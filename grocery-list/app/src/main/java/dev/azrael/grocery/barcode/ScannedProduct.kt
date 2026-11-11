package dev.azrael.grocery.barcode

import org.json.JSONObject
import kotlin.math.roundToInt

/** How salty a packaged food is, from its label. */
enum class SodiumLevel(val label: String) {
    LOW("Low sodium"),
    MODERATE("Moderate sodium"),
    HIGH("High sodium");

    companion object {
        /**
         * Per serving, FDA rules: 140 mg or less is "low sodium", 20% of the daily value (460 mg) or more is high.
         * Without a serving size, per 100 g, UK traffic-light rules: 120 mg or less is low, over 600 mg is high.
         * Null when the label has no sodium at all.
         */
        fun of(perServingMg: Int?, per100gMg: Int?): SodiumLevel? = when {
            perServingMg != null -> when {
                perServingMg <= 140 -> LOW
                perServingMg >= 460 -> HIGH
                else -> MODERATE
            }
            per100gMg != null -> when {
                per100gMg <= 120 -> LOW
                per100gMg > 600 -> HIGH
                else -> MODERATE
            }
            else -> null
        }
    }
}

/** A product looked up by barcode. Amounts are in mg; null when the label doesn't say. */
data class ScannedProduct(
    val barcode: String,
    val name: String,
    val brand: String? = null,
    /** As printed, e.g. "1 cup (240 ml)". */
    val servingSize: String? = null,
    val sodiumMgPerServing: Int? = null,
    val sodiumMgPer100g: Int? = null,
    val potassiumMgPerServing: Int? = null,
) {
    val sodiumLevel: SodiumLevel? get() = SodiumLevel.of(sodiumMgPerServing, sodiumMgPer100g)

    /** "Brand Name" for display, without repeating a brand already in the name. */
    val displayName: String
        get() = if (brand == null || name.contains(brand, ignoreCase = true)) name else "$brand $name"
}

/** Reads Open Food Facts' product API (v2) response. Free, no key; https://openfoodfacts.github.io/openfoodfacts-server/api/ */
object OpenFoodFacts {
    /** Only the fields the app uses, to keep the response small. */
    const val FIELDS = "code,product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments"

    fun productUrl(barcode: String) =
        "https://world.openfoodfacts.org/api/v2/product/$barcode.json?fields=$FIELDS"

    /** Keeps digits only; barcodes are 8, 12, 13 or 14 digits. Returns null for anything else. */
    fun cleanBarcode(raw: String): String? = raw.filter(Char::isDigit).takeIf { it.length in 8..14 }

    /** Null when the product isn't in the database. */
    fun parse(barcode: String, body: String): ScannedProduct? {
        val root = JSONObject(body)
        if (root.optInt("status", 0) != 1) return null
        val p = root.optJSONObject("product") ?: return null
        val n = p.optJSONObject("nutriments") ?: JSONObject()

        val name = listOf("product_name_en", "product_name", "generic_name")
            .map { p.optString(it).trim() }
            .firstOrNull { it.isNotEmpty() }
            ?: "Product $barcode"
        val brand = p.optString("brands").split(',').map { it.trim() }.firstOrNull { it.isNotEmpty() }
        val servingGrams = p.optDouble("serving_quantity").takeIf { !it.isNaN() && it > 0 }

        // Open Food Facts stores sodium and potassium in grams. Some products only list salt (= sodium x 2.5).
        val sodium100 = grams(n, "sodium_100g") ?: grams(n, "salt_100g")?.div(2.5)
        val sodiumServing = grams(n, "sodium_serving")
            ?: grams(n, "salt_serving")?.div(2.5)
            ?: if (sodium100 != null && servingGrams != null) sodium100 * servingGrams / 100 else null
        val potassiumServing = grams(n, "potassium_serving")
            ?: grams(n, "potassium_100g")?.let { k -> servingGrams?.let { k * it / 100 } }

        return ScannedProduct(
            barcode = barcode,
            name = name,
            brand = brand,
            servingSize = p.optString("serving_size").trim().ifEmpty { null },
            sodiumMgPerServing = sodiumServing?.let { (it * 1000).roundToInt() },
            sodiumMgPer100g = sodium100?.let { (it * 1000).roundToInt() },
            potassiumMgPerServing = potassiumServing?.let { (it * 1000).roundToInt() },
        )
    }

    private fun grams(n: JSONObject, key: String): Double? {
        if (!n.has(key)) return null
        return n.optDouble(key).takeIf { !it.isNaN() && it >= 0 }
    }
}
