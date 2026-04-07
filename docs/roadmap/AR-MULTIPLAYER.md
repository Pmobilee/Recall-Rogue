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
| 2.5 ELO matchmaking | PENDING | Ranked mode, replay anti-cheat |

### Phase 3: Social — Co-op + Trivia (Weeks 8-10)
| Task | Status | Notes |
|------|--------|-------|
| 3.1 Co-op vs Enemy | PENDING | Simultaneous turns, shared enemy |
| 3.2 Co-op exclusive effects | PENDING | Synapse Link, Guardian, Knowledge Share |
| 3.3 Trivia Night mode | PENDING | Pure quiz, 2-8 players |

### Phase 4: Polish (Weeks 11-12)
| Task | Status | Notes |
|------|--------|-------|
| 4.1 Workshop deck integration | PENDING | In-lobby browser, deck voting |
| 4.2 Fairness mechanisms | PENDING | Fresh Facts, handicap, practice period |
| 4.3 Local/same-screen play | PENDING | No networking needed |

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
| `src/services/multiplayerTransport.ts` | DONE: Transport abstraction (WS + Steam P2P + factory) |
| `src/data/multiplayerTypes.ts` | DONE: All shared MP types, constants, mode metadata |
| `src/services/multiplayerLobbyService.ts` | DONE: MP lobby orchestration |
| `src/services/multiplayerGameService.ts` | PENDING: MP game state sync |
| `src/ui/components/MultiplayerLobby.svelte` | DONE: 3-column lobby (modes/players/settings) |
| `src/ui/components/MultiplayerHUD.svelte` | DONE: Compact/expanded opponent progress overlay |
| `src/services/seededRng.ts` | Seed sharing (reuse as-is) |

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
