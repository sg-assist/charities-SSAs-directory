package org.unfpa.otg.ai

import org.unfpa.otg.knowledge.KnowledgeRepository

/**
 * ToolExecutor — routes tool calls from AgentOrchestrator to the
 * appropriate repository methods.
 *
 * Currently supports:
 *   - knowledge_base_search → KnowledgeRepository.search(query, limit, verticals)
 *
 * Returns formatted result strings that are fed back into the Gemma prompt.
 */
class ToolExecutor(private val knowledgeRepo: KnowledgeRepository) {

    /**
     * Execute a semantic knowledge base search and format the results as a
     * plain-text block ready to be injected into the Gemma prompt.
     *
     * Each result block has the format expected by AgentOrchestrator's
     * chunk_id and source extractors:
     *   chunk_id="<id>" From "<title>" (page <page>)
     *   <content>
     */
    suspend fun searchKnowledge(
        query: String,
        limit: Int,
        verticals: List<String>,
    ): String {
        if (query.isBlank()) return ""

        val results = knowledgeRepo.search(
            query = query,
            topK = limit.coerceIn(1, 10),
            verticals = verticals,
        )

        if (results.isEmpty()) return ""

        return results.joinToString("\n\n---\n\n") { r ->
            buildString {
                append("chunk_id=\"${r.chunkId}\" ")
                append("From \"${r.documentTitle}\"")
                if (r.sourcePage > 0) append(" (page ${r.sourcePage})")
                if (r.sourceSection.isNotBlank()) append(" — ${r.sourceSection}")
                append("\n")
                append(r.content)
            }
        }
    }
}
