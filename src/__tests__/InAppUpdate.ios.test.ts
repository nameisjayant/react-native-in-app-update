import {
  addInstallStateListener,
  checkForUpdate,
  completeUpdate,
  startUpdate,
} from '../index';
import {
  iosInfo,
  native,
  resetNative,
  setPlatform,
} from '../__fixtures__/native';

jest.mock('../NativeInAppUpdate');

beforeAll(() => setPlatform('ios'));
beforeEach(resetNative);

describe('checkForUpdate (iOS)', () => {
  it('returns the App Store version, release notes and staleness', async () => {
    native.checkForUpdate.mockResolvedValueOnce(iosInfo());
    await expect(checkForUpdate()).resolves.toEqual({
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
    });
  });

  it('maps empty strings (app not in the store) to null', async () => {
    native.checkForUpdate.mockResolvedValueOnce(
      iosInfo({
        updateAvailability: 'not_available',
        availableVersion: '',
        releaseNotes: '',
        isImmediateAllowed: false,
        isFlexibleAllowed: false,
        clientVersionStalenessDays: -1,
      })
    );
    const result = await checkForUpdate();
    expect(result.updateAvailability).toBe('not_available');
    expect(result.availableVersion).toBeNull();
    expect(result.releaseNotes).toBeNull();
    expect(result.clientVersionStalenessDays).toBeNull();
  });

  it('reports the store version even when up to date', async () => {
    native.checkForUpdate.mockResolvedValueOnce(
      iosInfo({ updateAvailability: 'not_available', availableVersion: '1.0' })
    );
    const result = await checkForUpdate();
    expect(result.availableVersion).toBe('1.0');
  });

  it('rejects when the App Store lookup fails', async () => {
    native.checkForUpdate.mockRejectedValueOnce(
      new Error('The Internet connection appears to be offline.')
    );
    await expect(checkForUpdate()).rejects.toThrow('offline');
  });
});

describe('startUpdate (iOS)', () => {
  it.each(['immediate', 'flexible'] as const)(
    'shows the App Store page for the %s flow',
    async (type) => {
      native.startUpdate.mockResolvedValueOnce('canceled');
      await expect(startUpdate(type)).resolves.toBe('canceled');
      expect(native.startUpdate).toHaveBeenCalledWith(type);
    }
  );

  it('rejects when there is no newer version', async () => {
    native.startUpdate.mockRejectedValueOnce(
      new Error('No update is available on the App Store')
    );
    await expect(startUpdate()).rejects.toThrow('No update is available');
  });

  it('rejects while the App Store page is already showing', async () => {
    native.startUpdate.mockRejectedValueOnce(
      new Error('The App Store page is already showing')
    );
    await expect(startUpdate()).rejects.toThrow('already showing');
  });
});

describe('completeUpdate (iOS)', () => {
  it('is a no-op: the App Store installs updates', async () => {
    await expect(completeUpdate()).resolves.toBeUndefined();
    expect(native.completeUpdate).not.toHaveBeenCalled();
  });
});

describe('addInstallStateListener (iOS)', () => {
  it('never subscribes to native events', () => {
    const listener = jest.fn();
    const sub = addInstallStateListener(listener);
    expect(native.onInstallStateChange).not.toHaveBeenCalled();
    expect(() => sub.remove()).not.toThrow();
  });
});
