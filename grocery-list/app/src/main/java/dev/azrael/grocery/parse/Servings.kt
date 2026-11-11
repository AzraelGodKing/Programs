package dev.azrael.grocery.parse

import kotlin.math.ceil

/** Recipe yields and scaling a recipe to a different number of servings. Plain Kotlin. */
object Servings {
    private val patterns = listOf(
        Regex("\\b(?:serves|servings?|yield|yields|makes)\\s*[:\\-]?\\s*(?:about\\s+)?(\\d{1,2})(?:\\s*(?:-|–|to)\\s*(\\d{1,2}))?", RegexOption.IGNORE_CASE),
        Regex("\\b(\\d{1,2})\\s+(?:servings|portions|people)\\b", RegexOption.IGNORE_CASE),
    )

    /** Finds "Serves 4", "Servings: 6", "Makes 8 servings" or "Yield: 4-6" in recipe text; the low end of a range. */
    fun detect(text: String): Int? {
        for (p in patterns) {
            val m = p.find(text) ?: continue
            val n = m.groupValues[1].toIntOrNull() ?: continue
            if (n in 1..48) return n
        }
        return null
    }

    // Count units where a fraction of one isn't something you can buy.
    private val wholeUnits = setOf(
        "can", "jar", "package", "bag", "box", "bottle", "container", "packet", "loaf", "head", "bunch",
    )

    /**
     * Scales ingredient amounts from [from] servings to [to]. Things bought whole (3 eggs, 1 can)
     * round up, so 1 can for 4 becomes 2 cans for 6, not 1 1/2. Measured amounts stay exact and
     * move into a friendlier unit (9 tsp -> 3 tbsp).
     */
    fun scale(ingredients: List<ParsedIngredient>, from: Int, to: Int): List<ParsedIngredient> {
        if (from <= 0 || to <= 0 || from == to) return ingredients
        val factor = to.toDouble() / from
        return ingredients.map { ing ->
            val q = ing.quantity ?: return@map ing
            val scaled = q * factor
            if (ing.unit == null || ing.unit in wholeUnits) {
                ing.copy(quantity = ceil(scaled - 1e-9).coerceAtLeast(1.0))
            } else {
                val (sq, su) = Units.simplify(scaled, ing.unit)
                ing.copy(quantity = sq, unit = su)
            }
        }
    }
}
