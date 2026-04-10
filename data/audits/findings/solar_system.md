# solar_system — Quiz Audit Findings

_Cross-referenced: `data/audits/expectations/solar_system.md`, `data/audits/quiz-dumps/solar_system.jsonl` (90 entries = 30 facts × 3 mastery levels), `data/decks/solar_system.json`._

---

## Summary

The `planet_names` pool (39 facts, all single-word planet names) renders cleanly across all mastery levels — distractors are thematically coherent, length-homogeneous, and appropriately challenging. The `moon_names` and `moon_names_outer` pools also render well, with synthetic distractors providing good variety. The deck has one confirmed factual error, one structural mismatch between question stem and answer type, one pool with three badly misclassified facts that corrupt every question they touch, and two numeric distractor issues of varying severity. Total: **1 BLOCKER, 4 MAJOR, 4 MINOR, 3 NIT** across 90 rendered entries. The `mission_names` pool contamination is the dominant issue — it affects 6 of 30 sampled facts across all three mastery levels.

---

## Issues

### BLOCKER

**Issue B-1**
- **Fact**: `solar_system_jupiter_has_rings` @ mastery=0,2,4
- **Category**: `FACTUAL-SUSPECT`
- **Rendered** (mastery=0):
  ```
  Q: "Which planet was the first discovered to have rings besides Saturn?"
   A) Jupiter  ✓ correct
   B) Venus
   C) Uranus
  ```
- **Issue**: The correct answer is likely Uranus, not Jupiter. Uranus's rings were discovered on March 10, 1977 via stellar occultation — two years before Voyager 1 confirmed Jupiter's rings in March 1979. The deck's own explanation acknowledges both discoveries but misdates the order ("Jupiter was confirmed... by Voyager 1 in 1979... Uranus and Neptune were later found to have rings too"). The explanation contradicts itself: if the goal is "first besides Saturn," Uranus (1977) predates Jupiter (1979). Worse, Uranus appears as a distractor at mastery=0, making it eliminable for a player who knows the real history. This is a BLOCKER because the question, as stated, has the wrong correct answer.

---

### MAJOR

**Issue M-1**
- **Fact**: `solar_system_prograde_orbits` @ mastery=0,2,4
- **Category**: `TEMPLATE-MISFIT`
- **Rendered** (mastery=0):
  ```
  Q: "In which plane do all 8 planets orbit the Sun?"
   A) New Horizons
   B) Pioneer 10
   C) Prograde direction  ✓ correct
  ```
- **Issue**: Two independent problems. First, the question asks for a **plane** ("In which plane…") but the answer is a **direction** ("Prograde direction"). The ecliptic plane is the correct answer to this question as worded; "Prograde direction" is the correct answer to "In which direction do all planets orbit the Sun?" — a different question. This is a question/answer semantic mismatch. Second, the fact is placed in the `mission_names` pool, so at mastery levels 2 and 4 it draws spacecraft names ("New Horizons", "Pioneer 10", "Curiosity") and other contaminated pool members ("Kuiper Belt", "Medium-sized (G-type)") as distractors, which are obviously eliminable by any player.

**Issue M-2**
- **Fact**: `solar_system_sun_medium_star` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=0):
  ```
  Q: "What size category does our Sun belong to among stars?"
   A) New Horizons
   B) Pioneer 10
   C) Medium-sized (G-type)  ✓ correct
  ```
- **Rendered** (mastery=2):
  ```
  Q: "What size category does our Sun belong to among stars?"
   A) Prograde direction
   B) New Horizons
   C) Pioneer 10
   D) Medium-sized (G-type)  ✓ correct
  ```
- **Issue**: This fact about stellar classification is placed in `mission_names` pool, producing spacecraft names and a directional term as distractors for a question about star size categories. The correct answer is immediately obvious because it is the only option that resembles a size descriptor. A player who has never studied astronomy can eliminate every distractor instantly.

**Issue M-3**
- **Fact**: `solar_system_kuiper_belt_pluto` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=0):
  ```
  Q: "What region beyond Neptune is home to Pluto and short-period comets?"
   A) Kuiper Belt  ✓ correct
   B) New Horizons
   C) Cassini-Huygens
  ```
