# Playtest Batch Summary — BATCH-2026-04-10-003-fullsweep

**Date**: 2026-04-10 | **Testers**: 4 of 5 complete (full-run hit rate limit before writing report) | **Domain**: general_knowledge | **Runs**: 5 encounters / tester

## Overall Verdict: **FAIL**

3 CRITICAL findings across 2 testers, plus 6+ HIGH issues including 1 convergent perf issue found by all 3 combat-path testers. Full-run bug-hunter tester did not complete — Sonnet hit its rate limit ~90% through. The 4 completed testers surfaced more than enough actionable data to fix first; re-spawning the full-run tester can wait until after those fixes land.

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Quiz Quality | FAIL | 1 | 5 | 3 | 2 |
| Balance Curve | FAIL | 2 | 1 | 2 | 1 |
| Fun / Engagement | ISSUES | 0 | 2 | 5 | 0 |
| Study Temple | PASS | 0 | 1 | 1 | 2 |
| Full Run | INCOMPLETE | — | — | — | — |

## Convergence Matrix (CONVERGING = found by >1 tester)

| Issue | Severity | Tester(s) | Confidence |
|---|---|---|---|
| **Sustained low FPS in CombatScene (4–29 fps, avg 11–18)** | HIGH | quiz-quality, balance-curve, fun-engagement | **CONVERGING (3/3)** — high confidence, real signal even accounting for SwiftShader |
| **AP economy strands 1 AP at end of turn when only 2-cost charges available** | MED | balance-curve, fun-engagement | CONVERGING (2/2) |
| **Narrative/reward overlays require click to dismiss, feel sluggish** | MED | fun-engagement (+1 quiz-quality low-priority note) | CONVERGING (2/2) |
| **Post-tutorial devpreset leaks dev buttons into hub + doesn't re-apply after reload** | HIGH | fun-engagement (HUB-01), quiz-quality (L-01) | CONVERGING (2/2) |
| All other findings are SOLO (one tester only — lower confidence, still actionable) | — | — | — |

## Per-Focus-Area Verdict (14 items)

| # | Focus Area | Verdict | Evidence |
|---|---|---|---|
| 1 | Chess Tactics deck live play | **NOT TESTED** | No tester drew chess cards; full-run tester aborted before spawning chess combat. **Re-run needed.** |
| 2 | Map Pin Drop quiz mode | **NOT TESTED** | world_capitals not drawn in general_knowledge; study-temple reached detail modal only. **Re-run needed.** |
| 3 | Deck front art (7 new decks) | **PASS** | All 7 portrait pixel-art, 0 broken, 0 landscape regressions (study-temple) |
| 4 | Resume flow / InRunFactTracker rebuild | **FAIL — CRITICAL** | `reviewStateSnapshot.has is not a function` on every post-resume card play. Commit 0aeff3bfe fix is incomplete. |
| 5 | Fact repetition (ack only) | ACK | All testers respected |
| 6 | QP vs Charge ratio (ack only) | ACK | Measured 1.5× as expected |
| 7 | Hub onboarding clarity | **ISSUES** | 9 sprite hitboxes without labels; 7 dev buttons visible in prod hub; 3/5 clarity |
| 8 | Audio leakage | N/A | Muted in Docker |
| 9 | AP economy sanity | **ISSUES** | 46% of turns ended with ≥1 wasted AP |
| 10 | Card reward relevance | **BLOCKED** | Reward room auto-accepts via Phaser scene; no 3-card picker surfaced through `__rrPlay`. Needs API expansion. |
| 11 | Relic clarity | **NOT TESTED** | `getRelicDetails()` returned `[]` entire session. Post_tutorial preset didn't seed relics OR API doesn't expose them. Needs fix to test framework. |
| 12 | Run-end flow | **ISSUES** | Player death → direct hub jump, no runEnd screen shown. `getSessionSummary()` returns valid data but death-stats UI skipped. |
| 13 | Cursed / fizzle path | **PASS** | 7+ intentional wrongs across testers, no NaN, no negatives, no UI lock. Damage values slightly above `floor(qp×0.25)` due to mastery stacking, which is expected. |
| 14 | Performance subjective signal | **FAIL** | See CONVERGING row above. 10+ `[fps] Low FPS alert` events; `__rrDebug().fps`: current 14–18, min 4, avg 11–22. |

## All Issues by Severity

### CRITICAL

1. **[content/synthetic-distractors] `{N}` template token leak in quiz options** — `pc_0_tigerking_viewers` serves choices `['34.3', '{93}', '{28}', '{1932}']`. Correct answer trivially identifiable. Deterministic (observed twice). Synthetic-distractor number formatter emits unescaped template braces. **Owner: content-agent.** Fix: grep `data/decks/pop_culture*.json` (and any scripts emitting numeric synthetic distractors) for literal `{` in distractor strings; fix the template-interpolation step in the synthetic-distractor generator.

