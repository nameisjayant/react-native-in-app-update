package com.inappupdate

import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

class InAppUpdateModule(reactContext: ReactApplicationContext) :
  NativeInAppUpdateSpec(reactContext) {

  private val appUpdateManager: AppUpdateManager by lazy {
    AppUpdateManagerFactory.create(reactApplicationContext)
  }

  private val installStateListener = InstallStateUpdatedListener { state ->
    emitOnInstallStateChange(state.toMap())
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
      .addOnSuccessListener { promise.resolve(it.toMap()) }
      .addOnFailureListener { promise.reject(E_CHECK_FAILED, it.message, it) }
  }

  override fun startUpdate(type: String, promise: Promise) {
    val updateType = if (type == "flexible") AppUpdateType.FLEXIBLE else AppUpdateType.IMMEDIATE
    // AppUpdateInfo can only start one flow, so always fetch a fresh one.
    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { info ->
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
          promise.reject(E_NO_ACTIVITY, "No foreground activity to show the update UI")
          return@addOnSuccessListener
        }
        val canStart = when (info.updateAvailability()) {
          UpdateAvailability.UPDATE_AVAILABLE -> info.isUpdateTypeAllowed(updateType)
          UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ->
            updateType == AppUpdateType.IMMEDIATE
          else -> false
        }
        if (!canStart) {
          promise.reject(E_NOT_AVAILABLE, "No $type update is available")
          return@addOnSuccessListener
        }
        appUpdateManager
          .startUpdateFlow(info, activity, AppUpdateOptions.defaultOptions(updateType))
          .addOnSuccessListener { resultCode ->
            promise.resolve(
              when (resultCode) {
                Activity.RESULT_OK -> "accepted"
                Activity.RESULT_CANCELED -> "canceled"
                else -> "failed"
              }
            )
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

  private fun AppUpdateInfo.toMap(): WritableMap = Arguments.createMap().apply {
    putString("updateAvailability", availabilityName(updateAvailability()))
    putString("installStatus", installStatusName(installStatus()))
    putInt("availableVersionCode", availableVersionCode())
    putBoolean("isImmediateAllowed", isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
    putBoolean("isFlexibleAllowed", isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
    putInt("clientVersionStalenessDays", clientVersionStalenessDays() ?: -1)
    putInt("updatePriority", updatePriority())
    putDouble("bytesDownloaded", bytesDownloaded().toDouble())
    putDouble("totalBytesToDownload", totalBytesToDownload().toDouble())
  }

  private fun InstallState.toMap(): WritableMap = Arguments.createMap().apply {
    putString("installStatus", installStatusName(installStatus()))
    putInt("installErrorCode", installErrorCode())
    putDouble("bytesDownloaded", bytesDownloaded().toDouble())
    putDouble("totalBytesToDownload", totalBytesToDownload().toDouble())
  }

  private fun availabilityName(value: Int) = when (value) {
    UpdateAvailability.UPDATE_NOT_AVAILABLE -> "not_available"
    UpdateAvailability.UPDATE_AVAILABLE -> "available"
    UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "in_progress"
    else -> "unknown"
  }

  private fun installStatusName(value: Int) = when (value) {
    InstallStatus.PENDING -> "pending"
    InstallStatus.DOWNLOADING -> "downloading"
    InstallStatus.DOWNLOADED -> "downloaded"
    InstallStatus.INSTALLING -> "installing"
    InstallStatus.INSTALLED -> "installed"
    InstallStatus.FAILED -> "failed"
    InstallStatus.CANCELED -> "canceled"
    InstallStatus.REQUIRES_UI_INTENT -> "requires_ui_intent"
    else -> "unknown"
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
