import Foundation
import CoreLocation
import UserNotifications
import UIKit   // UIDevice — battery level attached to each fix

// ─── LocationTrackingModule ───────────────────────────────────────────────────
// Native iOS foreground + background location service.
// Mirrors the Android Kotlin LocationTrackingService behaviour.
//
// Permission flow (called from JS before startTracking):
//   requestPermission() → shows iOS "Allow location?" dialog → resolves "granted"/"denied"/"restricted"
//
// Background behaviour:
//   • App alive (FG/BG):  CLLocationManager + Timer → 30 s pings  ✓
//   • System-killed:      startMonitoringSignificantLocationChanges relaunches app  ✓
//   • User force-quit:    Apple blocks all background execution — best-effort only
//
// School Geofencing (user-benefit feature):
//   • updateGeofences([schools]) → registers CLCircularRegion for each assigned school
//   • didEnterRegion → local notification "You've arrived at [School]" + backend event
//   • didExitRegion  → local notification "Visit recorded: [X] min at [School]" + backend event
//   • Works in background / after system relaunch
//   • iOS limit: 20 regions max (handled by capping at 20)

@objc(LocationTrackingModule)
class LocationTrackingModule: NSObject {

    // MARK: – State

    private var locationManager: CLLocationManager?
    private var pingTimer: Timer?
    private var lastLocation: CLLocation?
    /// Rolling stationary state — reset on every startTracking.
    private var stationaryStreak = 0
    private var lastSentLocation: CLLocation?
    private var lastHeartbeatAt: Date?
    private var authToken: String?
    private var apiBaseUrl: String?

    // School entry timestamps — key = schoolId string
    private var entryTimes: [String: Date] = [:]

    // Pending permission promise — fulfilled by CLLocationManagerDelegate callback
    private var permissionResolve: RCTPromiseResolveBlock?
    private var permissionReject:  RCTPromiseRejectBlock?
    // Dedicated manager just for the permission request (separate lifecycle)
    private var permissionManager: CLLocationManager?

    private static let tokenKey  = "lt_auth_token"
    private static let urlKey    = "lt_api_url"
    private static let pingPathKey  = "lt_ping_path"
    private static let batchPathKey = "lt_batch_path"
    private static let seqKey       = "lt_ping_seq"
    private static let queueKey     = "lt_pending_pings"

    // ── On-device cleaning gates (mirrors the Android service exactly) ──────────────
    /// Accuracy ceiling. LOOSENED from 35 m, deliberately: with per-point snapping a poor fix
    /// became a confident wrong road, so a tight gate helped. A sequence-aware matcher inverts
    /// that — it is handed each point's accuracy as a matching radius and resolves an uncertain
    /// fix from its neighbours and the road network. What it cannot recover from is a STARVED
    /// trace, and in an urban canyon (accuracy 20–50 m) a 35 m gate discarded most of the day
    /// exactly where the route was hardest to infer.
    private static let maxAccuracyMetres: CLLocationAccuracy = 50
    /// A cached fix stamped "now" drags the route back to where the agent used to be.
    private static let maxFixAgeSeconds: TimeInterval = 30
    private static let stationarySpeedKmh: Double = 1.5
    private static let stationaryDisplacementM: CLLocationDistance = 20
    /// Three, not one: a slow fix at a traffic light is not a parked phone.
    private static let stationaryStreakLimit = 3
    private static let maxRegions = 20   // iOS hard limit for monitored regions

    /// How often a fix is sent while moving. 10 s, not 30 s: a matcher deduces the road path
    /// from the sequence of observations, and at 30 s / 40 km/h consecutive fixes are ~330 m
    /// apart — far enough that a turn or a choice between parallel roads is genuinely ambiguous.
    private static let movingIntervalSeconds: TimeInterval = 10
    /// While parked, a fix still goes out this often. It adds no distance (the server flags it
    /// stationary) but it keeps "agent is in a meeting" distinguishable from "phone died".
    private static let stationaryHeartbeatSeconds: TimeInterval = 300
    /// Cap the offline queue so a device left offline for days can't grow it without bound.
    private static let maxQueuedPings = 500

