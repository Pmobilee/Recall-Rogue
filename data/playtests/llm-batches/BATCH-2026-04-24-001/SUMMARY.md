# Playtest Batch Summary — BATCH-2026-04-24-001
**Date**: 2026-04-24 | **Testers**: 1 (full-run) | **Mode**: general_knowledge Trivia Dungeon | **Floors target**: 2

## Overall Verdict: ISSUES

1 full run played, partial Floor 1 coverage plus contaminated Floor 2 navigation. 7 bugs reported by tester; after ground-truth verification against source code, **2 are real player-facing bugs**, **1 is an API/docs gap**, **4 are tester misuse (confirmation dialogs the agent didn't click through, or API called at the wrong lifecycle phase)**.

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Full Run | ISSUES | 0 | 2 | 1 | 0 |

## Verified Issues — Normal Playthrough

### HIGH

#### NPT-001 [HIGH] — Mystery event quiz displays unresolved `{N}` bracket tokens
- **Where**: Any mystery event whose quiz fact has a `{N}`-format `correctAnswer` (e.g., `{2018}`, `{600}`).
- **Player impact**: Answer buttons render literal `{2018}`, `About {600}` instead of `2018`, `About 600`.
- **Root cause**: `src/ui/components/EventQuiz.svelte` builds choices from `fact.correctAnswer` + `fact.distractors` directly (lines 61-112) without calling `displayAnswer()` from `numericalDistractorService`. Combat path uses `displayAnswer` correctly in `quizService.ts:189-235`; mystery path is missing the strip.
- **Fix sketch**: Import `displayAnswer` in `EventQuiz.svelte` and wrap every string in the rendered `choices` array.
- **Evidence**: Sub-agent layout dump of pomegranate mystery quiz showed four buttons: `{2018}`, `About {600}`, `Second fermentation in bottle`, `Veal`.

#### NPT-002 [HIGH] — Map node marked visited before combat start resolves; failed combat strands the player
- **Where**: Any combat / elite / boss map-node click whose `startEncounterForRoom` throws or returns false.
- **Player impact**: Node consumed as if the encounter happened (row advances, next row unlocks), but the actual encounter never ran — free XP / free rewards lost / potential exploit if it becomes reproducible via a known trigger.
- **Root cause**: `src/CardApp.svelte:1305` calls `onMapNodeSelected(nodeId)` BEFORE awaiting `startEncounterForRoom` at line 1314. On thrown error (caught 1320-1324) the screen reverts to `dungeonMap` but the map mutation has already landed.
- **Fix sketch**: Move `onMapNodeSelected(nodeId)` to AFTER a successful `startEncounterForRoom`, or implement a rollback when combat start fails.
- **Triggering evidence**: Phaser `Text2.updateText → Frame2.updateUVs → null drawImage` thrown from `CombatScene.setEnemy` during the second combat of the session. The Phaser crash itself may be SwiftShader-specific (1 FPS throughout, Docker/CI environment), but the **architectural consequence — advancing the map despite combat failure — is environment-independent and will hit any real player whose combat start fails for any reason (async race, network, scene lifecycle)**.

### MEDIUM

#### NPT-003 [MEDIUM] — Mystery event quiz distractor pool crosses unrelated domains
- **Where**: Mystery events that build distractors via `EventQuiz.svelte` lines 101-109 fallback path.
- **Example observed**: Pomegranate-seed-count question (numeric answer) shipped with distractors "Second fermentation in bottle" (wine process) and "Veal" (food) — neither is a plausible numeric distractor.
- **Root cause**: When `fact.distractors` has <2 entries, EventQuiz falls back to `allFacts.map(f => f.correctAnswer)` shuffled. No domain / answer-type filtering is applied.
- **Fix sketch**: Require every mystery fact to ship ≥3 domain-appropriate distractors, OR filter the fallback pool by answer-type pool membership.
- **Player impact**: Trivially eliminable wrong answers; educational value diluted.

## False-Positive Reports (verified NOT bugs — logged for transparency)

These were reported by the tester but do NOT represent real player-facing defects after source-code verification. Not added to the leaderboard.

| Tester Report | Reason it's not a bug |
|---|---|
| `restMeditate` Remove Card click has no effect | `MeditateOverlay.svelte:30-33` opens a confirmation dialog (`showConfirm = true`). The tester never clicked `.confirm-remove-btn` to complete the two-step flow. |
| `btn-leave-shop` click doesn't transition | `ShopRoomOverlay.svelte:249` uses an inline leave-confirmation (`showLeaveConfirm`). Same two-step pattern as meditate. |
| `mysteryContinue()` returns `{ok:false}` | The helper was called during the pre-quiz "Begin Quiz" phase, when the `[data-testid="mystery-continue"]` button doesn't exist yet. `src/dev/playtestAPI.ts:896-909` selector is correct. |
| `getQuiz()` returns null during mystery quiz | Mystery event quizzes don't write to the `rr:activeQuiz` store; they have their own local component state. `getQuiz()` is scoped to combat quizzes only. API/doc gap, not a game bug. |
| `acceptReward()` returns `{ok:false}` when called before rewardRoom mounts | Graceful error message, correct behavior — the tester called it in the same batch as the final killing blow before the screen had a chance to transition. |

## Cross-Tester Insights
Single-tester batch; no convergence signal available.

## Recommendations (in priority order)

1. **Fix NPT-001** — one-line patch in `EventQuiz.svelte`: wrap `choices` strings through `displayAnswer` before rendering. Low-risk, high-value.
2. **Fix NPT-002** — reorder `onMapNodeSelected` to happen only after a successful encounter launch, or implement rollback. Medium-risk (touches run-state), but leaving it means any future combat-start regression silently steals map progress.
3. **Address NPT-003** — either enforce distractor shipping for mystery facts or filter the fallback pool. Content-quality bucket.
4. **Document the false positives** in the rrPlay API docs so future testers don't re-file them — confirmation dialogs for meditate/shop, mystery quiz not visible in `getQuiz()`, `mysteryContinue()` phase-dependence.

## Next Steps
- `/visual-inspect mysteryEvent` to confirm NPT-001 visually on real hardware.
- Spawn focused fix agent on `EventQuiz.svelte` + `CardApp.svelte:1305`.
- Next batch: run `/llm-playtest quiz` to deep-dive content quality now that the tester run shows mystery quiz pool contamination.

## Artifacts
- Full tester report: `full-run.md`
- Docker traces: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-04-24-001_*` (not committed)
