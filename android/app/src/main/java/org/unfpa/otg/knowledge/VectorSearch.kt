package org.unfpa.otg.knowledge

import org.unfpa.otg.db.KnowledgeChunk
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * VectorSearch — in-memory cosine similarity scan over all chunk embeddings.
 *
 * At ~8,000 chunks × 384 dims × 4 bytes = ~12 MB. Fits comfortably in RAM.
 * Cosine similarity is used (all embeddings are L2-normalised, so dot product == cosine).
 *
 * load() must be called once after the DB is populated. After that,
 * search() is pure in-memory with no IO.
 */
class VectorSearch {

    private data class Entry(
        val chunkId: String,
        val documentTitle: String,
        val docSlug: String,
        val content: String,
        val sourcePage: Int,
        val sourceSection: String,
        val sourceDocument: String,
        val sourceUrl: String,
        val verbatimExcerpt: String,
        val expiryDate: String?,
        val vertical: String,
        val embedding: FloatArray,
    )

    data class RawResult(
        val chunkId: String,
        val documentTitle: String,
        val docSlug: String,
        val content: String,
        val sourcePage: Int,
        val sourceSection: String,
        val sourceDocument: String,
        val sourceUrl: String,
        val verbatimExcerpt: String,
        val expiryDate: String?,
        val vertical: String,
        val score: Float,
    )

    private var entries: List<Entry> = emptyList()

    /**
     * Load all chunks from Room into the in-memory index.
     * Called once during app initialisation.
     */
    fun load(chunks: List<KnowledgeChunk>) {
        // We need doc metadata (title, vertical) which is on KnowledgeChunk via docSlug.
        // KnowledgeChunk carries documentTitle via the denormalised index.json fields —
        // but the entity only has docSlug. We rely on the sourceDocument field as title fallback.
        entries = chunks.map { c ->
            Entry(
                chunkId = c.chunkId,
                documentTitle = c.sourceDocument.ifBlank { c.docSlug },
                docSlug = c.docSlug,
                content = c.content,
                sourcePage = c.sourcePage,
                sourceSection = c.sourceSection,
                sourceDocument = c.sourceDocument,
                sourceUrl = c.sourceUrl,
                verbatimExcerpt = c.verbatimExcerpt,
                expiryDate = c.expiryDate,
                vertical = "",   // populated from doc via KnowledgeRepository if needed
                embedding = bytesToFloats(c.embedding),
            )
        }
    }

    /**
     * Load with full doc metadata (preferred path — call from KnowledgeRepository).
     */
    fun loadWithMeta(chunks: List<KnowledgeChunk>, docTitleBySlug: Map<String, String>, docVerticalBySlug: Map<String, String>) {
        entries = chunks.map { c ->
            Entry(
                chunkId = c.chunkId,
                documentTitle = docTitleBySlug[c.docSlug] ?: c.sourceDocument.ifBlank { c.docSlug },
                docSlug = c.docSlug,
                content = c.content,
                sourcePage = c.sourcePage,
                sourceSection = c.sourceSection,
                sourceDocument = c.sourceDocument,
                sourceUrl = c.sourceUrl,
                verbatimExcerpt = c.verbatimExcerpt,
                expiryDate = c.expiryDate,
                vertical = docVerticalBySlug[c.docSlug] ?: "",
                embedding = bytesToFloats(c.embedding),
            )
        }
    }

    /**
     * Return top-K results by cosine similarity to [queryEmbedding].
     * queryEmbedding must be L2-normalised (produced by EmbeddingEngine.embed()).
     */
    fun search(queryEmbedding: FloatArray, topK: Int): List<RawResult> {
        if (entries.isEmpty()) return emptyList()

        return entries.map { e ->
            val score = dotProduct(queryEmbedding, e.embedding)
            e to score
        }
            .sortedByDescending { it.second }
            .take(topK)
            .map { (e, score) ->
                RawResult(
                    chunkId = e.chunkId,
                    documentTitle = e.documentTitle,
                    docSlug = e.docSlug,
                    content = e.content,
                    sourcePage = e.sourcePage,
                    sourceSection = e.sourceSection,
                    sourceDocument = e.sourceDocument,
                    sourceUrl = e.sourceUrl,
                    verbatimExcerpt = e.verbatimExcerpt,
                    expiryDate = e.expiryDate,
                    vertical = e.vertical,
                    score = score,
                )
            }
    }

    private fun dotProduct(a: FloatArray, b: FloatArray): Float {
        var sum = 0f
        for (i in a.indices) sum += a[i] * b[i]
        return sum
    }

    private fun bytesToFloats(bytes: ByteArray): FloatArray {
        val buf = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        return FloatArray(buf.remaining()).also { buf.get(it) }
    }

    fun size(): Int = entries.size
}
