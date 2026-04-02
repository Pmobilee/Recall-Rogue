# Playtest Batch Summary — BATCH-2026-04-02-004
**Date**: 2026-04-02 | **Testers**: 5 | **Domain**: general_knowledge | **Runs**: 3 encounters / 2 floors

## Overall Verdict: ISSUES

All 5 testers reported ISSUES. No CRITICAL game-breaking bugs (the RewardRoomScene crash from earlier batches is CONFIRMED FIXED). Core combat loop and reward transitions work reliably. Issues are primarily balance, content quality, and test harness gaps.

---

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | ISSUES | 0 | 0 | 2 | 2 |
| Balance Curve | ISSUES | 0 | 2 | 2 | 0 |
| Fun/Engagement | ISSUES | 0 | 1 | 0 | 4 |
| Study Temple | ISSUES | 1 | 0 | 0 | 1 |
| Full Run | ISSUES | 0 | 2 | 1 | 2 |

**Totals**: 1 Critical (API only), 5 High, 5 Medium, 9 Low

---

## Cross-Tester Insights

### CONVERGING (found by 2+ testers — high confidence)

- **[HIGH] acceptReward() can't handle relic-only rewards** — Fun tester and Full Run tester both hit this. The API uses card callbacks that are null for relics. Players unaffected; only automated testing blocked.

- **[HIGH] Floor 1-2 enemies deal trivial damage / combat too short** — Balance tester measured all combats at 2-4 turns. Fun tester confirmed zero-tension floor 1. Both flag enemy HP and damage as too low.

- **[MEDIUM] Fizzle damage higher than expected** — Balance tester measured charge-wrong beating quick-play (4 vs 2-3 dmg). Fun tester saw fizzle=4 vs expected 2. FIZZLE_EFFECT_RATIO may be 0.5× not 0.25×, or mastery modifiers apply.

- **[LOW] getCombatState() null window after enemy death** — Balance and Full Run testers both hit the brief window where getScreen()='combat' but state is null. Our guard fix works (returns null), but the window exists.

### SOLO (found by 1 tester — needs corroboration)

- **[CRITICAL/API] `fastForward()` uses wrong field names** — Study Temple tester only. `nextReview`/`lastReview` vs actual `nextReviewAt`/`lastReviewAt`. Zero effect on scheduling.

- **[HIGH] EventQuiz.svelte has no data-testid on choice buttons** — Full Run tester only. Mystery quiz events cause permanent lock for automated testing. 1-line fix per button.

- **[HIGH] Rest room buttons invisible during staggerPopIn animation** — Full Run tester only. 2s animation window where buttons exist but aren't clickable/visible.

- **[MEDIUM] Moai height distractors mix weight units** — Quiz tester only. "52,800 tonnes" as distractor for a height question.

- **[MEDIUM] Neuschwanstein distractors are World Wonders nicknames** — Quiz tester only. Unrelated to castles/theme parks.

- **[LOW] Citation Needed enemy heals +9 but telegraphed +5** — Fun tester only. Enemy heal mismatch.

- **[LOW] Rest Heal visible at full HP** — Fun tester only. Should be disabled.

---

## All Issues by Severity

### CRITICAL (1 — API/test infrastructure only)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| C-1 | `fastForward()` wrong field names | Study Temple | Uses `nextReview`/`lastReview` but FSRS uses `nextReviewAt`/`lastReviewAt`. Zero scheduling effect. |

### HIGH (5)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| H-1 | Enemy damage doesn't scale floors 1→2→3 | Balance | Floor 2 enemy (Overdue Golem) deals less damage than floor 1. Non-monotonic. |
| H-2 | Charge wrong beats quick play | Balance | Fizzle=4 vs quick=2-3. FIZZLE_EFFECT_RATIO × charge value > quick value at high chain. |
| H-3 | acceptReward() fails on relic-only rewards | Fun, Full Run | API uses card callbacks null for relics. Players unaffected. |
| H-4 | EventQuiz.svelte no data-testid | Full Run | Mystery quiz buttons unreachable by automated testing → permanent lock. |
| H-5 | Rest room buttons invisible during animation | Full Run | 2s staggerPopIn window blocks interaction. |

