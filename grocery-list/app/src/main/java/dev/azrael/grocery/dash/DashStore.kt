package dev.azrael.grocery.dash

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** DASH servings by day, kept on the phone. Only the last [KEEP_DAYS] days are kept. */
class DashStore(context: Context) {
    private val prefs = context.getSharedPreferences("dash_day", Context.MODE_PRIVATE)
    private val _log = MutableStateFlow(read())
    val log: StateFlow<DashLog> = _log.asStateFlow()

    /** Adds [delta] servings (may be negative) of [group] on [day]; never goes below zero. */
    fun add(day: Long, group: DashGroup, delta: Int) {
        val counts = _log.value[day].orEmpty()
        val n = ((counts[group] ?: 0) + delta).coerceIn(0, 99)
        val updated = if (n == 0) counts - group else counts + (group to n)
        val cutoff = day - KEEP_DAYS
        val log = (_log.value + (day to updated)).filter { (d, c) -> d > cutoff && c.isNotEmpty() }
        _log.value = log
        prefs.edit().apply {
            clear()
            log.forEach { (d, c) -> putString(KEY_DAY + d, DashDay.encode(c)) }
        }.apply()
    }

    fun clearDay(day: Long) {
        _log.value = _log.value - day
        prefs.edit().remove(KEY_DAY + day).apply()
    }

    private fun read(): DashLog = prefs.all.mapNotNull { (k, v) ->
        val day = k.removePrefix(KEY_DAY).takeIf { k.startsWith(KEY_DAY) }?.toLongOrNull() ?: return@mapNotNull null
        day to DashDay.decode(v as? String)
    }.toMap()

    private companion object {
        const val KEY_DAY = "d_"
        const val KEEP_DAYS = 90
    }
}
