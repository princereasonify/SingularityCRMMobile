package com.singularitycrm

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
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
