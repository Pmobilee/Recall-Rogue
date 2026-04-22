---
name: steam-p2p-playtest
status: DRAFT
description: End-to-end Steam P2P multiplayer playtest using two Tauri instances on separate Steam accounts.
created: 2026-04-22
canonical-issue: MP-STEAM-20260422-051
---

# Steam P2P Playtest — DRAFT (stub)

> **STATUS: DRAFT.** This skill exists as a protocol document only. The actual
> automation is **not implemented yet**. Do NOT invoke as if it works. The orchestrator
> should run the steps below by hand for now and capture findings into a batch under
> `data/playtests/mp-batches/`.

## Problem this skill exists to fill

`.claude/skills/multiplayer-playtest/` covers the Fastify-backed (web) transport.
The `MockTransport` exercised by `*.test.ts` covers nothing that hits Steamworks.
**Every `BUG 1`–`BUG 27` fix has been verified against mocks only.** A regression
inside `SteamP2PTransport`, `steamNetworkingService.ts`, the Rust callback wiring,
or the lobby-chat-update event filtering would ship without test failure and surface
only when a player files a bug.

This skill specifies the protocol for running real P2P traffic against the actual
shipped exe.

## Required environment (until automation lands)

1. Two distinct Steam accounts logged in on **two distinct Windows machines** (or
   one Windows machine + one VM with Steam Family Sharing — the host and guest
   MUST be different SteamID64s).
2. Both machines have access to App ID `4547570` (either via key-grant or the
   in-development build pushed to a private branch).
3. The latest `steam/windows-build/recall-rogue.exe` deployed to both machines
   via `scripts/steam-windows.sh --install` and the Steam client.
4. A shared chat (Discord, etc.) for the orchestrator to coordinate timing.

## Protocol (manual today, automation TODO)

### 1. Boot
- Both players: launch from Steam (NOT from explorer.exe — need Steam ticket).
- Both players: open devtools (`Ctrl+Shift+I`) and run `window.__rrMpDebug()` —
  must return `{ lobby: null, transport: null, steam: { ready: true, …}, … }`.
  If `steam.ready === false`, abort — Steamworks didn't init.

### 2. Lobby create
- HOST: Multiplayer → Create → mode=`coop`, deck=`fundamentals_of_biology`,
  visibility=`public`. Note the lobby code shown.
- HOST: Run `window.__rrMpDebug()` again. Confirm:
  - `lobby.lobbyId` is a numeric SteamID64 string.
  - `lobby.players.length === 1` and `players[0].id === <host SteamID64>`.
  - `transport.backend === 'steam-p2p'`.

### 3. Lobby join
- GUEST: Multiplayer → Join → enter the lobby code → click Join.
- GUEST: Watch console for `[mp:steam] join_lobby success` then
  `[mp:steam] P2PSessionConnected`.
- HOST: `window.__rrMpDebug()` — `players.length === 2`, both IDs distinct.
- GUEST: same — both sides must agree on the player set.

### 4. Stale-roster regression check (BUG 21 / BUG 24)
- HOST: leave the lobby. GUEST: leave the lobby.
- HOST: create a NEW lobby (different code).
- GUEST: join the NEW lobby.
- WITHIN 5 SECONDS: both sides run `window.__rrMpDebug()`. Confirm
  `players.length === 2` on both. (BUG 24: stale `LobbyChatUpdate.Left` events
  from the prior lobby must NOT clobber the new roster.)

### 5. ContentSelection sync check (MP-STEAM-20260422-014, eae6415f1)
- HOST: in the new lobby, switch deck to `world_war_ii`.
- HOST: ready up.
- GUEST: ready up.
- HOST: click START.
- GUEST: confirm the run starts and the deck is World War II (not the previous
  selection). The CardApp guard `if (!lobby.contentSelection) {…}` must NOT fire.
- BOTH: capture `__rrDebug()` immediately after first encounter loads. Compare
  `seed`, `deckId`, `mode`, `houseRules.ascensionLevel` — all must match exactly.

### 6. Coop play loop (smoke test)
- Play one full encounter. Both players answer at least one quiz prompt each.
- Verify `mp:coop:partner_state` traffic in the host's console (look for
  `[mp:coop] partnerState recv`).
- Run a card. Both sides see the same enemy HP after the action resolves.

### 7. Tear-down
- One side closes the game. The other side should see the connection drop within
  the reconnect grace window (`RECONNECT_GRACE_MS`, ~10s today). If the lobby
  hangs with the disconnected player still present after 30s, that is a regression
  in the `mp:lobby:peer_left` handler.

## Findings file

Write findings to:
```
data/playtests/mp-batches/STEAM-P2P-<YYYY-MM-DD>/AUDIT.md
```
With one section per protocol step. Include screenshots of `__rrMpDebug()` output
on each side for the lobby-roster verification step (5 above is the most likely
regression site).

## TODO — automation roadmap

Listed in priority order so a future session can land the pieces incrementally.

1. **Two-process driver.** Spawn two `recall-rogue.exe` processes via `Tauri --debug`
   on the same machine using two Steam install dirs and the
   `STEAM_USERNAME` / `STEAM_PASSWORD` env vars. Validate: requires a Steam dev key
   (we do not have one) OR a second Windows VM with a free Steam account.
2. **WebSocket debug bridge.** Open a debug-only WS port on each instance that
   exposes `evalInRenderer(code)` and `getRrMpDebug()`. Gate behind
   `import.meta.env.DEV` AND a CLI flag so production builds cannot expose it.
3. **Test orchestrator.** A Node script that:
   - Boots both processes
   - Drives lobby create on instance A
   - Reads the lobby code from `__rrMpDebug()`
   - Drives join on instance B with that code
   - Asserts roster parity at every step
   - Tears both processes down on success or failure
4. **CI integration.** Run the orchestrator nightly against the latest
   `steam/windows-build/`. Report failures to `data/playtests/leaderboard.json`
   under a new `MP-STEAM-P2P-NIGHTLY` batch ID.

Until step 3 lands, this skill is a manual checklist — invoke by reading the
protocol section above, executing each step against two real Steam accounts,
and writing the findings file.

## Cross-reference

- `.claude/rules/testing.md` — Docker-only LLM playtests rule does NOT apply
  here because Steam P2P traffic cannot be Dockerized. This skill is the
  documented exception.
- `.claude/skills/multiplayer-playtest/SKILL.md` — Fastify-backed cousin.
- `data/playtests/mp-batches/MP-STEAM-AUDIT-2026-04-22/AUDIT.md` — the audit
  that prompted creating this stub.
- `docs/architecture/multiplayer.md` — transport-selection cascade.
- `src/services/steamNetworkingService.ts` — the layer this skill exercises.
- `src/services/multiplayerTransport.ts` — `SteamP2PTransport` class.
