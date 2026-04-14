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

### Steam Auto-Cloud Configuration (Configured)

Steam Auto-Cloud syncs the `saves/` directory across platforms without any Steamworks SDK code. Configured in Steamworks App Admin → Cloud.

**Root Path:**

| Field | Value |
|---|---|
| Root | `WinAppDataRoaming` |
| Subdirectory | `com.bramblegategames.recallrogue/saves` |
| Pattern | `*.json` |
| OS | `[All OSes]` |
| Recursive | No |

**Root Overrides** (cross-platform mapping):

| Original Root | OS | New Root | Subdirectory |
|---|---|---|---|
| `WinAppDataRoaming` | macOS | `MacApplicationSupport` | `com.bramblegategames.recallrogue/saves` |
| `WinAppDataRoaming` | Linux | `LinuxXdgDataHome` | `com.bramblegategames.recallrogue/saves` |

**Resolved paths per OS:**

| OS | Resolved Path |
|---|---|
| Windows | `%USERPROFILE%/AppData/Roaming/com.bramblegategames.recallrogue/saves/*.json` |
| macOS | `~/Library/Application Support/com.bramblegategames.recallrogue/saves/*.json` |
| Linux | `$XDG_DATA_HOME/com.bramblegategames.recallrogue/saves/*.json` |

No Rust Steamworks SDK changes needed — Auto-Cloud reads the files on disk automatically. Conflict resolution uses Steam's built-in timestamp comparison with player prompt.

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
- **Achievements** — `steamService.unlockAchievement(id)` → Rust → Steamworks SDK. 24 achievements defined; wired in `gameFlowController.ts`.
- **Rich Presence** — Auto-updates per screen via `steamPresenceWatcher.ts` (initialized at boot in `main.ts`). Combat shows floor + enemy name; hub/library/shop show contextual status.
- **Platform Detection** — `platformService.hasSteam` guards all Steam calls
- **File-Based Saves** — implemented (see above); ready for Steam Auto-Cloud configuration

### Stubbed (TODO)
- **Leaderboards** — Requires async callback handler
- **DLC Ownership** — Requires DLC configuration in dashboard

### Achievements

24 achievements defined in `src/data/steamAchievements.ts`. IDs must match the Steamworks dashboard exactly.

| ID | Name | Trigger |
|---|---|---|
| `FIRST_VICTORY` | First Blood | First combat win (`encountersWon` reaches 1) |
| `FIRST_RUN_COMPLETE` | The Scholar's Journey | Any run end (retreat, victory, or defeat) |
| `BOSS_SLAYER` | Boss Slayer | Defeat a boss |
| `FLOOR_5` | Deeper Knowledge | Reach floor 5 |
| `FLOOR_12` | Into the Depths | Reach floor 12 |
| `FLOOR_24` | The Final Test | Reach floor 24 |
| `PERFECT_ENCOUNTER` | Flawless Scholar | Win combat with 0 wrong answers |
| `STREAK_10` | Chain Master | 10-answer streak in a single run |
| `STREAK_25` | Unstoppable Mind | 25-answer streak in a single run |
| `LEVEL_5` | Novice | Reach character level 5 (triggers on level-up) |
| `LEVEL_15` | Adept | Reach character level 15 |
| `LEVEL_25` | Grand Scholar | Reach character level 25 |
| `RELIC_COLLECTOR` | Relic Hoarder | Collect 5+ relics in a single run |
| `FACTS_100` | Century of Knowledge | 100 cumulative correct answers (`stats.totalQuizCorrect`) |
| `FACTS_1000` | Encyclopedic Mind | 1000 cumulative correct answers |
| `ASCENSION_1` | Rising Challenge | Complete a run (non-defeat) at Ascension 1+ |
| `ASCENSION_5` | True Scholar | Complete a run (non-defeat) at Ascension 5+ |
| `ELITE_SLAYER` | Elite Hunter | 10 cumulative elite kills (`stats.totalElitesDefeated` — extended field) |
| `FACTS_5000` | Grand Librarian | 5000 cumulative correct answers (`stats.totalQuizCorrect`) |
| `MASTERY_FIRST` | First Mastery | 1 fact mastered (`stats.lifetimeFactsMastered >= 1`) |
| `MASTERY_100` | Centurion Scholar | 100 facts mastered (`stats.lifetimeFactsMastered >= 100`) |
| `MASTERY_500` | Living Encyclopedia | 500 facts mastered (`stats.lifetimeFactsMastered >= 500`) |
| `STREAK_7` | Week Warrior | 7-day play streak (`save.longestStreak >= 7`) |
| `DECK_EXPLORER` | Deck Explorer | 5 unique curated decks used across runs (`save.runHistory` unique `deckId` count) |

