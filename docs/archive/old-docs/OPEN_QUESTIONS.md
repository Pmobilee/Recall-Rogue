# Open Design Questions — Terra Miner

Unresolved design questions from brainstorming sessions. Organized by system.

## Status Key
- **OPEN**: Not yet discussed or decided
- **LEANING**: Have a direction but not committed
- **DECIDED**: Resolved — full detail in DECISIONS.md

---

## Resolved Questions (Summary)

These have been decided and documented in `docs/DECISIONS.md`:

| # | Question | Decision | DD# |
|---|---|---|---|
| Q1 | Gacha moments | All of them (artifact, dive reward, pet) | DD-014 |
| Q2 | Rarity on containers vs facts | Containers, not facts | DD-015 |
| Q3 | Duplicate facts | Trade, mix, convert, or flag | DD-020 |
| Q4 | Gacha reveal ceremony | Escalating spectacle by rarity | DD-014 |
| Q5 | Oxygen depletion model | Per-action, no real-time | DD-012 |
| Q6 | Quiz timer | N/A — no timer exists | DD-012 |
| Q7b | Layer oxygen recovery | Small bonus on descent | DD-012 |
| Q10 | In-run upgrade persistence | Never persist | DD-003 |
| Q12 | Knowledge-gated pet revival | Yes, require related facts | DD-017 |
| Q13 | Pet roles | All: cosmetic, dive, farm | DD-017 |
| Q15 | Multiplayer depth | Minimal at launch, grow | — |
| Q16 | Shareable achievements | Yes | — |
| Q18 | Onboarding flow | Crash → fossil choice → tree seed | DD-018 |
| Q19 | First artifact quality | Guaranteed Rare+ | DD-018 |
| Q20 | Tutorial for Anki | Quick, optional intro | — |
| Q21 | Notification style | Duolingo-style | — |
| Q23 | Mineral naming | Dust → Primordial Essence | DD-019 |
| Q25 | Farm balance | Supplementary, not dominant | — |
| Q7 | Loot loss model | "The Sacrifice" — player chooses | DD-021 |
| Q8a | Biome shuffling | Yes, randomized per run | DD-022 |
| Q9 | Layer transitions | Descent Shafts + entrance challenges | DD-023 |
| Q11 | In-run upgrade style | Binding of Isaac passives | DD-016 |

---

## Still Open Questions

### Economy & Balance

**Q-E1: Mineral conversion tax** [OPEN]
When compressing 100 Dust → 1 Shard, should there be a "loss"? e.g., require 110 Dust for 1 Shard? This acts as an economy sink but might feel punishing.

**Q-E2: Rescue beacon cost** [OPEN]
How expensive should rescue beacons be? Too cheap = no risk. Too expensive = nobody uses them. Need to find the sweet spot where carrying one is a meaningful pre-dive decision.

**Q-E3: Daily deal rotating shop specifics** [OPEN]
What items appear? How often do rare items rotate in? Should there be a "pity timer" (guaranteed rare item every X days)?

**Q-E4: Knowledge Store currency** [OPEN]
The Knowledge Store uses a separate currency earned through learning milestones. How does this currency work? Per-fact? Per-branch-percentage? Per-mastery-level?

### Dive Mechanics

**Q-D1: Layer count per run** [LEANING: 5 layers in pool, 3-5 per run]
How many layers does a single run contain? Current thinking: pool of 7+ biomes, each run draws 3-5 depending on oxygen allocation. Still needs testing.

**Q-D2: Backpack starting size** [OPEN]
3x3? 4x3? 4x4? Needs prototyping to find the sweet spot where it feels tight but not unplayable.

**Q-D3: Oxygen cost per action specifics** [OPEN]
How much oxygen per block type? Per movement? Per quiz attempt? These numbers define the entire game's pacing. Need a spreadsheet/simulation.

**Q-D4: "Barely made it" mechanic** [IDEA BOX]
If you run out of oxygen within X blocks of a layer boundary, crawl out gasping but keep everything. Cinematic, but might undermine the Sacrifice system. Needs thought.

