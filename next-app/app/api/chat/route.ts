import { NextRequest } from 'next/server';
import { searchKnowledge } from '@/services/knowledgeDocumentService';
import { buildSystemPrompt, getSearchVerticals, type AppMode } from '@/lib/prompts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_ROUNDS = 3;      // safety cap on agentic tool-use loops
const MAX_CONTINUATION_WAVES = 2; // max waves of continued generation on max_tokens cutoff

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // allow up to 3 minutes for agentic + wave responses

const SYSTEM_PROMPT = `You are a caregiving and social services assistant for Singapore.
Your role is to help people — caregivers, families, social workers, and anyone in need —
navigate Singapore's landscape of charities, social service agencies (SSAs), voluntary
welfare organisations (VWOs), and government support programmes.

Singapore's social service ecosystem includes:
- Ministry of Health (MOH) — healthcare policy, subsidies, MediSave/MediShield
- Ministry of Social and Family Development (MSF) — social services, family support, ComCare
- Agency for Integrated Care (AIC) — eldercare, disability, mental health service coordination
- National Council of Social Service (NCSS) — umbrella body for VWOs and SSAs
- Commissioner of Charities — charity registration and governance
- Hundreds of registered charities, VWOs, and SSAs across eldercare, disability,
  mental health, family services, healthcare, and community support

Your job is to help users:
1. FIND the right organisation or service for their needs — matching their situation
   (eldercare, disability, mental health, financial difficulty, etc.) to relevant
   organisations and government schemes.
2. EXPLAIN available services, subsidies, and support programmes — including eligibility
   criteria, application processes, and what to expect.
3. PROVIDE contact details and practical next steps — addresses, phone numbers, websites,
   and how to get started with an organisation or scheme.
4. NAVIGATE government guidelines — MOH healthcare subsidies, MSF social assistance schemes,
   AIC care coordination, and other support frameworks.

Key areas of knowledge:
- Eldercare: nursing homes, day care, home care, dementia care, caregiver support
- Disability: early intervention, special education, employment support, respite care
- Mental health: counselling, crisis support, community mental health services
- Family services: family service centres, counselling, mediation, protection services
- Healthcare: medical social work, financial assistance for healthcare, chronic disease support
- Community: befriending services, volunteer programmes, grassroots support

IMPORTANT CAPABILITIES:
- You HAVE real-time internet access through the web_search tool. USE IT to look up
  current information about organisations, services, eligibility criteria, and recent changes.
- You have a knowledge_base_search tool to query the internal knowledge base with
  semantic search. Try 1–2 focused queries. If the knowledge base returns "No relevant
  results" twice in a row, STOP searching the knowledge base and compose your answer
  using web search results plus your general expert knowledge.
- Think step-by-step. When a user asks about a specific need or organisation, ALWAYS search
  the web for current information, contact details, and recent updates BEFORE responding.

RESPONSE PROTOCOL — READ CAREFULLY:
- Do NOT announce what you are about to do. Do NOT say things like "Let me search...",
  "I'll look up...", or "I'll help you identify...". These are wasted tokens.
- Call your tools IMMEDIATELY and SILENTLY. The user does not need a preamble.
- After gathering information from tools, compose the FULL response in one go — do not
  stop to ask confirmation, and do not produce short interim acknowledgements.
- Your first output should either be a tool call, or (if no research is needed) the
  complete final answer. Never a "let me do X" preamble with no tool call.
- NEVER return an empty response. If the knowledge base has no data on the topic and
  web search is thin, answer from your general knowledge and say so explicitly. A
  substantive answer from general knowledge is always better than silence.

Adopt a warm, practical tone suitable for people who may be stressed or overwhelmed.
Be direct about what's available, honest about limitations, and always provide
actionable next steps.

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
documents express uncertainty. When information may be outdated, say so clearly and
recommend the user verify with the organisation directly.`;

// ── Tool definitions for Claude ──────────────────────────────────────────

