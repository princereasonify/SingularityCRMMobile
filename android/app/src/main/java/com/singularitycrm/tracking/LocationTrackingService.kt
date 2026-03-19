package com.singularitycrm.tracking

import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class LocationTrackingService : Service() {

    companion object {
        private const val TAG = "LocationTracking"
        const val CHANNEL_ID = "location_tracking_channel"
        const val NOTIFICATION_ID = 1001
        const val EXTRA_TOKEN = "auth_token"
        const val EXTRA_API_URL = "api_base_url"
        private const val PREFS_NAME = "LocationTrackingPrefs"
        private const val PING_INTERVAL_MS = 30_000L
    }

    private lateinit var locationManager: LocationManager
    private val handler = Handler(Looper.getMainLooper())
    private var pingRunnable: Runnable? = null
    private var lastLocation: Location? = null
    private var authToken: String? = null
    private var apiBaseUrl: String? = null

    private val locationListener = LocationListener { location ->
        // Keep the most accurate fix
        val prev = lastLocation
        if (prev == null || location.accuracy <= prev.accuracy) {
            lastLocation = location
        }
        Log.d(TAG, "Location: ${location.latitude}, ${location.longitude} acc=${location.accuracy}m")
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Persist token/url so service can restart itself after kill (START_STICKY)
        intent?.getStringExtra(EXTRA_TOKEN)?.let { token ->
            authToken = token
            prefs.edit().putString(EXTRA_TOKEN, token).apply()
        } ?: run {
            authToken = prefs.getString(EXTRA_TOKEN, null)
        }

        intent?.getStringExtra(EXTRA_API_URL)?.let { url ->
            apiBaseUrl = url
            prefs.edit().putString(EXTRA_API_URL, url).apply()
        } ?: run {
            apiBaseUrl = prefs.getString(EXTRA_API_URL, null)
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        startLocationUpdates()
        schedulePings()

        Log.d(TAG, "Service started. Token present=${authToken != null}, url=$apiBaseUrl")
        return START_STICKY // Restart automatically if killed by OS
    }

    override fun onDestroy() {
        super.onDestroy()
        stopPings()
        try { locationManager.removeUpdates(locationListener) } catch (_: Exception) {}
        Log.d(TAG, "Service destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─── Location ────────────────────────────────────────────────────────────────

    private fun startLocationUpdates() {
        try {
            // Network provider: fast, works indoors, low battery
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    10_000L, 0f, locationListener
                )
                locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                    ?.let { lastLocation = it }
            }
            // GPS provider: more accurate outdoors
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    10_000L, 0f, locationListener
                )
                locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?.let { gps ->
                        val prev = lastLocation
                        if (prev == null || gps.accuracy < prev.accuracy) lastLocation = gps
                    }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied: ${e.message}")
        }
    }

    // ─── Ping scheduler ──────────────────────────────────────────────────────────

    private fun schedulePings() {
        stopPings() // Clear any existing schedule
        pingRunnable = object : Runnable {
            override fun run() {
                sendPingAsync()
                handler.postDelayed(this, PING_INTERVAL_MS)
            }
        }
        handler.post(pingRunnable!!)
    }

    private fun stopPings() {
        pingRunnable?.let { handler.removeCallbacks(it) }
        pingRunnable = null
    }

    // ─── HTTP ping (runs on background thread) ────────────────────────────────────

    private fun sendPingAsync() {
        val token = authToken ?: return Unit.also { Log.w(TAG, "No token — skip ping") }
        val baseUrl = apiBaseUrl ?: return Unit.also { Log.w(TAG, "No API URL — skip ping") }
        val location = lastLocation ?: return Unit.also { Log.w(TAG, "No location yet — skip ping") }

        Thread {
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val body = JSONObject().apply {
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    if (location.hasAccuracy()) put("accuracyMetres", location.accuracy.toDouble())
                    if (location.hasSpeed()) put("speedKmh", location.speed * 3.6)
                    if (location.hasAltitude()) put("altitudeMetres", location.altitude)
                    put("recordedAt", sdf.format(Date(location.time)))
                    put("provider", "GPS")
                    put("isMocked", location.isFromMockProvider)
                }.toString()

                val url = URL("$baseUrl/tracking/ping")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.doOutput = true
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000

                OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(body) }

                val code = conn.responseCode
                Log.d(TAG, "Ping → $code | ${location.latitude}, ${location.longitude}")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Ping failed: ${e.message}")
            }
        }.start()
    }

    // ─── Notification ─────────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active while your day tracking is on"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Day Tracking Active")
            .setContentText("Sending location updates every 30 seconds")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
}
