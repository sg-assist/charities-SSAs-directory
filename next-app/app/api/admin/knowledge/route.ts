import { NextRequest, NextResponse } from 'next/server';
import { listDocuments, ingestDirectory } from '@/services/knowledgeDocumentService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/knowledge
 * List all knowledge documents.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vertical = searchParams.get('vertical') || undefined;

    const documents = await listDocuments(vertical);

    return NextResponse.json({ documents, total: documents.length });
  } catch (error) {
    console.error('[Admin Knowledge] GET error:', error);
    return NextResponse.json({ error: 'Failed to list knowledge documents' }, { status: 500 });
  }
}

/**
 * POST /api/admin/knowledge
 * Trigger ingestion. Body: { vertical: string, directory?: string, force?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vertical, directory, force } = body;

    if (!vertical) {
      return NextResponse.json({ error: 'Missing required field: vertical' }, { status: 400 });
    }

    const defaultDir = '../docs/knowledge-base/unfpa';
    const dirPath = directory || defaultDir;

    const pathModule = await import('path');
    const resolvedDir = pathModule.resolve(process.cwd(), '..', dirPath);

    console.log(`[Admin Knowledge] Ingesting from ${resolvedDir} for vertical ${vertical}`);

    const result = await ingestDirectory(resolvedDir, vertical, { force });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Admin Knowledge] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}
