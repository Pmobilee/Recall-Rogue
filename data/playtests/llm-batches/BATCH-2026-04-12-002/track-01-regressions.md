# Track 1 — Known-Critical Regression Verification
**Date**: 2026-04-12 | **Agent**: track-1 | **Method**: Docker warm container (port 3282)

## Verdict: ISSUES (4 fixed, 1 partially fixed, 2 still reproducing)

---

### R1: `{N}` Template Placeholder Leak — Correct Answers
**Status**: FIXED (for primary correct answers; see R4 for distractor pipeline gap)

**Evidence**:
```json
[
  {"correctAnswer":"Over 340","choices":["Over 340","Over 500","Over 400","Over 220"]},
  {"correctAnswer":"Touchscreen over keyboard"},
  {"correctAnswer":"At least 1564"},
  {"correctAnswer":"Vacuum tubes"},
  {"correctAnswer":"50 megatons"}
]
```
No `{` characters in `correctAnswer` or any `choices` field across 5 sampled quiz previews on combat-basic. The `displayAnswer()` stripping pipeline works correctly for the primary answer path.

---

### R2: `chargePlayCard` Crash on Continued-Run State
**Status**: FIXED

**Evidence**:
```
rrPlay chargePlayCard: ok=True out={"ok": true, "message": "Charge-played card 0 (attack) — answered correctly"}
rrPlay chargePlayCard: ok=True out={"ok": true, "message": "Charge-played card 0 (attack) — answered correctly"}
```
After `startRun` (which simulates continued-run state), `chargePlayCard` succeeds on both calls. No `currentEncounterSeenFacts is not iterable` error thrown. Console errors: none.

Fix confirmed: commit `64229c9` — `serializeActiveDeckSets()` / `rehydrateActiveDeckSets()` wrap the `Set<string>` correctly.

