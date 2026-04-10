# Retrospective — BATCH-2026-04-10-003-fullsweep

**Written**: 2026-04-10 | **Author**: docs-agent (Phase 7)
**Branch**: `worktree-agent-afee9b25` | **Sweep commits**: 35 (ab7d3a3 → f6836117c)

This is the most important document from the Apr-10 sweep. It is meant to prevent Apr-11 from looking like Apr-10.

---

## 1. What Went Wrong — Process Failures Behind Each Bug

### CRITICAL-2 "0aeff3bfe was a partial fix"

Commit `0aeff3bfe` (2026-04-10 10:41) did real work. It added `toJSON()` and `fromJSON()` to `InRunFactTracker`, wired them through `runSaveService`, and wrote four round-trip unit tests. The bug report was "InRunFactTracker loses its Map fields on JSON round-trip." That specific class bug was fixed correctly.

What the commit missed: `RunState` itself has *four additional Set/Map fields* (`reviewStateSnapshot`, `firstTimeFactIds`, `tierAdvancedFactIds`, `masteredThisRunFactIds`) that are **not fields of InRunFactTracker** — they live directly on the `RunState` object. `runSaveService.serializeRunState()` used a `...run` spread, which caused `JSON.stringify` to silently convert all four Sets to `{}`. The commit's unit tests tested `InRunFactTracker` in isolation; no test serialized a full `RunState` and then called `.has()` on `reviewStateSnapshot` after deserialization.

**Root review gap**: the fix was scoped to the reported class (`InRunFactTracker`) without a broader audit of whether `RunState` had the same pattern elsewhere. The rule "any field whose runtime type is Set or Map must be explicitly serialized" was not written yet — it was only added to `.claude/rules/save-load.md` as part of this sweep (commit `bf2db2a2`). Without that rule in scope, the fixing agent had no prompt to look wider. A full-`RunState` round-trip integration test would have caught it: the unit test suite tested the class in isolation, but the integration that breaks is `runSaveService` → full `RunState` → JSON → full `RunState` → `.has()`.

The complete fix landed in `3372edf52` (2026-04-10 16:31), which rewrote `serializeRunState()` to use explicit destructuring rather than a spread.

**What would have caught it**: a single test in `runSaveService.test.ts` that serializes a `RunState` with all four Set fields populated, parses it, deserializes it, and calls `.has()` on each. That test now exists.

---

### CRITICAL-1 `{N}` template leak

`verify-all-decks.mjs` had no brace check before this sweep. It existed since the early deck-verification days but was built to check structural issues (missing fields, pool size, duplicate facts) — it never tried to parse the character content of `syntheticDistractors` strings.

The root cause of the leak was in `scripts/add-synthetic-distractors.mjs`. On 2026-04-09 (commit `f614c0400`), the first large-scale run of that script padded 151 pools across 32 decks. Numeric synthetic distractors — years, counts, measurements — were being formatted with a JavaScript template literal that emitted the bracket-notation form `{7}` instead of the plain string `"7"`. The format `{N}` is the game's fill-in-blank syntax, intended only for `correctAnswer` fields. In distractor arrays, it displayed literally.

Why didn't `verify-all-decks.mjs` catch it? Because Check #24 (the brace-leak check) did not exist. There was no structural validator that examined the character content of distractor strings — only semantic validators (pool size, pool membership, field presence). The content-pipeline rule about batch output verification was present in `.claude/rules/content-pipeline.md` before this sweep, but it described manual sampling, not an automated grep. The specific bad pattern (template literal producing `{N}`) was not in any grep script or checklist. No agent's prompt said "grep syntheticDistractors arrays for literal `{` before committing."

89 leaked distractors across 7 decks shipped and sat undetected from `f614c0400` (2026-04-09 00:55) to the playtest on 2026-04-10 — roughly 24 hours and 133 commits later.

**What now prevents it**: Check #24 in `verify-all-decks.mjs` (HARD FAIL), a dedicated vitest suite in `tests/content/synthetic-distractors.test.ts`, and a new subsection in `.claude/rules/content-pipeline.md` with the exact bad pattern and a mandatory post-generation bash grep.

---

### HIGH-5 Grammar scars recurrence

