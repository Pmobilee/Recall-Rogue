# Playtest Batch Summary — BATCH-2026-04-12-002
**Date:** 2026-04-12 | **Tracks:** 16 | **Waves:** 5 | **Commit:** `18743ff2a` | **Duration:** ~2h 10m
**Preflight:** 6193 tests passed, 0 errors, build clean

## Overall Verdict: **FAIL**

5 CRITICAL bugs confirmed — 3 are player-facing content corruption visible to every player. The `{N}` brace-token leak in quiz distractors (converging evidence from 4 independent tracks) is the #1 Steam-launch blocker. Two encounter-start relics are silently broken. The `world_cuisines` deck ships with 0 playable facts. The human anatomy study session freezes on image-only facts.

## Tester Verdicts

| Track | Focus | Verdict | Critical | High | Medium | Low |
|-------|-------|---------|----------|------|--------|-----|
| 1 | Known-Critical Regressions | ISSUES | 1 | 0 | 0 | 2 |
| 2 | Combat Core Mechanics | ISSUES | 0 | 0 | 1 | 3 |
| 3 | Quiz Content Quality (50+ samples) | FAIL | 2 | 2 | 0 | 0 |
| 4 | Full Run Bug Hunter | ISSUES | 0 | 3 | 4 | 2 |
| 5 | FSRS Scheduling | PASS | 0 | 0 | 0 | 0 |
| 6 | Card Mechanics (22+ tested) | PASS | 0 | 0 | 1 | 1 |
| 7 | Relic Triggers (15 tested) | FAIL | 2 | 0 | 2 | 1 |
| 8 | Visual Screen Sweep (26 screens) | PASS | 0 | 0 | 1 | 2 |
| 9 | Ascension Scaling | PASS | 0 | 0 | 1 | 2 |
| 10 | Edge Cases & Stress | ISSUES | 0 | 3 | 3 | 1 |
| 11 | Mystery/Shop/Rest | PASS | 0 | 0 | 1 | 2 |
| 12 | Card Mastery L0-L5 | PASS | 0 | 0 | 0 | 0 |
| 13 | Headless Balance Sim (6000 runs) | ISSUES | 0 | 0 | 1 | 1 |
| 14 | Deck Diversity (6 decks) | ISSUES | 1 | 0 | 1 | 1 |
| 15 | API Documentation Drift | FAIL | 1 | 0 | 4 | 3 |
| 16 | Save/Load Integrity | PASS | 0 | 0 | 0 | 0 |
| **TOTAL** | | **FAIL** | **7** | **8** | **20** | **21** |

## Cross-Track Converging Evidence

Issues flagged by multiple tracks get highest confidence.

- **[4x CONVERGING] `{N}` brace-token leak in quiz distractors** — Tracks 1, 3, 4, 14. Root cause confirmed: `quizService.ts:229` applies `displayAnswer()` to correct answer but NOT distractors. Also `quizService.ts:188` `getBridgedDistractors()` returns raw brace strings. One-line fix each. 34+ facts across 5+ decks affected. Steam-review fuel.

- **[3x CONVERGING] `shopBuyRelic` / `getShopInventory` API broken** — Tracks 1, 10, 15. `shopBuyRelic()` opens modal but doesn't confirm. `getShopInventory()` returns `{}`. Shop UI itself works fine via DOM interaction.

- **[2x CONVERGING] `startRun()` destination drift** — Tracks 4, 15. Documented as going to `dungeonMap`, actually goes to `deckSelectionHub`. Every tester profile that follows documented flow breaks.

- **[2x CONVERGING] Encounter-start relic effects broken** — Tracks 7 (live verification), 13 (statistical: 0 triggers for plague_flask, thick_skin). `encounterBridge.ts` doesn't read `encounterStartPoison` or `thickSkinBlock` from resolver results.

## All Issues by Severity

### CRITICAL (7)

1. **[Tracks 1,3,4,14 — 4x confirmed] `{N}` brace-token leak in quiz distractors.** `quizService.ts:229` — add `.map(d => displayAnswer(d))` to distractor slice. `quizService.ts:188` — wrap bridged distractors in `displayAnswer()`. 34+ facts, 5+ decks. Player sees `{2015}` as answer choices.

2. **[Track 7] `plague_flask` encounter-start poison never fires.** `encounterBridge.ts:848-861` — `resolveEncounterStartEffects` return value's `encounterStartPoison` field is never read. Also affects `thick_skin`, `red_fang`, `gladiator_s_mark`.

3. **[Track 7] `thick_skin` encounter-start block never fires.** Same root cause as #2 — `thickSkinBlock: 5` returned by resolver but never applied to player state.

