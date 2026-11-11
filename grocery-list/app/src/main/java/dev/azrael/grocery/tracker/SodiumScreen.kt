package dev.azrael.grocery.tracker

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.data.FoodLogEntry
import dev.azrael.grocery.nutrition.Dash
import dev.azrael.grocery.parse.Quantities
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** Daily sodium and potassium against DASH targets. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SodiumScreen(
    vm: TrackerViewModel,
    onBack: () -> Unit,
    onLogRecipe: () -> Unit,
) {
    val entries by vm.entries.collectAsStateWithLifecycle()
    val week by vm.week.collectAsStateWithLifecycle()
    val day by vm.day.collectAsState()
    val limit by vm.settings.sodiumLimit.collectAsState()
    var menuOpen by remember { mutableStateOf(false) }
    var pickLimit by remember { mutableStateOf(false) }
    var logging by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val today = TrackerViewModel.today()

    BackHandler(onBack = onBack)

    val list = entries.orEmpty()
    val sodium = list.sumOf { it.sodiumMg }
    val potassium = list.sumOf { it.potassiumMg ?: 0 }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sodium tracker") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Daily sodium limit: ${Dash.mg(limit)} mg") },
                                onClick = { menuOpen = false; pickLimit = true },
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Row(
                    Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(onClick = { logging = true }, modifier = Modifier.weight(1f)) { Text("Log a food") }
                    Button(onClick = onLogRecipe, modifier = Modifier.weight(1f)) { Text("Log a recipe") }
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = padding.calculateTopPadding(), bottom = padding.calculateBottomPadding() + 16.dp),
        ) {
            item(key = "day") {
                DaySwitcher(
                    day = day,
                    today = today,
                    onPrevious = vm::previousDay,
                    onNext = vm::nextDay,
                    onToday = vm::goToToday,
                )
            }
            item(key = "totals") {
                TotalsCard(sodium = sodium, potassium = potassium, limit = limit)
            }
            item(key = "week") {
                WeekStrip(week = week.associate { it.day to it.sodiumMg }, endDay = day, limit = limit, onPick = vm::showDay)
            }
            when {
                entries == null -> Unit
                list.isEmpty() -> item(key = "empty") { EmptyLog(isToday = day == today) }
                else -> items(list, key = { it.id }) { entry ->
                    LogRow(entry, limit = limit, onDelete = {
                        vm.delete(entry)
                        scope.launch {
                            snackbar.currentSnackbarData?.dismiss()
                            val r = snackbar.showSnackbar("Removed ${entry.name}", actionLabel = "Undo", withDismissAction = true)
                            if (r == SnackbarResult.ActionPerformed) vm.restore(entry)
                        }
                    })
                }
            }
        }
    }

    if (logging) {
        LogFoodDialog(
            onDismiss = { logging = false },
            onLog = { name, na, k, servings ->
                logging = false
                vm.log(name, na, k, servings)
            },
        )
    }

    if (pickLimit) {
        LimitDialog(current = limit, onDismiss = { pickLimit = false }, onPick = {
            vm.settings.setSodiumLimit(it)
            pickLimit = false
        })
    }
}

private val dayFormat = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)

@Composable
private fun DaySwitcher(day: Long, today: Long, onPrevious: () -> Unit, onNext: () -> Unit, onToday: () -> Unit) {
    val date = LocalDate.ofEpochDay(day)
    val label = when (day) {
        today -> "Today, " + date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        today - 1 -> "Yesterday, " + date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        else -> date.format(dayFormat)
    }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onPrevious) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Previous day") }
        Text(label, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
        if (day != today) {
            TextButton(onClick = onToday) { Text("Today") }
        }
        IconButton(onClick = onNext, enabled = day < today) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Next day")
        }
    }
}

/** Colour for a sodium amount against the limit: fine, getting close, over. */
@Composable
fun sodiumColor(mg: Int, limit: Int): Color = when {
    mg > limit -> MaterialTheme.colorScheme.error
    mg > limit * 0.8 -> Color(0xFFB26A00)
    else -> MaterialTheme.colorScheme.primary
}

@Composable
private fun TotalsCard(sodium: Int, potassium: Int, limit: Int) {
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Column(Modifier.padding(16.dp)) {
            val color = sodiumColor(sodium, limit)
            Text("Sodium", style = MaterialTheme.typography.labelLarge)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    "${Dash.mg(sodium)} mg",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = color,
                )
                Text(
                    "  of ${Dash.mg(limit)} mg",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            LinearProgressIndicator(
                progress = { (sodium.toFloat() / limit).coerceIn(0f, 1f) },
                color = color,
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
            )
            Text(
                if (sodium <= limit) "${Dash.mg(limit - sodium)} mg left today" else "${Dash.mg(sodium - limit)} mg over the DASH limit",
                style = MaterialTheme.typography.bodyMedium,
                color = if (sodium > limit) color else MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(16.dp))
            Text("Potassium", style = MaterialTheme.typography.labelLarge)
            Row(verticalAlignment = Alignment.Bottom) {
                Text("${Dash.mg(potassium)} mg", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text(
                    "  goal ${Dash.mg(Dash.POTASSIUM_GOAL_MG)} mg",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 2.dp),
                )
            }
            LinearProgressIndicator(
                progress = { (potassium.toFloat() / Dash.POTASSIUM_GOAL_MG).coerceIn(0f, 1f) },
                color = MaterialTheme.colorScheme.tertiary,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            )
        }
    }
}

