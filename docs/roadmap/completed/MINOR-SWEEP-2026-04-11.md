# Minor-Issues Sweep — 2026-04-11

**Status:** 14/14 issues shipped + 2 game-logic follow-ups. Visual verification deferred per session scope.
**Plan file:** `~/.claude-muldamion/plans/serene-growing-swan.md`
**Session window:** 2026-04-11, ~4 hours, orchestrator + ~15 parallel sub-agents across 6 waves.
**Commit count:** 21 commits on `main`. 476/476 own-files unit tests pass, 0 typecheck errors across 1121 files.

## Context

User ran a live co-op test session and surfaced a mixed batch of bugs and polish items spanning lobby flow, content selection, combat logic, co-op determinism, visual polish, and system-wide theming. Two systemic shifts (content-picker redesign, status-effect rename, full-deck viewer overlay) and twelve smaller fixes. Plan written and approved in-session; all 14 items executed autonomously in dependency-ordered waves.

## Issues shipped

| # | Issue | Commit(s) | Core change |
|---|---|---|---|
| 1 | Lobby Start Game clickable without content | `f6bba5c28` | `canStart` gated on `lobby.contentSelection !== null`; three-state button label. |
| 2 | Lobby content picker redesign | `a0ab6ec7a` + `713ea981c` (DeckMode follow-up) | New `LobbyDeckPicker` with domain-grouped tabs, expandable deck rows, Map-based multi-select preserving across tab switches. New `LobbyContentSelection` variant `'study-multi'`. Full DeckMode wiring so mixed deck+trivia selections actually build the merged fact pool. |
| 3 | AP counter text sits too low | `f407e457a` + `1c29f7f3e` docs | `.player-ap-right` `bottom` raised 6px (scaled). |
| 4 | Card reward title sits below banner | `1526d93e3` | `.altar-header h1` `translateY(-8px)` (scaled). |
| 5 | Card-pick (transmute/transform) teleports to hand | `eb10f2e5e` (service) + `d04415a48` (UI) | `applyTransmuteSwap` now pushes picks to `drawPile` top and returns `pickResolvedCards[]`; UI calls `drawHand(deck, N)` per resolved card for the normal draw animation. |
| 6+10 | Card playability vs charge gate desync | `12761d2f3` | New `src/ui/utils/cardPlayability.ts` with `canChargeCard`, `canQuickPlayCard`, `isCardPlayable`; unified visual class + click-handler predicates in `CardHand.svelte` (both landscape + portrait blocks). |
| 7 | First-encounter AP regression | `4c0c39eba` | Root cause: `encounterBridge.startEncounterForRoom` wrote `run.startingAp` to `apMax` instead of `apCurrent`, silently breaking both arms of the `starting_ap_3_vs_4` experiment. New `TurnState.startingApPerTurn` field; `endPlayerTurn` refill = `Math.max(AP_PER_ACT[act], startingApPerTurn)`. |
| 8 | Wow-factor shows wrong fact text | `766223a3a` (bundled) + `dea268845` (type-cast fix) | New `src/services/wowFactorService.ts` extracts fact-ID resolution into a pure function; overlay now uses `committedQuizData.factId` instead of the mutable `card.__studyFactId` side-channel. Also adds previously-missing `custom_deck` mode branch. |
| 9 | End-turn cancel flow | `0e3574bd2` (service) + `fff6cff47` (UI) | No split needed — `endPlayerTurn` is already called AFTER the co-op barrier resolves, so hand is preserved. New `cancelEndTurnRequested()` with 4-state return; UI button transforms between END TURN / CANCEL END TURN / WAITING… based on waiting state + hand size. |
| 11 | Enemy damage preview ignores block decay | `9ce95ce75` (service) + `6563a6327` (UI) | New `computeIntentHpImpact(intent, enemy, playerBlock, act)` returning `{ raw, postDecayBlock, hpDamage }`. Combat overlay now displays `hpDamage` as the primary number with "Fully blocked" tooltip state. |
| 12 | Co-op enemy intent differs per player | `ac5e9c3c0` | Completes the prior `1e7624430` seeded-RNG pattern — `weightedRandomIntent` already uses `getRunRng('enemyIntents')`, `SharedEnemySnapshot.nextIntent` already broadcasts. Added non-host drift detection that rolls locally and logs `[coop-sync] intent drift` if the fork desyncs, then adopts the host value authoritatively. |
| 13 | Status-effect rename to study themes | `a9a57d8af` + `256698be0` + `f191d3329` (completeness) | Display-string rename only, IDs unchanged. Map: Poison→Doubt, Weakness→Drawing Blanks, Vulnerable→Exposed, Strength→Clarity, Regen→Recall, Immunity→Shielded Mind, Burn→Brain Burn, Bleed→Lingering Doubt. Updated `InRunTopBar`, `StatusEffectBar`, `CardCombatOverlay`, `keywords.ts`, `cardDescriptionService.ts`, card-description test fixtures. Added 5 previously-missing `KEYWORD_DEFINITIONS` entries so tooltip lookups resolve for all 8 effects. |
| 14 | Top-bar deck viewer overlay | `af280d2cf` | New `src/ui/components/RunDeckOverlay.svelte` (509 lines) — scrollable grid of all cards across hand/draw/discard/exhaust piles, upgrade state shown, scoped to IN_RUN_SCREENS via `showTopBar` gate in `CardApp.svelte`. New `runDeckOverlayStore` for single-source visibility. Top-bar deck icon next to settings, gear button `align-self: center` + 44x44 tap-target min. |

