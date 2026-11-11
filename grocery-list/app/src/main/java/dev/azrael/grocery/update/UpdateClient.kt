package dev.azrael.grocery.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class AvailableUpdate(
    val build: Int,
    val apkUrl: String,
    val pageUrl: String,
    val sizeBytes: Long,
)

/** Finds, downloads and installs newer builds from this repo's GitHub releases. */
object UpdateClient {
    private const val RELEASES_URL =
        "https://api.github.com/repos/AzraelGodKing/Programs/releases?per_page=30"

    /** Release tags look like "grocery-list-build-7"; the number matches the app's versionCode. */
    fun buildNumber(tag: String): Int? =
        Regex("^grocery-list-build-(\\d+)$").find(tag)?.groupValues?.get(1)?.toIntOrNull()

    /** Returns the newest published build if it is newer than [currentBuild], else null. */
    suspend fun findNewer(currentBuild: Int): AvailableUpdate? = withContext(Dispatchers.IO) {
        val conn = (URL(RELEASES_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "GroceryList-Android")
        }
        try {
            if (conn.responseCode != 200) error("GitHub returned ${conn.responseCode}")
            val releases = JSONArray(conn.inputStream.bufferedReader().use { it.readText() })
            var best: AvailableUpdate? = null
            for (i in 0 until releases.length()) {
                val r = releases.getJSONObject(i)
                if (r.optBoolean("draft")) continue
                val build = buildNumber(r.optString("tag_name")) ?: continue
                if (build <= currentBuild || build <= (best?.build ?: 0)) continue
                val assets = r.optJSONArray("assets") ?: continue
                for (j in 0 until assets.length()) {
                    val a = assets.getJSONObject(j)
                    if (a.optString("name").endsWith(".apk")) {
                        best = AvailableUpdate(
                            build = build,
                            apkUrl = a.getString("browser_download_url"),
                            pageUrl = r.optString("html_url"),
                            sizeBytes = a.optLong("size"),
                        )
                        break
                    }
                }
            }
            best
        } finally {
            conn.disconnect()
        }
    }

    /** Downloads the APK into the app's cache, reporting progress from 0 to 1. */
    suspend fun download(context: Context, update: AvailableUpdate, onProgress: (Float) -> Unit): File =
        withContext(Dispatchers.IO) {
            val dir = File(context.cacheDir, "updates").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }
            val target = File(dir, "grocery-list-${update.build}.apk")
            val conn = (URL(update.apkUrl).openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = true
                connectTimeout = 10_000
                readTimeout = 30_000
                setRequestProperty("User-Agent", "GroceryList-Android")
            }
            try {
                if (conn.responseCode != 200) error("Download failed (${conn.responseCode})")
                val total = conn.contentLengthLong.takeIf { it > 0 } ?: update.sizeBytes
                conn.inputStream.use { input ->
                    target.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var done = 0L
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            output.write(buffer, 0, n)
                            done += n
                            if (total > 0) onProgress((done.toFloat() / total).coerceIn(0f, 1f))
                        }
                    }
                }
            } finally {
                conn.disconnect()
            }
            target
        }

    /** Android requires the user to allow this app to install other apps once. */
    fun canInstall(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

    fun openInstallPermissionSettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Hands the downloaded APK to the system installer, which shows its own confirm screen. */
    fun install(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
