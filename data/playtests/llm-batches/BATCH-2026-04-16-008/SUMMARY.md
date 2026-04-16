# Playtest Batch Summary — BATCH-2026-04-16-008
**Date**: 2026-04-16 | **Testers**: 1 (Full Run Bug Hunter) | **Domain**: mixed | **Floors**: 3 target

## Overall Verdict: ISSUES (2 high, 1 medium, 1 low)

Significant improvement over BATCH-007 — stale getCombatState cascade eliminated. Tester completed 5 combats across 3 run attempts. Did not reach floor 3 due to death + reward room issue.

## Orchestrator Verification

| Bug | Real Game Bug? | Source Verification |
|-----|---------------|---------------------|
| BUG-001 Reward room not triggering | **MAYBE** | Could be real — needs reproduction in real browser. The tester navigated via "Descend Again" which calls `playAgain()` → `onArchetypeSelected('balanced')` directly, bypassing deck selection. This altered entry path may put the reward state machine in a bad state. |
| BUG-002 "Descend Again" skips domain selection | **Not a bug — by design** | `playAgain()` in gameFlowController.ts:3307 intentionally calls `onArchetypeSelected('balanced')` directly, reusing the previous domain settings. It's a "quick restart" button, not a fresh run. The "corrupted map state" claim is likely the tester misunderstanding the starting node. |
| BUG-003 Librarian HP too high for floor 1 | **Partially real** | Librarian baseHP=16 × 4.75 = 76 runtime HP (not 100 as claimed — hallucinated value). Still, 76 HP for an ELITE on floor 1 row 1 is intentional — Librarian is `category: 'elite'`. The tester encountered it from a mystery node, which is expected (mystery events can trigger elite combat). The Librarian is correctly placed in `shallow_depths` elites pool. **Not a bug but worth monitoring — an elite from mystery on row 1 is harsh for new players.** |
| BUG-004 chainLength always 0 | **Real API timing bug** | `finalState.chainLength` is read 0-500ms after `handlePlayCard`, but chain state updates may arrive slightly later. The poll only waits for hand shrink / AP change, not chain update. **API-only issue — chain works correctly in gameplay.** |

### Golem HP Clarification
The tester reported "Golem HP 39, not 8." This is correct at RUNTIME: baseHP=8 × ENEMY_BASE_HP_MULTIPLIER(4.75) × getFloorScaling(1.0) = **38** (plus variance). The "HP 10→8" nerf was applied to `baseHP`, which is then multiplied. The nerf IS working — heal of 3 is confirmed.

## Fixes Confirmed Working
- getCombatState null outside combat (BATCH-007 fix): **CONFIRMED**
- endTurn playerDefeated on death: **CONFIRMED**
- Chain AP discount (momentum): **CONFIRMED**
- Enriched API returns: **CONFIRMED**
- Golem heal=3 nerf: **CONFIRMED**

## Recommendations
1. Investigate reward room not triggering on runs started via "Descend Again" — may be a real state machine issue
2. Fix chainLength API timing (poll for chain update, not just hand/AP)
3. Consider whether mystery-event elites on floor 1 row 1 are too harsh for starter decks
