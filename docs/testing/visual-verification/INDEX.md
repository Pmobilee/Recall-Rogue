<!--
  Purpose: Master index for visual + functional verification checklist.
  Sources: src/data/mechanics.ts, src/data/enemies.ts, src/data/relics/,
           src/data/statusEffects.ts, src/data/enemyPowers.ts,
           src/dev/scenarioSimulator.ts, src/dev/playtestAPI.ts
  Last rebuilt: 2026-04-13
-->

# Visual + Functional Verification Checklist

885 items across 8 domain files, organized into 3 execution phases.

**Prerequisite:** The [chain multiplier rework](../../RESEARCH/chain-multiplier-rework.md) must land before Phase 1 items are meaningful — it changes the damage/block/DoT formulas every card tests against.

---

## Legend

- `SC.loadCustom(...)` = `__rrScenario.loadCustom({ ... })`
- `SC.patch(...)` = `__rrScenario.patch({ turn: {...}, run: {...} })`
- `SC.forceHand(...)` = `__rrScenario.forceHand([...])`
- `SC.addRelic(...)` = `__rrScenario.addRelic('id')`
- `LD()` = `__rrLayoutDump()` — spatial check
- `SS()` = `__rrScreenshotFile()` — pixel check

---

## Execution Phases

### Phase 1 — Core Math (blocking)
Validates damage formulas and card description accuracy. Must pass before visual checks.

| File | Items | Covers |
|------|-------|--------|
| [06-cards-functional.md](06-cards-functional.md) | 151 | Card damage/block/DoT formulas at all mastery levels (S11) |
| [08-card-description-accuracy.md](08-card-description-accuracy.md) | 68 | Display vs actual values, resolver drift, modifier reflection (S18) |

### Phase 2 — Visual Regression
Layout correctness, VFX, screen rendering.

| File | Items | Covers |
|------|-------|--------|
| [01-status-effects-passives.md](01-status-effects-passives.md) | 47 | Status bars, power badges, quiz-active state (S1) |
| [02-card-effects-visual.md](02-card-effects-visual.md) | 108 | Card VFX, mastery popups, card picker overlay (S2) |
| [04-enemies-rooms-screens.md](04-enemies-rooms-screens.md) | 185 | Enemies, rooms, sprites, misc screens (S4+S5+S9+S10) |

### Phase 3 — Depth Coverage
Relics, edge cases, complex interactions.

| File | Items | Covers |
|------|-------|--------|
| [03-relics-visual-functional.md](03-relics-visual-functional.md) | 129 | Relic rendering + functional correctness (S3+S12) |
| [05-edge-cases-interactions.md](05-edge-cases-interactions.md) | 41 | Overflow, interaction states, megastates (S6+S7+S8) |
| [07-status-chains-combos.md](07-status-chains-combos.md) | 156 | Status math, chain system, mastery, enemy mechanics, combos (S13-S17) |

---

## Progress

| File | Total | Verified | Remaining | Last Run |
|------|-------|----------|-----------|----------|
| 01-status-effects-passives | 47 | 0 | 47 | never |
| 02-card-effects-visual | 108 | 0 | 108 | never |
| 03-relics-visual-functional | 129 | 26 | 103 | 2026-04-13 |
| 04-enemies-rooms-screens | 185 | 0 | 185 | never |
| 05-edge-cases-interactions | 41 | 0 | 41 | never |
| 06-cards-functional | 151 | 151 | 0 | 2026-04-13 |
| 07-status-chains-combos | 156 | 35 | 121 | 2026-04-13 |
| 08-card-description-accuracy | 68 | 68 | 0 | 2026-04-13 |

---

## Automated Test Coverage (Phase B — 2026-04-13)

7 unit test files, 1,355 tests total, all passing in <1 second:

| Test File | Tests | Covers |
|-----------|-------|--------|
| verification-phase1-functional.test.ts | 366 | All 98 mechanics: damage/block/status at L0/L3/L5 for QP/CC/CW |
| verification-phase1-descriptions.test.ts | 276 | Card description accuracy, chain display, abbreviation bans |
| verification-phase1-milestones.test.ts | 101 | Mastery milestone behaviors: pickCount, draw counts, AP grants |
| verification-exhaustive-gaps.test.ts | 245 | Every remaining resolver result field across all play modes |
| verification-phase2-status-chains.test.ts | 86 | Status modifiers, all 6 chain multipliers, combo stacking |
| verification-phase2-relics.test.ts | 121 | 40+ relic functional correctness via resolveAttackModifiers |
| verification-enemy-passives.test.ts | 160 | All 15 enemy callbacks, phase transitions, passive flags |

### Bugs Found and Fixed
1. multi_hit hitCount from stat table was dead data (resolver read card.secondaryValue)
2. Negative masterySecondaryBonus silently dropped (rupture L0 bleed=3 not 2)
3. ignite/war_drum/curse_of_doubt/mark_of_ignorance stat tables had qpValue=0
4. Foresight forget tag missing from stat table (cards never forgotten)
5. Archive retain count never read from stat table extras
6. SC.patch() didn't update encounterBridge internal state (Docker visual blocked)
7. comparison_trap "Copies your last card type" was unimplemented placeholder

### Remaining Visual Items
505 items across files 01-05 require Docker visual verification (screenshot-based).
SC.patch() reactivity fix landed — Docker containers can now patch status effects.
Action JSON must use `"js"` field (not `"code"`) for eval actions.

---

## Implementation Notes

**Viewport presets for Docker containers:**
- Portrait: `412 × 915` (default mobile, primary)
- Landscape: `1280 × 720` (Steam primary target)
- Tablet: `1024 × 768` (secondary check)

**Standard test sequence per item:**
1. `await __rrScenario.loadCustom(config)` or `__rrScenario.load('preset-name')`
2. `await __rrScenario.patch(overrides)` if needed
3. `const layout = await __rrLayoutDump()` — verify spatial correctness
4. `const path = await __rrScreenshotFile()` — capture visual state
5. Read screenshot + layout dump together for full verification

**Key spatial assertions from `__rrLayoutDump()`:**
- Status effects: y-position should be > (enemy HP bar y + HP bar height) and < (enemy sprite bottom)
- Power badges: x-positions all within `[0, viewportWidth]`, y within `[0, viewportHeight]`
- Hand cards: all card bottom edges < viewport height (no clipping below fold)
- Relic tray: all relic slots x within `[0, viewportWidth]`
- AP orb: x/y within viewport, clickable

**Key pixel assertions from screenshots:**
- Status effect icons: minimum 24px visible height; label text readable
- Power badge icons: minimum 32px visible; no overlap with adjacent badges
- Chain counter: multiplier text clearly readable; color bar matches chain type
- Damage numbers: at least 30px font size; contrast ratio sufficient against background
- HP bars: fill width visually proportional to HP percentage

---

### Critical Files for Implementation

- `/Users/damion/CODE/Recall_Rogue/src/dev/scenarioSimulator.ts`
- `/Users/damion/CODE/Recall_Rogue/src/ui/components/CardCombatOverlay.svelte`
- `/Users/damion/CODE/Recall_Rogue/src/ui/components/EnemyPowerBadges.svelte`

---

## Cross-References

- [Testing strategy](../strategy.md) — five testing layers overview
- [Inspection registry](../inspection-registry.md) — element-level test tracking
- [Scenario playtest skills](../../../.claude/skills/scenario-playtest/SKILL.md) — automated scenario execution
- [Chain multiplier rework](../../RESEARCH/chain-multiplier-rework.md) — prerequisite design spec
