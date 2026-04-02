# Playtest Batch Summary — BATCH-2026-04-02-001
**Date**: 2026-04-02 | **Testers**: 1 (Full Run Bug Hunter) | **Domain**: general_knowledge | **Floors**: 2 target

## Overall Verdict: FAIL

The full run was blocked after 3 combat encounters by a CRITICAL Phaser scene lifecycle crash in RewardRoomScene. The tester never reached shops, rest rooms, mystery events, bosses, or the retreat/delve decision.

---

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Full Run Bug Hunter | FAIL | 1 | 1 | 2 | 1 |

**Totals**: 1 Critical, 1 High, 2 Medium, 1 Low

---

## All Issues by Severity

### CRITICAL (1)

| # | Issue | Description |
|---|-------|-------------|
| C-1 | RewardRoomScene crash after 3rd combat | Phaser scene fails to initialize after 3+ combat cycles. `TypeError: Cannot read properties of undefined (reading 'trigger')`. Screen permanently stuck on black canvas. **Run-ending bug — identical to BATCH-2026-04-01-001 C-1.** |

### HIGH (1)

| # | Issue | Description |
|---|-------|-------------|
| H-1 | Race condition: first acceptReward() returns "RewardRoomScene not active" | Svelte screen store updates to `rewardRoom` before Phaser scene is fully active. Retrying after ~3s succeeds. |

### MEDIUM (2)

| # | Issue | Description |
|---|-------|-------------|
| M-1 | cardReward screen never shown | acceptReward() transitions directly to dungeonMap, skipping card selection entirely. May be by design but contradicts GDD. |
| M-2 | getCombatState() undefined fields after enemy death | Brief window where getScreen()='combat' but all combat state fields are undefined. Affects test harnesses. |

### LOW (1)

| # | Issue | Description |
|---|-------|-------------|
| L-1 | Phaser blendModes error on 2nd rewardRoom | `Cannot read properties of null (reading 'blendModes')` — precursor to C-1 crash. |

---

## Cross-Batch Correlation

**C-1 is the SAME bug as BATCH-2026-04-01-001 C-1** (reward room crash). It was reported by the Fun/Engagement and Balance Curve testers on April 1st and is STILL PRESENT. This is the #1 blocker for all full-run testing.

---

## Room Type Coverage Gap

| Room Type | Tested? |
|-----------|---------|
| combat | YES (3 encounters) |
| rewardRoom | PARTIAL (crashes after 3rd) |
| cardReward | NO (never reached) |
| shop | NO |
| rest | NO |
| mystery | NO |
| elite | NO |
| boss | NO |
| retreatOrDelve | NO |
| runEnd | NO |

**Only 2 of 10 room types were testable.** Fixing C-1 is prerequisite for meaningful full-run testing.

---

## Additional Discoveries

1. **`selectDomain()` and `selectArchetype()` APIs are dead** — not wired to current deckSelectionHub/triviaDungeon UI flow. Must use DOM clicks instead.
2. **`selectMapNode()` needs short ID** (`'r0-n0'`) not full testId (`'map-node-r0-n0'`).
3. **Onboarding canvas blocks pointer events** — must use JS click on `button.enter-btn`.
4. **HUD shows "Floor 2" during stuck state** even though player never delved — RunState corruption.

---

## Recommendations (Priority Order)

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| 1 | **Fix RewardRoomScene lifecycle crash** — audit shutdown/destroy for event listener leaks | Unblocks ALL full-run testing | Medium |
| 2 | **Fix acceptReward() race condition** — add Phaser scene isActive check | Prevents flaky test failures | Low |
| 3 | **Clarify cardReward flow** — is it intentionally auto-collected by acceptReward()? | Design intent question | Low |
| 4 | **Update __rrPlay API** — mark selectDomain/selectArchetype as deprecated | Prevents future tester confusion | Low |
| 5 | **Re-run /llm-playtest fullrun** after C-1 fix to get shop/rest/mystery/boss coverage | Full regression test | N/A |

---

## Next Steps

- Fix RewardRoomScene.ts — investigate `shutdown()`/`destroy()` for uncleaned event listeners and `trigger` property on destroyed objects
- After fix: re-run `/llm-playtest fullrun` to test remaining room types
- Run `/inspect rewardRoom` to verify the fix with all testing methods
- Consider running full 5-tester batch (`/llm-playtest`) after fix
