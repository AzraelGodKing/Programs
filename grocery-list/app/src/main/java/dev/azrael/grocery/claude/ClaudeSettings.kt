package dev.azrael.grocery.claude

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ClaudeConfig(
    /** Off by default. When off the app never contacts Anthropic and hides every Claude button. */
    val enabled: Boolean = false,
    val apiKey: String = "",
    val model: ClaudeModel = ClaudeModel.DEFAULT,
) {
    val hasKey: Boolean get() = apiKey.isNotBlank()
}

/**
 * Claude on/off, API key and model, kept in this app's private storage on the phone.
 * The file is excluded from Android backups (see res/xml/backup_rules.xml), so the key never leaves the device
 * except in requests to api.anthropic.com.
 */
class ClaudeSettings(context: Context) {
    private val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    private val _config = MutableStateFlow(read())
    val config: StateFlow<ClaudeConfig> = _config.asStateFlow()

    fun setEnabled(enabled: Boolean) = edit { copy(enabled = enabled) }
    fun setApiKey(key: String) = edit { copy(apiKey = key.trim()) }
    fun setModel(model: ClaudeModel) = edit { copy(model = model) }

    private fun edit(change: ClaudeConfig.() -> ClaudeConfig) {
        val next = _config.value.change()
        prefs.edit()
            .putBoolean(KEY_ENABLED, next.enabled)
            .putString(KEY_API_KEY, next.apiKey)
            .putString(KEY_MODEL, next.model.id)
            .apply()
        _config.value = next
    }

    private fun read() = ClaudeConfig(
        enabled = prefs.getBoolean(KEY_ENABLED, false),
        apiKey = prefs.getString(KEY_API_KEY, "").orEmpty(),
        model = ClaudeModel.fromId(prefs.getString(KEY_MODEL, null)),
    )

    companion object {
        /** Must match the exclude entries in res/xml/backup_rules.xml and data_extraction_rules.xml. */
        const val FILE = "claude_settings"
        private const val KEY_ENABLED = "enabled"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_MODEL = "model"
    }
}
