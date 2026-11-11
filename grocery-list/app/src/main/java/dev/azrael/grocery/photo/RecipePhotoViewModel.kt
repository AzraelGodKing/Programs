package dev.azrael.grocery.photo

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.claude.ClaudeException
import dev.azrael.grocery.claude.ClaudeRecipeClient
import dev.azrael.grocery.claude.ClaudeSettings
import dev.azrael.grocery.claude.GeminiNano
import dev.azrael.grocery.claude.Photos
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface PhotoState {
    data object Start : PhotoState
    /** Claude app mode: the photo went to the Claude app; waiting for its reply to come back. */
    data class SentToApp(val photo: Uri) : PhotoState
    data class Working(val step: String) : PhotoState
    data class Review(val reading: RecipeReading, val byAi: Boolean, val photo: Uri?) : PhotoState
    /** [photo] is kept so the user can retry with the on-device reader. */
    data class Failed(val message: String, val photo: Uri?) : PhotoState
}

/**
 * Photo of a recipe → text in English → the user reviews it → Add recipe parses it as usual.
 * Without AI (or when the user picks it) everything runs on the phone with ML Kit: text recognition,
 * language detection, then translation. With AI on, the selected assistant reads the photo itself.
 */
class RecipePhotoViewModel(
    private val app: Application,
    val settings: ClaudeSettings,
    private val nano: () -> GeminiNano,
) : AndroidViewModel(app) {
    private val _state = MutableStateFlow<PhotoState>(PhotoState.Start)
    val state: StateFlow<PhotoState> = _state.asStateFlow()
    private var job: Job? = null

    /** A photo was taken or picked. */
    fun onPhoto(photo: Uri, useAi: Boolean, script: Script, sendToApp: (Uri) -> Unit) {
        val config = settings.config.value
        if (!useAi || !config.enabled) {
            readOnDevice(photo, script)
            return
        }
        if (!config.inApp) {
            job?.cancel()
            sendToApp(photo)
            _state.value = PhotoState.SentToApp(photo)
            return
        }
        if (config.usesApi && !config.hasKey) {
            _state.value = PhotoState.Failed("Add your API key in AI settings, or turn off Read with AI.", photo)
            return
        }
        run(photo) {
            _state.value = PhotoState.Working("${config.assistant} is reading the recipe…")
            val reply = if (config.onDevice) {
                val nano = nano()
                nano.ensureReady()
                val bitmap = withContext(Dispatchers.IO) { Photos.loadBitmap(app, photo, maxEdge = 1024) }
                nano.readRecipePhoto(bitmap)
            } else {
                withContext(Dispatchers.IO) {
                    val jpeg = Photos.loadJpeg(app, photo)
                    ClaudeRecipeClient(config.apiKey, config.model).use { it.readRecipePhoto(jpeg) }
                }
            }
            review(RecipePhoto.parseReply(reply), byAi = true, photo = photo)
        }
    }

    /** Reads the photo with ML Kit on the phone and translates it to English if needed. */
    fun readOnDevice(photo: Uri, script: Script) = run(photo) {
        _state.value = PhotoState.Working("Reading the text…")
        val bitmap = withContext(Dispatchers.IO) { Photos.loadBitmap(app, photo, maxEdge = 2048) }
        val text = OnDeviceReader.readText(bitmap, script)
        if (text.isBlank()) {
            PhotoState.Failed(
                "No text found in that photo. Try again closer, flat and in good light" +
                    if (script == Script.LATIN) "." else ", or check the alphabet setting.",
                photo,
            )
        } else {
            val tag = OnDeviceReader.detectLanguage(text)
            if (OnDeviceReader.canTranslate(tag)) {
                translated(text, tag, photo)
            } else {
                val note = if (!RecipePhoto.isEnglishOrUnknown(tag)) {
                    "This looks like ${RecipePhoto.languageName(tag) ?: tag}, which the phone can't translate. Pick the language below if it's wrong."
                } else {
                    ""
                }
                PhotoState.Review(RecipeReading(text, original = text, note = note), byAi = false, photo = photo)
            }
        }
    }

    /** The user picked the photo's language by hand (detection was wrong, or the text was short). */
    fun translateFrom(tag: String) {
        val review = _state.value as? PhotoState.Review ?: return
        val original = review.reading.original ?: return
        run(review.photo) {
            if (tag == ENGLISH) {
                PhotoState.Review(RecipeReading(original, original = original), byAi = false, photo = review.photo)
            } else {
                translated(original, tag, review.photo)
            }
        }
    }

    private suspend fun translated(text: String, tag: String, photo: Uri?): PhotoState {
        val name = RecipePhoto.languageName(tag) ?: tag
        val english = OnDeviceReader.translateToEnglish(
            text,
            tag,
            onDownloading = { _state.value = PhotoState.Working("Getting the $name translation (one-time download)…") },
            onTranslating = { _state.value = PhotoState.Working("Translating from $name…") },
        )
        return PhotoState.Review(
            RecipeReading(english, original = text, fromLanguage = name),
            byAi = false,
            photo = photo,
        )
    }

    /** A Claude app reply, shared or pasted back in. */
    fun onReplyText(text: String) {
        job?.cancel()
        val photo = (_state.value as? PhotoState.SentToApp)?.photo
        _state.value = if (RecipePhoto.isPrompt(text)) {
            PhotoState.Failed("That's the prompt sent to Claude, not its reply. Copy Claude's answer and paste that.", photo)
        } else {
            review(RecipePhoto.parseReply(text), byAi = true, photo = photo)
        }
    }

    private fun review(reading: RecipeReading, byAi: Boolean, photo: Uri?): PhotoState =
        if (reading.text.isBlank()) {
            PhotoState.Failed(reading.note.ifBlank { "No recipe came back from that photo." }, photo)
        } else {
            PhotoState.Review(reading, byAi, photo)
        }

    private fun run(photo: Uri?, block: suspend () -> PhotoState) {
        job?.cancel()
        _state.value = PhotoState.Working("Working…")
        job = viewModelScope.launch {
            val result = try {
                block()
            } catch (e: CancellationException) {
                throw e
            } catch (e: PhotoReadException) {
                PhotoState.Failed(e.message ?: "Couldn't read the photo.", photo)
            } catch (e: ClaudeException) {
                PhotoState.Failed(e.message ?: "Something went wrong.", photo)
            } catch (e: Exception) {
                PhotoState.Failed("Couldn't read the photo: ${e.message ?: e.javaClass.simpleName}", photo)
            }
            _state.value = result
        }
    }

    fun reset() {
        job?.cancel()
        _state.value = PhotoState.Start
    }

    companion object {
        const val ENGLISH = "en"

        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                RecipePhotoViewModel(app, app.claudeSettings) { app.nano }
            }
        }
    }
}
