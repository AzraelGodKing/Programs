package dev.azrael.grocery.claude

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.parse.CabinetMatch
import dev.azrael.grocery.parse.NameKey

/**
 * Take or pick a photo, let Claude list what's in it, untick anything wrong, add the rest to the Cabinet.
 * [incomingReply] is a Claude app reply that was shared into Grocery List.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CabinetScanScreen(
    vm: CabinetScanViewModel,
    cabinetKeys: Set<String>,
    incomingReply: String?,
    onReplyConsumed: () -> Unit,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onAdd: (names: List<String>) -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val config by vm.settings.config.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var pendingCapture by rememberSaveable { mutableStateOf<String?>(null) }
    var pasted by rememberSaveable { mutableStateOf("") }

    val sendToApp: (android.net.Uri) -> Unit = { ClaudeApp.send(context, CabinetScan.CLAUDE_APP_PROMPT, it) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val uri = pendingCapture?.let(android.net.Uri::parse)
        pendingCapture = null
        if (saved && uri != null) vm.onPhoto(uri, sendToApp)
    }
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            // Picked photos belong to another app; copy into our cache so the Claude app can read it too.
            val copy = Photos.newCaptureUri(context)
            context.contentResolver.openInputStream(uri)?.use { input ->
                context.contentResolver.openOutputStream(copy)?.use { input.copyTo(it) }
            }
            vm.onPhoto(copy, sendToApp)
        }
    }
    fun capture() {
        val uri = Photos.newCaptureUri(context)
        pendingCapture = uri.toString()
        takePicture.launch(uri)
    }

    LaunchedEffect(incomingReply) {
        if (incomingReply != null) {
            vm.onReplyText(incomingReply)
            onReplyConsumed()
        }
    }

    val review = state as? ScanState.Review
    val alreadyHave = remember(review, cabinetKeys) {
        review?.items.orEmpty().map { CabinetMatch.find(NameKey.of(it), cabinetKeys) != null }
    }
    // Items already in the Cabinet start unticked; everything else starts ticked.
    var excluded by remember(review, alreadyHave) {
        mutableStateOf(alreadyHave.withIndex().filter { it.value }.map { it.index }.toSet())
    }
    val selected = review?.items.orEmpty().filterIndexed { i, _ -> i !in excluded }

    val back = { if (state is ScanState.Start) onBack() else vm.reset() }
    BackHandler(onBack = back)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan with Claude") },
                navigationIcon = { IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = { IconButton(onClick = onOpenSettings) { Icon(Icons.Default.Settings, "AI settings") } },
            )
        },
        bottomBar = {
            if (review != null) {
                Surface(tonalElevation = 3.dp) {
                    Button(
                        onClick = { onAdd(selected); vm.reset() },
                        enabled = selected.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(16.dp),
                    ) { Text(if (selected.isEmpty()) "Nothing selected" else "Add ${selected.size} to Cabinet") }
                }
            }
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = padding) {
            when (val s = state) {
                ScanState.Start, is ScanState.Failed -> {
                    if (s is ScanState.Failed) item { Note(s.message, error = true) }
                    item {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                "Take a photo of a shelf, the fridge or the counter. ${config.assistant} lists the groceries it can see, " +
                                    "you untick anything wrong, and the rest goes into your Cabinet.",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Button(onClick = { capture() }, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Default.PhotoCamera, null)
                                Text("  Take photo")
                            }
                            OutlinedButton(
                                onClick = {
                                    pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Icon(Icons.Default.PhotoLibrary, null)
                                Text("  Choose a photo")
                            }
                            Text(
                                if (config.onDevice) {
                                    "Uses Gemini Nano on this phone, free and offline. It misses or misnames more " +
                                        "items than Claude, so check the list."
                                } else if (config.usesApi) {
                                    "Uses ${config.model.label} with your API key."
                                } else {
                                    "Opens the Claude app with the photo and a prompt, using your Claude plan. " +
                                        "Share or copy Claude's reply back to Grocery List to review it."
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    if (!config.inApp) item { PasteReply(pasted, { pasted = it }, clipboard, vm) }
                }
                is ScanState.SentToApp -> {
                    item {
                        Note(
                            "Sent to the Claude app. When Claude answers, use Share → Grocery List on its reply, " +
                                "or copy the reply and paste it below.",
                        )
                    }
                    item { PasteReply(pasted, { pasted = it }, clipboard, vm) }
                    item {
                        TextButton(onClick = { sendToApp(s.photo) }, modifier = Modifier.padding(horizontal = 8.dp)) {
                            Text("Open the Claude app again")
                        }
                    }
                }
                ScanState.Working -> item {
                    Column(
                        Modifier.fillMaxWidth().padding(48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        CircularProgressIndicator()
                        Text("${config.assistant} is looking at the photo…")
                        TextButton(onClick = { vm.reset() }) { Text("Cancel") }
                    }
                }
                is ScanState.Review -> {
                    if (s.note.isNotBlank()) item { Note(s.note) }
                    item {
                        Text(
                            "${config.assistant} found ${s.items.size}. Untick anything that's wrong.",
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                    itemsIndexed(s.items) { i, name ->
                        val included = i !in excluded
                        val toggle = { excluded = if (included) excluded + i else excluded - i }
                        Row(
                            Modifier.fillMaxWidth().clickable(onClick = toggle).padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(checked = included, onCheckedChange = { toggle() })
                            Column(Modifier.padding(vertical = 6.dp)) {
                                Text(name, style = MaterialTheme.typography.bodyLarge)
                                if (alreadyHave.getOrElse(i) { false }) {
                                    Text(
                                        "Already in your Cabinet",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PasteReply(
    text: String,
    onChange: (String) -> Unit,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
    vm: CabinetScanViewModel,
) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = onChange,
            label = { Text("Claude's reply") },
            minLines = 3,
            maxLines = 10,
            modifier = Modifier.fillMaxWidth(),
        )
        Row {
            TextButton(onClick = { clipboard.getText()?.text?.let(onChange) }) { Text("Paste from clipboard") }
            TextButton(onClick = { vm.onReplyText(text); onChange("") }, enabled = text.isNotBlank()) { Text("Review items") }
        }
    }
}

@Composable
private fun Note(message: String, error: Boolean = false) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (error) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer,
        ),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(message, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(12.dp))
    }
}
