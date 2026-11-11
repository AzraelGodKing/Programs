package dev.azrael.grocery.data

import androidx.room.withTransaction
import dev.azrael.grocery.barcode.ScannedProduct
import dev.azrael.grocery.parse.Amount
import dev.azrael.grocery.parse.Categorizer
import dev.azrael.grocery.parse.CombinedLine
import dev.azrael.grocery.parse.Merge
import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.ParsedIngredient
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

class GroceryRepository(private val db: GroceryDatabase, private val layout: StoreLayout? = null) {
    private val dao = db.groceryDao()
    private val cabinetDao = db.cabinetDao()
    private val recipeDao = db.recipeDao()
    private val mealPlanDao = db.mealPlanDao()

    val items: Flow<List<GroceryItem>> = dao.observeAll()
    val cabinet: Flow<List<CabinetItem>> = cabinetDao.observeAll()
    val recipes: Flow<List<Recipe>> = recipeDao.observeAll()

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
                category = categoryOverride ?: sectionFor(name, unit).name,
                note = note,
                sources = source,
            ),
        )
    }

    suspend fun update(item: GroceryItem) = dao.update(item.copy(key = NameKey.of(item.name)))
    suspend fun delete(item: GroceryItem) = dao.delete(item)
    suspend fun restore(item: GroceryItem) { dao.insert(item) }
    suspend fun setChecked(item: GroceryItem, checked: Boolean) = dao.setChecked(item.id, checked)
    suspend fun setChecked(id: Long, checked: Boolean) = dao.setChecked(id, checked)
    suspend fun uncheckAll() = dao.uncheckAll()
    suspend fun deleteChecked() = dao.deleteChecked()
    suspend fun deleteAll() = dao.deleteAll()

    // Cabinet: things already at home.

    /** Adds to the Cabinet; does nothing when an item with the same key is already there. */
    suspend fun addToCabinet(name: String, category: String? = null) {
        val clean = name.trim()
        if (clean.isEmpty()) return
        cabinetDao.insert(cabinetItemFor(clean, category))
    }

    suspend fun setExpiry(item: CabinetItem, expiresOn: Long?) = cabinetDao.setExpiry(item.id, expiresOn)

    /** Cabinet items that have an expiry date, for the daily reminder. */
    suspend fun cabinetWithExpiry(): List<CabinetItem> = cabinetDao.getWithExpiry()

    /**
     * Adds a scanned product to the Cabinet with its label sodium. If the Cabinet already has an item with
     * the same name, that item gets the barcode and sodium instead of a second line.
     */
    suspend fun addScannedToCabinet(product: ScannedProduct) = db.withTransaction {
        val fresh = cabinetItemFor(product.name, null).copy(
            barcode = product.barcode,
            sodiumMgPerServing = product.sodiumMgPerServing,
            sodiumMgPer100g = product.sodiumMgPer100g,
            potassiumMgPerServing = product.potassiumMgPerServing,
            servingSize = product.servingSize,
        )
        val existing = cabinetDao.findByKey(fresh.key)
        if (existing == null) {
            cabinetDao.insert(fresh)
        } else {
            cabinetDao.update(
                fresh.copy(
                    id = existing.id,
                    name = existing.name,
                    category = existing.category,
                    addedAt = existing.addedAt,
                    expiresOn = existing.expiresOn,
                ),
            )
        }
    }

    suspend fun removeFromCabinet(item: CabinetItem) = cabinetDao.delete(item)
    suspend fun restoreToCabinet(item: CabinetItem) { cabinetDao.insert(item) }
    suspend fun clearCabinet() = cabinetDao.deleteAll()

    /** Ran out of something: takes it out of the Cabinet and puts it on the grocery list. */
    suspend fun cabinetToList(item: CabinetItem) = db.withTransaction {
        cabinetDao.delete(item)
        addOne(item.name, null, null, null, null, item.category)
    }

    /** Bought it: every checked line goes into the Cabinet and off the list. Returns how many moved. */
    suspend fun moveCheckedToCabinet(): Int = db.withTransaction {
        val checked = dao.getChecked()
        checked.forEach { cabinetDao.insert(cabinetItemFor(it.name, it.category)) }
        dao.deleteChecked()
        checked.size
    }

    // Recipe box.

    suspend fun saveRecipe(title: String, servings: Int, text: String): Long =
        recipeDao.insert(Recipe(title = title.trim(), servings = servings.coerceAtLeast(1), text = text.trim()))

    suspend fun updateRecipe(recipe: Recipe) = recipeDao.update(recipe)
    /** Also takes the recipe off the meal plan. */
    suspend fun deleteRecipe(recipe: Recipe) = db.withTransaction {
        mealPlanDao.deleteForRecipe(recipe.id)
        recipeDao.delete(recipe)
    }
    suspend fun restoreRecipe(recipe: Recipe) { recipeDao.insert(recipe) }

    /** Puts a saved recipe's chosen (already scaled) ingredients on the list. */
    suspend fun addRecipeToList(recipe: Recipe, ingredients: List<ParsedIngredient>) = db.withTransaction {
        ingredients.forEach { addOne(it.name, it.quantity, it.unit, it.note, recipe.title) }
        recipeDao.markAdded(recipe.id, System.currentTimeMillis())
    }

    // Meal plan.

    fun mealPlan(from: LocalDate, to: LocalDate): Flow<List<MealPlanEntry>> =
        mealPlanDao.observeRange(from.toEpochDay(), to.toEpochDay())

    suspend fun planMeal(day: LocalDate, recipe: Recipe, servings: Int) {
        mealPlanDao.insert(MealPlanEntry(day = day.toEpochDay(), recipeId = recipe.id, servings = servings))
    }

    suspend fun updatePlanned(entry: MealPlanEntry) = mealPlanDao.update(entry)
    suspend fun unplan(entry: MealPlanEntry) = mealPlanDao.delete(entry)
    suspend fun restorePlanned(entry: MealPlanEntry) { mealPlanDao.insert(entry) }
    suspend fun clearPlan(from: LocalDate, to: LocalDate) = mealPlanDao.deleteRange(from.toEpochDay(), to.toEpochDay())

    /** Puts the week's combined lines on the list; each merges into the list like any other line. */
    suspend fun addCombinedToList(lines: List<CombinedLine>, recipeIds: Collection<Long>) = db.withTransaction {
        lines.forEach { addOne(it.name, it.quantity, it.unit, it.note, it.sources.joinToString(" · ").ifEmpty { null }) }
        val now = System.currentTimeMillis()
        recipeIds.forEach { recipeDao.markAdded(it, now) }
    }

    private fun cabinetItemFor(name: String, category: String?) = CabinetItem(
        name = name.replaceFirstChar { it.uppercase() },
        key = NameKey.of(name),
        category = category ?: sectionFor(name, null).name,
    )

    /** A section you moved this item to before, else the built-in guess. */
    private fun sectionFor(name: String, unit: String?) =
        layout?.order?.value?.sectionFor(name, unit) ?: Categorizer.categorize(name, unit)

    private fun joinDistinct(a: String?, b: String?, sep: String): String? {
        val parts = (a?.split(sep).orEmpty() + listOfNotNull(b)).map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        return parts.joinToString(sep).ifEmpty { null }
    }
}
