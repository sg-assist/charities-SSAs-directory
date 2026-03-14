import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '@/services/knowledgeDocumentService';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a research assistant supporting the Lee Kuan Yew School of Public Policy
Policy Innovation Lab consulting team. The team is working on a project for UNFPA
(United Nations Population Fund) on the following challenge:

"How might we design innovative public–private partnerships (PPPs) that strengthen
community resilience to climate and humanitarian stressors in Asia?"

Key dimensions of the challenge include:
- PPP models that integrate humanitarian, environmental, and economic insights
- Singapore's financial ecosystem: philanthropy, family offices, blended finance,
  South–South cooperation
- Social cohesion, intergenerational solidarity, and community ownership/co-design
- UNFPA's mandate: sexual and reproductive health, maternal mortality, family planning,
  and gender-based violence — especially in crises and climate-affected contexts

Answer questions based on the knowledge base context provided. Prioritise information
that helps the team understand: what has worked, what financing structures are viable,
where the evidence base is strong or weak, and what UNFPA's role in partnership models
could be.

When evidence is uncertain or contested, say so clearly. Cite document titles when
relevant. Do not fabricate statistics or claim certainty where documents express
uncertainty. Keep responses concise and useful — tailor depth to the question.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const trimmedMessage = message.slice(0, 2000);

    const history: { role: 'user' | 'assistant'; content: string }[] = [];
    if (Array.isArray(conversationHistory)) {
      for (const turn of conversationHistory.slice(-20)) {
        if (
          turn &&
          (turn.role === 'user' || turn.role === 'assistant') &&
          typeof turn.content === 'string'
        ) {
          history.push({ role: turn.role, content: turn.content.slice(0, 4000) });
        }
      }
    }

    // Search knowledge base for relevant context
    const knowledgeResults = await searchKnowledge(trimmedMessage, {
      limit: 5,
      threshold: 0.5,
    }).catch(() => []);

    // Build context block
    let knowledgeContext = '';
    if (knowledgeResults.length > 0) {
      knowledgeContext =
        '\n\n---\nRELEVANT KNOWLEDGE BASE CONTEXT (use this to inform your answer):\n' +
        knowledgeResults
          .map(
            (r, i) =>
              `[${i + 1}] From "${r.documentTitle}":\n${r.chunkContent}`
          )
          .join('\n\n');
    }

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history,
      {
        role: 'user',
        content: trimmedMessage + knowledgeContext,
      },
    ];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const claudeRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `${SYSTEM_PROMPT}\n\nToday's date is ${todayDate}.`,
        messages,
      }),
    });

    if (!claudeRes.ok) {
      console.error('[Chat API] Claude error:', claudeRes.status);
      return NextResponse.json({ error: 'AI service error' }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const assistantMessage: string =
      claudeData.content?.[0]?.type === 'text' ? claudeData.content[0].text : '';

    const sources = knowledgeResults.map((r) => ({
      title: r.documentTitle,
      slug: r.documentSlug,
    }));

    return NextResponse.json({ response: assistantMessage, sources });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
