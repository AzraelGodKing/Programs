package dev.azrael.grocery.nutrition

import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.ParsedIngredient
import dev.azrael.grocery.parse.UnitFamily
import dev.azrael.grocery.parse.Units
import kotlin.math.roundToInt

/** One ingredient's share of a recipe's sodium and potassium. Null mg means it couldn't be estimated. */
data class IngredientNutrition(
    val ingredient: ParsedIngredient,
    /** The table entry it matched, e.g. "chicken broth". */
    val matched: String?,
    val grams: Double?,
    val sodiumMg: Double?,
    val potassiumMg: Double?,
    /** Why it wasn't counted, for the breakdown. */
    val skippedReason: String? = null,
) {
    val counted: Boolean get() = sodiumMg != null
}

data class RecipeNutrition(
    val items: List<IngredientNutrition>,
    val servings: Double,
) {
    val sodiumMg: Double get() = items.sumOf { it.sodiumMg ?: 0.0 }
    val potassiumMg: Double get() = items.sumOf { it.potassiumMg ?: 0.0 }
    val sodiumPerServing: Int get() = (sodiumMg / servings).roundToInt()
    val potassiumPerServing: Int get() = (potassiumMg / servings).roundToInt()
    val skipped: List<IngredientNutrition> get() = items.filter { !it.counted }

    /** Biggest sodium sources first, for "where it comes from". */
    val topSodium: List<IngredientNutrition>
        get() = items.filter { (it.sodiumMg ?: 0.0) >= 1.0 }.sortedByDescending { it.sodiumMg }
}

/** Estimates a recipe's sodium and potassium from its parsed ingredient lines and [NutrientTable]. */
object RecipeNutritionEstimator {
    private const val ML_PER_CUP = 236.588
    private const val DEFAULT_PACKAGE_G = 400.0
    private val packageUnits = setOf("can", "jar", "package", "bag", "box", "bottle", "container", "packet")

    /** Words that mean a low-sodium version, checked on the NameKey key. */
    private val lowSodiumWords = listOf(
        "low sodium", "no salt added", "no salt", "unsalted", "salt free", "sodium free", "no sodium",
    )
    private val reducedSodiumWords = listOf("reduced sodium", "less sodium", "lower sodium", "lite")

    /** "15 oz", "14.5-ounce", "400g" in a parenthetical note gives the package or item size. */
    private val sizeInNote = Regex("(\\d+(?:\\.\\d+)?)\\s*-?\\s*(oz|ounces?|g|grams?|lb|lbs|pounds?|kg|ml|l)\\b", RegexOption.IGNORE_CASE)

    fun estimate(ingredients: List<ParsedIngredient>, servings: Double): RecipeNutrition =
        RecipeNutrition(ingredients.map { estimate(it) }, servings.coerceAtLeast(0.25))

    fun estimate(ing: ParsedIngredient): IngredientNutrition {
        val isPackage = ing.unit in packageUnits
        // "1 can diced tomatoes" is canned, not fresh.
        val entry = (if (isPackage) NutrientTable.find("canned ${ing.name}") else null)
            ?: NutrientTable.find(ing.name)
            ?: return IngredientNutrition(ing, null, null, null, null, "not in the built-in table")

        val grams = gramsOf(ing, entry)
            ?: return IngredientNutrition(
                ing, entry.label, null, null, null,
                if (ing.quantity == null) "no amount given" else "amount not understood",
            )

        val key = " ${NameKey.of(ing.name)} "
        var sodiumPer100 = entry.sodiumPer100g
        when {
            lowSodiumWords.any { key.contains(" $it ") } ->
                sodiumPer100 = minOf(sodiumPer100, entry.lowSodiumPer100g ?: (sodiumPer100 * 0.25))
            reducedSodiumWords.any { key.contains(" $it ") } -> sodiumPer100 *= 0.7
        }
        // Draining and rinsing canned beans and vegetables washes off roughly a third of the sodium.
        val rinsed = ing.note?.contains("rinse", ignoreCase = true) == true
        if (rinsed && sodiumPer100 < 1000) sodiumPer100 *= 0.65

        return IngredientNutrition(
            ingredient = ing,
            matched = entry.label,
            grams = grams,
            sodiumMg = grams * sodiumPer100 / 100.0,
            potassiumMg = grams * entry.potassiumPer100g / 100.0,
        )
    }

    private fun gramsOf(ing: ParsedIngredient, entry: NutrientEntry): Double? {
        val unit = Units.def(ing.unit)
        // "pinch of salt" without a number still means one pinch.
        val qty = ing.quantity ?: if (ing.unit == "pinch" || ing.unit == "dash") 1.0 else return null
        val noteSize = ing.note?.let { sizeFromNote(it) }
        return when {
            unit == null -> qty * (noteSize ?: entry.gramsEach ?: return null)
            unit.family == UnitFamily.WEIGHT -> qty * unit.toBase
            unit.family == UnitFamily.VOLUME -> qty * unit.toBase / ML_PER_CUP * (entry.gramsPerCup ?: 240.0)
            ing.unit == "pinch" -> qty * (entry.gramsPerCup ?: 240.0) / 768.0 // 1/16 tsp
            ing.unit == "dash" -> qty * (entry.gramsPerCup ?: 240.0) / 384.0 // 1/8 tsp
            ing.unit in packageUnits -> qty * (noteSize ?: entry.gramsPerPackage ?: DEFAULT_PACKAGE_G)
            // clove, slice, stalk, fillet, breast, ear, head, bunch, stick...
            else -> qty * (noteSize ?: entry.gramsEach ?: return null)
        }
    }

    /** Grams from a size like "15 oz" or "400 g" in the note, or null. Fluid sizes count as water. */
    fun sizeFromNote(note: String): Double? {
        val m = sizeInNote.find(note) ?: return null
        val n = m.groupValues[1].toDoubleOrNull() ?: return null
        return when (m.groupValues[2].lowercase().trimEnd('s')) {
            "oz", "ounce" -> n * 28.3495
            "g", "gram" -> n
            "lb", "pound" -> n * 453.592
            "kg" -> n * 1000
            "ml" -> n
            "l" -> n * 1000
            else -> null
        }
    }
}
