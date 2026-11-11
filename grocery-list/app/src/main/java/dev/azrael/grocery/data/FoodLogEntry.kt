package dev.azrael.grocery.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** Something eaten, for the daily sodium tracker. Amounts are for what was eaten, not per serving. */
@Entity(tableName = "food_log", indices = [Index("day")])
data class FoodLogEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    /** Local date as LocalDate.toEpochDay(). */
    val day: Long,
    val sodiumMg: Int,
    /** Null when unknown (many labels don't list potassium). */
    val potassiumMg: Int? = null,
    /** Servings eaten, for the label only. */
    val servings: Double = 1.0,
    val loggedAt: Long = System.currentTimeMillis(),
)
