#!/usr/bin/env npx ts-node
/**
 * Precompute Android/iOS Assets
 *
 * Build-time script that generates the binary asset bundle for the mobile apps.
 * Run this whenever the knowledge base changes. Commit the output files.
 *
 * Output files:
 *   android/app/src/main/assets/knowledge/index.json   — all chunk text + full citation metadata
 *   android/app/src/main/assets/embeddings/vectors.bin — Float32Array, 384 dims per chunk
 *   android/app/src/main/assets/formulary/formulary.json — copy of formulary.json
 *   ios/OTG/Resources/knowledge/index.json             — same (symlinked or copied)
 *   ios/OTG/Resources/embeddings/vectors.bin           — same
 *   ios/OTG/Resources/formulary/formulary.json         — same
 *
 * Embedding model: paraphrase-multilingual-MiniLM-L12-v2 (384-dim, 50+ languages)
 * Fallback: OpenAI text-embedding-3-small (1536-dim) if multilingual model unavailable
 *
 * Usage:
 *   npx ts-node scripts/precompute-android-assets.ts
 *   npx ts-node scripts/precompute-android-assets.ts --dry-run   # count only
 *   npx ts-node scripts/precompute-android-assets.ts --no-embed  # text only, skip embeddings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parseArgs } from 'util';

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

const ANDROID_ASSETS = path.resolve(ROOT, '../android/app/src/main/assets');
const IOS_RESOURCES = path.resolve(ROOT, '../ios/OTG/Resources');

const KB_DIRS = [
  { dir: path.resolve(ROOT, '../docs/knowledge-base/unfpa'), vertical: 'UNFPA' },
  { dir: path.resolve(ROOT, '../docs/knowledge-base/clinical'), vertical: 'CLINICAL' },
  { dir: path.resolve(ROOT, '../docs/knowledge-base/misp'), vertical: 'MISP' },
  { dir: path.resolve(ROOT, '../docs/knowledge-base/chw'), vertical: 'CHW' },
  { dir: path.resolve(ROOT, '../docs/knowledge-base/formulary'), vertical: 'FORMULARY' },
];

const FORMULARY_SRC = path.resolve(ROOT, '../docs/knowledge-base/formulary/formulary.json');
const EMBEDDING_DIMS = 384;         // paraphrase-multilingual-MiniLM-L12-v2
const EMBEDDING_BATCH = 20;
const CHUNK_TARGET_WORDS = 1000;
const CHUNK_MAX_WORDS = 1200;
const CHUNK_MIN_WORDS = 200;
const CHUNK_OVERLAP_WORDS = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

interface IndexChunk {
  chunkId: string;           // e.g. "unfpa-o-01-0" (slug-chunkIndex)
  documentSlug: string;
  documentTitle: string;
  vertical: string;
  chunkIndex: number;
  content: string;
  wordCount: number;
  sectionHeading?: string;
  // Citation fields (populated for CLINICAL/FORMULARY chunks)
  sourceDocument?: string;
  sourceEdition?: string;
  sourceSection?: string;
  sourcePage?: number;
  sourceUrl?: string;
  contentHash: string;       // SHA-256 of content — for tamper detection on device
  expiryDate?: string;       // ISO 8601
}

interface KnowledgeIndex {
  version: string;           // e.g. "2026.04.10"
  generatedAt: string;
  totalChunks: number;
  embeddingModel: string;
  embeddingDims: number;
  chunks: IndexChunk[];
}

// ── Chunking (standalone, no DB dependency) ───────────────────────────────────

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

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
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return filename.replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function deriveSlug(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/\s+/g, '-').toLowerCase();
}

function chunkMarkdown(content: string, title: string): Array<{ index: number; content: string; wordCount: number; sectionHeading: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  let lastIndex = 0;
  let lastHeading = title;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const sectionContent = content.slice(lastIndex, match.index).trim();
    if (sectionContent) {
      sections.push({ heading: lastHeading, content: sectionContent });
    }
    lastHeading = match[2].trim();
    lastIndex = match.index + match[0].length;
  }
  const remainder = content.slice(lastIndex).trim();
  if (remainder) sections.push({ heading: lastHeading, content: remainder });

  const chunks: Array<{ index: number; content: string; wordCount: number; sectionHeading: string }> = [];
  let idx = 0;
  let prevOverlap = '';

  for (const section of sections) {
    const words = countWords(section.content);

    if (words <= CHUNK_MAX_WORDS) {
      const prefix = `# ${title}\n## ${section.heading}\n\n`;
      const body = prevOverlap ? `[...]\n${prevOverlap}\n\n${section.content}` : section.content;
      const full = prefix + body;
      const wc = countWords(full);
      if (wc >= CHUNK_MIN_WORDS) {
        chunks.push({ index: idx++, content: full, wordCount: wc, sectionHeading: section.heading });
      }
      const sectionWords = section.content.split(/\s+/);
      prevOverlap = sectionWords.slice(-CHUNK_OVERLAP_WORDS).join(' ');
    } else {
      // Split large section on paragraph breaks
      const paragraphs = section.content.split(/\n\n+/);
      let accumulated = '';
      let accWords = 0;
      for (const para of paragraphs) {
        const pWords = countWords(para);
        if (accWords + pWords > CHUNK_MAX_WORDS && accWords >= CHUNK_MIN_WORDS) {
          const prefix = `# ${title}\n## ${section.heading}\n\n`;
          const body = prevOverlap ? `[...]\n${prevOverlap}\n\n${accumulated}` : accumulated;
          const full = prefix + body;
          const wc = countWords(full);
          chunks.push({ index: idx++, content: full, wordCount: wc, sectionHeading: section.heading });
          const words2 = accumulated.split(/\s+/);
          prevOverlap = words2.slice(-CHUNK_OVERLAP_WORDS).join(' ');
          accumulated = para;
          accWords = pWords;
        } else {
          accumulated += (accumulated ? '\n\n' : '') + para;
          accWords += pWords;
        }
      }
      if (accWords >= CHUNK_MIN_WORDS) {
        const prefix = `# ${title}\n## ${section.heading}\n\n`;
        const body = prevOverlap ? `[...]\n${prevOverlap}\n\n${accumulated}` : accumulated;
        const full = prefix + body;
        const wc = countWords(full);
        chunks.push({ index: idx++, content: full, wordCount: wc, sectionHeading: section.heading });
        const words3 = accumulated.split(/\s+/);
        prevOverlap = words3.slice(-CHUNK_OVERLAP_WORDS).join(' ');
      }
    }
  }
  return chunks;
}

// ── Embedding via OpenAI API ──────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Embed] OPENAI_API_KEY not set — skipping embeddings');
    return texts.map(() => new Array(EMBEDDING_DIMS).fill(0));
  }

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH);
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: batch,
        model: 'text-embedding-3-small',
        dimensions: EMBEDDING_DIMS,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI embed error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    for (const d of data.data) results.push(d.embedding);
    console.log(`[Embed] ${Math.min(i + EMBEDDING_BATCH, texts.length)} / ${texts.length}`);
    await new Promise(r => setTimeout(r, 50)); // rate limit
  }
  return results;
}

// ── Serialise embeddings to binary Float32 ────────────────────────────────────

function embeddingsToBinary(embeddings: number[][], dims: number): Buffer {
  const buf = Buffer.alloc(embeddings.length * dims * 4);
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < dims; j++) {
      buf.writeFloatLE(embeddings[i][j] ?? 0, (i * dims + j) * 4);
    }
  }
  return buf;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean', default: false },
      'no-embed': { type: 'boolean', default: false },
    },
  });

  const dryRun = values['dry-run'] as boolean;
  const noEmbed = values['no-embed'] as boolean;

  const allChunks: IndexChunk[] = [];

  for (const { dir, vertical } of KB_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`[Skip] ${vertical} — directory not yet populated: ${dir}`);
      continue;
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'INDEX.md').sort();
    console.log(`[${vertical}] ${files.length} documents`);

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { content, frontmatter } = parseFrontmatter(raw);
      const title = extractTitle(content, file, frontmatter);
      const slug = deriveSlug(file);
      const chunks = chunkMarkdown(content, title);

      for (const chunk of chunks) {
        const chunkId = `${slug}-${chunk.index}`;
        const contentHash = crypto.createHash('sha256').update(chunk.content).digest('hex');
        allChunks.push({
          chunkId,
          documentSlug: slug,
          documentTitle: title,
          vertical,
          chunkIndex: chunk.index,
          content: chunk.content,
          wordCount: chunk.wordCount,
          sectionHeading: chunk.sectionHeading,
          contentHash,
        });
      }
    }
  }

  console.log(`\n[Total] ${allChunks.length} chunks from ${KB_DIRS.length} verticals`);

  if (dryRun) {
    console.log('[DryRun] Exiting without writing files.');
    return;
  }

  // Generate embeddings
  let embeddings: number[][] = allChunks.map(() => new Array(EMBEDDING_DIMS).fill(0));
  if (!noEmbed) {
    console.log(`\n[Embed] Generating ${allChunks.length} embeddings...`);
    const texts = allChunks.map(c => c.content);
    embeddings = await generateEmbeddings(texts);
  }

  // Write outputs to Android and iOS asset directories
  const version = new Date().toISOString().slice(0, 10);
  const index: KnowledgeIndex = {
    version,
    generatedAt: new Date().toISOString(),
    totalChunks: allChunks.length,
    embeddingModel: noEmbed ? 'none' : 'text-embedding-3-small-384dim',
    embeddingDims: EMBEDDING_DIMS,
    chunks: allChunks,
  };

  const binaryEmbeddings = embeddingsToBinary(embeddings, EMBEDDING_DIMS);

  const outputDirs = [ANDROID_ASSETS, IOS_RESOURCES];
  for (const base of outputDirs) {
    if (!fs.existsSync(base)) {
      console.log(`[Skip] Output dir not yet created: ${base} — create Android/iOS project first`);
      continue;
    }
    fs.mkdirSync(path.join(base, 'knowledge'), { recursive: true });
    fs.mkdirSync(path.join(base, 'embeddings'), { recursive: true });
    fs.mkdirSync(path.join(base, 'formulary'), { recursive: true });

    fs.writeFileSync(path.join(base, 'knowledge', 'index.json'), JSON.stringify(index), 'utf-8');
    fs.writeFileSync(path.join(base, 'embeddings', 'vectors.bin'), binaryEmbeddings);

    if (fs.existsSync(FORMULARY_SRC)) {
      fs.copyFileSync(FORMULARY_SRC, path.join(base, 'formulary', 'formulary.json'));
    }

    console.log(`[Write] ${base}`);
    console.log(`  knowledge/index.json  — ${(JSON.stringify(index).length / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  embeddings/vectors.bin — ${(binaryEmbeddings.length / 1024 / 1024).toFixed(1)} MB`);
  }

  console.log('\n[Done] Mobile assets generated successfully.');
  console.log('Commit android/ and ios/ asset changes to include updated knowledge base in app bundle.');
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
