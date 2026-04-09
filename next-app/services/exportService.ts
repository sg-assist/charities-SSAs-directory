/**
 * Export Service — generates DOCX, PDF, and PPTX from chat messages.
 *
 * Markdown in assistant responses is parsed into structured blocks
 * (headings, paragraphs, bullets, tables) and rendered natively into
 * each output format.
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
  NumberFormat,
  Header,
  ImageRun,
} from 'docx';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

// ── Types ────────────────────────────────────────────────────────────────

export interface ExportMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ title: string; slug: string }>;
}

export type ExportFormat = 'docx' | 'pdf' | 'pptx';

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

    // Regular paragraph — collect contiguous non-empty lines
    let paraText = line.trim();
    i++;
    // Single-line paragraphs for now (multi-line would need blank line detection)
    blocks.push({ type: 'paragraph', segments: parseInline(paraText) });
  }

  if (inTable) flushTable();
  return blocks;
}

// ── UNFPA brand colours ──────────────────────────────────────────────────

const UNFPA_BLUE = '003366';
const UNFPA_ACCENT = '009EDB';
const UNFPA_LIGHT_BLUE = 'E8F4FD';

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
                  color: UNFPA_BLUE,
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
                shading: { type: ShadingType.SOLID, color: UNFPA_BLUE },
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
                        ? { type: ShadingType.SOLID, color: UNFPA_LIGHT_BLUE }
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
  const reportTitle = title || 'UNFPA Partnership Catalyst — Report';
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
          color: UNFPA_BLUE,
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
        bottom: { style: BorderStyle.SINGLE, size: 6, color: UNFPA_ACCENT },
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
              color: UNFPA_BLUE,
            }),
            new TextRun({
              text: msg.content,
              size: 22,
              font: 'Calibri',
              italics: true,
            }),
          ],
          spacing: { before: 300, after: 200 },
          shading: { type: ShadingType.SOLID, color: UNFPA_LIGHT_BLUE },
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
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: UNFPA_ACCENT } },
      spacing: { before: 400, after: 80 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated by UNFPA Partnership Catalyst  ·  ', size: 18, font: 'Calibri', color: '888888' }),
        new TextRun({ text: 'https://unfpa-lkyspp-otg.vercel.app', size: 18, font: 'Calibri', color: '888888' }),
      ],
      spacing: { after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Questions about this output? Contact Haojun at haojun@ontheground.agency',
          size: 18, font: 'Calibri', color: '888888', italics: true,
        }),
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
                    text: 'UNFPA Partnership Catalyst',
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

// ── PDF generation ───────────────────────────────────────────────────────

export async function generatePdf(messages: ExportMessage[], title?: string): Promise<Buffer> {
  const reportTitle = title || 'UNFPA Partnership Catalyst — Report';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      bufferPages: true,
      info: {
        Title: reportTitle,
        Author: 'UNFPA Partnership Catalyst',
        Creator: 'UNFPA Partnership Catalyst',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PAGE_WIDTH = 595.28 - 144; // A4 minus margins

    // Helper: write inline segments respecting bold/italic
    function writeSegments(segments: TextSegment[], fontSize = 11, color = '#333333') {
      for (const seg of segments) {
        let font = 'Helvetica';
        if (seg.bold && seg.italic) font = 'Helvetica-BoldOblique';
        else if (seg.bold) font = 'Helvetica-Bold';
        else if (seg.italic) font = 'Helvetica-Oblique';

        doc.font(font).fontSize(fontSize).fillColor(color).text(seg.text, {
          continued: true,
        });
      }
      // End continuation
      doc.text('', { continued: false });
    }

    // Title page elements
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#' + UNFPA_BLUE)
      .text(reportTitle, { align: 'left' });

    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `Generated on ${new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`,
        { align: 'left' }
      );

    doc.moveDown(0.5);
    doc
      .moveTo(72, doc.y)
      .lineTo(72 + PAGE_WIDTH, doc.y)
      .strokeColor('#' + UNFPA_ACCENT)
      .lineWidth(2)
      .stroke();
    doc.moveDown(1);

    // Render messages
    for (const msg of messages) {
      // Check if we need a new page
      if (doc.y > 700) doc.addPage();

      if (msg.role === 'user') {
        // User query box
        const boxY = doc.y;
        doc
          .rect(72, boxY, PAGE_WIDTH, 0.1)
          .fill('#' + UNFPA_LIGHT_BLUE);

        // Measure text height for background
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#' + UNFPA_BLUE)
          .text('Query: ', { continued: true });
        doc
          .font('Helvetica-Oblique')
          .fontSize(11)
          .fillColor('#333333')
          .text(msg.content);
        doc.moveDown(0.8);
      } else {
        const blocks = parseMarkdown(msg.content);

        for (const block of blocks) {
          if (doc.y > 720) doc.addPage();

          switch (block.type) {
            case 'heading': {
              const sizes: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 12 };
              doc.moveDown(0.4);
              doc
                .font('Helvetica-Bold')
                .fontSize(sizes[block.level] || 12)
                .fillColor('#' + UNFPA_BLUE);
              writeSegments(block.segments, sizes[block.level] || 12, '#' + UNFPA_BLUE);
              doc.moveDown(0.3);
              break;
            }

            case 'paragraph':
              doc.font('Helvetica').fontSize(11).fillColor('#333333');
              writeSegments(block.segments);
              doc.moveDown(0.3);
              break;

            case 'bullet': {
              const indent = 20 + block.indent * 15;
              const bulletChar = block.indent === 0 ? '•' : '◦';
              doc
                .font('Helvetica')
                .fontSize(11)
                .fillColor('#333333')
                .text(`${bulletChar} `, 72 + indent, doc.y, { continued: true });
              writeSegments(block.segments);
              doc.moveDown(0.15);
              // Reset x position
              doc.text('', 72, doc.y, { continued: false });
              break;
            }

            case 'table': {
              if (block.headers.length === 0) break;
              const colCount = block.headers.length;
              const colWidth = PAGE_WIDTH / colCount;
              const cellPadding = 6;
              const rowHeight = 22;

              let tableY = doc.y + 4;

              // Check if table fits — if not, new page
              const tableHeight = (block.rows.length + 1) * rowHeight + 10;
              if (tableY + tableHeight > 720) {
                doc.addPage();
                tableY = doc.y;
              }

              // Header row
              doc
                .rect(72, tableY, PAGE_WIDTH, rowHeight)
                .fill('#' + UNFPA_BLUE);
              for (let c = 0; c < colCount; c++) {
                doc
                  .font('Helvetica-Bold')
                  .fontSize(9)
                  .fillColor('#FFFFFF')
                  .text(block.headers[c], 72 + c * colWidth + cellPadding, tableY + 6, {
                    width: colWidth - cellPadding * 2,
                    height: rowHeight,
                    lineBreak: false,
                  });
              }
              tableY += rowHeight;

              // Data rows
              for (let r = 0; r < block.rows.length; r++) {
                if (r % 2 === 1) {
                  doc
                    .rect(72, tableY, PAGE_WIDTH, rowHeight)
                    .fill('#' + UNFPA_LIGHT_BLUE);
                }
                for (let c = 0; c < block.rows[r].length; c++) {
                  doc
                    .font('Helvetica')
                    .fontSize(9)
                    .fillColor('#333333')
                    .text(block.rows[r][c] || '', 72 + c * colWidth + cellPadding, tableY + 6, {
                      width: colWidth - cellPadding * 2,
                      height: rowHeight,
                      lineBreak: false,
                    });
                }
                tableY += rowHeight;
              }

              // Table border
              doc
                .rect(72, doc.y + 4, PAGE_WIDTH, tableY - doc.y - 4)
                .strokeColor('#CCCCCC')
                .lineWidth(0.5)
                .stroke();

              doc.y = tableY + 8;
              break;
            }
          }
        }

        // Sources
        if (msg.sources?.length) {
          doc.moveDown(0.3);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#888888')
            .text('Sources:');
          for (const src of msg.sources) {
            doc
              .font('Helvetica-Oblique')
              .fontSize(9)
              .fillColor('#888888')
              .text(`• ${src.title}`);
          }
          doc.moveDown(0.5);
        }
      }
    }

    // Credits / attribution
    if (doc.y > 680) doc.addPage();
    doc.moveDown(1);
    doc
      .moveTo(72, doc.y)
      .lineTo(72 + PAGE_WIDTH, doc.y)
      .strokeColor('#CCCCCC')
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.4);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#888888')
      .text('Generated by UNFPA Partnership Catalyst  ·  https://unfpa-lkyspp-otg.vercel.app');
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor('#888888')
      .text('Questions about this output? Contact Haojun at haojun@ontheground.agency');

    // Add page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999999')
        .text(`Page ${i + 1} of ${totalPages}`, 72, 780, {
          width: PAGE_WIDTH,
          align: 'center',
        });
    }

    doc.end();
  });
}

// ── PPTX generation ──────────────────────────────────────────────────────

/**
 * Generates a PowerPoint slide deck from chat messages.
 *
 * Strategy:
 * - Title slide with report name and date
 * - Each user query becomes a section divider slide
 * - Assistant content is split by H2/H1 headings into separate slides
 * - Bullets, paragraphs, and tables are placed on content slides
 * - Sources slide at the end
 */
