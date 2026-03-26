# AR-256: NASA Missions Curated Deck

**Status:** In Progress
**Priority:** Tier 1 (SA-02 from deck-ideas.md)
**Complexity:** Medium — well-documented domain (NASA.gov is public domain), established deck pipeline
**Dependencies:** Curated deck runtime system (AR-245 through AR-253, all complete)

---

## Overview

Create the NASA Missions curated deck for Study Temple. This is the second `space_astronomy` deck (after Solar System) and covers **missions, programs, astronauts, and space exploration history** — an orthogonal angle to the solar system deck's planetary science focus.

**Target:** ~80 facts covering the most educationally interesting missions from Mercury through Artemis.

**Differentiation from Solar System deck:** The solar system deck asks "Which mission discovered water geysers on Enceladus?" (teaching about Enceladus). The NASA deck asks "Which mission orbited Saturn for 13 years before deliberately plunging into its atmosphere?" (teaching about the Cassini mission itself). Same mission names may appear, but questions are orthogonal.

---

## Phase 1: Architecture

### Answer Type Pools (pool-first design)

| Pool ID | Format | Est. Count | Notes |
|---------|--------|-----------|-------|
| `mission_names` | name | 55-60 | Primary pool. "Which mission...?" -> Apollo 11 |
| `program_names` | name | 10-12 | Mercury, Gemini, Apollo, Space Shuttle, Skylab, ISS, Artemis, etc. |
| `astronaut_names` | name | 20-25 | Famous firsts and records |
| `launch_years` | bracket_number | varies | Runtime-generated numeric distractors. "{1969}", "{1977}" |
| `celestial_targets` | name | 12-15 | Moon, Mars, Jupiter, Saturn, Sun, Pluto, etc. |
| `spacecraft_names` | name | 15-20 | Eagle, Columbia, Challenger, Hubble, JWST, Perseverance, etc. |

### Question Templates (mastery-driven difficulty curve)

| ID | Template | Pool | Mastery | Diff |
|----|----------|------|---------|------|
| famous_first | "Which NASA mission {famous_achievement}?" | mission_names | 0 | 1 |
| program_from_desc | "Which NASA program {basic_description}?" | program_names | 0 | 1 |
| astronaut_first | "Who was the first person to {achievement}?" | astronaut_names | 0 | 1 |
| mission_from_event | "Which mission {crew/event detail}?" | mission_names | 1 | 2 |
| target_from_mission | "What was the primary destination of {mission}?" | celestial_targets | 1 | 2 |
| astronaut_from_mission | "Who commanded {mission}?" | astronaut_names | 1 | 2 |
| year_from_mission | "In what year did {mission} launch?" | launch_years | 2 | 3 |
| spacecraft_from_mission | "What was {mission}'s spacecraft called?" | spacecraft_names | 2 | 3 |
| mission_from_tech | "Which mission {specific technical achievement}?" | mission_names | 2 | 3 |
| deep_engineering | "Which mission {engineering/design detail}?" | mission_names | 3 | 4 |
| astronaut_context | "Which astronaut {obscure-but-interesting detail}?" | astronaut_names | 3 | 4 |
| counterintuitive | Surprising/counterintuitive questions | varies | 4 | 5 |

### Seeded Confusion Pairs

- Apollo 11 / Apollo 13 (triumph vs. near-disaster)
- Voyager 1 / Voyager 2 (which launched first vs. arrived first)
- Mercury (program) / Gemini (program) (both pre-Apollo, which did what first)
- Curiosity / Perseverance (both nuclear-powered Mars rovers)
- Spirit / Opportunity (twin Mars rovers, different fates)
- Challenger / Columbia (both shuttle disasters, different years/causes)
- Hubble / JWST (both great telescopes, different wavelengths/orbits)
- Pioneer 10 / Pioneer 11 (twin missions, different targets)
- Cassini / Galileo (both outer planet orbiters)
- Apollo 8 / Apollo 11 (first orbit vs. first landing)
- Alan Shepard / John Glenn (first in space vs. first in orbit)
- Artemis / Apollo (modern vs. original Moon program)
- OSIRIS-REx / Stardust (both sample return missions)
- Ingenuity / Perseverance (helicopter vs. rover, same Mars 2020 mission)

### Synonym Groups

| ID | Members | Reason |
|----|---------|--------|
| mars_rover_family | Sojourner, Spirit, Opportunity, Curiosity, Perseverance | All Mars rovers, commonly conflated |
| shuttle_disasters | Challenger, Columbia | Both shuttle losses, confused years/causes |
| voyager_twins | Voyager 1, Voyager 2 | Twin missions, different trajectories |
| pioneer_twins | Pioneer 10, Pioneer 11 | Twin missions, similar names |
| apollo_moon_milestones | Apollo 8, Apollo 11, Apollo 17 | Key Apollo milestones easily mixed up |

### Sub-Decks

| Sub-Deck ID | Name | Target Facts | Content |
|-------------|------|-------------|---------|
| iconic_missions | Iconic Missions | ~30 | Famous missions everyone has heard of: Apollo 11, Apollo 13, Hubble, JWST, Voyager, Challenger, Mars rovers, ISS, Moon landing |
| full_nasa | Full NASA History | all (~80) | Complete deck including deep cuts. Default. |

