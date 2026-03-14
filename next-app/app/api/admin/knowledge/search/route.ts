import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '@/services/knowledgeDocumentService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/knowledge/search
 * Test semantic search. Body: { query: string, vertical?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, vertical, limit } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: query (string)' },
        { status: 400 }
      );
    }

    const results = await searchKnowledge(query, {
      vertical: vertical || undefined,
      limit: limit || 5,
      threshold: 0.5,
    });

    return NextResponse.json({ query, vertical: vertical || 'all', results, count: results.length });
  } catch (error) {
    console.error('[Admin Knowledge Search] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
