# Playtest Batch Summary — BATCH-2026-04-12-001
**Date**: 2026-04-12 | **Testers**: 5 | **Domain**: general_knowledge | **Runs**: 3 combat/encounter + 1 full run

## Overall Verdict: **FAIL**

Quiz Quality tester returned FAIL due to 2 CRITICAL bugs visible to every player who touches the affected fact subsets. Full Run tester hit 2 CRITICAL bugs as well but downgraded to ISSUES because one reproduces only on continued-run state and the other is a shop-only papercut. The aggregate verdict takes the worst-case: any CRITICAL player-facing data corruption is a FAIL.

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | **FAIL** | 2 | 3 | 2 | 3 |
| Balance Curve | ISSUES | 0 | 2 | 4 | 2 |
| Fun/Engagement | ISSUES | 0 | 5 | 5 | 4 |
| Study Temple | ISSUES | 0 | 3 | 3 | 1 |
| Full Run Bug Hunter | ISSUES | 2 | 6 | 6 | 3 |
| **TOTAL** | **FAIL** | **4** | **19** | **20** | **13** |

## Cross-Tester Insights — Converging Evidence

Issues flagged by multiple testers get escalated confidence. These are the bugs most worth fixing first because multiple independent sessions saw them.

- **[4× CONVERGING] `{N}` curly-brace template placeholder leak** in quiz choices and `factAnswer` — flagged by Quiz Quality (C-001), Fun/Engagement (lowlight #2), Study Temple (HIGH #1: `StudyQuizOverlay.svelte` missing `displayAnswer()` call), Full Run (C-001 CONFIRMED 4th). Confirmed facts: `pc_0_mash_finale_viewers`, `pc_2_superman_debut_year`, `pc_2_spawn_sales_record`, `pc_3_instagram_facebook_acquisition`, Transformers debut year fact. Steam-review fuel — a 30-second reviewer screenshotting `["{2015}", "1938", "{3}", "{2008}"]` wins the review thread.
- **[3× CONVERGING] Combat readability / no chain UI feedback** — Balance Curve (S-BC2 Agency 2/5), Fun/Engagement (HIGH: "Strike damage bouncing 4/7/14/11 with no visible reason"), Full Run (enemy intent `displayDamage` changing mid-turn without reason). Strike values and chain multiplier math are both invisible to the player. First-time players will believe the game is buggy.
- **[2× CONVERGING] `turnsRemaining: 9998` sentinel leak** on permanent Strength buff — Quiz Quality H-003, Fun/Engagement notable moment. Should display `∞` or `while in combat`; currently ticks 9998 → 9997 → 9996 visibly.
- **[2× CONVERGING] FPS 11-31 in CombatScene** — Balance Curve medium finding, Fun/Engagement HIGH. Both testers flagged alert ring-buffer warnings. Likely SwiftShader (Docker-only), but a potential real-hardware concern if it reproduces outside Docker. Worth a `/phaser-perf` sanity check before Steam.
- **[2× CONVERGING] Screen router drift post-kill-blow** — Balance Curve (getCombatState null after killing blow while getScreen says 'combat'), Full Run (getScreen returns 'combat' while RewardRoomScene is active). Any tester using the documented screen router will get stuck.
- **[2× CONVERGING] Run flow docs drift** — Every tester discovered that the post-`startRun` flow is now `deckSelectionHub → triviaDungeon → onboarding`, not the documented `domainSelect → archetypeSelect → dungeonMap`. `action-specs.md` and multiple skills need updating.

## All Issues by Severity

### CRITICAL (4)

1. **[Quiz/4× confirmed] C-001 — `{N}` template placeholder leakage in `factAnswer` and distractor pool, all numeric-answer pop culture facts.** Literal `"{125}"`, `"{1938}"`, `"{1.7}"`, `"{1984}"` strings ship as the canonical answer AND 3 of 4 quiz choices. Affected facts confirmed: `pc_0_mash_finale_viewers`, `pc_2_superman_debut_year`, `pc_2_spawn_sales_record`, `pc_3_instagram_facebook_acquisition`, plus the Transformers debut-year study question. Upstream bug lives in the deck-build template-substitution pipeline — source data has the number; build artifact has `"{N}"`. Hit rate across sampled facts ~33%, suggesting the entire `pc_*` numeric-answer subcategory is broken. Steam-review one-liner.  *[quiz-quality.md → C-001; fun-engagement.md → lowlight #2; study-temple.md → HIGH #1; full-run.md → C-001 confirmed]*

2. **[Quiz] C-002 — Cross-category distractor pollution on `inv_3_ic_kilby` (integrated circuit invention).** Question asks for a person; distractors are `"1977 Trinity"`, `"Lithium cobalt oxide (LiCoO₂)"`, `"Username from host machine name"`. Distractor-pool builder samples from a global string pool without type-filter — the card is winnable by elimination, which trivializes FSRS scheduling for every player who encounters it. *[quiz-quality.md → C-002]*

3. **[Full Run] BUG-FR-001 — `chargePlayCard` throws `(deck.currentEncounterSeenFacts ?? []) is not iterable`, softlocks combat.** Occurs on continued-run state after "Abandon & Start New" modal path. After the throw, subsequent quick-play kill blow sets enemy HP to 0 but game NEVER transitions to rewardRoom — stuck as `combat`, no end-turn button, no reward overlay, no recovery. Root cause likely: run-save serialization doesn't rehydrate `currentEncounterSeenFacts` as an array (exactly what `check-set-map-rehydration.mjs` lint was built to prevent — save-load agent should be pointed at it). *[full-run.md → BUG-FR-001]*

4. **[Full Run] BUG-SH-003 — Shop relic single-click has no observable effect at all** (no modal, no purchase, gold unchanged). Card clicks DO open a confirm modal; relics do not. Inconsistent interaction model — players clicking a relic get zero feedback and will assume the game is broken. *[full-run.md → BUG-SH-003]*

### HIGH (19)

**Data / Content quality:**
- [Quiz H-001] `factAnswer` field and `correctAnswer` from `previewCardQuiz` both string-equal `"{N}"` — bug is in the canonical answer, not just the distractor pool. Typed-input mode, FSRS reviews, registry, quiz audit all see the corrupted string.
- [Quiz H-002] `domain` field on every card is `"general_knowledge"` even though Trivia Dungeon loadout spans 11 domains. Field as-named is misleading (should be `runDomain`) OR dungeon is silently filtering to one bucket.
- [Quiz H-003 / Fun] `enemyStatusEffects[].turnsRemaining: 9998` on permanent Strength buff. Ticks 9998 → 9997 → 9996 visibly — sentinel-as-int instead of `Infinity`/`null`.
- [Study H-1] `StudyQuizOverlay.svelte` does not call `displayAnswer()` — leaks `{N}` bracket-notation markers into rendered answer buttons. Single-component fix: import `displayAnswer` and wrap every answer label. Affects 12 knowledge decks.

**Balance / Combat math:**
- [Balance H-1] `baseEffectValue: 8` in `getCombatState.hand[]` does not match in-game damage. Strike reports `8` but renders as "Deal 4 damage" and quick-plays for 4. Any tooling reading the API will be 2× off.
- [Balance H-2] Charge:Quick observed damage ratio is 2.25×, not the documented 1.5×. Either docs or math is wrong.
- [Fun H-1] "Piercing" card is mechanically identical to Strike against a blocking enemy (consumed 6 block, dealt 0 HP). The name `Piercing` screams "bypasses block" but the effect doesn't — dishonest card text.
- [Full Run H-1] Card description shows halved damage compared to the actual hit. Same class of bug as Balance H-1 — API/UI damage divergence.
- [Full Run H-2] `Transmute` card description has broken template text: `"forencounterCharge: choose 1/3"` — literal substring appearing in the player-visible card text.

**UX / feedback:**
- [Fun H-2] Chain multiplier has NO UI feedback in combat. Strike values bounce 4/7/14/11 with no visible reason. Biggest clarity issue found this batch — player cannot model their own damage output.
- [Fun H-3] Reward room silently accepts with no interaction — 3 cards visible on the altar, `getRewardChoices()` returns `[]`, pressing accept silently adds `reward_<id>` card to deck with no animation, no choice, no "picked X" confirmation.
- [Fun H-4] Enemy intent `displayDamage` changes mid-turn (15 → 17 → 22) without explanation.
- [Fun H-5] Hand index shuffles between plays in the same turn — misclicks cause wrong card to be played. Intended Strike, played Block. No UI warning.

**API docs drift (blocks every future tester):**
- [Study H-2] `__rrPlay.startStudy()` is broken — `src/dev/playtestAPI.ts:926` writes `rr:currentScreen = 'restStudy'` (should be `'restRoom'`), causing RestRoomOverlay to unmount BEFORE the subsequent `querySelector('[data-testid="rest-study"]')` runs. Every future LLM playtest following action-specs.md hits this. One-line fix.
- [Study H-3] `__rrScenario.spawn({screen:'restStudy'})` with no deckId destroys the run. Creates fresh L0 run but never enters combat → empty activeRunPool → `getStudyPoolSize` returns 0 → overlay mounts in empty-state. Documented tester entry path in `action-specs.md:206` is broken.
- [Full Run H-3] `getMysteryEventChoices` and `selectMysteryChoice` rrPlay helpers broken — return empty / not-found. DOM click works and does transition correctly; only the helper API is broken.
- [Full Run H-4] `getShopInventory` returns empty relic metadata.
- [Full Run H-5] Shop-buy helpers look for wrong testid.
- [Full Run H-6] `btn-leave-shop` DOM click does not transition screen.

### MEDIUM (20)

- [Quiz M-001] `pc_3_numa_numa_platform` lists `Disney+` as a distractor for a 2004 video; Disney+ launched 2019 (anachronism).
- [Quiz M-002] `previewCardQuiz` returns randomized choice order per call. Not a bug; tests must use sets not arrays.
- [Balance M-1] `getCombatState` returns null after killing blow but before scene transition.
- [Balance M-2] `getScreen` says `combat` while RewardRoom is the active Phaser scene.
- [Balance M-3] First `acceptReward()` after combat 2 spuriously fails with "RewardRoomScene not active after 3s wait" while the layout dump confirms it IS active (race).
- [Balance M-4] Low FPS 11-31 in CombatScene sustained over 600+ seconds (alert ring buffer). Likely SwiftShader.
- [Fun M-1] Intent text `"Applies 5 strip_block for 0 turns"` — `0` where duration is expected reads like a bug.
- [Fun M-2] Page Flutter re-spawns as combats 1 AND 2 — same enemy back to back destroys dungeon-exploration feel.
- [Fun M-3] Mastery level-ups are completely silent — no popup, no sparkle, no juice.
- [Fun M-4] Cold-start combat rendering: background renders, then 3-second delay before cards/UI paint. First impression lost.
- [Fun M-5] `action-specs.md` says `look()` returns full state; actual behavior returns empty on hub.
- [Study M-1] Test spec assumed Anki-style SM-2 grading UI; live Study Temple is a 3-question multiple-choice quiz with NO FSRS scheduling, no grade buttons, no card-reappearance mechanic. Profile is stale vs. implementation.
- [Study M-2] `getSessionSummary` returns diagnostic ring-buffer stats (eventCount, typeCounts, durationMs), NOT documented "accuracy, encounters, damage dealt".
- [Study M-3] 1200 ms auto-advance swallows the fact's `explanation` field between answer-click and next question — missed teaching moment (PX Lens flag).
- [Full Run M-1] `look()` pretty-print shows `?` for HP/floor/turn.
- [Full Run M-2] `look()` omits the Study option in restRoom response.
- [Full Run M-3] `getRunState` returns minimal subset vs. action-specs.md schema.
- [Full Run M-4] Shop button concat prices display as `"92g 46g"` (two values concatenated).
- [Full Run M-5] `startRun` succeeds while blocked by "Run In Progress" modal — false success message.
- [Full Run M-6] Gladiator's Mark relic shows `acquiredAtFloor: 2` when acquired on floor 1.

### LOW (13)

- [Quiz L-001] `chargePlayCard` returns `{ok: true}` even when AP is 0 in some edge cases.
- [Quiz L-002] Heavy US/Anglo-American cultural skew in captured general_knowledge slice (11/11 facts). Likely sampling artifact but worth a domain-of-origin audit.
- [Quiz L-003] `cs_5_google_founders` question is over-leading ("Stanford" + "PageRank" + "1998" + "two students" in the question text).
- [Balance L-1] `apCost: 1` field is misleading — quick costs 1, charge costs 2; should be `quickApCost`/`chargeApCost`.
- [Balance L-2] Charge correct damage variance (7-11) wider than flat ×1.5 predicts.
- [Fun L-1] Quiz integration feel 4/5 — the one bright spot.
- [Fun L-2..4] Various polish-tier findings (intent bubble shape, victory fanfare, reward animations).
- [Full Run L-1] HP inconsistency between `getRunState` and `getCombatState` after continue-run.
- [Full Run L-2] Enemy intent `displayDamage` grows without visible buff source.
- [Full Run L-3] `rrPlay` errors don't reach `__rrDebug().recentErrors`.

## Recommendations (Priority Ordered)

1. **Fix the `{N}` template placeholder leak immediately.** Highest-impact, highest-visibility bug. Trace the deck-build pipeline (content-pipeline or deck-master) and find where numeric values get wrapped in `{...}` without substitution. Start by grepping every `data/decks/*.json` for `"{\d+}"` or `"{.+?}"` as answer strings. Then verify `StudyQuizOverlay.svelte` calls `displayAnswer()` (single-component fix confirmed by study-temple.md). *Owner: content-agent for data scan, ui-agent for overlay fix.*
2. **Fix the continued-run save/load softlock (BUG-FR-001).** Point `check-set-map-rehydration.mjs` at `currentEncounterSeenFacts` — this is exactly the class of bug that lint was written to prevent. *Owner: game-logic (save-load).*
3. **Add chain multiplier UI feedback in combat.** The biggest clarity/fun issue. Without it, damage numbers appear random. Slay-the-Spire-style "Combo x3" badge with visible decay. *Owner: ui-agent.*
4. **Audit card descriptions against actual damage output.** Balance H-1/H-2, Fun H-1 all point at the same class: card text doesn't match what the player sees. Run the headless balance sim and diff `baseEffectValue` × play-mode vs observed damage. *Owner: game-logic.*
5. **Fix run-flow docs drift in `action-specs.md`.** The `selectDomain → selectArchetype → selectMapNode('r0-n0')` path is stale. Update to: `startRun → deckSelectionHub → triviaDungeon → onboarding → dungeonMap`. Add known-quirks: `'r0-n0'` only works once; use node enumeration for subsequent picks. *Owner: docs-agent.*
6. **Fix shop relic click to open confirm modal** (consistent with card click). BUG-SH-003. *Owner: ui-agent.*
7. **Replace `turnsRemaining: 9998` sentinel with `Infinity`/`null`/`-1`** and render `∞` in UI. *Owner: game-logic + ui-agent.*
8. **Fix `__rrPlay.startStudy()`** one-line in `src/dev/playtestAPI.ts:926` — write `'restRoom'` not `'restStudy'` so the DOM click finds the button. *Owner: game-logic.*
9. **Update Study Temple profile in `/llm-playtest`** to match current 3-question quiz UI, not the Anki SM-2 expectations. Either remove the SM-2 verification or reroute it to probe FSRS fields directly via `getStudyCard.interval/reps`. *Owner: docs-agent.*

## Known-behavior confirmations (NOT bugs)

- Fact repetition (~8-10 unique facts per 22 charges) is the `InRunFactTracker` spaced-rep algorithm working as designed. Confirmed by quiz-quality tester; not a bug.
- Quick play IS base damage, charge is the +50% bonus. Confirmed; charge:quick observed as 2.25× probably includes relic/mastery stacking.
- Card selection is inline in rewardRoom Phaser scene, no separate cardReward screen. Confirmed.

## Next Steps

- Run `/balance-sim` with `baseEffectValue` corrected vs observed to get statistical confirmation of the damage-drift issue.
- Run `/visual-inspect` on the reward-room Phaser scene to verify the card-selection altar is actually interactable vs the fun/engagement lowlight.
- Run `scripts/check-set-map-rehydration.mjs` manually to see if `currentEncounterSeenFacts` triggers.
- Grep `data/decks/*.json` for `"{\d+}"` answer patterns to quantify the template-leak blast radius.
- Re-run this batch after fixes with `/llm-playtest fullrun floors=3` to confirm the softlock is closed and floor 2/3 progression still works.
