#!/bin/bash
set -euo pipefail

# Steam Build, Test & Deploy Script
# Usage:
#   ./scripts/steam-build.sh              # Build only (release)
#   ./scripts/steam-build.sh --debug      # Build only (debug)
#   ./scripts/steam-build.sh --test       # Build + copy to Steam install + launch
#   ./scripts/steam-build.sh --test-only  # Copy existing build to Steam install + launch (no build)
#   ./scripts/steam-build.sh --deploy     # Build + upload to Steam via SteamPipe
#   ./scripts/steam-build.sh --deploy-only # Upload existing build (no build)
#
# Notes:
#   --test and --deploy are mutually exclusive.
#   The Tauri build does not automatically include libsteam_api.dylib in the .app
#   bundle, but the recall-rogue binary links against it via @loader_path/libsteam_api.dylib.
#   This script copies the dylib (built by steamworks-sys) into the .app bundle's
#   MacOS directory after the Tauri build completes.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
STEAM_INSTALL="/Users/damion/Library/Application Support/Steam/steamapps/common/Recall Rogue"
APP_ID="4547570"

MODE="release"
CARGO_FLAG=""
DO_BUILD=true
DO_TEST=false
DO_DEPLOY=false

for arg in "$@"; do
    case $arg in
        --debug)       MODE="debug"; CARGO_FLAG="--debug" ;;
        --test)        DO_TEST=true ;;
        --test-only)   DO_TEST=true; DO_BUILD=false ;;
        --deploy)      DO_DEPLOY=true ;;
        --deploy-only) DO_DEPLOY=true; DO_BUILD=false ;;
        *) echo "[steam] Unknown flag: $arg"; exit 1 ;;
    esac
done

if $DO_TEST && $DO_DEPLOY; then
    echo "[steam] ERROR: --test and --deploy are mutually exclusive."
    exit 1
fi

APP_BUNDLE="$TAURI_DIR/target/$MODE/bundle/macos/Recall Rogue.app"

# ── Build ──
if $DO_BUILD; then
    echo "[steam] Building frontend..."
    cd "$PROJECT_ROOT"
    npm run build
    # Note: npm run build includes obfuscation (obfuscate-db.mjs) as the final step.
    # Tauri's beforeBuildCommand also runs npm run build, which re-obfuscates dist/.

    echo "[steam] Building Tauri ($MODE)..."
    cd "$TAURI_DIR"
    cargo tauri build --bundles app $CARGO_FLAG

    echo "[steam] Bundling libsteam_api.dylib..."
    DYLIB=$(find "$TAURI_DIR/target/$MODE/build" -name "libsteam_api.dylib" -path "*/steamworks-sys-*/out/*" | head -1)
    if [[ -z "$DYLIB" ]]; then
        echo "[steam] ERROR: libsteam_api.dylib not found!"
        exit 1
    fi
    cp "$DYLIB" "$APP_BUNDLE/Contents/MacOS/libsteam_api.dylib"
    echo "[steam] libsteam_api.dylib bundled."
fi

# ── Verify build exists ──
if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "[steam] ERROR: No build found at $APP_BUNDLE"
    echo "[steam] Run without --test-only or --deploy-only first."
    exit 1
fi

# ── Test (copy to Steam install + launch) ──
if $DO_TEST; then
    # Kill any running instance first — Steam caches the old binary in memory
    echo "[steam] Killing any running instance..."
    pkill -f "Recall Rogue" 2>/dev/null || true
    sleep 1

    echo "[steam] Copying to Steam install..."
    rm -rf "$STEAM_INSTALL/Recall Rogue.app"
    cp -R "$APP_BUNDLE" "$STEAM_INSTALL/"
    echo "[steam] Installed to: $STEAM_INSTALL/"
    du -sh "$STEAM_INSTALL/Recall Rogue.app"
    echo "[steam] Launching via Steam..."
    open "steam://rungameid/$APP_ID"
    echo "[steam] Done! Game should be launching."
    exit 0
fi

# ── Deploy (upload via SteamPipe) ──
if $DO_DEPLOY; then
    ENV_FILE="$PROJECT_ROOT/.env.local"
    if [[ ! -f "$ENV_FILE" ]]; then
        echo "[steam] ERROR: .env.local not found. Create it with STEAM_USERNAME=your_username"
        exit 1
    fi
    STEAM_USER=$(grep STEAM_USERNAME "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
    if [[ -z "$STEAM_USER" ]]; then
        echo "[steam] ERROR: STEAM_USERNAME not set in .env.local"
        exit 1
    fi

    VDF="$PROJECT_ROOT/steam/app_build_4547570_mac.vdf"
    echo "[steam] Uploading to Steam as $STEAM_USER..."
    steamcmd +login "$STEAM_USER" +run_app_build "$VDF" +quit
    echo "[steam] Upload complete!"
    exit 0
fi

# ── Build-only summary ──
echo ""
echo "[steam] Build complete!"
echo "  .app: $APP_BUNDLE"
du -sh "$APP_BUNDLE"
echo ""
echo "Next steps:"
echo "  Test locally:  ./scripts/steam-build.sh --test-only"
echo "  Deploy:        ./scripts/steam-build.sh --deploy-only"
