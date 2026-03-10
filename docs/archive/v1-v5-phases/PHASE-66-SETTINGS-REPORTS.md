# Phase 66: Settings & Reports Polish

## Tech Stack

- Frontend: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- State: `playerSave` writable store (`src/ui/stores/playerData.ts`)
- Save schema: `PlayerSave` type (`src/data/types.ts`)
- Balance constants: `src/data/balance.ts` (`BALANCE.STREAK_MILESTONES`, `BALANCE.DOME_UPGRADE_COSTS`)
- Typecheck: `npm run typecheck` — 0 errors required
- Build: `npm run build` — must succeed

---

## Overview

**Goal:** Fix six playtest findings (M6, M7, M10, L3, L4, L5) related to settings, reports, and informational UI that currently show incomplete, misleading, or placeholder content.

**Priority:** MEDIUM — these are polish issues, not blockers, but they hurt perceived quality.

**Dependencies:** All V2-V4 phases complete (Phases 0-59). No new systems required — all changes are within existing components.

**Estimated Complexity:** Low-Medium — six independent sub-tasks, all confined to existing Svelte components. No new stores, services, or game systems needed.

**Design Decision Refs:** DD-V2-087 (dome upgrade tiers), DD-V2-045 (SM-2 tuning/retention), DD-V2-112 (GAIA personality).

---

## Sub-steps

### 66.1 — Flesh Out Dome Upgrades Tab

**File:** `src/ui/components/Materializer.svelte` (lines 343-356, the `activeTab === 'dome'` block)
**Supporting file:** `src/ui/components/FloorUpgradePanel.svelte`
**Data:** `src/data/balance.ts` — `BALANCE.DOME_UPGRADE_COSTS` or equivalent tier data

**Problem:** The Dome Upgrades tab only shows "Starter Hub / Tier 0" and a bare "Upgrade Current Floor" button with no cost preview, no tier benefits, and no progression indicator.

**Changes:**

1. **Show current tier benefits** — Below the tier badge, add a short description of what the current tier provides:
   - Example: "Tier 0: Basic facilities, 3 objects" / "Tier 1: Expanded rooms, 5 objects"
   - Source this from a `TIER_DESCRIPTIONS` array or inline map in balance.ts (add if missing)

2. **Show upgrade cost preview** — Below the description, display the minerals required for the next tier:
   - Format: "Next Tier: 500 Dust + 50 Crystal" (pull from `BALANCE.DOME_UPGRADE_COSTS[currentTier + 1]` or equivalent)
   - If already at max tier, show "Maximum Tier Reached" instead

3. **Show next tier preview** — A one-line description of what the next tier unlocks:
   - Example: "Unlocks: Workshop expansion, new decoration slots"

4. **Add tier progression bar** — A horizontal progress indicator showing current tier out of max tiers:
   - Visual: filled segments (e.g., 2 of 5 filled), or a simple `Tier 2/5` with a bar
   - Style consistent with existing progress bars in the app

5. **Disable upgrade button at max tier** — When `currentTier >= maxTier`:
   - Button text changes to "Max Tier Reached"
   - Button gets `disabled` attribute and `.disabled` styling (opacity 0.5, no pointer)

**Implementation notes:**
- The existing `FloorUpgradePanel.svelte` already handles the actual upgrade flow — this sub-step enriches the preview shown BEFORE clicking "Upgrade"
- If `BALANCE.DOME_UPGRADE_COSTS` doesn't exist as a structured array, create one in `src/data/balance.ts`:
  ```typescript
  DOME_TIER_INFO: [
    { tier: 0, name: 'Basic', desc: 'Basic facilities, 3 objects', cost: null },
    { tier: 1, name: 'Improved', desc: 'Expanded rooms, 5 objects', cost: { dust: 500, crystal: 50 } },
    { tier: 2, name: 'Advanced', desc: 'Full workshop, 8 objects', cost: { dust: 1500, crystal: 200, shard: 50 } },
    // ... up to max tier
  ]
  ```
- Check `FloorUpgradePanel.svelte` for existing tier/cost data structures and reuse them

**Acceptance Criteria:**
- [ ] Dome Upgrades tab shows current tier description (not just "Tier 0")
- [ ] Upgrade cost for next tier is visible without clicking the upgrade button
- [ ] Next tier preview text is shown
- [ ] Tier progression bar/indicator is visible
- [ ] At max tier, button is disabled with "Max Tier Reached" text
- [ ] Typecheck passes, build succeeds

---

### 66.2 — Fix Streak Milestone Claiming

**File:** `src/ui/components/StreakPanel.svelte`
**Store logic:** `src/ui/stores/playerData.ts` (lines ~367-435, `updateStreak` function)
**Types:** `src/data/types.ts` (line ~531, `claimedMilestones: number[]`)
**Balance:** `src/data/balance.ts` (`BALANCE.STREAK_MILESTONES`)

**Problem:** The 3-Day milestone shows "100% progress (7/3 days)" but the reward was never claimed. The auto-claim logic exists in `playerData.ts` `updateStreak()` but may not have fired for this save state (e.g., streak was already 7 when the auto-claim code was added, or the claim happens only on streak increment).

