#!/bin/bash
set -euo pipefail

# Steam Build Script — builds Tauri app and bundles libsteam_api.dylib
# Usage: ./scripts/steam-build.sh [--debug]
#
# The Tauri build does not automatically include libsteam_api.dylib in the .app
# bundle, but the recall-rogue binary links against it via @loader_path/libsteam_api.dylib.
# This script copies the dylib (built by steamworks-sys) into the .app bundle's
# MacOS directory after the Tauri build completes.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"

MODE="release"
CARGO_FLAG=""
if [[ "${1:-}" == "--debug" ]]; then
    MODE="debug"
    CARGO_FLAG="--debug"
fi

echo "[steam-build] Building frontend..."
cd "$PROJECT_ROOT"
npm run build

echo "[steam-build] Building Tauri ($MODE)..."
cd "$TAURI_DIR"
cargo tauri build $CARGO_FLAG

echo "[steam-build] Bundling libsteam_api.dylib..."

# Find the dylib built by steamworks-sys
DYLIB=$(find "$TAURI_DIR/target/$MODE/build" -name "libsteam_api.dylib" -path "*/steamworks-sys-*/out/*" | head -1)

if [[ -z "$DYLIB" ]]; then
    echo "[steam-build] ERROR: libsteam_api.dylib not found in build output!"
    exit 1
fi

# Find the .app bundle
APP_BUNDLE="$TAURI_DIR/target/$MODE/bundle/macos/Recall Rogue.app"
MACOS_DIR="$APP_BUNDLE/Contents/MacOS"

if [[ ! -d "$MACOS_DIR" ]]; then
    echo "[steam-build] ERROR: .app bundle not found at $APP_BUNDLE"
    exit 1
fi

cp "$DYLIB" "$MACOS_DIR/libsteam_api.dylib"
echo "[steam-build] Copied libsteam_api.dylib to $MACOS_DIR/"

# Verify
ls -la "$MACOS_DIR/"
echo ""
echo "[steam-build] Build complete!"
echo "  .app: $APP_BUNDLE"
du -sh "$APP_BUNDLE"
