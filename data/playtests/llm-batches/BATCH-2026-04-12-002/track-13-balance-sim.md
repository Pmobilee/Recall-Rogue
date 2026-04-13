# Track 13 — Headless Balance Simulation
## Verdict: ISSUES

## Simulation Data (6000 runs, 23.6s)

| Profile | Win Rate | Charge Rate | Accuracy | Avg Acts | Avg Encounters | HP(surv) | In Range? |
|---------|----------|-------------|----------|----------|----------------|----------|-----------|
| new_player | 31% | 6% | 50% | 1.93 | 14.3 | 65 | YES (20-40%) |
| developing | 77% | 79% | 60% | 2.63 | 16.9 | 81 | YES (60-80%) |
| competent | 47% | 70% | 68% | 2.15 | 13.9 | 51 | YES (40-60%) |
| experienced | **97%** | 82% | 76% | 2.92 | 18.2 | 106 | **HIGH** (target 70-90%) |
| master | 84% | 81% | 85% | 2.75 | 17.4 | 87 | YES (70-90%) |
| language_learner | 22% | 62% | 35% | 1.74 | 11.8 | 36 | YES (20-40%) |

## Relic Audit
- 10 WORKING (direct combat stat relics)
- 30 PASSIVE/UI-only (economy, shop, visual — not measurable by headless sim)
- 0 BROKEN

## Issues Found

### [MEDIUM] experienced profile win rate 97% — above 70-90% target
The `experienced` profile (76% accuracy, 82% charge rate) wins 97% of runs. This suggests the difficulty curve is too flat for high-skill players. Possible fixes:
- Increase Act 2/3 enemy HP scaling
- Reduce charge damage multiplier at higher floors
- Add more elite/boss encounters in later acts

### [LOW] 0-trigger relics not distinguishable from economy relics
The relic audit can't differentiate between "relic works but only affects economy" and "relic trigger is broken" for 30 relics. Cross-reference with Track 7 findings (which found plague_flask and thick_skin encounter-start triggers are broken).

## Source Data
`/Users/damion/CODE/Recall_Rogue/data/playtests/runs/2026-04-12_15-48-16/`
