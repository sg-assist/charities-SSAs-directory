package org.unfpa.otg.ui.knowledge

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.unfpa.otg.db.KnowledgeDoc

/**
 * KBBrowserScreen — lists all knowledge base documents grouped by vertical.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KBBrowserScreen(
    docs: List<KnowledgeDoc>,
    onDocTap: (KnowledgeDoc) -> Unit,
    onBack: () -> Unit,
) {
    val grouped = docs.groupBy { it.vertical }.toSortedMap()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Knowledge Base") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Back") }
                },
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            grouped.forEach { (vertical, verticalDocs) ->
                item(key = "header_$vertical") {
                    Text(
                        text = vertical,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                    )
                }
                items(verticalDocs, key = { it.slug }) { doc ->
                    DocListItem(doc = doc, onTap = { onDocTap(doc) })
                }
            }
        }
    }
}

@Composable
private fun DocListItem(doc: KnowledgeDoc, onTap: () -> Unit) {
    ListItem(
        headlineContent = { Text(doc.title) },
        supportingContent = {
            val isExpired = doc.expiryDate?.let { expiry ->
                try {
                    expiry < java.time.LocalDate.now().toString()
                } catch (e: Exception) { false }
            } ?: false
            if (isExpired) Text("⚠️ May be outdated", color = MaterialTheme.colorScheme.error)
        },
        modifier = Modifier.clickable(onClick = onTap),
    )
}
