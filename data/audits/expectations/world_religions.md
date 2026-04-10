# world_religions — Expectations

## Intended Scope
Broad survey of major world religions: Christianity, Islam, Judaism, Hinduism, Buddhism, Sikhism, Shinto, Taoism, and other traditions (Bahá'í, Zoroastrianism, indigenous religions). Covers founders, texts, practices, holy days, sites, concepts, and figures.

## Canonical Source
Curated general knowledge. No single authoritative text; draws from multiple religious traditions' own canonical sources (Torah, Quran, Vedas, Pali Canon, etc.) as reported by secondary sources.

## Sub-Deck / Chain Theme List
7 sub-decks. No chain themes populated.

## Answer Pool Inventory
26 pools defined — the largest pool inventory of any deck in this batch. Note: **`religious_concept_names_long` appears twice** (duplicate pool ID), which is a structural defect.

Key pools:
| Pool | Facts | Synthetics | Notes |
|------|-------|------------|-------|
| bracket_numbers | 32 | 0 | Numeric answers |
| denomination_names_short | 21 | 0 | OK |
| holy_day_names_short/long | 13/14 | 2/1 | Appropriate split |
| holy_site_names_short/long | 15/14 | 0/1 | OK |
| religious_concept_names | 31 | 0 | Large, no split |
| religious_figure_names | 27 | 0 | Large, no split |
| religious_concept_names_long (x2) | 22+7 | 0+0 | DUPLICATE ID |

## Expected Quality Bar
Good but high POOL-CONTAM risk given the cross-religion nature of the deck. Distractors from one religion may be wrongly presented as choices for another religion's question.

## Risk Areas
1. **POOL-CONTAM across religions** — high risk. A Hindu holy day appearing as a distractor for a Jewish question, or a Buddhist concept for an Islamic question, would be confusing but technically "different enough" to still function.
2. **Duplicate pool ID** — `religious_concept_names_long` defined twice. The runtime behavior when a fact references this ID is undefined; it may always select the first or the second, making 7 facts effectively unreachable from pool distractors.
3. **LENGTH-TELL** — multi-word compound answers (e.g., "Buddha, Dharma, Sangha") vs. single-word distractors are easily spotted by length alone.
4. **founder/text/figure POOL-CONTAM** — `founder_names_short` is separate from `religious_figure_names`, but both contain personal names; cross-pool contamination is likely if synthetics are drawn from the combined name space.
5. **377 facts across 26 pools** — largest deck in this batch. High surface area for edge cases.
