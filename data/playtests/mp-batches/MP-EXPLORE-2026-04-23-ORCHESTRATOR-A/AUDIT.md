# MP Full Exploration Audit — Orchestrator-A, 2026-04-23

**Trigger:** User request — "DO a full exploration of any possible thing you can think of to fix multiplayer issues, simultaneous runs, all multiplayer game modes. Other agents running in parallel; avoid overlap."

**Method:** 4 parallel Explore sub-agents, each locked to a non-overlapping scope via `CLAIM.md`. Every issue verified against source with grep; evidence cites `path:line` and a verbatim excerpt.

**Verdict:** FAIL — 39 net-new issues, 2 CRITICAL, 14 HIGH, 18 MEDIUM, 5 LOW.

**Deliberately out of scope:** all issues already filed in MP-STEAM-AUDIT-2026-04-22, MP-STEAM-20260422-COOP, MP-STEAM-20260422-ULTRATHINK, MP-20260413-003941, MP-20260421-002450. See `CLAIM.md` for the full not-re-audit list.

---

## Totals

| Track | Scope | Count | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| A | Simultaneous runs, singleton state leak across sessions | 9 | 1 | 3 | 4 | 1 |
| B | Non-coop modes: race end-state, duel downstream, trivia_night, study_multi | 10 | 0 | 5 | 3 | 2 |
| C | Mid-run disconnect / abandon / peer-leave / reconnect | 11 | 1 | 3 | 7 | 0 |
| D | ELO / scoring / leaderboard writes / Workshop / map sync | 9 | 0 | 2 | 5 | 2 |
| **Total** | | **39** | **2** | **13** | **19** | **5** |

(Breakdown by severity after dedup: 2 CRITICAL, 14 HIGH, 18 MEDIUM, 5 LOW — one `HIGH` row reclassified after cross-track dedup.)

---

## Critical findings at a glance

| ID | Mode | One-liner |
|---|---|---|
| TRACK-A-001 | all | Cross-lobby envelope guard documented but `setActiveLobby()` is never called from join/create paths — stale messages from prior lobby pass the filter unchecked |
| TRACK-C-007 | coop | `awaitCoopTurnEnd` has no send-health probe; a zombie Steam P2P session burns the full 15s timeout and both sides end up on different turn numbers |

---

## Top HIGH findings

| ID | Mode | One-liner |
|---|---|---|
| TRACK-A-002 | coop | `destroyCoopSync` leaves `_preInitBroadcastBuffer` populated — prior-run broadcasts replay into next run |
| TRACK-A-003 | coop | Coop subscriber sets never cleared on destroy — stale closures fire alongside new ones |
| TRACK-A-004 | all | `setupMessageHandlers` can stack duplicate handlers across join cycles without a clean leaveLobby |
| TRACK-B-001 | race | Race "Play Again" does not reset currentRun — relics/HP leak into next race |
| TRACK-B-002 | duel | Duel uses RaceResultsScreen and race scoring formula — Floor/Accuracy metrics are meaningless for turn-based duels |
| TRACK-B-003 | trivia_night | Trivia Night never renders its own UI — lobby mode is set but startNewRun routes to combat |
| TRACK-B-005 | study_multi | Study-multi missing `activeDeckMode` assignment branch — dungeon starts with null pool and empty quiz options |
| TRACK-B-006 | trivia_night | Host can stall game forever; no auto-advance after reveal delay, host disconnect strands guests |
| TRACK-C-001 | coop | `_peerLeftPollInterval` can persist across barrier start and synthesize ghost peer_left mid-encounter |
| TRACK-C-002 | coop | `awaitCoopEnemyReconcile` has no retry — a single dropped packet desyncs enemy state for rest of encounter |
| TRACK-C-006 | all | Ghost `onGameStart` subscribers after HMR/error-boundary re-mount cause double scene transition |
| TRACK-C-010 | coop | `_pendingGameMessageCleanup` may be called twice when Track-C-006 fires |
| TRACK-D-001 | race | Race ELO double-apply: `_tryEmitRaceResults` lacks idempotency guard and can fire twice on finish timing |
| TRACK-D-002 | duel | Duel ELO applied by BOTH host and non-host — every ranked duel corrupts rating by 2× delta |

