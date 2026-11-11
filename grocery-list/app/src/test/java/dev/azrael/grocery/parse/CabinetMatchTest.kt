package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CabinetMatchTest {
    private fun key(s: String) = NameKey.of(s)

    @Test fun sameItemMatches() {
        assertTrue(CabinetMatch.matches(key("2 large Eggs"), key("egg")))
        assertTrue(CabinetMatch.matches(key("garlic cloves"), key("Garlic clove")))
    }

    @Test fun cabinetCoversMoreSpecificIngredient() {
        assertTrue(CabinetMatch.matches(key("kosher salt"), key("salt")))
        assertTrue(CabinetMatch.matches(key("extra virgin olive oil"), key("olive oil")))
    }

    @Test fun notTheOtherWayRound() {
        assertFalse(CabinetMatch.matches(key("salt"), key("kosher salt")))
    }

    @Test fun partialWordsDontMatch() {
        // "oil" is the last word of "olive oil", but "boil" or "soil" must not count.
        assertFalse(CabinetMatch.matches(key("broil"), key("oil")))
        assertFalse(CabinetMatch.matches(key("salt free seasoning"), key("salt")))
    }

    @Test fun findPrefersMostSpecific() {
        val keys = listOf(key("oil"), key("olive oil"), key("rice"))
        assertEquals(key("olive oil"), CabinetMatch.find(key("extra virgin olive oil"), keys))
        assertNull(CabinetMatch.find(key("chicken breast"), keys))
    }

    @Test fun blankNeverMatches() {
        assertFalse(CabinetMatch.matches(key("salt"), ""))
    }
}
