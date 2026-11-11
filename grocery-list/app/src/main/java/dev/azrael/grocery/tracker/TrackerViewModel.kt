package dev.azrael.grocery.tracker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.data.DayTotal
import dev.azrael.grocery.data.FoodLogDao
import dev.azrael.grocery.data.FoodLogEntry
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.math.roundToInt

@OptIn(ExperimentalCoroutinesApi::class)
class TrackerViewModel(private val log: FoodLogDao, val settings: TrackerSettings) : ViewModel() {
    private val _day = MutableStateFlow(today())

    /** The day being shown, as LocalDate.toEpochDay(). */
    val day: StateFlow<Long> = _day.asStateFlow()

    /** null until loaded. */
    val entries: StateFlow<List<FoodLogEntry>?> = _day
        .flatMapLatest { log.observeDay(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** The 7 days ending on the shown day. Days with nothing logged are missing. */
    val week: StateFlow<List<DayTotal>> = _day
        .flatMapLatest { log.observeTotals(it - 6, it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun showDay(day: Long) { _day.value = minOf(day, today()) }
    fun previousDay() = showDay(_day.value - 1)
    fun nextDay() = showDay(_day.value + 1)
    fun goToToday() = showDay(today())

    /** Logs [servings] of something with [sodiumPerServing] mg, on the day being shown. */
    fun log(name: String, sodiumPerServing: Int, potassiumPerServing: Int?, servings: Double, onDone: () -> Unit = {}) {
        val entry = FoodLogEntry(
            name = name.trim().ifEmpty { "Food" },
            day = _day.value,
            sodiumMg = (sodiumPerServing * servings).roundToInt(),
            potassiumMg = potassiumPerServing?.let { (it * servings).roundToInt() },
            servings = servings,
        )
        viewModelScope.launch { log.insert(entry); onDone() }
    }

    fun delete(entry: FoodLogEntry) = viewModelScope.launch { log.delete(entry) }
    fun restore(entry: FoodLogEntry) = viewModelScope.launch { log.insert(entry) }

    companion object {
        fun today(): Long = LocalDate.now().toEpochDay()

        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                TrackerViewModel(app.foodLog, app.trackerSettings)
            }
        }
    }
}
