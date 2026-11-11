package dev.azrael.grocery.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Kitchen
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.barcode.SodiumLevel
import dev.azrael.grocery.data.CabinetItem
import dev.azrael.grocery.nutrition.Dash
import kotlinx.coroutines.launch

/** The Cabinet: what's already at home. Recipe lines that match start unticked on Add recipe. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun CabinetScreen(
    vm: GroceryViewModel,
    onBack: () -> Unit,
    /** Opens the Claude photo scan. Null hides the button (Claude turned off). */
    onScanWithClaude: (() -> Unit)? = null,
    /** Opens the barcode scanner. */
    onScanBarcode: () -> Unit = {},
) {
    val items by vm.cabinet.collectAsStateWithLifecycle()
    var newName by rememberSaveable { mutableStateOf("") }
    var menuOpen by remember { mutableStateOf(false) }
    var confirmClear by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    BackHandler(onBack = onBack)

    fun add() {
        val name = newName.trim()
        if (name.isEmpty()) return
        vm.addToCabinet(name)
        newName = ""
    }

    fun showUndo(message: String, undo: () -> Unit) {
        scope.launch {
            snackbar.currentSnackbarData?.dismiss()
            val result = snackbar.showSnackbar(message, actionLabel = "Undo", withDismissAction = true)
            if (result == SnackbarResult.ActionPerformed) undo()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Cabinet")
                        val list = items.orEmpty()
                        if (list.isNotEmpty()) {
                            val salty = list.count { it.sodiumLevel == SodiumLevel.HIGH }
                            Text(
                                "${list.size} on hand" + if (salty > 0) " · $salty high sodium" else "",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    IconButton(onClick = onScanBarcode) { Icon(Icons.Default.QrCodeScanner, "Scan a barcode") }
                    if (onScanWithClaude != null) {
                        IconButton(onClick = onScanWithClaude) { Icon(Icons.Default.PhotoCamera, "Scan a photo") }
                    }
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Empty the Cabinet") },
                                onClick = { menuOpen = false; confirmClear = true },
                                enabled = !items.isNullOrEmpty(),
                            )
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val list = items
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 24.dp,
            ),
        ) {
            item(key = "add") {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        label = { Text("Add something you have") },
                        placeholder = { Text("olive oil") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Sentences,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(onDone = { add() }),
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { add() }, enabled = newName.isNotBlank()) {
                        Icon(Icons.Default.Add, "Add to Cabinet")
                    }
                }
            }
            when {
                list == null -> Unit
                list.isEmpty() -> item(key = "empty") { CabinetEmptyState() }
                else -> {
                    list.groupBy { it.categoryEnum }.toSortedMap().forEach { (category, rows) ->
                        stickyHeader(key = "h_${category.name}") { CabinetHeader(category.label) }
                        items(rows, key = { it.id }) { item ->
                            CabinetRow(
                                item = item,
                                onRanOut = {
                                    vm.cabinetToList(item)
                                    scope.launch {
                                        snackbar.currentSnackbarData?.dismiss()
                                        snackbar.showSnackbar("${item.name} added to your grocery list")
                                    }
                                },
                                onDelete = {
                                    vm.removeFromCabinet(item)
                                    showUndo("Removed ${item.name}") { vm.restoreToCabinet(item) }
                                },
                                modifier = Modifier.animateItem(),
                            )
                        }
                    }
                }
            }
        }
    }

    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text("Empty the Cabinet?") },
            text = { Text("This removes everything you've marked as on hand. Your grocery list stays as it is.") },
            confirmButton = {
                TextButton(onClick = { confirmClear = false; vm.clearCabinet() }) { Text("Empty") }
            },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun CabinetHeader(label: String) {
    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 6.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CabinetRow(
    item: CabinetItem,
    onRanOut: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state = rememberSwipeToDismissBoxState()
    LaunchedEffect(state.currentValue) {
        if (state.currentValue == SwipeToDismissBoxValue.EndToStart) onDelete()
    }
    SwipeToDismissBox(
        state = state,
        modifier = modifier,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(Icons.Default.Delete, "Delete", tint = MaterialTheme.colorScheme.onErrorContainer)
            }
        },
    ) {
        Surface(color = MaterialTheme.colorScheme.surface) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f).padding(vertical = 14.dp)) {
                    Text(item.name, style = MaterialTheme.typography.bodyLarge)
                    item.sodiumLevel?.let { level ->
                        val amount = item.sodiumMgPerServing?.let { "${Dash.mg(it)} mg per serving" }
                            ?: item.sodiumMgPer100g?.let { "${Dash.mg(it)} mg per 100 g" }
                        Text(
                            listOfNotNull(level.label, amount).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = when (level) {
                                SodiumLevel.HIGH -> MaterialTheme.colorScheme.error
                                SodiumLevel.MODERATE -> MaterialTheme.colorScheme.onSurfaceVariant
                                SodiumLevel.LOW -> MaterialTheme.colorScheme.primary
                            },
                        )
                    }
                }
                IconButton(onClick = onRanOut) {
                    Icon(
                        Icons.Default.AddShoppingCart,
                        "Ran out of ${item.name}: add to grocery list",
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
    }
}

@Composable
private fun CabinetEmptyState() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Default.Kitchen,
            null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            "Your Cabinet is empty",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Add the staples you keep at home, or use \"Put checked items in Cabinet\" on the list " +
                "after shopping. When you add a recipe, anything in here starts unticked.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