- **Rendered** (mastery=4):
  ```
  Q: "What region beyond Neptune is home to Pluto and short-period comets?"
   A) Voyager 1
   B) Kuiper Belt  ✓ correct
   C) Pioneer 10
   D) Cassini-Huygens
   E) New Horizons
  ```
- **Issue**: The answer "Kuiper Belt" is a region of space; all distractors are spacecraft mission names. A player at any mastery level can eliminate all options except the only non-spacecraft answer. The correct fact has own-defined distractors ("Asteroid Belt", "Oort Cloud", etc.) which are semantically appropriate, but the pool assignment overrides these with spacecraft names from the pool.

**Issue M-4**
- **Fact**: `solar_system_sun_mass_percentage` @ mastery=0,2,4
- **Category**: `NUMERIC-WEAK`
- **Rendered** (mastery=0):
  ```
  Q: "What percentage of the solar system total mass does the Sun contain (to 2 decimal places)?"
   A) 138.52
   B) 58.07
   C) 99.86  ✓ correct
  ```
- **Issue**: The distractor `138.52` is greater than 100%, which is logically impossible for a percentage. Any player who understands that percentages are bounded at 100 can immediately eliminate it. At mastery=2 the impossible distractor `138.52` reappears alongside `120.24` (also >100%). At mastery=4, three of four distractors are impossible (138.52, 120.24, and arguably 58.07 is implausible but at least valid). The engine appears to be generating numerical distractors by arithmetic offset without respecting domain constraints (0–100 range for percentages).

---

### MINOR

**Issue mn-1 — `mission_names` pool: spillover into spacecraft questions**

At mastery levels 2 and 4, questions about named spacecraft draw "Kuiper Belt", "Medium-sized (G-type)", and "Prograde direction" as distractors. These three non-mission answers appear repeatedly across the 12 mission facts in the JSONL dump.

- `solar_system_cassini_saturn_orbit_years` ml=4: distractor "Kuiper Belt", "Medium-sized (G-type)"
- `solar_system_cassini_titan_landing` ml=4: distractor "Kuiper Belt"
- `solar_system_pioneer10_asteroid_belt` ml=4: distractor "Kuiper Belt", "Medium-sized (G-type)"
- `solar_system_messenger_mercury_orbit` ml=4: distractor "Kuiper Belt"

These are eliminable (a player knows a belt is not a spacecraft) but they do not provide zero challenge at mastery=0 where only 2–3 distractors appear and a non-mission may not be drawn. Severity is MINOR rather than MAJOR because real spacecraft names dominate most option sets.

**Issue mn-2 — `bracket_numbers` distractor `12.2` near-duplicate of `12.1`**

- **Fact**: `solar_system_light_travel_time_sun_earth` @ mastery=2,4
- **Rendered** (mastery=2): A) 12.1, B) 5.7, C) 8.3 ✓, D) 12.2
- Both `12.1` and `12.2` appear as distractors simultaneously. They differ by 0.1 — functionally identical at the precision level of the answer (1 decimal place). A player faces two nearly-duplicate distractors, which effectively reduces the choice set.

**Issue mn-3 — `solar_system_prograde_orbits` own distractors are good but unreachable**

The fact's own `distractors` field contains semantically appropriate options ("Retrograde direction", "Clockwise direction", "Ecliptic plane") but the pool assignment to `mission_names` causes the engine to draw from the pool instead. The curated distractors are wasted. This is a structural consequence of pool miscategorization (linked to M-1), noted separately because it demonstrates that the content author did supply correct distractors — the pool assignment is the root cause.

**Issue mn-4 — `solar_system_mercury_not_hottest` draws Mercury as distractor at mastery=4**

- **Rendered** (mastery=4): A) Venus ✓, B) Uranus, C) Neptune, D) Mercury, E) Mars
- Mercury is the expected naive wrong answer (closest to Sun = hottest), making it a plausible distractor. However, the question says "despite not being closest to the Sun" — this phrase explicitly rules out Mercury as a candidate before asking, which means Mercury in the option list is a CATEGORY-TELL / self-answering partial leak. The question tells the player which planet NOT to pick (Mercury = closest), then offers Mercury as a distractor. A player who reads carefully can eliminate it from context alone.

