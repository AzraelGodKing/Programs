package dev.azrael.grocery.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.data.GroceryItem
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun GroceryListScreen(
    vm: GroceryViewModel,
    onAddRecipe: () -> Unit,
    onCheckForUpdates: () -> Unit,
    versionLabel: String,
) {
    val items by vm.items.collectAsStateWithLifecycle()
    var editing by remember { mutableStateOf<GroceryItem?>(null) }
    var adding by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var confirmClearAll by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    fun deleteWithUndo(item: GroceryItem) {
        vm.delete(item)
        scope.launch {
            snackbar.currentSnackbarData?.dismiss()
            val result = snackbar.showSnackbar("Removed ${item.name}", actionLabel = "Undo", withDismissAction = true)
            if (result == SnackbarResult.ActionPerformed) vm.restore(item)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Grocery List")
                        val list = items.orEmpty()
                        if (list.isNotEmpty()) {
                            Text(
                                "${list.count { !it.checked }} left of ${list.size}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { adding = true }) { Icon(Icons.Default.Add, "Add item") }
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Remove checked items") },
                                onClick = { menuOpen = false; vm.clearChecked() },
                            )
                            DropdownMenuItem(
                                text = { Text("Uncheck everything") },
                                onClick = { menuOpen = false; vm.uncheckAll() },
                            )
                            DropdownMenuItem(
                                text = { Text("Clear whole list") },
                                onClick = { menuOpen = false; confirmClearAll = true },
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("Check for updates") },
                                onClick = { menuOpen = false; onCheckForUpdates() },
                            )
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        versionLabel,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                },
                                onClick = { menuOpen = false },
                                enabled = false,
                            )
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAddRecipe,
                icon = { Icon(Icons.Default.Restaurant, null) },
                text = { Text("Add recipe") },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val list = items
        when {
            list == null -> Box(Modifier.fillMaxSize())
            list.isEmpty() -> EmptyState(Modifier.padding(padding))
            else -> {
                val open = list.filter { !it.checked }
                    .groupBy { it.categoryEnum }
                    .toSortedMap()
                val done = list.filter { it.checked }
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        top = padding.calculateTopPadding(),
                        bottom = padding.calculateBottomPadding() + 96.dp,
                    ),
                ) {
                    open.forEach { (category, rows) ->
                        stickyHeader(key = "h_${category.name}") { SectionHeader(category.label) }
                        items(rows, key = { it.id }) { item ->
                            SwipeableRow(
                                item = item,
                                onToggle = { vm.toggle(item) },
                                onEdit = { editing = item },
                                onDelete = { deleteWithUndo(item) },
                                modifier = Modifier.animateItem(),
                            )
                        }
                    }
                    if (done.isNotEmpty()) {
                        stickyHeader(key = "h_done") { SectionHeader("In cart (${done.size})") }
                        items(done, key = { it.id }) { item ->
                            SwipeableRow(
                                item = item,
                                onToggle = { vm.toggle(item) },
                                onEdit = { editing = item },
                                onDelete = { deleteWithUndo(item) },
                                modifier = Modifier.animateItem(),
                            )
                        }
                    }
                }
            }
        }
    }

    if (adding) {
        ItemDialog(
            initial = null,
            onDismiss = { adding = false },
            onSave = { name, q, unit, category, note ->
                adding = false
                vm.addManual(name, q, unit, note, category?.name)
            },
        )
    }
    editing?.let { item ->
        ItemDialog(
            initial = item,
            onDismiss = { editing = null },
            onSave = { name, q, unit, category, note ->
                editing = null
                vm.update(
                    item.copy(
                        name = name,
                        quantity = q,
                        unit = unit,
                        category = (category ?: item.categoryEnum).name,
                        note = note,
                    ),
                )
            },
        )
    }
    if (confirmClearAll) {
        AlertDialog(
            onDismissRequest = { confirmClearAll = false },
            title = { Text("Clear the whole list?") },
            text = { Text("This removes every item, checked or not.") },
            confirmButton = {
                TextButton(onClick = { confirmClearAll = false; vm.clearAll() }) { Text("Clear") }
            },
            dismissButton = { TextButton(onClick = { confirmClearAll = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SectionHeader(label: String) {
    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        Column {
            Text(
                label,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 6.dp),
            )
            HorizontalDivider()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeableRow(
    item: GroceryItem,
    onToggle: () -> Unit,
    onEdit: () -> Unit,
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
        ItemRow(item, onToggle, onEdit)
    }
}

@Composable
private fun ItemRow(item: GroceryItem, onToggle: () -> Unit, onEdit: () -> Unit) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Surface(color = MaterialTheme.colorScheme.surface) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(start = 4.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = item.checked, onCheckedChange = { onToggle() })
            Column(Modifier.weight(1f).padding(vertical = 10.dp)) {
                Text(
                    buildAnnotatedString {
                        val amount = item.amountLabel
                        if (amount.isNotEmpty()) {
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(amount) }
                            append("  ")
                        }
                        append(item.name)
                    },
                    style = MaterialTheme.typography.bodyLarge,
                    textDecoration = if (item.checked) TextDecoration.LineThrough else null,
                    color = if (item.checked) muted else MaterialTheme.colorScheme.onSurface,
                )
                item.note?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = muted)
                }
                item.sources?.let {
                    Text("For: $it", style = MaterialTheme.typography.labelSmall, color = muted)
                }
            }
            IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, "Edit ${item.name}", tint = muted) }
        }
    }
}

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Default.ShoppingCart,
            null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            "Your list is empty",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Tap Add recipe to paste a recipe, or + to add a single item. " +
                "You can also share recipe text to this app from your browser.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
