package dev.azrael.grocery

import android.app.Application
import dev.azrael.grocery.claude.ClaudeSettings
import dev.azrael.grocery.claude.GeminiNano
import dev.azrael.grocery.data.GroceryDatabase
import dev.azrael.grocery.data.GroceryRepository
import dev.azrael.grocery.expiry.ExpiryReminders

class GroceryApp : Application() {
    val repository: GroceryRepository by lazy { GroceryRepository(GroceryDatabase.create(this)) }
    val claudeSettings: ClaudeSettings by lazy { ClaudeSettings(this) }
    /** Only created when Gemini Nano is picked in AI settings; lives as long as the app. */
    val nano: GeminiNano by lazy { GeminiNano() }

    override fun onCreate() {
        super.onCreate()
        ExpiryReminders.schedule(this)
    }
}
