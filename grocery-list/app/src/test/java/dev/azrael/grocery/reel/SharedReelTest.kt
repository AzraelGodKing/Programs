package dev.azrael.grocery.reel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedReelTest {
    @Test
    fun findsFacebookLinks() {
        assertEquals("https://www.facebook.com/share/r/1AbCdEf/", SharedReel.findLink("https://www.facebook.com/share/r/1AbCdEf/"))
        assertEquals("https://fb.watch/abc123", SharedReel.findLink("Look at this https://fb.watch/abc123."))
        assertEquals("https://m.facebook.com/reel/1059876475815127", SharedReel.findLink("(https://m.facebook.com/reel/1059876475815127)"))
        assertNull(SharedReel.findLink("https://notfacebook.example.com/reel/1"))
        assertNull(SharedReel.findLink("2 cups rice"))
    }

    @Test
    fun aShareIsTheLinkWithLittleElse() {
        assertTrue(SharedReel.isShare("https://www.facebook.com/reel/123"))
        assertTrue(SharedReel.isShare("Easy one-pan salmon\nhttps://www.facebook.com/reel/123"))
        val longRecipe = "Salmon\nIngredients\n" + "- 1 cup rice\n".repeat(60) + "https://www.facebook.com/reel/123"
        assertFalse(SharedReel.isShare(longRecipe))
        assertFalse(SharedReel.isShare("Chicken soup\n- 2 cups broth"))
    }

    @Test
    fun readsPreviewTags() {
        val html = """
            <html><head>
            <title>Facebook</title>
            <meta property="og:title" content="12K views &#xb7; 300 reactions | Lemon garlic salmon | By Healthy Eats | Facebook" />
            <meta name="description" content="Short">
            <meta content="Lemon garlic salmon &amp; greens&#10;Ingredients: 2 salmon fillets, 1 lemon, 3 cloves garlic" property="og:description"/>
            </head><body></body></html>
        """.trimIndent()
        val page = SharedReel.parsePage(html)
        assertEquals("Lemon garlic salmon & greens\nIngredients: 2 salmon fillets, 1 lemon, 3 cloves garlic", page.description)
        assertEquals("Lemon garlic salmon & greens\nIngredients: 2 salmon fillets, 1 lemon, 3 cloves garlic", page.caption)
        assertEquals("Lemon garlic salmon", SharedReel.cleanCaption(page.title))
    }

    @Test
    fun prefersEmbeddedPostText() {
        val html = """<meta property="og:description" content="Lemon garlic salmon..." />""" +
            """<script>{"message":{"text":"Lemon garlic salmon\n\nYou need:\n- 2 fillets\n- 1 lemon ½ zested \"fresh\""}}</script>"""
        val page = SharedReel.parsePage(html)
        assertEquals("Lemon garlic salmon\n\nYou need:\n- 2 fillets\n- 1 lemon ½ zested \"fresh\"", page.caption)
    }

    @Test
    fun signInPageHasNoCaption() {
        val html = """
            <meta property="og:title" content="Log into Facebook" />
            <meta property="og:description" content="Log into Facebook to start sharing and connecting with your friends, family, and people you know." />
        """.trimIndent()
        assertEquals("", SharedReel.parsePage(html).caption)
        assertEquals("", SharedReel.parsePage("<html></html>").caption)
    }

    @Test
    fun requestCarriesCaptionAndLinkWithoutScheme() {
        val request = SharedReel.aiRequest("https://www.facebook.com/reel/123", "  Salmon with 2 lemons  ")
        assertTrue(request.contains("<reel_text>\nSalmon with 2 lemons\n</reel_text>"))
        assertTrue(request.contains("Reel: www.facebook.com/reel/123\n"))
        // No https:// so the Claude API doesn't try (and fail) to fetch Facebook.
        assertFalse(request.contains("https://"))
        assertEquals("https://www.facebook.com/reel/123", SharedReel.linkInRequest(request))
        assertNull(SharedReel.linkInRequest("Reel: www.facebook.com/reel/123"))
        assertNull(SharedReel.linkInRequest(SharedReel.aiRequest(null, "Salmon")))
    }

    @Test
    fun longCaptionsAreCut() {
        val request = SharedReel.aiRequest(null, "a".repeat(SharedReel.MAX_CAPTION_CHARS + 500))
        assertTrue(request.contains("a".repeat(SharedReel.MAX_CAPTION_CHARS) + "\n</reel_text>"))
    }

    @Test
    fun unescapesJson() {
        assertEquals("a\nb \"c\" é \\", SharedReel.unescapeJson("""a\nb \"c\" é \\"""))
    }
}
