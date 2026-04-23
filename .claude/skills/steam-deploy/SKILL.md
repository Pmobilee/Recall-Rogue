---
name: steam-deploy
description: "Build and deploy Recall Rogue to Steam — local Tauri builds, SteamPipe uploads, branch management, and release promotion."
user_invocable: true
---

# Steam Deploy — Build & Upload to Steam

Build the desktop app via Tauri and upload to Steam via SteamPipe. Manages development, staging, and production branches.

## 🚨 Known-bad patterns the stack has burned us on (2026-04-22)

Read this before touching anything Steam/Tauri-adjacent. The multiplayer
debugging marathon of 2026-04-21 → 22 uncovered every item below; ignoring
any of them has cost 20+ rebuild cycles.

1. **macOS silently drops stdout + stderr from Steam-launched apps.** Tauri
   Windows release builds do the same (`windows_subsystem = "windows"`).
   Any `println!` / `eprintln!` is invisible unless `main.rs` redirects via
   `redirect_stdio_to_log_file()` (commit `a18cdb851`). Target file:
   `~/Library/Logs/Recall Rogue/debug.log` (macOS). DO NOT remove that
   redirect — it is the only way diagnostics land somewhere a player can
   read. JS console output also piped in via `rr_log` Tauri command +
   `rrLog()` TS helper.

2. **`steam_appid.txt` must be in `Contents/MacOS/`**, NOT
   `Contents/Resources/`. steamworks-rs looks next to the binary. The
   authoritative fix is the explicit `cp` step in `scripts/steam-build.sh`
   right after the `libsteam_api.dylib` copy. `bundle.resources[]` in
   `tauri.conf.json` is belt-and-suspenders only — it puts the file in
   Resources/, which steamworks doesn't find.

3. **`NSLocalNetworkUsageDescription` is required for macOS 15+.** Missing
   key → LAN `TcpListener` bind hangs silently → "LAN server start timed
   out" client-side toast. Delivered via `bundle.macOS.infoPlist` in
   `tauri.conf.json` pointing at `src-tauri/Info.plist`. That field is a
   **path string**, NEVER an inline dict — Tauri 2 errors with `invalid
   type: map, expected path string` if you try the dict shape.

4. **axum 0.7+ route syntax is `{param}`, not `:param`.** `lan.rs`
   Router::new().route() using `:lobbyId` panics at startup with
   "Path segments must not start with :". JS client times out waiting
   for a server that has already crashed.

5. **`steamworks::sys` is crate-private** in steamworks-rs 0.12.2. Don't
   try to call flat-C APIs through the `sys` re-export — `cargo check`
   fails with E0603. If the method isn't exposed on `Matchmaking` /
   `Friends` / `NetworkingMessages` you'd need `steamworks-sys` as a
   direct dep. Wave 12's `steam_request_lobby_data` hack was reverted —
   the function is now a no-op and Steam backfills metadata on its own
   through the background pump.

6. **`steam_run_callbacks` is no longer required.** A background thread
   spawned in `SteamState::new()` calls `client.run_callbacks()` every
   ~16 ms so async Steam callbacks (LobbyEnter_t, LobbyCreated_t,
   LobbyChatUpdate_t, leaderboard, cloud) fire without depending on the
   JS 100 ms polling cadence. Keep the Tauri command as a harmless safety
   net; don't rely on it.

