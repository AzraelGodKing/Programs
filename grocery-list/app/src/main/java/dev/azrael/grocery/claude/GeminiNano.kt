package dev.azrael.grocery.claude

import android.graphics.Bitmap
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.prompt.Candidate
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.SystemInstruction
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import dev.azrael.grocery.photo.RecipePhoto
import kotlinx.coroutines.CancellationException

/** Whether Gemini Nano can run on this phone right now. */
sealed interface NanoStatus {
    data object Checking : NanoStatus
    /** The phone doesn't support it, or AICore hasn't been set up or updated yet. */
    data object Unavailable : NanoStatus
    /** Supported, but the model isn't on the phone yet. */
    data object Downloadable : NanoStatus
    data class Downloading(val downloaded: Long = 0, val total: Long = 0) : NanoStatus
    data object Ready : NanoStatus
    data class Failed(val message: String) : NanoStatus
}

/**
 * Gemini Nano through ML Kit's GenAI Prompt API. The model runs inside Android's AICore service on the
 * phone, so it's free, works offline, and nothing leaves the device. Supported on phones such as the
 * Galaxy S25/S26 series and Pixel 9 and later (see developers.google.com/ml-kit/genai). Google only lets
 * apps use it while they're on screen, and AICore caps how much each app can use per day.
 */
class GeminiNano {
    // Created on first use, inside status()'s try, since it can fail on phones without AICore.
    private val model: GenerativeModel by lazy { Generation.getClient() }

    suspend fun status(): NanoStatus = try {
        when (model.checkStatus()) {
            FeatureStatus.AVAILABLE -> NanoStatus.Ready
            FeatureStatus.DOWNLOADABLE -> NanoStatus.Downloadable
            FeatureStatus.DOWNLOADING -> NanoStatus.Downloading()
            else -> NanoStatus.Unavailable
        }
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        // Thrown on phones without AICore at all, among others.
        NanoStatus.Unavailable
    }

    /** Downloads the model into AICore (a large, one-time download shared with other apps), reporting progress. */
    suspend fun download(onStatus: (NanoStatus) -> Unit) {
        var total = 0L
        model.download().collect { s ->
            when (s) {
                is DownloadStatus.DownloadStarted -> {
                    total = s.bytesToDownload
                    onStatus(NanoStatus.Downloading(0, total))
                }
                is DownloadStatus.DownloadProgress -> onStatus(NanoStatus.Downloading(s.totalBytesDownloaded, total))
                is DownloadStatus.DownloadCompleted -> onStatus(NanoStatus.Ready)
                is DownloadStatus.DownloadFailed ->
                    throw ClaudeException("Gemini Nano didn't download: ${s.e.message ?: "unknown error"}", s.e)
            }
        }
    }

    /** Makes sure Nano is on the phone, downloading it first if needed; throws if it can't be used. */
    suspend fun ensureReady(onStatus: (NanoStatus) -> Unit = {}) {
        var status = status()
        onStatus(status)
        if (status is NanoStatus.Downloadable || status is NanoStatus.Downloading) {
            try {
                download(onStatus)
            } catch (e: CancellationException) {
                throw e
            } catch (e: ClaudeException) {
                throw e
            } catch (e: Exception) {
                throw ClaudeException("Gemini Nano didn't download: ${e.message ?: e.javaClass.simpleName}", e)
            }
            status = status()
            onStatus(status)
        }
        if (status !is NanoStatus.Ready) throw ClaudeException(UNAVAILABLE)
    }

    /** Same job as [ClaudeRecipeClient.ask]: write a DASH recipe, or read a pasted one. */
    suspend fun ask(input: String, onHand: List<String> = emptyList()): ClaudeRecipe {
        NanoPrompts.problemWith(input)?.let { throw ClaudeException(it) }
        val text = generate {
            generateContentRequest(SystemInstruction(NanoPrompts.SYSTEM), TextPart(NanoPrompts.recipe(input, onHand))) {
                temperature = 0.2f
                maxOutputTokens = 1500
            }
        }
        return try {
            ClaudeRecipe.parse(text)
        } catch (e: Exception) {
            throw ClaudeException(
                "Gemini Nano's answer didn't come out in a form the app can read. Try again, or use the built-in " +
                    "Add recipe → Paste.",
                e,
            )
        }
    }

    /** Same job as [ClaudeRecipeClient.identifyItems]: list the groceries in a photo. */
    suspend fun identifyItems(photo: Bitmap): CabinetScan {
        val text = generate {
            generateContentRequest(ImagePart(photo), TextPart(NanoPrompts.PHOTO)) {
                temperature = 0.1f
                maxOutputTokens = 600
            }
        }
        return CabinetScan.parseReplyText(text)
    }

    /** Copies out the recipe in a photo, in English. The reply is read by [RecipePhoto.parseReply]. */
    suspend fun readRecipePhoto(photo: Bitmap): String = generate {
        generateContentRequest(ImagePart(photo), TextPart(NanoPrompts.RECIPE_PHOTO)) {
            temperature = 0.1f
            maxOutputTokens = 1500
        }
    }

    private suspend fun generate(request: () -> com.google.mlkit.genai.prompt.GenerateContentRequest): String {
        val candidate = try {
            model.generateContent(request()).candidates.firstOrNull()
        } catch (e: CancellationException) {
            throw e
        } catch (e: GenAiException) {
            throw ClaudeException(messageFor(e), e)
        } catch (e: Exception) {
            throw ClaudeException("Gemini Nano failed: ${e.message ?: e.javaClass.simpleName}", e)
        }
        val text = candidate?.text?.trim().orEmpty()
        if (text.isEmpty()) {
            if (candidate?.finishReason == Candidate.FinishReason.MAX_TOKENS) {
                throw ClaudeException("Gemini Nano's answer was too long and got cut off. Try a shorter recipe.")
            }
            throw ClaudeException("Gemini Nano didn't send back an answer. Try again.")
        }
        return text
    }

    private fun messageFor(e: GenAiException): String = when (e.errorCode) {
        GenAiException.ErrorCode.BUSY -> "Gemini Nano is busy. Wait a few seconds and try again."
        GenAiException.ErrorCode.BACKGROUND_USE_BLOCKED -> "Keep Grocery List on screen while Gemini Nano works."
        GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED ->
            "Android's daily limit for on-device AI in this app is used up. Try again tomorrow, or switch to Claude in AI settings."
        else -> "Gemini Nano failed: ${e.message ?: "error ${e.errorCode}"}"
    }

    companion object {
        const val UNAVAILABLE =
            "Gemini Nano isn't available on this phone right now. It needs a supported phone (such as a Galaxy " +
                "S25 or S26, or a Pixel 9 or later) with AICore up to date and a locked bootloader. Check for system " +
                "updates, or switch to Claude in AI settings."
    }
}
