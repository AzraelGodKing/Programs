package dev.azrael.grocery.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.data.CabinetItem
import dev.azrael.grocery.data.GroceryItem
import dev.azrael.grocery.data.GroceryRepository
import dev.azrael.grocery.data.Recipe
import dev.azrael.grocery.parse.ParsedIngredient
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class GroceryViewModel(private val repo: GroceryRepository) : ViewModel() {
    /** null until the database has loaded, so the UI doesn't flash the empty state. */
    val items: StateFlow<List<GroceryItem>?> =
        repo.items.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Things already at home; null until loaded. */
    val cabinet: StateFlow<List<CabinetItem>?> =
        repo.cabinet.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Saved recipes, by title; null until loaded. */
    val recipes: StateFlow<List<Recipe>?> =
        repo.recipes.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun toggle(item: GroceryItem) = launch { repo.setChecked(item, !item.checked) }
    fun update(item: GroceryItem) = launch { repo.update(item) }
    fun delete(item: GroceryItem) = launch { repo.delete(item) }
    fun restore(item: GroceryItem) = launch { repo.restore(item) }
    fun uncheckAll() = launch { repo.uncheckAll() }
    fun clearChecked() = launch { repo.deleteChecked() }
    fun clearAll() = launch { repo.deleteAll() }

    fun addManual(name: String, quantity: Double?, unit: String?, note: String?, category: String?) =
        launch { repo.addManual(name, quantity, unit, note, category) }

    fun addIngredients(ingredients: List<ParsedIngredient>, source: String?) =
        launch { repo.addIngredients(ingredients, source) }

    fun addToCabinet(name: String) = launch { repo.addToCabinet(name) }
    fun setExpiry(item: CabinetItem, expiresOn: Long?) = launch { repo.setExpiry(item, expiresOn) }
    fun removeFromCabinet(item: CabinetItem) = launch { repo.removeFromCabinet(item) }
    fun restoreToCabinet(item: CabinetItem) = launch { repo.restoreToCabinet(item) }
    fun clearCabinet() = launch { repo.clearCabinet() }
    fun cabinetToList(item: CabinetItem) = launch { repo.cabinetToList(item) }

    fun saveRecipe(title: String, servings: Int, text: String) = launch { repo.saveRecipe(title, servings, text) }
    fun updateRecipe(recipe: Recipe) = launch { repo.updateRecipe(recipe) }
    fun deleteRecipe(recipe: Recipe) = launch { repo.deleteRecipe(recipe) }
    fun restoreRecipe(recipe: Recipe) = launch { repo.restoreRecipe(recipe) }
    fun addRecipeToList(recipe: Recipe, ingredients: List<ParsedIngredient>) =
        launch { repo.addRecipeToList(recipe, ingredients) }

    /** [onDone] gets how many items moved, for the snackbar. */
    fun moveCheckedToCabinet(onDone: (Int) -> Unit) = launch { onDone(repo.moveCheckedToCabinet()) }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as GroceryApp
                GroceryViewModel(app.repository)
            }
        }
    }
}