const TOOLS = [
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
  },
  {
    name: 'knowledge_base_search',
    description:
      'Search the internal knowledge base about Singapore charities, social service agencies, ' +
      'government guidelines, and caregiving resources using semantic similarity. ' +
      'Use this to find information about specific organisations, services, subsidies, ' +
      'eligibility criteria, and caregiving topics. ' +
      'Returns the most relevant document chunks with similarity scores.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query. Be specific — e.g. "eldercare day care centres Singapore" ' +
            'or "financial assistance for caregivers MSF ComCare".',
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
  toolInput: Record<string, unknown>,
  verticals: string[]
): Promise<string> {
  if (toolName === 'knowledge_base_search') {
    const query = toolInput.query as string;
    const limit = Math.min((toolInput.limit as number) || 5, 10);

    // Search across all verticals for this mode; pass vertical filter if single vertical
    const searchOptions = {
      limit,
      threshold: 0.45,
      // If multiple verticals, we search all and filter post-hoc (future: multi-vertical support)
      vertical: verticals.length === 1 ? verticals[0] : undefined,
    };

    const results = await searchKnowledge(query, searchOptions).catch(() => []);

    if (results.length === 0) {
      return 'No relevant results found in the knowledge base for this query.';
    }

    // Include chunkId/slug in output so the LLM can emit [SRC:chunk_id] citation tags
    return results
      .map(
        (r, i) =>
          `[${i + 1}] chunk_id="${r.documentSlug}-${r.chunkIndex}" From "${r.documentTitle}" (similarity: ${r.similarity.toFixed(2)}):\n${r.chunkContent}`
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
    const body = await request.json();
    const {
      message,
      conversationHistory,
      mode = 'partnership',   // 'clinical' | 'community' | 'partnership'
      country = '',           // e.g. "Myanmar", "Bangladesh"
      language = 'en',        // BCP 47, e.g. "my", "km", "id"
    } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate mode
    const validModes: AppMode[] = ['clinical', 'community', 'partnership'];
    const appMode: AppMode = validModes.includes(mode) ? mode : 'partnership';

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
    const systemPrompt = buildSystemPrompt({ mode: appMode, country, language }, todayDate);
    const searchVerticals = getSearchVerticals(appMode, country);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEncode(event, data)));
        };

        try {
          const messages: Array<{ role: string; content: unknown }> = [
            ...history,
            { role: 'user', content: trimmedMessage },
          ];

          let allSources: Array<{ title: string; slug: string }> = [];
          let finalText = '';
          let toolRound = 0;

          async function callClaude(
            msgs: Array<{ role: string; content: unknown }>,
            includeTools: boolean
          ) {
            const body: Record<string, unknown> = {
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8000,
              system: systemPrompt,
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
                    'anthropic-beta': 'web-search-2025-03-05',
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

                if (res.status < 500 && res.status !== 429) {
                  break;
                }

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

            return { _error: true, status: lastStatus, detail: lastError };
          }

          function processBlocks(contentBlocks: Array<Record<string, unknown>>) {
            const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
            const blockTypes: string[] = [];
            let text = '';
            for (const block of contentBlocks) {
              const type = block.type as string;
              blockTypes.push(type);
              if (type === 'thinking' || type === 'redacted_thinking') {
                send('status', { phase: 'thinking', message: 'Thinking deeply...' });
              } else if (type === 'text') {
                text += (block.text as string) || '';
              } else if (type === 'tool_use') {
                toolUseBlocks.push({
                  id: block.id as string,
                  name: block.name as string,
                  input: block.input as Record<string, unknown>,
                });
              }
            }
            return { text, toolUseBlocks, blockTypes };
          }

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

          let lastStopReason = '';
          let errored = false;
          let interimText = '';
          let consecutiveEmptyKbResults = 0;
          const kbFindings: string[] = [];

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
              errored = true;
              break;
            }

            const contentBlocks = claudeData.content || [];
            lastStopReason = claudeData.stop_reason || '';
            const { text: responseText, toolUseBlocks, blockTypes } = processBlocks(contentBlocks);

            console.log(
              `[Chat API] Round ${toolRound}: stop_reason=${lastStopReason}, blocks=[${blockTypes.join(',')}], text_len=${responseText.length}, tools=[${toolUseBlocks.map(t => t.name).join(',')}]`
            );

            if (responseText) {
              interimText += (interimText ? '\n\n' : '') + responseText;
            }

            if (lastStopReason === 'end_turn') {
              const looksLikePreamble =
                toolUseBlocks.length === 0 &&
                responseText.length < 500 &&
                /\b(let me|i['']ll|i will|i'll help|allow me)\b/i.test(responseText);
              if (looksLikePreamble && toolRound < MAX_TOOL_ROUNDS) {
                messages.push({ role: 'assistant', content: contentBlocks });
                messages.push({
                  role: 'user',
                  content:
                    'Proceed with the research now. Call knowledge_base_search ' +
                    'and/or web_search as needed, then compose the full response ' +
                    'in a single turn. Do not preamble.',
                });
                continue;
              }
              finalText = responseText;
              break;
            }

            if (lastStopReason === 'max_tokens') {
              finalText = responseText;
              break;
            }

            if (toolUseBlocks.length === 0) {
              finalText = responseText;
              break;
            }

            messages.push({ role: 'assistant', content: contentBlocks });

            const toolResults: Array<{
              type: 'tool_result';
              tool_use_id: string;
              content: string;
            }> = [];

            for (const toolCall of toolUseBlocks) {
              if (toolCall.name === 'web_search') {
                continue;
              }

              send('status', {
                phase: 'searching',
                message:
                  toolCall.name === 'knowledge_base_search'
                    ? `Searching knowledge base: "${(toolCall.input.query as string)?.slice(0, 60)}..."`
                    : `Using ${toolCall.name}...`,
              });

              const result = await executeToolCall(toolCall.name, toolCall.input, searchVerticals);

              if (toolCall.name === 'knowledge_base_search') {
                const isEmpty = result.startsWith('No relevant results');
                if (isEmpty) {
                  consecutiveEmptyKbResults++;
                } else {
                  consecutiveEmptyKbResults = 0;
                  kbFindings.push(result);
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

            if (consecutiveEmptyKbResults >= 2) {
              break;
            }
          }

          const preamblePattern =
            /\b(let me (search|help|look|find|check|start)|i['']ll (search|help|look|find|check|start)|i will (search|help|look|find|check|start)|allow me to)/i;
          const looksStub =
            finalText.length > 0 &&
            finalText.length < 500 &&
            preamblePattern.test(finalText);
          const needsSynthesis = !errored && (!finalText || looksStub);
          if (needsSynthesis) {
            send('status', { phase: 'writing', message: 'Composing final answer...' });

            const researchText =
              kbFindings.length > 0
                ? kbFindings.map((f) => f.slice(0, 3000)).join('\n\n---\n\n').slice(0, 12000)
                : '';

            const synthesisUserContent = researchText
              ? `${trimmedMessage}\n\n---\n\nResearch gathered so far from the knowledge base:\n\n${researchText}\n\n---\n\nBased on the research above and your general expert knowledge, compose the full, complete response to my original question now. Use markdown structure (headings, bullets, tables where helpful). Provide substantive content — do not return empty text.`
              : `${trimmedMessage}\n\n(Note: the knowledge base did not have specific data on this topic. Please answer from your general expert knowledge, structured with markdown headings and bullets. Do not return empty text.)`;

            const synthesisMessages: Array<{ role: string; content: unknown }> = [
              ...history,
              { role: 'user', content: synthesisUserContent },
            ];

            const synthesisData = await callClaude(synthesisMessages, false);
            if (synthesisData && !synthesisData._error) {
              const synthesisBlocks = synthesisData.content || [];
              lastStopReason = synthesisData.stop_reason || '';
              const { text: synthesisText } = processBlocks(synthesisBlocks);
              if (synthesisText && synthesisText.length > finalText.length) {
                finalText = synthesisText;
              }
            }

            if (!finalText && interimText) {
              finalText = interimText;
            }
          }

          if (!errored && !finalText) {
            send('error', {
              message: 'I had trouble composing a complete response. Please try rephrasing your question or ask something more specific.',
            });
            errored = true;
          }

          if (errored) {
            return;
          }

          send('status', { phase: 'writing', message: 'Composing response...' });
          await streamText(finalText);

          let wave = 0;
          while (lastStopReason === 'max_tokens' && wave < MAX_CONTINUATION_WAVES) {
            wave++;
            send('status', { phase: 'writing', message: `Continuing response (wave ${wave + 1})...` });

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

            await streamText(waveText);
            finalText += waveText;
          }

          send('done', { sources: allSources, fullText: finalText });
        } catch (error) {
          console.error('[Chat API] Stream error:', error);
          send('error', { message: 'Failed to process request. Please try again.' });
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
