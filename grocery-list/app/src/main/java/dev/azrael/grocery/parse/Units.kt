package dev.azrael.grocery.parse

/** Families of units that can be converted into each other. */
enum class UnitFamily { VOLUME, WEIGHT, COUNT }

data class UnitDef(
    val canonical: String,
    val family: UnitFamily,
    /** Size in the family's base unit (ml for volume, g for weight). 1.0 for count units. */
    val toBase: Double,
    val plural: String = canonical,
)

object Units {
    private val defs = listOf(
        UnitDef("tsp", UnitFamily.VOLUME, 4.92892),
        UnitDef("tbsp", UnitFamily.VOLUME, 14.7868),
        UnitDef("fl oz", UnitFamily.VOLUME, 29.5735),
        UnitDef("cup", UnitFamily.VOLUME, 236.588, "cups"),
        UnitDef("pint", UnitFamily.VOLUME, 473.176, "pints"),
        UnitDef("quart", UnitFamily.VOLUME, 946.353, "quarts"),
        UnitDef("gallon", UnitFamily.VOLUME, 3785.41, "gallons"),
        UnitDef("ml", UnitFamily.VOLUME, 1.0),
        UnitDef("l", UnitFamily.VOLUME, 1000.0),
        UnitDef("g", UnitFamily.WEIGHT, 1.0),
        UnitDef("kg", UnitFamily.WEIGHT, 1000.0),
        UnitDef("oz", UnitFamily.WEIGHT, 28.3495),
        UnitDef("lb", UnitFamily.WEIGHT, 453.592),
    ) + listOf(
        "clove", "can", "jar", "package", "bunch", "slice", "piece", "stalk", "sprig",
        "head", "pinch", "dash", "handful", "bag", "box", "bottle", "container", "packet",
        "stick", "sheet", "fillet", "breast", "thigh", "loaf", "ear", "leaf",
    ).map { UnitDef(it, UnitFamily.COUNT, 1.0, pluralOf(it)) }

    private val byCanonical = defs.associateBy { it.canonical }

    /** Case-sensitive aliases checked first (T = tablespoon, t = teaspoon). */
    private val caseSensitive = mapOf("T" to "tbsp", "Tbsp" to "tbsp", "Tb" to "tbsp", "t" to "tsp")

    private val aliases: Map<String, String> = buildMap {
        fun add(canonical: String, vararg names: String) = names.forEach { put(it, canonical) }
        add("tsp", "tsp", "tsps", "teaspoon", "teaspoons", "tspn")
        add("tbsp", "tbsp", "tbsps", "tbs", "tbl", "tbls", "tablespoon", "tablespoons")
        add("fl oz", "fl oz", "fl. oz", "fluid ounce", "fluid ounces", "floz")
        add("cup", "c", "cup", "cups")
        add("pint", "pt", "pts", "pint", "pints")
        add("quart", "qt", "qts", "quart", "quarts")
        add("gallon", "gal", "gals", "gallon", "gallons")
        add("ml", "ml", "mls", "milliliter", "milliliters", "millilitre", "millilitres")
        add("l", "l", "liter", "liters", "litre", "litres")
        add("g", "g", "gr", "gram", "grams")
        add("kg", "kg", "kgs", "kilogram", "kilograms")
        add("oz", "oz", "ounce", "ounces")
        add("lb", "lb", "lbs", "pound", "pounds")
        add("leaf", "leaf", "leaves")
        add("loaf", "loaf", "loaves")
        add("bunch", "bunch", "bunches")
        add("dash", "dash", "dashes")
        add("pinch", "pinch", "pinches")
        add("box", "box", "boxes")
        add("package", "pkg", "pkgs", "package", "packages")
        defs.filter { it.family == UnitFamily.COUNT }.forEach {
            putIfAbsent(it.canonical, it.canonical)
            putIfAbsent(it.plural, it.canonical)
        }
    }

    /** Returns the canonical unit for a token like "Tbsp." or "cups", or null if it isn't a unit. */
    fun lookup(token: String): String? {
        val trimmed = token.trimEnd('.')
        caseSensitive[trimmed]?.let { return it }
        return aliases[trimmed.lowercase()]
    }

    fun def(canonical: String?): UnitDef? = canonical?.let { byCanonical[it] }

    fun display(unit: String?, quantity: Double?): String {
        if (unit == null) return ""
        val d = def(unit) ?: return unit
        return if (quantity != null && quantity > 1.0001) d.plural else d.canonical
    }

    /**
     * Converts [quantity] in [from] into [to]. Returns null when the units can't be converted
     * (different families, or two different count units like "can" and "jar").
     */
    fun convert(quantity: Double, from: String?, to: String?): Double? {
        if (from == to) return quantity
        val a = def(from) ?: return null
        val b = def(to) ?: return null
        if (a.family != b.family || a.family == UnitFamily.COUNT) return null
        return quantity * a.toBase / b.toBase
    }

    /** Moves a quantity into a friendlier unit after summing, e.g. 6 tsp -> 2 tbsp, 20 oz -> 1.25 lb. */
    fun simplify(quantity: Double, unit: String?): Pair<Double, String?> {
        val promotions = listOf("tsp" to "tbsp", "tbsp" to "cup", "oz" to "lb", "g" to "kg", "ml" to "l")
        val threshold = mapOf("tsp" to 3.0, "tbsp" to 4.0, "oz" to 16.0, "g" to 1000.0, "ml" to 1000.0)
        var q = quantity
        var u = unit
        while (true) {
            val next = promotions.firstOrNull { it.first == u }?.second ?: break
            if (q < (threshold[u] ?: break) - 1e-9) break
            q = convert(q, u, next) ?: break
            u = next
        }
        return q to u
    }

    private fun pluralOf(word: String): String = when {
        word.endsWith("ch") || word.endsWith("sh") || word.endsWith("x") -> word + "es"
        word.endsWith("f") -> word.dropLast(1) + "ves"
        else -> word + "s"
    }
}
