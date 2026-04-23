# Exploration Claim — MP-EXPLORE-2026-04-23-ORCHESTRATOR-A

**Started:** 2026-04-23
**Batch owner:** orchestrator-A (this agent)
**Scope claim for parallel agents — do NOT re-explore these angles:**

## Tracks this batch owns

### Track A — Simultaneous runs & singleton state leak
- `multiplayerLobbyService` / `coopService` / `duelService` / `multiplayerCoopSync` singleton residue across sessions
- Leave-run → new-lobby-join ghost subscribers
- Transport reset, channel listener leak between lobbies
- `_currentLobby` / `_currentRoomId` / stale peerIds across runs
- Repeat lobby join within one process lifetime

### Track B — Non-coop modes (race end-state, duel, trivia_night, study_multi)
- Race mode end-game / scoring / rewards flow
- Duel wiring beyond known orphan (C-002) — exit paths, re-init
- Trivia Night mode flow
- Study-multi post BUG-28 — entire flow edges
- Mode-to-mode transitions and hub return

### Track C — Mid-run disconnect / abandon / peer-leave / reconnect
- Partner leaves mid-combat, host leaves during shop
- Transient network failure recovery
- Ghost subscribers, peer-departed cleanup
- Timeouts, softlocks, "continue alone" paths

### Track D — ELO / scoring / leaderboard writes + Workshop service + Map sync
- `multiplayerElo` / `chessEloService` / `geoEloService` concurrent writes, rollback, anti-cheat
- `multiplayerScoring` edge cases
- `multiplayerWorkshopService` — content-auth assumptions
- `multiplayerMapSync` — room choice divergence, deterministic map regen

## Angles explicitly OUT OF SCOPE (already covered)

Do not re-survey these — they are in `MP-STEAM-AUDIT-2026-04-22` / `MP-STEAM-20260422-COOP` / `MP-STEAM-20260422-ULTRATHINK`:
- `mp:lobby:start` payload field drops
- `initCoopSync` gating on `lobby.mode`
- Host 3s ACK timeout firing onGameStart anyway
- `SteamP2PTransport` single-peer design
- Fork-seed RNG divergence in coop (C-004)
- Coop HP scaling missing `playerCount` (C-005)
- `coopEffects.ts` dead code (C-006)
- `awaitCoopEnemyReconcile` no timeout (C-007)
- Windows stdio `let _ = file;` (C-008)
- `initGameMessageHandlers()` never called (C-001)
- `_duelState` never initialised (C-002) — we verify downstream, don't re-file

Any parallel agent reading this file must pick a different angle.
