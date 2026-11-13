package dev.azrael.grocery.reel

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import dev.azrael.grocery.claude.ClaudeAppPrompts

/**
 * A Facebook reel shared into the app: shows the caption it found (editable), then hands it to the AI to
 * find the recipe. When there's no caption, the user can paste it or switch to a screenshot.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReelScreen(
    vm: ReelViewModel,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    /** API key / Gemini Nano: run the request and show the result on the Ask screen. */
    onAskInApp: (request: String) -> Unit,
    /** AI off: the text goes to Add recipe as it is. */
    onUseText: (String) -> Unit,
    /** Read a screenshot of the recipe from the video instead. */
    onScreenshot: () -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val config by vm.settings.config.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val ready = state as? ReelState.Ready
    var caption by rememberSaveable(ready) { mutableStateOf(ready?.caption.orEmpty()) }
    val link = ready?.link ?: (state as? ReelState.Loading)?.link
    var showPage by rememberSaveable { mutableStateOf(false) }

    if (showPage && link != null) {
        ReelPage(
            link = link,
            onText = { text ->
                if (text.isNotBlank()) caption = text
                showPage = false
            },
            onClose = { showPage = false },
        )
        return
    }

    val back = { vm.reset(); onBack() }
    BackHandler(onBack = back)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recipe from a reel") },
                navigationIcon = { IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = {
                    if (config.enabled) {
                        IconButton(onClick = onOpenSettings) { Icon(Icons.Default.Settings, "AI settings") }
                    }
                },
            )
        },
        bottomBar = {
            if (ready != null) {
                Surface(tonalElevation = 3.dp) {
                    val mod = Modifier.fillMaxWidth().navigationBarsPadding().imePadding().padding(16.dp)
                    val text = caption.trim()
                    when {
                        !config.enabled -> Button(onClick = { onUseText(text) }, enabled = text.isNotEmpty(), modifier = mod) {
                            Text("Use this text")
                        }
                        config.inApp -> Button(
                            onClick = { onAskInApp(SharedReel.aiRequest(link, text)) },
                            enabled = text.isNotEmpty(),
                            modifier = mod,
                        ) { Text("Find the recipe with ${config.assistant}") }
                        else -> Button(
                            onClick = { ClaudeApp.send(context, ClaudeAppPrompts.recipe(SharedReel.aiRequest(link, text))) },
                            enabled = text.isNotEmpty(),
                            modifier = mod,
                        ) { Text("Find the recipe in the Claude app") }
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = padding) {
            when (val s = state) {
                ReelState.Empty -> item {
                    Note("Share a Facebook reel to Grocery List from Facebook's Share button to find its recipe.")
                }
                is ReelState.Loading -> item {
                    Column(
                        Modifier.fillMaxWidth().padding(48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        CircularProgressIndicator()
                        Text("Getting the reel's caption…")
                    }
                }
                is ReelState.Ready -> {
                    if (s.problem != null) {
                        item {
                            Note(
                                s.problem + " Open the reel here and sign in to Facebook once to read its caption " +
                                    "and comments, paste the caption below, or take a screenshot of the recipe in " +
                                    "the video and use Read a screenshot.",
                                error = true,
                            )
                        }
                    } else {
                        item {
                            Note(
                                if (config.enabled) {
                                    "This is the reel's caption. AI can't watch the video, so it finds the recipe in " +
                                        "this text and fills in typical amounts if the caption leaves them out. If the " +
                                        "recipe is in the comments, use Read the comments; if it's only shown in the " +
                                        "video, use Read a screenshot."
                                } else {
                                    "This is the reel's caption. Turn on AI in AI settings to have it find the recipe " +
                                        "and suggest DASH swaps, or use the text as it is."
                                },
                            )
                        }
                    }
                    item {
                        OutlinedTextField(
                            value = caption,
                            onValueChange = { caption = it },
                            label = { Text("Caption or recipe text") },
                            minLines = 6,
                            modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp).padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                        Row(Modifier.padding(horizontal = 8.dp)) {
                            TextButton(onClick = { clipboard.getText()?.text?.let { caption = it } }) {
                                Text("Paste from clipboard")
                            }
                            if (caption.isNotEmpty()) TextButton(onClick = { caption = "" }) { Text("Clear") }
                        }
                    }
                    item {
                        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (s.link != null) {
                                OutlinedButton(onClick = { showPage = true }, modifier = Modifier.fillMaxWidth()) {
                                    Icon(Icons.Default.Forum, null)
                                    Text(if (s.problem != null) "  Open the reel here" else "  Read the comments")
                                }
                            }
                            OutlinedButton(onClick = onScreenshot, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Default.PhotoLibrary, null)
                                Text("  Read a screenshot instead")
                            }
                            if (s.link != null) {
                                TextButton(onClick = {
                                    try {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(s.link)))
                                    } catch (e: ActivityNotFoundException) {
                                        // No app can open the link; nothing to do.
                                    }
                                }) { Text("Open in the Facebook app") }
                            }
                        }
                    }
                    if (config.enabled && !config.inApp) {
                        item {
                            Text(
                                "Opens the Claude app with the caption and a DASH prompt. Share Claude's reply back " +
                                    "to Grocery List to save it or add the ingredients.",
                                style = MaterialTheme.typography.bodySmall,
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
