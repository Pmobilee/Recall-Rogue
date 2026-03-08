# Phase 53: Knowledge Tree Vitality

**Status**: Not Started
**Depends On**: Phase 13 (Knowledge Tree 2.0 — radial tree, mastery coloring, 3-level LOD), Phase 6 (Advanced Learning — knowledge store, mastery levels)
**Estimated Complexity**: Medium — tree rendering extensions, new currency system, branch bonus data layer, no new overlays required
**Design Decisions**: DD-V2-115 (Knowledge Tree rendering), DD-V2-113 (mastery levels), Q-E4 (Learning Sparks currency)

---

## 1. Overview

Phase 53 makes the Knowledge Tree feel alive in three dimensions: it responds to neglect through leaf wilting, shows granular completion progress per branch, and introduces a new non-purchasable currency (Learning Sparks) earned through genuine mastery milestones. A fourth system delivers the first tier of branch-gated gameplay bonuses — concrete rewards for exploring a full knowledge domain.

Together these systems transform the Knowledge Tree from a passive display into a living garden that requires tending and rewards completionists.

### What Exists Already

| File | Status |
|---|---|
| `src/ui/components/KnowledgeTree.svelte` | Radial tree, leaf mastery coloring, 3-level LOD — exists |
| `src/ui/components/KnowledgeTreeView.svelte` | Wrapper/container for KnowledgeTree — exists |
| `src/data/knowledgeStore.ts` | Knowledge Store item definitions — exists; needs Learning Sparks integration |
| `src/ui/stores/playerData.ts` | Player save access; needs new helper functions |
| `src/ui/utils/masteryColor.ts` | Mastery-to-color mapping — exists |
| `src/data/types.ts` | `ReviewState`, `PlayerSave` — needs `learningSparks` field |

### What This Phase Adds

- Leaf wilting/decay visual in `KnowledgeTree.svelte` (3 visual stages)
- Branch completion percentage badges in `KnowledgeTree.svelte` / `KnowledgeTreeView.svelte`
- Learning Sparks currency: `PlayerSave.learningSparks`, milestone grants, weekly counter
- Branch gameplay bonuses: `src/data/branchBonuses.ts` data file, `src/ui/components/BranchBonuses.svelte` display panel

---

## 2. Sub-phases

---

### 53.1 — Leaf Wilting / Decay Visual

**Goal**: Facts that are overdue for SM-2 review should show progressive wilting on the Knowledge Tree. Three visual stages based on days overdue. Correct review answer snaps the leaf back to full health.

#### 53.1.1 — Wilt stage computation in `KnowledgeTree.svelte`

For each leaf node rendered in the tree, compute a `wiltStage` based on the fact's `ReviewState.nextReviewAt`:

```typescript
function getWiltStage(reviewState: ReviewState | undefined): 0 | 1 | 2 | 3 {
  if (!reviewState) return 0
  const nowMs = Date.now()
  const overdueMs = nowMs - reviewState.nextReviewAt
  if (overdueMs <= 0) return 0                            // On time: healthy
  const overdueDays = overdueMs / (1000 * 60 * 60 * 24)
  if (overdueDays < 1) return 0                           // < 1 day: healthy
  if (overdueDays <= 3) return 1                          // 1–3 days: slightly drooped
  if (overdueDays <= 7) return 2                          // 4–7 days: yellowing
  return 3                                                // 7+ days: grey/dead
}
```

#### 53.1.2 — Wilt visual CSS/Canvas

In the Knowledge Tree leaf rendering, apply the wilt stage as a CSS class or Canvas transform:

- **Stage 0**: Normal leaf color from `masteryColor.ts`.
- **Stage 1**: Leaf rendered with a subtle downward droop (SVG transform `rotate(-8deg)` on the leaf element, or equivalent canvas transform) and 5% opacity reduction.
- **Stage 2**: Leaf color tinted toward `#c8a83c` (yellow-amber). Droop of -15 degrees.
- **Stage 3**: Leaf color desaturated to `#888` (grey). Droop of -25 degrees. Optional: dashed border instead of solid.

