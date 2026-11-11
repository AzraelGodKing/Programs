package dev.azrael.grocery.claude

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CabinetScanTest {
    @Test fun parsesStructuredAnswer() {
        val scan = CabinetScan.parse("""{"items":["eggs"," Rolled oats ","rolled oats",""],"note":"Top shelf is blurry."}""")
        assertEquals(listOf("eggs", "Rolled oats"), scan.cleanItems)
        assertEquals("Top shelf is blurry.", scan.note)
    }

    @Test fun readsClaudeAppReply() {
        val reply = """
            **CABINET ITEMS**
            - Low-sodium black beans
            * rolled oats
            1. Eggs.
            • baby spinach
            Note: couldn't read the jar on the right.
        """.trimIndent()
        assertTrue(CabinetScan.isCabinetReply(reply))
        val scan = CabinetScan.parseReplyText(reply)
        assertEquals(listOf("Low-sodium black beans", "rolled oats", "Eggs", "baby spinach"), scan.cleanItems)
        assertEquals("couldn't read the jar on the right.", scan.note)
    }

    @Test fun plainListWithoutMarkerStillParses() {
        val scan = CabinetScan.parseReplyText("olive oil\nbrown rice\n\n")
        assertEquals(listOf("olive oil", "brown rice"), scan.cleanItems)
    }

    @Test fun recipesAreNotCabinetReplies() {
        assertFalse(CabinetScan.isCabinetReply("Lemon Chicken\nIngredients\n2 chicken breasts"))
    }

    @Test fun photoRequestSendsImageThenInstructions() {
        ClaudeRecipeClient("sk-test", ClaudeModel.HAIKU).use { c ->
            val p = c.buildPhotoParams(byteArrayOf(1, 2, 3))
            val blocks = p.messages().single().content().contentBlockParams().get()
            assertTrue(blocks[0].isImage())
            assertTrue(blocks[1].isText())
            assertFalse(p.tools().isPresent)
        }
    }

    @Test fun recipePhotoRequestSendsImageThenRecipePrompt() {
        ClaudeRecipeClient("sk-test", ClaudeModel.SONNET).use { c ->
            val p = c.buildRecipePhotoParams(byteArrayOf(1, 2, 3))
            val blocks = p.messages().single().content().contentBlockParams().get()
            assertTrue(blocks[0].isImage())
            assertEquals(dev.azrael.grocery.photo.RecipePhoto.AI_PROMPT, blocks[1].asText().text())
            assertFalse(p.tools().isPresent)
        }
    }

    @Test fun appRecipePromptAsksForParsableLayout() {
        val prompt = ClaudeAppPrompts.recipe("quick chicken dinner for 2")
        assertTrue(prompt.contains("quick chicken dinner for 2"))
        assertTrue(prompt.contains("\"Ingredients\""))
    }
}
