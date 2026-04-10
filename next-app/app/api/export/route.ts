import { NextRequest, NextResponse } from 'next/server';
import {
  generateDocx,
  type ExportMessage,
} from '@/services/exportService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// ── File integrity validation ───────────────────────────────────────────
// DOCX files are ZIP archives (PK\x03\x04).

const MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // PK.. (ZIP archive)
const MIN_FILE_SIZE = 1024; // ~1 KB minimum

/** Validate magic bytes at the start of the buffer. */
function validateMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < MAGIC_BYTES.length) return false;
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (buffer[i] !== MAGIC_BYTES[i]) return false;
  }
  return true;
}

/** Structural checks beyond magic bytes. */
function validateFileStructure(buffer: Buffer): { valid: boolean; reason?: string } {
  if (buffer.length < MIN_FILE_SIZE) {
    return { valid: false, reason: `File too small (${buffer.length} bytes). Generation may have been truncated.` };
  }

  if (!validateMagicBytes(buffer)) {
    return { valid: false, reason: 'Invalid file header. Expected DOCX magic bytes.' };
  }

  // ZIP-based format: verify end-of-central-directory record exists
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
    return { valid: false, reason: 'DOCX file is missing ZIP end-of-central-directory — file appears truncated.' };
  }

  return { valid: true };
}

// ── POST /api/export ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, title } = body as {
      messages: ExportMessage[];
      format?: string;
      title?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and must not be empty' },
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

    const buffer = await generateDocx(messages, title);

    // Integrity check
    const validation = validateFileStructure(buffer);
    if (!validation.valid) {
      console.error('[Export API] Integrity check failed:', validation.reason);
      return NextResponse.json(
        { error: `Generated file failed integrity check: ${validation.reason}` },
        { status: 500 }
      );
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `directory-report-${timestamp}.docx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
