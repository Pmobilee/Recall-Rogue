#!/bin/bash
set -euo pipefail

# Steam Pre-Deploy Verification
# Run before ANY SteamPipe upload to catch missing files.
# Usage: npm run steam:verify [--platform mac|windows|linux|all]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"

PLATFORM="${1:-all}"
ERRORS=0
WARNINGS=0

red() { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

check_file() {
    local label="$1" path="$2" required="${3:-true}"
    if [[ -f "$path" ]]; then
        local size
        size=$(du -h "$path" | cut -f1)
        green "  ✓ $label ($size)"
    elif [[ "$required" == "true" ]]; then
        red "  ✗ $label — MISSING: $path"
        ERRORS=$((ERRORS + 1))
    else
        yellow "  ⚠ $label — missing (optional): $path"
        WARNINGS=$((WARNINGS + 1))
    fi
}

check_dir() {
    local label="$1" path="$2"
    if [[ -d "$path" ]]; then
        local size
        size=$(du -sh "$path" | cut -f1)
        green "  ✓ $label ($size)"
    else
        red "  ✗ $label — MISSING: $path"
        ERRORS=$((ERRORS + 1))
    fi
}

# ── Version sync check ──
echo "=== Version Sync ==="
PKG_VER=$(node -e "console.log(require('./package.json').version)")
TAURI_VER=$(node -e "console.log(JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')).version)")
if [[ "$PKG_VER" == "$TAURI_VER" ]]; then
    green "  ✓ Version: $PKG_VER (package.json = tauri.conf.json)"
else
    red "  ✗ Version mismatch: package.json=$PKG_VER, tauri.conf.json=$TAURI_VER"
    ERRORS=$((ERRORS + 1))
fi

# ── macOS ──
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "mac" || "$PLATFORM" == "macos" ]]; then
    echo ""
    echo "=== macOS (depot 4547574) ==="
    APP="$TAURI_DIR/target/release/bundle/macos/Recall Rogue.app"
    check_dir "Recall Rogue.app" "$APP"
    check_file "recall-rogue binary" "$APP/Contents/MacOS/recall-rogue"
    check_file "libsteam_api.dylib" "$APP/Contents/MacOS/libsteam_api.dylib"

    # Check binary linkage
    if [[ -f "$APP/Contents/MacOS/recall-rogue" ]]; then
        if otool -L "$APP/Contents/MacOS/recall-rogue" 2>/dev/null | grep -q "libsteam_api"; then
            green "  ✓ Binary links @loader_path/libsteam_api.dylib"
        else
            yellow "  ⚠ Binary does NOT link libsteam_api — Steamworks compiled out?"
            WARNINGS=$((WARNINGS + 1))
        fi

        # Check architecture
        ARCH=$(lipo -archs "$APP/Contents/MacOS/recall-rogue" 2>/dev/null || echo "unknown")
        if [[ "$ARCH" == *"arm64"* ]]; then
            green "  ✓ Architecture: $ARCH"
        else
            yellow "  ⚠ Architecture: $ARCH (expected arm64)"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi

    # Check VDF
    check_file "macOS depot VDF" "$PROJECT_ROOT/steam/depot_build_4547574.vdf"
fi

# ── Windows ──
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "windows" || "$PLATFORM" == "win" ]]; then
    echo ""
    echo "=== Windows (depot 4547572) ==="
    WIN="$PROJECT_ROOT/steam/windows-build"
    check_file "recall-rogue.exe" "$WIN/recall-rogue.exe"
    check_file "steam_api64.dll" "$WIN/steam_api64.dll"

    # Check exe architecture
    if [[ -f "$WIN/recall-rogue.exe" ]] && command -v file &>/dev/null; then
        FILE_INFO=$(file "$WIN/recall-rogue.exe" 2>/dev/null)
        if echo "$FILE_INFO" | grep -q "x86-64\|x86_64\|PE32+"; then
            green "  ✓ Architecture: x86_64 (64-bit)"
        else
            yellow "  ⚠ Architecture unclear: $FILE_INFO"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi

    # Note about WebView2
    yellow "  ℹ Note: WebView2 Runtime required on Windows. Not bundled (system dependency)."

    # Check VDF
    check_file "Windows depot VDF" "$PROJECT_ROOT/steam/depot_build_4547572.vdf"
fi

# ── Linux ──
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "linux" ]]; then
    echo ""
    echo "=== Linux (depot 4547573) ==="
    LINUX="$PROJECT_ROOT/steam/linux-build"
    check_file "recall-rogue" "$LINUX/recall-rogue"
    check_file "libsteam_api.so" "$LINUX/libsteam_api.so"

    # Check VDF
    check_file "Linux depot VDF" "$PROJECT_ROOT/steam/depot_build_4547573.vdf"
fi

# ── Common checks ──
echo ""
echo "=== Common Checks ==="
check_file "steam_appid.txt" "$TAURI_DIR/steam_appid.txt"

