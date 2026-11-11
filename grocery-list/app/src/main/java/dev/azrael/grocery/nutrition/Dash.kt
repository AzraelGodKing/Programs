package dev.azrael.grocery.nutrition

/** DASH daily targets. Sodium is a ceiling, potassium a goal. */
object Dash {
    /** Standard DASH sodium limit. */
    const val SODIUM_STANDARD_MG = 2300

    /** Lower-sodium DASH, which lowers blood pressure further. */
    const val SODIUM_LOWER_MG = 1500

    const val POTASSIUM_GOAL_MG = 4700

    /** About how much sodium 1/4 tsp of table salt adds, for "salt to taste" hints. */
    const val QUARTER_TSP_SALT_MG = 575

    /** "1,840" */
    fun mg(value: Int): String = String.format(java.util.Locale.US, "%,d", value)
}
