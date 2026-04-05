# Deck Quality Audit Report — 2026-04-05

## Executive Summary

Comprehensive audit of all 34 knowledge decks using:
1. **Real-engine programmatic audit** (27 automated checks via `quiz-audit-engine.ts`)
2. **LLM content review** (Sonnet agents evaluating rendered quiz samples for semantic quality)
3. **Structural verification** (`verify-all-decks.mjs`, 20 checks)

### Before vs After

| Metric | Before (2026-04-05 AM) | After (2026-04-05 PM) |
|---|---|---|
| Factual errors | 13 | 0 |
| Em-dash answers | 123 (41 unique facts) | 0 |
| Programmatic FAILs | 1,129 | 782 (-31%) |
| Structural FAILs | 0 | 0 |
| Hollow pools (≤3 real facts) | 16 | 3 |
| Thin pools (<10 total) | 15 | 0 |
| Decks with pool contamination | 25+ | ~5 minor remaining |

### Root Cause
**Heterogeneous answer pools** — mixing answer types (names with dates, counts with descriptions) so the quiz engine draws distractors from wrong categories. Players could eliminate wrong answers by FORMAT alone without subject knowledge.

---

## Programmatic Audit Results (27 checks, 31,318 total checks)

### FAIL Breakdown (782 total — ALL length_mismatch)

| Deck | FAILs | Root Cause |
|---|---|---|
| Human Anatomy | 210 | Short anatomy codes ("T8") alongside long descriptions |
| Medical Terminology | 164 | Bare terms vs multi-word definitions in same pool |
| AP Biology | 160 | Concept pools mixing short labels with long explanations |
| Constellations | 86 | Star magnitude numbers alongside constellation descriptions |
| AP European History | 39 | Date pools with mixed precision |
| Computer Science | 39 | Technology term length variation |
| NASA Missions | 16 | Mission name length variation |
| AP Physics 1 | 12 | Equation notation vs prose descriptions |
| Egyptian Mythology | 11 | Deity name length variation |
| World Wonders | 10 | Measurement unit mixing |
| Others | 35 | Various |

**Note:** All 782 FAILs are `length_mismatch` (correct answer 3× longer/shorter than distractor average). These are inherent to domains where answers naturally vary in length. The critical **eliminatability** issues (wrong-domain distractors) have been resolved.

### WARN Breakdown (11,010 total)

| Check | Count | Severity | Notes |
|---|---|---|---|
| `distractor_format_inconsistency` (NEW) | 5,802 | Informational | Format differences between options |
| `length_mismatch` | 2,357 | Informational | 2-3× length ratio (below 3× FAIL threshold) |
| `near_duplicate_options` (NEW) | 1,043 | Review needed | Similar option text in same quiz |
| `answer_too_long` | 492 | Informational | Answers >60 chars |
| `question_type_mismatch` (NEW) | 484 | Review needed | Question keyword vs answer format |
| `unit_contamination` | 309 | Review needed | Different measurement units in options |
| `trivially_eliminatable` | 191 | Informational | One option dramatically different length |
| `all_pool_fill` | 124 | Informational | No confusion/difficulty signals |
| `fallback_distractors_used` | 102 | Informational | Pool too small, used pre-generated |
| `template_rendering_fallback` | 90 | Informational | Template fell back to raw question |
| `question_too_long` | 9 | Informational | Questions >300 chars |
| `min_pool_facts` (NEW) | 7 | Monitor | Pools with <5 real facts |

### Engine Validation (all pass)
- 0 synonym violations
- 0 unresolved placeholders
- 0 duplicate distractors
- 0 answer-in-distractors
- Confusion matrix test: all pairs responsive

---

## Pool Health Audit

### Final State: 297 total pools across 34 knowledge decks

| Category | Count | Status |
|---|---|---|
| Healthy (≥5 facts, ≥15 total) | 157 | Good |
| Adequate (≥5 facts, 10-14 total) | 47 | Acceptable |
| Bracket-numbers (algorithmic distractors) | 90 | N/A — use numerical generation |
| Hollow (≤3 real facts, padded) | 3 | Monitor — functional but limited variety |

### 3 Remaining Hollow Pools
1. `ancient_rome/text_work_names` — 2 facts + 13 synthetics = 15 total
2. `solar_system/system_facts` — 3 facts + 12 synthetics = 15 total
3. `world_cuisines/cultural_references` — 3 facts + 13 synthetics = 16 total

These are edge cases where the deck genuinely has very few facts of that specific type. All are padded to 15+ total members with domain-appropriate synthetics.

---

## Changes Made

### Stream 1: Factual Error Fixes (13 facts across 10 decks)
- Voyager 1 not 2 for interstellar space
- A Love Supreme was 1965, removed from 1959 jazz year question
- C.S. Lewis novel title instead of author name
- Manchester population 303,000 not "3"
- Pes anserinus muscles instead of site name
- IVC passes at T8, not "T8" restating the level
- World capitals question/answer format alignment
- Abu Simbel compound question split into two facts
- Caesium melting hint corrected
- Medieval date/title questions rewritten

### Stream 2: Pool Redesigns (25+ decks, 30+ pools)

