# music_history — Expectations

## Intended Scope
Curated general knowledge covering 400 years of music history: Baroque and Classical composers, musical instruments and theory, jazz and blues, rock and pop, and modern/world music from the 1600s through 2024.

## Canonical Source
Curated general knowledge across 5 sub-decks. Wikipedia cited per fact.

## Sub-Deck / Chain Theme List
- classical_masters (chainThemeId 0 — 55 facts): Bach, Handel, Haydn, Mozart, Beethoven, Brahms, Liszt, Wagner, Chopin, Debussy, Stravinsky, etc.
- instruments_theory (chainThemeId 1 — 40 facts): Instrument mechanics, music theory
- jazz_blues (chainThemeId 2 — 45 facts): Jazz, blues history and artists
- rock_pop (chainThemeId 3 — 50 facts): Rock and pop revolution
- world_modern (chainThemeId 4 — 40 facts): World music, modern era, streaming

## Answer Pool Inventory
| Pool ID | Facts | Synthetic | Total | Answer Type |
|---|---|---|---|---|
| work_names | 32 | 0 | 32 | Musical work titles |
| artist_names_short | 40 | 0 | 40 | Short artist/composer names |
| artist_names_long | 35 | 0 | 35 | Long artist names |
| instrument_names | 12 | 3 | 15 | Instrument names |
| music_terms | 21 | 0 | 21 | Music theory terms |
| album_names | 25 | 0 | 25 | Album titles |
| genre_names | 22 | 0 | 22 | Genre labels |
| bracket_numbers | 17 | 0 | 17 | Numeric values (NO inline distractors — relies on pool) |
| place_names | 8 | 11 | 19 | Place names |
| nickname_terms | 6 | 10 | 16 | Nicknames |
| description_terms | 12 | 7 | 19 | Descriptive terms (heterogeneous risk) |

## Expected Quality Bar
- 230 facts across 11 pools
- bracket_numbers pool has NO inline distractors on any of its 17 facts — relies entirely on numerical generation in engine
- 10 facts confirmed with broken "this" word replacement (pre-audit)

## Known Risk Areas
1. **BROKEN-GRAMMAR (confirmed, systemic)**: 10 facts with word-replacement artifacts — "Which Leipzig this", "Joseph This", "Piano this No. 14", "Brahms melody...most famous this in history", "Tchaikovsky this commemorates", "What this does a trombone use", "What this spans exactly 8 notes", "Charles this album". These are spread across multiple chain themes.
2. **POOL-CONTAM in description_terms**: Pool mixes "Double reed", "Single reed", "Polish", "Became deaf", "Spotify", "Napster", "Plucks the strings", "over 200" — semantically incompatible across sub-domains (instrument mechanics, composer biography, streaming services, cantata counts).
3. **POOL-CONTAM in place_names**: Pool mixes German cities (Bayreuth, Bonn), music venues (Mississippi Delta, Cotton Club, New Orleans), and countries (England) — answering city vs. venue vs. country is sometimes trivially eliminable.
4. **bracket_numbers pool heterogeneity**: Mixes ages (35, 37), birth years (1685, 1770), counts (41, 104, 200), and small values (4, 9) — a player who knows the category of answer has a strong length/magnitude tell.
5. **AMBIGUOUS-Q with superlatives**: "Most famous this in history" style questions (degraded by broken grammar) and "greatest surviving exponent" phrasing are contestable.
