import type { EventSubscription } from 'react-native';
import type {
  InstallState,
  UpdateFlowResult,
  UpdateInfo,
  UpdateType,
} from './types';

export const UNSUPPORTED_INFO: UpdateInfo = {
  updateAvailability: 'unsupported',
  installStatus: 'unknown',
  availableVersionCode: 0,
  availableVersion: null,
  releaseNotes: null,
  isImmediateAllowed: false,
  isFlexibleAllowed: false,
  clientVersionStalenessDays: null,
  updatePriority: 0,
  bytesDownloaded: 0,
  totalBytesToDownload: 0,
};

export async function checkForUpdate(): Promise<UpdateInfo> {
  return UNSUPPORTED_INFO;
}

export async function startUpdate(
  _type: UpdateType = 'immediate'
): Promise<UpdateFlowResult> {
  throw new Error(
    "'@nameisjayant/react-native-in-app-update' is only supported on native platforms."
  );
}

export async function completeUpdate(): Promise<void> {}

export function addInstallStateListener(
  _listener: (state: InstallState) => void
): EventSubscription {
  return { remove() {} };
}
