import {
  addInstallStateListener,
  checkForUpdate,
  completeUpdate,
  startUpdate,
} from '../index';
import {
  androidInfo,
  installState,
  native,
  resetNative,
  setPlatform,
} from '../__fixtures__/native';

jest.mock('../NativeInAppUpdate');

beforeAll(() => setPlatform('android'));
beforeEach(resetNative);

describe('checkForUpdate (Android)', () => {
  it('returns Play update info', async () => {
    native.checkForUpdate.mockResolvedValueOnce(
      androidInfo({ updatePriority: 4, clientVersionStalenessDays: 7 })
    );
    await expect(checkForUpdate()).resolves.toEqual({
      updateAvailability: 'available',
      installStatus: 'unknown',
      availableVersionCode: 42,
      availableVersion: null,
      releaseNotes: null,
      isImmediateAllowed: true,
      isFlexibleAllowed: true,
      clientVersionStalenessDays: 7,
      updatePriority: 4,
      bytesDownloaded: 0,
      totalBytesToDownload: 0,
    });
  });

  it('maps -1 staleness to null', async () => {
    native.checkForUpdate.mockResolvedValueOnce(
      androidInfo({ clientVersionStalenessDays: -1 })
    );
    const result = await checkForUpdate();
    expect(result.clientVersionStalenessDays).toBeNull();
  });

  it('keeps 0 staleness (update published today)', async () => {
    native.checkForUpdate.mockResolvedValueOnce(
      androidInfo({ clientVersionStalenessDays: 0 })
    );
    const result = await checkForUpdate();
    expect(result.clientVersionStalenessDays).toBe(0);
  });

  it('has no version string or release notes on Play', async () => {
    native.checkForUpdate.mockResolvedValueOnce(androidInfo());
    const result = await checkForUpdate();
    expect(result.availableVersion).toBeNull();
    expect(result.releaseNotes).toBeNull();
  });

  it('passes download progress through', async () => {
    native.checkForUpdate.mockResolvedValueOnce(
      androidInfo({
        installStatus: 'downloading',
        bytesDownloaded: 50,
        totalBytesToDownload: 200,
      })
    );
    const result = await checkForUpdate();
    expect(result.installStatus).toBe('downloading');
    expect(result.bytesDownloaded).toBe(50);
    expect(result.totalBytesToDownload).toBe(200);
  });

  it('rejects with the native error', async () => {
    native.checkForUpdate.mockRejectedValueOnce(
      new Error('Install Error(-10): The app is not owned')
    );
    await expect(checkForUpdate()).rejects.toThrow('The app is not owned');
  });
});

describe('startUpdate (Android)', () => {
  it('defaults to the immediate flow', async () => {
    await expect(startUpdate()).resolves.toBe('accepted');
    expect(native.startUpdate).toHaveBeenCalledWith('immediate');
  });

  it('starts the flexible flow', async () => {
    await startUpdate('flexible');
    expect(native.startUpdate).toHaveBeenCalledWith('flexible');
  });

  it.each(['accepted', 'canceled', 'failed'])(
    'resolves the native result %s',
    async (result) => {
      native.startUpdate.mockResolvedValueOnce(result);
      await expect(startUpdate()).resolves.toBe(result);
    }
  );

  it('rejects when no update can be started', async () => {
    native.startUpdate.mockRejectedValueOnce(
      new Error('No immediate update is available')
    );
    await expect(startUpdate()).rejects.toThrow('No immediate update');
  });
});

describe('completeUpdate (Android)', () => {
  it('installs the downloaded update', async () => {
    await completeUpdate();
    expect(native.completeUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects when Play cannot install', async () => {
    native.completeUpdate.mockRejectedValueOnce(new Error('Install failed'));
    await expect(completeUpdate()).rejects.toThrow('Install failed');
  });
});

describe('addInstallStateListener (Android)', () => {
  it('forwards Play install states', () => {
    const listener = jest.fn();
    addInstallStateListener(listener);
    native.__emitInstallState(
      installState('downloading', {
        bytesDownloaded: 5,
        totalBytesToDownload: 10,
      })
    );
    expect(listener).toHaveBeenCalledWith({
      installStatus: 'downloading',
      installErrorCode: 0,
      bytesDownloaded: 5,
      totalBytesToDownload: 10,
    });
  });

  it('passes install error codes through', () => {
    const listener = jest.fn();
    addInstallStateListener(listener);
    native.__emitInstallState(installState('failed', { installErrorCode: -6 }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ installStatus: 'failed', installErrorCode: -6 })
    );
  });

  it('stops listening after remove()', () => {
    const listener = jest.fn();
    addInstallStateListener(listener).remove();
    native.__emitInstallState(installState('downloaded'));
    expect(listener).not.toHaveBeenCalled();
  });
});
