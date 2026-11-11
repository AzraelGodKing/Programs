package dev.azrael.grocery.photo

import dev.azrael.grocery.parse.IngredientParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RecipePhotoTest {
    @Test fun languageNames() {
        assertEquals("Spanish", RecipePhoto.languageName("es"))
        assertEquals("Chinese", RecipePhoto.languageName("zh"))
        assertNull(RecipePhoto.languageName("und"))
        assertNull(RecipePhoto.languageName(null))
        assertTrue(RecipePhoto.isEnglishOrUnknown("en"))
        assertTrue(RecipePhoto.isEnglishOrUnknown("en-GB"))
        assertTrue(RecipePhoto.isEnglishOrUnknown("und"))
        assertFalse(RecipePhoto.isEnglishOrUnknown("it"))
    }

    @Test fun hasWords() {
        assertTrue(RecipePhoto.hasWords("200 g farina"))
        assertTrue(RecipePhoto.hasWords("砂糖 大さじ1"))
        assertFalse(RecipePhoto.hasWords("1/2"))
        assertFalse(RecipePhoto.hasWords("—"))
    }

    @Test fun cleansOcrText() {
        val raw = "  Tomato   Soup \n\n\n• 4 ripe toma-\ntoes\n·  1 onion\n Low-\nSodium broth\n\n"
        assertEquals(
            "Tomato Soup\n\n- 4 ripe tomatoes\n- 1 onion\nLow-\nSodium broth",
            RecipePhoto.cleanOcr(raw),
        )
    }

    @Test fun readsReplyWithMarkerLanguageAndNote() {
        val reply = """
            **RECIPE FROM PHOTO**
            Language: Italian

            Lemon Pasta
            Serves 4
            ## Ingredients
            - 12 oz whole-wheat spaghetti
            - 2 **lemons**
            Steps
            1. Boil the pasta.
            Note: the last step is cut off.
        """.trimIndent()
        assertTrue(RecipePhoto.isReply(reply))
        val r = RecipePhoto.parseReply(reply)
        assertEquals("Italian", r.fromLanguage)
        assertEquals("the last step is cut off.", r.note)
        assertEquals(
            "Lemon Pasta\nServes 4\nIngredients\n- 12 oz whole-wheat spaghetti\n- 2 lemons\nSteps\n1. Boil the pasta.",
            r.text,
        )
        // The text is what Add recipe parses.
        val parsed = IngredientParser.parseRecipe(r.text)
        assertEquals(listOf("whole-wheat spaghetti", "lemons"), parsed.map { it.name })
    }

    @Test fun englishReplyHasNoLanguage() {
        val r = RecipePhoto.parseReply("RECIPE FROM PHOTO\nLanguage: English\nToast\n- 1 slice bread")
        assertNull(r.fromLanguage)
        assertEquals("Toast\n- 1 slice bread", r.text)
    }

    @Test fun replyWithoutMarkerStillParses() {
        val r = RecipePhoto.parseReply("```\nOats\n- 1 cup rolled oats\n```")
        assertFalse(RecipePhoto.isReply("Oats\n- 1 cup rolled oats"))
        assertEquals("Oats\n- 1 cup rolled oats", r.text)
    }

    @Test fun promptIsNotAReply() {
        assertTrue(RecipePhoto.isPrompt(RecipePhoto.CLAUDE_APP_PROMPT))
        assertFalse(RecipePhoto.isReply(RecipePhoto.CLAUDE_APP_PROMPT))
        assertTrue(RecipePhoto.AI_PROMPT.contains(RecipePhoto.REPLY_MARKER))
    }
}
