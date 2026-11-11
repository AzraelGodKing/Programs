package dev.azrael.grocery.parse

/**
 * How your store is laid out: the order you walk the sections in, an optional aisle label for
 * each ("Aisle 4", "Back wall"), and sections you moved items into by hand, remembered by item.
 */
data class StoreOrder(
    val sections: List<Category> = Category.entries,
    val aisles: Map<Category, String> = emptyMap(),
    /** NameKey key -> section, from items you moved to another section. */
    val remembered: Map<String, Category> = emptyMap(),
) {
    fun rank(category: Category): Int = sections.indexOf(category).let { if (it < 0) sections.size else it }

    /** "Produce · Aisle 1", or just "Produce". */
    fun header(category: Category): String =
        aisles[category]?.trim()?.takeIf { it.isNotEmpty() }?.let { "${category.label} · $it" } ?: category.label

    /** The section for a new line: one you picked for this item before, else the built-in guess. */
    fun sectionFor(name: String, unit: String?): Category =
        remembered[NameKey.of(name)] ?: Categorizer.categorize(name, unit)

    fun move(from: Int, to: Int): StoreOrder {
        if (from !in sections.indices || to !in sections.indices || from == to) return this
        val list = sections.toMutableList()
        list.add(to, list.removeAt(from))
        return copy(sections = list)
    }

    companion object {
        /** Reads a saved order; unknown names drop out and sections added in later builds go at the end. */
        fun decodeSections(saved: String?): List<Category> {
            val known = saved.orEmpty().split(',').mapNotNull { n -> Category.entries.firstOrNull { it.name == n.trim() } }.distinct()
            return known + Category.entries.filter { it !in known }
        }

        fun encodeSections(sections: List<Category>): String = sections.joinToString(",") { it.name }

        /** "key=CATEGORY" entries, as kept in a string set. */
        fun decodeRemembered(saved: Set<String>?): Map<String, Category> = saved.orEmpty().mapNotNull { e ->
            val at = e.lastIndexOf('=')
            if (at <= 0) return@mapNotNull null
            val cat = Category.entries.firstOrNull { it.name == e.substring(at + 1) } ?: return@mapNotNull null
            e.substring(0, at) to cat
        }.toMap()

        fun encodeRemembered(map: Map<String, Category>): Set<String> = map.map { (k, v) -> "$k=${v.name}" }.toSet()
    }
}
