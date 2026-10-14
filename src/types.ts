export type UpdateType = 'immediate' | 'flexible';

export type UpdateAvailability =
  | 'unknown'
  | 'not_available'
  | 'available'
  /** An immediate update was started and not finished — resume it. */
  | 'in_progress'
  /** Platform without in-app updates (web). */
  | 'unsupported';

export type InstallStatus =
  | 'unknown'
  | 'pending'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'canceled'
  | 'requires_ui_intent';

export type UpdateInfo = {
  updateAvailability: UpdateAvailability;
  installStatus: InstallStatus;
  /** Play `versionCode` of the update. Always 0 on iOS. */
  availableVersionCode: number;
  /** App Store version string (e.g. "2.1.0"). null on Android: Play only gives `availableVersionCode`. */
  availableVersion: string | null;
  /** App Store "What's New" text. null on Android. */
  releaseNotes: string | null;
  /** On iOS both flows show the App Store page, so these match. */
  isImmediateAllowed: boolean;
  isFlexibleAllowed: boolean;
  /**
   * Days since Play learned about the update (Android) or since the App Store
   * version was released (iOS), or null if unknown.
   */
  clientVersionStalenessDays: number | null;
  /** 0–5, set via the Play Developer API. Always 0 on iOS. */
  updatePriority: number;
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

export type InstallState = {
  installStatus: InstallStatus;
  /** Play `InstallErrorCode`, 0 when there is no error. */
  installErrorCode: number;
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

/**
 * Outcome of the update UI. On iOS it is always `canceled` once the App Store
 * page closes: Apple doesn't say whether the user updated, and if they did
 * iOS relaunches the app on the new version.
 */
export type UpdateFlowResult = 'accepted' | 'canceled' | 'failed';
