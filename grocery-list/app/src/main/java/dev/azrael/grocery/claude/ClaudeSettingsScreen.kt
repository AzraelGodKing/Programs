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
                title = { Text("Claude settings") },
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
                    Text("Use Claude", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Ask Claude for DASH recipes and have it read recipes or links into your list. " +
                            "When this is off, the app never contacts Anthropic and the Claude buttons are hidden.",
                        style = MaterialTheme.typography.bodySmall,
                        color = muted,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Switch(checked = config.enabled, onCheckedChange = { vm.settings.setEnabled(it) })
            }
            HorizontalDivider()

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
            Spacer(Modifier.size(24.dp))
        }
    }
}