    // MARK: – Permission check (no dialog — just reads current status)

    /// Returns current location permission status WITHOUT showing any dialog.
    /// Use this on mount and on foreground restore to read existing status.
    /// Resolves with: "granted" | "whenInUse" | "denied" | "restricted" | "notDetermined"
    @objc
    func checkPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            switch CLLocationManager.authorizationStatus() {
            case .authorizedAlways:   resolve("granted")
            case .authorizedWhenInUse: resolve("whenInUse")
            case .denied:             resolve("denied")
            case .restricted:         resolve("restricted")
            case .notDetermined:      resolve("notDetermined")
            @unknown default:         resolve("denied")
            }
        }
    }

    // MARK: – Permission request (shows dialog when status is notDetermined)

    /// Shows the iOS location permission dialog ONLY when not yet decided.
    /// For already-decided status returns immediately without a dialog.
    /// Resolves with: "granted" | "whenInUse" | "denied" | "restricted"
    @objc
    func requestPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self else { resolve("denied"); return }

            let status = CLLocationManager.authorizationStatus()

            switch status {
            case .authorizedAlways:
                NSLog("[LocationTracking] Permission: already authorizedAlways")
                resolve("granted")
                return
            case .authorizedWhenInUse:
                NSLog("[LocationTracking] Permission: authorizedWhenInUse")
                resolve("whenInUse")
                return
            case .denied:
                NSLog("[LocationTracking] Permission: denied")
                resolve("denied")
                return
            case .restricted:
                NSLog("[LocationTracking] Permission: restricted")
                resolve("restricted")
                return
            case .notDetermined:
                NSLog("[LocationTracking] Permission: requesting for first time")
            @unknown default:
                resolve("denied")
                return
            }

            self.permissionResolve = resolve
            self.permissionReject  = reject

            let mgr = CLLocationManager()
            mgr.delegate = self
            self.permissionManager = mgr
            mgr.requestAlwaysAuthorization()
        }
    }

    // MARK: – Credentials

    /// Current access token. UserDefaults is authoritative: JS refreshes the token
    /// periodically and writes it here, whereas `authToken` is only a snapshot taken
    /// when tracking started. Preferring the snapshot is what left this module pinging
    /// (and posting geofence visits) with a long-expired token.
    private var currentToken: String? {
        UserDefaults.standard.string(forKey: LocationTrackingModule.tokenKey) ?? authToken
    }

    private var currentBaseUrl: String? {
        UserDefaults.standard.string(forKey: LocationTrackingModule.urlKey) ?? apiBaseUrl
    }

    /// Replaces the token used by the ping timer and the geofence handlers, without
    /// restarting tracking. Called by JS on login and after every token refresh.
    /// An empty token clears the stored credentials (logout).
    @objc
    func updateAuthToken(_ token: String,
                         apiBaseUrl url: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self else { resolve(false); return }

            if token.isEmpty {
                self.authToken = nil
                UserDefaults.standard.removeObject(forKey: LocationTrackingModule.tokenKey)
            } else {
                self.authToken  = token
                self.apiBaseUrl = url
                UserDefaults.standard.set(token, forKey: LocationTrackingModule.tokenKey)
                UserDefaults.standard.set(url,   forKey: LocationTrackingModule.urlKey)
            }
            resolve(true)
        }
    }

    // MARK: – Start / Stop

    /// `pingPath` / `batchPath` are what let one engine serve both B2B and B2C — capture,
    /// filtering and delivery are identical, only the endpoint differs. Empty values fall back
    /// to the B2B paths, so an older JS bundle calling the two-argument form is unaffected.
    @objc
    func startTracking(_ token: String,
                       apiBaseUrl url: String,
                       pingPath: String,
                       batchPath: String,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self else { resolve(false); return }

            self.authToken  = token
            self.apiBaseUrl = url
            UserDefaults.standard.set(token, forKey: LocationTrackingModule.tokenKey)
            UserDefaults.standard.set(url,   forKey: LocationTrackingModule.urlKey)
            UserDefaults.standard.set(pingPath.isEmpty ? "/tracking/ping" : pingPath,
                                      forKey: LocationTrackingModule.pingPathKey)
            UserDefaults.standard.set(batchPath.isEmpty ? "/tracking/ping/batch" : batchPath,
                                      forKey: LocationTrackingModule.batchPathKey)

            // A fresh start is a fresh day: never inherit the previous shift's motion state.
            // The sequence counter is NOT reset — see nextSeq().
            self.stationaryStreak = 0
            self.lastSentLocation = nil
            self.lastHeartbeatAt  = nil
            // Needed for the battery reading attached to each fix; harmless if already on.
            UIDevice.current.isBatteryMonitoringEnabled = true

            self.setupLocationManager()
            self.requestNotificationPermission()

            // Ping timer (.common mode keeps it alive during scroll)
            self.pingTimer?.invalidate()
            let timer = Timer(timeInterval: LocationTrackingModule.movingIntervalSeconds,
                              repeats: true) { [weak self] _ in
                self?.sendPing()
            }
            RunLoop.main.add(timer, forMode: .common)
            self.pingTimer = timer

            // First ping after 2 s so CLLocationManager can seed an initial fix
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                self?.sendPing()
            }

            NSLog("[LocationTracking] Started. Token present=%@", token.isEmpty ? "NO" : "YES")
            resolve(true)
        }
    }

    @objc
    func stopTracking(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self else { resolve(true); return }

            self.pingTimer?.invalidate()
            self.pingTimer = nil
            self.locationManager?.stopUpdatingLocation()
            self.locationManager?.stopMonitoringSignificantLocationChanges()

            // Stop all school geofence regions
            if let mgr = self.locationManager {
                for region in mgr.monitoredRegions {
                    mgr.stopMonitoring(for: region)
                }
            }
            self.locationManager = nil
            self.entryTimes.removeAll()

            UserDefaults.standard.removeObject(forKey: LocationTrackingModule.tokenKey)
            UserDefaults.standard.removeObject(forKey: LocationTrackingModule.urlKey)

            NSLog("[LocationTracking] Stopped.")
            resolve(true)
        }
    }

    // MARK: – School Geofences (user-benefit feature)

    /// Registers CLCircularRegion geofences for today's assigned schools.
    /// When the field officer enters or exits a school zone:
    ///   1. A local notification is shown (benefits the user — no manual check-in needed)
    ///   2. A geofence event is sent to the backend for visit log tracking
    ///
    /// schools: array of { schoolId, schoolName, latitude, longitude, radiusMetres }
    @objc
    func updateGeofences(_ schools: [[String: Any]],
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self, let mgr = self.locationManager else {
                resolve(0)
                return
            }

            // Remove existing school geofence regions
            for region in mgr.monitoredRegions where region is CLCircularRegion {
                mgr.stopMonitoring(for: region)
            }
            self.entryTimes.removeAll()

            // Register up to maxRegions schools (iOS hard limit)
            let toRegister = schools.prefix(LocationTrackingModule.maxRegions)
            var registered = 0

            for school in toRegister {
                guard
                    let schoolId  = school["schoolId"]  as? Int,
                    let lat       = school["latitude"]  as? Double,
                    let lng       = school["longitude"] as? Double,
                    let radius    = school["radiusMetres"] as? Double
                else { continue }

                let name = school["schoolName"] as? String ?? "School"
                // Persist name so didEnterRegion / didExitRegion can display it
                UserDefaults.standard.set(name, forKey: "geofence_name_\(schoolId)")

                let center  = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                let safeRadius = max(radius, 50)   // iOS min meaningful radius ~50m
                let region  = CLCircularRegion(
                    center: center,
                    radius: safeRadius,
                    identifier: "school_\(schoolId)"
                )
                region.notifyOnEntry = true
                region.notifyOnExit  = true
                mgr.startMonitoring(for: region)
                registered += 1

                NSLog("[Geofence] Registered: %@ (r=%.0fm)", name, safeRadius)
            }

            NSLog("[Geofence] %d school regions active", registered)
            resolve(registered)
        }
    }

    /// Stops all school geofence monitoring (call when tracking session ends).
    @objc
    func clearGeofences(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self, let mgr = self.locationManager else { resolve(true); return }
            for region in mgr.monitoredRegions where region is CLCircularRegion {
                mgr.stopMonitoring(for: region)
            }
            self.entryTimes.removeAll()
            NSLog("[Geofence] All regions cleared")
            resolve(true)
        }
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }

    // MARK: – Private setup

    private func setupLocationManager() {
        let mgr = CLLocationManager()
        mgr.delegate = self
        // Field-grade accuracy: BestForNavigation drives the GPS chip hardest (was
        // HundredMeters → fixes up to 100 m off). Every fix's own horizontalAccuracy travels
        // with it to the server and becomes the map matcher's search radius, so the gate below
        // only has to exclude the unusable — the algorithm weighs the rest.
        mgr.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        mgr.distanceFilter  = kCLDistanceFilterNone
        mgr.activityType    = .automotiveNavigation
        // Keep delivering updates in background (UIBackgroundModes:location in Info.plist)
        mgr.allowsBackgroundLocationUpdates    = true
        mgr.pausesLocationUpdatesAutomatically = false
        // The blue "your location is in use" pill. Not decoration and not optional in practice:
        // an app tracking a field agent's whole shift must show them it is doing so, and iOS
        // treats a hidden background tracker as a review issue. It also gives the agent a way to
        // notice the day is still running when they forget to end it.
        if #available(iOS 11.0, *) { mgr.showsBackgroundLocationIndicator = true }
        mgr.startUpdatingLocation()
        // Significant-change monitoring: lets iOS relaunch the app after a system kill
        mgr.startMonitoringSignificantLocationChanges()
        locationManager = mgr
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            NSLog("[Geofence] Notification permission: %@", granted ? "granted" : "denied")
        }
    }
}

