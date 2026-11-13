package dev.azrael.grocery.dash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate

class DashViewModel(private val store: DashStore) : ViewModel() {
    val log: StateFlow<DashLog> = store.log
    private val _day = MutableStateFlow(today())

    /** The day being shown, as LocalDate.toEpochDay(). */
    val day: StateFlow<Long> = _day.asStateFlow()

    fun showDay(day: Long) { _day.value = minOf(day, today()) }
    fun previousDay() = showDay(_day.value - 1)
    fun nextDay() = showDay(_day.value + 1)
    fun goToToday() = showDay(today())

    fun add(group: DashGroup) = store.add(_day.value, group, 1)
    fun remove(group: DashGroup) = store.add(_day.value, group, -1)
    fun clearDay() = store.clearDay(_day.value)

    companion object {
        fun today(): Long = LocalDate.now().toEpochDay()

        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                DashViewModel(app.dashStore)
            }
        }
    }
}
