package org.unfpa.otg.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "knowledge_docs")
data class KnowledgeDoc(
    @PrimaryKey val slug: String,
    val title: String,
    val vertical: String,       // UNFPA | CLINICAL | MISP | CHW | MOH_MMR | FORMULARY | etc.
    val contentHash: String,    // SHA-256 of raw content — used for OTA change detection
    val expiryDate: String?,    // ISO-8601 date; null = no expiry
    val sourceUrl: String?,
    val language: String,       // BCP-47, e.g. "en", "my", "id"
    val ingestedAt: Long,       // epoch millis
)
