package com.singularitycrm.tracking

import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

class LocationTrackingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LocationTrackingModule"

    /**
     * Overwrites the token the running service pings with.
     *
     * The service can outlive many access tokens (START_STICKY, stopWithTask=false).
     * It re-reads this value from SharedPreferences on every ping, so writing here is
     * enough to keep a long-running service authenticated — no restart required.
     * An empty token clears the stored credentials (logout).
     */
    @ReactMethod
    fun updateAuthToken(token: String, apiBaseUrl: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                LocationTrackingService.PREFS_NAME, Context.MODE_PRIVATE
            )
            val editor = prefs.edit()
            if (token.isEmpty()) {
                editor.remove(LocationTrackingService.EXTRA_TOKEN)
            } else {
                editor.putString(LocationTrackingService.EXTRA_TOKEN, token)
                editor.putString(LocationTrackingService.EXTRA_API_URL, apiBaseUrl)
            }
            editor.apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_TOKEN_ERROR", e.message, e)
        }
    }

    /**
     * Starts the shared foreground tracking engine for one tier.
     *
     * `pingPath` / `batchPath` are what make one engine serve both B2B and B2C — the capture,
     * filtering, queueing and restart behaviour are identical, only the endpoint differs. Blank
     * values fall back to the B2B paths inside the service, so an older JS bundle calling the
     * two-argument form keeps working unchanged.
     */
    @ReactMethod
    fun startTracking(token: String, apiBaseUrl: String, pingPath: String, batchPath: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, LocationTrackingService::class.java).apply {
                putExtra(LocationTrackingService.EXTRA_TOKEN, token)
                putExtra(LocationTrackingService.EXTRA_API_URL, apiBaseUrl)
                putExtra(LocationTrackingService.EXTRA_PING_PATH, pingPath)
                putExtra(LocationTrackingService.EXTRA_BATCH_PATH, batchPath)
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
        promise.resolve(LocationTrackingService.isRunning)
    }
}
