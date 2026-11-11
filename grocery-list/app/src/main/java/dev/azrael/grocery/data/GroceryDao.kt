package dev.azrael.grocery.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface GroceryDao {
    @Query("SELECT * FROM grocery_items ORDER BY checked ASC, createdAt ASC")
    fun observeAll(): Flow<List<GroceryItem>>

    @Query("SELECT * FROM grocery_items WHERE `key` = :key AND checked = 0")
    suspend fun findUncheckedByKey(key: String): List<GroceryItem>

    @Insert
    suspend fun insert(item: GroceryItem): Long

    @Update
    suspend fun update(item: GroceryItem)

    @Delete
    suspend fun delete(item: GroceryItem)

    @Query("UPDATE grocery_items SET checked = :checked WHERE id = :id")
    suspend fun setChecked(id: Long, checked: Boolean)

    @Query("UPDATE grocery_items SET checked = 0")
    suspend fun uncheckAll()

    @Query("DELETE FROM grocery_items WHERE checked = 1")
    suspend fun deleteChecked()

    @Query("DELETE FROM grocery_items")
    suspend fun deleteAll()
}
