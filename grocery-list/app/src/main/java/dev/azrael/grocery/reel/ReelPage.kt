package dev.azrael.grocery.reel

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * The reel's Facebook page inside the app. Sign in to Facebook here once (the sign-in stays in this app's
 * own web storage, separate from the Facebook app, and is left out of backups), open the comments if the
 * recipe is there, then "Use the text on this page" copies the caption and loaded comments back to the
 * reel screen. Nothing is read until that button is tapped.
 */
@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReelPage(link: String, onText: (String) -> Unit, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    var web by remember { mutableStateOf<WebView?>(null) }
    var reading by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    BackHandler {
        val w = web
        if (w != null && w.canGoBack()) w.goBack() else onClose()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reel on Facebook") },
                navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = {
                    TextButton(onClick = {
                        CookieManager.getInstance().removeAllCookies { web?.loadUrl(link) }
                    }) { Text("Sign out") }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
                    Text(
                        "Sign in if Facebook asks. If the recipe is in the comments, open them first (and tap " +
                            "See more on long ones), then use the text.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(
                        onClick = {
                            val w = web ?: return@Button
                            reading = true
                            scope.launch {
                                // Expand "See more" on the caption and comments, give the page a moment, then read it.
                                w.evaluateJavascript(EXPAND_JS, null)
                                delay(1_200)
                                val raw = suspendCancellableCoroutine { cont ->
                                    w.evaluateJavascript(TEXT_JS) { cont.resume(it) }
                                }
                                reading = false
                                val text = raw?.takeIf { it != "null" }?.removeSurrounding("\"")?.let(SharedReel::unescapeJson).orEmpty()
                                onText(SharedReel.cleanPageText(text))
                            }
                        },
                        enabled = !reading && web != null,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) { Text(if (reading) "Reading…" else "Use the text on this page") }
                }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        // Facebook gives embedded browsers ("wv") a cut-down page; look like Chrome instead.
                        settings.userAgentString = settings.userAgentString.replace("; wv", "")
                        CookieManager.getInstance().setAcceptCookie(true)
                        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                // Stay on web pages; ignore fb:// and intent:// links that try to open the Facebook app.
                                val scheme = request.url.scheme?.lowercase()
                                return scheme != "http" && scheme != "https"
                            }

                            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                                loading = true
                            }

                            override fun onPageFinished(view: WebView, url: String?) {
                                loading = false
                                // Keep the sign-in on disk right away, not only when the app closes.
                                CookieManager.getInstance().flush()
                            }
                        }
                        loadUrl(link)
                        web = this
                    }
                },
                onRelease = { it.destroy() },
            )
        }
    }
}

/** Taps the "See more" links on the caption and comments (at most 30). Returns how many it tapped. */
private const val EXPAND_JS = """
(function () {
  var n = 0;
  var nodes = document.querySelectorAll('[role="button"], span, div, a');
  for (var i = 0; i < nodes.length && n < 30; i++) {
    var e = nodes[i];
    if (e.childElementCount > 1) continue;
    var t = (e.innerText || '').trim().replace(/^[.…\s]+/, '');
    if (t === 'See more' || t === 'See More') { e.click(); n++; }
  }
  return n;
})()
"""

/** The text of the page as shown: the caption, then whatever comments are loaded. */
private const val TEXT_JS = "(function () { return document.body ? document.body.innerText : ''; })()"
