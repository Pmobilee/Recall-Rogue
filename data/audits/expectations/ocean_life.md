# ocean_life — Expectations

## 1. Intended Scope
Ocean biodiversity, ecology, and conservation: iconic species (blue whale, octopus, sharks), deep-sea life, coral reefs, ocean geography, currents, human threats, and marine conservation status. 182 facts across 5 sub-decks.

## 2. Canonical Source
Wikipedia cited for species facts. Conservation status from IUCN Red List (implied). Ocean depth/geography facts from standard oceanographic sources. The deck is the only one of the six with chain themes formally defined (5 themes).

## 3. Sub-Deck / Chain Theme List
5 sub-decks. 5 chain themes defined (unlike all other decks in this batch).

## 4. Answer Pool Inventory
15 pools total. Multiple critically under-staffed pools:
- `stats_compact`: 1 real fact + 0 synthetics = 1 (CRITICAL: single-member pool, quiz engine cannot function)
- `ocean_lists`: 1 real fact + 6 synth = 7 (UNDER 15; only 1 real question — "What are the five named oceans?")
- `ocean_currents`: 2 real facts + 14 synth = 16 — barely passing with heavy synthetic support
- `habitat_zones`: 4 real facts + 12 synth = 16 — barely passing
- `conservation_status`: 5 real facts + 5 synth = 10 (UNDER 15)
- `stats_compact_short`: 28 facts — OK but mixes depths (10,984 m), percentages (8%), counts (~80,000), temperatures (~1°C), year-based numbers — POOL-CONTAM
- `stats_compact_long`: 24 facts — mixes lengths (600-900 m depth), weights (Up to 640 kg), decibels (230 dB) — POOL-CONTAM
- `stats_extended`: 26 facts — mixes percentages, counts, and volumes
- `species_names`: 13 facts + 21 synth = 34 — OK but 21 synthetics vs 13 real is a high ratio

## 5. Expected Quality Bar
Casual knowledge deck. Stat pools need unit-consistent groupings. Conservation status questions need clearly distinct IUCN categories. Species name distractors must be plausible alternative species, not ecosystem terms.

## 6. Risk Areas
1. **SINGLETON POOLS**: stats_compact has 1 real fact; ocean_lists has 1 real fact. The quiz engine cannot meaningfully function with these — it will always show the same question or fail to assemble a round.
2. **DUPLICATE-OPT / NEAR-DUPLICATE**: ocean_1_frilled_shark_teeth has "300 teeth" as correct answer and "~300 teeth" as a distractor — these are functionally identical, and a player correctly answers even by guessing "the rounder one." Similarly, ocean_0_octopus_species_count has "~300 species" correct vs "3" as a distractor (extreme LENGTH-TELL).
3. **POOL-CONTAM in stats_compact_short**: Mixes ocean depths (10,984 m, 3,688 m), counts (~80,000 whales), percentages (~8%), temperatures (~1°C) — all "compact" numeric answers but answerable by matching units alone.
4. **LENGTH-TELL in species_names pool**: ocean_0_humpback_songs answer "Humpback whale" (14ch) vs distractor "North Atlantic right whale" (26ch) — at low mastery the ratio approaches 2× but at high mastery (5 opts) with "Vaquita" (7ch) and "Orca (killer whale)" (19ch) the range is 7–26ch, ratio 3.7×.
5. **SYNONYM-LEAK in conservation_status pool**: ocean_4_oceanic_whitetip_status correct answer is "Critically Endangered" (21ch) but distractor "From Endangered to Least Concern" (32ch) contains the word "Endangered" — players can partially pattern-match.