---

### NIT

- **`solar_system_eight_planets` ml=0 distractors**: Options are "22", "2", "8 ✓" — the value "2" is implausibly far from anything a real student would expect, and "22" is also very far. At mastery=0 (3 options total) this may be intentionally easy, but the distractor range could be tighter (7, 9, 10 would be harder).
- **`solar_system_age_4_6_billion` not in JSONL dump**: This fact does not appear in the 90-line dump sample. Cannot audit its rendering. (Same for 46 other facts not in the sample — the dump covers only 30 of 76 facts.)
- **`solar_system_jupiter_moon_count` explanation contradiction**: The explanation says Jupiter has "101 confirmed moons — the second-highest of any planet. Saturn now holds the record with 285." The associated `saturn_most_moons` question then asks "which planet holds the record for most confirmed moons with 285?" — both facts are internally consistent, but together they make the Voyager 2 / mission facts redundant when both appear in the same session. Not a rendering issue, just a content design note.

---

## Expected vs Actual

| Expectation | Result |
|---|---|
| `mission_names` pool contamination would produce distractors from wrong semantic category | **CONFIRMED** — spacecraft names appear for stellar classification and region-name questions (and vice versa) at every mastery level (M-2, M-3, mn-1) |
| `bracket_numbers` engine-generated distractors carry risk of impossible values | **CONFIRMED** — `138.52` and `120.24` (both >100%) appear as distractors for the Sun mass percentage question (M-4) |
| `jupiter_has_rings` factual accuracy flag | **CONFIRMED as likely error** — Uranus rings (1977) predate Jupiter rings (1979); explanation text acknowledges the timing but labels Jupiter as "first" (B-1) |
| `prograde_orbits` question/answer mismatch | **CONFIRMED** — "In which plane" asks for a plane; "Prograde direction" is a direction (M-1) |
| `planet_names` pool length homogeneity would be fine | **CONFIRMED clean** — all planet name distractors are length-homogeneous single proper nouns |
| `moon_names` and `moon_names_outer` pools render cleanly | **CONFIRMED clean** — synthetic distractors (Phobos, Titania, Oberon, etc.) are thematically coherent and plausible |

---

## Notes

**What NOT to fix (out of scope for this audit):**
- Factual verification of numerical claims (99.86% Sun mass, 8.3 min light travel time) — these appear correct per standard sources but require source verification, not quiz audit review.
- The `volatile: true` flag on `solar_system_jupiter_moon_count` (101 moons) is already set — volatile handling is a system concern, not a content fix.
- Facts not in the JSONL sample (46 of 76) were not audited for rendering. A full 76-fact × 3-level dump would be needed for complete coverage.
- The deck has no `chainThemes` defined. Whether this is intentional (sub-deck-only navigation) or an omission is a design decision, not a quality issue identifiable from the quiz dump alone.

**Workflow friction for scaling to 98 decks:**
1. The JSONL dump covers only 30 of 76 facts (39%). A 100%-coverage dump (all facts × 3 mastery levels = 228 entries) would catch issues in the 46 un-sampled facts. The current 30-fact sample appears to be a random or priority selection — the audit should document which facts were selected and why.
2. Pool contamination issues (M-1, M-2, M-3) were predictable from reading the deck JSON alone, before the dump. A pre-dump structural check that flags facts whose `answerTypePoolId` answer type diverges from the pool's `label` / `answerFormat` would catch these programmatically and save manual review time.
3. The `FACTUAL-SUSPECT` finding (B-1) requires human verification against external sources — this cannot be automated. A protocol for flagging which facts need human fact-checking (e.g., historical firsts, precise dates, specific numerical claims) would help triage across 98 decks.
4. The `bracket_numbers` impossible-percentage distractors (M-4) suggest the numeric distractor generator lacks domain constraint awareness. A post-generation check: "for percentage questions, all distractors must be in [0, 100]" would catch this automatically.
