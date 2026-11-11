package dev.azrael.grocery.nutrition

/** Reads "Serves 4", "Servings: 6", "Yield: 8 servings" or "Makes 4 servings" out of recipe text. */
object RecipeServings {
    private val patterns = listOf(
        Regex("\\b(?:serves|servings|serving size|yield|yields)\\s*:?\\s*(\\d{1,2})\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(?:makes|for)\\s+(\\d{1,2})\\s+(?:servings|portions|people)\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(\\d{1,2})\\s+(?:servings|portions)\\b", RegexOption.IGNORE_CASE),
    )

    fun detect(text: String): Int? = patterns.firstNotNullOfOrNull { p ->
        p.find(text)?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 1..50 }
    }
}
