package org.unfpa.otg.knowledge

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.LongBuffer

/**
 * EmbeddingEngine — runs paraphrase-multilingual-MiniLM-L12-v2 via ONNX Runtime.
 *
 * Model: paraphrase-multilingual-MiniLM-L12-v2 (ONNX export, ~480 MB)
 * Output: 384-dimensional float32 embeddings, L2-normalised
 * Languages: 50+ including all T1/T2 targets (Burmese, Bangla, Khmer, etc.)
 *
 * Model file location: context.getExternalFilesDir("models")/multilingual-minilm.onnx
 * Tokenizer vocab: assets/models/multilingual-minilm-vocab.txt (SentencePiece)
 */
class EmbeddingEngine(private val context: Context) {

    companion object {
        const val MODEL_FILENAME = "multilingual-minilm.onnx"
        const val VOCAB_FILENAME = "multilingual-minilm-vocab.txt"
        const val MODEL_SUBDIR = "models"
        const val EMBEDDING_DIM = 384
        const val MAX_SEQ_LEN = 128

        fun modelFile(context: Context): File =
            File(context.getExternalFilesDir(MODEL_SUBDIR), MODEL_FILENAME)

        fun isModelAvailable(context: Context): Boolean = modelFile(context).exists()
    }

    private var env: OrtEnvironment? = null
    private var session: OrtSession? = null
    private var vocab: Map<String, Int> = emptyMap()
    private var unkId = 0
    private var clsId = 101
    private var sepId = 102
    private var padId = 0

    fun initialise() {
        env = OrtEnvironment.getEnvironment()
        val opts = OrtSession.SessionOptions().apply {
            addConfigEntry("session.intra_op_num_threads", "2")
        }
        session = env!!.createSession(modelFile(context).absolutePath, opts)
        vocab = loadVocab()
        unkId = vocab["[UNK]"] ?: 100
        clsId = vocab["[CLS]"] ?: 101
        sepId = vocab["[SEP]"] ?: 102
        padId = vocab["[PAD]"] ?: 0
    }

    /**
     * Compute a normalised 384-dim embedding for [text].
     * Returns FloatArray(384).
     */
    suspend fun embed(text: String): FloatArray = withContext(Dispatchers.Default) {
        val sess = session ?: error("EmbeddingEngine not initialised")
        val env = this@EmbeddingEngine.env ?: error("EmbeddingEngine not initialised")

        val tokens = tokenize(text).take(MAX_SEQ_LEN - 2)
        val inputIds = LongArray(MAX_SEQ_LEN)
        val attentionMask = LongArray(MAX_SEQ_LEN)
        val tokenTypeIds = LongArray(MAX_SEQ_LEN) // all zeros for single-sequence

        inputIds[0] = clsId.toLong()
        tokens.forEachIndexed { i, id -> inputIds[i + 1] = id.toLong() }
        inputIds[tokens.size + 1] = sepId.toLong()

        for (i in 0..tokens.size + 1) attentionMask[i] = 1L

        val shape = longArrayOf(1, MAX_SEQ_LEN.toLong())
        val inputIdsTensor  = OnnxTensor.createTensor(env, LongBuffer.wrap(inputIds), shape)
        val attentionTensor = OnnxTensor.createTensor(env, LongBuffer.wrap(attentionMask), shape)
        val tokenTypeTensor = OnnxTensor.createTensor(env, LongBuffer.wrap(tokenTypeIds), shape)

        val inputs = mapOf(
            "input_ids"      to inputIdsTensor,
            "attention_mask" to attentionTensor,
            "token_type_ids" to tokenTypeTensor,
        )

        val result = sess.run(inputs)
        // Model output: last_hidden_state [1, seq_len, 384] — mean-pool over attended tokens
        val hiddenState = result[0].value as Array<Array<FloatArray>>

        val embedding = FloatArray(EMBEDDING_DIM)
        var count = 0
        for (i in 0 until MAX_SEQ_LEN) {
            if (attentionMask[i] == 1L) {
                for (d in 0 until EMBEDDING_DIM) embedding[d] += hiddenState[0][i][d]
                count++
            }
        }
        if (count > 0) for (d in 0 until EMBEDDING_DIM) embedding[d] /= count

        l2Normalise(embedding)

        inputIdsTensor.close()
        attentionTensor.close()
        tokenTypeTensor.close()
        result.close()

        embedding
    }

    private fun l2Normalise(v: FloatArray) {
        var norm = 0f
        for (x in v) norm += x * x
        norm = Math.sqrt(norm.toDouble()).toFloat()
        if (norm > 0f) for (i in v.indices) v[i] /= norm
    }

    /**
     * Minimal WordPiece tokenizer over the SentencePiece vocab file.
     * For production accuracy, replace with a full HuggingFace tokenizer JAR
     * (e.g. djl-tokenizers) — this covers the common case adequately.
     */
    private fun tokenize(text: String): List<Int> {
        val ids = mutableListOf<Int>()
        for (word in text.lowercase().split(Regex("\\s+"))) {
            if (word.isBlank()) continue
            val wordPieces = wordpiece(word)
            ids.addAll(wordPieces.map { vocab[it] ?: unkId })
        }
        return ids
    }

    private fun wordpiece(word: String): List<String> {
        if (vocab.containsKey(word)) return listOf(word)
        val pieces = mutableListOf<String>()
        var start = 0
        while (start < word.length) {
            var end = word.length
            var found: String? = null
            while (start < end) {
                val substr = if (start == 0) word.substring(start, end)
                             else "##${word.substring(start, end)}"
                if (vocab.containsKey(substr)) { found = substr; break }
                end--
            }
            if (found == null) return listOf(word) // fallback to [UNK]
            pieces.add(found)
            start = end
        }
        return pieces
    }

    private fun loadVocab(): Map<String, Int> {
        val vocabStream = try {
            context.assets.open("models/$VOCAB_FILENAME")
        } catch (e: Exception) {
            return emptyMap()
        }
        return vocabStream.bufferedReader().useLines { lines ->
            lines.mapIndexed { i, line -> line.trim() to i }.toMap()
        }
    }

    fun close() {
        session?.close()
        env?.close()
        session = null
        env = null
    }
}
