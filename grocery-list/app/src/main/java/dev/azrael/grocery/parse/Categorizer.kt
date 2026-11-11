package dev.azrael.grocery.parse

/** Store sections, in the order the list shows them. */
enum class Category(val label: String) {
    PRODUCE("Produce"),
    MEAT("Meat & Seafood"),
    DAIRY("Dairy & Eggs"),
    BAKERY("Bakery"),
    CANNED("Canned & Jarred"),
    PANTRY("Pantry"),
    SPICES("Spices & Seasonings"),
    FROZEN("Frozen"),
    BEVERAGES("Beverages"),
    OTHER("Other");

    companion object {
        fun fromName(name: String?): Category = entries.firstOrNull { it.name == name } ?: OTHER
    }
}

object Categorizer {
    // Checked top to bottom; the first match wins, so specific phrases come before broad words.
    private val rules: List<Pair<Category, List<String>>> = listOf(
        Category.FROZEN to listOf("frozen"),
        Category.SPICES to listOf(
            "powder", "dried", "ground cumin", "ground cinnamon", "ground ginger", "ground pepper",
            "black pepper", "pepper flake", "red pepper flakes", "salt", "cumin", "paprika",
            "oregano", "thyme", "cinnamon", "nutmeg", "turmeric", "chili powder", "cayenne",
            "seasoning", "bay leaf", "bay leaves", "peppercorn", "clove", "allspice", "coriander",
            "curry", "vanilla", "extract", "italian seasoning", "rosemary", "sage",
        ),
        Category.PANTRY to listOf(
            "peanut butter", "almond butter", "broth", "stock", "olive oil", "oil", "vinegar",
            "soy sauce", "tamari", "honey", "maple syrup", "flour", "sugar", "baking soda",
            "baking powder", "cornstarch", "rice", "quinoa", "oats", "oatmeal", "pasta", "noodle",
            "spaghetti", "lentil", "barley", "couscous", "bulgur", "nuts", "almond", "walnut",
            "pecan", "cashew", "peanut", "seed", "chia", "flax", "raisin", "dried fruit",
            "mustard", "ketchup", "mayonnaise", "salsa", "hot sauce", "worcestershire",
            "breadcrumb", "panko", "cocoa", "chocolate", "cereal", "crackers", "dried beans",
        ),
        Category.CANNED to listOf(
            "canned", "tomato paste", "tomato sauce", "diced tomatoes", "crushed tomatoes",
            "black beans", "kidney beans", "chickpeas", "garbanzo", "cannellini", "pinto beans",
            "white beans", "coconut milk", "tuna", "olives", "capers", "pickles", "artichoke",
        ),
        Category.MEAT to listOf(
            "chicken", "beef", "pork", "turkey", "lamb", "steak", "sausage", "bacon", "ham",
            "salmon", "tuna steak", "cod", "tilapia", "shrimp", "fish", "scallop", "crab",
            "halibut", "trout", "sirloin", "tenderloin", "meat",
        ),
        Category.DAIRY to listOf(
            "milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "egg", "parmesan",
            "mozzarella", "cheddar", "feta", "ricotta", "cottage", "sour cream", "kefir", "tofu",
        ),
        Category.PRODUCE to listOf(
            "onion", "garlic", "shallot", "scallion", "green onion", "leek", "tomato", "potato",
            "sweet potato", "carrot", "celery", "pepper", "jalapeno", "jalapeño", "lettuce",
            "spinach", "kale", "arugula", "chard", "cabbage", "broccoli", "cauliflower",
            "zucchini", "squash", "cucumber", "eggplant", "mushroom", "corn", "pea", "green bean",
            "asparagus", "avocado", "lemon", "lime", "orange", "apple", "banana", "berry",
            "berries", "grape", "melon", "mango", "pineapple", "peach", "pear", "plum", "cherry",
            "cilantro", "parsley", "basil", "mint", "dill", "chive", "ginger", "beet", "radish",
            "sprout", "herb", "fruit", "vegetable", "greens", "lettuce",
        ),
        Category.BAKERY to listOf("bread", "bun", "roll", "tortilla", "pita", "bagel", "baguette", "naan", "wrap"),
        Category.BEVERAGES to listOf("juice", "coffee", "tea", "wine", "beer", "sparkling water", "soda"),
    )

    // "No-salt-added black beans" are beans, not salt.
    private val dietQualifiers = Regex(
        "\\b(no salt added|salt free|unsalted|low sodium|reduced sodium|sodium free|no sugar added|sugar free|unsweetened|low fat|fat free|nonfat|reduced fat)\\b",
    )

    fun categorize(name: String, unit: String? = null): Category {
        val text = " " + name.lowercase()
            .replace(Regex("[^a-zñé ]"), " ")
            .replace(dietQualifiers, " ") + " "
        if (text.contains(" frozen ")) return Category.FROZEN
        for ((category, words) in rules) {
            if (words.any { Regex("\\b${Regex.escape(it)}(e?s)?\\b").containsMatchIn(text) }) {
                return category
            }
        }
        if (unit == "can" || unit == "jar") return Category.CANNED
        return Category.OTHER
    }
}
