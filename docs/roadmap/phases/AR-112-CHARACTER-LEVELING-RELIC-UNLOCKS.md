# AR-112: Character Leveling System — XP-Based Relic Unlocks

## Research Summary

Extensive analysis of meta-progression in Slay the Spire, Hades, Vampire Survivors, Monster Train, and Balatro. Key findings:

- **StS unlocks fast** (~8-10 runs per character) because gameplay depth IS the retention. Educational games justify longer tracks because content changes as you learn.
- **Hades' logarithmic cost curve** (cheap early, expensive late) with multiple parallel tracks is the gold standard for pacing.
- **First reward must come in session 1** — Day 1 retention jumps from 15% to 40% when a meaningful reward lands in the first session.
- **60-80% progress to next level** is the strongest "return tomorrow" hook (Zeigarnik Effect + Goal Gradient Effect).
- **Milestone levels** should cost 40% less XP and give premium rewards — creates burst dopamine moments.
- **Variable reward pacing** (surprise double-relic levels between dry levels) outperforms uniform distribution.
- **XP must never be lost.** Even mid-run XP is permanently banked.
- **Anti-rush aligns with learning science:** spaced repetition requires TIME between sessions, so daily-play incentives > marathon incentives.

## Design

### XP Curve Formula

```typescript
const XP_BASE = 80;
const XP_MULTIPLIER = 1.14;

function xpRequiredForLevel(level: number): number {
  return Math.round(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1));
}
```

Clean exponential curve. No special cases. Levels 5, 10, 15, 20, 25 simply happen to have the best rewards — the curve itself is smooth.

### XP Sources Per Run

| Source | XP |
|--------|-----|
| Correct answer | 3 |
| Speed bonus (fast answer) | +1 |
| Streak bonus (3+ correct) | +2 |
| Floor cleared | 8 |
| Combat won | 5 |
| Mini-boss defeated | 10 |
| Boss defeated | 15 |
| New fact encountered (first time) | 2 |
| Run completion (retreat) | 10 |
| Run completion (full clear) | 25 |
| Daily first-run bonus | +30% total |

**Projected XP per run:**
- Floor-1 death: ~16-25 XP
- Below average (floor 2-3): ~40-60 XP
- Average (floor 4-5): ~80-110 XP
- Great (floor 6, boss): ~150-200 XP
- Weighted average new player: ~65 XP/run, experienced: ~110 XP/run

### Level Progression Table

| Level | XP Cost | Cumulative | ~Runs (new) | Reward |
|-------|---------|------------|-------------|--------|
| 1 | 80 | 80 | 1 | Relic #1 |
| 2 | 91 | 171 | 3 | 200 Dust |
| 3 | 104 | 275 | 4 | Relic #2 |
| 4 | 119 | 394 | 6 | 300 Dust |
| 5 | 135 | 529 | 8 | Relic #3 + "Novice" title |
| 6 | 154 | 683 | 11 | Relic #4 |
| 7 | 176 | 859 | 13 | 400 Dust |
| 8 | 200 | 1,059 | 16 | Relic #5 |
| 9 | 228 | 1,287 | 20 | 500 Dust |
| 10 | 260 | 1,547 | 24 | Relic #6 + card back |
| 11 | 297 | 1,844 | 28 | Relic #7 |
| 12 | 338 | 2,182 | 34 | 600 Dust |
| 13 | 385 | 2,567 | 39 | Relic #8 |
| 14 | 439 | 3,006 | 46 | Relic #9 (back-to-back!) |
| 15 | 501 | 3,507 | 54 | Relic #10 + "Adept" title |
| 16 | 571 | 4,078 | 63 | Relic #11 |
| 17 | 651 | 4,729 | 73 | 800 Dust |
| 18 | 742 | 5,471 | 84 | Relic #12 + #13 (double!) |
| 19 | 846 | 6,317 | 97 | 1,000 Dust |
| 20 | 964 | 7,281 | 112 | Relic #14 + #15 + "Master" title |
| 21 | 1,099 | 8,380 | 129 | Cosmetic card frame |
| 22 | 1,253 | 9,633 | 148 | Relic #16 (prestige) |
| 23 | 1,429 | 11,062 | 170 | "Sage" title |
| 24 | 1,629 | 12,691 | 195 | Relic #17 + #18 (final prestige) |
| 25 | 1,857 | 14,548 | 224 | Legendary frame + "Grand Scholar" |

**Pacing:** Level 1 after first run. Level 10 at ~24 runs (~3-4 weeks). Level 20 at ~112 runs (~3 months). Level 25 at ~224 runs (~5-6 months).
**Clean exponential curve** — no special cases, no milestone modifiers. Big reward levels (5, 10, 15, 20, 25) are special because of what they give, not how they're priced.
**All 18 gameplay relics unlocked by level 20 (~112 runs).** Levels 21-25 are prestige/cosmetic.

