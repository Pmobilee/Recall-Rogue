# Run Narrative System — Woven Narrative Architecture

> **Purpose:** Design spec for the procedural narrative system that delivers dark RPG storytelling woven from four concurrent threads, reactive to actual knowledge the player studies.
> **Last verified:** 2026-04-03
> **Status:** PHASE 3 COMPLETE — full gameFlowController integration implemented (2026-04-03). All hooks wired: preload, initNarrative, recordEncounterResults, getNarrativeLines, recordShopPurchase, recordRestAction, resetNarrative.
> **Source files:** `src/services/narrativeTypes.ts` (data interfaces), `src/services/narrativeGravity.ts` (classification + gravity scoring), `src/services/narrativeLoader.ts` (runtime loader), `src/services/narrativeEngine.ts` (IMPLEMENTED — 2026-04-03), `src/services/encounterBridge.ts` (NarrativeEncounterSnapshot snapshot mechanism), `src/services/gameFlowController.ts` (integration hooks), `data/narratives/` (COMPLETE — 61 YAML files), `scripts/build-narratives.mjs` (YAML-to-JSON converter), `public/data/narratives/` (generated JSON output)


## Data Pipeline (2026-04-03)

Narrative YAML files are converted to JSON at build time, then loaded at runtime via fetch().

### Build Step: scripts/build-narratives.mjs

```
npm run narratives:build
```

Reads all 61 YAML files from `data/narratives/`, normalises snake_case keys to camelCase (e.g. `min_gravity` to `minGravity`, `deck_categories` to `deckCategories`, `relic_id` to `relicId`), and writes JSON to `public/data/narratives/` mirroring the directory structure. Also writes `public/data/narratives/manifest.json` with the full file list.

The inhabitant greeting field is normalised from `{ 1: text, 2: text, default: text }` to `InhabitantGreeting[]` with `visitNumber: number | 'default'` as required by the TS interface.

Runs automatically as part of `npm run dev` and `npm run build`.

### Runtime Loader: src/services/narrativeLoader.ts

All accessor functions are synchronous after `preloadNarrativeData()` completes. The cache is module-level and never re-fetched.

| Function | Returns | Notes |
|---|---|---|
| `preloadNarrativeData()` | `Promise<void>` | Call once at game init. No-op if already called. |
| `loadArchetype(id)` | `DescentArchetype` | Throws if not found after preload |
| `loadAllArchetypes()` | `DescentArchetype[]` | All 12 archetypes |
| `loadLens(id)` | `DomainLens` | Throws if not found after preload |
| `loadAllLenses()` | `DomainLens[]` | All 15 lenses |
| `loadEchoTemplates(type)` | `EchoTemplate[]` | By AnswerType; returns empty array if type missing |
| `loadInhabitant(npc)` | `InhabitantDialogue` | Throws if not found after preload |
| `loadSeekerLines()` | `SeekerLine[]` | hp/streak/floor reactive lines combined |
| `loadRelicCallbacks()` | `RelicCallback[]` | Relic-specific seeker lines |
| `loadAmbientLines(lensId)` | `AmbientLine[]` | By lens ID; returns empty array if missing |
| `isNarrativeDataReady()` | `boolean` | Guard before synchronous access |
| `_resetNarrativeCache()` | `void` | Testing only — resets all caches |

---
## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Design Philosophy

Recall Rogue has an asset no other roguelite possesses: **the game knows exactly what knowledge the player just engaged with**. The narrative system exploits this ruthlessly. Every run tells a different story — not through branching scripts, but through four concurrent narrative threads that weave together based on what the player does, what they learn, and how they perform.

### Core Principles

1. **The knowledge domain IS the narrative fuel** — facts, answers, chain themes become plot points
2. **Not generic, not scripted** — a third path between "you enter a dungeon" and same-story-every-run
3. **Purely programmatic** — no runtime LLM generation; all content is pre-authored templates with contextual slot-filling
4. **Dark, serious tone** — this is a deep, ancient knowledge dungeon RPG; never whimsical, never meta-humorous
5. **Combinatorial depth from authored fragments** — ~580 authored lines produce thousands of unique experiences
6. **Only echo what was seen** — the narrative NEVER references specific facts, answers, or knowledge the player hasn't encountered in this run. Echo templates, Oracle callbacks, and chain arrows draw EXCLUSIVELY from facts the player has already been quizzed on (correct or incorrect). Unseen facts have no meaning to the player.

### The Voice: The Creature Below

Something vast and ancient lives at the bottom of the dungeon. It speaks in a language no one understands — a deep, reverberating resonance — but the text on screen is its words, translated. The player reads a translation of a monster's narration.

