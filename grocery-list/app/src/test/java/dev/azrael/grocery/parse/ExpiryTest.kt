package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class ExpiryTest {
    private val today = LocalDate.of(2026, 11, 11)
    private fun inDays(n: Long) = today.toEpochDay() + n

    @Test fun labels() {
        assertEquals("Expired 3 days ago", Expiry.label(inDays(-3), today))
        assertEquals("Expired yesterday", Expiry.label(inDays(-1), today))
        assertEquals("Expires today", Expiry.label(inDays(0), today))
        assertEquals("Expires tomorrow", Expiry.label(inDays(1), today))
        assertEquals("Expires in 10 days", Expiry.label(inDays(10), today))
        assertEquals("Expires Dec 11", Expiry.label(inDays(30), today))
        assertEquals("Expires Jan 10, 2027", Expiry.label(inDays(60), today))
    }

    @Test fun soonIsTwoDaysOrPast() {
        assertTrue(Expiry.isSoon(inDays(-5), today))
        assertTrue(Expiry.isSoon(inDays(2), today))
        assertFalse(Expiry.isSoon(inDays(3), today))
        assertFalse(Expiry.isSoon(null, today))
    }

    @Test fun dueSoonSortsSoonestFirst() {
        val due = Expiry.dueSoon(
            listOf(
                Expiry.Due("Spinach", inDays(1)),
                Expiry.Due("Rice", inDays(200)),
                Expiry.Due("Milk", inDays(0)),
                Expiry.Due("Yogurt", inDays(-2)),
            ),
            today,
        )
        assertEquals(listOf("Yogurt", "Milk", "Spinach"), due.map { it.name })
    }

    @Test fun reminderForOneItem() {
        val (title, body) = Expiry.reminderText(listOf(Expiry.Due("Milk", inDays(1))), today)!!
        assertEquals("Milk expires tomorrow", title)
        assertEquals("Milk (tomorrow)", body)
    }

    @Test fun reminderForSeveral() {
        val (title, body) = Expiry.reminderText(
            listOf(Expiry.Due("Yogurt", inDays(-2)), Expiry.Due("Milk", inDays(0)), Expiry.Due("Kale", inDays(2))),
            today,
        )!!
        assertEquals("3 Cabinet items to use soon", title)
        assertEquals("Yogurt (expired), Milk (today), Kale (in 2 days)", body)
    }

    @Test fun noReminderWhenNothingDue() {
        assertNull(Expiry.reminderText(emptyList(), today))
    }
}