// MARK: – CLLocationManagerDelegate

extension LocationTrackingModule: CLLocationManagerDelegate {

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard manager === permissionManager,
              let resolve = permissionResolve else { return }

        let status = manager.authorizationStatus
        permissionResolve = nil
        permissionReject  = nil
        permissionManager = nil

        switch status {
        case .authorizedAlways:
            NSLog("[LocationTracking] User granted: Always")
            resolve("granted")
        case .authorizedWhenInUse:
            NSLog("[LocationTracking] User granted: WhenInUse")
            resolve("whenInUse")
        case .denied:
            NSLog("[LocationTracking] User denied location")
            resolve("denied")
        case .restricted:
            NSLog("[LocationTracking] Location restricted")
            resolve("restricted")
        case .notDetermined:
            break
        @unknown default:
            resolve("denied")
        }
    }

    func locationManager(_ manager: CLLocationManager,
                         didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        let prev = lastLocation
        if prev == nil
            || (loc.horizontalAccuracy >= 0 && loc.horizontalAccuracy < (prev?.horizontalAccuracy ?? .greatestFiniteMagnitude))
            || loc.timestamp > (prev?.timestamp ?? .distantPast) {
            lastLocation = loc
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        NSLog("[LocationTracking] Location error: %@", error.localizedDescription)
    }

    // MARK: – Geofence enter

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circularRegion = region as? CLCircularRegion,
              circularRegion.identifier.hasPrefix("school_") else { return }

        let schoolIdStr = String(circularRegion.identifier.dropFirst("school_".count))
        entryTimes[schoolIdStr] = Date()

        let schoolName = schoolNameFromDefaults(schoolIdStr) ?? "your school"
        NSLog("[Geofence] Entered: %@ (%@)", schoolName, schoolIdStr)

        // Show local notification — benefits the field officer
        sendLocalNotification(
            identifier: "geofence_enter_\(schoolIdStr)",
            title: "Arrived at \(schoolName)",
            body: "You've entered the school zone. Your visit has been automatically started.",
            categoryId: "GEOFENCE_ARRIVE"
        )

        // Report entry event to backend
        let location = lastLocation ?? manager.location
        sendGeofenceEvent(
            schoolId:    Int(schoolIdStr) ?? 0,
            eventType:   "Enter",
            location:    location,
            center:      circularRegion.center,
            durationMin: nil
        )
    }

    // MARK: – Geofence exit

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard let circularRegion = region as? CLCircularRegion,
              circularRegion.identifier.hasPrefix("school_") else { return }

        let schoolIdStr = String(circularRegion.identifier.dropFirst("school_".count))
        let entryTime   = entryTimes.removeValue(forKey: schoolIdStr)

        let durationMin: Int? = entryTime.map { Int(Date().timeIntervalSince($0) / 60) }
        let schoolName = schoolNameFromDefaults(schoolIdStr) ?? "school"
        NSLog("[Geofence] Exited: %@ (%@) duration=%@min", schoolName, schoolIdStr,
              durationMin.map(String.init) ?? "?")

        let durationText = durationMin.map { "\($0) min" } ?? ""
        sendLocalNotification(
            identifier: "geofence_exit_\(schoolIdStr)",
            title: "Visit logged: \(schoolName)",
            body: durationText.isEmpty
                ? "Your visit at \(schoolName) has been recorded."
                : "Visit recorded — \(durationText) at \(schoolName).",
            categoryId: "GEOFENCE_DEPART"
        )

        let location = lastLocation ?? manager.location
        sendGeofenceEvent(
            schoolId:    Int(schoolIdStr) ?? 0,
            eventType:   "Exit",
            location:    location,
            center:      circularRegion.center,
            durationMin: durationMin
        )
    }

    func locationManager(_ manager: CLLocationManager,
                         monitoringDidFailFor region: CLRegion?,
                         withError error: Error) {
        NSLog("[Geofence] Monitoring failed for %@: %@",
              region?.identifier ?? "unknown", error.localizedDescription)
    }
}

