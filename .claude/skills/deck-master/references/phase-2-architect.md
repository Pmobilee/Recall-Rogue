# deck-master — Phase 2: Architect

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/deck-master`
**Covers:** The architecture phase — pool-first design philosophy, the YAML spec template, semantic homogeneity checks, comprehensive coverage rules, sub-deck design, chain themes, the mandatory provenance document structure, and all design decisions that must be made BEFORE any facts are generated.

---

## Goal

Design the complete pedagogical structure BEFORE any facts are generated. The architecture spec is the contract for the generation phase.

---

## Curated Deck Design Philosophy — CRITICAL

**A curated deck is NOT a trivia collection.** It is a carefully crafted ecosystem where every fact, every answer pool, every question template, and every confusion pair work together to build genuine understanding. This section is mandatory reading before any deck creation work.

### The #1 Mistake: Entity-First Design

**The wrong approach:** "Let me grab all solar system entities from Wikidata and generate questions about each one." This produces a trivia deck with a curated label — a flat list of disconnected facts that could just as easily be random trivia questions.

**The right approach: Pool-first design.** Start by asking "What pools of confusable answers can I build?" and "What question templates create interesting difficulty curves?" The entities follow from the pools, not the other way around.

### Pool-First Design Process

The answer type pools ARE the deck's educational backbone. At runtime, distractors are drawn from these pools, weighted by the confusion matrix. This means:

1. **Each pool must contain members that are genuinely confusable with each other.** "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune" is a great pool — players WILL mix up which planet has which property. A pool of random asteroid names nobody's heard of is useless.

2. **Pools must have 5+ members minimum** (1 correct + 4 distractors at high mastery). But aim higher — 8+ members create richer confusion matrices over time.

3. **The pools define what the deck teaches.** If your deck has pools for planet_names, moon_names, and mission_names, the deck teaches planetary identity, moon-planet relationships, and exploration history. If it has a pool for orbital_period_days with 50 entries, you've built a memorization grind, not an educational experience.

4. **Cross-pool question templates are where the magic happens.** "Which planet has the moon Europa?" uses planet_names as the answer pool but tests knowledge about moons. "Which mission was the first to orbit Jupiter?" uses mission_names but tests planetary knowledge. These cross-references build connected understanding, not isolated recall.

### Question Templates Drive the Difficulty Curve

A single fact isn't one question — it generates multiple questions at different mastery levels via question templates:

- **Mastery 0**: Easiest template — "What is the largest planet in the solar system?" (recognition)
- **Mastery 1-2**: Standard + reverse — "Which planet is known as the Red Planet?" → "What is Mars known as?"
- **Mastery 3+**: Harder variants — "Which planet is between Venus and Mars?" (relational reasoning)
- **Mastery 4-5**: Hardest — comparative, counterintuitive, or multi-step — "Which planet has the highest surface temperature?" (Venus, not Mercury — requires understanding greenhouse effect)

**Design templates that force reasoning, not just recall.** "What is the 5th planet?" is rote. "Which planet could fit all other planets inside it?" teaches scale. The best templates make the player think about relationships between entities.

### The Confusion Matrix Is Your Secret Weapon

The runtime confusion matrix tracks what players actually mix up. But deck designers can **seed** obvious confusion pairs at build time:

- Monroe ↔ Madison (both "James M___" presidents)
- Jupiter ↔ Saturn (both gas giants, players confuse their properties)
- Europa ↔ Enceladus (both icy moons with subsurface oceans)

These seeded confusions tell the distractor system to preferentially pair these as distractors, accelerating the adaptive difficulty from the first encounter. Design your deck to ANTICIPATE what will confuse learners.

### What Makes a Fact Worth Including

Every fact in a curated deck must earn its place. Ask:

1. **Does it belong to a pool with 5+ confusable members?** If it's an orphan fact with no natural distractor pool, it doesn't belong in a curated deck (it might work fine as trivia).
2. **Does it connect to other facts in the deck?** The best facts create "aha" moments when the player realizes how two things relate. "Venus is hotter than Mercury" connects to "Venus has a thick CO2 atmosphere" — together they teach the greenhouse effect.
3. **Does it support multiple question templates?** A fact that only works as one question type is thin. A fact about Jupiter's Great Red Spot can ask: what planet has it (planet_names pool), how long it's existed (bracket number), what it is (feature_names pool).
4. **Is it counterintuitive or surprising?** "Saturn could float in water", "A day on Venus is longer than its year", "Olympus Mons is 3x taller than Everest" — these are the facts players remember and share. Prioritize them.
5. **Does it avoid being pure rote memorization?** "Neptune is the 8th planet" teaches nothing interesting. "Neptune was predicted mathematically before it was observed" teaches something profound about science.

### What Does NOT Belong in a Curated Deck

- **Catalog entries** nobody cares about (minor moons, unnamed asteroids, obscure missions)
- **Dry measurement facts** with no comparative context ("Jupiter's radius is 69,911 km" — so what?)
- **Facts that only work as one flat question** with no template depth
- **Facts with no natural distractor pool** (orphan facts that can't participate in the confusion matrix ecosystem)
- **Anything you'd find in a random trivia game** without the connected understanding that makes curated decks special

---

## Comprehensive Coverage & Narrative Depth — CRITICAL

**The Trust Test:** When a player masters a deck, they must be able to confidently say "I know [topic]" at a dinner party. If the deck is too shallow for that, it has failed. A curated deck is not a sampler plate — it is an education.

### Inclusion Threshold

- **Include** if a casual fan would recognize the name or feel embarrassed not knowing it
- **Include** if it's needed to understand a story that IS included (you can't tell the Trojan War without Paris, even if Paris isn't "major")
- **Exclude** only truly academic/obscure entries that no one outside a university course would encounter
- The threshold is NOT "does it have a Wikipedia article" — everything does. It's "would a well-read person know this?"

### Facts-Per-Entity Depth

One fact per entity is a glossary, not a deck. Players must learn enough about each entity to actually understand it.

| Entity importance | Facts | What they must cover |
|---|---|---|
| Major (Zeus, Medusa, Heracles, Lincoln, Jupiter) | 4-8 | Identity, key myth/event, origin/backstory, relationships to others, cultural legacy, counterintuitive detail, Roman equivalent or alternate name |
| Medium (Sphinx, Artemis, Atalanta, Fillmore, Titan) | 2-4 | Key trait, key myth/event, one surprise, how they connect to other entities |
| Minor (Griffin, Iris, Nereus, Chester Arthur) | 1-2 | The one thing that makes them distinctive and why they matter |

A Monsters sub-deck with 25 creatures and 25 facts means 1 fact per creature — the player learns a name and nothing else. That's a flashcard list, not knowledge. 25 creatures with 60-80 facts means the player actually KNOWS those creatures.

### Narrative Coverage

**Stories must be told as stories, not isolated facts.** This is the difference between "knowing Greek mythology" and "knowing some Greek mythology trivia."

A deck that teaches "Odysseus was clever" and "Cyclops was a one-eyed giant" as separate facts has FAILED — the player never learns that Odysseus BLINDED the Cyclops by driving a burning stake into his eye, or that he escaped by hiding under sheep, or that this act caused Poseidon to curse his voyage home. The CONNECTION is the knowledge.

**Rules for narrative coverage:**

- Every major narrative arc in the domain must have enough facts to tell the story: setup, conflict, resolution, aftermath
- Connected facts must cross-reference each other in explanations ("This is the same golden fleece Jason sailed to Colchis to find")
- A player who masters all facts in a narrative sequence should be able to RETELL the story, not just answer isolated questions about it
- The `explanation` field is the primary vehicle for narrative threads — use it to link facts into story arcs

**During architecture phase, identify all narrative arcs:**

- List every major story/arc in the domain
- Each major arc needs: inciting incident, key episodes, climax, aftermath (minimum 4-6 facts)
- Each minor arc needs: setup, key moment, outcome (minimum 2-3 facts)
- Map which entities appear in which arcs — this reveals natural interweaving points

**Examples of narrative depth:**

- Trojan War arc (10+ facts): golden apple → Judgment of Paris → abduction of Helen → Achilles joins → Achilles' rage → Hector's death → wooden horse → fall of Troy → aftermath
- 12 Labors of Heracles (12+ facts): each labor as its own fact, plus the setup (why he had to do them) and the aftermath
- The Odyssey (8+ facts): each major episode (Cyclops, Circe, Sirens, Scylla/Charybdis, Calypso, Penelope's suitors, recognition scene)

### Interweaving & Cross-References

**The best facts connect entities across sub-decks.** These connections build the web of understanding that makes someone actually "know" a topic rather than knowing isolated fragments.

- A Medusa fact in Monsters links to Perseus in Heroes ("Perseus killed Medusa using Athena's mirrored shield")
- A Prometheus fact in Titans links to Zeus in Olympians ("Zeus chained Prometheus to a rock for stealing fire")
- An Underworld fact links to Orpheus in Heroes ("Orpheus descended to the Underworld to rescue his wife Eurydice")
- A Trojan Horse fact links to Odysseus ("The wooden horse was Odysseus's idea")

**Rule:** At least 20% of facts in a comprehensive deck should explicitly reference entities from OTHER sub-decks in their question or explanation. This is what transforms a collection of sub-decks into a unified body of knowledge.

### Target Fact Ranges by Domain Size

| Domain scope | Target facts | Sub-decks | Examples |
|---|---|---|---|
| Narrow | 60-100 | Optional | Solar System, US Presidents |
| Medium | 100-200 | Recommended | Periodic Table, US States |
| Deep | 250-400 | Required (30+ facts each) | Greek Mythology, WWII, Ancient Rome |
| Encyclopedic | 400+ | Required, split by era/region | World History, All Animals |

The target is driven by the content, not arbitrary numbers. A topic with 50 entities at 4 facts each naturally produces ~200 facts. Don't pad to hit a number, but don't artificially constrain either.

### Sub-Deck Rules

- Any deck over 100 facts MUST have sub-decks so players can focus their study
- Each sub-deck must be independently playable (30+ facts minimum)
- Sub-decks should be thematic and narratively coherent, not arbitrary alphabetical/numerical splits
- A player who completes one sub-deck should feel they learned something complete and coherent
- Sub-decks should have natural interweaving points (shared characters, cause-effect chains across sub-decks)

### Domain-Specific Pool Types

Some domains benefit from pool types beyond the standard name/term/place/number:

- **Mythology/History:** Add `object_names` pool for famous artifacts, weapons, and symbols (Golden Fleece, Pandora's Box, Excalibur, Holy Grail). These are essential knowledge that isn't captured by entity-name pools.
- **Science:** Add `concept_names` pool for named laws, effects, and phenomena (greenhouse effect, plate tectonics, natural selection)
- **Geography:** Add `landmark_names` pool for famous natural/built features
- **Music/Art:** Add `work_names` pool for famous compositions, paintings, novels

---

## Architecture Process

1. **Deep domain research** — Wikipedia, Wikidata, authoritative sources. Understand the full scope.
2. **Identify data sources** — Which Wikidata properties? Which Wikipedia categories? Which authoritative databases? Document these in the architecture.
3. **Identify natural answer types** — names, dates, places, terms, categories, numbers? **THIS IS THE MOST IMPORTANT STEP.** The pools you define here ARE what the deck teaches.
4. **Define answer type pools** — group potential facts by answer format; verify each pool has 5+ members after synonym exclusions. Pools with fewer than 5 must be merged with a related pool or use bracket-number runtime generation.

   **Semantic homogeneity self-review — MANDATORY before proceeding to step 5:** After naming your pools, apply this test for each pool: "If I showed a player the 4 quiz options, could they eliminate wrong answers just by the *type* of thing they are, without knowing anything about the subject?" If yes, split the pool.
   - Never mix: person names with descriptions, game consoles with streaming services, hardware specs with pop-culture trivia
   - Common contamination patterns: (consoles + streaming), (inventor names + descriptions), (hardware + media + trivia)
   - Only facts of the same semantic category belong together — "Netflix" and "Game Boy" are both 1-2 words but are not confusable answer types

5. **Design question templates** — for each answer type pool: what question formats make sense? Templates MUST span a mastery-driven difficulty curve: simple recognition at mastery 0, standard/reverse at mastery 1-2, relational reasoning at mastery 3+, counterintuitive/comparative at mastery 4-5. Templates that force reasoning over rote recall are always preferred.
6. **Identify common confusions** — what do learners typically mix up? These pairs are SEEDED into the confusion matrix at deck build time. Good seeded pairs share a surface similarity (same first letter, same era, same category) that fools learners at low mastery.
7. **Identify synonym groups** — answers that are semantically interchangeable (e.g., "Civil War" / "War Between the States"). Facts in the same synonym group must NEVER appear as each other's distractors.
8. **Define chain slots (NOT required to be subcategorized):**
   - For NOW, named/thematic chain themes are NOT required. Facts can simply be assigned to generic chain slot types (Obsidian/Crimson/Azure/Amber/Violet/Jade) distributed evenly across all facts.
   - Vocabulary decks: always use generic chains — no thematic grouping
   - Knowledge decks: also use generic chains for initial builds. Themed groupings are a future enhancement — skip for now.
   - Assign `chainThemeId` as a generic slot index (0-5) distributed evenly across facts.
9. **Set difficulty tiers** — easy (universally known), medium (commonly known), hard (obscure)
10. **Identify required visual assets** — what images/icons does this deck need? Where will they come from? What license?
11. **Validate structure** — confirm every pool has 5+ members, total facts meets target, chain slots are evenly distributed, no synonym group is so large it starves the distractor pool (flag groups >4 facts). **Re-run the semantic category-type elimination test on the finalized pool list** — pools assembled from real facts sometimes drift from their intended type.

---

## Output Format — Architecture YAML

Save to `data/deck-architectures/<deck_id>_arch.yaml`:

```yaml
deck_id: us_presidents
name: "US Presidents"
domain: history
sub_domain: american_government
target_facts: 46
minimum_facts: 30

