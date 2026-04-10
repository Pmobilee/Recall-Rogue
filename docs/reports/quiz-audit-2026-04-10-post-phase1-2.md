# Quiz Audit — Post-Phase-1+2 Snapshot

**Date:** 2026-04-10
**Branch:** `fix/deck-quality-2026-04-10`
**Status:** intermediate snapshot — Phase 3 (auto-fix scripts) and Phase 4 (structural refactors) not yet run.

## Headline

After 11 commits implementing engine fixes (Phase 1) and targeted content fixes (Phase 2), pattern counts measured by mechanical grep against the regenerated `data/audits/quiz-dumps/`:

| Pattern | Baseline (2026-04-10) | Post-Phase-1+2 | Δ |
|---|---|---|---|
| `this` placeholder in question stem | 27 facts (across 8 decks) | **0** | -27 |
| `anatomical structure X` placeholder | 50+ facts (human_anatomy) | **0** | -50 |
| Reverse-template English distractors (foreign-script answer) | ~150 rows (20 decks) | **0** | -150 |
| `definition_match` self-answering via explanation | ~150 rows (15 decks) | **0** for the explanation-leak class | -150 |
| `reading` template on phonetic-form word | ~30 rows (JLPT) | **0** | -30 |
| Generic self-answer (other classes — answer leaks into question via different mechanisms) | ~210 (whole MAJOR tier) | **96** | -114 (still high) |
| Numeric distractor > 100 for percentage answer | ~5 confirmed | **12** detected (broader scan) | net +7 (broader detector) |

**Total directly resolved by Phase 1+2: ~407 issue instances** (27 + 50 + 150 + 150 + 30).

## Engine fixes landed

| # | Fix | Commit | Affected decks | Test |
|---|---|---|---|---|
| 1 | Reverse template draws from target-language pool | `d89d33bcc` | ~20 vocab decks | `curatedDistractorSelector.reverse.test.ts` (6 tests) |
| 2 | `definition_match` ineligible when explanation contains answer | `9a5a4bbc7` | ~15 vocab decks | `questionTemplateSelector.definitionMatch.test.ts` (19 tests) |
| 3 | `reading` template ineligible when reading == targetLanguageWord | `f55222ee8` | JLPT N1-N5 | `questionTemplateSelector.readingEligibility.test.ts` (15 tests) |
| 4 | Numeric distractor domain detection + clamping | `c2ae82b33` | solar_system, AP physics/chem | `numericalDistractorService.domain.test.ts` (21 tests) |
| 5 | N1 fallback investigation | (no commit) | classified as Phase 4 content fix (task #37) | n/a |

**Total new regression tests: 61.**

## Content fixes landed

| # | Fix | Commit | Facts |
|---|---|---|---|
| 2.1 | "this" placeholder cluster (8 decks) | `3aa31709d` + `d36a479e1` | 91 + 17 = 108 |
| 2.2 | `human_anatomy` "anatomical structure" placeholder | `7cc3457bd` | 47 |
| 2.3 | Reagan USSR factual error | `cf98e7675` | 1 (us_presidents) — reframed to Reagan's actual Cold War role |
| 2.4 | Spanish C1 translation errors | `982b5cd68` | 3 (donde, habitual, sino) |
| 2.5 | Chess `solutionMoves[0]` corruption | `83a259671` | 2 (disabled pending re-extraction) |

**Total individual facts fixed: 161.**

## Remaining patterns to address (Phases 3, 4)

### Self-answer (96 remaining instances)

Concentrated in:
- `human_anatomy` (30) — likely the audit's earlier MAJOR-tier self-answering facts not in the placeholder cluster
- `spanish_c1` (18) — cognates where the Spanish word is similar to English answer
- `dutch_b2` (11) — same cognate pattern (German/Latin doublets)
- `dutch_a2` (6) — same
- `french_b1` (4), `dinosaurs` (3), `dutch_a1` (3), `dutch_b1` (3), `german_a1` (3), `ap_biology` (3), `periodic_table` (3), `spanish_a1` (3), `french_a2` (3), `french_a1` (1), `german_b2` (1), `korean_topik1` (1)

**Phase 3 plan:** run `node scripts/fix-self-answering.mjs --dry-run` and review. If it covers most cases, apply.

### Numeric > 100 for percentage (12 remaining)

- `solar_system` (3) — likely the original `sun_mass_percentage` neighbours
- `world_wonders` (3), `ap_world_history` (3), `mammals_world` (2), `famous_inventions` (1)

**Root cause:** the engine fix improved variant generation, but some facts whose `correctAnswer` is a bare number (no `%`) and whose question lacks `percent`/`percentage` keywords still slip past the detector.

**Phase 3 plan:** for each of these 12 facts, edit the `quizQuestion` to include the word "percentage" or rephrase. Or extend the detector to look for `chainThemeId` / category hints.

## What Phase 1+2 did NOT address (still pending)

- Mega-pool POOL-CONTAM (Phase 4.1 — AP decks)
- POS-separated vocab pools (Phase 4.2 — Spanish/French/German)
- History catch-all pool splitting (Phase 4.3)
- Numeric pool misclassification (Phase 4.4)
- Empty chainThemes on knowledge decks (Phase 4.5)
- HSK6 CC-CEDICT sense alignment + regeneration (Phase 4.6)
- Dutch B1/B2 delisting (Phase 4.7)
- JLPT kanji template addition (Phase 4.8 — new task from N1 investigation)
- Verify-all-decks + quiz-audit-engine extension (Phase 5.1, 5.2)

## Verification steps run

- `npm run typecheck` — passes
- `npx vitest run` — all engine fix regression tests pass (61 new tests)
- `node scripts/verify-all-decks.mjs` — 0 NEW failures from Phase 1+2 changes
- Re-ran `audit-dump-samples.ts` (full sweep, 10,212 rows in 3 seconds)
- Mechanical pattern grep against new dumps (this report)

## Next session continues with Phase 3

`/docs/reports/quiz-audit-2026-04-10.md` is the diagnostic baseline.
This file is the intermediate snapshot.
`docs/reports/quiz-audit-2026-04-1X-postfix.md` will be the final post-fix report after Phase 6.
