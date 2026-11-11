package dev.azrael.grocery.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
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
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.data.MealPlanEntry
import dev.azrael.grocery.data.Recipe
import dev.azrael.grocery.parse.CabinetMatch
import dev.azrael.grocery.parse.CombinedLine
import dev.azrael.grocery.parse.MealPlan
import dev.azrael.grocery.parse.Servings
import dev.azrael.grocery.parse.formatAmount
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private val monthDay = DateTimeFormatter.ofPattern("MMM d", Locale.getDefault())

/**
 * The week's meals, Monday to Sunday, from the recipe box. "Make the grocery list" combines every
 * planned meal, at its servings, into one list to review.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealPlanScreen(
    vm: GroceryViewModel,
    cabinetKeys: Set<String>,
    onBack: () -> Unit,
    onOpenRecipeBox: () -> Unit,
    /** After the week's ingredients went on the list. */
    onAddedToList: () -> Unit,
) {
    val start by vm.weekStart.collectAsStateWithLifecycle()
    val entries by vm.week.collectAsStateWithLifecycle()
    val recipes by vm.recipes.collectAsStateWithLifecycle()
    val byId = remember(recipes) { recipes.orEmpty().associateBy { it.id } }
    // Meals whose recipe is still in the box.
    val planned = entries.orEmpty().filter { it.recipeId in byId }
    var reviewing by rememberSaveable { mutableStateOf(false) }
    var addingFor by rememberSaveable { mutableStateOf<Long?>(null) }
    var editing by remember { mutableStateOf<MealPlanEntry?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    var confirmClear by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    if (reviewing && planned.isNotEmpty()) {
        WeekReview(
            start = start,
            planned = planned,
            byId = byId,
            cabinetKeys = cabinetKeys,
            onBack = { reviewing = false },
            onAdd = { lines ->
                vm.addCombinedToList(lines, planned.map { it.recipeId }.toSet())
                reviewing = false
                onAddedToList()
            },
        )
        return
    }

    BackHandler(onBack = onBack)
    val today = LocalDate.now()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Meal plan") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Recipe box") },
                                onClick = { menuOpen = false; onOpenRecipeBox() },
                            )
                            DropdownMenuItem(
                                text = { Text("Clear this week") },
                                onClick = { menuOpen = false; confirmClear = true },
                                enabled = planned.isNotEmpty(),
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Button(
                    onClick = { reviewing = true },
                    enabled = planned.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),
                ) {
                    Text(
                        when (planned.size) {
                            0 -> "Plan a meal to make a list"
                            1 -> "Make the grocery list (1 meal)"
                            else -> "Make the grocery list (${planned.size} meals)"
                        },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 16.dp,
            ),
        ) {
            item(key = "week") {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { vm.shiftWeek(-1) }) { Icon(Icons.Default.ChevronLeft, "Previous week") }
                    Text(
                        "${start.format(monthDay)} – ${start.plusDays(6).format(monthDay)}",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f).clickable { vm.thisWeek() },
                    )
                    IconButton(onClick = { vm.shiftWeek(1) }) { Icon(Icons.Default.ChevronRight, "Next week") }
                }
            }
            if (recipes?.isEmpty() == true) {
                item(key = "norecipes") {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "Meals come from your recipe box, and it's empty. Save a recipe there first.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        TextButton(onClick = onOpenRecipeBox) { Text("Open the recipe box") }
                    }
                }
            }
            items((0L..6L).toList(), key = { "d$it" }) { offset ->
                val day = start.plusDays(offset)
                val meals = planned.filter { it.day == day.toEpochDay() }
                DayCard(
                    day = day,
                    isToday = day == today,
                    meals = meals,
                    byId = byId,
                    canAdd = !recipes.isNullOrEmpty(),
                    onAdd = { addingFor = day.toEpochDay() },
                    onEdit = { editing = it },
                    onRemove = { entry ->
                        vm.unplan(entry)
                        scope.launch {
                            snackbar.currentSnackbarData?.dismiss()
                            val r = snackbar.showSnackbar(
                                "Took ${byId[entry.recipeId]?.title ?: "the meal"} off ${dayName(day)}",
                                actionLabel = "Undo",
                                withDismissAction = true,
                            )
                            if (r == SnackbarResult.ActionPerformed) vm.restorePlanned(entry)
                        }
                    },
                )
            }
        }
    }

    addingFor?.let { epochDay ->
        val day = LocalDate.ofEpochDay(epochDay)
        PickRecipeDialog(
            day = day,
            recipes = recipes.orEmpty(),
            onDismiss = { addingFor = null },
            onPick = { recipe, servings ->
                addingFor = null
                vm.planMeal(day, recipe, servings)
            },
        )
    }
    editing?.let { entry ->
        byId[entry.recipeId]?.let { recipe ->
            ServingsDialog(
                title = recipe.title,
                initial = entry.servings,
                onDismiss = { editing = null },
                onSave = { n -> editing = null; vm.updatePlanned(entry.copy(servings = n)) },
            )
        }
    }
    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text("Clear this week?") },
            text = { Text("Every meal planned for this week comes off the plan. Your recipes and list stay.") },
            confirmButton = {
                TextButton(onClick = { confirmClear = false; vm.clearWeek() }) { Text("Clear") }
            },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("Cancel") } },
        )
    }
}

private fun dayName(day: LocalDate) = day.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())

