package com.daylight.app

import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class DirectoryPicker(private val activity: AppCompatActivity) {
    private var callback: ((String?) -> Unit)? = null
    private val launcher: ActivityResultLauncher<Uri?>

    init {
        launcher = activity.registerForActivityResult(
            ActivityResultContracts.OpenDocumentTree()
        ) { uri ->
            handleResult(uri)
        }
    }

    private fun handleResult(uri: Uri?) {
        val cb = callback
        callback = null

        if (uri == null || cb == null) {
            cb?.invoke(null)
            return
        }

        // Take persistable permission
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        try {
            activity.contentResolver.takePersistableUriPermission(uri, flags)
        } catch (e: Exception) {
            // Permission may not be grantable, continue anyway
        }

        val path = getPathFromUri(uri)
        cb.invoke(path)
    }

    private fun getPathFromUri(uri: Uri): String? {
        return try {
            val docId = DocumentsContract.getTreeDocumentId(uri)
            val split = docId.split(":")

            if (split.size >= 2) {
                val type = split[0]
                val relativePath = split[1]

                when (type) {
                    "primary" -> "/storage/emulated/0/$relativePath"
                    else -> "/storage/$type/$relativePath"
                }
            } else {
                uri.toString()
            }
        } catch (e: Exception) {
            uri.toString()
        }
    }

    fun pick(cb: (String?) -> Unit) {
        callback = cb
        launcher.launch(null)
    }
}

class DirectoryPickerInterface(
    private val picker: DirectoryPicker,
    private val webView: WebView
) {
    @JavascriptInterface
    fun pickDirectory() {
        picker.pick { path ->
            val jsPath = path?.let { "\"$it\"" } ?: "null"
            webView.post {
                webView.evaluateJavascript(
                    "window.__DIRECTORY_PICKER_RESOLVE__($jsPath)",
                    null
                )
            }
        }
    }
}
