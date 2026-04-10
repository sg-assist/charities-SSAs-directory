package org.unfpa.otg.ui.chat

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.unfpa.otg.knowledge.CitationRepository

/**
 * CitationDrawer — bottom sheet showing full citation detail for a [SRC:chunk_id] tag.
 *
 * Displays:
 *   - Source document, edition, section, page
 *   - Verbatim excerpt (exact text from source)
 *   - SHA-256 hash (user can verify tamper-proofing)
 *   - "Verify online" button → opens sourceUrl
 *   - Amber warning if content is expired
 *   - Red warning if SHA-256 integrity check fails
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CitationDrawer(
    chunkId: String,
    citationRepository: CitationRepository,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var citation by remember { mutableStateOf<CitationRepository.CitationDetail?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(chunkId) {
        citation = citationRepository.getCitation(chunkId)
        isLoading = false
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Source Citation", style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold)
                IconButton(onClick = { scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() } }) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            if (isLoading) {
                Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                return@Column
            }

            val c = citation
            if (c == null) {
                Text("Citation not found in knowledge base.", color = MaterialTheme.colorScheme.error)
                return@Column
            }

            // Expiry warning
            if (c.isExpired) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null,
                        tint = Color(0xFFE65100), modifier = Modifier.size(18.dp))
                    Text("This content may be outdated (expired: ${c.expiryDate}). " +
                            "Verify with current guidelines.",
                        fontSize = 12.sp, color = Color(0xFFE65100))
                }
            }

            // Integrity warning
            if (!c.integrityOk) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null,
                        tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                    Text("Integrity check failed — content hash mismatch. Do not rely on this citation.",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                }
            }

            // Source info
            LabeledField("Source", c.sourceDocument)
            if (c.sourceEdition.isNotBlank()) LabeledField("Edition", c.sourceEdition)
            if (c.sourceSection.isNotBlank()) LabeledField("Section", c.sourceSection)
            if (c.sourcePage > 0) LabeledField("Page", c.sourcePage.toString())

            Divider()

            // Verbatim excerpt
            Text("Verbatim Excerpt", style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = MaterialTheme.shapes.small,
            ) {
                Text(
                    text = "\"${c.verbatimExcerpt}\"",
                    modifier = Modifier.padding(12.dp),
                    fontStyle = FontStyle.Italic,
                    fontSize = 13.sp,
                    lineHeight = 20.sp,
                )
            }

            Divider()

            // SHA-256
            Text("Content Hash (SHA-256)", style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                text = c.contentHash,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            // Verify online button
            if (c.sourceUrl.isNotBlank()) {
                OutlinedButton(
                    onClick = {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(c.sourceUrl))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Verify Online (requires internet)")
                }
            }

            Text(
                text = "Chunk ID: ${c.chunkId}",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun LabeledField(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}
