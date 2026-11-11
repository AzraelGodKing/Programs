package dev.azrael.grocery.parse

/**
 * Decides whether a recipe ingredient is something already in the Cabinet.
 * Both sides are NameKey keys. A Cabinet entry matches an ingredient with the same key, or one that
 * ends with it as whole words, so "salt" covers "kosher salt" and "olive oil" covers
 * "extra virgin olive oil". It never matches the other way round: "kosher salt" in the Cabinet
 * doesn't cover plain "salt". The result is only a suggestion; the user can still tick the line.
 */
object CabinetMatch {
    fun matches(ingredientKey: String, cabinetKey: String): Boolean {
        if (cabinetKey.isBlank() || ingredientKey.isBlank()) return false
        return ingredientKey == cabinetKey || ingredientKey.endsWith(" $cabinetKey")
    }

    /** The Cabinet key that covers [ingredientKey], or null. Prefers the longest (most specific) one. */
    fun find(ingredientKey: String, cabinetKeys: Collection<String>): String? =
        cabinetKeys.filter { matches(ingredientKey, it) }.maxByOrNull { it.length }
}
