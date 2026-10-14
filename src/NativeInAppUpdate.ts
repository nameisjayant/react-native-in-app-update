import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

export type NativeUpdateInfo = {
  /** 'unknown' | 'not_available' | 'available' | 'in_progress' | 'unsupported' */
  updateAvailability: string;
  /** See `InstallStatus` in types.ts */
  installStatus: string;
  availableVersionCode: number;
  isImmediateAllowed: boolean;
  isFlexibleAllowed: boolean;
  /** -1 when Play doesn't know yet */
  clientVersionStalenessDays: number;
  updatePriority: number;
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

export type NativeInstallState = {
  installStatus: string;
  installErrorCode: number;
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

export interface Spec extends TurboModule {
  checkForUpdate(): Promise<NativeUpdateInfo>;
  /** Resolves 'accepted' | 'canceled' | 'failed'. `type` is 'immediate' | 'flexible'. */
  startUpdate(type: string): Promise<string>;
  completeUpdate(): Promise<void>;
  readonly onInstallStateChange: CodegenTypes.EventEmitter<NativeInstallState>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('InAppUpdate');
