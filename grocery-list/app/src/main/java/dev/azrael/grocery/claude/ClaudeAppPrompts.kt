package dev.azrael.grocery.claude

/**
 * Prompts for "Claude app" mode, where the request goes to the official Claude app (and the user's
 * own subscription) and the answer comes back as shared or pasted text. Plain Kotlin, no Android.
 */
object ClaudeAppPrompts {
    /** Asks for a recipe in a plain layout the built-in paste parser reads ("Ingredients" heading, one per line). */
    fun recipe(request: String): String = """
        I follow the DASH diet (Dietary Approaches to Stop Hypertension). ${request.trim()}

        If that is a recipe or a link to one, keep the recipe as written and add DASH-friendlier swaps at the end. Otherwise write one original recipe that fits DASH: vegetables, fruits, whole grains, beans, nuts, fish, skinless poultry and low-fat dairy; herbs, spices and citrus instead of salt; low-sodium or no-salt-added canned goods and broth; under about 600 mg sodium per serving.

        Format it so my grocery app can read it: the title on the first line, then a line that says "Ingredients", then one ingredient per line like "1 1/2 cups low-sodium chicken broth" or "2 cloves garlic, minced", then "Steps". Include the estimated sodium per serving. I'll share your reply back into the app.
    """.trimIndent()
}
