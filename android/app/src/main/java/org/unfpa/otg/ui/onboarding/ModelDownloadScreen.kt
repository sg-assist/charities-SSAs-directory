package org.unfpa.otg.ui.onboarding

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.unfpa.otg.ai.GemmaEngine

/**
 * ModelDownloadScreen — blocks first use until the Gemma 4 model is downloaded.
 *
 * Shows:
 *   - Model size (~1.3 GB E2B or ~2.5 GB E4B)
 *   - Wi-Fi warning
 *   - Download progress bar
 *   - ETA
 *   - Model variant selector (E2B default for mid-range, E4B for flagship)
 */
@Composable
fun ModelDownloadScreen(
    downloadProgress: Float,        // 0.0 to 1.0
    isDownloading: Boolean,
    downloadError: String?,
    isWifi: Boolean,
    onStartDownload: (variant: String) -> Unit,
    onContinue: () -> Unit,         // enabled only when model is available
) {
    var selectedVariant by remember { mutableStateOf("E2B") }
    val isDownloaded = downloadProgress >= 1f

    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
    ) {
        Text("Download AI Model", style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)

        Text(
            "The on-device AI model must be downloaded once. " +
            "After that, the app works fully offline with no internet connection needed.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )

        // Wi-Fi warning
        if (!isWifi) {
            Card(colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Text(
                    "⚠️ You are not on Wi-Fi. Downloading on mobile data will use 1.3–2.5 GB. " +
                    "We recommend connecting to Wi-Fi first.",
                    modifier = Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    fontSize = 13.sp,
                )
            }
        }

        // Variant selector
        if (!isDownloading && !isDownloaded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Choose model variant:", style = MaterialTheme.typography.labelMedium)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ModelVariantCard(
                        name = "Gemma 4 E2B",
                        size = "~1.3 GB",
                        requirement = "6 GB RAM",
                        recommended = "Mid-range devices",
                        selected = selectedVariant == "E2B",
                        onClick = { selectedVariant = "E2B" },
                        modifier = Modifier.weight(1f),
                    )
                    ModelVariantCard(
                        name = "Gemma 4 E4B",
                        size = "~2.5 GB",
                        requirement = "8 GB RAM",
                        recommended = "Flagship devices",
                        selected = selectedVariant == "E4B",
                        onClick = { selectedVariant = "E4B" },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        // Progress
        if (isDownloading || isDownloaded) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (isDownloaded) {
                    Text("✓ Model downloaded successfully", color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium)
                } else {
                    Text("Downloading Gemma 4 ${selectedVariant}…",
                        style = MaterialTheme.typography.bodyMedium)
                    LinearProgressIndicator(
                        progress = { downloadProgress },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("${(downloadProgress * 100).toInt()}% — do not close the app",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // Error
        downloadError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        // Action button
        when {
            isDownloaded -> Button(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
                Text("Continue")
            }
            isDownloading -> OutlinedButton(onClick = {}, enabled = false,
                modifier = Modifier.fillMaxWidth()) {
                Text("Downloading…")
            }
            else -> Button(onClick = { onStartDownload(selectedVariant) },
                modifier = Modifier.fillMaxWidth()) {
                Text("Download Gemma 4 $selectedVariant")
            }
        }
    }
}

@Composable
private fun ModelVariantCard(
    name: String,
    size: String,
    requirement: String,
    recommended: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(name, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(size, style = MaterialTheme.typography.labelLarge)
            Text(requirement, fontSize = 11.sp)
            Text(recommended, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
