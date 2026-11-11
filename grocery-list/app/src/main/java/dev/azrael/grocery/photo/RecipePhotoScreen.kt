package dev.azrael.grocery.photo

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.azrael.grocery.claude.ClaudeApp
import dev.azrael.grocery.claude.Photos

/**
 * Take or pick a photo of a recipe, get it as English text, check it, then hand it to Add recipe.
 * [incomingReply] is a Claude app reply that was shared into Grocery List.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipePhotoScreen(
    vm: RecipePhotoViewModel,
    incomingReply: String?,
    onReplyConsumed: () -> Unit,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    /** The checked text, in English, to parse on Add recipe. */
    onUse: (String) -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val config by vm.settings.config.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var pendingCapture by rememberSaveable { mutableStateOf<String?>(null) }
    var useAi by rememberSaveable { mutableStateOf(true) }
    var scriptName by rememberSaveable { mutableStateOf(OnDeviceReader.defaultScript().name) }
    val script = Script.valueOf(scriptName)
    var pasted by rememberSaveable { mutableStateOf("") }
    val aiOn = config.enabled && useAi

    val sendToApp: (Uri) -> Unit = { ClaudeApp.send(context, RecipePhoto.CLAUDE_APP_PROMPT, it) }
    val onPhoto: (Uri) -> Unit = { vm.onPhoto(it, useAi = aiOn, script = script, sendToApp = sendToApp) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val uri = pendingCapture?.let(Uri::parse)
        pendingCapture = null
        if (saved && uri != null) onPhoto(uri)
    }
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            // Picked photos belong to another app; copy into our cache so the Claude app can read it too.
            val copy = Photos.newCaptureUri(context)
            context.contentResolver.openInputStream(uri)?.use { input ->
                context.contentResolver.openOutputStream(copy)?.use { input.copyTo(it) }
            }
            onPhoto(copy)
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

    val review = state as? PhotoState.Review
    // The text being checked; reset whenever a new reading arrives.
    var edited by rememberSaveable(review?.reading) { mutableStateOf(review?.reading?.text.orEmpty()) }
    var showOriginal by rememberSaveable(review?.reading) { mutableStateOf(false) }

    val back = { if (state is PhotoState.Start) onBack() else vm.reset() }
    BackHandler(onBack = back)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recipe from a photo") },
                navigationIcon = { IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = {
                    if (config.enabled) {
                        IconButton(onClick = onOpenSettings) { Icon(Icons.Default.Settings, "AI settings") }
                    }
                },
            )
        },
        bottomBar = {
            if (review != null) {
                Surface(tonalElevation = 3.dp) {
                    Button(
                        onClick = { onUse(edited.trim()); vm.reset() },
                        enabled = edited.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(16.dp),
                    ) { Text("Use this recipe") }
                }
            }
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = padding) {
            when (val s = state) {
                PhotoState.Start, is PhotoState.Failed -> {
                    if (s is PhotoState.Failed) {
                        item { Note(s.message, error = true) }
                        if (s.photo != null) {
                            item {
                                Row(Modifier.padding(horizontal = 8.dp)) {
                                    TextButton(onClick = { vm.readOnDevice(s.photo, script) }) {
                                        Text(if (aiOn) "Read it on the phone instead" else "Try again")
                                    }
                                }
                            }
                        }
                    }
                    item {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                "Take a photo of a cookbook page, recipe card or handwritten recipe. Grocery List copies " +
                                    "out the text, translates it into English if it's in another language, and lets you " +
                                    "check it before it goes to Add recipe, where you can save it to the recipe box or " +
                                    "add the ingredients to your list.",
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
                        }
                    }
                    if (config.enabled) {
                        item {
                            Row(
                                Modifier.fillMaxWidth().clickable { useAi = !useAi }.padding(horizontal = 16.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text("Read with ${config.assistant}", style = MaterialTheme.typography.bodyLarge)
                                    Text(
                                        when {
                                            !useAi -> "Off: reads and translates on the phone with Google's free text reader."
                                            config.onDevice -> "Gemini Nano on this phone, free and offline. Better with handwriting than the plain reader; check what it copies."
                                            config.usesApi -> "Uses ${config.model.label} with your API key. Best with handwriting and odd layouts."
                                            else -> "Opens the Claude app with the photo, using your plan. Share or copy Claude's reply back here."
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                Switch(checked = useAi, onCheckedChange = { useAi = it })
                            }
                        }
                    }
                    if (!aiOn) item { ScriptPicker(script) { scriptName = it.name } }
                    if (!aiOn) {
                        item {
                            Text(
                                "Runs on the phone for free. Each language's translation downloads once (about 30 MB), " +
                                    "then works offline. Printed recipes read best; handwriting is hit and miss" +
                                    if (config.enabled) ", so turn on Read with ${config.assistant} for those." else ".",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                        }
                    }
                    if (aiOn && !config.inApp) item { PasteReply(pasted, { pasted = it }, clipboard, vm) }
                }
                is PhotoState.SentToApp -> {
                    item {
                        Note(
                            "Sent to the Claude app. When Claude answers, use Share → Grocery List on its reply, " +
                                "or copy the reply and paste it below.",
                        )
                    }
                    item { PasteReply(pasted, { pasted = it }, clipboard, vm) }
                    item {
                        Row(Modifier.padding(horizontal = 8.dp)) {
                            TextButton(onClick = { sendToApp(s.photo) }) { Text("Open the Claude app again") }
                            TextButton(onClick = { vm.readOnDevice(s.photo, script) }) { Text("Read it on the phone") }
                        }
                    }
                }
                is PhotoState.Working -> item {
                    Column(
                        Modifier.fillMaxWidth().padding(48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        CircularProgressIndicator()
                        Text(s.step)
                        TextButton(onClick = { vm.reset() }) { Text("Cancel") }
                    }
                }
                is PhotoState.Review -> {
                    val r = s.reading
                    item {
                        Note(
                            buildString {
                                if (r.fromLanguage != null) {
                                    append("Translated from ${r.fromLanguage}")
                                    append(if (s.byAi) " by ${config.assistant}. " else " on the phone. ")
                                } else if (s.byAi) {
                                    append("Copied by ${config.assistant}. ")
                                }
                                append("Check the amounts and fix anything misread, then tap Use this recipe.")
                                if (r.note.isNotBlank()) append("\n\n").append(r.note)
                            },
                        )
                    }
                    if (!s.byAi && r.original != null) {
                        item { LanguagePicker(r.fromLanguage, onPick = vm::translateFrom) }
                    }
                    item {
                        OutlinedTextField(
                            value = edited,
                            onValueChange = { edited = it },
                            label = { Text(if (r.fromLanguage != null) "Recipe (English)" else "Recipe") },
                            minLines = 8,
                            modifier = Modifier.fillMaxWidth().heightIn(max = 520.dp).padding(horizontal = 16.dp),
                        )
                    }
                    if (r.original != null && r.fromLanguage != null) {
                        item {
                            TextButton(onClick = { showOriginal = !showOriginal }, modifier = Modifier.padding(horizontal = 8.dp)) {
                                Text(if (showOriginal) "Hide the original" else "Show the original ${r.fromLanguage}")
                            }
                        }
                        if (showOriginal) {
                            item {
                                Text(
                                    r.original,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScriptPicker(script: Script, onPick: (Script) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    Box(Modifier.padding(horizontal = 8.dp)) {
        TextButton(onClick = { open = true }) { Text("Alphabet: ${script.label}") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Script.entries.forEach {
                DropdownMenuItem(text = { Text(it.label) }, onClick = { onPick(it); open = false })
            }
        }
    }
}

@Composable
private fun LanguagePicker(current: String?, onPick: (String) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    Box(Modifier.padding(horizontal = 8.dp)) {
        TextButton(onClick = { open = true }) {
            Text("Written in: ${current ?: "English"} · change")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text("English (don't translate)") }, onClick = {
                onPick(RecipePhotoViewModel.ENGLISH); open = false
            })
            OnDeviceReader.translatableLanguages.forEach { (tag, name) ->
                DropdownMenuItem(text = { Text(name) }, onClick = { onPick(tag); open = false })
            }
        }
    }
}

@Composable
private fun PasteReply(
    text: String,
    onChange: (String) -> Unit,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
    vm: RecipePhotoViewModel,
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
            TextButton(onClick = { vm.onReplyText(text); onChange("") }, enabled = text.isNotBlank()) { Text("Check the recipe") }
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
