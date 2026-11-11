package dev.azrael.grocery.nutrition

import dev.azrael.grocery.parse.IngredientParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RecipeNutritionTest {
    private fun line(text: String) = RecipeNutritionEstimator.estimate(IngredientParser.parseLine(text)!!)

    @Test fun findsLongestMatch() {
        assertEquals(NutrientTable.find("chicken broth"), NutrientTable.find("low-sodium chicken broth"))
        assertEquals("vegetable broth", NutrientTable.find("low sodium vegetable broth")!!.label)
        assertEquals("bell pepper", NutrientTable.find("red bell pepper")!!.label)
        assertEquals("pepper", NutrientTable.find("black pepper")!!.label)
        assertEquals("unsalted butter", NutrientTable.find("unsalted butter")!!.label)
        assertEquals("kosher salt", NutrientTable.find("Kosher salt")!!.label)
        assertNull(NutrientTable.find("dragonfruit"))
    }

    @Test fun teaspoonOfSaltIsAbout2300mg() {
        val n = line("1 tsp salt")
        assertEquals(2325.0, n.sodiumMg!!, 60.0)
    }

    @Test fun lowSodiumBrothIsMuchLower() {
        val regular = line("2 cups chicken broth").sodiumMg!!
        val low = line("2 cups low-sodium chicken broth").sodiumMg!!
        assertEquals(1780.0, regular, 100.0)
        assertTrue(low < regular / 4)
    }

    @Test fun cannedBeansUseCanSizeAndRinsing() {
        val plain = line("1 can black beans").sodiumMg!!
        val sized = line("1 (15 oz) can black beans, drained and rinsed").sodiumMg!!
        assertEquals(425 * 3.0, plain, 1.0)
        assertTrue(sized < plain)
        val noSalt = line("1 (15 oz) can no-salt-added black beans, drained and rinsed").sodiumMg!!
        assertTrue(noSalt < 100)
    }

    @Test fun cannedTomatoesNotFresh() {
        assertEquals("canned tomato", line("1 can diced tomatoes").matched)
        assertEquals("tomato", line("2 tomatoes").matched)
    }

    @Test fun countsAndWeights() {
        assertEquals(9.0, line("3 cloves garlic").grams!!, 0.01)
        assertEquals(453.592, line("1 lb ground turkey").grams!!, 0.01)
        assertEquals(400.0, line("2 chicken breasts").grams!!, 0.01)
        assertEquals(236.0, line("2 bananas").grams!!, 0.01)
    }

    @Test fun saltToTasteIsSkipped() {
        val n = line("Salt and pepper to taste")
        assertFalse(n.counted)
        val salt = line("salt, to taste")
        assertFalse(salt.counted)
        assertEquals("no amount given", salt.skippedReason)
    }

    @Test fun pinchWithoutNumber() {
        val n = line("pinch of salt")
        assertNotNull(n.sodiumMg)
        assertEquals(145.0, n.sodiumMg!!, 20.0)
    }

    @Test fun wholeRecipePerServing() {
        val text = """
            Serves 4
            Ingredients
            1 lb boneless skinless chicken breasts
            2 cups low-sodium chicken broth
            1 (15 oz) can no-salt-added black beans, rinsed
            1 tbsp olive oil
            1/2 tsp kosher salt
            2 cups spinach
            Instructions
            Cook it.
        """.trimIndent()
        val servings = RecipeServings.detect(text)!!
        assertEquals(4, servings)
        val r = RecipeNutritionEstimator.estimate(IngredientParser.parseRecipe(text), servings.toDouble())
        assertTrue(r.skipped.isEmpty())
        assertEquals("kosher salt", r.topSodium.first().matched)
        // Sodium: ~570 mg salt + ~260 broth + ~200 chicken + ~50 beans + ~47 spinach over 4 servings.
        // Potassium is high: chicken, beans and spinach are all good sources.
        assertTrue("got ${r.sodiumPerServing}", r.sodiumPerServing in 250..350)
        assertTrue("got ${r.potassiumPerServing}", r.potassiumPerServing in 800..1100)
    }

    @Test fun detectsServings() {
        assertEquals(6, RecipeServings.detect("Servings: 6"))
        assertEquals(8, RecipeServings.detect("Yield: 8 servings"))
        assertEquals(4, RecipeServings.detect("Makes 4 servings"))
        assertEquals(2, RecipeServings.detect("Dinner for 2 people"))
        assertNull(RecipeServings.detect("2 cups rice"))
    }

    @Test fun sizeFromNote() {
        assertEquals(425.24, RecipeNutritionEstimator.sizeFromNote("15 oz")!!, 0.1)
        assertEquals(411.07, RecipeNutritionEstimator.sizeFromNote("14.5-ounce")!!, 0.1)
        assertEquals(400.0, RecipeNutritionEstimator.sizeFromNote("400g")!!, 0.01)
        assertNull(RecipeNutritionEstimator.sizeFromNote("drained"))
    }
}
