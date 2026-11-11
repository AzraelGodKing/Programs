package dev.azrael.grocery.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [GroceryItem::class, CabinetItem::class, FoodLogEntry::class], version = 3, exportSchema = false)
abstract class GroceryDatabase : RoomDatabase() {
    abstract fun groceryDao(): GroceryDao
    abstract fun cabinetDao(): CabinetDao
    abstract fun foodLogDao(): FoodLogDao

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

        /** Adds the sodium tracker's food log, and label sodium on Cabinet items added by barcode. */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `food_log` (" +
                        "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`name` TEXT NOT NULL, `day` INTEGER NOT NULL, " +
                        "`sodiumMg` INTEGER NOT NULL, `potassiumMg` INTEGER, " +
                        "`servings` REAL NOT NULL, `loggedAt` INTEGER NOT NULL)",
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_food_log_day` ON `food_log` (`day`)")
                db.execSQL("ALTER TABLE `cabinet_items` ADD COLUMN `barcode` TEXT")
                db.execSQL("ALTER TABLE `cabinet_items` ADD COLUMN `sodiumMgPerServing` INTEGER")
                db.execSQL("ALTER TABLE `cabinet_items` ADD COLUMN `sodiumMgPer100g` INTEGER")
                db.execSQL("ALTER TABLE `cabinet_items` ADD COLUMN `potassiumMgPerServing` INTEGER")
                db.execSQL("ALTER TABLE `cabinet_items` ADD COLUMN `servingSize` TEXT")
            }
        }

        fun create(context: Context): GroceryDatabase =
            Room.databaseBuilder(context, GroceryDatabase::class.java, "grocery.db")
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
    }
}
