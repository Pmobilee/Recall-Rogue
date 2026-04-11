# Archetype Performance (Multi-Dimensional)

*28000 total runs across 22 profiles*

> **Primary sort:** avgFloorsReached (survivorship-free — 18 for wins, deathFloor for losses).
> **hpEfficiency:** totalDamageDealt / totalDamageTaken — values >1 mean more damage dealt than taken.
> **deckDiversity:** Shannon entropy of deck type distribution (bits) — higher = more varied deck.

## Archetype Performance Table

| Profile | Runs | Win% | Avg Floors | Avg Enc Won | HP Efficiency | Deck Diversity (bits) |
|---------|------|------|------------|-------------|---------------|-----------------------|
| experienced | 4000 | 94.5% | 17.8 | 17.7 | 33.05 | 1.33 |
| build_fortress | 1000 | 84.0% | 17.7 | 17.3 | 34.66 | 1.33 |
| build_poison | 1000 | 86.9% | 17.4 | 16.5 | 20.79 | 1.33 |
| build_control | 1000 | 73.2% | 17.3 | 16.7 | 22.19 | 1.35 |
| master | 4000 | 71.2% | 17.1 | 16.4 | 25.27 | 1.34 |
| build_exhaust | 1000 | 64.9% | 17.1 | 16.2 | 18.57 | 1.34 |
| experienced@asc5 | 1000 | 81.0% | 17.0 | 16.1 | 22.17 | 1.44 |
| developing | 1000 | 63.7% | 16.8 | 16.1 | 13.62 | 1.23 |
| build_berserker | 1000 | 56.5% | 16.5 | 13.4 | 12.28 | 1.25 |
| build_tempo | 1000 | 53.6% | 16.4 | 14.8 | 14.60 | 1.33 |
| experienced@asc10 | 1000 | 71.7% | 16.2 | 15.0 | 25.95 | 1.42 |
| build_chain | 1000 | 54.3% | 15.8 | 14.2 | 14.14 | 1.32 |
| build_strength | 1000 | 41.3% | 15.6 | 13.8 | 12.62 | 1.33 |
| master@asc5 | 1000 | 51.2% | 15.5 | 14.2 | 18.36 | 1.43 |
| competent | 1000 | 29.0% | 15.5 | 12.8 | 10.50 | 1.25 |
| new_player | 1000 | 22.2% | 15.3 | 13.8 | 8.90 | 1.65 |
| language_learner | 1000 | 19.8% | 14.7 | 10.8 | 7.90 | 1.22 |
| master@asc10 | 1000 | 42.2% | 14.7 | 13.1 | 20.90 | 1.41 |
| experienced@asc15 | 1000 | 54.8% | 14.5 | 12.6 | 32.29 | 1.40 |
| master@asc15 | 1000 | 31.3% | 12.6 | 10.6 | 26.23 | 1.40 |
| master@asc20 | 1000 | 9.1% | 8.3 | 6.7 | 20.58 | 1.20 |
| experienced@asc20 | 1000 | 2.7% | 4.0 | 3.1 | 14.19 | 1.09 |

## Notable Archetypes

**Most HP-Efficient:** build_fortress (34.66× ratio)
**Most Diverse Deck:** new_player (1.65 bits)
**Most Floors Reached:** experienced (17.8 avg)
**Highest Win Rate:** experienced (94.5%)
