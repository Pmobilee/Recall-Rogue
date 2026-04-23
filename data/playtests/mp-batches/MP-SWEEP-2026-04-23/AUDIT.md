# MP Sweep — 2026-04-23 (orthogonal to ORCHESTRATOR-A)

**Trigger:** User request — "Full exploration of MP issues, simultaneous runs, all MP game modes, log to issue leaderboard. Other agents in parallel; avoid overlap."

**Method:** 4 parallel Explore sub-agents, each scoped to a non-overlapping surface area. Findings cross-checked against the 135 pre-existing MP leaderboard items and against ORCHESTRATOR-A's parallel batch (which covers coop-specific state, race "Play Again", trivia/study_multi UI routing, mid-run disconnect, ELO/scoring, Workshop, map sync). Each finding here is verified by source-read with file:line citations.

**Scope of THIS batch (non-overlapping):**
- Server-side auth, injection, capacity races, rate limiting (Fastify mp lobby + ELO endpoints)
- Trivia Night message correctness (timing display, allIncorrect trust, dedupe state pollution, input validation)
- Duel message ordering & identity validation (cards_played reorder, sender vs payload identity)
- Lobby browser UX edge cases (stale entry click, copy-code button)
- LAN transport edges (IPv6 scope, permission-denied uncaught, URL persistence across sessions)
- Cross-mode state bleed at the persistence layer (SAVE_KEY shared between solo + MP)
- Transport singleton lifecycle on mode switching
- Lobby visibility constraint enforcement after creation

**Verdict:** 25 net-new issues — 2 CRITICAL, 8 HIGH, 12 MEDIUM, 3 LOW.

**Cross-check vs ORCHESTRATOR-A:** TRACK-A-003 ("Coop subscriber sets stale closures") and this batch's M-018 ("Lobby/game subscribers persist across leave+rejoin") share theme but address different code paths — ORCHESTRATOR-A is coop-specific (`multiplayerCoopSync.ts`); M-018 is the general lobby/game subscriber pattern in `multiplayerLobbyService.ts:94-114`. Both are valid; both should be fixed.

---

## Totals

| Track | Scope | Count | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| Trivia/Duel deep scan | triviaNightService, multiplayerGameService duel paths, trivia + duel UI components | 8 | 0 | 2 | 4 | 2 |
| Server + ELO | server/src/routes/mp\*\*, mpLobbyRegistry, eloMatchmakingService, multiplayerElo | 8 | 1 | 2 | 4 | 1 |
| State bleed + simultaneous runs | runManager, runSaveService, gameFlowController, multiplayerLobbyService, multiplayerTransport singleton | 5 | 1 | 2 | 2 | 0 |
| Transport + lobby browser + LAN | multiplayerTransport, steamNetworkingService, lan*Service, LobbyBrowserScreen, MultiplayerLobby | 4 | 0 | 2 | 2 | 0 |
| **Total (after dedup)** | | **25** | **2** | **8** | **12** | **3** |

---

## Severity rollup

### CRITICAL (2)

| ID | One-liner |
|---|---|
| C-001 | Solo run `SAVE_KEY` shared with MP — solo navigation while in MP overwrites coop/duel snapshot, partner reconnect loads stale solo run as if it were the MP run |
| C-002 | Fastify `mp:lobby:start` accepts host start with NO server-side ready check — host can start while guests are not ready |

### HIGH (8)

| ID | One-liner |
|---|---|
| H-003 | Fastify `mp:lobby:start` payload spread broadcasts client-supplied keys verbatim (mode/houseRules/contentSelection injection) |
| H-004 | Duel `mp:duel:cards_played` does not validate `action.playerId === msg.senderId` — opponent can credit damage to wrong player (ELO manipulation surface in ranked) |
| H-005 | Duel cards_played arriving before turn_start drops silently; host then waits forever for opponent's action |
| H-006 | Host changing lobby visibility public→password mid-session does not evict already-joined public guests |
| H-007 | Lobby-browser join: clicked entry may have been deleted server-side; no preflight existence check, generic error UX |
| H-008 | Guest readied → host's `mp:lobby:start` lost → guest UI locked forever (no client-side timeout) |
| H-009 | Transport singleton survives mode switch solo→MP→solo; subsequent sends route to old session endpoint |
| H-010 | Server allows same playerId to join lobby twice; second join silently overwrites first connection record |

### MEDIUM (12)

