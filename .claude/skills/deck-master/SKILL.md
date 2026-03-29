---
name: deck-master
description: Create curated knowledge decks for Recall Rogue. 3 phases: discover (research topics), architect (design deck structure), generate (produce facts). Per DECKBUILDER.md spec. All content programmatically sourced from authoritative, commercially-licensed sources.
---

# deck-master

## Mission

Single skill for creating high-quality curated decks. Every deck is a self-contained educational unit: its own fact pool, answer type pools, synonym groups, chain themes, and question templates. Decks power the curated run system described in `docs/RESEARCH/DECKBUILDER.md`.

**Canonical spec:** `docs/RESEARCH/DECKBUILDER.md` sections 3-9. If anything in this skill conflicts with that doc, the doc wins.

**Living brainstorm doc:** `data/deck-ideas.md` — append all discovered deck candidates here with demand signals and notes. Consult it before discovery runs to avoid duplicate research.

---

## Implementation Discipline — READ BEFORE DOING ANYTHING

This section exists because every mistake listed below was actually made during the Solar System deck build (2026-03-24). Future agents MUST follow this process to avoid repeating them.

### 🚨🚨🚨 ABSOLUTE RULE: SOURCE DATA BEFORE GENERATION 🚨🚨🚨

**NEVER EVER generate facts from LLM training knowledge. This is the #1 content pipeline failure mode.**

On 2026-03-25, an entire batch of ~270 WWII facts had to be thrown away because workers were generating facts from their training knowledge and attributing fake Wikipedia URLs they never consulted. The facts LOOKED correct but had no verified provenance.

### Two-Tier Fact Production Pipeline

Fact production uses a **two-tier model** that separates accuracy from quality:

#### Tier 1: Sonnet Workers — Research & Extraction (Accuracy)
- **Role**: Structured data extraction from authoritative sources
- **Tools**: WebSearch, WebFetch, and **Wikidata SPARQL MCP** (`mcp__wikidata__query`) for structured data from Wikidata
- **Output**: Verified source data in architecture YAML — dates, numbers, names, quotes, claims, each with source URL
- **What they do**: "Find me the exact date, casualty figure, commander names, and Wikipedia URL for the Battle of Stalingrad"
- **What they DON'T do**: Write quiz questions, explanations, wow factors, or distractors
- **Why Sonnet**: Cheap, fast, excellent at structured extraction. Can run many in parallel.

#### Tier 2: Opus Final Pass — Curation & Writing (Quality)
- **Role**: Craft the educational experience from verified data
- **Input**: The verified source data from Tier 1
- **Output**: Final DeckFact JSON with polished quizQuestion, explanation, wowFactor, distractors, variants
- **What Opus does**:
  - Writes quiz questions that force reasoning, not just recall
  - Writes explanations that connect facts into narrative arcs ("This same policy of appeasement would later lead to...")
  - Writes wow factors that make facts memorable and shareable
  - Generates distractors that are plausible and pedagogically useful
  - Creates variants (reverse, context, fill_blank, true_false) with craft
  - Ensures cross-references between subdecks (20%+ of facts reference other subdecks)
  - Applies the "dinner party test" — would mastering these facts let someone confidently discuss WWII?
  - Calibrates difficulty and funScore with full-deck context
- **Why Opus**: Creative judgment, narrative craft, full-deck awareness. This is where educational quality lives.

#### The Pipeline in Practice:
1. **Orchestrator** identifies topics for a subdeck (from AR doc)
2. **Sonnet workers** (parallel, ~5 at a time) each research 10-15 topics via WebSearch/WebFetch, writing verified data + source URLs into architecture YAML sections
3. **Orchestrator reviews** the verified data for completeness and accuracy
4. **Opus** reads the verified data and writes the final DeckFact JSON — questions, explanations, wow factors, distractors, variants
5. **QA pass** checks every fact against original sources

**If you don't have verified source data, STOP. Do not generate. Go back to the research phase.**

This applies to: dates, casualty figures, names, quotes, locations, statistics, attributions, cause-effect claims, "first/largest/longest" superlatives — EVERYTHING that is a factual claim.

### Phase 0: Research Before Implementing

**NEVER approximate an algorithm. Study the actual source.** When the Anki queue system was first implemented, the agent "approximated" Anki with weighted random, then hardcoded "every 3rd charge", then burned through all new cards first. Three rewrites. The fix was studying Anki's actual Rust source code on GitHub and replicating the real algorithm.

**Rule:** Before implementing any learning algorithm, distractor system, or queue mechanism:
1. Find the canonical source (Anki source code, published paper, reference implementation)
2. Read it. Understand the actual algorithm, not a blog summary.
3. Write the implementation plan referencing specific functions/logic from the source
4. Only then implement

### Phase 0.5: Plan Review (MANDATORY for non-trivial decks)

**Before generating any facts, the orchestrator MUST write an AR doc and review it for errors.** The AR should be reviewed in at least 2 passes:

**Pass 1 — Structural review:**
- Are the answer pools semantically coherent? (Every member genuinely confusable with others?)
- Does each pool have 5+ unique `correctAnswer` values? If not, facts in that pool need pre-generated distractors.
- Are there any questions where multiple pool members are correct? (e.g., "Which planet has rings?" — Jupiter, Saturn, Uranus, Neptune ALL have rings)
- Does the correct answer ever appear in the question text? (e.g., "Besides Saturn..." → Saturn must not be a distractor)

**Pass 2 — Runtime compatibility review:**
- Will bracket `{N}` notation work in the curated path? (YES — both `nonCombatQuizSelector.ts` and `CardCombatOverlay.svelte` handle it)
- Will question templates with `{placeholder}` patterns resolve? (Only if the placeholder maps to a DeckFact field. If not, the renderer falls back to `fact.quizQuestion`.)
- Will the deck's domain show correctly on cards? (`encounterBridge.ts` overrides card domains for study mode)
- Is the CuratedDeck envelope complete? (answerTypePools, questionTemplates, difficultyTiers, synonymGroups, subDecks)

### Mistakes That Must Never Be Repeated

| Mistake | What happened | Prevention |
|---------|--------------|------------|
| Deleting a system instead of fixing it | Bracket notation didn't work → agent deleted brackets and used pre-generated distractors | NEVER remove working systems. Fix the code path. Ask the user if unsure. |
| Approximating instead of researching | "Anki-like" weighted random → 3 rewrites | Study the actual source code. No approximations. |
| Testing only data, not runtime | All validation passed but `{8}` showed literally in-game | Run `playtest-curated-deck.ts --learner` after EVERY change |
| Arbitrary fact counts | "Let's do 50 facts" with no rationale | Let pool-first design dictate count. A deck needs enough facts per pool for good distractors, not a round number. |
| Pool pollution | "Medium-sized (G-type)" in planet_names pool | Audit every pool: does each member's `correctAnswer` make sense as a distractor for every other member? |
| Hardcoding magic numbers | "Every 3rd charge, introduce a new card" | Use proportional ratios from the source algorithm. No hardcoded rates. |

---

### Composite Deck Architecture

Source decks own their facts. Composite decks (AP World History, AP US History, Ancient Civilizations) reference facts from multiple source decks without duplication. When designing source deck pools:

- Each fact gets a globally unique ID and a `sourceDeckId` field
- SM-2 progress is keyed globally by factId, not per-deck
- Chain themes should be self-contained (composites may pull individual chains)
- Flag facts with high composite reuse potential in notes

**Full architecture:** See `data/deck-ideas.md` Section 2: Composite Deck Architecture.

### Era-Based History Series

World History is structured as 12 chronological era decks (Ancient Mesopotamia through Modern World), aligned with AP World History units where applicable. Each era has full pool architecture, chain themes, and cross-deck linking documented in `data/deck-ideas.md` Section 1.

**ALWAYS consult `data/deck-ideas.md` before starting any new deck work** — it contains pool architecture, estimated fact counts, cross-deck dependencies, and production priority for ~180 planned decks across all domains.


## Curated Deck Design Philosophy — CRITICAL

**A curated deck is NOT a trivia collection.** It is a carefully crafted ecosystem where every fact, every answer pool, every question template, and every confusion pair work together to build genuine understanding. This section is mandatory reading before any deck creation work.

### The #1 Mistake: Entity-First Design

The wrong approach: "Let me grab all solar system entities from Wikidata and generate questions about each one." This produces a trivia deck with a curated label — a flat list of disconnected facts that could just as easily be random trivia questions.

The right approach: **Pool-first design.** Start by asking "What pools of confusable answers can I build?" and "What question templates create interesting difficulty curves?" The entities follow from the pools, not the other way around.

### Pool-First Design Process

The answer type pools ARE the deck's educational backbone. At runtime, distractors are drawn from these pools, weighted by the confusion matrix. This means:

1. **Each pool must contain members that are genuinely confusable with each other.** "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune" is a great pool — players WILL mix up which planet has which property. A pool of random asteroid names nobody's heard of is useless.

2. **Pools must have 5+ members minimum** (1 correct + 4 distractors at high mastery). But aim higher — 8+ members create richer confusion matrices over time.

3. **The pools define what the deck teaches.** If your deck has pools for planet_names, moon_names, and mission_names, the deck teaches planetary identity, moon-planet relationships, and exploration history. If it has a pool for orbital_period_days with 50 entries, you've built a memorization grind, not an educational experience.

4. **Cross-pool question templates are where the magic happens.** "Which planet has the moon Europa?" uses planet_names as the answer pool but tests knowledge about moons. "Which mission was the first to orbit Jupiter?" uses mission_names but tests planetary knowledge. These cross-references build connected understanding, not isolated recall.

