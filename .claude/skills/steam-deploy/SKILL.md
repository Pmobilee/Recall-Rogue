---
name: steam-deploy
description: "Build and deploy Recall Rogue to Steam — local Tauri builds, SteamPipe uploads, branch management, and release promotion."
user_invocable: true
---

# Steam Deploy — Build & Upload to Steam

Build the desktop app via Tauri and upload to Steam via SteamPipe. Manages development, staging, and production branches.

## Arguments

Parse the user's message for a subcommand:

| Subcommand | Description |
|---|---|
| `setup` | Verify toolchain (Rust, Tauri CLI, steamcmd), check auth, validate VDFs |
| `build` | Build Tauri app for macOS (local). Runs `./scripts/steam-build.sh` |
| `build debug` | Build debug variant (faster, larger) |
| `test` | Full build + copy to local Steam install + launch. `npm run steam:test` |
| `test quick` | Copy existing build to Steam install + launch (no rebuild, ~10s). `npm run steam:test:quick` |
| `deploy` | Full build + upload to Steam via SteamPipe (auto-sets-live). `npm run steam:deploy` |
| `deploy quick` | Upload existing build only (no rebuild). `npm run steam:deploy:quick` |
| `status` | Show last build info, git version, depot status |

If no subcommand is given, default to `test` (local).

## Deployment Modes

There are two deployment targets. **Default is local.**

| Mode | Command | What it does |
|---|---|---|
| **Local** (default) | `npm run steam:test` | Build + copy to local Steam install + launch. No internet needed. |
| **Local quick** | `npm run steam:test:quick` | Copy existing build to local Steam install + launch (no rebuild, ~10s). |
| **Cloud** | `npm run steam:deploy` | Build + upload to Steam cloud via SteamPipe. Requires steamcmd auth. |
| **Cloud quick** | `npm run steam:deploy:quick` | Upload existing build to Steam cloud (no rebuild). |

When the user says "deploy", "push to steam", or "update steam" without specifying cloud/online, **always use local** (`test` or `test quick`). Only use cloud deploy when the user explicitly says "cloud", "online", "SteamPipe", or "upload".

## Constants

```
APP_ID=4547570
PARTNER_ID=385085
DEPOT_CONTENT=4547571
DEPOT_WINDOWS=4547572
DEPOT_LINUX=4547573
DEPOT_MACOS=4547574
PROJECT_ROOT=/Users/damion/CODE/Recall_Rogue
TAURI_DIR=/Users/damion/CODE/Recall_Rogue/src-tauri
STEAM_DIR=/Users/damion/CODE/Recall_Rogue/steam
BUILD_OUTPUT_MAC=/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/
BUILD_OUTPUT_DMG=/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/dmg/
```

## Steps by Subcommand

### `setup`

Verify all toolchain components are installed and configured:

1. Check Rust toolchain:
   ```bash
   rustc --version && cargo --version
   ```

2. Check Tauri CLI:
   ```bash
   cargo tauri --version
   ```

3. Check steamcmd:
   ```bash
   which steamcmd || echo "NOT INSTALLED — run: brew install steamcmd"
   ```

4. Verify VDF configs exist:
   ```bash
   ls /Users/damion/CODE/Recall_Rogue/steam/*.vdf
   ```

5. Verify App ID is correct (not 480):
   ```bash
   cat /Users/damion/CODE/Recall_Rogue/src-tauri/steam_appid.txt
   ```
   Should show `4547570`. If it shows `480`, alert the user.

6. Test steamcmd authentication:
   ```bash
   steamcmd +login $(grep STEAM_USERNAME .env.local | cut -d= -f2) +quit
   ```
   If this fails, the user needs to run `steamcmd +login <username> +quit` interactively for Steam Guard.

7. Report status of all components.

### `build`

Build the production macOS app:

1. Clear Vite cache:
   ```bash
   rm -rf /Users/damion/CODE/Recall_Rogue/node_modules/.vite
   ```

