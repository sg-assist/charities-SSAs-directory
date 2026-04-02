import { NextRequest } from 'next/server';
import { searchKnowledge } from '@/services/knowledgeDocumentService';
import { Redis } from '@upstash/redis';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DAILY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 6;      // safety cap on agentic tool-use loops
const MAX_CONTINUATION_WAVES = 4; // max waves of continued generation on max_tokens cutoff

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // allow up to 3 minutes for agentic + wave responses

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

IMPORTANT CAPABILITIES:
- You HAVE real-time internet access through the web_search tool. USE IT to look up
  current information about funders, organisations, recent news, strategies, and priorities.
- You have a knowledge_base_search tool to query UNFPA's internal knowledge base with
  semantic search. Use it multiple times with different queries to find comprehensive info.
- Think step-by-step. When a user asks about a specific funder or partner, ALWAYS search
  the web for their latest priorities, strategy documents, and recent activities BEFORE
  drafting your response.

When preparing materials, adopt a professional, partnership-ready tone suitable for
external meetings. Tailor content to the audience — a briefing for a family office should
emphasise impact and returns differently from one for a development agency.

FORMATTING RULES:
- Use proper markdown tables with header rows and separator rows when presenting structured
  data. Example:
  | Column A | Column B |
  |----------|----------|
  | Data 1   | Data 2   |
