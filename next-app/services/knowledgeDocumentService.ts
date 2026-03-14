/**
 * Knowledge Document Service
 *
 * Core service for the UNFPA institutional knowledge base.
 * Handles ingestion, chunking, embedding, and semantic search.
 */

import { prisma } from '@/lib/prisma';
import { chunkDocument, countWords } from './chunkingService';
import { generateEmbedding, generateEmbeddingBatch, isEmbeddingAvailable } from './embeddingService';
import type {
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  IngestResult,
  IngestDocumentResult,
  KnowledgeDocumentSummary,
  KnowledgeDocumentMetadata,
} from '@/types/corpus';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Ingestion
// ============================================

export async function ingestDirectory(
  dirPath: string,
  vertical: string,
  options?: { force?: boolean }
): Promise<IngestResult> {
  const startTime = Date.now();
  const result: IngestResult = {
    documentsProcessed: 0,
    documentsCreated: 0,
    documentsUpdated: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    errors: [],
    duration: 0,
  };

  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory not found: ${resolvedPath}`);
  }

  const files = fs.readdirSync(resolvedPath)
    .filter((f: string) => f.endsWith('.md') && f !== 'INDEX.md')
    .sort();

  console.log(`[KnowledgeIngestion] Found ${files.length} markdown files in ${resolvedPath}`);

  for (const file of files) {
    const filePath = path.join(resolvedPath, file);
    result.documentsProcessed++;

    try {
      const slug = deriveSlug(file);
      const existing = await prisma.knowledgeDocument.findUnique({ where: { slug } });

      if (existing && !options?.force) {
        console.log(`[KnowledgeIngestion] Skipping ${file} (already exists)`);
        continue;
      }

      const docResult = await ingestDocument(filePath, vertical, { force: options?.force });
      if (existing) {
        result.documentsUpdated++;
      } else {
        result.documentsCreated++;
      }
      result.chunksCreated += docResult.chunksCreated;
      result.embeddingsGenerated += docResult.embeddingsGenerated;

      console.log(
        `[KnowledgeIngestion] ${existing ? 'Updated' : 'Created'} ${file}: ` +
        `${docResult.chunksCreated} chunks, ${docResult.embeddingsGenerated} embeddings`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[KnowledgeIngestion] Error processing ${file}: ${message}`);
      result.errors.push({ file, error: message });
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

export async function ingestDocument(
  filePath: string,
  vertical: string,
  options?: { force?: boolean }
): Promise<IngestDocumentResult> {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  const filename = path.basename(resolvedPath);
  const slug = deriveSlug(filename);

  // Parse and strip YAML frontmatter
  const { content, frontmatter } = parseFrontmatter(rawContent);
  const title = frontmatter.TITLE || extractTitle(content, filename);
  const wordCount = countWords(content);
  const metadata = extractMetadata(content, filename, frontmatter);

  const existing = await prisma.knowledgeDocument.findUnique({
    where: { slug },
    include: { chunks: true },
  });

  if (existing && !options?.force) {
    return { document: existing as any, chunksCreated: 0, embeddingsGenerated: 0 };
  }

  if (existing) {
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: existing.id } });
  }

  const document = await prisma.knowledgeDocument.upsert({
    where: { slug },
    create: { vertical, title, slug, content, wordCount, metadata, version: 1 },
    update: {
      vertical, title, content, wordCount, metadata,
      version: existing ? existing.version + 1 : 1,
    },
  });

  const chunks = chunkDocument(content, title);

  let embeddingsGenerated = 0;
  const embeddingEnabled = isEmbeddingAvailable();
  let embeddings: number[][] = [];

  if (embeddingEnabled) {
    try {
      const chunkTexts = chunks.map((c) => c.content);
      const results = await generateEmbeddingBatch(chunkTexts);
      embeddings = results.map((r) => r.embedding);
      embeddingsGenerated = embeddings.length;
    } catch (error) {
      console.warn(`[KnowledgeIngestion] Embeddings failed for ${slug}: ${error}`);
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    if (embedding) {
      const embeddingStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
        generateCuid(),
        document.id,
        i,
        chunk.content,
        chunk.tokenCount,
        embeddingStr
      );
    } else {
      await prisma.knowledgeChunk.create({
        data: {
          documentId: document.id,
          chunkIndex: i,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
        },
      });
    }
  }

  return { document: document as any, chunksCreated: chunks.length, embeddingsGenerated };
}

// ============================================
// Querying
// ============================================

