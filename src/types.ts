export type UpdateType = 'immediate' | 'flexible';

export type UpdateAvailability =
  | 'unknown'
  | 'not_available'
  | 'available'
  /** An immediate update was started and not finished — resume it. */
  | 'in_progress'
  /** Platform without Play in-app updates (iOS, web). */
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
  availableVersionCode: number;
  isImmediateAllowed: boolean;
  isFlexibleAllowed: boolean;
  /** Days since Play learned about the update, or null if unknown. */
  clientVersionStalenessDays: number | null;
  /** 0–5, set via the Play Developer API. */
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

/** Outcome of the Play update dialog. */
export type UpdateFlowResult = 'accepted' | 'canceled' | 'failed';
