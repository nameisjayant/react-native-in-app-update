import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import { checkForUpdate, startUpdate, useInAppUpdate } from '../index';
import NativeInAppUpdate from '../NativeInAppUpdate';

jest.mock('../NativeInAppUpdate');

const native = NativeInAppUpdate as unknown as {
  checkForUpdate: jest.Mock;
  startUpdate: jest.Mock;
  completeUpdate: jest.Mock;
  __emitInstallState: (s: object) => void;
};

const info = (overrides: object = {}) => ({
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

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { get: () => 'android' });
  Object.defineProperty(AppState, 'currentState', { get: () => 'active' });
});

beforeEach(() => {
  jest.clearAllMocks();
  native.startUpdate.mockResolvedValue('accepted');
});

describe('checkForUpdate', () => {
  it('maps -1 staleness to null', async () => {
    native.checkForUpdate.mockResolvedValueOnce(info());
    const result = await checkForUpdate();
    expect(result.clientVersionStalenessDays).toBeNull();
    expect(result.availableVersionCode).toBe(42);
  });
});

describe('startUpdate', () => {
  it('defaults to the immediate flow', async () => {
    await expect(startUpdate()).resolves.toBe('accepted');
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
  });
});

describe('useInAppUpdate (mandatory, default)', () => {
  it('does nothing when the app is up to date', async () => {
    native.checkForUpdate.mockResolvedValue(
      info({ updateAvailability: 'not_available' })
    );
    const { result } = await renderHook(() => useInAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('starts an immediate update when one is available', async () => {
    native.checkForUpdate.mockResolvedValue(info());
    const { result } = await renderHook(() => useInAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
  });

  it('re-prompts when the user cancels', async () => {
    native.checkForUpdate.mockResolvedValue(info());
    native.startUpdate
      .mockResolvedValueOnce('canceled')
      .mockResolvedValueOnce('accepted');
    const { result } = await renderHook(() => useInAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledTimes(2);
  });

  it('resumes an immediate update that was left in progress', async () => {
    native.checkForUpdate.mockResolvedValue(
      info({ updateAvailability: 'in_progress', isImmediateAllowed: false })
    );
    await renderHook(() => useInAppUpdate());
    await waitFor(() =>
      expect(native.startUpdate).toHaveBeenCalledWith('immediate')
    );
  });

  it('falls back to flexible and auto-installs when immediate is not allowed', async () => {
    native.checkForUpdate.mockResolvedValue(
      info({ isImmediateAllowed: false })
    );
    const { result } = await renderHook(() => useInAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('downloading'));
    expect(native.startUpdate).toHaveBeenCalledWith('flexible');

    await act(async () => {
      native.__emitInstallState({
        installStatus: 'downloaded',
        installErrorCode: 0,
        bytesDownloaded: 10,
        totalBytesToDownload: 10,
      });
    });
    expect(native.completeUpdate).toHaveBeenCalled();
  });

  it('installs a flexible update downloaded in a previous session', async () => {
    native.checkForUpdate.mockResolvedValue(
      info({ updateAvailability: 'not_available', installStatus: 'downloaded' })
    );
    await renderHook(() => useInAppUpdate());
    await waitFor(() => expect(native.completeUpdate).toHaveBeenCalled());
  });

  it('reports errors without throwing', async () => {
    native.checkForUpdate.mockRejectedValue(
      new Error('Install Error(-10): The app is not owned')
    );
    const onError = jest.fn();
    const { result } = await renderHook(() => useInAppUpdate({ onError }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(onError).toHaveBeenCalled();
  });

  it('skips everything when disabled', async () => {
    await renderHook(() => useInAppUpdate({ enabled: false }));
    expect(native.checkForUpdate).not.toHaveBeenCalled();
  });
});

describe('on iOS', () => {
  it('reports unsupported without touching the native module', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    try {
      const { result } = await renderHook(() => useInAppUpdate());
      await waitFor(() => expect(result.current.status).toBe('unsupported'));
      expect(native.checkForUpdate).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    }
  });
});

describe('useInAppUpdate (flexible)', () => {
  it('waits for the user to complete a downloaded update', async () => {
    native.checkForUpdate.mockResolvedValue(info());
    const { result } = await renderHook(() =>
      useInAppUpdate({ mandatory: false })
    );
    await waitFor(() => expect(result.current.status).toBe('downloading'));
    expect(native.startUpdate).toHaveBeenCalledWith('flexible');

    await act(async () => {
      native.__emitInstallState({
        installStatus: 'downloaded',
        installErrorCode: 0,
        bytesDownloaded: 10,
        totalBytesToDownload: 10,
      });
    });
    expect(result.current.status).toBe('downloaded');
    expect(native.completeUpdate).not.toHaveBeenCalled();

    await act(() => result.current.completeUpdate());
    expect(native.completeUpdate).toHaveBeenCalled();
  });
});
