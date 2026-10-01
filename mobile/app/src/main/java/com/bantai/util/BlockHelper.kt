package com.bantai.util

import android.app.role.RoleManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.BlockedNumberContract
import android.provider.Telephony
import android.util.Log
import com.bantai.BuildConfig
import com.bantai.container
import com.bantai.data.local.BlockedSendersStore
import com.bantai.data.remote.BlockedNumbersApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TAG = "BlockHelper"

object BlockHelper {
    /**
     * Where a block landed. [onDevice]: in Android's block list, so the phone
     * itself stops the sender, which only works while BantAI is the default
     * SMS app. [onServer]: on the backend, which suppresses the sender's later
     * texts either way.
     */
    data class BlockOutcome(
        val onDevice: Boolean,
        val onServer: Boolean,
    ) {
        val blocked: Boolean get() = onDevice || onServer
    }

    fun isDefaultSmsApp(context: Context): Boolean = DefaultSmsApp.isDefault(context)

    // Opens the system prompt that makes BantAI the default SMS app (same request
    // as onboarding's OnboardingDefaultSmsScreen), falling back to the pre-Q intent.
    fun defaultSmsAppIntent(context: Context): Intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            context.getSystemService(RoleManager::class.java).createRequestRoleIntent(RoleManager.ROLE_SMS)
        } else {
            Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
                .putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, context.packageName)
        }

    /**
     * The one way BantAI blocks a sender: on the device when it can, on the
     * backend, and in [BlockedSendersStore] so Blocked Numbers and Alerts
     * agree on who is blocked. Recorded locally whenever either side took it.
     */
    suspend fun blockSender(
        context: Context,
        token: String,
        sender: String,
    ): BlockOutcome {
        val onDevice =
            isDefaultSmsApp(context) &&
                withContext(Dispatchers.IO) {
                    blockNumberSystem(context, sender)
                    isBlocked(context, sender)
                }
        val onServer =
            token.isNotEmpty() &&
                BlockedNumbersApi
                    .block(token, sender)
                    .onFailure { Log.w(TAG, "Backend block failed", it) }
                    .isSuccess
        val outcome = BlockOutcome(onDevice, onServer)
        if (outcome.blocked) context.container.blockedSendersStore.markBlocked(sender)
        return outcome
    }

    /** Undoes [blockSender]; false when the backend half failed (the device half always runs). */
    suspend fun unblockSender(
        context: Context,
        token: String,
        sender: String,
    ): Boolean {
        withContext(Dispatchers.IO) { unblockNumberSystem(context, sender) }
        context.container.blockedSendersStore.markUnblocked(sender)
        if (token.isEmpty()) return true
        return BlockedNumbersApi.unblock(token, sender).isSuccess
    }

    /** Blocked by BantAI (either side) or in Android's own block list. Call off the main thread. */
    fun isSenderBlocked(
        context: Context,
        sender: String,
        bantaiBlocked: Set<String>,
    ): Boolean = sender.isNotEmpty() && (sender in bantaiBlocked || isBlocked(context, sender))

    fun blockNumberSystem(
        context: Context,
        number: String,
    ): Result<Unit> =
        runCatching {
            if (!BlockedNumberContract.isBlocked(context, number)) {
                val values =
                    ContentValues().apply {
                        put(BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER, number)
                    }
                context.contentResolver.insert(
                    BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                    values,
                )
            }
            Unit
        }.onFailure { error ->
            if (BuildConfig.DEBUG) Log.e(TAG, "blockNumberSystem failed for $number", error)
        }

    fun isBlocked(
        context: Context,
        number: String,
    ): Boolean =
        try {
            BlockedNumberContract.isBlocked(context, number)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.e(TAG, "isBlocked failed for $number", e)
            false
        }

    fun unblockNumberSystem(
        context: Context,
        number: String,
    ) {
        try {
            context.contentResolver.delete(
                BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                "${BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER} = ?",
                arrayOf(number),
            )
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.e(TAG, "unblockNumberSystem failed for $number", e)
        }
    }

    fun getBlockedNumbers(context: Context): List<BlockedEntry> {
        val results = mutableListOf<BlockedEntry>()
        try {
            val cursor =
                context.contentResolver.query(
                    BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                    arrayOf(
                        BlockedNumberContract.BlockedNumbers.COLUMN_ID,
                        BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER,
                    ),
                    null,
                    null,
                    null,
                )
            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(BlockedNumberContract.BlockedNumbers.COLUMN_ID)
                val numCol = it.getColumnIndexOrThrow(BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER)
                while (it.moveToNext()) {
                    results.add(
                        BlockedEntry(
                            id = it.getLong(idCol),
                            number = it.getString(numCol) ?: "",
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getBlockedNumbers failed", e)
        }
        return results
    }

    /**
     * @param onDevice false for a sender only BantAI's server blocks (it was
     *   blocked while BantAI wasn't the default SMS app), so the phone itself
     *   still lets its texts through.
     * @param name the saved contact's name, when the number is one.
     */
    data class BlockedEntry(
        val id: Long,
        val number: String,
        val onDevice: Boolean = true,
        val name: String? = null,
    )
}
