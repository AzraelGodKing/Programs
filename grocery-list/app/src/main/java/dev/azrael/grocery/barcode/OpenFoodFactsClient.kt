package dev.azrael.grocery.barcode

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/** Looks a barcode up on Open Food Facts. Sends only the barcode; no account or key. */
object OpenFoodFactsClient {
    /** Null when the product isn't listed. Throws on network errors. */
    suspend fun lookup(barcode: String): ScannedProduct? = withContext(Dispatchers.IO) {
        val conn = (URL(OpenFoodFacts.productUrl(barcode)).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 15_000
            // Open Food Facts asks apps to identify themselves.
            setRequestProperty("User-Agent", "GroceryList-Android/1.0")
            setRequestProperty("Accept", "application/json")
        }
        try {
            when (conn.responseCode) {
                200 -> OpenFoodFacts.parse(barcode, conn.inputStream.bufferedReader().use { it.readText() })
                404 -> null
                else -> error("Open Food Facts returned ${conn.responseCode}")
            }
        } finally {
            conn.disconnect()
        }
    }
}
