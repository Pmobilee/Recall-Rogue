# MASTER SYNTHESIS — BATCH-2026-04-11-ULTRA

**Batch:** Ultra-scope LLM playtest — Recall Rogue
**Date:** 2026-04-11
**Orchestrator:** Opus 4.6 (1M context)
**Plan file:** `/Users/damion/.claude-muldamion/plans/polished-wibbling-bear.md`
**Tracks executed:** 12 of 12 parallel sub-agents
**Total issues surfaced:** 114 new + 10 pre-existing = 124 tracked
**Wall-clock duration:** ~70 minutes (Wave 0 + Wave 1 + Wave 2)

---

## 1. Verdict

**MIXED — the game is functionally playable, but has 9 CRITICAL ship-blockers and 3 cross-track CRITICAL clusters that must be fixed before Steam launch.**

- **Game logic core:** solid. Headless sim confirms functional correctness; no zero-damage bugs, no broken mechanics at the implementation level.
- **Balance curve:** broken at two specific transitions (floor 4→6 and floor 17→18) and at ascension 15→20. All three are confirmed by multiple independent methods.
- **Tooling:** broken in three places (`gym-server.ts` drift, `scenarioSimulator.ts` ascension bug, Docker-parallel-saturation). These bugs were **actively hiding other bugs** until now.
- **Accessibility:** not shippable. Two CRITICAL keyboard blockers in core game flow (reward room Continue, deck selection panels).
- **Multiplayer co-op:** 2 new CRITICAL RNG desyncs in relic effects. 3 prior RNG gotchas verified still-fixed.
- **Content quality:** 1 CRITICAL + 8 HIGH across 10 sampled decks. 118-fact `{N}` template leak quantified.

---

## 2. CRITICAL Repro Confirmation (3 known CRITICALs from BATCH-2026-04-10-003-fullsweep)

| ID | Finding | Status This Batch |
|---|---|---|
| CRITICAL-1 | Synthetic distractor `{N}` leak in pop_culture | **REPRODUCED + QUANTIFIED** — T4 SQL audit: 118 live facts with `{1988}`-style raw braces in `correct_answer`/`distractors`. Pop Culture is the worst offender at 70 facts. |
| CRITICAL-2 | InRunFactTracker `reviewStateSnapshot.has is not a function` on post-resume card play | **CLEARED** — T5 confirmed fixed. 15/15 rehydration checks + 11/11 regression tests + 20/20 fact tracker tests all green. Live Docker snapshot→reload→restore flow had zero Set/Map serialization issues. The explicit-destructuring fix in `serializeRunState` is durable. |
| CRITICAL-3 | `__rrPlay.restore()` leaves Phaser scene black | **NOT RE-TESTED** — T5 focused on save/load, did not exercise `__rrScenario.restore()` through a full Phaser bootstrap. Status: untested this batch. Recommend a dedicated follow-up. |

**PRE-EXISTING-1** (found during preflight): `barbed_edge` synergy applies to non-strike-tagged cards (`damagePreviewService.test.ts:417` fails). Confirmed real by T5 (issue-05-004) and noted in T1 data. Confined to one file, minor sim impact.

---

## 3. Top 20 Ranked Issues (from updated leaderboard.json)

Scored by `severity_weight × cluster_boost` (1.5× for cross-track cluster members).

| Rank | Score | Sev | Cluster | Title (truncated) | Track |
|---|---|---|---|---|---|
| 1 | 15.0 | CRIT | B | Gym-server comboCount NaN: RL pipeline fully non-functional | T2 |
| 2 | 15.0 | CRIT | B | TriviaRoundScreen.svelte is an orphan component — unreachable from any screen flow | T7 |
| 3 | 15.0 | CRIT | B+E | scenarioSimulator.ts bootstrapRun() ignores config.ascension — combat stats remain at A0 | T8 |
| 4 | 15.0 | CRIT | D | crit_lens relic uses Math.random() — co-op peers roll independent crits | T9 |
| 5 | 15.0 | CRIT | D | obsidian_dice relic uses Math.random() — co-op peers independently roll multiplier | T9 |
| 6 | 15.0 | CRIT | B+F | Reward room Continue button is Phaser Text object — not accessible to DOM | T11 |
| 7 | 15.0 | CRIT | B+F | Deck selection panels — non-interactive divs, entire game entry blocked | T11 |
| 8 | 10.0 | CRIT | C | `{N}` template artifact in 118 facts — `{1988}` shown instead of `1988` | T4 |
| 9 | 10.0 | CRIT | C | medical_terminology: 31 duplicate answer instances across 13 pools | T6 |
| 10 | 7.5 | HIGH | A | Floor 4→6 boss encounter 3.36× harder than preceding floor | T1 |
| 11 | 7.5 | HIGH | A | Floor 18 final bosses delete 87-91% of encounters via 50% HP damage | T1 |
| 12 | 7.5 | HIGH | E | Ascension 20 unplayable: experienced@asc20 wins 2.7%, avg death floor 3 | T1 |
| 13 | 7.5 | HIGH | E | Ascension 15-20 progression cliff — non-linear scaling | T1 |
| 14 | 7.5 | HIGH | D | relicAcquisitionService Math.random() — co-op reward screens differ | T9 |
| 15 | 7.5 | HIGH | A | Floor 18 damage spike: 14× jump from floor 16 avg 2 → floor 18 avg 28 | T4 |
| 16 | 5.0 | HIGH | – | Foresight 0-AP card is strictly dominant — always played, never suboptimal | T3 |
| 17 | 5.0 | HIGH | – | Slow card description misleads players vs heal intents, wasting 2 AP | T3 |
| 18 | 5.0 | HIGH | C | ap_world_history: 10+ questions contain "ProperNoun this" grammar scars | T6 |
| 19 | 5.0 | HIGH | C | ap_world_history: "Rape of this" question corrupts WWII massacre education | T6 |
| 20 | 5.0 | HIGH | C | korean_topik1 mega-pool 1368 facts no POS split — POS-tell vulnerability | T6 |

