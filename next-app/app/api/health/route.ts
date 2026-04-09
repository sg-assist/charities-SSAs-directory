import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    databaseUrlSet: !!process.env.DATABASE_URL,
  };

  // Test Anthropic API with a minimal request
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 32,
          messages: [{ role: 'user', content: 'Say "ok"' }],
        }),
      });

      if (res.ok) {
        results.anthropicStatus = 'ok';
      } else {
        const errorText = await res.text();
        results.anthropicStatus = 'error';
        results.anthropicHttpStatus = res.status;
        results.anthropicError = errorText.slice(0, 500);
      }
    } catch (err) {
      results.anthropicStatus = 'unreachable';
      results.anthropicError = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  // Test database connectivity and document counts
  if (process.env.DATABASE_URL) {
    try {
      const rows = await Promise.race([
        prisma.$queryRawUnsafe(`
          SELECT
            (SELECT COUNT(*) FROM knowledge_documents)::int AS docs,
            (SELECT COUNT(*) FROM knowledge_chunks)::int AS chunks,
            (SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL)::int AS chunks_with_embeddings
        `),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB query timeout after 5s')), 5000)
        ),
      ]) as { docs: number; chunks: number; chunks_with_embeddings: number }[];
      const row = rows[0];
      results.databaseReachable = true;
      results.knowledgeDocuments = Number(row?.docs ?? 0);
      results.knowledgeChunks = Number(row?.chunks ?? 0);
      results.chunksWithEmbeddings = Number(row?.chunks_with_embeddings ?? 0);
    } catch (err) {
      results.databaseReachable = false;
      results.databaseError = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  return NextResponse.json(results);
}