// MARK: – HTTP ping

extension LocationTrackingModule {

    private func sendPing() {
        // Read per-ping so a token refreshed by JS is picked up immediately.
        let token   = currentToken
        let baseUrl = currentBaseUrl

        guard let token, let baseUrl else {
            NSLog("[LocationTracking] No token/url — skip ping"); return
        }
        guard let location = lastLocation ?? locationManager?.location else {
            NSLog("[LocationTracking] No location yet — skip ping"); return
        }

        // ── On-device cleaning gates. Identical to the Android service, deliberately: two
        //    platforms filtering differently would produce two different routes for one walk.

        // 1) Staleness — a cached fix stamped "now" teleports the route backwards then forwards.
        let age = -location.timestamp.timeIntervalSinceNow
        if age > Self.maxFixAgeSeconds {
            NSLog("[LocationTracking] Fix %.0fs old — skip ping", age); return
        }

        // 2) Accuracy — a poor fix snapped to a road becomes a confident wrong road.
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > Self.maxAccuracyMetres {
            NSLog("[LocationTracking] Low-accuracy fix %.0fm — skip ping", location.horizontalAccuracy); return
        }

        // 3) Stationary — a parked phone still wanders metres a minute; over a shift that is
        //    kilometres nobody walked. Only after three consecutive stationary checks, so a
        //    slow crawl in traffic still counts as travel. Past the streak the cadence drops to
        //    a heartbeat rather than stopping: silence is ambiguous, and "in a meeting" and
        //    "phone died" must not look identical in the data.
        let speedKmh = location.speed >= 0 ? location.speed * 3.6 : 0
        let movedM = lastSentLocation.map { location.distance(from: $0) } ?? .greatestFiniteMagnitude
        let now = Date()
        if speedKmh < Self.stationarySpeedKmh && movedM < Self.stationaryDisplacementM {
            stationaryStreak += 1
            if stationaryStreak >= Self.stationaryStreakLimit {
                let due = lastHeartbeatAt.map { now.timeIntervalSince($0) >= Self.stationaryHeartbeatSeconds } ?? true
                if !due {
                    // Still parked. Drain anything queued so a recovered network is not left
                    // waiting for the agent to start moving again.
                    flushQueue(token: token, baseUrl: baseUrl)
                    NSLog("[LocationTracking] Stationary (%dx) — suppressing ping", stationaryStreak); return
                }
                lastHeartbeatAt = now
                NSLog("[LocationTracking] Stationary heartbeat")
            }
        } else {
            stationaryStreak = 0
            lastHeartbeatAt = now
        }
        lastSentLocation = location

        let path = UserDefaults.standard.string(forKey: LocationTrackingModule.pingPathKey) ?? "/tracking/ping"
        guard let url = URL(string: "\(baseUrl)\(path)") else { return }

        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // iOS 15+ can tell us a location was simulated. Below that there is no signal, and
        // claiming false would be asserting something we do not know — but false is also the
        // only safe default, since the server treats true purely as grounds to invalidate.
        var simulated = false
        if #available(iOS 15.0, *) {
            simulated = location.sourceInformation?.isSimulatedBySoftware ?? false
        }

