import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  addInstallStateListener,
  checkForUpdate,
  completeUpdate,
  startUpdate,
} from './InAppUpdate';
import type { UpdateInfo, UpdateType } from './types';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up_to_date'
  /** The Play update UI is on screen. */
  | 'prompting'
  /** User dismissed the Play UI (re-prompted when `mandatory`). */
  | 'canceled'
  | 'downloading'
  /** Flexible update ready — call `completeUpdate()`. */
  | 'downloaded'
  | 'installing'
  | 'unsupported'
  | 'error';

export type UseInAppUpdateOptions = {
  /**
   * Force every user onto the latest Play version. Uses the immediate
   * (full-screen) flow, re-shows it if the user backs out, and installs
   * flexible downloads as soon as they finish. Default `true`.
   */
  mandatory?: boolean;
  /** Flow used when `mandatory` is false. Default `'flexible'`. */
  type?: UpdateType;
  /** Check when the hook mounts (app open). Default `true`. */
  checkOnMount?: boolean;
  /** Check again whenever the app returns to the foreground. Default `true`. */
  checkOnResume?: boolean;
  /** Turn the hook off, e.g. in dev builds not installed from Play. */
  enabled?: boolean;
  onError?: (error: Error) => void;
};

export type UseInAppUpdateResult = {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  error: Error | null;
  /** 0–1 download progress for flexible updates. */
  progress: number;
  /** Run the check → update flow now. */
  checkNow: () => Promise<void>;
  /** Install a downloaded flexible update (restarts the app). */
  completeUpdate: () => Promise<void>;
};

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

export function useInAppUpdate(
  options: UseInAppUpdateOptions = {}
): UseInAppUpdateResult {
  const {
    mandatory = true,
    type = 'flexible',
    checkOnMount = true,
    checkOnResume = true,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const busy = useRef(false);
  const mounted = useRef(true);
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;
  const mandatoryRef = useRef(mandatory);
  mandatoryRef.current = mandatory;

  const fail = useCallback((e: unknown) => {
    const err = toError(e);
    if (!mounted.current) return;
    setError(err);
    setStatus('error');
    onErrorRef.current?.(err);
  }, []);

  const install = useCallback(async () => {
    setStatus('installing');
    try {
      await completeUpdate();
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const run = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    let reprompt = false;
    try {
      setError(null);
      setStatus('checking');
      const info = await checkForUpdate();
      if (!mounted.current) return;
      setUpdateInfo(info);

      if (info.updateAvailability === 'unsupported') {
        setStatus('unsupported');
        return;
      }
      // A flexible download finished while the app was closed.
      if (info.installStatus === 'downloaded') {
        if (mandatoryRef.current) await install();
        else setStatus('downloaded');
        return;
      }
      if (
        info.installStatus === 'downloading' ||
        info.installStatus === 'pending'
      ) {
        setStatus('downloading');
        return;
      }

      let flow: UpdateType = mandatoryRef.current ? 'immediate' : type;
      const resumeImmediate = info.updateAvailability === 'in_progress';
      if (!resumeImmediate && info.updateAvailability !== 'available') {
        setStatus('up_to_date');
        return;
      }
      if (!resumeImmediate) {
        const allowed =
          flow === 'immediate'
            ? info.isImmediateAllowed
            : info.isFlexibleAllowed;
        // Mandatory but Play won't allow immediate: download flexibly and
        // install automatically once downloaded.
        if (!allowed && mandatoryRef.current && info.isFlexibleAllowed) {
          flow = 'flexible';
        } else if (!allowed) {
          setStatus('up_to_date');
          return;
        }
      } else {
        flow = 'immediate';
      }

      setStatus('prompting');
      const result = await startUpdate(flow);
      if (!mounted.current) return;
      if (result === 'accepted') {
        setStatus(flow === 'flexible' ? 'downloading' : 'installing');
      } else if (result === 'canceled') {
        setStatus('canceled');
        reprompt = mandatoryRef.current;
      } else {
        fail(new Error('The update failed. Please try again.'));
      }
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
    }
    // Mandatory: put the dialog straight back. If we're backgrounded, the
    // AppState listener re-prompts on return instead.
    if (reprompt && mounted.current && AppState.currentState === 'active') {
      await run();
    }
  }, [type, install, fail]);

  // Flexible download progress / completion.
  useEffect(() => {
    if (!enabled) return;
    const sub = addInstallStateListener((state) => {
      if (!mounted.current) return;
      if (state.totalBytesToDownload > 0) {
        setProgress(state.bytesDownloaded / state.totalBytesToDownload);
      }
      switch (state.installStatus) {
        case 'pending':
        case 'downloading':
          setStatus('downloading');
          break;
        case 'downloaded':
          setProgress(1);
          if (mandatoryRef.current) install();
          else setStatus('downloaded');
          break;
        case 'installing':
          setStatus('installing');
          break;
        case 'failed':
          fail(
            new Error(`Update install failed (code ${state.installErrorCode})`)
          );
          break;
        case 'canceled':
          setStatus('canceled');
          break;
      }
    });
    return () => sub.remove();
  }, [enabled, install, fail]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled)
      return () => {
        mounted.current = false;
      };
    if (checkOnMount) run();
    const sub = checkOnResume
      ? AppState.addEventListener('change', (next) => {
          if (next === 'active') run();
        })
      : null;
    return () => {
      mounted.current = false;
      sub?.remove();
    };
  }, [enabled, checkOnMount, checkOnResume, run]);

  return {
    status,
    updateInfo,
    error,
    progress,
    checkNow: run,
    completeUpdate: install,
  };
}
