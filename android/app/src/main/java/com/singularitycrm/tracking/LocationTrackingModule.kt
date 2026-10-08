package com.singularitycrm.tracking

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import java.util.concurrent.atomic.AtomicBoolean

class LocationTrackingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LocationTrackingModule"

    companion object {
        /** End Day must never hang on a dead network; after this the flush is abandoned (the
         *  queue stays intact for the next flush) and JS proceeds. */
        private const val FLUSH_TIMEOUT_MS = 10_000L
    }

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

    /**
     * Drains the native offline queue to the tier's batch endpoint NOW, using the service's own
     * flush (same trimming against `acceptedThroughSeq`, same lock). Called by JS on End Day
     * BEFORE the session is closed — the server freezes the day's totals at end-day, so a fix
     * still sitting on the phone afterwards would never count.
     *
     * Resolves true when nothing is left queued, false on failure or timeout. Never rejects:
     * End Day must proceed regardless. Runs off the JS/main thread; the HTTP call can take up to
     * the connection timeouts, so a [FLUSH_TIMEOUT_MS] guard resolves false first if needed (the
     * worker keeps going in the background and still trims the queue correctly when it lands).
     */
    @ReactMethod
    fun flushQueue(promise: Promise) {
        val settled = AtomicBoolean(false)
        val handler = Handler(Looper.getMainLooper())
        val timeout = Runnable {
            if (settled.compareAndSet(false, true)) promise.resolve(false)
        }
        handler.postDelayed(timeout, FLUSH_TIMEOUT_MS)
        try {
            Thread {
                val ok = LocationTrackingService.flushStoredQueue(reactContext)
                if (settled.compareAndSet(false, true)) {
                    handler.removeCallbacks(timeout)
                    promise.resolve(ok)
                }
            }.start()
        } catch (e: Exception) {
            if (settled.compareAndSet(false, true)) {
                handler.removeCallbacks(timeout)
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun isTracking(promise: Promise) {
        promise.resolve(LocationTrackingService.isRunning)
    }
}
