package dev.azrael.grocery.claude

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ClaudeRecipeTest {
    private val sample = """
        {"title":"Lemon Herb Chicken","servings":2,"summary":"Bright sheet-pan chicken.",
         "dash_notes":"Lean protein, lots of veg, no added salt.","sodium_mg_per_serving":310,
         "swaps":[{"instead_of":"salt","use":"lemon zest","why":"flavor without sodium"}],
         "ingredients":[
           {"name":"chicken breast","quantity":2,"unit":"breast","note":"boneless, skinless"},
           {"name":"olive oil","quantity":2,"unit":"tablespoons","note":null},
           {"name":"lemon","quantity":1,"unit":null,"note":"zested and juiced"},
           {"name":"black pepper","quantity":null,"unit":null,"note":"to taste"},
           {"name":"  ","quantity":1,"unit":null,"note":null}
         ],
         "steps":["Heat oven to 425F.","Roast 20 minutes."]}
    """.trimIndent()

    @Test fun parsesRecipeJson() {
        val r = ClaudeRecipe.parse(sample)
        assertEquals("Lemon Herb Chicken", r.title)
        assertEquals(2, r.servings)
        assertEquals(310, r.sodiumMgPerServing)
        assertEquals("lemon zest", r.swaps.single().use)
        assertEquals(2, r.steps.size)
    }

    @Test fun toleratesTextAroundJson() {
        val r = ClaudeRecipe.parse("Here it is:\n$sample\n")
        assertEquals("Lemon Herb Chicken", r.title)
    }

    @Test fun mapsIngredientsToParserShape() {
        val items = ClaudeRecipe.parse(sample).toParsedIngredients()
        assertEquals(4, items.size) // blank name dropped
        assertEquals("tbsp", items[1].unit) // "tablespoons" normalised so it merges
        assertNull(items[2].unit)
        assertEquals("zested and juiced", items[2].note)
        assertNull(items[3].quantity)
    }

    @Test fun shareTextHasIngredientsAndSteps() {
        val text = ClaudeRecipe.parse(sample).asText()
        assertTrue(text.startsWith("Lemon Herb Chicken"))
        assertTrue(text.contains("2 tbsp olive oil"))
        assertTrue(text.contains("2. Roast 20 minutes."))
    }

    @Test fun requestOffersWebFetchOnlyForLinks() {
        ClaudeRecipeClient("sk-test", ClaudeModel.OPUS).use { c ->
            assertFalse(c.buildParams("quick chicken dinner for 2", emptyList()).tools().isPresent)
            val withLink = c.buildParams("https://example.com/soup", emptyList())
            assertEquals(1, withLink.tools().get().size)
        }
    }

    @Test fun onHandItemsAreSentToClaude() {
        ClaudeRecipeClient("sk-test", ClaudeModel.HAIKU).use { c ->
            val p = c.buildParams("soup", listOf("carrots", "rice"))
            val text = p.messages().single().content().string().get()
            assertTrue(text.contains("<on_hand>\n- carrots\n- rice\n</on_hand>"))
        }
    }

    @Test fun unknownModelIdFallsBackToDefault() {
        assertEquals(ClaudeModel.DEFAULT, ClaudeModel.fromId("nope"))
        assertEquals(ClaudeModel.HAIKU, ClaudeModel.fromId("claude-haiku-5-5"))
    }
}
