package dev.azrael.grocery.claude

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/** Photo files for Cabinet scans, kept in the app's cache (see res/xml/update_paths.xml). */
object Photos {
    /** A fresh content:// URI for the camera app to write a photo into. */
    fun newCaptureUri(context: Context): Uri {
        val dir = File(context.cacheDir, "photos").apply { mkdirs() }
        // Keep only the latest few; older scans aren't needed once their items are added.
        dir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(3)?.forEach { it.delete() }
        val file = File(dir, "scan-${System.currentTimeMillis()}.jpg")
        return FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
    }

    /**
     * Reads a photo and returns it as a JPEG no larger than [maxEdge] pixels on its long side, which is as
     * much detail as Claude uses and keeps the upload small on a phone connection.
     */
    fun loadJpeg(context: Context, uri: Uri, maxEdge: Int = 1568): ByteArray {
        val sized = loadBitmap(context, uri, maxEdge)
        return ByteArrayOutputStream().use { out ->
            sized.compress(Bitmap.CompressFormat.JPEG, 85, out)
            out.toByteArray()
        }
    }

    /** Reads a photo, upright, no larger than [maxEdge] pixels on its long side. */
    fun loadBitmap(context: Context, uri: Uri, maxEdge: Int): Bitmap {
        val bitmap = decode(context, uri, maxEdge)
        val scale = maxEdge.toFloat() / max(bitmap.width, bitmap.height)
        return if (scale < 1f) {
            Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).roundToInt(), (bitmap.height * scale).roundToInt(), true)
        } else {
            bitmap
        }
    }

    private fun decode(context: Context, uri: Uri, maxEdge: Int): Bitmap {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // ImageDecoder applies the photo's EXIF rotation and can downsample while decoding.
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            return ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                val longest = max(info.size.width, info.size.height)
                if (longest > maxEdge * 2) {
                    val factor = longest / (maxEdge * 2)
                    decoder.setTargetSize(info.size.width / factor, info.size.height / factor)
                }
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxEdge) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        return context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
            ?: error("Couldn't open the photo")
    }
}
