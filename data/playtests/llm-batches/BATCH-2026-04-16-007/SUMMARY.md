# Playtest Batch Summary — BATCH-2026-04-16-007
**Date**: 2026-04-16 | **Testers**: 1 (Full Run Bug Hunter) | **Domain**: mixed | **Floors**: 3 target

## Overall Verdict: FAIL
Run could not complete 3 floors. Stale combat state cascade blocked boss encounter on floor 1.

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Full Run Bug Hunter | FAIL | 2 | 2 | 2 | 1 |

## Orchestrator Verification of Claims

All 7 bugs were checked against source code. Hallucination assessment:

| Bug | Verdict | Confidence | Notes |
|-----|---------|-----------|-------|
| BUG-001 Stale boss state | **PLAUSIBLE** | 80% | `rr:activeTurnState` store has no explicit clear-on-exit. getCombatState guards check for null but stale non-null data persists. |
| BUG-002 0HP softlock (stale) | **PLAUSIBLE** | 85% | endTurn fix checks `result === 'defeat'` but stale turnState has `result: null`. The fix works for clean combats, not stale state. |
| BUG-003 Stale getCombatState | **CONFIRMED** | 95% | Same root cause as BUG-001. Store not cleared between encounters. |
| BUG-004 drawImage null | **PLAUSIBLE** | 70% | CombatScene.setEnemy exists at line 1111. GL error may be SwiftShader-specific (Docker). |
| BUG-005 No API exit from rest/shop | **CONFIRMED** | 95% | restMeditate() clicks btn and returns. No "continue" API for post-meditation. exitRoom() writes 'base' not 'dungeonMap'. API gap, not game bug. |
| BUG-006 cardUpgradeReveal error | **PLAUSIBLE** | 75% | "Restart Game" + "Error details" = Svelte error boundary. Real JS exception during card upgrade reveal. |
| BUG-007 startRun after navigate | **PLAUSIBLE** | 65% | Edge case — navigate('hub') puts game in abnormal state. Not a real player path. |

## Issues by Priority

### CRITICAL (verified plausible — fix before next playtest)
1. **Stale combat state persists between encounters** (BUG-001/003) — Root cause: `rr:activeTurnState` store not cleared when leaving combat. Cascades into stale boss data, stale AP, stale hand. **Fix: clear `rr:activeTurnState` on room/encounter exit.**
2. **0HP softlock in stale context** (BUG-002) — The today's fix guards `result === 'defeat'` but stale turnState has `result: null`. **Fix: endTurn should also check `playerState.hp <= 0` directly, not just the `result` field.**

### HIGH (fix soon)
3. **drawImage null in setEnemy** (BUG-004) — GL context error during encounter load. May be Docker-specific (SwiftShader). Verify on real browser before prioritizing.

### MEDIUM (API gaps, not player-facing)
4. **No API exit from restMeditate/shopRoom** (BUG-005) — Add `restContinue()` and `shopLeave()` helpers to playtestAPI.
5. **cardUpgradeReveal JS exception** (BUG-006) — Svelte error boundary fires during mystery card upgrade. Needs runtime reproduction.

### LOW (edge case)
6. **startRun after navigate workaround** (BUG-007) — Not a real player path.

## Today's Fixes Status
| Fix | Status |
|-----|--------|
| Enriched card play API | CONFIRMED WORKING |
| rewardRoom force-continue | CONFIRMED WORKING |
| mystery continue fallback | CONFIRMED WORKING |
| GL context guard (EnemySpriteSystem) | PARTIAL — prevents crash but error still logged |
| 0HP softlock fix | PARTIAL — works for UI path, fails in stale state |
| Overdue Golem nerf | NOT TESTED — Golem not encountered |
| Vial drop rates | NOT TESTED — no vials dropped |

## Recommendations
1. **Clear `rr:activeTurnState` on combat exit** — single fix resolves BUG-001, BUG-002, BUG-003
2. **Add `hp <= 0` guard to endTurn** — defense-in-depth for stale state edge cases
3. **Add `restContinue()` and `shopLeave()` to playtestAPI** — unblocks future automated testing
4. **Investigate cardUpgradeReveal error** — reproduce in real browser
5. **Re-run this playtest after fix #1** — the 3-floor target was blocked by stale state

## Next Steps
- Fix the stale turnState store (highest priority — blocks all multi-encounter testing)
- Re-run BATCH-2026-04-16-008 after fix lands
- Run `/balance-sim --runs 1000` to get statistical confirmation alongside the qualitative data
- Run with Golem-heavy floor to verify the nerf
