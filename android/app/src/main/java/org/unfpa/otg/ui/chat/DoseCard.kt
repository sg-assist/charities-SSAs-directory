package org.unfpa.otg.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.unfpa.otg.knowledge.FormularyRepository

/**
 * DoseCard — native dose card rendered from formulary.json.
 *
 * Doses are NEVER LLM-generated. This component reads exclusively from
 * FormularyRepository, which is sourced from the human-verified formulary.json.
 *
 * Shows:
 *   - Drug name (localised)
 *   - Indication, dose, route, timing
 *   - Contraindications
 *   - Warnings
 *   - Source attribution with "View source" tap
 *   - Amber warning if formulary entry is unverified or expired
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoseCard(
    drug: String,
    viewModel: ChatViewModel,
    onDismiss: () -> Unit,
    onCitationTap: (String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var card by remember { mutableStateOf<FormularyRepository.DrugCard?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var notFound by remember { mutableStateOf(false) }

    LaunchedEffect(drug) {
        card = viewModel.getDrugCard(drug)
        notFound = card == null
        isLoading = false
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Dose Card", style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold)
                IconButton(onClick = {
                    scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() }
                }) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            if (isLoading) {
                Box(Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                return@Column
            }

            if (notFound) {
                Text("Drug \"$drug\" not found in formulary.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Consult your facility reference materials or a qualified supervisor.",
                    fontSize = 13.sp)
                return@Column
            }

            val c = card!!

            // Unverified / expired warnings
            if (c.clinicalStatus != "VERIFIED") {
                UnverifiedBanner("This dose card has not yet been clinically verified. " +
                        "Do not use for clinical decisions until verified.")
            }
            if (c.isExpired) {
                UnverifiedBanner("This formulary entry may be outdated. Verify with current guidelines.")
            }

            // Drug name
            Text(c.displayName, style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold)
            if (c.drug != c.displayName.lowercase()) {
                Text(c.drug, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Divider()

            // Indication
            DoseField("Indication", c.indication)

            // Dose / Route / Timing
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                DoseField("Dose", c.dose, Modifier.weight(1f))
                DoseField("Route", c.route, Modifier.weight(1f))
            }
            DoseField("Timing", c.timing)
            c.alternativeDose?.let { DoseField("Alternative", it) }

            // Contraindications
            if (c.contraindications.isNotEmpty()) {
                Divider()
                Text("Contraindications", style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                c.contraindications.forEach { ci ->
                    Text("• $ci", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                }
            }

            // Warnings
            if (c.warnings.isNotEmpty()) {
                Divider()
                Text("Warnings", style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold, color = Color(0xFFE65100))
                c.warnings.forEach { w ->
                    Text("• $w", fontSize = 13.sp)
                }
            }

            Divider()

            // Source attribution
            Text("Source", style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(c.source, fontSize = 12.sp)
            if (c.whoEmlListed) {
                Text("✓ WHO Essential Medicines List", fontSize = 11.sp,
                    color = Color(0xFF1565C0))
            }

            OutlinedButton(
                onClick = { onCitationTap(c.sourceChunkId) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("View Original Guideline Section")
            }

            Text("All doses sourced from formulary.json — never LLM-generated.",
                fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DoseField(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun UnverifiedBanner(message: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Warning, contentDescription = null,
            tint = Color(0xFFE65100), modifier = Modifier.size(18.dp))
        Text(message, fontSize = 12.sp, color = Color(0xFFE65100))
    }
}