        var body: [String: Any] = [
            // Allocated once, before the first send attempt, and carried through every retry —
            // that is the whole point. Re-allocating on retry would make the retry look like a
            // new fix and defeat the deduplication it exists to enable.
            "seq":        nextSeq(),
            "latitude":   location.coordinate.latitude,
            "longitude":  location.coordinate.longitude,
            "recordedAt": fmt.string(from: location.timestamp),
            "provider":   "GPS",
            // Both tiers' spellings — the two APIs were built separately and each ignores
            // members it does not know, so one payload serves both without a translation layer.
            "isMocked":   simulated,   // B2B
            "isMock":     simulated,   // B2C
        ]
        body["accuracyMetres"] = location.horizontalAccuracy
        if location.speed  >= 0 { body["speedKmh"] = location.speed * 3.6 }
        if location.verticalAccuracy >= 0 {
            body["altitudeMetres"] = location.altitude   // B2B
            body["altitude"]       = location.altitude   // B2C
        }
        // course is negative when iOS cannot determine a heading (stationary); sending 0 there
        // would point the map's marker due north for no reason.
        if location.course >= 0 { body["bearing"] = location.course }

        // Battery: B2B stores a 0–1 fraction, B2C a 0–100 percent. -1 means unavailable.
        let battery = UIDevice.current.batteryLevel
        if battery >= 0 {
            body["batteryLevel"]   = Double(battery)                  // B2B, 0–1
            body["batteryPercent"] = Int((battery * 100).rounded())   // B2C, 0–100
        }

