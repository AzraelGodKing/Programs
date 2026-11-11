package dev.azrael.grocery.parse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class IngredientParserTest {
    private fun p(line: String) = IngredientParser.parseLine(line)!!

    @Test fun simpleQuantityAndUnit() {
        val i = p("2 cups low-sodium chicken broth")
        assertEquals(2.0, i.quantity!!, 1e-9)
        assertEquals("cup", i.unit)
        assertEquals("low-sodium chicken broth", i.name)
        assertEquals(Category.PANTRY, i.category)
    }

    @Test fun mixedAndUnicodeFractions() {
        assertEquals(1.5, p("1 1/2 tsp ground cumin").quantity!!, 1e-9)
        assertEquals(1.5, p("1½ tsp ground cumin").quantity!!, 1e-9)
        assertEquals(0.75, p("¾ cup plain Greek yogurt").quantity!!, 1e-9)
    }

    @Test fun capitalTMeansTablespoon() {
        assertEquals("tbsp", p("2 T olive oil").unit)
        assertEquals("tsp", p("2 t salt").unit)
    }

    @Test fun rangeTakesUpperBound() {
        val i = p("2-3 cloves garlic, minced")
        assertEquals(3.0, i.quantity!!, 1e-9)
        assertEquals("clove", i.unit)
        assertEquals("garlic", i.name)
        assertEquals("minced", i.note)
        assertEquals(Category.PRODUCE, i.category)
    }

    @Test fun parentheticalBecomesNote() {
        val i = p("1 (15 oz) can no-salt-added black beans, drained and rinsed")
        assertEquals(1.0, i.quantity!!, 1e-9)
        assertEquals("can", i.unit)
        assertEquals("no-salt-added black beans", i.name)
        assertEquals("15 oz; drained and rinsed", i.note)
        assertEquals(Category.CANNED, i.category)
    }

    @Test fun bulletsAndNumbering() {
        assertEquals("carrots", p("- 3 carrots").name)
        assertEquals("carrots", p("• 3 carrots").name)
        assertEquals(3.0, p("1. 3 carrots").quantity!!, 1e-9)
    }

    @Test fun noQuantity() {
        val i = p("Salt and pepper to taste")
        assertNull(i.quantity)
        assertEquals("Salt and pepper", i.name)
        assertEquals("to taste", i.note)
    }

    @Test fun gluedUnitAndWordNumbers() {
        val i = p("200g rolled oats")
        assertEquals(200.0, i.quantity!!, 1e-9)
        assertEquals("g", i.unit)
        assertEquals("rolled oats", i.name)
        val j = p("a pinch of nutmeg")
        assertEquals(1.0, j.quantity!!, 1e-9)
        assertEquals("pinch", j.unit)
        assertEquals("nutmeg", j.name)
    }

    @Test fun headingsAreSkipped() {
        assertNull(IngredientParser.parseLine("For the dressing:"))
        assertNull(IngredientParser.parseLine("   "))
    }

    @Test fun recipeSectionsAreRespected() {
        val text = """
            Lemon Herb Salmon
            Serves 4

            Ingredients
            4 salmon fillets (4 oz each)
            2 tbsp olive oil
            1 lemon, juiced
            2 tsp dried dill

            Instructions
            1. Preheat oven to 400F.
            2. Bake 12 minutes.
        """.trimIndent()
        val items = IngredientParser.parseRecipe(text)
        assertEquals(listOf("salmon fillets", "olive oil", "lemon", "dried dill"), items.map { it.name })
        assertEquals(Category.MEAT, items[0].category)
        assertEquals(Category.SPICES, items[3].category)
    }

    @Test fun nameKeysMatchAcrossPluralsAndSizes() {
        assertEquals(NameKey.of("egg"), NameKey.of("2 Large Eggs".substringAfter(' ')))
        assertEquals(NameKey.of("tomato"), NameKey.of("tomatoes"))
        assertEquals(NameKey.of("berry"), NameKey.of("berries"))
    }
}