4. **[Track 3] `world_cuisines` deck has ZERO facts in factsDB.** 141 facts in JSON, 0 at runtime. `npm run build:curated` likely hasn't ingested this deck or there's an ID/domain mismatch.

5. **[Track 14] Human anatomy study session serves only `image_answers` facts.** `generateStudyQuestions()` selects `ha_visual_*` facts with `quizMode: "image_answers"` — unrenderable in text overlay, freezes session.

6. **[Track 15] `startRun()` API destination wrong.** Documented as `dungeonMap`, actual is `deckSelectionHub`. Blocks all tester automation flows. `deckSelectionHub` missing from `getScreen()` docs.

7. **[Track 15] `getShopInventory()` returns `{}`.** Completely unimplemented. No shop data accessible via API.

### HIGH (8)

8. **[Track 3] Cross-category distractor contamination in 4 decks.** Hindu city names as Christianity distractors, animal speeds as mammal weight distractors, feudal terms as printing-date distractors.
9. **[Track 3] Duplicate factIds in single combat hand.** Same fact at card indices 1 and 4 — player sees identical question twice per turn.
10. **[Track 4] `getCombatState` returns wrong HP during End Turn confirmation dialog.** Shows pre-dialog cached values.
11. **[Track 4] `selectMapNode(N)` format mismatch.** API uses integer, DOM uses `map-node-r{row}-n{col}`.
12. **[Track 10] `shopBuyRelic` returns false success when shop inventory empty.** `{ok:true}` with no gold deduction.
13. **[Track 10] Max-relic (5) cap enforcement unclear.** No swap overlay appears; purchase silently rejected.
14. **[Track 10] `snapshot`/`restore` usage pattern footgun.** `restore(snapshot('name'))` is a silent no-op (takes new snapshot at restore-time).
15. **[Track 3] Study quiz unauditable via automation API.** `getStudyCard()` always returns null, no testid on answer buttons.

### MEDIUM (20)

16. **[Track 2] Two divergent fizzle implementations.** `turnManager.ts` inline path ignores `mechanic.chargeWrongValue`, uses `baseEffectValue * 0.5`. Production fizzle differs from resolver fizzle.
17. **[Track 4] `getMysteryEventChoices` returns `[]` for quiz/continue-type events.** Only works for choice-type events.
18. **[Track 4] Enemy maxHP escalates across warm-container batches.** 30 → 32 → 36 → 38 over successive tests.
19. **[Track 6] `fortify` description says "Double your current block" but gives +50%.** Misleading card text.
20. **[Track 7] `iron_shield` triggers as `iron_buckler` (old v1 name).** No visual relic feedback.
21. **[Track 7] `iron_shield` scaling formula dead code.** `shieldsPlayedLastTurn` never forwarded to resolver.
22. **[Track 8] Card-reward header off-screen (y=-175).** `h1 "Choose a Card"` invisible.
23. **[Track 9] `ascension-15-elite` preset has stale turnOverrides.** Old values from pre-balance passes.
24. **[Track 10] `spawn({hand:[]})` silently ignored.** Loads default 5 cards.
25. **[Track 10] `setGold(0)` silently no-ops.** Gold unchanged.
26. **[Track 10] `enemyHp:9999` injection causes state/display desync.** Phaser reads definition HP.
27. **[Track 11] `canMeditate()` uses `> 5` but UI says "min 5".** Off-by-one in messaging.
28. **[Track 13] `experienced` profile 97% win rate.** Above 70-90% target, difficulty too flat.
29. **[Track 15] `look()` returns string, documented as object.** `getAllText()` returns object, documented as string.
30. **[Track 15] `getRewardChoices()` returns `{}` not `[]`.** Length check silently wrong.
31. **[Track 15] `getStudyPoolSize()` returns `{}` not number.** Conditional checks always truthy.
32. **[Track 15] 18 undocumented `__rrPlay` methods.** Including useful ones: `answerQuizCorrectly`, `getStats`, `getSave`.
33. **[Track 4] Broken quiz question missing "Latin".** `general_knowledge-romance-languages-vulgar-latin`.
34. **[Track 14] `getStudyCard()` returns null for all study decks.** Missing `data-testid`.
35. **[Track 11] `knowledge_gamble` parallax depth map 404.** Background renders via fallback.

### LOW (21)

36-56. Various: timer format reversed, onboarding z-index, study-deck-rome preset not wiring, endTurn returns ok:true on non-combat screen, scavengers_eye hand size anomaly, iron_shield `shieldsPlayedLastTurn` gap, scenario API footguns, Docker warm container grace period, phoenix feather once-per-run unimplemented, SURGE_DRAW_BONUS undocumented, endTurn polling window too short, `deckSelectionHub` undocumented, `__rrScenario.scenarios` is property not function, `getLeechInfo` has undocumented key, Docker 6fps degradation, various spawn API gaps.

