package dev.azrael.grocery.reel

/**
 * A Facebook reel (or other Facebook video) shared into the app. AI can't watch the video, so the app
 * works from the words around it: the caption Facebook publishes in the page's preview tags, text the user
 * pastes, or a screenshot read through the recipe photo screen. Plain Kotlin, no Android, so it can be
 * unit tested.
 */
object SharedReel {
    private val LINK = Regex(
        "https?://(?:[a-z0-9-]+\\.)*(?:facebook\\.com|fb\\.watch|fb\\.com|fb\\.me)(?:/\\S*)?",
        RegexOption.IGNORE_CASE,
    )

    /** Shared text with more than this much besides the link is something else (say a Claude reply). */
    private const val MAX_EXTRA_CHARS = 400

    /** The first Facebook link in [text], without trailing punctuation, or null. */
    fun findLink(text: String): String? =
        LINK.find(text)?.value?.trimEnd('.', ',', ')', ']', '!', '?', '"', '\'', '>')

    /**
     * True when shared text is a Facebook share (the link, maybe with a line of text), not a long text
     * that happens to mention a Facebook link.
     */
    fun isShare(text: String): Boolean {
        val link = findLink(text) ?: return false
        return text.replace(link, "").trim().length <= MAX_EXTRA_CHARS
    }

    /** Whatever was shared along with the link (Facebook sometimes adds the post's text), or "". */
    fun textBesides(text: String, link: String): String = text.replace(link, "").trim()

    /** The link without "https://", so the Claude API doesn't spend a web fetch on a page it can't open. */
    fun displayLink(link: String): String = link.replace(Regex("^https?://", RegexOption.IGNORE_CASE), "")

    // --- Reading the page ---

    /** What a reel's page says about itself. Fields are "" when missing. */
    data class PageInfo(val title: String = "", val description: String = "", val postText: String = "") {
        /** The best caption found, or "" when the page only had Facebook's sign-in boilerplate. */
        val caption: String
            get() = listOf(postText, description, title)
                .map { cleanCaption(it) }
                .filterNot { isBoilerplate(it) }
                .maxByOrNull { it.length }
                .orEmpty()
    }

    private val META = Regex("<meta\\b[^>]*>", RegexOption.IGNORE_CASE)
    private val ATTR = Regex("([a-zA-Z:_-]+)\\s*=\\s*(\"[^\"]*\"|'[^']*')")
    private val TITLE = Regex("<title[^>]*>([^<]*)</title>", RegexOption.IGNORE_CASE)
    /** The post text Facebook sometimes embeds in the page's JSON. */
    private val POST_TEXT = Regex("\"message\"\\s*:\\s*\\{\\s*\"text\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")

    /** Pulls the preview tags (Open Graph, description, title) and any embedded post text out of [html]. */
    fun parsePage(html: String): PageInfo {
        val meta = mutableMapOf<String, String>()
        for (tag in META.findAll(html)) {
            val attrs = ATTR.findAll(tag.value).associate { m ->
                m.groupValues[1].lowercase() to m.groupValues[2].substring(1, m.groupValues[2].length - 1)
            }
            val key = (attrs["property"] ?: attrs["name"])?.lowercase() ?: continue
            val content = attrs["content"] ?: continue
            meta.putIfAbsent(key, decodeEntities(content))
        }
        val title = meta["og:title"] ?: meta["twitter:title"]
            ?: TITLE.find(html)?.groupValues?.get(1)?.let(::decodeEntities).orEmpty()
        val description = listOfNotNull(meta["og:description"], meta["twitter:description"], meta["description"])
            .maxByOrNull { it.length }.orEmpty()
        val postText = POST_TEXT.findAll(html).map { unescapeJson(it.groupValues[1]) }.maxByOrNull { it.length }.orEmpty()
        return PageInfo(title.trim(), description.trim(), postText.trim())
    }

    /** Drops the " | Facebook" and "| By Page Name" endings Facebook adds to titles and descriptions. */
    fun cleanCaption(text: String): String = text
        .replace(Regex("\\s*\\|\\s*Facebook\\s*$", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\|\\s*By [^|\\n]+$"), "")
        .replace(Regex("^\\d[\\d.,KkMm]* (?:views|reactions)\\s*·\\s*[^|\\n]*\\|\\s*"), "")
        .trim()

    private val boilerplate = listOf(
        "log into facebook", "log in to facebook", "log in or sign up", "see posts, photos and more on facebook",
        "facebook helps you connect", "you must log in", "this content isn't available", "this video isn't available",
        "create an account or log in",
    )

    /** True for text that is Facebook's sign-in page rather than the reel's own caption. */
    fun isBoilerplate(text: String): Boolean {
        val t = text.trim().lowercase()
        if (t.length < 15) return true
        if (t == "facebook" || t == "watch" || t == "reels") return true
        return boilerplate.any { t.contains(it) }
    }

    fun decodeEntities(text: String): String = Regex("&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);").replace(text) { m ->
        val e = m.groupValues[1]
        when {
            e.startsWith("#x") || e.startsWith("#X") -> e.substring(2).toIntOrNull(16)?.let(::codePoint) ?: m.value
            e.startsWith("#") -> e.substring(1).toIntOrNull()?.let(::codePoint) ?: m.value
            else -> namedEntities[e] ?: m.value
        }
    }

    private val namedEntities = mapOf(
        "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\"", "apos" to "'", "nbsp" to " ",
        "deg" to "°", "frac12" to "½", "frac14" to "¼", "frac34" to "¾", "hellip" to "…", "ndash" to "–",
        "mdash" to "—", "rsquo" to "’", "lsquo" to "‘", "rdquo" to "”", "ldquo" to "“",
    )

    private fun codePoint(cp: Int): String = if (cp in 0..0x10FFFF) String(Character.toChars(cp)) else ""

    /** Undoes JSON string escapes (\n, \", \u00e9 and surrogate pairs). */
    fun unescapeJson(text: String): String {
        val out = StringBuilder(text.length)
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c != '\\' || i + 1 >= text.length) {
                out.append(c); i++; continue
            }
            when (val n = text[i + 1]) {
                'n' -> out.append('\n')
                't' -> out.append('\t')
                'r' -> Unit
                'b', 'f' -> Unit
                'u' -> {
                    val hex = text.substring(i + 2, minOf(i + 6, text.length))
                    val code = hex.takeIf { it.length == 4 }?.toIntOrNull(16)
                    if (code != null) {
                        out.append(code.toChar()); i += 6; continue
                    }
                    out.append(n)
                }
                else -> out.append(n)
            }
            i += 2
        }
        return out.toString()
    }

