# Multiplayer Mechanics

> **Source files:** `src/services/multiplayerGameService.ts`, `src/services/multiplayerLobbyService.ts`, `src/services/multiplayerTransport.ts`, `src/services/coopEffects.ts`, `src/services/coopService.ts`, `src/services/eloMatchmakingService.ts`, `src/services/triviaNightService.ts`, `src/services/steamNetworkingService.ts`, `src/data/multiplayerTypes.ts`, `src/services/enemyManager.ts`
> **Master tracking doc:** `docs/roadmap/AR-MULTIPLAYER.md`
> **Last verified:** 2026-04-06

## Modes

| Mode | Players | Sync | Key Mechanic |
|------|---------|------|--------------|
| Race | 2-4 | 0.5 Hz progress broadcast | Same seed, independent play, compare final scores |
| Same Cards | 2 | 0.5 Hz progress broadcast | Shared fork seeds for identical card draws |
| Real-Time Duel | 2 | Per-turn (host-authoritative) | Shared enemy, simultaneous turns, damage attribution |
| Co-op | 2 | Per-turn (host-authoritative) | Shared enemy, co-op exclusive effects |
| Trivia Night | 2-8 | Per-round | Pure quiz, speed bonus scoring, no combat |

## Co-op Enemy Scaling

Designed for sublinear scaling — two players at 70% quiz accuracy deal ~1.4x effective DPS, not 2x,
so HP does not scale to 2x. Source: `getCoopHpMultiplier()` in `enemyManager.ts`.

| Stat | 1P | 2P | 3P | 4P |
|------|----|----|----|----|
| HP | 1.0x | 1.6x | 2.0x | 2.3x (cap) |
| Block | 1.0x | 1.5x | 2.0x | 2.5x |
| Damage Cap | 1.0x | 1.5x | 2.0x | 2.5x |
| Enemy Damage | 1.0x | 1.0x | 1.0x | 1.0x |

Block and damage cap use formula `1.0 + (playerCount - 1) * 0.5`. HP uses the JSDoc-documented values above (1.6/2.0/2.3) capped at 2.3.

Functions: `getCoopHpMultiplier()`, `getCoopBlockMultiplier()`, `getCoopDamageCapMultiplier()` in `src/services/enemyManager.ts`.

## Co-op Exclusive Effects

All multipliers are **additive** — max combined bonus is +1.25x over base. This prevents excessive
variance that multiplicative stacking would produce. Source: `src/services/coopEffects.ts`.

| Effect | Trigger | Bonus | Duration |
|--------|---------|-------|----------|
| Synapse Link | Both players charge the same chain type | +0.5x damage | This turn |
| Guardian Shield | Play a card tagged `guardian_shield` (charged) | Block redirected to partner | This turn |
| Knowledge Share | Partner answers their quiz correctly | +0.25x damage | 1 turn |
| Team Chain Bonus | Both players have active chains | +0.5x damage | While both chains active |
| Fog Contagion | Either player answers wrong | +1 fog to BOTH players | Permanent |
| Shared Surge | Combined turn counter divisible by 4 | AP surcharge waived for both | This turn |

Active only in `coop` and `duel` modes. Initialized by `initCoopEffects()`, processed by
`processTurnActions()`, ticked by `tickEndOfTurn()`.

## Real-Time Duel Turn Flow

Host-authoritative model prevents desync. Both players submit actions each turn; host resolves:

1. Host sends `mp:duel:turn_start` with `turnNumber`
2. Both players play cards, each sends `mp:duel:cards_played`
3. Both face quiz — each sends `mp:duel:quiz_result`
4. Host collects both `DuelTurnAction` objects, calls `hostResolveTurn()`
5. `hostResolveTurn()` combines damage, applies to shared enemy, rolls next intent, broadcasts `mp:duel:turn_resolve` and `mp:duel:enemy_state`
6. Enemy attacks — target chosen round-robin, HP applied locally
7. If enemy or player defeated, host sends `mp:duel:end`

Source: `src/services/multiplayerGameService.ts`.

## ELO System

Starting rating 1000. Standard ELO formula: `E = 1 / (1 + 10^((Rb - Ra) / 400))`.

| Constant | Value |
|----------|-------|
| Starting ELO | 1000 |
| K-factor (first 20 games) | 32 |
| K-factor (after 20 games) | 16 |
| K-factor threshold | 20 games |

Rank tiers (ascending):

| Rank | ELO Floor |
|------|-----------|
| Novice | < 800 |
| Bronze | 800 |
| Silver | 1000 |
| Gold | 1200 |
| Platinum | 1400 |
| Diamond | 1600 |
| Master | 1800 |
| Grandmaster | 2000 |

