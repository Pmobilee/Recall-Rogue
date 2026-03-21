# AR-113: In-Run Mastery Upgrade System

## Overview

Replace the old rest-site/mini-boss card upgrade system with **in-run mastery upgrades**. Cards upgrade (and downgrade) based on answering their quiz questions correctly during combat. This makes learning the core gameplay loop — every correct answer directly powers up your deck.

**Complexity**: Large — touches card data model, combat flow, animations, balance, study session, UI.
**Dependencies**: None (replaces existing upgrade system).

## Design

### Core Mechanic
- **Correct charge answer** on a card: upgrade that card by 1 level (max 5)
- **Wrong charge answer** on a card: downgrade that card by 1 level (min 0)
- **Quick play**: no upgrade/downgrade (no quiz = no mastery change)
- **Once per encounter per card**: a card can only upgrade/downgrade once per encounter (prevents farming)
- Cards start at **Level 0** (base)

### 5 Mastery Levels

| Level | Icon Color | Name | Visual |
|-------|-----------|------|--------|
| 0 | (none) | Base | No icon, no effects |
| 1 | Green | Learned | Green + icon, slight float bob |
| 2 | Blue | Practiced | Blue + icon, float bob |
| 3 | Purple | Skilled | Purple + icon, float bob |
| 4 | Orange | Expert | Orange + icon, float bob |
| 5 | Gold | Mastered | Gold + icon, float bob, gold glow. Card is MASTERED — auto quick-plays (no quiz) except at final boss |

The green + icon asset already exists at `public/assets/cardframes/v2/card-upgrade-icon.webp`. We'll apply CSS `filter: hue-rotate()` + `brightness()` to colorize it for each level, or generate 5 color variants via the PSD extraction script.

### Float Bob Animation
Any card at level 1+ has the upgrade icon gently bobbing up and down (3-4px amplitude, ~2s cycle). This is visible everywhere the card appears: hand, reward screen, library, deck builder.

### Upgrade/Downgrade Animation
- **Upgrade**: Card does a 360-degree Y-axis flip (like the existing tier-up animation), upgrade icon appears/changes color, brief "Upgraded!" text popup fades in and out above the card
- **Downgrade**: Card does a reverse 360-degree Y-axis flip, icon downgrades color (or disappears at level 0), brief "Downgraded!" text popup

### Per-Mechanic Upgrade Scaling

Each mastery level grants a cumulative bonus. The bonus per level is smaller than the old single-upgrade system to balance 5 levels.

| Mechanic | Per-Level Bonus | Level 0 -> Level 5 Total |
|----------|----------------|--------------------------|
| **strike** | +2 damage | 8 -> 18 |
| **multi_hit** | +1 damage | 4 -> 9 (per hit) |
| **heavy_strike** | +2 damage | 14 -> 24 |
| **piercing** | +1 damage | 6 -> 11 |
| **reckless** | +2 damage | 12 -> 22 |
| **execute** | +2 bonus damage | 8 -> 18 bonus |
| **lifetap** | +1 damage | 8 -> 13 |
| **double_strike** | +1 damage per hit | 5 -> 10 per hit |
| **block** | +2 block | 6 -> 16 |
| **fortify** | +1 block | 7 -> 12 |
| **parry** | +1 block | 3 -> 8 |
| **brace** | +2 block | 5 -> 15 |
| **emergency** | +1 block | 4 -> 9 |
| **overheal** | +2 block | 10 -> 20 |
| **thorns** | +1 retaliate | 3 -> 8 |
| **empower** | +5% multiplier | 50% -> 75% |
| **weaken** | +1 turn duration (at L3, L5) | 2 -> 4 turns |
| **expose** | +1 turn duration (at L3, L5) | 1 -> 3 turns |
| **slow** | +1 turn duration (at L3, L5) | 2 -> 4 turns |
| **hex** | +1 damage/turn | 3 -> 8 |
| **scout** | +1 draw (at L3) | 2 -> 3 |
| **recycle** | +1 draw (at L3) | 3 -> 4 |
| **foresight** | +1 draw (at L3) | 1 -> 2 |
| **quicken** | add 'draw' tag (at L3) | base -> +draw |
| **cleanse** | unchanged (cleanse is binary) | - |
| **mirror** | +0.05x multiplier | 1.0 -> 1.25x |
| **adapt** | +0.05x multiplier | 1.0 -> 1.25x |
| **focus** | +1 extra card (at L3) | 1 -> 2 cards |
| **immunity** | unchanged (binary) | - |
| **overclock** | AP-1 (at L3) | AP 2 -> 1 |
| **transmute** | +1 transform (at L3) | 1 -> 2 |

Note: some mechanics get their bonus at specific thresholds (L3, L5) rather than every level, because their values don't scale linearly (e.g., turns of a debuff).

### Charge Multiplier Nerf
- Change `CHARGE_CORRECT_MULTIPLIERS` from `{ '1': 2.5, '2a': 3.0, '2b': 3.5, '3': 1.2 }` to a flat **1.5x** for all tiers
- This is necessary because mastery upgrades now provide the main power scaling — charge is just for the quiz trigger + small bonus

### Distractors
- Level 0 cards: 2 distractors (easier quiz)
- Level 1+ cards: 3 distractors (standard quiz)
- This makes the first answer easier, helping new cards get their first upgrade

