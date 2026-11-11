package dev.azrael.grocery.claude

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NanoPromptsTest {
    @Test
    fun bareLinkIsRejectedBecauseNanoIsOffline() {
        assertNotNull(NanoPrompts.problemWith("https://example.com/recipes/lemon-chicken"))
        assertNotNull(NanoPrompts.problemWith("make this https://example.com/r/1 please"))
    }

    @Test
    fun requestsAndPastedRecipesAreAllowed() {
        assertNull(NanoPrompts.problemWith("Quick chicken dinner for 2"))
        val pasted = "Lemon chicken\nIngredients\n2 chicken breasts\n1 lemon\nSource: https://example.com/r/1\n" +
            "Steps\n1. Squeeze the lemon over the chicken and roast at 400F for 25 minutes until cooked through."
        assertNull(NanoPrompts.problemWith(pasted))
    }

    @Test
    fun tooLongInputIsRejected() {
        assertNotNull(NanoPrompts.problemWith("a".repeat(NanoPrompts.MAX_INPUT_CHARS + 1)))
    }

    @Test
    fun onHandItemsAreMentioned() {
        val prompt = NanoPrompts.recipe("soup", listOf("carrots", "onion"))
        assertTrue(prompt.contains("carrots, onion"))
    }

    @Test
    fun fencedJsonAnswerParses() {
        // Small models often wrap JSON in a code fence; the shared parser has to cope.
        val answer = """
            ```json
            {"title": "Lemon chicken", "servings": 2, "summary": "Roast chicken.", "dash_notes": "Fits DASH.",
             "sodium_mg_per_serving": 300, "swaps": [],
             "ingredients": [{"name": "chicken breast", "quantity": 2, "unit": null, "note": null},
                             {"name": "lemon", "quantity": 1, "unit": null, "note": "juiced"}],
             "steps": ["Roast."]}
            ```
        """.trimIndent()
        val recipe = ClaudeRecipe.parse(answer)
        assertEquals(2, recipe.toParsedIngredients().size)
    }

    @Test
    fun photoAnswerUsesTheCabinetListFormat() {
        val scan = CabinetScan.parseReplyText("${CabinetScan.REPLY_MARKER}\n- rolled oats\n- eggs\n")
        assertEquals(listOf("rolled oats", "eggs"), scan.cleanItems)
        assertTrue(NanoPrompts.PHOTO.contains(CabinetScan.REPLY_MARKER))
    }
}
