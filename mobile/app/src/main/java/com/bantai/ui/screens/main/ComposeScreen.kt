package com.bantai.ui.screens.main

import android.net.Uri
import android.provider.ContactsContract
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.OutgoingSms
import com.bantai.data.model.normalizeSenderKey
import com.bantai.mms.MmsSender
import com.bantai.mms.needsMms
import com.bantai.navigation.Screen
import com.bantai.ui.components.MAX_MMS_PHOTOS
import com.bantai.ui.components.PhotoAttachmentStrip
import com.bantai.ui.components.SimSelector
import com.bantai.ui.components.rememberPhotoPicker
import com.bantai.ui.components.rememberSmsSendPermission
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.ContactNames
import com.bantai.util.SimChoice
import com.bantai.util.isValidSmsRecipient
import com.bantai.viewmodel.ComposeViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// The To field (chips, contact picker), photos and the SMS/MMS send in one screen.
@Suppress("LongMethod", "CyclomaticComplexMethod")
@OptIn(ExperimentalLayoutApi::class) // FlowRow for the recipient chips
@Composable
fun ComposeScreen(
    navController: NavController,
    initialRecipient: String = "",
    initialBody: String = "",
    viewModel: ComposeViewModel = viewModel(),
) {
    val context = LocalContext.current
    var recipient by remember { mutableStateOf(initialRecipient) }
    var messageBody by remember { mutableStateOf(initialBody) }
    var isSending by remember { mutableStateOf(false) }
    // Set right before navigating away after a successful send, so the draft-save
    // below doesn't re-save text that was just sent (and already had its draft cleared).
    var justSent by remember { mutableStateOf(false) }
    var numberChoices by remember { mutableStateOf<List<Pair<String, String>>?>(null) }
    // Recipients already added (shown as chips); [recipient] is the one being typed.
    val chips = remember { mutableStateListOf<String>() }
    val photos = remember { mutableStateListOf<Uri>() }
    // Dual-SIM: which SIM the new message goes out on (see SimChoice).
    val sims = remember { SimChoice.activeSims(context) }
    var chosenSub by remember { mutableStateOf(SimChoice.pick(sims, null, -1, SimChoice.defaultSmsSub())) }
    val scope = rememberCoroutineScope()
    val pickPhotos =
        rememberPhotoPicker { picked ->
            picked.filterNot { it in photos }.take(MAX_MMS_PHOTOS - photos.size).let(photos::addAll)
        }

    // Adds the typed number as a chip; false (with a toast) when it isn't one.
    @Suppress("ReturnCount") // nothing typed, not a number, or added
    fun commitRecipient(raw: String = recipient): Boolean {
        val number = raw.trim().replace(Regex("[\\s\\-()]"), "")
        if (number.isEmpty()) return true
        if (!isValidSmsRecipient(number)) {
            Toast.makeText(context, R.string.compose_enter_valid_number, Toast.LENGTH_SHORT).show()
            return false
        }
        if (chips.none { normalizeSenderKey(it) == normalizeSenderKey(number) }) chips += number
        if (raw == recipient) recipient = ""
        return true
    }

    // Leaving this screen any other way (back button, system back gesture) should
    // preserve unsent text as a draft instead of silently discarding it.
    DisposableEffect(Unit) {
        onDispose {
            // A draft belongs to one conversation: a single recipient, typed or added.
            val draftRecipient = if (recipient.isBlank() && chips.size == 1) chips.single() else recipient
            if (!justSent) viewModel.saveDraft(draftRecipient, messageBody, previousRecipient = initialRecipient)
        }
    }

    // PickContact's returned URI carries its own temporary read grant, so this
    // works without holding READ_CONTACTS at runtime.
    val contactPickerLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.PickContact()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (!cursor.moveToFirst()) return@use
                val hasPhoneIndex = cursor.getColumnIndex(ContactsContract.Contacts.HAS_PHONE_NUMBER)
                if (hasPhoneIndex < 0 || cursor.getInt(hasPhoneIndex) <= 0) return@use
                val contactId = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID))
                // Every number on the contact (mobile, work, a second SIM...). It
                // used to take the first one silently; with several, the user picks.
                val numbers = mutableListOf<Pair<String, String>>()
                context.contentResolver
                    .query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        arrayOf(
                            ContactsContract.CommonDataKinds.Phone.NUMBER,
                            ContactsContract.CommonDataKinds.Phone.TYPE,
                            ContactsContract.CommonDataKinds.Phone.LABEL,
                        ),
                        "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                        arrayOf(contactId),
                        null,
                    )?.use { phoneCursor ->
                        while (phoneCursor.moveToNext()) {
                            val number = phoneCursor.getString(0) ?: continue
                            val label =
                                ContactsContract.CommonDataKinds.Phone
                                    .getTypeLabel(context.resources, phoneCursor.getInt(1), phoneCursor.getString(2))
                                    .toString()
                            if (numbers.none { normalizeSenderKey(it.first) == normalizeSenderKey(number) }) {
                                numbers += number to label
                            }
                        }
                    }
                when {
                    numbers.size == 1 -> commitRecipient(numbers.single().first)
                    numbers.size > 1 -> numberChoices = numbers
                }
            }
        }

    numberChoices?.let { choices ->
        AlertDialog(
            onDismissRequest = { numberChoices = null },
            containerColor = SurfaceElevated,
            title = { Text(stringResource(R.string.compose_choose_number), color = White) },
            text = {
                Column {
                    choices.forEach { (number, label) ->
                        TextButton(
                            onClick = {
                                commitRecipient(number)
                                numberChoices = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                "$label · $number",
                                color = White,
                                fontSize = TextSize.Body,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { numberChoices = null }) {
                    Text(stringResource(R.string.action_cancel), color = TextSecondary)
                }
            },
        )
    }

    val withSmsPermission = rememberSmsSendPermission()

    fun openThread(key: String) {
        justSent = true
        navController.navigate(Screen.Detail.createRoute(key)) {
            popUpTo(Screen.Compose.route) { inclusive = true }
        }
    }

    fun sendMessage() {
        if (!commitRecipient()) return
        val recipients = chips.toList()
        val body = messageBody.trim()
        if (recipients.isEmpty()) {
            Toast.makeText(context, R.string.compose_enter_recipient, Toast.LENGTH_SHORT).show()
            return
        }
        if (body.isEmpty() && photos.isEmpty()) {
            Toast.makeText(context, R.string.compose_enter_message, Toast.LENGTH_SHORT).show()
            return
        }
        // Sending, recording the result and the failure notice all happen in
        // OutgoingSms's own scope: this screen is popped right after, which
        // used to cancel the result update and leave the message "Sending…".
        withSmsPermission {
            if (needsMms(recipients.size, photos.size)) {
                val picked = photos.toList()
                scope.launch {
                    // A group's thread id comes from the phone; looked up off the main thread.
                    val key = withContext(Dispatchers.IO) { MmsSender.conversationKeyFor(context, recipients) }
                    chosenSub?.let { SimChoice.remember(context, key, it) }
                    OutgoingSms.sendMms(context, recipients, body, picked, chosenSub ?: -1)
                    if (recipients.size == 1) viewModel.clearDraft(recipients.single())
                    openThread(key)
                }
            } else {
                val to = recipients.single()
                chosenSub?.let { SimChoice.remember(context, to, it) }
                OutgoingSms.send(context, to, body, chosenSub ?: -1)
                viewModel.clearDraft(to)
                openThread(to)
            }
        }
    }

    val canSend = (chips.isNotEmpty() || recipient.isNotBlank()) && (messageBody.isNotBlank() || photos.isNotEmpty())

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .imePadding(),
    ) {
        // Top bar
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = TextSecondary,
                )
            }
            Text(
                stringResource(R.string.compose_new_message),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = 8.dp)
                        .size(36.dp)
                        .background(if (canSend) Indigo else Surface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (isSending) {
                    CircularProgressIndicator(color = OnIndigo, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(
                        onClick = { sendMessage() },
                        modifier = Modifier.size(36.dp),
                        enabled = !isSending,
                    ) {
                        Icon(
                            Icons.Filled.ArrowUpward,
                            contentDescription = stringResource(R.string.action_send),
                            tint = if (canSend) OnIndigo else TextSecondary,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        }
        HorizontalDivider(color = Surface)

        // To field
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(Black)
                    .border(width = 1.dp, color = BorderColor)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(stringResource(R.string.compose_to), color = TextSecondary, fontSize = TextSize.Footnote)
            FlowRow(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                chips.forEach { number -> RecipientChip(number, onRemove = { chips.remove(number) }) }
                BasicTextField(
                    value = recipient,
                    // A comma or semicolon finishes a recipient, like most messaging apps.
                    onValueChange = { typed ->
                        if (typed.endsWith(',') || typed.endsWith(';')) {
                            recipient = typed.dropLast(1)
                            commitRecipient()
                        } else {
                            recipient = typed
                        }
                    },
                    modifier = Modifier.widthIn(min = 120.dp).padding(vertical = 4.dp),
                    textStyle = TextStyle(color = White, fontSize = TextSize.Body),
                    cursorBrush = SolidColor(Indigo),
                    singleLine = true,
                    keyboardOptions =
                        KeyboardOptions(
                            keyboardType = KeyboardType.Phone,
                            imeAction = ImeAction.Next,
                        ),
                    keyboardActions = KeyboardActions(onNext = { commitRecipient() }),
                    decorationBox = { inner ->
                        if (recipient.isEmpty() && chips.isEmpty()) {
                            Text(
                                stringResource(R.string.compose_phone_number),
                                color = TextSecondary,
                                fontSize = TextSize.Body,
                            )
                        }
                        inner()
                    },
                )
            }
            IconButton(
                onClick = { contactPickerLauncher.launch(null) },
                modifier = Modifier.size(20.dp),
            ) {
                Icon(
                    Icons.Default.PersonAdd,
                    contentDescription = stringResource(R.string.compose_add_contact),
                    tint = Indigo,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
        HorizontalDivider(color = BorderColor)
        if (needsMms(chips.size + (if (recipient.isNotBlank()) 1 else 0), photos.size)) {
            Text(
                stringResource(R.string.compose_mms_hint),
                color = TextSecondary,
                fontSize = TextSize.Caption,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 4.dp, top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SimSelector(sims, chosenSub, onSelect = { chosenSub = it }, modifier = Modifier.padding(start = 12.dp))
            IconButton(onClick = pickPhotos, enabled = photos.size < MAX_MMS_PHOTOS) {
                Icon(
                    Icons.Outlined.AddPhotoAlternate,
                    contentDescription = stringResource(R.string.attachment_add_photo),
                    tint = Indigo,
                )
            }
            PhotoAttachmentStrip(photos, onRemove = { photos.remove(it) }, modifier = Modifier.weight(1f))
        }

        // Message body
        BasicTextField(
            value = messageBody,
            onValueChange = { messageBody = it },
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(16.dp),
            textStyle = TextStyle(color = White, fontSize = TextSize.Body, lineHeight = 22.sp),
            cursorBrush = SolidColor(Indigo),
            decorationBox = { inner ->
                if (messageBody.isEmpty()) {
                    Text(
                        stringResource(R.string.compose_type_a_message),
                        color = TextSecondary,
                        fontSize = TextSize.Body,
                    )
                }
                inner()
            },
        )
    }
}

/** One added recipient in the To field; its contact name when there is one. */
@Composable
private fun RecipientChip(
    number: String,
    onRemove: () -> Unit,
) {
    val context = LocalContext.current
    val name by produceState<String?>(initialValue = null, number) {
        value = withContext(Dispatchers.IO) { ContactNames.lookup(context, number) }
    }
    Row(
        modifier =
            Modifier
                .background(Surface, RoundedCornerShape(14.dp))
                .padding(start = 10.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(name ?: number, color = White, fontSize = TextSize.Subhead, maxLines = 1)
        IconButton(onClick = onRemove, modifier = Modifier.size(22.dp)) {
            Icon(
                Icons.Filled.Close,
                contentDescription = stringResource(R.string.compose_remove_recipient, name ?: number),
                tint = TextSecondary,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}
