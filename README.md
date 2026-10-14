# react-native-in-app-update

[![npm version](https://img.shields.io/npm/v/@nameisjayant/react-native-in-app-update.svg)](https://www.npmjs.com/package/@nameisjayant/react-native-in-app-update)
[![license](https://img.shields.io/npm/l/@nameisjayant/react-native-in-app-update.svg)](LICENSE)
![platform](https://img.shields.io/badge/platform-android-3ddc84.svg)

**Keep every user on the latest version of your React Native app.**

A small, typed wrapper around the [Google Play In-App Updates API](https://developer.android.com/guide/playcore/in-app-updates) (Play Core `app-update` 2.1.0). Add one hook to your root component and users are prompted with Play's full-screen update screen whenever a newer version is available.

---

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Usage](#usage)
  - [Mandatory update (default)](#mandatory-update-default)
  - [Flexible update](#flexible-update)
  - [Imperative API](#imperative-api)
- [API reference](#api-reference)
- [Platform support](#platform-support)
- [Testing in-app updates](#testing-in-app-updates)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- 🔒 **Mandatory updates by default.** Shows the update screen on app open and on every return to the foreground, and shows it again if the user backs out.
- 🌙 **Flexible updates.** Downloads in the background while the app keeps running, with progress, so you can show your own "Restart to update" prompt.
- 🪝 **One hook.** `useInAppUpdate()` handles checking, prompting, resuming interrupted updates and installing.
- 🧩 **Imperative API** for full control: `checkForUpdate`, `startUpdate`, `completeUpdate`, `addInstallStateListener`.
- ⚡ **New Architecture.** Built as a TurboModule.
- 🛡️ **Safe on every platform.** iOS and web are no-ops that report `unsupported`, so the same code runs everywhere.

## Requirements

| Requirement | Version |
| --- | --- |
| React Native | New Architecture (TurboModules) enabled |
| Android `minSdkVersion` | 24+ |
| Distribution | App must be **installed from Google Play** for updates to work |

## Installation

```sh
npm install @nameisjayant/react-native-in-app-update
# or
yarn add @nameisjayant/react-native-in-app-update
```

On iOS, install pods (the module is a no-op there, but it still has to be linked):

```sh
cd ios && pod install
```

There are no extra Android setup steps. Autolinking adds the Play Core dependency for you.

## Quick start

Call the hook once in your root component:

```tsx
import { useInAppUpdate } from '@nameisjayant/react-native-in-app-update';

export default function App() {
  useInAppUpdate({ enabled: !__DEV__ });

  return <RootNavigator />;
}
```

That's all you need. When a new version is on Play, users see the update screen and can't continue until they update.

> **Tip:** `enabled: !__DEV__` turns the hook off in debug builds. Builds installed from Android Studio or `yarn android` aren't from Play, so they can't receive updates.

## Usage

### Mandatory update (default)

```tsx
useInAppUpdate(); // same as useInAppUpdate({ mandatory: true })
```

How it behaves on Android:

| Situation | Behaviour |
| --- | --- |
| App opened or resumed, update available | Shows Play's full-screen **immediate** update |
| User backs out of the update screen | Shows it again right away (or on next resume) |
| Immediate update was interrupted | Resumes it |
| Play doesn't allow an immediate update | Downloads it as a flexible update and installs it automatically when done |
| Flexible update downloaded in an earlier session | Installs it on launch |
| No update, or app not installed from Play | Does nothing (`status` is `up_to_date` or `error`) |

### Flexible update

Let users keep using the app while the update downloads, then ask them to restart:

```tsx
import { useInAppUpdate } from '@nameisjayant/react-native-in-app-update';

function UpdateBanner() {
  const { status, progress, completeUpdate } = useInAppUpdate({
    mandatory: false,
  });

  if (status === 'downloading') {
    return <Text>Downloading update… {Math.round(progress * 100)}%</Text>;
  }

  if (status === 'downloaded') {
    return (
      <Snackbar
        text="An update has been downloaded"
        action="Restart"
        onPress={completeUpdate} // installs and restarts the app
      />
    );
  }

  return null;
}
```

### Imperative API

Use these when you want to decide yourself when and how to update, for example only for high-priority releases:

```ts
import {
  checkForUpdate,
  startUpdate,
  completeUpdate,
  addInstallStateListener,
} from '@nameisjayant/react-native-in-app-update';

const info = await checkForUpdate();

if (info.updateAvailability === 'available' && info.updatePriority >= 4) {
  if (info.isImmediateAllowed) {
    const result = await startUpdate('immediate'); // 'accepted' | 'canceled' | 'failed'
  }
}

// Track a flexible download
const sub = addInstallStateListener((state) => {
  console.log(state.installStatus, state.bytesDownloaded, state.totalBytesToDownload);
  if (state.installStatus === 'downloaded') completeUpdate();
});

// later
sub.remove();
```

## API reference

### `useInAppUpdate(options?)`

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mandatory` | `boolean` | `true` | Force the update: immediate flow, shown again on cancel, flexible downloads installed automatically |
| `type` | `'immediate' \| 'flexible'` | `'flexible'` | Flow to use when `mandatory` is `false` |
| `checkOnMount` | `boolean` | `true` | Check for an update when the hook mounts (app open) |
| `checkOnResume` | `boolean` | `true` | Check again whenever the app returns to the foreground |
| `enabled` | `boolean` | `true` | Turn the hook off entirely (e.g. `!__DEV__`) |
| `onError` | `(error: Error) => void` | — | Called with any Play error |

#### Returns

| Field | Type | Description |
| --- | --- | --- |
| `status` | `UpdateStatus` | Current state of the update flow (see below) |
| `updateInfo` | `UpdateInfo \| null` | Result of the last check |
| `error` | `Error \| null` | Last error, if any |
| `progress` | `number` | Download progress of a flexible update, `0`–`1` |
| `checkNow` | `() => Promise<void>` | Run the check → update flow right now |
| `completeUpdate` | `() => Promise<void>` | Install a downloaded flexible update (restarts the app) |

#### `UpdateStatus`

| Value | Meaning |
| --- | --- |
| `idle` | Nothing has happened yet |
| `checking` | Asking Play for updates |
| `up_to_date` | No update available |
| `prompting` | The Play update screen is showing |
| `canceled` | User dismissed the update screen (shown again when `mandatory`) |
| `downloading` | Flexible update is downloading |
| `downloaded` | Flexible update is ready; call `completeUpdate()` |
| `installing` | Update is being installed |
| `unsupported` | Platform has no Play in-app updates (iOS, web) |
| `error` | Something failed (see `error`) |

### Functions

| Function | Returns | Description |
| --- | --- | --- |
| `checkForUpdate()` | `Promise<UpdateInfo>` | Asks Google Play whether a newer version is available |
| `startUpdate(type = 'immediate')` | `Promise<UpdateFlowResult>` | Shows the Play update UI. Rejects if no update can be started (and always on iOS/web) |
| `completeUpdate()` | `Promise<void>` | Installs a downloaded flexible update. The app restarts |
| `addInstallStateListener(listener)` | `EventSubscription` | Listens to download/install progress. Call `.remove()` to unsubscribe |

### Types

```ts
type UpdateType = 'immediate' | 'flexible';

type UpdateFlowResult = 'accepted' | 'canceled' | 'failed';

type UpdateInfo = {
  updateAvailability: 'unknown' | 'not_available' | 'available' | 'in_progress' | 'unsupported';
  installStatus: InstallStatus;
  availableVersionCode: number;
  isImmediateAllowed: boolean;
  isFlexibleAllowed: boolean;
  clientVersionStalenessDays: number | null; // days since Play learned about the update
  updatePriority: number;                    // 0–5, set via the Play Developer API
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

type InstallState = {
  installStatus: InstallStatus;
  installErrorCode: number; // Play InstallErrorCode, 0 = no error
  bytesDownloaded: number;
  totalBytesToDownload: number;
};

type InstallStatus =
  | 'unknown' | 'pending' | 'downloading' | 'downloaded'
  | 'installing' | 'installed' | 'failed' | 'canceled' | 'requires_ui_intent';
```

All types are exported from the package:

```ts
import type { UpdateInfo, UpdateStatus, UseInAppUpdateOptions } from '@nameisjayant/react-native-in-app-update';
```

## Platform support

| Platform | Behaviour |
| --- | --- |
| **Android** | Full support via Google Play In-App Updates |
| **iOS** | No-op. `checkForUpdate()` returns `updateAvailability: 'unsupported'`, the hook reports `status: 'unsupported'` |
| **Web** | Same as iOS |

`startUpdate()` throws on iOS and web. The hook never does, so it's safe to call unconditionally.

## Testing in-app updates

In-app updates only work for an app **installed from Google Play**. Use [internal app sharing](https://developer.android.com/guide/playcore/in-app-updates/test) to test without publishing:

1. **Set up.** In Play Console, enable internal app sharing and add your Google account as a tester. On the device, open **Play Store → Settings → About**, tap *Play Store version* 7 times, then turn on **Internal app sharing**.
2. **Install v1.** Build a release APK/AAB with `versionCode 1`, upload it to internal app sharing, open the link on the device and install it.
3. **Publish v2.** Bump to `versionCode 2`, build and upload again. Open the new link but **don't** tap *Update*. Just let Play see it.
4. **Try it.** Open the app from step 2. The Play update screen appears; press back and it appears again.

The [`example/`](example) app shows the current status and version info, and has a Mandatory/Flexible switch for this.

## Troubleshooting

| Problem | Cause / fix |
| --- | --- |
| `Install Error(-10): The app is not owned by any user on this device` | The app wasn't installed from Play (e.g. `yarn android`). Expected in dev. The hook reports `status: 'error'` and the app keeps working. Use `enabled: !__DEV__` |
| Update screen never shows | Make sure the installed `versionCode` is lower than the one on Play, and open the Play Store listing once so Play's cache refreshes |
| `status` is `unsupported` | You're on iOS or web. In-app updates are Android-only |

## Development

| Command | What it does |
| --- | --- |
| `yarn` | Install dependencies (Yarn 4, Node version from `.nvmrc`) |
| `yarn example android` / `yarn example ios` | Run the example app |
| `yarn test` | Unit tests (Jest) |
| `yarn typecheck` | TypeScript check |
| `yarn lint` | ESLint + Prettier |
| `yarn prepare` | Build `lib/` with react-native-builder-bob |

Project layout:

```
src/
  index.tsx              Public exports
  InAppUpdate.native.ts  Imperative API (Android/iOS)
  InAppUpdate.ts         Web fallback
  useInAppUpdate.ts      Mandatory/flexible update hook
  NativeInAppUpdate.ts   TurboModule spec
  types.ts               Public types
android/                 Kotlin module (com.inappupdate), Google Play Core app-update
ios/                     Objective-C++ module (no-op, reports unsupported)
example/                 Example app using the library from source
```

## Contributing

Contributions are welcome. See:

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE) © [Jayant Kumar](https://github.com/nameisjayant)
