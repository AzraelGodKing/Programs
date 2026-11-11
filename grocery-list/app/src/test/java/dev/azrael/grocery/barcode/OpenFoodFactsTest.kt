package dev.azrael.grocery.barcode

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OpenFoodFactsTest {
    @Test fun readsPerServingSodium() {
        val body = """
            {"code":"051000012616","status":1,"product":{
              "product_name":"Chicken Noodle Soup","brands":"Campbell's, Campbell Soup Company",
              "serving_size":"1/2 cup (120 ml)","serving_quantity":120,
              "nutriments":{"sodium_100g":0.742,"sodium_serving":0.89,"salt_100g":1.855,"potassium_serving":0.05}
            }}
        """.trimIndent()
        val p = OpenFoodFacts.parse("051000012616", body)!!
        assertEquals("Chicken Noodle Soup", p.name)
        assertEquals("Campbell's", p.brand)
        assertEquals("1/2 cup (120 ml)", p.servingSize)
        assertEquals(890, p.sodiumMgPerServing)
        assertEquals(742, p.sodiumMgPer100g)
        assertEquals(50, p.potassiumMgPerServing)
        assertEquals(SodiumLevel.HIGH, p.sodiumLevel)
        assertEquals("Campbell's Chicken Noodle Soup", p.displayName)
    }

    @Test fun fallsBackToSaltAndServingWeight() {
        val body = """
            {"status":1,"product":{"product_name":"Oats","serving_quantity":"40",
              "nutriments":{"salt_100g":0.025}}}
        """.trimIndent()
        val p = OpenFoodFacts.parse("123", body)!!
        assertEquals(10, p.sodiumMgPer100g)
        assertEquals(4, p.sodiumMgPerServing)
        assertEquals(SodiumLevel.LOW, p.sodiumLevel)
    }

    @Test fun missingProduct() {
        assertNull(OpenFoodFacts.parse("1", """{"status":0,"status_verbose":"product not found"}"""))
    }

    @Test fun noNutritionData() {
        val p = OpenFoodFacts.parse("42", """{"status":1,"product":{}}""")!!
        assertEquals("Product 42", p.name)
        assertNull(p.sodiumLevel)
    }

    @Test fun levels() {
        assertEquals(SodiumLevel.LOW, SodiumLevel.of(140, null))
        assertEquals(SodiumLevel.MODERATE, SodiumLevel.of(141, 5000))
        assertEquals(SodiumLevel.HIGH, SodiumLevel.of(460, null))
        assertEquals(SodiumLevel.HIGH, SodiumLevel.of(null, 601))
        assertEquals(SodiumLevel.MODERATE, SodiumLevel.of(null, 300))
        assertNull(SodiumLevel.of(null, null))
    }

    @Test fun cleansBarcodes() {
        assertEquals("0123456789012", OpenFoodFacts.cleanBarcode(" 0 12345 67890 12 "))
        assertNull(OpenFoodFacts.cleanBarcode("1234"))
        assertNull(OpenFoodFacts.cleanBarcode("abc"))
    }
}
