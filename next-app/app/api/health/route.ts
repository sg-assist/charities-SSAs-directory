import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    openaiKeySet: !!process.env.OPENAI_API_KEY,
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

  return NextResponse.json(results);
}
