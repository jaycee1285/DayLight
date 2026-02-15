package com.daylight.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView

class MainActivity : TauriActivity() {
  private lateinit var directoryPicker: DirectoryPicker
  private lateinit var storagePermissionHelper: StoragePermissionHelper

  override fun onCreate(savedInstanceState: Bundle?) {
    directoryPicker = DirectoryPicker(this)
    storagePermissionHelper = StoragePermissionHelper(this)
    super.onCreate(savedInstanceState)
  }

  @SuppressLint("JavascriptInterface")
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(
      DirectoryPickerInterface(directoryPicker, webView),
      "AndroidDirectoryPicker"
    )
    webView.addJavascriptInterface(
      StoragePermissionInterface(storagePermissionHelper, webView),
      "AndroidStoragePermission"
    )
  }
}
