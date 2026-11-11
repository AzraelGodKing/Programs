package dev.azrael.grocery.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.CheckBox
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.MainActivity
import dev.azrael.grocery.data.GroceryItem

/**
 * Home-screen widget: the grocery list in store-section order, with checkboxes that tick items off
 * without opening the app. Tapping the title opens the app.
 */
class GroceryWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val repo = (context.applicationContext as GroceryApp).repository
        provideContent {
            val items by repo.items.collectAsState(initial = null)
            GlanceTheme { WidgetContent(items) }
        }
    }
}

class GroceryWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = GroceryWidget()
}

/** Ticks or unticks one item. The widget redraws itself from the list's Room flow. */
class ToggleItemAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[ITEM_ID] ?: return
        val checked = parameters[CHECKED] ?: return
        (context.applicationContext as GroceryApp).repository.setChecked(id, checked)
        GroceryWidget().update(context, glanceId)
    }

    companion object {
        val ITEM_ID = ActionParameters.Key<Long>("item_id")
        val CHECKED = ActionParameters.Key<Boolean>("checked")
    }
}

@Composable
private fun WidgetContent(items: List<GroceryItem>?) {
    val toBuy = items.orEmpty().filter { !it.checked }.sortedBy { it.categoryEnum.ordinal }
    val inCart = items.orEmpty().filter { it.checked }
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.widgetBackground)
            .cornerRadius(16.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Row(
            modifier = GlanceModifier.fillMaxWidth().padding(bottom = 4.dp).clickable(actionStartActivity<MainActivity>()),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Grocery List",
                style = TextStyle(color = GlanceTheme.colors.onSurface, fontWeight = FontWeight.Bold, fontSize = 16.sp),
                modifier = GlanceModifier.defaultWeight(),
            )
            if (items != null) {
                Text(
                    if (toBuy.isEmpty()) "All done" else "${toBuy.size} to get",
                    style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 13.sp),
                )
            }
        }
        when {
            items == null -> Unit
            items.isEmpty() -> Text(
                "Your list is empty. Tap to add a recipe.",
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 14.sp),
                modifier = GlanceModifier.padding(top = 8.dp).clickable(actionStartActivity<MainActivity>()),
            )
            else -> LazyColumn {
                items(toBuy + inCart, itemId = { it.id }) { item -> ItemRow(item) }
            }
        }
    }
}

@Composable
private fun ItemRow(item: GroceryItem) {
    val label = if (item.amountLabel.isEmpty()) item.name else "${item.name} · ${item.amountLabel}"
    CheckBox(
        checked = item.checked,
        onCheckedChange = actionRunCallback<ToggleItemAction>(
            actionParametersOf(
                ToggleItemAction.ITEM_ID to item.id,
                ToggleItemAction.CHECKED to !item.checked,
            ),
        ),
        text = label,
        style = TextStyle(
            color = if (item.checked) GlanceTheme.colors.onSurfaceVariant else GlanceTheme.colors.onSurface,
            fontSize = 14.sp,
            textDecoration = if (item.checked) TextDecoration.LineThrough else null,
        ),
        maxLines = 2,
        modifier = GlanceModifier.fillMaxWidth(),
    )
}
