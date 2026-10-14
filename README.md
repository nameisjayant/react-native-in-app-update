# react-native-in-app-update

[![npm version](https://img.shields.io/npm/v/@nameisjayant/react-native-in-app-update.svg)](https://www.npmjs.com/package/@nameisjayant/react-native-in-app-update)
[![license](https://img.shields.io/npm/l/@nameisjayant/react-native-in-app-update.svg)](LICENSE)
![platform](https://img.shields.io/badge/platform-android%20%7C%20ios-3ddc84.svg)

**Keep every user on the latest version of your React Native app.**

A small, typed wrapper around the [Google Play In-App Updates API](https://developer.android.com/guide/playcore/in-app-updates) (Play Core `app-update` 2.1.0) on Android, and an App Store version check on iOS. Add one hook to your root component and users are prompted to update whenever a newer version is available: with Play's full-screen update screen on Android, and with your app's App Store page, shown inside the app, on iOS.

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
  - [iOS](#ios)
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
- 🍎 **iOS too.** Checks the App Store for a newer version and shows the App Store page inside your app (no extra setup or API keys).
- 🧩 **Imperative API** for full control: `checkForUpdate`, `startUpdate`, `completeUpdate`, `addInstallStateListener`.
- ⚡ **New Architecture.** Built as a TurboModule.
- 🛡️ **Safe on every platform.** Web is a no-op that reports `unsupported`, so the same code runs everywhere.

## Requirements

| Requirement | Version |
| --- | --- |
| React Native | New Architecture (TurboModules) enabled |
| Android `minSdkVersion` | 24+ |
| iOS | 15.1+ (React Native's minimum) |
| Distribution | Android: app must be **installed from Google Play**. iOS: app must be **live on the App Store** |

## Installation

```sh
npm install @nameisjayant/react-native-in-app-update
# or
yarn add @nameisjayant/react-native-in-app-update
```

On iOS, install pods:

```sh
cd ios && pod install
```

There are no extra setup steps on either platform. Autolinking adds the Play Core dependency on Android and links StoreKit on iOS.

## Quick start

Call the hook once in your root component:

```tsx
import { useInAppUpdate } from '@nameisjayant/react-native-in-app-update';

export default function App() {
  useInAppUpdate({ enabled: !__DEV__ });

  return <RootNavigator />;
}
```

That's all you need. When a new version is on Play or the App Store, users see the update screen and can't continue until they update.

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

On iOS, see [iOS](#ios).

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

### iOS

iOS has no equivalent of Play's in-app updates, so the library does what most iOS apps do:

1. `checkForUpdate()` looks up your bundle ID with Apple's public [iTunes Lookup API](https://performance-partners.apple.com/search-api) and compares the App Store `version` with your app's `CFBundleShortVersionString`. It uses the store for the device's region, then falls back to the US store.
2. `startUpdate()` shows your app's App Store page **inside the app** (`SKStoreProductViewController`). The user taps *Update* there. If the sheet can't load, it opens the App Store app instead.

The same hook works unchanged:

| Situation | `mandatory: true` (default) | `mandatory: false` |
| --- | --- | --- |
| Update available on app open/resume | Shows the App Store page | Shows the App Store page |
| User closes the page | Shows it again right away | `status` becomes `canceled`, app continues |
| User taps *Update* | iOS installs it and relaunches the app on the new version | Same |
| Device's iOS is older than the new version's minimum | Treated as no update | Same |

Things that differ from Android:

- `updateInfo.availableVersion` (e.g. `"2.1.0"`) and `updateInfo.releaseNotes` (the "What's New" text) are filled in. `availableVersionCode` and `updatePriority` are always `0`.
- `clientVersionStalenessDays` is the number of days since the App Store version was released, so you can force an update only after a grace period.
- `startUpdate()` always resolves `'canceled'` once the App Store page closes. Apple doesn't tell apps whether the user updated. If they did, iOS relaunches the app on the new version.
- `type` (`immediate`/`flexible`), `completeUpdate()` and `addInstallStateListener()` don't apply. They're accepted and do nothing.
- Apple's lookup can lag a few hours behind a new release, so not every user sees the update the moment it goes live.

## API reference

### `useInAppUpdate(options?)`

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mandatory` | `boolean` | `true` | Force the update: immediate flow (App Store page on iOS), shown again on cancel, flexible downloads installed automatically |
| `type` | `'immediate' \| 'flexible'` | `'flexible'` | Android flow to use when `mandatory` is `false` (ignored on iOS) |
| `checkOnMount` | `boolean` | `true` | Check for an update when the hook mounts (app open) |
| `checkOnResume` | `boolean` | `true` | Check again whenever the app returns to the foreground |
| `enabled` | `boolean` | `true` | Turn the hook off entirely (e.g. `!__DEV__`) |
| `onError` | `(error: Error) => void` | — | Called with any Play or App Store error |

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
| `checking` | Asking Play or the App Store for updates |
| `up_to_date` | No update available |
| `prompting` | The Play update screen or App Store page is showing |
| `canceled` | User dismissed the update screen (shown again when `mandatory`) |
| `downloading` | Flexible update is downloading |
| `downloaded` | Flexible update is ready; call `completeUpdate()` |
| `installing` | Update is being installed |
| `unsupported` | Platform has no in-app updates (web) |
| `error` | Something failed (see `error`) |

### Functions

| Function | Returns | Description |
| --- | --- | --- |
| `checkForUpdate()` | `Promise<UpdateInfo>` | Asks Google Play or the App Store whether a newer version is available |
| `startUpdate(type = 'immediate')` | `Promise<UpdateFlowResult>` | Shows the Play update UI, or the App Store page on iOS. Rejects if no update can be started (and always on web) |
| `completeUpdate()` | `Promise<void>` | Installs a downloaded flexible update. The app restarts. No-op on iOS |
| `addInstallStateListener(listener)` | `EventSubscription` | Listens to download/install progress. Call `.remove()` to unsubscribe. Never fires on iOS |

### Types

```ts
type UpdateType = 'immediate' | 'flexible';

type UpdateFlowResult = 'accepted' | 'canceled' | 'failed'; // always 'canceled' on iOS

type UpdateInfo = {
  updateAvailability: 'unknown' | 'not_available' | 'available' | 'in_progress' | 'unsupported';
  installStatus: InstallStatus;
  availableVersionCode: number;              // Play versionCode, 0 on iOS
  availableVersion: string | null;           // App Store version, null on Android
  releaseNotes: string | null;               // App Store "What's New", null on Android
  isImmediateAllowed: boolean;
  isFlexibleAllowed: boolean;
  clientVersionStalenessDays: number | null; // days since Play learned about / App Store released the update
  updatePriority: number;                    // 0–5, set via the Play Developer API, 0 on iOS
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
| **iOS** | App Store version check + in-app App Store page (see [iOS](#ios)) |
| **Web** | No-op. `checkForUpdate()` returns `updateAvailability: 'unsupported'`, the hook reports `status: 'unsupported'` |

`startUpdate()` throws on web. The hook never does, so it's safe to call unconditionally.

## Testing in-app updates

### Android

In-app updates only work for an app **installed from Google Play**. Use [internal app sharing](https://developer.android.com/guide/playcore/in-app-updates/test) to test without publishing:

1. **Set up.** In Play Console, enable internal app sharing and add your Google account as a tester. On the device, open **Play Store → Settings → About**, tap *Play Store version* 7 times, then turn on **Internal app sharing**.
2. **Install v1.** Build a release APK/AAB with `versionCode 1`, upload it to internal app sharing, open the link on the device and install it.
3. **Publish v2.** Bump to `versionCode 2`, build and upload again. Open the new link but **don't** tap *Update*. Just let Play see it.
4. **Try it.** Open the app from step 2. The Play update screen appears; press back and it appears again.

### iOS

The check uses your app's live App Store listing, so there's nothing to upload:

1. Set the app's bundle ID to one that's live on the App Store.
2. Set its *Version* (`CFBundleShortVersionString`) lower than the App Store version, e.g. `0.0.1`.
3. Run it on a device or simulator. The App Store page appears; close it and it appears again.

On the simulator the App Store page may not load (there's no App Store app), so test on a real device for the full flow.

The [`example/`](example) app shows the current status and version info, and has a Mandatory/Flexible (Optional on iOS) switch for this.

## Troubleshooting

| Problem | Cause / fix |
| --- | --- |
| `Install Error(-10): The app is not owned by any user on this device` | The app wasn't installed from Play (e.g. `yarn android`). Expected in dev. The hook reports `status: 'error'` and the app keeps working. Use `enabled: !__DEV__` |
| Update screen never shows | Make sure the installed `versionCode` is lower than the one on Play, and open the Play Store listing once so Play's cache refreshes |
| `status` is `unsupported` | You're on web or another platform without in-app updates |
| iOS: `status` is `up_to_date` though a new version is live | Apple's lookup can lag a few hours behind a release. Also check that the bundle ID matches the App Store app and that the device meets the new version's minimum iOS |
| iOS: `E_NOT_AVAILABLE` from `startUpdate()` | There's no newer App Store version for this device. Call `checkForUpdate()` first |

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
ios/                     Objective-C++ module, App Store lookup + SKStoreProductViewController
example/                 Example app using the library from source
```

## Contributing

Contributions are welcome. See:

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE) © [Jayant Kumar](https://github.com/nameisjayant)
