# MP/Steam Forensic Audit — Pass 2 (ultrathink, 2026-04-22 evening)

**Trigger:** User report — coop lobby works on Steam but each player ends up in their own game after Start. "Obnoxiously large ultrathink full analysis" with parallel agents.

**Relationship to first audit:** Complementary. AUDIT.md (from earlier today, source batch `MP-STEAM-20260422-COOP`, 15 issues) correctly identified the prime-suspect chain around `mp:lobby:start` payload fields, guest-side mode stashing, and ACK timeout. This pass-2 audit found **31 additional issues** covering deeper gameplay-layer wiring, determinism, Rust-side, and observability — almost no overlap.

**Method:** 4 parallel Explore sub-agents (coop-vs-race trace, Steam P2P transport audit, Rust/Tauri audit, determinism audit). Every CRITICAL / HIGH claim spot-verified against source with grep before cataloguing. Source batch id in leaderboard: `MP-STEAM-AUDIT-2026-04-22`.

---

## Summary of this pass (31 issues)

- **8 critical** (ship blockers)
- **8 high**
- **9 medium**
- **6 low**

Full entries in `data/playtests/leaderboard.json` filtered by `sourceBatch == "MP-STEAM-AUDIT-2026-04-22"`.

## Critical findings at a glance

| ID | One-line |
|---|---|
| C-001 | `initGameMessageHandlers()` never called — duel/coop + fork-seed routers not installed |
| C-002 | `_duelState` never initialised — `initDuel`/`hostCreateSharedEnemy`/`submitDuelTurnAction`/`hostStartNextTurn` all orphan |
| C-003 | `activeRunMode` pinned to `'multiplayer_race'` for ALL MP modes — coop runs into race wiring |
| C-004 | Fork-seed sync never happens in coop — RNG diverges across `getRunRng(…)` calls |
| C-005 | Coop HP scaling (1.6×) not applied — `createEnemy` missing `playerCount` option |
| C-006 | `coopEffects.ts` dead code — `initCoopEffects` / `processTurnActions` zero callers |
| C-007 | `awaitCoopEnemyReconcile` no timeout — Steam P2P race can silently strand guest on local enemy |
| C-008 | Windows stdio redirect is a no-op — `let _ = file;` drops log handle, Rust logs invisible on Windows release |

## Key divergence from first audit

AUDIT.md pass 1 identified `mp:lobby:start` payload fields (`mode`, `deckId`, `houseRules`) being dropped on guest — a real and correct finding. This pass-2 audit found that **even if the payload were correct**, several subsequent wiring gaps would still cause "each player in their own game":

- `initGameMessageHandlers` not called → duel/coop message handlers not installed regardless of mode
- `activeRunMode` forced to race → coop mode routes into race broadcast loop
- Fork seeds not broadcast → both clients independently RNG anything not state-replicated

These are independent of `mp:lobby:start` payload correctness. They mean the bug would persist even after pass-1 fixes — which is why pass-2 exists.

## Recommended fix order (merging both audits)

**Tier 1 — ship-blocking, needed for any coop to work:**

1. Pass-1 BUG-1 — add `mode/deckId/houseRules` to `mp:lobby:start` payload
2. Pass-1 BUG-2 — defensive assertion on `_currentLobby.mode` at start-fire
3. Pass-2 C-003 — branch `activeRunMode` on actual mode
4. Pass-2 C-001 — call `initGameMessageHandlers(lobby.mode)` in onGameStart
5. Pass-2 C-002 — call `initDuel()` + `hostCreateSharedEnemy()` for coop/duel
6. Pass-2 C-005 — pass `playerCount` to `createEnemy`
7. Pass-2 C-007 — add timeout + retry to `awaitCoopEnemyReconcile`

**Tier 2 — prevents regressions:**

8. Pass-2 C-004 — broadcast + apply fork seeds in coop
9. Pass-1 BUG-3 — convert 3s fire-anyway timeout to abort-on-no-ACK
10. Pass-1 BUG-6 + BUG-7 — move `initCoopSync` / `onPartnerStateUpdate` before `startNewRun`
11. Pass-2 H-013 + H-014 — gate race broadcasts on mode==race

**Tier 3 — observability (do in parallel with tier 2):**

12. Pass-2 C-008 — Windows stdio redirect via `windows-sys`
13. Pass-2 M-024 — add "Copy MP Debug Snapshot" UI button

**Tier 4 — determinism hardening (after tier 1-3 land):**

14. Pass-2 H-009/H-010/H-011 — seed `deckManager.ts:198`, `turnManager.ts:608`, `turnManager.ts:1665/1670/1682/2991`
15. Pass-2 M-017/M-018/M-019 — seed `catchUpMasteryService.ts:40`, `shopService.ts:237`, `nonCombatQuizSelector.ts:~290`

**Tier 5 — orphan-code cleanup:**

16. Decide on `coopEffects.ts` (delete or wire) — Pass-2 C-006
17. Decide on `DuelOpponentPanel`/`RaceResultsScreen`/`TriviaRoundScreen` — Pass-2 L-026/L-027/L-028
18. Update `.claude/skills/multiplayer/SKILL.md` to remove false "DONE" markers

## Verification protocol for fixes

After each tier, re-run:

```bash
# 1. Two-Steam-client playtest via /multiplayer-playtest
# 2. Headless check that coop RNG matches:
node -e "
const { initRunRng, getRunRng } = require('./dist/services/seededRng');
initRunRng(12345);
const a = getRunRng('cardDraw').next();
initRunRng(12345);
const b = getRunRng('cardDraw').next();
console.assert(a === b, 'run seed not deterministic');
"
# 3. grep -rn initGameMessageHandlers src/ → must now show a non-test caller
# 4. grep -rn initDuel src/ → must now show a non-test caller
```

## Cross-references

- `data/playtests/mp-batches/MP-STEAM-AUDIT-2026-04-22/AUDIT.md` — pass 1 audit
- `data/playtests/mp-batches/MP-STEAM-AUDIT-2026-04-22/issues.json` — pass 1 issue JSON
- `data/playtests/leaderboard.json` — all issues (both passes), filter by sourceBatch
- `.claude/skills/multiplayer/SKILL.md` — phase tables (need update — several "DONE" rows are orphan)
- `docs/architecture/multiplayer.md` — architecture doc