        // Anything undelivered goes first, so the route reaches the server in order.
        flushQueue(token: token, baseUrl: baseUrl)

        postJSON(to: url, body: body, token: token) { [weak self] statusCode, error in
            guard let self else { return }
            if error != nil || statusCode == 0 || statusCode == 401 || (500...599).contains(statusCode) {
                // Network failure, an expired token, or a server error. The fix is KEPT.
                //
                // This module previously logged the failure and dropped the fix. Android had an
                // offline queue and iOS did not, so the same drive through a dead zone measured
                // shorter on an iPhone than on an Android — a platform-shaped hole in the data
                // that no amount of algorithm work downstream could recover.
                //
                // Retrying is safe because the fix carries a sequence: if the server did commit
                // it and only the reply was lost, the retry is recognised as a duplicate rather
                // than counted as a second helping of distance.
                self.enqueue(body)
                NSLog("[LocationTracking] Ping failed (%d) — queued for retry", statusCode)
            } else if statusCode == 403 {
                NSLog("[LocationTracking] Ping → 403 (no active session) — dropping")
            } else {
                NSLog("[LocationTracking] Ping → %d | %.5f, %.5f",
                      statusCode,
                      location.coordinate.latitude,
                      location.coordinate.longitude)
            }
        }
    }

    // MARK: – Sequence numbers

    /// The next sequence number for this device.
    ///
    /// Monotonic and never reset, not even across days — a counter that restarts can collide
    /// with one the server already holds for the same session, and a collision is silently
    /// dropped as a duplicate, which loses a real fix. Uniqueness only has to hold within a
    /// session, so a forever-increasing counter is trivially safe.
    private func nextSeq() -> Int64 {
        objc_sync_enter(self)
        defer { objc_sync_exit(self) }
        let next = Int64(UserDefaults.standard.integer(forKey: Self.seqKey)) + 1
        UserDefaults.standard.set(Int(next), forKey: Self.seqKey)
        return next
    }

    // MARK: – Offline queue

    private func readQueue() -> [[String: Any]] {
        guard let data = UserDefaults.standard.data(forKey: Self.queueKey),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [] }
        return arr
    }

    private func writeQueue(_ queue: [[String: Any]]) {
        // Oldest-first eviction: a stale position matters less than a recent one.
        let trimmed = queue.count > Self.maxQueuedPings ? Array(queue.suffix(Self.maxQueuedPings)) : queue
        if let data = try? JSONSerialization.data(withJSONObject: trimmed) {
            UserDefaults.standard.set(data, forKey: Self.queueKey)
        }
    }

    private func enqueue(_ ping: [String: Any]) {
        objc_sync_enter(self)
        defer { objc_sync_exit(self) }
        var queue = readQueue()
        queue.append(ping)
        writeQueue(queue)
        NSLog("[LocationTracking] Queued ping. Pending=%d", queue.count)
    }

    /// Delivers queued fixes via the batch endpoint.
    ///
    /// Trimming is driven by the server's `acceptedThroughSeq`, not by the response code alone.
    /// A 200 says the request was handled; it does not say every fix in it was stored, and
    /// clearing the whole queue on a 200 is how a partially-processed batch silently loses its
    /// tail. Anything at or below the acknowledged sequence is durable and safe to drop;
    /// anything above stays for the next cycle, where deduplication makes the re-send free.
    private func flushQueue(token: String, baseUrl: String) {
        objc_sync_enter(self)
        let queue = readQueue()
        objc_sync_exit(self)
        guard !queue.isEmpty else { return }

        let path = UserDefaults.standard.string(forKey: Self.batchPathKey) ?? "/tracking/ping/batch"
        guard let url = URL(string: "\(baseUrl)\(path)") else { return }

        postJSONReturningBody(to: url, body: ["pings": queue], token: token) { [weak self] status, data in
            guard let self else { return }
            objc_sync_enter(self)
            defer { objc_sync_exit(self) }

            if (200...299).contains(status) {
                if let through = Self.acceptedThroughSeq(data) {
                    // Re-read rather than filtering the snapshot: fixes captured while the flush
                    // was in flight are already in the queue and must not be discarded with it.
                    // A row whose sequence cannot be read is KEPT — losing a fix is worse than
                    // re-sending one the server will recognise and drop.
                    let remaining = self.readQueue().filter {
                        guard let seq = ($0["seq"] as? NSNumber)?.int64Value else { return true }
                        return seq > through
                    }
                    self.writeQueue(remaining)
                    NSLog("[LocationTracking] Flushed through seq %lld; %d pending", through, remaining.count)
                } else {
                    self.writeQueue([])
                    NSLog("[LocationTracking] Flushed %d queued pings", queue.count)
                }
            } else if status == 403 {
                // Session is over — these will never be accepted, so stop carrying them.
                self.writeQueue([])
                NSLog("[LocationTracking] Batch → 403 — discarded %d queued pings", queue.count)
            } else {
                NSLog("[LocationTracking] Batch → %d — keeping %d pings queued", status, queue.count)
            }
        }
    }

    /// Pulls acceptedThroughSeq out of either tier's response envelope.
    private static func acceptedThroughSeq(_ data: Data?) -> Int64? {
        guard let data,
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let payload = root["data"] as? [String: Any],
              let value = payload["acceptedThroughSeq"] as? NSNumber
        else { return nil }
        return value.int64Value
    }
}

