# solar_system — Expectations Sheet

_Written before reviewing the quiz dump. Based on `data/decks/solar_system.json` only._

## 1. Intended Scope
A student completing this deck should be able to recall distinctive properties of each solar system planet, identify major moons by their defining features, name key robotic missions by their achievements, and recall a handful of fundamental numerical facts about the Sun and solar system structure.

## 2. Canonical Source
General knowledge / curated curriculum. Not exam-aligned (no AP, GCSE, or equivalent scope document cited). Source URLs reference individual Wikipedia articles per fact. Coverage is deliberately selective — highlights and "wow facts" rather than systematic textbook completeness.

## 3. Sub-deck / Chain Theme Structure
- `planets` — The Planets & the Sun (47 facts): rocky planets, gas giants, ice giants, dwarf planets, Pluto, Ceres, Sun basics, asteroid/Kuiper belt locations
- `deep_space` — Moons, Missions & Deep Space (29 facts): notable moons (Io, Europa, Ganymede, Titan, Enceladus, Triton, The Moon), major robotic missions (Voyager, Cassini, Curiosity, New Horizons, Pioneer 10, MESSENGER)
- **No chain themes defined** (`chainThemes: []`) — this deck uses sub-decks only.

## 4. Answer Pool Inventory

| Pool ID | Fact Count | Synthetic Distractors | Answer Type |
|---|---|---|---|
| `planet_names` | 39 | none | Planet names (Mercury–Neptune + Pluto, Ceres) |
| `bracket_numbers` | 5 | none (engine generates) | Numeric values: {101}, {8}, {4.6}, {99.86}, {8.3} |
| `moon_names` | 11 | 12 | Moon names (Io ×3, Europa ×3, Titan ×4, Triton) |
| `moon_names_outer` | 6 | 10 | Moon names (The Moon ×2, Ganymede ×2, Enceladus ×2) |
| `mission_names` | 15 | 3 | **MIXED**: 12 spacecraft names + "Kuiper Belt" + "Medium-sized (G-type)" + "Prograde direction" |

**Notable pool issue (pre-read observation):** `mission_names` contains three non-mission answers (`Kuiper Belt`, `Medium-sized (G-type)`, `Prograde direction`). These facts were apparently placed here because no better pool existed for them. This is likely to produce pool contamination issues in quiz rendering.

## 5. Expected Quality Bar
Well-sourced general-knowledge deck with strong fact selection; quality risk lies primarily in the heterogeneous `mission_names` pool and whether the engine generates plausible numeric distractors for the `bracket_numbers` pool.

## 6. Known Risk Areas
- **`mission_names` pool contamination** — Three facts with non-spacecraft answers (a region name, a star category label, a directional term) share a pool with spacecraft names. Any of these three appearing as a distractor for a spacecraft question, or vice versa, will be an obvious category tell.
- **Numeric distractors (`bracket_numbers`)** — With only 5 facts and no defined distractors, the engine must auto-generate numeric alternates. Risks: distractors too far from correct value (trivial elimination), impossible values (percentage > 100%), or values that match other facts in the pool (e.g., 4.6 billion vs 8.3 minutes — very different units that could appear together in a question).
- **`jupiter_has_rings` factual accuracy** — The question claims Jupiter was the first planet "besides Saturn" found to have rings. In reality, Uranus rings were discovered in 1977 (stellar occultation), two years before Jupiter's rings were confirmed by Voyager 1 in 1979. This is a potential factual error worth verifying.
- **`prograde_orbits` question/answer mismatch** — The question asks "In which plane do all 8 planets orbit the Sun?" but the answer is "Prograde direction." A plane (the ecliptic) and a direction (prograde/counterclockwise) are different concepts; the question stem does not match the answer type.
- **`planet_names` pool length homogeneity** — All answers are single proper nouns (1–7 chars) so length-tell is unlikely. However, `planet_names` includes Ceres (a dwarf planet / asteroid) which may behave oddly as a distractor for questions specifically about "planets."