When a fact is reviewed and quality ≥ 3, its leaf snaps back to Stage 0 with a brief CSS transition (0.4s ease-out bounce).

#### 53.1.3 — Wilt summary in `KnowledgeTreeView.svelte`

Add a small wilting summary above the tree (or in a sidebar): "X leaves need attention" — where X is the count of facts with wilt stage ≥ 1. Tapping this text navigates to a filtered study session showing only overdue facts.

**Acceptance Criteria**:
- Facts with `nextReviewAt < Date.now()` show drooped leaves in the tree.
- Stage 1 (1–3 days overdue): slight droop, minimal color change.
- Stage 2 (4–7 days): yellow tint, more droop.
- Stage 3 (7+ days): grey, max droop.
- Reviewing a wilted fact and answering correctly snaps its leaf back to healthy with a visual transition.
- The wilt summary counter shows the correct count of overdue facts.

---

### 53.2 — Branch Completion Percentages

**Goal**: Each top-level branch on the Knowledge Tree displays its exploration percentage — how many facts in that category the player has learned relative to the total available facts in the database for that category.

#### 53.2.1 — Branch stats derivation

`KnowledgeTreeView.svelte` already has access to `PlayerSave.learnedFacts` and the local facts database (via the sql.js singleton or fact cache). For each `categoryL1` value (see `CATEGORIES` in `types.ts`):

```typescript
interface BranchStats {
  category: string
  learnedCount: number    // facts in learnedFacts with categoryL1 === category
  totalAvailable: number  // total facts in DB with categoryL1 === category
  completionPercent: number // learnedCount / totalAvailable * 100, rounded to 1dp
  masteredCount: number   // facts where ReviewState.repetitions >= 4 AND quality history ≥ 3
}
```

Compute `totalAvailable` by querying the local facts DB: `SELECT COUNT(*) FROM facts WHERE category_l1 = ?`. Cache the result on mount (it changes only on DB updates).

#### 53.2.2 — Branch badge rendering in `KnowledgeTree.svelte`

For each top-level branch node, render a small completion badge:

- Positioned at the root of the branch (near the label).
- Text: `"34%"` in small font (11px) with a subtle pill background matching the branch color.
- On hover/long-press (mobile): expand to a tooltip showing `"Biology: 34% explored (68/200 facts)"`.

If `completionPercent >= 100`, replace with a gold star badge.
If `completionPercent >= 25`, replace with a partial completion indicator (colored fill arc, like a small pie slice).

**Acceptance Criteria**:
- Each branch in the Knowledge Tree shows a completion percentage badge.
- Percentage accurately reflects `learnedFacts` count vs. total DB facts in that category.
- Badge updates immediately when a new fact is learned.
- 100% completion shows a gold star badge.
- Tooltip/long-press shows the numeric breakdown ("68/200 facts").

---

### 53.3 — Learning Sparks Currency

**Goal**: Introduce "Learning Sparks" as the Knowledge Store currency — earned only through genuine learning milestones, never purchased. Displayed in the Knowledge Store UI with an "earned this week" counter.

#### 53.3.1 — `PlayerSave` extension in `src/data/types.ts`

Add `learningSparks` and `sparkEarnedThisWeek` to `PlayerSave`:

```typescript
// In PlayerSave interface (src/data/types.ts):
/** Learning Sparks currency — earned through mastery milestones, used in Knowledge Store. */
learningSparks?: number
/** How many Sparks have been earned since the start of the current ISO week (Mon-Sun). */
sparkEarnedThisWeek?: number
/** ISO date string (YYYY-MM-DD) of the Monday that started the current Spark week. */
sparkWeekStart?: string
```

Default values (for save migration guard): `learningSparks = 0`, `sparkEarnedThisWeek = 0`, `sparkWeekStart = <current Monday>`.

#### 53.3.2 — Spark grant table in `src/data/balance.ts`