7. **Steam auth: never kill the Steam desktop client.** `pkill`,
   `killall`, `osascript quit`, or any variant. Opening Steam between
   uploads clobbers steamcmd's cached token → `Cached credentials not
   found → ERROR (Invalid Password)`. Ask the user to Quit via macOS
   menu bar and re-login interactively. This rule has caused at least
   5 failed upload cycles across these two sessions.

8. **`steam_join_lobby` returns `Ok(())` which Tauri serialises to null.**
   Do NOT guard the kickoff with `if (kickoff === null) return null` —
   that treats the normal success path as IPC failure and skips
   `pollJoinResult`. Use `getLastSteamInvokeError()` delta to
   distinguish a thrown invoke from a normal unit return.

9. **Steam P2P peer IDs are SteamIDs, not LobbyIDs.** Both are 64-bit
   integers but a LobbyId is a chat-room endpoint, not a networking
   endpoint. Passing lobby_id to `acceptP2PSession` /
   `sendP2PMessage` returns `ConnectFailed` forever. The guest resolves
   the host via `getLobbyOwner(lobbyId)`; the host defers
   `transport.connect` and polls `lobby_members` every 300 ms via
   `startSteamHostPeerPoll` + auto-accepts via the raw
   `LobbyChatUpdate` callback.

10. **Svelte $state and external mutation.** CardApp.svelte gets a lobby
    object from the service's `onLobbyUpdate`. Assigning the same
    reference back to a `$state` variable does NOT retrigger `$derived`
    computations downstream. Always `{ ...lobby, players: [...lobby.players] }`
    on the update callback to force a fresh reference.

11. **Steam Partner fee ≠ Steam Store purchase.** A dev account that
    paid the $100 Steamworks submission is STILL a Limited User for
    matchmaking purposes. Requires $5+ in the Steam Wallet for
    ChatRoomEnterResponse::Limited (code 7) to clear.

12. **Steam overlay is architecturally incompatible with Tauri.**
    Tauri issue [#6196](https://github.com/tauri-apps/tauri/issues/6196)
    closed as "not planned". WebView2/WKWebView render in a separate GPU
    process that Steam's overlay hook doesn't reach. The diagnostic
    (`steam_overlay_status` + `GameOverlayActivated` callback) can
    confirm hook state, but there is no known fix. Document and move on.

## Log path quick reference

The single debug.log file is where all Rust `println!` / `eprintln!` + JavaScript
`rrLog()` output lands. Both Steam-launched and direct-exe launches write here;
in a Steam launch there is NO console, so this file is the only evidence of
what happened. Check it FIRST for any "game launched but broke" report.

| Platform | Path |
|---|---|
| **macOS** | `~/Library/Logs/Recall Rogue/debug.log` |
| **Windows (Steam install)** | `%LocalAppData%\Recall Rogue\debug.log` (via `SetStdHandle` redirect wired in `main.rs`; commit c9d24721d) |
| **Windows (VM pre-install artifact)** | Same as above once the exe runs in the VM |
| **Linux** | `~/.cache/recall-rogue/debug.log` |

JS console output reaches this file via the `rr_log` Tauri command and
`src/services/rrLog.ts`. The file is append-only across app launches — look
for `[Steam] Initialized successfully` lines to find launch boundaries.

### Grep cheat sheet (read in order)

```bash
# Quick health — was the app even alive recently?
tail -50 "~/Library/Logs/Recall Rogue/debug.log"

# Count app launches captured in the file
grep -c "Initialized successfully" "~/Library/Logs/Recall Rogue/debug.log"

# Multiplayer lobby lifecycle (host and guest)
grep -E "mp:createLobby|mp:joinById|mp:joinCode|mp:hostpoll|mp:lobby|mp:broadcast" debug.log

# P2P transport & session handshake
grep -E "mp:tx|session_request|session_failed|P2P message sent|P2P send failed|receive_messages_on_channel|auto-accepting P2P|LobbyChatUpdate" debug.log

# Coop enemy sync — send/recv events per card play
grep "mp:coop" debug.log

# Game-start guard failures (the kind that silently loop mp:lobby:start)
grep -E "mp:lobby:start|missing fields|Couldn't start|aborting to prevent" debug.log

# Deck/content selection flow
grep -E "mp:deck|contentSelection|setContentSelection" debug.log

# Receive heartbeat — flags when the 60Hz poll loop is running but silent
grep "mp:rx" debug.log

# Failsafe watchdogs — all stuck-state detections and repairs
grep "watchdog:" debug.log

