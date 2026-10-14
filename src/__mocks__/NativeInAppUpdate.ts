import type { NativeInstallState } from '../NativeInAppUpdate';

let installListener: ((state: NativeInstallState) => void) | null = null;

const NativeInAppUpdate = {
  checkForUpdate: jest.fn(async () => ({
    updateAvailability: 'not_available',
    installStatus: 'unknown',
    availableVersionCode: 0,
    isImmediateAllowed: false,
    isFlexibleAllowed: false,
    clientVersionStalenessDays: -1,
    updatePriority: 0,
    bytesDownloaded: 0,
    totalBytesToDownload: 0,
  })),
  startUpdate: jest.fn(async (_type: string) => 'accepted'),
  completeUpdate: jest.fn(async () => {}),
  onInstallStateChange: jest.fn(
    (listener: (state: NativeInstallState) => void) => {
      installListener = listener;
      return {
        remove: () => {
          installListener = null;
        },
      };
    }
  ),
  /** Test helper: simulate a Play install-state event. */
  __emitInstallState(state: NativeInstallState) {
    installListener?.(state);
  },
};

export default NativeInAppUpdate;
