package dev.azrael.grocery.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [GroceryItem::class, CabinetItem::class], version = 3, exportSchema = false)
abstract class GroceryDatabase : RoomDatabase() {
    abstract fun groceryDao(): GroceryDao
    abstract fun cabinetDao(): CabinetDao

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

        /** Adds expiry dates to Cabinet items; existing items have none. */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `cabinet_items` ADD COLUMN `expiresOn` INTEGER")
            }
        }

        fun create(context: Context): GroceryDatabase =
            Room.databaseBuilder(context, GroceryDatabase::class.java, "grocery.db")
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
    }
}
