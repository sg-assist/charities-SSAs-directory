import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '@/services/knowledgeDocumentService';
import { Redis } from '@upstash/redis';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DAILY_LIMIT = 20;

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a partnership preparation assistant for the UNFPA Asia-Pacific Regional Office.
Your role is to help UNFPA staff prepare for conversations with potential funding
organisations — including family offices, philanthropic foundations, development finance
institutions, impact investors, and government agencies.

UNFPA's core mandate covers sexual and reproductive health and rights (SRHR), maternal
health, family planning, gender-based violence prevention, and population data — with
three transformative results: ending preventable maternal deaths, ending unmet need for
family planning, and ending gender-based violence and harmful practices.

Your job is to help UNFPA staff:
1. PITCH UNFPA programmes and projects in ways that resonate with each funder's interests
   and investment thesis — connecting UNFPA's work to climate resilience, humanitarian
   response, community development, or other frames that match the funder's priorities.
2. PREPARE talking points, briefing notes, and discussion questions for meetings with
   potential partners — drawing on the knowledge base to surface relevant evidence,
   programme examples, and financing models.
3. MATCH UNFPA projects to funding opportunities by identifying alignment between UNFPA's
   work and a funder's stated interests (e.g. climate adaptation, health systems, gender
   equity, blended finance, South–South cooperation).
4. CATALYSE conversations about climate and humanitarian funding by framing UNFPA's SRHR
   mandate within the climate–health–resilience nexus that many funders increasingly
   prioritise.

Key context areas in the knowledge base:
- UNFPA's mandate, programmes, and results (SRHR, maternal health, GBV, midwifery, etc.)
- Public–private partnership models for humanitarian and development settings
- Climate change and SRHR linkages in Asia-Pacific
- Singapore's financial ecosystem: family offices, philanthropy, blended finance
- Community resilience, co-design, and intergenerational solidarity approaches

When preparing materials, adopt a professional, partnership-ready tone suitable for
external meetings. Tailor content to the audience — a briefing for a family office should
emphasise impact and returns differently from one for a development agency.

Answer questions based on the knowledge base context provided. Cite document titles when
relevant. Do not fabricate statistics or claim certainty where documents express
uncertainty. When evidence is uncertain or contested, say so clearly.`;

// ── Global daily rate limiter ─────────────────────────────────────────────
// Uses Upstash Redis for a server-side counter shared across all users/sessions.
// If UPSTASH_REDIS_REST_URL / TOKEN are not set, limit is not enforced
// (safe fallback for local dev).

let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  // Redis unavailable — proceed without rate limiting
}

async function checkGlobalLimit(): Promise<{ allowed: boolean; remaining: number; used: number }> {
  if (!redis) return { allowed: true, remaining: DAILY_LIMIT, used: 0 };

  const today = new Date().toISOString().split('T')[0];
  const key = `unfpa:queries:${today}`;

  // Increment and set 25-hour expiry on first use each day
  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, 90000); // 25 hours

  const remaining = Math.max(0, DAILY_LIMIT - used);
  return { allowed: used <= DAILY_LIMIT, remaining, used };
}

// ── POST /api/chat ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Check global daily limit before doing any work
    const quota = await checkGlobalLimit();
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Daily query limit of ${DAILY_LIMIT} reached. Resets at midnight UTC.`, remaining: 0 },
        { status: 429 }
      );
    }

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

    return NextResponse.json({ response: assistantMessage, sources, remaining: quota.remaining });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