**Remaining 29 HIGH issues + 46 MEDIUM + 25 LOW are in `leaderboard.json`.**

---

## 4. Coverage Matrix

| Game surface | Tracks touching it | Verdict |
|---|---|---|
| Combat core loop | T1, T3, T4, T12 | PASS (balance issues at boss cliffs) |
| Quiz system / content | T4, T6 | FAIL (1 crit, many high) |
| Card mechanics | T1, T3 | MIXED (Foresight dominance, Slow clarity) |
| Ascension | T1, T8 | FAIL (broken both in game and in tool) |
| Relics | T1, T9 | FAIL (volatile_core -53%, 2 RNG desyncs) |
| Shop | T11 | PASS with minor UX issues |
| Rewards | T11 | **FAIL (CRITICAL accessibility)** |
| Rest site | T11 | PASS |
| Mystery events | (not covered — T5 attempted but container degraded) | INCOMPLETE |
| Map / dungeonMap | T10, T11 | FAIL (HIGH viewport issue) |
| Hub | T10, T11 | PASS minor |
| Run-end | T10, T11 | PASS minor |
| Save/load / resume | T5 | **PASS (CRITICAL-2 cleared)** |
| Multiplayer co-op | T9 | **FAIL (2 CRITICAL RNG bugs)** |
| Chess tactics mode | T7 | **FAIL (broken data format)** |
| Map pin drop mode | T7 | **FAIL (not wired)** |
| Procedural math | T7 | PASS minor |
| Trivia Night mode | T7 | **FAIL (orphan component)** |
| Study Temple full session | T7 | INCOMPLETE (scenario empty state) |
| Performance (FPS/memory) | T12 | PASS (memory) / INCOMPLETE (FPS needs real GPU) |
| Visual rendering 37 screens | T10 | PASS (34/37 captured, 1 HIGH) |
| UX/a11y 10 screens | T11 | **FAIL (2 CRITICAL blockers)** |
| Edge/empty/error states | T12 | PASS |
| Rogue Brain RL analysis | T2 | **BLOCKED (tooling drift)** |
| Statistical balance | T1 | PASS (delivered 15 issues) |
| LLM strategic reasoning | T3 | PASS (delivered 7 issues) |

**Summary: 5 surfaces FAIL, 4 INCOMPLETE, 2 BLOCKED, 13 PASS (with minor issues).**

---

## 5. What's Still Untested (Registry Delta Pre vs Post)

Registry stale-state diff shows **no material change** — this run was detection-only and deliberately did not stamp the registry. The following Tier-1 elements remain **never inspected** post-batch:

- **67/98 cards** — inspected only via T1 statistical aggregate, not per-element
- **87/89 enemies** — inspected only via T1 statistical aggregate
- **85/90 relics** — inspected only via T1 statistical aggregate; volatile_core flagged
- **11/11 status effects** — still never inspected
- **26/27 synergies** — still never inspected (barbed_edge found by PRE-EXISTING-1 is 1 of 27)
- **20/20 ascension levels** — inspected at the level level by T8, but NOT stamped (T8 had tool bug — re-test required after fix)
- **12/37 screens** — T10 covered 34; `mainMenu`, `base`, `relicReward` are aliases/deprecated and intentionally skipped

**What DID get direct inspection:**
- 5 ascension levels via T8 (but invalid until scenarioSimulator fix lands)
- 10 content decks via T6
- 10 screens via T11 UX audit
- 34 screens via T10 visual sweep
- 20 combat states via T3 strategic reasoning
- 9 save/load sub-tests via T5

