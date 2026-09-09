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
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
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

        /**
         * Which tier's endpoints this session pings. One engine serves B2B and B2C — the only
         * thing that differs is the path, so JS supplies it at start rather than the app
         * carrying two near-identical foreground services that can drift apart.
         * Defaults keep the historical B2B behaviour for any caller that does not pass them.
         */
        const val EXTRA_PING_PATH = "ping_path"
        const val EXTRA_BATCH_PATH = "batch_path"
        const val PREFS_NAME = "LocationTrackingPrefs"
        private const val PENDING_PINGS_KEY = "pending_pings"
        private const val SEQ_KEY = "ping_seq"

        /**
         * How often a fix is sent while the agent is moving.
         *
         * Dropped from 30 s to 10 s, and that change is what most improves the measured distance.
         * A map matcher deduces the road path from the SEQUENCE of observations; at 30 s and
         * 40 km/h consecutive fixes are ~330 m apart, and over that span a turn, a roundabout or
         * a choice between two parallel roads is genuinely ambiguous — the algorithm is left
         * guessing, and the geometry between two fixes is a chord across whatever the road did.
         * At 10 s the spacing is ~110 m and the road path is essentially determined.
         *
         * The cost is three times the rows and three times the pings. Both are cheap; a
         * kilometre figure nobody trusts is not.
         */
        private const val MOVING_INTERVAL_MS = 10_000L

        /**
         * While parked, a fix is still sent this often even though it is suppressed from the
         * route. Not for distance — the server flags these as stationary and they add none — but
         * because silence is ambiguous. A shift that goes quiet at 14:00 could be an agent
         * sitting in a meeting or a phone that died, and without a heartbeat those look identical
         * in the data.
         */
        private const val STATIONARY_HEARTBEAT_MS = 300_000L

        /** How often the loop wakes to decide whether to send. */
        private const val TICK_MS = 10_000L

        /** Cap the offline queue so a device left offline for days can't grow it without bound. */
        private const val MAX_QUEUED_PINGS = 500

        /** Never send a fix older than this — a stale position corrupts the route. */
        private const val STALE_FIX_MS = 30_000L

        /**
         * On-device accuracy gate (metres).
         *
         * LOOSENED from 35 m, which is counter-intuitive and deliberate. With per-point snapping
         * a poor fix became a confident wrong road, so a tight gate helped. A sequence-aware
         * matcher inverts that: it is handed each point's accuracy as a matching radius and
         * resolves an uncertain fix from its neighbours and the road network. What it cannot
         * recover from is a STARVED trace — and in an urban canyon, where accuracy sits in the
         * 20–50 m band, a 35 m gate discarded most of the day exactly where the route was
         * hardest to infer. 50 m keeps the evidence and lets the algorithm weigh it.
         */
        private const val MAX_ACCURACY_METRES = 50f

        /** Below this the device is standing still, whatever the coordinates wobble by. */
        private const val STATIONARY_SPEED_KMH = 1.5

        /** Displacement under this, at low speed, is jitter rather than travel. */
        private const val STATIONARY_DISPLACEMENT_M = 20.0

        /**
         * Consecutive stationary checks before the route stops accumulating. Three, not one: a
         * single slow fix at a traffic light is not a parked phone, and suppressing on the first
         * would eat real crawling-traffic movement. A phone on a desk still wanders several
         * metres a minute — over an eight-hour shift that is kilometres nobody walked.
         */
        private const val STATIONARY_STREAK = 3

        /** A fix this much newer wins outright (Google's isBetterLocation heuristic). */
        private const val SIGNIFICANT_TIME_MS = 15_000L

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private val handler = Handler(Looper.getMainLooper())
    private var pingRunnable: Runnable? = null

    // Fused provider — the primary source. LocationManager stays as the fallback for devices
    // without Play Services, so tracking degrades rather than disappearing on them.
    private var fusedClient: FusedLocationProviderClient? = null
    private var fusedCallback: LocationCallback? = null
    private var legacyManager: LocationManager? = null

    /** Rolling motion state — reset whenever a day starts (onStartCommand). */
    private var stationaryStreak = 0
    private var lastSentLocation: Location? = null
    private var lastLocation: Location? = null
    private var lastHeartbeatAt = 0L

    // ─── Fix intake ───────────────────────────────────────────────────────────

    private fun onFix(location: Location) {
        // Accept the fix only when it's genuinely better than what we hold (Google's canonical
        // heuristic): a much newer fix wins, a much older one is ignored, and among
        // comparable-age fixes the more accurate one wins. Still applied under FLP because a
        // fused stream can interleave a coarse fix with a fine one.
        if (isBetterLocation(location, lastLocation)) lastLocation = location
    }

    private val legacyListener = LocationListener { onFix(it) }

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
        legacyManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Persist token/url so the service can restart itself after kill (START_STICKY).
        // Note the token is NOT cached in a field: JS refreshes it periodically and writes
        // the new value straight to these prefs, so every ping re-reads it (see currentToken()).
        intent?.getStringExtra(EXTRA_TOKEN)?.let { prefs.edit().putString(EXTRA_TOKEN, it).apply() }
        intent?.getStringExtra(EXTRA_PING_PATH)?.let { prefs.edit().putString(EXTRA_PING_PATH, it).apply() }
        intent?.getStringExtra(EXTRA_BATCH_PATH)?.let { prefs.edit().putString(EXTRA_BATCH_PATH, it).apply() }
        intent?.getStringExtra(EXTRA_API_URL)?.let { prefs.edit().putString(EXTRA_API_URL, it).apply() }

        // A fresh start command is a fresh day: never inherit the previous shift's motion state.
        // The sequence counter is NOT reset here — see nextSeq().
        stationaryStreak = 0
        lastSentLocation = null
        lastHeartbeatAt = 0L

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
        try { fusedCallback?.let { fusedClient?.removeLocationUpdates(it) } } catch (_: Exception) {}
        try { legacyManager?.removeUpdates(legacyListener) } catch (_: Exception) {}
        fusedCallback = null
        Log.d(TAG, "Service destroyed")
    }

    // ─── Credentials (always read fresh from prefs) ───────────────────────────────

    private fun prefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun currentToken(): String? = prefs().getString(EXTRA_TOKEN, null)?.takeIf { it.isNotEmpty() }

    /**
     * The next sequence number for this device.
     *
     * Monotonic and never reset, not even across days or reinstalls of the session — a number
     * that restarts can collide with one the server already holds for the same session, and a
     * collision is silently dropped as a duplicate, which loses a real fix. Uniqueness only has
     * to hold within a session, so a forever-increasing counter is trivially safe.
     *
     * This is the idempotency key. Without it the server cannot tell a retried offline batch from
     * genuine new travel, and a request that was committed but whose reply was lost had its whole
     * queue inserted a second time — the route then walked the same road twice and billed it.
     */
    @Synchronized
    private fun nextSeq(): Long {
        val next = prefs().getLong(SEQ_KEY, 0L) + 1L
        // commit(), not apply(): the number must be durable BEFORE it goes out on the wire. With
        // apply() a process death between the send and the async flush would hand the same
        // sequence to a different fix, and the server would drop one of them as a duplicate.
        prefs().edit().putLong(SEQ_KEY, next).commit()
        return next
    }

    /**
     * Battery as a 0–1 fraction, or null when it cannot be read. Diagnostic, never critical:
     * a shift that goes dark at 3% is a flat phone, not a tracking failure, and the two need
     * telling apart. Must never throw — a battery reading is not worth losing a location over.
     */
    private fun batteryFraction(): Double? = try {
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        if (pct in 0..100) pct / 100.0 else null
    } catch (e: Exception) {
        null
    }

    private fun currentBaseUrl(): String? = prefs().getString(EXTRA_API_URL, null)?.takeIf { it.isNotEmpty() }

    /** Tier paths, defaulting to B2B so an old caller behaves exactly as before. */
    private fun pingPath(): String = prefs().getString(EXTRA_PING_PATH, null)?.takeIf { it.isNotEmpty() } ?: "/tracking/ping"
    private fun batchPath(): String = prefs().getString(EXTRA_BATCH_PATH, null)?.takeIf { it.isNotEmpty() } ?: "/tracking/ping/batch"

    override fun onBind(intent: Intent?): IBinder? = null

    // ─── Location acquisition ────────────────────────────────────────────────────

    private fun startLocationUpdates() {
        if (startFusedUpdates()) return
        Log.w(TAG, "Play Services unavailable — falling back to raw LocationManager")
        startLegacyUpdates()
    }

    /**
     * Fused Location Provider: the platform's own fusion of GPS, Wi-Fi, cell and motion sensors.
     *
     * The service used to drive GPS_PROVIDER and NETWORK_PROVIDER directly and pick between them
     * with a hand-rolled heuristic. That works, but it competes with a fusion the platform does
     * far better — FLP has the sensor hints, the Wi-Fi/cell fingerprint database and the
     * duty-cycling that raw providers do not expose, and the gap is widest exactly where field
     * tracking is worst: indoors, in traffic and between tall buildings.
     */
    private fun startFusedUpdates(): Boolean {
        val available = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(this)
        if (available != ConnectionResult.SUCCESS) return false

        return try {
            val client = LocationServices.getFusedLocationProviderClient(this)
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, MOVING_INTERVAL_MS)
                // The floor on how fast a fix may arrive. Held at half the send interval so a
                // fresh fix is always waiting when the ping loop wakes, rather than the loop
                // sending whatever happened to be lying around from the previous cycle.
                .setMinUpdateIntervalMillis(MOVING_INTERVAL_MS / 2)
                // Small, not zero: below this the device is not travelling, and a displacement
                // floor is the cheapest way to stop a parked phone spinning up the GPS radio.
                .setMinUpdateDistanceMeters(5f)
                // Wait for a real fix rather than immediately handing back a coarse network one.
                .setWaitForAccurateLocation(true)
                .build()

            val callback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    // FLP can deliver several fixes at once after a doze window; take them in
                    // order so the "better location" comparison sees them chronologically.
                    result.locations.sortedBy { it.time }.forEach { onFix(it) }
                }
            }

            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            client.lastLocation.addOnSuccessListener { loc -> loc?.let { onFix(it) } }
            fusedClient = client
            fusedCallback = callback
            Log.d(TAG, "Fused location updates started (${MOVING_INTERVAL_MS}ms, high accuracy)")
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Fused provider unavailable: ${e.message}")
            false
        }
    }

    /** Raw-provider fallback for devices without Play Services. */
    private fun startLegacyUpdates() {
        val manager = legacyManager ?: return
        try {
            if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                manager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, MOVING_INTERVAL_MS, 0f, legacyListener
                )
                manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)?.let { onFix(it) }
            }
            if (manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                manager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, MOVING_INTERVAL_MS, 0f, legacyListener
                )
                manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { onFix(it) }
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
                handler.postDelayed(this, TICK_MS)
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

        // Staleness gate: a fix older than 30 s no longer reflects where the agent is, and one
        // stamped "now" would drag the route back to where they used to be and forward again.
        val ageMs = System.currentTimeMillis() - location.time
        if (ageMs > STALE_FIX_MS) return Unit.also { Log.w(TAG, "Fix ${ageMs}ms old — skip ping") }

        // Accuracy gate. Loose by design — see MAX_ACCURACY_METRES. The fix's own accuracy goes
        // out with it and becomes the matcher's search radius, so an uncertain point is weighed
        // rather than trusted.
        if (location.hasAccuracy() && location.accuracy > MAX_ACCURACY_METRES) {
            return Unit.also { Log.w(TAG, "Low-accuracy fix ${location.accuracy}m — skip ping") }
        }

        // Stationary handling. A parked phone must not accumulate distance, but it must also not
        // go silent: after the streak the cadence drops to a heartbeat rather than stopping, so
        // "parked" and "phone died" stay distinguishable in the data.
        val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else 0.0
        val movedM = lastSentLocation?.distanceTo(location)?.toDouble() ?: Double.MAX_VALUE
        val now = System.currentTimeMillis()
        if (speedKmh < STATIONARY_SPEED_KMH && movedM < STATIONARY_DISPLACEMENT_M) {
            stationaryStreak++
            if (stationaryStreak >= STATIONARY_STREAK) {
                if (now - lastHeartbeatAt < STATIONARY_HEARTBEAT_MS) {
                    // Still parked and the heartbeat isn't due. Drain anything queued so a
                    // recovered network isn't left waiting for the agent to move again.
                    currentToken()?.let { token -> Thread { flushQueue(baseUrl, token) }.start() }
                    return Unit.also { Log.d(TAG, "Stationary (${stationaryStreak}x) — suppressed") }
                }
                lastHeartbeatAt = now
                Log.d(TAG, "Stationary heartbeat")
            }
        } else {
            stationaryStreak = 0
            lastHeartbeatAt = now
        }
        lastSentLocation = location

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val ping = JSONObject().apply {
            // Allocated once, before the first send attempt, and carried through every retry —
            // that is the whole point. Re-allocating on retry would make the retry look like a
            // new fix and defeat the deduplication it exists to enable.
            put("seq", nextSeq())
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            if (location.hasAccuracy()) put("accuracyMetres", location.accuracy.toDouble())
            if (location.hasSpeed()) put("speedKmh", location.speed * 3.6)
            if (location.hasAltitude()) put("altitudeMetres", location.altitude)
            put("recordedAt", sdf.format(Date(location.time)))
            // Report the real provider (gps/network/fused) so the server's fraud/quality
            // engine can weight fixes correctly instead of assuming everything is GPS.
            put("provider", location.provider?.uppercase(Locale.US) ?: "FUSED")

            // Course over ground — lets the live map orient the marker instead of drifting a
            // featureless dot, and helps disambiguate which carriageway a fix belongs to.
            // hasBearing() is false when stationary; a bearing of 0 would read as due north.
            if (location.hasBearing()) put("bearing", location.bearing.toDouble())

            // Altitude and mock-provider under BOTH tiers' names. The two APIs were built
            // separately and spell these differently; each ignores members it does not know,
            // so emitting both is what lets one engine serve both without a translation layer.
            if (location.hasAltitude()) put("altitude", location.altitude)          // B2C
            put("isMocked", location.isFromMockProvider)                            // B2B
            put("isMock", location.isFromMockProvider)                              // B2C

            // Battery: B2B stores a 0–1 fraction, B2C a 0–100 percent. Same reason as above.
            batteryFraction()?.let {
                put("batteryLevel", it)                                             // B2B, 0–1
                put("batteryPercent", Math.round(it * 100).toInt())                 // B2C, 0–100
            }
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

            when (val code = postJson("$baseUrl${pingPath()}", token, ping.toString())) {
                in 200..299 -> Log.d(TAG, "Ping → $code | ${location.latitude}, ${location.longitude}")

                // Token expired/invalid. Keep the fix — the app will mint a new token on next
                // foreground and we'll drain the queue then. Dropping here is what lost data.
                401 -> {
                    Log.w(TAG, "Ping → 401 (stale token) — queueing for retry after refresh")
                    enqueuePing(ping)
                }

                // No active tracking session — the day is over; this fix is genuinely unwanted.
                403 -> Log.w(TAG, "Ping → 403 (no active session) — dropping")

                // Network failure or server error — retry later. Safe now that the fix carries a
                // sequence: if the server did commit it and only the reply was lost, the retry is
                // recognised as a duplicate rather than counted twice.
                -1, in 500..599 -> {
                    Log.w(TAG, "Ping → $code — queueing for retry")
                    enqueuePing(ping)
                }

                else -> Log.e(TAG, "Ping → $code — dropping (client error)")
            }
        }.start()
    }

    /** Returns the HTTP status and body, or status -1 when the request never completed. */
    private fun postJson(urlString: String, token: String, body: String): Int = postJsonWithBody(urlString, token, body).first

    private fun postJsonWithBody(urlString: String, token: String, body: String): Pair<Int, String?> =
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
            val text = try {
                (if (code in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() }
            } catch (_: Exception) { null }
            conn.disconnect()
            code to text
        } catch (e: Exception) {
            Log.e(TAG, "POST $urlString failed: ${e.message}")
            -1 to null
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

    /**
     * Delivers queued pings via the batch endpoint.
     *
     * Trimming is driven by the server's `acceptedThroughSeq` rather than by the response code
     * alone. A 200 says the request was handled; it does not say every fix in it was stored, and
     * clearing the whole queue on a 200 is how a partially-processed batch silently loses its
     * tail. Anything at or below the acknowledged sequence is durable and safe to drop; anything
     * above it stays for the next cycle, where the server's deduplication makes the re-send free.
     */
    @Synchronized
    private fun flushQueue(baseUrl: String, token: String) {
        val queue = readQueue()
        if (queue.length() == 0) return

        val body = JSONObject().put("pings", queue).toString()
        val (code, response) = postJsonWithBody("$baseUrl${batchPath()}", token, body)
        when {
            code in 200..299 -> {
                val through = acceptedThroughSeq(response)
                if (through == null) {
                    Log.d(TAG, "Flushed ${queue.length()} queued pings")
                    writeQueue(JSONArray())
                } else {
                    val remaining = JSONArray()
                    for (i in 0 until queue.length()) {
                        val item = queue.optJSONObject(i) ?: continue
                        if (item.optLong("seq", Long.MAX_VALUE) > through) remaining.put(item)
                    }
                    Log.d(TAG, "Flushed through seq $through; ${remaining.length()} still pending")
                    writeQueue(remaining)
                }
            }
            // Session is over — these will never be accepted, so stop carrying them.
            code == 403 -> {
                Log.w(TAG, "Batch → 403 (no active session) — discarding ${queue.length()} queued pings")
                writeQueue(JSONArray())
            }
            // 401 / 5xx / network: leave the queue intact and try again next cycle.
            else -> Log.w(TAG, "Batch → $code — keeping ${queue.length()} pings queued")
        }
    }

    /** Pulls acceptedThroughSeq out of either tier's response envelope. */
    private fun acceptedThroughSeq(body: String?): Long? = try {
        val data = body?.let { JSONObject(it) }?.optJSONObject("data")
        data?.takeIf { it.has("acceptedThroughSeq") && !it.isNull("acceptedThroughSeq") }
            ?.optLong("acceptedThroughSeq")
    } catch (_: Exception) {
        null
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
            .setContentText("Recording your route while your day is on")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
}
