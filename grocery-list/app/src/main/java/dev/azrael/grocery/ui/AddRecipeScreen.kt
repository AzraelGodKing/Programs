package dev.azrael.grocery.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
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
import dev.azrael.grocery.parse.IngredientParser
import dev.azrael.grocery.parse.ParsedIngredient
import dev.azrael.grocery.parse.formatAmount

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AddRecipeScreen(
    text: String,
    onTextChange: (String) -> Unit,
    onBack: () -> Unit,
    onAdd: (ingredients: List<ParsedIngredient>, source: String?) -> Unit,
    /** Hands the pasted text to Claude instead of the built-in parser. Null hides the button (Claude off). */
    onReadWithClaude: ((String) -> Unit)? = null,
) {
    var title by rememberSaveable { mutableStateOf("") }
    val parsed = remember(text) { IngredientParser.parseRecipe(text) }
    // Indexes the user unticked (e.g. pantry staples they already have). Reset when the text changes.
    var excluded by remember(text) { mutableStateOf(emptySet<Int>()) }
    val selected = parsed.filterIndexed { i, _ -> i !in excluded }
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
                FlowRow(Modifier.padding(horizontal = 8.dp)) {
                    TextButton(onClick = {
                        clipboard.getText()?.text?.let { onTextChange(it) }
                    }) { Text("Paste from clipboard") }
                    if (text.isNotEmpty()) {
                        TextButton(onClick = { onTextChange("") }) { Text("Clear") }
                    }
                    if (onReadWithClaude != null && text.isNotBlank()) {
                        TextButton(onClick = { onReadWithClaude(text) }) { Text("Read with Claude") }
                    }
                }
            }
            if (parsed.isNotEmpty()) {
                item {
                    Text(
                        "Found ${parsed.size} ingredients. Untick anything you already have.",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
            itemsIndexed(parsed) { i, ing ->
                val included = i !in excluded
                val toggle = { excluded = if (included) excluded + i else excluded - i }
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
                            listOfNotNull(ing.category.label, ing.note).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
