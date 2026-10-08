package com.singularitycrm

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  // Orientation is driven at runtime by react-native-orientation-locker (per-device
  // policy in src/utils/orientation.ts), NOT hardcoded here. The manifest lists
  // `orientation` in configChanges so a lock change reconfigures the activity in place
  // instead of recreating it (which would remount the whole React tree). Do not add
  // android:screenOrientation — it would freeze the app and override the JS policy.

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "SingularityCRM"

  /**
   * Pass null, never savedInstanceState. Android kills a backgrounded app whenever it needs the
   * memory (opening the camera for a visit selfie is enough on many phones) and later recreates
   * this activity from its saved state. That state holds react-native-screens' fragments, which
   * refuse to be restored ("Screen fragments should never be restored") — a FATAL crash that
   * throws the user back to the phone's home screen. React Navigation rebuilds every screen from
   * JS anyway, so there is nothing in that bundle worth restoring. Required by react-native-screens:
   * https://github.com/software-mansion/react-native-screens#android
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