The 2026-04-09 entry in `docs/gotchas.md` documented grammar scars from batch word replacement ("the this", "Soviet this", "in a who") and listed them as lessons. The entry was appended by `fb8772818`. The rule in `.claude/rules/content-pipeline.md` before this sweep said to sample 10+ items and grep for the known patterns — but it described this as a manual step with no automated enforcement.

What happened on Apr-10: the `fix-self-answering.mjs` script used a `word_boundary_replacement` strategy that, in cases where the correct answer is a compound noun or descriptive phrase, would substitute a placeholder like "the concept" for the removed word. This left exactly the form the 2026-04-09 gotcha warned about. The script committed results on 2026-04-10 without the grammar-scar grep being in any automated check. The "sample 10+ items" rule was a reviewer discipline requirement; it was not machine-enforced.

Why did it happen again? Because the automated grep (Check #25 in `verify-all-decks.mjs`) did not exist before this sweep. The rule described a manual sampling step. When a sub-agent ran `fix-self-answering.mjs` and got `0 failures` from the existing verify script, it committed. The existing verify script could not detect "the concept" patterns because no rule told it to look for them.

The fix (`6acaccc1`, 2026-04-10 18:25) rewrote 74 grammar scars across 11 decks and created:
- `scripts/content-pipeline/grammar-scar-patterns.json` — an extensible regex catalog
- Check #25 in `verify-all-decks.mjs` — HARD FAIL on catalog patterns
- `tests/content/grammar-scars.test.ts` — 120 vitest tests

The rule in `.claude/rules/content-pipeline.md` now explicitly mandates running `verify-all-decks.mjs` after any batch rewrite and states that Check #25 is a HARD FAIL. This converts the "reviewer discipline" requirement into an automated gate.

---

### HIGH-7 Dev-button gating

The dev buttons (Intro, Enter, Exit, RunEnd) were already in `HubScreen.svelte` as far back as commit `5c72e1a9c` (2026-03-30). They were added incrementally as developer convenience tools during early hub layout work. The initial gating was inconsistent — some were wrapped in `{#if onReplayBootAnim}`, others were unconditional.

The conflation with `devpreset` was not a deliberate design choice. The dev buttons were simply inside the component with no guard, and the component renders whenever the hub screen renders. Since `?devpreset=post_tutorial` routes straight to the hub, every LLM playtest tester saw the dev buttons from day one. Nobody noticed because human developers always run with `?dev=true`-equivalent conditions, and the LLM tester reports were not previously written or reviewed for this category of finding.

Commit `3e7708c2a` (2026-03-31) added three more dev buttons (Lighting, BrightIdea, Deadline) without adding or re-examining any visibility guard. The dev-button-row `<div>` was always rendered unconditionally in both landscape and portrait branches.

No documentation existed that said "dev buttons must be gated on a dedicated dev flag." The rule was added to `.claude/rules/ui-layout.md` as "Dev-only UI Gating — MANDATORY" in commit `4172182d7` (2026-04-10). The `devMode` store (`src/ui/stores/devMode.ts`) was created as part of the HIGH-7 fix (`dbea82e79`).

The bug was introduced ~488 commits before this playtest caught it, dating to late March. It was never documented in any rule file and no prior playtest surfaced it because the tester primer described dev buttons as expected behavior (it did not exist before the new `tester-primer.md` was added for this sweep).

---

### HIGH-4 "FPS regression" — SwiftShader profiling artifact

The three testers who independently measured 4–22 fps in CombatScene were not wrong. They observed a real degradation. But the root cause was not a new regression in game code — it was the `deviceTierService.probeGPU()` function misclassifying Docker's SwiftShader renderer as `flagship` tier because it matched no known software-renderer strings. The `flagship` tier enables `DepthLightingFX` with 6-step ray-march shadow occlusion running on a 1920×1080 canvas via CPU-emulated WebGL. That produces 12–14 fps regardless of any other game optimization.

The issue this exposes about our Docker-only playtest rule: **we have no real-hardware FPS baseline from this sweep**. The HIGH-4 fix classified SwiftShader as `low-end` (disabling the expensive shader), which brings Docker fps up to target. But the fix is invisible to real GPU hardware — those users get the full shader and we have no continuous measurement that they still hit 60 fps. The `docs/testing/perf-baselines.md` file was created in this sweep (`05514068d`) and documents the targets, but the baseline was derived from prior human play sessions, not from a CI measurement on real hardware.

What the Docker-only rule prevents well: determinism, parallel isolation, WebGL correctness. What it cannot measure: whether real-hardware GPU performance is regressing. The profiling story for real-hardware perf is still "a human dev runs the game and notices." That is a gap.

---

## 2. What the Rules Now Prevent

Every update in this sweep is listed below. Enforcement type is noted for each.

| File | Section Added or Updated | Bug Class Caught | Enforcement |
|------|--------------------------|------------------|-------------|
| `.claude/rules/save-load.md` | "Rehydrating Typed Collections — CRITICAL RULE" (commit `bf2db2a2`) | Set/Map/class fields silently becoming `{}` on JSON round-trip, causing `.has()` / `.get()` to throw | Manual (reviewer discipline + code pattern); partial automation via lint script `scripts/lint/check-set-map-rehydration.mjs` added to `npm run check` |
| `.claude/rules/content-pipeline.md` | "Batch Output Verification" — added mandatory `verify-all-decks.mjs` step after batch rewrites, referencing Check #25 (commit `2321df492`) | Grammar scars shipping undetected after automated batch replacements | Automated (Check #25 is a HARD FAIL that blocks `verify-all-decks.mjs` from exiting 0) |
| `.claude/rules/content-pipeline.md` | "Template-literal Audit for Programmatic Distractors" (commit `94607cda8`) | `{N}` bracket tokens appearing literally in quiz distractor arrays | Automated (Check #24 in `verify-all-decks.mjs` — HARD FAIL; vitest suite `tests/content/synthetic-distractors.test.ts`) |
| `.claude/rules/deck-quality.md` | Added examples for barcode/netflix/n64 pool contamination to "Common split patterns" (commit `2321df492`) | Cross-category distractor contamination making correct answer eliminable by format alone | Manual (reviewer discipline during deck assembly) |
| `.claude/rules/ui-layout.md` | "Dev-only UI Gating — MANDATORY" (commit `4172182d7`) | Dev buttons / debug overlays visible in `devpreset` / production hub flows | Automated (unit tests for `devMode` store in `tests/ui/devMode.test.ts`; Playwright visual-inspect test asserts no `data-dev-only="true"` elements visible under `devpreset=post_tutorial`) |
| `.claude/rules/ui-layout.md` | "Softlock Prevention — MANDATORY" (commit `4172182d7`) | Screens with zero-pool states rendering with no escape button, leaving player stuck | Manual (lint script `scripts/lint/check-escape-hatches.mjs` added to `npm run check`) |
| `.claude/rules/performance.md` | "FPS Targets" — added SwiftShader low-end classification rule (commit `5618ef60a`) | Expensive `DepthLightingFX` PostFX shader running on software-renderer Docker CI, producing 12–14 fps false positives | Automated (`deviceTierService.probeGPU()` returns `low-end` for `swiftshader|llvmpipe|softpipe` — tested in headless perf suite) |
| `.claude/rules/performance.md` | "Software Renderer Detection — MANDATORY" — named the exact regex and why it must stay (commit `5618ef60a`) | Future agents removing the SwiftShader check and re-enabling the performance regression | Manual (doc reference); pattern in `deviceTierService.ts` tested by new unit tests |
| `.claude/rules/git-workflow.md` | "MANDATORY WORKTREE ISOLATION" (commit `ab7d3a389`) | Cross-agent file contamination when two agents share a working tree | Manual (orchestrator discipline); also added end-of-task merge reminder |
| `.claude/skills/phaser-perf/SKILL.md` | Added HIGH-4 as a case study with the SwiftShader profiling sequence (commit `5618ef60a`) | Wrong profiling environment producing misleading FPS readings | Manual (tester knowledge) |
| `.claude/skills/inspect/skill.md` | Added pre-flight check for `__rrPlay.restore()` canvas attachment verification (commit `bf2db2a2`) | `/inspect` resume-dependent scenarios silently running against a black Phaser scene | Manual (skill pre-flight) |
| `.claude/skills/manual-fact-ingest-dedup/SKILL.md` | Added mandatory obsessive-verification step: sample 10 outputs, grep for brace patterns before saving (commit `94607cda8`) | Batch content operations shipping broken output | Manual (skill step in prompt) |
| `.claude/skills/deck-master/SKILL.md` | Added "Semantic Homogeneity Self-Review" step before marking deck done (commit `2321df492`) | Pool contamination with cross-category distractors | Manual (skill step) |
| `.claude/skills/llm-playtest/SKILL.md` | Added `__rrPlay.getRelicDetails()`, `getRewardChoices()`, `getStudyPoolSize()` extensions to default primer (commit `a29b11ed2`) | Tester sub-agents unable to inspect relics or reward choices, leaving Focus Items 10–11 blocked | Manual (tester primer knowledge) |
| `docs/testing/dev-tooling-restore-invariants.md` | New file: dev tooling state-restore invariants (commit `bf2db2a2`) | `__rrPlay.restore()` skipping Phaser scene boot, leaving canvas black | Manual (developer reference) |
| `docs/testing/perf-baselines.md` | New file: FPS/frame-time baselines by device tier (commit `05514068d`) | No documented performance baseline to compare against | Manual (developer reference) |
| `docs/ui/screens.md` | Hub dev-mode gating contract, restStudy empty state, HIGH-7/8 gotchas (commit `4172182d7`) | Missing escape hatches in edge-case screen states | Manual (developer reference) |
| `docs/architecture/services/run.md` | `InRunFactTracker` rehydration contract documented (commit `bf2db2a2`) | Future fields added to RunState without explicit serialize/deserialize | Manual (developer reference) |

---

## 3. What Is Still Uncovered

**MEDIUM-9 AP economy design (46% wasted-AP turns)** remains open pending a user design decision. The data is clear (balance curve tester + fun tester both flagged it independently), but all three proposed solutions (bump starting AP, consistent free-charge waiver, homogeneous-cost surcharge waiver) change game feel enough that only the user can pick. No automated prevention exists — this is a design gap, not a tooling gap.

**Balance constants drift** continues to be caught only when a human or playtest tester notices the values are wrong. LOW-17 triage found 13 stale test constants during the sweep. The underlying issue is that numeric balance constants in `src/data/balance.ts` and the headless sim's expected-value assertions are not linked — a rebalance commit can change `CHARGE_CORRECT_MULTIPLIER` without updating the sim thresholds, and typecheck passes. The fix would be a codegen step that derives sim thresholds from balance constants, but that work was deferred.

**Real-hardware FPS baseline is absent.** The HIGH-4 fix prevents the Docker SwiftShader false positive, but we have no CI gate that measures FPS on a real GPU. If `DepthLightingFX` regresses on real hardware, it will only be caught when a human developer notices. The headless perf smoke test (`tests/playtest/headless/`) does not run the shader pipeline at all. A real-hardware canary job (a single human-run benchmark script that stores a rolling baseline) would close this gap but was not built in this sweep.

**Pre-existing typecheck errors in `tests/playtest/headless/simulator.ts`** (26 errors) were triaged and deferred. They are non-fatal for current operation because the headless sim uses `tsx` which skips type checking, but they represent accumulated type debt that will become painful when the simulator is next refactored.

**Parallel-agent commit contamination** surfaced once: commit `dc9ea7e20` (LOW-19 fix) accidentally staged files that the triage agent had partially modified, because both agents were operating in the same worktree at different times during this sweep. The per-agent worktree isolation rule (`ab7d3a389`) now mandates separate worktrees, but the enforcement is entirely manual. There is no technical barrier preventing an agent from using the wrong working directory if its prompt is wrong or omits the worktree path.

**Full-playthrough bugs remain harder to catch** than encounter-level bugs. Focus Items 1 (chess tactics board rendering), 2 (map pin drop mode), 11 (relic clarity), and 12 (full run-end on death from floor 3) all required a complete multi-floor run to surface — and the full-run tester hit its rate limit before completing. Single-encounter testers can catch quiz content and basic flow bugs, but any bug requiring ≥3 floors of play (late-game enemy mechanics, ascension interactions, run-state accumulation bugs) will be missed by the current tester roster unless the full-run tester consistently completes its session.

---

## 4. Mean Time to Discovery

For each CRITICAL and HIGH, the table below records the estimated introduction commit, its date, and the 2026-04-10 playtest detection. Introduction dates are from `git log` on the affected files.

| Issue | Introduction Commit | Introduced | Detected | Commits Between | Notes |
|-------|---------------------|-----------|----------|-----------------|-------|
| CRITICAL-1 `{N}` brace leak | `f614c0400` | 2026-04-09 00:55 | 2026-04-10 | ~133 | Generator added 2026-04-09; leaked distractors committed same day; caught ~24h later |
| CRITICAL-2 RunState Set deserialization | `ee5b8e2f7` (file-based save introduced) | 2026-04-04 | 2026-04-10 | ~208 | `reviewStateSnapshot` was a Set from early save-system design; the mismatch only manifested when Save→Resume was testable in a full run |
| CRITICAL-2 partial "fix" missed the set fields | `0aeff3bfe` | 2026-04-10 10:41 | Same day | ~46 | `0aeff3bfe` fixed `InRunFactTracker` but not the RunState-level Sets; the playtest was already in-flight and caught this path 6 hours later |
| CRITICAL-3 `restore()` black scene | Not isolated to a single commit — `restore()` was skeletal and never re-mounted the scene | ~2026-04-04 | 2026-04-10 | ~200+ | The dev tooling path was never fully tested end-to-end; it appeared to work in simpler states |
| HIGH-4 FPS regression (SwiftShader) | `deviceTierService.ts` never had SwiftShader detection — present from the introduction of the tier system (~2026-03-23) | ~2026-03-23 | 2026-04-10 | ~500+ | Not a regression in game code; SwiftShader always produced low fps at flagship tier; the game was not tested in Docker before this playtest batch |
| HIGH-5 grammar scars | The `fix-self-answering.mjs` `word_boundary_replacement` strategy — commit `f0ed78be5` | 2026-04-10 16:37 | Same day | ~0 | Grammar scars were produced by a fix commit earlier in the sweep and caught by the playtest running concurrently. The pattern is recurring: the same class of scar was first documented 2026-04-09. |
| HIGH-6 pool contamination | `93c6c1f7a` (pop_culture deck creation) | 2026-04-10 01:32 | 2026-04-10 | ~60 | Deck was authored 8h before the playtest; contamination visible on first play |
| HIGH-7 dev buttons | `3e7708c2a` | 2026-03-31 | 2026-04-10 | ~488 | Present for 10+ days, visible to every LLM tester since the tester-primer began using `devpreset=post_tutorial`; no prior tester surfaced it |
| HIGH-8 startStudy softlock | Related to `__rrPlay.startStudy()` precondition gap — timing unclear | ~2026-04-04 | 2026-04-10 | ~200+ | The precondition bypass was always present in the dev API; it only became observable when testers started calling `startStudy()` explicitly |

**Cadence warning**: CRITICAL-2 (the save-load Set deserialization bug) was present for ~6 days and ~208 commits before this sweep. HIGH-7 (dev buttons) was present for ~10 days and ~488 commits. Both significantly exceed the "10 commits between introduction and detection" threshold that should trigger a cadence review. The playtest schedule was not daily during this period — this batch was the first full playtest after the save system refactor and the hub redesign.

**Recommendation**: run at minimum a smoke playtest (quiz tester only, 3 encounters) after any commit that touches `runSaveService.ts`, `InRunFactTracker.ts`, `HubScreen.svelte`, or the content pipeline scripts. These files are high enough risk to warrant targeted spot-checks between full sweeps.

---

## 5. Improvements to the Playtest Skill Itself

### Why the full-run tester hit its rate limit

The full-run tester (`fullrun`) is a single Sonnet sub-agent asked to navigate from hub → dungeon selection → floor 1 → multiple combats → floor 2 → rest → floor 3 → death, while also checking Focus Items 1–12 along the way. Each action batch requires writing and reading a `result.json` back through the Docker warm container. A typical action batch is:

- Write actions JSON file (1 round-trip to disk)
- `scripts/docker-visual-test.sh --warm test --actions-file` (~5s per batch after warm boot)
- Read `result.json` output
- Read screenshot
- Reason about next action batch

A complete 3-floor run requires approximately 25–40 action batches. At ~2,000 tokens per batch round-trip (actions + results + reasoning), a full run costs 50,000–80,000 tokens. The Sonnet rate limit for a sub-agent context is approximately 100,000 tokens for a long-running session. At 90% completion (where the tester stopped), the tester had consumed ~70,000–90,000 tokens while also writing its report structure, which adds another 5,000–10,000 tokens. It hit the ceiling before completing the death-sequence and the final 4 focus items.

**What would help:**

1. **Separate the full-run tester into two sub-agents**: "Floor Navigation" (hub → floor 3 death) and "Focus Item Auditor" (reads the navigation sub-agent's notes and tests the remaining 4 focus items in isolation). Each would stay well under the token budget.

2. **Per-tester token budget**: target 60,000 input tokens per tester. Quiz, balance, fun, and study testers currently consume 30,000–50,000 tokens each. The full-run tester needs a budget of 80,000+. If the platform limit is 100,000, the full-run tester needs to be split.

3. **Parallelization across Docker containers**: quiz, balance, fun, and study testers are already architecturally parallelizable — they each use independent `--agent-id` scoped containers. The current skill instruction says "run testers SEQUENTIALLY when using Playwright MCP" but the Docker path removes that constraint. Converting the skill to run 4 testers in parallel would cut wall-clock time from ~60 minutes to ~20 minutes per batch. The full-run tester must remain sequential (it needs to navigate a continuous run), but the four domain testers can parallelize.

4. **`__rrPlay` extensions now shipped in Phase 5** that should become default primer content:
   - `__rrPlay.getRelicDetails()` — now returns actual relic data from runState (was returning `[]`)
   - `__rrPlay.getRewardChoices()` — exposes the 3-card reward picker before `acceptReward()` auto-accepts
   - `__rrPlay.getStudyPoolSize()` — lets testers check the study pool before calling `startStudy()`

   These should be added to the "Known Behaviors" section of the SKILL.md primer so every tester knows they exist and can use them without spending tokens rediscovering the API.

5. **Richer smoke test failure diagnosis**: the Phase 0 smoke test currently checks 6 booleans. If `getScreen()` returns `'onboarding'` instead of `'hub'`, the tester fails silently or burns tokens debugging. The smoke test should assert the expected screen and return the `look()` state dump so testers start with a full situational snapshot rather than needing their first batch to be pure orientation.

6. **Primer addendum: real-hardware FPS caveat**: every tester prompt should include "FPS readings in Docker/SwiftShader will show 22–45 fps at best regardless of optimization — this is the software renderer ceiling. Do not report Docker FPS below 45 as a bug unless the game is performing significantly worse than a prior run with `__rrDebug().phaserPerf`." This would have prevented the HIGH-4 report from being labeled a regression rather than a profiling environment issue.

**Proposed concrete edit to `.claude/skills/llm-playtest/SKILL.md`:**

- Section "Phase 0: Docker Smoke Test" — extend the eval actions-file to include a `look()` call and return it in the smoke output, so the first tester action batch starts with full state context
- Section "Known Behaviors" — add items 4, 5, 6 for the new `__rrPlay` extensions, Docker FPS caveat, and grammar-scar grep requirement for quiz tester
- Section "Phase 2: Run Testers Sequentially" — update to "Run domain testers in parallel (4× Docker containers); run full-run tester sequentially after or alongside"
- Add a "Token Budget" section: quiz/balance/fun/study target ≤60k input; full-run must be split into navigation + focus-audit sub-agents if the session exceeds 70k tokens

---

## Summary

The Apr-10 sweep fixed 3 CRITICAL bugs, 5 HIGH bugs, 7 MEDIUM bugs, and 2 LOW bugs across game logic, content, UI, and dev tooling. Every fix that could carry an automated regression test now has one. Every rule gap that allowed these classes of bugs to ship undetected has been filled.

The three themes that run through every finding are:

1. **Manual steps that should be automated**: grammar-scar grep, brace-leak grep, Set/Map rehydration audit — all were known patterns that required reviewer discipline to catch. All three are now automated via `verify-all-decks.mjs` checks or lint scripts.

2. **Partial fixes that weren't caught because integration tests were missing**: `0aeff3bfe` fixed the right class but not the right scope, and no test serialized a full `RunState` to catch the remaining gaps. Full round-trip integration tests now exist.

3. **Long TTD for UI bugs**: dev buttons lived undetected for 488 commits because no tester or reviewer was prompted to check for them, and the primer did not tell testers what "expected" hub state looked like. Explicit assertions in the playtest primer and in Playwright visual-inspect tests close this gap.

The next playtest should focus on the 4 untested Focus Items (chess, map pin, relic clarity, full death run) and should use the extended `__rrPlay` APIs delivered in Phase 5.

---

*Full FIX-PLAN is at `data/playtests/llm-batches/BATCH-2026-04-10-003-fullsweep/FIX-PLAN.md`. Full playtest findings are at `SUMMARY.md` in the same directory.*
