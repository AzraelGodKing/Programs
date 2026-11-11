package dev.azrael.grocery

import android.app.Application
import dev.azrael.grocery.claude.ClaudeSettings
import dev.azrael.grocery.data.GroceryDatabase
import dev.azrael.grocery.data.GroceryRepository

class GroceryApp : Application() {
    val repository: GroceryRepository by lazy { GroceryRepository(GroceryDatabase.create(this)) }
    val claudeSettings: ClaudeSettings by lazy { ClaudeSettings(this) }
}
