#!/usr/bin/env npx tsx
/**
 * UNFPA Knowledge Document Ingestion CLI Script
 *
 * Ingests markdown files from docs/knowledge-base/unfpa/ into the knowledge base.
 * Strips YAML frontmatter, chunks documents, generates embeddings, stores in PostgreSQL+pgvector.
 *
 * Usage:
 *   # Ingest all documents (recommended for first-time setup)
 *   npx tsx scripts/ingest-knowledge.ts --all
 *
 *   # Re-ingest (update existing documents, re-embed)
 *   npx tsx scripts/ingest-knowledge.ts --all --force
 *
 *   # Dry run (show what would be ingested without writing to DB)
 *   npx tsx scripts/ingest-knowledge.ts --all --dry-run
 *
 *   # Ingest a single document
 *   npx tsx scripts/ingest-knowledge.ts --file ../docs/knowledge-base/unfpa/UNFPA-O-01.md
 *
 *   # Check current corpus status
 *   npx tsx scripts/ingest-knowledge.ts --status
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { chunkDocument, countWords } from '../services/chunkingService';
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
  // Prisma 7 requires a driver adapter
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

const VERTICAL = 'UNFPA';
const DEFAULT_DIR = path.resolve(__dirname, '../../docs/knowledge-base/unfpa');

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
UNFPA Knowledge Document Ingestion Script

Options:
  --all                Ingest all documents from the default directory
  --dir <path>         Directory containing .md files (overrides default)
  --file <path>        Single .md file to ingest
  --force              Re-ingest even if document already exists
  --dry-run            Show what would be ingested without writing to database
  --status             Show current corpus status and exit
  --help               Show this help

Default directory: ${DEFAULT_DIR}
`);
}

function deriveSlug(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/\s+/g, '-').toLowerCase();
}

/**
 * Parse YAML frontmatter block.
 * Returns { content: string (frontmatter stripped), frontmatter: Record<string, string> }
 */
function parseFrontmatter(raw: string): { content: string; frontmatter: Record<string, string> } {
  const frontmatter: Record<string, string> = {};
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { content: raw, frontmatter };

  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Z_]+):\s*(.+)$/);
    if (kv) frontmatter[kv[1].trim()] = kv[2].trim();
  }

  return { content: match[2].trim(), frontmatter };
}

function extractTitle(content: string, filename: string, frontmatter: Record<string, string>): string {
  if (frontmatter.TITLE) return frontmatter.TITLE;
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
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
  chunks: number;
  embeddings: number;
  words: number;
}

