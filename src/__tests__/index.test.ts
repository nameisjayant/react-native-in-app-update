import * as InAppUpdate from '../index';

jest.mock('../NativeInAppUpdate');

it('exports the public API', () => {
  expect(Object.keys(InAppUpdate).sort()).toEqual([
    'addInstallStateListener',
    'checkForUpdate',
    'completeUpdate',
    'startUpdate',
    'useInAppUpdate',
  ]);
});
