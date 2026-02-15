package com.daylight.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity

class StoragePermissionHelper(private val activity: AppCompatActivity) {

    fun hasAllFilesAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            // On older Android versions, the permission is granted via manifest
            true
        }
    }

    fun requestAllFilesAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:${activity.packageName}")
                activity.startActivity(intent)
            } catch (e: Exception) {
                // Fallback to general storage settings
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                activity.startActivity(intent)
            }
        }
    }
}

class StoragePermissionInterface(
    private val helper: StoragePermissionHelper,
    private val webView: WebView
) {
    @JavascriptInterface
    fun hasAllFilesAccess(): Boolean {
        return helper.hasAllFilesAccess()
    }

    @JavascriptInterface
    fun requestAllFilesAccess() {
        helper.requestAllFilesAccess()
    }
}
