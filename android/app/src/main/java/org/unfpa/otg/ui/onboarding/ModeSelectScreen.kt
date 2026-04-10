package org.unfpa.otg.ui.onboarding

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private data class ModeOption(
    val id: String,
    val title: String,
    val description: String,
    val audience: String,
    val color: Color,
)

private val MODES = listOf(
    ModeOption("clinical",    "Clinical Mode",    "Evidence-based clinical reference with full source citations.", "Midwives, nurses, skilled birth attendants", Color(0xFF1565C0)),
    ModeOption("community",   "Community Mode",   "Health education and danger-sign recognition for fieldwork.", "Community health workers (CHWs)", Color(0xFF2E7D32)),
    ModeOption("partnership", "Partnership Mode", "UNFPA programmes, partnerships, and field officer support.", "UNFPA field officers", Color(0xFF6A1B9A)),
)

@Composable
fun ModeSelectScreen(
    initialMode: String,
    onModeSelected: (String) -> Unit,
    onContinue: () -> Unit,
) {
    var selected by remember { mutableStateOf(initialMode) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Select Your Role", style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold)
        Text("Choose the mode that matches your role. You can change this later in Settings.",
            style = MaterialTheme.typography.bodyMedium)

        Spacer(Modifier.height(8.dp))

        MODES.forEach { mode ->
            val isSelected = selected == mode.id
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { selected = mode.id },
                colors = CardDefaults.cardColors(
                    containerColor = if (isSelected) mode.color.copy(alpha = 0.12f)
                                    else MaterialTheme.colorScheme.surfaceVariant,
                ),
                border = if (isSelected)
                    CardDefaults.outlinedCardBorder().copy(
                        width = 2.dp,
                    ) else null,
            ) {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(mode.title, fontWeight = FontWeight.Bold,
                            color = if (isSelected) mode.color else MaterialTheme.colorScheme.onSurface)
                        Text(mode.audience, style = MaterialTheme.typography.labelSmall,
                            color = mode.color.copy(alpha = 0.8f))
                        Text(mode.description, style = MaterialTheme.typography.bodySmall)
                    }
                    if (isSelected) {
                        RadioButton(selected = true, onClick = null,
                            colors = RadioButtonDefaults.colors(selectedColor = mode.color))
                    }
                }
            }
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = { onModeSelected(selected); onContinue() },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Continue")
        }
    }
}
