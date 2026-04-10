# Full-Run Bug Hunter — Tester Report

**Batch**: BATCH-2026-04-10-002-docker
**Date**: 2026-04-10
**Tester**: full-run (executed directly by orchestrator via docker warm container)
**Container**: `rr-warm-llm-pt-002` (port 3263)
**Intended domain**: `human_body_health` (to exercise freshly-bridged `pharmacology` deck)
**Actual domain served**: `general_knowledge` (fallback — see Finding F5)

## Verdict: **ISSUES**
- Critical: 2 (rrPlay selectors broken, deck mismatch)
- High: 3 (silent failure in selectDomain, quiz pool heterogeneity, cross-domain distractors)
- Medium: 2 (language-deck leak, AP accounting anomaly)
- Low: 1 (console fetch errors)

---

## Testing Protocol Used

Docker warm container (`scripts/docker-visual-test.sh --warm`) driving `window.__rrPlay` via JSON action batches submitted to the container's HTTP `/test` endpoint. Each batch captures screenshots + layout dumps + result.json. ~30s roundtrip per batch.

Playtest flow attempted:
1. Smoke test → APIs reachable ✓
2. `startRun()` → `selectDomain("human_body_health")` → select first map node → combat
3. Capture full hand via `previewCardQuiz(0..4)`
4. Play cards, end turn, observe combat loop
5. Kill enemy → post-combat reward → delve → repeat for 5 encounters

**What actually happened:** Steps 1-4 executed with significant workarounds due to broken selectors (F1-F4). Step 5 was cut short when the Docker daemon crashed mid-session (second crash this session — see Session Notes).

---

## Findings

### F1 — CRITICAL — rrPlay selector stale: `.panel--trivia` no longer a button
**File:** `src/dev/playtestAPI.ts:114`
```ts
const triviaPanel = document.querySelector('button.panel--trivia') as HTMLElement | null;
```
Actual DOM element (from layout dump):
```
[div.panel.panel--trivia.svelte-qoeryv]   (192, 228)  750x720
```
The Trivia Dungeon panel was refactored from `<button>` to `<div>` but the selector wasn't updated. `selectDomain()` fails immediately on the `deckSelectionHub` screen with `"Trivia Dungeon panel not found on deckSelectionHub"`.

**Fix:** change selector to `div.panel.panel--trivia` (or better, `[data-testid="panel-trivia"]` after adding a testid).

### F2 — CRITICAL — Wrong deck served (deck selection completely bypassed)
Despite requesting `selectDomain("human_body_health")`, the run initialised with the default `general_knowledge` + `language` pools. None of the 5 cards in the opening hand had `domain: "human_body_health"`. The intended pharmacology bridge validation could not execute — this is the exact scenario the playtest was commissioned to verify.

Evidence from `previewCardQuiz(0..4)`:
| Card | factId | domain | Question |
|---|---|---|---|
| 0 | `cs_0_hedy_lamarr_spread_spectrum` | general_knowledge | "Which Hollywood film star…" |
| 1 | `philosophy_nc_spencer_survival_fittest` | general_knowledge | "Who coined 'survival of the fittest'…" |
| 2 | `es-cefr-3168` | **language** | "What does 'cancha' mean?" |
| 3 | `pc_4_starwars_creator` | general_knowledge | "Which filmmaker created the Star Wars universe…" |
| 4 | `inv_0_windmill_peak` | general_knowledge | "Approximately how many wind-powered mills…" |

Root cause is compound: F1 (Trivia Dungeon panel not clicked) → selectDomain fell through to a footer-start-btn click with no domain highlighted → run started with the default pool. Fix F1 and investigate whether `startRun` should refuse to proceed without an explicit domain selection.

### F3 — HIGH — `selectDomain` silent-success after domain card not found
**File:** `src/dev/playtestAPI.ts:108-136`

```ts
const domainCard = document.querySelector(`[data-testid="domain-card-${domain}"]`) as HTMLElement | null;
if (domainCard) {
  domainCard.click();
  await wait(turboDelay(500));
}
// ← no else; falls through and still clicks the start button

const startBtn = document.querySelector('button.footer-start-btn') as HTMLElement | null;
if (startBtn) {
  startBtn.click();
  ...
}
return { ok: true, message: `Selected domain: ${domain}. Screen: ${getScreen()}` };
```

