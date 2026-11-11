package dev.azrael.grocery.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface RecipeDao {
    @Query("SELECT * FROM recipes ORDER BY title COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<Recipe>>

    @Insert
    suspend fun insert(recipe: Recipe): Long

    @Update
    suspend fun update(recipe: Recipe)

    @Delete
    suspend fun delete(recipe: Recipe)

    @Query("UPDATE recipes SET lastAddedAt = :at WHERE id = :id")
    suspend fun markAdded(id: Long, at: Long)
}
