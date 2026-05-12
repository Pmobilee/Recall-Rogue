# Alpha-Readiness Codex Handoff — 2026-05-12

**Origin**: Two-day manual + LLM playtest sweep of Act 1 → Act 2. The most blocking findings (damage curve, mystery_combat softlock, texture leak, card AP display polish) shipped already. This document collects the remaining 8 issues for Codex to pick up.

**Status of fixes already shipped (do NOT redo):**
| Commit | Fix |
|---|---|
| `8337003dd` | `GLOBAL_ENEMY_DAMAGE_MULTIPLIER` 1.60 → 1.07 (initial overcorrection), `mystery_combat`/`mystery_elite_combat` background fallback, `WeaponAnimationSystem` texture-key guard |
| `c469997fc` | `GLOBAL_ENEMY_DAMAGE_MULTIPLIER` 1.07 → 1.30 (final, sim + LLM playtest validated) |
| `6ef2e9579` | Card AP cost: animated swap when crossing the charge line. The display rule (quick cost by default, charge cost only on drag-above-line OR charge-button hover) is now in [`docs/ui/components.md`](../../ui/components.md). |

**Required reading before starting any task:**
- [`docs/gotchas.md`](../../gotchas.md) entries dated 2026-05-11 and later
- [`docs/mechanics/combat.md`](../../mechanics/combat.md) for damage pipeline context
- [`data/playtests/llm-batches/BATCH-2026-05-11-001/normal-player-fullrun.md`](../../../data/playtests/llm-batches/BATCH-2026-05-11-001/normal-player-fullrun.md) — the LLM tester's full report with all the evidence below
- [`data/playtests/llm-batches/BATCH-2026-05-12-001/normal-player-fullrun-verify.md`](../../../data/playtests/llm-batches/BATCH-2026-05-12-001/normal-player-fullrun-verify.md) — the verification run at the new multiplier

**Hallucination warning:** The LLM-playtest skill's own header notes ~30% of reported bugs are fabrications. Treat every cited fact, line, value, or behavior below as **unverified until you reproduce it**. The convergence across two reports plus the headless sim is the strongest signal; isolated claims need verification first.

---

## Priority order

| # | Task | Severity | Effort | Block reason |
|---|---|---|---|---|
| 1 | Boss-reward "Leave items behind?" modal softlock | CRITICAL (if real) | Unknown — verify first | Blocks all automated Act 2+ testing |
| 2 | Boss intent table audit — cap non-damaging turns at ~25% | HIGH | ~1-2 hr | Bosses feel like punching bags even at 1.30 |
| 3 | Hand-reindex API — add `playCardById` variants | HIGH | ~30 min | Automation churn; also affects human mental model |
| 4 | Quiz distractor quick-scan | MEDIUM | ~30 min | Trivializes the core knowledge mechanic |
| 5 | Card upgrade L0→L1 "same damage" UX (Strike) | MEDIUM | Design decision, then ~15 min | First upgrade reads as broken |
| 6 | Texture leak follow-up — `CombatAtmosphereSystem` | LOW | ~10 min | Console error spam, no functional issue |
| 7 | Single-choice quiz bug (stroke-cases) | LOW | ~20 min | Possible content corruption — one fact only |
| 8 | Single-choice mystery events feel like placeholder | LOW | Design decision | Affects perceived content density |

---

## TASK 1 — Boss-reward "Leave items behind?" Phaser modal softlock

**STEP 1 IS VERIFICATION, NOT FIX.** Do not start coding until you've manually clicked through it in a real browser.

### What
After defeating the Floor-7 boss (`The Algorithm`), the reward room shows a Phaser-canvas Yes/No modal labeled "Leave items behind?". Yesterday's LLM tester could not dismiss it via any of: DOM clicks on visible Continue/Accept/Leave buttons, `__rrPlay.acceptReward()`, `__rrPlay.delve()`, `__rrPlay.mysteryContinue()`, `__rrPlay.selectRelic(0)`, or synthetic `pointerdown/pointerup/click` events dispatched at the canvas Yes-button coordinates.

### Why it matters
If this is broken for humans, it's an alpha-blocker — every run that beats Act 1 boss soft-locks. If broken only for automation, it blocks every future LLM playtest, Rogue Brain RL run, and headless verification of Act 2 content.

