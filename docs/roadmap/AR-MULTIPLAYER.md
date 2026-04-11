# AR-MULTIPLAYER: Multiplayer System [IN PROGRESS]

> **Priority:** Post-Launch Feature (implementation started 2026-04-07)
> **Complexity:** Very Large (~17 dev-weeks)
> **Dependencies:** AR-47 (Seeded PRNG — done), AR-80 (Steam Integration — partial)
> **Master Plan:** `~/.claude-pmobilee/plans/proud-fluttering-sketch.md`

## Overview

Comprehensive multiplayer for Recall Rogue: competitive, cooperative, and social modes. Steam P2P networking via Steamworks Networking Sockets, with WebSocket fallback for web/mobile.

## Implementation Phases

### Phase 1: Foundation — Steam P2P + Race Mode (Weeks 1-3)
| Task | Status | Notes |
|------|--------|-------|
| 1.1 Extend steam.rs with Networking Sockets | DONE | 10 Tauri commands: lobby CRUD, P2P send/recv, callback pump |
| 1.2 Create steamNetworkingService.ts | DONE | TS bridge: 10 functions + poll loop, docs updated |
| 1.3 Transport abstraction (multiplayerTransport.ts) | DONE | WebSocketTransport + SteamP2PTransport + factory |
| 1.4a Shared types (multiplayerTypes.ts) | DONE | All lobby/mode/fairness/race types and constants |
| 1.4b Lobby service (multiplayerLobbyService.ts) | DONE | createLobby, joinLobby, setMode, setHouseRules, startGame, race progress |
| 1.4c Multiplayer lobby UI (MultiplayerLobby.svelte) | DONE | 3-column: mode tabs, player list, settings panel |
| 1.5 Race Mode HUD (MultiplayerHUD.svelte) | DONE | Compact/expanded opponent progress overlay |
| 1.6 Verify Phase 1 foundation | DONE | 961 files, 0 errors, 27 warnings (pre-existing), build clean |

### Phase 2: Competitive Core — Duel + Same Cards (Weeks 4-7)
| Task | Status | Notes |
|------|--------|-------|
| 2.0 Wire MP into app flow | DONE | Screen routing, HubScreen button, MultiplayerHUD in combat |
| 2.1 Same Cards Mode | DONE | Fork seed sharing via multiplayerGameService (5 labels) |
| 2.2 Real-Time Duel game service | DONE | multiplayerGameService.ts: host-authoritative enemy, simultaneous turns, damage attribution |
| 2.3 Co-op enemy scaling | DONE | getCoopHpMultiplier (1.6x 2P), block (+50%), damage cap (+50%) in enemyManager |
| 2.4 Duel UI | DONE | DuelOpponentPanel.svelte (damage bar, timer, chain) + RaceResultsScreen.svelte |
| 2.5 ELO matchmaking | DONE | eloMatchmakingService.ts: ELO calc, 8 rank tiers, queue with band widening, AI fallback |

### Phase 3: Social — Co-op + Trivia (Weeks 8-10)
| Task | Status | Notes |
|------|--------|-------|
| 3.1 Co-op vs Enemy | DONE | Covered by multiplayerGameService + enemyManager co-op scaling |
| 3.2 Co-op exclusive effects | DONE | coopEffects.ts: 6 effects (Synapse Link, Guardian, Knowledge Share, Team Chain, Fog Contagion, Shared Surge) |
| 3.3 Trivia Night mode | DONE | triviaNightService.ts + TriviaRoundScreen.svelte: 2-8 players, speed bonus, 3-phase UI |

### Phase 4: Polish (Weeks 11-12)
| Task | Status | Notes |
|------|--------|-------|
| 4.1 Workshop deck integration | DONE | multiplayerWorkshopService.ts: deck browser, voting, Deck of the Day, post-match rating |
| 4.2 Fairness mechanisms | DONE | fairnessService.ts: Fresh Facts filter, handicap, FSRS normalization, fairness rating 0-100 |
| 4.3 Local/same-screen play | DONE | LocalMultiplayerTransport in multiplayerTransport.ts + createLocalTransportPair() |
| 4.4 Documentation | DONE | INDEX.md, GAME_DESIGN.md §multiplayer, mechanics/multiplayer.md, memory updated |

