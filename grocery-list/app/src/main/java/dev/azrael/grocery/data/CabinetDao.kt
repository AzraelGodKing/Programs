package dev.azrael.grocery.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CabinetDao {
    @Query("SELECT * FROM cabinet_items ORDER BY name COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<CabinetItem>>

    /** Ignores an item whose key is already in the Cabinet. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(item: CabinetItem): Long

    @Query("SELECT * FROM cabinet_items WHERE expiresOn IS NOT NULL")
    suspend fun getWithExpiry(): List<CabinetItem>

    @Query("UPDATE cabinet_items SET expiresOn = :expiresOn WHERE id = :id")
    suspend fun setExpiry(id: Long, expiresOn: Long?)

    @Query("SELECT * FROM cabinet_items WHERE `key` = :key LIMIT 1")
    suspend fun findByKey(key: String): CabinetItem?

    @Update
    suspend fun update(item: CabinetItem)

    @Delete
    suspend fun delete(item: CabinetItem)

    @Query("DELETE FROM cabinet_items")
    suspend fun deleteAll()
}
