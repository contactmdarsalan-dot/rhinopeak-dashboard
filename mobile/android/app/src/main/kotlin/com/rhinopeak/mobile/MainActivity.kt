package com.rhinopeak.mobile

import android.Manifest
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream

class MainActivity : FlutterActivity() {
    private var biometricResult: MethodChannel.Result? = null
    private var cameraResult: MethodChannel.Result? = null
    private var deepLinkChannel: MethodChannel? = null
    private var pushChannel: MethodChannel? = null
    private var initialLink: String? = null
    private var initialNotificationPayload: String? = null
    private var pendingCameraAfterPermission = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        initialLink = intent?.dataString
        initialNotificationPayload = intent?.getStringExtra("payload")
        configureBiometricChannel(flutterEngine)
        configureCameraChannel(flutterEngine)
        configurePushChannel(flutterEngine)
        configureDeepLinkChannel(flutterEngine)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val link = intent.dataString
        if (!link.isNullOrBlank()) {
            deepLinkChannel?.invokeMethod("linkOpened", link)
        }
        intent.getStringExtra("payload")?.let { payload ->
            pushChannel?.invokeMethod("notificationOpened", mapOf("payload" to payload))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == BIOMETRIC_REQUEST_CODE) {
            biometricResult?.success(resultCode == RESULT_OK)
            biometricResult = null
        }
        if (requestCode == CAMERA_REQUEST_CODE || requestCode == GALLERY_REQUEST_CODE) {
            handleImageResult(requestCode, resultCode, data)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE && pendingCameraAfterPermission) {
            pendingCameraAfterPermission = false
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                launchCameraIntent()
            } else {
                cameraResult?.error("camera_permission", "Camera permission is required.", null)
                cameraResult = null
            }
        }
    }

    private fun configureBiometricChannel(flutterEngine: FlutterEngine) {
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.rhinopeak.mobile/biometric")
            .setMethodCallHandler { call, result ->
                val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                when (call.method) {
                    "capability" -> result.success(
                        mapOf(
                            "available" to keyguard.isKeyguardSecure,
                            "enrolled" to keyguard.isKeyguardSecure,
                            "type" to "deviceCredential",
                        )
                    )
                    "authenticate" -> {
                        val reason = call.argument<String>("reason") ?: "Unlock RhinoPeak"
                        val intent = keyguard.createConfirmDeviceCredentialIntent("RhinoPeak", reason)
                        if (intent == null) {
                            result.success(false)
                            return@setMethodCallHandler
                        }
                        biometricResult = result
                        startActivityForResult(intent, BIOMETRIC_REQUEST_CODE)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun configureCameraChannel(flutterEngine: FlutterEngine) {
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.rhinopeak.mobile/camera")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "captureBillImage" -> {
                        val source = call.argument<String>("source") ?: "camera"
                        cameraResult = result
                        if (source == "gallery") {
                            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
                            startActivityForResult(intent, GALLERY_REQUEST_CODE)
                            return@setMethodCallHandler
                        }
                        if (
                            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                            checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
                        ) {
                            pendingCameraAfterPermission = true
                            requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST_CODE)
                            return@setMethodCallHandler
                        }
                        launchCameraIntent()
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun configurePushChannel(flutterEngine: FlutterEngine) {
        pushChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.rhinopeak.mobile/push")
        pushChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "initialize" -> {
                    createNotificationChannel()
                    initialNotificationPayload?.let { payload ->
                        pushChannel?.invokeMethod("notificationOpened", mapOf("payload" to payload))
                        initialNotificationPayload = null
                    }
                    result.success(null)
                }
                "requestPermission" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4101)
                    }
                    result.success(true)
                }
                "showLocalNotification" -> {
                    createNotificationChannel()
                    showLocalNotification(
                        call.argument<String>("title") ?: "RhinoPeak",
                        call.argument<String>("body") ?: "",
                        call.argument<String>("payload") ?: "{}",
                    )
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun configureDeepLinkChannel(flutterEngine: FlutterEngine) {
        deepLinkChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.rhinopeak.mobile/deep_links")
        deepLinkChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "initialLink" -> {
                    result.success(initialLink)
                    initialLink = null
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun handleImageResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val result = cameraResult ?: return
        cameraResult = null
        if (resultCode != RESULT_OK) {
            result.success(null)
            return
        }

        try {
            val bytes = if (requestCode == GALLERY_REQUEST_CODE) {
                val uri = data?.data ?: throw IllegalArgumentException("No image selected")
                contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: throw IllegalArgumentException("Could not read selected image")
            } else {
                val bitmap = data?.extras?.get("data") as? Bitmap
                    ?: throw IllegalArgumentException("No camera image returned")
                ByteArrayOutputStream().use { output ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)
                    output.toByteArray()
                }
            }
            val mimeType = if (requestCode == GALLERY_REQUEST_CODE) {
                data?.data?.let { contentResolver.getType(it) } ?: "image/jpeg"
            } else {
                "image/jpeg"
            }
            val extension = if (mimeType.contains("png")) "png" else "jpg"
            result.success(
                mapOf(
                    "fileName" to "bill-${System.currentTimeMillis()}.$extension",
                    "mimeType" to mimeType,
                    "dataUrl" to "data:$mimeType;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}",
                    "size" to bytes.size,
                )
            )
        } catch (error: Exception) {
            result.error("image_capture_failed", error.message, null)
        }
    }

    private fun launchCameraIntent() {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        startActivityForResult(intent, CAMERA_REQUEST_CODE)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "RhinoPeak Alerts",
            NotificationManager.IMPORTANCE_DEFAULT,
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun showLocalNotification(title: String, body: String, payload: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("rhinopeak://notifications")
            putExtra("payload", payload)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        val notification = builder
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        private const val BIOMETRIC_REQUEST_CODE = 4200
        private const val CAMERA_REQUEST_CODE = 4201
        private const val GALLERY_REQUEST_CODE = 4202
        private const val CAMERA_PERMISSION_REQUEST_CODE = 4203
        private const val CHANNEL_ID = "rhinopeak_alerts"
    }
}