Matchmaking queue widening:

| Time in Queue | ELO Band |
|---------------|----------|
| 0-30s | ±200 |
| 30-60s | ±400 |
| 60-90s | Anyone |
| 90s+ | AI fallback |

v1 stores ratings in `localStorage`. Server-side persistence is planned when the Fastify backend ships.
Source: `src/services/eloMatchmakingService.ts`.

## Trivia Night Scoring

No combat, no cards. Pure quiz party mode for 2-8 players.

| Constant | Value |
|----------|-------|
| Base points (correct) | 1000 |
| Max speed bonus | 500 |
| Speed bonus formula | `round(500 * (1 - timingMs / timeLimitMs))` |
| Total max per question | 1500 |
| Default rounds | 15 (range: 5-30) |
| Default time limit | 15s per question |
| Reveal delay | 3s between rounds |

Source: `src/services/triviaNightService.ts`.

## Networking Architecture

- **Lobbies and matchmaking:** Fastify backend (REST + WebSocket)
- **Gameplay transport:** Steam P2P (Steamworks Networking Sockets) primary, WebSocket fallback
- **Same-screen local play:** LocalMultiplayerTransport (in-memory, no networking)
- **Anti-cheat:** Host validates quiz answers; ranked uses post-hoc replay audit

### Transport Abstraction

`src/services/multiplayerTransport.ts` defines a `MultiplayerTransport` interface with three implementations:

- `SteamP2PTransport` — wraps Tauri `steamNetworkingService.ts` bridge (10 Tauri commands)
- `WebSocketTransport` — WebSocket fallback for web/mobile
- `LocalMultiplayerTransport` — in-memory event bus for same-screen multiplayer (Race Mode or Trivia Night hot-seat, no networking required)

`createTransport(mode?)` selects the implementation:
- `mode === 'local'` → `LocalMultiplayerTransport`
- `hasSteam === true` → `SteamP2PTransport`
- otherwise → `WebSocketTransport`

For same-screen play, use `createLocalTransportPair()` which returns two pre-linked instances (`[t1, t2]`). Messages sent on `t1` arrive on `t2`'s listeners via `queueMicrotask`, and vice versa.

`getMultiplayerTransport(mode?)` returns the lazily-created singleton.

## Lobby Flow

1. Host creates lobby via `coopService.createLobby()` — returns `roomId` and 6-char invite code
2. Players join via code or Steam invite (`joinLobby()`)
3. Host configures mode, deck, house rules, fairness options
4. All players ready up
5. Host starts game → shared seed distributed
6. Mode service takes over (`multiplayerGameService` for Race/Duel/Co-op, `triviaNightService` for Trivia Night)

Lobby lifecycle managed by `src/services/multiplayerLobbyService.ts`.

## Key Files

| File | Role |
|------|------|
| `src/data/multiplayerTypes.ts` | All shared types, constants, `MultiplayerMode` union, lobby/fairness/race types |
| `src/services/multiplayerLobbyService.ts` | Lobby lifecycle: create, join, configure, start |
| `src/services/multiplayerTransport.ts` | Transport abstraction (WebSocket + Steam P2P + Local) |
| `src/services/multiplayerGameService.ts` | Race / Duel / Same Cards game sync + `DuelTurnAction` / `DuelTurnResolution` |
| `src/services/coopEffects.ts` | 6 co-op exclusive effects, damage multiplier computation |
| `src/services/coopService.ts` | Client-side REST + WebSocket facade for co-op lobby REST API |
| `src/services/eloMatchmakingService.ts` | ELO calculation, 8 rank tiers, matchmaking queue with band widening |
| `src/services/triviaNightService.ts` | Trivia Night game logic: rounds, scoring, standings |
| `src/services/steamNetworkingService.ts` | Tauri bridge for Steam P2P (10 Tauri commands) |
| `src/services/enemyManager.ts` | `getCoopHpMultiplier()`, `getCoopBlockMultiplier()`, `getCoopDamageCapMultiplier()` |

## Implementation Status

Phases 1-3 complete as of 2026-04-07. Phase 4 (Polish) in progress.

| Phase | Status |
|-------|--------|
| Phase 1: Foundation (Steam P2P + Race Mode) | DONE |
| Phase 2: Competitive Core (Duel + Same Cards + ELO) | DONE |
| Phase 3: Social (Co-op effects + Trivia Night) | DONE |
| Phase 4: Polish (Workshop, fairness, local play) | IN PROGRESS |

See `docs/roadmap/AR-MULTIPLAYER.md` for full task breakdown.
