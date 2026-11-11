package dev.azrael.grocery.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [GroceryItem::class], version = 1, exportSchema = false)
abstract class GroceryDatabase : RoomDatabase() {
    abstract fun groceryDao(): GroceryDao

    companion object {
        fun create(context: Context): GroceryDatabase =
            Room.databaseBuilder(context, GroceryDatabase::class.java, "grocery.db").build()
    }
}
