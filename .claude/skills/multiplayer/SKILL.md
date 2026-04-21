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
| **Co-op Effects** | `src/services/coopEffects.ts` | DONE |
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
| (bundle fixes) | 11 | `steam_appid.txt` copied into `Contents/MacOS/` by `steam-build.sh`; `NSLocalNetworkUsageDescription` added to `Info.plist` via `tauri.conf.json` — fixes Steam init on macOS and LAN server permission on macOS 15 |

See `docs/mechanics/multiplayer.md` and `docs/architecture/multiplayer.md` for per-fix detail. All C1–C5 criticals, H1–H19 highs, M1–M23 mediums, L1–L5 lows closed.

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
