# AR-252: Solar System Curated Deck

**Status:** Draft
**Priority:** High
**Complexity:** Medium
**Domain:** space_astronomy
**Deck ID:** solar_system
**Target facts:** ~70-80

---

## Overview

Build the first curated deck for Recall Rogue: Solar System. This deck fills the weakest content domain (space_astronomy has only 74 trivia facts) and serves as the template for all future curated deck builds.

**Design approach: Pool-first, not entity-first.** Per the deck-master skill philosophy, we design answer type pools of genuinely confusable members first, then select entities/facts that serve those pools. No Wikidata dumps, no catalog entries.

---

## 1. Answer Type Pools (the backbone)

These pools define what the deck teaches and how the confusion matrix creates adaptive difficulty.

### Pool A: `planet_names` (8 members)

Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune

**Why this pool is strong:** Every planet is a plausible distractor for every other when asking about properties, features, positions, or characteristics. Players genuinely confuse which planet has which property. This is the deck's primary pool — most facts will use it as the answer pool.

**Cross-pool power:** "Which planet has the moon Europa?" answers from this pool but tests moon knowledge. "Which planet did Cassini orbit?" answers from this pool but tests mission knowledge.

### Pool B: `moon_names` (9 members)

The Moon, Io, Europa, Ganymede, Titan, Enceladus, Triton, Phobos, Charon

**Why these 9:** Each is distinctive enough to support facts, yet genuinely confusable with others. Players consistently mix up which moon orbits which planet and which moon has which property. No obscure catalog moons.

