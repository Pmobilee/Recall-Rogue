# world_flags — Expectations

## Intended Scope
197 countries/territories, each fact showing a flag image. Players identify the country from its flag. Every fact uses `quizMode: "image_question"` with `imageAssetPath` set. This is a pure visual recognition deck.

## Canonical Source
Wikipedia / CIA World Factbook flag images. Country name conventions should match standard English usage with `acceptableAlternatives` for contested names.

## Sub-Deck / Chain Theme List
- None — no `subDecks` or `chainThemes` defined (0 each)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Answer type |
|---|---|---|---|---|
| `country_names_short` | 156 | 0 | 156 | Short country names |
| `country_names_long` | 41 | 0 | 41 | Long country names |

All facts use `quizMode: "image_question"`. Rendered question is always "Which country does this flag belong to?" — identical for all 197 facts by design. The quiz dump shows passthrough rendering.

## Expected Quality Bar
- All 197 `imageAssetPath` values must point to existing flag assets
- Country name aliases handled: Myanmar/Burma, Ivory Coast/Côte d'Ivoire, Eswatini/Swaziland, North Macedonia/FYROM
- No synthetic distractors — pools rely on real fact pool (large enough: 156 and 41)
- Length ratio within 3× for each pool (confirmed: 2.5× and 2.9× — within limits)

## Risk Areas
1. **IMAGE-BROKEN risk** — 197 `imageAssetPath` values are not verified against disk; missing flag assets will break the quiz silently
2. **Visually similar flags** — Belgium/Germany/Chad (vertical tricolors), Romania/Chad (identical colors), Ireland/Ivory Coast/Italy (horizontal tricolors) — distractors should be regional/visually dissimilar, not nearest-neighbor
3. **Name aliases** — "Ivory Coast" vs "Côte d'Ivoire"; "Myanmar" vs "Burma"; verified both have `acceptableAlternatives`
4. **No chain themes** — 197 facts flat; no regional groupings by continent
5. **Passthrough-only dump** — Cannot assess distractor quality from quiz dump; all flag quiz rendering is image-mode passthrough
