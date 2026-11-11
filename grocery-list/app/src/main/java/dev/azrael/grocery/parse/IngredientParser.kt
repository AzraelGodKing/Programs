package dev.azrael.grocery.parse

data class ParsedIngredient(
    val name: String,
    val quantity: Double?,
    val unit: String?,
    val note: String?,
    val raw: String,
) {
    val key: String get() = NameKey.of(name)
    val category: Category get() = Categorizer.categorize(name, unit)
}

object IngredientParser {
    private val sectionStart = Regex("^\\s*ingredients?\\b.*$", RegexOption.IGNORE_CASE)
    private val sectionEnd = Regex(
        "^\\s*(instructions?|directions?|method|steps?|preparation|how to make( it)?|notes?|nutrition)\\b.*$",
        RegexOption.IGNORE_CASE,
    )
    private val bullet = Regex("^\\s*(?:[-*•·▢□☐◦✓✔]+|\\d+[.)](?=\\s))\\s*")
    private val numberPattern = "(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+)"
    private val leadingQuantity = Regex(
        "^($numberPattern)(?:\\s*(?:-|–|—|to|or)\\s*($numberPattern))?\\s*",
        RegexOption.IGNORE_CASE,
    )
    private val wordNumbers = mapOf(
        "a" to 1.0, "an" to 1.0, "one" to 1.0, "two" to 2.0, "three" to 3.0, "four" to 4.0,
        "five" to 5.0, "six" to 6.0, "seven" to 7.0, "eight" to 8.0, "nine" to 9.0, "ten" to 10.0,
        "dozen" to 12.0, "half" to 0.5,
    )
    private val parenthetical = Regex("\\(([^)]*)\\)")
    private val trailingNotes = Regex(
        "\\s+(to taste|as needed|for serving|for garnish|optional|or more|or to taste|divided)\\b.*$",
        RegexOption.IGNORE_CASE,
    )

    /**
     * Pulls ingredient lines out of pasted recipe text. If the text has an "Ingredients" heading
     * only the lines under it are used, stopping at "Instructions"/"Directions"/etc.
     */
    fun parseRecipe(text: String): List<ParsedIngredient> {
        val lines = text.lines()
        val start = lines.indexOfFirst { sectionStart.matches(it) && it.trim().length < 40 }
        val body = if (start >= 0) {
            val rest = lines.drop(start + 1)
            val end = rest.indexOfFirst { sectionEnd.matches(it) && it.trim().length < 40 }
            if (end >= 0) rest.take(end) else rest
        } else {
            lines
        }
        return body.mapNotNull { parseLine(it) }
    }

    fun parseLine(rawLine: String): ParsedIngredient? {
        var line = Quantities.normalizeFractions(rawLine).replace(' ', ' ').trim()
        line = line.replace(bullet, "").trim()
        if (line.isEmpty()) return null
        // Headings like "For the sauce:" and long instruction paragraphs aren't ingredients.
        if (line.endsWith(":")) return null
        if (line.length > 120) return null

        val notes = mutableListOf<String>()

        // Quantity
        var quantity: Double? = null
        leadingQuantity.find(line)?.let { m ->
            val low = Quantities.parse(m.groupValues[1])
            val high = m.groupValues[2].takeIf { it.isNotEmpty() }?.let { Quantities.parse(it) }
            // For a range like "2-3 cloves" buy the upper amount.
            quantity = high ?: low
            line = line.substring(m.range.last + 1)
        }
        // "200g flour" -> number glued to unit
        if (quantity == null) {
            Regex("^(\\d+(?:\\.\\d+)?)([a-zA-Z]+)\\b\\s*").find(line)?.let { m ->
                if (Units.lookup(m.groupValues[2]) != null) {
                    quantity = m.groupValues[1].toDouble()
                    line = m.groupValues[2] + " " + line.substring(m.range.last + 1)
                }
            }
        }
        if (quantity == null) {
            val first = line.substringBefore(' ')
            val n = wordNumbers[first.lowercase()]
            if (n != null && line.contains(' ')) {
                quantity = n
                line = line.substringAfter(' ').trim()
            }
        }

        // Parenthetical size like "1 (15 oz) can black beans" -> note
        parenthetical.findAll(line).forEach { notes += it.groupValues[1].trim() }
        line = line.replace(parenthetical, " ").replace(Regex("\\s+"), " ").trim()

        // Unit (try two-word units like "fl oz" / "fluid ounces" first)
        var unit: String? = null
        val words = line.split(' ')
        if (words.size >= 2) {
            Units.lookup("${words[0]} ${words[1]}")?.let {
                unit = it
                line = words.drop(2).joinToString(" ")
            }
        }
        if (unit == null && words.size >= 2) {
            Units.lookup(words[0])?.let {
                unit = it
                line = words.drop(1).joinToString(" ")
            }
        }
        line = line.removePrefix("of ").trim()

        // Name, with prep notes after the first comma split off
        trailingNotes.find(line)?.let {
            notes += it.value.trim()
            line = line.substring(0, it.range.first)
        }
        val comma = line.indexOf(',')
        if (comma >= 0) {
            line.substring(comma + 1).trim().takeIf { it.isNotEmpty() }?.let { notes += it }
            line = line.substring(0, comma)
        }
        val name = line.trim().trimEnd('.', ';', '*').trim()
        if (name.isEmpty() || !name.any { it.isLetter() }) return null

        return ParsedIngredient(
            name = name,
            quantity = quantity,
            unit = unit,
            note = notes.filter { it.isNotBlank() }.joinToString("; ").ifEmpty { null },
            raw = rawLine.trim(),
        )
    }
}
