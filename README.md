# react-native-in-app-update

In-app updates for React Native: Google Play in-app updates on Android and App Store version check on iOS.

Uses the [Google Play In-App Updates API](https://developer.android.com/guide/playcore/in-app-updates) (Play Core `app-update` 2.1.0). By default every user is **forced onto the latest version**: each time the app opens or returns to the foreground it asks Play for an update and, if there is one, shows the full-screen Play update screen. Backing out of it shows it again.

On iOS (and web) the API is a safe no-op that reports `unsupported`.

## Installation

```sh
npm install react-native-in-app-update
# or
yarn add react-native-in-app-update
```

iOS:

```sh
cd ios && pod install
```

Requires React Native's New Architecture (TurboModules). Android minSdk 24.

## Usage

### Mandatory update (recommended)

Call the hook once in your root component:

```tsx
import { useInAppUpdate } from 'react-native-in-app-update';

export default function App() {
  useInAppUpdate(); // mandatory by default

  return <RootNavigator />;
}
```

What it does on Android:

| Situation | Behaviour |
| --- | --- |
| App opened / resumed, update available | Shows Play's full-screen **immediate** update |
| User backs out of the update screen | Shows it again straight away (or on next resume) |
| Immediate update was interrupted | Resumes it |
| Play doesn't allow immediate for this update | Downloads it as a flexible update and installs it automatically when done |
| Flexible update downloaded in an earlier session | Installs it on launch |
| No update / app not installed from Play | Does nothing (`status` = `up_to_date` / `error`) |

Disable it in dev builds (sideloaded apps can't use Play updates):

```tsx
useInAppUpdate({ enabled: !__DEV__ });
```

### Flexible update (optional)

The background-download flow from the Play docs, with your own "Reload" prompt:

```tsx
const { status, progress, completeUpdate } = useInAppUpdate({ mandatory: false });

{status === 'downloaded' && (
  <Snackbar text="An update has been downloaded" action="Reload" onPress={completeUpdate} />
)}
```

### Hook options

| Option | Default | Description |
| --- | --- | --- |
| `mandatory` | `true` | Force the update (immediate flow + re-prompt on cancel + auto-install) |
| `type` | `'flexible'` | Flow used when `mandatory` is `false` |
| `checkOnMount` | `true` | Check when the hook mounts (app open) |
| `checkOnResume` | `true` | Check whenever the app comes back to the foreground |
| `enabled` | `true` | Turn the hook off entirely |
| `onError` | — | Called with any Play error |

Returns `{ status, updateInfo, error, progress, checkNow, completeUpdate }`.
`status` is one of `idle`, `checking`, `up_to_date`, `prompting`, `canceled`, `downloading`, `downloaded`, `installing`, `unsupported`, `error`.

### Imperative API

```ts
import {
  checkForUpdate,
  startUpdate,
  completeUpdate,
  addInstallStateListener,
} from 'react-native-in-app-update';

const info = await checkForUpdate();
// { updateAvailability: 'available', availableVersionCode, isImmediateAllowed,
//   isFlexibleAllowed, clientVersionStalenessDays, updatePriority, ... }

if (info.updateAvailability === 'available' && info.isImmediateAllowed) {
  const result = await startUpdate('immediate'); // 'accepted' | 'canceled' | 'failed'
}

const sub = addInstallStateListener((s) => console.log(s.installStatus, s.bytesDownloaded));
sub.remove();
```

## Testing

In-app updates only work for an app **installed from Google Play**. A build installed from Android Studio / `yarn android` gets `Install Error(-10): The app is not owned by any user on this device` — the hook reports `status: 'error'` and the app keeps working.

Quickest way to test with [internal app sharing](https://developer.android.com/guide/playcore/in-app-updates/test):

1. In Play Console, enable internal app sharing and add your Google account as a tester. On the device, open Play Store → Settings → About → tap *Play Store version* 7 times, then turn on **Internal app sharing**.
2. Build a release APK/AAB with `versionCode 1`, upload it to internal app sharing, open the link on the device and install it.
3. Bump to `versionCode 2`, build and upload again. Open the new link but **don't** tap Update — just let Play see it.
4. Open the app installed in step 2. The Play update screen appears; press back and it appears again.

The `example/` app shows status, version info and a Mandatory/Flexible switch for this.

## Development

| Command | What it does |
| --- | --- |
| `yarn` | Install dependencies (Yarn 4, Node from `.nvmrc`) |
| `yarn example android` / `yarn example ios` | Run the example app |
| `yarn test` | Unit tests (Jest) |
| `yarn typecheck` | TypeScript check |
| `yarn lint` | ESLint + Prettier |
| `yarn prepare` | Build `lib/` with react-native-builder-bob |

Project layout:

- `src/` — TypeScript API and the TurboModule spec (`NativeInAppUpdate.ts`)
- `src/useInAppUpdate.ts` — the mandatory/flexible update hook
- `android/` — Kotlin module (`com.inappupdate`), uses Google Play Core `app-update`
- `ios/` — Objective-C++ module (no-op, reports `unsupported`)
- `example/` — example app using the library from source

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
