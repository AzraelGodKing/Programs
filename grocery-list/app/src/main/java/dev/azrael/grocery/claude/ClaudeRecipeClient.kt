package dev.azrael.grocery.claude

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.NotFoundException
import com.anthropic.errors.OverloadedException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.Base64ImageSource
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.JsonOutputFormat
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.WebFetchTool20250910
import com.anthropic.models.messages.WebFetchTool20260209
import java.time.Duration
import java.util.Base64

/** Models offered in settings. The user pays for their own key, so they pick the tradeoff. */
enum class ClaudeModel(val id: String, val label: String, val blurb: String) {
    OPUS("claude-opus-5-5", "Claude Opus 5.5", "Best recipes; roughly 5-10¢ per recipe"),
    SONNET("claude-sonnet-5-5", "Claude Sonnet 5.5", "Faster; about half the cost of Opus"),
    HAIKU("claude-haiku-5-5", "Claude Haiku 5.5", "Fastest and cheapest (well under 1¢); fine for reading pasted recipes");

    companion object {
        val DEFAULT = OPUS
        fun fromId(id: String?): ClaudeModel = entries.firstOrNull { it.id == id } ?: DEFAULT
    }
}

class ClaudeException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Talks to the Claude API with the user's own key. Blocking: call from a background thread.
 * Plain Kotlin (no Android) so it can be unit tested on the JVM.
 */
class ClaudeRecipeClient(apiKey: String, private val model: ClaudeModel) : AutoCloseable {
    private val client: AnthropicClient = AnthropicOkHttpClient.builder()
        .apiKey(apiKey)
        // Thinking plus a page fetch can take a while on a phone connection.
        .timeout(Duration.ofMinutes(3))
        .maxRetries(2)
        .build()

    /** Cheap check that the key works: looks up the chosen model, which costs no tokens. */
    fun testKey() {
        translateErrors { client.models().retrieve(model.id) }
    }

    /**
     * [input] is either a request ("quick chicken dinner for 2") or a pasted recipe / link.
     * [onHand] are things the user already has (left off the shopping part, not out of the recipe).
     */
    fun ask(input: String, onHand: List<String> = emptyList()): ClaudeRecipe = translateErrors {
        val json = runStructured(buildParams(input, onHand))
        try {
            ClaudeRecipe.parse(json)
        } catch (e: Exception) {
            throw ClaudeException("Couldn't read Claude's answer.", e)
        }
    }

    /** Lists the grocery items Claude can see in a JPEG photo. */
    fun identifyItems(jpeg: ByteArray): CabinetScan = translateErrors {
        val json = runStructured(buildPhotoParams(jpeg))
        try {
            CabinetScan.parse(json)
        } catch (e: Exception) {
            throw ClaudeException("Couldn't read Claude's answer.", e)
        }
    }

    /** Sends [first], continues paused turns, checks how it stopped, and returns the JSON answer text. */
    private fun runStructured(first: MessageCreateParams): String {
        var params = first
        var response: Message = client.messages().create(params)
        // Server tools (web fetch) can pause a long turn; send it back to let Claude continue.
        var continues = 0
        while (response.stopReason().orElse(null) == StopReason.PAUSE_TURN && continues < 4) {
            params = params.toBuilder().addMessage(response).build()
            response = client.messages().create(params)
            continues++
        }
        when (response.stopReason().orElse(null)) {
            StopReason.REFUSAL -> throw ClaudeException(
                "Claude declined this request" +
                    (response.stopDetails().flatMap { it.explanation() }.orElse(null)?.let { ": $it" } ?: "."),
            )
            StopReason.MAX_TOKENS -> throw ClaudeException("Claude's answer was too long and got cut off. Try a simpler request.")
            StopReason.PAUSE_TURN -> throw ClaudeException("Claude took too long reading that page. Try pasting the recipe text instead.")
            else -> Unit
        }
        // With structured output the final text block is the JSON answer; earlier ones may be
        // short notes written around a web fetch.
        val texts = response.content().mapNotNull { block -> block.text().orElse(null)?.text() }
        return texts.lastOrNull { it.contains('{') } ?: throw ClaudeException("Claude didn't send back an answer.")
    }

