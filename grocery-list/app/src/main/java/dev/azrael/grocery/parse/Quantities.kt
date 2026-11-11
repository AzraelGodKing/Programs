package dev.azrael.grocery.parse

import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToLong

object Quantities {
    private val unicodeFractions = mapOf(
        '½' to "1/2", '⅓' to "1/3", '⅔' to "2/3", '¼' to "1/4", '¾' to "3/4",
        '⅕' to "1/5", '⅖' to "2/5", '⅗' to "3/5", '⅘' to "4/5", '⅙' to "1/6", '⅚' to "5/6",
        '⅛' to "1/8", '⅜' to "3/8", '⅝' to "5/8", '⅞' to "7/8",
    )

    /** Turns "1½" into "1 1/2" and "⅓" into "1/3" so the parser only has to understand ASCII. */
    fun normalizeFractions(text: String): String = buildString {
        for (ch in text) {
            val f = unicodeFractions[ch]
            if (f != null) {
                if (isNotEmpty() && last().isDigit()) append(' ')
                append(f)
            } else if (ch == '⁄') {
                append('/')
            } else {
                append(ch)
            }
        }
    }

    /** Parses "2", "1.5", ".5", "3/4" or "1 1/2". */
    fun parse(text: String): Double? {
        val parts = text.trim().split(Regex("\\s+"))
        var total = 0.0
        for (p in parts) {
            total += if (p.contains('/')) {
                val (n, d) = p.split('/').map { it.toDoubleOrNull() ?: return null }
                if (d == 0.0) return null
                n / d
            } else {
                p.toDoubleOrNull() ?: return null
            }
        }
        return total
    }

    private val niceFractions = listOf(
        1.0 / 8 to "1/8", 1.0 / 4 to "1/4", 1.0 / 3 to "1/3", 3.0 / 8 to "3/8", 1.0 / 2 to "1/2",
        5.0 / 8 to "5/8", 2.0 / 3 to "2/3", 3.0 / 4 to "3/4", 7.0 / 8 to "7/8",
    )

    /** Formats 1.5 as "1 1/2", 0.333 as "1/3", 2.0 as "2" and 1.37 as "1.37". */
    fun format(q: Double): String {
        val whole = floor(q)
        val frac = q - whole
        if (frac < 0.02) return whole.roundToLong().toString()
        if (frac > 0.98) return (whole + 1).roundToLong().toString()
        niceFractions.firstOrNull { abs(it.first - frac) < 0.02 }?.let { (_, label) ->
            return if (whole == 0.0) label else "${whole.roundToLong()} $label"
        }
        return String.format(Locale.US, "%.2f", q).trimEnd('0').trimEnd('.')
    }
}

/** "1 1/2 cups", "3", "pinch" or "" when there's no amount at all. */
fun formatAmount(quantity: Double?, unit: String?): String {
    val q = quantity?.let { Quantities.format(it) }
    val u = Units.display(unit, quantity).ifEmpty { null }
    return listOfNotNull(q, u).joinToString(" ")
}
