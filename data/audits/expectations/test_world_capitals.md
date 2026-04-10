# test_world_capitals — Expectations

## Intended Scope
30 facts covering major world capitals — a thin test fixture / starter deck, not a comprehensive geography deck. Intended for development and integration testing of the text-quiz rendering pipeline, not for production educational coverage.

## Canonical Source
Not specified (`sourceName` not verified at scale). Should match standard authoritative sources for national capitals (CIA World Factbook, UN).

## Sub-Deck / Chain Theme List
- None — no `subDecks` or `chainThemes` defined (0 each)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Notes |
|---|---|---|---|---|
| `capital_names` | 30 | 0 | 30 | All capitals in one pool — extreme length variation |

## Expected Quality Bar
- 30 facts is the minimum viable deck size
- Single pool with no synthetic distractors
- All capitals must be factually accurate
- South Africa's 3-capital situation must be handled with acceptableAlternatives
- `capital_names` pool length ratio 6.2× — FAR exceeds the 3× limit (Bern 4 chars vs Sri Jayawardenepura Kotte 25 chars)

## Risk Areas
1. **LENGTH-TELL (severe)** — Pool ratio 6.2× (Bern vs Sri Jayawardenepura Kotte). At m=4, "Sri Jayawardenepura Kotte" and "Washington, D.C." are visually distinct from "Bern", "Rome" — players can identify the correct answer for easy capitals (Paris, Tokyo, Rome) by picking the one matching expected length
2. **No synthetic distractors** — 30 real facts, 0 synthetic; at m=4 (5 options), 4 of the 30 pool members are drawn as distractors — reasonable variety but no padding for unusual groupings
3. **South Africa ambiguity** — Three official capitals (Pretoria executive, Cape Town legislative, Bloemfontein judicial); handled via acceptableAlternatives but question asks "What is the capital?" without qualifier
4. **No sub-decks** — Flat structure; no regional groupings
5. **Test fixture scope** — 30 facts covering only prominent world capitals is not educational-completeness; intended as a test fixture only, which is appropriate
