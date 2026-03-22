# AR-225: Reward & Treasure Room Fixes

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #32, #40, #42, #43
> **Priority:** P1 — Gameplay-breaking bugs + UX fixes
> **Complexity:** Medium (4 distinct fixes)
> **Dependencies:** AR-220 (card rendering improvements referenced in #43)

---

## Overview

Fix four issues with reward and treasure rooms: auto-skip timeout bug, treasure room giving cards/gold/health instead of relics-only, multi-enemy relic conversion, and reward screen card rendering not matching combat improvements. Also adds a stone slab art redesign reminder as a tracked TODO.

---

## User's Exact Words

- **#32:** "When you wait too long to select a reward it automatically seems to skip the reward and go to the map, this is bad!!"
- **#40:** "The reward screen with the stone slab and cloth on it needs to be redone by me, just create an AR that requires me to do that so I can remember. Also, those treasure rooms should NOT give cards, instead only give the relics as pickup option, NO HEALTH NO GOLD. Right now a treasure room seems to give two back to back reward screens. One with relics then one with cards, ONLY do the relics."
- **#42:** "We have some multi-enemy relics, but never any multiple enemies. If there are less than 5, just change what they do based on their lore and something basic but that we haven't seen before, like more cards is more strength, start with block per turn, boosts damage by 50% with hp under 25% etc."
- **#43:** "The cards in the reward room, the floating icons and their popup, don't have the latest improvements to how cards are rendered like we mentioned in our skill, and how we do it during combat."

---

## Sub-Steps

### 1. Fix Reward Auto-Skip Timeout

- **What:** The card selection step in `CardRewardScreen.svelte` may be exiting prematurely. Investigate and fix.
- **Context:** `CardRewardScreen.svelte` has two intentional `autoAdvanceTimer` calls:
  - Lines 275-277: 900ms auto-advance on the `gold` step (announcement pacing — intentional)
  - Lines 279-281: 1000ms auto-advance on the `heal` step (announcement pacing — intentional)
  - The `rewardStep === 'card'` step has NO auto-skip timer — this is correct by design
- **The gold and heal timers are NOT the bug.** They pace the announcement sequence between steps. Do NOT remove them.
- **Worker must:** Add `console.log` tracing at each step transition to identify exactly when and why the card step exits before the player selects. Check: does `proceedAfterReward()` get called without user input? Does some `onComplete` callback fire unexpectedly?
- **Fix:** Only remove or guard a timer/callback if logging confirms it causes the skip. Do NOT blindly remove all `autoAdvanceTimer` references.
- **Behavior after fix:** Reward screen stays open on the card selection step indefinitely until the player makes a selection or explicitly skips.
- **File:** `src/ui/components/CardRewardScreen.svelte`
- **Acceptance:** Player can wait on the card reward step as long as they want. No auto-skip. Gold/heal announcement pacing still works correctly.

---

### 2. Treasure Rooms — Relics Only

- **What:** Treasure rooms currently show two reward screens back-to-back (relic selection, then card reward). Change to show ONLY the relic selection. No card reward, no health, no gold.
- **Root cause:** `gameFlowController.ts` — `openRelicChoiceRewardRoom()` (line ~1117) calls `openCardReward()` in its `onComplete` callback. When a treasure room completes its relic offer, it chains into a card reward screen.
- **Fix:** In `openTreasureRoom()` (~line 1090), pass a custom `onComplete` to the relic reward flow that calls `proceedAfterReward()` directly, bypassing `openCardReward()`. Do NOT modify `openRelicChoiceRewardRoom()` itself — it is shared with boss and elite flows which SHOULD still chain to cards.
- **Fallback path:** When no relics are available (currently: gives +25 gold AND calls `openCardReward()`), new behavior: give nothing extra and proceed to map. No card reward, no gold.
- **State check:** `gameFlowState` has both `'treasureReward'` and `'relicReward'` states. Verify that `openTreasureRoom()` correctly sets `'treasureReward'` and that this state is not confused with the elite/boss `'relicReward'` flow.
- **Files:**
  - `src/services/gameFlowController.ts` — `openTreasureRoom()` (~line 1090), `openRelicChoiceRewardRoom()` (~line 1117)
- **Acceptance:** Treasure rooms show exactly 1 reward screen (relic selection only). No second screen. No health. No gold.

---

### 3. Stone Slab Redesign — User Action Required

- **What:** The reward room stone slab + cloth art needs to be redesigned by the user. This is an art task, not a code task.
- **Action:** Add a prominent TODO comment in `src/game/scenes/RewardRoomScene.ts` (the Phaser scene that renders the stone slab/altar visual) referencing this requirement.
- **Comment text (exact):**
  ```
  // TODO AR-225: Stone slab + cloth art needs redesign by user.
  // User request: "The reward screen with the stone slab and cloth on it needs to be redone by me."
  // Replace placeholder art with final asset when ready. See AR-225.
  ```
- **This is NOT a code implementation task.** No art is generated here.
- **File:** `src/game/scenes/RewardRoomScene.ts`
- **Acceptance:** TODO comment is present in `RewardRoomScene.ts`. User is reminded when they next open that file.

---

### 4. Multi-Enemy Relics — Convert to Single-Enemy Effects

- **What:** Find all relics that reference multiple enemies or multi-enemy combat. Since the game never has multiple enemies simultaneously, these relics are effectively dead.
- **Search strategy:**
  1. Grep ALL relic descriptions and names in `src/data/relics/index.ts`, `src/data/relics/unlockable.ts`, and `src/data/relics/starters.ts` for: `"enemies"`, `"all other enemies"`, `"spread to"`, `"each enemy"`, `"other enemies"`, `"multiple enemies"`
  2. The only confirmed relic with a multi-enemy flag is `toxic_bloom` in `unlockable.ts` (line ~743, `excludeFromPhase1: true`). The search MUST be exhaustive — do not assume this is the only one.
- **If fewer than 5 multi-enemy relics found:** Redesign their effects in place. Guidelines:
  - Base the new effect on the relic's existing lore/name (thematic fit)
  - Suggestions from user: "more cards is more strength, start with block per turn, boosts damage by 50% with hp under 25% etc."
  - Each redesigned relic must have a unique effect not already covered by existing relics
  - For `toxic_bloom` specifically: also change `excludeFromPhase1: true` to `false` so it becomes available
- **If more than 5:** Flag all of them in a comment and create a follow-up AR. Do not redesign in this pass.
- **Files:**
  - `src/data/relics/index.ts`
  - `src/data/relics/unlockable.ts`
  - `src/data/relics/starters.ts`
  - `src/services/relicEffectResolver.ts` — update effect logic for redesigned relics
- **Acceptance:** No relic descriptions reference multi-enemy scenarios. All redesigned relics have unique, functional effects. `npx vitest run` still passes.

---

### 5. Reward Room Cards — Latest Rendering

- **What:** Cards displayed in the reward room must use the same rendering pipeline as combat cards.
- **Context:** `CardRewardScreen.svelte` lines 366-376 ALREADY import and use the V2 frame pipeline: `getBorderUrl`, `getBaseFrameUrl`, `getBannerUrl`, `getUpgradeIconUrl`, `getChainColor`, `getChainGlowColor`. Full parity may already exist.
- **Worker must:** DIFF exactly what combat cards render versus what reward room cards render. Do NOT assume work is needed — confirm the gap first. Check:
  - Are all V2 frame layers (base, border, banner, upgrade icon) applied the same way?
  - Are chain border colors (`getChainColor`, `getChainGlowColor`) applied correctly?
  - Does the AP badge render the same way?
  - Are mastery indicators present?
  - Is description styling (font, size, keyword highlighting) identical?
- **If a gap is found:** Bring reward room card rendering to full parity with combat card rendering.
- **If no gap is found:** Document that parity is confirmed and close this sub-step.
- **File:** `src/ui/components/CardRewardScreen.svelte`
- **Acceptance:** Reward room cards are visually identical to combat cards. Any confirmed gap is closed. If already at parity, this is documented.

---

### 6. Reward Room Gold Icon Fix

- **What:** There is a stray pixel/coin at the bottom of the gold icon used in the reward room. This is a spritesheet artifact from a previous layout.
- **Context:** `CardRewardScreen.svelte` uses the emoji `🪙` (line ~321) for gold display in the Svelte layer — that is NOT the source of the issue. The stray pixel is in the Phaser-rendered `gold_tier_N.png` files loaded by `RewardRoomScene.ts`.
- **Worker must:**
  1. Visually inspect each `public/assets/reward_room/gold_tier_N.png` file (all tiers) to identify which file(s) have the stray pixel
  2. Crop or edit the offending PNG(s) to remove the artifact
  3. Verify the fixed file looks clean with no stray pixels below the main icon
- **Files:**
  - `public/assets/reward_room/gold_tier_N.png` (check all tier variants)
  - `src/game/scenes/RewardRoomScene.ts` — verify correct asset path references after any rename
- **Acceptance:** All gold tier PNGs are clean. No stray pixel or coin artifact at the bottom. Gold icon renders correctly in the reward room scene.

---

## Files Affected

- `src/ui/components/CardRewardScreen.svelte` — auto-skip investigation/fix, card rendering parity
- `src/services/gameFlowController.ts` — treasure room relics-only flow (`openTreasureRoom()`)
- `src/game/scenes/RewardRoomScene.ts` — stone slab TODO comment, gold icon asset path
- `src/data/relics/index.ts` — multi-enemy relic redesign
- `src/data/relics/unlockable.ts` — multi-enemy relic redesign (including `toxic_bloom`)
- `src/data/relics/starters.ts` — multi-enemy relic search (may have no changes)
- `src/services/relicEffectResolver.ts` — updated effect logic for redesigned relics
- `public/assets/reward_room/gold_tier_N.png` — gold icon fix (all tier variants)
- `docs/GAME_DESIGN.md` — update: Treasure Room rewards section, redesigned relic descriptions

---

## Worker Notes

These are critical implementation constraints. Read before starting any sub-step.

1. **Auto-skip bug (Sub-step 1):** The gold and heal step timers in `CardRewardScreen.svelte` are INTENTIONAL announcement pacing — do not remove them. Add `console.log` tracing first to confirm where and why the card step exits prematurely. Only remove or guard code that logging confirms is causing the skip.

2. **Treasure room fix (Sub-step 2):** Modify `openTreasureRoom()` in `gameFlowController.ts` only. Do NOT modify `openRelicChoiceRewardRoom()` — it is shared with boss/elite flows that must still chain to card rewards. The fix is scoped to the treasure room's `onComplete` callback.

3. **Multi-enemy relic search (Sub-step 4):** The search must be exhaustive. `toxic_bloom` is the only confirmed relic, but grep all description strings across all three relic definition files. Do not assume the list is complete without running the search.

4. **Card rendering (Sub-step 5):** `CardRewardScreen.svelte` already uses the V2 frame pipeline. Diff combat vs. reward rendering before assuming any work is needed. This sub-step may be a no-op if parity is already present.

5. **Gold icon (Sub-step 6):** The emoji `🪙` in the Svelte layer is NOT the issue. The stray pixel is in Phaser-rendered PNG files at `public/assets/reward_room/`. Inspect those files visually, not the Svelte component.

6. **Stone slab TODO (Sub-step 3):** This goes in `src/game/scenes/RewardRoomScene.ts` (a Phaser scene file), not any Svelte component. No Svelte file owns the stone slab visual.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Reward screen card step has no auto-skip; gold/heal announcement pacing still works
- [ ] Treasure room shows exactly 1 reward screen (relic selection only — no cards, health, or gold)
- [ ] No double reward screen in treasure rooms
- [ ] Stone slab TODO comment present in `src/game/scenes/RewardRoomScene.ts`
- [ ] All multi-enemy relics identified via exhaustive grep; redesigned (if <5) with unique effects
- [ ] `toxic_bloom` updated: new effect + `excludeFromPhase1` set to `false`
- [ ] Reward room card rendering confirmed at parity with combat cards (or gaps closed)
- [ ] All `public/assets/reward_room/gold_tier_N.png` files are clean (no stray pixel)
- [ ] `docs/GAME_DESIGN.md` updated: Treasure Room rewards, relic descriptions

---

## Visual Testing — MANDATORY

**After ALL sub-steps are implemented, a Sonnet visual-testing worker MUST inspect the result before the AR is considered complete.**

### Procedure

1. Ensure the dev server is running (`npm run dev`)
2. Navigate with Playwright MCP: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Load the relevant scenario: `browser_evaluate(() => window.__terraScenario.load('combat-basic'))` (or the appropriate scenario for this AR)
4. Take screenshot: `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`
5. Read the screenshot: `Read('/tmp/terra-screenshot.jpg')` to visually inspect
6. Take DOM snapshot: `mcp__playwright__browser_snapshot` for structural verification
7. Check console: `mcp__playwright__browser_console_messages` for JS errors
8. **If ANY visual issue is found: fix it before reporting done.** Do not tell the user "it should work" — CONFIRM it works.

### What to Verify (per AR)

The visual-testing worker must check every sub-step's acceptance criteria against the actual rendered output. Specific checks:

- Layout positions match the AR's layout diagram (if any)
- No element overlap or clipping
- Text is readable at 1920x1080 landscape
- Colors match the spec (HP bar colors, chain colors, etc.)
- No hardcoded-px visual artifacts (elements too small or too large)
- No console errors or warnings
- Dynamic scaling works (test at 1920x1080 AND 1280x720 if the AR touches layout)

### Resolution

- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's RAF blocks it permanently
- **NEVER** use `page.screenshot()` via `browser_run_code` — same RAF blocking issue
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')`
- Use Sonnet workers (`model: "sonnet"`) for visual inspection — equally capable as Opus for screenshot analysis