**Root Cause Investigation:**
- `updateStreak()` in `playerData.ts` (line ~367) iterates `BALANCE.STREAK_MILESTONES` and auto-claims unclaimed milestones where `newStreak >= milestone.days`
- This only runs when `updateStreak()` is called (daily login)
- Existing saves may have streaks that passed milestones before the auto-claim code existed
- The StreakPanel UI shows progress but has no manual "Claim" button as fallback

**Changes:**

1. **Add retroactive claim on panel open** — In `StreakPanel.svelte`, add an `$effect` that runs on mount:
   ```typescript
   $effect(() => {
     if (!save) return
     const unclaimed = BALANCE.STREAK_MILESTONES.filter(
       m => currentStreak >= m.days && !claimedMilestones.includes(m.days)
     )
     if (unclaimed.length > 0) {
       // Trigger the existing updateStreak logic or a new claimMilestones() function
       claimUnclaimedMilestones()
     }
   })
   ```

2. **Add `claimUnclaimedMilestones()` function** to `src/ui/stores/playerData.ts`:
   - Iterates `BALANCE.STREAK_MILESTONES`, finds any where `currentStreak >= days && !claimedMilestones.includes(days)`
   - Awards the milestone rewards (same logic as in `updateStreak()`)
   - Updates `claimedMilestones` array in save
   - Export this function for use by StreakPanel

3. **Visual: Claimed milestones show checkmark** — In StreakPanel's milestone list:
   - Claimed milestones: show a checkmark icon and greyed-out/completed styling
   - Unclaimed but achieved: should not exist after the retroactive fix, but if they do, show a pulsing "Claim!" button
   - Future milestones: show progress bar (current behavior)

4. **Visual: "Reward Claimed!" toast** — When retroactive claiming happens, show a brief notification:
   - Use existing `GaiaToast` or similar notification component
   - Message: "Streak milestone claimed! +{reward}"

**Acceptance Criteria:**
- [ ] Opening StreakPanel with streak >= 3 days and unclaimed 3-day milestone auto-claims it
- [ ] Claimed milestones display checkmark and completed styling
- [ ] Future milestones show progress bar as before
- [ ] Rewards are correctly applied to player save (minerals, titles, etc.)
- [ ] `claimedMilestones` array in save is updated
- [ ] Typecheck passes, build succeeds

---

### 66.3 — Remove "Coming Soon" Settings Items

**File:** `src/ui/components/Settings.svelte` (lines ~295-334)

**Problem:** Four settings items display "Coming Soon" badges: Language Learning, Fact Learning, Review Reminders, Dive Reminders. These create a perception of incompleteness.

**Changes:**

1. **Remove or comment out the four "Coming Soon" settings rows:**
   - "Language Learning" row (~lines 295-302)
   - "Fact Learning" row (~lines 304-310)
   - "Review Reminders" row (~lines 318-325)
   - "Dive Reminders" row (~lines 327-333)

2. **Remove the `.coming-soon-badge` and `.coming-soon-row` CSS rules** (~lines 1013-1020) — clean up unused styles

3. **Verify section headings** — If removing these items leaves a section header ("Learning" or "Notifications") with no items under it, remove the section header too

**Implementation notes:**
- Use HTML comments `<!-- Phase 66: hidden until implemented -->` to wrap the removed blocks so they can be restored later
- Do NOT delete the code entirely — just hide it from rendering

**Acceptance Criteria:**
- [ ] No "Coming Soon" text visible anywhere in Settings
- [ ] No empty section headers remain
- [ ] All other settings items still function correctly
- [ ] Typecheck passes, build succeeds

---

### 66.4 — Add Empty State for 30-Day Activity Chart

**File:** `src/ui/components/GaiaReport.svelte`

**Problem:** The 30-day activity chart in the GAIA Terminal Overview tab shows a mostly-empty line chart (flat line at zero) which looks broken rather than intentional.

**Changes:**

1. **Detect sparse data** — Before rendering the chart, count data points with non-zero values:
   ```typescript
   const meaningfulDataPoints = activityData.filter(d => d.value > 0).length
   ```

2. **Show empty state when fewer than 3 data points:**
   - Hide the chart canvas/SVG
   - Show a styled message box:
     ```
     No activity data yet.
     Keep diving and studying to see your trends here!
     ```
   - Style: centered text, muted color, consistent with other empty states in the app

3. **Keep chart visible when 3+ data points exist** — no change to existing chart rendering

**Implementation notes:**
- The chart may be rendered via a `<canvas>` element or inline SVG — check `GaiaReport.svelte` for the rendering method
- The empty state should occupy roughly the same vertical space as the chart to avoid layout shift

**Acceptance Criteria:**
- [ ] With 0-2 activity data points, chart is replaced with a helpful message
- [ ] With 3+ data points, chart renders normally
- [ ] Empty state message is visually consistent with the component's style
- [ ] Typecheck passes, build succeeds

---

### 66.5 — Update Version String from "Terra Miner" to "Recall Rogue"

