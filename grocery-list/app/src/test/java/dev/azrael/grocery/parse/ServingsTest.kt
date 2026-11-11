package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServingsTest {
    @Test fun detectsCommonYieldLines() {
        assertEquals(4, Servings.detect("Lemon chicken\nServes 4\n\nIngredients"))
        assertEquals(6, Servings.detect("Servings: 6"))
        assertEquals(8, Servings.detect("Makes 8 servings"))
        assertEquals(4, Servings.detect("Yield: 4-6"))
        assertEquals(2, Servings.detect("Enough for 2 people"))
        assertNull(Servings.detect("1 cup rice\n2 cups water"))
    }

    private fun ing(q: Double?, unit: String?, name: String) = ParsedIngredient(name, q, unit, null, name)

    @Test fun doublesMeasuredAmountsAndSimplifies() {
        val r = Servings.scale(listOf(ing(1.5, "tsp", "cumin"), ing(0.5, "cup", "rice")), 2, 4)
        assertEquals(1.0, r[0].quantity!!, 0.01)
        assertEquals("tbsp", r[0].unit)
        assertEquals(1.0, r[1].quantity!!, 0.01)
        assertEquals("cup", r[1].unit)
    }

    @Test fun wholeItemsRoundUp() {
        val r = Servings.scale(listOf(ing(1.0, "can", "black beans"), ing(3.0, null, "eggs")), 4, 6)
        assertEquals(2.0, r[0].quantity!!, 1e-9)
        assertEquals(5.0, r[1].quantity!!, 1e-9)
    }

    @Test fun halvingKeepsAtLeastOne() {
        val r = Servings.scale(listOf(ing(1.0, null, "onion"), ing(1.0, "lb", "chicken breast")), 4, 2)
        assertEquals(1.0, r[0].quantity!!, 1e-9)
        assertEquals(0.5, r[1].quantity!!, 1e-9)
    }

    @Test fun noAmountStaysAsIs() {
        val salt = ing(null, null, "salt")
        assertEquals(salt, Servings.scale(listOf(salt), 4, 8)[0])
    }
}
