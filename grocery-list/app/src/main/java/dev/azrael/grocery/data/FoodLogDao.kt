package dev.azrael.grocery.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/** Sodium for one day, for the week strip on the tracker. */
data class DayTotal(val day: Long, val sodiumMg: Int, val potassiumMg: Int)

@Dao
interface FoodLogDao {
    @Query("SELECT * FROM food_log WHERE day = :day ORDER BY loggedAt ASC")
    fun observeDay(day: Long): Flow<List<FoodLogEntry>>

    @Query(
        "SELECT day, SUM(sodiumMg) AS sodiumMg, COALESCE(SUM(potassiumMg), 0) AS potassiumMg " +
            "FROM food_log WHERE day BETWEEN :from AND :to GROUP BY day ORDER BY day ASC",
    )
    fun observeTotals(from: Long, to: Long): Flow<List<DayTotal>>

    @Insert
    suspend fun insert(entry: FoodLogEntry): Long

    @Delete
    suspend fun delete(entry: FoodLogEntry)
}
