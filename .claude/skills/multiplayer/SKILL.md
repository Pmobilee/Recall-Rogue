---
name: multiplayer
description: "Manage the multiplayer system — modes, networking, lobby, co-op scaling, ELO, Trivia Night, Workshop integration. Use when discussing or working on any multiplayer feature."
user_invocable: true
---

# Multiplayer System

Manage all multiplayer features: Race Mode, Same Cards, Real-Time Duel, Co-op, Trivia Night, ELO matchmaking, Workshop integration, fairness mechanisms, and local play.

## Arguments

Parse the user's message for a subcommand:

| Subcommand | Description |
|------------|-------------|
| `status` | Show current implementation status across all phases |
| `next` | Show prioritized next steps |
| `test` | Test multiplayer with 2 Steam accounts on LAN |
| `wire <mode>` | Wire a specific mode (duel, coop, trivia) into gameplay |
| `browse` | Guide lobby-browser implementation (Phase 1–8 of splendid-watching-unicorn plan) |

## Current Implementation Status

### Complete (Phases 1-5 + Hardening Waves, ~14K lines)

| Layer | Files | Status |
|-------|-------|--------|
| **Rust/Tauri** | `src-tauri/src/steam.rs` (+12 networking cmds, +2 lobby browser, +1 force-leave-lobby); `src-tauri/src/main.rs` (RunEvent::Exit cleanup); `src-tauri/src/lan.rs` (bound-addr + IPv6) | DONE |
| **Steam P2P Bridge** | `src/services/steamNetworkingService.ts` | DONE |
| **Transport** | `src/services/multiplayerTransport.ts` — WS reconnect (30s cap, 12 attempts, manual `reconnect()`), Steam P2P handshake buffer, `reestablishSteamP2PSession` | DONE + hardened |
| **Types** | `src/data/multiplayerTypes.ts` — `finishedAt`, `correctCount`, `wrongCount`, `winnerId \| null`, `connectionState`, `readyVersion`, `multiplayerRating` | DONE |
| **Lobby** | `src/services/multiplayerLobbyService.ts` — seed-ACK, 60s reconnect grace, timestamped ready-merge, 15s broadcast TTL, password-hash reset, player-count revalidation, collision-retry codes, LAN/solo hooks | DONE + hardened |
| **Game Sync** | `src/services/multiplayerGameService.ts` — deterministic tie-breaker, null-winner tie, fork-seed resync, scene-lifecycle cleanup, mode-specific scoring, damage clamping, FSRS batch on race end | DONE + hardened |
| **Scoring** | `src/services/multiplayerScoring.ts` (legacy — `calculateScoreForMode` in gameService is the new path) | DONE |
| **ELO** | `src/services/multiplayerElo.ts` (new — K=32, DEFAULT=1500, persist via PlayerProfile.multiplayerRating); `src/services/eloMatchmakingService.ts` (queue) | DONE |
| **Co-op Sync** | `src/services/multiplayerCoopSync.ts` — 45s barrier timeout, transport-disconnect detection, `handleCoopPlayerDeath`, 90s AFK detector, `partnerStateToRaceProgressShape` | DONE + hardened |
| **Co-op Effects** | ~~`src/services/coopEffects.ts`~~ | DELETED (C-006: zero callers, aspirational code — removed 2026-04-22) |
| **Trivia Night** | `src/services/triviaNightService.ts` — empty-pool guard, per-game dedupe set, timing clamp w/ 2s grace, `allIncorrect` flag | DONE + hardened |
| **Workshop MP** | `src/services/multiplayerWorkshopService.ts` — `checkAllPlayersHaveWorkshopDeck` preflight, `validateWorkshopDeckMetadata` w/ HTML rejection, wired handlers | DONE + hardened |
| **LAN** | `src/services/lan{Server,Discovery,Config}Service.ts` — RFC1918 whitelist, IPv6 subnet parsing, 254→~60 probe reduction, bound-addr reporting | DONE + hardened |
| **Fairness** | `src/services/fairnessService.ts` | DONE |
| **Lobby UI** | `src/ui/components/MultiplayerLobby.svelte` — subscriber cleanup on destroy, ready debounce, per-player deck picks, copy-code timeout fix | DONE + hardened |
| **Race HUD** | `src/ui/components/MultiplayerHUD.svelte` | DONE (live wired) |
| **Duel Panel** | `src/ui/components/DuelOpponentPanel.svelte` | DONE (not wired) |
| **Results** | `src/ui/components/RaceResultsScreen.svelte` | DONE (not wired) |
| **Trivia UI** | `src/ui/components/TriviaRoundScreen.svelte` | DONE (not wired) |
| **Gameplay Wiring** | gameFlowController + runManager + CardApp | DONE (Race Mode) |

