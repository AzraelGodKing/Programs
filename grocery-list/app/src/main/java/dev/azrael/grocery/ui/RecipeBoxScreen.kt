package dev.azrael.grocery.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.data.Recipe
import dev.azrael.grocery.parse.CabinetMatch
import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.ParsedIngredient
import dev.azrael.grocery.parse.Servings
import dev.azrael.grocery.parse.formatAmount
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

/** Ingredients of [recipe] scaled to [servings], with the ones already in the Cabinet left out. */
private fun toBuy(recipe: Recipe, servings: Int, cabinetKeys: Set<String>): List<ParsedIngredient> =
    Servings.scale(recipe.ingredients(), recipe.servings, servings)
        .filter { CabinetMatch.find(NameKey.of(it.name), cabinetKeys) == null }

/**
 * The recipe box: saved recipes, each re-added to the list in one tap or opened to change the
 * servings and pick ingredients first.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipeBoxScreen(
    vm: GroceryViewModel,
    cabinetKeys: Set<String>,
    onBack: () -> Unit,
    /** After a recipe's ingredients went on the list from its page. */
    onAddedToList: () -> Unit,
) {
    val recipes by vm.recipes.collectAsStateWithLifecycle()
    var openId by rememberSaveable { mutableStateOf<Long?>(null) }
    val open = openId?.let { id -> recipes?.firstOrNull { it.id == id } }

    if (open != null) {
        RecipeDetail(
            recipe = open,
            cabinetKeys = cabinetKeys,
            vm = vm,
            onBack = { openId = null },
            onAdded = { openId = null; onAddedToList() },
        )
        return
    }

    var query by rememberSaveable { mutableStateOf("") }
    var creating by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recipe box") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { creating = true },
                icon = { Icon(Icons.Default.Add, null) },
                text = { Text("New recipe") },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val list = recipes
        val shown = list.orEmpty().filter { query.isBlank() || it.title.contains(query.trim(), ignoreCase = true) }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 96.dp,
            ),
        ) {
            when {
                list == null -> Unit
                list.isEmpty() -> item(key = "empty") { RecipeBoxEmptyState() }
                else -> {
                    if (list.size > 5) {
                        item(key = "search") {
                            OutlinedTextField(
                                value = query,
                                onValueChange = { query = it },
                                leadingIcon = { Icon(Icons.Default.Search, null) },
                                placeholder = { Text("Find a recipe") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                        }
                    }
                    items(shown, key = { it.id }) { recipe ->
                        RecipeRow(
                            recipe = recipe,
                            onOpen = { openId = recipe.id },
                            onQuickAdd = {
                                val lines = toBuy(recipe, recipe.servings, cabinetKeys)
                                vm.addRecipeToList(recipe, lines)
                                scope.launch {
                                    snackbar.currentSnackbarData?.dismiss()
                                    snackbar.showSnackbar(
                                        if (lines.isEmpty()) {
                                            "Everything for ${recipe.title} is already in your Cabinet"
                                        } else {
                                            "Added ${lines.size} items for ${recipe.title}"
                                        },
                                        withDismissAction = true,
                                    )
                                }
                            },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    if (creating) {
        RecipeEditDialog(
            initial = null,
            onDismiss = { creating = false },
            onSave = { title, servings, text ->
                creating = false
                vm.saveRecipe(title, servings, text)
            },
        )
    }
}

@Composable
private fun RecipeRow(recipe: Recipe, onOpen: () -> Unit, onQuickAdd: () -> Unit) {
    val count = remember(recipe.text) { recipe.ingredients().size }
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(start = 16.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(vertical = 12.dp)) {
            Text(recipe.title, style = MaterialTheme.typography.bodyLarge)
            Text(
                listOfNotNull(
                    "Serves ${recipe.servings}",
                    "$count ingredients",
                    recipe.lastAddedAt?.let { "last added ${DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(it))}" },
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = onQuickAdd) {
            Icon(
                Icons.Default.AddShoppingCart,
                "Add ${recipe.title} to the grocery list",
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecipeDetail(
    recipe: Recipe,
    cabinetKeys: Set<String>,
    vm: GroceryViewModel,
    onBack: () -> Unit,
    onAdded: () -> Unit,
) {
    var servings by rememberSaveable(recipe.id) { mutableStateOf(recipe.servings) }
    val base = remember(recipe.text) { recipe.ingredients() }
    val scaled = remember(base, servings, recipe.servings) { Servings.scale(base, recipe.servings, servings) }
    val inCabinet = remember(base, cabinetKeys) {
        base.map { CabinetMatch.find(NameKey.of(it.name), cabinetKeys) != null }
    }
    var overrides by remember(recipe.text) { mutableStateOf(emptyMap<Int, Boolean>()) }
    fun isIncluded(i: Int) = overrides[i] ?: !inCabinet[i]
    val selected = scaled.filterIndexed { i, _ -> isIncluded(i) }
    var showText by rememberSaveable { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(recipe.title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    IconButton(onClick = { editing = true }) { Icon(Icons.Default.Edit, "Edit recipe") }
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Delete recipe") },
                                onClick = { menuOpen = false; confirmDelete = true },
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Button(
                    onClick = { vm.addRecipeToList(recipe, selected); onAdded() },
                    enabled = selected.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),
                ) {
                    Text(if (selected.isEmpty()) "Nothing selected" else "Add ${selected.size} items to list")
                }
            }
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = padding) {
            item(key = "servings") {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Servings", style = MaterialTheme.typography.titleSmall)
                        if (servings != recipe.servings) {
                            Text(
                                "Recipe as written serves ${recipe.servings}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    IconButton(onClick = { servings -= 1 }, enabled = servings > 1) {
                        Icon(Icons.Default.Remove, "Fewer servings")
                    }
                    Text("$servings", style = MaterialTheme.typography.titleMedium)
                    IconButton(onClick = { servings += 1 }, enabled = servings < 48) {
                        Icon(Icons.Default.Add, "More servings")
                    }
                }
                HorizontalDivider()
            }
            if (base.isEmpty()) {
                item(key = "none") {
                    Text(
                        "No ingredients found in this recipe. Edit it and put the ingredients one per line.",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
            itemsIndexed(scaled) { i, ing ->
                val included = isIncluded(i)
                val toggle = { overrides = overrides + (i to !included) }
                Row(
                    modifier = Modifier.fillMaxWidth().clickable(onClick = toggle).padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = included, onCheckedChange = { toggle() })
                    Column(Modifier.padding(vertical = 6.dp)) {
                        Text(
                            buildAnnotatedString {
                                val amount = formatAmount(ing.quantity, ing.unit)
                                if (amount.isNotEmpty()) {
                                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(amount) }
                                    append("  ")
                                }
                                append(ing.name)
                            },
                            style = MaterialTheme.typography.bodyLarge,
                        )
                        val sub = listOfNotNull(ing.note, "In your Cabinet".takeIf { inCabinet[i] })
                        if (sub.isNotEmpty()) {
                            Text(
                                sub.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            item(key = "text") {
                HorizontalDivider(Modifier.padding(top = 8.dp))
                TextButton(onClick = { showText = !showText }, modifier = Modifier.padding(horizontal = 8.dp)) {
                    Text(if (showText) "Hide the full recipe" else "Show the full recipe")
                }
                if (showText) {
                    SelectionContainer {
                        Text(
                            recipe.text,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        )
                    }
                }
            }
        }
    }

    if (editing) {
        RecipeEditDialog(
            initial = recipe,
            onDismiss = { editing = false },
            onSave = { title, newServings, text ->
                editing = false
                vm.updateRecipe(recipe.copy(title = title, servings = newServings, text = text))
                servings = newServings
            },
        )
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete ${recipe.title}?") },
            text = { Text("It comes out of the recipe box. Anything already on the grocery list stays.") },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; vm.deleteRecipe(recipe); onBack() }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

/** New or edited recipe: a name, how many it serves, and the text with its ingredients. */
@Composable
fun RecipeEditDialog(
    initial: Recipe?,
    onDismiss: () -> Unit,
    onSave: (title: String, servings: Int, text: String) -> Unit,
) {
    var title by rememberSaveable { mutableStateOf(initial?.title.orEmpty()) }
    var text by rememberSaveable { mutableStateOf(initial?.text.orEmpty()) }
    var servingsText by rememberSaveable { mutableStateOf(initial?.servings?.toString().orEmpty()) }
    val servings = servingsText.toIntOrNull()?.takeIf { it in 1..48 }
        ?: Servings.detect(text)?.takeIf { servingsText.isBlank() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "New recipe" else "Edit recipe") },
        text = {
            Column(Modifier.imePadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = servingsText,
                    onValueChange = { v -> servingsText = v.filter { it.isDigit() }.take(2) },
                    label = { Text("Serves") },
                    placeholder = { Text(Servings.detect(text)?.toString() ?: "4") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("Ingredients and steps") },
                    minLines = 5,
                    maxLines = 10,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(title.trim(), servings ?: 4, text.trim()) },
                enabled = title.isNotBlank() && text.isNotBlank(),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun RecipeBoxEmptyState() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.AutoMirrored.Filled.MenuBook,
            null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            "No saved recipes yet",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Tick \"Save to recipe box\" when you add a recipe, use the bookmark on an AI recipe, " +
                "or tap New recipe. Then the cart button puts it back on your list in one tap.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
