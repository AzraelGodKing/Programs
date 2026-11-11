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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.azrael.grocery.ui.AddRecipeScreen
import dev.azrael.grocery.ui.CabinetScreen
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

private enum class Screen { LIST, ADD_RECIPE, CABINET }

@Composable
private fun AppRoot(sharedText: String?, onSharedConsumed: () -> Unit) {
    val vm: GroceryViewModel = viewModel(factory = GroceryViewModel.Factory)
    val updates: UpdateViewModel = viewModel(factory = UpdateViewModel.Factory)
    val updateState by updates.state.collectAsState()
    var screen by rememberSaveable { mutableStateOf(Screen.LIST) }
    var draft by rememberSaveable { mutableStateOf("") }
    val cabinet by vm.cabinet.collectAsState()
    val cabinetKeys = remember(cabinet) { cabinet.orEmpty().map { it.key }.toSet() }

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
            onOpenCabinet = { screen = Screen.CABINET },
            onCheckForUpdates = { updates.check(manual = true) },
            versionLabel = "Version ${updates.versionName} (build ${updates.currentBuild})",
        )
        Screen.ADD_RECIPE -> AddRecipeScreen(
            text = draft,
            cabinetKeys = cabinetKeys,
            onTextChange = { draft = it },
            onBack = { screen = Screen.LIST },
            onAdd = { ingredients, source ->
                vm.addIngredients(ingredients, source)
                draft = ""
                screen = Screen.LIST
            },
        )
        Screen.CABINET -> CabinetScreen(vm = vm, onBack = { screen = Screen.LIST })
    }

    UpdateDialog(state = updateState, currentBuild = updates.currentBuild, vm = updates)
}
