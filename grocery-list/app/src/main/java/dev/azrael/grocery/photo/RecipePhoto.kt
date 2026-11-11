package dev.azrael.grocery.photo

import java.util.Locale

/**
 * A recipe read from a photo, before the user reviews it. [text] is what goes into Add recipe, in
 * English. Plain Kotlin, no Android, so it can be unit tested.
 */
data class RecipeReading(
    val text: String,
    /** The text as it was on the photo, when it was translated on the phone. Null when not translated. */
    val original: String? = null,
    /** Display name of the language the photo was in ("Spanish"), or null if English or unknown. */
    val fromLanguage: String? = null,
    /** Anything worth telling the user ("the bottom of the page is cut off"). Empty when nothing. */
    val note: String = "",
)

/** Which alphabet the on-device text reader looks for. Each one is a separate ML Kit model. */
enum class Script(val label: String) {
    LATIN("Latin (English, Spanish, French, Italian, German…)"),
    CHINESE("Chinese"),
    JAPANESE("Japanese"),
    KOREAN("Korean"),
    DEVANAGARI("Devanagari (Hindi, Marathi, Nepali…)"),
}

object RecipePhoto {
    /** English name for a BCP-47 tag from ML Kit ("es" → "Spanish"), or null for unknown/blank. */
    fun languageName(tag: String?): String? {
        if (tag.isNullOrBlank() || tag == UNDETERMINED) return null
        val name = Locale.forLanguageTag(tag).getDisplayLanguage(Locale.ENGLISH)
        return name.takeIf { it.isNotBlank() && !it.equals(tag, ignoreCase = true) } ?: tag
    }

    /** True for a tag that means English (or that ML Kit couldn't tell), so there's nothing to translate. */
    fun isEnglishOrUnknown(tag: String?): Boolean =
        tag.isNullOrBlank() || tag == UNDETERMINED || tag.substringBefore('-').equals("en", ignoreCase = true)

    /** ML Kit language identification's "couldn't tell" answer. */
    const val UNDETERMINED = "und"

    private val letter = Regex("\\p{L}")
    private val spaces = Regex("[ \\t\\u00A0]+")

    /** Whether a line has words to translate. Lines of only numbers, fractions or symbols stay as they are. */
    fun hasWords(line: String): Boolean = letter.containsMatchIn(line)

    /**
     * Tidies text from the on-device reader: trims and squeezes spaces, rejoins words hyphenated across a
     * line break ("toma-\ntoes" → "tomatoes"), turns bullets the parser doesn't know into "- ", and keeps
     * at most one blank line in a row.
     */
    fun cleanOcr(text: String): String {
        val lines = text.replace("\r\n", "\n").replace('\r', '\n').lines()
            .map { it.replace(spaces, " ").trim() }
        val out = mutableListOf<String>()
        for (line in lines) {
            val prev = out.lastOrNull()
            if (prev != null && prev.length > 1 && prev.endsWith("-") && prev[prev.length - 2].isLetter() &&
                line.firstOrNull()?.isLowerCase() == true
            ) {
                out[out.lastIndex] = prev.dropLast(1) + line
                continue
            }
            if (line.isEmpty() && (prev == null || prev.isEmpty())) continue
            out += line.replace(oddBullet, "- ")
        }
        while (out.lastOrNull()?.isEmpty() == true) out.removeAt(out.lastIndex)
        return out.joinToString("\n")
    }

    private val oddBullet = Regex("^[•·▪●◦○■□✓✔➤►»]\\s*")

    // --- Reading the photo with AI (Claude API, Claude app, or Gemini Nano) ---

    /** First line of every AI reply, so a Claude app reply shared back opens the photo review screen. */
    const val REPLY_MARKER = "RECIPE FROM PHOTO"
    private const val LANGUAGE_PREFIX = "Language:"
    private const val NOTE_PREFIX = "Note:"

    val AI_INSTRUCTIONS = """
        This is a photo of a recipe: a cookbook page, a recipe card, a magazine clipping, a handwritten note or a screen. Copy the recipe out as text so it can go into the user's grocery app, which reads ingredient lines like "2 cups low-sodium chicken broth".
        - If the recipe isn't in English, translate it into English. Keep every amount and unit as written (200 g stays 200 g), and translate ingredient names into the names an American grocery store uses.
        - Keep it faithful: don't add, drop or change ingredients, and don't invent anything you can't read. Write [unreadable] for words you can't make out.
        - Layout: the title on its own line, then "Serves N" if the recipe says, then a line "Ingredients" with one ingredient per line starting with "- ", then a line "Steps" with numbered steps.
    """.trimIndent()

    /** The reply format, shared by every AI path so one parser reads them all. */
    val REPLY_FORMAT = """
        Reply in exactly this format and nothing else:
        $REPLY_MARKER
        $LANGUAGE_PREFIX <the language the photo is written in, in English, e.g. Spanish>
        <the recipe>
        $NOTE_PREFIX <optional last line, only if something was cut off, blurry or unreadable>
    """.trimIndent()

    /** Sent with the photo through the Claude API and Gemini Nano. */
    val AI_PROMPT = "$AI_INSTRUCTIONS\n\n$REPLY_FORMAT"

    /** Sent with the photo to the Claude app, whose reply is shared or pasted back. */
    val CLAUDE_APP_PROMPT = "$AI_PROMPT\n\nI'll share your reply back to my grocery app, which reads that format."

    /** True when shared or pasted text is a reply to one of these prompts. */
    fun isReply(text: String): Boolean =
        firstLine(text)?.trimStart('#', '*', '_', ' ')?.trimEnd('*', '_', ' ', ':')?.uppercase() == REPLY_MARKER

    /** True when [text] is the prompt itself (copied by mistake) rather than the reply. */
    fun isPrompt(text: String): Boolean = text.contains(AI_INSTRUCTIONS.lineSequence().first().take(60))

    /**
     * Reads an AI reply. Works with or without the marker, language and note lines, and drops Markdown
     * bold and code fences that chat apps tend to add.
     */
    fun parseReply(reply: String): RecipeReading {
        var language: String? = null
        val notes = mutableListOf<String>()
        val body = mutableListOf<String>()
        var sawMarker = false
        for (raw in reply.replace("\r\n", "\n").lines()) {
            val line = raw.trimEnd()
            val bare = line.trim().trim('*', '_').trim()
            if (bare.startsWith("```")) continue
            if (!sawMarker && body.isEmpty() && bare.trimStart('#', ' ').trimEnd(':').uppercase() == REPLY_MARKER) {
                sawMarker = true
                continue
            }
            if (language == null && body.isEmpty() && bare.startsWith(LANGUAGE_PREFIX, ignoreCase = true)) {
                language = bare.substring(LANGUAGE_PREFIX.length).trim().trim('*', '_').trim()
                continue
            }
            if (bare.startsWith(NOTE_PREFIX, ignoreCase = true)) {
                notes += bare.substring(NOTE_PREFIX.length).trim()
                continue
            }
            if (line.isBlank() && body.isEmpty()) continue
            body += line.replace("**", "").replace(Regex("^#{1,6}\\s*"), "")
        }
        while (body.lastOrNull()?.isBlank() == true) body.removeAt(body.lastIndex)
        val lang = language?.takeIf { it.isNotBlank() && !it.equals("English", ignoreCase = true) }
        return RecipeReading(
            text = body.joinToString("\n").trim(),
            fromLanguage = lang,
            note = notes.filter { it.isNotBlank() }.joinToString(" "),
        )
    }

    private fun firstLine(text: String): String? = text.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() }
}