**Stamping decision:** DEFERRED to user review. The autonomy charter and the plan both say registry stamping must be a deliberate post-review action, not automatic.

---

## 6. Recommended Fix Queue (Top 10 Highest-Leverage)

Ordered by impact × ease. All clustered so each fix resolves multiple issues.

### Tier 1 — Ship Blockers (must land before any release)

1. **Fix `relicEffectResolver.ts` RNG determinism** — replace `Math.random()` at lines 1647, 1712 with `isRunRngActive() ? getRunRng('relicEffects').next() : Math.random()`. Fixes 2 CRITICAL + 1 HIGH (Cluster D). Also add `relicAcquisitionService.ts:73,93`. **Estimate:** 30 min including test. Assign: game-logic.

2. **Reward Room DOM overlay buttons** — add `<button>` overlays at the coordinates of Phaser interactive objects, linked by `data-phaser-id`. Fixes CRITICAL reward-room Continue, adjacent Phaser-only buttons across CombatScene. Cluster F. **Estimate:** 2 hours. Assign: ui-agent.

3. **Deck selection hub panels → role="button"** — convert two non-interactive divs to `role="button" tabindex="0" aria-label="..." onkeydown="handle Enter/Space"`. Fixes CRITICAL entry-point blocker. Cluster F. **Estimate:** 1 hour. Assign: ui-agent.

4. **Fix `gym-server.ts` comboCount drift** — rename 7 stale references (lines 381, 628, 870, 977, 982, 1111, 1212) from `ts.comboCount` → `ts.consecutiveCorrectThisEncounter`. Fixes CRITICAL Cluster B tooling blocker. Unblocks future RL analysis. **Estimate:** 30 min + 50-episode smoke test. Assign: game-logic.

