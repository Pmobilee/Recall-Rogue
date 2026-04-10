# mammals_world — Expectations

## 1. Intended Scope
Diversity of Earth's mammals — iconic species, record-breakers, surprising behaviors, conservation status, taxonomy, and evolutionary biology. 170 facts across 5 sub-decks: species records, taxonomy, behavior, conservation, and general stats.

## 2. Canonical Source
Wikipedia cited for all facts (IUCN Red List referenced implicitly for conservation status). The deck is not explicitly aligned to any IUCN database dump or mammal species checklist. Conservation status values may be stale if IUCN reassessments occurred after authoring.

## 3. Sub-Deck / Chain Theme List
5 sub-decks (inferred from chainThemeId values 0–4, which correspond to thematic groupings: stats, records, taxonomy, behavior, conservation).
Chain themes: NONE formally defined — chainThemes array empty; chainThemeId values are numeric.

## 4. Answer Pool Inventory
10 pools total:
- `term`: 25 facts + 5 synth = 30 — contains heterogeneous definitions and behavioral descriptions; some are very long compound sentences, others are short labels (POOL-CONTAM / LENGTH-TELL risk)
- `name_short`: 17 facts — OK (short species/group names)
- `name_long`: 7 facts + 8 synth = 15 — OK
- `bracket_numbers`: 13 facts + 0 synth = 13 (UNDER 15 target)
- `behavior_descriptions_short`: 8 facts + 7 synth = 15 — OK
- `behavior_descriptions_long`: 16 facts + 5 synth = 21 — OK
- `conservation_terms`: 7 facts + 5 synth = 12 (UNDER 15 target)
- `stats_short`: 25 facts, 0 synth — CRITICAL POOL-CONTAM: mixes counts (40,000 electroreceptors), lengths (5-10 cm, ~45 cm), masses (66 kg, 800 kg, ~180 kg), speeds (104 km/h), percentages (80-90%, 96%, ~20%), sound levels (236 dB), distances (500 km), times (2 hours), and proper nouns ("Koala", "None")
- `stats_medium`: 31 facts — similarly heterogeneous: distances ("Up to 32 km"), masses ("Up to 200 tonnes"), durations ("5-7 months", "Up to 7 hours"), lengths ("Up to 5.7 m"), and counts ("Five pairs")
- `stats_long`: 21 facts — same heterogeneity pattern

## 5. Expected Quality Bar
Casual knowledge deck. Behavioral and conservation facts require plausible but clearly wrong distractors. Stats pools must avoid units/type mixing since that creates eliminatable tells.

## 6. Risk Areas
1. **POOL-CONTAM in all three stats pools**: stats_short, stats_medium, and stats_long are not semantically homogeneous — they mix kg, km, cm, dB, %, hours, km/h, and unitless counts. A player seeing "5-10 cm" and "40,000" as options for a weight question can easily eliminate by units.
2. **POOL-CONTAM in term pool**: Mixes one-line behavioral facts ("Heart rate halves and breathing becomes barely detectable") with proper nouns ("Highest jaw compression per bone volume among carnivores") — very different lengths and formats as distractors for each other.
3. **BROKEN-GRAMMAR in question**: mamm_1_rec_heaviestseal renders "which animal species holds the record as the heaviest" with lowercase "which" — minor stylistic issue.
4. **CHAIN THEMES MISSING**: No chain themes defined for a 170-fact knowledge deck.
5. **conservation_terms and bracket_numbers pools under 15**: Both are below the 15-member minimum target (12 and 13 respectively), reducing distractor variety.
