/**
 * Clinical Chunking Service
 *
 * Integrity-preserving chunker for clinical content extracted via extract_clinical_pdf.py.
 * Unlike the general chunkingService.ts, this service:
 *
 *   - NEVER splits a table mid-row (tables are atomic chunks)
 *   - NEVER splits a numbered clinical protocol list
 *   - Records source page numbers for citation attribution
 *   - Auto-generates table captions as chunk prefixes (improves embedding quality)
 *   - Preserves heading context in every chunk ("Section 3.2 > Oxytocin use in AMTSL")
 *
 * Input: JSONL blocks from extract_clinical_pdf.py
 * Output: Chunks compatible with the existing KnowledgeChunk schema + citation fields
 */

export interface ClinicalBlock {
  type: 'heading' | 'paragraph' | 'table' | 'list';
  level?: number;          // heading level
  text?: string;           // heading or paragraph text
  caption?: string;        // table caption
  header?: string[];       // table header row
  rows?: string[][];       // table data rows
  ordered?: boolean;       // list: ordered or bulleted
  items?: string[];        // list items
  page: number;
}

export interface ClinicalChunk {
  index: number;
  content: string;
  tokenCount: number;
  wordCount: number;
  startPage: number;
  endPage: number;
  sectionHeading: string;    // Breadcrumb: "Chapter 3 > Section 3.2"
  sourceDocument?: string;   // e.g. "WHO PCPNC 2023"
  sourceSection?: string;    // e.g. "Section 3.2 — Active Management of Third Stage"
  sourcePage?: number;       // First page of this chunk
}

const TARGET_WORDS = 800;
const MAX_WORDS = 1500;    // Higher than general chunker to keep tables intact
const MIN_WORDS = 50;
const OVERLAP_WORDS = 80;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateTokens(wordCount: number): number {
  return Math.ceil(wordCount * 1.3);
}

function tableToMarkdown(block: ClinicalBlock): string {
  const lines: string[] = [];
  if (block.caption) lines.push(`**${block.caption}**\n`);
  if (block.header && block.header.length > 0) {
    lines.push('| ' + block.header.join(' | ') + ' |');
    lines.push('| ' + block.header.map(() => '---').join(' | ') + ' |');
  }
  for (const row of block.rows || []) {
    lines.push('| ' + row.map(cell => cell.replace(/\n/g, ' ')).join(' | ') + ' |');
  }
  return lines.join('\n');
}

function listToMarkdown(block: ClinicalBlock): string {
  if (!block.items) return '';
  return block.items
    .map((item, i) => block.ordered ? `${i + 1}. ${item}` : `- ${item}`)
    .join('\n');
}