**Files to update:**
- `src/ui/components/Settings.svelte` — line 593: `Terra Miner v0.1.0-alpha` -> `Recall Rogue v0.1.0-alpha`
- `src/game/systems/ParticleSystem.ts` — search for "Terra Miner" and update if user-visible
- `src/services/audioService.ts` — search for "Terra Miner" and update if user-visible
- `package.json` — `"name"` field (if it says "terra-miner", update to "recall-rogue")
- `index.html` — `<title>` tag (if it says "Terra Miner")
- Any `manifest.json` or `capacitor.config.ts` with the old name

**Changes:**

1. **Search all files** for the string "Terra Miner" (case-sensitive)
2. **Replace with "Recall Rogue"** in all user-visible locations
3. **For internal/technical identifiers** (package.json `name`, directory names, import paths): leave as-is unless they appear in user-facing UI — changing `package.json` name can break scripts
4. **Specifically update:**
   - Settings About section: `Recall Rogue v0.1.0-alpha`
   - HTML title: `<title>Recall Rogue</title>`
   - Any manifest `short_name` or `name` fields

**Implementation notes:**
- Do NOT rename the project directory or git repository
- Do NOT change import paths or file names
- Only change user-visible strings and metadata fields

**Acceptance Criteria:**
- [ ] Settings -> About shows "Recall Rogue" not "Terra Miner"
- [ ] Browser tab title shows "Recall Rogue"
- [ ] No user-visible reference to "Terra Miner" remains
- [ ] `package.json` name field updated if it was user-visible
- [ ] Typecheck passes, build succeeds

---

### 66.6 — Fix Predicted Retention with 0 Mastered Facts

**File:** `src/ui/components/LearningInsightsTab.svelte`

**Problem:** The "My Learning" tab shows "72% in 30 days / 51% in 60 days" predicted retention even when the player has 0 mastered facts. These are mathematically correct (SM-2 curve on zero facts produces default values) but misleading — there's nothing to retain.

**Changes:**

1. **Detect zero mastered facts:**
   ```typescript
   const masteredCount = $derived(/* count of facts with mastery status */)
   ```
   Check how `masteredFacts` is computed in this component — likely from the SM-2 review state.

2. **Show empty state when masteredCount === 0:**
   - Replace the retention prediction section with:
     ```
     Master some facts to see retention predictions.
     Start by appraising artifacts in the Artifact Lab!
     ```
   - Style: muted text, same area as the prediction display

3. **Show predictions normally when masteredCount > 0** — no change to calculation logic

**Implementation notes:**
- The retention prediction may use `learnedFacts` from the save or a derived count from `reviewStates`
- Check if the component already has a `masteredFacts` or similar derived value
- The threshold should be `=== 0`, not `< N` — even 1 mastered fact makes the prediction meaningful

**Acceptance Criteria:**
- [ ] With 0 mastered facts, retention section shows helpful message instead of percentages
- [ ] With 1+ mastered facts, retention predictions display normally
- [ ] Message is visually consistent with the component
- [ ] Typecheck passes, build succeeds

---

## Verification Gate

All of the following MUST pass before Phase 66 is marked complete:

1. **`npm run typecheck`** — 0 errors (warnings acceptable if pre-existing)
2. **`npm run build`** — succeeds without errors
3. **`npx vitest run`** — all existing tests pass (no regressions)
4. **Playwright visual verification:**
   - Navigate to Materializer -> Dome Upgrades tab -> shows tier info, cost preview, progression bar
   - Navigate to Streak Panel -> achieved milestones are claimed with checkmarks
   - Navigate to Settings -> no "Coming Soon" labels visible
   - Navigate to GAIA Terminal -> Overview -> activity chart shows empty state message (for new/sparse saves)
   - Navigate to Settings -> About -> reads "Recall Rogue"
   - Navigate to GAIA Terminal -> My Learning -> with 0 mastered facts shows message, not percentages
5. **Dev preset testing:** Use `?skipOnboarding=true&devpreset=new_player` (0 facts, 0 streak) and `?skipOnboarding=true&devpreset=mid_game_3_rooms` (has data) to verify both empty and populated states

---

## Files Affected

| File | Sub-step | Change Type |
|------|----------|-------------|
| `src/ui/components/Materializer.svelte` | 66.1 | Modify — enrich Dome Upgrades tab |
| `src/ui/components/FloorUpgradePanel.svelte` | 66.1 | Read — reference tier/cost data |
| `src/data/balance.ts` | 66.1, 66.2 | Modify — add `DOME_TIER_INFO` if missing |
| `src/ui/components/StreakPanel.svelte` | 66.2 | Modify — add retroactive claim + visual states |
| `src/ui/stores/playerData.ts` | 66.2 | Modify — add `claimUnclaimedMilestones()` export |
| `src/ui/components/Settings.svelte` | 66.3, 66.5 | Modify — hide Coming Soon rows, update version string |
| `src/ui/components/GaiaReport.svelte` | 66.4 | Modify — add empty state for activity chart |
| `src/ui/components/LearningInsightsTab.svelte` | 66.6 | Modify — add zero-facts empty state |
| `index.html` | 66.5 | Modify — update title tag |
| `package.json` | 66.5 | Modify — update name if user-visible |