### MEDIUM (5)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| M-1 | Moai height: weight-unit distractors | Quiz | "52,800 tonnes" for a height question. |
| M-2 | Neuschwanstein: wrong-domain distractors | Quiz | World Wonders nicknames for a castle question. |
| M-3 | Combat too short (2-4 turns) | Balance | Enemy HP 27-34 too low. Target 45-70 for 4-7 turns. |
| M-4 | Charge animation race condition | Balance | Final kills via charge return stale state. |
| M-5 | getCombatState() null window post-death | Balance, Full Run | Brief undefined period after enemy death. Guard works. |

### LOW (9)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| L-1 | Rome Metaurus: 5-emperor list distractor | Quiz | Format mismatch vs single-person answer. |
| L-2 | Hindi language: single-word vs list distractor | Quiz | "Bengali" vs 3-language-list answer. |
| L-3 | Citation Needed heals +9, telegraphed +5 | Fun | Enemy heal value mismatch. |
| L-4 | Rest Heal visible at full HP | Fun | Should be disabled/grayed. |
| L-5 | Two reward phases without separator | Fun | Sequential gold→card phases unclear. |
| L-6 | endTurn() fails after enemy death | Full Run | Button removed before API call. |
| L-7 | CSP violation from playtest dashboard polling | Full Run | Every 30s, non-blocking. |
| L-8 | startStudy() wrong DOM selectors | Study Temple | Looks for unmounted StudySession elements. |
| L-9 | Study FSRS flip-card not connected to screen | Study Temple | Phase 13.4 TODO — only quiz overlay is live. |

---

## What's Working Well

All testers independently praised:

1. **RewardRoomScene is FIXED** — 9/9 transitions across all testers, zero crashes (BATCH-001/002/003 CRITICAL bug resolved)
2. **Core combat decision loop** — charge vs quick is genuinely interesting AP tradeoff (Fun: highlighted)
3. **Quiz preview before commit** — `previewCardQuiz()` creates real risk-reward reads (Fun: "excellent UX")
4. **Heavy Strike one-shot moments** — thematic alignment between card and fact creates "oh, that fits" satisfaction
5. **Meditate screen** — best decision UI in the game, full deck with facts visible (Fun highlight)
6. **Study Temple deck browser** — 63 decks, category tabs, search, progress tracking all functional
7. **selectDomain/selectArchetype API fixes working** — run start flow is clean

---

## Recommendations (Priority Order)

| # | Fix | Impact | Effort | Source |
|---|-----|--------|--------|--------|
| 1 | **Add data-testid to EventQuiz.svelte buttons** | Unblocks mystery quiz automation | Trivial | Full Run |
| 2 | **Fix fastForward() field names** | Unblocks FSRS scheduling tests | Trivial | Study Temple |
| 3 | **Raise floor 2-3 enemy HP to 45-70** | Restores combat tension | Low | Balance |
| 4 | **Audit FIZZLE_EFFECT_RATIO** — charge wrong should never beat quick | Balance integrity | Low | Balance |
| 5 | **Fix acceptReward() for relic-only rewards** | Unblocks full automation | Medium | Fun, Full Run |
| 6 | **Fix Moai + Neuschwanstein distractor pools** | Content quality | Low | Quiz |
| 7 | **Fix Citation Needed heal value mismatch** | Data integrity | Trivial | Fun |
| 8 | **Disable Rest Heal at full HP** | UX polish | Trivial | Fun |

---

## Next Steps

- Fix H-4 (EventQuiz testids) + C-1 (fastForward fields) — both trivial, unblock future automation
- Run `/balance-sim --runs 1000` to get statistical confirmation of floor 1-3 damage scaling
- Run `/inspect changed` after balance values are modified
- Re-run `/llm-playtest fullrun` after EventQuiz fix to verify mystery room coverage
- Consider running `/strategy-analysis` on charge-wrong vs quick-play to understand the fizzle ratio issue
