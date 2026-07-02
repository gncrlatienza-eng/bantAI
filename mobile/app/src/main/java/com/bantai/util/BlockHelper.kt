package com.bantai.util

import android.content.ContentValues
import android.content.Context
import android.provider.BlockedNumberContract
import android.util.Log

private const val TAG = "BlockHelper"

object BlockHelper {

    fun blockNumberSystem(context: Context, number: String) {
        try {
            if (!BlockedNumberContract.isBlocked(context, number)) {
                val values = ContentValues().apply {
                    put(BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER, number)
                }
                context.contentResolver.insert(
                    BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                    values
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "blockNumberSystem failed for $number", e)
        }
    }

    fun unblockNumberSystem(context: Context, number: String) {
        try {
            context.contentResolver.delete(
                BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                "${BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER} = ?",
                arrayOf(number)
            )
        } catch (e: Exception) {
            Log.e(TAG, "unblockNumberSystem failed for $number", e)
        }
    }

    fun getBlockedNumbers(context: Context): List<BlockedEntry> {
        val results = mutableListOf<BlockedEntry>()
        try {
            val cursor = context.contentResolver.query(
                BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                arrayOf(
                    BlockedNumberContract.BlockedNumbers.COLUMN_ID,
                    BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER,
                ),
                null, null, null
            )
            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(BlockedNumberContract.BlockedNumbers.COLUMN_ID)
                val numCol = it.getColumnIndexOrThrow(BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER)
                while (it.moveToNext()) {
                    results.add(
                        BlockedEntry(
                            id = it.getLong(idCol),
                            number = it.getString(numCol) ?: "",
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getBlockedNumbers failed", e)
        }
        return results
    }

    data class BlockedEntry(val id: Long, val number: String)
}
