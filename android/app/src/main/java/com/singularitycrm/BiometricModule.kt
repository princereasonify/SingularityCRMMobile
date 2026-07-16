package com.singularitycrm

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native BiometricPrompt bridge. Used on Android instead of the JS library because
 * the library only detects Class-3 (STRONG) fingerprint, which would exclude
 * Class-2 face-unlock users. See BIOMETRIC_LOGIN.md.
 */
class BiometricModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppBiometric" // == NativeModules.AppBiometric

    @ReactMethod
    fun canAuthenticate(promise: Promise) {
        try {
            val manager = BiometricManager.from(reactContext)
            val result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            promise.resolve(result == BiometricManager.BIOMETRIC_SUCCESS)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun authenticate(title: String, subtitle: String, cancelText: String, promise: Promise) {
        val activity = reactContext.currentActivity as? FragmentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No foreground activity available")
            return
        }

        activity.runOnUiThread {
            val executor = ContextCompat.getMainExecutor(activity)
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    promise.resolve(true)
                }
                // Non-matching finger — keep the sheet open for a retry, don't reject.
                override fun onAuthenticationFailed() {}
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    promise.reject(errorCode.toString(), errString.toString())
                }
            }

            val prompt = BiometricPrompt(activity, executor, callback)
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+: biometrics + device PIN/password fallback
                info.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )
            } else {
                // Android 9/10: DEVICE_CREDENTIAL can't be combined — needs a negative button
                info.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                info.setNegativeButtonText(cancelText)
            }
            prompt.authenticate(info.build())
        }
    }
}