This conceit explains:
- Why the narration knows things it shouldn't (it IS the dungeon, omniscient)
- Why it references the player's facts (it watches everything)
- Why the Oracle NPC is different (a fragment of this creature, closer to the surface)
- Why intensity increases with depth (you're approaching the source)
- Why it comments on HP/relics/performance (it's studying you)

**Audio:** A procedurally generated low-frequency drone/chant plays briefly with each narrative line. Synthesized via Web Audio API — stacked oscillators with slow LFO modulation, reverb, and low-pass filter. Varies by floor depth (deeper = lower frequency), line gravity (dramatic = louder), and chain color (each adds a harmonic). No samples needed.

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## The Four Threads

Every room transition assembles 1-3 lines from different threads. The combination is never the same twice.

| Thread | Data Source | Purpose |
|---|---|---|
| **The Descent** | Floor, room number, archetype, domain lens | Structural arc — "where you are" |
| **The Echo Chamber** | Actual facts answered (correctAnswer, domain) | References REAL knowledge — the killer feature |
| **The Seeker** | HP, streak, relics, mastery, choices made | Character arc — "who you're becoming" |
| **The Inhabitants** | Room type, visit count, prior interactions | NPCs with memory within the run |

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Thread 1: The Descent (Structural Arc)

The backbone. A **Descent Archetype** is selected at run start and followed through 5-6 beats across the run. A **Domain Lens** transforms the archetype's generic templates into domain-specific prose.

### Descent Archetypes (~12, universal)

| ID | Name | Theme | Beat Rhythm |
|---|---|---|---|
| `lost_archive` | The Lost Archive | Recovering forbidden knowledge | Discovery - Warning - Revelation - Cost - Truth |
| `sealed_vault` | The Sealed Vault | Breaking ancient protections | Seal - Crack - Breach - Flood - Containment |
| `scholars_descent` | The Scholar's Descent | Following someone who came before | Footprints - Journal - Blood - Skeleton - Their final note |
| `the_infection` | The Infection | Knowledge as contagion | Curiosity - Obsession - Symptoms - Fever - Clarity or madness |
| `the_trial` | The Trial | Being tested by the dungeon | Challenge - Doubt - Adaptation - Mastery - Judgment |
| `the_excavation` | The Excavation | Digging through time layers | Surface - Sediment - Fossil - Bedrock - Core |
| `the_convergence` | The Convergence | Separate threads becoming one | Fragment - Fragment - Fragment - Pattern - Whole |
| `the_bargain` | The Bargain | Trading something for knowledge | Offer - Price - Doubt - Payment - What was bought |
| `the_cartographer` | The Cartographer | Mapping the unmappable | Edge - Interior - Anomaly - The center moves - You are the map |
| `the_heresy` | The Heresy | Learning what was forbidden | Dogma - Crack - Doubt - Counter-evidence - The old truth falls |
| `the_resonance` | The Resonance | Knowledge building to a frequency | Hum - Vibration - Harmony - Dissonance - Resolution |
| `the_wake` | The Wake | Something died here; reading its remains | Corpse - Memory - Cause - Culprit - It's still here |

Each archetype has 5-6 **beat templates** tied to progression points (early floors, mid-run, pre-boss, post-boss, finale). Between beats, other threads fill the space.

### Beat Trigger Points

| Trigger | When |
|---|---|
| `run_start` | First room of floor 1 |
| `first_boss_kill` | After defeating the first boss (floor 3) |
| `floor_2_start` | Entering floor 2 (room 1 of segment 2) |
| `mid_run` | ~50% through rooms (floor 2 mid-point) |
| `pre_final` | Entering the final boss floor |
| `run_victory` | After defeating the final boss |
| `run_defeat` | On death (replaces victory beat) |

### Domain Lenses (~15, one per deck category)

A lens provides vocabulary that transforms archetype templates into domain-specific prose.

```yaml
# Example lens definition
id: history_ancient
deck_categories: [history_ancient, history_classical]
fields:
  setting_noun: "the buried necropolis"
  knowledge_noun: "chronicle"
  knowledge_plural: "chronicles"
  discovery_verb: "unearthed"
  container_noun: "sarcophagus"
  guardian_noun: "shade"
  danger_noun: "curse"
  atmosphere: "dust and silence"
  material: "stone and bronze"
```

**Planned lenses:**

| Lens ID | Deck Categories | setting_noun | knowledge_noun |
|---|---|---|---|
| `history_ancient` | Ancient Greece, Rome, Egypt | the buried necropolis | chronicle |
| `history_modern` | WWII, Cold War | the sealed bunker | intelligence report |
| `history_medieval` | Medieval, Renaissance | the ransacked monastery | manuscript |
| `science_biology` | Biology, Anatomy | the sealed laboratory | specimen |
| `science_physics` | Physics, Chemistry, Astronomy | the collapsed observatory | equation |
| `science_computing` | Computer Science | the decommissioned mainframe | program |
| `geography` | World Capitals, Countries, Flags | the cartographer's vault | map fragment |
| `language_european` | Spanish, French, German, Dutch | the translator's prison | cipher |
| `language_east_asian` | Japanese, Chinese, Korean | the calligrapher's tower | character |
| `language_slavic` | Czech, Russian, Polish | the exile's archive | letter |
| `mythology` | Greek Mythology, Norse | the god's reliquary | scripture |
| `arts_literature` | Literature, Music, Art | the burned gallery | masterwork |
| `nature` | Dinosaurs, Animals, Plants | the petrified garden | specimen |
| `philosophy` | Philosophy, Psychology | the debating chamber | treatise |
| `general_trivia` | Trivia Dungeon (mixed) | the collector's labyrinth | fragment |

### Archetype + Lens = Specific Prose

**Template:** `"The {container_noun} held more than expected. {knowledge_plural|capitalize} {discovery_verb} here reshape what the surface world believes."`

- History Ancient: *"The sarcophagus held more than expected. Chronicles unearthed here reshape what the surface world believes."*
- Biology: *"The culture held more than expected. Specimens isolated here reshape what the surface world believes."*
- Language: *"The scroll held more than expected. Characters deciphered here reshape what the surface world believes."*

**Math:** 12 archetypes x 15 lenses x 5-6 beats = **900-1,080 unique structural lines** from ~72 templates + 15 lens definitions.

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Thread 2: The Echo Chamber (Fact-Reactive)

The killer feature. After combat, the narrative references **actual facts the player just answered**. This is what makes the system feel sentient.

### Data Available After Each Encounter

| Field | Source | Example |
|---|---|---|
| `recentCorrectAnswers[]` | Answers the player got right | ["Napoleon", "1815", "Waterloo"] |
| `recentWrongAnswers[]` | What they got wrong | ["1812"] |
| `chainCompletions[]` | Chains that hit 3+, with answer sequences | [["Colosseum", "Parthenon", "Petra"]] |
| `topicGroup.label` | Theme name (Tier 3 decks only) | "Persian Wars" |
| `deckDomain` | Deck's knowledge domain | "history" |

### Vocab Deck Echo Source — Foreign Word Extraction

For vocabulary deck facts (facts with `partOfSpeech` field), the echo system uses the **foreign word from the question**, not the English `correctAnswer`.

**Extraction:** Parse `quizQuestion` pattern `What does "{foreignWord}" mean?` → extract `foreignWord`.

**Why:** "abandonar" in a dark dungeon is atmospheric. "to abandon" is flat. The foreign script/word IS the exotic element that makes echoes work for vocab decks.

**For chain completion arrows:** Use foreign words too: `'aspecto' → 'abrazo' → 'acá'` not `'aspect' → 'hug' → 'here'`.

**FactEcho interface update:** Add `echoText: string` field — the actual string to use in templates. For knowledge decks: `echoText = correctAnswer`. For vocab decks: `echoText = extracted foreign word`. Templates use `{echoText}` instead of `{answer}`.

### Answer Type Classification

Each `correctAnswer` is classified at display time — no pre-tagging needed:

| Type | Detection Rule | Examples |
|---|---|---|
| `person` | Capitalized, 2-3 words, no digits, name patterns | Napoleon, Ada Lovelace |
| `place` | Capitalized, geographic patterns, "the" prefix | Rome, The Colosseum |
| `date` | 4-digit year (1000-2100) or date format | 1945, 476 AD |
| `number` | Mostly digits, not a year | 42, 3.14, 206 |
| `concept` | Multi-word lowercase, abstract nouns | democracy, photosynthesis |
| `foreign_word` | Non-Latin characters OR vocab deck fact | 食べる, abandonar |
| `object` | Fallback — concrete nouns, technical terms | mitochondria, TCP/IP |

### Gravity Scoring — The Silly Answer Filter

Not every answer works in dark RPG prose. "1738" or "Elon Musk" would break immersion. Gravity scoring prevents this.

**Three gravity levels:**

| Level | Meaning | Template Access |
|---|---|---|
| `high` | Always safe to echo dramatically | All templates including dramatic |
| `medium` | Echo with neutral templates only | Neutral templates only |
| `low` | Never echo by name | Answer-free fallback templates only |

**Scoring rules:**

```
HIGH gravity:
  - Historical figures (person type + history/mythology domain)
  - Ancient places (place type + history domain)
  - Foreign words (always atmospheric)
  - All places (geographic weight)
  - Concepts in science/philosophy domains

MEDIUM gravity:
  - Person type in science/computing domains (scientists, pioneers)
  - Concepts in any domain
  - Objects/things in any domain
  - Historical years (date type, 4 digits)

LOW gravity (never named in prose):
  - Pure numbers that aren't years
  - Answers < 4 characters
  - Boolean answers (True/False/Yes/No)
  - Answers that are lists ("A, B, and C")
  - Single characters
```

**Additional narrative quality filters:**
- Skip answers shorter than 3 characters
- Prefer facts where the player paused (>3s response time — indicates engagement)
- Prefer facts from chain completions (more dramatic context)
- Track shown echoes — same fact never echoed twice per run
- Concept echoes require `echoText` length >= 8 characters (filters thin single-word concepts like "War", "Art", "Water")

### Echo Template Categories

**Person echoes (high gravity):**
- `"{echoText}. The name reverberates. Someone — or something — down here remembers them."`
- `"A shadow in the shape of {echoText}. It watches. It has been watching for a long time."`
- `"'{echoText}' is scratched into the archway. The handwriting is your own."`
- `"The shade of {echoText} stands at the threshold. It does not move. It does not need to."`
- `"You know {echoText} now. That knowledge has weight. The floor sinks slightly beneath you."`

**Person echoes (medium gravity — neutral):**
- `"The name {echoText} joins the others carved into the walls."`
- `"You carry {echoText}'s legacy now. The dungeon takes note."`

**Place echoes:**
- `"For a heartbeat, the walls dissolve. You see {echoText} — impossibly distant, impossibly clear. Then stone again."`
- `"The dungeon shifts. This corridor was not here before. It remembers {echoText}."`
- `"{echoText}. You have never been there. But something in your marrow says otherwise."`
- `"Carvings on the wall. A map. {echoText} is marked. So is where you stand now. The distance between them is shrinking."`

**Foreign word echoes:**
- `"'{echoText}.' You speak it aloud. The echo returns in a voice that is not yours."`
- `"The walls absorb '{echoText}'. When you press your palm to the stone, you feel it — the word, trapped inside, still vibrating."`
- `"'{echoText}' — the dungeon tries to pronounce it. Fails. Tries again. The second attempt is closer."`
- `"You whisper '{echoText}'. Three rooms away, something responds."`

**Concept echoes:**
- `"{echoText}. The idea hits the air like a bell. Ideas are louder than swords down here."`
- `"The ancients sealed the concept of {echoText} behind three locks. You just turned one."`
- `"{echoText}. You feel it reorganize something behind your eyes. The dungeon noticed."`
- `"Every wall in this corridor is covered in attempts to describe {echoText}. None of them got it right. Until now."`

**Object/thing echoes:**
- `"You see {echoText} depicted in the stonework. Older than it should be. Much older."`
- `"{echoText}. The dungeon hoards knowledge of it. You just took a piece."`

**Chain completion echoes (3+ correct in sequence):**
- Chain 3: `"'{a1}' → '{a2}' → '{a3}'. The connections tighten. The dungeon groans."`
- Chain 4: `"Four links: {a1}, {a2}, {a3}, {a4}. The chain burns brighter than any torch."`
- Chain 5+: `"Five truths, forged into a single chain. The walls crack. Something beneath you shifts."`

**Wrong answer echoes (used sparingly):**
- `"The dungeon remembers your hesitation. It will ask again."`
- `"A wrong turn. The corridor darkens. Knowledge resists those who guess."`
- `"The echo distorts. The dungeon corrects you with silence."`

**Answer-free fallbacks (when all facts are low gravity):**
- `"Another truth recovered. The walls note your progress."`
- `"Correct. The dungeon concedes a step."`
- `"The chain grows. Each link forged from what you know."`
- `"Something stirs below. It felt that."`

**Context echoes (uses question + answer, for richer output when echoText alone is thin):**
- `"'{quizQuestion}' — you answered '{echoText}'. Even the dungeon pauses at that."`
- `"The question lingers: {quizQuestion} The answer — {echoText} — carved itself into the wall before you could speak."`
- `"They asked that same question here, long ago. '{quizQuestion}' The answer was always {echoText}."`

Context echoes fire when `echoText.length < 12` AND `gravity >= medium`. They include question context so thin answers ("Literature", "Assembly") gain meaning through framing.

**Math:** 6 categories x ~15 templates = ~90 echo templates. With answer substitution = effectively unlimited unique outputs.

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Thread 3: The Seeker (Character Arc)

Responds to HOW the player is doing — not what they know, but who they're becoming. Fires on **state changes**, not every room.

### State Conditions

| Condition | Detection | Narrative Meaning |
|---|---|---|
| `hp_above_80` | `playerHp / playerMaxHp > 0.8` | Confidence, hubris — ominous |
| `hp_30_to_80` | `0.3 <= ratio <= 0.8` | Battle-worn, committed — gritty resolve |
| `hp_below_30` | `ratio < 0.3` | Desperate — survival horror |
| `streak_5_plus` | 5+ consecutive correct | Flow state, mastery — awe |
| `streak_broken` | Was 3+, now 0 | Doubt, confusion — creeping dread |
| `many_relics` | 4+ relics held | Collector, burden — weight |
| `high_mastery` | Avg mastery > 3.0 | Scholar becoming master — transcendence |
| `low_mastery` | Avg mastery < 1.5 | Novice overwhelmed — in over their head |
| `floor_1` | Floor 1 | Fresh descent — wonder mixed with dread |
| `floor_2` | Floor 2 | Deep now, no turning back — commitment |
| `floor_3` | Floor 3 | The bottom, endgame — finality |
| `post_boss` | Just killed a boss | Aftermath — what it cost |
| `relic_specific` | Carrying specific relic ID | Relic "personality" callback |

### Example Seeker Lines

**HP high, early run:**
- "Untouched. The dungeon has not yet decided what you are worth."
- "Your footsteps are too loud. Confidence echoes."

**HP low:**
- "Blood on the pages. Every answer costs more than the last."
- "Your hands shake. The next question will be harder to read."
- "The dungeon feeds on what you lose. It is well-fed."

**Answer streak 5+:**
- "The connections flow through you now. You are not studying. You are remembering."
- "Five in a row. The chains sing. Something ancient stirs — it recognizes mastery."

**Streak broken:**
- "The rhythm shatters. Down here, hesitation is a wound."
- "You falter. The walls lean closer."

**Post-boss:**
- "It did not die. Guardians do not die. It returned to the knowledge it was made from."
- "The chamber still vibrates. Boss encounters leave scars on the architecture."

**Floor progression:**
- Floor 1: "The descent begins. What was buried here was buried for a reason."
- Floor 2: "Deeper. The air tastes of old ink and older regret."
- Floor 3: "The bottom. Where knowledge goes to become something else entirely."

### Relic Callback Lines

Each relic gets 1-2 narrative lines triggered when entering specific room types or meeting specific conditions. These make relics feel like characters, not just stat buffs.

**Examples (subset of ~60 relics):**

| Relic ID | Condition | Line |
|---|---|---|
| `phoenix_feather` | `hp_below_30` | "The Phoenix Feather warms against your chest. Not yet, it whispers. Not yet." |
| `lucky_coin` | `shop_visit` | "The Lucky Coin vibrates in your pocket. It knows this merchant." |
| `scholars_crown` | `streak_5_plus` | "The Scholar's Crown glows. It was made for moments like this." |
| `last_breath` | `hp_below_30` | "Last Breath pulses once. A promise — or a warning." |
| `living_grimoire` | `any_room` | "The Living Grimoire's pages turn on their own. It's reading the walls." |
| `chain_link_charm` | `chain_complete` | "The Chain Link Charm burns bright. It feeds on connections." |
| `memory_nexus` | `post_boss` | "The Memory Nexus absorbs the guardian's residue. It grows heavier." |
| `tattered_notebook` | `rest_visit` | "The Tattered Notebook fills itself while you rest. New entries. Not in your handwriting." |
| `obsidian_dice` | `mystery_visit` | "The Obsidian Dice rattle in your pack. They want to be thrown." |
| `blood_price` | `hp_below_30` | "Blood Price throbs. It's been counting what you've spent." |
| `insight_prism` | `high_mastery` | "The Insight Prism refracts — seven colors, seven truths you didn't know you held." |
| `surge_capacitor` | `surge_turn` | "The Surge Capacitor overflows. The dungeon's rhythm and yours are synchronized." |

**Content target:** ~75 relic callback lines covering the most narratively interesting relics. Not every relic needs one — passive stat relics (whetstone, iron_shield) can be skipped.

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Thread 4: The Inhabitants (NPC Memory)

Each special room type has a **character** who persists across visits within a run. They remember what happened before. They react to the player's state. They have personality.

### The Merchant (Shop Rooms)

**Personality:** Ancient, mercantile, slightly predatory. Trades in knowledge and memory. Not evil — transactional. Sees the player as a customer, not a hero.

**Dialogue structure:**
```yaml
merchant:
  greeting:      # Indexed by visit count (1, 2, 3, 4+)
  state_reactive: # Keyed by player condition (hp_low, hp_full, many_relics, no_gold)
  on_purchase:   # Keyed by purchase type (card, relic, heal)
  farewell:      # Default + conditional variants
```

**Greeting by visit count:**
1. "Ah. A new seeker. Everything here has a price. Some prices are visible."
2. "You return. The desperate always do."
3. "Three visits. You are either wealthy in knowledge or bankrupt in options."
4+. "I have nothing left to sell you that you can afford. But let us pretend."

**State reactive:**
- `hp_low`: "You look like the last one. They did not make it past the next floor."
- `hp_full`: "Untouched? Impressive. Or perhaps the dungeon simply hasn't tried yet."
- `many_relics`: "Quite the collection. Careful — relics remember their previous owners. Not all memories are kind."
- `no_gold`: "Empty pockets. The dungeon provides, but it always collects."

**On purchase:**
- Card: "That one wanted to be found. Cards choose their wielders, down here."
- Relic: "It will serve you. For now. Relics have their own loyalties."
- Heal: "The wound closes. The memory of it does not."

**Farewell:**
- Default: "The dungeon always has more to sell. Whether you can afford it is another matter."
- `hp_low`: "Survive. I prefer return customers to corpses. Corpses pay poorly."

### The Keeper (Rest Sites)

**Personality:** Weary, compassionate, ancient. Has watched countless seekers rest here. Offers reflection, not transactions.

**Greeting by visit count:**
1. "Rest. The knowledge will wait. It always waits."
2. "Again you find your way here. The dungeon permits rest — but charges interest."
3. "You know the way to me by heart now. That is either comforting or concerning."

**On rest action:**
- `hp_low`: "You barely made it. Sleep. The facts will rearrange themselves while you dream."
- `hp_high`: "You rest from caution, not necessity. Wise. The last one who didn't... well."

**On card upgrade:**
- Default: "The card sharpens. Knowledge refined is knowledge weaponized."
- `high_mastery`: "You already understand this deeply. The upgrade is a formality — the mastery was earned."

**Reflection lines (random, delivered during rest):**
- "Every seeker asks the same question eventually: is the knowledge worth what it takes from you?"
- "The ones who make it to the bottom are never the same when they return. If they return."
- "I was a seeker once. Then I became the rest. There are worse fates."

### The Oracle (Mystery Rooms)

**Personality:** Unsettling, omniscient, speaks in riddles that turn out to be literal. A fragment of the Creature Below, closer to the surface.

**Greeting by visit count:**
1. "You were expected. Not by me — by the question you haven't answered yet."
2. "We meet again. Or perhaps for the first time. Sequence is unreliable here."
3. "Three visits to the oracle. The first two were preparation. This one matters."

**Chain references (uses actual chain distribution data):**
- "Three colors bind your knowledge: {chain_0_color}, {chain_1_color}, {chain_2_color}. One of them is lying."
- "The {dominant_chain_color} chain grows fat with your correct answers. Beware what you feed."

**Fact callbacks — THE showpiece moment:**

The Oracle references a specific fact the player learned earlier in the run. It selects from `RunNarrativeState.memorableFacts` weighted by:
1. **Distance** — facts from further back are MORE impressive (Floor 1 fact referenced on Floor 3 = "how did it know that?!")
2. **Gravity** — only medium+ gravity facts
3. **Uniqueness** — not already echoed by Thread 2

**CRITICAL RULE:** The Oracle can ONLY reference facts the player has already been quizzed on during this run. `memorableFacts[]` is populated exclusively from encounter results — never from the deck's unplayed fact pool. If the player hasn't seen "Cleisthenes" as a question yet, the Oracle cannot mention Cleisthenes. This applies to ALL fact-reactive content across all threads.

**Callback templates by answer type:**
- Person: "You learned of {echoText}. They tried this dungeon too. Floor {N}. That's where they stopped."
- Place: "{echoText} exists above. Down here, it exists differently. You will see."
- Concept: "You think you understand {echoText}. The final floor will correct that assumption."
- Foreign word: "'{echoText}.' You said it on floor {N}. The walls have been repeating it since."

**Foreshadowing:**
- `boss_next`: "The guardian ahead was built from everything you got wrong. Prepare accordingly."
- `floor_end`: "This level ends soon. What comes next remembers what you brought."
- `final_floor`: "The last floor is not a test of knowledge. It is a test of what knowledge made you."

**Callback reach:** The entire run, weighted by recency. Maximum ONE fact callback per Oracle visit — multiple callbacks dilute impact.

### The Guardian (Boss Rooms)

**Personality:** Silent, massive, constructed from knowledge. Not evil — a test. Speaks through presence, not words.

**Pre-battle:**
- Default: "It does not speak. It does not need to. The question it poses is written in its stance."
- `hp_high`: "It studies you — unhurried. You are strong. It wants to know why."
- `hp_low`: "It smells the blood on your knowledge. Weakened seekers draw harder tests."

**Mid-battle (at 50% boss HP):**
- Default: "The guardian falters. Your answers cut deeper than steel ever could."
- `player_struggling`: "It recovers. Your hesitation feeds it. Certainty is the only weapon here."

**Post-battle:**
- Default: "The guardian dissolves. Not dead — returned to the knowledge it was made from."
- `flawless`: "It never touched you. In its final moment, something like respect crosses its face."
- `barely_survived`: "You stand. Barely. The guardian's remains whisper: the next one knows what you don't."

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## The Weaving Engine

The algorithmic heart that selects which lines appear after each room.

### Selection Algorithm

```
After each room:

1. CHECK which threads have pending content:
   - Descent: Is this a beat point for the current archetype?
   - Echo: Were facts answered in the last encounter?
   - Seeker: Has player state changed meaningfully since last Seeker line?
   - Inhabitants: Was this a special room (shop/rest/mystery/boss)?

2. BUDGET lines per room type:
   - Standard room transition: 1-2 lines (brief, ambient)
   - Special room entry (shop/rest/mystery): 2-4 lines (NPC dialogue)
   - Post-boss: 2-3 lines (aftermath + echo)
   - Standard room entry: 1 line (rotate threads)

3. PRIORITY rules:
   - Inhabitants ALWAYS fire for special rooms (they're the character moments)
   - Descent beats take priority when they trigger (structural moments)
   - Echo Chamber fires at MOST every other room (prevents fatigue)
   - Seeker lines fire on STATE CHANGE only (HP dropped, streak broke, new relic)

4. DEDUP and cooldown:
   - Track shown line template IDs per run — no same template twice
   - Same answer can't be echoed twice (even in different templates)
   - Cooldown per thread: 2 rooms minimum between same-thread lines
   - Never two lines from the same thread in a single room transition

5. FALLBACK: If no thread has content, pick from domain ambient lines
```


### Public API (src/services/narrativeEngine.ts — 2026-04-03)

| Function | Signature | Description |
|---|---|---|
| `initNarrative` | `(runState: RunState) => void` | Initialize state for a new run. Selects archetype + lens from seed. Call once at run start. |
| `recordEncounterResults` | `(data: EncounterNarrativeData) => void` | Record encounter facts into memorableFacts. Call after victory. |
| `getNarrativeLines` | `(ctx: NarrativeContext) => NarrativeLine[]` | Main entry point — returns 1-3 lines for a room transition. |
| `recordShopPurchase` | `(type) => void` | Feed merchant state-reactive dialogue. |
| `recordRestAction` | `(action) => void` | Feed keeper state-reactive dialogue. |
| `getNarrativeState` | `() => RunNarrativeState | null` | Read state for Expedition Journal. |
| `resetNarrative` | `() => void` | Clear state on run end. |
| `fillTemplate` | `(text, vars) => string` | Replace {key} and {key|capitalize} placeholders. |

**Input types defined in narrativeEngine.ts:**
- `EncounterNarrativeData` — correct/wrong answers, chain completions, domain, boss/elite flags
- `NarrativeContext` — roomType, HP, streak, relicIds, chainColors, floor/segment, post-boss flag

**Integration hooks wired (gameFlowController.ts — 2026-04-03):**
- `preloadNarrativeData()` — fire-and-forget at module init (line ~147)
- `initNarrative(run)` — called in `onArchetypeSelected()` after `activeRunState.set(run)`
- `recordEncounterResults()` — called in `onEncounterComplete()` victory branch, using a `NarrativeEncounterSnapshot` captured in `encounterBridge.ts` before `activeTurnState` is cleared
- `getNarrativeLines()` — called post-encounter (auto-fade) and on special-room entry (auto-fade)
- `recordShopPurchase('relic')` — in `onShopBuyRelic()`
- `recordShopPurchase('card')` — in `onShopBuyCard()`
- `recordRestAction('upgrade')` — in `onUpgradeSelected()`
- `resetNarrative()` — in `finishRunAndReturnToHub()`

**NarrativeEncounterSnapshot** (added to `encounterBridge.ts`):
Because `activeTurnState` is cleared inside a 550ms setTimeout before `notifyEncounterComplete` fires,
TurnState data is unavailable in `onEncounterComplete`. The bridge now captures a `NarrativeEncounterSnapshot`
just before clearing — containing `answeredFactIds`, `fizzledFactIds` (wrong charges, mapped from turnLog fizzle entries),
`isBoss`, `isElite`, `enemyId`, and `streakAtEnd`. `gameFlowController` reads this snapshot via
`getLastNarrativeEncounterSnapshot()` and clears it via `clearNarrativeEncounterSnapshot()` after consumption.
Fact details (answer text, quizQuestion) are resolved synchronously from `factsDB.getById()`.

### Display System

**Room transitions:** Brief black screen with atmospheric fog/particle CSS animation. Narrative text fades in with slight delay. Player clicks to advance OR waits for auto-fade (3-4 seconds for 1 line, 4-5 seconds for 2 lines).

**NPC dialogue (shops/rest/mystery):** Click-through each line, no auto-fade. More intimate pacing for character moments.

**Implementation:** Svelte overlay (`position: fixed`) on top of the parallax transition shader. Black background with CSS fog animation. Text rendered with the game's RPG font.

### Line Count Per Room Type

| Room Type | Lines | Pacing |
|---|---|---|
| Combat room transition | 1 line | 3s auto-fade or click |
| Pre-boss | 1-2 lines | Click-through |
| Post-boss | 2-3 lines | Click-through |
| Shop entry | 2-3 lines (greeting + state) | Click-through |
| Rest site entry | 2-3 lines (greeting + reflection) | Click-through |
| Mystery room entry | 2-4 lines (greeting + oracle content) | Click-through |
| Floor transition | 1-2 lines (descent beat + ambient) | 4s auto-fade or click |

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Run Narrative State

A lightweight object maintained throughout the run, tracking everything the narrative engine needs.

### `RunNarrativeState` Interface (Implemented — `src/services/narrativeTypes.ts`)

```typescript
interface RunNarrativeState {
  // Structural
  archetypeId: string;              // "lost_archive", "the_trial", etc.
  domainLensId: string;             // "history_ancient", "language_east_asian"
  currentBeat: number;              // Which archetype beat we're on (0-5)

  // Echo memory
  memorableFacts: FactEcho[];       // Facts worth referencing (filtered for quality)
  echoesShown: Set<string>;         // Fact IDs already echoed (no repeats)
  lastChainCompletion: string[];    // Most recent chain answer sequence

  // Inhabitant memory
  shopVisits: number;
  restVisits: number;
  mysteryVisits: number;
  lastShopPurchaseType?: 'card' | 'relic' | 'heal';
  lastRestAction?: 'rest' | 'upgrade';

  // Seeker state tracking (for change detection)
  prevHpPercent: number;
  prevStreak: number;
  prevRelicCount: number;
  relicsSeen: string[];             // For relic-specific callbacks

  // Display tracking
  linesShown: Set<string>;          // Template ID dedup
  threadCooldowns: Map<string, number>; // Thread -> rooms until eligible
}
```

### `FactEcho` Interface (Implemented — `src/services/narrativeTypes.ts`)

```typescript
interface FactEcho {
  factId: string;
  answer: string;              // The correctAnswer field (English for vocab)
  echoText: string;            // What to use in templates: foreign word for vocab, correctAnswer for knowledge
  quizQuestion: string;        // Original question (for context_echo templates)
  answerType: 'person' | 'place' | 'date' | 'number' | 'concept' | 'foreign_word' | 'object';
  gravity: 'high' | 'medium' | 'low';
  domain: string;
  wasCorrect: boolean;
  roomNumber: number;       // When encountered
  responseTimeMs?: number;  // How long player took (engagement signal)
  chainColor?: string;      // Which chain it belonged to
}
```

### State Persistence

`RunNarrativeState` lives on `RunState.narrativeState` (optional). It is **NOT saved to disk** — narrative is ephemeral per run. If the player quits mid-run and resumes, narrative state is lost (acceptable — the structural archetype can be re-derived from the seed, and echo memory starts fresh from current room).

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## The Expedition Journal

The camp's unused Expedition Journal becomes the home for run narrative logs.

### After a run, the journal contains:
- Every narrative line shown during the run, in chronological order
- Which room each line appeared in
- The facts that triggered echo lines (highlighted, linked to study data)
- The archetype name revealed: *"This expedition followed The Convergence"*

### Cross-run tracking:
- "You have experienced 7 of 12 descent archetypes" — completionist hook
- Players replay to see different archetypes with different decks
- Each archetype + domain combination feels distinct

### Journal as replayability driver:
- Different decks produce different domain lenses — same archetype, different flavor
- Different performance (HP, streaks) produces different Seeker lines
- Different facts answered produces different Echo lines
- Estimated unique run narratives: effectively unlimited

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Content Budget

| Content Type | Authored Lines | Effective Unique Outputs |
|---|---|---|
| Descent archetype beats | 12 x 6 = ~72 templates | x 15 lenses = **1,080** |
| Echo templates (high gravity) | ~40 | x unlimited answers = **infinite** |
| Echo templates (medium gravity) | ~25 | x unlimited answers = **infinite** |
| Echo templates (answer-free) | ~15 | 15 |
| Echo templates (chain completion) | ~10 | x unlimited combos = **infinite** |
| Echo templates (wrong answer) | ~8 | 8 |
| Seeker state lines | ~60 | 60 |
| Seeker relic callbacks | ~75 (across ~40 relics) | 75 |
| Merchant dialogue | ~30 | 30 |
| Keeper dialogue | ~25 | 25 |
| Oracle dialogue | ~35 | x fact callbacks = **infinite** |
| Guardian dialogue | ~20 | 20 |
| Domain ambient lines | 15 packs x 10 = ~150 | 150 |
| Domain lens definitions | 15 | (structural, not lines) |
| **Total authored** | **~580 lines + 15 lens defs** | **Thousands of unique combinations** |

Total authoring volume: ~8-10 pages of writing. Manageable scope.

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Data File Structure

```
data/narratives/
  archetypes/
    lost_archive.yaml
    sealed_vault.yaml
    scholars_descent.yaml
    the_infection.yaml
    the_trial.yaml
    the_excavation.yaml
    the_convergence.yaml
    the_bargain.yaml
    the_cartographer.yaml
    the_heresy.yaml
    the_resonance.yaml
    the_wake.yaml
  lenses/
    history_ancient.yaml
    history_modern.yaml
    science_biology.yaml
    language_european.yaml
    ... (15 total)
  echoes/
    person.yaml
    place.yaml
    concept.yaml
    foreign_word.yaml
    date.yaml
    number.yaml
    object.yaml
    chain_completion.yaml
    wrong_answer.yaml
    answer_free.yaml
  inhabitants/
    merchant.yaml
    keeper.yaml
    oracle.yaml
    guardian.yaml
  seeker/
    hp_reactive.yaml
    streak_reactive.yaml
    floor_reactive.yaml
    relic_callbacks.yaml
  ambient/
    history_ancient.yaml
    science_biology.yaml
    ... (15 total, matching lenses)

src/services/
  narrativeEngine.ts      — Core engine: archetype selection, slot-filling, beat tracking, line selection
  narrativeTypes.ts       — TypeScript interfaces (RunNarrativeState, FactEcho, etc.)
  narrativeGravity.ts     — Answer type classification and gravity scoring
  narrativeLoader.ts      — Runtime loader with caching and preloadNarrativeData()

public/data/narratives/     — Build output (JSON, generated by scripts/build-narratives.mjs)
  manifest.json             — Index of all narrative files
  archetypes/*.json
  lenses/*.json
  echoes/*.json
  inhabitants/*.json
  seeker/*.json
  ambient/*.json
```

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Integration Points with Existing Systems

| System | Integration |
|---|---|
| `chainDistribution.ts` | Provides `TopicGroup.label` for Tier 3 theme references, chain color names |
| `turnManager.ts` | Provides encounter results: correct/wrong answers, chain completions, streaks |
| `runManager.ts` / `RunState` | Hosts `narrativeState`, provides HP/floor/relic data |
| `floorManager.ts` | Room type triggers (shop, rest, mystery, boss) |
| `relicEffectResolver.ts` | Relic IDs currently held for callback line triggers |
| `gameFlowController.ts` | Room transition hooks — where narrative display is triggered |
| Parallax transition shader | Narrative text overlays on the existing transition system |
| Expedition Journal (camp) | Post-run narrative log display |
| `audioService.ts` / Web Audio | The Creature Below drone synthesis |

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Validated Behaviors (Dry Test 2026-04-03)

Dry-tested against real facts from 6 decks (Spanish A1, Ancient Greece, Computer Science, Japanese N5, WWII, World Wonders).

| Behavior | Status | Notes |
|---|---|---|
| Foreign word echoes (Japanese kanji, Spanish vocab) | Excellent | 汚い, abandonar — atmospheric in dungeon context |
| Gravity filter prevents embarrassment | Confirmed | "500", "2.5 million", "lo" all correctly excluded |
| Oracle distance-weighted callbacks | Confirmed | Room 1 fact referenced in Room 7 — highest impact |
| Chain completion arrows with foreign words | Works well | 'aspecto' → 'abrazo' → 'acá' |
| Chain completion arrows with proper nouns | Works well | 'Tony Hoare' → 'von Neumann' → 'Linus Torvalds' |
| Emergent thematic resonance | Delightful | "abandonar" (to abandon) in a dungeon = accidental poetry |
| WWII graceful degradation (no subDeck chainThemeIds) | Works | Falls to Tier 1-2 narrative correctly |
| Boss rooms as text-heaviest moments (4 lines) | Appropriate | Pre + post battle + descent beat + echo |
| Relic callback cooldowns prevent spam | Needed | living_grimoire any_room needs 3-room cooldown |
| Thin concept echoes ("Literature", "Water") | Fixed | Added min-length rule + context_echo fallback |
| Vocab echoText extraction | Critical fix | Use foreign word from question, not English correctAnswer |

---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Open Design Questions

1. **Chain theme narrative for vocab decks** — **RESOLVED.** Vocab decks use domain lens meta-narratives only. POS labels ("Nouns", "Verbs") are never referenced in narrative text. Echo templates use foreign words extracted from questions via `echoText`. Chain completion arrows use foreign words. Validated in dry testing — Japanese and Spanish vocab echoes work excellently with foreign word extraction.

2. **Mixed playlists** — When chains span multiple decks (WWII + Japanese), use universal archetypes with `general_trivia` lens. Chain themes reference colors only, not topic names.

3. **Narrative affecting gameplay** — Currently purely cosmetic. Future possibility: rare narrative moments grant small bonuses (free charge, chain bonus). Design the trigger system to support this without implementing it yet.

4. **Save/resume** — Narrative state is NOT persisted. If player quits and resumes, narrative restarts from current room. Acceptable tradeoff vs. serialization complexity.


---

## Content Inventory (2026-04-03)

All narrative content authored and placed in `data/narratives/`. 61 YAML files across 6 directories:

| Directory | Count | Contents |
|---|---|---|
| `archetypes/` | 12 | lost_archive, sealed_vault, scholars_descent, the_infection, the_trial, the_excavation, the_convergence, the_bargain, the_cartographer, the_heresy, the_resonance, the_wake |
| `lenses/` | 15 | history_ancient, history_modern, history_medieval, science_biology, science_physics, science_computing, geography, language_european, language_east_asian, language_slavic, mythology, arts_literature, nature, philosophy, general_trivia |
| `echoes/` | 11 | person, place, concept, foreign_word, date, number, object, chain_completion, wrong_answer, answer_free, context |
| `inhabitants/` | 4 | merchant, keeper, oracle, guardian |
| `seeker/` | 4 | hp_reactive, streak_reactive, floor_reactive, relic_callbacks |
| `ambient/` | 15 | one per lens — 10 atmospheric lines each |

Total authored lines: ~580+ narrative fragments. Tone: dark, serious literary RPG throughout. Voice: The Creature Below.

---

## Implementation Status (2026-04-03)

| File | Status | What it provides |
|---|---|---|
| `src/services/narrativeTypes.ts` | IMPLEMENTED | All TypeScript interfaces: FactEcho, RunNarrativeState, NarrativeLine, DescentArchetype, DomainLens, EchoTemplate, InhabitantDialogue, SeekerLine, RelicCallback, AmbientLine, ArchetypeBeat, ArchetypeBranch, InhabitantGreeting. Type aliases: AnswerType, GravityLevel, NarrativeThread, BeatTrigger. |
| `src/services/narrativeGravity.ts` | IMPLEMENTED | Pure functions: classifyAnswerType(), scoreGravity(), extractForeignWord(), buildEchoText(), isHistoricalYear(), hasNonLatinChars(). 74 unit tests. |
| `src/services/narrativeGravity.test.ts` | IMPLEMENTED | 74 passing tests covering all classification rules, gravity scoring, edge cases. |
| `src/services/narrativeEngine.ts` | IMPLEMENTED | Core engine: archetype selection, beat tracking, slot-filling, thread assembly per room. Integrated into gameFlowController (2026-04-03). |
| `src/services/narrativeLoader.ts` | IMPLEMENTED | fetch()-based loader with module-level cache. preloadNarrativeData() loads all JSON at game init. All accessors synchronous after preload. |
| `data/narratives/` | COMPLETE | 61 YAML files across 6 directories. Build script converts to JSON in public/data/narratives/. |
| `src/ui/stores/narrativeStore.ts` | IMPLEMENTED | `narrativeDisplay` writable store, `showNarrative()`, `dismissNarrative()`. The engine calls showNarrative() with lines + mode; the overlay dismisses via onDismiss. |
| `src/services/encounterBridge.ts` | INTEGRATED | `NarrativeEncounterSnapshot` interface + module-level capture in victory setTimeout. `getLastNarrativeEncounterSnapshot()` / `clearNarrativeEncounterSnapshot()` exports. |
| `src/services/gameFlowController.ts` | INTEGRATED | All 8 narrative hooks wired: preload, initNarrative, recordEncounterResults, getNarrativeLines (post-encounter + special rooms), recordShopPurchase (relic/card), recordRestAction (upgrade), resetNarrative. |
| `src/ui/components/NarrativeOverlay.svelte` | IMPLEMENTED | Full-screen overlay: black + CSS fog, italic RPG text, auto-fade and click-through modes. Props: lines, mode, onDismiss. z-index 950. CardApp.svelte wiring is PLANNED (separate task). |

### Implementation Notes

**classifyAnswerType()** classification priority:
1. partOfSpeech present (vocab fact) → foreign_word
2. Non-Latin Unicode characters → foreign_word
3. Historical year pattern (1000-2100, or N BCE/AD) → date
4. Boolean string (True/False/Yes/No) → number
5. >50% digit chars in answer → number
6. Capitalised words (1-3, no digits, no special chars): "The X" prefix → place; 2+ words → person; 1 word: question keyword disambiguation (geographic keywords → place, person keywords → person; default person)
7. Multi-word all-lowercase → concept
8. Single all-lowercase with abstract suffix (-ism, -ity, -tion, -sis, -ogy, etc.) → concept
9. Fallback → object

**scoreGravity()** gravity rules:
- foreign_word → always high (no length override — short foreign scripts are still atmospheric)
- Answers < 4 chars → always low (except foreign_word)
- place → high
- person + history/mythology/philosophy domain → high; other domains → medium
- concept + length < 8 → low; science/philosophy domain → high; other → medium
- date → medium
- number → low
- object → medium
