package com.singularitycrm.tracking

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

class LocationTrackingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LocationTrackingModule"

    @ReactMethod
    fun startTracking(token: String, apiBaseUrl: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, LocationTrackingService::class.java).apply {
                putExtra(LocationTrackingService.EXTRA_TOKEN, token)
                putExtra(LocationTrackingService.EXTRA_API_URL, apiBaseUrl)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            val intent = Intent(reactContext, LocationTrackingService::class.java)
            reactContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isTracking(promise: Promise) {
        // Always resolve — JS side tracks state via AsyncStorage
        promise.resolve(false)
    }
}
