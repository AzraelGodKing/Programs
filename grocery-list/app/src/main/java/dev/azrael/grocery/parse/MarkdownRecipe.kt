package dev.azrael.grocery.parse

/** A recipe read from a Markdown note, ready for the recipe box. */
data class ImportedRecipe(val title: String, val servings: Int, val text: String)

/**
 * Turns a Markdown recipe note (an Obsidian note, for example) into recipe-box text. Plain Kotlin.
 *
 * Front matter is read for `title` and `servings` and dropped. Markdown markup is removed so the
 * ingredient parser sees plain lines: "## Ingredients" becomes "Ingredients", a "**For the sauce**"
 * or "### Sauce" sub-heading becomes "For the sauce:" (which the parser skips), links keep their
 * text and address. A "Grocery List" or "Shopping List" section is left out, since the app makes
 * its own list from the ingredients.
 */
object MarkdownRecipe {
    const val DEFAULT_SERVINGS = 4

    /** Lines the ingredient parser drops; "(estimate)"-style notes are shortened to fit. */
    private const val MAX_INGREDIENT_LINE = 120

    private val heading = Regex("^(#{1,6})\\s+(.*?)\\s*#*\\s*$")
    private val boldOnly = Regex("^\\*\\*(.+?):?\\*\\*:?\\s*$")
    private val italicNote = Regex("\\s*\\*\\(([^)]*)\\)\\*")
    private val image = Regex("!\\[\\[[^]]*]]|!\\[[^]]*]\\([^)]*\\)")
    private val wikiLink = Regex("\\[\\[([^]|]*)(?:\\|([^]]*))?]]")
    private val link = Regex("\\[([^]]+)]\\(([^)\\s]+)\\)")
    private val checkbox = Regex("^(\\s*[-*+])\\s+\\[[ xX]]\\s+")
    private val comment = Regex("%%.*?%%", RegexOption.DOT_MATCHES_ALL)
    private val dropSections = Regex("^(grocery|shopping)\\s+list\\b.*", RegexOption.IGNORE_CASE)
    private val ingredientsSection = Regex("^ingredients?\\b.*", RegexOption.IGNORE_CASE)
    private val firstNumber = Regex("\\d+")

    fun parse(fileName: String, markdown: String): ImportedRecipe {
        val (front, body) = splitFrontMatter(markdown.replace("\r\n", "\n").replace(comment, ""))
        var title = front["title"]?.let { inline(it) }?.takeIf { it.isNotBlank() }
        val out = mutableListOf<String>()
        var dropping = false
        var inIngredients = false
        var topLevel = 0

        for (raw in body.lines()) {
            val h = heading.find(raw)
            if (h != null) {
                val level = h.groupValues[1].length
                val text = inline(h.groupValues[2])
                if (level == 1 && title == null) { title = text; continue }
                if (topLevel == 0 || level <= topLevel) {
                    topLevel = level
                    dropping = dropSections.matches(text)
                    inIngredients = ingredientsSection.matches(text)
                    if (!dropping) { blankLine(out); out += text }
                } else if (!dropping) {
                    blankLine(out)
                    out += text.trimEnd(':') + ":"
                }
                continue
            }
            if (dropping) continue
            val line = raw.trimEnd()
            if (line.trim() == "---" || line.trim() == "***") continue
            val bold = boldOnly.find(line.trim())
            if (bold != null) {
                out += inline(bold.groupValues[1]).trimEnd(':') + ":"
                continue
            }
            var text = line.removePrefix(">").let { if (line.startsWith(">")) it.trimStart() else it }
            text = text.replace(checkbox, "$1 ")
            var plain = inline(text)
            if (inIngredients && plain.length > MAX_INGREDIENT_LINE) {
                // Keep the ingredient readable by the parser: drop the "*(estimate…)*" asides.
                plain = inline(text.replace(italicNote, ""))
            }
            if (plain.isBlank()) blankLine(out) else out += plain
        }

        val text = out.joinToString("\n").trim().replace(Regex("\n{3,}"), "\n\n")
        val servings = front["servings"]?.let { firstNumber.find(it)?.value?.toIntOrNull() }?.takeIf { it in 1..48 }
            ?: Servings.detect(text)
            ?: DEFAULT_SERVINGS
        val name = title ?: fileName.substringAfterLast('/').substringAfterLast('\\').removeSuffix(".md").trim()
        return ImportedRecipe(name.ifBlank { "Recipe" }, servings, text)
    }

    private fun blankLine(out: MutableList<String>) {
        if (out.isNotEmpty() && out.last().isNotBlank()) out += ""
    }

    /** Removes inline Markdown: images, links, bold and italic markers, inline code. */
    fun inline(s: String): String {
        var t = s.replace(image, "")
        t = t.replace(wikiLink) { m -> m.groupValues[2].ifEmpty { m.groupValues[1] } }
        t = t.replace(link) { m ->
            val label = m.groupValues[1]
            val url = m.groupValues[2]
            if (label == url || label.startsWith("http")) url else "$label ($url)"
        }
        t = t.replace("**", "").replace("__", "").replace("`", "")
        // Single-asterisk italics; leave "*" used as a bullet alone.
        t = t.replace(Regex("(?<![\\w*])\\*(?!\\s)([^*\\n]+?)(?<!\\s)\\*(?![\\w*])"), "$1")
        return t.trimEnd()
    }

    /** Front matter keys (lower case) to raw values, and the rest of the note. */
    private fun splitFrontMatter(md: String): Pair<Map<String, String>, String> {
        val lines = md.lines()
        if (lines.firstOrNull()?.trim() != "---") return emptyMap<String, String>() to md
        val end = lines.drop(1).indexOfFirst { it.trim() == "---" || it.trim() == "..." }
        if (end < 0) return emptyMap<String, String>() to md
        val map = lines.subList(1, end + 1).mapNotNull { l ->
            val i = l.indexOf(':')
            if (i <= 0 || l.startsWith(" ")) null
            else l.substring(0, i).trim().lowercase() to l.substring(i + 1).trim().trim('"', '\'')
        }.toMap()
        return map to lines.drop(end + 2).joinToString("\n")
    }
}
