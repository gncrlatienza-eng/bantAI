package com.bantai.ui.components

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.ContactsContract
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextTertiary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

// Cache so scrolling lists don't re-query contacts for every row bind.
// Null value = looked up, no photo.
private val contactPhotoCache = ConcurrentHashMap<String, Optional<ImageBitmap>>()

private class Optional<T>(val value: T?)

private suspend fun loadContactPhoto(context: Context, sender: String): ImageBitmap? {
    contactPhotoCache[sender]?.let { return it.value }
    val result = withContext(Dispatchers.IO) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
            != PackageManager.PERMISSION_GRANTED
        ) return@withContext null
        try {
            val lookupUri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(sender),
            )
            var photoUri: String? = null
            context.contentResolver.query(
                lookupUri,
                arrayOf(ContactsContract.PhoneLookup.PHOTO_URI),
                null, null, null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) photoUri = cursor.getString(0)
            }
            photoUri?.let { uriString ->
                context.contentResolver.openInputStream(Uri.parse(uriString))?.use { stream ->
                    BitmapFactory.decodeStream(stream)?.asImageBitmap()
                }
            }
        } catch (e: Exception) {
            null
        }
    }
    contactPhotoCache[sender] = Optional(result)
    return result
}

/**
 * iOS-style sender avatar: the contact's photo when the user has set one,
 * otherwise a neutral gray person silhouette. System-generated senders
 * (brands like "Globe") never resolve to a contact, so they always get
 * the silhouette.
 */
@Composable
fun SenderAvatar(sender: String, size: Dp, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val photo by produceState<ImageBitmap?>(initialValue = contactPhotoCache[sender]?.value, sender) {
        value = loadContactPhoto(context, sender)
    }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(SurfaceElevated),
        contentAlignment = Alignment.Center,
    ) {
        val bitmap = photo
        if (bitmap != null) {
            Image(
                bitmap = bitmap,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Icon(
                Icons.Filled.Person,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(size * 0.58f).align(Alignment.Center),
            )
        }
    }
}
