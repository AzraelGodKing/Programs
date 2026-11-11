package dev.azrael.grocery.claude

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface AskState {
    data object Idle : AskState
    data object Working : AskState
    data class Done(val recipe: ClaudeRecipe) : AskState
    data class Failed(val message: String) : AskState
}

sealed interface KeyTestState {
    data object Idle : KeyTestState
    data object Testing : KeyTestState
    data object Ok : KeyTestState
    data class Failed(val message: String) : KeyTestState
}

class AskClaudeViewModel(val settings: ClaudeSettings, private val nano: () -> GeminiNano) : ViewModel() {
    private val _state = MutableStateFlow<AskState>(AskState.Idle)
    val state: StateFlow<AskState> = _state.asStateFlow()

    private val _keyTest = MutableStateFlow<KeyTestState>(KeyTestState.Idle)
    val keyTest: StateFlow<KeyTestState> = _keyTest.asStateFlow()

    private val _nanoStatus = MutableStateFlow<NanoStatus>(NanoStatus.Checking)
    /** Gemini Nano's state on this phone; refreshed by [checkNano]. */
    val nanoStatus: StateFlow<NanoStatus> = _nanoStatus.asStateFlow()

    private var job: Job? = null
    private var nanoJob: Job? = null

    fun ask(input: String) {
        val config = settings.config.value
        if (!config.enabled || input.isBlank()) return
        if (config.usesApi && !config.hasKey) return
        if (!config.inApp) return
        job?.cancel()
        _state.value = AskState.Working
        job = viewModelScope.launch {
            _state.value = try {
                val recipe = if (config.onDevice) {
                    ensureNano()
                    nano().ask(input)
                } else {
                    withContext(Dispatchers.IO) {
                        ClaudeRecipeClient(config.apiKey, config.model).use { it.ask(input) }
                    }
                }
                if (recipe.ingredients.isEmpty() && recipe.dashNotes.isNotBlank()) {
                    AskState.Failed(recipe.dashNotes)
                } else if (recipe.ingredients.isEmpty()) {
                    AskState.Failed("${config.assistant} didn't come back with any ingredients. Try again or reword it.")
                } else {
                    AskState.Done(recipe)
                }
            } catch (e: ClaudeException) {
                ensureActive() // cancelled while waiting: drop the late answer
                AskState.Failed(e.message ?: "Something went wrong.")
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                AskState.Failed("Something went wrong: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    /** Back to the input box, e.g. after adding items or to ask again. */
    fun reset() {
        job?.cancel()
        _state.value = AskState.Idle
    }

    fun testKey() {
        val config = settings.config.value
        if (!config.hasKey) return
        _keyTest.value = KeyTestState.Testing
        viewModelScope.launch {
            _keyTest.value = try {
                withContext(Dispatchers.IO) {
                    ClaudeRecipeClient(config.apiKey, config.model).use { it.testKey() }
                }
                KeyTestState.Ok
            } catch (e: ClaudeException) {
                KeyTestState.Failed(e.message ?: "The key didn't work.")
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                KeyTestState.Failed("The key didn't work: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    fun clearKeyTest() {
        _keyTest.value = KeyTestState.Idle
    }

    /** Looks up whether Gemini Nano is ready, downloadable or unsupported on this phone. */
    fun checkNano() {
        if (_nanoStatus.value is NanoStatus.Downloading) return
        nanoJob?.cancel()
        _nanoStatus.value = NanoStatus.Checking
        nanoJob = viewModelScope.launch { _nanoStatus.value = nano().status() }
    }

    /** Starts the one-time model download, if it's needed. */
    fun downloadNano() {
        if (_nanoStatus.value is NanoStatus.Downloading) return
        nanoJob?.cancel()
        nanoJob = viewModelScope.launch {
            try {
                ensureNano()
            } catch (e: ClaudeException) {
                _nanoStatus.value = NanoStatus.Failed(e.message ?: "Gemini Nano didn't download.")
            }
        }
    }

    private suspend fun ensureNano() = nano().ensureReady { _nanoStatus.value = it }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                AskClaudeViewModel(app.claudeSettings) { app.nano }
            }
        }
    }
}