function blockToText(block: ClinicalBlock): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level || 2)} ${block.text}`;
    case 'paragraph':
      return block.text || '';
    case 'table':
      return tableToMarkdown(block);
    case 'list':
      return listToMarkdown(block);
    default:
      return '';
  }
}

/**
 * Parse JSONL output from extract_clinical_pdf.py into typed blocks.
 */
export function parseClinicalJsonl(jsonl: string): ClinicalBlock[] {
  return jsonl
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as ClinicalBlock);
}

/**
 * Chunk clinical content from typed blocks.
 * Tables and protocol lists are kept intact as atomic chunks.
 */
export function chunkClinicalBlocks(
  blocks: ClinicalBlock[],
  documentTitle: string,
  sourceDocument?: string,
): ClinicalChunk[] {
  const chunks: ClinicalChunk[] = [];
  let chunkIndex = 0;

  // Track heading breadcrumb
  const headingStack: { level: number; text: string }[] = [];
  function currentBreadcrumb(): string {
    return headingStack.map(h => h.text).join(' > ');
  }
  function currentSection(): string {
    return headingStack[headingStack.length - 1]?.text || '';
  }

  // Current chunk accumulator
  let currentLines: string[] = [];
  let currentWords = 0;
  let currentStartPage = 1;
  let currentEndPage = 1;

  function flushChunk(overlapText = '') {
    if (currentWords < MIN_WORDS && !overlapText) return;

    const prefix = `# ${documentTitle}\n## ${currentBreadcrumb() || 'General'}\n\n`;
    const content = prefix + (overlapText ? `[...]\n${overlapText}\n` : '') + currentLines.join('\n\n');

    const wordCount = countWords(content);
    chunks.push({
      index: chunkIndex++,
      content,
      tokenCount: estimateTokens(wordCount),
      wordCount,
      startPage: currentStartPage,
      endPage: currentEndPage,
      sectionHeading: currentBreadcrumb(),
      sourceDocument,
      sourceSection: currentSection(),
      sourcePage: currentStartPage,
    });

    currentLines = [];
    currentWords = 0;
  }

  function getOverlapText(): string {
    // Take last OVERLAP_WORDS from current accumulator
    const allText = currentLines.join(' ');
    const words = allText.split(/\s+/);
    return words.slice(-OVERLAP_WORDS).join(' ');
  }

  let blockIdx = 0;
  for (const block of blocks) {
    blockIdx++;

    // Update heading stack
    if (block.type === 'heading') {
      const level = block.level || 1;
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text: block.text || '' });

      // Headings trigger a chunk flush if we have enough content
      if (currentWords >= TARGET_WORDS) {
        const overlap = getOverlapText();
        flushChunk(overlap);
        currentStartPage = block.page;
      }
    }

    const blockText = blockToText(block);
    const blockWords = countWords(blockText);
    currentEndPage = block.page;

    // Tables and lists are ATOMIC — never split, always their own chunk if large
    if (block.type === 'table' || block.type === 'list') {
      if (blockWords > MAX_WORDS) {
        // Oversized table: flush current, then emit table as its own chunk
        if (currentWords >= MIN_WORDS) {
          flushChunk();
          currentStartPage = block.page;
        }
        // Emit the table/list as a standalone chunk
        const prefix = `# ${documentTitle}\n## ${currentBreadcrumb() || 'General'}\n\n`;
        const content = prefix + blockText;
        const wordCount = countWords(content);
        chunks.push({
          index: chunkIndex++,
          content,
          tokenCount: estimateTokens(wordCount),
          wordCount,
          startPage: block.page,
          endPage: block.page,
          sectionHeading: currentBreadcrumb(),
          sourceDocument,
          sourceSection: currentSection(),
          sourcePage: block.page,
        });
        currentStartPage = block.page;
        continue;
      }

      // Table fits within MAX_WORDS — try to fit in current chunk
      if (currentWords + blockWords > MAX_WORDS && currentWords >= MIN_WORDS) {
        // Flush current, start new chunk with table
        const overlap = getOverlapText();
        flushChunk(overlap);
        currentStartPage = block.page;
      }

      currentLines.push(blockText);
      currentWords += blockWords;
      continue;
    }

    // Regular content: flush if we'd exceed MAX_WORDS
    if (currentWords + blockWords > MAX_WORDS && currentWords >= MIN_WORDS) {
      const overlap = getOverlapText();
      flushChunk(overlap);
      currentStartPage = block.page;
    }

    currentLines.push(blockText);
    currentWords += blockWords;

    // Flush at TARGET_WORDS (soft boundary — only at paragraph breaks)
    if (currentWords >= TARGET_WORDS && block.type === 'paragraph') {
      const overlap = getOverlapText();
      flushChunk(overlap);
      currentStartPage = block.page;
    }
  }

  // Final flush
  if (currentWords >= MIN_WORDS) {
    flushChunk();
  }

  return chunks;
}

/**
 * Full pipeline: JSONL string → typed blocks → chunks.
 */
export function chunkClinicalContent(
  jsonl: string,
  documentTitle: string,
  sourceDocument?: string,
): ClinicalChunk[] {
  const blocks = parseClinicalJsonl(jsonl);
  return chunkClinicalBlocks(blocks, documentTitle, sourceDocument);
}
