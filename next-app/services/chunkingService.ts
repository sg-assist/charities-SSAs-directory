/**
 * Document Chunking Service
 *
 * Splits markdown documents into embedding-optimized chunks.
 * Strategy:
 * 1. Split on markdown headings as natural boundaries
 * 2. If a section exceeds maxWords, split on paragraph breaks
 * 3. Each chunk includes the document title + section heading as prefix
 * 4. ~100 word overlap between consecutive chunks
 */

import type { Chunk, ChunkOptions } from '@/types/corpus';
import { estimateTokenCount } from './embeddingService';

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  targetWords: 1000,
  maxWords: 1200,
  minWords: 200,
  overlapWords: 100,
};

interface Section {
  heading: string;
  content: string;
  level: number;
}

export function chunkDocument(
  content: string,
  documentTitle: string,
  options?: ChunkOptions
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sections = splitIntoSections(content);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionWords = countWords(section.content);

    if (sectionWords <= opts.maxWords) {
      if (sectionWords >= opts.minWords) {
        const chunkContent = buildChunkContent(documentTitle, section.heading, section.content);
        chunks.push({
          index: chunkIndex++,
          content: chunkContent,
          wordCount: countWords(chunkContent),
          tokenCount: estimateTokenCount(chunkContent),
          sectionHeading: section.heading,
        });
      } else {
        if (chunks.length > 0) {
          const lastChunk = chunks[chunks.length - 1];
          const mergedContent = lastChunk.content + '\n\n' + section.content;
          const mergedWords = countWords(mergedContent);
          if (mergedWords <= opts.maxWords) {
            lastChunk.content = mergedContent;
            lastChunk.wordCount = mergedWords;
            lastChunk.tokenCount = estimateTokenCount(mergedContent);
            continue;
          }
        }
        const chunkContent = buildChunkContent(documentTitle, section.heading, section.content);
        chunks.push({
          index: chunkIndex++,
          content: chunkContent,
          wordCount: countWords(chunkContent),
          tokenCount: estimateTokenCount(chunkContent),
          sectionHeading: section.heading,
        });
      }
    } else {
      const subChunks = splitSectionIntoParagraphChunks(
        section.content,
        documentTitle,
        section.heading,
        opts
      );
      for (const subChunk of subChunks) {
        chunks.push({ ...subChunk, index: chunkIndex++ });
      }
    }
  }

  return applyOverlap(chunks, opts.overlapWords);
}

function splitIntoSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentHeading = '';
  let currentLevel = 0;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
          sections.push({ heading: currentHeading, content: text, level: currentLevel });
        }
      }
      currentHeading = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text) {
      sections.push({ heading: currentHeading, content: text, level: currentLevel });
    }
  }

  if (sections.length === 0 && content.trim()) {
    sections.push({ heading: '', content: content.trim(), level: 0 });
  }

  return sections;
}

function splitSectionIntoParagraphChunks(
  content: string,
  documentTitle: string,
  sectionHeading: string,
  opts: Required<ChunkOptions>
): Omit<Chunk, 'index'>[] {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
  const chunks: Omit<Chunk, 'index'>[] = [];
  let currentParagraphs: string[] = [];
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);

    if (currentWordCount + paragraphWords > opts.maxWords && currentParagraphs.length > 0) {
      const text = currentParagraphs.join('\n\n');
      const chunkContent = buildChunkContent(documentTitle, sectionHeading, text);
      chunks.push({
        content: chunkContent,
        wordCount: countWords(chunkContent),
        tokenCount: estimateTokenCount(chunkContent),
        sectionHeading,
      });
      currentParagraphs = [];
      currentWordCount = 0;
    }

    currentParagraphs.push(paragraph);
    currentWordCount += paragraphWords;

    if (currentWordCount > opts.maxWords) {
      const text = currentParagraphs.join('\n\n');
      const chunkContent = buildChunkContent(documentTitle, sectionHeading, text);
      chunks.push({
        content: chunkContent,
        wordCount: countWords(chunkContent),
        tokenCount: estimateTokenCount(chunkContent),
        sectionHeading,
      });
      currentParagraphs = [];
      currentWordCount = 0;
    }
  }

  if (currentParagraphs.length > 0) {
    const text = currentParagraphs.join('\n\n');
    const chunkContent = buildChunkContent(documentTitle, sectionHeading, text);
    chunks.push({
      content: chunkContent,
      wordCount: countWords(chunkContent),
      tokenCount: estimateTokenCount(chunkContent),
      sectionHeading,
    });
  }

  return chunks;
}

function applyOverlap(chunks: Chunk[], overlapWords: number): Chunk[] {
  if (chunks.length <= 1 || overlapWords <= 0) return chunks;

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const prevWords = prevChunk.content.split(/\s+/);

    if (prevWords.length > overlapWords) {
      const overlapText = prevWords.slice(-overlapWords).join(' ');
      const newContent = `[...] ${overlapText}\n\n${chunks[i].content}`;
      chunks[i] = {
        ...chunks[i],
        content: newContent,
        wordCount: countWords(newContent),
        tokenCount: estimateTokenCount(newContent),
      };
    }
  }

  return chunks;
}

function buildChunkContent(documentTitle: string, sectionHeading: string, content: string): string {
  const parts: string[] = [];
  if (documentTitle) parts.push(`# ${documentTitle}`);
  if (sectionHeading) parts.push(`## ${sectionHeading}`);
  parts.push(content);
  return parts.join('\n\n');
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
