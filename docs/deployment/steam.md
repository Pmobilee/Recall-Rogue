# Steam Deployment

> **Purpose:** Documents the Steam build and deployment pipeline for Recall Rogue.
> **Source files:** `src-tauri/`, `steam/`, `src/services/steamService.ts`, `src/services/platformService.ts`

## App Identity

| Field | Value |
|---|---|
| App ID | 4547570 |
| Partner ID | 385085 |
| Publisher | Bramblegate Games |
| Developer | Damion Woods |
| Windows Depot | 4547571 |
| macOS Depot | 4547572 |
| Linux Depot | 4547573 |

## Architecture

```
Vite Build (dist/)
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
- `steam/depot_build_4547571.vdf` — Windows depot
- `steam/depot_build_4547572.vdf` — macOS depot
- `steam/depot_build_4547573.vdf` — Linux depot

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

### Stubbed (TODO)
- **Cloud Save** — Requires background callback thread in Rust
- **Leaderboards** — Requires async callback handler
- **DLC Ownership** — Requires DLC configuration in dashboard

### Key Files
- `src-tauri/src/steam.rs` — Rust Steamworks wrapper
- `src-tauri/src/main.rs` — Tauri entry point, registers Steam commands
- `src/services/steamService.ts` — TypeScript IPC wrapper
- `src/services/platformService.ts` — Platform detection (Tauri/Capacitor/Web)
- `src-tauri/steam_appid.txt` — App ID for development (4547570)

## Steamworks Dashboard Checklist

Before first upload:
- [ ] Create depots (4547571, 4547572, 4547573)
- [ ] Set launch options per OS
- [ ] Create `development` branch
- [ ] Set content descriptors and age ratings
- [ ] Upload store page assets (see docs/marketing/steam-store-page.md)
- [ ] Set Coming Soon page live (2-week minimum before release)

## Cross-Platform CI (Planned)

GitHub Actions workflow `.github/workflows/steam-build.yml` will:
1. Build on macOS, Windows, Linux runners in parallel
2. Upload all three depots via steamcmd
3. Set live on staging branch
4. Manual promotion to default via dashboard

Not yet implemented — local macOS builds are the current workflow.

## Version Management

Both files must stay in sync:
- `package.json` → `version` field
- `src-tauri/tauri.conf.json` → `version` field

Current: `0.1.0`
