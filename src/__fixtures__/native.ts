import { AppState, Platform, type AppStateStatus } from 'react-native';
import NativeInAppUpdate, {
  type NativeInstallState,
  type NativeUpdateInfo,
} from '../NativeInAppUpdate';

/** The jest mock in src/__mocks__/NativeInAppUpdate.ts. */
export const native = NativeInAppUpdate as unknown as {
  checkForUpdate: jest.Mock;
  startUpdate: jest.Mock;
  completeUpdate: jest.Mock;
  onInstallStateChange: jest.Mock;
  __emitInstallState: (state: NativeInstallState) => void;
};

/** A Play update that can start either flow. */
export const androidInfo = (
  overrides: Partial<NativeUpdateInfo> = {}
): NativeUpdateInfo => ({
  updateAvailability: 'available',
  installStatus: 'unknown',
  availableVersionCode: 42,
  isImmediateAllowed: true,
  isFlexibleAllowed: true,
  clientVersionStalenessDays: -1,
  updatePriority: 0,
  bytesDownloaded: 0,
  totalBytesToDownload: 0,
  ...overrides,
});

/** What the iOS module returns for a newer App Store version. */
export const iosInfo = (
  overrides: Partial<NativeUpdateInfo> = {}
): NativeUpdateInfo => ({
  updateAvailability: 'available',
  installStatus: 'unknown',
  availableVersionCode: 0,
  availableVersion: '2.1.0',
  releaseNotes: 'Bug fixes',
  isImmediateAllowed: true,
  isFlexibleAllowed: true,
  clientVersionStalenessDays: 3,
  updatePriority: 0,
  bytesDownloaded: 0,
  totalBytesToDownload: 0,
  ...overrides,
});

export const installState = (
  installStatus: string,
  overrides: Partial<NativeInstallState> = {}
): NativeInstallState => ({
  installStatus,
  installErrorCode: 0,
  bytesDownloaded: 0,
  totalBytesToDownload: 0,
  ...overrides,
});

export function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

let appState: AppStateStatus = 'active';

export function setAppState(state: AppStateStatus) {
  appState = state;
}

Object.defineProperty(AppState, 'currentState', {
  get: () => appState,
  configurable: true,
});

/** Simulates the app moving to `state`, notifying AppState listeners. */
export function changeAppState(state: AppStateStatus) {
  appState = state;
  const listeners = (AppState.addEventListener as jest.Mock).mock.calls
    .filter(([type]) => type === 'change')
    .map(([, listener]) => listener as (s: AppStateStatus) => void);
  listeners.forEach((listener) => listener(state));
}

/** Resets mocks to "up to date, user accepts" defaults. */
export function resetNative() {
  jest.clearAllMocks();
  setAppState('active');
  native.checkForUpdate.mockReset();
  native.checkForUpdate.mockResolvedValue(
    androidInfo({ updateAvailability: 'not_available' })
  );
  native.startUpdate.mockReset();
  native.startUpdate.mockResolvedValue('accepted');
  native.completeUpdate.mockReset();
  native.completeUpdate.mockResolvedValue(undefined);
}

/** A promise you settle from the test, e.g. an update sheet still on screen. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
