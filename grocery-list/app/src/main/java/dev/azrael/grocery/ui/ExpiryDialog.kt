package dev.azrael.grocery.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.azrael.grocery.data.CabinetItem
import dev.azrael.grocery.parse.Expiry
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** Sets or clears a Cabinet item's expiry date. [onSave] gets an epoch day, or null to clear it. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ExpiryDialog(item: CabinetItem, onDismiss: () -> Unit, onSave: (Long?) -> Unit) {
    val today = LocalDate.now()
    var calendarOpen by remember { mutableStateOf(false) }

    if (calendarOpen) {
        // The date picker works in UTC midnight millis.
        val start = item.expiresOn ?: (today.toEpochDay() + 7)
        val state = rememberDatePickerState(initialSelectedDateMillis = start * MILLIS_PER_DAY)
        DatePickerDialog(
            onDismissRequest = { calendarOpen = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        state.selectedDateMillis?.let {
                            onSave(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toEpochDay())
                        }
                    },
                    enabled = state.selectedDateMillis != null,
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { calendarOpen = false }) { Text("Cancel") } },
        ) {
            DatePicker(state = state)
        }
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("When does ${item.name} expire?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item.expiresOn?.let {
                    Text(
                        Expiry.label(it, today),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Expiry.QUICK_PICKS.forEach { (label, days) ->
                        AssistChip(
                            onClick = { onSave(today.toEpochDay() + days) },
                            label = { Text(label) },
                        )
                    }
                }
                OutlinedButton(onClick = { calendarOpen = true }) {
                    Icon(Icons.Default.CalendarMonth, null)
                    Text("Pick a date", modifier = Modifier.padding(start = 8.dp))
                }
                Text(
                    "You'll get a reminder in the morning when it's two days out.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        dismissButton = if (item.expiresOn != null) {
            { TextButton(onClick = { onSave(null) }) { Text("Remove date") } }
        } else {
            null
        },
    )
}

private const val MILLIS_PER_DAY = 86_400_000L
