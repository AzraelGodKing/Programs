package dev.azrael.grocery.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface MealPlanDao {
    /** Days from [from] to [to], both included, as epoch days. */
    @Query("SELECT * FROM meal_plan WHERE day BETWEEN :from AND :to ORDER BY day ASC, id ASC")
    fun observeRange(from: Long, to: Long): Flow<List<MealPlanEntry>>

    @Insert
    suspend fun insert(entry: MealPlanEntry): Long

    @Update
    suspend fun update(entry: MealPlanEntry)

    @Delete
    suspend fun delete(entry: MealPlanEntry)

    @Query("DELETE FROM meal_plan WHERE day BETWEEN :from AND :to")
    suspend fun deleteRange(from: Long, to: Long)

    @Query("DELETE FROM meal_plan WHERE recipeId = :recipeId")
    suspend fun deleteForRecipe(recipeId: Long)
}
