import { renderHook, waitFor } from '@testing-library/react-native';
import { checkForUpdate as nativeCheckForUpdate } from '../InAppUpdate.native';
import { useInAppUpdate } from '../useInAppUpdate';
import { native, resetNative, setPlatform } from '../__fixtures__/native';
import type * as InAppUpdate from '../InAppUpdate.native';

jest.mock('../NativeInAppUpdate');

// Jest resolves '../InAppUpdate' to the .native file; load the web build directly.
const web: typeof InAppUpdate = jest.requireActual('../InAppUpdate.ts');

beforeEach(resetNative);

describe('web build (InAppUpdate.ts)', () => {
  it('reports unsupported', async () => {
    const result = await web.checkForUpdate();
    expect(result).toBe(web.UNSUPPORTED_INFO);
    expect(result).toMatchObject({
      updateAvailability: 'unsupported',
      isImmediateAllowed: false,
      isFlexibleAllowed: false,
      clientVersionStalenessDays: null,
    });
  });

  it('refuses to start an update', async () => {
    await expect(web.startUpdate()).rejects.toThrow(
      'only supported on native platforms'
    );
  });

  it('completeUpdate is a no-op', async () => {
    await expect(web.completeUpdate()).resolves.toBeUndefined();
  });

  it('install listener never fires and removes cleanly', () => {
    const sub = web.addInstallStateListener(jest.fn());
    expect(() => sub.remove()).not.toThrow();
  });

  it('matches the native UNSUPPORTED_INFO', () => {
    const nativeModule: typeof InAppUpdate = jest.requireActual(
      '../InAppUpdate.native'
    );
    expect(web.UNSUPPORTED_INFO).toEqual(nativeModule.UNSUPPORTED_INFO);
  });
});

describe('native build on other platforms (windows, macos)', () => {
  afterAll(() => setPlatform('ios'));

  beforeEach(() => setPlatform('windows'));

  it('reports unsupported without touching the native module', async () => {
    const result = await nativeCheckForUpdate();
    expect(result.updateAvailability).toBe('unsupported');
    expect(native.checkForUpdate).not.toHaveBeenCalled();
  });

  it('refuses to start an update', async () => {
    const { startUpdate } = jest.requireActual('../InAppUpdate.native');
    await expect(startUpdate()).rejects.toThrow(
      'only available on Android and iOS'
    );
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('the hook reports unsupported and never prompts', async () => {
    const { result } = await renderHook(() => useInAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('unsupported'));
    expect(result.current.updateInfo?.updateAvailability).toBe('unsupported');
    expect(native.checkForUpdate).not.toHaveBeenCalled();
    expect(native.startUpdate).not.toHaveBeenCalled();
  });

  it('completeUpdate and listeners are no-ops', async () => {
    const { completeUpdate, addInstallStateListener } = jest.requireActual(
      '../InAppUpdate.native'
    );
    await completeUpdate();
    addInstallStateListener(jest.fn()).remove();
    expect(native.completeUpdate).not.toHaveBeenCalled();
    expect(native.onInstallStateChange).not.toHaveBeenCalled();
  });
});