### Lobby Browser (splendid-watching-unicorn — SHIPPED 2026-04-11)

StS/Balatro-style public/private lobby browsing — visibility tri-state (Public / Password / Friends-Only), host-picked max players, 3 backends unified behind one client API. All 12 phases shipped + 2 Green-zone follow-ups.

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Rust: `steam_request_lobby_list` + `steam_get_lobby_member_count` | DONE |
| **Phase 2** | `multiplayerTypes.ts`: `LobbyVisibility`, `LobbyBrowserEntry`, `LobbyListFilter`, `MODE_MIN_PLAYERS` | DONE (orchestrator, after sub-agent ghost-commit) |
| **Phase 3** | `steamNetworkingService.ts`: `requestSteamLobbyList`, `getLobbyMemberCount` | DONE |
| **Phase 4** | Fastify `mpLobbyRegistry` + REST routes (`/mp/lobbies`) + WS upgrade (`/mp/ws`) | DONE (commit `699c416e1`) |
| **Phase 5** | `multiplayerTransport.ts`: WebSocket URL from `VITE_MP_WS_URL` + `joinToken` | DONE |
| **Phase 6** | `multiplayerLobbyService.ts`: `LobbyBackend` abstraction + `steamBackend` / `webBackend` / `broadcastBackend` + `setVisibility` / `setPassword` / `setMaxPlayers` / `listPublicLobbies` / `joinLobbyById` | DONE |
| **Phase 7** | `LobbyBrowserScreen.svelte` (new, 812 LOC) + `MultiplayerLobby.svelte` privacy/password/max-players (+224 LOC) + `MultiplayerMenu.svelte` Browse button + `CardApp.svelte` routing | DONE (commit `766223a3a`) |
| **Phase 8** | `broadcastBackend`: `localStorage['rr-mp:directory']` with 30 s TTL heartbeat | DONE |
| **Phase 9** | Docs same-commit: architecture/mechanics/roadmap/gotchas/SKILL/GAME_DESIGN/INDEX | DONE |
| **Phase 10** | Tests: 43/43 `multiplayerLobbyService.test.ts` + 52 `mpLobbyRegistry` + 18 `mpLobby.test.ts` | DONE |
| **Phase 11** | Docker visual verify: 2-screenshot run via `hub-fresh` + `__rrPlay.navigate('lobbyBrowser')` actions-file | DONE (artifacts at `/tmp/rr-docker-visual/lobby-verify_*1775893352566/`) |
| **Phase 12** | Commit + registry sync + follow-ups (`pickBackend` order + real `$authStore.displayName`) | DONE (commit `cc2e5b8bc`) |

**Key commits this session:** `699c416e1` (server) · `766223a3a` (UI) · `4f96917ea` (Rust/types/services/docs/tests — misattributed log message, see gotcha 2026-04-11) · `cc2e5b8bc` (follow-ups).

### Race Mode Flow (End-to-End)
Hub → Multiplayer button → Lobby (mode/deck/rules) → Start Game → shared seed → play with live opponent HUD → run end → race finish broadcast

### Hardening Wave (2026-04-21) — 81 audit findings resolved across 6 commits