### Question Templates Drive the Difficulty Curve

A single fact isn't one question — it generates multiple questions at different mastery levels via question templates:

- **Mastery 0**: Easiest template — "What is the largest planet in the solar system?" (recognition)
- **Mastery 1-2**: Standard + reverse — "Which planet is known as the Red Planet?" -> "What is Mars known as?"
- **Mastery 3+**: Harder variants — "Which planet is between Venus and Mars?" (relational reasoning)
- **Mastery 4-5**: Hardest — comparative, counterintuitive, or multi-step — "Which planet has the highest surface temperature?" (Venus, not Mercury — requires understanding greenhouse effect)

**Design templates that force reasoning, not just recall.** "What is the 5th planet?" is rote. "Which planet could fit all other planets inside it?" teaches scale. The best templates make the player think about relationships between entities.

### The Confusion Matrix Is Your Secret Weapon

The runtime confusion matrix tracks what players actually mix up. But deck designers can **seed** obvious confusion pairs at build time:

- Monroe <-> Madison (both "James M___" presidents)
- Jupiter <-> Saturn (both gas giants, players confuse their properties)
- Europa <-> Enceladus (both icy moons with subsurface oceans)

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

### Comprehensive Coverage & Narrative Depth — CRITICAL

**The Trust Test:** When a player masters a deck, they must be able to confidently say "I know [topic]" at a dinner party. If the deck is too shallow for that, it has failed. A curated deck is not a sampler plate — it is an education.

#### Inclusion Threshold

- **Include** if a casual fan would recognize the name or feel embarrassed not knowing it
- **Include** if it's needed to understand a story that IS included (you can't tell the Trojan War without Paris, even if Paris isn't "major")
- **Exclude** only truly academic/obscure entries that no one outside a university course would encounter
- The threshold is NOT "does it have a Wikipedia article" — everything does. It's "would a well-read person know this?"

#### Facts-Per-Entity Depth

One fact per entity is a glossary, not a deck. Players must learn enough about each entity to actually understand it.

| Entity importance | Facts | What they must cover |
|---|---|---|
| Major (Zeus, Medusa, Heracles, Lincoln, Jupiter) | 4-8 | Identity, key myth/event, origin/backstory, relationships to others, cultural legacy, counterintuitive detail, Roman equivalent or alternate name |
| Medium (Sphinx, Artemis, Atalanta, Fillmore, Titan) | 2-4 | Key trait, key myth/event, one surprise, how they connect to other entities |
| Minor (Griffin, Iris, Nereus, Chester Arthur) | 1-2 | The one thing that makes them distinctive and why they matter |

A Monsters sub-deck with 25 creatures and 25 facts means 1 fact per creature — the player learns a name and nothing else. That's a flashcard list, not knowledge. 25 creatures with 60-80 facts means the player actually KNOWS those creatures.

#### Narrative Coverage

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

#### Interweaving & Cross-References

**The best facts connect entities across sub-decks.** These connections build the web of understanding that makes someone actually "know" a topic rather than knowing isolated fragments.

- A Medusa fact in Monsters links to Perseus in Heroes ("Perseus killed Medusa using Athena's mirrored shield")
- A Prometheus fact in Titans links to Zeus in Olympians ("Zeus chained Prometheus to a rock for stealing fire")
- An Underworld fact links to Orpheus in Heroes ("Orpheus descended to the Underworld to rescue his wife Eurydice")
- A Trojan Horse fact links to Odysseus ("The wooden horse was Odysseus's idea")

**Rule:** At least 20% of facts in a comprehensive deck should explicitly reference entities from OTHER sub-decks in their question or explanation. This is what transforms a collection of sub-decks into a unified body of knowledge.

#### Target Fact Ranges by Domain Size

| Domain scope | Target facts | Sub-decks | Examples |
|---|---|---|---|
| Narrow | 60-100 | Optional | Solar System, US Presidents |
| Medium | 100-200 | Recommended | Periodic Table, US States |
| Deep | 250-400 | Required (30+ facts each) | Greek Mythology, WWII, Ancient Rome |
| Encyclopedic | 400+ | Required, split by era/region | World History, All Animals |

The target is driven by the content, not arbitrary numbers. A topic with 50 entities at 4 facts each naturally produces ~200 facts. Don't pad to hit a number, but don't artificially constrain either.

#### Sub-Deck Rules

- Any deck over 100 facts MUST have sub-decks so players can focus their study
- Each sub-deck must be independently playable (30+ facts minimum)
- Sub-decks should be thematic and narratively coherent, not arbitrary alphabetical/numerical splits
- A player who completes one sub-deck should feel they learned something complete and coherent
- Sub-decks should have natural interweaving points (shared characters, cause-effect chains across sub-decks)

#### Domain-Specific Pool Types

Some domains benefit from pool types beyond the standard name/term/place/number:

