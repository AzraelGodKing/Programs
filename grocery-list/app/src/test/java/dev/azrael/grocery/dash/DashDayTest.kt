package dev.azrael.grocery.dash

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class DashDayTest {
    private val monday = LocalDate.of(2026, 11, 9).toEpochDay()

    private fun fullDay() = mapOf(
        DashGroup.VEGETABLES to 4, DashGroup.FRUITS to 4, DashGroup.GRAINS to 6, DashGroup.DAIRY to 2,
    )

    @Test fun encodeRoundTrips() {
        val m = mapOf(DashGroup.VEGETABLES to 3, DashGroup.SWEETS to 1)
        assertEquals(m, DashDay.decode(DashDay.encode(m)))
        assertEquals("", DashDay.encode(mapOf(DashGroup.FRUITS to 0)))
    }

    @Test fun decodeSkipsJunk() {
        assertEquals(mapOf(DashGroup.FRUITS to 2), DashDay.decode("FRUITS=2,BOGUS=4,GRAINS=x,DAIRY=0,=,"))
        assertEquals(emptyMap<DashGroup, Int>(), DashDay.decode(null))
    }

    @Test fun statusForGoalsAndLimits() {
        assertEquals(GroupStatus.NOT_YET, DashDay.status(DashGroup.VEGETABLES, 0))
        assertEquals(GroupStatus.ON_TRACK, DashDay.status(DashGroup.VEGETABLES, 2))
        assertEquals(GroupStatus.MET, DashDay.status(DashGroup.VEGETABLES, 5))
        assertEquals(GroupStatus.OVER, DashDay.status(DashGroup.VEGETABLES, 6))
        assertEquals(GroupStatus.ON_TRACK, DashDay.status(DashGroup.PROTEIN, 6))
        assertEquals(GroupStatus.OVER, DashDay.status(DashGroup.PROTEIN, 7))
    }

    @Test fun weekStartsMonday() {
        val sunday = monday + 6
        assertEquals(monday..sunday, DashDay.weekOf(sunday))
        assertEquals(monday..sunday, DashDay.weekOf(monday))
    }

    @Test fun weeklyGroupsAddUpAcrossTheWeek() {
        val log = mapOf(monday to mapOf(DashGroup.NUTS to 2), monday + 3 to mapOf(DashGroup.NUTS to 2), monday + 7 to mapOf(DashGroup.NUTS to 9))
        assertEquals(4, DashDay.countFor(log, monday + 5, DashGroup.NUTS))
        assertEquals(9, DashDay.countFor(log, monday + 7, DashGroup.NUTS))
    }

    @Test fun scoreAndDashDay() {
        assertEquals(0, DashDay.score(emptyMap(), monday))
        val log = mapOf(monday to fullDay())
        assertEquals(100, DashDay.score(log, monday))
        assertTrue(DashDay.isDashDay(log, monday))
        val over = mapOf(monday to fullDay() + (DashGroup.PROTEIN to 8))
        assertEquals(90, DashDay.score(over, monday))
        assertFalse(DashDay.isDashDay(over, monday))
        val half = mapOf(monday to mapOf(DashGroup.VEGETABLES to 2, DashGroup.FRUITS to 4, DashGroup.GRAINS to 6, DashGroup.DAIRY to 2))
        assertEquals(87, DashDay.score(half, monday))
    }

    @Test fun streakIgnoresAnUnfinishedToday() {
        val log = mapOf(monday to fullDay(), monday + 1 to fullDay(), monday + 2 to mapOf(DashGroup.FRUITS to 1))
        assertEquals(2, DashDay.streak(log, monday + 2))
        assertEquals(3, DashDay.streak(log + (monday + 2 to fullDay()), monday + 2))
        assertEquals(0, DashDay.streak(log, monday + 4))
    }

    @Test fun nextUpIsTheFurthestBehind() {
        val log = mapOf(monday to mapOf(DashGroup.VEGETABLES to 3, DashGroup.FRUITS to 4, DashGroup.GRAINS to 6, DashGroup.DAIRY to 2))
        // Vegetables 1/4 behind, nuts 4/4 behind for the week.
        assertEquals(DashGroup.NUTS, DashDay.nextUp(log, monday))
        val done = mapOf(monday to fullDay() + (DashGroup.NUTS to 4))
        assertNull(DashDay.nextUp(done, monday))
    }
}
