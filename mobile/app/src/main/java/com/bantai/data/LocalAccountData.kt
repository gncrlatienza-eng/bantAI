package com.bantai.data

import android.content.Context
import com.bantai.container

/**
 * The per-message state this phone keeps for the signed-in account: labels,
 * Alerts seen/reported marks, soft deletes, drafts, backend ids, scam-wave
 * matches and the block list. Most stores are keyed by SMS provider row id,
 * not by account.
 *
 * Sign-out keeps it, so the same account signing back in gets its inbox as it
 * left it instead of a fresh Setup re-sort with every alert unread. It's wiped
 * when a different account signs in on this phone (so nothing leaks into the
 * next account) and on Delete account.
 */
object LocalAccountData {
    suspend fun wipe(context: Context) {
        val container = context.applicationContext.container
        container.classificationStore.clear()
        container.deletedMessagesStore.clearAll()
        container.draftsStore.clearAll()
        container.backendMessageIdStore.clear()
        container.campaignMatchStore.clear()
        container.alertStateStore.clearAll()
        container.blockedSendersStore.clearBlocked()
        OutgoingSms.clearAll(context)
    }
}
