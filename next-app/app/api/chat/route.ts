import { NextRequest } from 'next/server';
import { searchKnowledge } from '@/services/knowledgeDocumentService';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_ROUNDS = 3;      // safety cap on agentic tool-use loops
const MAX_CONTINUATION_WAVES = 2; // max waves of continued generation on max_tokens cutoff

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
  semantic search. Try 1–2 focused queries. If the knowledge base returns "No relevant
  results" twice in a row, STOP searching the knowledge base and compose your answer
  using web search results plus your general expert knowledge.
- Think step-by-step. When a user asks about a specific funder or partner, ALWAYS search
  the web for their latest priorities, strategy documents, and recent activities BEFORE
  drafting your response.

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
            // Keep the request simple: no extended thinking, just text + tool
            // calls. Extended thinking added complexity (signature-preserving
            // assistant turns, token budgeting against max_tokens, empty-text
            // responses when budget exhausted) without measurable quality win
            // for this use case. Claude Sonnet 4 is plenty capable without it.
            const body: Record<string, unknown> = {
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8000,
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
              // server_tool_use and web_search_tool_result are handled inline
              // by Anthropic — we don't need to do anything with them here,
              // but we still log their presence via blockTypes.
            }
            return { text, toolUseBlocks, blockTypes };
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
          let errored = false;
          // Track text accumulated across tool-use rounds (Claude may emit
          // commentary text alongside each tool_use block). Used as a
          // last-resort fallback if both the loop and the synthesis call
          // fail to produce a final answer.
          let interimText = '';
          // Track consecutive empty KB results. If the knowledge base has
          // no relevant data on the topic, Claude will often loop calling
          // knowledge_base_search with variations of the same query. We
          // break out of the loop early to stop wasting rounds.
          let consecutiveEmptyKbResults = 0;
          // Accumulate non-empty KB findings as plain text so the synthesis
          // call can use them without needing the raw tool_use/tool_result
          // block structure (which confuses Claude when tools are disabled).
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

            // Preserve any text Claude produced this round so we never lose it,
            // even if a later break/continue path doesn't pick it up.
            if (responseText) {
              interimText += (interimText ? '\n\n' : '') + responseText;
            }

            // If Claude is done with tool-use (stop_reason=end_turn means the
            // whole response is complete; no more tool calls will come).
            if (lastStopReason === 'end_turn') {
              // Guard against premature preamble-only endings: if Claude
              // stopped with no tool calls at all AND produced only a short
              // "let me search..." style preamble on an early round, nudge it
              // to actually do the work instead of accepting an empty answer.
              const looksLikePreamble =
                toolUseBlocks.length === 0 &&
                responseText.length < 500 &&
                /\b(let me|i['’]ll|i will|i'll help|allow me)\b/i.test(responseText);
              if (looksLikePreamble && toolRound < MAX_TOOL_ROUNDS) {
                console.warn(
                  `[Chat API] Premature preamble-only response on round ${toolRound} — nudging Claude to proceed with research`
                );
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

            // If stopped due to max_tokens, take whatever text we have. Phase 2
            // wave generation will try to continue from there.
            if (lastStopReason === 'max_tokens') {
              finalText = responseText;
              break;
            }

            // If Claude had nothing to contribute (no text, no tool calls), stop.
            if (toolUseBlocks.length === 0) {
              console.warn(
                `[Chat API] Round ${toolRound} produced no text and no tool calls, stopping loop`
              );
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

              // Track consecutive empty KB results for early-exit heuristic,
              // collect sources for citation, and stash non-empty findings
              // as plain text for the synthesis fallback.
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

            // If the KB is clearly dry on this topic, stop looping and go
            // straight to synthesis. Otherwise Claude keeps generating
            // variations of the same query and wasting rounds.
            if (consecutiveEmptyKbResults >= 2) {
              console.warn(
                '[Chat API] 2+ consecutive empty KB results — breaking loop early to synthesize'
              );
              break;
            }
          }

          // If the agentic loop exited without producing a usable finalText
          // (empty, or a suspicious preamble-only stub), force one more Claude
          // call WITHOUT tools. Without tool access Claude can't say "let me
          // search" — it has to emit the actual answer as text.
          const preamblePattern =
            /\b(let me (search|help|look|find|check|start)|i['’]ll (search|help|look|find|check|start)|i will (search|help|look|find|check|start)|allow me to)/i;
          const looksStub =
            finalText.length > 0 &&
            finalText.length < 500 &&
            preamblePattern.test(finalText);
          const needsSynthesis = !errored && (!finalText || looksStub);
          if (needsSynthesis) {
            console.warn(
              '[Chat API] Forcing final synthesis. toolRound:',
              toolRound,
              'lastStopReason:',
              lastStopReason,
              'finalText.length:',
              finalText.length,
              'looksStub:',
              looksStub,
              'interimText.length:',
              interimText.length,
              'sources:',
              allSources.length
            );
            send('status', {
              phase: 'writing',
              message: 'Composing final answer...',
            });

            // Rebuild the conversation as a CLEAN text-only message history
            // for the synthesis call. Why: when the original messages array
            // contains tool_use / tool_result / server_tool_use /
            // web_search_tool_result blocks from prior rounds AND the current
            // request has no tools defined, Claude consistently returns an
            // empty response (stop_reason=end_turn, blocks=[]). Stripping the
            // tool-block plumbing and inlining any research findings as plain
            // text gives Claude a clean conversation it can respond to.
            //
            // Trade-off: encrypted web_search_tool_result blocks can't be
            // decoded to plain text outside their original response context,
            // so the synthesis path loses web search data. The kbFindings
            // array (populated in the tool-execution loop above) preserves
            // any non-empty KB results as plain text so they survive the
            // rebuild. If both KB and web were dry, Claude falls back to
            // general knowledge per the RESPONSE PROTOCOL in the system
            // prompt.
            const researchText =
              kbFindings.length > 0
                ? kbFindings
                    .map((f) => f.slice(0, 3000))
                    .join('\n\n---\n\n')
                    .slice(0, 12000)
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
              const { text: synthesisText, blockTypes: synthBlockTypes } =
                processBlocks(synthesisBlocks);
              console.log(
                `[Chat API] Synthesis result: stop_reason=${lastStopReason}, blocks=[${synthBlockTypes.join(',')}], text_len=${synthesisText.length}, research_chars=${researchText.length}`
              );
              if (synthesisText && synthesisText.length > finalText.length) {
                finalText = synthesisText;
              }
            } else {
              console.error(
                '[Chat API] Synthesis call failed:',
                synthesisData?.status,
                synthesisData?.detail
              );
            }

            // Still empty? Fall back to whatever interim text we collected
            // from exploration rounds.
            if (!finalText && interimText) {
              console.warn(
                '[Chat API] Synthesis produced no text — falling back to interimText'
              );
              finalText = interimText;
            }
          }

          // If we STILL have nothing after synthesis + interimText fallback,
          // log the full conversation state so we can diagnose from Vercel
          // logs, then surface a real error. This should be extremely rare.
          if (!errored && !finalText) {
            console.error(
              '[Chat API] Empty finalText after all fallbacks. toolRound:',
              toolRound,
              'lastStopReason:',
              lastStopReason,
              'messages.length:',
              messages.length,
              'allSources:',
              allSources.length,
              'kbFindings:',
              kbFindings.length
            );
            // Dump the last two turns of the conversation so future
            // regressions are easier to diagnose from Vercel logs.
            try {
              console.error(
                '[Chat API] Last 2 turns (truncated):',
                JSON.stringify(messages.slice(-2)).slice(0, 3000)
              );
            } catch {
              /* non-serialisable content — ignore */
            }
            send('error', {
              message:
                'I had trouble composing a complete response. Please try rephrasing your question or ask something more specific.',
            });
            errored = true;
          }

          if (errored) {
            return;
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