    internal fun buildPhotoParams(jpeg: ByteArray): MessageCreateParams {
        val image = Base64ImageSource.builder()
            .mediaType(Base64ImageSource.MediaType.IMAGE_JPEG)
            .data(Base64.getEncoder().encodeToString(jpeg))
            .build()
        val builder = MessageCreateParams.builder()
            .model(model.id)
            .maxTokens(8000L)
            .outputConfig(
                OutputConfig.builder()
                    .effort(OutputConfig.Effort.LOW)
                    .format(JsonOutputFormat.builder().schema(schemaOf(CabinetScan.SCHEMA)).build())
                    .build(),
            )
            // Image before the text, as recommended for vision prompts.
            .addUserMessageOfContentBlockParams(
                listOf(ContentBlockParam.ofImage(image), ContentBlockParam.ofText(CabinetScan.PHOTO_INSTRUCTIONS)),
            )
        addFallbacks(builder)
        return builder.build()
    }

    internal fun buildParams(input: String, onHand: List<String>): MessageCreateParams {
        val userText = buildString {
            append(input.trim())
            if (onHand.isNotEmpty()) {
                append("\n\n<on_hand>\n")
                onHand.forEach { append("- ").append(it).append('\n') }
                append("</on_hand>")
            }
        }
        val builder = MessageCreateParams.builder()
            .model(model.id)
            .maxTokens(16000L)
            .system(SYSTEM_PROMPT)
            .outputConfig(
                OutputConfig.builder()
                    .effort(OutputConfig.Effort.MEDIUM)
                    .format(JsonOutputFormat.builder().schema(schemaOf(SCHEMA)).build())
                    .build(),
            )
            .addUserMessage(userText)
        // Web fetch can only open URLs that appear in the conversation, so only offer it then.
        if (URL_REGEX.containsMatchIn(input)) {
            if (model == ClaudeModel.HAIKU) {
                builder.addTool(WebFetchTool20250910.builder().maxUses(2L).maxContentTokens(30_000L).build())
            } else {
                builder.addTool(WebFetchTool20260209.builder().maxUses(2L).maxContentTokens(30_000L).build())
            }
        }
        addFallbacks(builder)
        return builder.build()
    }

    /**
     * If a safety check declines on Opus/Sonnet, let the API retry on a suitable model instead of
     * failing. Haiku has no server-side fallback.
     */
    private fun addFallbacks(builder: MessageCreateParams.Builder) {
        if (model != ClaudeModel.HAIKU) {
            builder.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
            builder.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
        }
    }

    override fun close() = client.close()

    private inline fun <T> translateErrors(block: () -> T): T = try {
        block()
    } catch (e: ClaudeException) {
        throw e
    } catch (e: UnauthorizedException) {
        throw ClaudeException("Anthropic rejected the API key. Check it in Claude settings.", e)
    } catch (e: PermissionDeniedException) {
        throw ClaudeException("This API key isn't allowed to use ${model.label}.", e)
    } catch (e: NotFoundException) {
        throw ClaudeException("${model.label} isn't available to this API key. Pick another model in Claude settings.", e)
    } catch (e: RateLimitException) {
        throw ClaudeException("Too many requests, or the key is out of credit. Wait a minute and try again.", e)
    } catch (e: OverloadedException) {
        throw ClaudeException("Claude is busy right now. Try again in a minute.", e)
    } catch (e: AnthropicServiceException) {
        throw ClaudeException("Claude API error ${e.statusCode()}.", e)
    } catch (e: AnthropicIoException) {
        throw ClaudeException("Couldn't reach Claude. Check your connection.", e)
    }

