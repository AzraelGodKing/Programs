package dev.azrael.grocery.barcode

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.azrael.grocery.nutrition.Dash
import dev.azrael.grocery.tracker.LogFoodDialog
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Scan a product's barcode, look up its label on Open Food Facts, flag how salty it is for DASH,
 * and add it to the Cabinet or log a serving in the sodium tracker.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BarcodeScreen(
    vm: BarcodeViewModel,
    sodiumLimit: Int,
    onBack: () -> Unit,
    onLogServing: (name: String, sodiumPerServing: Int, potassiumPerServing: Int?, servings: Double) -> Unit,
) {
    val state by vm.state.collectAsState()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var typed by rememberSaveable { mutableStateOf("") }
    var logging by remember { mutableStateOf<ScannedProduct?>(null) }
    // Open the camera straight away the first time; after that the user asks for it.
    var autoStarted by rememberSaveable { mutableStateOf(false) }

    fun startScan() = BarcodeScanner.scan(
        context,
        onResult = vm::lookup,
        onCancel = {},
        onError = vm::scanFailed,
    )

    LaunchedEffect(Unit) {
        if (!autoStarted) {
            autoStarted = true
            vm.reset()
            startScan()
        }
    }

    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan a barcode") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when (val s = state) {
                BarcodeState.Idle -> Text(
                    "Point the camera at the barcode on a package. Sodium comes from the label data on " +
                        "Open Food Facts, a free food database.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                is BarcodeState.Looking -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator(Modifier.padding(4.dp))
                    Text("Looking up ${s.barcode}…", modifier = Modifier.padding(top = 12.dp))
                }
                is BarcodeState.Found -> ProductCard(
                    product = s.product,
                    sodiumLimit = sodiumLimit,
                    added = s.added,
                    onAdd = {
                        vm.addToCabinet(s.product)
                        scope.launch { snackbar.showSnackbar("${s.product.name} added to the Cabinet") }
                    },
                    onLog = { logging = s.product },
                )
                is BarcodeState.NotFound -> ManualProduct(
                    barcode = s.barcode,
                    onAdd = { product ->
                        vm.addToCabinet(product)
                        scope.launch { snackbar.showSnackbar("${product.name} added to the Cabinet") }
                    },
                )
                is BarcodeState.Failed -> Text(s.message, color = MaterialTheme.colorScheme.error)
            }

            Button(onClick = { startScan() }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.QrCodeScanner, null)
                Text(if (state == BarcodeState.Idle) "  Scan" else "  Scan another", fontWeight = FontWeight.SemiBold)
            }
            OutlinedTextField(
                value = typed,
                onValueChange = { typed = it.filter(Char::isDigit) },
                label = { Text("Or type the barcode number") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { if (typed.isNotBlank()) vm.lookup(typed) }),
                trailingIcon = {
                    TextButton(onClick = { vm.lookup(typed) }, enabled = typed.length >= 8) { Text("Look up") }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    logging?.let { p ->
        LogFoodDialog(
            onDismiss = { logging = null },
            onLog = { name, na, k, servings ->
                logging = null
                onLogServing(name, na, k, servings)
                scope.launch { snackbar.showSnackbar("Logged ${Dash.mg((na * servings).roundToInt())} mg sodium") }
            },
            initialName = p.displayName,
            initialSodium = p.sodiumMgPerServing,
            initialPotassium = p.potassiumMgPerServing,
            servingLabel = p.servingSize,
        )
    }
}

@Composable
fun SodiumLevelChip(level: SodiumLevel) {
    val (container, text) = sodiumLevelColors(level)
    AssistChip(
        onClick = {},
        label = { Text(level.label) },
        colors = AssistChipDefaults.assistChipColors(containerColor = container, labelColor = text),
        border = null,
    )
}

@Composable
fun sodiumLevelColors(level: SodiumLevel): Pair<Color, Color> = when (level) {
    SodiumLevel.HIGH -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
    SodiumLevel.MODERATE -> Color(0xFFFFE0B2) to Color(0xFF5D3A00)
    SodiumLevel.LOW -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
}

@Composable
private fun ProductCard(
    product: ScannedProduct,
    sodiumLimit: Int,
    added: Boolean,
    onAdd: () -> Unit,
    onLog: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleLarge)
            product.brand?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            product.sodiumLevel?.let { SodiumLevelChip(it) }
            val perServing = product.sodiumMgPerServing
            when {
                perServing != null -> {
                    Text(
                        "${Dash.mg(perServing)} mg sodium per serving" + (product.servingSize?.let { " ($it)" } ?: ""),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        "That's ${(perServing * 100f / sodiumLimit).roundToInt()}% of your ${Dash.mg(sodiumLimit)} mg day.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                product.sodiumMgPer100g != null -> Text(
                    "${Dash.mg(product.sodiumMgPer100g)} mg sodium per 100 g (no serving size listed)",
                    style = MaterialTheme.typography.titleMedium,
                )
                else -> Text(
                    "No sodium listed for this product. Check the label.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            product.potassiumMgPerServing?.let {
                Text("${Dash.mg(it)} mg potassium per serving", style = MaterialTheme.typography.bodyMedium)
            }
            if (product.sodiumLevel == SodiumLevel.HIGH) {
                Text(
                    "High for DASH. Look for a low-sodium or no-salt-added version, or rinse it if it's canned.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
                Button(onClick = onAdd, enabled = !added) { Text(if (added) "In the Cabinet" else "Add to Cabinet") }
                OutlinedButton(onClick = onLog) { Text("Log a serving") }
            }
        }
    }
}

/** For a barcode Open Food Facts doesn't know: type the name and label sodium yourself. */
@Composable
private fun ManualProduct(barcode: String, onAdd: (ScannedProduct) -> Unit) {
    var name by rememberSaveable(barcode) { mutableStateOf("") }
    var sodium by rememberSaveable(barcode) { mutableStateOf("") }
    var serving by rememberSaveable(barcode) { mutableStateOf("") }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("$barcode isn't in Open Food Facts yet", style = MaterialTheme.typography.titleMedium)
            Text(
                "Type what's on the label and it goes in the Cabinet with its sodium flag.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Product name") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = sodium,
                onValueChange = { sodium = it.filter(Char::isDigit) },
                label = { Text("Sodium per serving (mg, optional)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = serving,
                onValueChange = { serving = it },
                label = { Text("Serving size (optional)") },
                placeholder = { Text("1/2 cup (130 g)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    onAdd(
                        ScannedProduct(
                            barcode = barcode,
                            name = name.trim(),
                            servingSize = serving.trim().ifEmpty { null },
                            sodiumMgPerServing = sodium.toIntOrNull(),
                        ),
                    )
                },
                enabled = name.isNotBlank(),
            ) { Text("Add to Cabinet") }
        }
    }
}