- **Mythology/History:** Add `object_names` pool for famous artifacts, weapons, and symbols (Golden Fleece, Pandora's Box, Excalibur, Holy Grail). These are essential knowledge that isn't captured by entity-name pools.
- **Science:** Add `concept_names` pool for named laws, effects, and phenomena (greenhouse effect, plate tectonics, natural selection)
- **Geography:** Add `landmark_names` pool for famous natural/built features
- **Music/Art:** Add `work_names` pool for famous compositions, paintings, novels

---

## Game Modes Context

Decks serve TWO distinct game modes. Workers building decks must understand both:

### Study Temple (Focused Study)
- Player enters via the **Dungeon Selection Screen** -> Study Temple tab
- Browses curated decks by domain (left sidebar) -> picks a deck tile -> optionally focuses on a sub-deck
- All facts for the entire run come from that single deck (or sub-deck)
- Generic chain slots (0-5) for card combos; thematic chains are a future enhancement
- Adaptive difficulty via confusion matrix and in-run FSRS
- **ALL vocabulary content lives here** — Japanese N5-N1, Korean, Spanish, etc. are curated decks with sub-decks (Vocabulary, Kanji, Grammar)
- **This is the deep learning mode** — the reason players keep coming back

### Trivia Dungeon (Casual)
- Player enters via the **Dungeon Selection Screen** -> Trivia Dungeon tab
- Picks one or more domains and/or subdomains from the general trivia fact pool
- Facts pulled from the existing general trivia database (`src/data/seed/facts.db`, `knowledge-*.json`)
- Random fact selection — no chain theme strategy, no confusion matrix
- **Vocabulary facts are NOT available in Trivia Dungeon** — they live exclusively in Study Temple
- **This is the casual/fun mode** — zero commitment, instant variety
- Facts answered in Trivia Dungeon do NOT count toward curated deck progress (separate fact pools)

### Fact Pool Separation (CRITICAL)

**Trivia Dungeon and Study Temple use COMPLETELY SEPARATE fact pools.** There is zero overlap.

- **Trivia Dungeon** uses the existing general fact database (`src/data/seed/facts.db`, `knowledge-*.json`). These are the broad trivia facts that have always been in the game — standalone questions, no special structure. **No vocabulary/language facts** — those live exclusively in Study Temple.
- **Study Temple (Curated Decks)** use their own dedicated fact files (`data/decks/<deck_id>.json`). These are purpose-built for focused study with answer type pools, confusion matrices, and sub-decks.

Both systems can cover the same knowledge domains (e.g., both have History, Geography, etc.) and even the same sub-topics (e.g., both might have WW2 facts). But the actual fact entries are completely different — different IDs, different questions, different distractors.

**Vocabulary is curated-only.** ALL language learning content (Japanese, Korean, Spanish, French, German, Dutch, Czech, etc.) lives exclusively in Study Temple as curated decks with sub-decks (Vocabulary, Kanji, Grammar). Language facts must be removed from the general trivia pool.

**Future consideration:** Once enough curated decks exist, Trivia Dungeon could optionally pull from curated deck facts. Not for initial implementation.

### Per-Language Display Settings

Vocabulary decks may have language-specific display settings (e.g., Japanese: furigana, romaji, kana-only). These are defined in `src/types/vocabulary.ts` as `LanguageDeckOption` entries on each `LanguageConfig`. Settings are per-language (not per-deck) — they apply to ALL sub-decks of that language. When building a new language deck, check if display options should be added to the language config.

### Progress Tracking

Progress does NOT transfer between modes. A curated deck's progress bar only reflects facts answered within that deck's own Study Temple runs. Each sub-deck within a curated deck also has its own independent progress bar.

---

## Invocation

```
/deck-master discover [--domain history|science|languages|...]
/deck-master architect --topic "US Presidents" [--target-facts 46]
/deck-master generate --architecture <path/to/arch.yaml>
/deck-master full --topic "Chemical Elements" [--target-facts 118]
```

- `discover` — Phase 1 only: research demand and output ranked deck candidates
- `architect` — Phase 2 only: design deck structure for a chosen topic
- `generate` — Phase 3 only: produce facts from a completed architecture spec
- `full` — All three phases sequentially for a single topic

---

## CRITICAL: Programmatic Sourcing Rule

**ALL deck content MUST be programmatically sourced from authoritative, commercially-usable sources.** This is non-negotiable. The game is a commercial product — every fact, every asset, every data point must have a clear provenance chain.

### Data Sourcing Requirements

| Requirement | Detail |
|-------------|--------|
| **Facts** | Must be grounded in Wikipedia/Wikidata. Every fact needs a `sourceName` and `sourceUrl` pointing to the authoritative source. Never invent facts from LLM knowledge alone. |
| **Verification** | Cross-reference at least 2 sources for non-trivial claims. Wikipedia + one additional source (Britannica, official government sites, peer-reviewed databases). |
| **Numerical data** | Use the **Wikidata SPARQL MCP** (`mcp__wikidata__query`) for structured numerical facts (populations, dates, measurements). Never approximate. |
| **Visual assets** | Flag SVGs from open-source CC0/public domain repositories (e.g., flag-icons, flagpedia). Map outlines from Natural Earth (public domain). Animal/plant images from Wikimedia Commons (verify license per image). |
| **Commercial licensing** | Every asset must be CC0, CC-BY, public domain, or have explicit commercial-use permission. CC-BY-NC (non-commercial) is NOT acceptable. CC-BY-SA is acceptable if attribution is provided. |
| **Attribution tracking** | Each deck's architecture YAML must include an `asset_sources` section listing every external asset with its license type and attribution requirements. |

### What This Means in Practice

- **Flags of the World deck**: Use `flag-icons` npm package (MIT license) or `flagpedia.net` SVGs (public domain). Do NOT use random Google Image results.
- **Periodic Table deck**: Use PubChem or IUPAC data (public domain). Cross-reference with Wikidata.
- **Animal decks**: Use IUCN Red List data (verify API terms), Wikidata for taxonomy, Wikimedia Commons for reference images (check per-image license).
- **Geography decks**: Use Natural Earth shapefiles (public domain) for any map data. UN Statistics Division for country/population data.
- **Historical decks**: Wikipedia + Britannica cross-reference. Primary sources where available (Library of Congress, National Archives).

### Banned Practices

- Using LLM-generated "facts" without source verification
- Scraping copyrighted content (Quizlet sets, Anki shared decks — use for demand research only, never copy content)
- Using images/assets without verifying commercial license
- Hardcoding data that could drift (populations, "current" leaders, living records) — these need flagging as `volatile: true`
- Generating facts from LLM training knowledge and attributing fake source URLs (the #1 failure mode — happened 2026-03-25, 270 facts thrown away)
- Passing workers a topic list without verified source data and asking them to "generate facts"
- Any worker prompt that does NOT include pre-verified dates, numbers, and source URLs for every claim

---

## Phase 1: Discovery

**Goal:** Find what people actually want to learn. Identify high-demand topics with strong structural potential.

### Process

1. Search Anki shared deck repositories for download counts (ankiweb.net/shared/decks) — for demand signal only, never copy content
2. Search Reddit study communities: r/languagelearning, r/medicalschool, r/history, r/learnmath, etc. — look for recurring study requests
3. Search educational forums and quiz sites (Quizlet, Kahoot popular sets, Sporcle trending quizzes) — demand signal only
4. Check trending educational content: YouTube edu-channels, popular podcast topics, TikTok edu-creators
5. Cross-reference `data/deck-ideas.md` — skip topics already researched or in progress

### Filtering criteria

A topic is a viable deck candidate if it satisfies ALL of:
- 30+ distinct facts can be extracted from authoritative, commercially-usable sources
- Answer types fall into at least 2 identifiable pools with 5+ members each
- Not a micro-topic (e.g., "Noble Gases" alone — too small; fold it into "Periodic Table")
- Note: natural sub-groupings for chain themes are NOT a current requirement. They are worth noting in the discovery output as future potential, but a topic is not disqualified for lacking them.
- Required visual assets (if any) are available under commercial-friendly licenses

### Sub-deck splitting rule

**Large topics (100+ entities) SHOULD be evaluated for splitting into standalone sub-decks** when the sub-groups are independently viable (30+ facts each). Examples:
- "World Capitals" (195) -> could split into "African Capitals" (54), "European Capitals" (44), "Asian Capitals" (48), etc.
- "Periodic Table" (118) -> could keep as one mega-deck with 8+ chain themes (more replayability per run)

The decision depends on whether sub-groups are independently interesting or only meaningful as part of the whole. Players should be able to choose either the full deck or a focused sub-deck.

### Output format

Append to `data/deck-ideas.md`. Return a ranked list in this format:

```
1. "US Presidents" — 50k Anki downloads, frequent Reddit requests, 46 facts; natural themed groupings exist (Founding Fathers, Civil War Era) — note for future chain theme enhancement
2. "Chemical Elements" — 120k Anki downloads, periodic table grouping maps well; good future chain theme potential (by period, group, metal/nonmetal)
3. "World Capitals" — 200k Anki downloads; verify it can reach 30+ interesting facts (not just name->capital)
4. "Dog Breeds" — niche but passionate community; visual learning potential for cardbacks; groupings by size/type noted for future chains
```

Include:
- A note on any topic that seems popular but structurally weak (pool count, depth, synonym hazards)
- A note on required visual assets and their licensing status
- Whether the topic should be one deck or split into sub-decks

---

## Phase 2: Architecture

**Goal:** Design the complete pedagogical structure before any facts are generated. The architecture spec is the contract for the generation phase.

### Process

1. **Deep domain research** — Wikipedia, Wikidata, authoritative sources. Understand the full scope.
2. **Identify data sources** — Which Wikidata properties? Which Wikipedia categories? Which authoritative databases? Document these in the architecture.
3. **Identify natural answer types** — names, dates, places, terms, categories, numbers? **THIS IS THE MOST IMPORTANT STEP.** The pools you define here ARE what the deck teaches. A poor pool choice produces disconnected trivia; strong, confusable pools produce genuine learning. See "Curated Deck Design Philosophy" above before proceeding.
4. **Define answer type pools** — group potential facts by answer format; verify each pool has 5+ members after synonym exclusions. Pools with fewer than 5 must be merged with a related pool or use bracket-number runtime generation. **Pools must contain members that are genuinely confusable with each other** — same-format is not enough. Also design cross-pool question templates that test one pool's knowledge using another pool as context (see "Pool-First Design Process" in the Design Philosophy section above).
5. **Design question templates** — for each answer type pool: what question formats make sense? Templates MUST span a mastery-driven difficulty curve: simple recognition at mastery 0 (e.g., "What is the largest planet?"), standard/reverse at mastery 1-2, relational reasoning at mastery 3+ (e.g., "Which planet lies between Venus and Mars?"), and counterintuitive/comparative at mastery 4-5 (e.g., "Which planet has the highest surface temperature?" — tricky because it's Venus, not Mercury). Templates that force reasoning over rote recall are always preferred.
6. **Identify common confusions** — what do learners typically mix up? These pairs are SEEDED into the confusion matrix at deck build time, telling the distractor system to preferentially pair them before any real player data exists. This is especially valuable for a new deck's initial quality — the adaptive system starts smart instead of cold. Good seeded pairs share a surface similarity (same first letter, same era, same category) that fools learners at low mastery. See examples in the Design Philosophy section above.
7. **Identify synonym groups** — answers that are semantically interchangeable (e.g., "Civil War" / "War Between the States"). Facts in the same synonym group must NEVER appear as each other's distractors.
8. **Define chain slots (NOT required to be subcategorized):**
   - For NOW, named/thematic chain themes are NOT required. Facts can simply be assigned to generic chain slot types (Obsidian/Crimson/Azure/Amber/Violet/Jade) distributed evenly across all facts. The in-game chaining mechanic works correctly without themed groupings.
   - Vocabulary decks: always use generic chains — no thematic grouping
   - Knowledge decks: also use generic chains for initial builds. Themed chain groupings (e.g., "Founding Fathers", "Civil War Era") are a future enhancement for replayability — skip for now.
   - Both deck types: assign `chainThemeId` as a generic slot index (0-5) distributed evenly across facts. Do NOT spend time designing named sub-groupings.
9. **Set difficulty tiers** — easy (universally known), medium (commonly known), hard (obscure)
10. **Identify required visual assets** — what images/icons does this deck need? Where will they come from? What license?
11. **Validate structure** — confirm every pool has 5+ members, total facts meets target, chain slots (0-5) are evenly distributed, no synonym group is so large it starves the distractor pool (flag groups >4 facts)

### Output format (YAML spec)

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

## Phase 3: Generation

**Goal:** Produce the complete fact dataset conforming to the architecture spec.

### Two-Phase Generation Pipeline — MANDATORY

Deck generation uses a **two-phase pipeline** to ensure both factual accuracy and writing quality. This is non-negotiable — never skip phases or combine them.

#### Phase 1: Sonnet Workers — Truth-Grounded Fact Generation

**Purpose:** Generate structurally complete facts grounded in ACTUAL source data. Sonnet ensures factual accuracy by working directly from fetched Wikipedia/Wikidata text.

**Before spawning workers, the orchestrator MUST:**
1. **Query Wikidata via SPARQL MCP** (`mcp__wikidata__query`) — get machine-verified structured data (dates, locations, casualty figures, participants, relationships). Example: `SELECT ?startDate ?endDate WHERE { wd:Q38789 wdt:P580 ?startDate. wd:Q38789 wdt:P582 ?endDate. }` returns exact Battle of Stalingrad dates. This is the PRIMARY source for all verifiable numerical/date claims.
2. **Fetch Wikipedia articles** via WebFetch for narrative context, quotes, explanations, and details that Wikidata doesn't capture (stories, motivations, consequences)
3. **Pass BOTH to workers** — Wikidata results (structured, machine-verified) + Wikipedia text (narrative context). Workers use Wikidata for dates/numbers and Wikipedia for explanations/stories.

**Why Wikidata SPARQL first:** During the WWII deck build (2026-03-25), 51 factual errors (6.9%) were found — almost all were wrong dates, inflated casualty figures, or rounded numbers. These are exactly the claims Wikidata stores as structured, verified data. Using SPARQL eliminates this entire error class.

**Sonnet worker setup:**
- Spawn **Sonnet** sub-agents (`model: "sonnet"`) for ALL fact generation. Haiku is not acceptable for database content.
- Each worker receives:
  - The architecture spec (pool definitions, chain themes, sub-deck assignments)
  - **ACTUAL Wikipedia/Wikidata text** for the entities being processed — this is the truth source
  - The master worker prompt from `docs/RESEARCH/SOURCES/master-worker-prompt.md` if it exists
  - A batch of entities to process (max 10 per worker to avoid token limits)
  - Max 6 workers running simultaneously
- **Core rule:** The question + correct answer of every fact MUST be verifiable in the provided source text. Workers must NOT generate facts from training knowledge alone — the source data is the ground truth.
- Workers produce structurally complete facts with all required fields (see "Per-fact requirements" below)
- Workers MAY use world knowledge for distractors, since plausible wrong answers don't need source verification

#### Phase 2: Opus Quality Pass — Prose Polish & Narrative Interweaving

**Purpose:** Elevate writing quality without changing factual content. Opus rewrites prose for engagement, adds narrative connections between sub-decks, and ensures stories read as connected arcs.

**The orchestrator (Opus) reads all Sonnet-generated facts and rewrites ONLY these fields:**
- `explanation` — make it richer, add cross-references to other entities/sub-decks
- `wowFactor` — make it genuinely surprising and share-worthy
- `visualDescription` — make it vivid and memorable for pixel art generation
- `statement` — make it clear and compelling

**Opus MUST NOT change these fields:**
- `correctAnswer` — the truth stays as Sonnet verified it
- `quizQuestion` — the question stays as written
- `distractors` — pool-based, already correct
- `difficulty` — calibrated by Sonnet against source material
- `answerTypePoolId` — structural, not prose
- `chainThemeId` — structural
- `ageGroup` — content-based, already assessed
- `id`, `sourceUrl`, `sourceName`, `volatile` — metadata

**Narrative interweaving rules for Opus pass:**
- At least 20% of explanations should reference entities from OTHER sub-decks
- Narrative arcs (e.g., Trojan War, Ragnarok, 12 Labors) should have explanations that connect sequential facts ("This is the same Fleece that Jason sailed to Colchis to find")
- Add "bridge" references between sub-decks where natural connections exist

**Why two phases?**
- Sonnet is excellent at structured extraction from source text — it stays faithful to the data
- Opus is excellent at creative writing and seeing narrative connections — it makes facts engaging
- Combining both in one step risks Opus "improving" facts by changing them to be more interesting but less accurate
- Separating phases means truth is locked in before quality polish begins

### Worker Batch Size & Parallelism — CRITICAL

These limits were discovered during the WWII deck build (2026-03-25, 735 facts generated). Violating them wastes tokens and produces incomplete output.

| Rule | Detail |
|------|--------|
| **Max 30 facts per worker** | Requesting 50+ facts in a single Sonnet worker hits the 32K output token limit and silently truncates. The Holocaust subdeck (60 facts) had to be split into 2x30 after a total failure at 60. |
| **Always verify counts after return** | Workers routinely underdeliver. Western Front batch 2 was asked for 24, returned 14. ALWAYS check `len(facts)` and spawn supplement workers for shortfalls. |
| **3 parallel batches per subdeck** | Split entities into ~3 batches of 8-10 entities each, run all 3 in parallel with `run_in_background: true`. This maximizes throughput while keeping each worker under the token limit. |
| **Supplement shortfalls immediately** | After all batches return, count total. If under target, spawn one more worker with specific gap-filling instructions referencing what's already been generated. |

### Source Data — Workers ALWAYS Need Wikipedia Verification

**The architecture YAML is NOT a verified source.** YAML notes were written by LLMs in previous sessions — they may contain hallucinated dates, wrong numbers, or misattributed claims. The YAML is a research OUTLINE, not a truth source.

**Every worker MUST verify against Wikipedia/Wikidata before generating facts.** The correct workflow is:
1. Orchestrator reads the YAML to identify WHAT entities and topics to cover
2. Orchestrator queries `mcp__wikidata__query` with SPARQL to get structured data (dates, numbers, locations) for each entity — this is machine-verified, zero hallucination risk
3. Workers receive the entity list + Wikidata results AND are instructed to WebFetch Wikipedia articles for narrative context
3. Workers generate facts from the Wikipedia data they actually fetched, citing real URLs they consulted
4. The YAML notes serve as a checklist of what to look for — not as the source of truth

**What went wrong in the WWII build (2026-03-25):** 14 of 16 subdecks were generated with YAML notes passed directly to workers as if they were verified source data. The YAML had been written with research in a prior session, so the data was MOSTLY correct — but this workflow skipped the verification step that catches LLM confabulations. This was expedient but violated the sourcing rule. Future decks must not repeat this shortcut.

**The only acceptable shortcut:** If the orchestrator has PERSONALLY verified a YAML entry against Wikipedia in the current session (via WebSearch/WebFetch), that entry can be passed to workers as verified. But "it was in the YAML" alone is never sufficient provenance.

### Wikidata SPARQL MCP Quick Reference

The `mcp__wikidata__query` tool executes SPARQL against `https://query.wikidata.org/sparql`. **Use it as the PRIMARY source for all verifiable dates, numbers, and locations.**

**Find entity ID by name:**
```sparql
SELECT ?item ?itemLabel WHERE {
  ?item rdfs:label "Battle of Stalingrad"@en.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

**Get dates/location for an entity:**
```sparql
SELECT ?startDate ?endDate ?locationLabel WHERE {
  wd:Q38789 wdt:P580 ?startDate.
  wd:Q38789 wdt:P582 ?endDate.
  OPTIONAL { wd:Q38789 wdt:P276 ?location. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

**Bulk query (all WWII battles with dates):**
```sparql
SELECT ?battle ?battleLabel ?startDate ?endDate WHERE {
  ?battle wdt:P31 wd:Q178561.
  ?battle wdt:P361 wd:Q362.
  ?battle wdt:P580 ?startDate.
  OPTIONAL { ?battle wdt:P582 ?endDate. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?startDate
```

**Key Wikidata properties:**
- P580/P582: start/end date
- P276: location
- P1120: number of deaths
- P569/P570: birth/death date
- P1082: population
- P1086: atomic number
- P710: participant

**Workflow:**
1. Find entity ID: SPARQL `rdfs:label` search
2. Query specific properties: `wd:QXXXXX wdt:PXXX ?value`
3. Pass structured results to workers as machine-verified source data

### Opus Quality Pass — When to Skip

The two-phase pipeline (Sonnet generates, Opus polishes) is the ideal. However, during the WWII build, Sonnet workers consistently produced high-quality prose — narrative explanations, cross-references, surprising angles. The Opus quality pass was reviewed and deemed unnecessary for all 16 subdecks.

**Skip the Opus pass when:**
- Sonnet explanations already connect facts into narrative arcs
- Questions already force reasoning (not just recall)
- Distractors are already semantically coherent
- The orchestrator samples 5-10 facts and finds no prose quality issues

**Do the Opus pass when:**
- Explanations are flat/disconnected ("X happened in Y year")
- Cross-subdeck references are absent
- wowFactor fields are generic or missing
- The deck is a flagship product where prose quality is a differentiator

### Assembly & Schema Normalization

When assembling the final deck from WIP files, expect schema drift between batches:

| Issue | Fix |
|-------|-----|
| `chainTheme` instead of `chainThemeId` | Rename field |
| `categories` instead of `answerTypePoolId` | Replace with `"historical_events"` default |
| Variants with `answer` instead of `correctAnswer` | Rename field |
| Missing `acceptableAlternatives` | Default to `[]` |
| Missing `volatile` | Default to `false` |
| Bare array `[...]` instead of `{"facts": [...]}` | Wrap in object |

The assembly worker must normalize all of these. Always validate the final deck with a script that checks every fact has all required fields.

### Source data caching

For large decks (100+ entities), source data should be cached locally:
- Save fetched Wikipedia text to `data/deck-sources/<deck_id>/` as individual `.txt` files per entity
- This prevents re-fetching on worker retries or subsequent generation batches
- Cache files are NOT committed to git — add to `.gitignore`

### Per-fact requirements (each fact must include)

| Field | Requirement |
|-------|-------------|
| `id` | Unique, deck-scoped (e.g., `us_presidents_washington`) |
| `correctAnswer` | Max 5 words / 30 chars; bracket numeric answers: `{1789}` |
| `acceptableAlternatives` | All valid synonyms/alternates |
| `synonymGroupId` | Assigned if fact belongs to a synonym group |
| `chainThemeId` | Generic slot index (0-5), distributed evenly across all facts. Named theme assignments are NOT required for initial decks — use numeric slots only. |
| `answerTypePoolId` | Must match a pool defined in the architecture |
| `difficulty` | 1-5 per architecture tiers |
| `funScore` | 1-10 using calibration anchors from master-worker-prompt |
| `distractors` | 8-12 plausible wrong answers — LLM-generated from world knowledge, NEVER pulled from DB pools |
| `quizQuestion` | Max 15 words, ends with `?`, not self-answering |
| `explanation` | 1-3 sentences, adds context, never circular |
| `wowFactor` | 1 punchy "share-worthy" sentence shown as a popup after correct answers in-game. Must be deck-specific, not generic trivia. |
| `statement` | Clear declarative sentence of the fact (used on card face) |
| `visualDescription` | 20-40 words, vivid mnemonic scene for pixel art cardback |
| `sourceName` | Required — the authoritative source this fact comes from |
| `sourceUrl` | Strongly recommended — direct link to the source page |
| `volatile` | Boolean — true if this fact contains data that changes over time (populations, leaders, records) |
| `ageGroup` | `"all"` (suitable for kids 8+) or `"teen+"` (complex/abstract concepts best for 13+). See Age Appropriateness section below. |

### Age Appropriateness — MANDATORY for all decks

Every fact MUST be tagged with an `ageGroup` field. This enables the game to filter deck content based on the player's age setting.

**`"all"` (ages 8+):** The fact is concrete, engaging, and understandable by a bright 8-year-old. Examples: "What is the largest planet?", "Which planet has rings?", "What color is Mars?"

**`"teen+"` (ages 13+):** The fact involves abstract scientific concepts, complex historical context, technical terminology, or requires reasoning beyond concrete thinking. Examples: "Which planet was predicted mathematically before it was observed?", "What causes Io's volcanic activity?" (tidal forces), greenhouse effect explanations.

**Rules:**
- At least 40% of facts in every deck MUST be `"all"` — kids need a full, enjoyable deck experience, not a handful of easy questions
- When in doubt, tag `"teen+"` — it's safer to under-include for kids than to bore/confuse them
- Violence, death, sensitive historical content → always `"teen+"`
- The `ageGroup` tag does NOT affect difficulty rating — a fact can be `"all"` and difficulty 4 (hard but concrete: "Which moon is larger than Mercury?")

### Question quality rules — MANDATORY for workers

Every worker prompt MUST include these rules. They prevent factual errors that code checks can never catch:

1. **One correct answer only.** Every question must have EXACTLY ONE correct answer from the pool. If the question is "Which planet has rings?" and multiple planets have rings, the question is BAD. Rewrite to make the answer unique: "Which planet was the first discovered to have rings besides Saturn?"

2. **Answer must not appear in question text.** If the question says "Besides Saturn, which..." then Saturn MUST NOT appear as a distractor. The runtime excludes mentioned entities, but don't create questions that rely on this.

3. **No "trick" exclusion questions.** Questions like "Which planet does NOT have X?" are confusing with multiple choice. Rephrase positively.

4. **Verify claims against source data.** If the worker writes "Jupiter is the only planet with rings" but the source data says Uranus/Neptune also have rings, that's a factual error. Workers must cross-check claims against ALL provided source data, not just the entity they're writing about.

5. **Distractors must be plausible for THIS question.** "Venus" is a valid planet distractor in general, but for "Which planet has moons named Phobos and Deimos?" Venus (0 moons) is a freebie. Workers should prefer distractors that could genuinely confuse a learner.

### Pool size and pre-generated distractor fallback

**Runtime distractor selection uses the answer type pool.** But pools with fewer than **5 unique `correctAnswer` values** (after excluding the correct answer and synonyms) are too small for sensible pool-based distractors. The runtime automatically falls back to the fact's pre-generated `distractors[]` array when this happens.

**What this means for deck design:**
- **Pools with 5+ unique answers** (planet_names, moon_names, mission_names): distractors come from the pool at runtime. The `distractors[]` field on each fact is a backup but won't normally be used. You still generate 8 per fact as a safety net.
- **Pools with <5 unique answers** (system_facts, or any small specialty pool): the runtime ignores the pool and uses the fact's pre-generated `distractors[]` directly. These MUST be high quality — 8 plausible wrong answers crafted by the LLM for each specific question.

**When generating facts, workers MUST always provide 8 pre-generated distractors** regardless of pool size. The runtime decides whether to use pool or pre-generated based on pool viability. This is NOT optional — facts with empty `distractors[]` in small pools will have no distractors at all.

### Distractor variation is BY DESIGN — do not "fix" it

Pool-based distractors deliberately vary between repetitions of the same fact (via jitter shuffle). This is intentional and superior to fixed distractors:

- **Fixed distractors** (Anki-style): player memorizes "not Titan, not Ganymede" through process of elimination. Tests distractor recognition, not knowledge.
- **Varying distractors** (our approach): player sees different wrong answers each time. Must actually KNOW the correct answer, not just eliminate familiar wrong ones. Deeper learning.

**LLM playtests may flag this as a bug** ("distractors should be consistent across repetitions"). It is NOT a bug. If an LLM reviewer says this, note it as "working as designed" and move on. The confusion matrix tracks which distractors the player actually confuses with — those will be weighted higher in future encounters, creating adaptive difficulty naturally.

### Distractor rule — non-negotiable

Distractors MUST be generated by the LLM reading the specific question and producing plausible wrong answers from world knowledge. NEVER use `SELECT correct_answer FROM facts WHERE ...` or any DB query to source distractors. Post-generation DB validation is permitted to check for accidental matches.

### Bracket notation for numeric answers — SUPPORTED

Curated decks fully support `{N}` bracket notation for numeric answers (e.g., `"{8}"`, `"{4.6} billion years"`, `"About {8} minutes"`). The curated quiz paths (`nonCombatQuizSelector.ts` and `CardCombatOverlay.svelte`) detect bracket answers and route them through `getNumericalDistractors()` + `displayAnswer()` from `numericalDistractorService.ts`.

**How to use:**
1. Set `correctAnswer` to the bracket-notated value: `"{8}"`, `"{101}"`, `"{4.6} billion years"`
2. Set `distractors` to `[]` (empty array) — the runtime generates plausible wrong numbers
3. Set `answerTypePoolId` to `"bracket_numbers"` — these facts form their own pool but distractors come from the bracket generator, NOT from the pool
4. The `bracket_numbers` pool exists for organizational purposes and pool-size validation, but the runtime NEVER uses it for distractor sourcing — bracket facts always self-generate distractors

**What the runtime does:**
- Detects `{N}` via `isNumericalAnswer()` → generates nearby plausible wrong numbers via `getNumericalDistractors()`
- Strips braces for display via `displayAnswer("{8}")` → `"8"`
- The player sees clean numbers, never curly braces

### Runtime Fact Selection — Anki-Faithful Learning Step Model

Curated deck fact selection uses Anki's actual learning step model (`curatedFactSelector.ts` + `inRunFactTracker.ts`). Deck designers must understand this because it directly shapes the player experience.

**Three card states (not simple queues — states with timers):**

| State | Meaning | How it got here |
|-------|---------|-----------------|
| **NEW** | Never seen this run | Default for all facts at run start |
| **LEARNING** | Seen but not graduated. Has step counter + due timer. | Correct on NEW card, or wrong on ANY card |
| **GRADUATED** | Completed all learning steps | Correct on final learning step |

**Learning step progression (adapted from Anki's 1min/10min to charges):**

| Event | Result |
|-------|--------|
| NEW card + correct | → LEARNING step 0. Due in **2 charges**. |
| LEARNING step 0 + correct | → LEARNING step 1. Due in **5 charges**. |
| LEARNING step 1 + correct | → **GRADUATED**. Due in **10 charges**. |
| ANY card + **wrong** | → LEARNING step 0. Due in **2 charges**. (Anki "Again") |
| GRADUATED + correct | Stays graduated. Due in **10 charges**. |
| GRADUATED + wrong | **Un-graduates**. Back to LEARNING step 0. |

**Selection priority (exactly Anki):**
1. **Due learning cards** — any LEARNING card whose charge timer expired. ALWAYS shown first. These are time-critical.
2. **Main queue (Intersperser)** — proportional mix of due GRADUATED reviews + NEW cards. Ratio: `P(review) = reviewCount / (reviewCount + newCount)`.
3. **Ahead learning** — LEARNING cards not yet due. Only if nothing else available.
4. **Fallback** — any card except the last one shown.

**New card introduction cap:** Max 8 cards in LEARNING state at once. If 8 cards are learning, no new cards are introduced until some graduate. This prevents overwhelming the player.

**What a typical session looks like (25 charges, all correct):**
- Charges 1-3: Three NEW cards introduced
- Charges 4-6: Those 3 come back as LEARNING (step 0 → step 1)
- Charges 7-9: Three more NEW cards while step-1 cards wait
- Charges 10-12: First batch returns (step 1 → GRADUATE)
- Charges 13-15: Second batch returns (step 0 → step 1)
- Charge 25: First REVIEW appears (graduated card's 10-charge timer expires)

**Never repeats immediately.** The last shown card is always excluded.

**Implications for deck design:**
- Decks need 30+ facts minimum. The learning cap (8) + graduation delays mean ~9 unique cards rotate in early gameplay.
- Wrong answers come back aggressively (2 charges). Design distractors to be plausibly confusing — the confusion matrix feeds on wrong answers.
- The wow factor popup shows after correct answers on Learning-tier cards (max 3 per encounter). Each fact's `wowFactor` field must be present and deck-specific.

### Synonym group computation

After generation, run the `acceptableAlternatives` intersection algorithm (DECKBUILDER.md section 4.6):
- Vocabulary decks: fully automated
- Knowledge decks: review any flagged overlaps manually before committing

### Output — CuratedDeck Envelope Format (CRITICAL)

The final deck JSON file is NOT a flat array of facts. It MUST be wrapped in the `CuratedDeck` envelope that the runtime expects (`src/data/curatedDeckTypes.ts`). Workers generate facts as a flat array, then the orchestrator wraps them.

**The orchestrator MUST wrap the merged facts into this structure:**

```json
{
  "id": "solar_system",
  "name": "Solar System",
  "domain": "space_astronomy",
  "subDomain": "solar_system",
  "description": "Player-facing description (1-2 sentences, engaging)",
  "minimumFacts": 60,
  "targetFacts": 76,
  "facts": [ ...all generated facts... ],
  "answerTypePools": [
    {
      "id": "planet_names",
      "label": "Planet Names",
      "answerFormat": "name",
      "factIds": ["...scan facts for answerTypePoolId === 'planet_names'..."],
      "minimumSize": 5
    }
  ],
  "synonymGroups": [
    {
      "id": "venus_names",
      "factIds": ["...facts with overlapping acceptableAlternatives..."],
      "reason": "Same planet, different names"
    }
  ],
  "questionTemplates": [
    {
      "id": "planet_from_feature",
      "answerPoolId": "planet_names",
      "questionFormat": "Which planet has {feature}?",
      "availableFromMastery": 1,
      "difficulty": 2,
      "reverseCapable": false
    }
  ],
  "difficultyTiers": [
    {"tier": "easy", "factIds": ["...difficulty 1-2..."]},
    {"tier": "medium", "factIds": ["...difficulty 3..."]},
    {"tier": "hard", "factIds": ["...difficulty 4-5..."]}
  ],
  "subDecks": [
    {
      "id": "planets",
      "name": "Planets & System",
      "factIds": ["...subset of fact IDs..."]
    }
  ]
}
```

**Build the envelope programmatically** — scan the facts array to populate `answerTypePools[].factIds`, `difficultyTiers[].factIds`, and `synonymGroups[].factIds`. Never hand-craft these arrays.

**After writing the deck JSON**, update `data/decks/manifest.json` to include the new deck filename in the `decks` array. The manifest is a flat array of filename strings:

```json
{
  "decks": [
    "existing_deck.json",
    "new_deck.json"
  ]
}
```

The curated deck store (`src/data/curatedDeckStore.ts`) reads this manifest at app startup to discover available decks. If a deck is not in the manifest, it won't be loaded.

Run validation commands below before marking generation complete.

### Grammar Deck Quality Standard — GOLDEN REFERENCE

This section captures ALL quality requirements for grammar-type curated decks. It was derived from a deep audit of the Japanese N3 grammar deck (2026-03-29) and applies to ALL future grammar decks (N5, N4, N3, N2, N1, Korean, etc.).

#### 1. Grammar Note Generation

All grammar-type curated decks MUST include a `grammarNote` field on every fact. This field provides a simple contextual explanation shown to the player when they answer incorrectly.

**How it works at runtime:**
- **Bold header**: Derived from the `explanation` field (part before ` — `). E.g., `"さえ (even; only; just)"`. Same for every fact using that grammar point. Shown in bold white text.
- **Contextual note**: The `grammarNote` field. A simple 1-2 sentence explanation of why this grammar point fits THIS specific sentence. Shown below the header.

**Generation rules for `grammarNote`:**
- Written by **Sonnet workers** during Phase 3 (Generation)
- 1-2 simple sentences, 80-150 characters
- Plain English, no linguistic jargon
- Explains why the grammar point fits this specific sentence (contextual clue)
- **NO distractor references** — distractors are selected dynamically at runtime
- **Do NOT repeat** the grammar point definition (that's shown in the bold header)
- Each worker receives grounded data: grammar point name + meaning, quiz question + translation, full sentence from explanation field

**Example:**
- Quiz: `食べ過ぎて、イチゴ{___}食べられない。` (I'm so full I couldn't even eat a strawberry.)
- Bold header: **さえ (even; only; just)**
- `grammarNote`: `"Emphasizes an extreme case — even a strawberry, the easiest food, is impossible to eat here."`

#### 2. Fragment Answers — Tilde Display System

When the blank extraction produces a **fragment** of the grammar point (e.g., "くれ" instead of "てくれる"), the fact MUST use the tilde display system:

- Set `displayAsFullForm: true` on the fact
- At quiz time, ALL answer options (correct + distractors) are shown with `~` prefix + full canonical grammar point name: `~てくれる`, `~てあげる`, `~てしまう`
- **CRITICAL**: ALL options must consistently use the tilde format — NEVER mix tilde and non-tilde options, as this gives away the answer
- Distractors for tilde facts must be the full canonical names from the same confusion group
- The blank `{___}` stays in the sentence at the fragment position

**When does this happen?** Te-form auxiliaries where the verb is in て-form and the auxiliary is split: `読んであ{___}` (answer: "げる" from "あげる"). The fill-blank extraction catches the suffix but not the full auxiliary.

#### 3. Distractor Quality — MANDATORY RULES

**CRITICAL LESSON (N3 audit, 2026-03-29):** 40-50% of distractors in the initial N3 deck were obviously wrong by grammatical form, letting students answer by elimination. This section prevents that.

**Rule A: Syntactic Slot Filtering (MANDATORY)**
- NEVER draw distractors from incompatible syntactic slots
- A `te_form_auxiliary` blank → ONLY te-form auxiliary distractors
- A `particle_post_noun` blank → ONLY particle distractors
- A `sentence_ender` blank → ONLY sentence-ender distractors
- Cross-slot contamination (e.g., particles in a verb-form question) is a blocking bug

**Rule B: Conjugation Form Matching (MANDATORY for verb-attached grammar)**
- When the blank answer is conjugated (e.g., "てしまった" past tense), ALL distractors MUST be in the same conjugation form (e.g., "ていた", "てあった", "てみた")
- The confusion groups file must include a conjugation table mapping each grammar point to its conjugated forms (past, polite, negative, past_negative, volitional, conditional, etc.)
- The build script MUST call `detectTeFormTense()` and `getMatchingConjugation()` — and these MUST handle all edge cases including fragment answers
- If conjugation matching fails for a fact, fall back to the tilde display system (Rule 2)

**Rule C: Confusion Group Priority**
Distractors are drawn in priority order:
1. **Same confusion group** (3-4 items) — semantically confusable, hardest
2. **Same syntactic slot, different group** (3-4 items) — grammatically compatible
3. **Broad pool within slot** (1-2 items) — only from the same syntactic slot, never cross-slot

**Rule D: No Stem Giveaways**
For grammar points that attach to verb stems (ようとする, ことにする), the preceding context often reveals the stem form. Distractors must:
- Be grammar points that can grammatically follow the same verb form
- NOT be obviously wrong because their stem doesn't fit the preceding verb

#### 4. English Meaning Hints

Every grammar quiz question MUST include an English hint word in the translation that cues the grammar function:

```
食べ過ぎて、イチゴ{___}食べられない。
(I am so full I could not [even] eat a strawberry.)
```

- The `[bracketed word]` directly indicates which grammar function is being tested
- Stored as a `hintWord` field on each fact (e.g., "even", "because", "if", "apparently")
- Generated by Sonnet workers who compare the grammar point meaning against the English translation
- If the translation already clearly indicates the function, the hint may be omitted

#### 5. Dictionary Hover (Word-Level Translation)

Grammar decks SHOULD support hover/tap word-level translation on the Japanese sentence text:
- Uses **kuromoji.js** for morphological analysis (tokenization + POS tagging)
- Maps tokens to **JMdict** entries for English glosses
- Each word in the quiz question is wrapped in a hoverable `<span>`
- On hover/tap: shows hiragana reading + primary English meaning
- **MUST NOT** highlight or translate the grammar point being tested (don't give away the answer)
- Helps learners understand sentence context when vocabulary is above their study level

#### 6. Typing/Writing Mode

Grammar decks SHOULD support a typing response mode alongside multiple choice:
- Uses **wanakana** library for romaji→hiragana live conversion
- Text input field replaces answer buttons (configurable per deck or per mastery level)
- Answer validation: exact match + acceptable alternatives + politeness tolerance (casual/formal not penalized)
- On wrong: show correct answer + grammar note + allow retry
- Recommended activation: mastery level 3+ (students prove comprehension with MC first, then recall with typing)

#### 7. Vocabulary Level Validation

All sentences in a grammar deck MUST be validated against the target JLPT level:
- Cross-reference sentence vocabulary against JLPT word frequency lists (N5→target level)
- Flag sentences containing vocabulary above the target level
- For flagged sentences: either replace with a simpler sentence OR add furigana + hover glosses for the advanced words
- This prevents N3 grammar learners from being blocked by N2+ vocabulary

#### Enforcement Checklist (Grammar Decks)

Before marking a grammar deck as complete, verify ALL of the following:

- [ ] Every fact has a non-empty `grammarNote`
- [ ] Every fact has an `explanation` field in `"point (meaning) — sentence"` format
- [ ] Fragment answers use the tilde display system (`displayAsFullForm: true`)
- [ ] ALL distractors are from the same syntactic slot as the correct answer
- [ ] Conjugated answers have conjugation-matched distractors
- [ ] English translations include `[hint word]` for the grammar function
- [ ] No cross-slot distractor contamination (sample 20 facts across all slots)
- [ ] Vocabulary validated against target JLPT level
- [ ] `npm run typecheck` + `npm run build` + `npx vitest run` all pass
- [ ] Manual playtest: 10+ questions with genuinely confusable distractors

### Sub-Deck Design — When and How

Sub-decks let players focus on a subset of the deck's content. They appear as selectable options within the deck tile in Study Temple (like Japanese has Hiragana, Katakana, N5, etc.).

**When to create sub-decks:**
- The deck has 50+ facts AND contains natural groupings a player would want to study independently
- Each sub-deck must have 25+ facts to be viable (below that, the pool is too thin for good distractor variety)
- The groupings must make sense from the PLAYER's perspective, not just the data's structure
- A "Full Deck" option is always the default — sub-decks are optional focus modes

**When NOT to create sub-decks:**
- The deck has < 50 facts total (sub-decks would be too thin)
- The groupings are arbitrary (e.g., "facts 1-25" vs "facts 26-50")
- The answer pools would be too small within a sub-deck (< 5 confusable members per pool)

**Sub-deck design process:**
1. Look at the answer type pools — do any pools map naturally to a self-contained learning goal?
2. Check that each sub-deck has enough facts AND enough pool members for good distractor variety
3. Name sub-decks from the player's perspective: "Planets" not "Pool A", "Moons & Exploration" not "Sub-deck 2"
4. Add `subDecks` array to the CuratedDeck envelope with id, name, and factIds

**Examples by deck type:**

| Deck | Sub-decks | Rationale |
|------|-----------|-----------|
| Solar System (76 facts) | "Planets & System" (50), "Moons & Exploration" (29) | Kids want just planets; enthusiasts want deep space |
| Periodic Table (118 facts) | "Metals" (60+), "Non-metals & Noble Gases" (40+) | Chemistry students study these as distinct groups |
| World Capitals (195 facts) | "European Capitals", "Asian Capitals", "African Capitals", "Americas Capitals" | Geographic focus is how people study capitals |
| US Presidents (46 facts) | None — too small, and all facts use the same pool | Splitting would starve the distractor pools |
| Japanese N5 (800+ facts) | "Vocabulary", "Kanji", "Grammar" | Completely different content types and study goals |

**Architecture phase must decide sub-decks** — include them in the YAML spec so workers know which facts belong to which sub-deck. The orchestrator assigns `subDecks[].factIds` when building the envelope.

---

## Rules

| Rule | Detail |
|------|--------|
| Fact count | No arbitrary targets. Let pool-first design dictate count: each pool needs 5+ unique answers for good distractors, and the deck needs enough total facts to sustain 8 simultaneous learning cards. Minimum viable is ~30 facts, but the right number is whatever the content demands. |
| Pool minimum | 5 facts per answer type pool (after synonym exclusions) |
| Chain themes (knowledge) | NOT required for initial decks. Use generic chain slots (0-5) distributed evenly. Named themes are a future enhancement. |
| Chain themes (vocabulary) | Generic chains only — no thematic grouping (same as knowledge decks for now) |
| Math/numeric answers | Bracket notation + runtime generation, not pool distractors |
| Grounding | All facts grounded in Wikipedia/Wikidata — never invented |
| Distractor source | **Pool-based at runtime for pools with 5+ unique answers.** Falls back to pre-generated `distractors[]` for small pools (<5 unique answers). Workers MUST always generate 8 pre-generated distractors per fact regardless of pool size — the runtime decides which source to use. |
| Model for DB content | Sonnet only; Haiku is not acceptable for facts, distractors, or questions |
| Micro-topics | Forbidden as standalone decks. "Noble Gases" = chain theme inside "Periodic Table", not its own deck |
| Deck ideas log | Always update `data/deck-ideas.md` after a discovery run |
| Programmatic sourcing | ALL facts must cite authoritative sources with URLs |
| Commercial licensing | ALL visual assets must be CC0, CC-BY, public domain, or explicitly commercially licensed |
| Volatile data | Facts with time-dependent data must be flagged `volatile: true` |
| Age tagging | Every fact MUST have `ageGroup`: `"all"` (kids 8+) or `"teen+"` (13+). At least 40% must be `"all"` per deck. |
| Sub-deck splitting | Large decks (100+ entities) must be evaluated for splitting into standalone sub-decks |
| Bracket notation | Use `{N}` for numeric answers with `distractors: []`. Runtime generates numeric distractors. Pool is `bracket_numbers` (organizational only). |
| Wow factor field | Every fact MUST have a `wowFactor` string — 1 punchy sentence shown after correct answers. Must be deck-specific. |

---

## Validation Commands — Data Quality

Run after generation; fix all failures before committing.

### CRITICAL: Run the Deck Verifier (MANDATORY)

Before any other validation, run the deck verification script. This simulates every question the player would see — including bracket number generation, pool-based distractor selection, and answer display. It catches bugs that data-only checks miss.

```bash
node scripts/verify-curated-deck.mjs <deck_id>
```

**All facts must PASS.** If any fail, fix the data and re-run until clean. The script exits with code 1 on any failure.

The verifier checks: literal braces in answers, answer appearing in distractors, duplicate distractors, pool size violations, missing fields, bracket generation quality, and unplayable quiz states.

### Data Simulation Check

**After ALL data validation passes, simulate what the player actually sees for EVERY fact.** Data checks alone are not sufficient — the Solar System deck shipped with literal `{8}` answers and `{4.6}` distractors because data validation passed but nobody simulated the runtime display.

```bash
# Simulate runtime distractor selection for every fact
node -e "
const deck = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const factById = new Map(deck.facts.map(f => [f.id, f]));
let issues = 0;

deck.facts.forEach(f => {
  // 1. Check answer contains no braces
  if (f.correctAnswer.includes('{') || f.correctAnswer.includes('}')) {
    console.log('BRACE IN ANSWER:', f.id, '->', f.correctAnswer);
    issues++;
  }

  // 2. Simulate pool-based distractor selection (what curatedDistractorSelector.ts does)
  const pool = deck.answerTypePools.find(p => p.id === f.answerTypePoolId);
  if (!pool) {
    console.log('NO POOL:', f.id, '-> pool', f.answerTypePoolId, 'not found');
    issues++;
    return;
  }

  // Get pool member answers (what player would see as distractors)
  const poolDistractors = pool.factIds
    .filter(id => id !== f.id)
    .map(id => factById.get(id)?.correctAnswer || '???')
    .slice(0, 4);

  // Check if pool distractors make semantic sense with the question
  const hasNonsense = poolDistractors.some(d =>
    d.includes('{') || d.includes('}') || d === f.correctAnswer
  );
  if (hasNonsense) {
    console.log('NONSENSE DISTRACTOR:', f.id, '-> pool gives:', poolDistractors.join(', '));
    issues++;
  }

  // 3. Check fallback distractors (used when pool too small)
  if (f.distractors.length < 8 && pool.factIds.length < 6) {
    console.log('THIN POOL + FEW FALLBACKS:', f.id, '-> pool has', pool.factIds.length, 'members, fact has', f.distractors.length, 'fallbacks');
    issues++;
  }

  // 4. Check answer not in distractors
  if (f.distractors.includes(f.correctAnswer)) {
    console.log('ANSWER IN DISTRACTORS:', f.id);
    issues++;
  }

  // 5. Check duplicate distractors
  if (new Set(f.distractors).size < f.distractors.length) {
    console.log('DUPE DISTRACTORS:', f.id);
    issues++;
  }
});

console.log(issues ? issues + ' ISSUES FOUND — fix before shipping' : 'All ' + deck.facts.length + ' facts simulate clean');
"
```

**What this catches that basic validation misses:**
- Bracket answers showing literally (the `{8}` bug)
- Pool members being semantically wrong as distractors (moon counts as distractors for planet counts)
- Pools too small to generate enough distractors at runtime
- Correct answer appearing in distractor list after pool-based selection

---

### Data Validation Commands

**Required fields check:**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const required = ['id','correctAnswer','acceptableAlternatives','chainThemeId','answerTypePoolId',
  'difficulty','funScore','distractors','quizQuestion','explanation','visualDescription','sourceName','ageGroup'];
let issues = 0;
facts.forEach(f => {
  const missing = required.filter(k => !(k in f));
  if (missing.length) { console.log('MISSING in', f.id, ':', missing.join(', ')); issues++; }
});
console.log(issues ? issues + ' facts with missing fields' : 'All fields present');
"
```

**Distractor count check (min 8):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const low = facts.filter(f => !f.distractors || f.distractors.length < 8);
low.forEach(f => console.log('LOW DISTRACTORS:', f.id, '(' + (f.distractors?.length ?? 0) + ')'));
console.log(low.length ? low.length + ' facts need more distractors' : 'Distractor counts OK');
"
```

**Pool size check (min 5 per pool):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const pools = {};
facts.forEach(f => { pools[f.answerTypePoolId] = (pools[f.answerTypePoolId] || 0) + 1; });
Object.entries(pools).forEach(([pool, count]) => {
  if (count < 5) console.log('POOL TOO SMALL:', pool, '(' + count + ' facts — need 5+)');
});
console.log('Pool check done.');
"
```

**Chain slot distribution check (verify chainThemeId 0-5 is evenly spread):**
```bash
# NOTE: Named chain themes with min-8-per-theme rules are NOT required for initial decks.
# Facts use generic slot indices (0-5) distributed evenly. This check just verifies
# the distribution is reasonably balanced — not enforcing a hard minimum.
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const slots = {};
facts.forEach(f => { slots[f.chainThemeId] = (slots[f.chainThemeId] || 0) + 1; });
const counts = Object.values(slots);
const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
Object.entries(slots).forEach(([slot, count]) => {
  const pct = Math.round((count / facts.length) * 100);
  console.log('Slot', slot + ':', count, 'facts (' + pct + '%)');
});
console.log('Average per slot:', Math.round(avg), '| Total slots used:', counts.length);
"
```

**Age group distribution check (min 40% kids-friendly):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const all = facts.filter(f => f.ageGroup === 'all').length;
const teen = facts.filter(f => f.ageGroup === 'teen+').length;
const other = facts.filter(f => !['all','teen+'].includes(f.ageGroup)).length;
const pct = Math.round((all / facts.length) * 100);
console.log('all (kids 8+):', all, '(' + pct + '%)');
console.log('teen+ (13+):', teen, '(' + Math.round((teen / facts.length) * 100) + '%)');
if (other) console.log('INVALID ageGroup:', other, 'facts');
if (pct < 40) console.log('FAIL: Only ' + pct + '% are kids-friendly — need at least 40%');
else console.log('Age distribution OK');
"
```

**Synonym group sanity (flag groups >4 facts):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const groups = {};
facts.forEach(f => { if (f.synonymGroupId) { groups[f.synonymGroupId] = (groups[f.synonymGroupId] || 0) + 1; } });
Object.entries(groups).forEach(([g, count]) => {
  if (count > 4) console.log('LARGE SYNONYM GROUP (may starve distractor pool):', g, '(' + count + ' facts)');
});
console.log('Synonym group check done.');
"
```

**Source URL check (all facts should have sourceUrl):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const noUrl = facts.filter(f => !f.sourceUrl);
noUrl.forEach(f => console.log('NO SOURCE URL:', f.id));
console.log(noUrl.length ? noUrl.length + ' facts missing sourceUrl' : 'All facts have sourceUrl');
"
```

**Volatile fact audit:**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const vol = facts.filter(f => f.volatile);
if (vol.length) {
  console.log(vol.length + ' volatile facts (need periodic review):');
  vol.forEach(f => console.log('  -', f.id, ':', f.correctAnswer));
} else {
  console.log('No volatile facts.');
}
"
```

**categoryL2 taxonomy check (if deck facts enter the global DB):**
```bash
node -e "
const facts = JSON.parse(require('fs').readFileSync('data/decks/<deck_id>.json'));
const bad = facts.filter(f => !f.categoryL2 || ['general','other',''].includes(f.categoryL2));
bad.forEach(f => console.log('BAD categoryL2:', f.id, '->', f.categoryL2));
console.log(bad.length ? bad.length + ' facts need valid categoryL2' : 'categoryL2 OK');
"
```

---

## Automated Playtest — MANDATORY (replaces manual in-game testing)

**After all data validation passes, run the automated deck playtest.** This imports the REAL game code (fact selector, template renderer, distractor selector, learning step tracker) and simulates a full study mode session. No browser needed.

```bash
# All correct — verify Anki queue interleaving and question quality
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts <deck_id> --charges 30 --verbose

# With wrong answers — verify learning queue brings them back
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts <deck_id> --charges 25 --wrong-rate 0.3 --verbose

# Deterministic replay (same seed = same sequence)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts <deck_id> --charges 20 --seed 42 --verbose
```

**What it checks per charge:**
- Unresolved `{placeholder}` patterns in rendered questions
- Braces in displayed answers
- Correct answer leaking into distractors
- Duplicate distractors
- Back-to-back fact repeats
- Fewer than 2 distractors
- Empty question or answer text

**What the summary reports:**
- Unique facts seen vs charges (Anki interleaving quality)
- Learning/review/new queue hit distribution
- Total issues found (exit code 1 if any)

**Run BOTH all-correct and wrong-rate tests.** All-correct verifies new card introduction. Wrong-rate verifies the learning queue brings back wrong answers aggressively.

---

## Runtime Rendering Validation

After generating or modifying a curated deck, run the audit script to verify questions render correctly in-game:

```bash
node scripts/audit-quiz-display.mjs
```

This renders every questionTemplate × fact combination exactly as players see it, and flags: trivial questions (answer in question text), short questions (<15 chars), missing distractors, and duplicate distractors. Fix all flags before publishing.

---

## LLM Playtest — MANDATORY (final gate before deck ships)

**After automated playtest passes, an LLM agent must play through the deck as a real player.** This is the FINAL quality gate. The agent reads each question, evaluates the answer choices, picks one (sometimes wrong on purpose), and judges quality from a player's perspective. No code check catches "this question is confusing" or "these distractors are too obvious" — only an LLM reading them naturally can.

### How to run

Spawn a **Haiku sub-agent** (`model: "haiku"`) with the playtest output and this prompt:

```
You are playtesting a curated quiz deck for the game Recall Rogue. Below is a simulated
play session showing 30 quiz charges. For each question, evaluate:

1. QUESTION CLARITY: Is the question clear and unambiguous? Would a player understand what's being asked?
2. ANSWER CORRECTNESS: Is the stated correct answer actually correct? Flag any factual errors.
3. DISTRACTOR QUALITY: Are the wrong answers plausible but clearly wrong? Flag if:
   - A distractor is actually correct (secretly right answer)
   - Distractors are too obvious (trivially eliminatable)
   - Distractors are nonsensical for this question type
4. LEARNING VALUE: Does this question teach something? Or is it pure rote recall?
5. REPETITION FEEL: As you go through the sequence, does it feel varied? Or tedious?
6. PROGRESSION: Do the learning queue returns feel natural? (Cards you got wrong should come back.)

Rate the deck overall:
- Question quality (1-10)
- Distractor quality (1-10)
- Variety/pacing (1-10)
- Educational value (1-10)

List ALL issues found, no matter how minor. Be harsh — we want to catch everything.
```

### What to feed the agent

Run the automated playtest with `--verbose` and capture the output:

```bash
# Generate the playtest transcript
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  scripts/playtest-curated-deck.ts <deck_id> --charges 30 --seed 42 --verbose > /tmp/deck-playtest.txt 2>&1

# Also run a wrong-answer session
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  scripts/playtest-curated-deck.ts <deck_id> --charges 20 --wrong-rate 0.3 --seed 99 --verbose >> /tmp/deck-playtest.txt 2>&1
```

Then spawn the Haiku agent with the contents of `/tmp/deck-playtest.txt` plus the evaluation prompt above.

### Checklist — EVERY curated deck must pass ALL of these

Before a deck can ship, check off every item:

- [ ] **Static verification clean** — `node scripts/verify-curated-deck.mjs <deck_id>` → 0 failures
- [ ] **Automated playtest clean (all correct)** — `playtest-curated-deck.ts --charges 30` → 0 issues
- [ ] **Automated playtest clean (wrong answers)** — `playtest-curated-deck.ts --charges 20 --wrong-rate 0.3` → 0 issues
- [ ] **LLM playtest: question clarity** — Haiku agent rates 7+ / 10, no confusing questions flagged
- [ ] **LLM playtest: answer correctness** — Zero factual errors found by the agent
- [ ] **LLM playtest: distractor quality** — Haiku agent rates 7+ / 10, no secretly-correct distractors
- [ ] **LLM playtest: variety/pacing** — Haiku agent rates 7+ / 10, Anki queue feels natural
- [ ] **LLM playtest: educational value** — Haiku agent rates 7+ / 10, questions teach not just test
- [ ] **Learning queue verified** — Wrong answers return after 2 charges, correct advance through steps
- [ ] **No pool pollution** — Distractors are semantically appropriate (no "Medium-sized (G-type)" as planet distractor)
- [ ] **Bracket numbers clean** — Numeric answers display without braces, distractors are plausible nearby numbers
- [ ] **Wow factors present** — Every fact has a deck-specific wowFactor string

**If ANY checklist item fails, fix and re-run until ALL pass. No exceptions.**

---

## In-Game Visual Testing — SUPPLEMENTARY

**After all automated and LLM testing passes, optionally verify in the browser.** This catches rendering/layout issues that code-level tests can't see (font overflow, z-index, animation).

### After every deck ships, verify in-game:

1. **Start a Study Temple run** with the new deck
2. **Play through at least 10 charge quizzes** and verify:
   - Domain label at top matches the deck's domain (e.g., "SPACE & ASTRONOMY", not random)
   - Questions vary — not the same question repeating
   - Answers display cleanly (no `{braces}`, no truncation)
   - Distractors are plausible wrong answers from the correct pool (not random values from other pools)
   - Bracket-number facts show clean numbers with runtime-generated numeric distractors
3. **Check the console** for `[CuratedDecks]` log showing the deck loaded with correct fact count
4. **Test at least one bracket-number fact** — verify braces are stripped and distractors are nearby plausible numbers
5. **No fact repeats within 3 charges** (Anki cooldown system)
6. **Wrong answers come back after ~2 other facts** (learning queue)
7. **New facts introduced gradually**, not all at once
8. **Wow factor popup shows deck-specific text**, not trivia from other domains
9. **Wow factor shows max 3 times per encounter**, no duplicates

### Known integration points to verify:

| Component | What to check | Past bug |
|-----------|--------------|----------|
| Domain label on cards | Must show deck domain, not random trivia domain | Study mode used general pool → random domains (fixed in encounterBridge.ts) |
| Bracket answers | Must display without `{}` braces | Curated path didn't call `displayAnswer()` (fixed in nonCombatQuizSelector.ts + CardCombatOverlay.svelte) |
| Question variety | Different questions per charge in same encounter | Seeded PRNG used same seed for all charges in encounter (fixed in curatedFactSelector.ts via chargeCount) |
| Pool distractors | Must be semantically appropriate | bracket_numbers pool members showed as distractors for each other (fixed: bracket facts use runtime generation) |
| Deck loads | Console shows `[CuratedDecks] Loaded N deck(s)` | Deck not in manifest → invisible |
| CuratedDeck envelope | Must have answerTypePools, questionTemplates, difficultyTiers | Flat array of facts → runtime crash |
| Distractor dedup | No duplicate answer text in choices; correct answer never appears as distractor | Multiple pool facts with same correctAnswer (6 Jupiter facts) caused "Jupiter" showing 3x as distractor (fixed: dedup by answer value in curatedDistractorSelector.ts) |
| Wow factor popups | Must show curated deck fact's wowFactor, not random trivia facts | showWowFactor() read from trivia DB instead of curated deck (fixed: branches on deckMode, reads __studyFactId) |
| Fact selection | Anki three-queue system: learning > review > new, charge-based cooldowns | Old weighted random picked same fact repeatedly (fixed: three queues with charge cooldowns in curatedFactSelector.ts + inRunFactTracker.ts) |
