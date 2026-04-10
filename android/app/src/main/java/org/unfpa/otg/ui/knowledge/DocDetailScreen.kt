package org.unfpa.otg.ui.knowledge

import android.widget.TextView
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import io.noties.markwon.Markwon
import io.noties.markwon.ext.tables.TablePlugin
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin
import org.unfpa.otg.db.KnowledgeDoc

/**
 * DocDetailScreen — renders a knowledge base document in Markdown via Markwon.
 *
 * Uses AndroidView to embed a TextView with Markwon rendering, which supports
 * tables, strikethrough, and RTL text via Android's BiDi engine.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocDetailScreen(
    doc: KnowledgeDoc,
    markdownContent: String,
    onBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(doc.title, maxLines = 1) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Back") }
                },
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            // Expiry warning banner
            doc.expiryDate?.let { expiry ->
                val isExpired = try { expiry < java.time.LocalDate.now().toString() }
                                catch (e: Exception) { false }
                if (isExpired) {
                    Surface(color = MaterialTheme.colorScheme.errorContainer) {
                        Text(
                            "⚠️ This document may be outdated (expired: $expiry). " +
                                    "Verify with current guidelines before clinical use.",
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                }
            }

            // Markwon rendering
            AndroidView(
                factory = { ctx ->
                    val markwon = Markwon.builder(ctx)
                        .usePlugin(TablePlugin.create(ctx))
                        .usePlugin(StrikethroughPlugin.create())
                        .build()
                    TextView(ctx).also { tv ->
                        tv.setPadding(48, 32, 48, 32)
                        markwon.setMarkdown(tv, markdownContent)
                    }
                },
                update = { tv ->
                    val ctx = tv.context
                    val markwon = Markwon.builder(ctx)
                        .usePlugin(TablePlugin.create(ctx))
                        .usePlugin(StrikethroughPlugin.create())
                        .build()
                    markwon.setMarkdown(tv, markdownContent)
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
