package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class MealPlanTest {
    private fun ing(q: Double?, unit: String?, name: String) = ParsedIngredient(name, q, unit, null, name)

    @Test fun weekStartsOnMonday() {
        assertEquals(LocalDate.of(2026, 11, 9), MealPlan.weekStart(LocalDate.of(2026, 11, 11)))
        assertEquals(LocalDate.of(2026, 11, 9), MealPlan.weekStart(LocalDate.of(2026, 11, 15)))
        assertEquals(LocalDate.of(2026, 11, 9), MealPlan.weekStart(LocalDate.of(2026, 11, 9)))
    }

    @Test fun combinesTheSameIngredientAcrossRecipes() {
        val lines = MealPlan.combine(
            listOf(
                "Chili" to listOf(ing(1.0, null, "onion"), ing(1.0, "cup", "milk"), ing(1.0, "can", "black beans")),
                "Tacos" to listOf(ing(2.0, null, "onions"), ing(4.0, "tbsp", "milk"), ing(1.0, "lb", "black beans")),
            ),
        )
        val onion = lines.single { it.key == NameKey.of("onion") }
        assertEquals(3.0, onion.quantity!!, 1e-9)
        assertEquals(listOf("Chili", "Tacos"), onion.sources)
        val milk = lines.single { it.key == NameKey.of("milk") }
        assertEquals(1.25, milk.quantity!!, 0.01)
        assertEquals("cup", milk.unit)
        // Cans and pounds don't combine.
        assertEquals(2, lines.count { it.key == NameKey.of("black beans") })
    }

    @Test fun sameRecipeTwiceListsItOnce() {
        val meal = "Oats" to listOf(ing(0.5, "cup", "rolled oats"))
        val lines = MealPlan.combine(listOf(meal, meal))
        assertEquals(1.0, lines.single().quantity!!, 1e-9)
        assertEquals(listOf("Oats"), lines.single().sources)
    }
}