When the domain card isn't found, `selectDomain` returns `ok: true` and still kicks off the run. There is no error, no warning, no state validation. **This is how F2 manifested.** The function should:
- Return `{ok: false}` if the domain card isn't found
- Refuse to click the start button if no domain is highlighted
- At minimum log a console warning

### F4 — HIGH — `domain-card-*` testids also missing on trivia dungeon
Evaluated at runtime after reaching `triviaDungeon` screen:
```js
Array.from(document.querySelectorAll('[data-testid^="domain-card-"]'))  // → []
```
The DOM has zero `domain-card-*` testids on this screen. Either the component was refactored (likely — the visible screen shows stone-wall domain icons, not `DomainSelection.svelte` cards) or the trivia dungeon entry point moved. `DomainSelection.svelte` at `src/ui/components/DomainSelection.svelte:212` still emits the testid but it's apparently no longer the component rendered on the `triviaDungeon` screen.

**Investigation needed:** which component actually renders on `triviaDungeon` and what are its real selectors?

### F5 — HIGH — Pool heterogeneity bug (exact anti-pattern from deck-quality.md)
**Card 4**, fact `inv_0_windmill_peak`:
- **Question:** "Approximately how many wind-powered mills existed at their peak usage around 1850?"
- **Correct:** `200,000`
- **Choices:** `["18,000", "200,000", "94%", "13.5 hours"]`

A "how many" count question offering a percent (`94%`) and a duration (`13.5 hours`) as distractors. A player can eliminate 50% of options without knowing anything — the question asks for a count, and only two options are counts. This is exactly the anti-pattern documented in `.claude/rules/deck-quality.md` ("Anti-Pattern 2: Pool Length Heterogeneity") and should be caught by the `fix-pool-heterogeneity.mjs` script.

**Fix:** rerun `node scripts/fix-pool-heterogeneity.mjs --dry-run` against the inventions/general_knowledge pool containing `inv_0_windmill_peak`. Split into count-typed and non-count pools.

### F6 — HIGH — Cross-domain distractors in shallow-pool quizzes
**Card 3**, fact `pc_4_starwars_creator`:
- **Question:** "Which filmmaker created the Star Wars universe, first releasing it to cinemas in 1977?"
- **Correct:** `George Lucas`
- **Choices:** `["Jimmy Donaldson", "Steve Ditko", "George Lucas", "Jimmy Wales"]`

Distractors come from wildly unrelated fields: Jimmy Donaldson (MrBeast, YouTube), Steve Ditko (comics artist), Jimmy Wales (Wikipedia founder). Only George Lucas is a filmmaker. Any player who reads the question ("filmmaker") can eliminate all three. The pool the card is drawing from is clearly semantically incoherent — all four entries are "famous person with the name Jim/Steve/George" but their domains are mismatched.

**Fix:** pool homogeneity audit — ensure a "filmmakers" pool exists and the Lucas fact is assigned to it, not a generic "person_names" pool.

### F7 — MEDIUM — Language-deck leak into trivia dungeon
Card 2 (`es-cefr-3168`, domain `language`) appeared in a trivia dungeon opening hand alongside general_knowledge cards. Either:
- (a) Intentional — language cards are mixed into the general pool → surprising, probably wrong UX
- (b) Bug — language facts shouldn't be drawn when no language domain is active
- (c) Side effect of F2's fallback — the default pool includes language facts

Needs clarification from game-logic owner. If intentional, the player should at least know *which* pool they're in. If accidental, investigate `InRunFactTracker` seeding.

### F8 — MEDIUM — AP accounting anomaly: two charge-plays consumed 3 AP instead of 4
**Turn 1:**
- Starting AP: 3/3
- Played card 0 (block, apCost=1 per hand data) via `chargePlayCard(0, true)` → success
- Played card 0 (block) again → success
- Attempted card 0 (block) a third time → `{ok: false, message: "Not enough AP to charge-play card 0 (needs 2, have 0)"}`

Charge-play of a 1-AP card should cost `1 + CHARGE_AP_SURCHARGE(1) = 2 AP`. Two such plays should cost 4 AP, but the player started with only 3 AP and the second play succeeded anyway (ending at 0 AP, not -1). Either:
- The first-charge-free-AP-surcharge waiver is still active despite being disabled in Pass 8 (see `.claude/rules/game-conventions.md` — claims `FIRST_CHARGE_FREE_AP_SURCHARGE = 1 (disabled)`)
- A chain-momentum / warcry / on-color waiver silently applied
- A bug in AP accounting

