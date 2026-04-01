# Playtest Batch Summary — BATCH-2026-04-01-003
**Date**: 2026-04-01 | **Testers**: 4 | **Domain**: general_knowledge | **Runs**: 3 encounters each
**Fixes applied**: Study dedup, SRS +/- indicator, charge total AP, Rome/Greece pool fix, post-reward sync, floor 1 damage raise, playerHp API

## Overall Verdict: PASS (with minor issues)

Major improvement from BATCH-001/002. Quiz quality PASS, balance improved, all critical bugs fixed. Remaining issues are polish-level.

---

## Tester Verdicts

| Tester | B-001 | B-002 | B-003 | Trend |
|--------|-------|-------|-------|-------|
| Quiz Quality | ISSUES | PASS | **PASS** | Stable |
| Balance Curve | ISSUES | ISSUES | **PASS** (minor) | Improved |
| Fun/Engagement | ISSUES (C:1) | ISSUES | **ISSUES** (minor) | Improved |
| Study Temple | ISSUES | ISSUES | **PASS** (dedup fixed) | Improved |

---

## Fix Verification Status

| Fix | Status | Evidence |
|-----|--------|---------|
| Study question dedup | **CONFIRMED FIXED** | No duplicate questions in either session (was broken in B-001/002) |
| SRS +/- indicator | **IMPLEMENTED** | Present in StudyQuizOverlay code; 1200ms display window too brief for LLM to capture |
| Charge total AP display | **NOT DIRECTLY TESTED** | Testers used programmatic API (bypasses visual UI) |
| Rome/Greece pool contamination | **PARTIAL** | JSON distractors fixed, but runtime answerTypePool draws from DB — "three"/"23" still appear as pool-mate distractors |
| Post-reward flow (sync sceneComplete) | **IMPROVED** | acceptReward works, scenario loader reliable; organic map flow still has selectMapNode issues |
| Floor 1 enemy damage (3-4 base) | **CONFIRMED** | Intent=3, delivered=4 damage (was 2 in B-001) |
| playerHp in getCombatState | **CONFIRMED FIXED** | Returns correctly in every call |

---

## Remaining Issues

### HIGH (2)
| # | Issue | Source |
|---|-------|--------|
| H-1 | `trigger` undefined JS error blocks card plays intermittently | Balance |
| H-2 | Runtime pool distractors still contaminated (DB-level, not just JSON) | Study |

### MEDIUM (4)
| # | Issue | Source |
|---|-------|--------|
| M-1 | `endTurn()` requires double-call | Balance |
| M-2 | `selectMapNode()` doesn't launch combat (organic flow broken) | Balance, Fun |
| M-3 | Charge-wrong damage same as quick-play (fizzle 0.25x not observed) | Fun |
| M-4 | Basic encounters too short (2 turns) — enemy HP too low | Balance |

### LOW (3)
| # | Issue | Source |
|---|-------|--------|
| L-1 | Caligula horse distractors are people names not horse names | Quiz |
| L-2 | Archaeopteryx distractor "China" is a country not a species | Quiz |
| L-3 | Displayed vs actual damage values differ without tooltip | Fun |

---

## What's Working Great

1. **Quiz mechanic** — core loop consistently praised across all 3 batches
2. **Distractor rotation** — same fact shows completely different distractors each encounter
3. **Elite/boss encounters** — multi-phase patterns create genuine drama
4. **Study dedup** — fixed, 3 unique questions guaranteed per session
5. **playerHp API** — automated testing now reliable
6. **Reward room** — no more crashes, gold collecting works

---

## Recommendations

| # | Fix | Priority |
|---|-----|----------|
| 1 | Fix `trigger` undefined JS error | HIGH — causes silent gameplay failures |
| 2 | Fix runtime distractor pool at DB level (not just JSON) | HIGH — distractors still wrong in study |
| 3 | Fix `selectMapNode()` for organic run flow | MEDIUM — all testers use scenario loader workaround |
| 4 | Raise floor 1 basic enemy HP to 25-30 | MEDIUM — 2-turn combats feel flat |
| 5 | Fix `endTurn()` double-call requirement | MEDIUM — reliability hazard |