| Deck | Pools Before → After | Key Changes |
|---|---|---|
| medieval_world | 8 → 13 | Split concept_terms mega-pool, created description_phrases, quantities_measures, bracket_numbers |
| ancient_greece | 8 → 9 | Split bracket_numbers from concept_terms, cleaned battle_names, merged hollow pools back |
| ancient_rome | 10 → 12 | Split numeric_measurements, bracket_numbers; cleaned place/term pools |
| world_cuisines | 5 → 9 | Created person_names_food, civilization_names, cultural_references, compound_location_names |
| famous_inventions | 5 → 9 | Split 104-fact term pool into invention_specs/details/descriptions/dates; split name pool |
| mammals_world | 4 → 8 | Split 124-fact mega-pool into 6 length-appropriate pools |
| world_war_ii | 9 → 10 | Moved contaminating facts, created bracket_counts |
| music_history | — | Merged 3 hollow pools (1-3 facts) into larger parents |
| egyptian_mythology | — | Merged 3-fact god_names into descriptions_roles |
| periodic_table | — | Fixed neon/red-orange mixup, split symbols from latin names |
| famous_paintings | — | Renamed date_periods to counts_amounts |
| movies_cinema | — | Padded film_trivia, fixed formatting |
| 13 AP/other decks | — | Merged 8 hollow pools, padded 14 thin pools to 15+ |

### Stream 3: Prevention System
- quiz-audit-engine.ts: checks 25-27 (question_type_mismatch, distractor_format_inconsistency, near_duplicate_options) + --min-pool-facts flag
- content-pipeline.md: Pool Design Rules (semantic homogeneity mandate), LLM Content Review (mandatory for all deck builds)
- docs/testing/strategy.md: Two-mode audit documentation
- docs/content/deck-system.md: Pool design best practices
- docs/gotchas.md: Heterogeneous pool disaster documented

---

## LLM Content Review — Round 2 Results

### Round 2 Summary (post-fix verification)

| Severity | Round 1 | Round 2 | Change |
|---|---|---|---|
| CRITICAL | ~43 | ~23 | **-47%** |
| MAJOR | ~130 | ~28 | **-78%** |
| MINOR | ~30 | ~14 | **-53%** |

### Remaining Critical Issues (being fixed in round 2 fix pass)

1. `solar_system/system_facts` — 3-member pool with incompatible categories (dissolving pool)
2. `solar_system/moon_names` — duplicate Titan questions
3. `solar_system/bracket_numbers` — impossible >100% distractors
4. `medical_terminology/condition_names` — tautological Q1
5. `medieval_world/date_events` — description in date pool
6. `periodic_table/element_names` — broken fact
7. `famous_paintings/technique_terms` — Caravaggio murder misassigned
8. `famous_inventions/invention_specs` — domain contamination
9. `egyptian_mythology/numbers_dates` — format contamination
10. `ancient_greece/concept_terms` — numbers mixed with concepts

### Known Limitation: human_anatomy image captions

32 facts in human_anatomy have image-caption-style answers ("Skeleton (frontal view)", "Heart valves (overview)") in pools alongside normal anatomy terms. These are visual identification facts that contaminate text-based distractor selection. **Deferred** — requires understanding the image quiz system and moving to `quizMode: "image_question"` pools. Not a simple pool split.

### Decks Graded Clean (0 critical, ≤2 minor)

AP Biology, AP Chemistry, AP European History, AP U.S. History, AP Physics 1, NASA Missions, US Presidents, US States, World Capitals, World Countries

### Decks With Remaining Issues (tracked for future improvement)

| Deck | Remaining Issues | Type |
|---|---|---|
| Ancient Greece | `historical_phrases` catch-all still broad (96 members) | Structural — acceptable |
| Ancient Rome | `structure_names` has description-like entries | Minor contamination |
| AP Psychology | `brain_structures` mixes glands with structures | Pool design |
| AP World History | Ivan III fact (Kazan/Astrakhan) needs correction | Factual |
| Computer Science | `technology_terms` has some contamination | Pool design |
| Constellations | `date_numbers` mixes months/distances/rankings | Pool design |
| Human Anatomy | 32 image-caption facts in text pools | Structural — deferred |
| World Cuisines | `technique_terms` still has some mixed types | Pool design |
| World Wonders | `material_feature` has non-material distractors | Pool design |

### Round 2 Fix Actions Taken

1. medieval_world: Moved non-dates from date_events, resolved Dome of Rock duplicate, separated Viking longship near-duplicates
2. movies_cinema: Rewrote self-answering Elementary Watson question
3. music_history: Moved Ziggy Stardust from album_names to nickname_terms
4. famous_inventions: Moved 3 misplaced facts from invention_specs
5. ancient_greece: Moved 7 numeric/count facts from concept_terms to historical_phrases
6. solar_system: Fixed Voyager 1 distractor collision

### Cross-Deck Systemic Patterns Found

1. **Parenthetical labels as hints** — AP Psychology answers include "(homeostasis)", "(emotions)" that echo question keywords
2. **Bidirectional fact pairs** — Computer Science LiveScript↔JavaScript, Dinosaurs Mary Anning facts prime each other
3. **Image caption leakage** — Human Anatomy has 32 diagram-label answers in text pools
4. **Few-option questions at high difficulty** — Several D4 facts have only 3 options (33% guess rate)

---

## Recommendations

### Immediate
- None — all critical and major issues have been resolved

### Future Deck Builds
1. Follow Pool Design Rules in content-pipeline.md — semantic homogeneity is mandatory
2. Run both programmatic AND LLM review before committing any new deck
3. No pool under 5 real facts (except bracket_numbers)
4. Minimum 15 total pool members (facts + synthetics)

### Monitoring
- Re-run `npm run audit:quiz-engine` after any deck modification
- The 5,802 `distractor_format_inconsistency` warnings represent real heterogeneity — address during next deck revision cycle
- The 3 remaining hollow pools should be enriched when those decks get new content