| ID | One-liner |
|---|---|
| M-011 | Lobby code generator uses `Math.random()` with no collision check; birthday-problem risk at concurrent-lobby scale |
| M-012 | Server stores `multiplayerRating` from client join payload and broadcasts — no profile-DB validation, ELO is forgeable |
| M-013 | Lobby join capacity check is non-atomic across `await` boundary; concurrent joins can both pass `currentPlayers < maxPlayers` |
| M-014 | Trivia Night: late answer flagged timeout via `selectedIndex=-1` but `timingMs` is NOT clamped; UI shows "13.5s" for "missed" |
| M-015 | Trivia Night: clients trust host-computed `allIncorrect` flag without local recompute |
| M-016 | Trivia Night dedupe `_usedFactIds` polluted by stale timer closure across rapid play-again cycles |
| M-017 | Race FSRS batch is async + not awaited; concurrent solo run start reads mid-update mastery state, card power wrong in next run |
| M-018 | Lobby/game subscribers persist across leave+rejoin in `multiplayerLobbyService` — second race start fires onGameStart twice |
| M-019 | No rate limiting on `POST /mp/lobbies` or `GET /mp/lobbies` — DOS via spam create or list |
| M-020 | LAN URL persists in localStorage across sessions; Steam build relaunched without `?lan=1` still routes transport to LAN |
| M-021 | LAN discovery `toSubnetPrefix()` does not strip IPv6 `%scope` suffix; link-local probe URLs are invalid |
| M-022 | `startLanServer()` exception (port-in-use, macOS Local Network denied) propagates uncaught; caller has no error UX path |

### LOW (3)

| ID | One-liner |
|---|---|
| L-023 | Trivia Night `submitAnswer` accepts any integer for `selectedIndex`; out-of-bounds creates ghost selection in reveal UI |
| L-024 | MultiplayerLobby copy-code button stuck "Copied!" after rapid double-click — timeout cleared without resetting state flag |
| L-025 | WS transport reconnect race: `onclose` + `onerror` both schedule, both can pass the timeout-handle guard |

---

## Verification protocol

Before filing, the following claims were verified by direct source read:

| Claim | Verification command | Result |
|---|---|---|
| `mp:lobby:start` server has no ready check | `sed -n '245,275p' server/src/routes/mpLobbyWs.ts` | Confirmed: handler only checks `hostId !== playerId`; no `allPlayersReady()` |
| `SAVE_KEY = 'recall-rogue-active-run'` shared | `grep SAVE_KEY src/services/runSaveService.ts` | Confirmed: line 17, no mode namespacing |
| Lobby code uses Math.random with no collision check | `sed -n '149,156p' server/src/services/mpLobbyRegistry.ts` | Confirmed: `Math.floor(Math.random() * chars.length)`, no `lobbies.has()` check |
| Duel handler stores opponentAction without senderId check | `sed -n '1040,1055p' src/services/multiplayerGameService.ts` | Confirmed: `_duelState.opponentAction = action` direct from `raw`, no `action.playerId === msg.senderId` |
| Transport singleton not auto-reset on mode switch | `grep -n "_transport\b\|destroyMultiplayerTransport" src/services/multiplayerTransport.ts` | Confirmed: lines 1257-1284, lazy create + manual destroy only |
| `connections.set(playerId, conn)` unconditional | `grep "connections.set" server/src/services/mpLobbyRegistry.ts` | Confirmed: line 275, no pre-check |
| Trivia `_usedFactIds` cleared in two paths | `grep "_usedFactIds" src/services/triviaNightService.ts` | Confirmed: lines 144 (decl), 235 (init clear), 320 (add), 527 (destroy clear) — module-scoped, no per-game scope |

---

## Recommended fix wave order

1. **C-001 (SAVE_KEY namespace)** + **C-002 (server ready check)** — both ship-blocker for any post-launch MP play
2. **H-003 / H-004 / H-010** — three server-side auth/injection issues are a single-day fix wave (allowlist payload, validate sender identity, dedupe playerId on join)
3. **H-005 / H-008** — duel-mode ordering + guest-hang UX timeout (independent, can be parallel)
4. **H-006 / H-007 / H-009** — lobby visibility kick + browser stale-entry UX + transport singleton guard
5. Medium wave: M-011 → M-013 → M-019 (server hardening trio); M-014 → M-016 (Trivia trio); M-017 + M-018 (state lifecycle pair); M-020 → M-022 (LAN polish trio)
6. Low wave: L-023 → L-025 cosmetic polish

Each numbered ID maps to a leaderboard entry with full root cause + fix hypothesis at `data/playtests/leaderboard.json` filtered by `canonicalId.startsWith("MP-SWEEP-2026-04-23")`.
