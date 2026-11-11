package dev.azrael.grocery.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import dev.azrael.grocery.parse.IngredientParser
import dev.azrael.grocery.parse.ParsedIngredient

/** A saved recipe in the recipe box. The text is kept as pasted and parsed again when used. */
@Entity(tableName = "recipes")
data class Recipe(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    /** How many the text as written serves; scaling starts from here. */
    val servings: Int,
    /** The whole recipe: ingredients, steps, notes. */
    val text: String,
    val createdAt: Long = System.currentTimeMillis(),
    /** Last time its ingredients went on the grocery list; null if never. */
    val lastAddedAt: Long? = null,
) {
    fun ingredients(): List<ParsedIngredient> = IngredientParser.parseRecipe(text)
}
