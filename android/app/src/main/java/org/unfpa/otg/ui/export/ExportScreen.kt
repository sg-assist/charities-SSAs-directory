package org.unfpa.otg.ui.export

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import org.unfpa.otg.export.ExportService
import org.unfpa.otg.ui.chat.ChatMessage
import org.unfpa.otg.ui.chat.ChatViewModel

@Composable
fun ExportScreen(
    chatViewModel: ChatViewModel = viewModel(),
    onBack: () -> Unit,
) {
    val uiState by chatViewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val exportService = remember { ExportService(context) }
    var isExporting by remember { mutableStateOf(false) }
    var exportError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Export Conversation") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } },
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Export this conversation including citations and sources.",
                style = MaterialTheme.typography.bodyMedium)

            Text("${uiState.messages.size} messages",
                style = MaterialTheme.typography.labelMedium)

            exportError?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
            }

            val exportMessages = uiState.messages.map { msg ->
                ExportService.ExportMessage(
                    role = msg.role,
                    content = msg.content,
                    sources = msg.sources.map { it.title },
                )
            }

            if (isExporting) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                Button(
                    onClick = {
                        scope.launch {
                            isExporting = true
                            exportError = null
                            try {
                                val result = exportService.exportDocx(
                                    exportMessages, uiState.mode, uiState.country)
                                exportService.shareExport(result)
                            } catch (e: Exception) {
                                exportError = "DOCX export failed: ${e.message}"
                            } finally {
                                isExporting = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Export as DOCX")
                }

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            isExporting = true
                            exportError = null
                            try {
                                val result = exportService.exportPdf(
                                    exportMessages, uiState.mode, uiState.country)
                                exportService.shareExport(result)
                            } catch (e: Exception) {
                                exportError = "PDF export failed: ${e.message}"
                            } finally {
                                isExporting = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Export as PDF")
                }
            }

            Spacer(Modifier.weight(1f))

            Text(
                "Exports include the conversation text and source citations. " +
                "They do not include audio, images, or personal data.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// Need this for collectAsStateWithLifecycle in this file
@Composable
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectAsStateWithLifecycle(): State<T> =
    androidx.lifecycle.compose.collectAsStateWithLifecycle()