### Difficulty Tiers

- **Easy (1-2, ~30 facts):** Apollo 11, Apollo 13, Challenger, Columbia, Hubble, JWST, Voyager 1/2, ISS, Curiosity, Perseverance, Mercury program, Gemini, Neil Armstrong, Buzz Aldrin, Sally Ride, Space Shuttle, Artemis
- **Medium (3, ~30 facts):** Apollo 8, Apollo 17, Skylab, Pioneer 10/11, Spirit, Opportunity, Cassini-Huygens, Galileo, New Horizons, Sojourner, John Glenn, STS-1, STS-135, Parker Solar Probe, OSIRIS-REx, Ingenuity, Kepler
- **Hard (4-5, ~20 facts):** Apollo 1, Gemini 4 EVA, MESSENGER, Dawn, Stardust, GRACE, Juno, Mars Reconnaissance Orbiter, MAVEN, Chandra, Spitzer, Shuttle-Mir, Ed White, Gene Cernan, counterintuitive cost/engineering facts

### Data Sources

| Source | License | Usage |
|--------|---------|-------|
| NASA.gov | Public domain (US government) | Official mission data, dates, crew, descriptions |
| Wikipedia | CC-BY-SA-4.0 | Fact text, explanations, mission histories |
| Wikidata | CC0 | Structured data: launch dates, mission status |
| NASA History Division | Public domain | Historical context, program overviews |

---

## Phase 2: Content Generation

### Chain Theme Distribution

| Chain | Theme | Facts | Content |
|-------|-------|-------|---------|
| 0-1 | Crewed Programs | ~25 | Mercury (3), Gemini (3), Apollo (8), Shuttle (5), Skylab (2), ISS (2), Artemis (2) |
| 2-3 | Robotic Missions | ~30 | Voyager (5), Pioneer (2), Cassini (3), Galileo (2), New Horizons (2), Mars rovers (7), Viking/MESSENGER/Dawn/OSIRIS-REx/Parker/Europa Clipper/Juno (8) |
| 4 | Space Telescopes | ~12 | Hubble (3), JWST (3), Kepler (2), Chandra (1), Spitzer (1), TESS (1), Roman (1) |
| 5 | Astronauts & Firsts | ~13 | Armstrong, Aldrin, Shepard, Glenn, Ride, Jemison, Whitson, Cernan, Ed White, Lovell, Hadfield, Koch/Meir, Borman |

### Per-Fact Requirements
Each DeckFact must include:
- `id`: `nasa_` prefix + descriptive slug (e.g., `nasa_apollo11_moon_landing`)
- `correctAnswer`: The target answer
- `acceptableAlternatives`: Synonyms (e.g., ["Armstrong"] for "Neil Armstrong")
- `chainThemeId`: 0-5 per chain assignment above
- `answerTypePoolId`: One of the 6 pools
- `difficulty`: 1-5
- `funScore`: 1-10
- `ageGroup`: "all", "teen", or "adult"
- `distractors`: 8 plausible wrong answers (LLM-generated, NOT database-mined)
- `quizQuestion`: The question stem
- `explanation`: Educational context with source attribution
- `statement`: Declarative form of the fact
- `wowFactor`: Surprising hook that makes the fact memorable
- `visualDescription`: Sprite generation prompt
- `sourceName`: "NASA" or "Wikipedia"
- `sourceUrl`: Link to source
- `volatile`: true for facts that may change (ongoing missions, records)
- `categoryL1`: "space_astronomy"
- `categoryL2`: "nasa_crewed", "nasa_robotic", "nasa_telescopes", or "nasa_astronauts"
- `variants`: Array with reverse, context, true_false, fill_blank variants (each with own distractors)
- `tags`: Array of relevant keywords

### Volatile Facts (flagged `volatile: true`)
- Voyager 1 distance, ISS habitation streak, Perseverance status, JWST discoveries, Artemis timeline, Europa Clipper status, "most time in space" records

---

## Phase 3: Assembly & Registration

- [ ] Merge all fact batches into `data/decks/nasa_missions.json`
- [ ] Build deck envelope: id, name, domain, subDomain, description, minimumFacts, targetFacts, facts, answerTypePools, synonymGroups, difficultyTiers
- [ ] Add `"nasa_missions.json"` to `data/decks/manifest.json`

---

## Phase 4: Validation

- [ ] `node scripts/verify-curated-deck.mjs nasa_missions` — 0 failures
- [ ] `npm run typecheck` — clean
- [ ] `npm run build` — clean
- [ ] Full QA review of ALL facts (quizQuestion, correctAnswer, distractors, explanation)
- [ ] Playwright visual inspection — deck appears in Study Temple, quizzes render

---

## Phase 5: Finalize

- [ ] Mark SA-02 as SHIPPED in `data/deck-ideas.md`
- [ ] Move this doc to `docs/roadmap/completed/`

---

## Files Affected

| File | Action |
|------|--------|
| `data/deck-architectures/nasa_missions_arch.yaml` | CREATE |
| `data/decks/nasa_missions.json` | CREATE |
| `data/decks/manifest.json` | MODIFY |
| `data/deck-ideas.md` | MODIFY |
| `docs/roadmap/phases/AR-256-NASA-MISSIONS-CURATED-DECK.md` | CREATE -> move to completed/ |
