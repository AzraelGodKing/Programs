package dev.azrael.grocery.update

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.util.Locale

/** Shows whichever step of the update flow we're in; nothing for Idle/Checking. */
@Composable
fun UpdateDialog(state: UpdateState, currentBuild: Int, vm: UpdateViewModel) {
    when (state) {
        UpdateState.Idle, UpdateState.Checking -> Unit
        UpdateState.UpToDate -> AlertDialog(
            onDismissRequest = vm::dismiss,
            title = { Text("You're up to date") },
            text = { Text("Build $currentBuild is the newest one.") },
            confirmButton = { TextButton(onClick = vm::dismiss) { Text("OK") } },
        )
        is UpdateState.Available -> AlertDialog(
            onDismissRequest = vm::dismiss,
            title = { Text("Update available") },
            text = {
                val mb = String.format(Locale.US, "%.1f", state.update.sizeBytes / 1_048_576.0)
                Text("Build ${state.update.build} is out (you have build $currentBuild). Download it now? It's about $mb MB. Your list is kept.")
            },
            confirmButton = { TextButton(onClick = { vm.download(state.update) }) { Text("Download") } },
            dismissButton = { TextButton(onClick = vm::dismiss) { Text("Later") } },
        )
        is UpdateState.Downloading -> AlertDialog(
            onDismissRequest = {},
            title = { Text("Downloading build ${state.update.build}") },
            text = {
                Column {
                    LinearProgressIndicator(progress = { state.progress }, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    Text("${(state.progress * 100).toInt()}%")
                }
            },
            confirmButton = {},
        )
        is UpdateState.ReadyToInstall -> AlertDialog(
            onDismissRequest = vm::dismiss,
            title = { Text("Ready to install") },
            text = {
                Text(
                    "Tap Install and confirm on Android's screen. If Android asks first, allow " +
                        "Grocery List to install apps, then come back and tap Install again.",
                )
            },
            confirmButton = { TextButton(onClick = { vm.install(state.apk) }) { Text("Install") } },
            dismissButton = { TextButton(onClick = vm::dismiss) { Text("Later") } },
        )
        is UpdateState.Failed -> AlertDialog(
            onDismissRequest = vm::dismiss,
            title = { Text("Update problem") },
            text = { Text(state.message) },
            confirmButton = { TextButton(onClick = vm::dismiss) { Text("OK") } },
        )
    }
}
