package com.inappupdate

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener

class InAppUpdateModule(reactContext: ReactApplicationContext) :
  NativeInAppUpdateSpec(reactContext) {

  private val appUpdateManager: AppUpdateManager by lazy {
    AppUpdateManagerFactory.create(reactApplicationContext)
  }

  private val installStateListener = InstallStateUpdatedListener { state ->
    emitOnInstallStateChange(InAppUpdateMapping.installState(state).toWritableMap())
  }

  override fun initialize() {
    super.initialize()
    appUpdateManager.registerListener(installStateListener)
  }

  override fun invalidate() {
    appUpdateManager.unregisterListener(installStateListener)
    super.invalidate()
  }

  override fun checkForUpdate(promise: Promise) {
    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { promise.resolve(InAppUpdateMapping.updateInfo(it).toWritableMap()) }
      .addOnFailureListener { promise.reject(E_CHECK_FAILED, it.message, it) }
  }

  override fun startUpdate(type: String, promise: Promise) {
    val updateType = InAppUpdateMapping.updateType(type)
    // AppUpdateInfo can only start one flow, so always fetch a fresh one.
    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { info ->
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
          promise.reject(E_NO_ACTIVITY, "No foreground activity to show the update UI")
          return@addOnSuccessListener
        }
        if (!InAppUpdateMapping.canStart(info, updateType)) {
          promise.reject(E_NOT_AVAILABLE, "No $type update is available")
          return@addOnSuccessListener
        }
        appUpdateManager
          .startUpdateFlow(info, activity, AppUpdateOptions.defaultOptions(updateType))
          .addOnSuccessListener { resultCode ->
            promise.resolve(InAppUpdateMapping.flowResult(resultCode))
          }
          .addOnFailureListener { promise.reject(E_START_FAILED, it.message, it) }
      }
      .addOnFailureListener { promise.reject(E_CHECK_FAILED, it.message, it) }
  }

  override fun completeUpdate(promise: Promise) {
    appUpdateManager.completeUpdate()
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { promise.reject(E_COMPLETE_FAILED, it.message, it) }
  }

  private fun Map<String, Any>.toWritableMap(): WritableMap = Arguments.createMap().also { map ->
    forEach { (key, value) ->
      when (value) {
        is String -> map.putString(key, value)
        is Boolean -> map.putBoolean(key, value)
        is Int -> map.putInt(key, value)
        is Double -> map.putDouble(key, value)
      }
    }
  }

  companion object {
    const val NAME = NativeInAppUpdateSpec.NAME
    private const val E_CHECK_FAILED = "E_CHECK_FAILED"
    private const val E_NO_ACTIVITY = "E_NO_ACTIVITY"
    private const val E_NOT_AVAILABLE = "E_NOT_AVAILABLE"
    private const val E_START_FAILED = "E_START_FAILED"
    private const val E_COMPLETE_FAILED = "E_COMPLETE_FAILED"
  }
}
