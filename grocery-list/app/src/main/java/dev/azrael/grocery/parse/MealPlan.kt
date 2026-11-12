package dev.azrael.grocery.parse

import java.time.DayOfWeek
import java.time.LocalDate

/** One line of a combined shopping list built from several recipes. */
data class CombinedLine(
    val name: String,
    val quantity: Double?,
    val unit: String?,
    val note: String?,
    /** Recipe names this line is for, in plan order. */
    val sources: List<String>,
) {
    val key: String get() = NameKey.of(name)
}

/** Plain-Kotlin helpers for the weekly meal plan. */
object MealPlan {
    /** The Monday of the week holding [day]. */
    fun weekStart(day: LocalDate): LocalDate = day.with(DayOfWeek.MONDAY)

    /**
     * Folds the (already scaled) ingredients of each planned meal into one list, combining the same
     * ingredient across recipes the way the grocery list does (1 cup + 4 tbsp milk = 1 1/4 cups).
     * Amounts that can't be combined (2 cans + 1 lb) stay as separate lines.
     */
    fun combine(meals: List<Pair<String, List<ParsedIngredient>>>): List<CombinedLine> {
        val lines = mutableListOf<CombinedLine>()
        for ((source, ingredients) in meals) {
            for (ing in ingredients) {
                val key = NameKey.of(ing.name)
                val at = lines.indexOfFirst { line ->
                    line.key == key && Merge.combine(Amount(line.quantity, line.unit), Amount(ing.quantity, ing.unit)) != null
                }
                if (at < 0) {
                    lines += CombinedLine(ing.name, ing.quantity, ing.unit, ing.note, listOf(source))
                } else {
                    val line = lines[at]
                    val sum = Merge.combine(Amount(line.quantity, line.unit), Amount(ing.quantity, ing.unit))!!
                    lines[at] = line.copy(
                        quantity = sum.quantity,
                        unit = sum.unit,
                        note = listOfNotNull(line.note, ing.note).distinct().joinToString("; ").ifEmpty { null },
                        sources = (line.sources + source).distinct(),
                    )
                }
            }
        }
        return lines
    }
}
