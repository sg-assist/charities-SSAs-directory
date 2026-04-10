package org.unfpa.otg.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "formulary_entries")
data class FormularyEntry(
    @PrimaryKey val drug: String,          // lowercase generic name, e.g. "oxytocin"
    val genericName: String,
    val localNamesJson: String,            // JSON object: {"my": "…", "id": "…"}
    val indication: String,
    val dose: String,
    val route: String,                     // IM | IV | oral | sublingual | rectal
    val timing: String,
    val alternativeDose: String?,
    val contraindicationsJson: String,     // JSON array of strings
    val warningsJson: String,              // JSON array of strings
    val source: String,                    // "WHO PCPNC 2023, Section 3.2, Page 47"
    val sourceChunkId: String,
    val sourceUrl: String,
    val whoEmlListed: Boolean,
    val clinicalStatus: String,            // "VERIFIED" | "UNVERIFIED-SCAFFOLD"
    val reviewedBy: String?,
    val reviewedAt: String?,               // ISO-8601
    val expiryDate: String?,               // ISO-8601
)