```typescript
export const LEARNING_SPARKS_PER_MILESTONE = {
  /** Fact reaches 'Familiar' mastery (reps >= 1 and quality >= 3 once). */
  fact_familiar:       1,
  /** Fact reaches 'Known' mastery (reps >= 3 and quality >= 3 consistently). */
  fact_known:          3,
  /** Fact reaches 'Mastered' mastery (reps >= 6 and ease >= 2.5). */
  fact_mastered:       5,
  /** Branch reaches 25% explored. */
  branch_25_pct:      10,
  /** Branch reaches 50% explored. */
  branch_50_pct:      20,
  /** Branch reaches 100% explored. */
  branch_100_pct:     25,
} as const
```

#### 53.3.3 — `playerData.ts` — `awardLearningSparkIfMilestone()`

After every SM-2 update, check if the fact's mastery level has just crossed a threshold:

```typescript
/**
 * Checks if the given ReviewState has just reached a new mastery threshold
 * and awards the appropriate Learning Sparks. Returns updated PlayerSave.
 */
export function awardLearningSparkIfMilestone(
  save: PlayerSave,
  factId: string,
  prevState: ReviewState,
  newState: ReviewState
): PlayerSave {
  let sparksToAdd = 0
  const prevMastery = getMasteryLevel(prevState)
  const newMastery = getMasteryLevel(newState)

  if (prevMastery === 'new' && newMastery === 'familiar') sparksToAdd += LEARNING_SPARKS_PER_MILESTONE.fact_familiar
  if (prevMastery === 'familiar' && newMastery === 'known') sparksToAdd += LEARNING_SPARKS_PER_MILESTONE.fact_known
  if (prevMastery === 'known' && newMastery === 'mastered') sparksToAdd += LEARNING_SPARKS_PER_MILESTONE.fact_mastered

  if (sparksToAdd === 0) return save

  // Update weekly tracker
  const weekStart = getCurrentIsoWeekStart()
  const sameWeek = save.sparkWeekStart === weekStart
  return {
    ...save,
    learningSparks: (save.learningSparks ?? 0) + sparksToAdd,
    sparkEarnedThisWeek: sameWeek ? (save.sparkEarnedThisWeek ?? 0) + sparksToAdd : sparksToAdd,
    sparkWeekStart: weekStart,
  }
}

function getMasteryLevel(rs: ReviewState): 'new' | 'familiar' | 'known' | 'mastered' {
  if (rs.repetitions >= 6 && rs.easeFactor >= 2.5) return 'mastered'
  if (rs.repetitions >= 3) return 'known'
  if (rs.repetitions >= 1) return 'familiar'
  return 'new'
}
```

Branch milestone Sparks are awarded in `KnowledgeTreeView.svelte` (or `GameManager.ts`) when branch completion crosses 25%, 50%, or 100%. Store previously-awarded branch milestones in `PlayerSave` to prevent double-awarding:

```typescript
// In PlayerSave:
awardedBranchMilestones?: string[] // e.g. ["Natural Sciences:25", "History:100"]
```

#### 53.3.4 — `KnowledgeStore.svelte` — Spark currency display

In `src/ui/components/KnowledgeStore.svelte`, replace or supplement the existing `knowledgePoints` display with `learningSparks`:

```svelte
<div class="spark-balance">
  <span class="spark-icon">✨</span>
  <span class="balance">{save.learningSparks ?? 0} Sparks</span>
  <span class="weekly">(+{save.sparkEarnedThisWeek ?? 0} this week)</span>
</div>
```

Update any store item `cost` fields to use `learningSparks` as the currency source instead of (or in addition to) `knowledgePoints`.

**Acceptance Criteria**:
- A fact reaching Familiar for the first time grants +1 Learning Spark.
- A fact reaching Known grants +3 Sparks (cumulative with prior Familiar grant is fine — each milestone fires once).
- A fact reaching Mastered grants +5 Sparks.
- Branch completing 25% grants +10 Sparks (one-time per branch).
- Branch completing 100% grants +25 Sparks (one-time per branch).
- `learningSparks` and `sparkEarnedThisWeek` persist in `PlayerSave` across sessions.
- Knowledge Store UI shows the current Spark balance and weekly earnings.
- Sparks are never purchasable with real money — only earned through the milestone system.

