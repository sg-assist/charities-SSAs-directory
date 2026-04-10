package org.unfpa.otg.ai

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.unfpa.otg.knowledge.KnowledgeRepository
import org.unfpa.otg.knowledge.SearchResult

/**
 * AgentOrchestrator — port of next-app/app/api/chat/route.ts agentic loop.
 *
 * Implements the same 3-round tool-use loop:
 *   1. Send prompt to Gemma 4 with tool definitions
 *   2. Parse tool calls from response
 *   3. Execute tools (knowledge_base_search, web_search if online)
 *   4. Feed results back for next round
 *   5. Repeat up to MAX_TOOL_ROUNDS; synthesise final answer
 *
 * Emits AgentEvent objects that the ViewModel converts to UI state.
 */
class AgentOrchestrator(
    private val gemma: GemmaEngine,
    private val knowledgeRepo: KnowledgeRepository,
    private val toolExecutor: ToolExecutor,
    private val citationValidator: CitationValidator,
    private val promptBuilder: SystemPromptBuilder,
) {
    companion object {
        const val MAX_TOOL_ROUNDS = 3
        val PREAMBLE_REGEX = Regex(
            """\b(let me (search|help|look|find|check)|i['']ll (search|help|look|find)|allow me to)\b""",
            RegexOption.IGNORE_CASE
        )
    }

    sealed class AgentEvent {
        data class Status(val phase: String, val message: String) : AgentEvent()
        data class TextDelta(val text: String) : AgentEvent()
        data class Done(
            val fullText: String,
            val sources: List<SourceRef>,
            val citationChunkIds: List<String>,
            val hasDoseCard: Boolean,
            val doseCardDrug: String? = null,
        ) : AgentEvent()
        data class Error(val message: String) : AgentEvent()
    }

    data class SourceRef(val title: String, val slug: String, val chunkId: String)

    /**
     * Run the agentic loop for a user message. Returns a Flow of AgentEvents.
     */
    fun run(
        userMessage: String,
        conversationHistory: List<Pair<String, String>>, // (role, content)
        mode: String,
        country: String,
        language: String,
    ): Flow<AgentEvent> = flow {
        val systemPrompt = promptBuilder.build(mode, country, language)
        val verticals = promptBuilder.verticals(mode, country)

        val sources = mutableListOf<SourceRef>()
        val citationChunkIds = mutableListOf<String>()
        val kbFindings = mutableListOf<String>()

        var finalText = ""
        var interimText = ""
        var consecutiveEmptyKb = 0
        var toolRound = 0
        var lastStopReason = ""
        var hasDoseCard = false
        var doseCardDrug: String? = null

        // Build full prompt with conversation history
        val messages = buildMessageList(systemPrompt, conversationHistory, userMessage)

        // ── Phase 1: Agentic tool-use loop ─────────────────────────────────────
        while (toolRound < MAX_TOOL_ROUNDS) {
            toolRound++
            emit(AgentEvent.Status(
                phase = if (toolRound == 1) "thinking" else "researching",
                message = if (toolRound == 1) "Analysing your question…" else "Gathering more information (step $toolRound)…"
            ))

            val response = gemma.generate(buildPromptWithTools(messages, mode))
            val parsed = parseGemmaResponse(response)
            lastStopReason = parsed.stopReason

            if (parsed.text.isNotEmpty()) interimText += "\n\n${parsed.text}"

            // Preamble-only stub check (same as web app)
            if (parsed.toolCalls.isEmpty()
                && parsed.text.length < 500
                && PREAMBLE_REGEX.containsMatchIn(parsed.text)
                && toolRound < MAX_TOOL_ROUNDS
            ) {
                messages.add(Pair("assistant", parsed.text))
                messages.add(Pair("user",
                    "Proceed with research now. Call knowledge_base_search and compose the full response."
                ))
                continue
            }

            if (parsed.toolCalls.isEmpty() || lastStopReason == "end_turn") {
                finalText = parsed.text
                break
            }

            // Execute tool calls
            messages.add(Pair("assistant", response))
            val toolResults = StringBuilder()

            for (toolCall in parsed.toolCalls) {
                when (toolCall.name) {
                    "knowledge_base_search" -> {
                        emit(AgentEvent.Status("searching",
                            "Searching knowledge base: \"${toolCall.input["query"]?.take(60)}…\""))

                        val result = toolExecutor.searchKnowledge(
                            query = toolCall.input["query"] ?: "",
                            limit = (toolCall.input["limit"]?.toIntOrNull() ?: 5).coerceAtMost(10),
                            verticals = verticals,
                        )

                        if (result.isEmpty()) {
                            consecutiveEmptyKb++
                        } else {
                            consecutiveEmptyKb = 0
                            kbFindings.add(result)
                            // Extract sources and citation IDs
                            Regex("""chunk_id="([^"]+)"""").findAll(result).forEach { match ->
                                citationChunkIds.add(match.groupValues[1])
                            }
                            Regex("""From "([^"]+)"""").findAll(result).forEach { match ->
                                val title = match.groupValues[1]
                                if (sources.none { it.title == title }) {
                                    sources.add(SourceRef(
                                        title = title,
                                        slug = title.lowercase().replace(Regex("[^a-z0-9]+"), "-"),
                                        chunkId = citationChunkIds.lastOrNull() ?: "",
                                    ))
                                }
                            }
                        }
                        toolResults.appendLine("[knowledge_base_search result]: $result")
                    }

                    "dose_card_request" -> {
                        // <<DOSE_CARD_REQUEST:drug_name>> trigger
                        hasDoseCard = true
                        doseCardDrug = toolCall.input["drug"]
                    }
                }
            }

            messages.add(Pair("user", toolResults.toString()))

            if (consecutiveEmptyKb >= 2) break  // KB dry — synthesise
        }

        // ── Synthesis fallback (same logic as web app) ──────────────────────
        val looksStub = finalText.isNotEmpty() && finalText.length < 500 && PREAMBLE_REGEX.containsMatchIn(finalText)
        val needsSynthesis = finalText.isEmpty() || looksStub

        if (needsSynthesis) {
            emit(AgentEvent.Status("writing", "Composing final answer…"))
            val researchContext = if (kbFindings.isNotEmpty())
                kbFindings.joinToString("\n\n---\n\n") { it.take(3000) }.take(12000)
            else ""

            val synthesisPrompt = buildSynthesisPrompt(
                systemPrompt, conversationHistory, userMessage, researchContext, mode
            )
            val synthResponse = gemma.generate(synthesisPrompt)
            val parsed = parseGemmaResponse(synthResponse)
            if (parsed.text.length > finalText.length) finalText = parsed.text
        }

        if (finalText.isEmpty()) finalText = interimText
        if (finalText.isEmpty()) {
            emit(AgentEvent.Error("Unable to generate a response. Please try rephrasing your question."))
            return@flow
        }

        // ── Citation validation ──────────────────────────────────────────────
        val validationResult = citationValidator.validate(finalText, citationChunkIds)
        if (!validationResult.passed) {
            finalText = validationResult.correctedText ?: finalText
        }

        // ── Detect dose card trigger in final text ───────────────────────────
        val doseCardMatch = Regex("""<<DOSE_CARD_REQUEST:([^>]+)>>""").find(finalText)
        if (doseCardMatch != null) {
            hasDoseCard = true
            doseCardDrug = doseCardMatch.groupValues[1]
            finalText = finalText.replace(doseCardMatch.value, "")
        }

        // ── Stream the final text ────────────────────────────────────────────
        emit(AgentEvent.Status("writing", "Composing response…"))
        val chunkSize = 80
        for (i in finalText.indices step chunkSize) {
            emit(AgentEvent.TextDelta(finalText.substring(i, minOf(i + chunkSize, finalText.length))))
        }

        emit(AgentEvent.Done(
            fullText = finalText,
            sources = sources,
            citationChunkIds = citationChunkIds,
            hasDoseCard = hasDoseCard,
            doseCardDrug = doseCardDrug,
        ))
    }

    // ── Prompt construction helpers ─────────────────────────────────────────

    data class ParsedResponse(
        val text: String,
        val toolCalls: List<ToolCall>,
        val stopReason: String,
    )

    data class ToolCall(val name: String, val input: Map<String, String>)

    private fun parseGemmaResponse(response: String): ParsedResponse {
        // Gemma 4 function calling format — parse JSON tool calls from response
        // Format: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
        val toolCallRegex = Regex("""<tool_call>\s*(\{.*?})\s*</tool_call>""", RegexOption.DOT_MATCHES_ALL)
        val toolCalls = toolCallRegex.findAll(response).map { match ->
            try {
                val json = match.groupValues[1]
                // Simple JSON parsing — extract name and arguments
                val name = Regex(""""name"\s*:\s*"([^"]+)"""").find(json)?.groupValues?.get(1) ?: ""
                val args = Regex(""""arguments"\s*:\s*(\{[^}]*})""").find(json)?.let { argsMatch ->
                    Regex(""""(\w+)"\s*:\s*"([^"]+)"""").findAll(argsMatch.groupValues[1])
                        .associate { it.groupValues[1] to it.groupValues[2] }
                } ?: emptyMap()
                ToolCall(name, args)
            } catch (e: Exception) { null }
        }.filterNotNull().toList()

        val cleanText = toolCallRegex.replace(response, "").trim()
        val stopReason = if (toolCalls.isEmpty()) "end_turn" else "tool_use"
        return ParsedResponse(cleanText, toolCalls, stopReason)
    }

    private fun buildMessageList(
        systemPrompt: String,
        history: List<Pair<String, String>>,
        userMessage: String,
    ): MutableList<Pair<String, String>> {
        val messages = mutableListOf<Pair<String, String>>()
        messages.add(Pair("system", systemPrompt))
        messages.addAll(history.takeLast(20))
        messages.add(Pair("user", userMessage))
        return messages
    }

    private fun buildPromptWithTools(
        messages: List<Pair<String, String>>,
        mode: String,
    ): String {
        // Gemma 4 instruction format with tool definitions
        val sb = StringBuilder()
        for ((role, content) in messages) {
            when (role) {
                "system" -> sb.append("<system>\n$content\n</system>\n\n")
                "user" -> sb.append("<user>\n$content\n</user>\n\n")
                "assistant" -> sb.append("<assistant>\n$content\n</assistant>\n\n")
            }
        }
        // Append tool definitions
        sb.append(TOOL_DEFINITIONS_PROMPT)
        sb.append("\n<assistant>\n")
        return sb.toString()
    }

    private fun buildSynthesisPrompt(
        systemPrompt: String,
        history: List<Pair<String, String>>,
        userMessage: String,
        researchContext: String,
        mode: String,
    ): String {
        val contextualMessage = if (researchContext.isNotEmpty()) {
            "$userMessage\n\n---\nResearch from knowledge base:\n\n$researchContext\n\n---\nCompose the full response now."
        } else {
            "$userMessage\n\n(Note: knowledge base had no specific results. Answer from your expert knowledge.)"
        }
        val messages = buildMessageList(systemPrompt, history, contextualMessage)
        return buildPromptWithTools(messages, mode)
    }

    private val TOOL_DEFINITIONS_PROMPT = """
Available tools (call using <tool_call>{"name": "...", "arguments": {...}}</tool_call>):

1. knowledge_base_search: Search UNFPA internal knowledge base using semantic similarity.
   Arguments: {"query": "specific search term", "limit": "5"}
   Returns: Relevant document chunks with chunk_id for citation.

2. dose_card_request: Request a verified dose card from the formulary database.
   Arguments: {"drug": "generic drug name"}
   Use INSTEAD of generating drug doses yourself.
"""
}
