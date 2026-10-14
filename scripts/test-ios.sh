#!/bin/bash
# Builds ios/InAppUpdateInfo.m + ios/Tests into an XCTest bundle and runs it.
# The code under test is Foundation-only, so it runs on the macOS toolchain
# without a simulator or React Native.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ios/build/InAppUpdateTests.xctest"
FRAMEWORKS="$(xcrun --show-sdk-platform-path)/Developer/Library/Frameworks"

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS"
cat >"$OUT/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.inappupdate.tests</string>
  <key>CFBundleExecutable</key><string>InAppUpdateTests</string>
  <key>CFBundlePackageType</key><string>BNDL</string>
</dict></plist>
PLIST

xcrun clang -fobjc-arc -fmodules -Wall -Werror -bundle \
  -F "$FRAMEWORKS" -framework Foundation -framework XCTest \
  -Wl,-rpath,"$FRAMEWORKS" \
  -I "$ROOT/ios" \
  "$ROOT/ios/InAppUpdateInfo.m" "$ROOT"/ios/Tests/*.m \
  -o "$OUT/Contents/MacOS/InAppUpdateTests"

xcrun xctest "$OUT"