    companion object {
        private val URL_REGEX = Regex("https?://\\S+", RegexOption.IGNORE_CASE)

        val SYSTEM_PROMPT = """
            You help one person plan meals and shop for groceries. They follow the DASH diet (Dietary Approaches to Stop Hypertension), so every recipe you write should fit it.

            The user's message is one of two things:

            1. A recipe they pasted, or a link to one. Extract that recipe faithfully: title, servings, every ingredient and the steps. Don't change the ingredients. Instead, put DASH-friendlier substitutions in `swaps` (for example low-sodium broth, no-salt-added canned tomatoes, whole-wheat pasta, half the salt), and say briefly in `dash_notes` how well the recipe fits DASH as written. If a link can't be read, say so in `dash_notes`, leave `ingredients` and `steps` empty, and suggest pasting the recipe text.

            2. A request for a recipe or meal idea (anything else). Write one original recipe that fits DASH: built on vegetables, fruits, whole grains, beans, nuts and seeds, fish, skinless poultry and low-fat dairy; little red or processed meat, saturated fat or added sugar; flavor from herbs, spices, garlic, citrus and vinegar rather than salt; low-sodium or no-salt-added canned goods and broth; aim for under about 600 mg sodium per serving. Keep it practical for a home cook. `swaps` may be empty. Use `dash_notes` for one or two sentences on why it fits DASH.

            If the message contains an <on_hand> list, those are things the user already has. Use them where they fit, and still list them as ingredients.

            Ingredients: one entry per item to buy, in recipe order.
            - `name` is the plain grocery item ("yellow onion", "low-sodium chicken broth"), with no amount and no prep words.
            - `quantity` is a number (0.5, not "1/2"), or null when there is no amount ("pepper to taste").
            - `unit` is one of: tsp, tbsp, cup, fl oz, pint, quart, ml, l, g, kg, oz, lb, clove, can, jar, package, bunch, slice, stalk, sprig, head, pinch, bag, box, bottle, stick, fillet, breast, loaf. Use null for whole items counted by number (2 eggs, 1 onion).
            - Prep and other details (diced, divided, 15-oz can, optional) go in `note`, or null.

            `summary` is one sentence describing the dish. `sodium_mg_per_serving` is your honest estimate, or null if you can't estimate it. Keep each step short.
        """.trimIndent()

        private fun nullable(type: String): Map<String, Any> =
            mapOf("anyOf" to listOf(mapOf("type" to type), mapOf("type" to "null")))

        private fun obj(properties: Map<String, Any>): Map<String, Any> = mapOf(
            "type" to "object",
            "properties" to properties,
            "required" to properties.keys.toList(),
            "additionalProperties" to false,
        )

        /** JSON schema for [ClaudeRecipe]; structured output guarantees the answer matches it. */
        val SCHEMA: Map<String, Any> = obj(
            linkedMapOf(
                "title" to mapOf("type" to "string"),
                "servings" to nullable("integer"),
                "summary" to mapOf("type" to "string"),
                "dash_notes" to mapOf("type" to "string"),
                "sodium_mg_per_serving" to nullable("integer"),
                "swaps" to mapOf(
                    "type" to "array",
                    "items" to obj(
                        linkedMapOf(
                            "instead_of" to mapOf("type" to "string"),
                            "use" to mapOf("type" to "string"),
                            "why" to mapOf("type" to "string"),
                        ),
                    ),
                ),
                "ingredients" to mapOf(
                    "type" to "array",
                    "items" to obj(
                        linkedMapOf(
                            "name" to mapOf("type" to "string"),
                            "quantity" to nullable("number"),
                            "unit" to nullable("string"),
                            "note" to nullable("string"),
                        ),
                    ),
                ),
                "steps" to mapOf("type" to "array", "items" to mapOf("type" to "string")),
            ),
        )

        private fun schemaOf(schema: Map<String, Any>): JsonOutputFormat.Schema {
            val b = JsonOutputFormat.Schema.builder()
            schema.forEach { (k, v) -> b.putAdditionalProperty(k, JsonValue.from(v)) }
            return b.build()
        }
    }
}
