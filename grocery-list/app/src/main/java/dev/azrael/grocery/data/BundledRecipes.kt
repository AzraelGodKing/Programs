package dev.azrael.grocery.data

import android.content.Context
import dev.azrael.grocery.parse.MarkdownRecipe

/**
 * Recipe notes shipped in assets/recipes/ (Azrael's Obsidian recipes). Each file is added to the
 * recipe box once, the first time a build that has it starts, so a recipe deleted from the box
 * doesn't come back and new files in later builds still arrive.
 */
object BundledRecipes {
    private const val DIR = "recipes"
    private const val PREFS = "bundled_recipes"
    private const val KEY = "imported"

    suspend fun importNew(context: Context, repo: GroceryRepository): Int {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val done = prefs.getStringSet(KEY, emptySet()).orEmpty()
        val files = context.assets.list(DIR).orEmpty().filter { it.endsWith(".md") && it !in done }
        if (files.isEmpty()) return 0
        val recipes = files.map { name ->
            MarkdownRecipe.parse(name, context.assets.open("$DIR/$name").bufferedReader().use { it.readText() })
        }
        val added = repo.importRecipes(recipes)
        prefs.edit().putStringSet(KEY, done + files).apply()
        return added
    }
}
