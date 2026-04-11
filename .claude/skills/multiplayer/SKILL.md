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

### Complete (Phases 1-5, 6 commits, ~11K lines)

| Layer | Files | Status |
|-------|-------|--------|
| **Rust/Tauri** | `src-tauri/src/steam.rs` (+12 networking commands, +2 lobby browser) | DONE |
| **Steam P2P Bridge** | `src/services/steamNetworkingService.ts` | DONE |
| **Transport** | `src/services/multiplayerTransport.ts` (WS + P2P + Local) | DONE |
| **Types** | `src/data/multiplayerTypes.ts` | DONE |
| **Lobby** | `src/services/multiplayerLobbyService.ts` | DONE |
| **Game Sync** | `src/services/multiplayerGameService.ts` | DONE |
| **Scoring** | `src/services/multiplayerScoring.ts` | DONE |
| **ELO** | `src/services/eloMatchmakingService.ts` | DONE |
| **Co-op Effects** | `src/services/coopEffects.ts` | DONE |
| **Trivia Night** | `src/services/triviaNightService.ts` | DONE |
| **Workshop MP** | `src/services/multiplayerWorkshopService.ts` | DONE |
| **Fairness** | `src/services/fairnessService.ts` | DONE |
| **Lobby UI** | `src/ui/components/MultiplayerLobby.svelte` | DONE |
| **Race HUD** | `src/ui/components/MultiplayerHUD.svelte` | DONE (live wired) |
| **Duel Panel** | `src/ui/components/DuelOpponentPanel.svelte` | DONE (not wired) |
| **Results** | `src/ui/components/RaceResultsScreen.svelte` | DONE (not wired) |
| **Trivia UI** | `src/ui/components/TriviaRoundScreen.svelte` | DONE (not wired) |
| **Gameplay Wiring** | gameFlowController + runManager + CardApp | DONE (Race Mode) |

### Lobby Browser (Phase 1 complete — Plan: splendid-watching-unicorn)

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Rust: `steam_request_lobby_list` + `steam_get_lobby_member_count` | DONE |
| **Phase 2** | `multiplayerTypes.ts`: `LobbyVisibility`, `LobbyBrowserEntry`, `LobbyListFilter` | DONE (orchestrator) |
| **Phase 3** | `steamNetworkingService.ts`: TS wrappers for Phase 1 commands | DONE |
| **Phase 4** | Fastify `mpLobbyRegistry` + REST routes + WS upgrade | DONE |
| **Phase 5** | `multiplayerTransport.ts`: WebSocket URL fix + joinToken support | DONE |
| **Phase 6** | `multiplayerLobbyService.ts`: `LobbyBackend` abstraction + 3 backends | DONE |
| **Phase 7** | UI: `LobbyBrowserScreen.svelte` + privacy toggle + max-players selector | IN PROGRESS (ui-agent) |
| **Phase 8** | Dev: BroadcastChannel fake `localStorage` directory for two-tab testing | IN PROGRESS (ui-agent) |

### Race Mode Flow (End-to-End)
Hub → Multiplayer button → Lobby (mode/deck/rules) → Start Game → shared seed → play with live opponent HUD → run end → race finish broadcast

### Next Steps (Prioritized)

| Priority | Task | Complexity |
|----------|------|-----------|
| **HIGH** | Complete Phase 7 UI: confirm `LobbyBrowserScreen.svelte` + privacy toggle land (ui-agent) | Medium |
| **HIGH** | Phase 10: Tests for lobby service, mpLobbyRegistry, REST routes, steamBackend mock | Medium |
| **HIGH** | Phase 11: Docker visual verify — BroadcastChannel + Web path scenarios | Medium |
| **HIGH** | Test with 2 Steam accounts on LAN (verify P2P) | Low |
| **HIGH** | Wire RaceResultsScreen into run end flow | Low |
| **HIGH** | Wire Duel mode (shared enemy, simultaneous turns) into gameplay | Medium |
| **MEDIUM** | Server-side matchmaking queue (replace client simulation) | Medium |
| **MEDIUM** | Wire Co-op mode into gameplay (co-op effects active) | Medium |
| **MEDIUM** | Wire Trivia Night into gameplay (question flow) | Medium |
| **LOW** | ELO updates after match completion | Low |
| **LOW** | Tournament bracket system | Medium |
| **LOW** | Spectator mode | Medium |
| **LOW** | Real Steam ID integration (replace 'local_player') | Low |

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
