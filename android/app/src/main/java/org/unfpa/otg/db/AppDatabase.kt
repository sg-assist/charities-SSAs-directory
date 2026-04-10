package org.unfpa.otg.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction

@Database(
    entities = [KnowledgeDoc::class, KnowledgeChunk::class, FormularyEntry::class, AuditLogEntry::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun knowledgeDocDao(): KnowledgeDocDao
    abstract fun knowledgeChunkDao(): KnowledgeChunkDao
    abstract fun formularyDao(): FormularyDao
    abstract fun auditLogDao(): AuditLogDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "otg_knowledge.db",
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
    }
}

@Dao
interface KnowledgeDocDao {
    @Query("SELECT * FROM knowledge_docs WHERE slug = :slug LIMIT 1")
    suspend fun getBySlug(slug: String): KnowledgeDoc?

    @Query("SELECT * FROM knowledge_docs WHERE vertical = :vertical")
    suspend fun getByVertical(vertical: String): List<KnowledgeDoc>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(doc: KnowledgeDoc)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(docs: List<KnowledgeDoc>)

    @Query("DELETE FROM knowledge_docs WHERE slug = :slug")
    suspend fun deleteBySlug(slug: String)

    @Query("SELECT COUNT(*) FROM knowledge_docs")
    suspend fun count(): Int
}

@Dao
interface KnowledgeChunkDao {
    @Query("SELECT * FROM knowledge_chunks WHERE chunkId = :chunkId LIMIT 1")
    suspend fun getById(chunkId: String): KnowledgeChunk?

    @Query("SELECT chunkId FROM knowledge_chunks WHERE docSlug = :docSlug")
    suspend fun getChunkIdsByDoc(docSlug: String): List<String>

    @Query("SELECT * FROM knowledge_chunks")
    suspend fun getAll(): List<KnowledgeChunk>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(chunk: KnowledgeChunk)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(chunks: List<KnowledgeChunk>)

    @Query("DELETE FROM knowledge_chunks WHERE docSlug = :docSlug")
    suspend fun deleteByDoc(docSlug: String)

    @Query("SELECT COUNT(*) FROM knowledge_chunks")
    suspend fun count(): Int

    @Transaction
    suspend fun replaceChunksForDoc(docSlug: String, chunks: List<KnowledgeChunk>) {
        deleteByDoc(docSlug)
        upsertAll(chunks)
    }
}

@Dao
interface FormularyDao {
    @Query("SELECT * FROM formulary_entries WHERE drug = :drug LIMIT 1")
    suspend fun getByDrug(drug: String): FormularyEntry?

    @Query("SELECT * FROM formulary_entries")
    suspend fun getAll(): List<FormularyEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entries: List<FormularyEntry>)

    @Query("SELECT COUNT(*) FROM formulary_entries")
    suspend fun count(): Int
}

@Dao
interface AuditLogDao {
    @Insert
    suspend fun insert(entry: AuditLogEntry)

    @Query("SELECT * FROM audit_log ORDER BY answeredAt DESC LIMIT :limit")
    suspend fun getRecent(limit: Int = 100): List<AuditLogEntry>

    @Query("SELECT * FROM audit_log ORDER BY answeredAt DESC")
    suspend fun getAll(): List<AuditLogEntry>

    @Query("DELETE FROM audit_log WHERE answeredAt < :beforeEpochMillis")
    suspend fun deleteOlderThan(beforeEpochMillis: Long)
}
