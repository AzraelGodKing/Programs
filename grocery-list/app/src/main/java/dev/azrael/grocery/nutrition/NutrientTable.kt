package dev.azrael.grocery.nutrition

import dev.azrael.grocery.parse.NameKey

/**
 * Typical sodium and potassium for common recipe ingredients, per 100 g, rounded from USDA
 * FoodData Central. Good enough for a daily DASH estimate; packaged foods vary by brand, so the
 * barcode scan (real label values) beats this table when there is one.
 */
data class NutrientEntry(
    /** NameKey keys this entry covers. The first is shown as the match. */
    val keys: List<String>,
    val sodiumPer100g: Double,
    val potassiumPer100g: Double,
    /** Grams in one cup, for amounts given by volume. Null means "treat like water" (240 g). */
    val gramsPerCup: Double? = null,
    /** Grams in one item, clove, slice, fillet, etc. for counted amounts. */
    val gramsEach: Double? = null,
    /** Grams in one can, jar or package. */
    val gramsPerPackage: Double? = null,
    /** Sodium per 100 g of the "low sodium" / "no salt added" version, when it's very different. */
    val lowSodiumPer100g: Double? = null,
) {
    val label: String get() = keys.first()
}

object NutrientTable {
    private fun e(
        keys: String,
        na: Number,
        k: Number,
        cup: Number? = null,
        each: Number? = null,
        pkg: Number? = null,
        lowNa: Number? = null,
    ) = NutrientEntry(
        keys = keys.split('|').map { NameKey.of(it) },
        sodiumPer100g = na.toDouble(),
        potassiumPer100g = k.toDouble(),
        gramsPerCup = cup?.toDouble(),
        gramsEach = each?.toDouble(),
        gramsPerPackage = pkg?.toDouble(),
        lowSodiumPer100g = lowNa?.toDouble(),
    )