---

### 53.4 — Branch Gameplay Bonuses (First Tier at 25%)

**Goal**: When a player has explored 25% of any top-level branch, award a small passive gameplay bonus tied to that branch's theme. These bonuses are permanent and shown in a "Branch Bonuses" panel accessible from the Knowledge Tree.

#### 53.4.1 — Branch bonus data in `src/data/branchBonuses.ts`

Create a new file `src/data/branchBonuses.ts`:

```typescript
export interface BranchBonus {
  id: string
  category: string           // matches CATEGORIES top-level value
  threshold: number          // completion % required (25, 50, or 100)
  bonusType: 'oxygen_efficiency' | 'artifact_rarity' | 'scanner_range' | 'mineral_magnet' | 'quiz_streak' | 'dust_drop'
  bonusValue: number         // interpretation depends on bonusType
  displayName: string        // shown in Branch Bonuses panel
  description: string        // one-sentence explanation
}

/** First-tier bonuses (25% branch completion). One per top-level category. */
export const BRANCH_BONUSES_25: BranchBonus[] = [
  {
    id: 'natural_sciences_25',
    category: 'Natural Sciences',
    threshold: 25,
    bonusType: 'oxygen_efficiency',
    bonusValue: 0.05, // 5% O2 cost reduction
    displayName: 'Naturalist\'s Breath',
    description: 'Mining gear takes 5% less oxygen — you understand how to work with the planet\'s rhythms.',
  },
  {
    id: 'history_25',
    category: 'History',
    threshold: 25,
    bonusType: 'artifact_rarity',
    bonusValue: 0.02, // +2% rarity roll bonus
    displayName: 'Archaeologist\'s Eye',
    description: 'Artifact reveal rarity rolls gain +2% — you know what to look for.',
  },
  {
    id: 'technology_25',
    category: 'Technology',
    threshold: 25,
    bonusType: 'scanner_range',
    bonusValue: 1, // +1 tile radius
    displayName: 'Tech Sense',
    description: 'Scanner range extended by 1 tile — you understand the machines.',
  },
  {
    id: 'life_sciences_25',
    category: 'Life Sciences',
    threshold: 25,
    bonusType: 'mineral_magnet',
    bonusValue: 1, // +1 tile auto-collect radius
    displayName: 'Living World Bond',
    description: 'Minerals within 1 extra tile are auto-collected — you feel the earth\'s pulse.',
  },
  {
    id: 'geography_25',
    category: 'Geography',
    threshold: 25,
    bonusType: 'scanner_range',
    bonusValue: 1,
    displayName: 'Cartographer\'s Instinct',
    description: 'Fog of war reveals 1 extra tile radius around the miner — you read terrain naturally.',
  },
  {
    id: 'language_25',
    category: 'Language',
    threshold: 25,
    bonusType: 'quiz_streak',
    bonusValue: 0.10, // +10% quiz streak multiplier cap
    displayName: 'Wordsmith',
    description: 'Quiz streak multiplier cap increased by 10% — precise thought yields precise answers.',
  },
  {
    id: 'culture_25',
    category: 'Culture',
    threshold: 25,
    bonusType: 'dust_drop',
    bonusValue: 0.05, // +5% dust drop rate
    displayName: 'Cultural Lens',
    description: 'Mineral dust drop rate increased by 5% — cultural knowledge reveals hidden value everywhere.',
  },
]
```

#### 53.4.2 — Bonus application in `GameManager.ts` / `MineScene.ts`

On dive start, compute which branch bonuses the player has earned (branch completion ≥ 25%) and store them in a `activeBranchBonuses` array. Apply bonuses at the relevant calculation points:

- `oxygen_efficiency`: Multiply O2 costs by `(1 - bonusValue)` wherever O2 is deducted.
- `artifact_rarity`: Add `bonusValue` to the rarity roll result when resolving artifact rarity.
- `scanner_range`: Add `bonusValue` to the scanner radius in `FogOfWarSystem.ts` or equivalent.
- `mineral_magnet`: Extend auto-collect radius in `MineScene.ts` item pickup logic.
- `quiz_streak`: Increase `QUIZ_STREAK_MULTIPLIER_CAP` by `bonusValue` for this dive.
- `dust_drop`: Multiply dust drops by `(1 + bonusValue)`.

