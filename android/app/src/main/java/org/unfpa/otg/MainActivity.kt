package org.unfpa.otg

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import org.unfpa.otg.sync.KnowledgeSyncWorker
import org.unfpa.otg.ui.chat.ChatScreen
import org.unfpa.otg.ui.chat.ChatViewModel
import org.unfpa.otg.ui.export.ExportScreen
import org.unfpa.otg.ui.knowledge.DocDetailScreen
import org.unfpa.otg.ui.knowledge.KBBrowserScreen
import org.unfpa.otg.ui.onboarding.*
import org.unfpa.otg.ui.settings.SettingsScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Schedule periodic OTA sync (Wi-Fi only)
        KnowledgeSyncWorker.schedule(this)

        setContent {
            OtgTheme {
                Surface(modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background) {
                    OtgApp()
                }
            }
        }
    }
}

@Composable
fun OtgApp() {
    val navController = rememberNavController()
    val chatViewModel: ChatViewModel = viewModel()

    // Determine start destination based on onboarding state
    // In production, use DataStore to persist onboarding completion
    val startDest = "welcome"

    NavHost(navController = navController, startDestination = startDest) {

        composable("welcome") {
            WelcomeScreen(onContinue = { navController.navigate("mode_select") })
        }

        composable("mode_select") {
            val uiState by chatViewModel.uiState.collectAsStateWithLifecycle()
            ModeSelectScreen(
                initialMode = uiState.mode,
                onModeSelected = { chatViewModel.setMode(it) },
                onContinue = { navController.navigate("country_select") },
            )
        }

        composable("country_select") {
            val uiState by chatViewModel.uiState.collectAsStateWithLifecycle()
            CountrySelectScreen(
                initialCountry = uiState.country,
                onCountrySelected = { chatViewModel.setCountry(it) },
                onContinue = { navController.navigate("chat") },
            )
        }

        composable("model_download") {
            // Placeholder — in production, wire up a DownloadViewModel
            ModelDownloadScreen(
                downloadProgress = 0f,
                isDownloading = false,
                downloadError = null,
                isWifi = true,
                onStartDownload = { variant ->
                    // TODO: start download via DownloadManager
                },
                onContinue = { navController.navigate("chat") {
                    popUpTo("welcome") { inclusive = true }
                }},
            )
        }

        composable("chat") {
            ChatScreen(
                viewModel = chatViewModel,
                onNavigateToSettings = { navController.navigate("settings") },
            )
        }

        composable("kb_browser") {
            // In production, load docs from KnowledgeRepository
            KBBrowserScreen(
                docs = emptyList(),
                onDocTap = { doc -> navController.navigate("doc_detail/${doc.slug}") },
                onBack = { navController.popBackStack() },
            )
        }

        composable("doc_detail/{slug}") { backStack ->
            val slug = backStack.arguments?.getString("slug") ?: ""
            // In production, load doc content from Room
            DocDetailScreen(
                doc = org.unfpa.otg.db.KnowledgeDoc(
                    slug = slug, title = slug, vertical = "", contentHash = "",
                    expiryDate = null, sourceUrl = null, language = "en",
                    ingestedAt = 0L,
                ),
                markdownContent = "Loading…",
                onBack = { navController.popBackStack() },
            )
        }

        composable("export") {
            ExportScreen(
                chatViewModel = chatViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable("settings") {
            val uiState by chatViewModel.uiState.collectAsStateWithLifecycle()
            SettingsScreen(
                chatViewModel = chatViewModel,
                onBack = { navController.popBackStack() },
                onNavigateToModelDownload = { navController.navigate("model_download") },
                onNavigateToModeSelect = { navController.navigate("mode_select") },
                onNavigateToCountrySelect = { navController.navigate("country_select") },
            )
        }
    }
}

@Composable
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectAsStateWithLifecycle(): State<T> =
    androidx.lifecycle.compose.collectAsStateWithLifecycle()
