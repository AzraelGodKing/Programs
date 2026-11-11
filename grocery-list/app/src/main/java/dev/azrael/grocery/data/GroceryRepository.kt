package dev.azrael.grocery.data

import androidx.room.withTransaction
import dev.azrael.grocery.parse.Amount
import dev.azrael.grocery.parse.Categorizer
import dev.azrael.grocery.parse.Merge
import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.ParsedIngredient
import kotlinx.coroutines.flow.Flow

class GroceryRepository(private val db: GroceryDatabase) {
    private val dao = db.groceryDao()

    val items: Flow<List<GroceryItem>> = dao.observeAll()

    /** Adds recipe ingredients, folding each into a matching unchecked line when the units allow. */
    suspend fun addIngredients(ingredients: List<ParsedIngredient>, source: String?) = db.withTransaction {
        ingredients.forEach { addOne(it.name, it.quantity, it.unit, it.note, source) }
    }

    /** Adds a single item typed in by hand; it merges the same way recipe lines do. */
    suspend fun addManual(name: String, quantity: Double?, unit: String?, note: String?, category: String?) =
        db.withTransaction { addOne(name, quantity, unit, note, null, category) }

    private suspend fun addOne(
        name: String,
        quantity: Double?,
        unit: String?,
        note: String?,
        source: String?,
        categoryOverride: String? = null,
    ) {
        val key = NameKey.of(name)
        for (existing in dao.findUncheckedByKey(key)) {
            val merged = Merge.combine(
                Amount(existing.quantity, existing.unit),
                Amount(quantity, unit),
            ) ?: continue
            dao.update(
                existing.copy(
                    quantity = merged.quantity,
                    unit = merged.unit,
                    note = joinDistinct(existing.note, note, "; "),
                    sources = joinDistinct(existing.sources, source, " · "),
                ),
            )
            return
        }
        dao.insert(
            GroceryItem(
                name = name.replaceFirstChar { it.uppercase() },
                key = key,
                quantity = quantity,
                unit = unit,
                category = categoryOverride ?: Categorizer.categorize(name, unit).name,
                note = note,
                sources = source,
            ),
        )
    }

    suspend fun update(item: GroceryItem) = dao.update(item.copy(key = NameKey.of(item.name)))
    suspend fun delete(item: GroceryItem) = dao.delete(item)
    suspend fun restore(item: GroceryItem) { dao.insert(item) }
    suspend fun setChecked(item: GroceryItem, checked: Boolean) = dao.setChecked(item.id, checked)
    suspend fun uncheckAll() = dao.uncheckAll()
    suspend fun deleteChecked() = dao.deleteChecked()
    suspend fun deleteAll() = dao.deleteAll()

    private fun joinDistinct(a: String?, b: String?, sep: String): String? {
        val parts = (a?.split(sep).orEmpty() + listOfNotNull(b)).map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        return parts.joinToString(sep).ifEmpty { null }
    }
}
