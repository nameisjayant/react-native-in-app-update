import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useInAppUpdate, type UseInAppUpdateOptions } from '../index';
import {
  androidInfo,
  changeAppState,
  deferred,
  installState,
  native,
  resetNative,
  setAppState,
  setPlatform,
} from '../__fixtures__/native';

jest.mock('../NativeInAppUpdate');

beforeAll(() => setPlatform('android'));
beforeEach(resetNative);

const render = (options?: UseInAppUpdateOptions) =>
  renderHook(
    (props: UseInAppUpdateOptions | undefined) => useInAppUpdate(props),
    {
      initialProps: options,
    }
  );

const emit = (status: string, overrides = {}) =>
  act(async () => native.__emitInstallState(installState(status, overrides)));

describe('mandatory (default)', () => {
  it('checks for an update on mount', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the app is up to date', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ updateAvailability: 'not_available' })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(result.current.updateInfo?.updateAvailability).toBe('not_available');
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('treats unknown availability as up to date', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ updateAvailability: 'unknown' })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('shows "prompting" while the Play UI is open', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    native.startUpdate.mockReturnValue(deferred().promise);
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('prompting'));
  });

  it('starts an immediate update when one is available', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
    expect(result.current.updateInfo?.availableVersionCode).toBe(42);
  });

  it('uses immediate even when type is flexible', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    await render({ type: 'flexible' });
    await waitFor(() =>
      expect(native.startUpdate).toHaveBeenCalledWith('immediate')
    );
  });

  it('re-prompts straight away when the user cancels', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    native.startUpdate
      .mockResolvedValueOnce('canceled')
      .mockResolvedValueOnce('accepted');
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledTimes(2);
    expect(native.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('re-prompts on resume when canceled in the background', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    const sheet = deferred<string>();
    native.startUpdate
      .mockReturnValueOnce(sheet.promise)
      .mockResolvedValueOnce('accepted');
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('prompting'));

    setAppState('background');
    await act(async () => sheet.resolve('canceled'));
    expect(result.current.status).toBe('canceled');
    expect(native.startUpdate).toHaveBeenCalledTimes(1);

    await act(async () => changeAppState('active'));
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledTimes(2);
  });

  it('resumes an immediate update that was left in progress', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({
        updateAvailability: 'in_progress',
        isImmediateAllowed: false,
        isFlexibleAllowed: false,
      })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
  });

  it('falls back to flexible and auto-installs when immediate is not allowed', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ isImmediateAllowed: false })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('downloading'));
    expect(native.startUpdate).toHaveBeenCalledWith('flexible');

    await emit('downloaded', { bytesDownloaded: 10, totalBytesToDownload: 10 });
    expect(native.completeUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('installing');
    expect(result.current.progress).toBe(1);
  });

  it('stays up to date when Play allows neither flow', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ isImmediateAllowed: false, isFlexibleAllowed: false })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('installs a flexible update downloaded in a previous session', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({
        updateAvailability: 'not_available',
        installStatus: 'downloaded',
      })
    );
    const { result } = await render();
    await waitFor(() => expect(native.completeUpdate).toHaveBeenCalled());
    expect(result.current.status).toBe('installing');
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it.each(['pending', 'downloading'])(
    'reports a %s download from a previous session without re-prompting',
    async (installStatus) => {
      native.checkForUpdate.mockResolvedValue(androidInfo({ installStatus }));
      const { result } = await render();
      await waitFor(() => expect(result.current.status).toBe('downloading'));
      expect(native.startUpdate).not.toHaveBeenCalled();
    }
  );

  it('installs automatically when a flexible download finishes', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await emit('downloaded');
    expect(native.completeUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('installing');
  });
});