/** Seven small bars for the week ending on [endDay]; tap one to open that day. */
@Composable
private fun WeekStrip(week: Map<Long, Int>, endDay: Long, limit: Int, onPick: (Long) -> Unit) {
    val maxMg = maxOf(limit, week.values.maxOrNull() ?: 0).toFloat()
    Row(
        Modifier.fillMaxWidth().height(96.dp).padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (d in (endDay - 6)..endDay) {
            val mg = week[d] ?: 0
            Column(
                Modifier.weight(1f).fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
            ) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    if (mg > 0) {
                        Box(
                            Modifier
                                .fillMaxWidth(0.7f)
                                .fillMaxHeight((mg / maxMg).coerceIn(0.04f, 1f))
                                .background(sodiumColor(mg, limit), RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)),
                        )
                    }
                }
                TextButton(onClick = { onPick(d) }, contentPadding = PaddingValues(0.dp), modifier = Modifier.height(24.dp)) {
                    Text(
                        LocalDate.ofEpochDay(d).dayOfWeek.getDisplayName(TextStyle.NARROW, Locale.US),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (d == endDay) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LogRow(entry: FoodLogEntry, limit: Int, onDelete: () -> Unit) {
    val state = rememberSwipeToDismissBoxState()
    LaunchedEffect(state.currentValue) {
        if (state.currentValue == SwipeToDismissBoxValue.EndToStart) onDelete()
    }
    SwipeToDismissBox(
        state = state,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                Modifier.fillMaxSize().background(MaterialTheme.colorScheme.errorContainer).padding(horizontal = 24.dp),
                contentAlignment = Alignment.CenterEnd,
            ) { Icon(Icons.Default.Delete, "Delete", tint = MaterialTheme.colorScheme.onErrorContainer) }
        },
    ) {
        Surface(color = MaterialTheme.colorScheme.surface) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(entry.name, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        listOfNotNull(
                            servingsLabel(entry.servings),
                            entry.potassiumMg?.let { "${Dash.mg(it)} mg potassium" },
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    "${Dash.mg(entry.sodiumMg)} mg",
                    style = MaterialTheme.typography.titleMedium,
                    // A single food over a third of the day's limit stands out.
                    color = if (entry.sodiumMg > limit / 3) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

fun servingsLabel(servings: Double): String =
    if (servings == 1.0) "1 serving" else "${Quantities.format(servings)} servings"

@Composable
private fun EmptyLog(isToday: Boolean) {
    Column(
        Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Default.Insights, null, modifier = Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        Text(
            if (isToday) "Nothing logged today" else "Nothing logged this day",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            "Log a recipe you cooked and the app estimates its sodium and potassium per serving. " +
                "Log a food for anything with a label, or scan its barcode from the Cabinet.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun LimitDialog(current: Int, onDismiss: () -> Unit, onPick: (Int) -> Unit) {
    val options = listOf(
        Dash.SODIUM_STANDARD_MG to "Standard DASH",
        Dash.SODIUM_LOWER_MG to "Lower-sodium DASH (lowers blood pressure more)",
    )
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Daily sodium limit") },
        text = {
            Column {
                options.forEach { (mg, label) ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = current == mg, onClick = { onPick(mg) })
                        Column {
                            Text("${Dash.mg(mg)} mg")
                            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}

/**
 * Log something by its label values. [initialName] and the per-serving amounts can be prefilled,
 * e.g. from a barcode scan.
 */
@Composable
fun LogFoodDialog(
    onDismiss: () -> Unit,
    onLog: (name: String, sodiumPerServing: Int, potassiumPerServing: Int?, servings: Double) -> Unit,
    initialName: String = "",
    initialSodium: Int? = null,
    initialPotassium: Int? = null,
    servingLabel: String? = null,
) {
    var name by rememberSaveable { mutableStateOf(initialName) }
    var sodium by rememberSaveable { mutableStateOf(initialSodium?.toString().orEmpty()) }
    var potassium by rememberSaveable { mutableStateOf(initialPotassium?.toString().orEmpty()) }
    var servings by rememberSaveable { mutableStateOf("1") }
    val sodiumMg = sodium.trim().toIntOrNull()
    val servingsN = Quantities.parse(servings.trim().ifEmpty { "1" })?.takeIf { it > 0 }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log a food") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("What you ate") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                )
                OutlinedTextField(
                    value = sodium,
                    onValueChange = { sodium = it.filter(Char::isDigit) },
                    label = { Text("Sodium per serving (mg)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = potassium,
                    onValueChange = { potassium = it.filter(Char::isDigit) },
                    label = { Text("Potassium per serving (mg, optional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = servings,
                    onValueChange = { servings = it },
                    label = { Text("Servings eaten") },
                    supportingText = servingLabel?.let { { Text("1 serving = $it") } },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                if (sodiumMg != null && servingsN != null) {
                    Text(
                        "Logs ${Dash.mg((sodiumMg * servingsN).toInt())} mg sodium",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onLog(name, sodiumMg ?: 0, potassium.trim().toIntOrNull(), servingsN ?: 1.0) },
                enabled = name.isNotBlank() && sodiumMg != null && servingsN != null,
            ) { Text("Log") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