# Check App ID is correct
APP_ID=$(cat "$TAURI_DIR/steam_appid.txt" 2>/dev/null || echo "")
if [[ "$APP_ID" == "4547570" ]]; then
    green "  ✓ App ID: $APP_ID"
elif [[ "$APP_ID" == "480" ]]; then
    red "  ✗ App ID is 480 (Spacewar test app) — should be 4547570!"
    ERRORS=$((ERRORS + 1))
else
    yellow "  ⚠ App ID: $APP_ID (expected 4547570)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check PNG metadata (if dist/ exists)
if [[ -d "$PROJECT_ROOT/dist" ]]; then
    if [[ -f "$PROJECT_ROOT/scripts/audit-asset-metadata.mjs" ]]; then
        if node "$PROJECT_ROOT/scripts/audit-asset-metadata.mjs" "$PROJECT_ROOT/dist/" >/dev/null 2>&1; then
            green "  ✓ No AI metadata in dist/ PNGs"
        else
            red "  ✗ AI metadata found in dist/ PNGs — run: node scripts/strip-asset-metadata.mjs"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

# Check .env.local exists for steamcmd auth
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
    green "  ✓ .env.local exists (steamcmd auth config)"
else
    yellow "  ⚠ .env.local missing — needed for steamcmd login"
    WARNINGS=$((WARNINGS + 1))
fi

# ── Bundled JS marker scan (MP-STEAM-20260422-050) ──
# Sub-agents have repeatedly built and deployed bundled JS that does NOT contain
# the latest fix-marker strings — silent stale-cache reuse. This grep verifies
# the production bundle includes a known fix marker from each recent critical
# commit. Add new markers below as new BUG fixes land.
echo ""
echo "=== Bundled JS marker scan ==="

# Determine which bundled JS to scan — prefer Tauri bundle if present, else dist/.
SCAN_CANDIDATES=(
  "$TAURI_DIR/target/release/bundle/macos/Recall Rogue.app/Contents/Resources/dist"
  "$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Recall Rogue.app/Contents/Resources/dist"
  "$PROJECT_ROOT/steam/windows-build"
  "$PROJECT_ROOT/dist"
)
SCAN_DIR=""
for cand in "${SCAN_CANDIDATES[@]}"; do
  if [[ -d "$cand" ]]; then SCAN_DIR="$cand"; break; fi
done

if [[ -z "$SCAN_DIR" ]]; then
  yellow "  ⚠ No bundled JS dir found — run \`npm run build\` first."
  WARNINGS=$((WARNINGS + 1))
else
  echo "  scanning: $SCAN_DIR"

  # Marker list — grep -F (fixed string), recursive across all .js bundles.
  # Format: "MARKER_STRING|HUMAN_LABEL"
  # Add a new line for every BUG-fix that should be verifiable in the bundle.
  declare -a MARKERS=(
    "BUG 27|gameScreens-set lobby clobber fix (61a60edd9)"
    "preSendBuffer|BUG 25 transport buffer flush fix (82bf261ef)"
    "force_leave_active_lobby|host force-leave (Wave 1)"
    "active_lobby_id|BUG 24 LobbyChatUpdate filter (df09f5857)"
    "contentSelection|2026-04-09 mp:lobby:start contentSelection fix (eae6415f1)"
  )

  for entry in "${MARKERS[@]}"; do
    marker="${entry%%|*}"
    label="${entry##*|}"
    # Use grep -rqF on .js files only.
    if find "$SCAN_DIR" -type f -name '*.js' -print0 2>/dev/null | xargs -0 grep -qF -- "$marker" 2>/dev/null; then
      green "  ✓ marker present: $marker  ($label)"
    else
      red "  ✗ marker MISSING: $marker  ($label)"
      ERRORS=$((ERRORS + 1))
    fi
  done

  # Stale-fix marker REJECTIONS — strings that should NOT appear in the bundle
  # because they were removed in a recent fix. If found, the build is stale.
  declare -a STALE_MARKERS=(
    "'shop','rest','mystery'|gameScreens stale set (BUG 27 — removed in 61a60edd9)"
  )
  for entry in "${STALE_MARKERS[@]}"; do
    marker="${entry%%|*}"
    label="${entry##*|}"
    if find "$SCAN_DIR" -type f -name '*.js' -print0 2>/dev/null | xargs -0 grep -qF -- "$marker" 2>/dev/null; then
      red "  ✗ STALE marker present: $marker  ($label) — build was not refreshed"
      ERRORS=$((ERRORS + 1))
    else
      green "  ✓ stale marker absent: $marker"
    fi
  done
fi

# ── Summary ──
echo ""
echo "================================"
if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    green "✓ All checks passed. Ready to deploy."
elif [[ $ERRORS -eq 0 ]]; then
    yellow "⚠ $WARNINGS warning(s), 0 errors. Deploy is safe but review warnings."
else
    red "✗ $ERRORS error(s), $WARNINGS warning(s). Fix errors before deploying."
    exit 1
fi
