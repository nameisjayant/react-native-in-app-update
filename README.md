# react-native-in-app-update

In-app updates for React Native: Google Play in-app updates on Android and App Store version check on iOS.

> 🚧 Work in progress — the public API is not final yet.

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

Requires React Native's New Architecture (TurboModules).

## Usage

```js
import { multiply } from 'react-native-in-app-update';

const result = multiply(3, 7);
```

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
- `android/` — Kotlin module (`com.inappupdate`), uses Google Play Core `app-update`
- `ios/` — Objective-C++ module
- `example/` — example app using the library from source

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
