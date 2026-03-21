import Foundation
import CoreLocation

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

@objc(LocationTrackingModule)
class LocationTrackingModule: NSObject {

    // MARK: – State

    private var locationManager: CLLocationManager?
    private var pingTimer: Timer?
    private var lastLocation: CLLocation?
    private var authToken: String?
    private var apiBaseUrl: String?

    // Pending permission promise — fulfilled by CLLocationManagerDelegate callback
    private var permissionResolve: RCTPromiseResolveBlock?
    private var permissionReject:  RCTPromiseRejectBlock?
    // Dedicated manager just for the permission request (separate lifecycle)
    private var permissionManager: CLLocationManager?

    private static let tokenKey = "lt_auth_token"
    private static let urlKey   = "lt_api_url"

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

            // Already decided — return immediately without showing dialog again
            switch status {
            case .authorizedAlways:
                NSLog("[LocationTracking] Permission: already authorizedAlways")
                resolve("granted")
                return
            case .authorizedWhenInUse:
                // Already permitted for when-in-use — return immediately, don't re-prompt.
                // JS side will suggest opening Settings to upgrade if needed.
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

            // Store callbacks — delegate fires when user responds
            self.permissionResolve = resolve
            self.permissionReject  = reject

            let mgr = CLLocationManager()
            mgr.delegate = self
            self.permissionManager = mgr
            mgr.requestAlwaysAuthorization()   // shows the system dialog
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
            self.locationManager = nil

            UserDefaults.standard.removeObject(forKey: LocationTrackingModule.tokenKey)
            UserDefaults.standard.removeObject(forKey: LocationTrackingModule.urlKey)

            NSLog("[LocationTracking] Stopped.")
            resolve(true)
        }
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }

    // MARK: – Private setup

    private func setupLocationManager() {
        let mgr = CLLocationManager()
        mgr.delegate = self
        mgr.desiredAccuracy = kCLLocationAccuracyHundredMeters // cell/WiFi — fast & low battery
        mgr.distanceFilter  = kCLDistanceFilterNone
        // Keep delivering updates in background (UIBackgroundModes:location in Info.plist)
        mgr.allowsBackgroundLocationUpdates    = true
        mgr.pausesLocationUpdatesAutomatically = false
        mgr.startUpdatingLocation()
        // Significant-change monitoring: lets iOS relaunch the app after a system kill
        mgr.startMonitoringSignificantLocationChanges()
        locationManager = mgr
    }
}

// MARK: – CLLocationManagerDelegate

extension LocationTrackingModule: CLLocationManagerDelegate {

    // Called when user responds to the permission dialog (or status changes)
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Only handle if this is the permission-request manager
        guard manager === permissionManager,
              let resolve = permissionResolve else { return }

        let status = manager.authorizationStatus
        permissionResolve = nil
        permissionReject  = nil
        permissionManager = nil   // release dedicated manager

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
            break  // Dialog not yet dismissed — wait for another callback
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

        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else { return }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.httpBody        = bodyData
        req.timeoutInterval = 15

        URLSession.shared.dataTask(with: req) { _, response, error in
            if let err = error {
                NSLog("[LocationTracking] Ping error: %@", err.localizedDescription)
            } else if let r = response as? HTTPURLResponse {
                NSLog("[LocationTracking] Ping → %d | %.5f, %.5f",
                      r.statusCode,
                      location.coordinate.latitude,
                      location.coordinate.longitude)
            }
        }.resume()
    }
}
