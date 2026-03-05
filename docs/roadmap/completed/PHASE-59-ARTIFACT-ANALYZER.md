# Phase 59: Artifact Analyzer — Mystery Reward System

## Overview

**Goal:** Transform mined artifacts from simple fact containers into mystery loot boxes cracked open in the Artifact Lab, with reward quality influenced by the player's study habits via a Study Score system.

**Dependencies:** Phases 0-50 (all V2+V3 complete), existing StudyManager, SM-2 system, pendingArtifacts store, FactReveal component, DomeScene hub, GAIA personality system.

**Estimated Complexity:** High — touches save schema, loot generation, UI animation, game flow routing, and cross-system integration (study + mining + dome).

**Design Decision Refs:** DD-V2-087 (artifact appraisal), DD-V2-112 (GAIA personality), DD-V2-045 (SM-2 tuning), DD-V2-201 (loot tables).

---

## Core Concept

Artifacts mined during dives are no longer always "facts". They are now mystery containers that the player cracks open in the Artifact Lab (dome hub room). The cracking animation reveals one of several reward types, with the loot table influenced by the player's study habits.

### IRON RULE: Fact Progression is EXCLUSIVELY Through the Anki-like SM-2 System

- Facts ONLY enter `learnedFacts` via `addLearnedFact()` in `StudyManager.learnArtifact()`
- Mine quizzes update existing review states via `updateReviewState()`, never add new facts
- The artifact analyzer may YIELD a fact as one possible outcome, which then enters the normal Learn/Sell flow

### Reward Types (from cracking an artifact)

1. **Fact** — A knowledge fact (enters current Learn/Sell flow via FactReveal)
2. **Dust/Minerals** — Direct currency reward (dust, shards, crystals, geodes)
3. **Consumable** — Usable item for next dive (bomb, O2 tank, scanner charge, shield)
4. **Fossil** — For the fossil gallery collection
5. **Upgrade Token** — Rare token that permanently boosts pickaxe/scanner/backpack tier
6. **Junk** — Low-value filler (broken crystal, rusty gear) — more common when study habits are poor

### Study Score System

A "Study Score" (0.0 to 1.0) is computed from the player's learning habits:

```
studyScore = clamp(
  (masteredFacts / max(totalLearned, 1)) * 0.3 +
  (1 - min(overdueFacts / max(totalDue, 1), 1)) * 0.4 +
  (recentStudySessions / 5) * 0.3,
  0.0, 1.0
)
```

