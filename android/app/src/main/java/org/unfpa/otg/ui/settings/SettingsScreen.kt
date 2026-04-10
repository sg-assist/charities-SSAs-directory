package org.unfpa.otg.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.unfpa.otg.ai.GemmaEngine
import org.unfpa.otg.sync.KnowledgeSyncWorker
import org.unfpa.otg.ui.chat.ChatViewModel
import androidx.compose.ui.platform.LocalContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    chatViewModel: ChatViewModel = viewModel(),
    onBack: () -> Unit,
    onNavigateToModelDownload: () -> Unit,
    onNavigateToModeSelect: () -> Unit,
    onNavigateToCountrySelect: () -> Unit,
) {
    val uiState by chatViewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } },
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Spacer(Modifier.height(8.dp))

            // Mode
            SettingsSection("Mode") {
                SettingsRow(
                    label = "Current Mode",
                    value = uiState.mode.replaceFirstChar { it.uppercase() },
                    onClick = onNavigateToModeSelect,
                )
            }

            // Country
            SettingsSection("Country") {
                SettingsRow(
                    label = "Country",
                    value = uiState.country.ifBlank { "None selected" },
                    onClick = onNavigateToCountrySelect,
                )
            }

            // Language
            SettingsSection("Language") {
                SettingsRow(
                    label = "Response Language",
                    value = uiState.language,
                    onClick = { /* TODO: language picker */ },
                )
            }

            // Model
            SettingsSection("AI Model") {
                val isDownloaded = GemmaEngine.isModelDownloaded(context)
                SettingsRow(
                    label = "Gemma 4 E2B",
                    value = if (isDownloaded) "Downloaded" else "Not downloaded",
                    onClick = if (!isDownloaded) onNavigateToModelDownload else null,
                )
                SettingsRow(
                    label = "Model File",
                    value = GemmaEngine.MODEL_FILENAME,
                    onClick = null,
                )
            }

            // Knowledge Base
            SettingsSection("Knowledge Base") {
                SettingsRow(
                    label = "KB Version",
                    value = "bundled",
                    onClick = null,
                )
                SettingsButton(label = "Sync Now (requires internet)") {
                    KnowledgeSyncWorker.runOnce(context)
                }
            }

            // About
            SettingsSection("About") {
                SettingsRow(label = "Version", value = "1.0.0", onClick = null)
                SettingsRow(label = "License", value = "Apache 2.0", onClick = null)
                SettingsRow(
                    label = "Clinical Disclaimer",
                    value = "Reference only — not a substitute for clinical judgment",
                    onClick = null,
                )
            }
        }
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Text(title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
        content()
        HorizontalDivider(modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun SettingsRow(label: String, value: String, onClick: (() -> Unit)?) {
    ListItem(
        headlineContent = { Text(label) },
        trailingContent = { Text(value, style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant) },
        modifier = if (onClick != null) Modifier.let { mod ->
            mod // clickable applied below via ListItem modifier
        } else Modifier,
    )
}

@Composable
private fun SettingsButton(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(label)
    }
}

@Composable
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectAsStateWithLifecycle(): State<T> =
    androidx.lifecycle.compose.collectAsStateWithLifecycle()
