package dev.azrael.grocery.parse

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Expiry dates on Cabinet items, as epoch days (LocalDate.toEpochDay) so they don't shift with time zones.
 * Plain Kotlin so the rules have unit tests.
 */
object Expiry {
    /** Items this many days from expiring, or past it, show as "use soon" and go in the reminder. */
    const val SOON_DAYS = 2

    /** Quick picks in the expiry dialog: label to days from today. */
    val QUICK_PICKS = listOf("3 days" to 3, "1 week" to 7, "2 weeks" to 14, "1 month" to 30)

    fun daysLeft(expiresOn: Long, today: LocalDate): Long = expiresOn - today.toEpochDay()

    fun isSoon(expiresOn: Long?, today: LocalDate): Boolean =
        expiresOn != null && daysLeft(expiresOn, today) <= SOON_DAYS

    /** "Expired 2 days ago", "Expires today", "Expires tomorrow", "Expires in 5 days", "Expires Mar 3". */
    fun label(expiresOn: Long, today: LocalDate): String {
        val days = daysLeft(expiresOn, today)
        return when {
            days < -1 -> "Expired ${-days} days ago"
            days == -1L -> "Expired yesterday"
            days == 0L -> "Expires today"
            days == 1L -> "Expires tomorrow"
            days <= 14 -> "Expires in $days days"
            else -> "Expires " + LocalDate.ofEpochDay(expiresOn).format(
                DateTimeFormatter.ofPattern(
                    if (LocalDate.ofEpochDay(expiresOn).year == today.year) "MMM d" else "MMM d, yyyy",
                    Locale.US,
                ),
            )
        }
    }

    /** Short form for the reminder: "today", "tomorrow", "in 2 days", "expired". */
    fun shortLabel(expiresOn: Long, today: LocalDate): String {
        val days = daysLeft(expiresOn, today)
        return when {
            days < 0 -> "expired"
            days == 0L -> "today"
            days == 1L -> "tomorrow"
            else -> "in $days days"
        }
    }

    data class Due(val name: String, val expiresOn: Long)

    /** The reminder's items: expired or expiring within [SOON_DAYS], soonest first. */
    fun dueSoon(items: List<Due>, today: LocalDate): List<Due> =
        items.filter { isSoon(it.expiresOn, today) }.sortedWith(compareBy({ it.expiresOn }, { it.name.lowercase() }))

    /** Notification text, e.g. title "3 Cabinet items to use soon", body "Milk (today), Spinach (tomorrow), ...". */
    fun reminderText(due: List<Due>, today: LocalDate): Pair<String, String>? {
        if (due.isEmpty()) return null
        val title = if (due.size == 1) {
            "${due[0].name} " + when (val d = daysLeft(due[0].expiresOn, today)) {
                in Long.MIN_VALUE..-1L -> "has expired"
                0L -> "expires today"
                1L -> "expires tomorrow"
                else -> "expires in $d days"
            }
        } else {
            "${due.size} Cabinet items to use soon"
        }
        val body = due.joinToString(", ") { "${it.name} (${shortLabel(it.expiresOn, today)})" }
        return title to body
    }
}
