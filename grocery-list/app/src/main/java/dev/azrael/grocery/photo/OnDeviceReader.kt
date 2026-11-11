package dev.azrael.grocery.photo

import android.graphics.Bitmap
import com.google.android.gms.tasks.Task
import com.google.mlkit.common.MlKitException
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizerOptionsInterface
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PhotoReadException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Reads and translates recipe photos on the phone with Google ML Kit: free, no account, no AI needed.
 * Text recognition models come through Google Play services (downloaded once, on first use). Each
 * translation language is a one-time download of about 30 MB, kept on the phone and used offline after.
 */
object OnDeviceReader {
    /** Every language ML Kit can translate to English, as (tag, English name), sorted by name. */
    val translatableLanguages: List<Pair<String, String>> by lazy {
        TranslateLanguage.getAllLanguages()
            .filter { it != TranslateLanguage.ENGLISH }
            .map { it to (RecipePhoto.languageName(it) ?: it) }
            .sortedBy { it.second }
    }

    /** The text on the photo, tidied. Throws [PhotoReadException] with a message for the user. */
    suspend fun readText(photo: Bitmap, script: Script): String {
        val recognizer = TextRecognition.getClient(options(script))
        try {
            val result = recognizer.process(InputImage.fromBitmap(photo, 0)).await()
            return RecipePhoto.cleanOcr(result.text)
        } catch (e: CancellationException) {
            throw e
        } catch (e: MlKitException) {
            throw PhotoReadException(
                if (e.errorCode == MlKitException.UNAVAILABLE) {
                    "Google Play services is still downloading the text reader. Give it a minute (on Wi-Fi if you can) and try again."
                } else {
                    "Couldn't read the photo: ${e.message ?: "error ${e.errorCode}"}"
                },
                e,
            )
        } finally {
            recognizer.close()
        }
    }

    /** ML Kit's guess at the language (a BCP-47 tag such as "es"), or [RecipePhoto.UNDETERMINED]. */
    suspend fun detectLanguage(text: String): String {
        val identifier = LanguageIdentification.getClient(
            LanguageIdentificationOptions.Builder().setConfidenceThreshold(0.4f).build(),
        )
        return try {
            identifier.identifyLanguage(text.take(4000)).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            RecipePhoto.UNDETERMINED
        } finally {
            identifier.close()
        }
    }

    /** Whether ML Kit can translate from [tag] to English. */
    fun canTranslate(tag: String): Boolean =
        TranslateLanguage.fromLanguageTag(tag) != null && !RecipePhoto.isEnglishOrUnknown(tag)

    /**
     * Translates [text] from [tag] into English one line at a time, so ingredient lines stay one per line
     * for the parser. [onDownloading] is called before the language model is fetched (first time only
     * takes long).
     */
    suspend fun translateToEnglish(text: String, tag: String, onDownloading: () -> Unit, onTranslating: () -> Unit): String {
        val source = TranslateLanguage.fromLanguageTag(tag)
            ?: throw PhotoReadException("The phone can't translate ${RecipePhoto.languageName(tag) ?: tag} yet.")
        val translator = Translation.getClient(
            TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(TranslateLanguage.ENGLISH).build(),
        )
        try {
            onDownloading()
            try {
                translator.downloadModelIfNeeded(DownloadConditions.Builder().build()).await()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                throw PhotoReadException(
                    "Couldn't download the ${RecipePhoto.languageName(tag) ?: tag} translation (about 30 MB, " +
                        "one time). Check your connection and try again.",
                    e,
                )
            }
            onTranslating()
            val out = StringBuilder()
            for ((i, line) in text.lines().withIndex()) {
                if (i > 0) out.append('\n')
                out.append(if (RecipePhoto.hasWords(line)) translator.translate(line).await() else line)
            }
            return out.toString()
        } catch (e: CancellationException) {
            throw e
        } catch (e: PhotoReadException) {
            throw e
        } catch (e: Exception) {
            throw PhotoReadException("Translation failed: ${e.message ?: e.javaClass.simpleName}", e)
        } finally {
            translator.close()
        }
    }

    private fun options(script: Script): TextRecognizerOptionsInterface = when (script) {
        Script.LATIN -> TextRecognizerOptions.DEFAULT_OPTIONS
        Script.CHINESE -> ChineseTextRecognizerOptions.Builder().build()
        Script.JAPANESE -> JapaneseTextRecognizerOptions.Builder().build()
        Script.KOREAN -> KoreanTextRecognizerOptions.Builder().build()
        Script.DEVANAGARI -> DevanagariTextRecognizerOptions.Builder().build()
    }

    /** The alphabet to read with for a phone set to [locale], so most people never have to pick. */
    fun defaultScript(locale: Locale = Locale.getDefault()): Script = when (locale.language) {
        "zh" -> Script.CHINESE
        "ja" -> Script.JAPANESE
        "ko" -> Script.KOREAN
        "hi", "mr", "ne" -> Script.DEVANAGARI
        else -> Script.LATIN
    }
}

/** Waits for a Play services / ML Kit task without blocking the main thread. */
private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { cont ->
    addOnSuccessListener { cont.resume(it) }
    addOnFailureListener { cont.resumeWithException(it) }
    addOnCanceledListener { cont.cancel() }
}
