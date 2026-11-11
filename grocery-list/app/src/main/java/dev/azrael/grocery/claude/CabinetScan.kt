package dev.azrael.grocery.claude

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue

/** What Claude saw in a photo of a cupboard, fridge or counter. Plain Kotlin, no Android. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class CabinetScan(
    val items: List<String> = emptyList(),
    /** Anything worth telling the user, such as "photo is blurry on the left". Empty when nothing. */
    val note: String = "",
) {
    /** Trimmed, de-duplicated (case-insensitive) names in the order Claude listed them. */
    val cleanItems: List<String>
        get() = items.map { it.trim() }.filter { it.isNotEmpty() }.distinctBy { it.lowercase() }

    companion object {
        private val mapper = jacksonObjectMapper()

        fun parse(json: String): CabinetScan {
            val start = json.indexOf('{')
            val end = json.lastIndexOf('}')
            require(start >= 0 && end > start) { "Claude's answer wasn't an item list" }
            return mapper.readValue(json.substring(start, end + 1))
        }

        /** The first line of a Claude app reply that should open the Cabinet review screen. */
        const val REPLY_MARKER = "CABINET ITEMS"

        /** True when shared text is a reply to [CLAUDE_APP_PROMPT] rather than a recipe. */
        fun isCabinetReply(text: String): Boolean =
            text.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() }
                ?.trimStart('#', '*', ' ')?.uppercase()?.startsWith(REPLY_MARKER) == true

        private val bullet = Regex("^\\s*(?:[-*•·]|\\d+[.)]|\\[[ xX]?])\\s*")

        /**
         * Reads a plain-text list (pasted or shared from the Claude app): one item per line, bullets and
         * numbering optional. Skips the marker line, headings and "Note:" lines.
         */
        fun parseReplyText(text: String): CabinetScan {
            val items = mutableListOf<String>()
            val notes = mutableListOf<String>()
            for (raw in text.lines()) {
                var line = raw.trim().trim('*', '_').trim()
                if (line.isEmpty()) continue
                if (line.trimStart('#', ' ').uppercase().startsWith(REPLY_MARKER)) continue
                if (line.startsWith("#")) continue
                if (line.lowercase().startsWith("note:")) {
                    notes += line.substringAfter(':').trim()
                    continue
                }
                line = line.replace(bullet, "").trim().trim('*', '_').trim().trimEnd('.', ',')
                if (line.isNotEmpty() && line.length <= 60) items += line
            }
            return CabinetScan(items, notes.joinToString(" "))
        }

        val PHOTO_INSTRUCTIONS = """
            This is a photo of food the user has at home: a cupboard, pantry shelf, fridge, freezer or counter. List the grocery items you can identify so they can be added to the user's kitchen inventory.
            - One entry per distinct item, named the way it would appear on a grocery list: "low-sodium black beans", "rolled oats", "eggs", "baby spinach". No brand names unless the brand is the product's common name. No quantities.
            - Only include items you can actually see or read on a label. Skip non-food things (dishes, appliances, cleaning products).
            - If several of the same item are visible, list it once.
            - Put anything the user should know (blurry areas, labels you couldn't read) in `note`, or leave it empty.
        """.trimIndent()

        /** Prompt sent along with the photo to the Claude app, whose reply comes back as plain text. */
        val CLAUDE_APP_PROMPT = """
            $PHOTO_INSTRUCTIONS

            Reply with the line "$REPLY_MARKER" and then one item per line starting with "- ", and nothing else except an optional last line starting with "Note:". I'll share your reply back to my grocery app, which reads that format.
        """.trimIndent()

        val SCHEMA: Map<String, Any> = mapOf(
            "type" to "object",
            "properties" to linkedMapOf(
                "items" to mapOf("type" to "array", "items" to mapOf("type" to "string")),
                "note" to mapOf("type" to "string"),
            ),
            "required" to listOf("items", "note"),
            "additionalProperties" to false,
        )
    }
}
