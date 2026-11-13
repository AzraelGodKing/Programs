package dev.azrael.grocery.reel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.claude.ClaudeSettings
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface ReelState {
    data object Empty : ReelState
    data class Loading(val link: String) : ReelState
    /**
     * [caption] is what was found (may be ""), ready to edit. [problem] says why nothing was found, when
     * nothing was.
     */
    data class Ready(val link: String?, val caption: String, val problem: String? = null) : ReelState
}

/** A shared Facebook reel → its caption → the AI finds the recipe (on the Ask screen). */
class ReelViewModel(val settings: ClaudeSettings) : ViewModel() {
    private val _state = MutableStateFlow<ReelState>(ReelState.Empty)
    val state: StateFlow<ReelState> = _state.asStateFlow()
    private var job: Job? = null

    /** Text shared from the Facebook app: usually just the link. */
    fun onShared(text: String) {
        val link = SharedReel.findLink(text)
        val sharedCaption = link?.let { SharedReel.textBesides(text, it) }.orEmpty()
        job?.cancel()
        if (link == null) {
            _state.value = ReelState.Ready(null, text.trim())
            return
        }
        _state.value = ReelState.Loading(link)
        job = viewModelScope.launch {
            val result = try {
                val page = withContext(Dispatchers.IO) { ReelFetcher.fetch(link) }
                val caption = listOf(page.caption, sharedCaption).maxByOrNull { it.length }.orEmpty()
                if (caption.isBlank()) {
                    ReelState.Ready(
                        link,
                        "",
                        "Facebook didn't show this reel's caption without signing in, or the reel has no caption.",
                    )
                } else {
                    ReelState.Ready(link, caption)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                ReelState.Ready(
                    link,
                    sharedCaption,
                    if (sharedCaption.isBlank()) "Couldn't load the reel: ${e.message ?: e.javaClass.simpleName}." else null,
                )
            }
            _state.value = result
        }
    }

    fun reset() {
        job?.cancel()
        _state.value = ReelState.Empty
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                ReelViewModel(app.claudeSettings)
            }
        }
    }
}
