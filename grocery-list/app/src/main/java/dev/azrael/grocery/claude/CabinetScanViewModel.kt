package dev.azrael.grocery.claude

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface ScanState {
    /** No photo yet. */
    data object Start : ScanState
    /** Claude app mode: the photo was handed to Claude; waiting for the reply to be shared or pasted. */
    data class SentToApp(val photo: Uri) : ScanState
    data object Working : ScanState
    data class Review(val items: List<String>, val note: String) : ScanState
    data class Failed(val message: String) : ScanState
}

/** Photo of a cupboard or fridge → Claude lists the items → the user reviews → they go in the Cabinet. */
class CabinetScanViewModel(private val app: Application, val settings: ClaudeSettings) : AndroidViewModel(app) {
    private val _state = MutableStateFlow<ScanState>(ScanState.Start)
    val state: StateFlow<ScanState> = _state.asStateFlow()

    private var job: Job? = null

    /** A photo was taken or picked. API mode scans it here; Claude app mode hands it over. */
    fun onPhoto(photo: Uri, sendToApp: (Uri) -> Unit) {
        val config = settings.config.value
        if (!config.enabled) return
        if (!config.usesApi) {
            sendToApp(photo)
            _state.value = ScanState.SentToApp(photo)
            return
        }
        if (!config.hasKey) {
            _state.value = ScanState.Failed("Add your API key in Claude settings, or switch to the Claude app.")
            return
        }
        job?.cancel()
        _state.value = ScanState.Working
        job = viewModelScope.launch {
            _state.value = try {
                val scan = withContext(Dispatchers.IO) {
                    val jpeg = Photos.loadJpeg(app, photo)
                    ClaudeRecipeClient(config.apiKey, config.model).use { it.identifyItems(jpeg) }
                }
                review(scan)
            } catch (e: ClaudeException) {
                ensureActive()
                ScanState.Failed(e.message ?: "Something went wrong.")
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                ScanState.Failed("Couldn't scan the photo: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    /** Claude's reply from the Claude app, shared or pasted back in. */
    fun onReplyText(text: String) {
        job?.cancel()
        if (text.contains(CabinetScan.PHOTO_INSTRUCTIONS.lineSequence().first())) {
            _state.value = ScanState.Failed("That's the prompt sent to Claude, not its reply. Copy Claude's answer and paste that.")
            return
        }
        _state.value = review(CabinetScan.parseReplyText(text))
    }

    private fun review(scan: CabinetScan): ScanState {
        val items = scan.cleanItems
        return if (items.isEmpty()) {
            ScanState.Failed(scan.note.ifBlank { "Claude didn't find any groceries in that photo." })
        } else {
            ScanState.Review(items, scan.note)
        }
    }

    fun reset() {
        job?.cancel()
        _state.value = ScanState.Start
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                CabinetScanViewModel(app, app.claudeSettings)
            }
        }
    }
}
