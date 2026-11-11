package dev.azrael.grocery.data

import android.content.Context
import dev.azrael.grocery.parse.Category
import dev.azrael.grocery.parse.NameKey
import dev.azrael.grocery.parse.StoreOrder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Your store's section order, aisle labels and remembered item sections, kept on the phone. */
class StoreLayout(context: Context) {
    private val prefs = context.getSharedPreferences("store_layout", Context.MODE_PRIVATE)
    private val _order = MutableStateFlow(read())
    val order: StateFlow<StoreOrder> = _order.asStateFlow()

    fun move(from: Int, to: Int) = save(_order.value.move(from, to))

    fun setAisle(category: Category, label: String) =
        save(_order.value.copy(aisles = _order.value.aisles + (category to label)))

    /** Next time this item is added it goes straight to [category]. */
    fun remember(name: String, category: Category) =
        save(_order.value.copy(remembered = _order.value.remembered + (NameKey.of(name) to category)))

    fun forgetRemembered() = save(_order.value.copy(remembered = emptyMap()))

    /** Back to the built-in order with no aisle labels; remembered items stay. */
    fun resetOrder() = save(_order.value.copy(sections = Category.entries, aisles = emptyMap()))

    private fun read() = StoreOrder(
        sections = StoreOrder.decodeSections(prefs.getString(KEY_SECTIONS, null)),
        aisles = Category.entries.mapNotNull { c -> prefs.getString(KEY_AISLE + c.name, null)?.let { c to it } }.toMap(),
        remembered = StoreOrder.decodeRemembered(prefs.getStringSet(KEY_REMEMBERED, null)),
    )

    private fun save(order: StoreOrder) {
        _order.value = order
        prefs.edit().apply {
            putString(KEY_SECTIONS, StoreOrder.encodeSections(order.sections))
            Category.entries.forEach { c ->
                val label = order.aisles[c]?.trim().orEmpty()
                if (label.isEmpty()) remove(KEY_AISLE + c.name) else putString(KEY_AISLE + c.name, label)
            }
            putStringSet(KEY_REMEMBERED, StoreOrder.encodeRemembered(order.remembered))
        }.apply()
    }

    private companion object {
        const val KEY_SECTIONS = "sections"
        const val KEY_AISLE = "aisle_"
        const val KEY_REMEMBERED = "remembered"
    }
}
