package dev.azrael.grocery

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Kitchen
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.azrael.grocery.barcode.BarcodeScreen
import dev.azrael.grocery.barcode.BarcodeViewModel
import dev.azrael.grocery.claude.AskClaudeScreen
import dev.azrael.grocery.claude.AskClaudeViewModel
import dev.azrael.grocery.claude.CabinetScan
import dev.azrael.grocery.claude.CabinetScanScreen
import dev.azrael.grocery.claude.CabinetScanViewModel
import dev.azrael.grocery.claude.ClaudeSettingsScreen
import dev.azrael.grocery.dash.DashScreen
import dev.azrael.grocery.dash.DashViewModel
import dev.azrael.grocery.expiry.ExpiryReminders
import dev.azrael.grocery.photo.RecipePhoto
import dev.azrael.grocery.photo.RecipePhotoScreen
import dev.azrael.grocery.photo.RecipePhotoViewModel
import dev.azrael.grocery.reel.ReelScreen
import dev.azrael.grocery.reel.ReelViewModel
import dev.azrael.grocery.reel.SharedReel
import dev.azrael.grocery.tracker.LogRecipeScreen
import dev.azrael.grocery.tracker.SodiumScreen
import dev.azrael.grocery.tracker.TrackerViewModel
import dev.azrael.grocery.ui.AddRecipeScreen
import dev.azrael.grocery.ui.CabinetScreen
import dev.azrael.grocery.ui.GroceryListScreen
import dev.azrael.grocery.ui.GroceryTheme
import dev.azrael.grocery.ui.GroceryViewModel
import dev.azrael.grocery.ui.MealPlanScreen
import dev.azrael.grocery.ui.RecipeBoxScreen
import dev.azrael.grocery.ui.StoreLayoutScreen
import dev.azrael.grocery.update.UpdateDialog
import dev.azrael.grocery.update.UpdateViewModel

