# anime_manga — Expectations

## Intended Scope
Curated general knowledge covering Japanese anime and manga: creators, series, studios, characters, genres, techniques, awards, and publication history from the postwar era through 2024.

## Canonical Source
Curated general knowledge (no single authoritative curriculum). Wikipedia cited per fact.

## Sub-Deck / Chain Theme List
- sd_series_stories (chainThemeId 0, 1, 2 — 91 facts): Major series, storylines, publication records
- sd_film_classics (chainThemeId 3, 4 — 47 facts): Classic films, Ghibli, theatrical releases
- sd_craft_culture (chainThemeId 5, 6, 7 — 66 facts): Studio history, techniques, awards, demographics

## Answer Pool Inventory
| Pool ID | Facts | Synthetic | Total | Answer Type |
|---|---|---|---|---|
| anime_series_titles_short | 7 | 0 | 7 | Short anime titles (≤20 chars) |
| anime_series_titles_long | 16 | 0 | 16 | Long anime titles |
| manga_series_titles | 5 | 0 | 5 | Manga series names (at minimum floor) |
| creator_names_short | 5 | 0 | 5 | Short creator names (at minimum floor) |
| creator_names_long | 38 | 0 | 38 | Full creator names |
| character_names_short | 10 | 5 | 15 | Short character names |
| character_names_long | 13 | 2 | 15 | Long character names |
| studio_names_short | 18 | 0 | 18 | Short studio names |
| studio_names_long | 13 | 0 | 13 | Long studio names |
| bracket_years | 25 | 0 | 25 | Year values |
| genre_demographic_terms | 12 | 0 | 12 | Genre/demographic labels |
| technique_terms_short | 10 | 5 | 15 | Short technique names |
| technique_terms_long | 5 | 8 | 13 | Long technique descriptions (below 15 threshold) |
| publisher_magazine_names | 8 | 0 | 8 | Publisher/magazine names |
| count_values | 19 | 0 | 19 | Numeric counts |

## Expected Quality Bar
- 204 facts across 15 pools — meets target
- Large creator pool (38 facts) should produce excellent distractor variety
- Year facts use numerical generation — standard quality expected
- Image facts: none expected in this deck
- Volatile: box-office figures, rankings, sale counts may shift

## Known Risk Areas
1. **VOLATILITY**: Sales figures, box-office records, and rankings (Demon Slayer, One Piece copies sold) are frequently updated — FACTUAL-SUSPECT risk.
2. **SYNTHETIC-WEAK in small pools**: technique_terms_long (13 total) and manga_series_titles (5 facts, 0 synth) — at or below recommended 15 threshold.
3. **creator_names pool homogeneity**: Pool mixes directors (Miyazaki, Takahata) with mangaka — distractors may feel wrong for director-specific questions.
4. **AMBIGUOUS-Q with superlatives**: Questions about "most popular" characters or "best-selling" series will be flagged.
5. **bracket_years NUMERIC-WEAK**: Year distractors generated numerically may cluster too close or too far from correct year, especially for 1950s–1960s facts.
