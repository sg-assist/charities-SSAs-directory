package org.unfpa.otg.ai

import org.unfpa.otg.knowledge.KnowledgeRepository

/**
 * CitationValidator — post-generation safety check for clinical answers.
 *
 * Runs on every LLM response before it is displayed in Clinical or Community mode.
 * Checks:
 *   1. All [SRC:chunk_id] tags reference chunks that exist in the local KB
 *   2. No bare dose numbers appear without a citation tag immediately following
 *   3. Diagnostic language ("the diagnosis is") is flagged
 *
 * Port of the citation validation logic described in the implementation plan.
 */
class CitationValidator(private val knowledgeRepo: KnowledgeRepository) {

    // Matches dose numbers: "4 g", "10 IU", "600 mcg", "1 mL", etc.
    private val DOSE_REGEX = Regex(
        """\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|IU|mL|ml|L|units?|drops?|tablets?|caps?)\b""",
        RegexOption.IGNORE_CASE
    )
    // Matches [SRC:chunk_id] citation tags
    private val CITATION_TAG_REGEX = Regex("""\[SRC:([^\]]+)]""")
    // Matches <<DOSE_CARD_REQUEST:drug>> triggers
    private val DOSE_CARD_REGEX = Regex("""<<DOSE_CARD_REQUEST:[^>]+>>""")
    // Diagnostic language
    private val DIAGNOSTIC_REGEX = Regex(
        """\b(the diagnosis is|you (?:have|are suffering from)|this is a case of)\b""",
        RegexOption.IGNORE_CASE
    )

    data class ValidationResult(
        val passed: Boolean,
        val correctedText: String?,
        val warnings: List<ValidationWarning>,
    )

    data class ValidationWarning(
        val type: String,   // "undisclaimed_dose" | "unknown_chunk_id" | "diagnostic_language"
        val detail: String,
        val position: Int,
    )

    suspend fun validate(text: String, declaredChunkIds: List<String>): ValidationResult {
        val warnings = mutableListOf<ValidationWarning>()
        var workingText = text

        // 1. Verify all [SRC:chunk_id] tags reference known chunks
        CITATION_TAG_REGEX.findAll(text).forEach { match ->
            val chunkId = match.groupValues[1]
            if (!declaredChunkIds.contains(chunkId) && !knowledgeRepo.chunkExists(chunkId)) {
                warnings.add(ValidationWarning(
                    type = "unknown_chunk_id",
                    detail = "Citation [SRC:$chunkId] references unknown chunk",
                    position = match.range.first,
                ))
            }
        }

        // 2. Scan for dose numbers not immediately followed by a citation tag
        val allCitationPositions = CITATION_TAG_REGEX.findAll(text).map { it.range.last }.toSet()
        DOSE_REGEX.findAll(text).forEach { doseMatch ->
            // Skip if inside a DOSE_CARD_REQUEST block
            if (DOSE_CARD_REGEX.containsMatchIn(text.substring(
                    maxOf(0, doseMatch.range.first - 50),
                    minOf(text.length, doseMatch.range.last + 50)
                ))) return@forEach

            // Check if a [SRC:...] tag appears within 150 chars after the dose number
            val searchEnd = minOf(text.length, doseMatch.range.last + 150)
            val nearbyText = text.substring(doseMatch.range.last, searchEnd)
            if (!CITATION_TAG_REGEX.containsMatchIn(nearbyText)) {
                warnings.add(ValidationWarning(
                    type = "undisclaimed_dose",
                    detail = "Dose '${doseMatch.value}' has no citation tag within 150 characters",
                    position = doseMatch.range.first,
                ))
                // Append an amber warning marker inline
                workingText = workingText.replace(
                    doseMatch.value,
                    "${doseMatch.value} ⚠️[unverified — check source]",
                )
            }
        }

        // 3. Flag diagnostic language
        DIAGNOSTIC_REGEX.findAll(text).forEach { match ->
            warnings.add(ValidationWarning(
                type = "diagnostic_language",
                detail = "Diagnostic phrase detected: '${match.value}' — remove or reframe",
                position = match.range.first,
            ))
        }

        val passed = warnings.none { it.type == "undisclaimed_dose" || it.type == "unknown_chunk_id" }
        return ValidationResult(
            passed = passed,
            correctedText = if (workingText != text) workingText else null,
            warnings = warnings,
        )
    }
}