# Specific watchdog areas:
grep "watchdog:hand" debug.log         # Class A: empty hand / AP stuck states
grep "watchdog:enemy" debug.log        # Class B: invalid enemy HP at encounter start
grep "watchdog:coop" debug.log         # Class C: coop HP clamp + delta bucket overflow
grep "watchdog:reconcile" debug.log    # Class C: coop initial-state reconcile failures
grep "watchdog:barrier" debug.log      # Class C: turn-end barrier cancellations
grep "watchdog:combatScene" debug.log  # Class E: Phaser scene null during combat
grep "watchdog:runState" debug.log     # Class F: run state null during active encounter
grep "watchdog:cardPlay" debug.log     # Class A: committed-quiz open/resolve events
```

### Tag prefixes

| Prefix | Source | What it covers |
|---|---|---|
| `[Steam]` | Rust `println!` (`steam.rs`) | Steamworks init, lobby callbacks, P2P send/recv drain, session callbacks, LobbyChatUpdate, overlay hook |
| `[LAN]` | Rust `println!` (`lan.rs`) | LAN server bind/accept, mDNS, macOS local-network permission hint |
| `[stdio]` | Rust `main.rs` | Stdio redirect confirmation on launch |
| `[js:mp:lobby]` | `multiplayerLobbyService.ts` | Lobby state changes, notifyLobbyUpdate, broadcastSettings |
| `[js:mp:tx]` | `multiplayerTransport.ts` | Transport state, preConnect/preSend buffer flushes, send/recv dispatch |
| `[js:mp:peer]` | `multiplayerLobbyService.ts` | resolveSteamPeerId attempts, retry exhaustion |
| `[js:mp:hostpoll]` | `multiplayerLobbyService.ts` | Host-side peer-wait loop (ticks every ~300ms) |
| `[js:mp:deck]` | `multiplayerLobbyService.ts` | setContentSelection PRE/POST state logs |
| `[js:mp:broadcast]` | `multiplayerLobbyService.ts` | broadcastSettings with seq number |
| `[js:mp:recv]` | `multiplayerLobbyService.ts` | Message handlers (mp:lobby:join, mp:lobby:ready, etc.) |
| `[js:mp:coop]` | `multiplayerCoopSync.ts` | initCoopSync, enemy_state / enemy_hp_update send+recv |
| `[js:mp:rx]` | `steamNetworkingService.ts` | Poll-loop heartbeat (every 5s, flags silent windows) |
| `[js:mp:createLobby]` / `[js:mp:joinCode]` / `[js:mp:joinById]` | `multiplayerLobbyService.ts` | Entry-point logs |
| `[js:mp:ui:lobby]` | `MultiplayerLobby.svelte` | Render-time forensic dumps of content selection |
| `[js:watchdog:hand]` | `failsafeWatchdogs.ts` | Empty-hand / AP stuck state; repair log on recovery |
| `[js:watchdog:enemy]` | `failsafeWatchdogs.ts` | Invalid HP / empty intent pool at encounter start |
| `[js:watchdog:coop]` | `failsafeWatchdogs.ts` | HP clamp on wire + delta bucket overflow |
| `[js:watchdog:reconcile]` | `failsafeWatchdogs.ts` | Coop initial enemy-state reconcile timeout |
| `[js:watchdog:barrier]` | `failsafeWatchdogs.ts` | Turn-end barrier cancel (partner drop / timeout) |
| `[js:watchdog:combatScene]` | `failsafeWatchdogs.ts` | Phaser scene null >5s during active combat |
| `[js:watchdog:runState]` | `failsafeWatchdogs.ts` | activeRunState null during active encounter |
| `[js:watchdog:cardPlay]` | `failsafeWatchdogs.ts` | Card committed-quiz open/resolve events |

### What "silent" looks like

- No `mp:lobby` lines after `Initialized successfully` → app didn't enter multiplayer.
- `mp:hostpoll started` with no `peer detected` → no guest joined the Steam lobby.
- `mp:tx state connected` with no `recv dispatched` → P2P open but nothing arriving — check the other side's log.
- `mp:rx heartbeat { silent: true, sinceStart: 15s }` → poll loop alive but Steam returning zero messages.
- Repeated `mp:lobby:start` sends with matching `start_ack` but no `gameStart` firing → host-side start-guard rejected the payload (look for `missing fields` above).

## 🚨 RULE: Claude NEVER kills the Steam desktop client. The USER does.

steamcmd and the Steam desktop client share `~/Library/Application Support/Steam/config/config.vdf`. When Claude force-quits Steam via `pkill`, `pkill -9`, `killall`, or `kill -9` — especially against the `ipcserver` or `Steam.AppBundle` family — the shared config gets written mid-flush and the cached steamcmd credentials are invalidated. The next steamcmd login then reports `Cached credentials not found` → empty password prompt in non-interactive shell → `ERROR (Invalid Password)` → exit 5. Every upload fails until the USER does a fresh interactive login. This was observed repeatedly on 2026-04-20 (at least four failed upload cycles traced to Claude-initiated `pkill`).

**The rule, no exceptions:**

- **Never** run `pkill`, `pkill -9`, `killall`, `osascript -e 'quit app "Steam"'`, or any variant that touches `Steam`, `Steam Helper`, `Steam.AppBundle`, `steam_osx`, `ipcserver`, or the Steam process family. Not even the "clean" AppleScript quit — Steam's watchdog reacts by rewriting config on the way down, and the race is the same.
- **If the Steam client must be quit** (because its running instance is rewriting `config.vdf` and invalidating steamcmd's cache mid-upload), ask the USER to quit it via **Steam menu → Quit** in the macOS menu bar, then wait for them to confirm.
- **After any auth failure**, ask the user to run interactive login themselves:
  ```bash
  steamcmd +login bramblegate_games
  # password, Steam Guard code, "Waiting for user info...OK", then: quit
  ```
  Then ask them NOT to relaunch Steam until the upload finishes.

This is a session-scoped rule the user re-stated explicitly on 2026-04-20 after Claude cost multiple upload cycles by force-killing Steam trying to "help" with auth. Don't repeat the mistake.

## 🚨 RULE: Never push a content-identical build to any depot. Prove the build is NEW before claiming success.

On 2026-04-20 the Windows pipeline silently shipped the same stale exe (BuildID 22863831 from 1:27am) six consecutive times across the session. Every Windows "upload" claimed a new BuildID (22865375 → 22865669 → 22867059 → 22867651 → 22867790), but each one had byte-identical depot content to the 1:27am build — so the Steamworks merge UI kept pointing at 22863831 for Windows and kept reporting "no changes" whenever the user tried to promote a newer one.

Root causes, all independent, all silent:
1. `vm-build-windows.ps1` had em-dashes (U+2014) in comments. PowerShell 5.1 reads files without BOM using the system's ANSI codepage (Windows-1252). The em-dash's UTF-8 byte 0x94 is Right Double Quotation Mark in cp1252, which opens an unclosed string literal — the whole script fails to parse before step 1 runs.
2. The Mac `tar` that ships source to the VM included only `scripts/vm-build-windows.ps1` by name, not the whole `scripts/` dir. Once the PS parse error was fixed, step 3 failed because all the inline build helpers (`strip-asset-metadata.mjs`, `build-facts-db.mjs`, etc.) were absent on the VM.
3. PowerShell's `exit $LASTEXITCODE` inside `Check-Exit` does NOT reliably propagate through SSH → cmd.exe → `powershell -File` + redirection. The remote shell reports exit 0 even after the PS script printed `STEP FAILED` and called `exit 1`. `steam-windows.sh`'s `$VM_EXIT` check passes, the stage step scp's the stale pre-existing `recall-rogue.exe` from `target/x86_64-pc-windows-msvc/release/` back to the Mac, and the upload proceeds.
4. SteamPipe's chunk-level dedup then reports "Uploading content... done in 9 seconds" because the content hashes all match. Looks like a normal fast-cached upload.

**The rule, no exceptions:**

Before claiming a build was pushed, prove it is actually new content. Three cross-checks; any one of them failing means do NOT report success — report the failure and diagnose.

1. **Build-log marker.** The VM script must print `BUILD_OK` at the very end. `steam-windows.sh` now grep-bails if that marker is missing — do not remove or weaken that check. For macOS (native) trust `cargo tauri build`'s `Finished release profile` line in the log plus the `.app` mtime.
2. **Wall-clock sanity.** A fresh Windows VM build from cold cargo cache is 6–8 min; from warm cache it's 3–5 min; a "build" that finishes in under 2 min end-to-end (tar → scp → VM → pull → stage) is almost certainly a stale-exe reuse. If the `Done in Ns` report shows N < 120, dig into the VM log before reporting success.
3. **Upload-byte sanity.** SteamPipe's output under `Uploading content...` shows actual megabytes transferred. A fresh build with real TypeScript changes normally transfers 100–900 MB of new chunks (the embedded `dist/` varies, cargo's linker output varies). An upload that goes straight from `Uploading content...` to `Successfully finished` with no MB lines is a 100% chunk-dedup cache hit — the depot content is identical to the last upload. Cross-check against the source diff: if there were source changes since the last successful upload on this depot, a zero-byte upload is a bug, not an optimization. Call it out.

When any of the three trips, do NOT tell the user the build was pushed. Say: "Upload succeeded on SteamPipe but the content is identical to BuildID &lt;prev&gt; — the staged exe is likely stale. Investigating." Then inspect `/Users/damion/CODE/WINDOWS_VM/vm-build-*.log` (latest), look for `STEP FAILED`, `MODULE_NOT_FOUND`, `rustc-LLVM ERROR`, and report specifically.

This rule applies to **all three depots** — Windows (4547572), macOS (4547574), Linux (4547573). macOS has never had the problem historically because it's a native local build, but the same sanity checks apply.


## Arguments

Parse the user's message for a subcommand:

| Subcommand | Description |
|---|---|
| `setup` | Verify toolchain (Rust, Tauri CLI, steamcmd, cargo-xwin), check auth, validate VDFs |
| `build` | Build Tauri app for macOS (local). Runs `./scripts/steam-build.sh` |
| `build debug` | Build debug variant (faster, larger) |
| `build windows` | Build Windows exe on UTM VM via `./scripts/steam-windows.sh` (no deploy) |
| `test` | Full build + copy to local Steam install + launch. `npm run steam:test` |
| `test quick` | Copy existing build to Steam install + launch (no rebuild, ~10s). `npm run steam:test:quick` |
| `deploy` | Full build + upload to Steam via SteamPipe (auto-sets-live). `npm run steam:deploy` |
| `deploy quick` | Upload existing build only (no rebuild). `npm run steam:deploy:quick` |
| `deploy windows` | Build Windows on VM + upload to Steam. `./scripts/steam-windows.sh --deploy` |
| `deploy linux` | SSH to Linux VM, cross-compile, pull artifacts, upload to Steam depot 4547573. `npm run steam:linux` |
| `status` | Show last build info, git version, depot status |

If no subcommand is given, default to `test` (local).

## Deployment Modes

**Default is local macOS.**

| Mode | Command | What it does |
|---|---|---|
| **Local macOS** (default) | `npm run steam:test` | Build + copy to local Steam install + launch. No internet needed. |
| **Local quick** | `npm run steam:test:quick` | Copy existing build to local Steam install + launch (no rebuild, ~10s). |
| **Cloud macOS** | `npm run steam:deploy` | Build macOS + upload to Steam cloud via SteamPipe. Requires steamcmd auth. |
| **Cloud quick** | `npm run steam:deploy:quick` | Upload existing macOS build to Steam cloud (no rebuild). |
| **Windows build** | `./scripts/steam-windows.sh` | Build on UTM Win VM — tar+scp sync, cargo x86_64, produces ~1.35 GB exe (~7 min). |
| **Windows deploy** | `./scripts/steam-windows.sh --deploy` | Build + upload to Steam depot 4547572 (setlive=default in VDF). |
| **Linux deploy** | `npm run steam:linux` | SSH to Linux VM, cross-compile, pull artifacts, upload to Steam depot 4547573. Use `--linux` flag on `steam-build.sh`. |

When the user says "deploy", "push to steam", or "update steam" without specifying cloud/online, **always use local** (`test` or `test quick`). Only use cloud deploy when the user explicitly says "cloud", "online", "SteamPipe", or "upload".

## Windows Build — UTM VM via `steam-windows.sh`

Windows builds run on the Windows 11 ARM64 VM (UTM, bridged networking). The Mac `cargo-xwin` cross-compile path is **deprecated and broken** — it produces an 11 MB exe missing the embedded Tauri frontend. See `docs/gotchas.md` 2026-04-20.

**Canonical command:**
```bash
./scripts/steam-windows.sh [flags]
```

Flags: `--deploy` (upload after build), `--deploy-only` (upload existing staged exe), `--setlive=<branch>` (override VDF branch), `--skip-npm` (deps unchanged), `--frontend-only` (skip cargo), `--vm-ip=<ip>` (pin IP).

The script: auto-discovers the VM, pre-flights the pagefile (must be ≥30 GB), tars the source (~1.7 GB), `scp`s to the VM, runs `scripts/vm-build-windows.ps1`, pulls back the ~1.35 GB exe, stages into `steam/windows-build/`, and optionally uploads via `steamcmd`. `steam-build.sh --windows` delegates to this script.

Output: `steam/windows-build/recall-rogue.exe` (~1.35 GB) + `steam_api64.dll` + `steam_appid.txt`

Total time (measured 2026-04-20): ~7 min build with cached cargo deps, +25 min steamcmd upload.

See `.claude/skills/windows-vm/SKILL.md` for VM setup, pagefile recipe, and troubleshooting.

## Linux Build Support (via SSH VM)

Linux builds cross-compile from macOS by SSHing to a Linux VM, building there, and pulling artifacts back. Requirements:
- Linux VM accessible via SSH (see `~/.claude-intelligents/projects/*/memory/reference_windows_vm.md` for VM setup patterns)
- `--linux` flag on `scripts/steam-build.sh`: `./scripts/steam-build.sh --linux`
- Output: pulled to `steam/linux-build/` before SteamPipe upload to depot 4547573

```bash
# Build Linux only
./scripts/steam-build.sh --linux

# Full deploy including Linux
npm run steam:linux
```

## Constants

```
APP_ID=4547570
PARTNER_ID=385085
DEPOT_CONTENT=4547571          # DEPRECATED — being removed from packages; do not upload to
DEPOT_WINDOWS=4547572
DEPOT_LINUX=4547573
DEPOT_MACOS=4547574
PROJECT_ROOT=/Users/damion/CODE/Recall_Rogue
TAURI_DIR=/Users/damion/CODE/Recall_Rogue/src-tauri
STEAM_DIR=/Users/damion/CODE/Recall_Rogue/steam
BUILD_OUTPUT_MAC=/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/
BUILD_OUTPUT_DMG=/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/dmg/
```

## ⚠️ Launch Options: NEVER allow trailing whitespace in Executable field

Steamworks → Installation → Launch Options stores leading/trailing whitespace verbatim, but the UI hides it. A single trailing space after `recall-rogue.exe` causes Steam's Play button to error with "missing game executable = C:\...\recall-rogue.exe" even though the file exists at that exact path, verify integrity passes, and double-click works. Event Viewer logs nothing because Steam's pre-launch existence check fails before any CreateProcess attempt. See `docs/gotchas.md` 2026-04-20 for the full case study.

Whenever editing a Launch Option: click into the Executable field → press End → confirm the cursor sits flush against the last character → Save → **Publish changes (top of App Admin).** Same rule for the Install Folder field — invisible trailing whitespace there has the same effect.

## Canonical Build Icon

The executable icon embedded into every build (Windows taskbar/exe, macOS dock, Linux desktop) is sourced from **`marketing/steam/capsules/Library Logo.ico`** (Windows) and **`marketing/steam/capsules/Library Logo.png`** (source PNG). Those are copied into `src-tauri/icons/icon.ico` + `src-tauri/icons/icon.png`, which `tauri.conf.json → bundle.icon` references at build time.

**Rule:** if the Library Logo changes in `marketing/steam/capsules/`, re-copy both files into `src-tauri/icons/` before the next build. If all Tauri icon sizes (32x32.png, 128x128.png, etc.) need refreshing, run `npx tauri icon "marketing/steam/capsules/Library Logo.png"` from the project root — that regenerates every size + the iOS/Android sets in one pass.

## VDF Files

| File | Purpose |
|---|---|
| `steam/app_build_4547570.vdf` | Full multi-platform build (macOS + Windows + Linux depots) |
| `steam/app_build_4547570_macos.vdf` | macOS-only depot upload — use this when Linux build artifacts are not present to avoid Linux depot path errors |

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

   `npm run build` does the following in sequence:
   - Vite production build (bundles all frontend assets into `dist/`)
   - `build-curated-db.mjs` — compiles 77 curated deck JSONs into `public/curated.db`
   - `obfuscate-db.mjs` — XOR-obfuscates `dist/facts.db` and `dist/curated.db` so they cannot be opened with a standard SQLite tool

   The `steam-build.sh` script does **not** have a separate obfuscation step — obfuscation is fully handled inside `npm run build`.

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
   # macOS-only depot (avoids Linux depot path error if Linux build not present):
   steamcmd +login $(grep STEAM_USERNAME /Users/damion/CODE/Recall_Rogue/.env.local | cut -d= -f2) +run_app_build /Users/damion/CODE/Recall_Rogue/steam/app_build_4547570_macos.vdf +quit

   # Full multi-platform upload:
   steamcmd +login $(grep STEAM_USERNAME /Users/damion/CODE/Recall_Rogue/.env.local | cut -d= -f2) +run_app_build /Users/damion/CODE/Recall_Rogue/steam/app_build_4547570.vdf +quit
   ```

   **Auth gotcha:** steamcmd and the Steam desktop client share `config.vdf`. If the Steam client is running during an upload, it can rewrite the config mid-flight and the cached steamcmd token appears invalid (pre-flight says `Cached credentials valid`, actual steamcmd invocation says `Cached credentials not found`). When this happens, ASK THE USER to quit Steam via Steam menu → Quit, then do an interactive `steamcmd +login`. Do NOT `pkill` Steam yourself — see the 🚨 RULE at the top of this file.

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

## Local Deploy — Kill Before Copy (CRITICAL)

Steam caches the running app in memory. If you just copy files while the game is running, Steam will keep serving the old version. **Always follow this sequence:**

```bash
# 1. Kill any running instance FIRST
pkill -f "Recall Rogue" 2>/dev/null; sleep 1

# 2. Delete the old app bundle entirely (not just overwrite)
rm -rf "/Users/damion/Library/Application Support/Steam/steamapps/common/Recall Rogue/Recall Rogue.app"

# 3. Copy fresh build
cp -R "/Users/damion/CODE/Recall_Rogue/src-tauri/target/release/bundle/macos/Recall Rogue.app" \
  "/Users/damion/Library/Application Support/Steam/steamapps/common/Recall Rogue/"

# 4. Launch via Steam
open steam://run/4547570
```

**Why:** On 2026-04-04, a local deploy appeared to succeed but Steam kept running the old cached binary. The fix was killing the process + deleting the old .app before copying. The `steam-build.sh` script should handle this automatically, but if calling manually, always kill first.

## Steam Cloud Save

Save data uses a `StorageBackend` abstraction (`src/services/storageBackend.ts`) that routes writes to either localStorage (browser/dev) or the file system (desktop/Steam).

**Desktop file saves** are handled via Rust IPC commands defined in `src-tauri/src/filesave.rs`. Save files are written to:

```
~/Library/Application Support/com.bramblegategames.recallrogue/saves/   (macOS)
```

Files in the saves directory:

| File | Contents |
|---|---|
| `profiles.json` | All user profiles index |
| `profile_{uuid}.json` | Per-profile FSRS state, deck progress, stats |
| `run_active.json` | Active run state (mid-run persistence) |
| `settings.json` | User preferences and keybinds |

**Steamworks Auto-Cloud configuration** (must be set in the Steamworks Dashboard before shipping):

| Field | Value |
|---|---|
| Root path | `{4547570}/saves/` |
| OS | All platforms |
| File pattern | `*.json` |
| Max files | 10 |
| Max size per file | 10 MB |

Configure this under App Admin > Steam Cloud > Auto-Cloud in the Steamworks partner dashboard. Without this, save files stay local and are lost if the player reinstalls or switches machines.

## Important Notes

- **steamcmd authentication** is interactive (Steam Guard) — the first login must be done by the user in a terminal: `steamcmd +login <username> +quit`. The `steam-build.sh` script includes an auth-check wrapper that tests cached credentials before uploading. **When the Steam desktop client is running and interfering with steamcmd auth, ASK THE USER to quit Steam via Steam menu → Quit** — never `pkill`, `killall`, or force-quit from Claude. See the 🚨 RULE at the top of this file (2026-04-20 session incident).
- **Depot IDs** must match what's configured in the Steamworks dashboard: DEPOT_CONTENT=4547571, DEPOT_WINDOWS=4547572, DEPOT_LINUX=4547573, DEPOT_MACOS=4547574. Only Linux (4547573) and macOS (4547574) are active at launch.
- **Cross-platform builds:** Windows uses `cargo-xwin` (direct macOS cross-compilation, ~12s cached). Linux uses SSH to a Linux VM via `--linux` flag on `steam-build.sh`. GitHub Actions CI (`.github/workflows/steam-build.yml`) also exists for Windows builds on real Windows runners.
- **Build size** is ~750MB for macOS (includes all game assets). This is normal for Steam.
- **Version bumping**: Update `version` in both `package.json` and `src-tauri/tauri.conf.json` before release builds.
- **Database obfuscation**: `dist/facts.db` and `dist/curated.db` are XOR-obfuscated by `obfuscate-db.mjs` as part of `npm run build`. They cannot be opened with the `sqlite3` CLI in production builds — this is expected.
- **No AI tooling artifacts in bundle**: `CLAUDE.md` and `.claude/` are never included in the production bundle. Verify with `du -sh` on the shipped `.app` if suspicious.
- **Save file security**: Save files (`profiles.json`, `profile_{uuid}.json`, etc.) are plain JSON on disk — not encrypted. Steam handles integrity guarantees via Steam Cloud sync.

## Steamworks Dashboard Checklist

Before first upload, the user must configure in partner.steamgames.com:
- [ ] Create depots (4547571 Content, 4547572 Windows, 4547573 Linux, 4547574 macOS)
- [ ] Set launch options per OS (macOS: `Recall Rogue.app/Contents/MacOS/Recall Rogue`) — **OS field must be set explicitly** (macOS/Windows), NOT left blank. Blank OS causes Steam to misidentify architecture and show a "32-bit game" warning (see `docs/gotchas.md` 2026-04-15).
- [ ] Create a `development` branch for testing
- [ ] Set content descriptors and age ratings
- [ ] Configure Steam Cloud — Auto-Cloud sync for saves/ directory (*.json, 10 files, 10MB each)
