package dev.azrael.grocery.claude

/**
 * Prompts for Gemini Nano, the free model that runs on the phone itself. Plain Kotlin, no Android, so it
 * can be unit tested.
 *
 * Nano is much smaller than Claude: it has a context window of about 4,000 tokens, it can't open web
 * pages, and it follows long instructions less reliably. So the prompts are short, ask for the same JSON
 * shape as [ClaudeRecipe] (parsed by the same code), and the photo prompt asks for the plain-text list
 * that [CabinetScan.parseReplyText] already reads.
 */
object NanoPrompts {
    /** Longest request text sent to Nano. The prompt and the answer have to fit in its small window too. */
    const val MAX_INPUT_CHARS = 7_000

    private val URL_REGEX = Regex("https?://\\S+", RegexOption.IGNORE_CASE)

    /**
     * Why [input] can't go to Nano, or null if it can. Nano runs offline, so a bare link would only get an
     * invented recipe back.
     */
    fun problemWith(input: String): String? {
        val text = input.trim()
        if (text.length > MAX_INPUT_CHARS) {
            return "That's too long for Gemini Nano on this phone (it can read about $MAX_INPUT_CHARS characters). " +
                "Paste just the ingredients and steps."
        }
        val withoutLinks = URL_REGEX.replace(text, "").trim()
        if (URL_REGEX.containsMatchIn(text) && withoutLinks.length < 120) {
            return "Gemini Nano runs on the phone without internet, so it can't open links. Open the recipe, copy " +
                "its text, and paste that here."
        }
        return null
    }

    val SYSTEM = """
        You help one person shop for groceries. They follow the DASH diet (low sodium; lots of vegetables, fruit, whole grains, beans, nuts, fish, skinless poultry and low-fat dairy; flavor from herbs, spices, garlic and citrus instead of salt).

        If the message is a recipe, copy it faithfully: title, servings, every ingredient and the steps. Don't change the ingredients; put DASH-friendlier swaps in "swaps".
        Otherwise write one simple original recipe that fits DASH, under about 600 mg sodium per serving.

        Answer with only one JSON object, no other text, in exactly this shape:
        {"title": "...", "servings": 4, "summary": "one sentence", "dash_notes": "one or two sentences on how well it fits DASH", "sodium_mg_per_serving": 450, "swaps": [{"instead_of": "...", "use": "...", "why": "..."}], "ingredients": [{"name": "yellow onion", "quantity": 1, "unit": null, "note": "diced"}], "steps": ["..."]}

        Ingredient rules: "name" is the plain grocery item with no amount or prep words. "quantity" is a number like 0.5, or null. "unit" is one of tsp, tbsp, cup, oz, lb, g, ml, clove, can, jar, package, bunch, slice, stalk, head, pinch, or null for items counted by number. Prep words like "diced" go in "note". Use null for unknown numbers.
    """.trimIndent()

    fun recipe(input: String, onHand: List<String> = emptyList()): String = buildString {
        append(input.trim())
        if (onHand.isNotEmpty()) {
            append("\n\nI already have: ")
            append(onHand.joinToString(", "))
            append(". Use them where they fit and still list them as ingredients.")
        }
    }

    /** Sent with a photo. The answer is read by [CabinetScan.parseReplyText]. */
    val PHOTO = """
        This photo shows food at home: a cupboard, pantry shelf, fridge, freezer or counter. List the grocery items you can see, named the way they'd appear on a grocery list ("rolled oats", "eggs", "baby spinach"), with no brands and no quantities. List each item once. Skip anything that isn't food.

        Reply with the line "${CabinetScan.REPLY_MARKER}", then one item per line starting with "- ", and nothing else.
    """.trimIndent()
}
