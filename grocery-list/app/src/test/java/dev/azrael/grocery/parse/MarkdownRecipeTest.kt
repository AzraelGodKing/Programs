package dev.azrael.grocery.parse

import dev.azrael.grocery.nutrition.DashCheck
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkdownRecipeTest {
    private val note = """
        ---
        tags: [recipe, crockpot]
        source: https://example.com/reel/1
        servings: 6
        ---

        # Creamy Chicken & Rice

        **Source:** [A reel](https://example.com/reel/1)
        **Servings:** 6 *(estimate)*

        > Amounts are estimates.

        ## Ingredients

        **For the chicken**
        - 1½ lb boneless skinless chicken breast
        - 1 tsp paprika *(estimate)*

        ### Sauce
        - 1 cup heavy cream
        - Kinder's Cowboy Butter seasoning, for the chicken and later for the broth *(amount not shown; estimate: about 1 tsp on the chicken, plus about 1 tsp into the broth)*

        ## Steps
        1. Brown the **chicken**.
        2. Stir in the [[Cream sauce|sauce]].

        ## Grocery List
        ### Meat
        - [ ] Chicken breast, 1½ lb
    """.trimIndent()

    @Test fun readsTitleServingsAndPlainText() {
        val r = MarkdownRecipe.parse("Creamy Chicken.md", note)
        assertEquals("Creamy Chicken & Rice", r.title)
        assertEquals(6, r.servings)
        assertTrue(r.text, r.text.startsWith("Source: A reel (https://example.com/reel/1)"))
        assertTrue(r.text.contains("\nAmounts are estimates."))
        assertTrue(r.text.contains("\nIngredients\n"))
        assertTrue(r.text.contains("\nFor the chicken:\n"))
        assertTrue(r.text.contains("\nSauce:\n"))
        assertTrue(r.text.contains("- 1 tsp paprika (estimate)"))
        assertTrue(r.text.contains("1. Brown the chicken."))
        assertTrue(r.text.contains("2. Stir in the sauce."))
        assertFalse("grocery list section is dropped", r.text.contains("Grocery List"))
        assertFalse(r.text.contains("**"))
        assertFalse(r.text.contains("tags:"))
    }

    @Test fun ingredientsParseFromTheConvertedText() {
        val names = IngredientParser.parseRecipe(MarkdownRecipe.parse("x.md", note).text).map { it.name.lowercase() }
        assertEquals(4, names.size)
        assertTrue(names.toString(), names.any { it.contains("chicken breast") })
        assertTrue(names.toString(), names.any { it.contains("heavy cream") })
        // The long line loses its "(estimate…)" aside so the parser keeps it.
        assertTrue(names.toString(), names.any { it.contains("cowboy butter seasoning") })
    }

    @Test fun fallsBackToFileNameAndDefaultServings() {
        val r = MarkdownRecipe.parse("Notes/Plain Soup.md", "## Ingredients\n- 1 onion\n\n## Steps\n1. Cook.")
        assertEquals("Plain Soup", r.title)
        assertEquals(MarkdownRecipe.DEFAULT_SERVINGS, r.servings)
    }

    @Test fun dashCheckFlagsCreamAndSkipsSeasoningButter() {
        val r = DashCheck.annotate(MarkdownRecipe.parse("x.md", note))
        val first = r.text.lineSequence().first()
        assertTrue(first, first.startsWith("DASH check: not DASH as written."))
        assertTrue(first, first.contains("heavy cream"))
        assertFalse(first, first.contains("butter,") || first.endsWith("butter."))
    }

    @Test fun dashCheckPassesALightRecipe() {
        val md = "# Bean Salad\nServes 4\n\n## Ingredients\n- 1 can (15 oz) no-salt-added black beans, rinsed\n" +
            "- 2 cups cherry tomatoes\n- 1 tbsp olive oil\n- 1 lime\n\n## Steps\n1. Toss."
        val first = DashCheck.annotate(MarkdownRecipe.parse("x.md", md)).text.lineSequence().first()
        assertTrue(first, first.startsWith("DASH check: looks DASH friendly"))
    }
}
