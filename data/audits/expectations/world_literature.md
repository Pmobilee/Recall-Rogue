# world_literature — Expectations

## Intended Scope
Curated general knowledge covering world literature from antiquity through the modern era: authors, works, characters, movements, literary forms, and opening lines spanning 3,000 years across Western, Eastern, and global literary traditions.

## Canonical Source
Curated general knowledge. Wikipedia cited per fact.

## Sub-Deck / Chain Theme List
- ancient_classical (chainThemeId 0 — 56 facts): Ancient Greek, Roman, Epic, and Classical literature
- renaissance_early_modern (chainThemeId 1 — 52 facts): Renaissance, Baroque, Enlightenment literature
- nineteenth_century (chainThemeId 2 — 48 facts): 19th-century novels, poetry, realism
- modern_contemporary (chainThemeId 3, 4, 5 — 44 facts): Modernism through contemporary

## Answer Pool Inventory
| Pool ID | Facts | Synthetic | Total | Answer Type |
|---|---|---|---|---|
| author_names_long | 27 | 0 | 27 | Long author names |
| author_names_short | 17 | 0 | 17 | Short author names |
| character_names_short | 7 | 8 | 15 | Short character names |
| character_names_long | 9 | 6 | 15 | Long character names |
| country_names | 10 | 7 | 17 | Country names |
| genre_form_names_short | 9 | 7 | 16 | Short genre/form names (contamination risk) |
| genre_form_names_long | 10 | 7 | 17 | Long genre/form names |
| movement_names | 8 | 7 | 15 | Literary movement names |
| opening_line_sources_short | 6 | 9 | 15 | Short source titles for opening lines |
| opening_line_sources_long | 6 | 9 | 15 | Long source titles for opening lines |
| publication_years | 11 | 0 | 11 | Numeric values (pool ID misleading — contains line counts, chapter counts, dates) |
| work_titles_long | 11 | 1 | 12 | Long work titles (below 15 threshold) |
| work_titles_mid | 39 | 2 | 41 | Medium work titles |
| work_titles_short | 30 | 1 | 31 | Short work titles |

## Expected Quality Bar
- 200 facts across 14 pools
- Serious pool-naming mismatch: publication_years contains line counts (15693), chapter counts (9, 12, 24, 250), and a date ("June 16")
- Classic author-vs-work contamination risk in author_names pools

## Known Risk Areas
1. **POOL-CONTAM in publication_years (confirmed)**: Pool is named "publication_years" but contains line counts (15693 lines), structural counts (9 circles, 12 books, 24 books, 100 tales, 250 myths), years (1605, 1866, 1869), and a calendar date ("June 16") — these cannot serve as plausible distractors for each other.
2. **POOL-CONTAM in genre_form_names_short (confirmed)**: Pool contains "himself" (Montaigne's subject), "Old English" (Beowulf's language), "jealousy", "Newspeak", "blank verse", "terza rima" — a mix of concepts, grammatical forms, and proper nouns that cannot function as a coherent distractor set.
3. **AUTHOR-WORK contamination**: author_names pools contain "Theo van Gogh" (not an author), and short pools mix ancient Greek authors with modern European poets, which creates spurious plausibility.
4. **work_titles_long below threshold**: Only 12 total (11 facts + 1 synthetic) — below recommended 15.
5. **FACTUAL-SUSPECT with literary priority claims**: "First modern novel" (Don Quixote vs. Tale of Genji debate), "greatest surviving exponent" of comedy (Aristophanes) — contestable superlatives.