describe('errors', () => {
  it('reports a failed check without throwing', async () => {
    native.checkForUpdate.mockRejectedValue(
      new Error('Install Error(-10): The app is not owned')
    );
    const onError = jest.fn();
    const { result } = await render({ onError });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toContain('not owned');
    expect(onError).toHaveBeenCalledWith(result.current.error);
  });

  it('reports a failed startUpdate', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    native.startUpdate.mockRejectedValue(new Error('No foreground activity'));
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('No foreground activity');
  });

  it('reports a "failed" update result', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    native.startUpdate.mockResolvedValue('failed');
    const onError = jest.fn();
    const { result } = await render({ onError });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe(
      'The update failed. Please try again.'
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(native.startUpdate).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error rejections', async () => {
    native.checkForUpdate.mockRejectedValue('network down');
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('network down');
  });

  it('reports a failed install', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ installStatus: 'downloaded' })
    );
    native.completeUpdate.mockRejectedValue(new Error('Install failed'));
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('Install failed');
  });

  it('reports a failed download with the Play error code', async () => {
    const onError = jest.fn();
    const { result } = await render({ onError });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await emit('failed', { installErrorCode: -100 });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe(
      'Update install failed (code -100)'
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('clears the error on the next check', async () => {
    native.checkForUpdate
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(androidInfo({ updateAvailability: 'not_available' }));
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(() => result.current.checkNow());
    expect(result.current.status).toBe('up_to_date');
    expect(result.current.error).toBeNull();
  });

  it('calls the latest onError', async () => {
    native.checkForUpdate
      .mockResolvedValueOnce(
        androidInfo({ updateAvailability: 'not_available' })
      )
      .mockRejectedValue(new Error('offline'));
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = await render({ onError: first });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await rerender({ onError: second });
    await act(() => result.current.checkNow());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('flexible download progress', () => {
  it('tracks progress from install states', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));

    await emit('pending');
    expect(result.current.status).toBe('downloading');
    expect(result.current.progress).toBe(0);

    await emit('downloading', {
      bytesDownloaded: 25,
      totalBytesToDownload: 100,
    });
    expect(result.current.status).toBe('downloading');
    expect(result.current.progress).toBe(0.25);

    await emit('downloading', {
      bytesDownloaded: 75,
      totalBytesToDownload: 100,
    });
    expect(result.current.progress).toBe(0.75);

    await emit('downloaded', { bytesDownloaded: 0, totalBytesToDownload: 0 });
    expect(result.current.status).toBe('downloaded');
    expect(result.current.progress).toBe(1);
  });

  it('ignores progress until the total size is known', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await emit('downloading', { bytesDownloaded: 10, totalBytesToDownload: 0 });
    expect(result.current.progress).toBe(0);
  });

  it('reports installing', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await emit('installing');
    expect(result.current.status).toBe('installing');
  });

  it('reports a canceled download', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await emit('canceled');
    expect(result.current.status).toBe('canceled');
  });

  it.each(['installed', 'unknown', 'requires_ui_intent'])(
    'ignores %s',
    async (status) => {
      const { result } = await render({ mandatory: false });
      await waitFor(() => expect(result.current.status).toBe('up_to_date'));
      await emit(status);
      expect(result.current.status).toBe('up_to_date');
    }
  );
});

describe('not mandatory', () => {
  it('waits for the user to complete a downloaded flexible update', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('downloading'));
    expect(native.startUpdate).toHaveBeenCalledWith('flexible');

    await emit('downloaded', { bytesDownloaded: 10, totalBytesToDownload: 10 });
    expect(result.current.status).toBe('downloaded');
    expect(native.completeUpdate).not.toHaveBeenCalled();

    await act(() => result.current.completeUpdate());
    expect(native.completeUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('installing');
  });

  it('uses the immediate flow when asked', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    const { result } = await render({ mandatory: false, type: 'immediate' });
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
  });

  it('does not re-prompt when the user cancels', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    native.startUpdate.mockResolvedValue('canceled');
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('canceled'));
    expect(native.startUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to another flow', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ isFlexibleAllowed: false })
    );
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('still resumes an in-progress immediate update', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ updateAvailability: 'in_progress' })
    );
    await render({ mandatory: false });
    await waitFor(() =>
      expect(native.startUpdate).toHaveBeenCalledWith('immediate')
    );
  });

  it('leaves a download from a previous session for the user to install', async () => {
    native.checkForUpdate.mockResolvedValue(
      androidInfo({ installStatus: 'downloaded' })
    );
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('downloaded'));
    expect(native.completeUpdate).not.toHaveBeenCalled();
  });

  it('switches to mandatory without remounting', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    native.startUpdate.mockResolvedValue('canceled');
    const { result, rerender } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('canceled'));

    native.startUpdate.mockReset().mockResolvedValue('accepted');
    await rerender({ mandatory: true });
    await act(() => result.current.checkNow());
    expect(native.startUpdate).toHaveBeenLastCalledWith('immediate');
    expect(result.current.status).toBe('installing');
  });
});

