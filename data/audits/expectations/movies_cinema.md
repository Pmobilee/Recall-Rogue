# movies_cinema — Expectations

## Intended Scope
Curated general knowledge covering cinema history from silent films through modern blockbusters: directors, actors, landmark films, quotes, characters, box office, techniques, and awards from the 1920s to present.

## Canonical Source
Curated general knowledge. Wikipedia cited per fact. No single authoritative curriculum.

## Sub-Deck / Chain Theme List
- iconic_films (chainThemeId 0, 1 — 138 facts): Classic and legendary films, quotes, scenes
- directors_and_stars (chainThemeId 2, 3 — 67 facts): Directors, actors, biographies
- cinema_craft (chainThemeId 4, 5 — 72 facts): Film history, technique, industry facts

## Answer Pool Inventory
| Pool ID | Facts | Synthetic | Total | Answer Type |
|---|---|---|---|---|
| director_names | 59 | 0 | 59 | Director full names |
| film_titles | 69 | 0 | 69 | Film titles |
| actor_names | 44 | 0 | 44 | Actor full names |
| film_trivia | 6 | 9 | 15 | Mixed trivia answers (heterogeneous risk) |
| bracket_years | 32 | 0 | 32 | Year values |
| cinema_terms | 20 | 0 | 20 | Technical cinema terms |
| character_names | 23 | 0 | 23 | Character names |
| bracket_counts | 4 | 6 | 10 | Numeric counts (below 15 threshold) |
| country_names | 10 | 10 | 20 | Country names |
| film_quotes | 10 | 5 | 15 | Film quote attribution |

## Expected Quality Bar
- 277 facts — largest deck in batch, meets target
- Large pools for directors (59), films (69), actors (44) should produce strong distractors
- Volatile: box-office rankings, award counts may shift
- 3 facts confirmed with broken "this" word replacement

## Known Risk Areas
1. **BROKEN-GRAMMAR (confirmed)**: 3 facts with word-replacement artifacts detected pre-audit: `cinema_hist_cinema_paradiso` ("tribute to this itself"), `cinema_char_jack_torrance` ("played by this Nicholson"), `cinema_char_rocky_balboa` ("in this (1976)").
2. **POOL-CONTAM in film_trivia**: Pool mixes Shakespeare play names, song names, author names, book titles, car models, and country names — answering with wrong semantic type is trivially easy.
3. **AMBIGUOUS-Q with superlatives**: Questions using "greatest film ever made" embedded in stem may cue obvious answers.
4. **correctAnswer format inconsistency**: Some film titles include director parentheticals ("Psycho (Hitchcock)") while others do not — within the same `film_titles` pool.
5. **bracket_counts pool size**: Only 10 total (4 facts + 6 synthetic) — below 15 recommendation. One answer is "{10,000,000,000}" which is a massive outlier likely causing length tells.
