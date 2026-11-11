package dev.azrael.grocery.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.azrael.grocery.parse.Category
import dev.azrael.grocery.parse.formatAmount

@Entity(tableName = "grocery_items", indices = [Index("key")])
data class GroceryItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    /** Normalized name used to merge duplicates; see NameKey. */
    val key: String,
    val quantity: Double? = null,
    val unit: String? = null,
    /** Category enum name. */
    val category: String = Category.OTHER.name,
    val note: String? = null,
    /** Recipe names this line came from, separated by " · ". */
    val sources: String? = null,
    val checked: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
) {
    val categoryEnum: Category get() = Category.fromName(category)

    /** "1 1/2 cups" or "" when there's no amount. */
    val amountLabel: String get() = formatAmount(quantity, unit)
}
