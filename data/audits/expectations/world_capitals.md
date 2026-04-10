# world_capitals — Expectations

## Intended Scope
168 countries, each with their capital city. Covers virtually all UN member states and a few additional territories (e.g., Kosovo). Every fact is paired with map coordinates for the `map_pin` response mode.

## Canonical Source
Wikipedia / CIA World Factbook per `sourceName: "Wikipedia"`. Map coordinates should be verifiable against authoritative geographic databases.

## Sub-Deck / Chain Theme List
- None — no `subDecks` or `chainThemes` defined (0 each)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Answer type |
|---|---|---|---|---|
| `capital_names_short` | 118 | 0 | 118 | Short capital city names (≤ ~11 chars) |
| `capital_names_long` | 50 | 0 | 50 | Long capital city names |
| `country_names_caps_short` | 118 | 0 | 118 | Short country names for map_pin passthrough |
| `country_names_caps_long` | 50 | 0 | 50 | Long country names for map_pin passthrough |

All 168 facts use `quizResponseMode: "map_pin"` — text-mode distractors exist in the fact but the quiz dump shows `templateId: passthrough` with single-option arrays. No text-quiz rendering occurs.

## Expected Quality Bar
- All 168 coordinates valid (lat ∈ [-90,90], lng ∈ [-180,180]) — confirmed clean
- No duplicate questions — each has a unique country name
- Capital answers must not appear as distractors in other facts' rendered options (map_pin mode bypasses this)
- Bolivia: dual-capital situation handled with `acceptableAlternatives: ["La Paz"]`
- UK question grammar should be "of the United Kingdom"

## Risk Areas
1. **Grammar error in UK question** — "What is the capital of United Kingdom?" missing article "the"
2. **Bolivia ambiguity** — Two capitals (Sucre constitutional, La Paz seat of government); only `La Paz` in acceptableAlternatives, Sucre is the correctAnswer — not universally agreed as "the" capital
3. **Kosovo** — Pristina listed; Kosovo's international recognition is disputed (~100 countries); question may confuse players
4. **No chain themes / subDecks** — Deck lacks themed progression; all facts in one flat structure reduces engagement
5. **Map-pin only mode** — Zero text-quiz rendering; the pool structure is effectively unused for in-game quiz variety
