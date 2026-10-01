package com.bantai.ui.components

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.White
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Most photos one MMS carries; each shares the carrier's size limit. */
const val MAX_MMS_PHOTOS = 5

private const val THUMBNAIL_PX = 192

/**
 * Opens Android's photo picker (no storage permission needed; older phones
 * get the system file picker instead). Returns the launch function.
 */
@Composable
fun rememberPhotoPicker(onPicked: (List<Uri>) -> Unit): () -> Unit {
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_MMS_PHOTOS)) { uris ->
            if (uris.isNotEmpty()) onPicked(uris)
        }
    return { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
}

/** The photos picked for the next message, each with a remove button. */
@Composable
fun PhotoAttachmentStrip(
    photos: List<Uri>,
    onRemove: (Uri) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (photos.isEmpty()) return
    Row(
        modifier = modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        photos.forEach { uri ->
            Box(modifier = Modifier.size(64.dp)) {
                Thumbnail(uri, Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)))
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(2.dp)
                            .size(20.dp)
                            .background(Black.copy(alpha = 0.7f), CircleShape)
                            .clickable { onRemove(uri) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = stringResource(R.string.attachment_remove),
                        tint = White,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun Thumbnail(
    uri: Uri,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val bitmap by produceState<ImageBitmap?>(initialValue = null, uri) {
        value = withContext(Dispatchers.IO) { decodeThumbnail(context, uri) }
    }
    Box(modifier = modifier.background(Surface)) {
        bitmap?.let {
            Image(it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        }
    }
}

// A small, subsampled decode: a full camera photo per thumbnail would be tens of MB.
private fun decodeThumbnail(
    context: Context,
    uri: Uri,
): ImageBitmap? =
    runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (minOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= THUMBNAIL_PX) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        context.contentResolver
            .openInputStream(uri)
            ?.use { BitmapFactory.decodeStream(it, null, options) }
            ?.asImageBitmap()
    }.getOrNull()
