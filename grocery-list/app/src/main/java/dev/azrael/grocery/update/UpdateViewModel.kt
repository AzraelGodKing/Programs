package dev.azrael.grocery.update

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data object UpToDate : UpdateState
    data class Available(val update: AvailableUpdate) : UpdateState
    data class Downloading(val update: AvailableUpdate, val progress: Float) : UpdateState
    data class ReadyToInstall(val update: AvailableUpdate, val apk: File) : UpdateState
    data class Failed(val message: String) : UpdateState
}

class UpdateViewModel(private val app: Application) : AndroidViewModel(app) {
    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    val currentBuild: Int = BuildConfig.VERSION_CODE
    val versionName: String = BuildConfig.VERSION_NAME

    init {
        check(manual = false)
    }

    /** [manual] checks report "up to date" and errors; the quiet launch check only speaks up for an update. */
    fun check(manual: Boolean) {
        if (_state.value is UpdateState.Checking || _state.value is UpdateState.Downloading) return
        _state.value = UpdateState.Checking
        viewModelScope.launch {
            _state.value = try {
                UpdateClient.findNewer(currentBuild)?.let { UpdateState.Available(it) }
                    ?: if (manual) UpdateState.UpToDate else UpdateState.Idle
            } catch (e: Exception) {
                if (manual) UpdateState.Failed("Couldn't reach GitHub: ${e.message ?: "unknown error"}") else UpdateState.Idle
            }
        }
    }

    fun download(update: AvailableUpdate) {
        _state.value = UpdateState.Downloading(update, 0f)
        viewModelScope.launch {
            _state.value = try {
                val apk = UpdateClient.download(app, update) { p ->
                    _state.value = UpdateState.Downloading(update, p)
                }
                UpdateState.ReadyToInstall(update, apk)
            } catch (e: Exception) {
                UpdateState.Failed("Download failed: ${e.message ?: "unknown error"}")
            }
        }
    }

    /** Returns false when Android still needs the "install unknown apps" permission. */
    fun install(apk: File): Boolean {
        if (!UpdateClient.canInstall(app)) {
            UpdateClient.openInstallPermissionSettings(app)
            return false
        }
        UpdateClient.install(app, apk)
        return true
    }

    fun dismiss() {
        if (_state.value !is UpdateState.Downloading) _state.value = UpdateState.Idle
    }

    companion object {
        val Factory = viewModelFactory {
            initializer { UpdateViewModel(this[APPLICATION_KEY]!!) }
        }
    }
}
