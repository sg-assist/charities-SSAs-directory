package org.unfpa.otg.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

/**
 * ChatScreen — main conversation UI.
 *
 * Features:
 *   - Persistent mode bar (cannot be dismissed) with colour-coding + disclaimer
 *   - Streaming message bubbles
 *   - Status indicator during tool-use rounds
 *   - Tappable [SRC:...] citation tags opening CitationDrawer
 *   - DoseCard rendering when hasDoseCard = true
 *   - Sources panel below each assistant message
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel = viewModel(),
    onNavigateToSettings: () -> Unit = {},
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var inputText by remember { mutableStateOf("") }
    var selectedCitationChunkId by remember { mutableStateOf<String?>(null) }
    var selectedDoseCardDrug by remember { mutableStateOf<String?>(null) }

    // Scroll to bottom on new messages
    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            scope.launch { listState.animateScrollToItem(uiState.messages.size - 1) }
        }
    }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = { Text("UNFPA On-The-Ground") },
                    actions = {
                        TextButton(onClick = onNavigateToSettings) { Text("Settings") }
                    },
                )
                ModeBanner(mode = uiState.mode)
            }
        },
        bottomBar = {
            Column {
                if (uiState.isLoading && uiState.statusMessage.isNotBlank()) {
                    StatusIndicator(message = uiState.statusMessage)
                }
                MessageInput(
                    text = inputText,
                    enabled = !uiState.isLoading && !uiState.isInitialising,
                    onTextChange = { inputText = it },
                    onSend = {
                        viewModel.sendMessage(inputText.trim())
                        inputText = ""
                    },
                )
            }
        },
    ) { padding ->
        when {
            uiState.isInitialising -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            uiState.initialisationError == "model_not_downloaded" -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text("Gemma model not downloaded.\nPlease go to Settings → Download Model.",
                        style = MaterialTheme.typography.bodyLarge)
                }
            }
            uiState.initialisationError != null -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text("Error: ${uiState.initialisationError}",
                        color = MaterialTheme.colorScheme.error)
                }
            }
            else -> {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (uiState.messages.isEmpty()) {
                        item {
                            WelcomeHint(mode = uiState.mode)
                        }
                    }
                    items(uiState.messages, key = { it.id }) { message ->
                        MessageBubble(
                            message = message,
                            onCitationTap = { chunkId -> selectedCitationChunkId = chunkId },
                            onDoseCardTap = { drug -> selectedDoseCardDrug = drug },
                        )
                        if (message.role == "assistant" && message.hasDoseCard && message.doseCardDrug != null) {
                            Spacer(Modifier.height(4.dp))
                            DoseCardTrigger(
                                drug = message.doseCardDrug,
                                onClick = { selectedDoseCardDrug = message.doseCardDrug },
                            )
                        }
                        if (message.role == "assistant" && message.sources.isNotEmpty()) {
                            Spacer(Modifier.height(4.dp))
                            SourcesRow(sources = message.sources, onTap = { id -> selectedCitationChunkId = id })
                        }
                    }
                }
            }
        }
    }

    // Citation drawer
    selectedCitationChunkId?.let { chunkId ->
        CitationDrawer(
            chunkId = chunkId,
            citationRepository = viewModel.citationRepository,
            onDismiss = { selectedCitationChunkId = null },
        )
    }

    // Dose card sheet
    selectedDoseCardDrug?.let { drug ->
        DoseCard(
            drug = drug,
            viewModel = viewModel,
            onDismiss = { selectedDoseCardDrug = null },
            onCitationTap = { chunkId ->
                selectedDoseCardDrug = null
                selectedCitationChunkId = chunkId
            },
        )
    }
}

@Composable
private fun ModeBanner(mode: String) {
    val (color, label) = when (mode) {
        "clinical"   -> Color(0xFF1565C0) to "CLINICAL MODE — Reference only — not a substitute for clinical judgment"
        "community"  -> Color(0xFF2E7D32) to "COMMUNITY MODE — For CHW reference only"
        else         -> Color(0xFF6A1B9A) to "PARTNERSHIP MODE"
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(color)
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Text(
            text = label,
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun MessageBubble(
    message: ChatMessage,
    onCitationTap: (String) -> Unit,
    onDoseCardTap: (String) -> Unit,
) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            shape = RoundedCornerShape(
                topStart = if (isUser) 12.dp else 4.dp,
                topEnd = if (isUser) 4.dp else 12.dp,
                bottomStart = 12.dp,
                bottomEnd = 12.dp,
            ),
            color = if (isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.widthIn(max = 320.dp),
        ) {
            Column(Modifier.padding(12.dp)) {
                // Render content with [SRC:...] tags as tappable spans
                CitableText(
                    text = message.content,
                    color = if (isUser) MaterialTheme.colorScheme.onPrimary
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                    onCitationTap = onCitationTap,
                )
                if (message.isStreaming) {
                    Spacer(Modifier.height(4.dp))
                    LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp))
                }
            }
        }
    }
}

@Composable
private fun CitableText(
    text: String,
    color: Color,
    onCitationTap: (String) -> Unit,
) {
    // Simple rendering — split on [SRC:...] tags and render inline
    // A production-quality implementation would use AnnotatedString spans
    val citationRegex = Regex("""\[SRC:([^\]]+)]""")
    val parts = citationRegex.split(text)
    val matches = citationRegex.findAll(text).map { it.groupValues[1] }.toList()

    if (matches.isEmpty()) {
        Text(text = text, color = color, fontSize = 14.sp)
        return
    }

    Column {
        parts.forEachIndexed { i, part ->
            if (part.isNotBlank()) Text(text = part, color = color, fontSize = 14.sp)
            if (i < matches.size) {
                Text(
                    text = "[${matches[i].take(12)}…]",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 11.sp,
                    fontStyle = FontStyle.Italic,
                    modifier = Modifier.clickable { onCitationTap(matches[i]) },
                )
            }
        }
    }
}

@Composable
private fun DoseCardTrigger(drug: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
    ) {
        Text("View Dose Card: ${drug.replaceFirstChar { it.uppercase() }}", fontSize = 13.sp)
    }
}

@Composable
private fun SourcesRow(
    sources: List<org.unfpa.otg.ai.AgentOrchestrator.SourceRef>,
    onTap: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Sources:", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Medium)
        sources.forEach { src ->
            Text(
                text = "• ${src.title}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable { onTap(src.chunkId) },
            )
        }
    }
}

@Composable
private fun StatusIndicator(message: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
        Text(message, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MessageInput(
    text: String,
    enabled: Boolean,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Ask a question…") },
            enabled = enabled,
            maxLines = 4,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (text.isNotBlank()) onSend() }),
        )
        IconButton(
            onClick = { if (text.isNotBlank()) onSend() },
            enabled = enabled && text.isNotBlank(),
        ) {
            Icon(Icons.Default.Send, contentDescription = "Send")
        }
    }
}

@Composable
private fun WelcomeHint(mode: String) {
    val hint = when (mode) {
        "clinical"  -> "Ask about clinical protocols, medications, or emergency management.\nAll answers are cited to source documents."
        "community" -> "Ask about danger signs, referral criteria, or health education for the community."
        else        -> "Ask about UNFPA programmes, partnerships, or country office context."
    }
    Box(
        modifier = Modifier.fillMaxWidth().padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
