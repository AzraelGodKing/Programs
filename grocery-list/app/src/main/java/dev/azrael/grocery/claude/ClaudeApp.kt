package dev.azrael.grocery.claude

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/** Hands a prompt (and optionally a photo) to the official Claude app, which uses the user's own plan. */
object ClaudeApp {
    private const val PACKAGE = "com.anthropic.claude"

    fun send(context: Context, prompt: String, image: Uri? = null) {
        // Not every version of the Claude app fills the message box from a share, so the prompt is
        // also on the clipboard, ready to paste.
        val clipboard = context.getSystemService(ClipboardManager::class.java)
        clipboard?.setPrimaryClip(ClipData.newPlainText("Prompt for Claude", prompt))

        val send = Intent(Intent.ACTION_SEND).apply {
            putExtra(Intent.EXTRA_TEXT, prompt)
            if (image != null) {
                type = "image/jpeg"
                putExtra(Intent.EXTRA_STREAM, image)
                clipData = ClipData.newRawUri("photo", image)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } else {
                type = "text/plain"
            }
        }
        try {
            context.startActivity(Intent(send).setPackage(PACKAGE))
        } catch (e: ActivityNotFoundException) {
            // Claude app not installed: let the user pick where to send it.
            context.startActivity(Intent.createChooser(send, "Send to Claude"))
        }
        Toast.makeText(
            context,
            "Prompt copied. If Claude's message box is empty, paste it. Then share or copy Claude's reply back here.",
            Toast.LENGTH_LONG,
        ).show()
    }
}
