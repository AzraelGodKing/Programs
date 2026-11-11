package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MergeTest {
    @Test fun sameUnitAdds() {
        val r = Merge.combine(Amount(2.0, "cup"), Amount(1.0, "cup"))!!
        assertEquals(3.0, r.quantity!!, 1e-9)
        assertEquals("cup", r.unit)
    }

    @Test fun convertsIntoExistingUnit() {
        val r = Merge.combine(Amount(1.0, "cup"), Amount(4.0, "tbsp"))!!
        assertEquals(1.25, r.quantity!!, 0.01)
        assertEquals("cup", r.unit)
    }

    @Test fun promotesAfterSumming() {
        val r = Merge.combine(Amount(2.0, "tsp"), Amount(1.0, "tsp"))!!
        assertEquals("tbsp", r.unit)
        assertEquals(1.0, r.quantity!!, 0.01)
    }

    @Test fun countsWithoutUnitAdd() {
        val r = Merge.combine(Amount(2.0, null), Amount(1.0, null))!!
        assertEquals(3.0, r.quantity!!, 1e-9)
    }

    @Test fun bareEntryTakesTheAmount() {
        val r = Merge.combine(Amount(null, null), Amount(1.0, "tsp"))!!
        assertEquals(1.0, r.quantity!!, 1e-9)
        assertEquals("tsp", r.unit)
    }

    @Test fun incompatibleStaysSeparate() {
        assertNull(Merge.combine(Amount(2.0, "can"), Amount(1.0, "lb")))
        assertNull(Merge.combine(Amount(1.0, "cup"), Amount(8.0, "oz")))
    }
}
