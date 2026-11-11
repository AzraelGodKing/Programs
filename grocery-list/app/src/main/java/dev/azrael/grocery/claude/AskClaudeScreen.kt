package dev.azrael.grocery.claude

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.parse.ParsedIngredient
import dev.azrael.grocery.parse.formatAmount

private val suggestions = listOf(
    "Quick chicken dinner for 2",
    "Meatless lunch I can prep for the week",
    "Low-sodium breakfast ideas",
    "Salmon with whatever vegetables are in season",
)

/**
 * Ask Claude for a DASH recipe, or have it read a pasted recipe or link, then add the ingredients.
 * Only reachable when Claude is turned on in settings.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AskClaudeScreen(
    vm: AskClaudeViewModel,
    input: String,
    onInputChange: (String) -> Unit,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onAdd: (ingredients: List<ParsedIngredient>, source: String?) -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val config by vm.settings.config.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current

    val recipe = (state as? AskState.Done)?.recipe
    val parsed = remember(recipe) { recipe?.toParsedIngredients().orEmpty() }
    var excluded by remember(recipe) { mutableStateOf(emptySet<Int>()) }
    val selected = parsed.filterIndexed { i, _ -> i !in excluded }

    // Back from a result returns to the question; back from the question leaves.
    val back = { if (state is AskState.Idle) onBack() else vm.reset() }
    BackHandler(onBack = back)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ask Claude") },
                navigationIcon = {
                    IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    if (recipe != null) {
                        IconButton(onClick = {
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, recipe.title)
                                putExtra(Intent.EXTRA_TEXT, recipe.asText())
                            }
                            context.startActivity(Intent.createChooser(send, "Save recipe"))
                        }) { Icon(Icons.Default.Share, "Share recipe") }
                    }
                    IconButton(onClick = onOpenSettings) { Icon(Icons.Default.Settings, "Claude settings") }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                val mod = Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(16.dp)
                when {
                    recipe != null -> Button(
                        onClick = {
                            onAdd(selected, recipe.title.ifBlank { null })
                            vm.reset()
                        },
                        enabled = selected.isNotEmpty(),
                        modifier = mod,
                    ) { Text(if (selected.isEmpty()) "Nothing selected" else "Add ${selected.size} items to list") }
                    state is AskState.Working -> Unit
                    else -> Button(
                        onClick = { vm.ask(input) },
                        enabled = config.hasKey && input.isNotBlank(),
                        modifier = mod,
                    ) { Text("Ask Claude") }
                }
            }
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = padding) {
            when (val s = state) {
                AskState.Idle, is AskState.Failed -> {
                    if (!config.hasKey) {
                        item {
                            InfoCard(
                                "Add your Anthropic API key in Claude settings to start.",
                                action = "Open settings",
                                onAction = onOpenSettings,
                            )
                        }
                    }
                    if (s is AskState.Failed) {
                        item { InfoCard(s.message, error = true) }
                    }
                    item {
                        OutlinedTextField(
                            value = input,
                            onValueChange = onInputChange,
                            label = { Text("Ask for a DASH recipe, or paste a recipe or link") },
                            minLines = 4,
                            maxLines = 12,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                        Row(Modifier.padding(horizontal = 8.dp)) {
                            TextButton(onClick = { clipboard.getText()?.text?.let(onInputChange) }) {
                                Text("Paste from clipboard")
                            }
                            if (input.isNotEmpty()) TextButton(onClick = { onInputChange("") }) { Text("Clear") }
                        }
                    }
                    item {
                        FlowRow(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            suggestions.forEach { text ->
                                AssistChip(onClick = { onInputChange(text) }, label = { Text(text) })
                            }
                        }
                        Text(
                            "Uses ${config.model.label} with your API key. Recipes are written to fit the DASH diet; " +
                                "pasted recipes are kept as written, with DASH swaps suggested.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
                AskState.Working -> item {
                    Column(
                        Modifier.fillMaxWidth().padding(48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        CircularProgressIndicator()
                        Text("Claude is working on it. This can take up to a minute.")
                        TextButton(onClick = { vm.reset() }) { Text("Cancel") }
                    }
                }
                is AskState.Done -> {
                    val r = s.recipe
                    item { RecipeHeader(r) }
                    item {
                        Text(
                            "Ingredients. Untick anything you already have.",
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
                        )
                    }
                    itemsIndexed(parsed) { i, ing ->
                        val included = i !in excluded
                        val toggle = { excluded = if (included) excluded + i else excluded - i }
                        Row(
                            Modifier.fillMaxWidth().clickable(onClick = toggle).padding(horizontal = 4.dp),
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
                                Text(
                                    listOfNotNull(ing.category.label, ing.note).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                    if (r.steps.isNotEmpty()) {
                        item {
                            Text(
                                "Steps",
                                style = MaterialTheme.typography.titleSmall,
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
                            )
                        }
                        itemsIndexed(r.steps) { i, step ->
                            Text(
                                "${i + 1}. $step",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                            )
                        }
                    }
                    item {
                        TextButton(onClick = { vm.reset() }, modifier = Modifier.padding(8.dp)) {
                            Text("Ask something else")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecipeHeader(r: ClaudeRecipe) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(r.title.ifBlank { "Recipe" }, style = MaterialTheme.typography.headlineSmall)
        val facts = listOfNotNull(
            r.servings?.let { "Serves $it" },
            r.sodiumMgPerServing?.let { "~$it mg sodium per serving" },
        )
        if (facts.isNotEmpty()) Text(facts.joinToString(" · "), style = MaterialTheme.typography.labelLarge, color = muted)
        if (r.summary.isNotBlank()) Text(r.summary, style = MaterialTheme.typography.bodyMedium)
        if (r.dashNotes.isNotBlank() || r.swaps.isNotEmpty()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("DASH", style = MaterialTheme.typography.titleSmall)
                    if (r.dashNotes.isNotBlank()) Text(r.dashNotes, style = MaterialTheme.typography.bodyMedium)
                    r.swaps.forEach {
                        Text(
                            buildAnnotatedString {
                                append("Instead of ${it.insteadOf}, use ")
                                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(it.use) }
                                if (it.why.isNotBlank()) append(": ${it.why}")
                            },
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoCard(message: String, error: Boolean = false, action: String? = null, onAction: () -> Unit = {}) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (error) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant,
        ),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(message, style = MaterialTheme.typography.bodyMedium)
            if (action != null) TextButton(onClick = onAction) { Text(action) }
        }
    }
}
