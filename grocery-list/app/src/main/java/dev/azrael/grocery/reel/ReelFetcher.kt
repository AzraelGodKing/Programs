package dev.azrael.grocery.reel

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Loads a reel's public page the way a signed-out phone browser would and reads its preview tags. Facebook
 * often puts the caption there; when it shows its sign-in page instead, [SharedReel.PageInfo.caption] is
 * empty. Blocking: call from a background thread. Only the link is sent, with no cookies or account.
 */
object ReelFetcher {
    private const val USER_AGENT =
        "Mozilla/5.0 (Linux; Android 16; SM-S948U) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/142.0.0.0 Mobile Safari/537.36"

    /** The preview tags live in <head>; there's no need to download the rest of a large page. */
    private const val MAX_BYTES = 1_500_000
    private const val MAX_REDIRECTS = 6

    fun fetch(link: String): SharedReel.PageInfo {
        var url = URL(link)
        repeat(MAX_REDIRECTS) {
            val conn = (url.openConnection() as HttpURLConnection).apply {
                // Followed by hand so a redirect from http to https (fb.watch does this) is followed too.
                instanceFollowRedirects = false
                connectTimeout = 15_000
                readTimeout = 20_000
                setRequestProperty("User-Agent", USER_AGENT)
                setRequestProperty("Accept", "text/html,application/xhtml+xml")
                setRequestProperty("Accept-Language", "en-US,en;q=0.9")
            }
            try {
                val code = conn.responseCode
                if (code in 300..399) {
                    val next = conn.getHeaderField("Location") ?: throw IOException("Facebook sent an empty redirect")
                    url = URL(url, next)
                    return@repeat
                }
                if (code !in 200..299) throw IOException("Facebook answered $code")
                return SharedReel.parsePage(readHead(conn))
            } finally {
                conn.disconnect()
            }
        }
        throw IOException("Too many redirects")
    }

    private fun readHead(conn: HttpURLConnection): String {
        val out = StringBuilder()
        conn.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
            val buf = CharArray(16_384)
            while (out.length < MAX_BYTES) {
                val n = reader.read(buf)
                if (n < 0) break
                out.appendRange(buf, 0, n)
                // Embedded post text can sit past </head>, so read a little further, then stop.
                if (out.length > 400_000 && out.contains("</head>", ignoreCase = true)) break
            }
        }
        return out.toString()
    }
}
