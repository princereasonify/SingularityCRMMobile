import Foundation
import CoreLocation
import UserNotifications

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
    private static let maxRegions = 20   // iOS hard limit for monitored regions

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

    // MARK: – Start / Stop

    @objc
    func startTracking(_ token: String,
                       apiBaseUrl url: String,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async { [weak self] in
            guard let self else { resolve(false); return }

            self.authToken  = token
            self.apiBaseUrl = url
            UserDefaults.standard.set(token, forKey: LocationTrackingModule.tokenKey)
            UserDefaults.standard.set(url,   forKey: LocationTrackingModule.urlKey)

            self.setupLocationManager()
            self.requestNotificationPermission()

            // 30 s ping timer (.common mode keeps it alive during scroll)
            self.pingTimer?.invalidate()
            let timer = Timer(timeInterval: 30, repeats: true) { [weak self] _ in
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
        mgr.desiredAccuracy = kCLLocationAccuracyHundredMeters
        mgr.distanceFilter  = kCLDistanceFilterNone
        // Keep delivering updates in background (UIBackgroundModes:location in Info.plist)
        mgr.allowsBackgroundLocationUpdates    = true
        mgr.pausesLocationUpdatesAutomatically = false
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
        let token   = authToken   ?? UserDefaults.standard.string(forKey: LocationTrackingModule.tokenKey)
        let baseUrl = apiBaseUrl  ?? UserDefaults.standard.string(forKey: LocationTrackingModule.urlKey)

        guard let token, let baseUrl else {
            NSLog("[LocationTracking] No token/url — skip ping"); return
        }
        guard let location = lastLocation ?? locationManager?.location else {
            NSLog("[LocationTracking] No location yet — skip ping"); return
        }
        guard let url = URL(string: "\(baseUrl)/tracking/ping") else { return }

        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var body: [String: Any] = [
            "latitude":   location.coordinate.latitude,
            "longitude":  location.coordinate.longitude,
            "recordedAt": fmt.string(from: location.timestamp),
            "provider":   "GPS",
            "isMocked":   false,
        ]
        if location.horizontalAccuracy >= 0 { body["accuracyMetres"] = location.horizontalAccuracy }
        if location.speed             >= 0 { body["speedKmh"]       = location.speed * 3.6 }
        if location.verticalAccuracy  >= 0 { body["altitudeMetres"] = location.altitude }

        postJSON(to: url, body: body, token: token) { statusCode, error in
            if let err = error {
                NSLog("[LocationTracking] Ping error: %@", err.localizedDescription)
            } else {
                NSLog("[LocationTracking] Ping → %d | %.5f, %.5f",
                      statusCode,
                      location.coordinate.latitude,
                      location.coordinate.longitude)
            }
        }
    }
}

// MARK: – Geofence HTTP event

extension LocationTrackingModule {

    private func sendGeofenceEvent(schoolId: Int,
                                   eventType: String,
                                   location: CLLocation?,
                                   center: CLLocationCoordinate2D,
                                   durationMin: Int?) {

        let token   = authToken   ?? UserDefaults.standard.string(forKey: LocationTrackingModule.tokenKey)
        let baseUrl = apiBaseUrl  ?? UserDefaults.standard.string(forKey: LocationTrackingModule.urlKey)
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

    /// Reads school name stored in UserDefaults by updateGeofences.
    private func schoolNameFromDefaults(_ schoolId: String) -> String? {
        return UserDefaults.standard.string(forKey: "geofence_name_\(schoolId)")
    }
}
