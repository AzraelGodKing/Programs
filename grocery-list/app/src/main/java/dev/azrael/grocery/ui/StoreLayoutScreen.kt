package dev.azrael.grocery.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.data.StoreLayout

/** Put the list's sections in the order you walk your store, with an optional aisle label each. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StoreLayoutScreen(layout: StoreLayout, onBack: () -> Unit) {
    val order by layout.order.collectAsStateWithLifecycle()
    var menuOpen by remember { mutableStateOf(false) }
    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Store layout") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Reset to the usual order") },
                                onClick = { menuOpen = false; layout.resetOrder() },
                            )
                            DropdownMenuItem(
                                text = { Text("Forget items moved by hand (${order.remembered.size})") },
                                onClick = { menuOpen = false; layout.forgetRemembered() },
                                enabled = order.remembered.isNotEmpty(),
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().imePadding(), contentPadding = padding) {
            item {
                Text(
                    "Put the sections in the order you walk your store; the list follows it. " +
                        "Move an item to another section with its pencil and the app remembers it next time.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
            }
            itemsIndexed(order.sections, key = { _, c -> c.name }) { i, category ->
                // Typed locally so the cursor doesn't jump; every change is saved straight away.
                var aisle by remember(category) { mutableStateOf(order.aisles[category].orEmpty()) }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp).animateItem(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("${i + 1}. ${category.label}", style = MaterialTheme.typography.bodyLarge)
                    }
                    OutlinedTextField(
                        value = aisle,
                        onValueChange = { aisle = it.take(20); layout.setAisle(category, aisle) },
                        placeholder = { Text("Aisle") },
                        singleLine = true,
                        modifier = Modifier.width(110.dp).padding(vertical = 4.dp),
                    )
                    IconButton(onClick = { layout.move(i, i - 1) }, enabled = i > 0) {
                        Icon(Icons.Default.KeyboardArrowUp, "Move ${category.label} up")
                    }
                    IconButton(onClick = { layout.move(i, i + 1) }, enabled = i < order.sections.lastIndex) {
                        Icon(Icons.Default.KeyboardArrowDown, "Move ${category.label} down")
                    }
                }
                HorizontalDivider()
            }
        }
    }
}