2. **[game-logic/save-load] `reviewStateSnapshot.has is not a function` after resume** — Every post-resume `chargePlayCard` / `quickPlayCard` throws. Cards still consume AP and some damage lands but the tracker path is broken and errors leak into rrPlay return values. **Commit 0aeff3bfe's "fix" does not fix the bug.** `reviewStateSnapshot` is deserialized from JSON as a plain object `{}` but code calls `.has()`. Needs proper Set/Map rehydration in `InRunFactTracker` constructor or wherever the snapshot is loaded. **Owner: game-logic.**

3. **[game-logic/dev-tooling] `__rrPlay.restore()` leaves scene body black** — HUD chrome restores correctly but Phaser scene not loaded. `acceptReward()` fails with "RewardRoomScene not active after 3s wait". Natural "Resume Run" button works, but the dev-tool restore path is broken — blocks `/inspect` resume testing and any mid-run snapshot workflow. **Owner: game-logic.**

### HIGH

4. **[perf] Sustained <20 fps in CombatScene** — CONVERGING across 3 testers. `__rrDebug().fps` current 14–18, min 4, avg 11–22. 10+ low-FPS alerts with sustained 8–18 fps for 60–423 seconds. Target 60 / hard-fail <45. SwiftShader inflates the effect but 4–22 is way below hardfail. Root cause likely a tween leak, RAF leak, or Phaser object pool churn. **Owner: game-logic / ui-agent (whoever owns CombatScene render loop).** Run `/phaser-perf` skill to profile.

5. **[content/deck-quality] Broken grammar "the concept" word-replacement scars** — Two question stems have grammatically broken "the concept" inserts from a prior batch replacement pass:
   - `cs_7_msword_original_name`: "Microsoft **the concept** was first released in 1983..."
   - `philosophy_at_williams_moral_luck`: "...that **the concept praise and blame** are pervasively influenced..."
   Strongly recommend `grep -r "the concept " data/decks/` to find the rest of that batch. Exactly matches the pattern warned about in `.claude/rules/content-pipeline.md` §"Batch Output Verification". **Owner: content-agent.**

6. **[content/deck-quality] Multi-category answer-pool contamination** — Three pop_culture / inventions facts mix semantic answer types across their 4 choices:
   - `inv_3_barcode_patent` ("Who" question): 2/4 distractors are descriptions ("Wing-warping (roll), front elevator...", "Nobel Prize in Physics for neutron bombardment work"), not names
   - `pc_5_netflix_platform` (streaming service): distractors include Game Boy + PlayStation 2
   - `pc_1_n64_innovation` (analog stick): distractors include "King of Comics" and "$15 billion+"
   Directly violates `.claude/rules/deck-quality.md` §"Pool Design Rules — MANDATORY" semantic-homogeneity rule. **Owner: content-agent.** Fix: `node scripts/fix-pool-heterogeneity.mjs --dry-run` on affected decks.

7. **[ui-agent] Dev buttons leak into post_tutorial hub** — 7 dev buttons (Intro / Enter / Exit / RunEnd / Lighting / BrightIdea / InkSlug) visible alongside Start Run when `?skipOnboarding=true&devpreset=post_tutorial`. Should be gated behind a pure dev flag, not devpreset. Steam reviewer will notice within 60 seconds. **Owner: ui-agent.**

8. **[ui-agent] `startStudy` from hub → empty "QUESTION 1 / 0" dead screen** — Two compounded defects: (a) `__rrPlay.startStudy()` fails its precondition but still advances the screen store to `restStudy`, violating fail-fast. (b) `restStudy` empty-pool state renders "QUESTION 1 / 0" with no back button, no error, no grade buttons — player stuck in a black screen. A real player hitting this via a mis-wired button would be softlocked. **Owner: ui-agent.** Fix: early-return to hub or show "No cards to review" empty state.

### MEDIUM

9. **[game-logic] AP economy strands 1 AP at turn end** — 46% of balance tester's turns ended with ≥1 wasted AP; fun tester independently flagged the charge surcharge not being obvious. Starting AP 3/4 lets you charge exactly 1 card (2 AP) and orphan 1 AP. Suggestions from balance tester: (i) bump starting AP to 4/4 from turn 1, (ii) make first-charge-free waiver consistent, (iii) reduce charge surcharge to 0 when hand is homogeneous. Needs design call. **Owner: game-logic + design.**

10. **[ui-agent/game-logic] Run-end skips `runEnd` screen on death** — Player HP → 0 jumps straight to hub; no death-stats screen. `getSessionSummary()` has valid data but the UI skips the reveal. **Owner: ui-agent.**

11. **[ui-agent] Narrative overlays don't auto-dismiss** — Pre-combat flavor, chain-win flavor, floor-intro overlays require explicit click-to-dismiss; hint is small + low-contrast. Feels like the game is hung 3–5s. **Owner: ui-agent.**

12. **[ui-agent] Weak low-HP visual signal** — Only HP bar color change at <43%. No vignette, pulse, shake, flash. With muted audio the "you're in trouble" moment is subdued. **Owner: ui-agent.**

