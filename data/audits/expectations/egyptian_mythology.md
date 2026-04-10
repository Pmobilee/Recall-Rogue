# egyptian_mythology — Expectations

## Intended Scope
Egyptian mythology covering major deities (Ra, Osiris, Isis, Horus, Set, Thoth, Anubis, Hathor, Ma'at), cosmogony, afterlife/funerary practices, pharaonic symbolism, major temples, and key mythic cycles (Osirian myth, Eye of Ra).

## Canonical Source
Wikipedia (individual deity/myth articles). Academic anchors would be the Pyramid Texts, Book of the Dead, and secondary sources like Wilkinson's "The Complete Gods and Goddesses of Ancient Egypt."

## Sub-Deck / Chain Theme List
5 sub-decks. No chain themes populated.

## Answer Pool Inventory
| Pool | Facts | Synthetics | Notes |
|------|-------|------------|-------|
| numbers_dates | 20 | 0 | No length split — mix of "70 days" (7ch) and "Dynasty XVII-XX" (18ch) |
| places_locations | 9 | 6 | Padded to 15 ✓ |
| symbols_objects | 5 | 10 | Padded to 15 ✓ |
| deity_names_short | 3 | 15 | Only 3 real facts — very thin real-fact base |
| descriptions_roles | 38 | 0 | Large — no length split |
| concepts_terms | 96 | 0 | Largest pool — high heterogeneity risk |

## Expected Quality Bar
Good but risks higher than mythology peers due to smaller pool counts and thin `deity_names_short` pool.

## Risk Areas
1. **BROKEN GRAMMAR from template placeholder** — high risk. The `_fallback` template generates questions from the `quizQuestion` field verbatim; if the question contains unresolved `{field}` placeholders or pronoun references ("this"), the rendered question will be unintelligible.
2. **deity_names_short pool (3 real facts)** — below minimum-5. With 15 synthetics the pool reaches 18 total, but only 3 real-fact answers can serve as correct answers. Very shallow.
3. **numbers_dates pool** — mix of durations ("70 days"), years ("1352 BCE"), and counts creates length heterogeneity (min=2ch, max=18ch, ratio=4.5x).
4. **concepts_terms pool (96 facts)** — no length split. Enormous semantic range from single-word terms to multi-word descriptions.
5. **SELF-ANSWERING** — Egyptian mythological questions often name the key deity or object in the question stem when asking about associated concepts.