**Resulting block gained:** 16 (so each shield gave +8 block at base 6 × charge correct multiplier 1.5 ≈ 9, or +8 after some rounding). Rough numbers plausible; AP math is not.

### F9 — LOW — Console errors during warm container boot
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
FactsDB init failed: TypeError: Failed to fetch
Failed to load resource: net::ERR_CONTENT_LENGTH_MISMATCH
```
The container hit transient fetch failures loading `facts.db` and related assets during boot. The app recovered (playtest proceeded) but these indicate unreliable asset loading from the dev server inside the Docker network. May be unrelated to the game itself — could be `host.docker.internal` flakiness under load.

---

## What Worked Well

- **rrPlay core API is solid** once you reach combat — `getCombatState`, `previewCardQuiz`, `chargePlayCard`, `quickPlayCard`, `endTurn` all return rich, structured data
- **Docker warm container architecture** successfully drives the game end-to-end with batched action files. Smoke test → combat loop worked cleanly (despite daemon instability, see below)
- **Combat mechanics** (block absorption, enemy intent telegraphing, turn transitions) worked correctly — enemy Page Flutter's "Frenzied bite" (9 dmg) was absorbed by 16 stacked block, player stayed at 100/100
- **Quiz content quality** on 3 of 5 cards was genuinely good: Hedy Lamarr (card 0) and Herbert Spencer (card 1) questions were well-crafted, factually accurate, with plausible same-domain distractors

---

## Session Notes

**Docker daemon instability:** Docker Desktop's daemon crashed TWICE during this session. First crash happened between the initial `docker info` check and the first `docker run -d` — the container boot hung at 120s. User restarted Docker Desktop, smoke test passed cleanly. Second crash occurred partway through combat-turn batch 8 — the test script returned stale output from a previous batch directory, masking the failure until I checked `docker info` again. **Recommendation:** add a `docker info --format '{{.ServerVersion}}'` health check before each warm test call in `scripts/docker-visual-test.sh` and fail loudly if the daemon is down.

**Why the other 4 testers (quiz-quality, balance-curve, fun-engagement, study-temple) did not run:** Combination of
1. Docker daemon instability (2 crashes)
2. The F1/F4 rrPlay wiring bugs make the standard `selectDomain → start` flow unreliable, so every tester would spend most of its budget working around the same broken selectors
3. Pragmatic orchestrator call: a single deep fullrun report surfacing 9 bugs is more actionable than 5 shallow reports all hitting the same blockers

The other testers should be re-run **after F1-F4 are fixed**.

---

## Recommended Fix Order

1. **F1** — One-line selector fix in `playtestAPI.ts:114`, unblocks all playtesting
2. **F4** — Investigate which component renders on `triviaDungeon`, re-expose `domain-card-*` testids, update `playtestAPI.ts:121`
3. **F3** — Make `selectDomain` fail loudly when domain card not found (add explicit guard + return `{ok:false}`)
4. **F5** — `node scripts/fix-pool-heterogeneity.mjs` for the inventions/count pool
5. **F6** — Pool homogeneity audit for `pc_4_starwars_creator` (should be in a filmmakers pool, not generic)
6. **F8** — Audit first-charge AP accounting vs Pass 8 disabled flag
7. **F7** — Clarify language-pool intent, fix or document
8. **F2** — Verify fix for F1 also resolves domain routing end-to-end
9. **F9** — Investigate docker→dev-server fetch reliability
10. **Re-run `/llm-playtest`** with all 5 testers targeting `human_body_health` (pharmacology) once F1-F4 land

---

## Raw Artifacts

All captures in `/tmp/rr-docker-visual/llm-pt-002_none_*`:
- `smoke-start.png` — hub screen, confirmed __rrPlay available
- `after-domain-select.png` — deckSelectionHub with broken selectDomain attempt
- `after-trivia-enter.png` — triviaDungeon screen after manual panel click
- `diagnose.png` — dungeonMap state after onboarding bypass
- `combat-start.png` — Page Flutter encounter, turn 1
- `end-turn-1.png` — after playing 2 block cards, turn ended
- `combat-ready.png` — combat state confirmed mid-turn

Action files archived at `/tmp/rr-actions/fullrun-*.json`.