#### 53.4.3 — Branch completion tracking in `GameManager.ts`

After every fact is learned, compute branch completion for its `categoryL1`. If the branch just crossed a bonus threshold (25%, 50%, 100%) and the bonus has not been awarded yet (`!awardedBranchMilestones.includes(bonusId)`):

1. Add the bonus ID to `awardedBranchMilestones`.
2. Award the corresponding Learning Sparks.
3. Show a `GaiaToast`: "Branch bonus unlocked! [BranchBonus.displayName]: [description]"

#### 53.4.4 — `BranchBonuses.svelte` panel

Create `src/ui/components/BranchBonuses.svelte`. This is a modal panel accessible from a "Branch Bonuses" button in `KnowledgeTreeView.svelte`.

Content:
- Header: "Branch Bonuses"
- For each top-level category, show a row with: category name, completion percentage, bonus name, bonus description.
- Unlocked bonuses shown in full color with a checkmark. Locked bonuses shown greyed out with "Reach 25% to unlock".
- Optional second tier ("Coming soon: 50% and 100% bonuses").

**Acceptance Criteria**:
- When a branch reaches 25% explored, the corresponding bonus is permanently applied to all future dives.
- `awardedBranchMilestones` is persisted in `PlayerSave` and the bonus is not awarded twice.
- A GAIA toast confirms each new bonus unlock.
- The Branch Bonuses panel shows all 7 categories with their locked/unlocked status.
- Oxygen efficiency bonus correctly reduces O2 deduction in MineScene.
- Scanner range bonus correctly expands the fog-of-war reveal radius.

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully.
- [ ] Manually advance a fact's `nextReviewAt` to 2 days ago: leaf shows Stage 1 droop in the tree.
- [ ] Advance to 6 days ago: leaf shows Stage 2 yellow tint.
- [ ] Advance to 10 days ago: leaf shows Stage 3 grey.
- [ ] Answer the overdue fact correctly: leaf snaps back to healthy with visual transition.
- [ ] Branch badges show correct percentages (verify against DB fact counts).
- [ ] 100% branch completion: gold star badge appears.
- [ ] Reaching "Familiar" mastery on a fact: `learningSparks` increments by 1. Check persist after refresh.
- [ ] Branch at 25% completion: +10 Sparks awarded, GAIA toast shown, bonus appears in BranchBonuses panel.
- [ ] BranchBonuses panel opens from KnowledgeTreeView. Shows locked and unlocked bonuses.
- [ ] Unlock "Naturalist's Breath" (Natural Sciences 25%): O2 costs in next dive reduced by 5%.

---

## 4. Files Affected

### Modified
- `src/data/types.ts` — add `PlayerSave.learningSparks`, `sparkEarnedThisWeek`, `sparkWeekStart`, `awardedBranchMilestones`
- `src/data/balance.ts` — add `LEARNING_SPARKS_PER_MILESTONE`
- `src/ui/components/KnowledgeTree.svelte` — wilt stage computation and leaf visual rendering
- `src/ui/components/KnowledgeTreeView.svelte` — branch completion badges, wilt summary counter, BranchBonuses button
- `src/ui/components/KnowledgeStore.svelte` — Learning Sparks balance display
- `src/ui/stores/playerData.ts` — `awardLearningSparkIfMilestone()`, `getMasteryLevel()`, branch milestone check
- `src/game/GameManager.ts` — branch completion tracking, bonus unlock events, active bonus application on dive start
- `src/game/scenes/MineScene.ts` — apply `oxygen_efficiency`, `mineral_magnet` bonuses
- `src/game/systems/FogOfWarSystem.ts` (or equivalent scanner radius file) — apply `scanner_range` bonus

### New
- `src/data/branchBonuses.ts` — branch bonus definitions
- `src/ui/components/BranchBonuses.svelte` — branch bonus display panel