// MARK: – Geofence HTTP event

extension LocationTrackingModule {

    private func sendGeofenceEvent(schoolId: Int,
                                   eventType: String,
                                   location: CLLocation?,
                                   center: CLLocationCoordinate2D,
                                   durationMin: Int?) {

        // Read per-event: a school visit can fire days into a tracking session, long
        // after the token that started it has expired.
        let token   = currentToken
        let baseUrl = currentBaseUrl
        guard let token, let baseUrl,
              let url = URL(string: "\(baseUrl)/tracking/geofence-event") else { return }

        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let lat = location?.coordinate.latitude  ?? center.latitude
        let lng = location?.coordinate.longitude ?? center.longitude

        // Distance from school center
        let eventLoc  = CLLocation(latitude: lat, longitude: lng)
        let centerLoc = CLLocation(latitude: center.latitude, longitude: center.longitude)
        let distanceM = eventLoc.distance(from: centerLoc)

        var body: [String: Any] = [
            "schoolId":                 schoolId,
            "eventType":                eventType,
            "timestamp":                fmt.string(from: Date()),
            "latitude":                 lat,
            "longitude":                lng,
            "distanceFromCenterMeters": distanceM,
        ]
        if let d = durationMin { body["durationMinutes"] = d }

        postJSON(to: url, body: body, token: token) { statusCode, error in
            if let err = error {
                NSLog("[Geofence] Event POST error: %@", err.localizedDescription)
            } else {
                NSLog("[Geofence] Event POST → %d (%@ school %d)", statusCode, eventType, schoolId)
            }
        }
    }
}

