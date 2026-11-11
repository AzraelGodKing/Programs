package dev.azrael.grocery.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.azrael.grocery.parse.Category

/** Something already at home. Recipe ingredients that match a Cabinet item start unticked. */
@Entity(tableName = "cabinet_items", indices = [Index(value = ["key"], unique = true)])
data class CabinetItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    /** Normalized name; see NameKey. One Cabinet line per key. */
    val key: String,
    /** Category enum name. */
    val category: String = Category.OTHER.name,
    val addedAt: Long = System.currentTimeMillis(),
) {
    val categoryEnum: Category get() = Category.fromName(category)
}
