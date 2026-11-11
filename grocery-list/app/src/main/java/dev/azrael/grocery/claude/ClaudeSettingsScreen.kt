package dev.azrael.grocery.claude

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClaudeSettingsScreen(vm: AskClaudeViewModel, onBack: () -> Unit) {
    val config by vm.settings.config.collectAsStateWithLifecycle()
    val keyTest by vm.keyTest.collectAsStateWithLifecycle()
    var showKey by rememberSaveable { mutableStateOf(false) }
    val uri = LocalUriHandler.current
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("AI settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState()),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { vm.settings.setEnabled(!config.enabled) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Use AI", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Ask for DASH recipes, have pasted recipes read into your list, and scan photos into your " +
                            "Cabinet, with Claude or with Gemini Nano on this phone. " +
                            "When this is off, the app never contacts Anthropic and the AI buttons are hidden.",
                        style = MaterialTheme.typography.bodySmall,
                        color = muted,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Switch(checked = config.enabled, onCheckedChange = { vm.settings.setEnabled(it) })
            }
            HorizontalDivider()

            Text(
                "Connect with",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
            )
            ClaudeMode.entries.forEach { mode ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(
                            selected = config.mode == mode,
                            onClick = { vm.settings.setMode(mode); vm.clearKeyTest() },
                            role = Role.RadioButton,
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = config.mode == mode, onClick = null, modifier = Modifier.padding(8.dp))
                    Column {
                        Text(mode.label, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            when (mode) {
                                ClaudeMode.CLAUDE_APP ->
                                    "Uses the Pro or Max plan you already pay for. Requests open in the Claude app, " +
                                        "and you share Claude's reply back here. Anthropic doesn't allow other apps " +
                                        "to sign in with a Claude subscription, so this is the supported way."
                                ClaudeMode.API_KEY ->
                                    "Everything happens inside this app in one tap. Needs an API key from the " +
                                        "Anthropic Console, billed per use (a recipe is a few cents, a photo scan " +
                                        "less than that)."
                                ClaudeMode.ON_DEVICE ->
                                    "Google's small AI model built into Android on supported phones (Galaxy S25 " +
                                        "and S26, Pixel 9 and later). Free, works offline, nothing leaves the " +
                                        "phone. Much less capable than Claude: it can't open links, and its " +
                                        "recipes and photo lists need more checking."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = muted,
                        )
                    }
                }
            }

            if (config.onDevice) {
                NanoSection(vm)
            }

            if (config.usesApi) {
                Text(
                    "API key",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp),
                )
                Text(
                    "Uses your own Anthropic API key, billed to your account. The key is stored only on this phone " +
                        "and left out of backups.",
                    style = MaterialTheme.typography.bodySmall,
                    color = muted,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
                OutlinedTextField(
                    value = config.apiKey,
                    onValueChange = { vm.settings.setApiKey(it); vm.clearKeyTest() },
                    label = { Text("sk-ant-…") },
                    singleLine = true,
                    visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                    trailingIcon = {
                        IconButton(onClick = { showKey = !showKey }) {
                            Icon(
                                if (showKey) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                if (showKey) "Hide key" else "Show key",
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                )
                Row(
                    Modifier.padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = { uri.openUri("https://console.anthropic.com/settings/keys") }) {
                        Text("Get a key")
                    }
                    if (config.hasKey) {
                        TextButton(onClick = { vm.settings.setApiKey(""); vm.clearKeyTest() }) { Text("Remove key") }
                    }
                }
                Row(
                    Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedButton(
                        onClick = { vm.testKey() },
                        enabled = config.hasKey && keyTest !is KeyTestState.Testing,
                    ) { Text("Test key") }
                    Spacer(Modifier.width(12.dp))
                    when (val t = keyTest) {
                        KeyTestState.Idle -> Unit
                        KeyTestState.Testing -> CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        KeyTestState.Ok -> Text("Key works", color = MaterialTheme.colorScheme.primary)
                        is KeyTestState.Failed -> Text(t.message, color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall)
                    }
                }

                Text(
                    "Model",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 4.dp),
                )
                ClaudeModel.entries.forEach { model ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = config.model == model,
                                onClick = { vm.settings.setModel(model); vm.clearKeyTest() },
                                role = Role.RadioButton,
                            )
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = config.model == model, onClick = null, modifier = Modifier.padding(8.dp))
                        Column {
                            Text(model.label, style = MaterialTheme.typography.bodyLarge)
                            Text(model.blurb, style = MaterialTheme.typography.bodySmall, color = muted)
                        }
                    }
                }
            }
            Spacer(Modifier.size(24.dp))
        }
    }
}

@Composable
private fun NanoSection(vm: AskClaudeViewModel) {
    val status by vm.nanoStatus.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.checkNano() }

    Text(
        "Gemini Nano",
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
    )
    Column(Modifier.padding(horizontal = 16.dp)) {
        val muted = MaterialTheme.colorScheme.onSurfaceVariant
        when (val s = status) {
            NanoStatus.Checking -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(12.dp))
                Text("Checking this phone…")
            }
            NanoStatus.Ready -> Text("Ready on this phone.", color = MaterialTheme.colorScheme.primary)
            NanoStatus.Downloadable -> {
                Text(
                    "Supported on this phone, but the model needs a one-time download (Android shares it " +
                        "between apps). Wi-Fi recommended.",
                    style = MaterialTheme.typography.bodySmall,
                    color = muted,
                )
                OutlinedButton(onClick = { vm.downloadNano() }, modifier = Modifier.padding(top = 4.dp)) {
                    Text("Download Gemini Nano")
                }
            }
            is NanoStatus.Downloading -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(12.dp))
                Text(
                    if (s.total > 0) {
                        "Downloading… ${s.downloaded * 100 / s.total}%"
                    } else {
                        "Downloading… Android may finish this in the background."
                    },
                )
            }
            NanoStatus.Unavailable -> Text(
                GeminiNano.UNAVAILABLE,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
            is NanoStatus.Failed -> Text(s.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
        if (status is NanoStatus.Unavailable || status is NanoStatus.Failed || status is NanoStatus.Downloading) {
            TextButton(onClick = { vm.checkNano() }) { Text("Check again") }
        }
        Text(
            "Only works while Grocery List is on screen, and Android limits how much each app can use per day.",
            style = MaterialTheme.typography.bodySmall,
            color = muted,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