### Content & Pipeline

**Q-C1: Fact sourcing at scale** [OPEN]
How to source and curate 500+ facts with 25 distractors each efficiently? Need to build an automated pipeline. AI-assisted with minimal human review, strong verification system.

**Q-C2: Image generation pipeline for facts** [OPEN]
Every fact gets a pixel art image. How to auto-generate these at scale? Need prompt templates per category, quality checks (image doesn't reveal answer), and batch processing via ComfyUI.

**Q-C3: Distractor quality at scale** [OPEN]
25 plausible distractors per fact is critical but hard. Need a system that generates same-domain wrong answers that are plausible but clearly wrong. Domain-specific distractor templates?

### Social & Meta

**Q-S1: Guilds/clubs** [OPEN]
"The Historians" concept — groups focused on knowledge areas. Interesting but not priority. Design the social layer to accommodate later.

**Q-S2: Seasons/battle pass** [OPEN]
"Age of Dinosaurs" themed seasons with special content. Could drive engagement cadence. Worth exploring post-MVP.

**Q-S3: How to gamify fact trading between players** [OPEN]
Trading facts is confirmed, but the mechanics need design. Marketplace? Direct trade? How to prevent exploitation?

### Learning System

**Q-L1: Balance learning bonuses across topics** [OPEN]
If learning Geology gives mining bonuses, players might only study Geology. Need balanced incentives. Deferred for now — Knowledge Tree is cosmetic/social first.

**Q-L2: Pet species count at launch** [OPEN]
5-10 species? One per major knowledge category? Need to balance content creation effort with collection depth. First pet is chosen during onboarding.

### MVP

**Q-MVP1: MVP system list** [DECIDED — KEEP SIMPLE]
MVP uses simple versions of each system:

1. Procedural mine generation (1 biome, single visual depth gradient)
2. Mining controls (tap to mine, block hardness)
3. Block types (dirt, stone, mineral node, artifact node)
4. **Simple slot inventory** (X slots, no Tetris/stacking yet — upgrade to Darkest Dungeon stacking in v1.1)
5. Dust mineral collection (single currency tier)
6. Artifact discovery + basic reveal (no elaborate gacha animation yet)
7. Quiz (1 correct + 3 distractors — start with 8-10 distractors per fact, expand to 25 later)
8. SM-2 spaced repetition (basic review at base)
9. **Simple list/grid Knowledge Tree** (fact list by category, not tree visualization yet)
10. Per-action oxygen system (static allocation, no earning system yet)
11. Simple onboarding (text prompts, no cutscene, no fossil choice)
12. Fixed mine size per run (seeded), fixed number of layers

**Test content**: Japanese JLPT N3 vocabulary (~50-100 words). Distractors auto-generated from similar words. No images. Language learning exercises the schema and is fastest to produce.

**What to cut for MVP**: Multiple biomes, stacking/Tetris inventory, gacha animations, multiple mineral tiers, pets/farm/zoo, premium materializer, social features, hazards, data discs, streaks, notifications, combat, synergies, ambient text, GAIA personality, cutscenes, tree visualization, pixel art per fact.

**What to add post-MVP (v1.1+)**: Darkest Dungeon backpack, send-up slots, multiple biomes + shuffling, GAIA personality, gacha animations, real fact content (500+ with wow_factor), pixel art per fact, Knowledge Tree visualization, fossil/pet system, slow dome unlocks.

### Content Pipeline

**Q-C1: Fact verification system** [OPEN — CRITICAL]
For a learning game, accuracy is existential. Need automated fact-checking integrated into the content pipeline. AI-generated facts with 5-10% error rate is unacceptable.

**Q-C2: Fact sourcing strategy** [LEANING]
Start with sources known to be fun and verifiable. Local Wikipedia copy considered but may not be the best first source. Semantic search (Qdrant/Graphiti) for deduplication. Build a robust internal verification pipeline before scaling.

---

*Last updated: 2026-02-28 — after brainstorming sessions 1-4 (Batches 1-30+, Questions 1-160)*
