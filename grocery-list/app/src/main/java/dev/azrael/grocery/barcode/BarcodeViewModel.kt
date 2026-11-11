package dev.azrael.grocery.barcode

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.data.GroceryRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface BarcodeState {
    /** Waiting for the scanner, or the user to type a number. */
    data object Idle : BarcodeState
    data class Looking(val barcode: String) : BarcodeState
    data class Found(val product: ScannedProduct, val added: Boolean = false) : BarcodeState
    data class NotFound(val barcode: String) : BarcodeState
    data class Failed(val barcode: String?, val message: String) : BarcodeState
}

class BarcodeViewModel(private val repo: GroceryRepository) : ViewModel() {
    private val _state = MutableStateFlow<BarcodeState>(BarcodeState.Idle)
    val state: StateFlow<BarcodeState> = _state.asStateFlow()
    private var job: Job? = null

    fun reset() {
        job?.cancel()
        _state.value = BarcodeState.Idle
    }

    fun scanFailed(message: String) {
        _state.value = BarcodeState.Failed(null, message)
    }

    fun lookup(raw: String) {
        val code = OpenFoodFacts.cleanBarcode(raw)
        if (code == null) {
            _state.value = BarcodeState.Failed(null, "\"$raw\" doesn't look like a product barcode.")
            return
        }
        job?.cancel()
        _state.value = BarcodeState.Looking(code)
        job = viewModelScope.launch {
            _state.value = try {
                OpenFoodFactsClient.lookup(code)?.let { BarcodeState.Found(it) } ?: BarcodeState.NotFound(code)
            } catch (e: Exception) {
                BarcodeState.Failed(code, "Couldn't reach Open Food Facts: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    /** Adds to the Cabinet; works for products typed in by hand after a miss too. */
    fun addToCabinet(product: ScannedProduct) {
        viewModelScope.launch {
            repo.addScannedToCabinet(product)
            _state.value = BarcodeState.Found(product, added = true)
        }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                BarcodeViewModel(app.repository)
            }
        }
    }
}
