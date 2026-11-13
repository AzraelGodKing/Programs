package dev.azrael.grocery.dash

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** Tap-to-count DASH servings for the day, with a daily score, a week view and a streak. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashScreen(
    vm: DashViewModel,
    onBack: () -> Unit,
    onOpenSodium: () -> Unit,
) {
    val log by vm.log.collectAsState()
    val day by vm.day.collectAsState()
    val today = DashViewModel.today()
    var menuOpen by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf<DashGroup?>(null) }
    var confirmClear by remember { mutableStateOf(false) }
    BackHandler(onBack = onBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("DASH day")
                        Text(
                            dayLabel(day, today),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = vm::previousDay) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Previous day")
                    }
                    IconButton(onClick = vm::nextDay, enabled = day < today) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Next day")
                    }
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            if (day != today) {
                                DropdownMenuItem(text = { Text("Go to today") }, onClick = { menuOpen = false; vm.goToToday() })
                            }
                            DropdownMenuItem(text = { Text("Sodium tracker") }, onClick = { menuOpen = false; onOpenSodium() })
                            DropdownMenuItem(
                                text = { Text("Clear this day") },
                                onClick = { menuOpen = false; confirmClear = true },
                                enabled = log[day].orEmpty().isNotEmpty(),
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = padding.calculateTopPadding() + 4.dp,
                bottom = padding.calculateBottomPadding() + 24.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "hero") {
                ScoreCard(
                    score = DashDay.score(log, day),
                    streak = DashDay.streak(log, today),
                    next = DashDay.nextUp(log, day),
                    dashDay = DashDay.isDashDay(log, day),
                )
            }
            item(key = "week") { WeekStrip(log, day, today, onPick = vm::showDay) }
            items(DashGroup.entries, key = { it.name }) { group ->
                GroupCard(
                    group = group,
                    count = DashDay.countFor(log, day, group),
                    todayCount = log[day]?.get(group) ?: 0,
                    onAdd = { vm.add(group) },
                    onRemove = { vm.remove(group) },
                    onInfo = { info = group },
                )
            }
            item(key = "sodium") {
                Card(
                    onClick = onOpenSodium,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Insights, null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
                        Column(Modifier.padding(start = 12.dp).weight(1f)) {
                            Text("Sodium & potassium", style = MaterialTheme.typography.titleSmall)
                            Text(
                                "DASH also caps sodium. Log foods and recipes in the sodium tracker.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
            item(key = "note") {
                Text(
                    "Targets are the NHLBI DASH plan at about 2,000 calories a day. Tap a group to see what a serving is.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                )
            }
        }
    }

    info?.let { group ->
        AlertDialog(
            onDismissRequest = { info = null },
            title = { Text("${group.emoji}  ${group.label}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Target: ${group.targetLabel}", fontWeight = FontWeight.SemiBold)
                    Text("One serving is ${group.serving}.")
                }
            },
            confirmButton = { TextButton(onClick = { info = null }) { Text("Got it") } },
        )
    }
    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text("Clear ${dayLabel(day, today).lowercase()}?") },
            text = { Text("This removes every serving counted on this day.") },
            confirmButton = { TextButton(onClick = { confirmClear = false; vm.clearDay() }) { Text("Clear") } },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ScoreCard(score: Int, streak: Int, next: DashGroup?, dashDay: Boolean) {
    val progress by animateFloatAsState(score / 100f, label = "score")
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.size(96.dp),
                    strokeWidth = 10.dp,
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("$score", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("score", style = MaterialTheme.typography.labelSmall)
                }
            }
            Column(Modifier.padding(start = 20.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.LocalFireDepartment,
                        null,
                        tint = if (streak > 0) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f),
                    )
                    Text(
                        when (streak) {
                            0 -> "No streak yet"
                            1 -> "1-day streak"
                            else -> "$streak-day streak"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
                Text(
                    when {
                        dashDay && next == null -> "Every goal met. A perfect DASH day!"
                        dashDay -> "Daily goals met. ${next!!.emoji} ${next.label} still need servings this week."
                        next != null -> "Next up: ${next.emoji} ${next.label.lowercase()}. ${next.serving.replaceFirstChar { it.uppercase() }}."
                        else -> "Watch the limits below to make it a DASH day."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun WeekStrip(log: DashLog, day: Long, today: Long, onPick: (Long) -> Unit) {
    val week = DashDay.weekOf(day)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        week.forEach { d ->
            val future = d > today
            val score = DashDay.score(log, d)
            val selected = d == day
            val fill = when {
                future -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                DashDay.isDashDay(log, d) -> MaterialTheme.colorScheme.primary
                score > 0 -> MaterialTheme.colorScheme.primary.copy(alpha = 0.25f + score / 200f)
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.clickable(enabled = !future) { onPick(d) }.padding(4.dp),
            ) {
                Text(
                    LocalDate.ofEpochDay(d).dayOfWeek.getDisplayName(TextStyle.NARROW, Locale.getDefault()),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Box(
                    Modifier
                        .size(if (selected) 34.dp else 28.dp)
                        .background(fill, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (!future && score > 0) {
                        Text(
                            "$score",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (DashDay.isDashDay(log, d)) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupCard(
    group: DashGroup,
    count: Int,
    todayCount: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
    onInfo: () -> Unit,
) {
    val status = DashDay.status(group, count)
    val goal = if (group.limit) group.max else group.min
    val progress by animateFloatAsState((count.toFloat() / goal).coerceIn(0f, 1f), label = group.name)
    val barColor = when (status) {
        GroupStatus.OVER -> MaterialTheme.colorScheme.error
        GroupStatus.MET -> MaterialTheme.colorScheme.primary
        else -> if (group.limit) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
    }
    Card(
        onClick = onInfo,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        modifier = Modifier.fillMaxWidth().animateContentSize(),
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(44.dp).background(MaterialTheme.colorScheme.surfaceContainerHighest, CircleShape),
                contentAlignment = Alignment.Center,
            ) { Text(group.emoji, style = MaterialTheme.typography.titleLarge) }
            Column(Modifier.padding(horizontal = 12.dp).weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(group.label, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f, fill = false))
                    StatusPill(status, group)
                }
                Text(
                    buildString {
                        append("$count")
                        append(if (group.limit) " of ${group.max} max" else " of ${group.min}–${group.max}")
                        append(if (group.weekly) " this week" else " today")
                        if (group.weekly && todayCount > 0) append(" · $todayCount today")
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                    color = barColor,
                    trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                )
            }
            OutlinedIconButton(onClick = onRemove, enabled = todayCount > 0, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Default.Remove, "One less ${group.label}")
            }
            Spacer(Modifier.width(6.dp))
            FilledTonalIconButton(onClick = onAdd, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Default.Add, "One more ${group.label}")
            }
        }
    }
}

@Composable
private fun StatusPill(status: GroupStatus, group: DashGroup) {
    val (label, bg, fg) = when (status) {
        GroupStatus.MET -> Triple("Done", MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.onPrimary)
        GroupStatus.OVER -> Triple("Over", MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.onError)
        GroupStatus.ON_TRACK -> if (group.limit) {
            Triple("Limit", MaterialTheme.colorScheme.tertiaryContainer, MaterialTheme.colorScheme.onTertiaryContainer)
        } else {
            Triple("Going", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
        }
        GroupStatus.NOT_YET -> return
    }
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        color = fg,
        modifier = Modifier
            .padding(start = 8.dp)
            .background(bg, CircleShape)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

private fun dayLabel(day: Long, today: Long): String = when (day) {
    today -> "Today"
    today - 1 -> "Yesterday"
    else -> LocalDate.ofEpochDay(day).format(DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.getDefault()))
}

