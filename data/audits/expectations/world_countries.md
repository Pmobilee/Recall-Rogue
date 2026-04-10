# world_countries — Expectations

## Intended Scope
168 countries shown as map images (highlighted on a world map). Players identify the country from its visual shape/location. Every fact uses `quizMode: "image_question"` with `imageAssetPath` set.

## Canonical Source
Wikipedia / standard world political maps. Country names should conform to ISO 3166-1 standard or widely recognized common English names.

## Sub-Deck / Chain Theme List
- None — no `subDecks` or `chainThemes` defined (0 each)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Answer type |
|---|---|---|---|---|
| `country_names_short` | 136 | 0 | 136 | Short country names (≤ ~15 chars) |
| `country_names_long` | 32 | 0 | 32 | Long country names |

All facts use `quizMode: "image_question"` — the quiz question is always "Which country is highlighted on this map?" (same for all 168). The answer pool provides distractors. The dump shows `templateId: passthrough` with single-option arrays — suggests the image quiz mode is passthrough-only in this dump, meaning true distractor rendering is not exercised here.

## Expected Quality Bar
- All 168 facts must have `imageAssetPath` — confirmed 168/168
- Duplicate question text is expected and correct for image decks (question is always the same)
- Country names should use internationally recognized names, with `acceptableAlternatives` for contested names
- Myanmar should have "Burma" as alternative; Côte d'Ivoire / "Ivory Coast" handled
- Czech Republic / Czechia alias should be handled

## Risk Areas
1. **SYNONYM-LEAK** — Myanmar vs Burma, Czechia vs Czech Republic, Eswatini vs Swaziland. If only one variant is the `correctAnswer` without `acceptableAlternatives`, players using the other name are penalized
2. **No chain themes / subDecks** — Flat structure, no regional groupings
3. **Length-tell in text fallback** — If text distractors ever render, the pools have no synthetic distractors to pad variety; ratio 2.5–2.9× approaching limit
4. **Image asset availability** — imageAssetPath values not verified to exist on disk; broken image = broken quiz
5. **No synthetic distractors** — Pools rely entirely on real facts; distractor variety limited at low mastery levels