async function ingestFile(
  filePath: string,
  options: { force: boolean; dryRun: boolean }
): Promise<IngestResult> {
  const resolvedPath = path.resolve(filePath);
  const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  const filename = path.basename(resolvedPath);
  const slug = deriveSlug(filename);

  const { content, frontmatter } = parseFrontmatter(rawContent);
  const title = extractTitle(content, filename, frontmatter);
  const wordCount = countWords(content);
  const chunks = chunkDocument(content, title);

  if (options.dryRun) {
    const code = frontmatter.CODE || filename.replace(/\.md$/, '');
    console.log(`  [DRY] ${code} — ${title} (${wordCount.toLocaleString()} words, ${chunks.length} chunks)`);
    return { created: true, updated: false, skipped: false, chunks: chunks.length, embeddings: 0, words: wordCount };
  }

  // Compute content hash for change detection
  const contentHash = crypto.createHash('sha256').update(rawContent).digest('hex');

  const existing = await getPrisma().knowledgeDocument.findUnique({ where: { slug } });

  if (existing && !options.force) {
    const existingHash = (existing.metadata as Record<string, unknown>)?.contentHash;
    if (existingHash === contentHash) {
      console.log(`  [SKIP] ${filename} — unchanged (hash match)`);
      return { created: false, updated: false, skipped: true, chunks: 0, embeddings: 0, words: 0 };
    }
    console.log(`  [CHANGE] ${filename} — content changed, re-ingesting...`);
  }

  if (existing) {
    await getPrisma().knowledgeChunk.deleteMany({ where: { documentId: existing.id } });
  }

  // Build metadata from frontmatter
  const blockMatch = (frontmatter.CODE || '').match(/^(?:UNFPA|PMNCH)-([A-Z])-/);
  const h2Matches = [...content.matchAll(/^##\s+(.+)$/gm)];
  const metadata = {
    sourceFile: filename,
    code: frontmatter.CODE || undefined,
    documentId: frontmatter.CODE || filename.replace(/\.md$/, ''),
    block: blockMatch?.[1] || undefined,
    audience: frontmatter.AUDIENCE || undefined,
    tier: frontmatter.TIER || undefined,
    topics: h2Matches.map((m) => m[1].trim()),
    contentHash,
  };

  const document = await getPrisma().knowledgeDocument.upsert({
    where: { slug },
    create: { vertical: VERTICAL, title, slug, content, wordCount, metadata, version: 1 },
    update: {
      vertical: VERTICAL, title, content, wordCount, metadata,
      version: existing ? existing.version + 1 : 1,
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

  const status = existing ? 'UPDATE' : 'CREATE';
  const embStr = embeddings.length > 0 ? ` + ${embeddings.length} embeddings` : ' (no embeddings)';
  console.log(`  [${status}] ${filename} — "${title}" — ${chunks.length} chunks${embStr}`);

  return {
    created: !existing,
    updated: !!existing,
    skipped: false,
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
    return { created: 0, updated: 0, skipped: 0, chunks: 0, embeddings: 0, words: 0, errors: 1 };
  }

  const files = fs.readdirSync(resolvedDir)
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
    .sort();

  console.log(`\n  Found ${files.length} markdown files in ${resolvedDir}\n`);

  let created = 0, updated = 0, skipped = 0, chunks = 0, embeddings = 0, words = 0, errors = 0;

  for (const file of files) {
    try {
      const result = await ingestFile(path.join(resolvedDir, file), options);
      if (result.created) created++;
      if (result.updated) updated++;
      if (result.skipped) skipped++;
      chunks += result.chunks;
      embeddings += result.embeddings;
      words += result.words;
    } catch (error) {
      console.error(`  [ERROR] ${file}: ${error}`);
      errors++;
    }
  }

  return { created, updated, skipped, chunks, embeddings, words, errors };
}

async function showStatus() {
  console.log('='.repeat(60));
  console.log('UNFPA Knowledge Corpus Status');
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

  // Document counts
  console.log('\n  Documents in database:');
  try {
    const docCount = await getPrisma().knowledgeDocument.count({ where: { vertical: VERTICAL } });
    const chunkCount = await getPrisma().knowledgeChunk.count({
      where: { document: { vertical: VERTICAL } },
    });

    let embeddingCount = 0;
    try {
      const result = await getPrisma().$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM knowledge_chunks kc
         JOIN knowledge_documents kd ON kd.id = kc.document_id
         WHERE kd.vertical = $1 AND kc.embedding IS NOT NULL`,
        VERTICAL
      ) as Array<{ count: bigint }>;
      embeddingCount = Number(result[0]?.count || 0);
    } catch { /* pgvector might not be enabled */ }

    const embStr = embeddingCount > 0 ? `, ${embeddingCount} with embeddings` : '';
    console.log(`    ${VERTICAL}: ${docCount} docs, ${chunkCount} chunks${embStr}`);
  } catch {
    console.log(`    ${VERTICAL}: table not found (run: npx prisma db push)`);
  }

  // Files on disk
  console.log('\n  Documents on disk:');
  if (fs.existsSync(DEFAULT_DIR)) {
    const files = fs.readdirSync(DEFAULT_DIR).filter((f) => f.endsWith('.md') && f !== 'INDEX.md');
    console.log(`    ${files.length} files in ${DEFAULT_DIR}`);
  } else {
    console.log(`    Directory not found: ${DEFAULT_DIR}`);
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
  console.log('UNFPA Knowledge Document Ingestion');
  console.log(`Mode:      ${args.dryRun ? 'DRY RUN' : args.force ? 'FORCE UPDATE' : 'NEW ONLY'}`);
  console.log(`Vertical:  ${VERTICAL}`);
  console.log(`Embedding: ${isEmbeddingAvailable() ? 'ENABLED' : 'DISABLED (no OPENAI_API_KEY)'}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let grandTotal = { created: 0, updated: 0, skipped: 0, chunks: 0, embeddings: 0, words: 0, errors: 0 };

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
