package dev.azrael.grocery.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CabinetDao {
    @Query("SELECT * FROM cabinet_items ORDER BY name COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<CabinetItem>>

    /** Ignores an item whose key is already in the Cabinet. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(item: CabinetItem): Long

    @Delete
    suspend fun delete(item: CabinetItem)

    @Query("DELETE FROM cabinet_items")
    suspend fun deleteAll()
}
