package dev.azrael.grocery.claude

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import dev.azrael.grocery.parse.ParsedIngredient
import dev.azrael.grocery.parse.Units
import dev.azrael.grocery.parse.formatAmount

/** A recipe as Claude returns it (see [ClaudeRecipeClient.SCHEMA]). Plain Kotlin, no Android. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ClaudeRecipe(
    val title: String = "",
    val servings: Int? = null,
    val summary: String = "",
    @JsonProperty("dash_notes") val dashNotes: String = "",
    @JsonProperty("sodium_mg_per_serving") val sodiumMgPerServing: Int? = null,
    val swaps: List<Swap> = emptyList(),
    val ingredients: List<Ingredient> = emptyList(),
    val steps: List<String> = emptyList(),
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Ingredient(
        val name: String = "",
        val quantity: Double? = null,
        val unit: String? = null,
        val note: String? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Swap(
        @JsonProperty("instead_of") val insteadOf: String = "",
        val use: String = "",
        val why: String = "",
    )

    /** Ingredients in the same shape the paste parser produces, so they merge into the list the same way. */
    fun toParsedIngredients(): List<ParsedIngredient> = ingredients
        .filter { it.name.isNotBlank() }
        .map { ing ->
            val rawUnit = ing.unit?.trim()?.takeIf { it.isNotEmpty() }
            // Map "tablespoons" -> "tbsp" etc. so amounts combine; keep unknown units as Claude wrote them.
            val unit = rawUnit?.let { Units.lookup(it) ?: Units.lookup(it.lowercase()) ?: it.lowercase() }
            val quantity = ing.quantity?.takeIf { it > 0 }
            ParsedIngredient(
                name = ing.name.trim(),
                quantity = quantity,
                unit = unit,
                note = ing.note?.trim()?.takeIf { it.isNotEmpty() },
                raw = listOf(formatAmount(quantity, unit), ing.name.trim()).filter { it.isNotEmpty() }.joinToString(" "),
            )
        }

    /** Plain-text version for sharing to a notes app. */
    fun asText(): String = buildString {
        appendLine(title)
        servings?.let { appendLine("Serves $it") }
        sodiumMgPerServing?.let { appendLine("About $it mg sodium per serving (estimate)") }
        if (summary.isNotBlank()) { appendLine(); appendLine(summary) }
        appendLine(); appendLine("Ingredients")
        toParsedIngredients().forEach { ing ->
            append("- ")
            append(listOf(formatAmount(ing.quantity, ing.unit), ing.name).filter { it.isNotEmpty() }.joinToString(" "))
            ing.note?.let { append(", $it") }
            appendLine()
        }
        if (steps.isNotEmpty()) {
            appendLine(); appendLine("Steps")
            steps.forEachIndexed { i, s -> appendLine("${i + 1}. $s") }
        }
        if (dashNotes.isNotBlank()) { appendLine(); appendLine("DASH notes: $dashNotes") }
        if (swaps.isNotEmpty()) {
            appendLine(); appendLine("DASH swaps")
            swaps.forEach { appendLine("- Instead of ${it.insteadOf}, use ${it.use}: ${it.why}") }
        }
    }.trim()

    companion object {
        private val mapper = jacksonObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES, false)

        /** Parses Claude's JSON answer. Throws if it isn't a recipe object. */
        fun parse(json: String): ClaudeRecipe {
            val start = json.indexOf('{')
            val end = json.lastIndexOf('}')
            require(start >= 0 && end > start) { "Claude's answer wasn't a recipe" }
            return mapper.readValue(json.substring(start, end + 1))
        }
    }
}