# Sourcing & licensing (MANDATORY)
data_sources:
  - name: Wikipedia
    url: https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States
    license: CC-BY-SA-4.0
    usage: fact text, explanations
  - name: Wikidata
    url: https://www.wikidata.org/wiki/Q11696
    license: CC0
    usage: structured data (dates, party, state)
  - name: Library of Congress
    url: https://www.loc.gov/rr/print/list/057_chron.html
    license: public domain
    usage: verification, portraits reference

asset_sources:
  - type: portraits
    source: Wikimedia Commons
    license: public domain (US government works)
    note: "Official presidential portraits are public domain"
  - type: party_icons
    source: custom pixel art
    license: original work
    note: "Generate via ComfyUI"

answer_type_pools:
  - id: president_names
    format: name
    estimated_count: 46
    min_distractors: 4
  - id: inauguration_years
    format: bracket_number
    estimated_count: 46
    note: "Use bracket system — runtime generation, not pool distraction"
  - id: party_names
    format: term
    estimated_count: 8
    note: "Small pool — merge with era labels if under 5"
  - id: home_states
    format: place
    estimated_count: 30

# chain_themes: NOT required for initial decks.
# Facts are assigned to generic chain slots (0-5) distributed evenly across all facts.
# Named/thematic chain groupings (e.g., "Founding Fathers", "Civil War Era") are a future
# enhancement for replayability. Skip for now — generic slots work fine in-game.
# When themed chains are added later, they go here:
#   chain_themes:
#     - id: 0
#       name: "Founding Fathers"
#       color: "#546E7A"
#       estimated_facts: ["washington", "j_adams", "jefferson", "madison", "monroe"]

