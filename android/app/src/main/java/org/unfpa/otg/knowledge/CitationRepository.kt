package org.unfpa.otg.knowledge

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.unfpa.otg.db.AppDatabase
import java.security.MessageDigest

/**
 * CitationRepository — resolves [SRC:chunk_id] tags to full citation metadata
 * and verifies verbatim excerpts via SHA-256 integrity check.
 *
 * Used by CitationDrawer to display source, section, page, verbatim excerpt,
 * and the "Verify online" link.
 */
class CitationRepository(private val context: Context) {

    private val db = AppDatabase.getInstance(context)

    data class CitationDetail(
        val chunkId: String,
        val sourceDocument: String,
        val sourceEdition: String,
        val sourceSection: String,
        val sourcePage: Int,
        val sourceUrl: String,
        val verbatimExcerpt: String,
        val contentHash: String,
        val expiryDate: String?,
        val isExpired: Boolean,
        val integrityOk: Boolean,   // true if stored hash matches computed hash of verbatim excerpt
    )

    suspend fun getCitation(chunkId: String): CitationDetail? = withContext(Dispatchers.IO) {
        val chunk = db.knowledgeChunkDao().getById(chunkId) ?: return@withContext null

        val computedHash = sha256(chunk.content)
        val integrityOk = computedHash.equals(chunk.contentHash, ignoreCase = true)

        val isExpired = chunk.expiryDate?.let { expiry ->
            try {
                val parts = expiry.split("-")
                val expiryYear = parts[0].toInt()
                val expiryMonth = parts[1].toInt()
                val now = java.util.Calendar.getInstance()
                val nowYear = now.get(java.util.Calendar.YEAR)
                val nowMonth = now.get(java.util.Calendar.MONTH) + 1
                expiryYear < nowYear || (expiryYear == nowYear && expiryMonth < nowMonth)
            } catch (e: Exception) { false }
        } ?: false

        CitationDetail(
            chunkId = chunkId,
            sourceDocument = chunk.sourceDocument,
            sourceEdition = chunk.sourceEdition,
            sourceSection = chunk.sourceSection,
            sourcePage = chunk.sourcePage,
            sourceUrl = chunk.sourceUrl,
            verbatimExcerpt = chunk.verbatimExcerpt.ifBlank { chunk.content.take(500) },
            contentHash = chunk.contentHash,
            expiryDate = chunk.expiryDate,
            isExpired = isExpired,
            integrityOk = integrityOk,
        )
    }

    /**
     * Resolve multiple chunk IDs at once — used when loading sources panel
     * for a full conversation turn.
     */
    suspend fun getCitations(chunkIds: List<String>): List<CitationDetail> =
        withContext(Dispatchers.IO) {
            chunkIds.mapNotNull { getCitation(it) }
        }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }
}