@Composable
private fun DayCard(
    day: LocalDate,
    isToday: Boolean,
    meals: List<MealPlanEntry>,
    byId: Map<Long, Recipe>,
    canAdd: Boolean,
    onAdd: () -> Unit,
    onEdit: (MealPlanEntry) -> Unit,
    onRemove: (MealPlanEntry) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
        colors = if (isToday) {
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        } else {
            CardDefaults.cardColors()
        },
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "${dayName(day)} · ${day.format(monthDay)}" + if (isToday) " · today" else "",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onAdd, enabled = canAdd) { Icon(Icons.Default.Add, "Add a meal on ${dayName(day)}") }
        }
        meals.forEach { entry ->
            val recipe = byId[entry.recipeId] ?: return@forEach
            Row(
                modifier = Modifier.fillMaxWidth().clickable { onEdit(entry) }.padding(start = 16.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                    Text(recipe.title, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Serves ${entry.servings}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { onRemove(entry) }) { Icon(Icons.Default.Close, "Remove ${recipe.title}") }
            }
        }
        if (meals.isEmpty()) {
            Text(
                "Nothing planned",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 16.dp, bottom = 12.dp),
            )
        }
    }
}

@Composable
private fun PickRecipeDialog(
    day: LocalDate,
    recipes: List<Recipe>,
    onDismiss: () -> Unit,
    onPick: (Recipe, Int) -> Unit,
) {
    var chosenId by rememberSaveable { mutableStateOf<Long?>(null) }
    val chosen = recipes.firstOrNull { it.id == chosenId }
    var servings by rememberSaveable(chosenId) { mutableStateOf(chosen?.servings ?: 4) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (chosen == null) "Add a meal on ${dayName(day)}" else chosen.title) },
        text = {
            if (chosen == null) {
                LazyColumn(Modifier.heightIn(max = 400.dp)) {
                    items(recipes, key = { it.id }) { recipe ->
                        Text(
                            recipe.title,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.fillMaxWidth().clickable { chosenId = recipe.id }.padding(vertical = 12.dp),
                        )
                        HorizontalDivider()
                    }
                }
            } else {
                ServingsStepper(servings) { servings = it }
            }
        },
        confirmButton = {
            if (chosen != null) TextButton(onClick = { onPick(chosen, servings) }) { Text("Add") }
        },
        dismissButton = {
            TextButton(onClick = { if (chosen == null) onDismiss() else chosenId = null }) {
                Text(if (chosen == null) "Cancel" else "Back")
            }
        },
    )
}

@Composable
private fun ServingsDialog(title: String, initial: Int, onDismiss: () -> Unit, onSave: (Int) -> Unit) {
    var servings by rememberSaveable { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { ServingsStepper(servings) { servings = it } },
        confirmButton = { TextButton(onClick = { onSave(servings) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ServingsStepper(servings: Int, onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Servings", modifier = Modifier.weight(1f))
        IconButton(onClick = { onChange(servings - 1) }, enabled = servings > 1) {
            Icon(Icons.Default.Remove, "Fewer servings")
        }
        Text("$servings", style = MaterialTheme.typography.titleMedium)
        IconButton(onClick = { onChange(servings + 1) }, enabled = servings < 48) {
            Icon(Icons.Default.Add, "More servings")
        }
    }
}

/** The week's meals folded into one list; Cabinet items start unticked. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WeekReview(
    start: LocalDate,
    planned: List<MealPlanEntry>,
    byId: Map<Long, Recipe>,
    cabinetKeys: Set<String>,
    onBack: () -> Unit,
    onAdd: (List<CombinedLine>) -> Unit,
) {
    val lines = remember(planned, byId) {
        MealPlan.combine(
            planned.mapNotNull { entry ->
                val recipe = byId[entry.recipeId] ?: return@mapNotNull null
                recipe.title to Servings.scale(recipe.ingredients(), recipe.servings, entry.servings)
            },
        )
    }
    val inCabinet = remember(lines, cabinetKeys) { lines.map { CabinetMatch.find(it.key, cabinetKeys) != null } }
    var overrides by remember(lines) { mutableStateOf(emptyMap<Int, Boolean>()) }
    fun isIncluded(i: Int) = overrides[i] ?: !inCabinet[i]
    val selected = lines.filterIndexed { i, _ -> isIncluded(i) }
    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Week's grocery list")
                        Text(
                            "${start.format(monthDay)} – ${start.plusDays(6).format(monthDay)} · ${planned.size} meals",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Button(
                    onClick = { onAdd(selected) },
                    enabled = selected.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),
                ) { Text(if (selected.isEmpty()) "Nothing selected" else "Add ${selected.size} items to list") }
            }
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = padding) {
            item {
                val skipped = lines.indices.count { inCabinet[it] && !isIncluded(it) }
                Text(
                    buildString {
                        append("${lines.size} items for the week. ")
                        if (skipped > 0) append("$skipped already in your Cabinet, so they start unticked.")
                    },
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            itemsIndexed(lines) { i, line ->
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
                                val amount = formatAmount(line.quantity, line.unit)
                                if (amount.isNotEmpty()) {
                                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(amount) }
                                    append("  ")
                                }
                                append(line.name)
                            },
                            style = MaterialTheme.typography.bodyLarge,
                        )
                        Text(
                            listOfNotNull(
                                line.sources.joinToString(", "),
                                "In your Cabinet".takeIf { inCabinet[i] },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
