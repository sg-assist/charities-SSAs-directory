/**
 * Export Service — generates DOCX from chat messages.
 *
 * Markdown in assistant responses is parsed into structured blocks
 * (headings, paragraphs, bullets, tables) and rendered natively into
 * the output format.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Footer,
  PageNumber,
  Header,
} from 'docx';

// ── Types ────────────────────────────────────────────────────────────────

export interface ExportMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ title: string; slug: string }>;
}

export type ExportFormat = 'docx';

// ── Markdown → structured blocks ─────────────────────────────────────────

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  segments: TextSegment[];
}

interface ParagraphBlock {
  type: 'paragraph';
  segments: TextSegment[];
}

interface BulletBlock {
  type: 'bullet';
  segments: TextSegment[];
  indent: number; // 0-based nesting depth
}

interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

type ContentBlock = HeadingBlock | ParagraphBlock | BulletBlock | TableBlock;

/** Parse inline bold/italic markdown into TextSegments */
function parseInline(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match **bold**, *italic*, ***bold+italic***
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      segments.push({ text: match[3], bold: true });
    } else if (match[4]) {
      segments.push({ text: match[4], italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  if (segments.length === 0) segments.push({ text });
  return segments;
}

/** Strip bold/italic markdown markers, returning plain text */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

/** Parse markdown text into structured blocks */
function parseMarkdown(md: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = md.split('\n');
  let i = 0;

  // State for table parsing
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  function flushTable() {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      blocks.push({ type: 'table', headers: tableHeaders, rows: tableRows });
      tableHeaders = [];
      tableRows = [];
    }
    inTable = false;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Table row: starts with |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => stripInlineMarkdown(c.trim()));

      // Separator row (|---|---|)
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        i++;
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      i++;
      continue;
    }

    // If we were in a table and hit a non-table line, flush
    if (inTable) flushTable();

    // Heading: # ... #### max
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      blocks.push({ type: 'heading', level, segments: parseInline(headingMatch[2]) });
      i++;
      continue;
    }

    // Bullet / list item: -, *, or numbered (1.)
    const bulletMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2);
      blocks.push({ type: 'bullet', indent, segments: parseInline(bulletMatch[3]) });
      i++;
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    const paraText = line.trim();
    i++;
    blocks.push({ type: 'paragraph', segments: parseInline(paraText) });
  }

  if (inTable) flushTable();
  return blocks;
}

// ── Brand colours ───────────────────────────────────────────────────────

const PRIMARY_COLOR = '0891B2';   // teal-600
const ACCENT_COLOR = '38BDF8';    // sky-400
const LIGHT_COLOR = 'F0FDFA';     // teal-50

// ── DOCX generation ──────────────────────────────────────────────────────

function segmentsToTextRuns(segments: TextSegment[], baseSize = 22): TextRun[] {
  return segments.map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italic,
        size: baseSize,
        font: 'Calibri',
      })
  );
}

function blocksToDocxParagraphs(blocks: ContentBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
        };
        paragraphs.push(
          new Paragraph({
            heading: headingMap[block.level],
            children: block.segments.map(
              (s) =>
                new TextRun({
                  text: s.text,
                  bold: true,
                  size: block.level === 1 ? 32 : block.level === 2 ? 28 : 24,
                  font: 'Calibri',
                  color: PRIMARY_COLOR,
                })
            ),
            spacing: { before: 240, after: 120 },
          })
        );
        break;
      }

      case 'paragraph':
        paragraphs.push(
          new Paragraph({
            children: segmentsToTextRuns(block.segments),
            spacing: { after: 120 },
          })
        );
        break;

      case 'bullet':
        paragraphs.push(
          new Paragraph({
            children: segmentsToTextRuns(block.segments),
            bullet: { level: block.indent },
            spacing: { after: 60 },
          })
        );
        break;

      case 'table': {
        if (block.headers.length === 0) break;
        const colCount = block.headers.length;
        const colWidth = Math.floor(9000 / colCount);

        const headerRow = new TableRow({
          children: block.headers.map(
            (h) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        size: 20,
                        font: 'Calibri',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
                width: { size: colWidth, type: WidthType.DXA },
                shading: { type: ShadingType.SOLID, color: PRIMARY_COLOR },
              })
          ),
        });

        const dataRows = block.rows.map(
          (row, ri) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: cell, size: 20, font: 'Calibri' })],
                      }),
                    ],
                    width: { size: colWidth, type: WidthType.DXA },
                    shading:
                      ri % 2 === 1
                        ? { type: ShadingType.SOLID, color: LIGHT_COLOR }
                        : undefined,
                  })
              ),
            })
        );

        const table = new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 9000, type: WidthType.DXA },
        });

        paragraphs.push(new Paragraph({ spacing: { before: 120 } })); // spacer
        paragraphs.push(table as unknown as Paragraph); // docx type quirk — Table is valid child
        paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
        break;
      }
    }
  }

  return paragraphs;
}

export async function generateDocx(messages: ExportMessage[], title?: string): Promise<Buffer> {
  const reportTitle = title || 'The Directory — Report';
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: reportTitle,
          bold: true,
          size: 36,
          font: 'Calibri',
          color: PRIMARY_COLOR,
        }),
      ],
      spacing: { after: 80 },
    })
  );

  // Subtitle / date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}`,
          size: 20,
          font: 'Calibri',
          color: '666666',
          italics: true,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Separator
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_COLOR },
      },
      spacing: { after: 300 },
    })
  );

  // Messages
  for (const msg of messages) {
    if (msg.role === 'user') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Query: ',
              bold: true,
              size: 22,
              font: 'Calibri',
              color: PRIMARY_COLOR,
            }),
            new TextRun({
              text: msg.content,
              size: 22,
              font: 'Calibri',
              italics: true,
            }),
          ],
          spacing: { before: 300, after: 200 },
          shading: { type: ShadingType.SOLID, color: LIGHT_COLOR },
        })
      );
    } else {
      const blocks = parseMarkdown(msg.content);
      const docxElements = blocksToDocxParagraphs(blocks);
      children.push(...(docxElements as (Paragraph | Table)[]));

      // Sources
      if (msg.sources?.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Sources:',
                bold: true,
                size: 18,
                font: 'Calibri',
                color: '888888',
              }),
            ],
            spacing: { before: 160, after: 40 },
          })
        );
        for (const src of msg.sources) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${src.title}`,
                  size: 18,
                  font: 'Calibri',
                  color: '888888',
                  italics: true,
                }),
              ],
              spacing: { after: 20 },
            })
          );
        }
      }
    }
  }

  // Credits / attribution
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT_COLOR } },
      spacing: { before: 400, after: 80 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated by The Directory  ·  SG Assist Pte Ltd x OTG', size: 18, font: 'Calibri', color: '888888' }),
      ],
      spacing: { after: 40 },
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'The Directory',
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
