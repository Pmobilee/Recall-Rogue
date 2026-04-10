# famous_paintings — Expectations

## Intended Scope
Curated general knowledge covering famous paintings and their artists: masterworks from the Renaissance through contemporary art, organized by movement, with artist biographies, techniques, and museum locations. Includes image_question facts (identifying paintings visually).

## Canonical Source
Curated general knowledge. Wikipedia cited per fact.

## Sub-Deck / Chain Theme List
- renaissance_baroque (chainThemeId 0 — 28 facts): Renaissance and Baroque masters (1400–1750)
- romanticism_realism (chainThemeId 1 — 15 facts): Romanticism and Realism (1750–1870)
- impressionism_post_impressionism (chainThemeId 2 — 24 facts): Impressionism and Post-Impressionism (1860–1910)
- modern_contemporary (chainThemeId 3 — 16 facts): Modern and Contemporary (1900–present)
- movements_techniques (chainThemeId 4 — 21 facts): Art movements and painting techniques

## Answer Pool Inventory
| Pool ID | Facts | Synthetic | Total | Answer Type |
|---|---|---|---|---|
| artist_names_short | 18 | 0 | 18 | Short artist names |
| artist_names_long | 23 | 0 | 23 | Long artist names |
| painting_names | 9 | 6 | 15 | Painting titles |
| movement_names | 9 | 6 | 15 | Art movement names |
| museum_names_short | 7 | 8 | 15 | Short museum/city names (contamination risk) |
| museum_names_long | 9 | 6 | 15 | Long museum names |
| counts_amounts | 8 | 4 | 12 | Numeric counts (below 15 threshold) |
| technique_terms_short | 5 | 10 | 15 | Short technique names |
| technique_terms_long | 8 | 7 | 15 | Long technique descriptions |
| country_names | 5 | 10 | 15 | Country names |
| bracket_numbers | 3 | 0 | 3 | Numeric bracket values (CRITICAL: below minimum floor) |

## Expected Quality Bar
- 104 facts across 11 pools — meets minimum
- Image facts (quizMode: "image_question") expected to generate distractors from their pool
- bracket_numbers: only 3 facts, 0 synthetics — CRITICAL pool failure expected

## Known Risk Areas
1. **IMAGE-QUESTION DISTRACTOR FAILURE (critical)**: Image facts rely on pool distractors. The quiz engine dump must be examined to confirm distractors render for image_question mode — risk of showing only 1 option.
2. **bracket_numbers pool CRITICAL**: Only 3 facts ({37} age, {1929} year, {4} count), zero synthetics — violates 5-fact minimum. Mixing age, year, and count creates length/magnitude tells and contamination.
3. **museum_names_short pool contamination**: Distractors in the dump show city names ("Amsterdam", "Madrid", "Florence", "Giverny") used as distractors for museum-name questions — these are not museum names, they are locations.
4. **POOL-CONTAM in museum_names_short**: "The Louvre" and "Louvre" appear as distinct options in the same quiz — duplicate synonym options at mastery 3–4.
5. **AMBIGUOUS-Q with superlatives**: "Most famous version" of Sunflowers, "one of the greatest Dutch masters" phrasing.