## Comparison to Previous Batches

### vs BATCH-2026-04-12-001 (56 issues, 4 critical)
| Bug | B12 Status | B002 Status |
|-----|-----------|-------------|
| `{N}` template leak (correct answers) | CRITICAL | **FIXED** |
| `{N}` template leak (distractors) | Not found | **STILL CRITICAL** (root cause different) |
| `chargePlayCard` crash on continued-run | CRITICAL | **FIXED** (Track 1 + Track 16 confirm) |
| Shop relic click no-op (UI) | CRITICAL | **FIXED** (tooltip-backdrop pointer-events resolved) |
| Cross-category distractors | CRITICAL | **STILL REPRODUCING** (Track 3 + Track 14) |
| `turnsRemaining: 9998` UI leak | HIGH | **FIXED** (UI shows infinity; API still leaks) |
| `startStudy()` softlock | HIGH | **FIXED** |
| `getMysteryEventChoices` broken | HIGH | **PARTIALLY FIXED** (works for choice-type, not quiz-type) |

### New Findings Not in Previous Batches
- Encounter-start relic effects broken (plague_flask, thick_skin, red_fang, gladiator_s_mark)
- `world_cuisines` deck ships with 0 facts
- Human anatomy study freezes on image_answers facts
- Two divergent fizzle implementations
- `fortify` description mismatch
- `iron_shield` legacy name + dead scaling code
- Card-reward header off-screen
- 18 undocumented API methods
- `experienced` profile 97% win rate (balance)
- Comprehensive mastery scaling verification (all clean)
- Full FSRS scheduling verification (all clean)
- Save/load + Set/Map serialization (all clean)

## Systems Verified Clean (6/16 tracks PASS)

| System | Track | Result |
|--------|-------|--------|
| FSRS scheduling (learning, leeches, fastForward, mastery) | 5 | PASS |
| Card mastery L0-L5 scaling (12 mechanics) | 12 | PASS |
| Save/load integrity + Set/Map serialization | 16 | PASS |
| Visual rendering (23/26 screens) | 8 | PASS |
| Mystery/Shop/Rest room interactions | 11 | PASS |
| Card mechanics (22+ tested) | 6 | PASS |

## Top 5 Recommendations (by impact)

1. **Fix `{N}` distractor leak** — Two one-line fixes in `quizService.ts` (lines 188 and 229). Blocks Steam launch. Every player will see it within 5 minutes.

2. **Wire encounter-start relic effects** — `encounterBridge.ts` needs to read `encounterStartPoison`, `thickSkinBlock`, and other fields from `resolveEncounterStartEffects` return. 4+ relics silently broken.

3. **Ingest `world_cuisines` deck** — Run `npm run build:curated` or fix ID/domain mismatch. 141 facts written but 0 playable.

4. **Fix `generateStudyQuestions()` image_answers filter** — Filter out `quizMode: "image_answers"` facts for text-based study overlay. Human anatomy deck study is broken.

5. **Update action-specs.md** — `startRun()` destination, return shapes for `look`/`getAllText`/`getRewardChoices`/`getStudyPoolSize`, document 18 missing methods. Every future tester batch will hit these.

## Coverage Matrix

| System | Tracks | Result |
|--------|--------|--------|
| Combat core (AP, surge, chains, status effects, block, intents) | 2, 4, 13 | Clean |
| Quiz content quality (50+ samples, 10 decks) | 3, 14 | 2 CRITICALs |
| FSRS scheduling (learning, leeches, fastForward) | 5 | Clean |
| Card mechanics (22+ individually tested) | 6 | Clean |
| Card mastery L0-L5 | 12 | Clean |
| Relic triggers (15 tested) | 7, 13 | 2 CRITICALs |
| Visual rendering (26 screens) | 8 | 1 MEDIUM |
| Ascension scaling (5 levels) | 9 | Clean |
| Edge cases (7 scenarios) | 10 | 3 HIGHs (API tooling) |
| Mystery/Shop/Rest | 11 | Clean |
| Balance (6000 runs) | 13 | 1 MEDIUM (experienced 97%) |
| Deck diversity (6 decks) | 14 | 1 CRITICAL |
| API drift (all methods) | 15 | 1 CRITICAL + 4 MEDIUMs |
| Save/load + serialization | 16 | Clean |
| Known regressions (7 from B12) | 1 | 4 fixed, 2 partial, 1 still reproducing |