| Commit | Wave | Scope |
|---|---|---|
| `ec9e86626` | 1 | coop/race/trivia/LAN + Elo/FSRS (42 core fixes) |
| `b8b7c1b0b` | 2 | lobby service + workshop + lobby UI |
| `2824e08d3` | 3 | wiring + PlayerProfile schema v2 |
| `c80c99e55` | 4 | polish + Elo wire + CORS default |
| `60f260fe0` | 5 | final wiring (initRaceMode, opp-rating, workshop gate) |
| `564111f12` | 6 | M6 hasPassword cleanup + M23 typed IPC + L4 kick scaffold + docs |
| (A2–A4 fix) | 7 | Ghost lobby prevention, Steam join error surfacing (pending_join_error, pollJoinResult), stale lobby filter, host metadata clear on leave |
| (B2–B3 + C1–C3) | 8 | Lobby titles end-to-end, profanityService (maskProfanity + sanitizeLobbyTitle), broadcast dir cleanup on host leave, Steam force-leave |
| (D1) | 9 | Steam overlay diagnostic: `steam_overlay_status` command, `GameOverlayActivated` callback, typed IPC, dev panel in MultiplayerMenu, docs |
| (AR-80 pump) | 10 | Background `run_callbacks` pump thread — fixes intermittent lobby join failures on cold Steam backends (see AR-80 follow-up section in `docs/architecture/multiplayer.md`) |
| (Wave 12) | 12 | Steam lobby metadata warm-up: `steam_request_lobby_data` Rust command (raw `steamworks::sys` flat API), `requestSteamLobbyData` TS helper, warm-up pass in `listPublicLobbies` + `resolveByCode` — fixes cold-cache GetLobbyData returning "" before `LobbyDataUpdate_t` fires |
| (bundle fixes) | 11 | `steam_appid.txt` copied into `Contents/MacOS/` by `steam-build.sh`; `NSLocalNetworkUsageDescription` added to `Info.plist` via `tauri.conf.json` — fixes Steam init on macOS and LAN server permission on macOS 15 |
| `3710f3917` | 13 | LAN server axum 0.7 route syntax (`:param` → `{param}`) — was panicking at startup with `"Path segments must not start with :"` so every LAN start silently died and the JS 10s timer fired. devtools disabled in release Cargo.toml. Diagnostic `println!` in `steam_get_pending_join_lobby_id` |
| `e6b070e10` | 14 | Tauri `bundle.macOS.infoPlist` is a **path** to a .plist file, not an inline dict — reverted the earlier inline-dict attempt that made `cargo check` fail with "invalid type: map, expected path string". Reverted a `steamworks::sys::SteamAPI_ISteamMatchmaking_RequestLobbyData` hack — that re-export is crate-private (E0603) |
| `c8911b9cb` | 15 | **Steam P2P peer ID is the remote player's SteamID, not the lobby ID.** `multiplayerLobbyService` was passing `result.lobbyId` to `transport.connect(peerId, ...)` everywhere — LobbyId and SteamId share 64-bit shape but a LobbyId is not a valid P2P endpoint. Symptom: `[Steam] P2P send failed ... ConnectFailed` spam forever. New Rust command `steam_get_local_steam_id` + `resolveSteamPeerId` helper + `startSteamHostPeerPoll` (host defers `transport.connect` until a peer is detected, polls `lobby_members`) |
| `a18cdb851` | 16 | **File logger.** Steam-launched macOS apps drop stdout to /dev/null; Tauri Windows release has `windows_subsystem = "windows"` → same. Every `println!`/`eprintln!` was invisible to players. `main.rs::redirect_stdio_to_log_file` `dup2`s fd 1 & 2 to `~/Library/Logs/Recall Rogue/debug.log` (macOS) / `%LocalAppData%/Recall Rogue/debug.log` (Windows now fully covered via `SetStdHandle` + `windows-sys` — 2026-04-22 fix, was a no-op stub) |
| `7a968aae5` | 17 | `handleCreateLobby`/`handleJoinLobby` in `MultiplayerMenu.svelte` auto-stop the LAN server when user creates/joins a Steam lobby. `isLanMode()` true → `pickBackend()` pins webBackend and the "Steam lobby" silently becomes a LAN lobby |
| `98a9239d3` | 18 | **`steam_join_lobby` Ok(()) → null Tauri-serialization swallow.** `joinSteamLobby` TS had `if (kickoff === null) return null`. Rust returning `Ok(())` also serialises to null, so the successful kickoff was treated as IPC failure — `pollJoinResult` never ran and the UI always said timeout. Fix: use `getLastSteamInvokeError()` delta instead. Also: clear persisted LAN URL on Create/Join regardless of `lanServerRunning` state |
| `b7f1b57c4` | 19 | `steam_get_lobby_owner` Rust command (`ISteamMatchmaking::GetLobbyOwner`) — synchronous local-cache read, reliable for guest-side peer resolution. `readSteamLobbyMetadataForJoin` reads mode/visibility/title/lobby_code/max_players from Steam lobby data so `_currentLobby` shows the host's real values instead of the `mode: 'race'` placeholder that persisted when the `mp:lobby:settings` broadcast failed |
| `1223272ec` | 20 | **Svelte $state reactivity**: CardApp.svelte `onLobbyUpdate((lobby) => currentLobby = lobby)` was assigning the same object reference Svelte had already wrapped, so downstream `$derived(amHost ...)` never re-evaluated after lobby mutations. Shallow-spread on every update so Svelte sees a new ref. Host peer-poll interval 2 s → 300 ms |
| `bfb7c52bd` | 21 | **Failsafe wave + forensic logging.** JS→file log bridge (`rr_log` Rust + `rrLog` TS), instrumented SteamP2PTransport (state/send/recv/buffer), instrumented multiplayerLobbyService (createLobby/joinLobby/setContentSelection/broadcastSettings/notifyLobbyUpdate/`mp:lobby:settings` handler + resolveSteamPeerId path). Failsafes: `LobbyChatUpdate` raw Rust callback auto-accepts P2P for any peer who enters our lobby (closes the receiver-accept gap), `resolveSteamPeerIdWithRetry` (5× 500ms), `SteamP2PTransport._preConnectBuffer` (buffers sends attempted before `connect()` is ever called — host's early deck selections), LAN self-probe (TCP connect to own routable IP:port; fails → firewall warning in debug.log) |
| (P2P session fix) | 22 | **`session_request_callback` registered in `SteamState::new()` — THE root fix for ConnectFailed.** Without this, Steam rejects incoming sessions by default (SessionRequest Drop impl calls CloseSessionWithUser). Supporting: `session_failed_callback` for diagnostic logging; `AUTO_RESTART_BROKEN_SESSION` send flag; `steam_prime_p2p_sessions` Tauri command (zero-byte primers to all lobby members after create/join); `steam_get_p2p_connection_state` diagnostic command; `lan_tcp_probe` LAN reachability command; TS `_sendWithRetry` (3 attempts, 200ms/500ms delays, logs connection state between attempts); `primeP2PSessions` called in all 3 lobby join/create paths. |

See `docs/mechanics/multiplayer.md` and `docs/architecture/multiplayer.md` for per-fix detail.

### Known-bad patterns (additional, 2026-04-22)

- **Assumed `steamworks-rs 0.12` lacked `session_request_callback`.** It has it. `client.networking_messages().session_request_callback(|req| req.accept())` is 2 lines. Read `~/.cargo/registry/src/.../steamworks-0.12.2/src/networking_messages.rs` before concluding any API is absent.
- **Sending only from one direction does NOT establish bidirectional sessions.** Under `ISteamNetworkingMessages`, A→B and B→A are two separate session arcs. A priming zero-byte in each direction (or `session_request_callback` auto-accept) is required for both sides.

### Command inventory additions (2026-04-22)

| Command | Layer | Description |
|---------|-------|-------------|
| `steam_prime_p2p_sessions(lobbyId)` | Rust | Zero-byte primer to all other lobby members; returns count primed |
| `steam_get_p2p_connection_state(steamId)` | Rust | Diagnostic string: `state=Connected rtt=42 end_reason=None` |
| `steam_get_session_error(steamId)` | Rust | Most recent session failure from `last_session_errors` map; `null` if none. Written by `session_failed_callback`. |
| `lan_tcp_probe(host, port, timeoutMs)` | Rust (LAN) | Pure TCP connect probe; returns "ok" or failure reason |
| `primeP2PSessions(lobbyId)` | TS | Wraps `steam_prime_p2p_sessions` |
| `getP2PConnectionState(steamId)` | TS | Wraps `steam_get_p2p_connection_state` |
| `getSessionError(steamId)` | TS | Wraps `steam_get_session_error`; used by `_sendWithRetry` for enriched failure logs |
| `lanTcpProbe(host, port, timeoutMs)` | TS | Wraps `lan_tcp_probe` |
 All C1–C5 criticals, H1–H19 highs, M1–M23 mediums, L1–L5 lows closed.

### Post-wave 22 deep audit (2026-04-22b)

Seven bugs found and fixed after wave 22 shipped:

| Bug | Severity | Root cause | Fix |
|-----|----------|-----------|-----|
| BUG1: `steam_send_p2p_message` bool erased | Critical | `SteamCommandReturn.steam_send_p2p_message: void` → Rust `Ok(false)` invisible to TS | Changed to `boolean`; `sendP2PMessage()` → `Promise<boolean>` |
| BUG2: `_sendWithRetry` dead on resolved-false | Critical | `.then()` did `void result` — only `.catch()` triggered retry | Added `if (result === false)` check with same backoff + `getSessionError` logging |
| BUG3: `steam_accept_p2p_session` bool erased | Silent | Same pattern as BUG1 | Changed to `boolean`; `acceptP2PSession()` → `Promise<boolean>`; log false but still proceed |
| BUG4: Two send sites missing `AUTO_RESTART_BROKEN_SESSION` | Consistency | `LobbyChatUpdate` auto-accept + `steam_accept_p2p_session` used `RELIABLE` only | Added the flag to both sites |
| BUG5: `session_failed_callback` never reached TS | Diagnostic | Callback only `eprintln!`'d — no IPC read path | `last_session_errors` map in `SteamState`; `steam_get_session_error` command; `getSessionError()` TS helper |
| BUG6: No periodic session-state poll | Telemetry | `_sendWithRetry` only polled state on failure | `setInterval(2000ms)` in `connect().then()` publishes to `window.__rrMpState.steam.sessionState`; `_setState` publishes transport state on every transition |
| BUG7: Primer log not per-peer | Logging | Single count log obscured which peers failed | Per-peer `ok`/`err` already in Rust via `eprintln!`; added receive heartbeat every 5s in `startMessagePollLoop` |

### Post-wave 22 deep audit part 3 (2026-04-22c — BUGs 8-12)

Five bugs found in a third deep audit pass:

| Bug | Severity | Root cause | Fix |
|-----|----------|-----------|-----|
| BUG8: `mp:lobby:join` dropped on host (Steam P2P) | Critical | LAN/Fastify server transforms `mp:lobby:join` → `mp:lobby:player_joined`. Steam P2P has no server — raw join message was silently dropped. | Added `transport.on('mp:lobby:join', ...)` host-side handler in `setupMessageHandlers()`; adds player + calls `broadcastSettings()`. Existing `mp:lobby:player_joined` handler unchanged. |
| BUG9: MpDebugOverlay invisible in Steam release | Critical | Overlay gated on `$devMode` only. Tauri release builds: no URL params accessible, `VITE_DEV_TOOLS` not set at build time. | `devMode.ts` rewritten to `writable`; added `localStorage.rr-dev-mode` persistence and `Cmd+Shift+D`/`Ctrl+Shift+D` runtime chord. Overlay auto-shows when `mpLobbyActive` (polled in `$effect`). |
| BUG10: Guest `_currentLobby.players` missing host stub | Important | Guest initializes `players: [self]` only. Host entry added when `mp:lobby:settings` arrives — but if host hasn't processed BUG8's join yet, settings may carry stale player list. | `joinLobby` and `joinLobbyById` now call `getLobbyOwner` to prepopulate a placeholder host entry. `mp:lobby:settings` handler saves self-entry before `Object.assign` and reinserts it if missing. |
| BUG11: `resolveSteamPeerIdWithRetry` budget too short | Polish | 5 attempts × 500ms = 2.5s. Cold Steam backends take 3-4s. | Bumped to `attempts = 10` (5s total). |
| BUG12: Rich Presence `connect` key not set | Polish | Host never called `setRichPresence('connect', ...)`. Friends couldn't click "Join Game" in Steam overlay. | `steamNetworkingService.ts` gets `setRichPresence`/`clearRichPresence` helpers (backed by already-registered Rust commands `steam_set_rich_presence`/`steam_clear_rich_presence`). `createLobby` sets key; `leaveLobby` clears it. |

### Post-wave 22 deep audit part 4 (2026-04-22e — BUGs 13-20)

Six more bugs found and fixed in hypercritical pass 4:

| Bug | Severity | Root cause | Fix |
|-----|----------|-----------|-----|
| BUG13–14 | (prior pass) | — | — |
| BUG15: `macosPermissionHint` never rendered | UX | `startLanServer()` populates the hint on macOS; no UI consumer existed | `MultiplayerMenu.svelte` captures `result.macosPermissionHint` → `lanServerHint` state; dismissible `<aside class="mp-lan-hint">` rendered; dismiss persisted to `localStorage` |
| BUG16: transport listener leak on leave + rejoin | Critical | `setupMessageHandlers` deduped via `_handlersAttached` flag but never removed old listeners on leave. Each lobby cycle doubled handler count. | `_activeHandlerCleanups[]` array captures every `transport.on()` cleanup; `leaveLobby` calls all cleanups before resetting flag. `reg()` helper encapsulates pattern. |
| BUG17: LobbyChatUpdate only handles Entered | Important | Left/Disconnected/Kicked/Banned states ignored. Ghost entries in `_currentLobby.players` after peer crash. | Added `pending_peer_left: Arc<Mutex<Option<u64>>>` to `SteamState`. Else-branch in callback writes departing peer SteamID. New `steam_get_pending_peer_left` Tauri command (take() semantics). `getPendingPeerLeft()` TS helper. 1s poll in `setupMessageHandlers` synthesises local player removal. |
| BUG18: zero-byte primers logged as malformed | Noise | `JSON.parse('')` throws → `console.warn` "malformed P2P message" for every session handshake primer | Early guard `if (data.length === 0) { rrLog(...); return; }` before try/catch in `_handleRawMessage`. |
| BUG19: LAN state never published to debug overlay | Observability | `lanServerService.ts` had no `setMpDebugState` calls. Overlay showed "no lan state" forever. | `startLanServer()` publishes `{ lan: { boundUrl, ... } }`; `stopLanServer()` clears it. Added `import { setMpDebugState }` to `lanServerService.ts`. |
| BUG20: no console dump command | DX | No quick way to snapshot MP debug state for log-sharing. | `window.__rrMpDebug()` global added in `mpDebugState.ts`. Logs + returns `window.__rrMpState`. |

**Remaining Work (all nice-to-haves; no ship blockers)**

| Task | Notes |
|------|-------|
| Transport-side emission of `mp:lobby:peer_left` / `mp:lobby:peer_rejoined` via Fastify ws.on('close') + Rust P2PSessionConnectFail_t callback | JS-side ping/pong fallback active. Upgrading would drop detection latency from 30s to instant. |
| RaceResultsScreen wiring into run-end flow | Component exists, not hooked. |
| Duel mode end-to-end UI wire | `DuelOpponentPanel.svelte` + gameService primitives ready; needs in-game UI integration. |
| Vote-kick quorum logic | L4 scaffolding ships messages + `kickPlayer` host-only; vote counting not yet implemented. |
| UI dialog for `onLobbyError('kicked_by_host')` | L4 fires the error event; UI just needs a dismissible modal + hub nav. |
| Real Steam ID (replace `'local_player'`) | Works in live Steam build; dev placeholder only. |
| Server-side matchmaking queue | Client stub via `eloMatchmakingService.ts`. |
| Tournament bracket / spectator | Post-MVP. |

### Key References
- **AR Spec:** `docs/roadmap/AR-MULTIPLAYER.md`
- **Mechanics Doc:** `docs/mechanics/multiplayer.md`
- **Master Plan:** `~/.claude-pmobilee/plans/proud-fluttering-sketch.md`
- **Lobby Browser Plan:** `~/.claude-muldamion/plans/splendid-watching-unicorn.md`
- **Co-op Scaling:** HP 1.6x, Block 1.5x, Cap 1.5x for 2P (Monster Hunter sublinear)
- **Scoring:** `(floor×100) + (combo×50) + (correct×10) - (wrong×5) + (perfect×200)`

### Architecture
- **Lobbies/Matchmaking:** Fastify server (REST + WS)
- **Gameplay:** Steam P2P primary, WebSocket fallback, Local for same-screen
- **Anti-cheat:** Host validates quiz answers; ranked uses post-hoc replay audit
- **Transport:** `MultiplayerTransport` interface with 3 implementations

## Subcommand: `status`
Read `docs/roadmap/AR-MULTIPLAYER.md` and report the phase status table.

## Subcommand: `next`
Show the next steps table above. Ask the user which to tackle.

## Subcommand: `test`
Guide the user through testing with 2 Steam accounts:
1. Build with `npm run steam:build`
2. Copy to second machine or use Steam Family Sharing
3. Both launch, one creates lobby, other joins via code
4. Verify P2P message round-trip via console logs
5. Start Race Mode, verify shared seed produces same encounters

## Subcommand: `browse`
Guide the lobby browser feature (splendid-watching-unicorn plan):
1. Read the plan at `~/.claude-muldamion/plans/splendid-watching-unicorn.md`
2. Check the Phase table above for current status
3. Identify the next PENDING phase and its scope
4. Delegate to the appropriate agent per `.claude/rules/agent-routing.md`

## Critical Invariants

### Content Selection Sync (host ↔ guest)
Host + guest MUST end up with identical card pools. Two known pitfalls:

1. **`mp:lobby:start` MUST carry `contentSelection`** in its payload — don't rely on a prior `mp:lobby:settings` broadcast to have landed. Network reordering makes that race-condition-prone. `multiplayerLobbyService.startGame()` includes it; the `mp:lobby:start` handler assigns it to `_currentLobby.contentSelection` before firing `_onGameStart`.
2. **Guest MUST NOT silently fall back to general mode.** `CardApp.svelte` game-start callback guards with `if (!lobby.contentSelection) { console.error(...); transitionScreen('multiplayerLobby'); return; }` — never let a run start without a definitive content selection.
3. **Mixed custom decks (language + knowledge):** `buildPresetRunPool` / `buildGeneralRunPool` accept `allowLanguageFacts: boolean`. `encounterBridge.ts` computes `hasLanguageItem` from the custom deck's items and passes it through. Never use the old `domains.some(d => !d.startsWith('language:'))` heuristic — it strips grammar from mixed decks. Tests live in `src/services/presetPoolBuilder.test.ts` and `src/services/multiplayerLobbyService.test.ts`.

## Subcommand: `wire <mode>`
For each mode, read the relevant service file and existing UI component, then wire into gameFlowController following the Race Mode pattern:
- **duel**: `multiplayerGameService.ts` (initDuel, hostCreateSharedEnemy, submitDuelTurnAction) + `DuelOpponentPanel.svelte`
- **coop**: Same as duel + `coopEffects.ts` (initCoopEffects, processTurnActions)
- **trivia**: `triviaNightService.ts` (initTriviaGame, hostNextQuestion) + `TriviaRoundScreen.svelte`
