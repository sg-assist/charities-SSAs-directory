package org.unfpa.otg.ui.chat

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.unfpa.otg.ai.AgentOrchestrator
import org.unfpa.otg.ai.CitationValidator
import org.unfpa.otg.ai.GemmaEngine
import org.unfpa.otg.ai.SystemPromptBuilder
import org.unfpa.otg.ai.ToolExecutor
import org.unfpa.otg.db.AuditLogEntry
import org.unfpa.otg.db.AppDatabase
import org.unfpa.otg.knowledge.CitationRepository
import org.unfpa.otg.knowledge.EmbeddingEngine
import org.unfpa.otg.knowledge.FormularyRepository
import org.unfpa.otg.knowledge.KnowledgeRepository
import org.unfpa.otg.knowledge.VectorSearch
import java.util.UUID

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String,   // "user" | "assistant"
    val content: String,
    val isStreaming: Boolean = false,
    val sources: List<AgentOrchestrator.SourceRef> = emptyList(),
    val citationChunkIds: List<String> = emptyList(),
    val hasDoseCard: Boolean = false,
    val doseCardDrug: String? = null,
)

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val statusMessage: String = "",
    val mode: String = "partnership",
    val country: String = "",
    val language: String = "en",
    val isInitialising: Boolean = true,
    val initialisationError: String? = null,
    val sessionId: String = UUID.randomUUID().toString(),
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private val gemmaEngine = GemmaEngine(application)
    private val embeddingEngine = EmbeddingEngine(application)
    private val vectorSearch = VectorSearch()
    private val knowledgeRepo = KnowledgeRepository(application, embeddingEngine, vectorSearch)
    private val promptBuilder = SystemPromptBuilder()
    private val citationValidator = CitationValidator(knowledgeRepo)
    private val toolExecutor = ToolExecutor(knowledgeRepo)
    private val orchestrator = AgentOrchestrator(
        gemma = gemmaEngine,
        knowledgeRepo = knowledgeRepo,
        toolExecutor = toolExecutor,
        citationValidator = citationValidator,
        promptBuilder = promptBuilder,
    )
    private val formularyRepo = FormularyRepository(application)
    val citationRepository = CitationRepository(application)
    private val db = AppDatabase.getInstance(application)

    init {
        viewModelScope.launch {
            initialise()
        }
    }

    private suspend fun initialise() {
        _uiState.update { it.copy(isInitialising = true, initialisationError = null) }
        try {
            if (!GemmaEngine.isModelDownloaded(getApplication())) {
                _uiState.update { it.copy(
                    isInitialising = false,
                    initialisationError = "model_not_downloaded"
                )}
                return
            }
            gemmaEngine.initialise()
            if (EmbeddingEngine.isModelAvailable(getApplication())) {
                embeddingEngine.initialise()
            }
            knowledgeRepo.initialise()
            formularyRepo.initialise()
            _uiState.update { it.copy(isInitialising = false) }
        } catch (e: Exception) {
            _uiState.update { it.copy(
                isInitialising = false,
                initialisationError = e.message ?: "Initialisation failed"
            )}
        }
    }

    fun setMode(mode: String) = _uiState.update { it.copy(mode = mode) }
    fun setCountry(country: String) = _uiState.update { it.copy(country = country) }
    fun setLanguage(language: String) = _uiState.update { it.copy(language = language) }

    fun sendMessage(userText: String) {
        if (userText.isBlank() || _uiState.value.isLoading) return

        val state = _uiState.value
        val userMessage = ChatMessage(role = "user", content = userText)
        _uiState.update { it.copy(
            messages = it.messages + userMessage,
            isLoading = true,
            statusMessage = "Thinking…",
        )}

        viewModelScope.launch {
            val history = state.messages.takeLast(20).map { it.role to it.content }
            val assistantId = UUID.randomUUID().toString()

            // Add a placeholder streaming message
            _uiState.update { it.copy(
                messages = it.messages + ChatMessage(
                    id = assistantId,
                    role = "assistant",
                    content = "",
                    isStreaming = true,
                )
            )}

            var streamedText = ""
            orchestrator.run(
                userMessage = userText,
                conversationHistory = history,
                mode = state.mode,
                country = state.country,
                language = state.language,
            ).collect { event ->
                when (event) {
                    is AgentOrchestrator.AgentEvent.Status -> {
                        _uiState.update { it.copy(statusMessage = event.message) }
                    }
                    is AgentOrchestrator.AgentEvent.TextDelta -> {
                        streamedText += event.text
                        _uiState.update { s ->
                            s.copy(messages = s.messages.map { m ->
                                if (m.id == assistantId) m.copy(content = streamedText) else m
                            })
                        }
                    }
                    is AgentOrchestrator.AgentEvent.Done -> {
                        _uiState.update { s ->
                            s.copy(
                                isLoading = false,
                                statusMessage = "",
                                messages = s.messages.map { m ->
                                    if (m.id == assistantId) m.copy(
                                        content = event.fullText,
                                        isStreaming = false,
                                        sources = event.sources,
                                        citationChunkIds = event.citationChunkIds,
                                        hasDoseCard = event.hasDoseCard,
                                        doseCardDrug = event.doseCardDrug,
                                    ) else m
                                },
                            )
                        }
                        // Write to audit log for clinical mode
                        if (state.mode == "clinical") {
                            db.auditLogDao().insert(AuditLogEntry(
                                sessionId = state.sessionId,
                                mode = state.mode,
                                country = state.country,
                                language = state.language,
                                question = userText,
                                answer = event.fullText,
                                citationChunkIdsJson = "[${event.citationChunkIds.joinToString(",") { "\"$it\"" }}]",
                                kbVersion = "bundled",
                                modelVersion = GemmaEngine.MODEL_FILENAME,
                                hasDoseCard = event.hasDoseCard,
                                doseCardDrug = event.doseCardDrug,
                                validatorPassed = true,
                                validatorWarningsJson = "[]",
                                answeredAt = System.currentTimeMillis(),
                            ))
                        }
                    }
                    is AgentOrchestrator.AgentEvent.Error -> {
                        _uiState.update { s ->
                            s.copy(
                                isLoading = false,
                                statusMessage = "",
                                messages = s.messages.map { m ->
                                    if (m.id == assistantId) m.copy(
                                        content = event.message,
                                        isStreaming = false,
                                    ) else m
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    fun clearConversation() {
        _uiState.update { it.copy(
            messages = emptyList(),
            sessionId = UUID.randomUUID().toString(),
        )}
    }

    suspend fun getDrugCard(drug: String) =
        formularyRepo.getDrugCard(drug, _uiState.value.language)

    override fun onCleared() {
        super.onCleared()
        gemmaEngine.close()
        embeddingEngine.close()
    }
}
