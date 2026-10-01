package com.bantai.util

import android.annotation.SuppressLint
import android.content.Context
import android.telephony.SubscriptionManager
import com.bantai.data.model.normalizeSenderKey

private const val PREFS = "sim_choice"

/** One active SIM, labelled the way the phone's own dialer does ("SIM 1 · Globe"). */
data class Sim(
    val subId: Int,
    val slot: Int,
    val carrier: String?,
) {
    val shortLabel: String get() = "SIM ${slot + 1}"
    val label: String get() = carrier?.let { "$shortLabel · $it" } ?: shortLabel
}

/**
 * Which SIM a message goes out on, on a dual-SIM phone. Phones set to "Ask
 * every time" have no default SMS SIM, and leaving the choice to Android
 * opened its own picker, which failed at once on a Huawei -- and an MMS has no
 * picker at all. So the thread and Compose show their own SIM switch, and a
 * conversation remembers the SIM picked for it (on this phone only).
 */
object SimChoice {
    @SuppressLint("MissingPermission") // READ_PHONE_STATE is requested in onboarding; failure lists none
    fun activeSims(context: Context): List<Sim> =
        runCatching {
            context
                .getSystemService(SubscriptionManager::class.java)
                ?.activeSubscriptionInfoList
                .orEmpty()
                .sortedBy { it.simSlotIndex }
                .map { Sim(it.subscriptionId, it.simSlotIndex, it.carrierName?.toString()?.takeIf(String::isNotBlank)) }
        }.getOrDefault(emptyList())

    /**
     * The SIM to send on: the one picked for this conversation before, else
     * the one its messages came in on, else the phone's SMS SIM, else SIM 1.
     * Null when the phone lists no SIMs (Android then decides, as before).
     */
    fun pick(
        sims: List<Sim>,
        remembered: Int?,
        conversationSub: Int,
        defaultSmsSub: Int,
    ): Int? {
        val active = sims.map { it.subId }.toSet()
        return listOfNotNull(remembered, conversationSub, defaultSmsSub).firstOrNull { it in active }
            ?: sims.firstOrNull()?.subId
    }

    fun defaultSmsSub(): Int = SubscriptionManager.getDefaultSmsSubscriptionId()

    fun remembered(
        context: Context,
        conversationKey: String,
    ): Int? =
        prefs(context)
            .getInt(normalizeSenderKey(conversationKey), SubscriptionManager.INVALID_SUBSCRIPTION_ID)
            .takeIf { it != SubscriptionManager.INVALID_SUBSCRIPTION_ID }

    fun remember(
        context: Context,
        conversationKey: String,
        subId: Int,
    ) {
        prefs(context).edit().putInt(normalizeSenderKey(conversationKey), subId).apply()
    }

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
