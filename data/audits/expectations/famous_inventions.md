# famous_inventions — Pre-Read Expectations

## 1. Intended Scope
History of major inventions and inventors from ancient/medieval through the digital age: telegraph, telephone, steam engine, radio, X-rays, nylon, integrated circuits, LED, internet, and more. 200 facts, 5 sub-decks.

## 2. Canonical Source / Exam Alignment
No AP exam alignment. Wikipedia-sourced general knowledge deck. Domain is "general_knowledge / inventions_tech" rather than history.

## 3. Sub-Deck / Chain Theme List
5 sub-decks (no chainThemes array):
- Ancient & Medieval
- Industrial Revolution
- Modern Era (1880–1950)
- Digital Age
- (1 more inferred)

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| bracket_numbers | 19 factIds + 0 synth | Pure numbers |
| tech_codes | 9 factIds + 14 synth | Technical codes/designations |
| invention_names_short | 20 factIds + 0 synth | Short invention names |
| invention_names_long | 17 factIds + 0 synth | Longer invention descriptions |
| person_inventor_names | 23 factIds + 15 synth | Inventor names |
| invention_dates | 15 factIds + 0 synth [EXEMPT] | Specific invention dates |
| invention_specs | 14 factIds + 1 synth | Technical specifications |
| invention_details_short | 28 factIds + 0 synth | Short details/facts |
| invention_details_long | 30 factIds + 0 synth | Long details/descriptions |
| discovery_descriptions | 20 factIds + 0 synth [EXEMPT] | Discovery descriptions |
| number_values | 5 factIds + 13 synth [EXEMPT] | Numeric values |

Better pool design than ancient history decks — 11 pools with semantic differentiation. `invention_details_long` (30 facts) and `invention_details_short` (28) are the two largest pools.

## 5. Expected Quality Bar
Well-structured domain-specific pools. Largest risk: `invention_names_long` pool mixing duration answers ("Approximately six months") with device names ("Spark-gap transmitter", "Cavity magnetron") — format heterogeneity.

## 6. Known Risk Areas
1. **`invention_names_long` format heterogeneity** — "Approximately six months" (a duration) mixed with "Spark-gap transmitter" (a device), "Cavity magnetron" (a component), "Daventry Experiment" (an event name), "Window cleaning device" — all sharing one pool despite different semantic types.
2. **BROKEN-GRAMMAR** — `inv_0_steel_bessemer` question reads "Who introduced the device process for mass-producing cheap steel" — "device" appears to be a template placeholder or word-replacement artifact. Should likely be "Bessemer process" or just "process".
3. **`invention_dates` pool** — "November 8, 1895" and "3500–3350 BCE" in the same pool — mixing BCE-era and modern-era dates creates trivial temporal eliminability.
4. **`person_inventor_names` with 15 synthetics** — Quality of synthetic inventor names is uncertain.
5. **Self-answering potential** — Some invention questions may name the inventor in the question, making "who invented..." trivially answerable.
