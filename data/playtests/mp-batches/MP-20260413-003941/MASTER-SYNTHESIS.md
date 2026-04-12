# Multiplayer Playtest — MP-20260413-003941 — MASTER SYNTHESIS

**Date:** 2026-04-13 00:39 – 01:40 NZST
**Duration:** ~61 minutes
**Skill version:** multiplayer-playtest v1 (manual orchestration)
**Containers:** Docker warm (SwiftShader WebGL), host port 3228, guest port 3216

---

## Infrastructure Health

| Component | Status | Details |
|---|---|---|
| Fastify Server | STARTED | Port 3000, required CORS_ORIGIN env for Docker |
| Vite Dev Server | RESTARTED | Required restart after CSP fix in vite.config.ts |
| Host Container | READY | rr-warm-mp-host-20260413-003941, port 3228 |
| Guest Container | RESTARTED 2x | Auto-reconnect bug required container restart to clear lobby state |
| Env Vars | UPDATED | Added VITE_MP_API_URL + VITE_MP_WS_URL to .env.local |
| CSP | FIXED | Added host.docker.internal:* to dev connect-src in vite.config.ts |
| CORS | FIXED (runtime) | CORS_ORIGIN must include Docker origin — not persisted, needs skill update |

**Verdict:** Infrastructure works but requires 2 fixes (CSP + CORS) before Docker containers can communicate with Fastify. Both fixes are documented; CSP fix is committed, CORS fix is runtime-only.

---

## Lobby System Reliability

| Scenario | Result | Notes |
|---|---|---|
| S1: Create Lobby | PASS | Lobby code generated (6-char alphanumeric), Fastify confirms |
| S2: Join by Code | PASS (with restart) | Guest joins successfully on fresh container. Fails if container has stale lobby state. |
| S3: Password Protection | PARTIAL | Visibility radio pills work, password input appears. Full join-with-password flow not tested (blocked by auto-reconnect bug). |
| S4: Lobby Browser | NOT TESTED | Blocked by lobby auto-reconnect bug on guest container |
| S5: Deck Selection | PASS | Deck picker opens, categories/tabs render, checkbox selection works, confirm closes picker |
| S6: House Rules | NOT TESTED | Settings panel visible in screenshots but not individually verified |
| S7: Max Players | INCONCLUSIVE | Race mode allows 4 players; lobby only had 1-2 players, overflow not triggered |
| S8: Visibility States | PARTIAL | REST confirms visibility=public and visibility=password states work. friends_only not tested. |
| S9: Ready + Start Gate | FAIL | Host ready toggles correctly. Guest ready button DOES NOT TOGGLE. Start gate stays disabled. |
| S10: Leave Lobby | FAIL | Leave button click leads to stuck loading screen. Lobby state persists through navigation. |

**Pass rate:** 3 PASS / 3 FAIL / 4 PARTIAL-or-UNTESTED out of 10

---

## Race Mode End-to-End Health

| Test | Result | Notes |
|---|---|---|
| R1: Race Start | PASS (with bot) | Lobby -> onboarding -> dungeonMap works. Requires onboarding click-through. |
| R2: Shared Seed | NOT TESTED | getRunState() doesn't expose seed/multiplayerMode fields |
| R3: Gameplay | FAIL | enterRoom() from dungeonMap leads to black screen (screen='unknown') |
| R4: HUD Verification | NOT TESTED | Blocked by R3 failure — never reached combat |
| R5: Race End | NOT TESTED | Blocked by R3 failure |

**Verdict:** Race mode can start (lobby -> map) but **completely breaks on room entry**. Combat is unreachable in multiplayer. This is a showstopper.

---

## Transport / WebSocket Reliability

- **Lobby create/join:** WebSocket transport works for lobby lifecycle (create, join, player list sync)
- **Ready state sync:** Host ready state propagates correctly. Guest ready state does NOT propagate (click has no effect).
- **Race start broadcast:** The `mp:lobby:start` message reaches the client and triggers game start
- **In-game sync:** Not testable due to R3 black screen failure
- **Console errors:** Zero CSP/CORS errors after fixes applied. Occasional ERR_CONNECTION_REFUSED during server restarts (expected).

---

## UI Rendering Accuracy Across All 5 Modes

| Mode | Renders | Clickable | data-testid |
|---|---|---|---|
| Race Mode | PASS | PASS | mode-race |
| Same Cards | PASS | PASS | mode-same_cards |
| Knowledge Duel | PASS | PASS | mode-duel |
| Co-op | PASS | PASS | mode-coop |
| Trivia Night | PASS | PASS | mode-trivia_night |

**All 5 mode cards render correctly** with name text, descriptions, and player count badges. Mode selection UI is the most polished multiplayer component.

---

## Top 5 Most Critical Issues

| # | ID | Title | Severity |
|---|---|---|---|
| 1 | MP-007 | **Race enterRoom() black screen** — game stuck after dungeon map room entry | CRITICAL |
| 2 | MP-004 | **Guest ready button non-functional** — blocks all two-player race starts | CRITICAL |
| 3 | MP-003 | **Lobby auto-reconnect on navigation** — can't leave/rejoin lobbies | HIGH |
| 4 | MP-006 | **Leave lobby stuck on loading screen** — no clean exit path | HIGH |
| 5 | MP-005 | **Player slot count mismatch** — Fastify reports 2, host UI shows 1 | HIGH |

---

## Recommended Next Fixes (Prioritized)

1. **Fix guest ready toggle (MP-004)** — Without this, no two-player race can start. Check if the WebSocket `mp:lobby:ready` message is being sent by the guest client. The button click handler may not be wired to the lobby service's `toggleReady()` on the guest side.

2. **Fix enterRoom() in multiplayer race (MP-007)** — The Phaser scene transition from dungeonMap to combat fails silently. Check if the room type resolver, content selection, or Phaser scene manager has a multiplayer-specific code path that's missing or broken.

3. **Fix lobby state cleanup on navigation (MP-003)** — `navigate('hub')` must call `leaveLobby()` or equivalent. The multiplayerLobbyService should have a cleanup hook that fires on screen transition. Without this, players get trapped in stale lobbies.

4. **Fix leave lobby loading screen (MP-006)** — The btn-leave-lobby click triggers a transition that never completes. Debug the leave flow: is the Svelte component unmounting before the service responds?

5. **Persist CORS config for Docker testing** — Update the skill spec to document `CORS_ORIGIN="http://localhost:5173,http://host.docker.internal:5173"` as a required startup param, or add it to the server's default dev config.

---

## Test Infrastructure Notes

- **`--scenario none` is mandatory** for multi-step lobby tests. The default scenario reloads the page, destroying lobby state.
- **Container restart is the only reliable way to clear stale lobby state.** Navigate to hub does not leave the lobby.
- **Bot player** (`btn-add-bot`) is the reliable way to test race start without a second player's ready state.
- **`ldp-deck-check-btn`** is the correct selector for deck selection, not the deck row itself.
- **`src/csp.ts` is dead code.** All CSP is in `vite.config.ts` plugin. Fix was applied to the correct location.

---

## Screenshots

45 screenshots captured in `screenshots/` directory covering:
- Smoke test (both containers)
- Multiplayer menu (mode cards, tab structure)
- Lobby creation and code display
- Guest join confirmation
- Deck picker modal (category tabs, deck rows, confirm button)
- Ready state UI
- Race start -> onboarding -> dungeon map
- Room entry black screen
- Leave lobby loading screen
- All 5 mode card selections