class MainActivity : ComponentActivity() {
    /** Recipe text shared into the app from another app (browser, notes, etc.). */
    private var sharedText by mutableStateOf<String?>(null)
    /** An image shared into the app (a screenshot of a recipe), read on the recipe photo screen. */
    private var sharedImage by mutableStateOf<Uri?>(null)
    /** Set when the expiry reminder was tapped. */
    private var openCabinet by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) {
            sharedText = intent.sharedText()
            sharedImage = intent.sharedImage()
            openCabinet = intent.opensCabinet()
        }
        setContent {
            GroceryTheme {
                AppRoot(
                    sharedText = sharedText,
                    onSharedConsumed = { sharedText = null },
                    sharedImage = sharedImage,
                    onSharedImageConsumed = { sharedImage = null },
                    openCabinet = openCabinet,
                    onOpenCabinetConsumed = { openCabinet = false },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.sharedText()?.let { sharedText = it }
        intent.sharedImage()?.let { sharedImage = it }
        if (intent.opensCabinet()) openCabinet = true
    }

    private fun Intent?.opensCabinet(): Boolean =
        this?.getBooleanExtra(ExpiryReminders.EXTRA_OPEN_CABINET, false) == true

    private fun Intent?.sharedText(): String? =
        if (this?.action == Intent.ACTION_SEND && type?.startsWith("image/") != true) getStringExtra(Intent.EXTRA_TEXT) else null

    private fun Intent?.sharedImage(): Uri? {
        if (this?.action != Intent.ACTION_SEND || type?.startsWith("image/") != true) return null
        return if (Build.VERSION.SDK_INT >= 33) {
            getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        }
    }
}

private enum class Screen {
    LIST, ADD_RECIPE, CABINET, ASK_CLAUDE, CLAUDE_SETTINGS, CABINET_SCAN, RECIPE_BOX, SODIUM, LOG_RECIPE, BARCODE, MEAL_PLAN, STORE_LAYOUT, RECIPE_PHOTO, REEL, DASH,
}

/** The screens on the bottom bar. Everything else opens on top of one of these. */
private enum class Tab(val screen: Screen, val label: String, val icon: ImageVector) {
    LIST(Screen.LIST, "List", Icons.Default.ShoppingCart),
    RECIPES(Screen.RECIPE_BOX, "Recipes", Icons.AutoMirrored.Filled.MenuBook),
    PLAN(Screen.MEAL_PLAN, "Plan", Icons.Default.CalendarMonth),
    CABINET(Screen.CABINET, "Cabinet", Icons.Default.Kitchen),
    DASH(Screen.DASH, "DASH", Icons.Default.MonitorHeart),
}

@Composable
private fun AppRoot(
    sharedText: String?,
    onSharedConsumed: () -> Unit,
    sharedImage: Uri?,
    onSharedImageConsumed: () -> Unit,
    openCabinet: Boolean,
    onOpenCabinetConsumed: () -> Unit,
) {
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
    val cabinet by vm.cabinet.collectAsState()
    val cabinetKeys = remember(cabinet) { cabinet.orEmpty().map { it.key }.toSet() }
    val scan: CabinetScanViewModel = viewModel(factory = CabinetScanViewModel.Factory)
    // A Claude app reply listing Cabinet items, shared into the app; the scan screen reads it.
    var cabinetReply by rememberSaveable { mutableStateOf<String?>(null) }
    val tracker: TrackerViewModel = viewModel(factory = TrackerViewModel.Factory)
    // Recipe text and name handed to Log a recipe, and where it returns to.
    var logText by rememberSaveable { mutableStateOf("") }
    var logTitle by rememberSaveable { mutableStateOf("") }
    var logReturn by rememberSaveable { mutableStateOf(Screen.SODIUM) }
    val barcode: BarcodeViewModel = viewModel(factory = BarcodeViewModel.Factory)
    val sodiumLimit by tracker.settings.sodiumLimit.collectAsState()
    val recipePhoto: RecipePhotoViewModel = viewModel(factory = RecipePhotoViewModel.Factory)
    // A Claude app reply copying out a recipe photo, shared into the app; the photo screen reads it.
    var photoReply by rememberSaveable { mutableStateOf<String?>(null) }
    // A screenshot shared into the app; the photo screen reads it.
    var photoShared by remember { mutableStateOf<Uri?>(null) }
    val reel: ReelViewModel = viewModel(factory = ReelViewModel.Factory)
    val dash: DashViewModel = viewModel(factory = DashViewModel.Factory)
    // Where the sodium tracker returns to.
    var sodiumReturn by rememberSaveable { mutableStateOf(Screen.LIST) }

    LaunchedEffect(sharedText) {
        if (sharedText != null) {
            if (claudeConfig.enabled && CabinetScan.isCabinetReply(sharedText)) {
                cabinetReply = sharedText
                screen = Screen.CABINET_SCAN
            } else if (claudeConfig.enabled && RecipePhoto.isReply(sharedText)) {
                photoReply = sharedText
                screen = Screen.RECIPE_PHOTO
            } else if (SharedReel.isShare(sharedText)) {
                // A Facebook reel: get its caption, then let the AI find the recipe in it.
                reel.onShared(sharedText)
                screen = Screen.REEL
            } else {
                draft = sharedText
                screen = Screen.ADD_RECIPE
            }
            onSharedConsumed()
        }
    }

    LaunchedEffect(sharedImage) {
        if (sharedImage != null) {
            photoShared = sharedImage
            screen = Screen.RECIPE_PHOTO
            onSharedImageConsumed()
        }
    }

    LaunchedEffect(openCabinet) {
        if (openCabinet) {
            screen = Screen.CABINET
            onOpenCabinetConsumed()
        }
    }

    AppFrame(screen = screen, onTab = { screen = it }) {
        when (screen) {
            Screen.LIST -> GroceryListScreen(
                vm = vm,
                onAddRecipe = { screen = Screen.ADD_RECIPE },
                onOpenCabinet = { screen = Screen.CABINET },
                onOpenRecipeBox = { screen = Screen.RECIPE_BOX },
                onOpenMealPlan = { screen = Screen.MEAL_PLAN },
                onCheckForUpdates = { updates.check(manual = true) },
                onOpenStoreLayout = { screen = Screen.STORE_LAYOUT },
                claudeEnabled = claudeConfig.enabled,
                onAskClaude = { screen = Screen.ASK_CLAUDE },
                onOpenSodium = { sodiumReturn = Screen.LIST; screen = Screen.SODIUM },
                onClaudeSettings = { openClaudeSettings(Screen.LIST) },
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
                onSaveRecipe = { title, servings, text -> vm.saveRecipe(title, servings, text) },
                onLogSodium = { text, title ->
                    logText = text
                    logTitle = title
                    logReturn = Screen.ADD_RECIPE
                    screen = Screen.LOG_RECIPE
                },
                onScanPhoto = { screen = Screen.RECIPE_PHOTO },
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
                onSaveRecipe = { title, servings, text -> vm.saveRecipe(title, servings, text) },
            )
            Screen.CLAUDE_SETTINGS -> ClaudeSettingsScreen(
                vm = claude,
                // If Claude was just switched off, don't drop back into a Claude screen.
                onBack = { screen = if (claudeConfig.enabled) settingsReturn else Screen.LIST },
            )
            Screen.CABINET -> CabinetScreen(
                vm = vm,
                onBack = { screen = Screen.LIST },
                onScanBarcode = { screen = Screen.BARCODE },
                onScanWithClaude = if (claudeConfig.enabled) {
                    { screen = Screen.CABINET_SCAN }
                } else {
                    null
                },
            )
            Screen.RECIPE_BOX -> RecipeBoxScreen(
                vm = vm,
                cabinetKeys = cabinetKeys,
                onBack = { screen = Screen.LIST },
                onAddedToList = { screen = Screen.LIST },
            )
            Screen.MEAL_PLAN -> MealPlanScreen(
                vm = vm,
                cabinetKeys = cabinetKeys,
                onBack = { screen = Screen.LIST },
                onOpenRecipeBox = { screen = Screen.RECIPE_BOX },
                onAddedToList = { screen = Screen.LIST },
            )
            Screen.STORE_LAYOUT -> StoreLayoutScreen(layout = vm.layout, onBack = { screen = Screen.LIST })
            Screen.CABINET_SCAN -> CabinetScanScreen(
                vm = scan,
                cabinetKeys = cabinetKeys,
                incomingReply = cabinetReply,
                onReplyConsumed = { cabinetReply = null },
                onBack = { screen = Screen.CABINET },
                onOpenSettings = { openClaudeSettings(Screen.CABINET_SCAN) },
                onAdd = { names ->
                    names.forEach { vm.addToCabinet(it) }
                    screen = Screen.CABINET
                },
            )
            Screen.RECIPE_PHOTO -> RecipePhotoScreen(
                vm = recipePhoto,
                incomingReply = photoReply,
                onReplyConsumed = { photoReply = null },
                incomingPhoto = photoShared,
                onPhotoConsumed = { photoShared = null },
                onBack = { screen = Screen.ADD_RECIPE },
                onOpenSettings = { openClaudeSettings(Screen.RECIPE_PHOTO) },
                onUse = { text ->
                    draft = text
                    screen = Screen.ADD_RECIPE
                },
            )
            Screen.REEL -> ReelScreen(
                vm = reel,
                onBack = { screen = Screen.LIST },
                onOpenSettings = { openClaudeSettings(Screen.REEL) },
                onAskInApp = { request ->
                    claudeDraft = request
                    claude.ask(request)
                    screen = Screen.ASK_CLAUDE
                },
                onUseText = { text ->
                    draft = text
                    screen = Screen.ADD_RECIPE
                },
                onScreenshot = { screen = Screen.RECIPE_PHOTO },
            )
            Screen.BARCODE -> BarcodeScreen(
                vm = barcode,
                sodiumLimit = sodiumLimit,
                onBack = { screen = Screen.CABINET },
                onLogServing = { name, na, k, servings ->
                    tracker.goToToday()
                    tracker.log(name, na, k, servings)
                },
            )
            Screen.DASH -> DashScreen(
                vm = dash,
                onBack = { screen = Screen.LIST },
                onOpenSodium = { sodiumReturn = Screen.DASH; screen = Screen.SODIUM },
            )
            Screen.SODIUM -> SodiumScreen(
                vm = tracker,
                onBack = { screen = sodiumReturn },
                onLogRecipe = {
                    logText = ""
                    logTitle = ""
                    logReturn = Screen.SODIUM
                    screen = Screen.LOG_RECIPE
                },
            )
            Screen.LOG_RECIPE -> LogRecipeScreen(
                vm = tracker,
                initialText = logText,
                initialTitle = logTitle,
                onBack = { screen = logReturn },
                onLogged = {
                    tracker.goToToday()
                    screen = Screen.SODIUM
                },
            )
        }
    }

    UpdateDialog(state = updateState, currentBuild = updates.currentBuild, vm = updates)
}

/** Shows the bottom bar on the main screens and keeps the screen above it. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AppFrame(screen: Screen, onTab: (Screen) -> Unit, content: @Composable () -> Unit) {
    val current = Tab.entries.firstOrNull { it.screen == screen }
    Scaffold(
        bottomBar = {
            if (current != null) {
                NavigationBar {
                    Tab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = tab == current,
                            onClick = { if (tab != current) onTab(tab.screen) },
                            icon = { Icon(tab.icon, null) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
        contentWindowInsets = WindowInsets(0),
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) { content() }
    }
}
