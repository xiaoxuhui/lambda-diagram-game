package com.xiaoxuhui.lambda

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.File

/** 离线容器：原生只负责系统文件选择与保存，业务使用完整网页。 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = filePathCallback ?: return@registerForActivityResult
        filePathCallback = null
        val data = result.data
        callback.onReceiveValue(when {
            result.resultCode != RESULT_OK || data == null -> null
            data.clipData != null -> data.clipData!!.let { clip -> Array(clip.itemCount) { clip.getItemAt(it).uri } }
            data.data != null -> arrayOf(data.data!!)
            else -> null
        })
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = buildWebView(); setContentView(webView)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.updatePadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) webView.loadUrl(PAGE_URL)
    }
    @SuppressLint("SetJavaScriptEnabled")
    private fun buildWebView(): WebView {
        val view = WebView(this)
        view.setBackgroundColor(Color.parseColor("#F5F4EF")); view.overScrollMode = View.OVER_SCROLL_NEVER
        view.isVerticalScrollBarEnabled = false
        view.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true
            allowFileAccess = false
            // 系统选择器授权的 content URI 用于 JSON 导入。
            allowContentAccess = true
            setSupportZoom(false); builtInZoomControls = false; displayZoomControls = false
            mediaPlaybackRequiresUserGesture = true; cacheMode = WebSettings.LOAD_DEFAULT; textZoom = 100
        }
        val loader = WebViewAssetLoader.Builder().setDomain(ASSET_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        view.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                return loader.shouldInterceptRequest(request.url)
                    ?: WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "https" && url.host == ASSET_DOMAIN && url.path == "/assets/$ASSET_FILE") return false
                if (url.scheme == "https" || url.scheme == "http") runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                return true
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(webView: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                filePathCallback?.onReceiveValue(null); filePathCallback = callback
                try { fileChooserLauncher.launch(params.createIntent()) }
                catch (_: Exception) { filePathCallback = null; callback.onReceiveValue(null) }
                return true
            }
        }
        view.addJavascriptInterface(Bridge(), "LambdaAndroid"); return view
    }
    override fun onPause() {
        webView.evaluateJavascript("window.dispatchEvent(new Event('pagehide'));", null)
        webView.onPause(); super.onPause()
    }
    override fun onResume() { super.onResume(); if (::webView.isInitialized) webView.onResume() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); webView.saveState(outState) }
    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null); filePathCallback = null
        webView.removeJavascriptInterface("LambdaAndroid"); webView.destroy(); super.onDestroy()
    }
    private inner class Bridge {
        // JavascriptInterface runs on WebView's bridge thread, not the UI thread.
        @JavascriptInterface
        fun saveFileConfirmed(name: String, content: String, requestedMime: String): Boolean {
            return try {
                require(requestedMime == "application/json") { "备份必须是 JSON 存档" }
                val destination = writeToDownloads(sanitizeName(name), content, requestedMime)
                runOnUiThread { Toast.makeText(this@MainActivity, "已保存到「$destination」", Toast.LENGTH_LONG).show() }
                true
            } catch (error: Exception) {
                runOnUiThread { Toast.makeText(this@MainActivity, "保存失败：${error.message ?: "未知错误"}", Toast.LENGTH_LONG).show() }
                false
            }
        }
        @JavascriptInterface
        fun saveFile(name: String, content: String, requestedMime: String) {
            val mime = when (requestedMime) { "image/svg+xml" -> requestedMime; "application/json" -> requestedMime; else -> "text/plain" }
            Thread {
                val message = try { "已保存到「${writeToDownloads(sanitizeName(name), content, mime)}」" }
                catch (error: Exception) { "保存失败：${error.message ?: "未知错误"}" }
                runOnUiThread { Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show() }
            }.start()
        }
    }
    private fun writeToDownloads(name: String, content: String, mime: String): String {
        val bytes = content.toByteArray(Charsets.UTF_8)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name); put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("无法创建下载文件")
            try {
                resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("无法写入下载文件")
                values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0); resolver.update(uri, values, null, null)
            } catch (error: Exception) { resolver.delete(uri, null, null); throw error }
            return "下载/$name"
        }
        val directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
        directory.mkdirs(); File(directory, name).writeBytes(bytes); return "${directory.absolutePath}/$name"
    }
    private fun sanitizeName(name: String): String {
        val cleaned = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
        return if (cleaned.isEmpty() || cleaned == "." || cleaned == "..") "lambda-lab-export.json" else cleaned.take(120)
    }
    companion object {
        private const val ASSET_DOMAIN = "appassets.androidplatform.net"
        private const val ASSET_FILE = "lambda-lab.html"
        private const val PAGE_URL = "https://$ASSET_DOMAIN/assets/$ASSET_FILE"
    }
}
