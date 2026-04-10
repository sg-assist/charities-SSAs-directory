#!/usr/bin/env npx ts-node
/**
 * Clinical Knowledge Ingestion Script
 *
 * Ingests clinical PDFs (WHO guidelines, UNFPA handbooks, MOH SOPs) into the
 * knowledge base using the integrity-preserving clinical chunking pipeline.
 *
 * Pipeline:
 *   1. Run extract_clinical_pdf.py on each PDF → typed JSONL blocks
 *   2. Parse JSONL → chunk with clinicalChunkingService (table-safe)
 *   3. Generate embeddings for each chunk (multilingual MiniLM)
 *   4. Upsert to PostgreSQL with full citation metadata
 *   5. Register in ClinicalSource table with SHA-256 + review metadata
 *
 * Usage:
 *   npx ts-node scripts/ingest-clinical.ts --all
 *   npx ts-node scripts/ingest-clinical.ts --file /path/to/who-pcpnc-2023.pdf --vertical CLINICAL
 *   npx ts-node scripts/ingest-clinical.ts --formulary   # ingest formulary.json
 *   npx ts-node scripts/ingest-clinical.ts --dry-run     # preview without writing
 *
 * Requires:
 *   - Python 3 + pymupdf + camelot-py installed
 *   - DATABASE_URL and OPENAI_API_KEY in .env
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { parseArgs } from 'util';
import { prisma } from '@/lib/prisma';
import { chunkClinicalContent } from '@/services/clinicalChunkingService';
import { generateEmbeddingBatch, isEmbeddingAvailable } from '@/services/embeddingService';

// ── Config ────────────────────────────────────────────────────────────────────

const CLINICAL_SOURCES_DIR = path.resolve(__dirname, '../../docs/knowledge-base/clinical');
const MISP_SOURCES_DIR = path.resolve(__dirname, '../../docs/knowledge-base/misp');
const CHW_SOURCES_DIR = path.resolve(__dirname, '../../docs/knowledge-base/chw');
const MOH_SOURCES_DIR = path.resolve(__dirname, '../../docs/knowledge-base/moh');
const FORMULARY_PATH = path.resolve(__dirname, '../../docs/knowledge-base/formulary/formulary.json');
const PYTHON_EXTRACTOR = path.resolve(__dirname, '../../scripts/extract_clinical_pdf.py');
const TEMP_JSONL_DIR = path.resolve(__dirname, '../../.tmp/clinical-extract');

// Vertical codes by source directory
const VERTICAL_MAP: Record<string, string> = {
  [CLINICAL_SOURCES_DIR]: 'CLINICAL',
  [MISP_SOURCES_DIR]: 'MISP',
  [CHW_SOURCES_DIR]: 'CHW',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function generateCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function deriveSlug(filename: string): string {
  return filename.replace(/\.pdf$/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

// ── PDF extraction via Python ─────────────────────────────────────────────────

function extractPdfToJsonl(pdfPath: string, sourceName: string): string {
  fs.mkdirSync(TEMP_JSONL_DIR, { recursive: true });
  const slug = deriveSlug(path.basename(pdfPath));
  const jsonlPath = path.join(TEMP_JSONL_DIR, `${slug}.jsonl`);

  console.log(`[Extract] Running Python extractor on ${path.basename(pdfPath)}...`);
  execSync(
    `python3 "${PYTHON_EXTRACTOR}" "${pdfPath}" "${jsonlPath}" --source-name "${sourceName}"`,
    { stdio: 'inherit' }
  );

  return fs.readFileSync(jsonlPath, 'utf-8');
}

// ── Clinical document ingestion ───────────────────────────────────────────────

interface SourceMetadata {
  title: string;
  shortName: string;
  publisher: string;
  edition?: string;
  publicationYear: number;
  sourceUrl?: string;
  redistributionOk: boolean;
  clinicalReviewer?: string;
  expiryDate?: Date;
}

async function ingestClinicalPdf(
  pdfPath: string,
  vertical: string,
  sourceMeta: SourceMetadata,
  options: { force?: boolean; dryRun?: boolean }
): Promise<{ chunksCreated: number; embeddingsGenerated: number; skipped: boolean }> {
  const filename = path.basename(pdfPath);
  const slug = deriveSlug(filename);
  const sha256 = sha256File(pdfPath);

  // Check for existing record
  const existingSource = await prisma.clinicalSource.findUnique({ where: { slug } }).catch(() => null);
  if (existingSource && existingSource.sha256 === sha256 && !options.force) {
    console.log(`[Skip] ${filename} — unchanged (SHA-256 match)`);
    return { chunksCreated: 0, embeddingsGenerated: 0, skipped: true };
  }

  console.log(`[Ingest] ${filename} → ${vertical}`);

  if (options.dryRun) {
    console.log(`[DryRun] Would ingest ${filename} into ${vertical}`);
    return { chunksCreated: 0, embeddingsGenerated: 0, skipped: false };
  }

  // Extract PDF to JSONL
  const jsonl = extractPdfToJsonl(pdfPath, sourceMeta.shortName);

  // Chunk with clinical service (table-safe)
  const chunks = chunkClinicalContent(jsonl, sourceMeta.title, sourceMeta.shortName);
  console.log(`[Chunk] ${chunks.length} chunks from ${filename}`);

  // Register/update ClinicalSource
  const clinicalSource = await prisma.clinicalSource.upsert({
    where: { slug },
    create: {
      slug,
      ...sourceMeta,
      sha256,
      ingestedAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      ...sourceMeta,
      sha256,
      updatedAt: new Date(),
    },
  });

  // Upsert KnowledgeDocument
  const content = chunks.map(c => c.content).join('\n\n');
  const wordCount = chunks.reduce((sum, c) => sum + c.wordCount, 0);
  const document = await prisma.knowledgeDocument.upsert({
    where: { slug },
    create: {
      vertical,
      title: sourceMeta.title,
      slug,
      content,
      wordCount,
      metadata: {
        sourceFile: filename,
        shortName: sourceMeta.shortName,
        publisher: sourceMeta.publisher,
        contentHash: sha256,
      },
      version: 1,
    },
    update: {
      vertical,
      title: sourceMeta.title,
      content,
      wordCount,
      metadata: {
        sourceFile: filename,
        shortName: sourceMeta.shortName,
        publisher: sourceMeta.publisher,
        contentHash: sha256,
      },
    },
  });

  // Delete old chunks
  await prisma.knowledgeChunk.deleteMany({ where: { documentId: document.id } });

  // Generate embeddings
  let embeddings: number[][] = [];
  const embeddingEnabled = isEmbeddingAvailable();
  if (embeddingEnabled) {
    try {
      const chunkTexts = chunks.map(c => c.content);
      const results = await generateEmbeddingBatch(chunkTexts);
      embeddings = results.map(r => r.embedding);
      console.log(`[Embed] ${embeddings.length} embeddings for ${filename}`);
    } catch (err) {
      console.warn(`[Embed] Failed for ${filename}: ${err}`);
    }
  }

  // Insert chunks with citation metadata
  let embeddingsGenerated = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const contentHash = crypto.createHash('sha256').update(chunk.content).digest('hex');

    const chunkData = {
      documentId: document.id,
      chunkIndex: i,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      sourceDocument: chunk.sourceDocument || sourceMeta.shortName,
      sourceEdition: sourceMeta.edition,
      sourceSection: chunk.sourceSection,
      sourcePage: chunk.sourcePage,
      sourceUrl: sourceMeta.sourceUrl,
      contentHash,
      expiryDate: sourceMeta.expiryDate,
      clinicalSourceId: clinicalSource.id,
    };

    if (embedding) {
      const embeddingStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count, embedding,
           source_document, source_edition, source_section, source_page, source_url,
           content_hash, expiry_date, clinical_source_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        generateCuid(),
        chunkData.documentId,
        chunkData.chunkIndex,
        chunkData.content,
        chunkData.tokenCount,
        embeddingStr,
        chunkData.sourceDocument,
        chunkData.sourceEdition,
        chunkData.sourceSection,
        chunkData.sourcePage,
        chunkData.sourceUrl,
        chunkData.contentHash,
        chunkData.expiryDate,
        chunkData.clinicalSourceId,
      );
      embeddingsGenerated++;
    } else {
      await prisma.knowledgeChunk.create({ data: chunkData });
    }
  }

  return { chunksCreated: chunks.length, embeddingsGenerated, skipped: false };
}

// ── Formulary ingestion ───────────────────────────────────────────────────────

async function ingestFormulary(options: { dryRun?: boolean }): Promise<void> {
  if (!fs.existsSync(FORMULARY_PATH)) {
    console.warn(`[Formulary] Not found: ${FORMULARY_PATH}`);
    return;
  }

  const formulary = JSON.parse(fs.readFileSync(FORMULARY_PATH, 'utf-8'));
  const entries = Array.isArray(formulary) ? formulary : formulary.drugs || [];
  console.log(`[Formulary] ${entries.length} drug entries`);

  if (options.dryRun) {
    console.log('[DryRun] Would ingest formulary entries');
    return;
  }

  for (const entry of entries) {
    await prisma.formularyEntry.upsert({
      where: { drug: entry.drug },
      create: {
        drug: entry.drug,
        localNames: entry.localNames || {},
        indication: entry.indication,
        dose: entry.dose,
        route: entry.route,
        timing: entry.timing,
        contraindications: entry.contraindications || [],
        warnings: entry.warnings || [],
        source: entry.source,
        sourceChunkSlug: entry.sourceChunkId,
        sourceUrl: entry.sourceUrl,
        whoEmlListed: entry.whoEmlListed || false,
        reviewedBy: entry.reviewedBy,
        reviewedAt: entry.reviewedAt ? new Date(entry.reviewedAt) : null,
        expiryDate: entry.expiryDate ? new Date(entry.expiryDate) : null,
      },
      update: {
        localNames: entry.localNames || {},
        indication: entry.indication,
        dose: entry.dose,
        route: entry.route,
        timing: entry.timing,
        contraindications: entry.contraindications || [],
        warnings: entry.warnings || [],
        source: entry.source,
        sourceChunkSlug: entry.sourceChunkId,
        sourceUrl: entry.sourceUrl,
        whoEmlListed: entry.whoEmlListed || false,
        reviewedBy: entry.reviewedBy,
        reviewedAt: entry.reviewedAt ? new Date(entry.reviewedAt) : null,
        expiryDate: entry.expiryDate ? new Date(entry.expiryDate) : null,
        updatedAt: new Date(),
      },
    }).catch(err => console.warn(`[Formulary] Failed to upsert ${entry.drug}: ${err}`));
  }

  console.log('[Formulary] Done');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      all: { type: 'boolean', default: false },
      file: { type: 'string' },
      vertical: { type: 'string', default: 'CLINICAL' },
      formulary: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const dryRun = values['dry-run'] as boolean;
  const force = values.force as boolean;

  if (values.formulary || values.all) {
    await ingestFormulary({ dryRun });
  }

  if (values.all) {
    const sourceDirs = [CLINICAL_SOURCES_DIR, MISP_SOURCES_DIR, CHW_SOURCES_DIR];
    for (const dir of sourceDirs) {
      if (!fs.existsSync(dir)) {
        console.log(`[Skip] Directory not yet populated: ${dir}`);
        continue;
      }
      const vertical = VERTICAL_MAP[dir] || 'CLINICAL';
      const pdfs = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
      for (const pdf of pdfs) {
        const pdfPath = path.join(dir, pdf);
        const metaPath = pdfPath.replace('.pdf', '.meta.json');
        const meta: SourceMetadata = fs.existsSync(metaPath)
          ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          : {
              title: pdf.replace('.pdf', ''),
              shortName: pdf.replace('.pdf', ''),
              publisher: 'Unknown',
              publicationYear: new Date().getFullYear(),
              redistributionOk: false,
            };

        const result = await ingestClinicalPdf(pdfPath, vertical, meta, { force, dryRun });
        if (!result.skipped) {
          console.log(`[Done] ${pdf}: ${result.chunksCreated} chunks, ${result.embeddingsGenerated} embeddings`);
        }
      }

      // Also ingest MOH country directories
      if (fs.existsSync(MOH_SOURCES_DIR)) {
        for (const country of fs.readdirSync(MOH_SOURCES_DIR)) {
          const countryDir = path.join(MOH_SOURCES_DIR, country);
          if (!fs.statSync(countryDir).isDirectory()) continue;
          const mohVertical = `MOH_${country.toUpperCase()}`;
          const pdfs2 = fs.readdirSync(countryDir).filter(f => f.toLowerCase().endsWith('.pdf'));
          for (const pdf of pdfs2) {
            const pdfPath = path.join(countryDir, pdf);
            const metaPath = pdfPath.replace('.pdf', '.meta.json');
            const meta: SourceMetadata = fs.existsSync(metaPath)
              ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
              : {
                  title: pdf.replace('.pdf', ''),
                  shortName: pdf.replace('.pdf', ''),
                  publisher: `Ministry of Health, ${country}`,
                  publicationYear: new Date().getFullYear(),
                  redistributionOk: false,
                };
            const result = await ingestClinicalPdf(pdfPath, mohVertical, meta, { force, dryRun });
            if (!result.skipped) {
              console.log(`[Done] ${country}/${pdf}: ${result.chunksCreated} chunks`);
            }
          }
        }
      }
    }
  } else if (values.file) {
    const vertical = values.vertical as string;
    const metaPath = values.file.replace('.pdf', '.meta.json');
    const meta: SourceMetadata = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : {
          title: path.basename(values.file, '.pdf'),
          shortName: path.basename(values.file, '.pdf'),
          publisher: 'Unknown',
          publicationYear: new Date().getFullYear(),
          redistributionOk: false,
        };
    const result = await ingestClinicalPdf(values.file, vertical, meta, { force, dryRun });
    console.log(`[Done] ${values.file}: ${result.chunksCreated} chunks, ${result.embeddingsGenerated} embeddings`);
  } else {
    console.log('Usage:');
    console.log('  npx ts-node scripts/ingest-clinical.ts --all');
    console.log('  npx ts-node scripts/ingest-clinical.ts --file path/to/file.pdf --vertical CLINICAL');
    console.log('  npx ts-node scripts/ingest-clinical.ts --formulary');
    console.log('  npx ts-node scripts/ingest-clinical.ts --all --dry-run');
  }

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('[Fatal]', err);
  await prisma.$disconnect();
  process.exit(1);
});
