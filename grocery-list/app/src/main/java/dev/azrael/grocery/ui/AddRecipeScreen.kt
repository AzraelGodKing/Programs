package dev.azrael.grocery.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import dev.azrael.grocery.parse.CabinetMatch
import dev.azrael.grocery.parse.IngredientParser
import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.ParsedIngredient
import dev.azrael.grocery.parse.formatAmount

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddRecipeScreen(
    text: String,
    /** NameKey keys of what's in the Cabinet; matching lines start unticked. */
    cabinetKeys: Set<String>,
    onTextChange: (String) -> Unit,
    onBack: () -> Unit,
    onAdd: (ingredients: List<ParsedIngredient>, source: String?) -> Unit,
) {
    var title by rememberSaveable { mutableStateOf("") }
    val parsed = remember(text) { IngredientParser.parseRecipe(text) }
    // Lines already in the Cabinet start unticked. The Cabinet loads async, so keep it live
    // and store only what the user changed by hand (index -> included). Reset when the text changes.
    val inCabinet = remember(parsed, cabinetKeys) {
        parsed.map { CabinetMatch.find(NameKey.of(it.name), cabinetKeys) != null }
    }
    var overrides by remember(text) { mutableStateOf(emptyMap<Int, Boolean>()) }
    fun isIncluded(i: Int) = overrides[i] ?: !inCabinet[i]
    val selected = parsed.filterIndexed { i, _ -> isIncluded(i) }
    val skippedFromCabinet = parsed.indices.count { inCabinet[it] && !isIncluded(it) }
    val clipboard = LocalClipboardManager.current

    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add recipe") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Button(
                    onClick = { onAdd(selected, title.trim().ifEmpty { null }) },
                    enabled = selected.isNotEmpty(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                        .padding(16.dp),
                ) {
                    Text(if (selected.isEmpty()) "Nothing to add yet" else "Add ${selected.size} items to list")
                }
            }
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = padding) {
            item {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Recipe name (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            item {
                OutlinedTextField(
                    value = text,
                    onValueChange = onTextChange,
                    label = { Text("Paste the recipe or its ingredient list") },
                    minLines = 6,
                    maxLines = 14,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                )
                Row(Modifier.padding(horizontal = 8.dp)) {
                    TextButton(onClick = {
                        clipboard.getText()?.text?.let { onTextChange(it) }
                    }) { Text("Paste from clipboard") }
                    if (text.isNotEmpty()) {
                        TextButton(onClick = { onTextChange("") }) { Text("Clear") }
                    }
                }
            }
            if (parsed.isNotEmpty()) {
                item {
                    Text(
                        buildString {
                            append("Found ${parsed.size} ingredients. ")
                            if (skippedFromCabinet > 0) {
                                append("$skippedFromCabinet already in your Cabinet, so they start unticked. ")
                            }
                            append("Untick anything else you already have.")
                        },
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
            itemsIndexed(parsed) { i, ing ->
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
                        Text(
                            listOfNotNull(
                                ing.category.label,
                                ing.note,
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
