package dev.azrael.grocery.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import dev.azrael.grocery.data.GroceryItem
import dev.azrael.grocery.parse.Category
import dev.azrael.grocery.parse.Quantities
import dev.azrael.grocery.parse.Units

/**
 * Add/edit dialog. [onSave] gets a null category when the user left it on "Auto"
 * (only offered for new items) so the app picks the store section itself.
 */
@Composable
fun ItemDialog(
    initial: GroceryItem?,
    onDismiss: () -> Unit,
    onSave: (name: String, quantity: Double?, unit: String?, category: Category?, note: String?) -> Unit,
) {
    var name by remember { mutableStateOf(initial?.name.orEmpty()) }
    var qty by remember { mutableStateOf(initial?.quantity?.let { Quantities.format(it) }.orEmpty()) }
    var unit by remember { mutableStateOf(initial?.unit.orEmpty()) }
    var note by remember { mutableStateOf(initial?.note.orEmpty()) }
    var category by remember { mutableStateOf(initial?.categoryEnum) }
    var pickerOpen by remember { mutableStateOf(false) }

    val parsedQty = qty.trim().takeIf { it.isNotEmpty() }?.let { Quantities.parse(Quantities.normalizeFractions(it)) }
    val qtyInvalid = qty.isNotBlank() && parsedQty == null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "Add item" else "Edit item") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Item") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = qty,
                        onValueChange = { qty = it },
                        label = { Text("Qty") },
                        placeholder = { Text("1 1/2") },
                        isError = qtyInvalid,
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("Unit") },
                        placeholder = { Text("cups") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                }
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Box {
                    OutlinedButton(onClick = { pickerOpen = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Section: ${category?.label ?: "Auto"}")
                    }
                    DropdownMenu(expanded = pickerOpen, onDismissRequest = { pickerOpen = false }) {
                        if (initial == null) {
                            DropdownMenuItem(text = { Text("Auto") }, onClick = { category = null; pickerOpen = false })
                        }
                        Category.entries.forEach { c ->
                            DropdownMenuItem(text = { Text(c.label) }, onClick = { category = c; pickerOpen = false })
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && !qtyInvalid,
                onClick = {
                    val u = unit.trim().takeIf { it.isNotEmpty() }?.let { Units.lookup(it) ?: it }
                    onSave(name.trim(), parsedQty, u, category, note.trim().ifEmpty { null })
                },
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
