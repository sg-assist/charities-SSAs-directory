#!/usr/bin/env npx tsx
/**
 * PDF Document Ingestion CLI Script
 *
 * Ingests PDF files from docs/pdf-files/ into the knowledge base.
 * Uses SHA-256 hash-based change detection to skip unchanged files.
 * Extracts text via pdf-parse, cleans it, chunks it, generates embeddings.
 *
 * Usage:
 *   npx tsx scripts/ingest-pdfs.ts --all           # process all PDFs in default dir
 *   npx tsx scripts/ingest-pdfs.ts --all --force   # re-process everything
 *   npx tsx scripts/ingest-pdfs.ts --all --dry-run
 *   npx tsx scripts/ingest-pdfs.ts --file "path/to/file.pdf"
 *   npx tsx scripts/ingest-pdfs.ts --dir "path/to/dir"
 *   npx tsx scripts/ingest-pdfs.ts --status
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { chunkPdfText, countWords } from '../services/chunkingService';
import { isEmbeddingAvailable, generateEmbeddingBatch } from '../services/embeddingService';

// Load .env.local for local development
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function createPrismaClient() {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');
  const adapter = new PrismaPg({ connectionString: dbUrl });
  return new PrismaClient({ adapter });
}

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = createPrismaClient();
  return _prisma;
}

const VERTICAL = 'DIRECTORY';
const DEFAULT_DIR = path.resolve(__dirname, '../../docs/pdf-files');

interface CliArgs {
  file?: string;
  dir?: string;
  all: boolean;
  force: boolean;
  dryRun: boolean;
  status: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { all: false, force: false, dryRun: false, status: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file': result.file = args[++i]; break;
      case '--dir': result.dir = args[++i]; break;
      case '--all': result.all = true; break;
      case '--force': result.force = true; break;
      case '--dry-run': result.dryRun = true; break;
      case '--status': result.status = true; break;
      case '--help': printHelp(); process.exit(0);
    }
  }

  return result;
}

function printHelp() {
  console.log(`
PDF Document Ingestion Script

Options:
  --all                Ingest all PDFs from the default directory
  --dir <path>         Directory containing .pdf files (overrides default)
  --file <path>        Single .pdf file to ingest
  --force              Re-ingest even if file hash is unchanged
  --dry-run            Show what would be ingested without writing to database
  --status             Show current PDF corpus status and exit
  --help               Show this help

Default directory: ${DEFAULT_DIR}
`);
}

function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function derivePdfSlug(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function extractPdfTitle(info: Record<string, string>, filename: string): string {
  const infoTitle = info?.Title?.trim();
  if (infoTitle && infoTitle.length > 3 && infoTitle.length < 200) {
    return infoTitle;
  }
  // Humanize filename
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

interface IngestResult {
  created: boolean;
  updated: boolean;
  skipped: boolean;
  noText: boolean;
  chunks: number;
  embeddings: number;
  words: number;
}

async function ingestFile(
  filePath: string,
  options: { force: boolean; dryRun: boolean }
): Promise<IngestResult> {
  const resolvedPath = path.resolve(filePath);
  const filename = path.basename(resolvedPath);
  const buffer = fs.readFileSync(resolvedPath);
  const sha256 = computeSha256(buffer);
  const slug = derivePdfSlug(filename);

  // Decision gate (skip hash lookup on dry-run for speed)
  if (!options.dryRun) {
    const existing = await (getPrisma() as any).pdfIngestRecord.findUnique({
      where: { filename },
    });

    if (existing) {
      if (!options.force && existing.sha256 === sha256) {
        console.log(`  [SKIP] ${filename} — hash unchanged`);
        return { created: false, updated: false, skipped: true, noText: false, chunks: 0, embeddings: 0, words: 0 };
      }
      if (!options.force && existing.sha256 !== sha256) {
        console.log(`  [CHANGED] ${filename} — hash changed, re-ingesting`);
      }
    }
  }

  // Extract text from PDF
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  let pdfData: { text: string; numpages: number; info: Record<string, string> };
  try {
    pdfData = await pdfParse(buffer, { max: 0 });
  } catch (err) {
    const msg = `pdf-parse failed: ${err}`;
    if (!options.dryRun) {
      await (getPrisma() as any).pdfIngestRecord.upsert({
        where: { filename },
        create: { filename, slug, filePath: resolvedPath, sha256, pageCount: 0, wordCount: 0, status: 'failed', errorMessage: msg },
        update: { sha256, filePath: resolvedPath, status: 'failed', errorMessage: msg, updatedAt: new Date() },
      });
    }
    throw new Error(msg);
  }

  const title = extractPdfTitle(pdfData.info, filename);
  const pageCount = pdfData.numpages;
  const wordCount = countWords(pdfData.text);

  if (options.dryRun) {
    const label = wordCount < 50 ? '[DRY/NO-TEXT]' : '[DRY]';
    console.log(`  ${label} ${filename} — "${title}" (${pageCount} pages, ${wordCount.toLocaleString()} words)`);
    return { created: true, updated: false, skipped: false, noText: wordCount < 50, chunks: 0, embeddings: 0, words: wordCount };
  }

  // No usable text (scanned/image PDF)
  if (wordCount < 50) {
    console.log(`  [NO-TEXT] ${filename} — only ${wordCount} words extracted (likely scanned)`);
    await (getPrisma() as any).pdfIngestRecord.upsert({
      where: { filename },
      create: { filename, slug, filePath: resolvedPath, sha256, pageCount, wordCount, status: 'no-text' },
      update: { sha256, filePath: resolvedPath, pageCount, wordCount, status: 'no-text', errorMessage: null, updatedAt: new Date() },
    });
    return { created: false, updated: false, skipped: false, noText: true, chunks: 0, embeddings: 0, words: wordCount };
  }

  const chunks = chunkPdfText(pdfData.text, title);

  // Check if KnowledgeDocument already exists for this slug
  const existingDoc = await getPrisma().knowledgeDocument.findUnique({ where: { slug } });
  if (existingDoc) {
    await getPrisma().knowledgeChunk.deleteMany({ where: { documentId: existingDoc.id } });
  }

  const metadata = {
    sourceFile: filename,
    sourceType: 'pdf',
    sha256,
    pageCount,
  };

  const document = await getPrisma().knowledgeDocument.upsert({
    where: { slug },
    create: { vertical: VERTICAL, title, slug, content: pdfData.text, wordCount, metadata, version: 1 },
    update: {
      vertical: VERTICAL, title, content: pdfData.text, wordCount, metadata,
      version: existingDoc ? existingDoc.version + 1 : 1,
    },
  });

  // Generate embeddings
  let embeddings: number[][] = [];
  if (isEmbeddingAvailable()) {
    try {
      const chunkTexts = chunks.map((c) => c.content);
      const results = await generateEmbeddingBatch(chunkTexts);
      embeddings = results.map((r) => r.embedding);
    } catch (error) {
      console.warn(`  [WARN] Embeddings failed for ${slug}: ${error}. Storing without embeddings.`);
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    if (embedding) {
      const embeddingStr = `[${embedding.join(',')}]`;
      await getPrisma().$executeRawUnsafe(
        `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
        generateCuid(), document.id, i, chunk.content, chunk.tokenCount, embeddingStr
      );
    } else {
      await getPrisma().knowledgeChunk.create({
        data: { documentId: document.id, chunkIndex: i, content: chunk.content, tokenCount: chunk.tokenCount },
      });
    }
  }

  // Upsert PdfIngestRecord
  await (getPrisma() as any).pdfIngestRecord.upsert({
    where: { filename },
    create: {
      filename, slug, filePath: resolvedPath, sha256,
      documentId: document.id, pageCount, wordCount, status: 'success',
    },
    update: {
      slug, filePath: resolvedPath, sha256,
      documentId: document.id, pageCount, wordCount, status: 'success', errorMessage: null,
      updatedAt: new Date(),
    },
  });

  const status = existingDoc ? 'UPDATE' : 'CREATE';
  const embStr = embeddings.length > 0 ? ` + ${embeddings.length} embeddings` : ' (no embeddings)';
  console.log(`  [${status}] ${filename} — "${title}" — ${chunks.length} chunks${embStr}`);

  return {
    created: !existingDoc,
    updated: !!existingDoc,
    skipped: false,
    noText: false,
    chunks: chunks.length,
    embeddings: embeddings.length,
    words: wordCount,
  };
}

async function ingestDirectory(
  dirPath: string,
  options: { force: boolean; dryRun: boolean }
) {
  const resolvedDir = path.resolve(dirPath);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`  Directory not found: ${resolvedDir}`);
    return { created: 0, updated: 0, skipped: 0, noText: 0, chunks: 0, embeddings: 0, words: 0, errors: 1 };
  }

  const files = fs.readdirSync(resolvedDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  console.log(`\n  Found ${files.length} PDF files in ${resolvedDir}\n`);

  let created = 0, updated = 0, skipped = 0, noText = 0, chunks = 0, embeddings = 0, words = 0, errors = 0;

  for (const file of files) {
    try {
      const result = await ingestFile(path.join(resolvedDir, file), options);
      if (result.created) created++;
      if (result.updated) updated++;
      if (result.skipped) skipped++;
      if (result.noText) noText++;
      chunks += result.chunks;
      embeddings += result.embeddings;
      words += result.words;
    } catch (error) {
      console.error(`  [ERROR] ${file}: ${error}`);
      errors++;
    }
  }

  return { created, updated, skipped, noText, chunks, embeddings, words, errors };
}

async function showStatus() {
  console.log('='.repeat(60));
  console.log('PDF Ingestion Status');
  console.log('='.repeat(60));

  // pgvector check
  try {
    const extensions = await getPrisma().$queryRawUnsafe(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`
    ) as Array<{ extname: string; extversion: string }>;
    console.log(`\n  pgvector: ${extensions.length > 0 ? `ENABLED (v${extensions[0].extversion})` : 'NOT ENABLED'}`);
  } catch {
    console.log('\n  pgvector: UNKNOWN');
  }

  console.log(`  Embeddings: ${isEmbeddingAvailable() ? 'AVAILABLE (OPENAI_API_KEY set)' : 'UNAVAILABLE (no OPENAI_API_KEY)'}`);

  // PDF ingest records
  console.log('\n  PDF ingest records:');
  try {
    const records = await (getPrisma() as any).pdfIngestRecord.findMany() as Array<{
      filename: string; sha256: string; status: string;
    }>;
    const successCount = records.filter((r) => r.status === 'success').length;
    const failedCount = records.filter((r) => r.status === 'failed').length;
    const noTextCount = records.filter((r) => r.status === 'no-text').length;
    console.log(`    success:  ${successCount}`);
    console.log(`    failed:   ${failedCount}`);
    console.log(`    no-text:  ${noTextCount}`);

    // Disk stats
    console.log('\n  PDF files on disk:');
    if (fs.existsSync(DEFAULT_DIR)) {
      const diskFiles = fs.readdirSync(DEFAULT_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
      console.log(`    ${diskFiles.length} files in ${DEFAULT_DIR}`);

      const trackedFilenames = new Set(records.map((r) => r.filename));
      const untracked = diskFiles.filter((f) => !trackedFilenames.has(f));
      console.log(`    ${untracked.length} untracked (not yet ingested)`);

      // Changed: on disk but hash differs from record
      let changed = 0;
      for (const file of diskFiles) {
        const record = records.find((r) => r.filename === file);
        if (record) {
          const buffer = fs.readFileSync(path.join(DEFAULT_DIR, file));
          const currentHash = computeSha256(buffer);
          if (currentHash !== record.sha256) changed++;
        }
      }
      console.log(`    ${changed} changed (hash mismatch — needs re-run)`);
    } else {
      console.log(`    Directory not found: ${DEFAULT_DIR}`);
    }
  } catch (err) {
    console.log(`    pdf_ingest_records table not found (run: npx prisma db push)\n    ${err}`);
  }

  console.log('\n' + '='.repeat(60));
}

async function main() {
  const args = parseArgs();

  if (args.status) {
    await showStatus();
    if (_prisma) await _prisma.$disconnect();
    return;
  }

  if (!args.all && !args.file && !args.dir) {
    console.error('Error: --all, --file, or --dir is required');
    printHelp();
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('PDF Document Ingestion');
  console.log(`Mode:      ${args.dryRun ? 'DRY RUN' : args.force ? 'FORCE UPDATE' : 'NEW / CHANGED ONLY'}`);
  console.log(`Vertical:  ${VERTICAL}`);
  console.log(`Embedding: ${isEmbeddingAvailable() ? 'ENABLED' : 'DISABLED (no OPENAI_API_KEY)'}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let grandTotal = { created: 0, updated: 0, skipped: 0, noText: 0, chunks: 0, embeddings: 0, words: 0, errors: 0 };

  if (args.file) {
    const resolvedFile = path.resolve(args.file);
    if (!fs.existsSync(resolvedFile)) {
      console.error(`File not found: ${resolvedFile}`);
      process.exit(1);
    }
    console.log(`\nIngesting single file: ${resolvedFile}`);
    try {
      const result = await ingestFile(resolvedFile, { force: args.force, dryRun: args.dryRun });
      if (result.created) grandTotal.created++;
      if (result.updated) grandTotal.updated++;
      if (result.skipped) grandTotal.skipped++;
      if (result.noText) grandTotal.noText++;
      grandTotal.chunks += result.chunks;
      grandTotal.embeddings += result.embeddings;
      grandTotal.words += result.words;
    } catch (error) {
      console.error(`  ERROR: ${error}`);
      grandTotal.errors++;
    }
  } else {
    const dir = args.dir || DEFAULT_DIR;
    const result = await ingestDirectory(dir, { force: args.force, dryRun: args.dryRun });
    grandTotal = { ...result };
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log(`Ingestion Complete (${duration}s)`);
  console.log(`  Created:    ${grandTotal.created}`);
  console.log(`  Updated:    ${grandTotal.updated}`);
  console.log(`  Skipped:    ${grandTotal.skipped}`);
  console.log(`  No-text:    ${grandTotal.noText}`);
  console.log(`  Chunks:     ${grandTotal.chunks}`);
  console.log(`  Embeddings: ${grandTotal.embeddings}`);
  console.log(`  Words:      ${grandTotal.words.toLocaleString()}`);
  console.log(`  Errors:     ${grandTotal.errors}`);

  if (!isEmbeddingAvailable() && !args.dryRun) {
    console.log('\n  NOTE: Documents stored WITHOUT embeddings.');
    console.log('  Set OPENAI_API_KEY and re-run with --force to generate embeddings.');
    console.log('  Text-based fallback search will work in the meantime.');
  }

  if (args.dryRun) {
    console.log('\n  This was a DRY RUN — no changes were made to the database.');
  }

  console.log('='.repeat(60));

  if (_prisma) await _prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  if (_prisma) _prisma.$disconnect().catch(() => {});
  process.exit(1);
});
