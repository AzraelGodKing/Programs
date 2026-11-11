package dev.azrael.grocery

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.azrael.grocery.claude.AskClaudeScreen
import dev.azrael.grocery.claude.AskClaudeViewModel
import dev.azrael.grocery.claude.ClaudeSettingsScreen
import dev.azrael.grocery.ui.AddRecipeScreen
import dev.azrael.grocery.ui.GroceryListScreen
import dev.azrael.grocery.ui.GroceryTheme
import dev.azrael.grocery.ui.GroceryViewModel
import dev.azrael.grocery.update.UpdateDialog
import dev.azrael.grocery.update.UpdateViewModel

class MainActivity : ComponentActivity() {
    /** Recipe text shared into the app from another app (browser, notes, etc.). */
    private var sharedText by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) sharedText = intent.sharedText()
        setContent {
            GroceryTheme {
                AppRoot(sharedText = sharedText, onSharedConsumed = { sharedText = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.sharedText()?.let { sharedText = it }
    }

    private fun Intent?.sharedText(): String? =
        if (this?.action == Intent.ACTION_SEND) getStringExtra(Intent.EXTRA_TEXT) else null
}

private enum class Screen { LIST, ADD_RECIPE, ASK_CLAUDE, CLAUDE_SETTINGS }

@Composable
private fun AppRoot(sharedText: String?, onSharedConsumed: () -> Unit) {
    val vm: GroceryViewModel = viewModel(factory = GroceryViewModel.Factory)
    val updates: UpdateViewModel = viewModel(factory = UpdateViewModel.Factory)
    val updateState by updates.state.collectAsState()
    val claude: AskClaudeViewModel = viewModel(factory = AskClaudeViewModel.Factory)
    val claudeConfig by claude.settings.config.collectAsState()
    var screen by rememberSaveable { mutableStateOf(Screen.LIST) }
    var draft by rememberSaveable { mutableStateOf("") }
    var claudeDraft by rememberSaveable { mutableStateOf("") }
    // Where Claude settings returns to.
    var settingsReturn by rememberSaveable { mutableStateOf(Screen.LIST) }
    val openClaudeSettings = { from: Screen -> settingsReturn = from; screen = Screen.CLAUDE_SETTINGS }

    LaunchedEffect(sharedText) {
        if (sharedText != null) {
            draft = sharedText
            screen = Screen.ADD_RECIPE
            onSharedConsumed()
        }
    }

    when (screen) {
        Screen.LIST -> GroceryListScreen(
            vm = vm,
            onAddRecipe = { screen = Screen.ADD_RECIPE },
            onCheckForUpdates = { updates.check(manual = true) },
            claudeEnabled = claudeConfig.enabled,
            onAskClaude = { screen = Screen.ASK_CLAUDE },
            onClaudeSettings = { openClaudeSettings(Screen.LIST) },
            versionLabel = "Version ${updates.versionName} (build ${updates.currentBuild})",
        )
        Screen.ADD_RECIPE -> AddRecipeScreen(
            text = draft,
            onTextChange = { draft = it },
            onBack = { screen = Screen.LIST },
            onAdd = { ingredients, source ->
                vm.addIngredients(ingredients, source)
                draft = ""
                screen = Screen.LIST
            },
            onReadWithClaude = if (claudeConfig.enabled) {
                { text: String ->
                    claudeDraft = text
                    claude.reset()
                    screen = Screen.ASK_CLAUDE
                }
            } else {
                null
            },
        )
        Screen.ASK_CLAUDE -> AskClaudeScreen(
            vm = claude,
            input = claudeDraft,
            onInputChange = { claudeDraft = it },
            onBack = { screen = Screen.LIST },
            onOpenSettings = { openClaudeSettings(Screen.ASK_CLAUDE) },
            onAdd = { ingredients, source ->
                vm.addIngredients(ingredients, source)
                claudeDraft = ""
                screen = Screen.LIST
            },
        )
        Screen.CLAUDE_SETTINGS -> ClaudeSettingsScreen(
            vm = claude,
            // If Claude was just switched off, don't drop back into a Claude screen.
            onBack = { screen = if (claudeConfig.enabled) settingsReturn else Screen.LIST },
        )
    }

    UpdateDialog(state = updateState, currentBuild = updates.currentBuild, vm = updates)
}