13. **[content/deck-quality] Length-tell in 2 questions** — `cs_3_np_complete_first_problem` (technical term outlier), `inv_3_barcode_patent` (double-counted with H-03). **Owner: content-agent.**

14. **[ui-agent] Hub sprite hitboxes have no accessible labels** — 9 sprites (bookshelf, tent, chest, signpost, etc.) have no text/aria-label/tooltip. New players don't know what's clickable. **Owner: ui-agent.**

15. **[ui-agent] Reward room items have no labels/tooltips** — Altar cards + potion are icon-only. No hover text, no "click to inspect". New player confusion. **Owner: ui-agent.**

16. **[ui-agent/perf] Library fact-browser renders all ~53k facts un-virtualized** — 4.6MB layout dump; DOM has tens of thousands of `.fact-row` buttons. Scalability concern for low-end Steam PCs. Suggest virtualized scrolling. **Owner: ui-agent.**

### LOW

17. **[quiz/dev-tooling] `?skipOnboarding=true&devpreset=post_tutorial` flag not re-applied after `location.reload()`** — After reload, clicking Trivia Dungeon lands on `onboarding` instead of skipping it. Orchestration concern, not a player bug.

18. **[content/deck-quality] Philosophy deck NEW badge not visible in screenshot** — Likely frame-clipping, not missing data. Needs DOM verify.

19. **[game-logic] Enemy attack math inconsistent with intent** — "attack 10" intent but HP drop didn't match block math. Could be vulnerable/thorns/charge-unleash bonuses — worth auditing damage pipeline for invisible modifiers.

## Recommendations (Ranked by Impact / Effort)

1. **(HOUR)** Fix `InRunFactTracker` rehydration (#2). Read `src/services/inRunFactTracker.ts`, find where `reviewStateSnapshot` is loaded from JSON, wrap in `new Set(data.reviewStateSnapshot ?? [])` or equivalent. This is the highest-impact fix — affects every player who ever reloads.
2. **(HOUR)** Fix `{N}` synthetic distractor leak (#1). Grep content pipeline scripts for unescaped `{${value}}` template literals, likely in `scripts/add-synthetic-distractors.mjs` or similar. Regenerate pop_culture synthetic distractors after fix.
3. **(HOUR)** Grep all decks for `"the concept "` substring (#5), fix each stem individually. Then add a validation check to `scripts/verify-all-decks.mjs` for known word-replacement scar patterns.
4. **(DAY)** Profile CombatScene FPS with `/phaser-perf` skill (#4). Likely suspects: tween leak, Phaser pool churn, debug overlay overhead.
5. **(HOUR)** Hide dev buttons from `post_tutorial` hub unless a separate `?dev=true` flag is present (#7). Keep them available but gate properly.
6. **(HOUR)** Fix `startStudy` softlock (#8). Early-return to hub or show empty state.
7. **(HOUR)** Split contaminated pools (#6) via `scripts/fix-pool-heterogeneity.mjs`.
8. **(DAY)** Fix `__rrPlay.restore()` scene rebuild (#3) — requires understanding Phaser scene lifecycle re-entry from snapshot.
9. **(DAY)** Add `runEnd` scene on death (#10) — even a simple stats overlay would be a huge UX lift.
10. **(DAY)** Improve low-HP signal (#12) — simple vignette + HP-bar pulse goes a long way.

## Next Steps (Suggested Follow-ups)

- Run `/inspect chess_tactics` to live-verify chess deck combat UI (Item 1 was NOT tested this batch — gap)
- Run `/inspect world_capitals` to live-verify map pin drop mode (Item 2 was NOT tested this batch — gap)
- Run `/phaser-perf` to profile CombatScene FPS regression
- Run `/balance-sim` to statistically corroborate AP economy strand findings
- Run `/ux-review` on hub + reward room for the labeling gaps (items 14, 15)
- Spawn a content-agent sub-agent to handle CRITICAL #1 + HIGH #5 + HIGH #6 in one batch (they're all deck-data fixes)
- Spawn a game-logic sub-agent to handle CRITICAL #2 + CRITICAL #3 (both save/resume)
- Spawn a ui-agent sub-agent to handle HIGH #7 + HIGH #8 + MED #10-#12, #14-16 (UI polish + softlocks)

## Gaps in This Batch

- Full-run bug-hunter tester hit Sonnet rate limit ~90% through; did NOT write `full-run.md`. Focus items 1 (chess), 2 (map pin), 11 (relic clarity via fresh run), and 12 (run-end flow via full 3-floor death) are UNTESTED or PARTIALLY tested.
- Reward-choice API not surfaced via `__rrPlay` — item 10 (card reward relevance) couldn't be measured; auto-accept strips the data.
- Relic details API returned `[]` — item 11 (relic clarity) blocked by test framework gap.
- SwiftShader exaggerates the perf signal; findings need cross-check on real GPU hardware.
