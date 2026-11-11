package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UnitsTest {
    @Test fun convertsWithinFamily() {
        assertEquals(3.0, Units.convert(1.0, "tbsp", "tsp")!!, 0.01)
        assertEquals(16.0, Units.convert(1.0, "lb", "oz")!!, 0.01)
    }

    @Test fun refusesAcrossFamilies() {
        assertNull(Units.convert(1.0, "cup", "lb"))
        assertNull(Units.convert(1.0, "can", "jar"))
    }

    @Test fun simplifyPromotes() {
        val (q, u) = Units.simplify(6.0, "tsp")
        assertEquals("tbsp", u)
        assertEquals(2.0, q, 0.01)
        val (q2, u2) = Units.simplify(24.0, "oz")
        assertEquals("lb", u2)
        assertEquals(1.5, q2, 0.01)
        assertEquals("tsp", Units.simplify(2.0, "tsp").second)
    }

    @Test fun formatsFractions() {
        assertEquals("1 1/2", Quantities.format(1.5))
        assertEquals("1/3", Quantities.format(1.0 / 3))
        assertEquals("2", Quantities.format(2.0))
        assertEquals("1.45", Quantities.format(1.45))
    }
}
