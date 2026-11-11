package dev.azrael.grocery.barcode

import android.content.Context
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

/**
 * Google's code scanner from Play services: it shows its own camera screen and hands back the code, so the
 * app needs no camera permission. The scanner module downloads once on first use.
 */
object BarcodeScanner {
    private val options = GmsBarcodeScannerOptions.Builder()
        .setBarcodeFormats(
            Barcode.FORMAT_EAN_13,
            Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_UPC_A,
            Barcode.FORMAT_UPC_E,
        )
        .enableAutoZoom()
        .build()

    fun scan(
        context: Context,
        onResult: (String) -> Unit,
        onCancel: () -> Unit,
        onError: (String) -> Unit,
    ) {
        GmsBarcodeScanning.getClient(context, options).startScan()
            .addOnSuccessListener { code ->
                val value = code.rawValue
                if (value.isNullOrBlank()) onError("That code couldn't be read.") else onResult(value)
            }
            .addOnCanceledListener { onCancel() }
            .addOnFailureListener { e -> onError(e.message ?: "The scanner isn't available on this phone.") }
    }
}