question_templates:
  - id: name_from_number
    format: "Who was the {ordinal} president of the United States?"
    answer_pool: president_names
    available_from_mastery: 0
    difficulty: 1
  - id: number_from_name
    format: "What number president was {name}?"
    answer_pool: ordinal_numbers
    available_from_mastery: 2
    difficulty: 3

common_confusions:
  - ["monroe", "madison"]           # James M___
  - ["j_adams", "jq_adams"]        # Father and son
  - ["roosevelt_t", "roosevelt_f"] # Different Roosevelts

synonym_groups:
  - id: civil_war_johnsons
    fact_ids: ["johnson_a", "johnson_l"]
    reason: "Both named Andrew/Lyndon Johnson; keep apart as distractors"

difficulty_tiers:
  easy: ["washington", "lincoln", "obama", "jefferson", "jfk"]
  medium: ["madison", "jackson", "grant", "eisenhower", "reagan"]
  hard: ["fillmore", "pierce", "arthur", "harrison_b", "tyler"]

# Volatile facts (data that changes over time)
volatile_facts: []
# e.g., for a "World Leaders" deck: ["current_us_president", "current_uk_pm"]
# These need periodic review and update
```

---

## Deck Provenance Documentation — MANDATORY

**Every curated deck MUST have a provenance document at `docs/deck-provenance/{deck_id}.md`.** No deck is considered complete without this. The provenance doc is the permanent record of HOW the deck was built — every source, every step, every decision.

### When to Create

- Create the provenance doc at the START of generation (Phase 3), not after
- Update it as each pipeline step runs
- Finalize it when the deck is complete

### Required Sections

Every provenance doc MUST contain:

#### 1. Sources
For every source used:
- **Name**: Human-readable source name (e.g., "Full Japanese Study Deck", "Wikipedia", "Wikidata")
- **URL**: Direct link to the source
- **License**: Exact license (CC BY-SA 4.0, CC-BY 2.0, public domain, etc.)
- **What was taken**: Exactly what data came from this source
- **Commercial use**: Confirmed yes/no with any conditions (attribution, share-alike)

#### 2. Pipeline Steps
For every step in the generation process:
- **Step name**: What was done (e.g., "Grammar point extraction", "Fill-blank generation")
- **Input**: What data went in (file paths, record counts)
- **Process**: How it was transformed (script name, agent type, algorithm)
- **Output**: What came out (file paths, record counts)
- **Validation**: What checks were run on the output

#### 3. Distractor Generation
- **Method**: How distractors were generated (confusion groups, LLM, conjugation tables, etc.)
- **Sources**: Where distractor content came from
- **Validation**: How distractors were checked for correctness (not accidentally correct, semantically plausible)

#### 4. Fact Verification
- **Method**: How factual accuracy was verified
- **Sources checked**: Which sources were consulted
- **Known limitations**: Any facts that couldn't be fully verified
- **Error rate**: If QA was run, what was found and fixed

#### 5. Quality Assurance
- **Checks run**: typecheck, build, unit tests, visual inspection, playtest
- **Sample review**: Spot-check results (10+ random facts reviewed)
- **Known issues**: Any quality concerns or limitations

#### 6. Attribution Requirements
- **Exact attribution text** needed for commercial use
- **Where to display**: In-app credits, about page, etc.
- **Share-alike obligations**: If CC-BY-SA, what this means for derivative works

#### 7. Reproduction Steps
- **Exact commands** to regenerate the deck from scratch
- **Prerequisites**: What tools/data must be available
- **Environment**: Any environment requirements (Node version, etc.)

### Per-Sub-Deck Documentation

If the deck has sub-decks, each sub-deck gets its own section within the provenance doc documenting any sub-deck-specific sources, steps, or decisions.

### Example Path

```
docs/deck-provenance/
├── japanese_n3_grammar.md
├── solar_system.md
├── us_presidents.md
└── world_war_2.md
```

### Enforcement

- The orchestrator MUST verify the provenance doc exists and is complete before marking a deck as done
- Workers MUST update the provenance doc as part of their generation task
- Missing or incomplete provenance docs are treated as blocking issues — the deck cannot ship without one

---

## What's Next After Architecture

Once the YAML is complete and passes the semantic homogeneity self-review, proceed to Phase 3: **`phase-3-generate.md`**. Do NOT start generation before architecture is final — schema drift between workers is the #1 cause of assembly failures.
