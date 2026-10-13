package com.bantai.util

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.telephony.SubscriptionManager
import com.bantai.data.model.normalizeSenderKey

private const val PREFS = "sim_choice"
private const val SETTINGS_PREFS = "sim_settings"
private const val KEY_SEND_SLOT = "send_slot"

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

    /**
     * The SIMs a thread or Compose may offer: every active one, or only the
     * Settings → Sending SIM pick when one is set (the switch then hides).
     */
    fun selectableSims(context: Context): List<Sim> {
        val sims = activeSims(context)
        val slot = sendSlot(context) ?: return sims
        return sims.filter { it.slot == slot }.ifEmpty { sims }
    }

    /**
     * Settings → Sending SIM: the slot (0 = SIM 1) every message goes out on,
     * or null for the per-conversation choice above. A slot rather than a
     * subscription id, so swapping the card in that slot keeps the setting.
     */
    fun sendSlot(context: Context): Int? = settings(context).getInt(KEY_SEND_SLOT, -1).takeIf { it >= 0 }

    fun setSendSlot(
        context: Context,
        slot: Int?,
    ) {
        settings(context).edit().putInt(KEY_SEND_SLOT, slot ?: -1).apply()
    }

    /** The active SIM in the Sending SIM slot; null when unset or that slot is empty. */
    fun fixedSendSub(context: Context): Int? {
        val slot = sendSlot(context) ?: return null
        return activeSims(context).firstOrNull { it.slot == slot }?.subId
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

    // Separate from PREFS, whose keys are conversation keys.
    private fun settings(context: Context): SharedPreferences {
        val app = context.applicationContext
        return app.getSharedPreferences(SETTINGS_PREFS, Context.MODE_PRIVATE)
    }
}