### Phase 5: Gameplay Wiring (Race Mode end-to-end)
| Task | Status | Notes |
|------|--------|-------|
| 5.1 runManager seed override | DONE | providedSeed option, perfectEncountersCount + totalDamageDealt fields |
| 5.2 multiplayerScoring.ts | DONE | computeRaceScore() — AR-86 formula (floors, combo, correct, perfect) |
| 5.3 gameFlowController wiring | DONE | multiplayer_race mode, seed passthrough, race broadcast start/stop, finish send |
| 5.4 CardApp wiring | DONE | onGameStart → startNewRun, live opponent progress → MultiplayerHUD |
| 5.5 Verification | DONE | 974 files, 0 errors, build clean |

## Next Steps (Post-Wiring)

| Priority | Task | Complexity | Notes |
|----------|------|-----------|-------|
| HIGH | Test with 2 Steam accounts on LAN | Low | Verify P2P connectivity and seed sharing |
| HIGH | Wire RaceResultsScreen into run end | Low | Show comparison overlay when both finish |
| HIGH | Wire Duel mode into gameplay | Medium | Shared enemy, simultaneous turns via multiplayerGameService |
| MEDIUM | Server-side matchmaking queue | Medium | Replace client-side simulation in eloMatchmakingService |
| MEDIUM | Wire Co-op mode into gameplay | Medium | Co-op effects active during combat |
| MEDIUM | Wire Trivia Night into gameplay | Medium | Question flow, TriviaRoundScreen rendering |
| LOW | ELO updates after match completion | Low | Call processMatchResult on race/duel end |
| LOW | Tournament bracket system | Medium | Single-elimination using Duel format |
| LOW | Spectator mode | Medium | Read-only state broadcast |
| LOW | Real Steam ID integration | Low | Replace 'local_player' placeholder |

## Modes Summary

| Mode | Players | Priority | Cost |
|------|---------|----------|------|
| Race Mode | 2-4 | Tier 1 | 2 wk |
| Same Cards | 2 | Tier 1 | +1 wk |
| Real-Time Knowledge Duel | 2 | Tier 1 (signature) | 3-4 wk |
| Co-op vs Shared Enemy | 2 | Tier 1 | 4-5 wk |
| Trivia Night | 2-8 | Tier 2 | 2 wk |
| Tournament Brackets | 4-16 | Tier 2 | 2 wk |
| Relay Mode | 2 | Tier 2 | 3 wk |

## Co-op Enemy Scaling

| Stat | 1P | 2P | 3P | 4P |
|------|----|----|----|----|
| HP | 1.0x | 1.6x | 2.0x | 2.3x |
| Damage | 1.0x | 1.0x | 1.0x | 1.0x |
| Block | 1.0x | 1.5x | 2.0x | 2.5x |
| Damage Cap | 1.0x | 1.5x | 2.0x | 2.5x |

Enemy damage does NOT scale (full hits to targeted player, StS2 model). Fog/Aura is SHARED across team.

## Networking Architecture

- **Lobbies/Matchmaking:** Existing Fastify server (REST + WS)
- **Gameplay:** Steam P2P (ISteamNetworkingMessages) with WS fallback
- **Anti-cheat:** Host validates quiz answers; ranked uses post-hoc replay audit
- **Reconnect:** 60s window, absent player auto-quick-plays

## Steam Networking Commands (Task 1.1 — DONE)

All commands live in `src-tauri/src/steam.rs` and are registered in `src-tauri/src/main.rs`.

### Async Model
Lobby creation and join are asynchronous (Steamworks callback-based). JS must:
1. Call `steam_create_lobby` / `steam_join_lobby` to initiate
2. Poll `steam_run_callbacks` every ~100ms until the callback fires
3. Use `steam_get_lobby_data` or a future `steam_get_pending_lobby_id` to confirm

### Lobby Commands
| Command | Parameters | Returns | Notes |
|---------|-----------|---------|-------|
| `steam_create_lobby` | `lobby_type: string, max_members: u32` | `""` (async) | types: public/private/friends_only/invisible |
| `steam_join_lobby` | `lobby_id: string` | `void` | async; poll steam_run_callbacks |
| `steam_leave_lobby` | `lobby_id: string` | `void` | synchronous |
| `steam_get_lobby_members` | `lobby_id: string` | `SteamLobbyMember[]` | `{steam_id, display_name}` |
| `steam_set_lobby_data` | `lobby_id, key, value: string` | `bool` | owner only |
| `steam_get_lobby_data` | `lobby_id, key: string` | `string \| null` | |

