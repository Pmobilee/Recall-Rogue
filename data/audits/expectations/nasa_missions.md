# nasa_missions — Expectations

## Intended Scope
NASA's major crewed and robotic missions from Mercury (1958) through JWST (2021). Covers program-level history, individual mission firsts, key spacecraft, notable astronauts, scientific discoveries, and mission outcomes.

## Canonical Source
NASA official mission archives, Wikipedia. Dates and mission parameters are verifiable from primary sources.

## Sub-Deck / Chain Theme List
2 sub-decks ("Major Programs" and "Notable Missions"). No chain themes populated.

## Answer Pool Inventory
6 pools:
| Pool | Facts | Synthetics | Notes |
|------|-------|------------|-------|
| mission_names_short | 38 | 0 | Large — single-word mission names |
| mission_names_long | 15 | 0 | Multi-word or acronym names |
| program_names | 7 | 6 | Padded to 13, near min |
| astronaut_names | 13 | 2 | Near minimum |
| launch_years | 6 | 20 | Padded to 26 ✓ — but pool contains a count fact |
| spacecraft_names | 5 | 10 | Padded to 15 ✓ |

## Expected Quality Bar
Good. 84 facts is smaller than mythology/religion decks. Clean numeric pool structure. Main risk is factual accuracy for specific dates and mission parameters.

## Risk Areas
1. **FACTUAL-SUSPECT** — specific launch years, astronaut names, and mission parameters must be verified. Errors in dates are subtle and hard to catch without source verification.
2. **launch_years pool contains non-year answer** — `nasa_moonwalkers_total` (answer: 12, a count) is pooled with year-format facts. POOL-CONTAM at the type level.
3. **mission_names_short pool (38 facts)** — no synthetics. Mission names vary from 2-char acronyms to full names. Length heterogeneity possible within this pool.
4. **SELF-ANSWERING** — questions naming the telescope/mission in the question stem (e.g., "Hubble Space Telescope") may give away the answer.
5. **No chain themes** — Study Temple mechanic non-functional.
