# AR-49 — Learning Threshold Reward Gate

## Overview
**Goal:** Prevent players from grinding camp/meta-progression rewards by playing content they already know. Players can still play whatever they want — no limitations, no difficulty manipulation — but camp rewards are zeroed out when the system detects the run wasn't a genuine learning experience.

**Philosophy:** "Play whatever you want. Learn whatever you want. But you can't grind mastered content for camp rewards."

**Dependencies:** Existing mastery scaling system (masteryScalingService.ts), tier system, pool builder.
**Estimated complexity:** Medium (tracking + threshold checks at run end, UI feedback, pre-run warning).

## Design

### Detection Signals

| Signal | Threshold | Result |
|--------|-----------|--------|
| **Novel fact accuracy > 80%** | Tier 1 (new/unseen) facts only, checked at run end | Camp rewards → 0 |
| **Overall run accuracy > 85%** | All facts answered during run, checked at run end | Camp rewards → 0 |
| **Pool mastery > 75% at start** | Pre-run check on pool composition | Show warning + camp rewards → 0 |
| **Zero facts answered wrong** | Run end check (perfect run) | Camp rewards → 0 |
| **Accuracy 70-85%** | Run end | Reduced rewards (existing mastery scaling 0.4x-1.0x) |
| **Accuracy < 70%** | Normal learning run | Full rewards |

### What "Camp Rewards" Means
- Dust (currency)
- Relic shards
- Any persistent progression currency earned at run end
- Does NOT affect in-run gold, card rewards during the run, or XP/mastery progression on individual facts (SM-2 still updates normally — the learning still counts, just not the meta-rewards)

### What The Player Sees

**Pre-run warning (pool mastery > 75%):**
A gentle banner on the domain selection or run start screen:
> "You've mastered most of this content. This will be a practice run — camp rewards disabled. Choose a less familiar domain to earn rewards!"

Not blocking — player can still start the run. Just informative.

**Post-run feedback (threshold triggered):**
On the RunEndScreen, instead of showing dust/shard rewards:
> "Practice Run — You already know this material well! Camp rewards: none.
> Tip: Try a domain you're still learning to earn rewards."

The run stats (accuracy, floors cleared, cards played) still show normally. The learning still counted (SM-2 updated). Just no camp currency.

**Normal run (thresholds not triggered):**
No change — full rewards as currently implemented.

## Sub-steps

### 1. Track per-run accuracy statistics
- During combat, track: total questions answered, total correct, novel (Tier 1) questions answered, novel correct
- Store in the run state (`activeRunState`) so it persists across encounters
- Fields to add to run state:
  - `questionsAnswered: number`
  - `questionsCorrect: number`
  - `novelQuestionsAnswered: number`
  - `novelQuestionsCorrect: number`

**Files:** `src/services/runManager.ts` (RunState type), `src/services/turnManager.ts` or `src/services/encounterBridge.ts` (increment counters on answer)
**Acceptance:** Run state tracks all four counters. Counters increment correctly during combat.

### 2. Pre-run mastery check with warning
- In the pool builder or run start flow, check if >75% of the pool is Tier 2b+
- If so, set a flag on the run state: `practiceRunDetected: true`
- Show a warning banner on the domain selection screen or run start

**Files:** `src/services/encounterBridge.ts` or `src/services/gameFlowController.ts`, `src/ui/components/DomainSelection.svelte`
**Acceptance:** When pool is >75% mastered, player sees a warning. Flag is set on run state.

### 3. Post-run threshold evaluation
- At run end, evaluate:
  - `novelQuestionsCorrect / novelQuestionsAnswered > 0.80` → practice run
  - `questionsCorrect / questionsAnswered > 0.85` → practice run
  - `questionsCorrect === questionsAnswered && questionsAnswered > 5` → practice run (perfect)
  - OR `practiceRunDetected` flag already set from pre-run check
- If any trigger fires, set `campRewardsDisabled: true` on the run end data
- The existing mastery scaling (0.4x-1.0x) still applies for the 70-85% grey zone

**Files:** `src/services/gameFlowController.ts` (run end logic), `src/services/masteryScalingService.ts` (new function)
**Acceptance:** Practice runs correctly identified. `campRewardsDisabled` flag set.

### 4. Zero out camp rewards when flagged
- In the run end reward calculation, if `campRewardsDisabled === true`:
  - Dust earned → 0
  - Relic shards → 0
  - Any other camp currency → 0
- SM-2 review state updates still apply (learning still counts)
- In-run gold and card rewards were already consumed during the run (no change)

**Files:** `src/services/gameFlowController.ts` (reward distribution)
**Acceptance:** Flagged runs earn zero camp currency. SM-2 still updates normally.

### 5. UI feedback on RunEndScreen
- If `campRewardsDisabled`, show a distinct message on the run end screen
- Message: "Practice Run — You already know this material well! Camp rewards: none."
- Tip: "Try a domain you're still learning to earn rewards."
- Styling: neutral/informative tone, not punitive. Maybe a blue/grey info banner rather than red warning.
- Run stats (accuracy, floors, cards) still display normally

**Files:** `src/ui/components/RunEndScreen.svelte`
**Acceptance:** Practice runs show informative message. Normal runs unaffected.

### 6. Update GAME_DESIGN.md
- Add "Learning Threshold Reward Gate" section under Difficulty System
- Document all thresholds and the philosophy

**Files:** `docs/GAME_DESIGN.md`
**Acceptance:** Design doc reflects the new system.

## Files Affected
| File | Changes |
|------|---------|
| `src/services/runManager.ts` | Add accuracy tracking fields to RunState |
| `src/services/encounterBridge.ts` or `src/services/turnManager.ts` | Increment accuracy counters |
| `src/services/gameFlowController.ts` | Pre-run mastery check, post-run evaluation, reward zeroing |
| `src/services/masteryScalingService.ts` | New `isPracticeRun()` evaluation function |
| `src/ui/components/DomainSelection.svelte` | Pre-run warning banner |
| `src/ui/components/RunEndScreen.svelte` | Practice run feedback message |
| `docs/GAME_DESIGN.md` | Document the system |

## Verification Gate
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Test: Start run with >75% mastered pool → warning shown, rewards disabled
- [ ] Test: Complete run with >85% overall accuracy → camp rewards = 0
- [ ] Test: Complete run with >80% novel fact accuracy → camp rewards = 0
- [ ] Test: Perfect run (0 wrong answers, 5+ questions) → camp rewards = 0
- [ ] Test: Normal run (60% accuracy) → full rewards
- [ ] Test: Grey zone run (75% accuracy) → reduced rewards via existing scaling
- [ ] Test: SM-2 still updates on practice runs (learning counts, just not rewards)
- [ ] RunEndScreen shows correct message for practice vs normal runs
