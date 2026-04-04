# Steam Deployment

> **Purpose:** Documents the Steam build and deployment pipeline for Recall Rogue.
> **Source files:** `src-tauri/`, `steam/`, `src/services/steamService.ts`, `src/services/platformService.ts`, `src/services/storageBackend.ts`, `src-tauri/src/filesave.rs`

## App Identity

| Field | Value |
|---|---|
| App ID | 4547570 |
| Partner ID | 385085 |
| Publisher | Bramblegate Games |
| Developer | Damion Woods |
| Content Depot | 4547571 (shared, not used in builds currently) |
| Windows Depot | 4547572 (not shipping at launch) |
| Linux + SteamOS Depot | 4547573 (active at launch) |
| macOS Depot | 4547574 (active at launch) |

## Architecture

```
Vite Build (dist/)
    ↓
Database pipeline (post-build):
  scripts/build-curated-db.mjs  → public/curated.db
  scripts/obfuscate-db.mjs      → dist/curated.db (XOR), dist/facts.db (XOR)
    ↓
Tauri 2 Bundle (Rust + WebView)
    ↓
Platform Bundles:
  macOS: Recall Rogue.app (+ .dmg installer)
  Windows: Recall Rogue.exe (via NSIS installer)
  Linux: Recall Rogue.AppImage
    ↓
SteamPipe Upload (steamcmd + VDF configs)
    ↓
Steam CDN → Player Download
```

## Database Build Pipeline

### Curated Deck Compilation

The 77 JSON deck files in `data/decks/` are never shipped directly. At build time they are compiled into a single SQLite file:

```bash
npm run build:curated     # Compiles data/decks/*.json → public/curated.db
npm run build:obfuscate   # XOR-obfuscates public/facts.db and public/curated.db → dist/
npm run build             # Runs both of the above automatically after vite build
```

XOR obfuscation uses the `__RR_VERSION__` Vite build injection as the key. The obfuscated files cannot be opened directly with `sqlite3`. At runtime, `src/services/dbDecoder.ts` decodes them in-memory before passing the buffer to sql.js.

**Important:** Obfuscation targets `dist/` (the Vite output), not `public/`. Vite copies `public/` into `dist/` during the build — obfuscation runs after that copy step.

### Key files

| File | Purpose |
|------|---------|
| `scripts/build-curated-db.mjs` | Compiles JSON decks → SQLite |
| `scripts/obfuscate-db.mjs` | XOR-obfuscates both `.db` files in `dist/` |
| `src/services/dbDecoder.ts` | Runtime decoder — XOR-decodes buffer before sql.js load |
| `src/data/curatedDeckStore.ts` | Runtime loader — fetches `curated.db` via sql.js |

## File-Based Save System

### Overview

The Steam build uses file I/O instead of localStorage for save persistence. This is required for Steam Cloud compatibility and crash-safe saves.

`src/services/storageBackend.ts` provides two backends:
- `LocalStorageBackend` — wraps localStorage (web/mobile)
- `FileStorageBackend` — write-through cache + debounced file I/O (Tauri/desktop)

The active backend is selected at startup by `initStorageBackend()` in `main.ts`, which checks `platformService.isTauri`. All services (`saveService`, `runSaveService`, `profileService`, `cardPreferences`) call `getBackend()` and never reference localStorage directly.

### Rust I/O Commands (`src-tauri/src/filesave.rs`)

| Command | Signature | Notes |
|---------|-----------|-------|
| `fs_get_save_dir` | `() → Result<String>` | Creates dir if missing |
| `fs_write_save` | `(filename, data) → Result<()>` | Atomic via `.tmp` rename |
| `fs_read_save` | `(filename) → Result<Option<String>>` | null if not found |
| `fs_delete_save` | `(filename) → Result<()>` | no-op if not found |