**Confusability examples:**
- Europa vs Enceladus (both icy, both subsurface oceans)
- Ganymede vs Titan (both "largest moon" candidates — which is bigger?)
- Io vs Europa (both Jupiter, completely different character)
- Phobos vs Deimos (Mars's two moons — which is which?)

Note: Deimos is NOT in the pool as a full member (not enough interesting facts), but appears in Phobos-related questions as a seeded confusion pair.

### Pool C: `mission_names` (7 members)

Voyager 2, Cassini-Huygens, Curiosity, New Horizons, Juno, Pioneer 10, MESSENGER

**Why these 7:** Each mission revealed something profound and visited different destinations. Players confuse which mission went where. Framed by discovery, not launch dates.

**Selection rationale:**
- Voyager 2 (only spacecraft to visit Uranus AND Neptune — unique)
- Cassini-Huygens (Saturn system + Titan landing — dual achievement)
- Curiosity (Mars surface science — most famous rover)
- New Horizons (Pluto flyby — reclassification era)
- Juno (Jupiter orbiter — ongoing science)
- Pioneer 10 (first past asteroid belt, first Jupiter flyby — historic firsts)
- MESSENGER (first Mercury orbiter — innermost planet finally mapped)

Voyager 1 excluded as separate pool member (too confusable with Voyager 2 in unfair ways — appears as seeded confusion pair instead).

### Pool D: Bracket numbers (runtime-generated distractors)

Used for all quantitative answers:
- Orbital positions (1st through 8th)
- Moon counts
- Surface temperatures
- Distances/sizes (comparative, not raw km)
- Time periods (day/year lengths in Earth units)

---

## 2. Question Templates (difficulty curve)

Each template targets a mastery range. Higher mastery = more reasoning, less pure recall.

### Templates for `planet_names` pool

| ID | Template | Mastery | Type |
|----|----------|---------|------|
| `planet_from_ordinal` | "What is the {ordinal} planet from the Sun?" | 0 | Recognition |
| `planet_from_nickname` | "Which planet is known as the {nickname}?" | 0-1 | Recognition |
| `planet_from_feature` | "Which planet has {distinctive_feature}?" | 1-2 | Property recall |
| `planet_from_moon` | "Which planet does {moon_name} orbit?" | 2 | Cross-pool |
| `planet_from_mission` | "Which planet did {mission} visit/orbit?" | 2 | Cross-pool |
| `planet_from_neighbors` | "Which planet is between {planet_a} and {planet_b}?" | 3 | Relational |
| `planet_from_superlative` | "Which planet has the highest/lowest {property}?" | 3-4 | Comparative |
| `planet_from_counterintuitive` | "Which planet has the highest surface temperature?" (Venus, not Mercury) | 4-5 | Counterintuitive |

### Templates for `moon_names` pool

| ID | Template | Mastery | Type |
|----|----------|---------|------|
| `moon_from_property` | "Which moon has {distinctive_property}?" | 1 | Property recall |
| `moon_from_planet` | "Which of these is a moon of {planet}?" | 1-2 | Association |
| `moon_from_superlative` | "What is the largest moon in the solar system?" | 2-3 | Comparative |
| `moon_from_distinction` | "Which moon has active volcanoes / methane lakes / subsurface ocean?" | 3-4 | Specific knowledge |

### Templates for `mission_names` pool

| ID | Template | Mastery | Type |
|----|----------|---------|------|
| `mission_from_destination` | "Which mission was the first to visit {planet/body}?" | 2 | Historic recall |
| `mission_from_achievement` | "Which mission {landed on Titan / photographed Pluto / etc.}?" | 3 | Achievement recall |
| `mission_from_unique` | "Which is the only spacecraft to have visited both Uranus and Neptune?" | 4 | Specific knowledge |

### Templates for bracket numbers

| ID | Template | Mastery | Type |
|----|----------|---------|------|
| `count_moons` | "How many known moons does {planet} have?" | 2-3 | Numeric recall |
| `ordinal_from_planet` | "What number planet from the Sun is {planet}?" | 1 | Reverse ordinal |
| `temperature_compare` | "What is {planet}'s average surface temperature?" | 3-4 | Numeric |

---

## 3. Seeded Confusion Pairs

These are written into the confusion matrix at build time so the distractor system starts smart.

| Pair | Why players confuse them |
|------|------------------------|
| Jupiter <-> Saturn | Both gas giants; players mix up which has more moons, which has the Great Red Spot vs rings |
| Uranus <-> Neptune | Both ice giants; similar size/color; which is tilted, which has Triton |
| Mercury <-> Venus | Both inner planets; temperature confusion (Venus is hotter despite being farther) |
| Europa <-> Enceladus | Both icy moons with subsurface oceans; which orbits Jupiter vs Saturn |
| Ganymede <-> Titan | Both "largest moon" contenders; which is actually biggest, which has atmosphere |
| Io <-> Europa | Both Jupiter moons; completely opposite character (fire vs ice) |
| Phobos <-> Deimos | Both Mars moons; which is bigger, which is closer |
| Voyager 1 <-> Voyager 2 | Which went to which outer planets |
| Mars <-> Venus | Earth's neighbors; which has atmosphere, which had water |

---

## 4. Fact Design (organized by pool)

### Planet-centric facts (~40 facts, answer pool: planet_names)

Each planet gets 4-6 facts chosen for confusability and template depth. NOT uniform coverage — planets with more interesting/counterintuitive properties get more facts.

**Mercury (4 facts):**
- Closest to Sun (ordinal) [kids-ok]
- Smallest planet (superlative) [kids-ok]
- Extreme temperature swings day/night — no atmosphere to retain heat (counterintuitive: NOT the hottest despite being closest)
- Most cratered planet — no atmosphere or weather to erode them [kids-ok]

**Venus (5 facts):**
- Highest surface temperature in solar system — greenhouse effect (counterintuitive, cross-ref Mercury confusion)
- Rotates backward (retrograde rotation) [kids-ok]
- Day longer than year (counterintuitive) [kids-ok]
- Thick CO2 atmosphere / "Earth's evil twin" (nickname, connects to temperature fact)
- Brightest planet in Earth's sky / "Morning Star" / "Evening Star" [kids-ok]

**Earth (3 facts):**
- Only planet with confirmed liquid surface water (superlative) [kids-ok]
- Between Venus and Mars (relational template) [kids-ok]
- Only planet not named after a Greek or Roman god [kids-ok]

**Mars (5 facts):**
- Has Olympus Mons, tallest mountain/volcano in solar system (feature + superlative) [kids-ok]
- Has Valles Marineris, largest canyon in solar system (feature + superlative) [kids-ok]
- Two moons: Phobos and Deimos (moon count, cross-pool) [kids-ok]
- Evidence of ancient water / dry riverbeds (science discovery)
- Red color comes from iron oxide (rust) on the surface [kids-ok]

**Jupiter (6 facts):**
- Largest planet (superlative) [kids-ok]
- Great Red Spot — storm larger than Earth, centuries old (feature) [kids-ok]
- Most moons of any planet (superlative, bracket number) [kids-ok]
- Has moons Io, Europa, Ganymede, Callisto — the Galilean moons (cross-pool)
- So massive it could fit all other planets inside it [kids-ok]
- Has faint rings — not just Saturn! (counterintuitive) [kids-ok]

**Saturn (5 facts):**
- Most visible/prominent ring system (feature) [kids-ok]
- Could float in water — density less than water (counterintuitive) [kids-ok]
- Has moon Titan with thick atmosphere and methane lakes (cross-pool)
- Rings made mostly of ice and rock particles [kids-ok]
- Second largest planet (ordinal/comparative) [kids-ok]

**Uranus (4 facts):**
- Tilted on its side — rotates at ~98 degrees (distinctive feature) [kids-ok]
- Ice giant classification (type)
- Discovered by William Herschel — first planet discovered by telescope (historical)
- Appears blue-green due to methane in atmosphere [kids-ok]

**Neptune (4 facts):**
- Predicted mathematically before observed (counterintuitive/profound — Le Verrier)
- Strongest winds in solar system (superlative) [kids-ok]
- Has moon Triton which orbits backward — likely captured (cross-pool)
- Farthest planet from the Sun (since Pluto's reclassification) [kids-ok]

**Pluto / dwarf planets (4 facts):**
- Reclassified as dwarf planet in 2006 (historical) [kids-ok]
- Smaller than Earth's Moon (comparative, counterintuitive for older players) [kids-ok]
- Has a heart-shaped region of nitrogen ice (Tombaugh Regio) [kids-ok]
- Ceres is the largest object in the asteroid belt AND a dwarf planet (dual identity)

### Moon-centric facts (~16 facts, answer pool: moon_names)

**The Moon (2 facts):**
- Formed from giant impact with Earth (Theia hypothesis) — only large moon formed this way
- Fifth largest moon in the solar system (comparative, counterintuitive)

**Io (3 facts):**
- Most volcanically active body in solar system (superlative) [kids-ok]
- Volcanism caused by tidal forces from Jupiter (science explanation)
- Surface constantly reshaped — no impact craters survive [kids-ok]

**Europa (3 facts):**
- Subsurface ocean beneath ice crust — prime candidate for extraterrestrial life
- Smooth ice surface with very few craters (distinctive visual) [kids-ok]
- More water than all of Earth's oceans combined (counterintuitive, bracket-adjacent)

**Ganymede (2 facts):**
- Largest moon in solar system — larger than Mercury (superlative + comparative) [kids-ok]
- Only moon with its own magnetic field

**Titan (3 facts):**
- Only moon with a thick atmosphere (superlative) [kids-ok]
- Has liquid methane lakes and rivers on surface (counterintuitive — liquid, but not water) [kids-ok]
- Huygens probe landed there — most distant landing ever (cross-pool with missions)

**Enceladus (2 facts):**
- Water geysers erupting from south pole — confirmed subsurface ocean [kids-ok]
- Tiny moon (500km) but one of the brightest objects in solar system — reflective ice [kids-ok]

**Triton (1 fact):**
- Orbits Neptune backward (retrograde) — likely a captured Kuiper Belt object

### Mission-centric facts (~12 facts, answer pool: mission_names)

**Voyager 2 (3 facts):**
- Only spacecraft to visit Uranus AND Neptune (unique achievement)
- Part of the "Grand Tour" — visited all 4 outer planets
- Still sending data from interstellar space — launched in 1977 (bracket)

**Cassini-Huygens (3 facts):**
- Orbited Saturn for 13 years (longest outer planet mission)
- Huygens probe landed on Titan — first landing in outer solar system
- Discovered water geysers on Enceladus (cross-pool with moons)

**Curiosity (2 facts):**
- Found organic molecules on Mars surface (science discovery)
- Has been exploring Mars since 2012 — nuclear powered (bracket)

**New Horizons (2 facts):**
- First spacecraft to fly by Pluto — revealed heart-shaped nitrogen ice plain [kids-ok]
- Fastest spacecraft ever launched from Earth — reached Jupiter in just 13 months (bracket)

**Pioneer 10 (1 fact):**
- First spacecraft to travel through the asteroid belt and fly by Jupiter [kids-ok]

**MESSENGER (1 fact):**
- First spacecraft to orbit Mercury — mapped the entire surface

### System-level facts (~8 facts, bracket numbers / planet_names)

- 8 planets in the solar system (bracket) [kids-ok]
- Asteroid belt between Mars and Jupiter (relational) [kids-ok]
- Kuiper Belt beyond Neptune — home of Pluto and short-period comets
- Solar system is approximately 4.6 billion years old (bracket)
- The Sun contains 99.86% of the solar system's total mass (bracket, counterintuitive)
- Light from the Sun takes about 8 minutes to reach Earth (bracket) [kids-ok]
- The Sun is a medium-sized star (counterintuitive — feels huge to us) [kids-ok]
- All planets orbit the Sun in the same direction [kids-ok]

### Total: ~76 facts

---

## 5. Synonym Groups

| Group ID | Members | Reason |
|----------|---------|--------|
| `evening_morning_star` | Venus facts using "Morning Star" / "Evening Star" | Same planet, different names |
| `red_planet` | Mars facts using "Red Planet" / "Mars" | Nickname = planet |
| `earth_moon` | Facts referencing "the Moon" / "Luna" | Same body |

---

## 6. Execution Plan

### Step 1: Architecture YAML
- [ ] Write `data/deck-architectures/solar_system_arch.yaml` with all pools, templates, confusion pairs, synonym groups
- [ ] Validate: every pool has 5+ members, no orphan facts, all templates reference valid pools

### Step 2: Source Data Gathering
- [ ] Wikidata SPARQL: fetch structured data for all 8 planets (mass, distance, moons, temperature, orbital period)
- [ ] Wikidata SPARQL: fetch data for 9 target moons (parent body, radius, orbital properties)
- [ ] Wikipedia: fetch article content for each entity for explanation text and verification
- [ ] NASA fact sheets as secondary verification source

### Step 3: Fact Generation
- [ ] Spawn Sonnet workers (batches of ~10 entities) with architecture YAML + master worker prompt + source data
- [ ] Max 5 workers parallel
- [ ] Each worker produces facts with all required fields per deck-master skill spec

### Step 4: Validation
- [ ] Required fields check (all 13 fields present)
- [ ] Distractor count (8-12 per fact, LLM-generated)
- [ ] Pool size check (all pools 5+ members)
- [ ] Chain slot distribution (0-5 evenly spread)
- [ ] Synonym group sanity
- [ ] Source URL check (every fact has sourceUrl)
- [ ] Cross-reference: no fact duplicates content from trivia deck (`knowledge-space_astronomy.json`)

### Step 5: Output
- [ ] Write to `data/decks/solar_system.json`
- [ ] Update `data/deck-ideas.md` with completion status

---

## Acceptance Criteria

1. `data/decks/solar_system.json` exists with 70+ facts
2. All validation commands from deck-master skill pass clean
3. Every fact has `sourceName` + `sourceUrl` pointing to Wikipedia/Wikidata/NASA
4. Zero overlap with existing trivia facts in `knowledge-space_astronomy.json`
5. All 3 answer pools (planet_names, moon_names, mission_names) have 5+ members
6. Seeded confusion pairs are included in the deck metadata
7. Question templates cover mastery 0-5 difficulty range
8. No orphan facts (every fact belongs to a pool with 5+ confusable members)
9. Every fact has an `ageGroup` field: `"all"` (safe for kids 8+) or `"teen+"` (complex/abstract concepts best for 13+). At least 40% of facts must be `"all"` so kids get a full deck experience.

---

## Files Affected

| File | Action |
|------|--------|
| `data/deck-architectures/solar_system_arch.yaml` | Create |
| `data/decks/solar_system.json` | Create |
| `data/deck-ideas.md` | Update (mark Solar System as completed) |

---

## Verification Gate

- [ ] All deck-master validation commands pass
- [ ] Manual review: read 10 random facts — are they genuinely interesting, not dry trivia?
- [ ] Manual review: check 5 distractor sets — are they plausible wrong answers, not nonsense?
- [ ] Confirm zero overlap with trivia deck space facts
