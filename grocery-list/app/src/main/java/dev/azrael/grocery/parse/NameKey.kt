package dev.azrael.grocery.parse

/** Builds a matching key so "2 large Eggs" and "1 egg" end up on the same grocery line. */
object NameKey {
    private val ignored = setOf(
        "large", "medium", "small", "fresh", "freshly", "chopped", "minced", "diced", "sliced",
        "finely", "roughly", "thinly", "whole", "raw", "organic", "ripe", "peeled", "about",
    )

    fun of(name: String): String = name.lowercase()
        .replace(Regex("[^a-z0-9 ]"), " ")
        .split(' ')
        .filter { it.isNotBlank() && it !in ignored }
        .joinToString(" ") { singular(it) }

    private fun singular(word: String): String = when {
        word.length <= 3 -> word
        word.endsWith("ies") -> word.dropLast(3) + "y"
        word.endsWith("oes") -> word.dropLast(2)
        word.endsWith("ches") || word.endsWith("shes") -> word.dropLast(2)
        word.endsWith("ss") || word.endsWith("us") -> word
        word.endsWith("s") -> word.dropLast(1)
        else -> word
    }
}
