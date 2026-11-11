package dev.azrael.grocery.tracker

import android.content.Context
import dev.azrael.grocery.nutrition.Dash
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** The daily sodium limit the tracker measures against: 2,300 mg (standard DASH) or 1,500 mg (lower). */
class TrackerSettings(context: Context) {
    private val prefs = context.getSharedPreferences("tracker", Context.MODE_PRIVATE)
    private val _sodiumLimit = MutableStateFlow(prefs.getInt(KEY_LIMIT, Dash.SODIUM_STANDARD_MG))
    val sodiumLimit: StateFlow<Int> = _sodiumLimit.asStateFlow()

    fun setSodiumLimit(mg: Int) {
        prefs.edit().putInt(KEY_LIMIT, mg).apply()
        _sodiumLimit.value = mg
    }

    private companion object {
        const val KEY_LIMIT = "sodium_limit_mg"
    }
}
