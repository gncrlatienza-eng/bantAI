package com.bantai.mms

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.File
import java.util.UUID

private const val TAG = "MmsFileProvider"
private const val DIR = "mms"

/**
 * Hands Android's MMS service a file to write a downloaded MMS into (and, for
 * sending, to read one from). SmsManager's MMS calls only accept a content://
 * URI, and the service runs in the phone process, so a plain file path isn't
 * enough. Not exported: the phone process only gets in through the per-file
 * grant in [newUri].
 */
class MmsFileProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun openFile(
        uri: Uri,
        mode: String,
    ): ParcelFileDescriptor? {
        val file = fileFor(context ?: return null, uri) ?: return null
        val flags =
            if (mode.contains('w')) {
                ParcelFileDescriptor.MODE_WRITE_ONLY or
                    ParcelFileDescriptor.MODE_CREATE or
                    ParcelFileDescriptor.MODE_TRUNCATE
            } else {
                ParcelFileDescriptor.MODE_READ_ONLY
            }
        return ParcelFileDescriptor.open(file, flags)
    }

    override fun getType(uri: Uri): String = "application/vnd.wap.mms-message"

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? = null

    override fun insert(
        uri: Uri,
        values: ContentValues?,
    ): Uri? = null

    override fun delete(
        uri: Uri,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0

    companion object {
        // The MMS service runs as the phone user; both names are granted because
        // it has shipped under each (com.android.mms.service shares its uid).
        private val PHONE_PACKAGES = listOf("com.android.phone", "com.android.mms.service")

        private fun authority(context: Context) = "${context.packageName}.mmsfile"

        /** A new, empty file's URI, readable and writable by the phone process. */
        fun newUri(context: Context): Uri {
            val name = UUID.randomUUID().toString()
            val uri =
                Uri
                    .Builder()
                    .scheme("content")
                    .authority(authority(context))
                    .appendPath(name)
                    .build()
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            for (pkg in PHONE_PACKAGES) {
                runCatching { context.grantUriPermission(pkg, uri, flags) }
                    .onFailure { Log.d(TAG, "Couldn't grant $pkg", it) }
            }
            return uri
        }

        fun readBytes(
            context: Context,
            uri: Uri,
        ): ByteArray? = fileFor(context, uri)?.takeIf { it.isFile }?.readBytes()

        fun delete(
            context: Context,
            uri: Uri,
        ) {
            fileFor(context, uri)?.delete()
            runCatching { context.revokeUriPermission(uri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
        }

        // Only our own authority and a bare file name: nothing outside cacheDir/mms.
        private fun fileFor(
            context: Context,
            uri: Uri,
        ): File? {
            val name = uri.lastPathSegment
            val valid =
                uri.authority == authority(context) &&
                    uri.pathSegments.size == 1 &&
                    !name.isNullOrBlank() &&
                    !name.contains('/') &&
                    !name.contains("..")
            if (!valid || name == null) return null
            val dir = File(context.cacheDir, DIR).apply { mkdirs() }
            return File(dir, name)
        }
    }
}