### P2P Commands
| Command | Parameters | Returns | Notes |
|---------|-----------|---------|-------|
| `steam_send_p2p_message` | `steam_id, data: string, channel: u32` | `bool` | RELIABLE mode, JSON payload |
| `steam_read_p2p_messages` | `channel: u32` | `SteamP2PMessage[]` | drains up to 64; `{sender_id, data}` |
| `steam_accept_p2p_session` | `steam_id: string` | `bool` | sends zero-byte ping to accept |
| `steam_run_callbacks` | — | `void` | pump Steam callbacks; poll at 100ms |

### Known Limitations / TODOs
- `steam_create_lobby` and `steam_join_lobby` return immediately (async initiation only). A future
  `steam_get_pending_lobby_id` command should read from an `Arc<Mutex<Option<LobbyId>>>` populated
  by a persistent `LobbyCreated_t` callback registered in `SteamState::new()`.
- `steam_accept_p2p_session` uses implicit accept (send zero-byte message). A persistent
  `session_request_callback` in `SteamState::new()` would auto-accept incoming sessions without
  requiring an explicit command call from JS.
- Steam IDs are returned as decimal strings throughout to avoid JS 64-bit integer precision loss.

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/steam.rs` | Steamworks SDK — all 13 commands including 10 new networking ones |
| `src-tauri/src/main.rs` | Tauri command registration |
| `src/services/steamService.ts` | TS bridge for Steam (extend for new commands) |
| `src/services/steamNetworkingService.ts` | DONE: P2P networking bridge (10 functions + poll loop) |
| `src/services/multiplayerTransport.ts` | DONE: Transport abstraction (WS + Steam P2P + Local factory) |
| `src/data/multiplayerTypes.ts` | DONE: All shared MP types, constants, mode metadata |
| `src/services/multiplayerLobbyService.ts` | DONE: MP lobby orchestration |
| `src/services/multiplayerGameService.ts` | DONE: Race / Duel / Same Cards sync |
| `src/services/multiplayerScoring.ts` | DONE: computeRaceScore() — AR-86 formula |
| `src/services/eloMatchmakingService.ts` | DONE: ELO calc, 8 rank tiers, queue with band widening |
| `src/services/coopEffects.ts` | DONE: 6 co-op exclusive effects |
| `src/services/triviaNightService.ts` | DONE: Trivia Night rounds, scoring, standings |
| `src/services/multiplayerWorkshopService.ts` | DONE: In-lobby deck browser, voting, Deck of the Day |
| `src/services/fairnessService.ts` | DONE: Fresh Facts, handicap, FSRS normalization, fairness rating |
| `src/ui/components/MultiplayerLobby.svelte` | DONE: 3-column lobby (modes/players/settings) |
| `src/ui/components/MultiplayerHUD.svelte` | DONE: Compact/expanded opponent progress overlay (wired) |
| `src/ui/components/DuelOpponentPanel.svelte` | DONE: Duel damage bar, timer, chain state (not wired) |
| `src/ui/components/RaceResultsScreen.svelte` | DONE: End-of-race score comparison (not wired) |
| `src/ui/components/TriviaRoundScreen.svelte` | DONE: Trivia Night 3-phase UI (not wired) |
| `src/services/seededRng.ts` | Seed sharing (reuse as-is) |

## Lobby Browser Phases (Plan: splendid-watching-unicorn)

> **Status:** Phases 1–6 DONE, Phases 7–8 IN PROGRESS (ui-agent running in parallel), Phases 9–12 documented.
> **Web backend:** Fastify in-memory registry (`mpLobbyRegistry.ts`) — fast, restartable, V1 correct. SQLite persistence deferred.
> **Deferred follow-ups:** Persistent lobby storage, real Steam friends graph integration, server-side anti-cheat on password-join.

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Rust: `steam_request_lobby_list` + `steam_get_lobby_member_count` in `steam.rs` | DONE |
| **2** | `multiplayerTypes.ts`: `LobbyVisibility`, `LobbyBrowserEntry`, `LobbyListFilter`, `MODE_MIN_PLAYERS` | DONE |
| **3** | `steamNetworkingService.ts`: TS wrappers (`requestSteamLobbyList`, `getLobbyMemberCount`) | DONE |
| **4** | Fastify: `mpLobbyRegistry.ts` + REST routes (`mpLobby.ts`) + WS upgrade (`mpLobbyWs.ts`) | DONE |
| **5** | `multiplayerTransport.ts`: WebSocket URL fix (`VITE_MP_WS_URL`) + `joinToken` support | DONE |
| **6** | `multiplayerLobbyService.ts`: `LobbyBackend` abstraction, 3 backends, new public API | DONE |
| **7** | UI: `LobbyBrowserScreen.svelte` + privacy toggle + max-players selector in `MultiplayerLobby.svelte` | IN PROGRESS (ui-agent) |
| **8** | Dev: BroadcastChannel `localStorage` fake directory (broadcastBackend) | IN PROGRESS (ui-agent) |
| **9** | Docs same-commit | DONE (this file) |
| **10** | Tests: lobby service, mpLobbyRegistry, REST routes, steamBackend mock | PENDING |
| **11** | Docker visual verify: BroadcastChannel + Web path scenarios | PENDING |
| **12** | Manual Steam LAN verify (two Steam accounts) | PENDING (user-run) |

## Changelog

- 2026-04-07: AR created. Phase 1 implementation started. Steam P2P + Race Mode.
- 2026-04-07: Task 1.1 DONE. 10 networking Tauri commands added to steam.rs (6 lobby + 4 P2P).
  Uses ISteamNetworkingMessages (not ISteamNetworkingSockets) for simpler P2P messaging.
  cargo check passes cleanly.
- 2026-04-06: Tasks 1.4a + 1.4b DONE. Created src/data/multiplayerTypes.ts (all shared types,
  constants, mode metadata) and src/services/multiplayerLobbyService.ts (createLobby, joinLobby,
  setMode, setDeckSelectionMode, selectDeck, setHouseRules, setRanked, setReady, allReady,
  startGame, sendRaceProgress, sendRaceFinish, and all four callback registrations).
  Typecheck: 0 errors. Build: clean.
- 2026-04-07: **PHASE 1 FOUNDATION COMPLETE.** All 7 tasks done:
  - Task 1.2: steamNetworkingService.ts — 10 exported functions + startMessagePollLoop
  - Task 1.3: multiplayerTransport.ts — WebSocketTransport + SteamP2PTransport + factory
  - Task 1.4c: MultiplayerLobby.svelte — 3-column lobby (mode tabs, player list, settings)
  - Task 1.5: MultiplayerHUD.svelte — compact/expanded Race Mode opponent progress
  - Task 1.6: Verified: 961 files, 0 errors, build clean
  Total new files: 6 (steam.rs extended, 5 new TS/Svelte files). All docs updated.
- 2026-04-07: **ALL 5 PHASES COMPLETE.** 20 files, ~11K lines, 974 files typecheck clean.
  Race Mode wired end-to-end: lobby → shared seed → play → live opponent HUD → run end.
  Key Files table updated: multiplayerGameService, multiplayerScoring, fairnessService,
  multiplayerWorkshopService all DONE (were marked PENDING). Next Steps section added.
  Next milestone: test P2P with real Steam accounts, wire remaining modes (Duel, Co-op, Trivia).

## Future Co-op Combat Ideas (Post-Launch Backlog)

> **Status: NOT SCHEDULED — design ideas only. No implementation tasks created yet.**
> Full design notes in `docs/mechanics/multiplayer.md` § "Future Co-op Combat Enhancements".

| Idea | Summary | Affected Files (when implemented) |
|------|---------|----------------------------------|
| Aggro / Taunt mechanics | Players can draw enemy focus; enables tank role | `enemyManager.ts`, `coopEffects.ts`, `statusEffects.ts` |
| Co-op-specific enemy intents | Enemies with distinct patterns: "attacks both for 5" vs "attacks one for 8" | `multiplayerGameService.ts`, `EnemyIntent` type |
| Split damage AoE attacks | AoE damage divided across all players rather than full damage to each | `multiplayerGameService.ts`, new `targeting: 'aoe_split'` intent variant |

These three ideas are designed to layer coherently: taunt + split AoE + multi-target intents combine into a genuine co-op tactical system. None require changes to the quiz or card systems.
- 2026-04-07: Future co-op combat ideas recorded (aggro/taunt, co-op intents, split AoE).
