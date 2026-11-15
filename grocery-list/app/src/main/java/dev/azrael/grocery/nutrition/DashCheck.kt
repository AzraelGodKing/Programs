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
        "steak" to "red meat",
        "beef" to "red meat",
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
        for (ing in ingredients) {
            val key = " ${NameKey.of(ing.name)} "
            if (notReally.any { key.contains(" ${NameKey.of(it)} ") }) continue
            val hit = heavy.firstOrNull { (word, _) -> key.contains(" ${NameKey.of(word)} ") } ?: continue
            if (lighter.any { key.contains(" ${NameKey.of(it)} ") }) continue
            found += hit.second
        }
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
