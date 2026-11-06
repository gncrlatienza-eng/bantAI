package com.bantai.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.BrokenImage
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.bantai.R
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextTertiary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TAG = "MmsImages"

// Longest edge, in pixels, a bubble thumbnail is decoded at; the full-screen
// viewer decodes larger. MMS pictures are small (carriers cap them near
// 300 KB-1 MB), but decoding every one at full size would still waste memory.
private const val THUMB_EDGE_PX = 720
private const val FULL_EDGE_PX = 2048
private const val CACHE_BYTES = 16 * 1024 * 1024
private const val MAX_ZOOM = 5f
private const val DOUBLE_TAP_ZOOM = 2.5f
private const val PLACEHOLDER_RATIO = 4f / 3f

// Very tall or wide pictures are cropped to this range so one can't fill the thread.
// Portrait photos are cropped to 3:4 at most. At 1:2 a single phone photo
// filled the whole screen (1,476 of 2,340 px on a Huawei P30).
private const val MIN_RATIO = 0.75f
private const val MAX_RATIO = 2f

private val cache =
    object : LruCache<String, Bitmap>(CACHE_BYTES) {
        override fun sizeOf(
            key: String,
            value: Bitmap,
        ): Int = value.byteCount
    }

/**
 * Decodes a picture from the phone's MMS store, scaled down so its longest
 * edge is at most [maxEdge]. Null when it can't be read (deleted meanwhile,
 * or a format Android can't decode).
 */
private suspend fun loadImage(
    context: Context,
    uri: String,
    maxEdge: Int,
): ImageBitmap? =
    withContext(Dispatchers.IO) {
        val key = "$uri@$maxEdge"
        cache.get(key)?.let { return@withContext it.asImageBitmap() }
        runCatching {
            val resolver = context.contentResolver
            val parsed = Uri.parse(uri)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            resolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxEdge) sample *= 2
            val options = BitmapFactory.Options().apply { inSampleSize = sample }
            resolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it, null, options) }
        }.onFailure { Log.w(TAG, "Couldn't load MMS picture", it) }
            .getOrNull()
            ?.also { cache.put(key, it) }
            ?.asImageBitmap()
    }

/**
 * The pictures of an MMS, stacked, inside its bubble. Tapping one opens it
 * full screen. [onLongClick] keeps the bubble's long-press (selection) working
 * over the picture.
 */
@Composable
fun MmsImages(
    images: List<String>,
    maxWidth: Dp,
    onLongClick: () -> Unit,
    modifier: Modifier = Modifier,
    // 0 when the pictures sit flush inside a bubble that rounds them itself.
    cornerRadius: Dp = 12.dp,
) {
    var open by remember { mutableStateOf<String?>(null) }
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        images.forEach { uri ->
            MmsImage(
                uri = uri,
                maxWidth = maxWidth,
                cornerRadius = cornerRadius,
                onClick = { open = uri },
                onLongClick = onLongClick,
            )
        }
    }
    open?.let { FullScreenImage(uri = it, onDismiss = { open = null }) }
}

private sealed interface Picture {
    data object Loading : Picture

    data object Missing : Picture

    data class Loaded(
        val bitmap: ImageBitmap,
    ) : Picture
}

@Composable
private fun MmsImage(
    uri: String,
    maxWidth: Dp,
    cornerRadius: Dp,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val context = LocalContext.current
    val picture by produceState<Picture>(Picture.Loading, uri) {
        value = loadImage(context, uri, THUMB_EDGE_PX)?.let { Picture.Loaded(it) } ?: Picture.Missing
    }
    val loaded = picture as? Picture.Loaded
    val ratio = loaded?.let { it.bitmap.width.toFloat() / it.bitmap.height } ?: PLACEHOLDER_RATIO
    Box(
        modifier =
            Modifier
                .width(maxWidth)
                .aspectRatio(ratio.coerceIn(MIN_RATIO, MAX_RATIO))
                .clip(RoundedCornerShape(cornerRadius))
                .background(SurfaceElevated)
                .pointerInput(uri, loaded != null) {
                    detectTapGestures(onTap = { if (loaded != null) onClick() }, onLongPress = { onLongClick() })
                },
        contentAlignment = Alignment.Center,
    ) {
        when (picture) {
            is Picture.Loaded ->
                Image(
                    bitmap = (picture as Picture.Loaded).bitmap,
                    contentDescription = stringResource(R.string.cd_mms_photo),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            // Deleted meanwhile, or a format Android can't decode.
            Picture.Missing ->
                Icon(
                    Icons.Outlined.BrokenImage,
                    contentDescription = stringResource(R.string.cd_mms_photo_unavailable),
                    tint = TextTertiary,
                    modifier = Modifier.size(32.dp),
                )
            // A plain grey tile while decoding.
            Picture.Loading -> Unit
        }
    }
}

/** A picture on black, pinch or double-tap to zoom, tap the X or back to close. */
@Composable
private fun FullScreenImage(
    uri: String,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val image by produceState<ImageBitmap?>(null, uri) { value = loadImage(context, uri, FULL_EDGE_PX) }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val transform =
        rememberTransformableState { zoom, pan, _ ->
            scale = (scale * zoom).coerceIn(1f, MAX_ZOOM)
            offset = if (scale == 1f) Offset.Zero else offset + pan
        }
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            image?.let {
                Image(
                    bitmap = it,
                    contentDescription = stringResource(R.string.cd_mms_photo),
                    contentScale = ContentScale.Fit,
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onDoubleTap = {
                                        scale = if (scale > 1f) 1f else DOUBLE_TAP_ZOOM
                                        offset = Offset.Zero
                                    },
                                )
                            }.transformable(transform)
                            .graphicsLayer(
                                scaleX = scale,
                                scaleY = scale,
                                translationX = offset.x,
                                translationY = offset.y,
                            ),
                )
            }
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.align(Alignment.TopStart).statusBarsPadding().padding(8.dp),
            ) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.action_close), tint = Color.White)
            }
        }
    }
}
