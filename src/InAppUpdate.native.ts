import { Platform, type EventSubscription } from 'react-native';
import NativeInAppUpdate from './NativeInAppUpdate';
import type {
  InstallState,
  UpdateFlowResult,
  UpdateInfo,
  UpdateType,
} from './types';

const isAndroid = () => Platform.OS === 'android';

export const UNSUPPORTED_INFO: UpdateInfo = {
  updateAvailability: 'unsupported',
  installStatus: 'unknown',
  availableVersionCode: 0,
  isImmediateAllowed: false,
  isFlexibleAllowed: false,
  clientVersionStalenessDays: null,
  updatePriority: 0,
  bytesDownloaded: 0,
  totalBytesToDownload: 0,
};

/** Asks Google Play whether a newer version of this app is available. */
export async function checkForUpdate(): Promise<UpdateInfo> {
  if (!isAndroid()) return UNSUPPORTED_INFO;
  const info = await NativeInAppUpdate.checkForUpdate();
  return {
    ...info,
    updateAvailability:
      info.updateAvailability as UpdateInfo['updateAvailability'],
    installStatus: info.installStatus as UpdateInfo['installStatus'],
    clientVersionStalenessDays:
      info.clientVersionStalenessDays < 0
        ? null
        : info.clientVersionStalenessDays,
  };
}

/**
 * Shows the Play update UI. `immediate` is the full-screen blocking flow,
 * `flexible` downloads in the background (call `completeUpdate` once the
 * install status is `downloaded`). Rejects if no update can be started.
 */
export async function startUpdate(
  type: UpdateType = 'immediate'
): Promise<UpdateFlowResult> {
  if (!isAndroid())
    throw new Error('In-app updates are only available on Android');
  return (await NativeInAppUpdate.startUpdate(type)) as UpdateFlowResult;
}

/** Installs a downloaded flexible update. The app restarts. */
export async function completeUpdate(): Promise<void> {
  if (!isAndroid()) return;
  await NativeInAppUpdate.completeUpdate();
}

/** Download/install progress of flexible updates. */
export function addInstallStateListener(
  listener: (state: InstallState) => void
): EventSubscription {
  if (!isAndroid()) return { remove() {} };
  return NativeInAppUpdate.onInstallStateChange((state) =>
    listener({
      ...state,
      installStatus: state.installStatus as InstallState['installStatus'],
    })
  );
}