export async function generatePptx(
  messages: ExportMessage[],
  title?: string
): Promise<Buffer> {
  const reportTitle = title || 'UNFPA Partnership Catalyst';
  const pptx = new PptxGenJS();

  pptx.author = 'UNFPA Partnership Catalyst';
  pptx.title = reportTitle;
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

  // Define slide masters / theme colours
  const MASTER_BG = '#FFFFFF';
  const ACCENT_BAR_COLOR = '#' + UNFPA_ACCENT;
  const TITLE_COLOR = '#' + UNFPA_BLUE;

  // ── Title slide ──
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: UNFPA_BLUE };
  titleSlide.addText(reportTitle, {
    x: 0.8,
    y: 2.0,
    w: 11.5,
    h: 1.5,
    fontSize: 36,
    fontFace: 'Calibri',
    color: 'FFFFFF',
    bold: true,
  });
  titleSlide.addText(
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    {
      x: 0.8,
      y: 3.6,
      w: 11.5,
      h: 0.5,
      fontSize: 16,
      fontFace: 'Calibri',
      color: 'A8C8E8',
      italic: true,
    }
  );
  // Accent bar
  titleSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0.8,
    y: 3.3,
    w: 3,
    h: 0.06,
    fill: { color: UNFPA_ACCENT },
  });

  const allSources: Array<{ title: string }> = [];

  // Process each message
  for (const msg of messages) {
    if (msg.role === 'user') {
      // Section divider slide
      const divider = pptx.addSlide();
      divider.background = { color: UNFPA_BLUE };
      divider.addText('Query', {
        x: 0.8,
        y: 1.5,
        w: 11.5,
        h: 0.6,
        fontSize: 14,
        fontFace: 'Calibri',
        color: 'A8C8E8',
        bold: true,
      });
      divider.addText(msg.content, {
        x: 0.8,
        y: 2.2,
        w: 11.5,
        h: 3.5,
        fontSize: 22,
        fontFace: 'Calibri',
        color: 'FFFFFF',
        italic: true,
        valign: 'top',
      });
      // Accent bar
      divider.addShape('rect' as PptxGenJS.ShapeType, {
        x: 0.8,
        y: 2.05,
        w: 2,
        h: 0.04,
        fill: { color: UNFPA_ACCENT },
      });
    } else {
      // Parse assistant content and split into slides at H1/H2 boundaries
      const blocks = parseMarkdown(msg.content);

      // Collect sources
      if (msg.sources) {
        for (const src of msg.sources) {
          if (!allSources.some((s) => s.title === src.title)) {
            allSources.push({ title: src.title });
          }
        }
      }

      // Group blocks into slides: split at each H1 or H2
      const slideGroups: { title: string; blocks: ContentBlock[] }[] = [];
      let currentGroup: { title: string; blocks: ContentBlock[] } = {
        title: reportTitle,
        blocks: [],
      };

      for (const block of blocks) {
        if (
          block.type === 'heading' &&
          (block.level === 1 || block.level === 2)
        ) {
          // Flush previous group if it has content
          if (currentGroup.blocks.length > 0) {
            slideGroups.push(currentGroup);
          }
          currentGroup = {
            title: block.segments.map((s) => s.text).join(''),
            blocks: [],
          };
        } else {
          currentGroup.blocks.push(block);
        }
      }
      if (currentGroup.blocks.length > 0) {
        slideGroups.push(currentGroup);
      }

      // ── Render each group — may span multiple slides if content overflows ──
      const CONTENT_START_Y = 1.2;
      const CONTENT_MAX_Y  = 6.75;

      /** Estimate the height (inches) a block will occupy on a slide */
      const estimateH = (block: ContentBlock): number => {
        if (block.type === 'heading') return 0.58;
        if (block.type === 'table') {
          return Math.min((block.rows.length + 1) * 0.42 + 0.25, CONTENT_MAX_Y - CONTENT_START_Y);
        }
        // paragraph or bullet
        const chars = (block as { segments: TextSegment[] }).segments
          .reduce((n, s) => n + s.text.length, 0);
        const charsPerLine =
          block.type === 'bullet' ? Math.max(60, 80 - block.indent * 8) : 90;
        const lines = Math.max(1, Math.ceil(chars / charsPerLine));
        return lines * 0.32 + 0.22; // line-height + top/bottom padding
      };

      /** Create a fresh content slide with title bar */
      const makeContentSlide = (title: string) => {
        const s = pptx.addSlide();
        s.background = { color: MASTER_BG };
        s.addShape('rect' as PptxGenJS.ShapeType, {
          x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: UNFPA_ACCENT },
        });
        s.addText(title, {
          x: 0.6, y: 0.3, w: 12, h: 0.75,
          fontSize: 22, fontFace: 'Calibri',
          color: TITLE_COLOR.replace('#', ''), bold: true,
        });
        return s;
      };

      const addSlideFooter = (s: PptxGenJS.Slide) =>
        s.addText('UNFPA Partnership Catalyst', {
          x: 0.6, y: 7.05, w: 5, h: 0.3,
          fontSize: 8, fontFace: 'Calibri', color: '999999',
        });

      for (const group of slideGroups) {
        let slide = makeContentSlide(group.title);
        let yPos  = CONTENT_START_Y;

        for (const block of group.blocks) {
          const blockH = estimateH(block);

          // If this block won't fit, finish current slide and open a continuation
          if (yPos + blockH > CONTENT_MAX_Y) {
            addSlideFooter(slide);
            slide = makeContentSlide(group.title + ' (cont.)');
            yPos  = CONTENT_START_Y;
          }

          switch (block.type) {
            case 'heading': {
              slide.addText(block.segments.map((s) => s.text).join(''), {
                x: 0.6, y: yPos, w: 12, h: blockH,
                fontSize: 16, fontFace: 'Calibri',
                color: TITLE_COLOR.replace('#', ''), bold: true,
              });
              yPos += blockH;
              break;
            }

            case 'paragraph': {
              const textObjs: PptxGenJS.TextProps[] = block.segments.map((s) => ({
                text: s.text,
                options: { bold: s.bold, italic: s.italic, fontSize: 13, fontFace: 'Calibri', color: '333333' },
              }));
              slide.addText(textObjs, {
                x: 0.6, y: yPos, w: 12, h: blockH, valign: 'top',
              });
              yPos += blockH;
              break;
            }

            case 'bullet': {
              const textObjs: PptxGenJS.TextProps[] = block.segments.map((s) => ({
                text: s.text,
                options: {
                  bold: s.bold, italic: s.italic,
                  fontSize: 13, fontFace: 'Calibri', color: '333333',
                  bullet: { indent: 10 + block.indent * 10 },
                },
              }));
              slide.addText(textObjs, {
                x: 0.6 + block.indent * 0.3,
                y: yPos,
                w: 12 - block.indent * 0.3,
                h: blockH,
                valign: 'top',
              });
              yPos += blockH;
              break;
            }

            case 'table': {
              if (block.headers.length === 0) break;
              const tableRows: PptxGenJS.TableRow[] = [];
              tableRows.push(
                block.headers.map((h) => ({
                  text: h,
                  options: {
                    bold: true, fontSize: 11, fontFace: 'Calibri',
                    color: 'FFFFFF', fill: { color: UNFPA_BLUE }, valign: 'middle' as const,
                  },
                }))
              );
              for (let r = 0; r < block.rows.length; r++) {
                tableRows.push(
                  block.rows[r].map((cell) => ({
                    text: cell,
                    options: {
                      fontSize: 10, fontFace: 'Calibri', color: '333333',
                      fill: r % 2 === 1 ? { color: UNFPA_LIGHT_BLUE } : undefined,
                      valign: 'middle' as const,
                    },
                  }))
                );
              }
              const tableH = Math.min(blockH, CONTENT_MAX_Y - yPos - 0.1);
              slide.addTable(tableRows, {
                x: 0.6, y: yPos, w: 12, h: tableH,
                border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
                colW: Array(block.headers.length).fill(12 / block.headers.length),
                autoPage: false,
              });
              yPos += tableH + 0.2;
              break;
            }
          }
        }

        addSlideFooter(slide);
      }
    }
  }

  // Sources slide
  if (allSources.length > 0) {
    const srcSlide = pptx.addSlide();
    srcSlide.background = { color: '#FFFFFF' };
    srcSlide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: UNFPA_ACCENT },
    });
    srcSlide.addText('Sources', {
      x: 0.6, y: 0.3, w: 12, h: 0.7,
      fontSize: 24, fontFace: 'Calibri',
      color: TITLE_COLOR.replace('#', ''), bold: true,
    });
    const srcTextObjs: PptxGenJS.TextProps[] = allSources.map((s) => ({
      text: `• ${s.title}\n`,
      options: { fontSize: 12, fontFace: 'Calibri', color: '555555' },
    }));
    srcSlide.addText(srcTextObjs, {
      x: 0.6, y: 1.3, w: 12, h: 5, valign: 'top',
    });
    srcSlide.addText('UNFPA Partnership Catalyst', {
      x: 0.6, y: 7.05, w: 5, h: 0.3,
      fontSize: 8, fontFace: 'Calibri', color: '999999',
    });
  }

  // Credits slide
  const creditsSlide = pptx.addSlide();
  creditsSlide.background = { color: UNFPA_BLUE };
  creditsSlide.addText('Generated by UNFPA Partnership Catalyst', {
    x: 0.8, y: 2.2, w: 11.5, h: 0.8,
    fontSize: 26, fontFace: 'Calibri', color: 'FFFFFF', bold: true,
  });
  creditsSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0.8, y: 3.1, w: 3, h: 0.06, fill: { color: UNFPA_ACCENT },
  });
  creditsSlide.addText('https://unfpa-lkyspp-otg.vercel.app', {
    x: 0.8, y: 3.3, w: 11.5, h: 0.5,
    fontSize: 16, fontFace: 'Calibri', color: 'A8C8E8',
  });
  creditsSlide.addText(
    'Questions about this output? Contact Haojun at haojun@ontheground.agency',
    {
      x: 0.8, y: 3.9, w: 11.5, h: 0.5,
      fontSize: 14, fontFace: 'Calibri', color: 'A8C8E8', italic: true,
    }
  );

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}