---

## Sub-steps

### 1. Create `characterLevel.ts` — XP and leveling service

- [ ] 1.1 Define `XP_BASE`, `XP_MULTIPLIER`, milestone constants
- [ ] 1.2 `xpRequiredForLevel(level)` — XP to go from level to level+1
- [ ] 1.3 `cumulativeXpForLevel(level)` — total XP to reach a level
- [ ] 1.4 `getLevelFromXP(totalXP)` — current level from cumulative XP
- [ ] 1.5 `getLevelProgress(totalXP)` — `{ level, currentXP, nextLevelXP, progress: 0-1 }`
- [ ] 1.6 `calculateRunXP(runStats)` — compute XP from run stats (questions correct, floors, enemies, etc.)
- [ ] 1.7 `LEVEL_REWARDS` — mapping of level → { relicIds: string[], dustBonus: number, title?: string, cosmetic?: string }
- [ ] 1.8 `getUnlockedRelicIds(level)` — all relic IDs unlocked up to that level
- [ ] 1.9 Add daily first-run bonus tracking (date-based flag in save)

**Files:** `src/services/characterLevel.ts`

**Acceptance:** Pure functions. Unit tests for XP curve, level calculation, and run XP computation.

### 2. Add XP/level to player save state

- [ ] 2.1 Add `totalXP: number` and `characterLevel: number` to player save schema
- [ ] 2.2 Add `lastDailyBonusDate: string | null` for first-run-of-day tracking
- [ ] 2.3 `processRunXP(runStats)` — calculates XP, adds to total, checks level ups, awards dust/relic unlocks, returns summary
- [ ] 2.4 Migrate existing saves (default 0 XP, level 0)

**Files:** `src/ui/stores/playerData.ts`, `src/data/saveState.ts`

**Acceptance:** XP persists. Level ups fire correctly. Old saves migrate.

### 3. Wire XP into run-end flow

- [ ] 3.1 Collect run stats during gameplay (questions answered, correct count, floors, enemies by type, streaks)
- [ ] 3.2 Call `processRunXP()` at run end (retreat/defeat)
- [ ] 3.3 Show XP earned breakdown on RunEndScreen (per source)
- [ ] 3.4 Animated XP bar fill on RunEndScreen
- [ ] 3.5 Level-up celebration if triggered: new level, relics unlocked, dust awarded
- [ ] 3.6 Even floor-1 deaths show XP progress ("16 XP earned — 20% to Level 3")

**Files:** `src/ui/components/RunEndScreen.svelte`, `src/services/gameFlowController.ts`, `src/services/runManager.ts`

**Acceptance:** Every run awards and displays XP. Level ups celebrate prominently.

### 4. Update relic system — level-gated unlocks

- [ ] 4.1 Add `unlockLevel` field to each of the 18 unlockable relics in `unlockable.ts`
- [ ] 4.2 Update relic acquisition to filter by player's current level
- [ ] 4.3 Remove `unlockCost` purchase mechanism — relics are free once level-unlocked
- [ ] 4.4 24 starter relics remain always available

**Files:** `src/data/relics/unlockable.ts`, `src/services/relicAcquisitionService.ts`

**Acceptance:** Only level-appropriate relics appear in relic choices.

### 5. Update Camp Shop Relics tab

- [ ] 5.1 Replace Relics tab placeholder with:
  - Level + XP progress bar at top
  - Grid of all 18 unlockable relics
  - Unlocked = full color with name/description/icon
  - Locked = greyed out with "Unlocks at Level X"
  - Next unlock preview with XP bar
- [ ] 5.2 Show upcoming level rewards ("Level 8: Relic #5 — 65% progress")

**Files:** `src/ui/components/CampUpgradeModal.svelte`

**Acceptance:** Relics tab shows full progression, lock status, and XP progress.

### 6. Add level indicator to camp HUD

- [ ] 6.1 Show "Lv.X" with tiny XP progress bar in camp HUD (near streak/dust)
- [ ] 6.2 Tap opens Camp Shop on Relics tab

**Files:** `src/ui/components/CampHudOverlay.svelte`

**Acceptance:** Level always visible. Tap navigates to relics.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (new tests for XP curve + leveling)
- [ ] Fresh save: level 0, no unlockable relics, XP bar at 0
- [ ] Run 1 ends with XP display, player reaches or nearly reaches level 1
- [ ] Level 1 unlocks 1 relic (visible in shop + available in runs)
- [ ] Dust bonus awarded on level up
- [ ] Level indicator on camp HUD
- [ ] Relics tab shows all 18 with lock/unlock state
- [ ] Daily first-run bonus applies correctly
- [ ] Old saves migrate cleanly
