# AR-210: Balance Pass — Headless Simulation Validation

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — Part 11 (Balance Scorecard)
**Priority:** High
**Estimated complexity:** Medium
**Depends on:** AR-209 (all content wired and unlocked)
**Blocks:** AR-212 (Art), AR-213 (Doc Sync), AR-214 (Final Test)

## Overview

Run comprehensive headless simulation testing across all 6 player profiles with the full 91-card, 77-relic expansion. Validate win rates, identify degenerate combos, tune any outliers, and produce a final balance report. This is the numbers-first validation pass — visual and integration testing happens in AR-214.

## TODO

- [ ] 1. Update headless sim bot profiles for new archetypes
  **Files:** `tests/playtest/headless/profiles/` or equivalent
  **What:** Add or update bot profiles to exercise new archetypes:
  - **Bleed Assassin:** Prioritize Rupture, Lacerate, Hemorrhage, Twin Strike
  - **Burn Burst:** Prioritize Kindle, Ignite, Entropy, Multi-Hit
  - **Chain Master:** Prioritize Chain Lightning, Chain Anchor, Synapse
  - **Quiz Master:** Prioritize Curse of Doubt, Mark of Ignorance, Gambit
  - **Inscription Engine:** Prioritize all 3 Inscriptions + cheap 1-AP cards
  - **Curse Weaponizer:** Prioritize Dark Knowledge, intentionally fail some Charges
  Keep existing profiles (scholar, gamer, casual, etc.) as baseline controls.
  **Acceptance:** At least 10 profiles defined (6 existing + 4-6 new archetype profiles).

- [ ] 2. Run full balance simulation — 1000 runs per profile
  **Files:** `tests/playtest/headless/run-batch.ts`
  **What:** Execute: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
  Record: win rate per profile, average floor reached, average HP at death, cards played distribution, Burn/Bleed/Cursed fact stats.
  **Acceptance:** All runs complete with 0 crashes. Results saved to `data/playtests/`.

- [ ] 3. Analyze win rates against targets
  **Files:** Output analysis
  **What:** Target win rates: 40-60% across all profiles. Check for:
  - Any profile below 30% (too weak — cards need buffing)
  - Any profile above 70% (too strong — cards need nerfing)
  - Large variance between profiles (>25% spread indicates archetype imbalance)
  Document findings in a balance report.
  **Acceptance:** Win rates within 35-65% for all profiles, or identified outliers with proposed fixes.

- [ ] 4. Run degenerate combo check
  **Files:** `tests/playtest/headless/run-batch.ts` (with logging)
  **What:** Check for degenerate combos from Part 11:
  - Chain Lightning + 5-chain + Singularity damage (should be rare, earned when it happens)
  - Triple Inscription setup time vs fight length (should take 2+ turns)
  - Mind Palace 30-streak frequency (should be <1% of runs)
  - Conversion + Aegis Stone block-to-damage (capped at 15)
  - Frenzy + multiple Charges per turn (pacing concern)
  Log max single-card damage, max damage in one turn, longest chain achieved.
  **Acceptance:** No single combo produces >200 damage reliably (>5% of runs).

- [ ] 5. Run relic audit
  **Files:** `tests/playtest/headless/relic-audit.ts`
  **What:** Execute relic audit: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts`
  Verify all 36 new relic triggers fire at least once across 1000 runs. Check pick rates — any relic picked <2% of the time may need buffing.
  **Acceptance:** All 77 relics trigger at least once. No relic has 0% pick rate.

- [ ] 6. Tune outlier values if needed
  **Files:** `src/data/mechanics.ts`, `src/data/balance.ts`, `src/data/relicData.ts`
  **What:** Based on sim results, adjust any outlier QP/CC/CW values or relic trigger effects. Document every change with reasoning. Changes must stay within +/-20% of the expansion spec values — if larger changes are needed, flag for user decision.
  **Acceptance:** Re-run 500 runs after tuning. Win rates within target range.

- [ ] 7. Cursed Card system balance check
  **Files:** Sim output analysis
  **What:** Check cursed fact statistics across runs:
  - Average cursed facts per run (target: 3-8 for average player)
  - Auto-cure trigger rate (should be <5% of runs — safety valve, not common)
  - Cure rate (what % of curses get cured within the run)
  - Dark Knowledge damage output (should be moderate, not dominant)
  **Acceptance:** Cursed system metrics within expected ranges. Auto-cure rare.

- [ ] 8. Generate final balance report
  **Files:** `data/playtests/reports/expansion-balance-report.md` (new)
  **What:** Write a comprehensive balance report covering:
  - Win rates by profile
  - Top 5 strongest cards by win-rate contribution
  - Top 5 weakest cards (lowest pick rate + lowest win contribution)
  - Degenerate combo frequency
  - Relic pick rates and trigger frequencies
  - Cursed system metrics
  - Recommended tuning (if any)
  **Acceptance:** Report exists and is complete.

## Testing Plan

1. Headless sim: 1000 runs × 10+ profiles = 10,000+ simulated runs
2. Relic audit: verify all triggers
3. Cursed system metrics
4. Degenerate combo logging

## Verification Gate

```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
# 0 crashes, win rates 35-65%
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts
# All relics trigger
```

## Files Affected

| File | Change Type |
|------|------------|
| `tests/playtest/headless/profiles/` | New/updated bot profiles |
| `tests/playtest/headless/run-batch.ts` | Add new archetype profiles, Burn/Bleed/Cursed logging |
| `data/playtests/reports/` | New balance report |
| `src/data/mechanics.ts` | Possible value tuning |
| `src/data/balance.ts` | Possible constant tuning |
| `src/data/relicData.ts` | Possible relic tuning |

## Doc Updates Required

- `docs/GAME_DESIGN.md` — Update balance section with final tuned values if any changed
