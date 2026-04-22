#!/bin/bash
set -euo pipefail

# Steam Build, Test & Deploy Script
# Usage:
#   ./scripts/steam-build.sh              # Build macOS only (release)
#   ./scripts/steam-build.sh --debug      # Build macOS only (debug)
#   ./scripts/steam-build.sh --test       # Build macOS + copy to Steam install + launch
#   ./scripts/steam-build.sh --test-only  # Copy existing macOS build to Steam install + launch
#   ./scripts/steam-build.sh --deploy     # Build macOS + upload to Steam via SteamPipe
#   ./scripts/steam-build.sh --deploy-only # Upload existing macOS build (no build)
#   ./scripts/steam-build.sh --windows --deploy  # Cross-compile Windows + upload to Steam
#   ./scripts/steam-build.sh --windows           # Cross-compile Windows only (no upload)
#
# Notes:
#   --test and --deploy are mutually exclusive.
#   The Tauri build does not automatically include libsteam_api.dylib in the .app
#   bundle, but the recall-rogue binary links against it via @loader_path/libsteam_api.dylib.
#   This script copies the dylib (built by steamworks-sys) into the .app bundle's
#   MacOS directory after the Tauri build completes.
#
#   steam_appid.txt is also copied into Contents/MacOS/ so steamworks-rs finds it
#   in the CWD relative to the binary. (Tauri bundles it into Contents/Resources/
#   via the resources[] config, but steamworks-rs looks next to the executable.)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
STEAM_INSTALL="${HOME}/Library/Application Support/Steam/steamapps/common/Recall Rogue"
APP_ID="4547570"

MODE="release"
CARGO_FLAG=""
DO_BUILD=true
DO_TEST=false
DO_DEPLOY=false
PLATFORM="mac"

for arg in "$@"; do
    case $arg in
        --debug)       MODE="debug"; CARGO_FLAG="--debug" ;;
        --test)        DO_TEST=true ;;
        --test-only)   DO_TEST=true; DO_BUILD=false ;;
        --deploy)      DO_DEPLOY=true ;;
        --deploy-only) DO_DEPLOY=true; DO_BUILD=false ;;
        --windows)     PLATFORM="windows" ;;
        --linux)       PLATFORM="linux" ;;
        *) echo "[steam] Unknown flag: $arg"; exit 1 ;;
    esac
done

if $DO_TEST && $DO_DEPLOY; then
    echo "[steam] ERROR: --test and --deploy are mutually exclusive."
    exit 1
fi

APP_BUNDLE="$TAURI_DIR/target/$MODE/bundle/macos/Recall Rogue.app"

# ── Windows build (delegates to VM orchestrator) ──
# The Mac cargo-xwin path produced a broken 11 MB exe (missing embedded frontend).
# All Windows builds now go through scripts/steam-windows.sh → Windows VM → scp back.
# See docs/gotchas.md 2026-04-20 for the full story.
if [[ "$PLATFORM" == "windows" ]]; then
    WIN_ARGS=()
    $DO_BUILD   || WIN_ARGS+=(--deploy-only)
    $DO_DEPLOY  && WIN_ARGS+=(--deploy)
    if $DO_TEST; then
        echo "[steam] --test is not supported for Windows (no local .app to launch)."
        exit 1
    fi
    # Empty-array expansion under `set -u` errors without a default. Harmless when
    # no --deploy / --deploy-only flag was passed (build-only run).
    exec "$SCRIPT_DIR/steam-windows.sh" ${WIN_ARGS[@]+"${WIN_ARGS[@]}"}
fi