2. Build frontend + Tauri:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && npm run steam:build
   ```
   This runs `npm run build` (Vite) then `cargo tauri build` (Rust + bundle).

3. Verify output:
   ```bash
   ls -la "/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/Recall Rogue.app"
   du -sh "/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/Recall Rogue.app"
   ```

4. Show version info:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && git describe --tags --always
   ```

5. Report: build success, output path, size, version.

### `build debug`

Same as `build` but uses debug variant (faster compile, larger binary):
```bash
cd /Users/damion/CODE/Recall_Rogue && npm run steam:build:dev
```

### `upload [branch]`

Upload the current build to Steam via SteamPipe:

1. Verify build exists:
   ```bash
   test -d "/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/Recall Rogue.app" || echo "NO BUILD FOUND — run /steam-deploy build first"
   ```

2. Determine branch (default: `development`):
   - Parse the user's message for a branch name
   - If `default` or `production`, **ASK FOR CONFIRMATION** — this is a public release

3. Update the VDF setlive field if needed. For development/staging:
   ```bash
   # The VDF setlive field controls which branch gets the build
   # Empty = don't auto-set-live, user promotes manually in dashboard
   ```

4. Run steamcmd upload:
   ```bash
   steamcmd +login $(grep STEAM_USERNAME /Users/damion/CODE/Recall_Rogue/.env.local | cut -d= -f2) +run_app_build /Users/damion/CODE/Recall_Rogue/steam/app_build_4547570.vdf +quit
   ```

5. Report: upload success/failure, build ID, branch.

6. Remind user: "Set this build live on the development branch in the Steamworks dashboard at partner.steamgames.com if it wasn't auto-set."

### `status`

Show current state:

1. Check if a build exists:
   ```bash
   ls -la "/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/Recall Rogue.app" 2>/dev/null && du -sh "/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/Recall Rogue.app" || echo "No macOS build found"
   ```

2. Show version:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && git describe --tags --always && git log --oneline -3
   ```

3. Check App ID:
   ```bash
   cat /Users/damion/CODE/Recall_Rogue/src-tauri/steam_appid.txt
   ```

4. Check Tauri version:
   ```bash
   grep '"version"' /Users/damion/CODE/Recall_Rogue/src-tauri/tauri.conf.json
   ```

5. Report table with: app version, build status, app ID, last 3 commits.

### `release`

Promote a build to the public default branch:

1. **ASK FOR EXPLICIT CONFIRMATION** — this makes the build downloadable by all Steam users
2. Show what will be released:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && git describe --tags --always && git log --oneline -5
   ```
3. Direct user to partner.steamgames.com > App Admin > SteamPipe > Builds to promote the build
4. Alternatively, re-upload with `setlive "default"` in the VDF

## Important Notes

- **steamcmd authentication** is interactive (Steam Guard) — the first login must be done by the user in a terminal: `steamcmd +login <username> +quit`
- **Depot IDs** must match what's configured in the Steamworks dashboard: DEPOT_CONTENT=4547571, DEPOT_WINDOWS=4547572, DEPOT_LINUX=4547573, DEPOT_MACOS=4547574. Only Linux (4547573) and macOS (4547574) are active at launch.
- **Cross-platform builds** (Windows/Linux) require GitHub Actions CI — see docs/deployment/steam.md
- **Build size** is ~750MB for macOS (includes all game assets). This is normal for Steam.
- **Version bumping**: Update `version` in both `package.json` and `src-tauri/tauri.conf.json` before release builds.

## Steamworks Dashboard Checklist

Before first upload, the user must configure in partner.steamgames.com:
- [ ] Create depots (4547571 Content, 4547572 Windows, 4547573 Linux, 4547574 macOS)
- [ ] Set launch options per OS (macOS: `Recall Rogue.app/Contents/MacOS/Recall Rogue`)
- [ ] Create a `development` branch for testing
- [ ] Set content descriptors and age ratings
- [ ] Configure Steam Cloud settings (optional, stubs exist in code)