Where:
- `masteredFacts / totalLearned` = mastery ratio (how well you've retained what you learned)
- `overdueFacts / totalDue` = review debt (inverted — fewer overdue = higher score)
- `recentStudySessions / 5` = recent engagement (capped at 5 sessions in last 7 days)

**Study Score affects loot table:**
- Score >= 0.7 (diligent): Higher chance of upgrades, rare fossils, quality consumables. Junk chance near 0%
- Score 0.3-0.7 (average): Balanced distribution
- Score < 0.3 (neglectful): Junk chance increases dramatically (up to 40%), upgrade tokens almost impossible. GAIA comments on poor calibration.
- Score 0.0 (no facts learned at all — new player): Default balanced table, no penalty (don't punish new players)

### Loot Tables (per artifact rarity tier)

Each artifact still has a rarity (common to mythic) from mine generation. Base loot weights:

**Common artifact:**

| Reward         | Base Weight | Study Bonus                         |
|----------------|-------------|-------------------------------------|
| Junk           | 25          | +30 if score < 0.3                  |
| Dust (small)   | 30          | -                                   |
| Fact           | 25          | -10 if score < 0.3, +10 if > 0.7   |
| Consumable     | 15          | +5 if score > 0.7                   |
| Fossil         | 5           | +5 if score > 0.7                   |
| Upgrade Token  | 0           | -                                   |

**Rare artifact:**

| Reward         | Base Weight | Study Bonus                         |
|----------------|-------------|-------------------------------------|
| Junk           | 10          | +25 if score < 0.3                  |
| Dust (medium)  | 20          | -                                   |
| Fact           | 25          | +10 if > 0.7                        |
| Consumable     | 25          | +5 if score > 0.7                   |
| Fossil         | 15          | +5 if score > 0.7                   |
| Upgrade Token  | 5           | +5 if score > 0.7                   |

**Legendary/Mythic artifact:**

| Reward         | Base Weight | Study Bonus                         |
|----------------|-------------|-------------------------------------|
| Junk           | 5           | +15 if score < 0.3                  |
| Dust (large)   | 10          | -                                   |
| Fact (rare+)   | 20          | +10 if > 0.7                        |
| Consumable     | 20          | +5 if score > 0.7                   |
| Fossil (rare)  | 20          | +5 if score > 0.7                   |
| Upgrade Token  | 25          | +10 if score > 0.7                  |

### Cracking Animation (5 stages)

1. **Stage 1 — "Artifact Received"** (0.5s): Artifact crystal/container appears center screen, glowing with rarity color. Rarity badge shown.
2. **Stage 2 — "Analyzing..."** (tap to start): Player taps the artifact. Cracks appear progressively with light shining through. Sound effects: crystalline cracking, energy buildup.
3. **Stage 3 — "Cracking Open"** (1.5s auto): The artifact shatters outward with particles matching rarity color. Screen flash.
4. **Stage 4 — "Reward Reveal"** (0.5s): The reward type icon fades in with a bouncy scale animation. Reward name and description appear. GAIA reacts.
5. **Stage 5 — "Collect"**: Button to collect the reward. For facts: transitions to the existing Learn/Sell flow. For other rewards: auto-adds and shows confirmation.

### GAIA Commentary

GAIA reacts to both the reward and the study score:

- **Good study score + good reward**: "Your dedication paid off! The crystal resonated with your knowledge."
- **Good study score + junk**: "Even masters find duds sometimes. Your next one will shine."
- **Bad study score + good reward**: "Lucky break! Imagine what you'd find if you studied more..."
- **Bad study score + junk**: "The analyzer needs a knowledgeable operator. Your overdue reviews are... showing."

### Artifact Queue in Hub

When the player returns from a dive with artifacts:
1. Artifact Lab clickable shows a badge count of pending artifacts
2. Clicking enters the cracking flow — one artifact at a time
3. After each crack: "Next Artifact (X remaining)" or "Return to Hub" if done
4. Pending artifacts persist in save — player can crack them across sessions

---

## Sub-steps

### 59.1 — Study Score Service

**File:** `src/services/studyScore.ts` (NEW)

1. Create `src/services/studyScore.ts`
2. Export `computeStudyScore(save: PlayerSave): number` returning a clamped float 0.0 to 1.0
3. Computation logic:
   - Count `masteredFacts`: facts with SM-2 interval >= 21 days (or equivalent mastery threshold from `src/data/balance.ts`)
   - Count `totalLearned`: total entries in `save.learnedFacts`
   - Count `overdueFacts`: facts where `nextReviewDate < Date.now()`
   - Count `totalDue`: facts that have been reviewed at least once
   - Count `recentStudySessions`: number of entries in `save.stats.lastStudySessionTimestamps` within the last 7 days
   - Apply formula: `clamp((masteredFacts / max(totalLearned, 1)) * 0.3 + (1 - min(overdueFacts / max(totalDue, 1), 1)) * 0.4 + (recentStudySessions / 5) * 0.3, 0.0, 1.0)`
4. Special case: if `totalLearned === 0` (new player), return `0.5` (neutral score, no penalty)
5. Export `getStudyScoreTier(score: number): 'diligent' | 'average' | 'neglectful' | 'new_player'`
   - `>= 0.7` = diligent, `0.3-0.7` = average, `< 0.3` = neglectful, special new_player if totalLearned === 0

**Save schema additions** (in `src/data/types.ts`):
- Add `lastStudySessionTimestamps: number[]` to `PlayerStats` interface (array of Unix timestamps)
- Add `upgradeTokens: number` to `PlayerSave` (or `PlayerInventory` if that type exists)

**StudyManager update** (in `src/game/managers/StudyManager.ts`):
- In `completeStudySession()` (or equivalent method called at end of a study/review session), push `Date.now()` to `save.stats.lastStudySessionTimestamps`
- Prune timestamps older than 7 days on each push (keep array small)

**Acceptance Criteria:**
- [ ] `computeStudyScore()` returns 0.5 for a save with 0 learned facts
- [ ] `computeStudyScore()` returns >= 0.7 for a save with many mastered facts, no overdue, recent sessions
- [ ] `computeStudyScore()` returns < 0.3 for a save with many overdue facts, no recent sessions
- [ ] `getStudyScoreTier()` correctly maps score ranges to tier names
- [ ] Unit tests cover all edge cases (empty save, max score, min score, boundary values)

---

### 59.2 — Artifact Loot Table

**File:** `src/data/artifactLootTable.ts` (NEW)

1. Create `src/data/artifactLootTable.ts`
2. Define the `ArtifactReward` type:
   ```typescript
   export type ArtifactRewardType = 'fact' | 'dust' | 'consumable' | 'fossil' | 'upgrade_token' | 'junk';

   export interface ArtifactReward {
     type: ArtifactRewardType;
     amount?: number;           // for dust, upgrade tokens
     factId?: string;           // for fact-type rewards
     itemId?: string;           // for consumable/fossil rewards
     dustTier?: MineralTier;    // for dust rewards (small/medium/large)
     gaiaMessage: string;       // GAIA commentary for this reward
   }
   ```
3. Define `PendingArtifact` type:
   ```typescript
   export interface PendingArtifact {
     factId: string;    // the fact associated with this artifact
     rarity: Rarity;    // common | uncommon | rare | epic | legendary | mythic
     minedAt: number;   // Unix timestamp
   }
   ```
4. Define base weight tables as const objects for each rarity tier (common, uncommon, rare, epic, legendary, mythic)
5. Export `rollArtifactReward(artifact: PendingArtifact, studyScore: number, rng: () => number): ArtifactReward`
   - Look up base weights for the artifact's rarity tier
   - Apply study score modifiers (bonuses/penalties per the design tables)
   - Clamp all weights to minimum 0
   - Normalize weights and roll using the provided `rng`
   - Select reward type, then generate specific reward details:
     - **Fact**: use `artifact.factId`
     - **Dust**: random amount based on rarity tier (common: 5-15, rare: 20-50, legendary: 80-200)
     - **Consumable**: pick from available consumable pool based on rarity
     - **Fossil**: pick from undiscovered fossils if any, else fallback to dust
     - **Upgrade Token**: amount = 1
     - **Junk**: small dust reward (1-5 dust) + junk item name
   - Select GAIA message based on study score tier + reward quality
6. Export `GAIA_ARTIFACT_MESSAGES` const with message pools keyed by `[studyTier][rewardQuality]`
   - At least 3 messages per combination for variety
   - Study tiers: diligent, average, neglectful
   - Reward quality: good (fact, fossil, upgrade_token, rare consumable), neutral (dust, common consumable), bad (junk)

**Acceptance Criteria:**
- [ ] `rollArtifactReward()` returns valid `ArtifactReward` for all rarity tiers
- [ ] With `studyScore < 0.3`, junk weight is significantly increased
- [ ] With `studyScore >= 0.7`, upgrade token and fossil weights are increased
- [ ] New player (score 0.5) gets balanced distribution
- [ ] `rng` parameter makes rolls deterministic for testing
- [ ] All rewards include a non-empty `gaiaMessage`
- [ ] Unit tests verify weight distribution across 1000+ seeded rolls for each tier

---

### 59.3 — Pending Artifact Store Rework

**Files Modified:**
- `src/ui/stores/gameState.ts` — change `pendingArtifacts` type
- `src/data/types.ts` — add `PendingArtifact` to type definitions
- `src/game/GameManager.ts` — update `endMine()` to push full artifact data

1. In `src/data/types.ts`, add `PendingArtifact` interface (defined in 59.2, import or co-locate)
2. In `src/ui/stores/gameState.ts`:
   - Change `pendingArtifacts` store type from `string[]` to `PendingArtifact[]`
   - Update any store initialization/reset to use empty `PendingArtifact[]`
3. In `src/game/GameManager.ts` (or wherever `endMine` / dive-end logic lives):
   - When artifacts are collected during a dive, push `{ factId, rarity, minedAt: Date.now() }` instead of just `factId`
   - The rarity should come from the mine block's rarity at the time it was mined
4. Add a save migration function in the appropriate migration file:
   - Detect if `pendingArtifacts` is `string[]` (old format)
   - Convert each string `factId` to `{ factId, rarity: 'common', minedAt: Date.now() }` (default to common rarity for legacy artifacts)
   - Migration runs on save load
5. Update ALL consumers of `pendingArtifacts`:
   - Search codebase for all references to `pendingArtifacts` store
   - Update each consumer to work with `PendingArtifact[]` instead of `string[]`
   - This includes DiveResults, FactReveal (soon ArtifactAnalyzer), any hub screens

**Acceptance Criteria:**
- [ ] `pendingArtifacts` store type is `PendingArtifact[]`
- [ ] `endMine()` pushes full `PendingArtifact` objects with rarity data
- [ ] Old saves with `string[]` format are auto-migrated on load
- [ ] No TypeScript errors after the type change (all consumers updated)
- [ ] Existing E2E tests still pass after migration

---

### 59.4 — Artifact Analyzer UI Component

**File:** `src/ui/components/ArtifactAnalyzer.svelte` (NEW)

1. Create `src/ui/components/ArtifactAnalyzer.svelte`
2. Component props: `artifact: PendingArtifact`, `studyScore: number`, `remainingCount: number`
3. Implement 5-stage animation flow using Svelte 5 runes (`$state` for current stage):

   **Stage 1 — "Artifact Received" (0.5s auto-advance)**
   - Full-screen overlay (same z-index pattern as existing FactReveal)
   - Center: artifact container sprite/icon, sized ~120px
   - Rarity-colored glow effect (CSS `box-shadow` or `filter: drop-shadow` with rarity color)
   - Rarity badge label (e.g., "RARE ARTIFACT") above the container
   - `data-testid="artifact-stage-1"`
   - Auto-advances to Stage 2 after 500ms

   **Stage 2 — "Analyzing..." (tap to advance)**
   - Text: "Tap to analyze" with pulsing animation
   - Artifact container has subtle idle animation (gentle float/bob)
   - On tap/click: advance to Stage 3
   - `data-testid="artifact-tap-target"`

   **Stage 3 — "Cracking Open" (1.5s auto-advance)**
   - CSS keyframe animation: cracks appear on the container (overlay crack SVG/PNG or CSS clip-path)
   - Light rays emanate from cracks (CSS radial gradient animation)
   - At 1.5s: container "shatters" — scale up + fade out with multiple fragment divs flying outward
   - Screen flash (brief white overlay, 100ms fade)
   - `data-testid="artifact-stage-3"`
   - During this stage, call `rollArtifactReward()` to determine the reward

   **Stage 4 — "Reward Reveal" (0.5s + wait for user)**
   - Reward icon fades in at center with CSS bouncy scale (`transform: scale` with overshoot easing)
   - Below icon: reward type name (e.g., "Fossil Fragment", "Upgrade Token", "Ancient Fact")
   - Below name: reward description/amount (e.g., "+45 Crystal Dust", "Scanner Upgrade Token x1")
   - Below description: GAIA speech bubble with `reward.gaiaMessage`
   - `data-testid="artifact-reward-reveal"`
   - `data-testid="artifact-reward-type"` on the reward type label (for assertions)

   **Stage 5 — "Collect" (user action)**
   - For fact rewards: "Learn This Fact" and "Sell for Dust" buttons (existing Learn/Sell flow)
   - For non-fact rewards: "Collect" button that applies the reward and shows confirmation
   - After collect: if `remainingCount > 0`, show "Next Artifact (X remaining)" button
   - If no more artifacts: "Return to Hub" button
   - `data-testid="artifact-collect-btn"`
   - `data-testid="artifact-next-btn"` (if more artifacts)
   - `data-testid="artifact-done-btn"` (if no more)

4. CSS animations — all in the component's `<style>` block:
   - `@keyframes artifact-glow` — pulsing rarity-colored glow
   - `@keyframes artifact-bob` — gentle vertical float
   - `@keyframes crack-spread` — crack overlay opacity/scale
   - `@keyframes shatter-fragment` — fragment fly-out (randomized via CSS custom properties)
   - `@keyframes reward-bounce` — scale overshoot entrance
   - `@keyframes flash` — screen flash
   - Use `prefers-reduced-motion` media query to skip animations for accessibility

5. Rarity color mapping:
   - Common: `#b0b0b0` (gray)
   - Uncommon: `#4ade80` (green)
   - Rare: `#60a5fa` (blue)
   - Epic: `#a78bfa` (purple)
   - Legendary: `#fbbf24` (gold)
   - Mythic: `#f472b6` (pink/magenta)

**Acceptance Criteria:**
- [ ] All 5 stages render correctly and transition smoothly
- [ ] Tap on Stage 2 advances to Stage 3 (click handler works)
- [ ] Reward type icon and description are correct for each reward type
- [ ] GAIA message is displayed in Stage 4
- [ ] Fact rewards transition to Learn/Sell flow on collect
- [ ] Non-fact rewards are applied and confirmed on collect
- [ ] "Next Artifact" button appears when more artifacts remain
- [ ] "Return to Hub" button appears on last artifact
- [ ] `prefers-reduced-motion` disables CSS animations
- [ ] All `data-testid` attributes are present

---

### 59.5 — Reward Application Logic

**File Modified:** `src/game/managers/StudyManager.ts`

1. Add method `applyArtifactReward(reward: ArtifactReward): void` to `StudyManager` (or create a standalone function in a new file `src/services/rewardApplicator.ts` if StudyManager is too large)
2. Reward application by type:
   - **Fact** (`reward.type === 'fact'`): Do NOT auto-add. Return control to the UI for Learn/Sell choice. The UI will call the existing `learnArtifact(factId)` or `sellArtifact(factId)` methods.
   - **Dust** (`reward.type === 'dust'`): Call `addMinerals(reward.dustTier, reward.amount)` on the appropriate currency store/manager. Map dustTier to the existing mineral tier system.
   - **Consumable** (`reward.type === 'consumable'`): Add to `save.inventory.consumables` (or the appropriate inventory field). If `reward.itemId` matches a known consumable (bomb, o2_tank, scanner_charge, shield), increment its count.
   - **Fossil** (`reward.type === 'fossil'`): Call the existing `addFossil(reward.itemId)` flow. If the fossil is already discovered, convert to dust as fallback.
   - **Upgrade Token** (`reward.type === 'upgrade_token'`): Increment `save.upgradeTokens` by `reward.amount` (default 1). This token is spent in the Workshop for permanent upgrades (spending logic is out of scope for this phase).
   - **Junk** (`reward.type === 'junk'`): Add 1-5 basic dust. The GAIA message is already set in the reward object.
3. After applying any non-fact reward, dispatch an event (via EventBus or store update) so the UI knows the reward was applied.
4. Add a `rewardApplied` event type to the EventBus if it doesn't exist.

**Acceptance Criteria:**
- [ ] Dust rewards increase the player's mineral count by the correct amount
- [ ] Consumable rewards appear in the player's inventory
- [ ] Fossil rewards are added to the fossil collection (or converted to dust if duplicate)
- [ ] Upgrade tokens are persisted in save data
- [ ] Junk rewards give a small dust amount
- [ ] Fact rewards are NOT auto-added — control returns to UI for Learn/Sell
- [ ] Unit tests verify each reward type application

---

### 59.6 — Artifact Lab Badge in Dome

**Files Modified:**
- `src/data/hubFloors.ts` — add badge support to interactive object definitions
- `src/game/scenes/DomeScene.ts` — render badge count on interactive objects

1. In `src/data/hubFloors.ts`:
   - Add an optional `badgeCount?: () => number` callback to the interactive object type definition
   - On the `artifact_lab` object, set `badgeCount: () => get(pendingArtifacts).length`
   - This allows any hub object to optionally show a notification badge

2. In `src/game/scenes/DomeScene.ts`:
   - When rendering interactive objects, check if `badgeCount` is defined and returns > 0
   - If so, render a small red circle with white number text at the top-right corner of the object
   - Badge styling: 18px red circle, white bold 12px number, slight overlap with object edge
   - Update the badge on scene enter and when `pendingArtifacts` store changes
   - Use Phaser text/graphics objects for the badge (not DOM — this is canvas)

3. Badge should pulse briefly when first rendered (Phaser tween: scale 1.0 -> 1.3 -> 1.0 over 300ms, once)

**Acceptance Criteria:**
- [ ] Artifact Lab shows badge with count when pendingArtifacts.length > 0
- [ ] Badge disappears when all artifacts are cracked (pendingArtifacts empty)
- [ ] Badge number updates reactively when artifacts are added/removed
- [ ] Badge has a brief pulse animation on first render
- [ ] No badge shown when count is 0

---

### 59.7 — GAIA Study Score Nudges

**Files Modified:**
- GAIA personality/dialogue system (locate via `src/game/` or `src/services/` — search for GAIA message pools)
- `src/game/scenes/DomeScene.ts` or hub screen component — add nudge trigger

1. Define study-related GAIA nudge messages (at least 5 variations):
   - "Your overdue reviews are piling up. The artifacts can sense it..."
   - "A quick study session would sharpen the analyzer's precision!"
   - "Knowledge is the fuel that powers this lab. When did you last review?"
   - "I've noticed your study streak slipping. The crystals grow dim..."
   - "Study tip: even 5 minutes of review can boost your artifact rewards!"

2. On hub/dome screen load:
   - Compute study score via `computeStudyScore(save)`
   - If score < 0.3 AND `Math.random() < 0.2` (20% chance): display a study nudge via GAIA
   - The nudge should appear as a GAIA speech bubble overlay (same as existing GAIA comments)

3. First-time nudge:
   - Track `hasSeenStudyNudge: boolean` in save stats
   - When study score drops below 0.3 for the first time, ALWAYS show a tutorial-style nudge:
     - "Hmm, I'm detecting calibration drift in the analyzer. Regular study sessions keep the resonance crystals aligned. Try reviewing some facts — it'll improve what you find in artifacts!"
   - Set `hasSeenStudyNudge = true` after showing

4. In the artifact cracking flow (ArtifactAnalyzer.svelte Stage 4):
   - GAIA commentary is already included via `reward.gaiaMessage` (set in 59.2)
   - No additional work needed here unless the GAIA UI component needs updating

**Acceptance Criteria:**
- [ ] GAIA study nudges appear ~20% of the time on hub load when score < 0.3
- [ ] First-time nudge always appears when score first drops below 0.3
- [ ] `hasSeenStudyNudge` flag prevents repeated first-time tutorial nudges
- [ ] Nudge messages are varied (randomly selected from pool)
- [ ] Nudges do NOT appear for new players (score 0.5 / no learned facts)

---

### 59.8 — Integration and Migration

**Files Modified:**
- `src/App.svelte` — route `factReveal` screen to ArtifactAnalyzer
- `src/ui/components/DiveResults.svelte` (or equivalent) — update artifact display
- Save migration logic

1. In `src/App.svelte`:
   - Import `ArtifactAnalyzer.svelte`
   - Where the screen router handles `factReveal`, replace with `ArtifactAnalyzer`
   - Pass the current pending artifact, study score, and remaining count as props
   - When ArtifactAnalyzer emits "done" (all artifacts cracked), navigate to hub

2. Artifact flow after dive:
   - In `DiveResults` screen (or equivalent post-dive screen):
     - Show artifact count: "You found X artifacts!"
     - Show button: "Analyze in Artifact Lab" (navigates to Artifact Lab in dome)
     - Alternatively: "Analyze Now" to enter cracking flow directly from dive results
   - Add `data-testid="btn-analyze-artifacts"` to the analyze button

3. Artifact cracking queue:
   - When entering the cracking flow, pop the first artifact from `pendingArtifacts`
   - Pass it to ArtifactAnalyzer along with `remainingCount = pendingArtifacts.length`
   - On "Next Artifact": pop next, re-render ArtifactAnalyzer
   - On "Return to Hub": navigate back to dome

4. Save migration:
   - In the save loading/migration pipeline:
     - Check if `save.pendingArtifacts` is an array of strings (old format)
     - If yes, map each string to `{ factId: str, rarity: 'common', minedAt: Date.now() }`
   - Check if `save.stats.lastStudySessionTimestamps` is missing
     - If yes, initialize to `[]`
   - Check if `save.upgradeTokens` is missing
     - If yes, initialize to `0`
   - Check if `save.stats.hasSeenStudyNudge` is missing
     - If yes, initialize to `false`

5. Remove or deprecate the direct FactReveal entry point:
   - The old flow where `factReveal` screen showed FactReveal directly for each pending fact should be replaced
   - FactReveal may still be used internally by ArtifactAnalyzer for fact-type rewards (Stage 5 Learn/Sell)
   - Keep FactReveal component but it should no longer be a top-level screen route

**Acceptance Criteria:**
- [ ] Navigating to `factReveal` screen opens ArtifactAnalyzer (not old FactReveal)
- [ ] DiveResults shows artifact count and analyze button
- [ ] Cracking queue processes all artifacts one by one
- [ ] "Return to Hub" navigates back to dome after last artifact
- [ ] Old saves load without errors (migration handles string[] -> PendingArtifact[])
- [ ] New save fields (lastStudySessionTimestamps, upgradeTokens, hasSeenStudyNudge) are initialized
- [ ] Existing E2E tests pass after integration

---

## Playwright Test Scripts

### Test 1: Study Score Computation (Unit Test via Vitest)

```typescript
// tests/unit/studyScore.test.ts
import { computeStudyScore, getStudyScoreTier } from '../../src/services/studyScore';

describe('computeStudyScore', () => {
  it('returns 0.5 for new player with no facts', () => {
    const save = makeSave({ learnedFacts: [], stats: { lastStudySessionTimestamps: [] } });
    expect(computeStudyScore(save)).toBe(0.5);
  });

  it('returns >= 0.7 for diligent player', () => {
    const save = makeSave({
      learnedFacts: createMasteredFacts(20),
      stats: { lastStudySessionTimestamps: recentTimestamps(5) }
    });
    expect(computeStudyScore(save)).toBeGreaterThanOrEqual(0.7);
  });

  it('returns < 0.3 for neglectful player', () => {
    const save = makeSave({
      learnedFacts: createOverdueFacts(20),
      stats: { lastStudySessionTimestamps: [] }
    });
    expect(computeStudyScore(save)).toBeLessThan(0.3);
  });
});
```

### Test 2: Loot Table Distribution (Unit Test via Vitest)

```typescript
// tests/unit/artifactLootTable.test.ts
import { rollArtifactReward } from '../../src/data/artifactLootTable';

describe('rollArtifactReward', () => {
  it('produces more junk for neglectful players', () => {
    const results = rollMany(1000, { rarity: 'common', studyScore: 0.1 });
    const junkRate = results.filter(r => r.type === 'junk').length / 1000;
    expect(junkRate).toBeGreaterThan(0.4);
  });

  it('produces more upgrades for diligent players with legendary artifacts', () => {
    const results = rollMany(1000, { rarity: 'legendary', studyScore: 0.9 });
    const upgradeRate = results.filter(r => r.type === 'upgrade_token').length / 1000;
    expect(upgradeRate).toBeGreaterThan(0.2);
  });

  it('never produces upgrade tokens from common artifacts', () => {
    const results = rollMany(1000, { rarity: 'common', studyScore: 1.0 });
    const upgrades = results.filter(r => r.type === 'upgrade_token');
    expect(upgrades.length).toBe(0);
  });
});
```

### Test 3: Artifact Cracking Flow (Playwright E2E)

```javascript
// tests/e2e/59-artifact-analyzer.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial');
  await page.waitForTimeout(2000);

  // Inject test artifacts
  await page.evaluate(() => {
    const store = globalThis[Symbol.for('terra:pendingArtifacts')];
    if (store) {
      store.set([
        { factId: 'test-fact-1', rarity: 'rare', minedAt: Date.now() },
        { factId: 'test-fact-2', rarity: 'common', minedAt: Date.now() },
      ]);
    }
  });

  // Navigate to artifact lab / trigger cracking
  // ... (depends on navigation patterns)

  // Stage 1: Artifact Received
  await page.waitForSelector('[data-testid="artifact-stage-1"]', { timeout: 5000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/artifact-stage-1.png' });

  // Stage 2: Tap to analyze
  await page.waitForSelector('[data-testid="artifact-tap-target"]', { timeout: 3000 });
  await page.click('[data-testid="artifact-tap-target"]');

  // Stage 3: Cracking
  await page.waitForSelector('[data-testid="artifact-stage-3"]', { timeout: 3000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/artifact-stage-3.png' });

  // Stage 4: Reward Reveal
  await page.waitForSelector('[data-testid="artifact-reward-reveal"]', { timeout: 5000 });
  const rewardType = await page.textContent('[data-testid="artifact-reward-type"]');
  console.log('Reward type:', rewardType);
  await page.screenshot({ path: 'tests/e2e/screenshots/artifact-reward-reveal.png' });

  // Stage 5: Collect
  await page.waitForSelector('[data-testid="artifact-collect-btn"]', { timeout: 3000 });
  await page.click('[data-testid="artifact-collect-btn"]');

  // Next artifact should be available
  await page.waitForSelector('[data-testid="artifact-next-btn"]', { timeout: 3000 });
  await page.click('[data-testid="artifact-next-btn"]');

  // Second artifact flow
  await page.waitForSelector('[data-testid="artifact-stage-1"]', { timeout: 5000 });

  // After last artifact
  // ... complete second artifact flow ...
  // await page.waitForSelector('[data-testid="artifact-done-btn"]');

  console.log('PASS: Artifact analyzer flow works');
  await browser.close();
})();
```

### Test 4: Save Migration (Unit Test via Vitest)

```typescript
// tests/unit/artifactMigration.test.ts
describe('pendingArtifacts migration', () => {
  it('converts string[] to PendingArtifact[]', () => {
    const oldSave = { pendingArtifacts: ['fact-1', 'fact-2'] };
    const migrated = migrateSave(oldSave);
    expect(migrated.pendingArtifacts[0]).toHaveProperty('factId', 'fact-1');
    expect(migrated.pendingArtifacts[0]).toHaveProperty('rarity', 'common');
    expect(migrated.pendingArtifacts[0]).toHaveProperty('minedAt');
  });

  it('leaves PendingArtifact[] unchanged', () => {
    const newSave = { pendingArtifacts: [{ factId: 'f1', rarity: 'rare', minedAt: 123 }] };
    const migrated = migrateSave(newSave);
    expect(migrated.pendingArtifacts).toEqual(newSave.pendingArtifacts);
  });
});
```

---

## Verification Gate

All of the following MUST pass before Phase 59 is marked complete:

1. **`npm run typecheck`** — 0 new errors (existing warnings acceptable)
2. **`npx vitest run`** — all existing tests pass PLUS new tests:
   - `studyScore.test.ts` — study score computation (min 5 test cases)
   - `artifactLootTable.test.ts` — loot table distribution (min 5 test cases)
   - `artifactMigration.test.ts` — save migration (min 3 test cases)
   - `rewardApplicator.test.ts` — reward application per type (min 6 test cases)
3. **`npm run build`** — production build succeeds with no errors
4. **Playwright screenshots** — capture all 5 stages of the cracking animation
5. **Playwright E2E** — `node tests/e2e/59-artifact-analyzer.cjs` passes:
   - Full cracking flow (Stage 1 through Stage 5)
   - Fact reward enters Learn/Sell flow
   - Non-fact reward applies correctly (dust increases)
   - Multiple artifacts queue correctly
6. **Console check** — no unhandled errors during the full cracking flow (`browser_console_messages`)
7. **Badge verification** — Playwright screenshot of Artifact Lab with badge count visible
8. **Migration verification** — load a test save with old `string[]` format, confirm no errors
9. **Study score nudge** — with a low-score save, confirm GAIA nudge appears on hub load (may need multiple attempts due to 20% chance)

---

## Files Affected

### New Files
| File | Description |
|------|-------------|
| `src/services/studyScore.ts` | Study Score computation service |
| `src/data/artifactLootTable.ts` | Loot table definitions, roll function, GAIA messages |
| `src/ui/components/ArtifactAnalyzer.svelte` | 5-stage artifact cracking UI component |
| `src/services/rewardApplicator.ts` | Reward application logic (if not added to StudyManager) |
| `tests/unit/studyScore.test.ts` | Unit tests for study score |
| `tests/unit/artifactLootTable.test.ts` | Unit tests for loot table |
| `tests/unit/artifactMigration.test.ts` | Unit tests for save migration |
| `tests/unit/rewardApplicator.test.ts` | Unit tests for reward application |
| `tests/e2e/59-artifact-analyzer.cjs` | E2E Playwright test script |

### Modified Files
| File | Change |
|------|--------|
| `src/data/types.ts` | Add `ArtifactReward`, `PendingArtifact`, `ArtifactRewardType` types; add `lastStudySessionTimestamps` to `PlayerStats`; add `upgradeTokens` to save; add `hasSeenStudyNudge` to stats |
| `src/ui/stores/gameState.ts` | Change `pendingArtifacts` store type from `string[]` to `PendingArtifact[]` |
| `src/game/managers/StudyManager.ts` | Add session timestamp tracking in `completeStudySession()`; optionally add `applyArtifactReward()` |
| `src/game/GameManager.ts` | Update `endMine()` to push `PendingArtifact` objects with rarity data |
| `src/App.svelte` | Route `factReveal` screen to `ArtifactAnalyzer` component |
| `src/data/hubFloors.ts` | Add optional `badgeCount` callback to interactive object type; set on artifact_lab |
| `src/game/scenes/DomeScene.ts` | Render notification badge on interactive objects with `badgeCount > 0` |
| `src/ui/components/FactReveal.svelte` | Retained as sub-component for fact-type rewards in ArtifactAnalyzer Stage 5 |
| `src/ui/components/DiveResults.svelte` | Show artifact count and "Analyze" button post-dive |
| `src/data/balance.ts` | Add study score thresholds and loot table weight constants |
| Save migration logic (location TBD) | Handle `string[]` to `PendingArtifact[]` migration and new field initialization |
