# World Religions — Verified Founder Data (Wikidata)

Queried 2026-04-08 via `mcp__wikidata__query`. These are machine-verified structured facts.
Workers MUST still fetch Wikipedia articles for narrative context — this file provides
only the ground-truth dates/places for factual claims.

## Founders (verified)

| Figure | Wikidata ID | Birth | Death | Birthplace | Notes |
|---|---|---|---|---|---|
| Jesus Christ | Q302 | ~5/4 BCE | ~30-33 CE | Bethlehem | Traditional dates; scholarly date range 6-4 BCE |
| Muhammad | Q9458 | 22 April 571 CE | 11 June 632 CE | Mecca | Well-attested |
| Siddhartha Gautama (Buddha) | Q9441 | ~500 BCE | ~500 BCE | Lumbini | Wikidata compresses; traditional 563-483 BCE, revisionist 480-400 BCE |
| Confucius | Q4604 | 551 BCE (Wikidata: 550) | 479 BCE (Wikidata: 478) | Qufu | |
| Laozi | Q9333 | ~579 BCE | ~500 BCE | Chu (Zhoukou) | Dates traditional, historicity debated |
| Zoroaster | Q35811 | ~627 BCE | ~550 BCE | Ray (Rhagae) | Highly uncertain — some scholars place 1500-1000 BCE |
| Abraham | Q9181 | — | — | — | No historical dates; tradition places ~2000 BCE |

## NOT YET QUERIED — workers must fetch

- Mahavira (Q123802 or similar) — Jainism founder, 6th cent BCE
- Guru Nanak — Sikhism, 1469-1539 CE
- Bahá'u'lláh — Bahá'í, 1817-1892 CE
- Moses — traditional ~1300 BCE, no historical record
- Joseph Smith (Mormonism) — 1805-1844
- Haile Selassie (Rastafari) — 1892-1975

## Usage for workers

Every date-containing fact about the founders above MUST use the Wikidata values,
not training knowledge. If a worker's draft date disagrees with this table, the
table wins. Cross-check against the specific Wikipedia article (via WebFetch)
for narrative details, but dates are locked.

For founders NOT in this table, worker MUST WebFetch the Wikipedia article and
cite the exact URL in `sourceUrl`.

## Sensitivity note

For Abraham, Moses, and Jesus — these figures are sacred to multiple traditions.
Worker explanations should note cross-tradition reverence where relevant:
- Abraham: patriarch in Judaism, Christianity, and Islam (Ibrahim)
- Moses: central in Judaism, also prophet in Christianity and Islam (Musa)
- Jesus: central in Christianity, prophet in Islam (Isa), historical Jewish teacher
