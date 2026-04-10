package org.unfpa.otg.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Local clinical answer audit trail — never auto-uploaded.
 * Exportable on demand for incident review.
 */
@Entity(tableName = "audit_log")
data class AuditLogEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sessionId: String,
    val mode: String,                      // clinical | community | partnership
    val country: String,
    val language: String,
    val question: String,
    val answer: String,
    val citationChunkIdsJson: String,      // JSON array of chunk IDs cited
    val kbVersion: String,
    val modelVersion: String,
    val hasDoseCard: Boolean,
    val doseCardDrug: String?,
    val validatorPassed: Boolean,
    val validatorWarningsJson: String,     // JSON array of ValidationWarning
    val answeredAt: Long,                  // epoch millis
)