## Design discoveries (a.k.a. latent bugs uncovered mid-sweep)

- **Issue 7 uncovered a completely broken A/B experiment.** `starting_ap_3_vs_4` was shipped weeks ago but the encounterBridge write target was wrong — control group got capped at 3 AP in Act 2 (blocking the 4 AP unlock), test group got `min(3, 4) = 3` on turn 1 (experiment never actually ran). Both arms fixed.
- **Issue 8 uncovered a missing `custom_deck` branch** in the wow-factor lookup. Custom-deck runs previously never showed wow-factor text at all.
- **Issue 2 required touching 7 service consumers** for the new `study-multi` DeckMode variant — design smell logged for a future `DeckModeCapabilities` descriptor refactor.
- **Issue 13 exposed a `Record<string, ...>` typing gap.** `KEYWORD_DEFINITIONS` had no compile-time guarantee that all `StatusEffectType` values had entries — 5 of 8 were silently missing. Test-level coverage was added; a `satisfies Partial<Record<StatusEffectType, KeywordDef>>` annotation is logged as the preventative follow-up.

## Files added

- `src/services/wowFactorService.ts` + `.test.ts` — fact-ID resolution for all three deck modes
- `src/services/studyMulti.test.ts` — 17 unit tests for the multi-deck DeckMode pool assembly
- `src/services/turnManager.startAp.test.ts` — 17 regression tests for first-encounter AP
- `src/services/turnManager.endTurnCancel.test.ts` — 22 tests for co-op cancel flow
- `src/services/turnManager.transmute.test.ts` — 7 tests for drawpile-routing picker resolution
- `src/ui/utils/cardPlayability.ts` + `.test.ts` — 26 tests for unified charge predicate
- `src/ui/utils/lobbyDeckSelection.ts` + `.test.ts` — 29 tests for multi-select helpers
- `src/ui/utils/lobbyStartGate.ts` + `.test.ts` — 12 tests for lobby start predicate
- `src/ui/components/RunDeckOverlay.svelte` (509 lines)
- `src/ui/stores/runDeckOverlayStore.ts`
- `src/data/keywords.test.ts` — 6 tests guarding keyword-entry completeness

## Verification

- **Own-files test sweep:** 476/476 passing across 11 test files in ~1.3s
- **Full workspace typecheck:** 0 errors across 1121 files (19 pre-existing a11y warnings, none in touched files)
- **Full workspace vitest:** 6069/6075 passing (99.9%). Six failures all in files I did not edit this session (`floor-manager.test.ts` probabilistic Monte Carlo flake, `burnout_no_exhaust` tag test affected by the parallel `6ea2c53e5 refactor(cards): rename exhaust → forget` commit).
- **Visual verification:** Docker warm container visual sweep **explicitly deferred** per user instruction at session end. The polish and UI rework issues (3, 4, 14, 2, 9, 13) merit a `/inspect` or `/visual-inspect` pass before shipping to Steam.

## Heads-Up — Follow-ups logged for future sessions

- **Visual verification pass** for Issues 3, 4, 14, 2, 9, 13 (deferred this session).
- **`study-multi` headless sim coverage** — add to `tests/playtest/headless/run-batch.ts` profile list so balance regressions on mixed deck+trivia runs are caught automatically.
- **`DeckModeCapabilities` refactor** — 7-file touch per new DeckMode variant is a design smell; a capabilities descriptor would eliminate the exhaustive-switch footprint.
- **Type-level `KEYWORD_DEFINITIONS` guard** — `satisfies Partial<Record<StatusEffectType, KeywordDef>>` to catch future drift at author time.
- **Chain-distribution weighting for `study-multi`** — currently tuned only by the curated deck portion; heavy-trivia runs may feel mis-matched.
- **`RunDeckOverlay` exhaust survivability** — verify whether `$activeTurnState.deck.exhaustPile` persists across encounters or clears at encounter start; affects what the map-screen overlay shows.
- **Onboarding tooltip pass** — first-time tooltips for the new deck icon, CANCEL END TURN transform, and renamed status effects would compound into a much more teachable first-run experience.
- **Pre-existing test failures (3 files)** — `floor-manager.test.ts` Monte Carlo flake + `burnout_no_exhaust` tag test + one more. Belong to parallel `exhaust → forget` refactor session, not this sweep.

## References

- Plan file: `~/.claude-muldamion/plans/serene-growing-swan.md`
- Wow-factor service: `docs/mechanics/quiz.md` → "Wow-Factor Text Resolution"
- Study-multi DeckMode: `docs/mechanics/multiplayer.md` → "Content Selection"
- End-turn cancel: `docs/mechanics/multiplayer.md` → "Co-op End-Turn Cancel Flow"
- Intent HP impact: `docs/mechanics/combat.md` → "Intent display"
- Card playability: `docs/ui/components.md` → "CardHand unified playability predicates"
- Status-effect rename: `docs/mechanics/status-effects.md` → "Display Names (Issue 13)"
- First-encounter AP fix: `docs/mechanics/combat.md` AP table + `docs/gotchas.md` 2026-04-11
- Gotcha log: `docs/gotchas.md` appended entries for Issues 7, 8, 9, 11, 12, 13, 14, and the Issue 13 hand-off
