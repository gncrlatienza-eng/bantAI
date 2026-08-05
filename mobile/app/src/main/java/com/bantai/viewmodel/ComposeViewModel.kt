package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.DraftsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ComposeViewModel(application: Application) : AndroidViewModel(application) {

    private val draftsStore = DraftsStore(application)

    // Runs on viewModelScope rather than a screen-level CoroutineScope, since this
    // is called from Compose's onDispose as the screen is leaving — a scope tied to
    // that same composable could already be cancelling by the time the save fires.
    // The ViewModel (and its scope) outlives the composable, tied to the NavBackStackEntry.
    fun saveDraft(recipient: String, body: String) {
        val address = recipient.trim()
        if (address.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            draftsStore.saveDraft(address, body)
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
