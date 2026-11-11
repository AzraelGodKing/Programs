package dev.azrael.grocery.parse

data class Amount(val quantity: Double?, val unit: String?)

object Merge {
    /**
     * Adds [incoming] onto [existing] when the two can be expressed in one unit, e.g.
     * 1 cup + 4 tbsp = 1 1/4 cups. Returns null when they can't be combined (2 cans + 1 lb),
     * in which case the caller keeps them as separate lines.
     */
    fun combine(existing: Amount, incoming: Amount): Amount? {
        val sum: Amount = when {
            existing.unit == incoming.unit -> Amount(add(existing.quantity, incoming.quantity), existing.unit)
            // "salt" + "1 tsp salt": the bare entry carries no amount, keep the precise one.
            existing.quantity == null && existing.unit == null -> incoming
            incoming.quantity == null && incoming.unit == null -> existing
            existing.quantity == null || incoming.quantity == null -> return null
            else -> {
                val converted = Units.convert(incoming.quantity, incoming.unit, existing.unit) ?: return null
                Amount(existing.quantity + converted, existing.unit)
            }
        }
        val q = sum.quantity ?: return sum
        val (sq, su) = Units.simplify(q, sum.unit)
        return Amount(sq, su)
    }

    private fun add(a: Double?, b: Double?): Double? = when {
        a == null -> b
        b == null -> a
        else -> a + b
    }
}
