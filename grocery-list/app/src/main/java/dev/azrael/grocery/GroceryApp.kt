package dev.azrael.grocery

import android.app.Application
import androidx.glance.appwidget.updateAll
import dev.azrael.grocery.claude.ClaudeSettings
import dev.azrael.grocery.claude.GeminiNano
import dev.azrael.grocery.dash.DashStore
import dev.azrael.grocery.data.FoodLogDao
import dev.azrael.grocery.data.GroceryDatabase
import dev.azrael.grocery.data.GroceryRepository
import dev.azrael.grocery.data.StoreLayout
import dev.azrael.grocery.expiry.ExpiryReminders
import dev.azrael.grocery.tracker.TrackerSettings
import dev.azrael.grocery.widget.GroceryWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

class GroceryApp : Application() {
    val storeLayout: StoreLayout by lazy { StoreLayout(this) }
    private val database: GroceryDatabase by lazy { GroceryDatabase.create(this) }
    val repository: GroceryRepository by lazy { GroceryRepository(database, storeLayout) }
    val foodLog: FoodLogDao by lazy { database.foodLogDao() }
    val trackerSettings: TrackerSettings by lazy { TrackerSettings(this) }
    val dashStore: DashStore by lazy { DashStore(this) }
    val claudeSettings: ClaudeSettings by lazy { ClaudeSettings(this) }
    /** Only created when Gemini Nano is picked in AI settings; lives as long as the app. */
    val nano: GeminiNano by lazy { GeminiNano() }

    override fun onCreate() {
        super.onCreate()
        ExpiryReminders.schedule(this)
        // Redraw the home-screen widget whenever the list changes in the app.
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
            repository.items.distinctUntilChanged().drop(1).collect { GroceryWidget().updateAll(this@GroceryApp) }
        }
    }
}
