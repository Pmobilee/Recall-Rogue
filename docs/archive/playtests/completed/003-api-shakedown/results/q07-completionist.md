# Q7: The Completionist - Full Game Loop

- Generated: 2026-03-07T18:50:00Z
- Script: `tests/e2e/batch003-playtest-core.cjs`
- Raw evidence: `docs/playtests/active/003-api-shakedown/results/raw/q07.json`

## Play Session Diary
I started at base with a clear action surface and moved directly into Dive 1. The first dive reached 25 blocks cleanly, with no quiz interruptions and a meaningful oxygen drop (ended around 56 O2). It felt like a functional mining lane, but not a particularly dynamic one.

After surfacing, I ran a 10-card study segment. The transition from dive to study was stable and the card flow was smooth enough to clear all ten cards without recovery handling.

Then I toured dome rooms (`command`, `lab`, `workshop`) and returned for Dive 2. Dive 2 also hit 25 blocks, but with a broader movement style and much higher oxygen retention (ended around 100 O2), so there was visible run-to-run variation even with flat dust telemetry.

## Quantitative Summary
- Dive 1: `25` blocks, O2 end `56`, inventory delta `+6`
- Study: `10` cards reviewed
- Dome: `3` rooms visited
- Dive 2: `25` blocks, O2 end `100`, inventory delta `0`
- API calls used for full loop: `119`

## Most/Least Engaging
- Most engaging: study phase (clear cadence and progress feedback)
- Least engaging: mining in this sample, mainly due to no quiz interruptions and flat dust signal

## Cohesion Rating
**8/10** for loop cohesion: all phases chain together naturally and do not feel detached.

## Success Criteria
| Criterion | Rating | Evidence |
|---|---|---|
| Dive + Study + Dome complete without errors | PASS | All three phases completed |
| Worker identifies most fun phase | PASS | Study chosen as most engaging |
| Dive 2 shows variation from Dive 1 | PASS | Different O2 outcome and style profile |
| Full loop under 80 API calls | FAIL | 119 calls |

## Verdict
**FAIL** on efficiency budget, despite good phase cohesion.

## What I'd change
Reduce high-frequency polling/validation in scripted play mode (or relax the 80-call cap) when using mandatory LOOK->DECIDE->ACT->CHECK loops.