**Wiring points:**
- Combat victories: `onEncounterComplete()` in `gameFlowController.ts` — `FIRST_VICTORY`, `BOSS_SLAYER`, `PERFECT_ENCOUNTER`, and cumulative elite tracking
- Run end: `finishRunAndReturnToHub()` — floor/streak/relic/ascension/cumulative achievements
- Level-ups: inside XP award block in `finishRunAndReturnToHub()` — `LEVEL_5/15/25`

**Cumulative achievements** (`FACTS_100/1000/5000`, `ELITE_SLAYER`, `MASTERY_FIRST/100/500`, `STREAK_7`, `DECK_EXPLORER`) read from `playerSave` via `checkCumulativeAchievements()`. `ELITE_SLAYER` uses `stats.totalElitesDefeated` (an extended field on `PlayerStats` — not in the TypeScript interface, stored as `any` extension). Mastery achievements read `stats.lifetimeFactsMastered`; `STREAK_7` reads `save.longestStreak`; `DECK_EXPLORER` counts unique `deckId` values in `save.runHistory`.

### Dev Override Fix

The unconditional dev-mode save override (`characterLevel = 25`, `totalXP = 999999`, all relics unlocked) in `saveService.ts` is now guarded by `import.meta.env.DEV`. It will NOT execute in production builds.

New players created via `createNewPlayer()` now start at `characterLevel: 1` (was incorrectly hardcoded to 25).

### Key Files
- `src-tauri/src/steam.rs` — Rust Steamworks wrapper
- `src-tauri/src/filesave.rs` — File I/O commands for save system
- `src-tauri/src/main.rs` — Tauri entry point, registers Steam + file commands
- `src/services/steamService.ts` — TypeScript IPC wrapper (`unlockAchievement`, `updateRichPresence`, `setRichPresence`)
- `src/services/steamPresenceWatcher.ts` — Screen-to-Rich-Presence subscription (initialized in `main.ts`)
- `src/data/steamAchievements.ts` — Achievement definitions (ID, name, description)
- `src/services/storageBackend.ts` — Storage abstraction (localStorage / file backends)
- `src/services/platformService.ts` — Platform detection (Tauri/Capacitor/Web)
- `src-tauri/steam_appid.txt` — App ID for development (4547570)

## Steam Launch TODO

Comprehensive checklist for shipping Recall Rogue on Steam. Items grouped by phase.

### Phase 1 — Steamworks Dashboard Setup