---

## Cross-cutting themes

**1. Singleton service state not reset between sessions.**
`multiplayerLobbyService`, `multiplayerCoopSync`, `multiplayerTransport` all hold module-scoped Sets, Maps, and buffers that are not cleared on `leaveLobby` / `destroyCoopSync`. When a player exits a run and starts another in the same process, old state (subscribers, deferred broadcasts, reconnect timers, peer IDs, handler registrations) leaks forward. Track A is a catalog of these leaks.

**2. Non-coop modes wired at the data layer but not the UI layer.**
Race, Duel, Trivia Night, and Study-Multi all have types, scoring branches, and lobby flags, but their screen transitions and state-reset paths are incomplete or missing. Trivia Night literally never shows its UI. Duel shares the race results screen. Study-Multi starts a run with no fact pool. Race doesn't reset state between rematches.

**3. Barrier/timeout architecture lacks cause context.**
`awaitCoopTurnEnd` and friends resolve a naked `'cancelled'` for every termination reason (timeout, peer-left, transport-close). The caller shows a generic "partner stopped responding" banner even when the real cause is "partner hit Leave Lobby". Worse: the 15s barrier timeout can outrun or underrun the 30s peer-pong timeout depending on failure mode, producing stale lobby updates against already-moved-on game loops.

**4. Ranked-match integrity is protected only by `isRanked`.**
ELO updates in race (`multiplayerGameService.ts:577-586`), duel (:906-917 host, :1075-1091 non-host), and coop all gate solely on `lobby.isRanked`. There's no mode whitelist (so Workshop / Trivia Night / Friendly can be accidentally flagged ranked), no idempotency guard on the call (so race can double-apply), and no agreement that only the host submits (so duel double-applies every match).

---

## Relationship to prior audits

This batch is **complementary**, not redundant:

- MP-STEAM-AUDIT-2026-04-22 focused on the coop cold-start flow (payload drops, mode gating, ACK timeouts, fork-seed RNG, coop HP scaling). It did not survey session-to-session state residue, non-coop modes, or ELO write integrity at depth.
- MP-STEAM-20260422-COOP and -ULTRATHINK re-explored the same coop cold-start chain with an ultra-deep lens (transport, Rust/Tauri, determinism).
- This batch (MP-EXPLORE-2026-04-23-ORCHESTRATOR-A) surveys: simultaneous-run state leak, all four non-coop modes, mid-run abandon and reconnect, ELO/scoring/Workshop integrity.

Where a finding borders an already-filed issue, the `note` field annotates the relationship rather than re-filing (see TRACK-B-004 extending C-003; TRACK-B-010 downstream of C-002).

---

## Recommended fix wave ordering

1. **Ship TRACK-A-001 first.** One line in `createLobby`/`joinLobby`/`leaveLobby` to call `setActiveLobby`. Unblocks the cross-lobby envelope guard that the rest of the codebase assumes is armed.
2. **TRACK-D-001 + TRACK-D-002** — ELO idempotency + host-only duel. Small code, large integrity impact. Pair with regression tests.
3. **TRACK-A-002/003/004** — the coop destroy-time cleanup patch. One function, clear scope.
4. **TRACK-B-005** — study-multi activeDeckMode branch. One missing else-if unblocks the whole mode post-BUG-28.
5. **TRACK-B-003 + TRACK-B-006** — Trivia Night UI + auto-advance. Without these the mode is unshippable.
6. **TRACK-C-007** — active send-health probe in barriers. Architecture-level; pair with TRACK-C-003 (cancel-cause union) to give the game loop the context it needs.