    // --- Reading the page in the app (signed in, with comments) ---

    /** Facebook's buttons and labels, which show up as lines of their own in the page text. */
    private val uiLines = setOf(
        "like", "liked", "reply", "share", "send", "comment", "comments", "follow", "following", "see more",
        "see less", "most relevant", "all comments", "newest", "top comments", "write a comment…", "write a comment...",
        "comment as", "author", "top fan", "edited", "see translation", "hide translation", "rate this translation",
        "reels", "home", "search", "menu", "notifications", "watch", "marketplace", "log in", "create new account",
        "sign up", "forgot password?", "more", "save", "save video", "copy link", "report", "hide", "original audio",
        "mute", "unmute", "play", "pause", "close", "back", "next", "previous", "view more comments", "·", "…", "...",
    )
    private val countLine = Regex(
        "^[\\d.,]+[KkMm]?( (likes?|reactions?|comments?|shares?|views?|plays?|replies|reply))?$",
        RegexOption.IGNORE_CASE,
    )
    private val timeLine = Regex(
        "^(just now|yesterday|\\d+ ?(s|m|h|d|w|y|min|mins|hr|hrs|sec|secs|minutes?|hours?|days?|weeks?|years?)( ago)?)$",
        RegexOption.IGNORE_CASE,
    )
    private val repliesLine = Regex("^(view|see|hide) (all |more |previous )?\\d* ?(more )?(repl(y|ies)|comments?)$", RegexOption.IGNORE_CASE)

    /**
     * Tidies the text of a reel's page as shown in the app (caption, then comments): drops Facebook's
     * buttons, counts, timestamps and repeated lines, so what's left for the AI is the words people wrote.
     */
    fun cleanPageText(text: String): String {
        val out = mutableListOf<String>()
        for (raw in text.replace("\r\n", "\n").lines()) {
            val line = raw.replace('\u00A0', ' ').trim()
            if (line.isEmpty()) continue
            val lower = line.lowercase()
            if (lower in uiLines || countLine.matches(line) || timeLine.matches(line) || repliesLine.matches(line)) continue
            if (out.lastOrNull() == line) continue
            out += line
        }
        return out.joinToString("\n")
    }

    // --- Asking the AI ---

    private val REQUEST_LINK = Regex("^Reel: (\\S+)$", RegexOption.MULTILINE)

    /** The reel link in a request made by [aiRequest], as a full URL, or null for any other request. */
    fun linkInRequest(request: String): String? =
        if (request.startsWith(REQUEST_START)) REQUEST_LINK.find(request)?.groupValues?.get(1)?.let { "https://$it" } else null

    private const val REQUEST_START = "Here's a Facebook cooking video (reel)"

    /** Longest caption sent to the AI; Gemini Nano's window is small and captions rarely need more. */
    const val MAX_CAPTION_CHARS = 5_500

    /**
     * The request for any AI mode (Claude API, Claude app, Gemini Nano): find the recipe in the caption. The
     * DASH handling (keep it as written, suggest swaps, estimate sodium) comes from each mode's own prompt.
     */
    fun aiRequest(link: String?, caption: String): String = buildString {
        append(REQUEST_START).append(" I want to make. Nobody can watch the video here, ")
        append("so this is the text that came with it: the caption, maybe some comments, or what I copied from the video.\n")
        if (link != null) append("Reel: ").append(displayLink(link)).append('\n')
        append("\n<reel_text>\n")
        append(caption.trim().take(MAX_CAPTION_CHARS))
        append("\n</reel_text>\n\n")
        append(
            "Find the recipe in that text and treat it as a recipe I pasted. Ignore hashtags, emoji, " +
                "\"follow for more\" and similar. The recipe is often in a comment, usually from the reel's creator, " +
                "so check the comments too, and if several comments give different recipes, use the creator's. If it names the ingredients but not the amounts, use typical " +
                "amounts for the dish and say that the amounts are estimated. Reels often lean on salt, butter, " +
                "cheese, sauces and processed meat, so be clear about how well it fits DASH and what to swap. " +
                "If there's no recipe in it (for example \"recipe in the comments\" or \"link in bio\"), " +
                "don't make one up: say so and leave the ingredients empty, and I'll send a screenshot of the " +
                "recipe from the video instead.",
        )
    }
}
