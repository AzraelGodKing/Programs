package dev.azrael.grocery.dash

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * The DASH eating plan's food groups at about 2,000 calories a day (NHLBI). Goals are servings to
 * reach; limits are servings to stay under. Nuts/legumes and sweets are counted by the week.
 */
enum class DashGroup(
    val label: String,
    val emoji: String,
    val min: Int,
    val max: Int,
    val weekly: Boolean,
    val limit: Boolean,
    val serving: String,
) {
    VEGETABLES("Vegetables", "🥦", 4, 5, weekly = false, limit = false,
        serving = "1 cup raw leafy greens, or ½ cup cut-up raw or cooked vegetables"),
    FRUITS("Fruits", "🍎", 4, 5, weekly = false, limit = false,
        serving = "1 medium fruit, ¼ cup dried fruit, or ½ cup fresh, frozen or canned fruit"),
    GRAINS("Whole grains", "🌾", 6, 8, weekly = false, limit = false,
        serving = "1 slice whole-wheat bread, 1 oz dry cereal, or ½ cup cooked rice, pasta or oats"),
    DAIRY("Low-fat dairy", "🥛", 2, 3, weekly = false, limit = false,
        serving = "1 cup fat-free or low-fat milk or yogurt, or 1½ oz cheese"),
    PROTEIN("Lean meat, poultry, fish", "🐟", 0, 6, weekly = false, limit = true,
        serving = "1 oz cooked meat, poultry or fish, or 1 egg"),
    FATS("Fats & oils", "🫒", 0, 3, weekly = false, limit = true,
        serving = "1 tsp soft margarine or vegetable oil, 1 Tbsp mayo, or 2 Tbsp salad dressing"),
    NUTS("Nuts, seeds, legumes", "🥜", 4, 5, weekly = true, limit = false,
        serving = "⅓ cup nuts, 2 Tbsp peanut butter or seeds, or ½ cup cooked beans or lentils"),
    SWEETS("Sweets", "🍯", 0, 5, weekly = true, limit = true,
        serving = "1 Tbsp sugar, jelly or jam, ½ cup sorbet, or 1 cup lemonade");

    /** "4–5 a day", "6 or fewer a day", "5 or fewer a week". */
    val targetLabel: String
        get() {
            val per = if (weekly) "a week" else "a day"
            return if (limit) "$max or fewer $per" else "$min–$max $per"
        }
}

enum class GroupStatus { NOT_YET, ON_TRACK, MET, OVER }

/** Servings eaten in each group, keyed by day (LocalDate.toEpochDay()). */
typealias DashLog = Map<Long, Map<DashGroup, Int>>

object DashDay {
    fun weekOf(day: Long): LongRange {
        val start = LocalDate.ofEpochDay(day).with(DayOfWeek.MONDAY).toEpochDay()
        return start..start + 6
    }

    fun weekCount(log: DashLog, day: Long, group: DashGroup): Int =
        weekOf(day).sumOf { log[it]?.get(group) ?: 0 }

    /** The count a group is judged on for [day]: that day's servings, or the week's for weekly groups. */
    fun countFor(log: DashLog, day: Long, group: DashGroup): Int =
        if (group.weekly) weekCount(log, day, group) else log[day]?.get(group) ?: 0

    fun status(group: DashGroup, count: Int): GroupStatus = when {
        count > group.max -> GroupStatus.OVER
        group.limit -> GroupStatus.ON_TRACK
        count >= group.min -> GroupStatus.MET
        count == 0 -> GroupStatus.NOT_YET
        else -> GroupStatus.ON_TRACK
    }

    /** 0..100: how much of the day's goals are reached, less 10 for each limit gone over. */
    fun score(log: DashLog, day: Long): Int {
        val goals = DashGroup.entries.filter { !it.limit && !it.weekly }
        val reached = goals.sumOf { g -> minOf(countFor(log, day, g), g.min).toDouble() / g.min }
        val over = DashGroup.entries.count { status(it, countFor(log, day, it)) == GroupStatus.OVER }
        return ((reached / goals.size) * 100 - over * 10).toInt().coerceIn(0, 100)
    }

    /** A day is a "DASH day" when every daily goal is met and no limit is gone over. */
    fun isDashDay(log: DashLog, day: Long): Boolean = DashGroup.entries.all { g ->
        val s = status(g, countFor(log, day, g))
        when {
            s == GroupStatus.OVER -> false
            g.weekly || g.limit -> true
            else -> s == GroupStatus.MET
        }
    }

    /** DASH days in a row up to [today]. Today only adds to the streak once it counts; it never breaks it. */
    fun streak(log: DashLog, today: Long): Int {
        var day = if (isDashDay(log, today)) today else today - 1
        var n = 0
        while (isDashDay(log, day)) { n++; day-- }
        return n
    }

    /** The daily goal furthest from done, to suggest next. Null once every goal is met. */
    fun nextUp(log: DashLog, day: Long): DashGroup? = DashGroup.entries
        .filter { !it.limit }
        .map { it to (it.min - countFor(log, day, it)).toDouble() / it.min }
        .filter { it.second > 0 }
        .maxByOrNull { it.second }
        ?.first

    /** "VEGETABLES=3,FRUITS=1"; unknown groups and zero counts are dropped when decoding. */
    fun encode(counts: Map<DashGroup, Int>): String =
        counts.filterValues { it > 0 }.entries.joinToString(",") { "${it.key.name}=${it.value}" }

    fun decode(s: String?): Map<DashGroup, Int> = s.orEmpty().split(',').mapNotNull { part ->
        val (name, n) = part.split('=').takeIf { it.size == 2 } ?: return@mapNotNull null
        val group = DashGroup.entries.firstOrNull { it.name == name.trim() } ?: return@mapNotNull null
        n.trim().toIntOrNull()?.takeIf { it > 0 }?.let { group to it }
    }.toMap()
}