    val all: List<NutrientEntry> = listOf(
        // Salt and salty seasonings: where most recipe sodium comes from.
        e("salt|table salt|sea salt|fine salt|iodized salt", 38758, 8, cup = 288),
        e("kosher salt|coarse salt|flaky salt", 38758, 8, cup = 170),
        e("garlic salt|onion salt|celery salt", 29000, 100, cup = 290),
        e("seasoned salt|seasoning salt", 26000, 150, cup = 270),
        e("baking soda|bicarbonate of soda", 27360, 0, cup = 220),
        e("baking powder", 10600, 20, cup = 220),
        e("bouillon|bouillon cube|stock cube|bouillon powder|chicken bouillon|beef bouillon", 24000, 400, cup = 200, each = 4),
        e("soy sauce|tamari|shoyu", 5490, 435, cup = 255, lowNa = 3330),
        e("fish sauce", 7850, 290, cup = 290),
        e("teriyaki sauce", 3830, 225, cup = 290),
        e("oyster sauce", 2730, 55, cup = 290),
        e("hoisin sauce", 1615, 120, cup = 260),
        e("miso|miso paste", 3730, 210, cup = 275),
        e("worcestershire sauce|worcestershire", 980, 800, cup = 275),
        e("hot sauce|sriracha|tabasco", 2640, 145, cup = 240),
        e("ketchup", 910, 280, cup = 240, lowNa = 20),
        e("mustard|yellow mustard|dijon mustard|dijon", 1120, 150, cup = 250),
        e("mayonnaise|mayo", 635, 20, cup = 220),
        e("barbecue sauce|bbq sauce", 1030, 230, cup = 280),
        e("salsa", 710, 275, cup = 260, pkg = 450),
        e("taco seasoning|fajita seasoning|cajun seasoning|creole seasoning", 6600, 600, cup = 130, pkg = 28),
        e("chili powder", 1010, 1950, cup = 130),
        e("ranch dressing|italian dressing|salad dressing", 1000, 70, cup = 240),
        e("pickle|dill pickle|pickles", 875, 25, cup = 155, each = 65),
        e("olive|olives|black olive|green olive|kalamata olive", 1100, 10, cup = 135, each = 4, pkg = 170),
        e("caper|capers", 2350, 40, cup = 135),
        e("sauerkraut|kimchi", 660, 170, cup = 140),
        e("pesto", 1000, 160, cup = 260),
        e("marinara|marinara sauce|pasta sauce|spaghetti sauce", 430, 315, cup = 260, pkg = 680, lowNa = 30),
        e("tomato sauce", 475, 300, cup = 245, pkg = 227, lowNa = 20),
        e("tomato paste", 60, 1010, cup = 262, pkg = 170, lowNa = 60),
        e("canned tomato|crushed tomato|tomato puree|canned diced tomato|fire roasted tomato", 190, 190, cup = 240, pkg = 411, lowNa = 15),

        // Broths and soups.
        e("broth|stock|chicken broth|chicken stock|beef broth|beef stock|bone broth", 370, 85, cup = 240, pkg = 950, lowNa = 55),
        e("vegetable broth|vegetable stock", 300, 90, cup = 240, pkg = 950, lowNa = 55),
        e("cream of mushroom soup|cream of chicken soup|condensed soup", 690, 70, cup = 250, pkg = 298, lowNa = 175),

        // Dairy and eggs.
        e("butter|salted butter", 640, 24, cup = 227, each = 113),
        e("unsalted butter", 11, 24, cup = 227, each = 113),
        e("milk|skim milk|low fat milk|whole milk|1% milk|2% milk|fat free milk|nonfat milk", 44, 150, cup = 244),
        e("buttermilk", 105, 135, cup = 245),
        e("heavy cream|cream|half and half|whipping cream", 30, 95, cup = 240),
        e("sour cream", 80, 140, cup = 230),
        e("yogurt|plain yogurt|nonfat yogurt|low fat yogurt", 70, 235, cup = 245),
        e("greek yogurt|plain greek yogurt|nonfat greek yogurt", 36, 140, cup = 227),
        e("cheese|cheddar|cheddar cheese|shredded cheese|monterey jack|colby jack|swiss cheese|provolone", 640, 80, cup = 113, each = 28),
        e("parmesan|parmesan cheese|parmigiano reggiano|pecorino|romano", 1600, 125, cup = 100),
        e("mozzarella|mozzarella cheese|part skim mozzarella", 650, 80, cup = 113, each = 28),
        e("feta|feta cheese", 920, 60, cup = 150),
        e("goat cheese", 460, 25, cup = 150),
        e("cottage cheese|low fat cottage cheese", 365, 105, cup = 226),
        e("cream cheese", 320, 130, cup = 232, pkg = 227),
        e("ricotta|ricotta cheese|part skim ricotta", 95, 125, cup = 246),
        e("egg|eggs|egg white|egg whites", 142, 138, cup = 243, each = 50),

        // Meat and fish (raw).
        e("chicken|chicken breast|boneless skinless chicken breast|chicken tender", 45, 335, cup = 140, each = 200),
        e("chicken thigh|boneless skinless chicken thigh|chicken drumstick", 95, 240, cup = 140, each = 115),
        e("rotisserie chicken", 400, 250, cup = 140, each = 900),
        e("ground beef|lean ground beef|beef|steak|sirloin|flank steak|chuck roast|stew meat", 65, 320, cup = 225, each = 225),
        e("ground turkey|turkey|turkey breast", 70, 235, cup = 225, each = 225),
        e("pork|pork chop|pork tenderloin|pork loin|ground pork", 55, 360, cup = 225, each = 170),
        e("bacon|turkey bacon", 750, 200, cup = 100, each = 28),
        e("ham|deli ham", 1200, 290, cup = 140, each = 28),
        e("deli turkey|sliced turkey|lunch meat|deli meat", 1000, 300, each = 28),
        e("sausage|italian sausage|chorizo|kielbasa|hot dog", 750, 270, cup = 150, each = 75),
        e("pepperoni|salami|prosciutto", 1750, 300, cup = 120, each = 3),
        e("salmon|salmon fillet", 60, 365, cup = 160, each = 170),
        e("cod|tilapia|white fish|halibut|fish fillet|fish", 60, 400, cup = 160, each = 170),
        e("shrimp|prawn", 400, 115, cup = 145, each = 12),
        e("tuna|canned tuna|tuna in water", 300, 240, cup = 155, pkg = 142, lowNa = 50),
        e("canned salmon", 400, 330, cup = 155, pkg = 170),
        e("tofu|firm tofu|extra firm tofu", 10, 120, cup = 250, pkg = 400),

        // Beans and grains.
        e(
            "bean|beans|black bean|kidney bean|pinto bean|cannellini bean|white bean|navy bean|great northern bean|" +
                "chickpea|garbanzo bean|canned bean|refried bean",
            300, 370, cup = 172, pkg = 425, lowNa = 15,
        ),
        e("dried bean|dried black bean|dried chickpea|dry bean|dried pinto bean", 10, 1400, cup = 190),
        e("lentil|lentils|red lentil|green lentil|brown lentil|split pea", 6, 680, cup = 192),
        e("rice|white rice|jasmine rice|basmati rice", 5, 115, cup = 185),
        e("brown rice|wild rice", 7, 270, cup = 190),
        e("quinoa", 5, 565, cup = 170),
        e("oat|oats|rolled oat|old fashioned oat|quick oat|steel cut oat|oatmeal", 2, 360, cup = 81),
        e("pasta|spaghetti|penne|macaroni|noodle|egg noodle|whole wheat pasta|linguine|fettuccine|rotini", 6, 220, cup = 100, pkg = 454),
        e("flour|all purpose flour|whole wheat flour|bread flour", 2, 110, cup = 125),
        e("cornmeal|polenta", 7, 290, cup = 150),
        e("bread|whole wheat bread|whole grain bread|sandwich bread|slice bread", 470, 230, cup = 45, each = 28),
        e("bun|hamburger bun|roll|dinner roll|english muffin|bagel", 450, 130, each = 55),
        e("tortilla|flour tortilla|whole wheat tortilla|wrap", 690, 140, each = 45),
        e("corn tortilla", 45, 185, each = 26),
        e("pita|pita bread|naan", 530, 120, each = 60),
        e("bread crumb|breadcrumb|panko", 730, 195, cup = 108),
        e("cracker|saltine", 1100, 150, cup = 60, each = 3),
        e("crouton", 700, 120, cup = 30),

        // Produce: low sodium, high potassium (the DASH good guys).
        e("potato|russet potato|yukon gold potato|red potato|baby potato", 6, 425, cup = 150, each = 215),
        e("sweet potato|yam", 55, 340, cup = 135, each = 130),
        e("banana", 1, 360, cup = 150, each = 118),
        e("avocado", 7, 485, cup = 150, each = 150),
        e("spinach|baby spinach", 79, 560, cup = 30, pkg = 140),
        e("kale", 43, 350, cup = 21, each = 200),
        e("lettuce|romaine|romaine lettuce|mixed green|salad green|arugula|spring mix", 10, 240, cup = 47, each = 600, pkg = 140),
        e("broccoli|broccoli floret", 33, 315, cup = 91, each = 600),
        e("cauliflower|cauliflower floret", 30, 300, cup = 107, each = 575),
        e("carrot|baby carrot", 69, 320, cup = 128, each = 61),
        e("celery|celery stalk", 80, 260, cup = 101, each = 40),
        e("onion|yellow onion|red onion|white onion|sweet onion|shallot", 4, 146, cup = 160, each = 110),
        e("green onion|scallion", 16, 275, cup = 100, each = 15),
        e("garlic|garlic clove", 17, 400, cup = 136, each = 3),
        e("bell pepper|red bell pepper|green bell pepper|yellow bell pepper|orange bell pepper|sweet pepper|red pepper|green pepper|yellow pepper|orange pepper", 4, 175, cup = 149, each = 120),
        e("jalapeno|jalapeno pepper|serrano|serrano pepper|chile|chili pepper|poblano", 3, 250, cup = 90, each = 14),
        e("tomato|roma tomato|cherry tomato|grape tomato|plum tomato", 5, 237, cup = 180, each = 123),
        e("mushroom|cremini mushroom|button mushroom|baby bella mushroom|portobello", 5, 318, cup = 70, each = 18, pkg = 227),
        e("zucchini|summer squash|yellow squash", 8, 261, cup = 124, each = 196),
        e("butternut squash|acorn squash|squash|pumpkin", 4, 350, cup = 140, each = 1000),
        e("cucumber|english cucumber", 2, 147, cup = 120, each = 300),
        e("eggplant", 2, 230, cup = 82, each = 450),
        e("cabbage|red cabbage|coleslaw mix", 18, 170, cup = 89, each = 900),
        e("green bean|string bean|asparagus", 4, 210, cup = 110, each = 16),
        e("corn|sweet corn|corn kernel|frozen corn", 15, 270, cup = 145, each = 100),
        e("canned corn", 200, 190, cup = 165, pkg = 432, lowNa = 10),
        e("pea|green pea|frozen pea", 100, 150, cup = 134),
        e("beet|beets", 78, 325, cup = 136, each = 82),
        e("lemon|lime", 2, 138, each = 84),
        e("lemon juice|lime juice", 1, 103, cup = 244),
        e("orange", 0, 181, cup = 165, each = 131),
        e("orange juice", 1, 200, cup = 248),
        e("apple", 1, 107, cup = 125, each = 182),
        e("pear|peach|nectarine|plum", 1, 160, cup = 160, each = 170),
        e("berry|blueberry|strawberry|raspberry|blackberry|mixed berry", 1, 120, cup = 148),
        e("mango|pineapple|cantaloupe|melon|watermelon", 2, 170, cup = 165, each = 300),
        e("grape", 2, 191, cup = 151),
        e("raisin|dried cranberry|dried apricot|date|prune", 15, 750, cup = 145),
        e("herb|parsley|cilantro|basil|mint|dill|thyme|rosemary|oregano|sage|chive", 40, 550, cup = 30, each = 1),
        e("ginger|fresh ginger|ginger root", 13, 415, cup = 96, each = 15),

        // Nuts, seeds, fats.
        e("almond|walnut|pecan|cashew|peanut|pistachio|nut|mixed nut|sunflower seed|pumpkin seed", 1, 700, cup = 140),
        e("salted peanut|salted almond|salted cashew|salted nut|roasted salted nut", 400, 650, cup = 140),
        e("peanut butter|almond butter", 430, 560, cup = 258),
        e("chia seed|flax seed|flaxseed|ground flaxseed|sesame seed|hemp seed", 15, 600, cup = 160),
        e("tahini", 115, 415, cup = 240),
        e("hummus", 425, 230, cup = 246, pkg = 283),
        e("oil|olive oil|extra virgin olive oil|vegetable oil|canola oil|avocado oil|sesame oil|coconut oil|cooking spray", 2, 1, cup = 216),
        e("coconut milk|light coconut milk", 15, 220, cup = 226, pkg = 400),
        e("almond milk|oat milk|soy milk", 70, 70, cup = 240),

        // Sweeteners, baking, liquids, spices: near zero sodium, listed so they count as known.
        e("sugar|brown sugar|powdered sugar|granulated sugar|coconut sugar", 1, 50, cup = 200),
        e("honey|maple syrup|agave", 4, 52, cup = 320),
        e("chocolate|chocolate chip|dark chocolate|cocoa|cocoa powder", 20, 700, cup = 170),
        e("vanilla|vanilla extract", 9, 150, cup = 208),
        e("cornstarch|corn starch|arrowroot", 9, 3, cup = 128),
        e("yeast|active dry yeast|instant yeast", 50, 900, cup = 130, each = 7),
        e("vinegar|apple cider vinegar|red wine vinegar|white vinegar|rice vinegar|balsamic vinegar", 5, 40, cup = 240),
        e("water|ice|ice water|warm water", 0, 0, cup = 237),
        e("wine|red wine|white wine|beer", 5, 100, cup = 240),
        e("coffee|tea", 2, 50, cup = 237),
        e(
            "pepper|black pepper|ground pepper|white pepper|cayenne|cayenne pepper|red pepper flake|crushed red pepper|" +
                "paprika|smoked paprika|cumin|ground cumin|coriander|turmeric|cinnamon|nutmeg|clove|allspice|" +
                "garlic powder|onion powder|italian seasoning|dried oregano|dried thyme|dried basil|bay leaf|curry powder|" +
                "salt free seasoning|no salt seasoning|herbes de provence|spice",
            30, 1500, cup = 110, each = 1,
        ),
    )

    /** NameKey key -> entry. Later duplicates don't override earlier ones. */
    private val byKey: Map<String, NutrientEntry> = buildMap {
        all.forEach { entry -> entry.keys.forEach { putIfAbsent(it, entry) } }
    }

    /**
     * Finds the entry for an ingredient name: the longest table key that equals the ingredient's key or
     * ends it as whole words, so "low sodium chicken broth" finds "chicken broth" and
     * "red bell pepper" finds "bell pepper" rather than the spice "pepper".
     */
    fun find(name: String): NutrientEntry? {
        val key = NameKey.of(name)
        if (key.isBlank()) return null
        byKey[key]?.let { return it }
        val words = key.split(' ')
        for (drop in 1 until words.size) {
            val suffix = words.drop(drop).joinToString(" ")
            byKey[suffix]?.let { return it }
        }
        return null
    }
}
