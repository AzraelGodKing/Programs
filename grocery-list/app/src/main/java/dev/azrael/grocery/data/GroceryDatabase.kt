package dev.azrael.grocery.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [GroceryItem::class, CabinetItem::class, Recipe::class, FoodLogEntry::class, MealPlanEntry::class],
    version = 6,
    exportSchema = false,
)
abstract class GroceryDatabase : RoomDatabase() {
    abstract fun groceryDao(): GroceryDao
    abstract fun cabinetDao(): CabinetDao
    abstract fun recipeDao(): RecipeDao
    abstract fun foodLogDao(): FoodLogDao
    abstract fun mealPlanDao(): MealPlanDao

    companion object {
        /** Builds before the Cabinet had only the grocery list; this adds the Cabinet and keeps the list. */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `cabinet_items` (" +
                        "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`name` TEXT NOT NULL, `key` TEXT NOT NULL, " +
                        "`category` TEXT NOT NULL, `addedAt` INTEGER NOT NULL)",
                )
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_cabinet_items_key` ON `cabinet_items` (`key`)")
            }
        }

        /** Adds the recipe box. */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) = createRecipes(db)
        }

        /** Adds expiry dates to Cabinet items; existing items have none. */
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // A test build from before the features were combined may already be at version 3 with a
                // different change (expiry or the sodium tracker), so every step below only adds what's missing.
                createRecipes(db)
                db.addColumnIfMissing("cabinet_items", "expiresOn", "INTEGER")
            }
        }

        /** Adds the sodium tracker's food log, and label sodium on Cabinet items added by barcode. */
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `food_log` (" +
                        "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`name` TEXT NOT NULL, `day` INTEGER NOT NULL, " +
                        "`sodiumMg` INTEGER NOT NULL, `potassiumMg` INTEGER, " +
                        "`servings` REAL NOT NULL, `loggedAt` INTEGER NOT NULL)",
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_food_log_day` ON `food_log` (`day`)")
                db.addColumnIfMissing("cabinet_items", "barcode", "TEXT")
                db.addColumnIfMissing("cabinet_items", "sodiumMgPerServing", "INTEGER")
                db.addColumnIfMissing("cabinet_items", "sodiumMgPer100g", "INTEGER")
                db.addColumnIfMissing("cabinet_items", "potassiumMgPerServing", "INTEGER")
                db.addColumnIfMissing("cabinet_items", "servingSize", "TEXT")
            }
        }

        private fun createRecipes(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `recipes` (" +
                    "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                    "`title` TEXT NOT NULL, `servings` INTEGER NOT NULL, `text` TEXT NOT NULL, " +
                    "`createdAt` INTEGER NOT NULL, `lastAddedAt` INTEGER)",
            )
        }

        private fun SupportSQLiteDatabase.addColumnIfMissing(table: String, column: String, type: String) {
            val exists = query("PRAGMA table_info(`$table`)").use { c ->
                val nameIndex = c.getColumnIndexOrThrow("name")
                generateSequence { if (c.moveToNext()) c.getString(nameIndex) else null }.any { it == column }
            }
            if (!exists) execSQL("ALTER TABLE `$table` ADD COLUMN `$column` $type")
        }

        /** Adds the weekly meal plan. */
        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `meal_plan` (" +
                        "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`day` INTEGER NOT NULL, `recipeId` INTEGER NOT NULL, `servings` INTEGER NOT NULL)",
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_meal_plan_day` ON `meal_plan` (`day`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_meal_plan_recipeId` ON `meal_plan` (`recipeId`)")
            }
        }

        fun create(context: Context): GroceryDatabase =
            Room.databaseBuilder(context, GroceryDatabase::class.java, "grocery.db")
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6)
                .build()
    }
}