All commands reject filenames containing `..`, `/`, `\`, or characters outside `[a-zA-Z0-9_\-.]` (path traversal prevention).

### Save File Layout

| File | Contents |
|------|----------|
| `profiles.json` | Profile list and active profile ID |
| `profile_{uuid}.json` | Full PlayerSave per profile |
| `run_active.json` | In-progress run checkpoint |
| `settings.json` | Audio, UI scale, accessibility prefs |

### Platform Save Directories

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/com.bramblegategames.recallrogue/saves/` |
| Windows | `%APPDATA%\com.bramblegategames.recallrogue\saves\` |
| Linux | `~/.local/share/com.bramblegategames.recallrogue/saves/` |

### Steam Auto-Cloud Configuration (Steamworks dashboard — not yet set)

To enable Steam Cloud Save, configure Auto-Cloud in the Steamworks App Admin:
1. **Root Override** — set to the platform save path above (per-OS)
2. **Include Pattern** — `saves/*.json`
3. **Quota** — 20 MB (default 1 GB limit is ample)
4. **Conflict resolution** — Steam compares timestamps and prompts the player

No Rust Steamworks SDK changes are needed — Auto-Cloud reads the files on disk automatically.

### Boot Init Order

In `main.ts`, the init sequence is:
1. `initStorageBackend()` — loads all save files into memory cache (async, awaited)
2. `migrateLocalStorageToFiles()` — one-time migration on first desktop launch
3. `initPlayer()` — reads from backend cache (synchronous after init)

`initPlayer()` MUST run after `initStorageBackend()` completes. `ProfileService` constructor runs before backend init and requires a `reload()` call after init to pick up file-based data.

## Local Build (macOS)

```bash
# Full production build
npm run steam:build

# Debug build (faster compile)
npm run steam:build:dev

# Output locations
src-tauri/target/release/bundle/macos/Recall Rogue.app    # ~750MB
src-tauri/target/release/bundle/dmg/Recall Rogue_*.dmg     # ~750MB
```

### Prerequisites
- Rust stable (1.94+): `rustup update stable`
- Tauri CLI 2.x: `cargo install tauri-cli`
- Xcode Command Line Tools: `xcode-select --install`

## SteamPipe Upload

### First-Time Setup
1. Install steamcmd: `brew install steamcmd`
2. Authenticate: `steamcmd +login <username> +quit` (Steam Guard prompt)
3. Create `.env.local` from `.env.local.example` with your Steam username

### Upload to Development Branch
```bash
steamcmd +login <username> +run_app_build steam/app_build_4547570.vdf +quit
```

### VDF Configuration
- `steam/app_build_4547570.vdf` — App-level config (references all depots)
- `steam/depot_build_4547572.vdf` — Windows depot
- `steam/depot_build_4547573.vdf` — Linux depot
- `steam/depot_build_4547574.vdf` — macOS depot

### Branch Strategy
| Branch | Purpose | Auto-set-live |
|---|---|---|
| `development` | Internal testing | No (manual in dashboard) |
| `staging` | Pre-release QA | No |
| `default` | Public release | Only via explicit promotion |

## Steamworks SDK Integration

### Working Features
- **Achievements** — `steamService.unlockAchievement(id)` → Rust → Steamworks SDK
- **Rich Presence** — Auto-updates per screen (combat, hub, library, shop, etc.)
- **Platform Detection** — `platformService.hasSteam` guards all Steam calls
- **File-Based Saves** — implemented (see above); ready for Steam Auto-Cloud configuration

### Stubbed (TODO)
- **Leaderboards** — Requires async callback handler
- **DLC Ownership** — Requires DLC configuration in dashboard

### Key Files
- `src-tauri/src/steam.rs` — Rust Steamworks wrapper
- `src-tauri/src/filesave.rs` — File I/O commands for save system
- `src-tauri/src/main.rs` — Tauri entry point, registers Steam + file commands
- `src/services/steamService.ts` — TypeScript IPC wrapper
- `src/services/storageBackend.ts` — Storage abstraction (localStorage / file backends)
- `src/services/platformService.ts` — Platform detection (Tauri/Capacitor/Web)
- `src-tauri/steam_appid.txt` — App ID for development (4547570)

## Steamworks Dashboard Checklist

Before first upload:
- [ ] Create depots (4547571 Content, 4547572 Windows, 4547573 Linux, 4547574 macOS)
- [ ] Set launch options per OS
- [ ] Create `development` branch
- [ ] Set content descriptors and age ratings
- [ ] Upload store page assets (see docs/marketing/steam-store-page.md)
- [ ] Set Coming Soon page live (2-week minimum before release)
- [ ] Configure Steam Auto-Cloud (saves/*.json pattern, per-OS root paths — see above)

## Cross-Platform CI (Planned)

GitHub Actions workflow `.github/workflows/steam-build.yml` will:
1. Build on macOS, Windows, Linux runners in parallel
2. Upload Linux (4547573) and macOS (4547574) depots via steamcmd
3. Set live on staging branch
4. Manual promotion to default via dashboard

Not yet implemented — local macOS builds are the current workflow.

## Version Management

Both files must stay in sync:
- `package.json` → `version` field
- `src-tauri/tauri.conf.json` → `version` field

Current: `0.1.0`
