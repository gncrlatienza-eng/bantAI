package com.bantai.mms

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.telephony.SmsManager
import android.util.Log
import com.bantai.util.SmsSender
import java.io.ByteArrayOutputStream

private const val TAG = "MmsImageCompressor"

// Used when the carrier config doesn't say: the size every PH carrier accepts.
private const val DEFAULT_MAX_MMS_BYTES = 300 * 1024

// Room left in the message for the text, layout part and PDU headers.
private const val OVERHEAD_BYTES = 8 * 1024

// Largest side first, then smaller until the photo fits.
@Suppress("MagicNumber") // pixel sizes, tried largest first
private val MAX_SIDES = listOf(1600, 1280, 1024, 800, 640, 480, 320)

@Suppress("MagicNumber") // JPEG quality steps
private val JPEG_QUALITIES = listOf(85, 70, 55, 40)
private const val DEGREES_90 = 90f
private const val DEGREES_180 = 180f
private const val DEGREES_270 = 270f

/**
 * Shrinks picked photos to fit one MMS. Carriers reject anything over their
 * limit (usually 300 KB here), so a phone camera's 3-5 MB photo has to be
 * scaled and re-encoded as JPEG first.
 */
object MmsImageCompressor {
    /** The carrier's MMS size limit for [subId], or 300 KB when it doesn't say. */
    @Suppress("DEPRECATION") // getCarrierConfigValues: the replacement needs carrier privileges
    fun maxMessageBytes(
        context: Context,
        subId: Int,
    ): Int =
        runCatching {
            SmsSender
                .smsManagerFor(context, subId)
                .carrierConfigValues
                .getInt(SmsManager.MMS_CONFIG_MAX_MESSAGE_SIZE)
        }.getOrNull()?.takeIf { it > 0 } ?: DEFAULT_MAX_MMS_BYTES

    /** Each photo's share of the message; the text and layout get [OVERHEAD_BYTES]. */
    fun budgetPerImage(
        maxMessageBytes: Int,
        imageCount: Int,
    ): Int = ((maxMessageBytes - OVERHEAD_BYTES) / imageCount.coerceAtLeast(1)).coerceAtLeast(1)

    /** The photo at [uri] as a JPEG of at most [maxBytes]; null if it can't be read or made small enough. */
    fun compress(
        context: Context,
        uri: Uri,
        maxBytes: Int,
    ): MmsAttachment? =
        runCatching {
            val source = decode(context, uri, MAX_SIDES.first()) ?: return null
            val rotated = rotate(source, orientation(context, uri))
            for (side in MAX_SIDES) {
                val scaled = scaleDown(rotated, side)
                for (quality in JPEG_QUALITIES) {
                    val bytes =
                        ByteArrayOutputStream().use { out ->
                            scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
                            out.toByteArray()
                        }
                    if (bytes.size <= maxBytes) return MmsAttachment("image/jpeg", bytes)
                }
            }
            null
        }.onFailure { Log.w(TAG, "Couldn't prepare a photo for MMS", it) }.getOrNull()

    // Decodes at roughly [maxSide] (a power-of-two subsample), not full size:
    // a 12 MP photo at full size is ~48 MB of memory.
    private fun decode(
        context: Context,
        uri: Uri,
        maxSide: Int,
    ): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        return context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
    }

    private fun orientation(
        context: Context,
        uri: Uri,
    ): Int =
        runCatching {
            context.contentResolver.openInputStream(uri)?.use {
                ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            }
        }.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL

    // Camera photos are often stored sideways with a "rotate me" tag that the
    // JPEG re-encode would drop; the pixels are turned upright instead.
    private fun rotate(
        bitmap: Bitmap,
        orientation: Int,
    ): Bitmap {
        val degrees =
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> DEGREES_90
                ExifInterface.ORIENTATION_ROTATE_180 -> DEGREES_180
                ExifInterface.ORIENTATION_ROTATE_270 -> DEGREES_270
                else -> return bitmap
            }
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun scaleDown(
        bitmap: Bitmap,
        maxSide: Int,
    ): Bitmap {
        val largest = maxOf(bitmap.width, bitmap.height)
        if (largest <= maxSide) return bitmap
        val scale = maxSide.toFloat() / largest
        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
    }
}
