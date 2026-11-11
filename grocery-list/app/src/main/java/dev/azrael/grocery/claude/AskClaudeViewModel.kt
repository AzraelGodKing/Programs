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

class AskClaudeViewModel(val settings: ClaudeSettings) : ViewModel() {
    private val _state = MutableStateFlow<AskState>(AskState.Idle)
    val state: StateFlow<AskState> = _state.asStateFlow()

    private val _keyTest = MutableStateFlow<KeyTestState>(KeyTestState.Idle)
    val keyTest: StateFlow<KeyTestState> = _keyTest.asStateFlow()

    private var job: Job? = null

    fun ask(input: String) {
        val config = settings.config.value
        if (!config.enabled || !config.hasKey || input.isBlank()) return
        job?.cancel()
        _state.value = AskState.Working
        job = viewModelScope.launch {
            _state.value = try {
                val recipe = withContext(Dispatchers.IO) {
                    ClaudeRecipeClient(config.apiKey, config.model).use { it.ask(input) }
                }
                if (recipe.ingredients.isEmpty() && recipe.dashNotes.isNotBlank()) {
                    AskState.Failed(recipe.dashNotes)
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

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                AskClaudeViewModel(app.claudeSettings)
            }
        }
    }
}
