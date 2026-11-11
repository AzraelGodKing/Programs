package dev.azrael.grocery.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** A saved recipe planned for one day of the week, at a number of servings. */
@Entity(tableName = "meal_plan", indices = [Index("day"), Index("recipeId")])
data class MealPlanEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** LocalDate.toEpochDay(). */
    val day: Long,
    val recipeId: Long,
    val servings: Int,
)