### Evidence
- Report: `data/playtests/llm-batches/BATCH-2026-05-11-001/normal-player-fullrun.md` § "BUG #1 — CRITICAL"
- Screenshot of the modal: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-11-001_*/20-after-canvas-click.rr.jpg` (may have been cleaned up — search for similar paths or re-reproduce)
- 10 minutes of dismissal attempts logged in the report's combat log § "After-boss: SOFTLOCK"

### Verification phase (DO THIS FIRST)
1. `npm run dev`, open browser, load `?skipOnboarding=true&devpreset=post_tutorial` or whatever fastest path to Act 1 boss exists. If none, use `__rrScenario` to spawn into a near-boss state (search `src/dev/scenarioPresets.ts` for boss presets).
2. Defeat The Algorithm.
3. Click each visible button (Continue, Accept, Leave, Yes, No) with a real mouse.
4. Open DevTools, run `window.__rrPlay.delve()` and `acceptReward()` from the console.
5. Report findings in the commit message: works for humans? works for some APIs? fully broken?

### Fix paths (pick after verification)
- **If broken for humans:** This is the bug. Find the modal's pointer/click handlers (likely in `src/game/scenes/RewardRoomScene.ts` or a related Phaser scene). Recent commit `05141d7d2` fixed a related "reward-room overlay pointer-events leak — Continue click reaches button". This may be a sibling bug in the same area.
- **If broken only for automation:** Add `__rrPlay.confirmLeaveReward(true|false)` (or rename to match existing conventions). Wire it into the modal's accept/decline handlers directly. Update `src/dev/playtestAPI.ts`. Add a unit test asserting screen transitions on call.

### Acceptance criteria
- Manual mouse path documented (works / broken).
- Either the human path or the automation path now reliably advances the screen out of the reward modal.
- New `__rrPlay.confirmLeaveReward` (if added) appears in `src/dev/playtestAPI.ts` and is exported on `window.__rrPlay`.
- A test in `tests/dev/playtestAPI.test.ts` (or similar) covers the flow.

### Constraints
- Don't refactor the entire reward-room scene. Surgical fix only.
- Don't break the existing pointer-events fix from `05141d7d2`.
- Do NOT change the modal's text or button copy without invoking `/humanizer` per `.claude/rules/human-prose.md`.

---

## TASK 2 — Boss intent table audit (cap non-damaging turns at ~25%)

### What
Audit every enemy whose `tier === 'boss'` (and the 4 floor checkpoints) and reshape their intent tables so non-damaging intents (`defend`, `buff`, `debuff` without damage, `heal`) account for **no more than ~25% of any boss's intent rotation**.

### Why
LLM tester reported The Algorithm spent **4 of 7 turns** on non-damaging intents (`Self-repair`, `System scan ×2`, `Memory wipe`). Even with the multiplier at 1.30, the boss fight felt anticlimactic — "punching bag with breaks." Tester quote: *"This is the END BOSS of Act 1. It should feel dangerous."* The same shape almost certainly affects Act 2/3 bosses.

### Where to look
- `src/data/enemies.ts` — full enemy roster including bosses. Each entry has an `intentPool` or `intents` array. The boss-tier enemies are tagged.
- `src/services/enemyManager.ts` — `rollNextIntent` logic. The "anti-stall defend filter" mentioned in the test file is real — don't remove it, but it's not in scope here.
- Specifically named in the playtest: `The Algorithm` (Act 1 boss). Check it first.

### Procedure
1. List every boss-tier enemy from `src/data/enemies.ts`.
2. For each, compute the % of intents in the pool that deal 0 damage. Use `enemy.intentPool.filter(i => !i.value || i.type === 'defend' || i.type === 'buff' || i.type === 'debuff').length / enemy.intentPool.length`.
3. Any boss with >25% non-damaging intents needs intent rebalancing — either:
   - Replace defensive intents with offensive variants (e.g. `defend` → `attack 8`).
   - Add damage to existing non-damaging intents (e.g. `Memory wipe` does 0 → does 4 + debuff).
4. Re-run `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 300 --profile competent` after changes. The competent win-rate should drop slightly (from 57% to ~50%) — that's the signal bosses are now properly threatening.

### Acceptance criteria
- Every boss in `src/data/enemies.ts` has ≤25% non-damaging intents in its pool.
- Sim win rate for `competent` profile stays in 45-60% range.
- Sim win rate for `new_player` profile doesn't drop below 40% (don't over-correct again).
- Update [`docs/mechanics/enemies.md`](../../mechanics/enemies.md) with the new intent ratios.

### Constraints
- Don't touch non-boss intent pools (regular and elite enemies are fine where they are).
- Don't lower `GLOBAL_ENEMY_DAMAGE_MULTIPLIER` (1.30 was just validated, stay there).
- Preserve each boss's mechanical identity. The Algorithm's "Self-repair" can stay if it now also deals chip damage; just don't have a turn where it does literally 0.

---

## TASK 3 — Hand-reindex API: add `playCardById` variants

### What
When a card at index N is played, every higher-index card shifts down by one in the hand. The current `__rrPlay.quickPlayCard(index)` and `chargePlayCard(index, correct)` operate on positional indices, which forces every automated caller to re-read `getCombatState` between every play.

Add ID-based variants: `quickPlayCardById(cardId)` and `chargePlayCardById(cardId, correct)`. Keep the index variants for compat.

### Why
LLM tester reported 4+ accidental wrong-card plays per run because the LLM's mental model of "card at index 2 is a Strike" was invalidated by an earlier play. Affects RL agents, LLM agents, and headless verification scripts. Also a mild PX problem for humans who tab between map and combat — but the impact is mostly automation.

### Evidence
- `data/playtests/llm-batches/BATCH-2026-05-11-001/normal-player-fullrun.md` § "BUG #3 — HIGH"

### Where to implement
- `src/dev/playtestAPI.ts` — current `quickPlayCard` at line 298, `chargePlayCard` at line 357. Read those for the existing pattern, then add the ID variants.
- The `cardId` is already exposed via `getCombatState().hand[i].id` (visible in the result.json snippets from the playtest reports — e.g. `card_50`, `card_67`, `card_105`).
- Resolve `cardId` → `index` via `turnState.deck.hand.findIndex(c => c.id === cardId)`, then delegate to the existing index-based logic.

### Acceptance criteria
- `window.__rrPlay.quickPlayCardById('card_42')` works.
- `window.__rrPlay.chargePlayCardById('card_42', true)` works.
- Returns the same shape as the index-based variants.
- Returns `{ok: false, message: 'Card <id> not in hand'}` if id is not found.
- Unit tests in `tests/dev/playtestAPI.test.ts`.
- Doc the new methods in [`docs/architecture/services/run.md`](../../architecture/services/run.md) or wherever `__rrPlay` is catalogued.

### Constraints
- Index-based methods stay. Don't deprecate them — sub-agent prompts and existing scripts depend on them.
- No new dependencies. No refactor of the play pipeline.

---

## TASK 4 — Quiz distractor quick-scan (homogeneity check)

### What
Spot-check the distractor quality of a sample of facts in the **trivia DB** (`facts.db`, used by Trivia Dungeon) and the **curated decks** (`data/decks/*.json`). Goal: identify how widespread the "Homer's Iliad as a distractor for a fraction question" problem is. The user asked for a *quick scan*, not an exhaustive audit.

### Why
LLM tester reported multiple charge questions where the distractors were trivially separable from the correct answer by category (one is a fraction, three are clearly not; one is an action, three are not). Trivializes the core "knowledge matters" mechanic. Tester quote: *"answers derivable from question grammar alone."*

### Procedure
1. Pull a **sample of ~50 facts** randomly drawn from `facts.db` (Trivia Dungeon) — split across the 7 domains.
2. Pull a **sample of ~30 facts** from 3 curated decks (pick small/representative decks — e.g. one knowledge, one vocab, one language). The user said "some" — these counts are guides, not strict.
3. For each, examine the 4 choices and rate: do they share grammatical category (noun/verb/year/place/number)? Do they share semantic category (all rivers, all years, all chemical elements)?
4. Categorize each fact as:
   - **PASS** — all 4 choices in same category
   - **FAIL** — at least one distractor from a different category
5. Report the FAIL rate per source.

### Output
Write findings to `docs/roadmap/active/distractor-quality-sample-2026-05-12.md`:
- Sample size per source
- FAIL rate per source
- 5-10 concrete examples of FAIL distractor sets (fact ID, question, choices, why it fails)
- Recommendation: is the FAIL rate <5% (ship it) / 5-15% (needs targeted re-gen for failing facts) / >15% (needs a deck-level distractor-regen pass)?

### Constraints
- Read-only on the data — don't mutate `facts.db` or deck JSONs in this task. The remediation is a separate task once the scope is known.
- Don't write a script that touches every fact — the user said *quick scan*. ~80 facts total is the target.
- If a curated deck obviously already has perfect homogeneity (e.g. "JLPT N5 vocabulary" where every distractor is by definition another vocab word), say so and skip it.

### Acceptance criteria
- New report file at the path above.
- FAIL rate computed for both sources.
- Recommendation for next step (none / targeted regen / full regen).

---

## TASK 5 — Card upgrade L0→L1 "same damage" UX (Strike specifically)

### What
The Reading Nook mystery event upgraded Strike from L0 to L1 and displayed both cards with "Deal 4 damage" — identical numbers. Tester wrote: *"a first upgrade that shows the same number on both faces will read as broken to a new player."* On investigation, this is intentional: Strike's mastery stat table at `src/services/cardUpgradeService.ts` defines L0 and L1 both with `qpValue: 4`.

### Why
First-impression cost is high. The Reading Nook is one of the earliest meaningful "your knowledge changed something" moments in the game. If the change isn't visible, the player concludes the upgrade system doesn't work, and the rest of the mastery loop is poisoned in their head.

### Two design options — pick one
1. **Bump Strike L1's `qpValue` from 4 to 5.** Simple, makes the upgrade feel real. Sim impact: small (Strike is a starter card; one extra damage per L1 charge is marginal in aggregate). After change, run `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 300 --profile competent` and confirm competent win rate doesn't jump >5%.
2. **Keep L1 qpValue at 4 and have the upgrade reveal show what DOES change.** E.g. surface the chain bonus, the tag changes, the `secondaryValue` if any. Update `src/ui/components/CardUpgradeRevealOverlay.svelte` to display deltas, not just the qpValue number.

Option 1 is faster; Option 2 is better long-term but requires UI work. The user has not specified — pick the simpler one (Option 1) unless you find Strike L1 is genuinely doing something interesting at L1 that the reveal isn't surfacing.

### Where
- `src/services/cardUpgradeService.ts` — `MASTERY_STAT_TABLES.strike`, around line 68 per the original diagnosis.
- `src/ui/components/CardUpgradeRevealOverlay.svelte` (if Option 2).

### Acceptance criteria
- After the change, run the Reading Nook scenario and confirm the reveal shows a visible delta.
- Update `docs/mechanics/cards.md` with the new Strike progression curve OR with the new "L1 shows tag/chain-bonus" UX rule.

### Constraints
- Don't change Strike L0. L0 is the base every other card balances against.
- Don't change any other card's mastery curve. Strike only.

---

## TASK 6 — Texture leak follow-up (`CombatAtmosphereSystem`)

### What
Two unguarded `createCanvas()` calls in `src/game/systems/CombatAtmosphereSystem.ts` at lines 609 and 698. Same fix pattern as the WeaponAnimationSystem fix that shipped yesterday (`8337003dd`).

### Why
Phaser silently no-ops duplicate texture-key registrations, leaving stale textures from the previous encounter. Functionally invisible but produces "Texture key already in use" console noise, and may eventually cause visual glitches if the texture was meant to be re-sized on the new scene.

### Fix
Wrap each `createCanvas(texKey, ...)` with:
```ts
if (this.scene.textures.exists(texKey)) {
  this.scene.textures.remove(texKey)
}
// existing createCanvas call
```

Match the pattern used in the WeaponAnimationSystem fix — same author intent.

### Acceptance criteria
- Both call sites guarded.
- Console errors `Texture key already in use:` no longer appear during combat → reward → map cycles. (Run any combat scenario via Docker visual verify and check the result.json `consoleErrors` field.)

### Constraints
- The texKey variable name might differ at each site — match it locally. Don't introduce a constant.
- Don't refactor the atmosphere system. Minimal surgical change.

---

## TASK 7 — Single-choice quiz bug (stroke-cases per 100K)

### What
LLM tester reported one call to `previewCardQuiz` returned a single-entry `choices` array for a "stroke cases per 100K" question: `choices: ["213 cases"]`. The combat actually completed normally, so either the preview API truncated, or the underlying fact has a malformed distractor pool.

### Why
Unknown blast radius — could be a one-off content bug or could affect many facts. A single-choice quiz is uncomfortable for players and breaks the multiple-choice contract.

### Investigation
1. `grep -r "213 cases" data/decks/ public/data/` and `grep -rE "stroke.*100K|stroke cases" data/decks/ public/data/` to find the source fact. If it's in `facts.db`, query: `sqlite3 public/facts.db "SELECT * FROM facts WHERE quizQuestion LIKE '%stroke%'"`.
2. Check the fact's `distractors` array — should have ≥3 entries.
3. If the data is correct, look at `src/dev/playtestAPI.ts` `previewCardQuiz` (around line 418) and the underlying `quizService.ts` to see if the preview API filters or truncates.

### Possible outcomes
- **Content bug:** fix the fact's distractors. Single edit.
- **API bug:** `previewCardQuiz` is truncating. Real bug — fix the API.
- **Race condition:** the quiz hasn't fully initialized when previewed. Add a poll like the recent `answerQuiz` fix (`fc17ac8b2`).

### Acceptance criteria
- Root cause identified and documented in the commit message.
- Fix applied to the appropriate layer (data / API / quiz service).
- Add a defensive assertion in `previewCardQuiz` that throws/returns `{ok: false}` if `choices.length < 3` so future occurrences are loud.

---

## TASK 8 — Single-choice mystery events feel like placeholder content

### What
Floor-5 mystery event in yesterday's run had a single "Continue" button and granted +30 gold. The "mystery event" label promises a choice; a single button doesn't deliver one.

### Why
Tester quote: *"Feels like a content slot wasn't filled."* In a roguelite, every node on the map is a story beat. A node with no actual decision is dead air.

### Investigation
1. Find single-choice mystery events in [`src/data/mysteryEvents.ts`](../../../src/data/mysteryEvents.ts) or wherever the tier-1 narrative pool lives (referenced from `src/services/floorManager.ts:884-888`).
2. Count how many have exactly one choice. Report the count.

### Two design options
1. **Flesh out the content** — add a real choice (Take +30 gold / Take +5 HP / Take a card) to each single-choice event. This requires text generation via the humanizer skill — see `.claude/rules/human-prose.md`. NOT a one-line fix; this is a real content task.
2. **Re-label the node type** — if a mystery has only "Continue", treat it as a free-reward tile, not a "mystery." Re-render the map node icon as a gold/treasure pile, not a `?`. Code-side change in `src/game/scenes/MapScene.ts` or wherever the map glyph is selected.

User has not specified. Option 2 is cheaper and more honest; option 1 is more content but better player experience. **Recommendation: Option 2 first, then add real Option-1 content over time.**

### Acceptance criteria
- Document the count of currently-single-choice mystery events in `docs/mechanics/mystery-events.md` (or create it if missing).
- Pick Option 1 or 2 and implement.
- Update the map-glyph logic if Option 2.

### Constraints
- Any new text in Option 1 must go through `/humanizer` with `voice-sample.md` per `.claude/rules/human-prose.md`. Hard failure if skipped.
- Don't remove any mystery event entirely — repurpose or extend.

---

## Self-Verification protocol (mandatory for every task)

Per `.claude/rules/agent-routing.md` § "Sub-Agent Prompt Template" item 10, every task above MUST end with a self-verification section in its commit message or PR description that includes:

- `git diff <file> | head -30` for every file touched
- The relevant test output (last line of `npx vitest run ...`)
- For visual changes: paths to before/after screenshots from Docker visual verify
- For balance changes: the relevant headless-sim profile output line

A commit that lands a task without this section is a hard failure — re-do it.

---

## Coordination notes

- Tasks 1, 2, 3, 4 are **independent** — Codex can parallelize them across separate worktrees or commits.
- Task 5 should run **after** Task 2 if it affects card balance — but probably independent in practice.
- Task 6 is **completely standalone** — quick win.
- Tasks 7 and 8 are **content-flavored** and should ideally not be bundled with code tasks in the same commit.

If you find yourself wanting to fix something not in this list, append it as TASK 9+ here rather than silently expanding scope. Keep this document as the source of truth.

**Total expected effort:** 4-6 hours focused work, assuming Task 1's verification finds the modal works for humans (otherwise add 1-3 hours for the human-side fix).
