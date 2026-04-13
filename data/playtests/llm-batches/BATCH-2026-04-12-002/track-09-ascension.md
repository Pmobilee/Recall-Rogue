# Track 9 — Ascension System Verification
## Verdict: ISSUES

Ascension scaling logic is **correctly implemented** in the game engine and turns state. Three issues found: stale preset values, enemy HP non-monotonicity (expected, explained below), and no ascension badge in combat UI.

---

## Scaling Data (page_flutter at floor 1)

Enemy baseHP = 7, ENEMY_BASE_HP_MULTIPLIER = 4.75, getFloorScaling(1) = 1.0.
Base unscaled HP before variance = round(7 × 4.75 × 1.0) = 33.25.
Variance range: 0.85–1.15 × base (random per encounter).

| Ascension | Enemy HP | turnState ascDmgMult | Player maxHP | ascWrongDmg | diffVariance | AP | Notes |
|-----------|----------|---------------------|--------------|-------------|----------------|-----|-------|
| 0 | 31 | 1.00 | 100 | 0 | 0.939 | 3/5 | Correct. No modifiers. |
| 1 | 32 | 1.00 | 100 | 0 | (varies) | 3/5 | No HP/damage modifier yet (A2 threshold). |
| 2 | 32 | 1.15 | 100 | 0 | (varies) | 3/5 | **A2 damage multiplier active** — confirmed 1.15 |
| 5 | 33 | 1.15 | 100 | 0 | (varies) | 3/5 | Correct. No HP multiplier (kicks in at A9). |
| 9 | 32 | 1.20 | 100 | 0 | (varies) | 3/5 | **A8+ damage mult 1.20** active. HP mult 1.10 active but variance obscures it. |
| 10 | 42 | 1.20 | 100 | 0 | (varies) | 3/5 | Higher variance roll shows 1.10× HP multiplier clearly. |
| 13 | 36 | 1.20 | **75** | 0 | (varies) | 3/5 | **A13 player max HP cap (75) active** — confirmed. |
| 15 | 33 | **1.20** | **75** | 0 | 0.851 | 3/5 | A15 modifiers correct. Low variance roll explains HP=33. |
| 17 | 39 | **1.25** | **75** | **2** | (varies) | 3/5 | All A17 thresholds confirmed active. |

### ascension-15-elite Preset (final_lesson, floor 8)
| Enemy | Enemy HP | displayDamage | Player HP | turnState ascDmgMult | ascWrongDmg | Player maxHP |
|-------|----------|---------------|-----------|---------------------|-------------|--------------|
| The Final Lesson | 107/107 | 14 | 60/100 | **1.5 (STALE)** | **5 (STALE)** | 100 (not capped) |

---

## Monotonicity Check

**Enemy HP — NOT strictly monotonic, but EXPECTED behavior.** Enemy HP for common enemies includes a `difficultyVariance` of 0.85–1.15× rolled randomly per encounter. This is by design (seeded RNG in real runs for co-op parity; random in dev). The ascension HP multiplier (1.0 → 1.10 at A9 → 1.15 at A15) IS applied correctly, but at floor 1 with baseHP=7 the variance range (±15%) is wide enough to produce apparent inversions across unrelated runs.

Expected HP ranges at floor 1 (pre-variance: 33.25):
- A0–A8: 28–38 (variance only)
- A9–A14: 31–42 (×1.10)
- A15+: 32–44 (×1.15)

All observed values fall within their respective expected ranges.

**Enemy Damage — Correctly stepped, but obscured by variance.** The damage multiplier steps at A2 (1.15×), A8 (1.20×), A17 (1.25×) are all confirmed correct via direct turnState reads.

**AP — UNCHANGED across all ascension levels.** Confirmed: apMax=5, ap=3 at all tested levels. Correct per spec.

---

## Issues Found

### ISSUE 1 — STALE: `ascension-15-elite` preset has outdated turnOverrides [src/dev/scenarioSimulator.ts:433-437]
**Severity: Medium** — Only affects the dev scenario preset, not real gameplay.

The preset overrides `ascensionEnemyDamageMultiplier: 1.5` and `ascensionWrongAnswerSelfDamage: 5` via `turnOverrides`. Both values are pre-Pass-8/9a era values that were reduced during balance passes.

Current correct values for A15 (from `getAscensionModifiers(15)`):
- `enemyDamageMultiplier`: 1.20 (preset has 1.5 — was the old A17 value)
- `wrongAnswerSelfDamage`: 0 (preset has 5 — only activates at A17, and even then it's 2 now)
- `playerMaxHpOverride`: 75 (preset's `playerHp: 60` sets current HP lower but doesn't reflect the 75 max)

The preset also sets `playerMaxHp` via the playerHp field which controls CURRENT HP, not max HP. When running the preset, the player starts at 60/100 HP instead of the correct 60/75.

Fix needed in `src/dev/scenarioSimulator.ts` `ascension-15-elite` block.

### ISSUE 2 — DISCOVERABILITY: No ascension badge or indicator visible in combat UI
**Severity: Low** — Player-experience gap.

Screenshots at A1, A5, A10, A15 all show identical combat UI. There is no ascension badge, icon, or indicator anywhere in the combat screen. Players cannot tell what ascension level an in-progress run is at from within combat. The topbar shows "Shallow Depths | Floor 1 | [gold] 0" but no ascension level indicator.

This is particularly relevant for high-ascension runs where the player should be aware of active modifiers (wrong-answer self-damage at A17, timer penalty at A4, etc.).

### ISSUE 3 — DATA INTEGRITY: `encounterStartShield` not applied on dev spawn
**Severity: Low** — Dev tooling only, does not affect real gameplay.

At A9+, `encounterStartShield: 2` should be active (2 shield at encounter start). The turnState shows `encounterStartShield: 0` on initial spawn via `__rrScenario.spawn`. The shield appears to be applied during `startEncounterForRoom()` via the `onEncounterStart` relic/modifier hook, which may not fire in the dev spawn path.

---

## Notes

- The first test (A0) had a browser crash on `rrScreenshot` — screenshot artifact `/tmp/rr-docker-visual/track-9_combat-basic_1776008871618/` has no screenshot but the `getCombatState()` eval succeeded and captured valid data.
- AP is correctly 3/5 at all levels — AP max is not a function of ascension level.
- All ascension multipliers confirmed to be correctly threaded from `getAscensionModifiers()` → `encounterBridge.ts` → `turnState` → `computeIntentDisplayDamage()`.