describe('options', () => {
  it('does nothing when disabled', async () => {
    const { result } = await render({ enabled: false });
    expect(result.current.status).toBe('idle');
    expect(native.checkForUpdate).not.toHaveBeenCalled();
    expect(native.onInstallStateChange).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('starts checking once enabled', async () => {
    const { result, rerender } = await render({ enabled: false });
    await rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('skips the mount check with checkOnMount: false', async () => {
    const { result } = await render({ checkOnMount: false });
    expect(result.current.status).toBe('idle');
    expect(native.checkForUpdate).not.toHaveBeenCalled();

    await act(() => result.current.checkNow());
    expect(result.current.status).toBe('up_to_date');
  });

  it('checks again when the app returns to the foreground', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));

    await act(async () => changeAppState('background'));
    expect(native.checkForUpdate).toHaveBeenCalledTimes(1);

    native.checkForUpdate.mockResolvedValue(androidInfo());
    await act(async () => changeAppState('active'));
    await waitFor(() => expect(result.current.status).toBe('installing'));
    expect(native.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not watch AppState with checkOnResume: false', async () => {
    const { result } = await render({ checkOnResume: false });
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('ignores checks while one is running', async () => {
    const check = deferred<ReturnType<typeof androidInfo>>();
    native.checkForUpdate.mockReturnValueOnce(check.promise);
    const { result } = await render();
    await act(async () => {
      result.current.checkNow();
      changeAppState('active');
    });
    expect(native.checkForUpdate).toHaveBeenCalledTimes(1);

    await act(async () =>
      check.resolve(androidInfo({ updateAvailability: 'not_available' }))
    );
    expect(result.current.status).toBe('up_to_date');
    await act(() => result.current.checkNow());
    expect(native.checkForUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('unmounting', () => {
  it('removes its listeners', async () => {
    const remove = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValueOnce({ remove });
    const { result, unmount } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    await act(async () => unmount());
    expect(remove).toHaveBeenCalled();

    native.__emitInstallState(installState('downloaded'));
    expect(native.completeUpdate).not.toHaveBeenCalled();
  });

  it('does not prompt when the check finishes after unmount', async () => {
    const check = deferred<ReturnType<typeof androidInfo>>();
    native.checkForUpdate.mockReturnValueOnce(check.promise);
    const { unmount } = await render();
    await act(async () => unmount());
    await act(async () => check.resolve(androidInfo()));
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('does not re-prompt after unmount', async () => {
    native.checkForUpdate.mockResolvedValue(androidInfo());
    const sheet = deferred<string>();
    native.startUpdate.mockReturnValueOnce(sheet.promise);
    const { result, unmount } = await render();
    await waitFor(() => expect(result.current.status).toBe('prompting'));
    await act(async () => unmount());
    await act(async () => sheet.resolve('canceled'));
    expect(native.startUpdate).toHaveBeenCalledTimes(1);
  });

  it('swallows errors that arrive after unmount', async () => {
    const check = deferred<ReturnType<typeof androidInfo>>();
    native.checkForUpdate.mockReturnValueOnce(check.promise);
    const onError = jest.fn();
    const { unmount } = await render({ onError });
    await act(async () => unmount());
    await act(async () => check.reject(new Error('offline')));
    expect(onError).not.toHaveBeenCalled();
  });
});
