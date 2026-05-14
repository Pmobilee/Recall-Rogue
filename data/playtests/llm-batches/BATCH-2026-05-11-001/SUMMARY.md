# Playtest Batch Summary — BATCH-2026-05-11-001
**Date**: 2026-05-11 | **Testers**: 1 (normal-player-fullrun) | **Domain**: general_knowledge

## Overall Verdict: **ISSUES**

The 33% damage cut overcorrected. Game is now too easy through floors 1-7 (Act 1). Tester cleared the Act 1 boss losing only 69 HP across 5 wins and reached the boss-reward screen — where a Phaser Yes/No modal blocked further automated progression. **Reached Floor 7, did NOT reach Act 2 Room 2.**

## Cross-source convergence
| Finding | Headless sim | Live playtest |
|---|---|---|
| Game is too easy after balance change | ✅ 81-98% win rate across profiles | ✅ Lost 69/100 HP in 7 floors, boss took 3 HP off |
| Boss intent tables too defensive | — | ✅ 4 of 7 boss turns were 0-damage |
| Quiz distractor quality | — | ✅ Multiple cross-category distractor pools |

The headless sim (1000 runs × 7 profiles) and the live LLM tester independently agree: difficulty is now too low.

## Issues

### CRITICAL
- **Boss-reward "Leave items behind?" Phaser modal blocks automated progression.** Tester defeated The Algorithm (floor-7 boss) then could not dismiss the Yes/No modal via DOM clicks, `__rrPlay.acceptReward / delve / mysteryContinue`, or synthetic canvas pointer events. Blocks LLM playtests, RL training runs, and headless verification of Act 2. A human with a mouse may not hit this — needs verification.

### HIGH
- **Difficulty too low** — boss did 3 HP damage in 7 turns (4 turns were 0-dmg intents). Multiplier 1.07 overshot.
- **Charge AP cost not surfaced** — cards display `apCost: 1` but charge costs 2. Player can't tell from the card.
- **Hand-index reshuffle after every play** — caused 4+ accidental sub-optimal plays. API-level issue (RL/LLM) but also affects mental model for human players.

### MEDIUM
- **Boss intent table too defensive** — The Algorithm: 4/7 turns are 0-damage (Self-repair, System scan ×2, Memory wipe).
- **Quiz distractor cross-category contamination** — fraction question with "Homer's Iliad" / "Halley's Comet" as distractors. Trivializes the core mechanic. Tester reported "answers derivable from question grammar alone."

### LOW
- **One question returned only 1 choice via `previewCardQuiz`** (`stroke_cases per 100K`) — possibly content bug or API truncation.
- **Single-choice "Continue"-only mystery event** felt like placeholder content.
- **Shop price discrepancy** — Surge Capacitor listed 52g, charged 42g. Likely a relic-discount mechanic not surfaced.

## Recommendations
1. **Walk back the damage multiplier** — try 1.20-1.30 (33% was too aggressive). Validate with `/balance-sim` until win rate drops to 50-65% for mid-skill profiles.
2. **Investigate the boss-reward modal softlock** — even if humans can dismiss it with a mouse click, the testability gap is a problem for ongoing balance work.
3. **Surface charge AP cost on cards** — UI fix.
4. **Run a distractor-homogeneity audit** on the quiz database — same grammar/category as the correct answer.
5. **Re-tune boss intent tables** so non-damaging turns are <25%.

## Full Tester Report
[normal-player-fullrun.md](./normal-player-fullrun.md) — 175 lines, 130 batches, ~25 min real time.