export async function searchKnowledge(
  query: string,
  options?: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  const limit = options?.limit || 5;
  const threshold = options?.threshold || 0.7;

  if (!isEmbeddingAvailable()) {
    console.warn('[KnowledgeSearch] Embedding service not available. Falling back to text search.');
    return searchKnowledgeByText(query, options);
  }

  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.embedding.join(',')}]`;

  let sql: string;
  let params: unknown[];

  if (options?.vertical) {
    sql = `
      SELECT
        kc.id,
        kc.content,
        kc.chunk_index,
        kd.slug as document_slug,
        kd.title as document_title,
        1 - (kc.embedding <=> $1::vector) as similarity
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kd.vertical = $2
        AND kc.embedding IS NOT NULL
        AND 1 - (kc.embedding <=> $1::vector) >= $3
      ORDER BY kc.embedding <=> $1::vector
      LIMIT $4
    `;
    params = [embeddingStr, options.vertical, threshold, limit];
  } else {
    sql = `
      SELECT
        kc.id,
        kc.content,
        kc.chunk_index,
        kd.slug as document_slug,
        kd.title as document_title,
        1 - (kc.embedding <=> $1::vector) as similarity
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kc.embedding IS NOT NULL
        AND 1 - (kc.embedding <=> $1::vector) >= $2
      ORDER BY kc.embedding <=> $1::vector
      LIMIT $3
    `;
    params = [embeddingStr, threshold, limit];
  }

  const results = await prisma.$queryRawUnsafe(sql, ...params) as Array<{
    id: string;
    content: string;
    chunk_index: number;
    document_slug: string;
    document_title: string;
    similarity: number;
  }>;

  return results.map((r) => ({
    documentSlug: r.document_slug,
    documentTitle: r.document_title,
    chunkIndex: r.chunk_index,
    chunkContent: r.content,
    similarity: Number(r.similarity),
  }));
}

async function searchKnowledgeByText(
  query: string,
  options?: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  const limit = options?.limit || 5;
  const searchTerms = query.split(/\s+/).filter(Boolean).slice(0, 5);

  const whereClause: Record<string, unknown> = {
    content: { contains: searchTerms[0], mode: 'insensitive' },
  };

  if (options?.vertical) {
    whereClause.document = { vertical: options.vertical };
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: whereClause,
    include: { document: { select: { slug: true, title: true } } },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return chunks.map((chunk: {
    document: { slug: string; title: string };
    chunkIndex: number;
    content: string;
  }) => ({
    documentSlug: chunk.document.slug,
    documentTitle: chunk.document.title,
    chunkIndex: chunk.chunkIndex,
    chunkContent: chunk.content,
    similarity: 0.5,
  }));
}

// ============================================
// CRUD
// ============================================

export async function getDocument(slug: string) {
  return prisma.knowledgeDocument.findUnique({
    where: { slug },
    include: {
      chunks: {
        orderBy: { chunkIndex: 'asc' },
        select: { id: true, chunkIndex: true, tokenCount: true, createdAt: true },
      },
    },
  });
}

export async function listDocuments(vertical?: string): Promise<KnowledgeDocumentSummary[]> {
  const where = vertical ? { vertical } : {};

  const docs = await prisma.knowledgeDocument.findMany({
    where,
    include: { _count: { select: { chunks: true } } },
    orderBy: [{ vertical: 'asc' }, { slug: 'asc' }],
  });

  return docs.map((doc: any) => ({
    id: doc.id,
    vertical: doc.vertical,
    title: doc.title,
    slug: doc.slug,
    wordCount: doc.wordCount,
    chunkCount: doc._count.chunks,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
}

export async function deleteDocument(slug: string): Promise<boolean> {
  const doc = await prisma.knowledgeDocument.findUnique({ where: { slug } });
  if (!doc) return false;
  await prisma.knowledgeDocument.delete({ where: { slug } });
  return true;
}

// ============================================
// Helpers
// ============================================

function deriveSlug(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/\s+/g, '-').toLowerCase();
}

function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return filename
    .replace(/\.md$/, '')
    .replace(/^[A-Z]+-[A-Z]+-\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns cleaned content (frontmatter stripped) and parsed frontmatter fields.
 */
function parseFrontmatter(raw: string): { content: string; frontmatter: Record<string, string> } {
  const frontmatter: Record<string, string> = {};

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { content: raw, frontmatter };
  }

  const yamlBlock = match[1];
  const rest = match[2];

  for (const line of yamlBlock.split('\n')) {
    const kv = line.match(/^([A-Z_]+):\s*(.+)$/);
    if (kv) {
      frontmatter[kv[1].trim()] = kv[2].trim();
    }
  }

  return { content: rest.trim(), frontmatter };
}

function extractMetadata(
  content: string,
  filename: string,
  frontmatter: Record<string, string>
): KnowledgeDocumentMetadata {
  const metadata: KnowledgeDocumentMetadata = {
    sourceFile: filename,
  };

  if (frontmatter.CODE) {
    metadata.code = frontmatter.CODE;
    metadata.documentId = frontmatter.CODE;
    // Extract block letter from CODE (e.g., UNFPA-O-01 → O)
    const blockMatch = frontmatter.CODE.match(/^(?:UNFPA|PMNCH)-([A-Z])-/);
    if (blockMatch) metadata.block = blockMatch[1];
  } else {
    const idMatch = filename.match(/^([A-Z]+-[A-Z]+-\d+)/i);
    if (idMatch) metadata.documentId = idMatch[1];
  }

  if (frontmatter.AUDIENCE) metadata.audience = frontmatter.AUDIENCE;
  if (frontmatter.TIER) metadata.tier = frontmatter.TIER;

  const h2Matches = content.matchAll(/^##\s+(.+)$/gm);
  const topics: string[] = [];
  for (const match of h2Matches) {
    topics.push(match[1].trim());
  }
  if (topics.length > 0) metadata.topics = topics;

  return metadata;
}

function generateCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
