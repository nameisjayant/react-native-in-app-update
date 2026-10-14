import { Platform, type EventSubscription } from 'react-native';
import NativeInAppUpdate from './NativeInAppUpdate';
import type {
  InstallState,
  UpdateFlowResult,
  UpdateInfo,
  UpdateType,
} from './types';

const isAndroid = () => Platform.OS === 'android';
const isSupported = () => Platform.OS === 'android' || Platform.OS === 'ios';

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

/**
 * Asks Google Play (Android) or the App Store (iOS) whether a newer version
 * of this app is available.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  if (!isSupported()) return UNSUPPORTED_INFO;
  const info = await NativeInAppUpdate.checkForUpdate();
  return {
    ...info,
    updateAvailability:
      info.updateAvailability as UpdateInfo['updateAvailability'],
    installStatus: info.installStatus as UpdateInfo['installStatus'],
    availableVersion: info.availableVersion || null,
    releaseNotes: info.releaseNotes || null,
    clientVersionStalenessDays:
      info.clientVersionStalenessDays < 0
        ? null
        : info.clientVersionStalenessDays,
  };
}

/**
 * Shows the update UI. On Android, `immediate` is Play's full-screen blocking
 * flow and `flexible` downloads in the background (call `completeUpdate` once
 * the install status is `downloaded`). On iOS both show the app's App Store
 * page in-app and resolve `canceled` when it closes. Rejects if no update can
 * be started.
 */
export async function startUpdate(
  type: UpdateType = 'immediate'
): Promise<UpdateFlowResult> {
  if (!isSupported())
    throw new Error('In-app updates are only available on Android and iOS');
  return (await NativeInAppUpdate.startUpdate(type)) as UpdateFlowResult;
}

/** Installs a downloaded flexible update. The app restarts. No-op on iOS. */
export async function completeUpdate(): Promise<void> {
  if (!isAndroid()) return;
  await NativeInAppUpdate.completeUpdate();
}

/** Download/install progress of flexible updates. Never fires on iOS. */
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
