# Quiz Audit — Post-Phase-3 Snapshot

**Date:** 2026-04-10
**Branch:** `fix/deck-quality-2026-04-10`
**Status:** Phase 3 (auto-fix scripts) complete. Phase 4 (structural refactors) still pending.

## Phase 3 Summary

Phase 3 ran 4 auto-fix scripts in sequence. Each committed separately.

| Script | Result | Commits | Files Changed |
|---|---|---|---|
| `fix-self-answering.mjs` | 14 facts fixed across 9 decks | `f0ed78be5` | 9 deck JSON files |
| `fix-pool-heterogeneity.mjs` | 6 pools split across 4 decks | `1ea49d46e` | 4 deck JSON files |
| `add-synthetic-distractors.mjs` | No-op: 0 pools needed padding | `4011c7040` | docs/gotchas.md only |
| `fix-empty-subdecks.mjs` | No-op: 0 empty factIds found | `ddca9d645` | docs/gotchas.md only |

## Pattern Counts — Comparison

| Pattern | Post-Phase-1+2 | Post-Phase-3 | Change |
|---|---|---|---|
| `self_answer` (sampled, ≥4-char answer at word boundary in question) | 96 | 96 | 0 (see note) |
| Numeric distractor > 100 for percentage answer | 12 | 12 | 0 |

**Note on self_answer count:** The audit dump samples 30 facts per deck × 3 mastery levels. Of the 14 facts fix-self-answering.mjs corrected, only 2 appeared in the sampled rows. The script's fixes are real (verified by reading back the changed JSON), but the sampling-based counter doesn't reflect them. Full-corpus verification would require scanning all 10,000+ facts rather than the 30-fact sample.

## Script Results in Detail

### 1. fix-self-answering.mjs — 14 facts fixed

Decks fixed: ancient_greece, ap_biology, ap_psychology, constellations, dinosaurs, human_anatomy, movies_cinema, periodic_table, philosophy.

**Sample changes (all correct):**

| Fact | Old question (truncated) | Fix strategy |
|---|---|---|
| `greece_rel_panathenaia` | "...honored by the Panathenaia festival...?" (Athena in festival name) | manual_fix |
| `ap_psych_cc_cs_definition` | "...conditioned stimulus that triggers..." (answer in stem) | manual_fix |
| `ha_integ_010` | "...epidermis above...dermis..." (answer substring of epidermis) | manual_fix |
| `dino_quetzalcoatlus_name_origin` | "...Quetzalcoatlus...deity..." (Quetzalcoatl as substring) | manual_fix |
| `ap_psych_intelligence_intellectual_disability` | "A diagnosis of intellectual disability..." | word_boundary_replacement → "A diagnosis of this concept requires..." |

4 word_boundary_replacement fixes produced broken grammar ("famous this", "the this structure", "an this", "being this concept") and were manually corrected to natural English.

### 2. fix-pool-heterogeneity.mjs — 6 pools split

| Pool | Deck | Ratio | Split |
|---|---|---|---|
| `drug_classes` | pharmacology | 3.1x | → drug_classes_short(50) + drug_classes_long(49) |
| `bop_account_terms` | ap_macroeconomics | 3.4x | → bop_account_terms_short(8) + bop_account_terms_long(5) |
| `ancient_philosopher_names` | philosophy | 4.5x | → _short(17) + _long(5) |
| `early_modern_philosopher_names` | philosophy | 4.5x | → _short(12) + _long(5) |
| `school_names` | philosophy | 4.7x | → _short(26) + _long(13) |
| `platform_console_names` | pop_culture | 5.8x | → _short(7) + _long(5) |

Side effect: quiz audit warnings dropped from 617 → 601 (16 fewer warns).

### 3. add-synthetic-distractors.mjs — No-op

All existing pools already had factIds + syntheticDistractors ≥ 15. The 63 pools still under 15 are either:
- `bracket_number` pools (exempt — algorithmic numeric distractors)
- Newly-created split sub-pools from script 2 (need future domain-specific padding)

### 4. fix-empty-subdecks.mjs — No-op

All 7 target decks already had populated `factIds` arrays in their sub-deck entries. Likely fixed in a prior session.

## Verification

- `node scripts/verify-all-decks.mjs` — **0 failures across 97 decks** after each script
- JSON parse validation — all modified files valid after each script
- Output sampling — 14 script-1 changes sampled, 4 grammar issues corrected manually
- Quiz audit engine — 0 fails across 45 knowledge decks

## Remaining issues (Phase 4+)

The patterns that Phase 3 could NOT address (still pending):

| Pattern | Count | Reason not fixed |
|---|---|---|
| self_answer in human_anatomy | ~30 facts | Script only auto-fixes cases with known rewrite patterns; anatomy has domain-specific compound names |
| self_answer in spanish_c1/dutch_b2 | 18+11 facts | Vocabulary decks — intentional per domain rules (cognate-aware questions) |
| Numeric >100 for percentage | 12 facts | Require question rewording ("includes the word 'percentage'") or distractor-filter engine fix |
| Newly-split pools with <15 total | ~10 pools | Need domain-specific synthetic distractors |

## Next Phase

Phase 4 covers structural refactors beyond what scripts can auto-fix:
- POOL-CONTAM (AP decks mega-pool cleanup)
- POS-separated vocab pools (Spanish/French/German)
- History catch-all pool splitting
- Human anatomy question rewrites (word-level leaks)
- HSK6 CC-CEDICT sense alignment