- [ ] Create depots (4547571 Content, 4547572 Windows, 4547573 Linux, 4547574 macOS)
- [ ] Set launch options per OS (macOS: `.app`, Linux: AppImage)
- [ ] Create `development` and `staging` branches
- [ ] Set content descriptors and age ratings
- [x] Configure Steam Auto-Cloud (saves/*.json, per-OS root paths — see Save System section)
- [ ] Register 24 achievements in App Admin → Achievements (IDs from `steamAchievements.ts`)
- [ ] Upload achievement icons (locked + unlocked, 256×256 PNG) — use `/artstudio` to generate
- [ ] Configure Rich Presence localization tokens (optional — English hardcoded in `steamService.ts`)

### Phase 2 — Store Page

- [ ] Upload store page assets (see `docs/marketing/steam-store-page.md` for full spec)
  - [ ] Header capsule (460×215)
  - [ ] Small capsule (231×87)
  - [ ] Main capsule (616×353)
  - [ ] Hero graphic (3840×1240)
  - [ ] Page background (1438×810)
  - [ ] 8 screenshots (1920×1080) — see marketing doc for the 8-screenshot sequence
  - [ ] Library capsule (600×900)
  - [ ] Library hero (3840×1240)
  - [ ] Library logo (1280×720, transparent)
- [ ] Write store description (short + long)
- [ ] Set tags and categories
- [ ] Set Coming Soon page live (2-week minimum before release)
- [ ] Upload trailer (optional but strongly recommended)

### Phase 3 — Build & Test

- [ ] Bump version in `package.json` AND `src-tauri/tauri.conf.json` (must match)
- [ ] Full production build: `npm run steam:build`
- [ ] Local Steam test: `npm run steam:test` — verify launch, save/load, fullscreen toggle (F11)
- [ ] Verify save files appear in correct platform directory
- [ ] Test Steam overlay (Shift+Tab) doesn't break WebView rendering
- [ ] Verify achievements fire (use `steam_set_achievement` Steamworks debug in dev)
- [ ] Verify Rich Presence shows in Steam friends list
- [ ] Test offline mode — game must be fully playable with no network
- [ ] Verify XOR-obfuscated DBs load correctly in production bundle
- [ ] Check no dev flags leak to production (`import.meta.env.DEV` guards all dev overrides)
- [ ] Verify `createNewPlayer()` starts at level 1 (not 25)

### Phase 4 — Upload & QA

- [ ] First SteamPipe upload to `development` branch: `npm run steam:deploy`
- [ ] Download from Steam on a clean machine — verify first-run experience
- [ ] Test Steam Cloud sync: play on machine A, verify save appears on machine B
- [ ] Test auto-update flow (upload a second build, verify Steam patches correctly)
- [ ] Promote `development` → `staging` for wider QA

### Phase 5 — Pre-Release

- [ ] Set up Community Hub (discussions, guides)
- [ ] Configure language DLCs in Steamworks (if shipping with language packs)
  - [ ] Create DLC apps for each language (dlc_japanese, dlc_korean, etc.)
  - [ ] Wire `steam_has_dlc` Rust command once DLC IDs are registered
- [ ] Set up Trading Cards (optional, post-launch)
- [ ] Review partner.steamgames.com release checklist — Valve has their own requirements
- [ ] Final version bump + build + upload to `default` branch

### Phase 6 — Post-Launch (Deferred)

- [ ] Leaderboards — implement Rust async callback handler + `steam_get_leaderboard_entries`
- [ ] Background callback pump thread (`client.run_callbacks()` on ~16ms timer)
- [ ] GitHub Actions CI for cross-platform builds (Windows/Linux)
- [ ] Windows build testing (currently macOS + Linux only at launch)
- [ ] Steam Deck verification (Linux + gamepad controls)
- [ ] Workshop support — wire 6 Tauri UGC commands (`steam_ugc_create_item`, `steam_ugc_update_item`, `steam_ugc_subscribe`, `steam_ugc_browse`, `steam_ugc_get_my_items`, `steam_ugc_get_item_path`) in `src-tauri/src/steam.rs`. TypeScript service layer + UI already implemented in `workshopService.ts` and `WorkshopBrowser.svelte`. See `docs/content/anki-integration.md` §Steam Workshop Integration.

### Code-Complete Status (2026-04-12)

Triage of all Phase 1–6 items against current codebase state. Last verified against commits through `de54e6a`.

**Verified facts:**
- App ID `4547570` is set in `src-tauri/steam_appid.txt` and hardcoded in `src-tauri/src/steam.rs`.
- `package.json` and `src-tauri/tauri.conf.json` both report version `0.1.0` (in sync).
- `npm run steam:build`, `npm run steam:deploy`, and `npm run steam:test` scripts all exist in `package.json`.

#### Code-Complete (code written; needs dashboard action or manual test to verify)

- Steam App ID configured (`4547570` in `steam_appid.txt` and `steam.rs`)
- Achievement system wired: 24 achievements in `steamAchievements.ts`, triggered in `gameFlowController.ts` via `checkCumulativeAchievements()`
- Rich Presence wired: `steamPresenceWatcher.ts` initialized at boot, updates on every screen transition
- File-based save system implemented: `storageBackend.ts`, `filesave.rs`, atomic `.tmp` write pattern
- Settings migration completeness: 12 previously missing keys added to `migrateLocalStorageToFiles()`
- Confusion matrix capped at 5000 entries — unbounded save growth risk eliminated
- Dev-mode overrides guarded by `import.meta.env.DEV` — will not leak to production
- `createNewPlayer()` starts at level 1, not 25
- Production crash overlay in `index.html` — shows restart prompt before Svelte mounts on fatal error
- `errorReporting.ts` skips HTTP POST on Tauri builds (no server); uses `__RR_VERSION__` not a hardcoded string
- `npm run steam:build` script exists and targets Tauri release bundle
- XOR obfuscation pipeline in place (`build:curated` + `build:obfuscate` run automatically via `npm run build`)
- PNG metadata stripping scripts exist (`scripts/strip-asset-metadata.mjs`, `scripts/audit-asset-metadata.mjs`)
- VDF depot configs exist for all platforms (`steam/depot_build_454757{2,3,4}.vdf`)

#### Needs Dashboard Setup (must be done in partner.steamgames.com)

- Create depots 4547571–4547574 in App Admin
- Set launch options per OS (`.app` for macOS, AppImage for Linux)
- Create `development` and `staging` branches
- Set content descriptors and age ratings
- Register all 24 achievements — IDs from `steamAchievements.ts` must match exactly
- Upload achievement icons (locked + unlocked 256×256 PNG — not yet generated)
- Set Coming Soon page live (2-week lead time required before release)
- Upload store page assets (see `docs/marketing/steam-store-page.md` for full 9-asset spec)
- Write and publish store description (short + long copy)
- Set tags and categories

#### Needs Manual Testing (can only be verified by playing the game)

- Launch, save/load, and fullscreen toggle (F11) on a real Steam install (`npm run steam:test`)
- Save files appear in correct platform directory after first launch
- Steam overlay (Shift+Tab) does not break WebView rendering
- Achievements fire correctly — use Steamworks debug overlay to confirm each trigger
- Rich Presence visible to friends in Steam friend list
- Offline mode: fully playable with no network connection
- XOR-obfuscated DBs load correctly in production bundle (no sql.js errors)
- First-run experience on a clean machine (no prior save files)
- Steam Cloud sync: save on machine A appears on machine B
- PNG metadata stripped from all shipped assets (`node scripts/audit-asset-metadata.mjs dist/` exits 0)

#### Not Started / Post-Launch (deferred)

- Leaderboards (Rust async callback handler + TypeScript service layer)
- Background Steamworks callback pump thread
- GitHub Actions CI for cross-platform builds
- Windows build testing
- Steam Deck verification (Linux + gamepad controls)
- Workshop support (Rust UGC commands — TypeScript + UI layer already done)
- Language DLC configuration in Steamworks
- Trading cards

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

## PNG Metadata Stripping

503 PNG files in the repository (AI-generated sprites, card art, anatomy images) contain embedded metadata chunks (`tEXt`, `iTXt`, `zTXt`, `eXIf`) including "Made with Google AI" attribution tags. These must be stripped before shipping to Steam.

### Why strip metadata

- Exposes AI toolchain details to players via file inspection
- Inflates file sizes (84 KB total, ~168 bytes per file average)
- Some chunks constitute attribution notices that should not appear in shipped products

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/strip-asset-metadata.mjs` | Strips metadata chunks from `public/assets/*.png` in-place (no re-encoding) |
| `scripts/audit-asset-metadata.mjs` | CI gate — scans `dist/` and exits 1 if any PNG contains forbidden chunks |

### Usage

```bash
# Dry-run first (no files modified) — shows what will be stripped
node scripts/strip-asset-metadata.mjs --dry-run

# Apply — rewrites only files that have metadata chunks
node scripts/strip-asset-metadata.mjs

# After build, verify dist/ is clean
node scripts/audit-asset-metadata.mjs dist/
```

### Implementation

Both scripts use pure binary chunk surgery with no external dependencies (no `sharp`). PNG chunk format per RFC 2083: `[4B length][4B type][N bytes data][4B CRC]`. The strip script copies all chunks except the four forbidden types and writes back only if at least one chunk was removed. Pixel data is never modified.

### Pre-release checklist entry

Add to Phase 3 pre-release checklist:
- Strip metadata: `node scripts/strip-asset-metadata.mjs` → `npm run build`
- Audit: `node scripts/audit-asset-metadata.mjs dist/` must exit 0

### Affected asset directories (on 2026-04-07 baseline)

| Directory | Files with metadata | Total PNGs | Bytes removed |
|-----------|--------------------:|------------|---------------|
| sprites | 100 | 655 | 46.2 KB |
| cardart | 93 | 96 | 15.3 KB |
| sprites-hires | 81 | 254 | 13.3 KB |
| anatomy | 228 | 239 | 8.2 KB |
| reward_room | 1 | 10 | 1.3 KB |
