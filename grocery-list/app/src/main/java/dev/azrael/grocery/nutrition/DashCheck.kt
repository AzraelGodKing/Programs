package dev.azrael.grocery.nutrition

import dev.azrael.grocery.parse.ImportedRecipe
import dev.azrael.grocery.parse.IngredientParser
import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.ParsedIngredient

/** A rough DASH verdict for a recipe as written. */
data class DashVerdict(
    val sodiumPerServing: Int,
    /** Ingredients DASH keeps small: cream, butter, processed and red meat. */
    val heavyIngredients: List<String>,
    /** Lines the sodium estimate couldn't count. */
    val uncounted: Int,
) {
    val tooSalty: Boolean get() = sodiumPerServing > DashCheck.SODIUM_PER_SERVING_MG
    val fits: Boolean get() = !tooSalty && heavyIngredients.isEmpty()

    /** One line to put at the top of the recipe. */
    fun note(): String {
        val salt = "about ${Dash.mg(sodiumPerServing)} mg sodium a serving" +
            if (uncounted > 0) " (estimate; $uncounted line${if (uncounted == 1) "" else "s"} not counted)" else " (estimate)"
        if (fits) return "DASH check: looks DASH friendly, $salt."
        val reasons = buildList {
            if (tooSalty) add("$salt, over the ${DashCheck.SODIUM_PER_SERVING_MG} mg a meal DASH aims for")
            else add(salt)
            if (heavyIngredients.isNotEmpty()) add("heavy on ${heavyIngredients.joinToString(", ")}")
        }
        return "DASH check: not DASH as written. ${reasons.joinToString("; ").replaceFirstChar { it.uppercase() }}."
    }
}

/** Checks a recipe against DASH: sodium a serving and the ingredients DASH limits. Plain Kotlin. */
object DashCheck {
    /** About a third of the 1,500 to 2,300 mg day, for one meal. */
    const val SODIUM_PER_SERVING_MG = 600

    private const val RED_MEAT = "red meat"
    /** About 4 oz cooked; DASH allows up to 6 oz of lean meat a day. */
    private const val RED_MEAT_PER_SERVING_G = 115.0

    private val heavy = listOf(
        "heavy cream" to "heavy cream",
        "whipping cream" to "heavy cream",
        "half and half" to "half and half",
        "alfredo" to "jarred Alfredo",
        "bacon" to "bacon",
        "sausage" to "sausage",
        "andouille" to "sausage",
        "kielbasa" to "sausage",
        "chorizo" to "sausage",
        "pepperoni" to "pepperoni",
        "salami" to "salami",
        "ham" to "ham",
        "meatball" to "meatballs",
        "steak" to RED_MEAT,
        "beef" to RED_MEAT,
        "sirloin" to RED_MEAT,
        "ribeye" to RED_MEAT,
        "butter" to "butter",
        "cream cheese" to "cream cheese",
    )
    /** Lighter versions that don't count as heavy. */
    private val lighter = listOf("light", "reduced fat", "low fat", "fat free", "nonfat", "turkey", "chicken")
    /** Not the ingredient the word suggests. */
    private val notReally = listOf("peanut butter", "almond butter", "seasoning", "bouillon", "broth", "stock")

    fun check(ingredients: List<ParsedIngredient>, servings: Int): DashVerdict {
        val n = RecipeNutritionEstimator.estimate(ingredients, servings.toDouble())
        val found = linkedSetOf<String>()
        var redMeatGrams = 0.0
        for ((i, ing) in ingredients.withIndex()) {
            val key = " ${NameKey.of(ing.name)} "
            if (notReally.any { key.contains(" ${NameKey.of(it)} ") }) continue
            val hit = heavy.firstOrNull { (word, _) -> key.contains(" ${NameKey.of(word)} ") } ?: continue
            if (lighter.any { key.contains(" ${NameKey.of(it)} ") }) continue
            if (hit.second == RED_MEAT) {
                // Lean red meat is fine on DASH in small portions; an unknown amount counts as a lot.
                redMeatGrams += n.items[i].grams ?: Double.MAX_VALUE
                continue
            }
            found += hit.second
        }
        if (redMeatGrams / servings.coerceAtLeast(1) > RED_MEAT_PER_SERVING_G) found += RED_MEAT
        return DashVerdict(n.sodiumPerServing, found.toList(), n.skipped.size)
    }

    /** The recipe with its DASH check as the first line of the text. */
    fun annotate(recipe: ImportedRecipe): ImportedRecipe {
        val ingredients = IngredientParser.parseRecipe(recipe.text)
        if (ingredients.isEmpty()) return recipe
        val note = check(ingredients, recipe.servings).note()
        return recipe.copy(text = "$note\n\n${recipe.text}")
    }
}
