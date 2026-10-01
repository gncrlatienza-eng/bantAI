package com.bantai

import android.content.Context
import com.bantai.data.SmsRepository
import com.bantai.data.SmsWriter
import com.bantai.data.local.AlertStateStore
import com.bantai.data.local.BackendMessageIdStore
import com.bantai.data.local.BlockedSendersStore
import com.bantai.data.local.CampaignMatchStore
import com.bantai.data.local.ClassificationStore
import com.bantai.data.local.DeletedMessagesStore
import com.bantai.data.local.DraftsStore
import com.bantai.data.local.UserPreferences
import com.bantai.mms.MmsDownloader

/**
 * One shared instance of each repository/store for the whole app. Screens,
 * ViewModels, receivers and services used to build their own copies wherever
 * they needed one; they now all read these. Built lazily, so creating the
 * container touches no disk.
 */
class AppContainer(
    appContext: Context,
) {
    val smsRepository by lazy { SmsRepository(appContext) }
    val smsWriter by lazy { SmsWriter(appContext) }
    val userPreferences by lazy { UserPreferences(appContext) }
    val classificationStore by lazy { ClassificationStore(appContext) }
    val deletedMessagesStore by lazy { DeletedMessagesStore(appContext) }
    val draftsStore by lazy { DraftsStore(appContext) }
    val backendMessageIdStore by lazy { BackendMessageIdStore(appContext) }
    val campaignMatchStore by lazy { CampaignMatchStore(appContext) }
    val blockedSendersStore by lazy { BlockedSendersStore(appContext) }
    val alertStateStore by lazy { AlertStateStore(appContext) }
    val mmsDownloader by lazy { MmsDownloader(appContext) }
}

/** The app's shared [AppContainer], reachable from any Context. */
val Context.container: AppContainer
    get() = (applicationContext as BantaiApp).container
