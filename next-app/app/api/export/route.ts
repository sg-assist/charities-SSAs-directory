import { NextRequest, NextResponse } from 'next/server';
import {
  generateDocx,
  generatePdf,
  generatePptx,
  type ExportMessage,
  type ExportFormat,
} from '@/services/exportService';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MIME_TYPES: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  docx: 'docx',
  pdf: 'pdf',
  pptx: 'pptx',
};

// ── File integrity validation ───────────────────────────────────────────
// Each format has known magic bytes and a minimum realistic size.
// DOCX and PPTX are ZIP archives (PK\x03\x04). PDF starts with %PDF-.

const MAGIC_BYTES: Record<ExportFormat, number[]> = {
  docx: [0x50, 0x4b, 0x03, 0x04], // PK.. (ZIP archive)
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  pptx: [0x50, 0x4b, 0x03, 0x04], // PK.. (ZIP archive)
};

// Minimum plausible file size (bytes) — an empty-ish document is still
// several KB due to format overhead. These thresholds catch truncated or
// zero-length buffers without rejecting small but valid files.
const MIN_FILE_SIZE: Record<ExportFormat, number> = {
  docx: 1024,  // ~1 KB minimum
  pdf: 256,    // ~256 B minimum (a valid single-page PDF)
  pptx: 2048,  // ~2 KB minimum
};

/** Validate magic bytes at the start of the buffer. */
function validateMagicBytes(buffer: Buffer, format: ExportFormat): boolean {
  const expected = MAGIC_BYTES[format];
  if (buffer.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }
  return true;
}

/** Format-specific structural checks beyond magic bytes. */
function validateFileStructure(buffer: Buffer, format: ExportFormat): { valid: boolean; reason?: string } {
  // Size check
  if (buffer.length < MIN_FILE_SIZE[format]) {
    return { valid: false, reason: `File too small (${buffer.length} bytes). Generation may have been truncated.` };
  }

  // Magic bytes
  if (!validateMagicBytes(buffer, format)) {
    return { valid: false, reason: `Invalid file header. Expected ${format.toUpperCase()} magic bytes.` };
  }

  // PDF-specific: must end with %%EOF (possibly followed by whitespace)
  if (format === 'pdf') {
    // Check the last 32 bytes for %%EOF marker
    const tail = buffer.subarray(Math.max(0, buffer.length - 32)).toString('ascii');
    if (!tail.includes('%%EOF')) {
      return { valid: false, reason: 'PDF is missing %%EOF marker — file appears truncated.' };
    }
  }

  // ZIP-based formats (DOCX, PPTX): verify the end-of-central-directory
  // record exists. Its signature is PK\x05\x06 and it must appear in the
  // last 64 KB of any valid ZIP file.
  if (format === 'docx' || format === 'pptx') {
    const searchWindow = buffer.subarray(Math.max(0, buffer.length - 65536));
    const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    let found = false;
    for (let i = 0; i <= searchWindow.length - 4; i++) {
      if (
        searchWindow[i] === eocdSig[0] &&
        searchWindow[i + 1] === eocdSig[1] &&
        searchWindow[i + 2] === eocdSig[2] &&
        searchWindow[i + 3] === eocdSig[3]
      ) {
        found = true;
        break;
      }
    }
    if (!found) {
      return {
        valid: false,
        reason: `${format.toUpperCase()} file is missing ZIP end-of-central-directory — file appears truncated.`,
      };
    }
  }

  return { valid: true };
}

// ── POST /api/export ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, format, title } = body as {
      messages: ExportMessage[];
      format: ExportFormat;
      title?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!format || !['docx', 'pdf', 'pptx'].includes(format)) {
      return NextResponse.json(
        { error: 'Format must be one of: docx, pdf, pptx' },
        { status: 400 }
      );
    }

    // Validate messages structure
    for (const msg of messages) {
      if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Each message must have a valid role (user/assistant) and content' },
          { status: 400 }
        );
      }
    }

    let buffer: Buffer;

    switch (format) {
      case 'docx':
        buffer = await generateDocx(messages, title);
        break;
      case 'pdf':
        buffer = await generatePdf(messages, title);
        break;
      case 'pptx':
        buffer = await generatePptx(messages, title);
        break;
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    // ── Integrity check: validate the generated file before serving ──
    const validation = validateFileStructure(buffer, format);
    if (!validation.valid) {
      console.error(`[Export API] Integrity check failed for ${format}:`, validation.reason);
      return NextResponse.json(
        { error: `Generated file failed integrity check: ${validation.reason}` },
        { status: 500 }
      );
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `unfpa-report-${timestamp}.${FILE_EXTENSIONS[format]}`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': MIME_TYPES[format],
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'X-File-Integrity': 'verified',
      },
    });
  } catch (error) {
    console.error('[Export API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export. Please try again.' },
      { status: 500 }
    );
  }
}
