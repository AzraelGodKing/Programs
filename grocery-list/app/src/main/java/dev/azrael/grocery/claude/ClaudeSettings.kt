package dev.azrael.grocery.claude

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** How Claude is reached. Subscription sign-in isn't allowed in third-party apps, so "Claude app" hands off instead. */
enum class ClaudeMode(val label: String) {
    /** Hand the request or photo to the official Claude app (your Pro/Max plan); share the reply back. */
    CLAUDE_APP("Claude app (your subscription)"),
    /** Call the Claude API in the background with your own API key, billed per use. */
    API_KEY("API key");

    companion object {
        fun fromName(name: String?): ClaudeMode = entries.firstOrNull { it.name == name } ?: CLAUDE_APP
    }
}

data class ClaudeConfig(
    /** Off by default. When off the app never contacts Anthropic and hides every Claude button. */
    val enabled: Boolean = false,
    val apiKey: String = "",
    val model: ClaudeModel = ClaudeModel.DEFAULT,
    val mode: ClaudeMode = ClaudeMode.CLAUDE_APP,
) {
    val hasKey: Boolean get() = apiKey.isNotBlank()

    /** True when requests run inside this app through the API. */
    val usesApi: Boolean get() = mode == ClaudeMode.API_KEY
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
    fun setMode(mode: ClaudeMode) = edit { copy(mode = mode) }

    private fun edit(change: ClaudeConfig.() -> ClaudeConfig) {
        val next = _config.value.change()
        prefs.edit()
            .putBoolean(KEY_ENABLED, next.enabled)
            .putString(KEY_API_KEY, next.apiKey)
            .putString(KEY_MODEL, next.model.id)
            .putString(KEY_MODE, next.mode.name)
            .apply()
        _config.value = next
    }

    private fun read() = ClaudeConfig(
        enabled = prefs.getBoolean(KEY_ENABLED, false),
        apiKey = prefs.getString(KEY_API_KEY, "").orEmpty(),
        model = ClaudeModel.fromId(prefs.getString(KEY_MODEL, null)),
        // Anyone who saved a key before modes existed keeps using it.
        mode = prefs.getString(KEY_MODE, null)?.let { ClaudeMode.fromName(it) }
            ?: if (prefs.getString(KEY_API_KEY, "").isNullOrBlank()) ClaudeMode.CLAUDE_APP else ClaudeMode.API_KEY,
    )

    companion object {
        /** Must match the exclude entries in res/xml/backup_rules.xml and data_extraction_rules.xml. */
        const val FILE = "claude_settings"
        private const val KEY_ENABLED = "enabled"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_MODEL = "model"
        private const val KEY_MODE = "mode"
    }
}
