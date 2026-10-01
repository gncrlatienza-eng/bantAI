package com.bantai.data.db

import android.content.Context
import android.util.Log
import androidx.room.AutoMigration
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase

private const val TAG = "BantaiDatabase"
private const val DB_NAME = "bantai.db"

@Database(
    entities = [
        LocalMessageEntity::class,
        MessageOverrideEntity::class,
        ClassificationEntity::class,
        MmsAddressEntity::class,
        ReplyQuoteEntity::class,
        PendingMmsEntity::class,
    ],
    version = 4,
    autoMigrations = [
        AutoMigration(from = 1, to = 2),
        AutoMigration(from = 2, to = 3),
        AutoMigration(from = 3, to = 4),
    ],
)
abstract class BantaiDatabase : RoomDatabase() {
    abstract fun localMessages(): LocalMessageDao

    abstract fun overrides(): MessageOverrideDao

    abstract fun classifications(): ClassificationDao

    abstract fun mmsAddresses(): MmsAddressDao

    abstract fun replyQuotes(): ReplyQuoteDao

    abstract fun pendingMms(): PendingMmsDao

    companion object {
        @Volatile private var instance: BantaiDatabase? = null

        fun get(context: Context): BantaiDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(appContext: Context): BantaiDatabase =
            Room
                .databaseBuilder(appContext, BantaiDatabase::class.java, DB_NAME)
                .addCallback(
                    object : Callback() {
                        // Runs once, when the database file is first created -- i.e. on the
                        // first launch of a build that has it. Pulls in what the older
                        // JSON-file/DataStore stores held so an upgrade loses nothing.
                        override fun onCreate(db: SupportSQLiteDatabase) {
                            runCatching { LegacyStoreImport.run(appContext, db) }
                                .onFailure { Log.e(TAG, "Importing the old local stores failed", it) }
                        }
                    },
                ).build()
    }
}