### Study Session Integration
- Study session can upgrade cards via the same mastery system
- Maximum of 3 upgrades per study session
- Uses the same animation (360 flip + icon change + popup)

### Fact Variant Cycling
- Track which fact variants have been shown for each card
- Cycle through variants before repeating
- Higher mastery levels should get harder variants when available

## Data Model Changes

### Card type (`src/data/card-types.ts`)
```typescript
// Replace:
isUpgraded?: boolean;
// With:
masteryLevel?: number; // 0-5, default 0
upgradedThisEncounter?: boolean; // prevents multiple upgrades per encounter
```

Keep `isUpgraded` as a derived getter: `card.masteryLevel > 0` for backwards compatibility where needed.

### New: Mastery upgrade definitions (`src/services/cardUpgradeService.ts`)
Refactor `UPGRADE_DEFS` from single-upgrade deltas to per-level arrays, or compute as `level * perLevelDelta`.

### Balance constants (`src/data/balance.ts`)
```typescript
export const MASTERY_MAX_LEVEL = 5;
export const MASTERY_DISTRACTOR_THRESHOLD = 1; // Level at which distractors increase
export const MASTERY_BASE_DISTRACTORS = 2;
export const MASTERY_UPGRADED_DISTRACTORS = 3;
export const CHARGE_CORRECT_MULTIPLIER = 1.5; // Flat for all tiers
```

## Sub-steps

### Phase 1: Data Model & Balance
1. Add `masteryLevel` and `upgradedThisEncounter` to Card type
2. Refactor `cardUpgradeService.ts` for multi-level upgrades
3. Nerf charge multipliers to flat 1.5x
4. Add mastery balance constants
5. Update `canUpgradeCard` / `upgradeCard` for level-based system
6. Add `downgradeCard` function

### Phase 2: Combat Integration
7. After charge play correct answer: upgrade card (if not already upgraded this encounter)
8. After charge play wrong answer: downgrade card (if not already downgraded this encounter)
9. Update card effect values based on mastery level in `cardEffectResolver`
10. Track `upgradedThisEncounter` per card, reset at encounter start
11. Adjust distractor count based on mastery level

### Phase 3: Animations
12. 360-degree Y-axis flip animation on upgrade (reuse/extend existing tier-up)
13. Reverse flip animation on downgrade
14. "Upgraded!" / "Downgraded!" popup text (fade in/out above card)
15. Generate or colorize 5 upgrade icon variants (green/blue/purple/orange/gold)
16. Floating bob animation on upgrade icon for level 1+ cards
17. Gold glow effect for level 4-5

### Phase 4: UI Updates
18. Show mastery level icon on cards everywhere (hand, reward, library, deck builder)
19. Update card description to reflect current mastery-boosted values
20. Remove old upgrade UI (rest site upgrade selection, UpgradeSelectionOverlay)
21. Update reward card detail to show mastery level

### Phase 5: Study Session
22. Add mastery upgrade to study session (max 3 per session)
23. Same animation treatment as combat

### Phase 6: Fact Variant Cycling
24. Track shown variants per card
25. Cycle through variants before repeating
26. Higher mastery = harder variants when available

## Files Affected
- `src/data/card-types.ts` — Card type changes
- `src/data/balance.ts` — New constants, charge multiplier nerf
- `src/services/cardUpgradeService.ts` — Multi-level upgrade logic
- `src/services/cardEffectResolver.ts` — Apply mastery-scaled values
- `src/services/turnManager.ts` — Upgrade/downgrade after quiz answer
- `src/services/quizService.ts` — Distractor count by mastery level
- `src/ui/components/CardHand.svelte` — Mastery icon, bob animation, flip animation
- `src/ui/components/CardCombatOverlay.svelte` — Upgraded/Downgraded popup
- `src/ui/components/RewardCardDetail.svelte` — Show mastery level
- `src/ui/utils/cardFrameV2.ts` — Mastery icon URL by level
- `src/ui/components/UpgradeSelectionOverlay.svelte` — Remove or archive
- `src/services/gameFlowController.ts` — Remove old upgrade flow
- `public/assets/cardframes/v2/` — Colorized upgrade icons

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (update existing upgrade tests)
- [ ] Headless sim: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
- [ ] Visual: charge correct upgrades card with flip animation + icon
- [ ] Visual: charge wrong downgrades card with reverse flip
- [ ] Visual: "Upgraded!"/"Downgraded!" popup appears
- [ ] Visual: upgrade icon bobs on level 1+ cards
- [ ] Visual: 5 distinct icon colors across levels
- [ ] Visual: gold glow on level 5
- [ ] Gameplay: card can only upgrade once per encounter
- [ ] Gameplay: study session upgrades work (max 3)
- [ ] Gameplay: 2 distractors at level 0, 3 at level 1+
- [ ] Balance: charge multiplier is 1.5x (not 2.5-3.5x)
- [ ] Old upgrade UI removed (rest site selection)

## Finalized Decisions
1. **Persistence**: Mastery levels **reset each run** — in-run power curve only. SM-2 handles long-term knowledge.
2. **Downgrade**: Always exactly -1 level on wrong answer. Never crater.
3. **Echo cards**: NOT upgradable — but echo copies inherit the source card's mastery-boosted stats.
4. **Boss bonus**: No special boss mastery bonus.
5. **Card description**: Show `base+bonus` format (e.g., "8+4") with the bonus portion in **green**.