# ── Linux remote build (via SSH to Linux VM) ──
if [[ "$PLATFORM" == "linux" ]]; then
    LINUX_BUILD="$PROJECT_ROOT/steam/linux-build"
    LINUX_VDF="$PROJECT_ROOT/steam/app_build_4547570_linux.vdf"
    LINUX_STAGING="${LINUX_STAGING_DIR:-$PROJECT_ROOT/steam/linux-staging}"

    # Discover Linux VM IP
    echo "[steam] Discovering Linux VM..."
    LINUX_VM_SUBNET="${LINUX_VM_SUBNET:-192.168.11}"
    LINUX_VM_HOSTNAME="${LINUX_VM_HOSTNAME:-debian-vm}"
    LINUX_VM_USER="${LINUX_VM_USER:-damion}"
    LINUX_IP=""
    for ip in $(arp -a | grep "$LINUX_VM_SUBNET" | grep -oE "${LINUX_VM_SUBNET//./\.}\.[0-9]+" | grep -v '\.255$' | grep -v '\.1$'); do
        result=$(ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o BatchMode=yes "$LINUX_VM_USER@$ip" "hostname" 2>/dev/null)
        if [ "$result" = "$LINUX_VM_HOSTNAME" ]; then LINUX_IP="$ip"; break; fi
    done
    if [[ -z "$LINUX_IP" ]]; then
        echo "[steam] ERROR: Linux VM not found on network. Is it running in UTM?"
        exit 1
    fi
    echo "[steam] Found Linux VM at $LINUX_IP"

    if $DO_BUILD; then
        echo "[steam] Syncing source to Linux VM..."
        rsync -avz --progress \
          --exclude='src-tauri/target' --exclude='node_modules' --exclude='.git' \
          --exclude='data' --exclude='dist' --exclude='.video-tmp' \
          --exclude='.openclaude' --exclude='store-assets' --exclude='*.db' \
          --exclude='_archived_assets' --exclude='steam/output' \
          --exclude='steam/store-images' --exclude='steam/windows-build' \
          -e ssh "$PROJECT_ROOT/" "$LINUX_VM_USER@$LINUX_IP":~/recall-rogue/

        echo "[steam] Installing npm deps on Linux VM..."
        ssh -o ServerAliveInterval=30 "$LINUX_VM_USER@$LINUX_IP" "cd ~/recall-rogue && npm install 2>&1" | tail -5

        echo "[steam] Building Tauri on Linux VM (this will be slow — x86_64 emulated)..."
        ssh -o ServerAliveInterval=30 "$LINUX_VM_USER@$LINUX_IP" \
          "cd ~/recall-rogue && . ~/.cargo/env && npm run build && cd src-tauri && cargo tauri build --bundles deb 2>&1"

        echo "[steam] Staging Linux build artifacts..."
        ssh "$LINUX_VM_USER@$LINUX_IP" "mkdir -p ~/linux-build && cp ~/recall-rogue/src-tauri/target/release/recall-rogue ~/linux-build/ && cp ~/recall-rogue/src-tauri/steam_appid.txt ~/linux-build/"
        # Copy libsteam_api.so if present
        ssh "$LINUX_VM_USER@$LINUX_IP" "STEAMSO=\$(find ~/recall-rogue/src-tauri/target/release/build -name 'libsteam_api.so' -path '*/steamworks-sys-*/out/*' 2>/dev/null | head -1); if [ -n \"\$STEAMSO\" ]; then cp \"\$STEAMSO\" ~/linux-build/; fi"

        echo "[steam] Pulling artifacts back to Mac..."
        mkdir -p "$LINUX_STAGING" "$LINUX_BUILD"
        scp "$LINUX_VM_USER@$LINUX_IP":~/linux-build/* "$LINUX_STAGING/"
        cp "$LINUX_STAGING/recall-rogue" "$LINUX_BUILD/"
        [ -f "$LINUX_STAGING/libsteam_api.so" ] && cp "$LINUX_STAGING/libsteam_api.so" "$LINUX_BUILD/"
        cp "$LINUX_STAGING/steam_appid.txt" "$LINUX_BUILD/" 2>/dev/null || true

        echo "[steam] Linux build staged:"
        ls -lh "$LINUX_BUILD/"
    fi

    if $DO_DEPLOY || $DO_TEST; then
        ENV_FILE="$PROJECT_ROOT/.env.local"
        STEAM_USER=$(grep STEAM_USERNAME "$ENV_FILE" | cut -d= -f2 | tr -d ' ')

        echo "[steam] Checking Steam credentials..."
        if steamcmd +login "$STEAM_USER" +quit 2>&1 | grep -q "ERROR"; then
            echo "[steam] ⚠ Cached credentials expired. Re-authenticating..."
            steamcmd +login "$STEAM_USER" +quit
            if [ $? -ne 0 ]; then
                echo "[steam] ERROR: Authentication failed. Aborting deploy."
                exit 1
            fi
        fi

        echo "[steam] Uploading Linux build to Steam as $STEAM_USER..."
        steamcmd +login "$STEAM_USER" +run_app_build "$LINUX_VDF" +quit
        echo "[steam] Linux upload complete!"
    fi

    if ! $DO_BUILD && ! $DO_DEPLOY && ! $DO_TEST; then
        echo "[steam] Linux build ready at: $LINUX_BUILD"
        ls -lh "$LINUX_BUILD/"
    fi
    exit 0
fi

# ── macOS Build ──
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

    # steamworks-rs looks for steam_appid.txt in the CWD (next to the binary).
    # On macOS the binary lives in Contents/MacOS/, so copy it there.
    # tauri.conf.json also lists it under resources[] (copies to Contents/Resources/)
    # as belt-and-suspenders for future Tauri CWD changes.
    echo "[steam] Bundling steam_appid.txt..."
    cp "$TAURI_DIR/steam_appid.txt" "$APP_BUNDLE/Contents/MacOS/steam_appid.txt"
    echo "[steam] steam_appid.txt bundled."
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
    echo "[steam] Ready — launch from Steam when you're ready to test."
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

    VDF="$PROJECT_ROOT/steam/app_build_4547570_macos.vdf"

    # Pre-flight: test cached credentials before attempting upload.
    # steamcmd and the Steam desktop client share ~/Library/Application Support/Steam/
    # and fight over auth tokens, so cached creds go stale frequently with Steam Guard.
    echo "[steam] Checking Steam credentials..."
    if steamcmd +login "$STEAM_USER" +quit 2>&1 | grep -q "ERROR"; then
        echo ""
        echo "[steam] ⚠ Cached credentials expired. Re-authenticating..."
        echo "[steam] You'll be prompted for password + Steam Guard code."
        echo "[steam] (This happens because the Steam desktop client shares the token cache)"
        echo ""
        # Run in foreground so the user can enter password + Steam Guard interactively
        steamcmd +login "$STEAM_USER" +quit
        if [ $? -ne 0 ]; then
            echo "[steam] ERROR: Authentication failed. Aborting deploy."
            exit 1
        fi
        echo "[steam] ✓ Re-authenticated successfully."
    else
        echo "[steam] ✓ Cached credentials valid."
    fi

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