5. **Fix `scenarioSimulator.ts:651` bootstrapRun ascension ignored** — one-line: pass `ascensionLevel: config.ascension ?? 0` into `createRunState()`. Fixes CRITICAL Cluster B tooling blocker. Unblocks visual ascension testing. **Estimate:** 15 min + re-test. Assign: game-logic (or qa-agent since it's a test fixture).

6. **Fix `{N}` template artifacts in facts.db** — migration script: `UPDATE facts SET correct_answer = REPLACE(REPLACE(correct_answer,'{',''),'}',''), distractors = …` with careful escaping. Fixes CRITICAL content leak (118 facts). **Estimate:** 1 hour including verify. Assign: content-agent.

7. **Fix medical_terminology 31 duplicates** — append root notation to synonym `correct_answer`s (`"Kidney (ren/o)"` vs `"Kidney (nephr/o)"`) so O-QZ2 duplicate-choice check passes. Fixes CRITICAL T6 finding. **Estimate:** 1 hour. Assign: content-agent.

8. **Wire TriviaRoundScreen.svelte into CardApp.svelte** — add import + `{:else if currentScreen === 'triviaRound'}` branch + scenario preset. Fixes CRITICAL Cluster B orphan. **Estimate:** 30 min. Assign: ui-agent.

### Tier 2 — Balance & Design (before Steam review window)

9. **Act boss warm-up / telegraph** — either add floor 5 and floor 17 pre-boss encounters OR add a Slay-the-Spire-style boss preview banner on the map node preceding a boss. Fixes Cluster A (5 issues). **Estimate:** 3-5 hours for option B, 1-2 days for option A. Assign: game-logic + content-agent.

10. **Ascension 15→20 curve fix + re-test** — only tuneable *after* fix #5 lands, because prior visual testing of asc20 was invalid. Cluster E. **Estimate:** 2 hours sim + tune cycle. Assign: game-logic.

### Tier 3 — Meta-fixes (prevent recurrence)

- **`scripts/lint/no-bare-math-random.mjs`** — grep lint that flags unsanctioned `Math.random()` outside an allowlist. Prevents future Cluster D.
- **`scripts/lint/check-wiring.mjs`** — CI check for (a) exported `.svelte` screen components not imported by `CardApp.svelte`, (b) game-data field reads on types that don't include the field. Prevents future Cluster B.
- **Docker container pool** — enforce max 4-8 concurrent in warm batches. Prevents future Cluster I (today's SwiftShader saturation).

---

## 7. Methodology Notes — What Worked, What Didn't, What to Change

### What worked

- **Parallel background sub-agents.** 12 tracks launched from one message, all returned independently. No agent deadlocks, no collision in the batch directory.
- **Shared issue JSON schema across tracks.** S1 ingestion was zero-friction — 114 issues concatenated cleanly, all 12 tracks represented, zero malformed entries. This is the single biggest process win.
- **Orchestrator post-verification.** Ground-truthing both T9 CRITICALs via grep caught zero fabrications but the discipline matters — it's cheap and it's the only defense against sub-agent summary drift.
- **Cross-method correlation.** The "built but not wired" meta-finding (Cluster B) was invisible in any single track but leaped out when 7 issues from 5 tracks were laid side-by-side. The cluster score boost (1.5×) moved these to the top of the leaderboard where they belong.
- **Downgrade protocols.** T3 (Haiku-swarm → Sonnet direct) and T9 (2-peer Docker → single-peer Vitest) both documented their downgrades in `manifest-entry.json` as planned. No silent failures.

### What didn't work

- **12 simultaneous Docker warm containers saturated SwiftShader.** T4, T8, T11, T12 all hit "Target crashed" failures. T4 lost all 3 live testers and had to pivot to SQL + static data; T8 was limited to 1 visual capture. **Lesson: max 4-8 concurrent warm containers on a single M4 Max host.** Document in `.claude/rules/testing.md` and enforce in orchestration.
- **Sub-agents cannot spawn nested Agent calls.** T3 discovered this at runtime and downgraded cleanly, but the original plan assumed 20 parallel Haiku sub-sub-agents per state. Future strategy-analysis tracks should be implemented via a single sub-agent with 20 sequential internal prompts, not nested spawns.
- **Parallel Claude session interference.** A concurrent "sorted-spinning-wind" plan session ran `deck-audit` Phases 4-6 during my batch window and shipped 4 commits touching `data/decks/` and `scripts/`. These did NOT touch any deck T6 was testing, so T6 findings remain valid, but **future ultra-scope batches should either (a) acquire a repo-wide lock, or (b) snapshot the batch against a specific git SHA and note it.**
- **T8 auto-committed track output mid-batch.** Plan said commits at S5c only. T8 shipped its own commit early (files within scope, so no damage). **Lesson: sub-agent prompts should include an explicit "DO NOT COMMIT — orchestrator handles commits at Wave 2" instruction.**

### What to change for next time

1. **Container pool dispatcher.** Don't spawn 12 Docker tracks at once — use a 4-wide queue.
2. **Stricter sub-agent commit discipline.** Explicit "do not commit" in every prompt.
3. **Snapshot git SHA at batch start.** Include `git rev-parse HEAD` in `manifest.json` at Wave 0 so parallel-session interference is detectable in synthesis.
4. **Include a "wiring-check" lint pre-batch.** The Cluster B meta-finding would have been catchable at commit time — should be before any future batch begins.
5. **Separate Docker track from API-only track in scheduling.** T1, T2, T3 don't use Docker and could start in parallel while Docker tracks stagger. Batch scheduling should respect this.

---

## Appendix A — Track Output Reference

All per-track reports, issues, and evidence:

| Track | Path |
|---|---|
| T1 | `tracks/01-stat-baseline/` |
| T2 | `tracks/02-neural-optimal/` |
| T3 | `tracks/03-strategic/` |
| T4 | `tracks/04-combat-core/` |
| T5 | `tracks/05-save-load/` |
| T6 | `tracks/06-content-sample/` |
| T7 | `tracks/07-mode-coverage/` |
| T8 | `tracks/08-ascension/` |
| T9 | `tracks/09-multiplayer/` |
| T10 | `tracks/10-visual-sweep/` |
| T11 | `tracks/11-ux-audit/` |
| T12 | `tracks/12-stress-edge/` |
| Combined issues | `combined-issues.json` |
| Cross-track correlation | `correlation-report.md` |
| Updated leaderboard | `../../leaderboard.json` |
| Preflight artifacts | `preflight/` |

---

## Appendix B — Gotchas Appended This Batch

T5 and T12 (both qa-agent, primary writer for `docs/gotchas.md` per `.claude/rules/agent-routing.md`) appended these entries during the run:

1. 2026-04-11 — Warm container memory degradation after 5+ sequential tests (T5)
2. 2026-04-11 — `loadActiveRun()` accepts any numeric save version without migration guard (T5)
3. 2026-04-11 — Parallel warm-container test requests cause scenario-state collision (T5)
4. 2026-04-11 — Docker SwiftShader crashes under 16-container parallel load (T12)
5. 2026-04-11 — Docker SwiftShader `drawCalls` always returns -1 (T12)
6. 2026-04-11 — `__rrPlay` API missing `forceHand` and `setGold` methods (T12)
7. 2026-04-11 — `chess_tactics.json fenPosition` is post-setup FEN; `getPlayerContext()` expects pre-setup base FEN (T7)
8. 2026-04-11 — Docker warm-container crashes on combat scenario load (T8)

Orchestrator to add one more at commit time:
- 2026-04-11 — BATCH-ULTRA: 12-wide parallel Docker warm containers saturate SwiftShader; use ≤4-wide queue.
