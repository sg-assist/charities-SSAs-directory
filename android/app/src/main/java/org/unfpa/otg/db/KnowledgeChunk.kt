package org.unfpa.otg.db

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "knowledge_chunks",
    foreignKeys = [
        ForeignKey(
            entity = KnowledgeDoc::class,
            parentColumns = ["slug"],
            childColumns = ["docSlug"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("docSlug")],
)
data class KnowledgeChunk(
    @PrimaryKey val chunkId: String,        // e.g. "PCPNC-2023-03-12"
    val docSlug: String,
    val chunkIndex: Int,
    val content: String,                    // full chunk text
    val contentHash: String,               // SHA-256 of content
    val embedding: ByteArray,              // Float32LE, 384 dims × 4 bytes = 1536 bytes

    // Citation metadata
    val sourceDocument: String,            // "WHO PCPNC 2023"
    val sourceEdition: String,
    val sourceSection: String,
    val sourcePage: Int,
    val sourceUrl: String,
    val verbatimExcerpt: String,           // exact verbatim text from source

    val expiryDate: String?,               // ISO-8601; null = no expiry
    val language: String,                  // BCP-47
    val ingestedAt: Long,                  // epoch millis
)
