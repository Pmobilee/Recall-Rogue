# constellations — Expectations

## Intended Scope
The 88 IAU-recognized constellations plus major named stars, astronomical phenomena associated with constellations, mythological origins, and historical observation (Ptolemy's 48 constellations, Bayer designations).

## Canonical Source
IAU (International Astronomical Union) official constellation catalog. Individual star data from Wikipedia/Simbad. Ptolemy's Almagest (historical source).

## Sub-Deck / Chain Theme List
4 sub-decks. No chain themes populated.

## Answer Pool Inventory
13 pools with length splitting:
| Pool | Facts | Synthetics | Notes |
|------|-------|------------|-------|
| star_names_short | 17 | 0 | OK |
| star_names_long | 6 | 9 | Padded to 15 ✓ |
| constellation_names | 9 | 5 | Padded to 14, near min |
| god_figure_names_short/mid/long | 6+6+5 | 9+9+10 | All padded to 15 ✓ |
| concept_terms_short/mid/long | 10+16+23 | 5+0+0 | Short padded, others not |
| date_numbers_short/mid/long | 7+5+20 | 8+10+0 | Short/mid padded |
| bracket_numbers | 10 | 0 | OK |

## Expected Quality Bar
Good. 140 facts is smaller than mythology decks, but the pool structure is carefully split by length. Risk areas are focused on semantic type mixing (scientific terms vs. mythological names in concept pools).

## Risk Areas
1. **SELF-ANSWERING via constellation name in question** — asking about an object "in the constellation Cygnus" when the answer is "Cygnus X-1" gives a strong semantic hint.
2. **concept_terms pools mixing astronomical objects with mythological terms** — "Cepheid variable" (star type) vs "Halley's Comet" (solar system object) in the same pool is a category type mismatch.
3. **LENGTH-TELL in Latin constellation names** — short Latin names vs. long descriptive English answers.
4. **FACTUAL-SUSPECT** — specific stellar distances, spectral types, and dates of discovery may drift from current values if data was pulled from older sources.
5. **No chain themes** — Study Temple mechanic non-functional.
