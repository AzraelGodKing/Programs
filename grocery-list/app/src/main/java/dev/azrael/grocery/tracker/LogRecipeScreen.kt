package dev.azrael.grocery.tracker

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.azrael.grocery.nutrition.Dash
import dev.azrael.grocery.nutrition.RecipeNutritionEstimator
import dev.azrael.grocery.parse.IngredientParser
import dev.azrael.grocery.parse.Quantities
import dev.azrael.grocery.parse.Servings
import dev.azrael.grocery.parse.formatAmount
import kotlin.math.roundToInt

/**
 * Log a cooked recipe: paste it (or arrive from Add recipe with it filled in), set how many servings it
 * makes and how many you ate, and the built-in table estimates sodium and potassium. The numbers can be
 * corrected before logging, e.g. from a nutrition label.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogRecipeScreen(
    vm: TrackerViewModel,
    initialText: String,
    initialTitle: String,
    onBack: () -> Unit,
    onLogged: () -> Unit,
) {
    var title by rememberSaveable { mutableStateOf(initialTitle) }
    var text by rememberSaveable { mutableStateOf(initialText) }
    var makes by rememberSaveable { mutableStateOf(Servings.detect(initialText)?.toString() ?: "") }
    var ate by rememberSaveable { mutableStateOf("1") }
    val clipboard = LocalClipboardManager.current
    val limit by vm.settings.sodiumLimit.collectAsState()

    val ingredients = remember(text) { IngredientParser.parseRecipe(text) }
    val makesN = Quantities.parse(makes.trim())?.takeIf { it > 0 }
    val ateN = Quantities.parse(ate.trim())?.takeIf { it > 0 }
    val estimate = remember(ingredients, makesN) { RecipeNutritionEstimator.estimate(ingredients, makesN ?: 1.0) }
    // Hand-corrected per-serving numbers; null means use the estimate. Reset when the estimate changes.
    var sodiumEdit by remember(estimate) { mutableStateOf<String?>(null) }
    var potassiumEdit by remember(estimate) { mutableStateOf<String?>(null) }
    val sodiumPer = sodiumEdit?.toIntOrNull() ?: estimate.sodiumPerServing
    val potassiumPer = potassiumEdit?.toIntOrNull() ?: estimate.potassiumPerServing
    val saltToTaste = estimate.skipped.any { it.matched?.contains("salt") == true && it.ingredient.quantity == null }

    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Log a recipe") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Button(
                    onClick = {
                        vm.log(title.ifBlank { "Recipe" }, sodiumPer, potassiumPer, ateN ?: 1.0, onLogged)
                    },
                    enabled = ingredients.isNotEmpty() && makesN != null && ateN != null,
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(16.dp),
                ) {
                    Text(
                        when {
                            ingredients.isEmpty() -> "Paste a recipe first"
                            makesN == null -> "How many servings does it make?"
                            else -> "Log ${Dash.mg((sodiumPer * (ateN ?: 1.0)).roundToInt())} mg sodium"
                        },
                    )
                }
            }
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = padding) {
            item {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Recipe name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                )
                OutlinedTextField(
                    value = text,
                    onValueChange = {
                        text = it
                        if (makes.isBlank()) Servings.detect(it)?.let { n -> makes = n.toString() }
                    },
                    label = { Text("Recipe or ingredient list") },
                    minLines = 4,
                    maxLines = 10,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                )
                Row(Modifier.padding(horizontal = 8.dp)) {
                    TextButton(onClick = {
                        clipboard.getText()?.text?.let {
                            text = it
                            Servings.detect(it)?.let { n -> makes = n.toString() }
                        }
                    }) { Text("Paste from clipboard") }
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedTextField(
                        value = makes,
                        onValueChange = { makes = it },
                        label = { Text("Recipe makes") },
                        suffix = { Text("servings") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = ate,
                        onValueChange = { ate = it },
                        label = { Text("You ate") },
                        suffix = { Text("servings") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            if (ingredients.isNotEmpty() && makesN != null) {
                item {
                    Card(Modifier.fillMaxWidth().padding(16.dp)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Per serving (estimate)", style = MaterialTheme.typography.labelLarge)
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedTextField(
                                    value = sodiumEdit ?: estimate.sodiumPerServing.toString(),
                                    onValueChange = { sodiumEdit = it.filter(Char::isDigit) },
                                    label = { Text("Sodium") },
                                    suffix = { Text("mg") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    textStyle = MaterialTheme.typography.titleMedium.copy(
                                        color = sodiumColor(sodiumPer, limit / 3),
                                        fontWeight = FontWeight.SemiBold,
                                    ),
                                    modifier = Modifier.weight(1f),
                                )
                                OutlinedTextField(
                                    value = potassiumEdit ?: estimate.potassiumPerServing.toString(),
                                    onValueChange = { potassiumEdit = it.filter(Char::isDigit) },
                                    label = { Text("Potassium") },
                                    suffix = { Text("mg") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            val share = (sodiumPer * 100f / limit).roundToInt()
                            Text(
                                "One serving is about $share% of your ${Dash.mg(limit)} mg day. " +
                                    "Estimated from typical USDA values; fix the numbers if you have a label.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (saltToTaste) {
                                Text(
                                    "Salt \"to taste\" isn't counted. Each 1/4 tsp you add is about " +
                                        "${Dash.QUARTER_TSP_SALT_MG} mg for the whole pot.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                    }
                }
                val top = estimate.topSodium.take(5)
                if (top.isNotEmpty()) {
                    item {
                        Text(
                            "Where the sodium comes from (whole recipe)",
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        )
                    }
                    items(top) { row ->
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                            Text(
                                listOf(formatAmount(row.ingredient.quantity, row.ingredient.unit), row.ingredient.name)
                                    .filter { it.isNotEmpty() }.joinToString(" "),
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f),
                            )
                            Text("${Dash.mg(row.sodiumMg!!.roundToInt())} mg", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                val skipped = estimate.skipped
                if (skipped.isNotEmpty()) {
                    item {
                        Text(
                            "Not counted: " + skipped.joinToString(", ") { "${it.ingredient.name} (${it.skippedReason})" },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
            }
        }
    }
}