- Use headers (##, ###) to structure long responses.
- Use bullet points for lists.
- Bold key terms and organisation names.

Answer questions based on the knowledge base context AND web search results. Cite document
titles and web sources when relevant. Do not fabricate statistics or claim certainty where
documents express uncertainty. When evidence is uncertain or contested, say so clearly.`;

// ── Global daily rate limiter ─────────────────────────────────────────────

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

  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, 90000); // 25 hours

  const remaining = Math.max(0, DAILY_LIMIT - used);
  return { allowed: used <= DAILY_LIMIT, remaining, used };
}

// ── Tool definitions for Claude ──────────────────────────────────────────

const TOOLS = [
  // Anthropic's built-in web search (server-side, no API key needed)
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
  },
  // Custom knowledge base search tool
  {
    name: 'knowledge_base_search',
    description:
      'Search UNFPA\'s internal knowledge base using semantic similarity. ' +
      'Use this to find information about UNFPA programmes, partnerships, SRHR, ' +
      'climate-health linkages, financing models, and institutional knowledge. ' +
      'You can call this multiple times with different queries to find comprehensive information. ' +
      'Returns the most relevant document chunks with similarity scores.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query. Be specific — e.g. "UNFPA climate adaptation programmes Asia-Pacific" ' +
            'or "blended finance models for maternal health".',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default: 5, max: 10).',
        },
      },
      required: ['query'],
    },
  },
];

// ── Execute tool calls ───────────────────────────────────────────────────

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === 'knowledge_base_search') {
    const query = toolInput.query as string;
    const limit = Math.min((toolInput.limit as number) || 5, 10);

    const results = await searchKnowledge(query, {
      limit,
      threshold: 0.45,
    }).catch(() => []);

    if (results.length === 0) {
      return 'No relevant results found in the knowledge base for this query.';
    }

    return results
      .map(
        (r, i) =>
          `[${i + 1}] From "${r.documentTitle}" (similarity: ${r.similarity.toFixed(2)}):\n${r.chunkContent}`
      )
      .join('\n\n---\n\n');
  }

  return `Unknown tool: ${toolName}`;
}

// ── SSE streaming helpers ────────────────────────────────────────────────

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── POST /api/chat ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Check global daily limit
    const quota = await checkGlobalLimit();
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({
          error: `Daily query limit of ${DAILY_LIMIT} reached. Resets at midnight UTC.`,
          remaining: 0,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { message, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey: string | undefined = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const trimmedMessage = message.slice(0, 4000);

    // Build conversation history
    const history: { role: 'user' | 'assistant'; content: string }[] = [];
    if (Array.isArray(conversationHistory)) {
      for (const turn of conversationHistory.slice(-20)) {
        if (
          turn &&
          (turn.role === 'user' || turn.role === 'assistant') &&
          typeof turn.content === 'string'
        ) {
          history.push({ role: turn.role, content: turn.content.slice(0, 6000) });
        }
      }
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // ── SSE stream ─────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEncode(event, data)));
        };

        try {
          // Build initial messages array
          const messages: Array<{ role: string; content: unknown }> = [
            ...history,
            { role: 'user', content: trimmedMessage },
          ];

          let allSources: Array<{ title: string; slug: string }> = [];
          let finalText = '';
          let toolRound = 0;

          // Helper: make a single Claude API call
          async function callClaude(
            msgs: Array<{ role: string; content: unknown }>,
            includeTools: boolean
          ) {
            const body: Record<string, unknown> = {
              model: 'claude-sonnet-4-20250514',
              max_tokens: 16000,
              thinking: {
                type: 'enabled',
                budget_tokens: 8000,
              },
              system: `${SYSTEM_PROMPT}\n\nToday's date is ${todayDate}.`,
              messages: msgs,
            };
            if (includeTools) {
              body.tools = TOOLS;
            }

            const MAX_RETRIES = 2;
            let lastError = '';
            let lastStatus = 0;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              try {
                const res = await fetch(ANTHROPIC_API_URL, {
                  method: 'POST',
                  headers: {
                    'x-api-key': apiKey!,
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'interleaved-thinking-2025-05-14,web-search-2025-03-05',
                    'content-type': 'application/json',
                  },
                  body: JSON.stringify(body),
                });

                if (res.ok) {
                  return res.json();
                }

                lastStatus = res.status;
                lastError = await res.text();
                console.error(`[Chat API] Claude error (attempt ${attempt + 1}):`, res.status, lastError);

                // Don't retry on client errors (4xx) except 429 (rate limit)
                if (res.status < 500 && res.status !== 429) {
                  break;
                }

                // Wait before retrying (exponential backoff)
                if (attempt < MAX_RETRIES) {
                  await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                }
              } catch (fetchError) {
                lastError = fetchError instanceof Error ? fetchError.message : 'Network error';
                lastStatus = 0;
                console.error(`[Chat API] Fetch error (attempt ${attempt + 1}):`, lastError);

                if (attempt < MAX_RETRIES) {
                  await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                }
              }
            }

            // Return error details instead of null so we can surface a meaningful message
            return { _error: true, status: lastStatus, detail: lastError };
          }

          // Helper: extract text and tool_use blocks from content
          function processBlocks(contentBlocks: Array<Record<string, unknown>>) {
            const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
            let text = '';
            for (const block of contentBlocks) {
              if (block.type === 'thinking') {
                send('status', { phase: 'thinking', message: 'Thinking deeply...' });
              } else if (block.type === 'text') {
                text += block.text as string;
              } else if (block.type === 'tool_use') {
                toolUseBlocks.push({
                  id: block.id as string,
                  name: block.name as string,
                  input: block.input as Record<string, unknown>,
                });
              }
            }
            return { text, toolUseBlocks };
          }

          // Helper: stream text progressively to the client
          async function streamText(text: string) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < text.length; i += CHUNK_SIZE) {
              const chunk = text.slice(i, i + CHUNK_SIZE);
              send('text_delta', { text: chunk });
              if (i + CHUNK_SIZE < text.length) {
                await new Promise((r) => setTimeout(r, 12));
              }
            }
          }

          // ── Phase 1: Agentic tool-use loop ──────────────────────────
          let lastStopReason = '';

          while (toolRound < MAX_TOOL_ROUNDS) {
            toolRound++;

            send('status', {
              phase: toolRound === 1 ? 'thinking' : 'researching',
              message:
                toolRound === 1
                  ? 'Analyzing your question...'
                  : `Gathering more information (step ${toolRound})...`,
            });

            const claudeData = await callClaude(messages, true);
            if (!claudeData || claudeData._error) {
              const status = claudeData?.status || 0;
              let userMessage = 'AI service error. Please try again.';
              if (status === 401 || status === 403) {
                userMessage = 'AI service authentication error. Please contact the administrator.';
              } else if (status === 429) {
                userMessage = 'AI service is temporarily overloaded. Please wait a moment and try again.';
              } else if (status >= 500) {
                userMessage = 'AI service is temporarily unavailable. Please try again in a few moments.';
              } else if (status === 0) {
                userMessage = 'Unable to reach AI service. Please check your connection and try again.';
              }
              console.error('[Chat API] Final error - status:', status, 'detail:', claudeData?.detail);
              send('error', { message: userMessage });
              break;
            }

            const contentBlocks = claudeData.content || [];
            lastStopReason = claudeData.stop_reason || '';
            const { text: responseText, toolUseBlocks } = processBlocks(contentBlocks);

            // If Claude is done (no tool calls), we have the answer (possibly partial)
            if (lastStopReason === 'end_turn' || toolUseBlocks.length === 0) {
              finalText = responseText;
              break;
            }

            // If stopped due to max_tokens during tool use, take whatever text we have
            if (lastStopReason === 'max_tokens') {
              finalText = responseText;
              break;
            }

            // Execute tool calls
            messages.push({ role: 'assistant', content: contentBlocks });

            const toolResults: Array<{
              type: 'tool_result';
              tool_use_id: string;
              content: string;
            }> = [];

            for (const toolCall of toolUseBlocks) {
              if (toolCall.name === 'web_search') {
                // Server-side tool handled by Anthropic — no local execution needed
                continue;
              }

              send('status', {
                phase: 'searching',
                message:
                  toolCall.name === 'knowledge_base_search'
                    ? `Searching knowledge base: "${(toolCall.input.query as string)?.slice(0, 60)}..."`
                    : `Using ${toolCall.name}...`,
              });

              const result = await executeToolCall(toolCall.name, toolCall.input);

              // Collect sources from KB results
              if (toolCall.name === 'knowledge_base_search') {
                const titleMatches = result.matchAll(/From "([^"]+)"/g);
                for (const match of titleMatches) {
                  const title = match[1];
                  if (!allSources.some((s) => s.title === title)) {
                    const slug = title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '');
                    allSources.push({ title, slug });
                  }
                }
              }

              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: result,
              });
            }

            if (toolResults.length > 0) {
              messages.push({ role: 'user', content: toolResults });
            }
          }

          // ── Phase 2: Wave generation for complete output ─────────────
          // If the response was cut off (stop_reason === 'max_tokens'),
          // continue generating in waves by feeding the partial text back
          // and asking Claude to continue from where it left off.

          send('status', { phase: 'writing', message: 'Composing response...' });

          // Stream the first wave
          await streamText(finalText);

          let wave = 0;
          while (lastStopReason === 'max_tokens' && wave < MAX_CONTINUATION_WAVES) {
            wave++;
            send('status', {
              phase: 'writing',
              message: `Continuing response (wave ${wave + 1})...`,
            });

            // Build continuation messages: original conversation + partial assistant response
            // Then a user message asking to continue
            const continuationMessages: Array<{ role: string; content: unknown }> = [
              ...history,
              { role: 'user', content: trimmedMessage },
              { role: 'assistant', content: finalText },
              {
                role: 'user',
                content:
                  'Your previous response was cut off mid-sentence. Please continue EXACTLY ' +
                  'where you left off. Do not repeat any content — just pick up from the ' +
                  'exact point where you stopped and complete the rest of the response.',
              },
            ];

            const waveData = await callClaude(continuationMessages, false);
            if (!waveData || waveData._error) break;

            const waveBlocks = waveData.content || [];
            lastStopReason = waveData.stop_reason || '';
            const { text: waveText } = processBlocks(waveBlocks);

            if (!waveText) break;

            // Stream this wave's text
            await streamText(waveText);

            // Accumulate into finalText
            finalText += waveText;
          }

          // ── Done ─────────────────────────────────────────────────────
          send('done', {
            sources: allSources,
            remaining: quota.remaining,
            fullText: finalText,
          });
        } catch (error) {
          console.error('[Chat API] Stream error:', error);
          send('error', {
            message: 'Failed to process request. Please try again.',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
