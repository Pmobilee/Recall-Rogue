# periodic_table — Quiz Audit Findings

## Summary
90 quiz dump entries (30 facts × 3 mastery levels). Zero blocking or major issues. One NIT regarding the small `element_symbols` pool. The deck is clean and factually reliable in all sampled entries.

## Issues

### NIT

- **Deck-level**: `periodic_table`
- **Category**: `OTHER`
- **Issue**: The `element_symbols` pool contains only 8 real facts + 2 synthetic distractors = 10 total entries. The recommended minimum for acceptable distractor variety is 15. At mastery 4 with 5 options shown, players will see the same few wrong element symbols (e.g., "Pb," "W") repeatedly for every symbol question. Distractor memorization rather than knowledge becomes the learning path.

## Expected vs Actual
Expected minimal issues given the fixed, authoritative nature of element data. Confirmed: all sampled facts (element names, properties, discovery stories) rendered cleanly with coherent questions and plausible distractors. No factual errors identified in the sample. The `element_names` pool (68 facts) showed no length heterogeneity in the sample — element names are short enough that the absence of a length split is acceptable.

## Notes
- 30 facts use `_fallback` template — all render as clear, factual English questions. No broken grammar.
- POS-TELL found in `periodic_table_polonium_marie_curie` ("Which element did Marie Curie name after her native country Poland?") — the question uses "her native country" which is fine; it does not leak the answer. False positive on gender pronoun check.
- Factual spot-checks: Tungsten has highest melting point (3422°C ✓), Silver has highest electrical conductivity ✓, Oxygen most abundant in Earth's crust ✓.
- The deck would benefit from a second sub-deck split (e.g., by element group or property type) to enable chain theme mechanics. Currently the single sub-deck and absence of chain themes mean Study Temple mechanics cannot activate.
- **Recommended fix**: Add synthetic distractors to `element_symbols` pool to reach minimum 15 total entries. Add 5+ plausible but incorrect element symbols as synthetics.
