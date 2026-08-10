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
import org.json.JSONArray
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
        const val PREFS_NAME = "LocationTrackingPrefs"
        private const val PENDING_PINGS_KEY = "pending_pings"
        private const val PING_INTERVAL_MS = 30_000L

        /** Cap the offline queue so a device left offline for days can't grow it without bound. */
        private const val MAX_QUEUED_PINGS = 500

        /** Never send a fix older than this — a stale position corrupts the route. */
        private const val STALE_FIX_MS = 30_000L

        /** On-device accuracy gate (metres); mirrors the server's 75 m gate so poor
         *  WiFi/cell fixes never enter the route. */
        private const val MAX_ACCURACY_METRES = 75f

        /** A fix this much newer wins outright (Google's isBetterLocation heuristic). */
        private const val SIGNIFICANT_TIME_MS = 15_000L

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private lateinit var locationManager: LocationManager
    private val handler = Handler(Looper.getMainLooper())
    private var pingRunnable: Runnable? = null
    private var lastLocation: Location? = null

    private val locationListener = LocationListener { location ->
        // Accept the fix only when it's genuinely better than what we hold (Google's
        // canonical heuristic): a much newer fix wins, a much older one is ignored,
        // and among comparable-age fixes the more accurate one wins. This stops an
        // optimistic NETWORK fix from displacing a real GPS fix.
        if (isBetterLocation(location, lastLocation)) {
            lastLocation = location
        }
        Log.d(TAG, "Location: ${location.latitude}, ${location.longitude} acc=${location.accuracy}m provider=${location.provider}")
    }

    /** Trimmed form of Google's isBetterLocation() — decides whether [candidate] should
     *  replace the fix we're currently holding. */
    private fun isBetterLocation(candidate: Location, current: Location?): Boolean {
        if (current == null) return true
        val timeDelta = candidate.time - current.time
        if (timeDelta > SIGNIFICANT_TIME_MS) return true    // much newer → take it
        if (timeDelta < -SIGNIFICANT_TIME_MS) return false  // much older → keep current
        val accuracyDelta = candidate.accuracy - current.accuracy
        val isNewer = timeDelta > 0
        val isFromSameProvider = candidate.provider == current.provider
        return when {
            accuracyDelta < 0 -> true                                  // strictly more accurate
            isNewer && accuracyDelta <= 50f -> true                    // newer and not much worse
            isNewer && isFromSameProvider && accuracyDelta <= 100f -> true
            else -> false
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Persist token/url so the service can restart itself after kill (START_STICKY).
        // Note the token is NOT cached in a field: JS refreshes it periodically and writes
        // the new value straight to these prefs, so every ping re-reads it (see currentToken()).
        intent?.getStringExtra(EXTRA_TOKEN)?.let { token ->
            prefs.edit().putString(EXTRA_TOKEN, token).apply()
        }
        intent?.getStringExtra(EXTRA_API_URL)?.let { url ->
            prefs.edit().putString(EXTRA_API_URL, url).apply()
        }

        isRunning = true
        startForeground(NOTIFICATION_ID, buildNotification())
        startLocationUpdates()
        schedulePings()

        Log.d(TAG, "Service started. Token present=${currentToken() != null}, url=${currentBaseUrl()}")
        return START_STICKY // Restart automatically if killed by OS
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        stopPings()
        try { locationManager.removeUpdates(locationListener) } catch (_: Exception) {}
        Log.d(TAG, "Service destroyed")
    }

    // ─── Credentials (always read fresh from prefs) ───────────────────────────────

    private fun prefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun currentToken(): String? = prefs().getString(EXTRA_TOKEN, null)?.takeIf { it.isNotEmpty() }

    private fun currentBaseUrl(): String? = prefs().getString(EXTRA_API_URL, null)?.takeIf { it.isNotEmpty() }

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
        val baseUrl = currentBaseUrl() ?: return Unit.also { Log.w(TAG, "No API URL — skip ping") }
        val location = lastLocation ?: return Unit.also { Log.w(TAG, "No location yet — skip ping") }

        // Staleness gate: a fix older than 30 s no longer reflects where the agent is.
        val ageMs = System.currentTimeMillis() - location.time
        if (ageMs > STALE_FIX_MS) return Unit.also { Log.w(TAG, "Fix ${ageMs}ms old — skip ping") }

        // Accuracy gate: drop poor fixes on-device (the server gates identically at 75 m).
        if (location.hasAccuracy() && location.accuracy > MAX_ACCURACY_METRES) {
            return Unit.also { Log.w(TAG, "Low-accuracy fix ${location.accuracy}m — skip ping") }
        }

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val ping = JSONObject().apply {
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            if (location.hasAccuracy()) put("accuracyMetres", location.accuracy.toDouble())
            if (location.hasSpeed()) put("speedKmh", location.speed * 3.6)
            if (location.hasAltitude()) put("altitudeMetres", location.altitude)
            put("recordedAt", sdf.format(Date(location.time)))
            // Report the real provider (gps/network/fused) so the server's fraud/quality
            // engine can weight fixes correctly instead of assuming everything is GPS.
            put("provider", location.provider?.uppercase(Locale.US) ?: "GPS")
            put("isMocked", location.isFromMockProvider)
        }

        Thread {
            // Re-read the token per ping. JS rotates it in the background and writes the new
            // value to prefs; caching it in a field is what used to leave this service pinging
            // with a long-dead token after the old one expired.
            val token = currentToken()
            if (token == null) {
                Log.w(TAG, "No token — queueing ping until the app refreshes it")
                enqueuePing(ping)
                return@Thread
            }

            // Anything we couldn't deliver earlier goes first, so the route stays in order.
            flushQueue(baseUrl, token)

            when (val code = postJson("$baseUrl/tracking/ping", token, ping.toString())) {
                in 200..299 -> Log.d(TAG, "Ping → $code | ${location.latitude}, ${location.longitude}")

                // Token expired/invalid. Keep the fix — the app will mint a new token on next
                // foreground and we'll drain the queue then. Dropping here is what lost data.
                401 -> {
                    Log.w(TAG, "Ping → 401 (stale token) — queueing for retry after refresh")
                    enqueuePing(ping)
                }

                // No active tracking session — the day is over; this fix is genuinely unwanted.
                403 -> Log.w(TAG, "Ping → 403 (no active session) — dropping")

                // Network failure or server error — retry later.
                -1, in 500..599 -> {
                    Log.w(TAG, "Ping → $code — queueing for retry")
                    enqueuePing(ping)
                }

                else -> Log.e(TAG, "Ping → $code — dropping (client error)")
            }
        }.start()
    }

    /** Returns the HTTP status, or -1 when the request never completed. */
    private fun postJson(urlString: String, token: String, body: String): Int =
        try {
            val conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                doOutput = true
                connectTimeout = 15_000
                readTimeout = 15_000
            }
            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(body) }
            val code = conn.responseCode
            conn.disconnect()
            code
        } catch (e: Exception) {
            Log.e(TAG, "POST $urlString failed: ${e.message}")
            -1
        }

    // ─── Offline queue ────────────────────────────────────────────────────────────

    private fun readQueue(): JSONArray =
        try { JSONArray(prefs().getString(PENDING_PINGS_KEY, "[]")) } catch (_: Exception) { JSONArray() }

    private fun writeQueue(queue: JSONArray) {
        prefs().edit().putString(PENDING_PINGS_KEY, queue.toString()).apply()
    }

    @Synchronized
    private fun enqueuePing(ping: JSONObject) {
        val queue = readQueue()
        queue.put(ping)

        // Oldest-first eviction: a stale position matters less than a recent one.
        val trimmed = if (queue.length() > MAX_QUEUED_PINGS) {
            JSONArray().also { out ->
                for (i in (queue.length() - MAX_QUEUED_PINGS) until queue.length()) out.put(queue.get(i))
            }
        } else queue

        writeQueue(trimmed)
        Log.d(TAG, "Queued ping. Pending=${trimmed.length()}")
    }

    /** Delivers queued pings via the batch endpoint. Keeps them on failure. */
    @Synchronized
    private fun flushQueue(baseUrl: String, token: String) {
        val queue = readQueue()
        if (queue.length() == 0) return

        val body = JSONObject().put("pings", queue).toString()
        when (val code = postJson("$baseUrl/tracking/ping/batch", token, body)) {
            in 200..299 -> {
                Log.d(TAG, "Flushed ${queue.length()} queued pings")
                writeQueue(JSONArray())
            }
            // Session is over — these will never be accepted, so stop carrying them.
            403 -> {
                Log.w(TAG, "Batch → 403 (no active session) — discarding ${queue.length()} queued pings")
                writeQueue(JSONArray())
            }
            // 401 / 5xx / network: leave the queue intact and try again next cycle.
            else -> Log.w(TAG, "Batch → $code — keeping ${queue.length()} pings queued")
        }
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
