# Hardcore Fix + Prevent Plan — BATCH-2026-04-10-003-fullsweep

**Doctrine**: Every finding gets THREE artefacts, not one:
1. **The code fix** — the line(s) that resolve the symptom
2. **A regression test** — unit / integration / playtest / verify-script that will catch it if it comes back
3. **A preventative rule update** — the skill / doc / rule / script that will stop this *class* of bug from ever being authored again

No fix counts as "done" until all three are committed in the same PR/commit batch. Any fix that can only produce (1) and (2) still needs a gotcha entry in `docs/gotchas.md` explaining why the prevention layer couldn't be added — and what would need to change to add it later.

**Parallel-agent awareness**: Another agent is mid-work in this repo. Every sub-agent spawned by this plan MUST:
- Start with `git pull --rebase origin main` before touching files
- Only edit files inside its declared scope (listed per task)
- Commit + push after every logical step, not batched
- Check `git status` before committing to avoid accidentally staging the other agent's work
- If it encounters unexpected unstaged changes that aren't its own, STOP and report — do not stash, revert, or assume ownership

---

## Phase 0 — Orchestrator Prep (before spawning any fix agents)

- **P0-1** Read `docs/INDEX.md` and navigate every sub-file relevant to this plan (combat render loop, save/load, content pipeline, deck quality, UI shell, study rest room). Note the current state so you can spot drift.
- **P0-2** Read `docs/gotchas.md` from top to bottom. Confirm no existing entry already covers any of these findings — if one does, the earlier prevention layer failed and we need to find out why before layering another one on top.
- **P0-3** Run `git pull --rebase origin main` at the start of every sub-agent handoff. Parallel agent will be pushing.
- **P0-4** Create a `docs/gotchas.md` entry skeleton for each CRITICAL + HIGH finding (don't fill in the "Fix:" field yet — the fixing agent fills that in when they commit).
- **P0-5** Start dev server once for any live verification runs. Start warm Docker container `rr-sweep-fix` at the beginning of the verification phase — NOT at the start.

---

## Phase 1 — CRITICAL Fixes (blocking, highest priority)

### CRITICAL-1: `{N}` template token leak into quiz options

**Owner**: content-agent sub-agent
**Scope**: `scripts/add-synthetic-distractors.mjs` (and siblings), `data/decks/pop_culture*.json` (and any affected deck), `scripts/verify-all-decks.mjs`, `.claude/rules/content-pipeline.md`, `.claude/rules/deck-quality.md`, `docs/gotchas.md`
**Will NOT touch**: `src/`, `scripts/audit-*`, `data/audits/*` (parallel agent territory)

**Root cause hypothesis**: numeric synthetic-distractor formatter is emitting a JS template-literal like `` `{${offset}}` `` verbatim instead of interpolating. The leading/trailing `{}` are the template braces, not random noise.

**Fix steps**:
1. `grep -rn "syntheticDistractors" scripts/` — find every generator
2. `grep -rn '`{${' scripts/` (and variants `{$`, `{\\${`) — find template-literal bugs
3. `grep -rn '"\\\\{' data/decks/ | grep -v '{___}'` — find any deck file that already has leaked `{N}` strings in its JSON (fill-in-blank `{___}` is legitimate, exclude it)
4. Fix the generator
5. Delete all leaked synthetic distractors from affected deck JSONs and regenerate via the fixed script
6. Run `npm run build:curated && npm run build:obfuscate` to rebuild the compiled DB

**Regression test** (CRITICAL-1-T):
- Add a check to `scripts/verify-all-decks.mjs` that rejects any `syntheticDistractor` or `answerTypePool.syntheticDistractors[]` containing a literal `{` OR `}` character that is NOT inside a fill-in-blank `{___}` token
- Make the check produce a HARD FAIL (exit non-zero) with the exact fact ID + distractor string
- Add a vitest unit test in `tests/content/synthetic-distractors.test.ts` that feeds the formatter known inputs and asserts no brace escapes ever appear

**Preventative rule updates** (CRITICAL-1-P):
- `.claude/rules/content-pipeline.md` → add a new subsection "Template-literal audit for programmatic distractors" with the explicit bad-pattern `{${value}}` and the correct form. Reference the 2026-04-10 incident.
- `.claude/rules/deck-quality.md` → add check number (next sequential) "No raw template braces in distractors" to the mandatory checklist
- `docs/gotchas.md` → append `### 2026-04-10 — {N} template tokens leaked into quiz options` with what/why/fix/prevention
- `.claude/skills/manual-fact-ingest-dedup/` (content pipeline skill) → add a paragraph in its instructions mandating "sample 10 outputs and grep for literal `{` before saving" — this is the obsessive-verification rule the user has drilled in twice before

**Verification**:
- `node scripts/verify-all-decks.mjs` — 0 failures
- `npm run build:curated`
- Live: load `pc_0_tigerking_viewers` via `__rrScenario` and confirm the 4 choices contain no literal `{` or `}`
- `npx vitest run tests/content/synthetic-distractors.test.ts`

---

### CRITICAL-2: `reviewStateSnapshot.has is not a function` after resume

**Owner**: game-logic sub-agent
**Scope**: `src/services/inRunFactTracker.ts` (or wherever `reviewStateSnapshot` lives), `src/services/saveManager.ts` (or migration file), `tests/services/inRunFactTracker.test.ts`, `docs/architecture/services/index.md`, `docs/gotchas.md`, `.claude/rules/save-load.md`
**Will NOT touch**: `src/ui/*`, `data/decks/*`, `scripts/audit-*`, content pipeline

**Root cause hypothesis**: `reviewStateSnapshot` is a `Set` (or `Map`) in memory, but when serialized to JSON it becomes `{}` or `[]`, and the rehydration path doesn't wrap it back into a `Set`. Commit `0aeff3bfe` partially addressed this but missed the actual `.has()` call site.

**Fix steps**:
1. Read `src/services/inRunFactTracker.ts` — find every field of type `Set` / `Map`
2. Read the save/load serializer — find where the tracker state is reconstituted
3. Check commit `0aeff3bfe` to understand what the prior "fix" actually did and why it missed this path
4. Add a proper `rehydrate(json)` static method on `InRunFactTracker` that wraps every `Set` / `Map` field in its correct container, with unit tests
5. Ensure all code paths that load a saved run (natural Resume Run + `__rrPlay.restore()`) go through this one rehydration method — no ad-hoc `Object.assign` shortcuts

**Regression test** (CRITICAL-2-T):
- Unit test: `inRunFactTracker.test.ts` → serialize a tracker with live state → JSON stringify → JSON parse → rehydrate → call `.has()` on reviewStateSnapshot, verify it returns the expected booleans
- Integration test: Spawn a bot-playtest scenario that starts a run, plays 2 encounters, snapshots, simulates page reload, restores, and plays another card. Add it to `scripts/deck-playtest-all.mjs` or an equivalent headless-sim harness. Fail the test if any `chargePlayCard` after restore returns an error.
- Headless-sim smoke: extend `tests/playtest/headless/run-batch.ts` with a `--resume-smoke` flag that does exactly the reload-then-play test at least once per run

**Preventative rule updates** (CRITICAL-2-P):
- `.claude/rules/save-load.md` → add a new section "Rehydrating typed collections" with the explicit rule: "Any field whose runtime type is `Set`, `Map`, `WeakSet`, or a class instance MUST be wrapped by an explicit rehydration function on load. Never rely on `Object.assign` or JSON parse alone for these types."
- `docs/gotchas.md` → append `### 2026-04-10 — InRunFactTracker.reviewStateSnapshot lost its Set type on resume` with what/why/fix/prevention. Reference the fact that commit 0aeff3bfe was a partial fix.
- `docs/architecture/services/index.md` (or whichever service catalog entry covers InRunFactTracker) → document the rehydration contract
- Add a lint/check: write a script `scripts/lint/check-set-map-rehydration.mjs` that greps `src/` for `new Set(` and `new Map(` fields on classes that are serialized to save files, and flags any class that doesn't have a matching `rehydrate` method. Run it from `npm run check`.

**Verification**:
- `npx vitest run tests/services/inRunFactTracker.test.ts`
- `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --resume-smoke --runs 10`
- Live: Docker warm container → play 2 encounters → `__rrPlay.snapshot` → `location.reload()` → Resume Run → play a charge card → verify no error
- `npm run check` (should now run the new lint script)

---

### CRITICAL-3: `__rrPlay.restore()` leaves Phaser scene black

**Owner**: game-logic sub-agent (same as CRITICAL-2 — these are related)
**Scope**: `src/dev/rrPlay.ts` (or wherever `restore` lives), `src/game/scenes/*` (scene lifecycle for restart), `tests/dev/rrPlay.test.ts`, `docs/testing/strategy.md`, `docs/gotchas.md`

**Root cause hypothesis**: `restore()` sets the data store state but does not re-mount / re-initialize the active Phaser scene. The scene was shut down during reload and never re-entered.

**Fix steps**:
1. Read `src/dev/rrPlay.ts` — find `restore()` and trace the screen-transition sequence
2. Compare to the natural Resume Run button flow in `src/ui/` — identify what scene-activation call it makes that restore() skips
3. Either: (a) have `restore()` explicitly boot the required scene via Phaser's scene manager after state is set, OR (b) re-route `restore()` through the same entry point as natural Resume Run
4. Option (b) is strongly preferred — single source of truth

**Regression test** (CRITICAL-3-T):
- Extend the existing dev tooling test suite (or create one) with a Playwright/Docker scenario that calls `__rrPlay.snapshot` then `__rrPlay.restore` then `getScreen()` then `acceptReward()` and verifies no "scene not active" errors
- Add a sanity assertion: after restore, `document.querySelectorAll('canvas')[0]` is attached AND has non-empty render dimensions

**Preventative rule updates** (CRITICAL-3-P):
- `docs/testing/strategy.md` → add a section "Dev tooling state-restore invariants" spelling out the rule that any state-restoring dev hook must go through the same scene-boot path as natural save/load
- `docs/gotchas.md` → append `### 2026-04-10 — __rrPlay.restore() forgot to re-mount the Phaser scene`
- `.claude/skills/inspect/skill.md` → add a pre-flight check: "Before any scenario that uses `__rrPlay.restore()`, verify the canvas is attached and the target screen matches." Reference this finding.

**Verification**:
- Docker smoke test: boot → snapshot → restore → verify scene render
- `/inspect` skill dry-run: confirm resume-dependent scenarios no longer fail

---

## Phase 2 — HIGH Fixes

### HIGH-4: Sustained low FPS in CombatScene (CONVERGENT)

**Owner**: game-logic sub-agent (separate spawn from CRITICAL-2/3)
**Scope**: `src/game/scenes/CombatScene.ts`, `src/game/systems/*`, `src/game/entities/*`, possibly `src/ui/components/CardHand.svelte` (if Svelte overlay is blocking RAF)
**Will NOT touch**: Svelte UI outside of CombatScene's direct overlay, `data/decks/*`

**Prerequisite**: Run `/phaser-perf` skill FIRST to profile before patching. Do not guess — the user has said "never brute force" and "investigate root cause". Three testers independently measured sub-20 fps with SwiftShader. Narrow the suspects before cutting.

**Fix steps**:
1. `/phaser-perf` → draw-call count, texture atlas state, RAF frame time, tween count
2. Profile with `__rrDebug()` extensions during a combat encounter
3. Identify the hot spot (likely: tween leak, object pool churn, debug overlay overhead, Svelte reactivity storm, or particles spawned-not-destroyed)
4. Fix root cause — do not add throttling as a band-aid
5. Re-measure: target ≥45 fps sustained in Docker/SwiftShader, ≥55 on real hardware

**Regression test** (HIGH-4-T):
- Add a headless perf smoke test: run 1 combat encounter, sample `performance.now()` deltas across 300 frames, assert median frame time < 22ms (= ~45 fps). Fail the build if regressed.
- Store the baseline frame-time in `docs/testing/` alongside the other performance targets
- Add an assertion to the `/inspect` skill's visual layer: if any captured combat screenshot is taken during a period where FPS is below threshold, log a loud warning

**Preventative rule updates** (HIGH-4-P):
- `.claude/rules/performance.md` → add a subsection "Continuous FPS monitoring during CI" with the concrete frame-time threshold (22ms = 45 fps headless, 16.7ms = 60 fps target real hardware)
- `.claude/skills/phaser-perf/SKILL.md` → add this incident as a case study with the profiling sequence that worked
- `docs/gotchas.md` → append `### 2026-04-10 — CombatScene regressed to <20 fps` with what/why/fix/prevention

**Verification**:
- `__rrDebug().fps` reports ≥45 sustained in Docker
- The new headless perf smoke test passes
- Live playtest on real host Chrome (not Docker) shows ≥55 fps

---

### HIGH-5: "the concept" word-replacement grammar scars

**Owner**: content-agent sub-agent (same as CRITICAL-1)
**Scope**: `data/decks/**/*.json`, `scripts/verify-all-decks.mjs`, `.claude/rules/content-pipeline.md`, `docs/gotchas.md`

**Fix steps**:
1. `grep -rn '"the concept ' data/decks/ | wc -l` — count total occurrences
2. Read each offending fact in context (question + answer + chainTheme) and rewrite the stem
3. For each fix: ensure the answer is still semantically valid, the difficulty is unchanged, and the pool assignments still make sense
4. After fixing all matches, run `npm run build:curated`

**Regression test** (HIGH-5-T):
- Add check to `scripts/verify-all-decks.mjs` for known grammar-scar patterns: `the concept `, `this the `, ` a the `, ` in a who `, `Soviet this `, `[Adjective] this` (the 2026-04-09 pattern from the content-pipeline rule). Fail on any match. Maintain as a regex catalog file `scripts/content-pipeline/grammar-scar-patterns.json` that grows over time.
- Unit test that feeds known-broken strings through the checker and asserts failures

**Preventative rule updates** (HIGH-5-P):
- `.claude/rules/content-pipeline.md` → strengthen the existing "Batch Output Verification — MANDATORY" section with a mandated automated-grep step: every batch content edit MUST run the grammar-scar checker before committing
- `docs/gotchas.md` → append `### 2026-04-10 — "the concept" grammar scars from a prior batch replacement` (likely a followup to the 2026-04-09 entry; cross-reference it)
- Review the manual-fact-ingest-dedup skill and any sub-agent prompt template: add the grammar-scar grep as a mandatory post-batch step

**Verification**:
- `grep -rn '"the concept ' data/decks/` → 0 matches
- `node scripts/verify-all-decks.mjs` → 0 failures
- Spot-check 5 of the fixed stems by reading them aloud

---

### HIGH-6: Pool contamination (barcode, netflix, n64)

**Owner**: content-agent sub-agent (same spawn as CRITICAL-1 + HIGH-5)
**Scope**: `data/decks/pop_culture*.json`, `data/decks/inventions*.json` (or wherever `inv_*` facts live), `scripts/fix-pool-heterogeneity.mjs`, `scripts/verify-all-decks.mjs`

**Fix steps**:
1. Run `node scripts/fix-pool-heterogeneity.mjs --dry-run` on the affected decks
2. Split pools by semantic answer type per `.claude/rules/deck-quality.md` §"Pool Design Rules — MANDATORY"
3. Re-run `scripts/fix-pool-heterogeneity.mjs` (apply)
4. For any pool that drops below 5 real facts after splitting, add targeted `syntheticDistractors` to reach 15+
5. `npm run build:curated`

**Regression test** (HIGH-6-T):
- Tighten the existing pool-homogeneity check in `verify-all-decks.mjs`: in addition to length/format checks, add a semantic-category check that flags any pool where the answers belong to >1 detectable category (person-name vs description vs year vs product-category). Use heuristics: length ratio > 3×, capitalization pattern mismatch, presence of digits in some answers but not others.
- The checker should produce a MEDIUM warning at ratio 2× and a HARD fail at 3×
- Cross-link the checker to `.claude/rules/deck-quality.md` so the rule reference is machine-checkable

**Preventative rule updates** (HIGH-6-P):
- `.claude/rules/deck-quality.md` → add the 3 specific failing examples (barcode, netflix, n64) to the "Common split patterns" subsection as canonical "what this rule catches" cases
- `docs/gotchas.md` → append `### 2026-04-10 — Pop-culture pools contaminated with cross-category distractors`
- `.claude/skills/deck-master/` (or equivalent deck-building skill) → add an explicit "semantic homogeneity self-review" step before marking a deck done

**Verification**:
- `node scripts/verify-all-decks.mjs` → 0 failures on the affected decks
- Live: load the 3 fixed facts via `__rrScenario` and manually read the choices

---

### HIGH-7: Dev buttons leak into post_tutorial hub

**Owner**: ui-agent sub-agent
**Scope**: `src/ui/components/HubScreen.svelte` (and anywhere dev buttons are rendered), `src/ui/stores/devMode.ts` (or equivalent), `docs/ui/screens.md`, `docs/gotchas.md`, `.claude/rules/ui-layout.md`
**Will NOT touch**: `src/game/*`, `data/decks/*`

**Fix steps**:
1. Find the dev-button component(s) — grep for `Intro`, `BrightIdea`, `InkSlug`, `RunEnd` as button labels
2. Find the condition gating their visibility
3. Current (broken) condition: probably `{#if import.meta.env.DEV || devpreset}`. Fix: gate strictly on a dev flag, NEVER on devpreset. Devpreset is a player-accessible test preset for playtests, not a dev-tools flag.
4. Add a new URL param `?dev=true` OR an env var `VITE_DEV_TOOLS=1` as the ONLY gate for dev-only UI
5. Keep the dev buttons available to actual devs; just de-couple from devpreset

**Regression test** (HIGH-7-T):
- Add a Playwright/Docker visual-inspect test: load hub with `?skipOnboarding=true&devpreset=post_tutorial` and assert that no element with `data-dev-only="true"` (or equivalent) is visible
- Add a unit test for the gating store: `devMode` is false when `devpreset=post_tutorial` is set without `?dev=true`

**Preventative rule updates** (HIGH-7-P):
- `.claude/rules/ui-layout.md` → add a new subsection "Dev-only UI gating" with the explicit rule: "Dev buttons, debug overlays, and internal testing UI must be gated on a dedicated dev flag (`?dev=true` or `VITE_DEV_TOOLS`), NEVER on `devpreset` or `botMode`. Devpreset is a playtest entry point, not a dev-tools flag."
- `docs/ui/screens.md` → document the hub's dev-mode-gating contract
- `docs/gotchas.md` → append `### 2026-04-10 — Dev buttons shipped in post_tutorial hub because gating used devpreset instead of a dev flag`

**Verification**:
- Docker visual inspect on hub with default flags → no dev buttons visible
- Dev visual inspect with `?dev=true` → dev buttons visible
- `npm run typecheck && npm run build`

---

### HIGH-8: startStudy from hub → "QUESTION 1 / 0" softlock

**Owner**: ui-agent sub-agent (same spawn as HIGH-7)
**Scope**: `src/dev/rrPlay.ts` (the `startStudy` method's precondition), `src/ui/components/StudyRestScreen.svelte` (or wherever restStudy renders), `src/services/studySession.ts` (or equivalent), `docs/ui/screens.md`, `docs/gotchas.md`

**Fix steps**:
1. Find `__rrPlay.startStudy` — tighten its precondition so a failure does NOT also navigate the screen store. Return `{ok: false, reason: "no active run"}` and leave the screen alone.
2. Find the restStudy screen renderer — add a proper empty state when `cardCount === 0`: "No cards to review yet. Start a run and visit a rest room." + a "Return to Hub" button
3. Make sure the back button is ALWAYS rendered in restStudy, even during loading / empty / error states

**Regression test** (HIGH-8-T):
- Unit test: `__rrPlay.startStudy()` from hub returns `{ok: false}` and does NOT change `screenStore`
- Integration (visual-inspect): load hub, call `startStudy`, assert screen is still 'hub' and no "QUESTION 1 / 0" text anywhere
- Visual-inspect: force restStudy with empty pool, assert empty-state text + back button visible

**Preventative rule updates** (HIGH-8-P):
- `.claude/rules/ui-layout.md` → add "Softlock prevention" subsection: every screen MUST render a dismiss / back button in ALL states (loading, error, empty, success). Never allow a state where the player cannot escape without reloading.
- `docs/gotchas.md` → append `### 2026-04-10 — startStudy from hub softlocked in "QUESTION 1 / 0"`
- Add a general-purpose dev helper: `scripts/lint/check-escape-hatches.mjs` that greps Svelte components for screens without a visible back/dismiss control. Run from `npm run check`.

**Verification**:
- Playwright: hub → startStudy → assert no navigation
- Playwright: force empty restStudy → assert back button visible and functional
- `npm run typecheck && npm run build`

---

## Phase 3 — MEDIUM Fixes (after all CRITICAL + HIGH pass verification)

### MEDIUM-9: AP economy strands 1 AP ~46% of turns

**Owner**: game-logic sub-agent + design decision from user
**Status**: NEEDS USER DECISION BEFORE CODING. Present the three options from balance-curve.md (bump AP, consistent free-charge waiver, homogeneous-cost surcharge waiver) and let the user pick.

- **Preventative rule**: `.claude/rules/game-conventions.md` → document whatever the chosen design is with the reasoning

### MEDIUM-10: Run-end skips runEnd screen on death

**Owner**: ui-agent
**Fix**: Add the missing transition from zero-HP → runEnd scene. Verify against natural Resume Run + death flows.
**Regression test**: headless-sim with a forced death + assert `getScreen() === 'runEnd'` afterwards
**Prevention**: `.claude/rules/save-load.md` → "All run-termination paths must converge on the runEnd scene; no direct hub jumps on death"
**Gotcha**: standard entry

### MEDIUM-11: Narrative overlays don't auto-dismiss reliably

**Owner**: ui-agent
**Fix**: Add an auto-dismiss timer (respect a skip-pref), make the "click to dismiss" hint higher contrast + larger
**Regression test**: visual-inspect with a 10s wait → assert overlay gone
**Prevention**: UI layout rule about overlay lifecycle

### MEDIUM-12: Weak low-HP visual signal

**Owner**: ui-agent
**Fix**: Add a low-HP vignette (≤40% HP = soft red edge), HP-bar pulse, subtle screen shake on damage below threshold
**Regression test**: visual-inspect at HP thresholds — screenshot vignette on/off
**Prevention**: `.claude/rules/ui-layout.md` → "Critical state visual signals" subsection listing low-HP, low-AP, surge imminent

### MEDIUM-13: Length-tells in 2 questions

**Owner**: content-agent
**Fix**: Rewrite distractors for the 2 facts to match the correct answer's length within 30%
**Regression test**: Tightened length-homogeneity check in `verify-all-decks.mjs` (already covers this; verify enforcement)
**Prevention**: already covered by HIGH-6-P

### MEDIUM-14: Hub sprite hitboxes have no labels

**Owner**: ui-agent
**Fix**: Add `aria-label` + tooltip text to all 9 hub sprite hitboxes
**Regression test**: a11y check — no `button.sprite-hitbox` without aria-label
**Prevention**: `.claude/rules/ui-layout.md` → "Accessibility baseline" subsection

### MEDIUM-15: Reward room items have no labels

**Owner**: ui-agent
**Fix**: Add hover tooltips + optional "inspect" mode for altar items
**Regression test**: visual-inspect reward room → assert labels present
**Prevention**: same as MED-14

### MEDIUM-16: Library fact-browser 4.6MB DOM (un-virtualized)

**Owner**: ui-agent + perf sanity review
**Fix**: Virtualize the fact-row list (`svelte-virtual-list` or equivalent)
**Regression test**: DOM node count for library screen ≤ 500 at any scroll position
**Prevention**: `.claude/rules/performance.md` → "DOM size budgets" subsection

---

## Phase 4 — LOW Fixes (batch at end, one commit)

- **LOW-17**: URL flag re-application after `location.reload()` (dev tooling polish)
- **LOW-18**: Philosophy NEW badge visibility (DOM verify, likely frame clip only)
- **LOW-19**: Enemy attack math sanity audit (investigation task → may escalate)

All three get: single investigation pass, fix if real, add a test. No individual prevention layer — the broader rules already in place catch these classes.

---

## Phase 5 — Re-test the Gaps

The playtest left four focus items UNTESTED because the full-run bug-hunter tester hit a rate limit:

- **Focus Item 1** — Chess Tactics runtime puzzle UI, board rendering, no-MC, no-hint verification
- **Focus Item 2** — Map Pin Drop quiz mode, partial-credit damage, map UI load
- **Focus Item 11** — Relic clarity (needs `getRelicDetails()` to return something, which may itself be a fix)
- **Focus Item 12** — Full runEnd screen on death (covered by MED-10 fix but needs live verification)

**Action**: Spawn a fresh full-run LLM playtest AFTER all CRITICALs and HIGHs land. Use the same batch directory convention but under a new batch ID (`BATCH-2026-04-11-001-gapfill` or whatever date it ends up). Give it a focused primer: "ONLY these 4 focus items, no broad coverage, no other testing". Expected runtime < 20 minutes.

Separately: **extend `__rrPlay` itself** to surface the missing APIs:
- `__rrPlay.getRelicDetails()` should return actual relic data from runState (it currently returns `[]`)
- `__rrPlay.getRewardChoices()` should expose the 3-card reward picker before `acceptReward` auto-accepts
- `__rrPlay.getStudyPoolSize()` so testers can see the empty state before triggering it

These are test-framework fixes that unblock future playtests — not product code. Same `game-logic` agent can handle during Phase 2.

---

## Phase 6 — Final Verification Sweep

After every fix lands:

1. `npm run typecheck` — 0 errors
2. `npm run build` — clean, no new warnings
3. `npx vitest run` — all 1900+ tests pass, including the new regression tests
4. `node scripts/verify-all-decks.mjs` — 0 failures
5. `node scripts/quiz-audit.mjs --full` — 0 failures
6. `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --resume-smoke` — no crashes, win-rate unchanged
7. `/inspect` on the chess deck AND the world_capitals deck (covers Focus Items 1 + 2)
8. Fresh `/llm-playtest fullrun` on the 4 gap items (Phase 5)
9. `git log --oneline -30` — review all commits for the sprint, verify each one has its doc / rule / gotcha in the same diff
10. Open SUMMARY.md → mark every listed issue RESOLVED with a commit SHA link

---

## Phase 7 — Retrospective (MANDATORY)

After all verification passes, write `data/playtests/llm-batches/BATCH-2026-04-10-003-fullsweep/RETROSPECTIVE.md` covering:

1. **What went wrong** — which patterns in our process let these bugs ship:
   - The 0aeff3bfe "fix" that didn't actually fix the CRITICAL-2 bug — why did it pass review? What test would have caught it? Why wasn't that test written?
   - The `{N}` template leak — did `verify-all-decks.mjs` ever have a brace check? If not, why not?
   - The grammar scars — this is the SECOND time the "the concept" / "the this" pattern has shipped. The 2026-04-09 entry in content-pipeline.md warned about it. Why did it happen again? Was the automated grep not enforced?
   - The dev-button gating — who authored the devpreset = dev-mode conflation? Is it in a doc anywhere?
2. **What the rules now prevent** — list every rule / doc / skill updated, the exact line, and the class of bug each addition catches
3. **What's still uncovered** — honest list of things the current preventative layer still cannot catch, plus ideas for closing those gaps
4. **Mean time to discovery** — how many commits shipped between the bug being introduced and this playtest catching it. If >10 for any CRITICAL, that's a signal the playtest cadence is too low.
5. **Improvements to the playtest skill itself** — what would have made the full-run tester not hit its rate limit? What should the per-tester token budget be? Should we parallelize across containers?

The retrospective goes to `docs/gotchas.md` as a meta-entry too: `### 2026-04-10 — Retrospective: what the Apr-10 playtest caught that our process should have`.

---

## Parallel-Agent Coordination Protocol

Since another agent is actively working in this repo:

1. **Before EVERY sub-agent spawn**: `git pull --rebase origin main`
2. **At every commit**: `git status` first to verify you're only staging YOUR files. If you see unexpected files, STOP and ask the user.
3. **Commit frequently** — one logical fix per commit. Never batch multiple CRITICALs into one commit.
4. **Push immediately after commit** — do not hold work locally
5. **If you hit a rebase conflict**: abort, read the other agent's changes, decide whether your fix needs to adapt, and ask the user if it's non-trivial
6. **Do not touch these paths** (parallel agent's territory based on current `git status`):
   - `data/audits/**`
   - `docs/reports/**`
   - `scripts/audit-*`
   - `.gitignore` modifications
   - `docs/INDEX.md` (unless adding a link to a new doc file you created — coordinate via commit message)
   - `docs/testing/strategy.md` (unless you own the section — coordinate)
   - `public/data/narratives/manifest.json`
7. **Communicate through commits** — every commit message should be grep-able for the finding ID (`CRITICAL-1`, `HIGH-4`, etc) so the other agent + future you can trace the work

---

## Execution Order (Recommended)

Run these in order. Do NOT parallelize Phase 1 — the CRITICALs have shared infrastructure (save/load, content pipeline) and simultaneous edits will conflict.

1. Phase 0 (prep, 15 min orchestrator work)
2. Phase 1 CRITICAL-1 (content-agent, ~1 hour)
3. Phase 1 CRITICAL-2 + CRITICAL-3 (game-logic, same agent, sequential, ~2 hours)
4. Phase 2 HIGH-4 (game-logic + `/phaser-perf`, ~2 hours)
5. Phase 2 HIGH-5 + HIGH-6 (content-agent, same spawn as Phase 1 if still running, ~1 hour)
6. Phase 2 HIGH-7 + HIGH-8 (ui-agent, ~1 hour)
7. Phase 3 MEDIUM-9 (user design decision) — can be deferred
8. Phase 3 MEDIUM-10 through MEDIUM-16 (ui-agent, game-logic, content-agent, can parallelize carefully)
9. Phase 4 LOW batch
10. Phase 5 gap-fill playtest
11. Phase 6 final verification
12. Phase 7 retrospective

**Rough budget**: 1-2 days of orchestrated work if agents cooperate. Do not attempt to rush — each fix must carry its test + prevention layer.
