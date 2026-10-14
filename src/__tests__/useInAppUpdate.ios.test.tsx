import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useInAppUpdate, type UseInAppUpdateOptions } from '../index';
import {
  changeAppState,
  deferred,
  iosInfo,
  native,
  resetNative,
  setAppState,
  setPlatform,
} from '../__fixtures__/native';

jest.mock('../NativeInAppUpdate');

beforeAll(() => setPlatform('ios'));
beforeEach(() => {
  resetNative();
  native.checkForUpdate.mockResolvedValue(iosInfo());
  // Closing the App Store page always reports 'canceled' on iOS.
  native.startUpdate.mockResolvedValue('canceled');
});

const render = (options?: UseInAppUpdateOptions) =>
  renderHook(() => useInAppUpdate(options));

describe('mandatory (default)', () => {
  it('does nothing when the App Store version is not newer', async () => {
    native.checkForUpdate.mockResolvedValue(
      iosInfo({
        updateAvailability: 'not_available',
        availableVersion: '1.0.0',
        isImmediateAllowed: false,
        isFlexibleAllowed: false,
        clientVersionStalenessDays: -1,
      })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(result.current.updateInfo?.availableVersion).toBe('1.0.0');
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when the app is not in the App Store', async () => {
    native.checkForUpdate.mockResolvedValue(
      iosInfo({
        updateAvailability: 'not_available',
        availableVersion: '',
        releaseNotes: '',
        isImmediateAllowed: false,
        isFlexibleAllowed: false,
      })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(result.current.updateInfo?.availableVersion).toBeNull();
  });

  it('shows the App Store page with the new version info', async () => {
    native.startUpdate.mockReturnValue(deferred().promise); // sheet open
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('prompting'));
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
    expect(result.current.updateInfo).toMatchObject({
      availableVersion: '2.1.0',
      releaseNotes: 'Bug fixes',
      clientVersionStalenessDays: 3,
    });
  });

  it('re-shows the App Store page until the user updates', async () => {
    native.startUpdate
      .mockResolvedValueOnce('canceled')
      .mockResolvedValueOnce('canceled')
      .mockReturnValueOnce(deferred().promise); // sheet still open
    const { result } = await render();
    await waitFor(() => expect(native.startUpdate).toHaveBeenCalledTimes(3));
    expect(result.current.status).toBe('prompting');
    // Each re-prompt re-checks the store, so a just-installed update stops it.
    expect(native.checkForUpdate).toHaveBeenCalledTimes(3);
  });

  it('stops re-prompting once the store says the app is current', async () => {
    native.checkForUpdate.mockResolvedValueOnce(iosInfo()).mockResolvedValue(
      iosInfo({
        updateAvailability: 'not_available',
        isImmediateAllowed: false,
        isFlexibleAllowed: false,
      })
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('up_to_date'));
    expect(native.startUpdate).toHaveBeenCalledTimes(1);
  });

  it('re-shows the page on return from the App Store app', async () => {
    // itms-apps fallback: the user leaves the app, startUpdate settles on return.
    const store = deferred<string>();
    native.startUpdate
      .mockReturnValueOnce(store.promise)
      .mockReturnValueOnce(deferred().promise);
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('prompting'));

    setAppState('background');
    await act(async () => store.resolve('canceled'));
    expect(result.current.status).toBe('canceled');

    await act(async () => changeAppState('active'));
    await waitFor(() => expect(native.startUpdate).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('prompting');
  });

  it('reports a failed App Store lookup', async () => {
    native.checkForUpdate.mockRejectedValue(
      new Error('The Internet connection appears to be offline.')
    );
    const onError = jest.fn();
    const { result } = await render({ onError });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('offline') })
    );
  });

  it('reports when the page cannot be shown', async () => {
    native.startUpdate.mockRejectedValue(
      new Error("Couldn't open the App Store")
    );
    const { result } = await render();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe("Couldn't open the App Store");
    expect(native.startUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('not mandatory', () => {
  it('shows the App Store page once', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('canceled'));
    expect(native.startUpdate).toHaveBeenCalledTimes(1);
    expect(native.startUpdate).toHaveBeenCalledWith('flexible');
  });

  it('shows it again on the next resume', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('canceled'));
    await act(async () => changeAppState('active'));
    await waitFor(() => expect(native.startUpdate).toHaveBeenCalledTimes(2));
  });
});

describe('Android-only behaviour', () => {
  it('never subscribes to install states', async () => {
    const { result } = await render({ mandatory: false });
    await waitFor(() => expect(result.current.status).toBe('canceled'));
    expect(native.onInstallStateChange).not.toHaveBeenCalled();
    expect(result.current.progress).toBe(0);
  });

  it('completeUpdate does not call native', async () => {
    const { result } = await render({ checkOnMount: false });
    await act(() => result.current.completeUpdate());
    expect(native.completeUpdate).not.toHaveBeenCalled();
  });
});