// MARK: – Local notifications

extension LocationTrackingModule {

    private func sendLocalNotification(identifier: String,
                                       title: String,
                                       body: String,
                                       categoryId: String) {
        let content = UNMutableNotificationContent()
        content.title    = title
        content.body     = body
        content.sound    = .default
        content.categoryIdentifier = categoryId

        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: nil   // deliver immediately
        )
        UNUserNotificationCenter.current().add(request) { error in
            if let err = error {
                NSLog("[Geofence] Notification error: %@", err.localizedDescription)
            }
        }
    }
}

// MARK: – Shared HTTP helper

extension LocationTrackingModule {

    private func postJSON(to url: URL,
                          body: [String: Any],
                          token: String,
                          completion: @escaping (Int, Error?) -> Void) {
        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            completion(0, nil); return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.httpBody        = bodyData
        req.timeoutInterval = 15

        URLSession.shared.dataTask(with: req) { _, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            completion(status, error)
        }.resume()
    }

    /// Same request, but hands back the response body — the batch flush needs to read
    /// `acceptedThroughSeq` out of it to know what it may safely stop carrying.
    private func postJSONReturningBody(to url: URL,
                                       body: [String: Any],
                                       token: String,
                                       completion: @escaping (Int, Data?) -> Void) {
        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            completion(0, nil); return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.httpBody        = bodyData
        req.timeoutInterval = 30

        URLSession.shared.dataTask(with: req) { data, response, _ in
            completion((response as? HTTPURLResponse)?.statusCode ?? 0, data)
        }.resume()
    }

    /// Reads school name stored in UserDefaults by updateGeofences.
    private func schoolNameFromDefaults(_ schoolId: String) -> String? {
        return UserDefaults.standard.string(forKey: "geofence_name_\(schoolId)")
    }
}
