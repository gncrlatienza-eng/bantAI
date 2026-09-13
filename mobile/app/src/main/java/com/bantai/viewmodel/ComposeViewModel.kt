package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.DraftsStore
import com.bantai.data.model.normalizeSenderKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ComposeViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val draftsStore = DraftsStore(application)

    // Runs on viewModelScope rather than a screen-level CoroutineScope, since this
    // is called from Compose's onDispose as the screen is leaving — a scope tied to
    // that same composable could already be cancelling by the time the save fires.
    // The ViewModel (and its scope) outlives the composable, tied to the NavBackStackEntry.
    fun saveDraft(
        recipient: String,
        body: String,
        previousRecipient: String? = null,
    ) {
        val address = recipient.trim()
        val previous = previousRecipient?.trim()
        viewModelScope.launch(Dispatchers.IO) {
            // If the recipient was edited before leaving (e.g. reopened an existing
            // draft and fixed a typo in the number), the old entry is keyed under
            // the original number — without this it's orphaned as a duplicate
            // instead of moved.
            if (!previous.isNullOrEmpty() &&
                address.isNotEmpty() &&
                normalizeSenderKey(previous) != normalizeSenderKey(address)
            ) {
                draftsStore.deleteDraft(previous)
            }
            if (address.isNotEmpty()) draftsStore.saveDraft(address, body)
        }
    }

    fun clearDraft(recipient: String) {
        val address = recipient.trim()
        if (address.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            draftsStore.deleteDraft(address)
        }
    }
}
