package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Test

class AislesTest {
    @Test fun movesASection() {
        val o = StoreOrder().move(Category.entries.indexOf(Category.DAIRY), 0)
        assertEquals(Category.DAIRY, o.sections.first())
        assertEquals(Category.entries.size, o.sections.size)
        assertEquals(1, o.rank(Category.PRODUCE))
    }

    @Test fun decodeKeepsOrderAndAddsMissingSections() {
        val s = StoreOrder.decodeSections("FROZEN,BOGUS,PRODUCE,FROZEN")
        assertEquals(listOf(Category.FROZEN, Category.PRODUCE), s.take(2))
        assertEquals(Category.entries.toSet(), s.toSet())
        assertEquals(Category.entries.size, s.size)
        assertEquals(Category.entries, StoreOrder.decodeSections(null))
    }

    @Test fun rememberedRoundTrips() {
        val m = mapOf(NameKey.of("tofu") to Category.PRODUCE, "a=b" to Category.FROZEN)
        assertEquals(m, StoreOrder.decodeRemembered(StoreOrder.encodeRemembered(m)))
    }

    @Test fun rememberedSectionWinsOverGuess() {
        assertEquals(Category.DAIRY, StoreOrder().sectionFor("Tofu", null))
        val o = StoreOrder(remembered = mapOf(NameKey.of("tofu") to Category.PRODUCE))
        assertEquals(Category.PRODUCE, o.sectionFor("tofu", null))
    }

    @Test fun headerShowsAisle() {
        val o = StoreOrder(aisles = mapOf(Category.PRODUCE to "Aisle 1", Category.DAIRY to " "))
        assertEquals("Produce · Aisle 1", o.header(Category.PRODUCE))
        assertEquals("Dairy & Eggs", o.header(Category.DAIRY))
    }
}