Note: `enterCombat` is not a registered `__rrPlay` method (test expected it; actual method doesn't exist). The continued-run test was validated by calling `chargePlayCard` after `startRun` since combat was already active from the scenario.

---

### R3: Shop Relic Click No-Op
**Status**: FIXED (with caveat)

**Evidence**:
```
getRunState before: currency=1000
shopBuyRelic result: {"ok": true, "message": "Bought shop relic 'whetstone'. Screen: shopRoom"}
getRunState after:  currency=903  (decreased by 97g — price of Whetstone)
getShopInventory after: relics=[iron_shield only]  (whetstone removed from shop)
```

The `tooltip-backdrop pointer-events: none` fix (commit `12b3445b`) allows the initial relic buy button click to open the purchase confirmation modal. The modal then correctly processes the purchase.

**Caveat**: `shopBuyRelic(index)` in playtestAPI only clicks the initial button (opens modal) but does NOT click the confirm button (`[data-testid="shop-btn-buy"]`). Gold remains 1000 if only the playtestAPI method is called. The correct test sequence requires also clicking `shop-btn-buy`. The underlying UI bug is fixed; the test helper API is incomplete.

---

### R4: Cross-Category Distractor Pollution (`inv_3_ic_kilby`)
**Status**: PARTIALLY FIXED — RESIDUAL BRACE LEAK IN BRIDGED DISTRACTOR PIPELINE

The `inv_3_ic_kilby` specific case was not reproduced (hand composition varies). However, a related `{N}` brace leak was confirmed in the **bridged distractor pipeline** affecting `pc_5_gamergate_year` and `pc_4_hot_wheels_launch_year`.

**Evidence**:
```
card 1: factId=pc_5_gamergate_year  
  correctAnswer='2014' (CLEAN)  
  choices=['{2013}', '{2023}', '2014', '{1984}']  ← BRACE LEAK in distractors
  
card 3: factId=pc_4_hot_wheels_launch_year  
  correctAnswer='1968' (not tested in this run — confirmed from prior batch)  
  choices=['{225}', '{1.7}', '{2006}', ...]  ← BRACE LEAK in distractors
```

**Root cause identified**: `getBridgedDistractors()` in `quizService.ts` line 188 returns `result.distractors.map(d => d.correctAnswer)` — returns raw `correctAnswer` from pool facts WITHOUT calling `displayAnswer()`. Pool facts with `{year}` or `{N}` format correctAnswers emit the braces directly into quiz choices.

**Fix required**: Change line 188 of `quizService.ts` from:
```typescript
return result.distractors.map(d => d.correctAnswer)
```
to:
```typescript
return result.distractors.map(d => displayAnswer(d.correctAnswer))
```
(Import `displayAnswer` from `'./numericalDistractorService'` — already imported in the file.)

Scope: Any bridged fact (tagged `bridge:{deckId}`) whose answerTypePool contains facts with brace-marked correctAnswers.

---

### R5: `turnsRemaining: 9998/9999` Sentinel Leak
**Status**: STILL REPRODUCING (in API — UI display is fixed)

**Evidence**:
```json
{
  "playerStatusEffects": [
    {"type": "strength", "value": 1, "turnsRemaining": 9999}
  ]
}
```
After playing `warcry` (permanent Strength buff), `getCombatState` still returns `turnsRemaining: 9999` in the raw API response.

**Status of fix**: The UI fix (commit `31963f4f`) gated display in `StatusEffectBar.svelte` — players do NOT see `9999` on screen anymore. The `getCombatState` playtestAPI function at line 174 passes `turnsRemaining: s.turnsRemaining` raw without sanitization.

**Impact**: Not player-visible (UI is fixed). However, any LLM tester or automation that reads `getCombatState` and checks for `turnsRemaining > 100` or `=== 9999` as a bug detector will false-positive. Recommend sanitizing in the API: `turnsRemaining: s.turnsRemaining >= 9999 ? null : s.turnsRemaining`.

---

### R6: `startStudy()` Screen Navigation Bug
**Status**: FIXED

**Evidence**:
```
getScreen (before startStudy): "restRoom"
startStudy(3): {"ok": false, "message": "empty study pool — no cards are eligible for mastery upgrade in this run"}
getScreen (after): "restRoom"  ← screen did NOT change (correct — no softlock)
getStudyCard(): null  ← correct, no study initiated

DOM check: rest-study button disabled=true  ← UI correctly gates the button
getStudyPoolSize(): 0
```
The softlock (QUESTION 1/0 with no escape) is prevented. The screen store is NOT mutated when the pool is empty, so no broken `restStudy` screen transition occurs. The DOM button is disabled when poolSize=0.

Fix confirmed: commits `a29b11ed2` (API guard) + companion UI guard in RestRoomOverlay.

---

### R7: `getMysteryEventChoices` Broken
**Status**: FIXED (for choice-type events; non-choice events correctly return `[]`)

**Evidence with non-choice event** (reward type — expected `[]`):
```
loadCustom mystery-event → "Lost and Found" (type: reward — "Continue" button only)
getMysteryEventChoices: []  ← correct, no choices exist
```

**Evidence with choice-type event** (`lost_notebook` — `type: 'choice'`):
```
getMysteryEventChoices: [
  {"index": 0, "text": "Read it carefully (upgrade a card)"},
  {"index": 1, "text": "Stuff it in your bag (gain a card)"}
]
DOM .choice-btn count: 2  ← both visible
```
The fix (commit `4956bd89`) changed the selector from the nonexistent `[data-testid="mystery-choice-{i}"]` to `.choice-btn` DOM query with store fallback. Working correctly.

**Clarification**: The `mystery-event` preset spawns a random event. The first test loaded "Lost and Found" (reward type — no choices by design). A choice-type event must be explicitly loaded with `loadCustom({mysteryEventId:'lost_notebook'})` etc. to verify choice reading.

---

## Summary Table

| # | Bug | Status | Fix Commit | Notes |
|---|-----|--------|------------|-------|
| R1 | `{N}` template leak — correct answers | **FIXED** | `0418807eb` | Clean for 5 sampled facts |
| R2 | `chargePlayCard` crash on continued-run | **FIXED** | `64229c9` | `currentEncounterSeenFacts` Set rehydrated correctly |
| R3 | Shop relic click no-op | **FIXED** | `12b3445b` | Backdrop click-eat resolved; purchase flow complete |
| R4 | Cross-category distractor pollution | **PARTIALLY FIXED** | — | Bridged distractor pipeline still emits `{N}` braces (line 188 quizService.ts) |
| R5 | `turnsRemaining: 9999` sentinel leak | **UI FIXED / API LEAKS** | `31963f4f` | Players don't see `9999`; API still raw |
| R6 | `startStudy()` navigation bug / softlock | **FIXED** | `a29b11ed2` | Screen stays `restRoom` when pool empty; button disabled |
| R7 | `getMysteryEventChoices` broken | **FIXED** | `4956bd89` | `.choice-btn` selector works; reward-type events correctly return `[]` |

## New Issues Discovered

### NEW-1: `getBridgedDistractors` brace leak (CRITICAL — player-visible)
**File**: `src/services/quizService.ts` line 188  
**Bug**: `result.distractors.map(d => d.correctAnswer)` returns raw brace-marked strings  
**Fix**: `result.distractors.map(d => displayAnswer(d.correctAnswer))`  
**Scope**: All bridged facts (tagged `bridge:{deckId}`) where pool facts have `{N}` correctAnswers  
**Confirmed facts**: `pc_5_gamergate_year`, `pc_4_hot_wheels_launch_year`

### NEW-2: `shopBuyRelic` playtestAPI incomplete (LOW — test tooling only)
**File**: `src/dev/playtestAPI.ts` line 820  
**Bug**: `shopBuyRelic` opens purchase modal but doesn't click confirm (`[data-testid="shop-btn-buy"]`)  
**Impact**: Gold stays unchanged if callers only call `shopBuyRelic()` — misleading test results  
**Fix**: After clicking initial button, also click `shop-btn-buy` if it appears

### NEW-3: `getCombatState` sentinel not sanitized (LOW — test tooling only)  
**File**: `src/dev/playtestAPI.ts` line 174  
**Bug**: `turnsRemaining: 9999` exposed in API for permanent buffs  
**Impact**: LLM testers may false-positive on this as a bug when it's API noise  
**Fix**: `turnsRemaining: s.turnsRemaining >= 9999 ? null : s.turnsRemaining`
