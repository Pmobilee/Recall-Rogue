# Design Decisions V2

**Date**: 2026-03-02
**Session Type**: Comprehensive Q&A design review
**Project**: Terra Gacha (formerly Terra Miner)

This document captures all design decisions from the V2 Q&A session. Each decision is numbered, grouped by system area, and includes context for future reference.

---

## Table of Contents

1. [Fact Creation and Content Pipeline](#fact-creation-and-content-pipeline)
2. [Mining Visuals and Sprites](#mining-visuals-and-sprites)
3. [Dome and Hub Visuals](#dome-and-hub-visuals)
4. [Multi-Level Mine System](#multi-level-mine-system)
5. [Quiz and Fact Popups](#quiz-and-fact-popups)
6. [Interest Selection and Categories](#interest-selection-and-categories)
7. [Dev Testing System](#dev-testing-system)
8. [Game Intro and Onboarding](#game-intro-and-onboarding)
9. [Login and Progress](#login-and-progress)
10. [GAIA Personality](#gaia-personality)
11. [Knowledge Tree](#knowledge-tree)
12. [Farming and Fossils](#farming-and-fossils)
13. [Known Bugs and Issues](#known-bugs-and-issues)

---

## Fact Creation and Content Pipeline

### DD-V2-001
**Area**: Content Pipeline — Fact Ingestion API
**Date**: 2026-03-02

**Context**: We need a scalable way to get facts into the database without requiring developers to manually author every field.

**Decision**: Create an API endpoint for fact ingestion that performs the following steps automatically:
- (a) Intelligently checks the database for duplicates or overly similar existing facts before inserting
- (b) Auto-categorizes into categories, subcategories, and sub-subcategories when none are provided
- (c) Auto-generates approximately 25 false answers (distractors) via LLM
- (d) Auto-generates `gaiaComment`, `explanation`, and `wowFactor` fields via LLM
- (e) Flags `fun_score`, `age_rating`, and political sensitivity automatically
- (f) Flags the fact as needing a pixel art image

The initial content source will be manually curated from interesting books before any automated crawler is built. Scale targets and numeric goals come later.

---

### DD-V2-002
**Area**: Content Pipeline — LLM Authorship
**Date**: 2026-03-02

**Context**: Deciding how much of the fact metadata to hand-author vs generate.

**Decision**: All LLM-generated content fields (distractors, `gaiaComment`, `explanation`, `wowFactor`) are fully LLM-generated. Nothing in these fields is human-authored. Human curation applies only to the core fact text and source material selection.

---

### DD-V2-003
**Area**: Content Pipeline — Category Taxonomy
**Date**: 2026-03-02

**Context**: The current category system is flat and insufficiently granular for a rich learning experience.

**Decision**: A very intelligent categorization system is required with sub-sub-sub categories. Every main category must have fine-grained subcategories. The depth of the hierarchy should be determined by the richness of available content in each domain, not by an artificial limit.

---

### DD-V2-004
**Area**: Content Pipeline — Distractor Generation
**Date**: 2026-03-02

**Context**: Distractors must be plausible and contextually similar to the correct answer to create meaningful quiz challenge.

**Decision**: Distractors are fully LLM-generated at scale. The LLM should produce approximately 25 candidates per fact so the quiz system can select the 3 most appropriate at runtime based on context (e.g., player knowledge level, category).

---

### DD-V2-005
**Area**: Content Pipeline — Web Dashboards
**Date**: 2026-03-02

**Context**: Content management, sprite selection, and system monitoring all need dedicated interfaces.

**Decision**: Multiple web dashboards are required:
- Fact editor, browser, and approval tool
- Sprite selection tool (choose best output from several ComfyUI generation candidates)
- General management dashboards for system health and content metrics

---

### DD-V2-006
**Area**: Content Pipeline — Fact Verification
**Date**: 2026-03-02

**Context**: Facts must be verifiable to maintain educational integrity.

**Decision**: Wikipedia with a citation URL stored in the fact record is sufficient for v1 verification. More rigorous source tracking can be added in later versions.

---

### DD-V2-007
**Area**: Content Pipeline — Pixel Art Per Fact
**Date**: 2026-03-02

**Context**: Facts are more memorable and engaging when accompanied by a relevant visual. The current schema has no mechanism for this.

**Decision**: Add a `visual_description` column to the fact schema. A 24/7 ComfyUI automation script continuously scans for facts that have no associated pixel art image and generates them automatically. Language and vocabulary facts are excluded from pixel art generation (they are text-inherent by nature).

---

## Mining Visuals and Sprites

### DD-V2-008
**Area**: Mining Visuals — Block Rendering
**Date**: 2026-03-02

**Context**: The current single-sprite-per-block rendering makes the mine look flat and disconnected. Terraria and similar games use bitmasking autotiling to make blocks visually connect to their neighbors.

**Decision**: Implement Terraria-style autotiling with bitmasking. Blocks must blend smoothly with their neighbors — dirt next to stone gets smooth transition edges. This is a significant rendering system change but non-negotiable for visual quality.

---

### DD-V2-009
**Area**: Mining Visuals — Tile Texture Continuity
**Date**: 2026-03-02

**Context**: The current flat single-sprite-per-block approach produces a disconnected, grid-like appearance.

**Decision**: Tiles must blend with their neighbors. The current approach is explicitly not acceptable. The mine must look significantly better, with continuous textures across same-type block regions. This requirement reinforces DD-V2-008 (autotiling) as a mandatory system.

---

### DD-V2-010
**Area**: Mining Visuals — Crack Overlays
**Date**: 2026-03-02

**Context**: Block damage states are currently shown with procedural vector lines. Crack sprites (`crack_small.png`, `crack_large.png`) exist in the asset folder but are unused.

**Decision**: Use sprite-based crack overlays with 3-4 distinct visual damage stages. Replace the existing procedural vector line approach with the existing crack sprite assets, extended to cover all required damage stages.

---

### DD-V2-011
**Area**: Mining Visuals — Character Animation
**Date**: 2026-03-02

**Context**: The miner character currently has no animation states. Visual feedback for movement and mining actions is essential for game feel.

**Decision**: Implement full character animation with the following sprite sheets:
- idle
- walk-left
- walk-right
- walk-up
- walk-down
- mine-left
- mine-right
- mine-down

That is 8 or more sprite sheets total. In the mine, movement is 4-directional. In the dome, movement is left-right only. In the dome, the player clicks a hub layer to move the miner up or down, then clicks on a usable item or pet in that layer — the miner walks to it and a popup shows available actions.

---

### DD-V2-012
**Area**: Mining Visuals — Block Idle Animations
**Date**: 2026-03-02

**Context**: Static blocks feel lifeless. Subtle animations make the mine feel like a living environment.

**Decision**: Implement block idle animations including:
- Crystals glinting
- Artifacts glowing
- Fossil bone edges slightly exposed with subtle animation
- Mineral nodes shimmering

Additional creative idle animations beyond this list are encouraged.

---

### DD-V2-012B: Mining Satisfaction — "The Pickaxe Feel"
- **Area**: Mining Visuals & Game Feel
- **Date**: 2026-03-02
- **Context**: The single most repeated action in the game is hitting a block. Players will do this millions of times. Games like Stardew Valley (pickaxe swing) and Motherload (drill animation) are beloved partly because the core mining action is deeply satisfying. This needs its own dedicated design session and iteration cycle.
- **Decision**: Design an ultra-satisfying mining feedback loop that rivals the best in the genre. This includes:
  - **Pickaxe swing animation** — weighty, impactful arc with anticipation frames (wind-up → swing → impact → recovery)
  - **Impact frame** — screen micro-shake, brief white flash on the hit block, impact particles spray
  - **Hit feedback per block type** — dirt crumbles softly, stone clinks with sparks, crystal rings with prismatic shards, hard rock thuds with dust clouds
  - **Progressive satisfaction** — each successive hit on a multi-hit block feels increasingly impactful (cracks widen, more particles, screen shake intensifies slightly)
  - **Break moment** — the final hit has a distinct, climactic feel: block shatters, loot pops out, dust cloud, satisfying crunch sound
  - **Audio layering** — impact sound + material sound + ambient reaction, all slightly randomized to prevent repetition fatigue
  - **Haptic feedback on mobile** — subtle vibration on hit, stronger on break (Capacitor haptics API)
  - **Pickaxe tier visual difference** — higher tier pickaxes have flashier swing animations, bigger impact effects, unique sound profiles
  - **Rhythm feel** — mining multiple blocks in succession should feel rhythmic and flow-state inducing, not jarring
  - This is NOT a one-and-done task — it requires dedicated prototyping, iteration, and playtesting. Allocate a full sub-phase.

---

### DD-V2-013
**Area**: Mining Visuals — Loot Pop Physics
**Date**: 2026-03-02

**Context**: Block breaking currently deposits items with no visual fanfare. The moment of reward is the highest-dopamine moment in a mining game.

**Decision**: Implement loot pop physics. When a block breaks, minerals and items bounce out with a physics arc trajectory, then get sucked into the backpack. Additional juice effects should be added everywhere they make sense — this is a high-priority polish pass.

---

### DD-V2-014
**Area**: Mining Visuals — Biome Tile Sets
**Date**: 2026-03-02

**Context**: The current biome system applies color tinting to reuse the same tiles. This is insufficient for visual distinctiveness.

**Decision**: Each of the 25 biomes needs its own unique tile sprite set. Biome tiles must look genuinely different, not just color-shifted. Volcanic dirt must look visually distinct from sedimentary dirt at the sprite level, not the shader level.

---

### DD-V2-015
**Area**: Mining Visuals — Particle Effects
**Date**: 2026-03-02

**Context**: Particles are one of the most impactful tools for making a game feel responsive and alive.

**Decision**: Particle effects are a very high priority and critical for addictiveness. Required effects include:
- Dust clouds on block break
- Ember particles in volcanic biome
- Crystal sparkles in crystalline biome

Additional biome-specific and action-specific particles beyond this list are required. This is not a nice-to-have.

---

### DD-V2-015-5
**Area**: Game Feel — Addictiveness Pass
**Date**: 2026-03-02

**Context**: Learning games live or die by their ability to keep players engaged. Every system needs to be evaluated from a dopamine and retention perspective.

**Decision**: A dedicated addictiveness pass is required as a separate development effort. Every system must be evaluated for dopamine response, engagement hooks, and retention mechanics. The learning-through-play loop must be maximally compelling.

---

## Dome and Hub Visuals

### DD-V2-016
**Area**: Dome — Complete Redesign
**Date**: 2026-03-02

**Context**: The current single dome is described as "looking like a JPEG, not alive, not clickable, not explorable." It is a static rendering that does not invite interaction or give the player a sense of ownable space.

**Decision**: Complete dome redesign. Replace the current single dome with a multi-floor glass hub system. Architecture:
- Multiple square glass hubs stacked vertically
- Start with a single bottom hub containing the diving hole and materializer
- The top is always a stargazing dome
- Players scroll up and down between floors, clicking a floor to teleport the miner there

The system must be flexible enough to support wallpapers purchasable and applicable to specific hubs, and must make players want to unlock more space to fill. This is a ground-up redesign, not an iteration on the current implementation.

---

### DD-V2-017
**Area**: Dome — Knowledge Tree as Physical Object
**Date**: 2026-03-02

**Context**: The Knowledge Tree is currently a separate screen overlay. Making it a physical dome object grounds it in the game world.

**Decision**: The Knowledge Tree is a clickable physical object in the starter hub. Clicking it opens a beautiful interactive tree visualization. Also required: a button to toggle between showing all unlocked leaves vs only partially-learned-and-above leaves.

---

### DD-V2-018
**Area**: Dome — Upgrade System
**Date**: 2026-03-02

**Context**: Dome progression needs clear goals and material sinks.

**Decision**: All dome upgrades are tied to materials players can buy with correct materials. Some upgrades additionally require unlocking via learning, gathering, and/or mastering specific items. This is a crucial system for long-term progression.

---

### DD-V2-019
**Area**: Dome — Visual Upgrade Reflection
**Date**: 2026-03-02

**Context**: Upgrades are meaningless if they are invisible.

**Decision**: All upgrades must be visually reflected in the hub. This is mandatory, not optional. Visual upgrade reflection is a core pillar of making the dome hyper addictive.

---

### DD-V2-020
**Area**: Dome — Physical Navigation
**Date**: 2026-03-02

**Context**: Rooms are currently screen overlays. The redesign requires physical traversal.

**Decision**: Rooms are physical floors and hubs. The player physically walks around, enters layers, and interacts with objects by walking to them. This is the fundamental navigation model for the redesigned dome.

---

## Multi-Level Mine System

### DD-V2-021
**Area**: Mine — Layer Transitions
**Date**: 2026-03-02

**Context**: The current layer transition is an instant scene restart with no visual ceremony. Major transitions deserve visual weight.

**Decision**: Layer transitions require:
- A falling animation for the miner
- A biome transition screen
- A title card (e.g., "Layer 2: Volcanic")

No more instant scene restarts for layer changes.

---

### DD-V2-022
**Area**: Mine — Layer Count and Depth Model
**Date**: 2026-03-02

**Context**: The current point-of-no-return mechanic creates frustration and is being removed. The depth model needs clarification.

**Decision**: Maximum 20 layers. Remove the point-of-no-return mechanic entirely. Depth is measured only in layers — within a single layer everything is equally deep. Players should be able to spawn everywhere in a layer. Every layer must have a sealed room accessible only via quiz gate.

---

### DD-V2-023
**Area**: Mine — Layer Sizing
**Date**: 2026-03-02

**Context**: All layers currently use the same grid size, which does not reward depth exploration with increased scale.

**Decision**: Layer sizes scale progressively. Start at 20×20 for layer 1, scale up to 40×40 for the deepest layers. The scaling curve between these bounds is to be determined during implementation.

---

### DD-V2-024
**Area**: Mine — Descent Shaft Placement
**Date**: 2026-03-02

**Context**: Players need a meaningful challenge in finding the path to the next layer.

**Decision**: The descent shaft becomes harder to find in deeper layers. This is achieved by placing it in a smaller bounded area deeper in the layer, increasing the required exploration effort.

---

### DD-V2-025
**Area**: Mine — Camera and Mini-Map
**Date**: 2026-03-02

**Context**: The current camera shows the entire mine on web, which removes all exploration tension. A mini-map is needed for spatial orientation.

**Decision**: Add a mini-map showing explored areas. The camera must be significantly more zoomed in — the entire map should not be visible on web. The camera moves with the character. Players use the mini-map for spatial reference, not the camera.

---

## Quiz and Fact Popups

### DD-V2-026
**Area**: Quiz — Gate Placement
**Date**: 2026-03-02

**Context**: `DENSITY_QUIZ_GATES` is currently set to 0, meaning quiz gates never spawn. The sealed room mechanic is the primary knowledge gate in the mine.

**Decision**: Every layer must have exactly 1 quiz gate in a sealed room. This prevents descending without answering a question. Additionally, quizzes must trigger for: picking up artifacts, picking up oxygen, and random blocks — with varying trigger chances depending on the rarity of the find. `DENSITY_QUIZ_GATES` must be restored to a value greater than 0.

---

### DD-V2-027
**Area**: Quiz — Pop Quiz Rate
**Date**: 2026-03-02

**Context**: The current 4% pop quiz trigger rate is insufficient for learning frequency goals.

**Decision**: Increase pop quiz rate to 8-10% (up from the current 4%).

---

### DD-V2-028
**Area**: Quiz — Additional Formats
**Date**: 2026-03-02

**Context**: Multiple choice is the only current quiz format. Other formats could improve learning outcomes.

**Decision**: Fill-in-blank, true/false, image-based, and audio-based quiz formats are nice-to-have for the far future. Not a near-term priority.

---

### DD-V2-029
**Area**: Quiz — Display Style
**Date**: 2026-03-02

**Context**: Quizzes could be displayed inline in the game world or as full-screen overlays.

**Decision**: Full-screen overlay style is the correct approach and is better than inline. Retain the existing overlay pattern.

---

## Interest Selection and Categories

### DD-V2-030
**Area**: Interests — Settings Page
**Date**: 2026-03-02

**Context**: Players have wildly different learning interests. The system must accommodate narrow specialists (particle physics only) and curious generalists.

**Decision**: Build a large settings page for interests. Players can select categories and subcategories they prefer, with up to 3 highlighted as favorites. Sliding bars relatively decrease chances of non-favorite categories, including within subcategories. A shop item should be available to study only a specific category or language. Interest selection must also be part of the tutorial flow.

---

### DD-V2-031
**Area**: Interests — Weighted Fact Spawning
**Date**: 2026-03-02

**Context**: Interest preferences must meaningfully affect what facts the player encounters.

**Decision**: Fact spawning is weighted based on player interest preferences. A player who wants to study only particle physics should be able to achieve that focus. Additionally, an option must exist to let the app learn what the player finds interesting from behavioral signals (sells, learns, voluntary masters) and adjust weights accordingly.

---

### DD-V2-032
**Area**: Knowledge Tree — Sub-Branches
**Date**: 2026-03-02

**Context**: A fixed Knowledge Tree structure cannot accommodate content that is added over time.

**Decision**: Each Knowledge Tree branch needs sub-branches that are interactively added based on new cards found in-game. There is no fixed limit on depth or branch count. This architecture allows adding more content categories later without restructuring the tree.

---

### DD-V2-033
**Area**: Social — Factions
**Date**: 2026-03-02

**Context**: Social competitive elements increase retention significantly.

**Decision**: Factions are a planned social competitive element for later phases. Not a near-term priority but reserved in the design space.

---

## Dev Testing System

### DD-V2-034
**Area**: Dev Tools — Scenario Presets
**Date**: 2026-03-02

**Context**: Manual state setup for testing specific scenarios is slow and error-prone.

**Decision**: Add scenario preset buttons to the dev panel that switch the game to specific named test states, such as "just bought first pet", "endgame all rooms unlocked", and "first fossil found".

---

### DD-V2-035
**Area**: Dev Tools — Save State Snapshots
**Date**: 2026-03-02

**Context**: Scenario presets need persistent save states to load from.

**Decision**: Implement save state snapshots that capture and restore specific game states for testing purposes. These work alongside the scenario presets from DD-V2-034.

---

### DD-V2-036
**Area**: Dev Tools — Access Control
**Date**: 2026-03-02

**Context**: Dev tools must not appear in production builds.

**Decision**: The dev panel and all dev tools are accessible in dev builds only. They are not present in production builds.

---

### DD-V2-037
**Area**: Dev Tools — Visual Testing
**Date**: 2026-03-02

**Context**: Automated visual regression testing requires significant infrastructure investment.

**Decision**: Manual visual inspection via Playwright is sufficient for now. No automated visual regression suite is required in the near term.

---

## Game Intro and Onboarding

### DD-V2-038
**Area**: Onboarding — Intro Screens
**Date**: 2026-03-02

**Context**: The game's backstory sets the emotional and narrative foundation. Visual quality of the intro communicates the game's overall quality.

**Decision**: Use pixel art panels generated via ComfyUI to tell an incredible backstory during the intro sequence.

---

### DD-V2-039
**Area**: Onboarding — GAIA Introduction
**Date**: 2026-03-02

**Context**: The GAIA introduction is also the interest assessment and personality establishment moment.

**Decision**: GAIA delivers a scripted monologue during onboarding with player choices. Choices help guide interest configuration. Example: "Who were you?" followed by bubbles: historian, geologist, language learner, etc. These choices feed directly into the interest weighting system.

---

### DD-V2-040
**Area**: Onboarding — Tutorial Length and Content
**Date**: 2026-03-02

**Context**: Players need enough guidance to understand the full game loop without being overwhelmed.

**Decision**: The tutorial is approximately 5 minutes total and very detailed. It must guide the player through:
- Biome introduction
- Finding a fossil
- Getting the first pet
- Finding first facts
- Understanding why learning matters in the game context
- Using the materializer to buy a second machine
- Ending with a clear first goal: "gather 50 facts underground and learn 20 to unlock the next hub"

---

### DD-V2-041
**Area**: Onboarding — Interest Assessment Integration
**Date**: 2026-03-02

**Context**: Interest assessment must feel natural, not like a survey.

**Decision**: Interest assessment is woven into the tutorial. Start with a multiple-select (language learner, geologist, etc.), then ask progressively specific questions (which language? volcanoes vs seas?).

Critical constraint: UNLESS the user specifically clicks that they ONLY want to learn one thing AND answers "No" to "are you open to learning anything else about this planet?", the system only increases the probability of interest categories — it never rules out other domains entirely. Interests are always weights, never hard filters.

---

## Login and Progress

### DD-V2-042
**Area**: Auth — Login Methods
**Date**: 2026-03-02

**Context**: Players need flexible authentication options that don't create friction.

**Decision**: Support all of: email and password login, social login (Google and Apple), and guest mode with optional account linking later.

---

### DD-V2-043
**Area**: Progress — Offline and Sync Model
**Date**: 2026-03-02

**Context**: Mobile players frequently lose connectivity. Progress must not be lost.

**Decision**: The game is fully locally playable. Cloud sync is a backup mechanism, not a requirement. Send updates and enable social features when the device is online. Offline-first architecture.

---

### DD-V2-044
**Area**: Backend — Database
**Date**: 2026-03-02

**Context**: The production backend needs a mature, well-supported relational database.

**Decision**: PostgreSQL for production. Standard setup.

---

## GAIA Personality

### DD-V2-045
**Area**: GAIA — Engagement Behavior
**Date**: 2026-03-02

**Context**: GAIA is the primary relationship mechanic. She must make players feel like they have a reason to come back.

**Decision**: GAIA must be way more involved. Required behaviors:
- Popups players can click to read her thoughts
- After a dive, sometimes gives a free fact
- "You dropped this, king" — returning an item with personality
- Tells jokes
- Complains about the player's pet
- Always says something after extended idle time so the player feels the need to come back
- After every dive, GAIA always says something

The goal is that players feel they have a companion they would miss if they stopped playing.

---

### DD-V2-046
**Area**: GAIA — Journey Memory
**Date**: 2026-03-02

**Context**: A companion that remembers your history is far more emotionally engaging than one with stateless interactions.

**Decision**: GAIA references specific facts the player has learned, congratulates them on milestones, and remembers their favorite category. Implementation requires either LLM integration for generative dialogue or extensive scripted dialogue trees covering the major memory states.

---

### DD-V2-047
**Area**: GAIA — Visual Presence
**Date**: 2026-03-02

**Context**: GAIA's visual presence in the mine vs dome needs to be clearly defined.

**Decision**: GAIA is dome-only. No visual GAIA in the mine. During dives, only toast notifications appear (text-only). GAIA's full presence — avatar, interactive popups, rich dialogue — is reserved for the dome.

---

## Knowledge Tree

### DD-V2-048
**Area**: Knowledge Tree — Visualization and Interaction
**Date**: 2026-03-02

**Context**: The Knowledge Tree is a core retention mechanic. Players must be able to see their learning progress visually and want to fill in gaps.

**Decision**: Add a toggle button for all available leaves vs all even remotely learned facts. Node and branch colors must change based on completeness. The visualization style should be Obsidian-like — an interactive graph, not a static diagram.

---

### DD-V2-049
**Area**: Knowledge Tree — Leaf Interaction
**Date**: 2026-03-02

**Context**: Tapping a fact in the tree should do more than display static information.

**Decision**: Tapping a leaf in the Knowledge Tree shows the fact interactively. The tree is not view-only — it is an interactive fact review interface.

---

### DD-V2-049-5
**Area**: Knowledge Tree / Facts — Pixel Art Visual Descriptions
**Date**: 2026-03-02

**Context**: This decision clarifies and extends DD-V2-007 in the context of the Knowledge Tree display.

**Decision**: Add a `visual_description` column to the fact schema. A 24/7 ComfyUI script generates gorgeous pixel art for any fact missing an image, scanning continuously. Language and vocabulary facts are excluded from this pipeline. When a fact has pixel art, it should be displayed in the Knowledge Tree leaf view.

---

## Farming and Fossils

### DD-V2-050
**Area**: Fossils / Farm — Species Facts
**Date**: 2026-03-02

**Context**: Making species feel real requires associated educational content. Unlocking them through learning creates a meaningful knowledge gate.

**Decision**: Implement crop fossils — find fossils of crops underground and learn about them. Every fossil, pet, and farm animal in the game must have approximately 10 species-specific facts in the database. Players must learn those facts before the animal or plant becomes available in-game after finding the fossil. The fact-learning requirement is the unlock mechanic.

---

## Known Bugs and Issues

The following bugs and issues were identified during the Q&A session. These are documented here for tracking alongside design decisions since they affect design intent.

### BUG-001: Quiz Gates Never Spawn
**File**: `src/data/balance.ts`
**Issue**: `DENSITY_QUIZ_GATES` is set to `0`. Quiz gates never spawn anywhere in the mine.
**Required Fix**: Set `DENSITY_QUIZ_GATES` to a value greater than 0 as part of implementing DD-V2-026.

### BUG-002: Knowledge Store Powerup Effects Not Wired
**Issue**: Knowledge Store powerup effects are defined in the data layer but buying them does nothing — the effects are not applied in GameManager or any other system.
**Required Fix**: Wire up all Knowledge Store powerup purchase effects to their respective game systems.

### BUG-003: Leaderboard Category Mismatch
**Issue**: Leaderboard category keys are mismatched between client and server. Client sends: `deepest_layer`, `total_dives`, `total_facts`, `total_blocks_mined`, `best_streak`. Server expects: `deepest_dive`, `facts_mastered`, `longest_streak`, `total_dust`. Submissions are silently rejected.
**Required Fix**: Align client and server on a single canonical set of leaderboard category keys.

### BUG-004: Confusing Layer Count Constants
**File**: `src/data/balance.ts` (and related)
**Issue**: The legacy constant `MINE_TOTAL_LAYERS: 1` coexists with `MAX_LAYERS: 3`, creating confusion about the authoritative layer count.
**Required Fix**: Remove or rename `MINE_TOTAL_LAYERS` to eliminate ambiguity. Update to reflect the new maximum of 20 layers per DD-V2-022.

### BUG-005: Crack Sprites Unused
**Files**: `src/assets/sprites/crack_small.png`, `src/assets/sprites/crack_large.png`
**Issue**: These sprites exist but are unused. The code currently uses procedural vector lines for crack/damage visualization.
**Required Fix**: Implement sprite-based crack overlays using these assets per DD-V2-010.

### BUG-006: Unreferenced Item Sprites
**Files**: `mineral_blue.png`, `mineral_green.png`, `mineral_red.png`, `relic_gold.png`, `relic_tablet.png`
**Issue**: These sprite files exist in assets but are not referenced anywhere in the codebase.
**Required Fix**: Either integrate these sprites into the rendering pipeline or document why they are not needed and remove them.

### BUG-007: Sacrifice Screen Has No Component
**File**: `src/ui/components/` (missing)
**Issue**: A `sacrifice` screen type exists in the `gameState` type definition but no corresponding Svelte component has been created. Any navigation to this screen results in a silent no-render.
**Required Fix**: Either create the `Sacrifice.svelte` component or remove the `sacrifice` screen type from the type definition if the feature is not planned.

---

## Gameplay & Mechanics — Q&A Session (2026-03-03)

This section captures decisions from a dedicated gameplay and mechanics Q&A session. Topics covered: time model, mine structure, hazards, economy, progression, quiz design, and late-game systems.

---

### DD-V2-051
**Area**: Core Mechanics — Time Model
**Date**: 2026-03-03

**Context**: Several proposed systems used real-time seconds (lava spreading per second, gas clouds lasting seconds, instability timers counting down in wall-clock time). The creator explicitly rejected all time-based elements during the Q&A session.

**Decision**: ALL game systems use movement/action-based timing, never real-time seconds. One player movement or one block hit equals one "tick." There is no rushing the player with a clock. This principle applies universally to: lava flow rate, gas cloud duration and drift, layer instability meters, cave-in warnings, and any other hazard or timer mechanic introduced in the future. The game must never create real-time pressure — only action-count pressure.

---

### DD-V2-052
**Area**: Mine — Descent Shaft Placement
**Date**: 2026-03-03

**Context**: DD-V2-024 specified that the descent shaft becomes harder to find in deeper layers by placing it in a smaller bounded area in the bottom half of the layer. The creator explicitly rejected the bottom-half restriction during the Q&A session.

**Decision**: The descent shaft is randomly placed anywhere in the layer, not restricted to the bottom half or any bounded sub-region. Layer 1 may use guided placement to ease onboarding; all subsequent layers use fully random placement. This mirrors the Pixel Dungeon approach. This decision supersedes DD-V2-024.

---

### DD-V2-053
**Area**: Mine — Endgame and Layer 20
**Date**: 2026-03-03

**Context**: The game needs an answer for what happens when a player completes layer 20. A "New Game+" or reset system would undermine the endless nature of the game.

**Decision**: No New Game+ system. Layer 20 is a milestone reward, not a conclusion. Each time a player finishes layer 20, one event is selected randomly from a long list of "completion events." Examples include: pick 5 facts to learn from 20 options in your favorite category, receive a guaranteed artifact, receive a generous loot package. Players continue diving indefinitely after each completion event. The goal is for layer 20 to feel like an exciting recurring reward, not a game-ending screen.

---

### DD-V2-054
**Area**: Mine — Grid Scaling
**Date**: 2026-03-03

**Context**: DD-V2-023 established linear scaling from 20x20 to 40x40 across 20 layers. Linear scaling makes per-layer size differences imperceptible — adjacent layers feel identical in scale.

**Decision**: Use discrete stepped tiers instead of linear scaling: Layers 1–5 at 20×20, Layers 6–10 at 25×25, Layers 11–15 at 30×30, Layers 16–20 at 40×40. Each tier boundary creates a noticeable jump in layer size that players can perceive and anticipate. This supersedes the linear scaling model from DD-V2-023.

---

### DD-V2-055
**Area**: Mine — Layer Design Identity
**Date**: 2026-03-03

**Context**: Over 20 layers the core mining loop risks feeling repetitive if every layer is structurally identical apart from block composition and biome.

**Decision**: Every 5th layer has a distinct structural identity that differentiates it from standard layers. Layer 5 = "Gauntlet" (narrow corridors, dense hazards, rich rewards as payoff). Layer 10 = "Treasure Vault" (open cavern structure, mineral-rich, oxygen-timed challenge). Layer 15 = "Ancient Archive" (artifact-heavy, quiz-heavy, structured around knowledge). Layer 20 = unique hand-crafted completion event per DD-V2-053.

---

### DD-V2-056
**Area**: Mine — Player Spawn Position
**Date**: 2026-03-03

**Context**: Layer 1 needs an intuitive, welcoming entry point. Subsequent layers should require active exploration and not allow players to spawn near the exit.

**Decision**: Layer 1: player always spawns top-center with a 3×3 area pre-cleared. Layers 2 and beyond: player spawns at a random position that is deliberately NOT near the descent shaft or exit. This ensures exploration is required on every layer and prevents trivial shaft-to-shaft routing. Inspired by Pixel Dungeon.

---

### DD-V2-057
**Area**: Mine — Block Distribution by Depth
**Date**: 2026-03-03

**Context**: Current block density values are flat across all layers. Deep layers do not feel meaningfully different in composition from shallow layers.

**Decision**: Implement a depth-based block distribution curve. Dirt dominates layers 1–3 and is virtually absent by layer 10. Hard Rock is absent in layers 1–5, minor in 6–10, and dominant in 15–20. Mineral node density peaks at layers 8–12 then shifts toward higher-tier mineral variants. Artifact density increases with depth, peaking in layers 15–20. Every block type must have a depth profile that makes each tier feel compositionally distinct.

---

### DD-V2-058
**Area**: Mine — Block Types
**Date**: 2026-03-03

**Context**: Unbreakable blocks at high density in 40×40 deep layers create frustrating dead-ends and impassable zones. A flat "cannot break" property is a blunt design tool.

**Decision**: Replace some unbreakable blocks with conditionally breakable variants. These blocks require a specific condition to mine: a minimum pickaxe tier, bomb usage, or a companion ability. Examples: "Crystallized Wall" (requires Diamond Pickaxe tier), "Sealed Chamber" (requires a bomb). This reduces flat unbreakable density in deeper layers and creates meaningful upgrade motivation. Standard unbreakable blocks remain but at reduced density.

---

### DD-V2-059
**Area**: Mine — Biome Assignment
**Date**: 2026-03-03

**Context**: With 25 biomes and only 20 layers per dive, not every biome can appear in every run. Biome assignment needs a system that provides variety without overwhelming shallow players with inappropriate biomes.

**Decision**: Group biomes into four depth tiers: Shallow (layers 1–5, 5 biomes), Mid (layers 6–10, 5 biomes), Deep (layers 11–15, 5 biomes), Extreme (layers 16–20, 5 biomes). The remaining 5 biomes are designated "anomaly" biomes with a 10–15% chance to override the normal tier biome for that layer. Anomaly layers provide surprise and replayability variety.

---

### DD-V2-060
**Area**: Hazards — Active Threats
**Date**: 2026-03-03

**Context**: All current hazards are static (blocks that cost O2 when mined) or reactive (cave-ins triggered by specific block types). No hazards actively pursue or expand toward the player.

**Decision**: Implement movement-based active hazards: lava entities that expand outward and gas clouds that drift toward the player. All active hazard behavior is driven by movement ticks (per DD-V2-051), never real-time seconds. These hazards introduce spatial pressure and escape decision-making without creating clock anxiety.

---

### DD-V2-061
**Area**: Mine — Tension Mechanic
**Date**: 2026-03-03

**Context**: The point-of-no-return mechanic was removed (DD-V2-022). A replacement tension system is needed that creates meaningful risk calculation without artificial barriers.

**Decision**: Implement oxygen cost scaling by depth. Layer 1 uses normal O2 costs. Layer 10 applies a 1.5x cost multiplier. Layer 20 applies a 2.5x cost multiplier. This creates a constant risk-reward calculation: going deeper is always possible but returning costs proportionally more O2. This is the primary tension mechanic replacing the point-of-no-return.

---

### DD-V2-062
**Area**: Hazards — Quiz Integration
**Date**: 2026-03-03

**Context**: Hazard hits (cave-in, lava, gas) are currently pure punishment with no learning integration. There is an opportunity to weave knowledge into the hazard resolution moment.

**Decision**: When the player is hit by a hazard, a fact question is presented. A correct answer reduces damage based on the player's current defense stats and upgrades. A wrong answer results in full damage. This integrates learning into hazard resolution naturally and makes knowledge upgrades feel impactful during dangerous moments.

---

### DD-V2-063
**Area**: Items — Consumable Tools
**Date**: 2026-03-03

**Context**: Bombs are the only consumable item. A single consumable type limits pre-dive strategy and in-run decision-making.

**Decision**: Expand to 4–5 consumable types with a total carry limit of 5 slots across all types. Defined consumables: Bombs (3×3 area clear), Flares (reveal 5×5 through fog of war), Shield Charges (block the next hazard damage instance), Drill Charges (mine 5 blocks in a straight line), Sonar Pulse (reveal all special blocks within a 7-tile radius). Consumable selection happens on the pre-dive preparation screen (see DD-V2-073).

---

### DD-V2-064
**Area**: Hazards — Lava Behavior
**Date**: 2026-03-03

**Context**: Lava needs to feel threatening and dynamic without exponentially destroying large portions of the level or creating unwinnable states.

**Decision**: A single lava entity — regardless of how many blocks wide it currently occupies — expands by exactly ONE block per movement tick. No exponential or branching spread. This keeps lava threatening and predictable. A "Coolant Bomb" consumable can solidify a 3×3 area of active lava into passable obsidian. Lava entity behavior follows the movement-based time model from DD-V2-051.

---

### DD-V2-065
**Area**: Hazards — Gas Behavior
**Date**: 2026-03-03

**Context**: Gas pockets currently deal a flat O2 penalty when mined. They need a spatial area-of-effect and drift behavior to make them genuinely hazardous.

**Decision**: When a gas pocket block is triggered, it releases a visible cloud (green mist particle effect) that fills a 3×3 area and drifts toward the player based on movement ticks. Standing inside the cloud drains O2 per tick. The cloud dissipates after a defined number of movement ticks. Gas cloud drift and dissipation both follow the movement-based time model from DD-V2-051.

---

### DD-V2-066
**Area**: Mine — Layer Urgency
**Date**: 2026-03-03

**Context**: Without a point-of-no-return and with movement-based timing, there is no urgency mechanic to prevent players from exhaustively clearing every layer at zero risk. Some urgency is needed without introducing real-time pressure.

**Decision**: Implement a movement/action-based instability meter per layer. The meter increases with each player action. At 75% instability: earthquake frequency doubles. At 100% instability: the player receives a limited number of moves to reach the descent shaft before a catastrophic collapse ends the dive. The meter is purely action-count based — no wall-clock seconds involved.

---

### DD-V2-067
**Area**: Economy — Anti-Grind
**Date**: 2026-03-03

**Context**: Players could endlessly grind layers 1–3 for safe, low-risk mineral farming, bypassing the intended depth-based economy entirely.

**Decision**: Implement shallow layer mineral depletion. Each repeat dive to the same shallow depth applies a 10% reduction to mineral yield, with a floor of 30% of base yield. The game displays a contextual GAIA message when this penalty is active: "This depth has been over-mined. G.A.I.A. suggests going deeper." This incentivizes depth progression without hard-blocking shallow farming entirely.

---

### DD-V2-068
**Area**: Progression — Depth Gating
**Date**: 2026-03-03

**Context**: Deep layers should be genuinely challenging and require preparation. Players should not be able to immediately access layer 20 content without earning the capability.

**Decision**: Deep diving requires earned preparation across three dimensions: (1) quiz performance must be viable, requiring the player to have learned enough facts for the hazard damage reduction system (DD-V2-062) to matter; (2) equipment upgrades from repeated dives (pickaxe tiers, oxygen tank upgrades); (3) consumable items purchased with earned minerals. Progression to deep layers is earned through play, not unlocked by time or arbitrary gates.

---

### DD-V2-069
**Area**: Crafting — Recipe Acquisition
**Date**: 2026-03-03

**Context**: The crafting system exists but recipes are pre-unlocked. Players asked "what's a recipe?" during the Q&A, indicating the discovery mechanic is unclear and insufficiently integrated into the exploration loop.

**Decision**: Recipes are discovered in the mine, not pre-unlocked. Recipe fragments drop from special blocks or structures. Collecting all fragments of a recipe unlocks it at the Materializer. This creates an additional exploration incentive and makes the crafting system feel like a reward for thorough mining rather than a static menu.

---

### DD-V2-070
**Area**: Core Design — Run Power Philosophy
**Date**: 2026-03-03

**Context**: The creator wants individual runs to feel filled with potential and power variation, similar to Binding of Isaac. Powerful runs should feel meaningfully different from weak runs.

**Decision**: Great runs — where the player answers quizzes correctly and finds synergistic upgrades — must feel POWERFULLY different from average runs. Players should be excited to tell others about exceptional run combinations: "I doubled my power with this item." However, there is a critical and non-negotiable constraint: learning rate is ONLY EVER managed by the Anki/SM-2 algorithm. In-run power and item effects NEVER affect how the game judges whether a player knows a fact. The game must never pretend a user knows something they do not. Run power is entirely separate from the learning assessment layer.

---

### DD-V2-071
**Area**: Quiz — Difficulty Scaling
**Date**: 2026-03-03

**Context**: A proposal was made to scale quiz difficulty with layer depth by restricting which facts appear at which depth (easy facts at shallow layers, hard facts at deep layers).

**Decision**: REJECTED. Quizzes must be fact-agnostic — the same quiz can appear at any depth. Difficulty is scaled through other means: distractor similarity, answer pressure from consequence severity, and the instability meter. Restricting which facts appear at which depth would compromise the SM-2 algorithm's scheduling and create false learning signals. Quiz content is always determined by the SM-2 review queue, not by depth.

---

### DD-V2-072
**Area**: Companions — Progression
**Date**: 2026-03-03

**Context**: Companion progression currently lacks depth and long-term investment hooks.

**Decision**: Two companion upgrade paths that both apply simultaneously. Path 1: find companion-specific upgrade items during runs that provide temporary per-run boosts. Path 2: invest shards permanently between runs to upgrade companion base stats and abilities. Both systems stack. A heavily invested companion should feel like a meaningful long-term partner with visibly different capabilities from an un-invested one.

---

### DD-V2-073
**Area**: UI — Pre-Dive Preparation
**Date**: 2026-03-03

**Context**: No pre-dive loadout screen exists. Strategic pre-dive choices (which consumables to bring, which companion, which pickaxe) happen implicitly or not at all.

**Decision**: Add a dedicated "Preparation" screen that appears before each dive. The screen allows: pickaxe tier selection, companion selection, consumable item loadout (up to 3 slots from DD-V2-063), and relic loadout review. This is the designated location for all strategic pre-dive decision-making.

---

### DD-V2-074
**Area**: Inventory — Backpack Upgrade
**Date**: 2026-03-03

**Context**: With 20 layers of mining, mineral overflow becomes an ongoing inventory frustration. Manual conversion during a dive interrupts flow.

**Decision**: Add an "Auto-Compress" backpack upgrade that automatically converts 50 dust into 1 shard while mining, without player intervention. The backpack upgrade system should feel like an optimization puzzle that rewards investment, not a source of frustration.

---

### DD-V2-075
**Area**: Mine — Structures and Offering Mechanic
**Date**: 2026-03-03

**Context**: BUG-007 documents that a "sacrifice" screen type exists with no corresponding component. The underlying mechanic has design value but needs a better name and clear trade table.

**Decision**: Rename the mechanic to "Offering." Ancient Altar structures appear in the mine as discoverable structures. Players trade items for immediate in-run benefits at defined rates: 50 dust = +25 oxygen, 1 shard = reveal the 5 nearest special blocks, 1 artifact = apply a random relic effect for the duration of the current layer, 1 crystal = full oxygen heal. The Offering mechanic resolves BUG-007 by providing the component that was missing.

---

### DD-V2-076
**Area**: Knowledge Store — Powerup Expansion
**Date**: 2026-03-03

**Context**: The initial Knowledge Store powerup list was well-received during the Q&A. The creator requested at least 20 total powerups purchasable with Knowledge Points.

**Decision**: Expand the Knowledge Store to 20 or more purchasable powerups. Confirmed powerups from prior design: "Miner's Instinct" (reveals mineral nodes for 3 dives), "Scholar's Focus" (doubles quiz dust reward for the next 5 correct answers), "Deep Breath" (permanent +50 base O2). Additional powerups must be designed to cover: mining speed, fog of war, hazard resistance, companion synergies, mineral yield, quiz streaks, relic discovery, and consumable capacity. The store should feel like a meaningful long-term progression layer, not an afterthought.

---

### DD-V2-077
**Area**: Quiz — Reward Scaling
**Date**: 2026-03-03

**Context**: The current flat 8-dust reward per correct quiz answer has no escalation and provides no incentive to maintain a streak of correct answers.

**Decision**: Implement an in-run quiz streak multiplier. 1st correct answer: 8 dust (1x). 2nd consecutive correct: 12 dust (1.5x). 3rd consecutive correct: 16 dust (2x). 4th and beyond: 24 dust (3x, capped). A wrong answer resets the streak to 0. The current multiplier level must be displayed prominently during quizzes so players are aware of what they stand to lose.

---

### DD-V2-078
**Area**: Knowledge — Non-Quiz Learning Moments
**Date**: 2026-03-03

**Context**: All knowledge delivery currently occurs through 4-choice multiple choice quizzes. Passive knowledge exposure without interaction can prime quiz performance and make facts feel embedded in the world.

**Decision**: Add "Fact Fragments" — when mining certain blocks, a single-line fact briefly appears on screen for approximately 2 seconds with no required interaction. 1–2 Fact Fragments appear per layer, thematically tied to the current biome. These seed knowledge for future quiz encounters and make the mine feel like an environment rich with discoverable information.

---

### DD-V2-079
**Area**: SM-2 — Review Queue Management
**Date**: 2026-03-03

**Context**: As the player accumulates facts, the transition from new cards to review cards becomes critical for sustainable learning. Poor management of this ratio causes review debt or insufficient new material.

**Decision**: Follow Anki's established model exactly for managing the new-to-review ratio. Cap daily reviews, use interleaving of new and review cards, and respect the SM-2 scheduling algorithm without modification. Do not re-invent this system — Anki has solved the new/review balance problem. Any deviation from the Anki model requires explicit justification.

---

### DD-V2-080
**Area**: Dev Tools — Balance Simulation
**Date**: 2026-03-03

**Context**: Session length targets, oxygen budget curves, and economy balance require systematic testing. Manual playtesting is too slow and too variable to validate numerical parameters reliably.

**Decision**: Build a simulation system capable of running thousands of simulated dives with configurable parameter sets. The simulator must be able to test: economy balance (mineral income vs expenditure), session length targets (average ticks per layer per tier), and difficulty curves (O2 survival rates by layer). This tooling is critical for getting balance numbers right without relying solely on expensive manual playtesting.

---

### DD-V2-081
**Area**: Relics — Rarity Tiers
**Date**: 2026-03-03

**Context**: The current 6 relics are equally weighted. There is no progression in relic quality that rewards deep diving or long-term investment.

**Decision**: Implement 3 relic rarity tiers. Common relics: available from any Relic Shrine. Rare relics: available only from layer 8 and deeper. Legendary relics: available only from layer 15 and deeper, or craftable through a specific Materializer recipe. Legendary relics must be "run-defining" — they should fundamentally change how a core system operates, not simply provide a percentage boost.

---

### DD-V2-082
**Area**: Hazards — Earthquake Communication
**Date**: 2026-03-03

**Context**: The earthquake system (0.8% per block, 15-block cooldown) was unfamiliar to the creator during the Q&A session, indicating it lacks sufficient in-game introduction and communication.

**Decision**: Earthquakes need explicit tutorial coverage and clear visual and audio warnings before and during occurrence. Earthquake frequency scales with depth. The system must be introduced to the player as a named mechanic with a visible warning state (screen shake precursor, visual indicator) so players understand what is happening and why. The existing implementation requires UI and tutorial work to make it legible.

---

### DD-V2-083
**Area**: Economy — Mineral Quality by Depth
**Date**: 2026-03-03

**Context**: Deep layers are more dangerous and require more preparation. The economic reward for depth must match the increased risk and difficulty.

**Decision**: Deeper layers must drop higher-tier minerals at significantly higher rates. Tier distribution by depth: Layers 1–5: primarily dust drops. Layers 6–10: shard-heavy distribution. Layers 11–15: crystal-heavy distribution. Layers 16–20: geode and essence drops become common. This mineral quality gradient is the primary economic incentive for deep diving and must be felt clearly by the player.

---

### DD-V2-084
**Area**: Streaks — Design Philosophy
**Date**: 2026-03-03

**Context**: The streak system could reward either session intensity (many dives in one sitting) or daily consistency (one dive per day over many days). These produce very different player behaviors.

**Decision**: The streak system rewards daily consistency above session intensity. A player who completes one dive per day for 30 days is more valuable to the game's retention goals — and to their own learning outcomes — than a player who completes 10 dives in a single day. Streak system design, rewards, and messaging must all reinforce this philosophy. Binge play should not be disproportionately rewarded over consistent daily engagement.

---

## Batch 2: Learning & Content Decisions (DD-V2-085 — DD-V2-134)

---

### DD-V2-085
**Area**: Content Pipeline — Fact Extraction Process
**Date**: 2026-03-03

**Context**: Curating the first 5,000 facts requires a scalable and editorially sound approach. Automated web crawling risks low-quality content; pure manual authoring does not scale.

**Decision**: Build a "fact extraction prompt" that takes highlighted passages from books or Wikipedia and outputs the full fact JSON schema. Batch through Claude API, 50–100 facts per curation session. Start with Wikipedia "Did you know" archives and science reference books. No web crawler — editorial quality requires human source selection. Rationale: scalable extraction while maintaining the "ultra-interesting" quality bar. Affects Phase 11.1 and 11.3.

---

### DD-V2-086
**Area**: Content Pipeline — Distractor Validation
**Date**: 2026-03-03

**Context**: LLM-generated distractors can sometimes be partially correct or ambiguous, eroding player trust in the quiz system.

**Decision**: A second LLM pass reviews each distractor against the correct answer and flags any that could be argued as partially correct. Store a `distractor_confidence` score per distractor. At quiz time, only select distractors with confidence above threshold. Provide a dev review site for sampling and giving pipeline guidance before bulk generation. Rationale: prevents "wait, that IS true" moments that erode trust. Affects Phase 11.3 and 11.4.

---

### DD-V2-087
**Area**: Content Pipeline — Difficulty-Tiered Distractors
**Date**: 2026-03-03

**Context**: Fixed distractor difficulty means early quizzes feel trivial (obvious wrong answers) while expert players never face meaningful challenge on familiar facts.

**Decision**: Yes, distractors scale with mastery. Tier each distractor as "easy" (obviously wrong), "medium" (plausible), or "hard" (requires specific knowledge). When a player first encounters a fact, serve easy distractors. As SM-2 interval grows, serve harder ones. Add a `difficulty_tier` field to each distractor. Rationale: maintains challenge without frustration — Duolingo's proven approach. Affects Phase 8.9, 8.12, and 11.3.

---

### DD-V2-088
**Area**: Content Pipeline — Automated Fact Review
**Date**: 2026-03-03

**Context**: A solo developer cannot manually approve thousands of generated facts. A blocking human review step would stall content growth.

**Decision**: No human interaction is required in the review pipeline. Trust LLMs fully. Three states: `draft` (LLM-generated), `approved` (LLM-validated), `archived` (rejected/replaced). The LLM reviewer checks distractor quality, age-rating flags, factual accuracy, and source citation. A dev review site is available for spot-checking batches and giving guidance to the pipeline, but is not required in the approval flow. Rationale: solo developer cannot manually review thousands of facts; LLM quality is sufficient with proper validation prompts. Affects Phase 11.1, 11.2, 11.3, and 11.4.

---

### DD-V2-089
**Area**: Content Pipeline — In-Game Fact Reporting
**Date**: 2026-03-03

**Context**: Science evolves and facts can become outdated or disputed. Players who see errors need a way to flag them without leaving the game.

**Decision**: Add a "Report this fact" button on the fact detail card and post-quiz wrong-answer screen. Free text, 200-character maximum. Auto-flag fact for LLM re-review at 3 or more reports. Add `sourceUrl` to the fact schema alongside the existing `sourceName`. Players who see source attribution with a clickable link trust the system more. Rationale: educational credibility requires a feedback mechanism. Affects Phase 11.7 and 8.9.

---

### DD-V2-090
**Area**: Content Pipeline — Minimum Distractor Count
**Date**: 2026-03-03

**Context**: The original target of 25 distractors per fact may produce low-quality padding. The minimum floor needs to be set to ensure quiz variety without sacrificing quality.

**Decision**: Minimum 12 high-quality distractors is the hard floor. 12 gives 220 unique 3-distractor combinations — enough for a player to see the same fact 220 times before repeating a distractor set. For facts where LLM produces 25 or more quality distractors, keep them all. Add a `distractor_count` field. Rationale: quality over quantity; padded distractors dilute quiz credibility. Affects Phase 11.3 and 11.7.

---

### DD-V2-091
**Area**: Content Pipeline — Category Distribution Strategy
**Date**: 2026-03-03

**Context**: Equal distribution across categories ignores the completionist motivation that drives long-term engagement and does not account for content richness variation between domains.

**Decision**: Not equal distribution. Minimum 200 facts per top-level category before launch (5,000 total ≈ 700 average). Chase the long tail of obscure subcategories (Mycology, Numismatics, etc.) — these drive completionist behavior. A gap analysis tool identifies subcategories with fewer than 20 facts for batch generation. Rationale: completionists obsess over obscure branches; Knowledge Tree looks compelling with visible growth opportunities. Affects Phase 11.2 and 11.4.

---

### DD-V2-092
**Area**: Content Pipeline — Fact Content Volatility
**Date**: 2026-03-03

**Context**: Some facts (world records, political leaders) become outdated quickly. Publishing these without a maintenance plan creates long-term credibility risk.

**Decision**: Add a `content_volatility` enum: `timeless` (octopus hearts), `slow_change` (world records, population), `current_events` (leaders, policies — avoid entirely for v1). Focus 90% of content on timeless facts. Slow-change facts flagged for annual LLM re-review. Rationale: small schema addition now prevents large credibility problem later. Affects Phase 11.7.

---

### DD-V2-093
**Area**: Content Pipeline — Database Migration Strategy
**Date**: 2026-03-03

**Context**: The current client-side sql.js approach cannot scale to thousands of facts or support live content updates without requiring app store releases.

**Decision**: Three-phase migration. (1) Server becomes source of truth for fact content; client downloads "fact packs" on first launch and periodically syncs. (2) Client caches locally using existing sql.js as cache layer, not source. (3) `build-facts-db.mjs` becomes "seed pack builder" for offline-first new installs. Facts fetched in batches of 50 at a time. Network calls are NEVER required to show a quiz — offline-first is non-negotiable for mobile. Rationale: server as source enables content updates without app store releases. Affects Phase 19.4 and 11.1.

---

### DD-V2-094
**Area**: Content Pipeline — Multimedia Scope
**Date**: 2026-03-03

**Context**: Multimedia (audio, video, interactive diagrams) could enhance fact memorability but dramatically increases pipeline complexity and mobile loading times.

**Decision**: V1 is text and pixel art only. The one exception deferred to later: language learning pronunciation audio (TTS-generated via ElevenLabs or Azure TTS) for Phase 24. No video, no interactive diagrams. Pixel art with greyscale-to-color mastery progression is thematically cohesive and sufficient. Rationale: multimedia dramatically increases pipeline complexity, storage costs, and loading times. Affects Phase 11.6 and 24.2.

---

### DD-V2-095
**Area**: SM-2 — Study Session Button Count
**Date**: 2026-03-03

**Context**: Binary correct/wrong feedback in study sessions loses granularity that improves SM-2 scheduling accuracy. Anki uses four buttons; more than three may overwhelm mobile players.

**Decision**: Three buttons in study sessions: "Easy" (quality=5, pushes interval out faster), "Got it" (quality=4, standard progression), "Didn't get it" (quality=1, resets). In-mine quizzes stay binary (correct/wrong). Three options is the sweet spot — less overwhelming than Anki's four buttons. Rationale: small UI change with large impact on scheduling accuracy. Affects Phase 6.2 (StudySession.svelte) and sm2.ts.

---

### DD-V2-096
**Area**: SM-2 — Second Interval Length
**Date**: 2026-03-03

**Context**: The standard SM-2 second interval of 6 days may be too aggressive for mobile game players who review less rigorously than dedicated Anki users.

**Decision**: Change the second interval from 6 days to 3 days. After only 2 correct reviews, memory consolidation is fragile. The 3-day interval gives one more early reinforcement before exponential growth kicks in. After the 3rd correct review (repetitions=3), standard `interval * easeFactor` takes over. This is a well-known SM-2 modification used by Mnemosyne. Rationale: mobile game players are less disciplined than Anki users. Affects sm2.ts line 44.

---

### DD-V2-097
**Area**: SM-2 — Consistency Penalty Context
**Date**: 2026-03-03

**Context**: The consistency penalty (O2 loss for answering correctly in study but wrong in-mine) is unfair when applied to facts the player has only ever seen as pop quizzes with no calm study baseline.

**Decision**: Consistency penalty ONLY applies to facts where the player has studied calmly (study session or ritual) AND has `repetitions >= 2`. Add a `lastReviewContext: 'study' | 'mine' | 'ritual'` field to ReviewState. If a fact was only ever seen as a pop quiz, no consistency penalty applies — there was never a calm baseline to be "inconsistent" with. Rationale: penalizing first-time pop quiz failures is unfair and discouraging. Affects QuizManager.ts and types.ts (ReviewState).

---

### DD-V2-098
**Area**: SM-2 — Mastery Visual Progression
**Date**: 2026-03-03

**Context**: General facts and vocabulary words have different memory consolidation timelines. A unified visual system needs to accommodate both while remaining easy to read on the Knowledge Tree.

**Decision**: Two mastery profiles. General facts: new (0), learning (1–3d), familiar (4–14d), known (15–60d), mastered (60d+). Language vocab: new (0), learning (1–2d), familiar (3–7d), known (8–30d), mastered (30d+). Mastery color progression for ALL facts: greyscale → orange/reddish (autumn) → green. No different shapes between fact types — just the universal color ramp. Rationale: vocabulary mastery means instant recall; fact mastery means long-term retention; unified color ramp keeps the tree visually clean. Affects sm2.ts and KnowledgeTree.svelte.

---

### DD-V2-099
**Area**: SM-2 — Quiz Timer Policy
**Date**: 2026-03-03

**Context**: If oxygen drains during quiz overlays, players tap the first plausible answer instead of reading carefully, defeating the educational purpose of the game.

**Decision**: PAUSE oxygen drain during all quiz overlays. Non-negotiable. Exception: deep quiz gates could have a generous visible timer (60 seconds) as a Phase 17 addictiveness-pass decision, not the default. Rationale: this is a learning game, not a speed test; no time pressure on quizzes. Affects OxygenSystem, MineScene, and QuizManager.

---

### DD-V2-100
**Area**: SM-2 — Teaching Moments for New Facts
**Date**: 2026-03-03

**Context**: Encountering a brand-new fact as a graded quiz question causes "how was I supposed to know that?" frustration that discourages exploration.

**Decision**: Separate "quiz" from "teach." When a player encounters a never-before-seen fact as a pop quiz, it becomes a "teaching moment": show the question, let them answer or guess, then ALWAYS reveal the full fact card with wow factor, explanation, and GAIA comment regardless of result. First exposure is NOT graded by SM-2 — the fact enters the review system only after this teaching moment. Quiz gates ONLY use facts the player has seen at least once. Rationale: prevents "how was I supposed to know that?" frustration. Affects Phase 8.9, quizService.ts, and QuizOverlay.svelte.

---

### DD-V2-101
**Area**: SM-2 — Adaptive Quiz Rate
**Date**: 2026-03-03

**Context**: A fixed pop quiz rate is either too intrusive for long sessions or too sparse for short ones. Player experience varies dramatically by session length.

**Decision**: Base rate 8% with a 15-block minimum cooldown between quizzes. "Quiz fatigue" reduces rate by 2% after 5 or more quizzes per dive. First quiz triggers after 10 or more blocks mined (doubled from current 5). Fatigue counter resets on layer descent. This creates a rhythm: frequent enough to learn, spaced enough for mining flow. Rationale: fixed rate is either too intrusive for long sessions or too sparse for short ones. Affects Phase 8.9 and balance.ts.

---

### DD-V2-102
**Area**: SM-2 — Review vs Discovery Quiz Categories
**Date**: 2026-03-03

**Context**: Applying oxygen penalties to first-exposure quiz questions makes exploration feel risky and discourages engaging with new facts.

**Decision**: Two quiz categories. "Review quizzes" (testing facts with repetitions ≥ 1) carry O2 penalties because the player SHOULD know them. "Discovery quizzes" (first exposure to new facts) are REWARD-ONLY — correct = bonus dust/oxygen, wrong = no penalty but shows answer with full explanation. Makes new facts exciting, not risky. Rationale: reduces risk aversion around quizzes; learning should feel like opportunity, not punishment. Affects Phase 8.9 and QuizManager.ts.

---

### DD-V2-103
**Area**: SM-2 — Quiz Gate Difficulty Scaling
**Date**: 2026-03-03

**Context**: Quiz gates at every depth with identical difficulty fail to reflect the intellectual depth-mirrors-physical-depth design philosophy.

**Decision**: Layers 1–5 select difficulty 1–2 facts; layers 6–10 from 2–3; layers 11–15 from 3–4; layers 16–20 from 4–5. Additionally select harder distractors from the tiered pool at deeper layers. Always fall back to any due fact if the difficulty range is unavailable — a gate must never be impossible. Rationale: intellectual depth mirrors physical depth. Affects Phase 8.9 and quizService.ts.

---

### DD-V2-104
**Area**: SM-2 — acceptableAnswers Schema Field
**Date**: 2026-03-03

**Context**: Future fill-in-blank quiz formats and vocabulary conjugation variants require a schema field for acceptable answer variations, but the field should be added before it is needed to avoid a migration later.

**Decision**: For current multiple-choice: exact matching is correct, no changes needed. Add an `acceptableAnswers: string[]` field to the fact schema now for future fill-in-blank support. For language vocab, this stores conjugation variants, spelling alternatives, and common translations. When fill-in-blank is implemented (far future), grade against the full array with Levenshtein distance ≤ 2. Rationale: schema-forward decision that costs nothing now. Affects Phase 11.7 and types.ts.

---

### DD-V2-105
**Area**: GAIA — Mood Delivery vs Content
**Date**: 2026-03-03

**Context**: GAIA's mood system risks changing the educational substance of explanations rather than just the tone, which could cause players to miss learning content when in certain moods.

**Decision**: Mood affects DELIVERY but not CONTENT. All moods show explanation, mnemonic, correct answer. What changes is GAIA's framing. Generate 3 `gaiaWrongComment` variants per fact (one per mood): snarky ("Seriously? Here's why..."), enthusiastic ("Tricky one! Let me help..."), calm ("No worries. Key detail..."). Rationale: relatively cheap generation step that dramatically improves companion feel. Affects Phase 11.3 and 15.1.

---

### DD-V2-106
**Area**: GAIA — Struggling Detection and Mnemonics
**Date**: 2026-03-03

**Context**: The mnemonic field exists in the schema but there is no defined trigger for when mnemonics surface or what "struggling" means quantitatively.

**Decision**: "Struggling" = getting the same fact wrong 2 or more times within a 7-day window, OR a ReviewState where `repetitions` resets from 3 or more back to 0. When struggling is detected: show mnemonic prominently on the fact card and quiz wrong-answer screen. Pre-populate the `mnemonic` field for ALL facts in the LLM pipeline. GAIA says "I noticed you keep missing this one. Try this trick..." Rationale: Duolingo's "encouragement after failure" pattern has strong retention data. Affects Phase 11.3 and QuizOverlay.svelte.

---

### DD-V2-107
**Area**: GAIA — Study Suggestions
**Date**: 2026-03-03

**Context**: SM-2 scheduling is invisible to players by design (DD-V2-130), but GAIA can personalize the scheduling experience by surfacing upcoming reviews and opportunities in natural language.

**Decision**: Yes, GAIA suggests specific facts to study. Three signals: (1) facts approaching due date ("Your octopus fact is due tomorrow"), (2) facts close to mastery threshold ("Two more reviews and Neptune is mastered!"), (3) new facts in interest area ("I decoded a Biology artifact — want to learn about tardigrades?"). Show as clickable thought bubbles in dome. Rationale: makes SM-2 scheduling feel personal rather than algorithmic. Affects Phase 15.2 and 15.4.

---

### DD-V2-108
**Area**: GAIA — First Mastery Celebration
**Date**: 2026-03-03

**Context**: The first fact mastery is the core emotional payoff of the entire game. Under-celebrating it is a critical design mistake.

**Decision**: One of the BIGGEST moments in the game. (1) Full-screen celebration animation rivaling Legendary artifact reveal. (2) GAIA delivers a unique congratulatory message referencing the specific fact ("You have permanently learned that octopuses have three hearts. That knowledge is YOURS now."). (3) Knowledge Tree leaf turns golden with visible animation. (4) First mastery ever gets extra treatment: achievement unlock, unique GAIA monologue, possible reward. Rationale: this is the core emotional payoff of the entire game; under-celebrating is a critical design mistake. Affects Phase 17.1 and 13.5.

---

### DD-V2-109
**Area**: GAIA — Chattiness vs Educational Content
**Date**: 2026-03-03

**Context**: Players who find GAIA chatty may reduce chattiness via the settings slider, but this must never suppress learning content such as explanations and mnemonics.

**Decision**: NEVER reduce educational content via the chattiness setting. Chattiness only affects: idle quips, pet commentary, joke frequency, ambient observations, and post-dive banter. Wrong-answer explanations, mnemonics, mastery celebrations, and learning tips are ALWAYS shown at full detail. Add an optional separate "show explanations" toggle in settings, defaulting to ON. Rationale: a player who finds GAIA chatty is annoyed by flavor text, not learning content. Affects settings.ts and GaiaToast behavior.

---

### DD-V2-110
**Area**: GAIA — Journey Memory Implementation
**Date**: 2026-03-03

**Context**: GAIA referencing past learning milestones creates a powerful sense of shared history, but runtime LLM calls introduce latency, cost, and unpredictability.

**Decision**: Scripted templates with variable interpolation for v1. Approximately 50 templates per trigger type (milestone, category mention, streak reference, etc.). Variables such as factStatement, category, and count are drawn from player save data. Example: "Remember when you learned that {factStatement}? Your {category} branch only had {countAtTime} leaves then!" LLM generation at runtime is overkill for v1 — revisit when analytics show which templates players engage with most. Rationale: cheaper, faster, more predictable than runtime LLM with no latency or cost. Affects Phase 15.4.

---

### DD-V2-111
**Area**: GAIA — Factual Authority
**Date**: 2026-03-03

**Context**: Having GAIA occasionally give wrong answers to create "productive uncertainty" teaching moments is a classroom technique, but may backfire in an automated system where the player cannot ask follow-up questions.

**Decision**: NO. GAIA is the authority figure and must never be wrong about facts. If GAIA is sometimes wrong, players distrust ALL information including explanations and mnemonics. Instead: express genuine curiosity ("I KNEW octopuses had multiple hearts, but the exact number always gets me excited. Three!"). Rationale: trust is the foundation of educational credibility. Affects gaiaDialogue.ts and Phase 15.

---

### DD-V2-112
**Area**: GAIA — Failure Escalation Response
**Date**: 2026-03-03

**Context**: Repeating the same explanation five times after repeated wrong answers provides zero additional value and wastes the teaching opportunity.

**Decision**: Three-tier failure escalation. (1) Wrong 1–2 times: show explanation and mnemonic. (2) Wrong 3–4 times: GAIA offers a different angle ("Let me explain differently...") — generate 2–3 `alternateExplanation` variants per fact in pipeline. (3) Wrong 5 or more times: GAIA suggests "deep study" from Knowledge Tree — expanded card with full wow factor, pixel art, related facts, and source link. Flag "chronically missed" facts in analytics for editorial revision. Rationale: same explanation repeated 5 times provides zero additional value. Affects Phase 11.3 and QuizOverlay.svelte.

---

### DD-V2-113
**Area**: GAIA — Study Session Teaching Mode
**Date**: 2026-03-03

**Context**: GAIA's mood-based personality system needs a defined behavior for study sessions where pedagogical support is more important than entertainment.

**Decision**: The `study` context for GAIA dialogue is always warm, encouraging, and pedagogically focused — regardless of mood setting. "Study GAIA" says: "Take your time with this one," "You're building strong connections," "That's 7 in a row!" Mood still inflects tone (snarky study GAIA is dryly encouraging, enthusiastic is effusive) but content switches to educational/supportive. Rationale: a good teacher changes demeanor for the classroom. Affects gaiaDialogue.ts and StudySession.svelte.

---

### DD-V2-114
**Area**: GAIA — Rotating Fact Comments
**Date**: 2026-03-03

**Context**: A single `gaiaComment` per fact means GAIA says exactly the same thing every time the player reviews a well-known fact, making the comment feel like noise after the first encounter.

**Decision**: Generate 3–5 `gaiaComments` per fact (stored as array, not string). First comment is a dramatic "ingestion" comment for artifact reveal. The rest are shorter "review" comments with variety. Example for a lightning fact: ingestion: "Five times hotter than the Sun!" / review 1: "Still hot." / review 2: "Your lightning knowledge sparks joy." / review 3: "You know this one cold. Or should I say... hot." Approximately 4x more tokens per fact in the pipeline but every review feels slightly fresh and prevents comment-as-noise. Rationale: prevents gaiaComment becoming invisible after first review. Affects Phase 11.3 and types.ts (gaiaComment → gaiaComments[]).

---

### DD-V2-115
**Area**: Knowledge Tree — Rendering Architecture
**Date**: 2026-03-03

**Context**: A force-directed graph layout (typical "Obsidian feel" approach) creates severe UX problems on mobile: node overlap, slow physics rendering, and fat-finger interaction.

**Decision**: Hierarchical RADIAL TREE with trunk at center, branches radiating outward, and tap-to-zoom-into-branch. NOT force-directed graph. Custom SVG/Canvas renderer — no graph library (100KB+ bloat for unused features). Pre-compute layout positions and render only visible nodes for 5,000-plus fact performance. Rationale: "Obsidian feel" comes from zoom transitions and connection lines, not physics simulation. Affects Phase 13.2 — replaces "force-directed or hierarchical graph" with "hierarchical radial tree."

---

### DD-V2-116
**Area**: Knowledge Tree — Level of Detail Rendering
**Date**: 2026-03-03

**Context**: Displaying 10,000 or more leaf nodes simultaneously is not feasible on mobile. A zoom-based level of detail system is required.

**Decision**: Three-level LOD rendering. Full zoom-out: only main branches and sub-branches as thick colored lines with completion percentage labels — no leaf nodes. Tap branch: see sub-branches with percentages. Tap sub-branch: see individual leaf nodes. Three zoom levels (forest / branch / leaf). Player sees overall progress at a glance and drills into specifics on demand. Google Maps metaphor: continent → country → city → street. Rationale: 10,000 leaf nodes cannot be displayed simultaneously. Affects Phase 13.1 and 13.2.

---

### DD-V2-117
**Area**: Knowledge Tree — Unknown Fact Display
**Date**: 2026-03-03

**Context**: Showing every unlearned fact as a grey silhouette node on the tree is demoralizing at low completion and visually overwhelming.

**Decision**: Show unknown facts at BRANCH level only: "Biology: 34 learned / 312 total" on the branch label. Do NOT show individual unlearned facts as separate nodes. Exception: within subcategories at 80% or more completion, show individual missing facts as silhouettes to drive completionist behavior. Rationale: Duolingo approach — show next few unlockable lessons, not the entire course. Affects Phase 13.3.

---

### DD-V2-118
**Area**: Knowledge Tree — Behavioral Inference Weight Cap
**Date**: 2026-03-03

**Context**: Behavioral interest inference based on player actions (keeping vs selling artifacts, study choices) risks creating filter bubbles or penalizing economic decisions that are not preference signals.

**Decision**: Explicit settings weight = 1.0 (constant), behavioral inference maximum = 0.3. Behavioral signals ONLY increase category weights, never decrease below explicit baseline. Track only positive signals (voluntarily studied, kept instead of sold, high mastery speed). Ignore negative signals (selling = economic decision, not preference). Show a "GAIA thinks you like..." panel with adjustable sliders for transparency. Rationale: prevents reinforcing cycles from economic decisions. Affects Phase 12.3.

---

### DD-V2-119
**Area**: Knowledge Tree — Tiered Mastery Celebrations
**Date**: 2026-03-03

**Context**: Celebrating every mastery equally causes fatigue; celebrating too infrequently loses emotional impact. A graduated system is needed.

**Decision**: Mastery #1 = full-screen event (see DD-V2-108). #2–9 = GAIA comment plus leaf glow plus small dust bonus. #10 = mini-celebration (GAIA speech, banner, branch glow). Multiples of 25 = medium celebration. #100 = major event (unique GAIA monologue, cosmetic unlock, Knowledge Tree visual evolution). Category milestones (50% branch, 100% sub-branch) get their own celebrations. Rationale: celebrate frequently at first (every mastery), taper to milestones to prevent fatigue. Affects Phase 17.1.

---

### DD-V2-120
**Area**: Knowledge Tree — Interest-Biased Biome Selection
**Date**: 2026-03-03

**Context**: Player category interests could subtly shape the mine environment to feel more personally meaningful without requiring player-visible configuration.

**Decision**: Yes, subtly. Weight biome selection so interest-aligned biomes appear approximately 30% more frequently (Geology→Crystal Caverns, History→Ancient Ruins). Never eliminate other biomes. Biome does NOT restrict which facts appear — all categories in any biome. Not configurable — invisible delight, not a setting. Rationale: creates serendipitous discovery while gently favoring interests. Affects Phase 12.2 and 9.1.

---

### DD-V2-121
**Area**: Knowledge Tree — Cross-Fact Connections
**Date**: 2026-03-03

**Context**: The `related_facts` field exists in the schema but there is no defined system for how or when cross-fact connections are surfaced to the player.

**Decision**: Surface related facts at three moments. (1) When learning a new fact that connects to a mastered fact, GAIA says "This connects to what you learned about [previousFact]!" with a connection explanation. (2) In the Knowledge Tree, draw faint connection lines between related fact nodes when zoomed into a branch. (3) On the fact detail card, show a "Related" section with links to connected facts. LLM populates `related_facts` in pipeline — start within subcategories, expand cross-category. Rationale: cross-references make knowledge feel interconnected, not siloed. Affects Phase 11.3, 13.2, and 13.4.

---

### DD-V2-122
**Area**: Knowledge Tree — Focus Study Mode
**Date**: 2026-03-03

**Context**: Players with specific study goals (exam prep, completing a subcategory) need the ability to practice facts from a single branch without the default interleaved mix.

**Decision**: Add a "Focus Study" button on each Knowledge Tree branch. Starts a study session using ONLY facts from that branch (due facts first, then new facts from the branch). Keep regular "Study All" as the default; Focus Study is an additional option. Drives Knowledge Tree engagement: players tap into a branch, see gaps, and impulsively hit Focus Study. Rationale: students with specific study goals need blocked practice. Affects Phase 13.4 and StudySession.svelte.

---

### DD-V2-123
**Area**: Knowledge Tree — Category Completion Celebration
**Date**: 2026-03-03

**Context**: Completing every fact in an entire category is a remarkable achievement that requires an equally remarkable acknowledgment.

**Decision**: Four responses to category completion. (1) Major celebration — GAIA delivers a unique "you mastered everything about [subcategory]" speech. (2) Permanent category badge on player profile and Knowledge Tree. (3) Unlock "challenge mode" for that category (harder distractors, shorter windows, combo scoring). (4) "More content coming" message and prioritize category in pipeline gap analysis. Rationale: remarkable achievement must be acknowledged emphatically. Affects Phase 17.1 and 13.5.

---

### DD-V2-124
**Area**: Dome — Physical Knowledge Tree Growth Stages
**Date**: 2026-03-03

**Context**: The dome tree should serve as a physical manifestation of the player's learning journey, with distinct visual stages that reward long-term engagement.

**Decision**: 8–10 visual stages based on total mastered facts: sapling (0–10), seedling (11–50), young tree (51–150), growing tree (151–400), mature tree (401–1000), great tree (1001–2500), ancient tree (2501–5000), world tree (5001+). Each stage is a distinct pixel art sprite generated via ComfyUI as a progression series. The tree is the FIRST thing the player sees in the dome — a physical manifestation of their learning journey. Rationale: one of the strongest retention hooks in the entire game. Affects Phase 10.6.

---

### DD-V2-125
**Area**: Study Design — Customizable Ritual Windows
**Date**: 2026-03-03

**Context**: The default morning/evening ritual windows do not accommodate shift workers, students with irregular schedules, or players in different time zones.

**Decision**: Let the player customize two 4-hour ritual windows in settings. Default 7–11 AM and 7–11 PM. Label "Ritual 1" and "Ritual 2" (not "Morning/Evening"). Add a "Remind me" toggle per ritual triggering a local notification 15 minutes before the window opens. The habit of consistent review times matters more than the specific times. Rationale: shift workers, students, and different timezones need flexibility. Affects settings.ts and balance.ts.

---

### DD-V2-126
**Area**: Study Design — Session Length Options
**Date**: 2026-03-03

**Context**: The current 5/10/All options do not include an intermediate time-bounded choice suited to the 15-minute optimal mobile study window.

**Decision**: Add a "15 minutes" option alongside 5/10/All due. Show a pause prompt every 15 cards: "Take a breather? Your brain consolidates better with short breaks." Session-end stats: "You reviewed 12 facts in 8 minutes. 10 correct, 2 to review again tomorrow." Never show 30 or more cards without a break prompt. Rationale: 15–20 minutes is the optimal study length for mobile learners (Duolingo data). Affects StudySession.svelte.

---

### DD-V2-127
**Area**: Study Design — Interleaving Default
**Date**: 2026-03-03

**Context**: Educational research strongly supports interleaved study for long-term retention, but players cramming for exams need blocked single-category practice.

**Decision**: Default to interleaved study (mixed categories) for superior long-term retention. Offer Focus Study (DD-V2-122) as an explicit option for blocked practice. Include a brief note on interleaved mode: "Mixing categories helps your brain build stronger connections." Never force interleaving — players cramming for exams need blocked practice. Rationale: educational research strongly supports interleaving for long-term retention. Affects StudySession.svelte and quizService.ts.

---

### DD-V2-128
**Area**: Study Design — Vocabulary SM-2 Tracks
**Date**: 2026-03-03

**Context**: Vocabulary acquisition requires multiple types of recall (recognition, production, usage) that cannot all be served by a single SM-2 track per word.

**Decision**: Three SM-2 tracks per vocabulary word: recognition (seeing word → knowing meaning), recall (seeing meaning → producing word), usage (completing sentence with correct word). Each track has its own ReviewState. V1 = recognition only (current system). Phase 24 v2 = add recall track. V3 = add usage track. Each track uses slightly tighter intervals than general facts (per DD-V2-098). Expand with N5 (beginner) and N4 (elementary) before N2/N1. Rationale: triples review volume per word but produces dramatically better outcomes. Affects Phase 24.1, types.ts, and sm2.ts.

---

### DD-V2-129
**Area**: Study Design — Already Known Initialization
**Date**: 2026-03-03

**Context**: Players may already know some facts before playing. Letting them skip facts entirely would bypass SM-2 entirely; making them re-learn everything is frustrating.

**Decision**: Initialize "already known" facts at `repetitions = 2, interval = 7, easeFactor = 2.5`. This places the fact at "familiar" level immediately but requires proof within 7 days. Correct at day 7 → interval jumps to approximately 17 days. Wrong → resets to interval 1, GAIA says "Hmm, maybe you didn't know this one as well as you thought?" Three consecutive correct reviews = claim sticks. Rationale: satisfying "prove it" mechanic without being punitive. Affects sm2.ts and FactReveal.svelte.

---

### DD-V2-130
**Area**: Study Design — Spaced Repetition Transparency
**Date**: 2026-03-03

**Context**: The spaced repetition algorithm is invisible to players. Explaining the concept builds metacognitive understanding and trust without requiring mathematical detail.

**Decision**: Hide the math, teach the concept. At the first spaced review, GAIA explains: "It's been 3 days since you saw this. Your brain strengthens memories by recalling at increasing intervals — this is how top students study." One explanation, once. Occasional reinforcement: "This fact hasn't been reviewed in 14 days. Longer gaps between successes = stronger memory." Surface the concept, not the formula. Keep interval numbers hidden. Rationale: metacognitive scaffolding — teaching HOW to learn while they experience it. Affects gaiaDialogue.ts.

---

### DD-V2-131
**Area**: Study Design — Consistency Penalty Recalibration
**Date**: 2026-03-03

**Context**: The original consistency penalty of 8 O2 triggers at repetitions ≥ 2, which fires too early in the learning curve when forgetting under pressure is entirely expected.

**Decision**: Reduce to 5 O2 (from 8). ONLY trigger when `repetitions >= 4` (roughly 2 or more weeks of spaced review, placing the fact in the "familiar" mastery range). At repetitions 2–3, forgetting under pressure is EXPECTED, not a sign of knowledge inflation. Frame as GAIA observation, not punishment: "Hmm, you knew this one at home but not down here. Let's strengthen that memory." Rationale: original threshold (reps ≥ 2) is too aggressive — weak memory is expected after only 2 correct reviews. Affects balance.ts and QuizManager.ts.

---

### DD-V2-132
**Area**: Study Design — Language Mode Architecture
**Date**: 2026-03-03

**Context**: A separate "Language Mode" would require a parallel codebase and create friction when players want to switch between fact and vocabulary learning.

**Decision**: Language Mode = the Category Lock feature (Phase 12.4) applied to language categories. NOT a separate game mode. Switching = toggling the category lock in settings — instant, lossless. All progress is preserved on the same underlying Knowledge Tree (filtered to show language branches when locked). GAIA adapts commentary to active categories. Mining, economy, biomes, and companions use identical mechanics. Only WHICH facts appear in artifacts, quizzes, and study changes. Supports seamless mid-game switching in either direction. Rationale: architecturally clean, reuses existing Category Lock system, zero switching friction, no parallel codebase. Affects Phase 12.4 and 24.1.

---

### DD-V2-133
**Area**: Study Design — Review Forecast Indicator
**Date**: 2026-03-03

**Context**: Players have no visibility into upcoming SM-2 review load, which makes it impossible to plan study sessions or understand why reviews feel dense on some days.

**Decision**: Add a simple "upcoming reviews" indicator on the dome screen. Calendar icon showing: "Today: 8 due / Tomorrow: 12 / This week: 43." GAIA references it: "You have 12 facts coming due tomorrow — want to knock out a few early?" Do NOT show a full Anki-style forecast graph — too data-heavy for mobile. Just today/tomorrow/this-week numbers. Rationale: creates daily "clear my queue" motivation with small UI and disproportionate engagement impact. Affects DomeView.svelte and saveService.ts.

---

### DD-V2-134
**Area**: Study Design — Learning Effectiveness Metrics
**Date**: 2026-03-03

**Context**: Without defined success metrics for the SM-2 learning system, it is impossible to know whether the educational design is working or whether parameter changes improve outcomes.

**Decision**: Track five metrics. (1) Retention rate: percentage of mastered facts (60d+ interval) still answered correctly when tested — target 90% or higher. (2) Lapse rate: percentage of reviews resulting in a reset — target under 15%. (3) Daily active study rate: percentage of DAU completing at least one review — target 40% or higher. (4) Facts per player: median total facts in review per active player — benchmark approximately 500. (5) Time to mastery: median days from first exposure to mastered — if over 90 days then intervals are too wide; if under 30 then threshold is too easy. These five metrics ARE the learning system's health dashboard. Rationale: these metrics make the learning system's health measurable and actionable. Affects Phase 21.3.

---

## Batch 3: Retention & Growth Decisions (DD-V2-135 — DD-V2-181)

---

### DD-V2-135
**Area**: Session Design — Dual Session Profiles
**Date**: 2026-03-03

**Context**: The game has no explicit session length targeting. Dives can range from a few minutes to extended play. Mobile games that retain well have both quick and deep session profiles.

**Decision**: Design for two distinct session profiles. "Quick dive" = 5–7 minutes (1–3 layers, review a few facts, tend dome). "Deep expedition" = 15–25 minutes (push 10+ layers, extended study session). Oxygen tank count naturally controls session length: 1 tank = quick dive, 2 tanks = medium, 3 tanks = deep expedition. Track median session length in analytics from day one — if it drifts above 25 minutes, casual players may feel the game demands too much. Affects Phase 18 and analytics instrumentation.

---

### DD-V2-136
**Area**: Session Design — Mid-Dive Auto-Save
**Date**: 2026-03-03

**Context**: Force-quitting mid-layer currently loses all layer progress. Lost progress is the #1 cause of permanent churn in roguelites.

**Decision**: Auto-save exact mine state on force-quit or app backgrounding. Players resume where they left off. Layer transitions (per DD-V2-021) are the natural checkpoint. Add a "Continue Diving?" summary screen every 5 layers showing loot collected, facts found, and oxygen remaining. This prevents mid-dive abandonment without adding artificial stopping mechanics. Affects Phase 8.5 and MineScene state serialization.

---

### DD-V2-137
**Area**: Session Design — Informational Engagement Hooks
**Date**: 2026-03-03

**Context**: "One more dive" hooks must drive engagement without becoming coercive. The game's educational mission requires ethical engagement patterns.

**Decision**: Post-dive hooks are strictly informational: "3 more facts to unlock Trilobite revival," "Your Biology branch is at 48%," "Unfinished Data Disc: Solar System (7/12 facts)." These appeal to completionist motivation without creating artificial urgency. GAIA says encouraging things on exit, NEVER guilt-trips. Direct contrast to Duolingo's streak guilt model. Aligns with DD-V2-084 (celebrate consistency, never weaponize). Affects Phase 18 and gaiaDialogue.ts.

---

### DD-V2-138
**Area**: Economy — Oxygen Real-Time Regeneration
**Date**: 2026-03-03

**Context**: The design doc mentions "oxygen refills over time" but no specific regeneration system exists. This is the single most important monetization decision in the game.

**Decision**: 1 oxygen tank regenerates every 90 minutes, with a maximum bank of 3 tanks. Quick dive costs 1 tank, medium dive costs 2, deep expedition costs 3. This gives casual players 3–4 sessions per day for free. The mastery path must be genuinely viable — quiz gate milestones (per DD-V2-026) grant bonus tanks, and top players who ace quizzes can earn net-positive oxygen to play indefinitely. Target: 10% of engaged players play entirely free through skill. This is the core monetization lever and the game's competitive differentiator. Affects Phase 21.1, balance.ts, and OxygenSystem.

---

### DD-V2-139
**Area**: Daily Loop — Consolidated Briefing Screen
**Date**: 2026-03-03

**Context**: Daily activities (review ritual, deals, farm, streak) are scattered across dome rooms. Hunting across rooms creates friction that reduces daily engagement completion rates.

**Decision**: Consolidate all daily activities into a single "Daily Briefing" screen that GAIA presents on first login each day: (1) streak status, (2) review ritual with bonus (5–8 facts, under 2 minutes, per DD-V2-125), (3) today's deals, (4) farm harvest summary, (5) one-tap dive button. The review ritual bonus of 25 dust is meaningful (≈1/4 of a cheap craft) but not so large that skipping feels punishing. Extends DD-V2-125 (customizable ritual windows). Affects Phase 18 and DomeView.svelte.

---

### DD-V2-140
**Area**: Daily Loop — Weekly Challenges
**Date**: 2026-03-03

**Context**: Phase 17.4 mentions weekly challenges but no design details exist. Weekly challenges are the single most effective mid-term retention mechanic in mobile gaming.

**Decision**: Three concurrent weekly challenges: one mining-focused (e.g., reach layer 12), one learning-focused (e.g., master 5 new facts), one collecting-focused (e.g., find 3 fossils). Completing all 3 awards a "Weekly Expedition" bonus chest with a guaranteed rare+ artifact. Challenges reset on Monday to give weekend players a fresh start. This creates a 7-day engagement arc that daily rituals alone cannot sustain. One challenge per player archetype ensures all playstyles engage. Affects Phase 17.5 and 23.2.

---

### DD-V2-141
**Area**: Session Design — Cozy Dome Sessions
**Date**: 2026-03-03

**Context**: Some days players open the app but do not want to dive. The dome has extensive non-dive systems (farm, study, crafting, fossils, cosmetics, Knowledge Tree, GAIA) but no designed "zero-dive" flow.

**Decision**: Design a "cozy session" flow: farm collection → 5-card study session → Knowledge Tree browsing → GAIA chat. This should feel like a complete, satisfying 3-minute visit. Track zero-dive session percentage as a health metric: below 10% means the dome needs more pull, above 40% means dive motivation needs work. The dome must be a place players want to visit, not just a lobby between dives. Affects Phase 10 and 18.

---

### DD-V2-142
**Area**: Session Design — Gentle Review Pressure
**Date**: 2026-03-03

**Context**: SM-2 schedules reviews at optimal intervals. Knowledge Tree leaves wilt when overdue. The question is how aggressively to surface due dates.

**Decision**: Show a gentle count ("12 facts ready for review") but never show countdown timers or red urgency indicators. Wilting Knowledge Tree leaves (already designed) are the perfect subtle nudge. GAIA frames overdue facts as exciting opportunities ("I found some connections between your overdue facts — want to see?") rather than obligations. Research shows guilt-driven review produces worse long-term retention than curiosity-driven review. Confirms DD-V2-098 and DD-V2-130 philosophy. Affects gaiaDialogue.ts and DomeView.svelte.

---

### DD-V2-143
**Area**: Onboarding — 90-Second Hook Moment
**Date**: 2026-03-03

**Context**: DD-V2-040 targets 5 minutes for the tutorial. Industry data shows the critical "hook moment" must happen within 90 seconds of app open or most players never return.

**Decision**: The first artifact reveal with GAIA's snarky comment and the gacha animation MUST happen within 90 seconds of gameplay start. Split the tutorial: 90 seconds to first hook, then progressively unlock remaining systems over dives 2–4 rather than front-loading everything in one session. Measure tutorial step completion granularly — industry benchmark is 60–70% completion. If below 50%, the tutorial is too long or confusing. Extends DD-V2-040. Affects Phase 14 tutorial design.

---

### DD-V2-144
**Area**: Daily Loop — Login Reward Calendar
**Date**: 2026-03-03

**Context**: The game has review rituals, daily deals, and streak tracking but no explicit login reward calendar. These are separate from review rituals.

**Decision**: Add a 7-day rotating login reward calendar with escalating value: Day 1 = 50 dust, Day 2 = 1 bomb, Day 3 = 100 dust, Day 4 = streak freeze, Day 5 = 1 shard, Day 6 = random Data Disc, Day 7 = guaranteed uncommon+ artifact. Day 7 must be desirable enough to drive weekly completion. Resets to Day 1 after completing Day 7, NOT on missed days — punishing breaks loses players, rewarding consistency keeps them. Aligns with DD-V2-084. Affects Phase 17.5 and DomeView.svelte.

---

### DD-V2-145
**Area**: Monetization — Hybrid Model
**Date**: 2026-03-03

**Context**: Phase 21 mentions Terra Pass subscription and IAP but no detailed pricing or philosophy. The monetization model must balance revenue with educational trust.

**Decision**: Hybrid monetization: $4.99/month "Terra Pass" subscription (unlimited oxygen + 1 exclusive cosmetic per month) plus à la carte cosmetic purchases ($0.99–$4.99 each). NO premium currency — no gems, no coins, no obfuscated pricing. Direct pricing builds trust with educational game audiences. Parents buying this for kids want transparent pricing. The "skill players play free through mastery" angle is the primary marketing differentiator against every other energy-gated mobile game. Affects Phase 21.1 and 21.2.

---

### DD-V2-146
**Area**: Monetization — Ad-Free Policy
**Date**: 2026-03-03

**Context**: No ad system exists in the design. The educational game market is extremely ad-sensitive — parents and teachers actively avoid recommending games with ads.

**Decision**: Launch completely ad-free. If revenue needs require ads later, they must be strictly opt-in rewarded video: "Watch a 30-second ad for +1 oxygen tank" available only after completing a dive. NEVER interrupt gameplay, NEVER interrupt quizzes, NEVER show banners. Word of mouth from educators is the highest-value growth channel, and ads jeopardize that channel. Affects Phase 21.

---

### DD-V2-147
**Area**: Monetization — Knowledge Never Paywalled
**Date**: 2026-03-03

**Context**: Data Discs are currently described as "can also be purchased in a shop." The design philosophy states "free to play, free to learn — no knowledge is paywalled."

**Decision**: ALL facts are free to find in-game. Selling Data Discs directly contradicts "free to learn" and would generate negative press ("education game paywalls knowledge"). Instead, sell cosmetic Data Disc skins (different visual appearance, same free facts) and "Data Disc Radar" consumables (increased disc drop rates for 3 dives). The educational credibility of "every fact is free" is worth more than Data Disc revenue. This is a philosophical line in the sand. Affects Phase 21 and shop systems.

---

### DD-V2-148
**Area**: Monetization — Cosmetic Pricing Tiers
**Date**: 2026-03-03

**Context**: The game has multiple cosmetic categories (miner skins, pickaxe skins, dome wallpapers, decorations, pet variants, GAIA skins) but no pricing strategy.

**Decision**: Price by interactivity and visibility. Animated pickaxe skins with particle trails: $2.99–$4.99 (highest conversion — players see these constantly during core loop). Pet skins/variants (golden trilobite, crystal cat): $1.99–$3.99. Dome themes that transform the entire aesthetic: $3.99–$4.99. GAIA avatar skins: $1.99. Bundle wallpapers into themes rather than selling individually. Static cosmetics at $0.99–$1.99, animated/interactive at $2.99–$4.99. Affects Phase 21.2.

---

### DD-V2-149
**Area**: Monetization — Season Pass
**Date**: 2026-03-03

**Context**: Phase 23 mentions seasonal events with exclusive rewards. A season pass must work ethically for an educational game targeting all ages.

**Decision**: "Knowledge Expedition" season pass, $4.99 per 8–12 week season. Free track contains ALL educational content and meaningful gameplay rewards. Premium track is cosmetics only: dome themes, pet skins, GAIA outfits, pickaxe effects. The pass NEVER expires — players who buy it complete at their own pace with no FOMO pressure. Progress is earned through learning milestones, not just playtime. Affects Phase 23.1.

---

### DD-V2-150
**Area**: Monetization — Starter Pack
**Date**: 2026-03-03

**Context**: No starter pack exists. Starter packs are the highest-converting IAP in mobile gaming (8–15% of D7 retained players).

**Decision**: $4.99 one-time "Pioneer Pack" available only during the first 7 days after install: 500 dust, 1 guaranteed rare+ artifact, a unique "Pioneer's Pickaxe" cosmetic skin (exclusive to this pack), and 3 bonus oxygen tanks. No gameplay advantages beyond consumable resources — cosmetic exclusivity is the real draw. Creates mild urgency without being predatory. Affects Phase 21.2.

---

### DD-V2-151
**Area**: Economy — Replace Mineral Decay with Positive Sinks
**Date**: 2026-03-03

**Context**: The current mineral decay mechanic (2% dust loss above 500 per dive) will frustrate returning players who took a break. Negative-framed economy mechanics conflict with the game's anti-punishment philosophy.

**Decision**: Replace mineral decay with positive-framed sinks. (1) "Dome maintenance" cost that scales with dome size — larger dome = more upkeep, providing a natural sink. (2) "Spending bonus" thresholds — spending above certain amounts awards extra items or cosmetic badges. (3) Gold-tier cosmetics at enormous costs (50,000 dust) as aspirational sinks for endgame veterans. Remove the 2% decay entirely. Keep 110:1 conversion ratio and 1.25× craft scaling. Monitor wealth distribution — if top 10% hold more than 80% of minerals, sinks are too weak. Supersedes mineral decay mechanic. Affects balance.ts and economy systems.

---

### DD-V2-152
**Area**: Monetization — Mastery-Free Play Segmentation
**Date**: 2026-03-03

**Context**: The mastery path promises skilled players can play indefinitely for free. This will reduce subscription conversion among the most engaged learners.

**Decision**: Mastery-free play cannibalizing subscription revenue is acceptable and strategically correct. Hardcore learners playing free become evangelists and educational proof-of-concept — their word-of-mouth is more valuable than their subscription revenue. Subscriptions convert casual players who want convenience without studying harder. This is healthy segmentation. NEVER weaken the mastery path; it is the competitive moat. Track mastery-free vs subscriber-free at D30. If mastery players exceed 30%, tighten the oxygen curve slightly. Affects Phase 21 and balance tuning.

---

### DD-V2-153
**Area**: Monetization — Patron Tier
**Date**: 2026-03-03

**Context**: No ultra-premium offering exists for players who want to support the educational mission at a higher level.

**Decision**: $24.99 per season "Patron of Knowledge" bundle: exclusive GAIA dialogue set, unique dome floor theme, "Patron" nameplate visible to future visitors/social features, and a real-world donation to a named educational nonprofit. Also offer $49.99 annual "Grand Patron" including all seasonal cosmetics and a physical pixel art sticker pack mailed to the player. Physical rewards drive unusually high conversion in indie games. NEVER sell gameplay advantages at any price tier. Affects Phase 21.2.

---

### DD-V2-154
**Area**: Content Strategy — Minimum Facts Before Subscriptions
**Date**: 2026-03-03

**Context**: At 522 facts, a subscriber playing 2 hours daily could exhaust content within weeks. A subscriber who runs out of new facts in week 2 will churn and leave a 1-star review.

**Decision**: Target 3,000 facts minimum before opening subscriptions. Mitigate the content cliff with: (1) procedural mine generation provides infinite replay variety, (2) fact mastery via SM-2 is inherently long-term (intervals stretch to 60+ days), (3) content drops every 2 weeks (50–100 new facts), (4) seasonal biome rotations, (5) social leaderboards that create infinite competition. Content velocity is existential for subscription retention. Affects Phase 11 and 21 sequencing.

---

### DD-V2-155
**Area**: Analytics — Retention Targets
**Date**: 2026-03-03

**Context**: Phase 21.3 mentions retention analytics but sets no targets. The game straddles education (D1: 40%, D7: 15%, D30: 5%) and casual gaming (D1: 35%, D7: 15%, D30: 7%).

**Decision**: Targets: D1: 45%, D7: 20%, D30: 10%. Optimize for D7 retention above everything else. D1 tells you if the tutorial works (fixable). D30 tells you if endgame works (need users to reach it). D7 answers the fundamental question: "After a week, did the player form a habit?" D7 > 20% = product-market fit. D7 < 12% = no amount of marketing saves you. Every first-6-month decision evaluated through: "does this improve D7?" Affects Phase 21.3 and all retention-related design.

---

### DD-V2-156
**Area**: Retention — Early Churn Mitigation
**Date**: 2026-03-03

**Context**: Highest churn occurs between dives 3–7 — after tutorial excitement fades but before Knowledge Tree and fossils create enough invested progression.

**Decision**: Front-load rewards: first fossil guaranteed by dive 2, first pet revived by dive 4 (reduced knowledge requirement for first species), first dome room unlocked by dive 5 (lower threshold). 0% loot loss on the very first oxygen depletion ever (GAIA rescue as tutorial moment) — the current 30% shock causes rage-quits. Graduated loot loss: first depletion = 0%, next 3 depletions = 15%, then 30% standard. Make Send-Up Stations more prominent in layers 1–3. Track "first depletion churn rate" as a specific metric. Affects Phase 14, 8.5, and balance.ts.

---

### DD-V2-157
**Area**: Retention — Welcome Back Flow
**Date**: 2026-03-03

**Context**: Players returning after 2+ weeks find broken streaks, wilted trees, and capped farm production. Shame-based re-engagement drives permanent churn.

**Decision**: Dedicated "Welcome Back" flow: GAIA greets with personality → shows positives first (farm produced X resources, pet has a gift, Y new facts available) → free "Comeback Chest" with rare artifact and bonus oxygen → THEN gently mention reviews. NEVER lead with broken streak or wilted Knowledge Tree. Extend farm production cap to 7 days for absent players so they return to a meaningful haul. The goal is to remove every friction point for the returning player. Affects Phase 23.4 and gaiaDialogue.ts.

---

### DD-V2-158
**Area**: Retention — Positive Streak Reframing
**Date**: 2026-03-03

**Context**: DD-V2-084 establishes daily consistency over session intensity. The emotional framing of streak loss matters enormously — Duolingo's streak guilt is a meme for anxiety.

**Decision**: Reframe streak breaks entirely. Instead of "you lost your 47-day streak," display "You completed a 47-day expedition — start a new one!" All milestone rewards are permanent achievements that are never reset. Add a "longest streak" personal record that persists forever and is displayed prominently. Keep 200-dust streak freezes (max 3). Celebrate streaks; never weaponize them. Extends DD-V2-084 with specific emotional framing language. Affects Phase 17.5, streak UI, and gaiaDialogue.ts.

---

### DD-V2-159
**Area**: Retention — Push Notification Strategy
**Date**: 2026-03-03

**Context**: Phase 23.4 lists notification types but no frequency or opt-in design exists. Persistent notifications to churned players accelerate uninstalls.

**Decision**: Maximum 1 push notification per day, only if the player has not opened the app. Request notification permission AFTER the player completes their first successful dive and artifact reveal — never during onboarding before they understand the value. Frame as GAIA asking: "Want me to let you know when your tree needs watering or your pet wants to play?" Rotate content between review nudges, streak reminders, and GAIA personality lines. After 7 days of no engagement, STOP all notifications entirely. Affects Phase 23.4 and mobile notification system.

---

### DD-V2-160
**Area**: Retention — Win-Back Strategy
**Date**: 2026-03-03

**Context**: No explicit win-back system exists. In-app features only trigger when the player opens the app, which churned players don't do.

**Decision**: External triggers bring back churned players. (1) Opt-in "GAIA's Letter" monthly email with pixel art and a fun fact. (2) Seasonal event announcements ("The Age of Dinosaurs just started — 50 new paleo facts!"). When a churned player does return: Welcome Back flow (DD-V2-157), free oxygen refill, special easy dive with boosted rewards. Goal: remove every friction point so the returning player is back in the fun loop within 30 seconds. Affects Phase 23.4.

---

### DD-V2-161
**Area**: Retention — Completionist Endgame
**Date**: 2026-03-03

**Context**: Completionists are the most valuable evangelists. At 522 facts, top players could see all content within a month. A dedicated player mastering everything needs a rewarding endgame.

**Decision**: Upon mastering all available facts: (1) "Omniscient" title and exclusive golden dome cosmetic, (2) GAIA personality shift ("You know more than me now, miner. I am genuinely impressed."), (3) access to submit community facts for review, (4) potential "Mentor" mode for future social features. The real answer is content velocity — target 100+ new facts per week post-launch. Add facts faster than completionists master them. At 522 facts, there are roughly 5–10 weeks before the most engaged players hit the wall. Affects Phase 11 content velocity and Phase 23.

---

### DD-V2-162
**Area**: Economy — Graduated Loot Loss
**Date**: 2026-03-03

**Context**: The flat 30% loot loss on oxygen depletion may shock casual or education-focused players, especially on their first experience with the mechanic.

**Decision**: Graduated penalty system: first oxygen depletion ever = 0% loss (GAIA rescue, tutorial teaching moment), next 3 depletions = 15% loss, then 30% becomes the standard. This gives new players a grace period to learn oxygen management. Make Send-Up Stations more prominent in early layers (layers 1–3) — many players won't discover them before their first depletion. Track "first depletion churn rate" specifically as a metric. Affects balance.ts and MineScene oxygen depletion handling.

---

### DD-V2-163
**Area**: Difficulty — Dynamic Engagement Scoring
**Date**: 2026-03-03

**Context**: Fixed difficulty scaling (block hardness, distractor similarity) doesn't adapt to individual player skill levels. Both boredom (too easy) and frustration (too hard) cause churn.

**Decision**: Implement a hidden "engagement score" tracking session frequency, quiz accuracy (rolling 20-question window), and dive depth. If quiz accuracy exceeds 90%, dynamically increase distractor difficulty (per DD-V2-087 tiered distractors). If accuracy drops below 50%, ease off. For mining, if a player consistently reaches layer 15+ easily, introduce harder biome combinations. The "flow state" — where perceived challenge equals perceived skill — maximizes both retention and learning. Extends DD-V2-087. Affects Phase 18 and QuizManager.ts.

---

### DD-V2-164
**Area**: Quiz — Brute-Force Philosophy
**Date**: 2026-03-03

**Context**: A player who deliberately fails quizzes pays heavy oxygen penalties but can technically still progress. This must be addressed as a design philosophy, not just a mechanic.

**Decision**: NEVER hard-gate progress on learning. A player can always brute-force through quiz penalties — the oxygen cost simply makes learning the clearly optimal strategy. Track "quiz skip rate" (percentage of intentional wrong answers, defined as answers given in under 2 seconds). If the rate exceeds 15% of all quiz interactions, investigate: distractor quality may be poor, question phrasing may be confusing, or reward balance may be off. The quiz must feel like a welcome puzzle break, not an interruption. Confirms DD-V2-026 and DD-V2-102. Affects analytics instrumentation.

---

### DD-V2-165
**Area**: Market Position — App Store Category
**Date**: 2026-03-03

**Context**: No app store categorization strategy exists. The game straddles gaming and education.

**Decision**: List in Games (Adventure or Casual subcategory) as primary category, with Education as secondary. The Education category has approximately 50% lower organic install rates than Games. The mining/exploration gameplay is the user acquisition hook; the learning system is the retention hook. Marketing should lead with "mine, explore, discover" and reveal the learning as a delightful surprise. Parents will find the game via "educational game" searches regardless of primary category. Affects Phase 20 app store setup.

---

### DD-V2-166
**Area**: Market Position — ASO Keywords
**Date**: 2026-03-03

**Context**: No App Store Optimization strategy exists. Keywords must bridge gaming and education audiences.

**Decision**: Five priority keywords: (1) "mining game" (high volume, moderate competition), (2) "pixel art adventure" (enthusiast audience, lower competition), (3) "learn while playing" (education-seeking parents), (4) "fossil collecting game" (unique niche, very low competition), (5) "trivia adventure" (bridges quiz and game audiences). App subtitle: "Mine Deep. Learn Everything." Avoid "roguelite" (niche, hardcore connotation on mobile) and "Anki" (too niche, implies tool not game). Affects Phase 20.

---

### DD-V2-167
**Area**: Market Position — Soft Launch Strategy
**Date**: 2026-03-03

**Context**: Phase 20 covers mobile launch but no geographic targeting or phased rollout is designed. Launching globally without data is high-risk.

**Decision**: Soft launch in Philippines, Malaysia, and Colombia (English-speaking, high mobile gaming engagement, representative demographics, low CPI for testing) for 4–6 weeks. Measure D1/D7/D30 retention, tutorial completion, first purchase conversion, and quiz engagement rate. Fix top 3 drop-off points. Then Google Play Early Access with 10,000 user cap for 2–4 weeks to gather store reviews. Full global launch with coordinated press push to education bloggers, indie game outlets, and pixel art communities. Never launch globally without soft launch data. Affects Phase 20.

---

### DD-V2-168
**Area**: Market Position — Competitor Lessons
**Date**: 2026-03-03

**Context**: No competitive analysis exists. The game combines mechanics from multiple genres with no direct competitor.

**Decision**: Study five games and apply specific lessons: (1) Duolingo — adopt the habit loop, drop the guilt and shame. (2) Terraria — the "one more layer" exploration hook, apply to descent shaft design. (3) Prodigy Math — classroom integration post-launch via teacher dashboard. (4) Idle Miner Tycoon — prestige/reset systems, consider completed-biome permanent bonuses. (5) QuizUp — social quiz battle matchmaking for Knowledge Duels. The unique competitive position: NO competitor combines roguelite mining with spaced repetition learning. Affects all phase design.

---

### DD-V2-169
**Area**: Market Position — Educational Partnerships
**Date**: 2026-03-03

**Context**: The game supports focused study, age-appropriate filtering, and offline play — all attractive to educators. But institutional sales are slow.

**Decision**: Post-launch only, and only after consumer retention proves strong. Create a free "Teacher Dashboard" web portal: assign fact categories, see aggregate quiz accuracy, create study groups. Offer a free "Classroom License" with no monetization. Viral loop: student plays at school → continues at home with full game → tells friends → parents download. Do not chase institutional sales before the consumer product retains. Affects post-Phase 22 planning.

---

### DD-V2-170
**Area**: Community — User-Generated Facts
**Date**: 2026-03-03

**Context**: Phase 23.3 mentions community fact submissions. User-generated content is a powerful growth lever but requires quality control at scale.

**Decision**: Optional late-game feature, not a priority for early phases. When implemented: verified users (30+ day streak, 200+ facts mastered) can submit facts via in-app form. Quality pipeline: (1) automated LLM check for accuracy, appropriateness, and duplicate detection, (2) community upvote/downvote from 5 random qualified players, (3) final automated approval if 4/5 approve. Credit the submitter on the fact card. Start with 20 curated community facts per month and scale as quality control proves reliable. Affects Phase 23.3.

---

### DD-V2-171
**Area**: Platform — Web as First-Class Platform
**Date**: 2026-03-03

**Context**: The game is built with Vite + Svelte + Phaser 3, making it inherently web-compatible. The primary target is mobile via Capacitor, but restricting to mobile-only limits reach.

**Decision**: Web is a full first-class platform at terragacha.com, NOT just a demo or teaser. Same account, same progress, hassle-free switching between web and mobile. This provides: zero-friction play for new users, SEO traffic, a content-creator-friendly link (no app store friction), and a classroom-accessible entry point. Some players will prefer web permanently — let them. Monetization may differ between platforms (web subscription vs mobile IAP). The tech stack already supports this natively. Affects Phase 20 and 24.

---

### DD-V2-172
**Area**: Player Psychology — Four Archetypes
**Date**: 2026-03-03

**Context**: The game has parallel progression tracks that appeal to different motivations. Without intentional archetype support, the game risks feeling unfocused.

**Decision**: Map four archetypes to primary engagement surfaces: Learners → Knowledge Tree and study sessions (GAIA celebrates knowledge milestones). Miners → depth records and layer progression (GAIA comments on bravery). Collectors → fossils, cosmetics, Data Discs (GAIA shows excitement about their gallery). Completionists → 100% branch completion and achievement hunting. Weekly challenges (DD-V2-140) always include one quest per archetype. Use early behavioral signals (study-to-mine ratio, collection actions, completion checking) to classify players by D7 and personalize GAIA's emphasis. Affects Phase 12 and 18.

---

### DD-V2-173
**Area**: Quiz Design — Anti-Homework Philosophy
**Date**: 2026-03-03

**Context**: Quizzes trigger during dives, study sessions, and review rituals. They must feel like game mechanics, not school tests.

**Decision**: Three rules to prevent homework feeling: (1) Every quiz must have immediate tangible stakes — correct answers boost artifact rarity, open gates, grant oxygen. Abstract "learning progress" alone is not motivating in the moment. (2) Wrong answers should cost something (oxygen) but NEVER end the run or permanently lock content. (3) After every wrong answer, show the correct answer with GAIA's explanation and mnemonic immediately — the "aha!" moment must follow the mistake. Frame quizzes as "challenges" not "tests." A challenge is something you choose to overcome; a test is something imposed on you. Confirms DD-V2-099, DD-V2-100, DD-V2-102. Affects all quiz UI.

---

### DD-V2-174
**Area**: Ethics — Gacha Guardrails
**Date**: 2026-03-03

**Context**: Artifacts have rarity tiers (Common 60% to Mythic 0.1%) with escalating reveal animations. The game is named "Terra Gacha." Gacha mechanics face regulatory scrutiny in some regions.

**Decision**: Five ethical guardrails: (1) All drop rates are displayed in-game with full transparency. (2) No real money directly buys randomized loot — you buy cosmetics directly or oxygen to play, which may lead to finds (indirect only). (3) Gacha excitement is earned through gameplay, never purchased. (4) Pity system: after 20 artifacts without a rare+, guarantee the next one is rare. (5) No "limited time" pressure on gacha items — no FOMO-driven mechanics. Be prepared for Belgium and Netherlands regulatory scrutiny with the "Terra Gacha" name. Affects Phase 21 and artifact system.

---

### DD-V2-175
**Area**: Content — Kid Content Quality
**Date**: 2026-03-03

**Context**: Facts have `age_rating` (kid/teen/adult) and `sensitivity_level`. Kid mode must not feel like a watered-down version of the real game.

**Decision**: The kid version must have equal "wow!" density as the adult version — just different topics. Kids get the most mind-blowing animal facts, space facts, and nature facts (octopus hearts, tardigrade survival, Jupiter's size). Create a dedicated "Kid Wow Score" during fact curation, rated independently from the adult interest score. Implement parental controls: lock the age setting, set daily play time limits, and surface a "what your child learned today" summary. This feature alone could drive teacher recommendations. Affects Phase 11 curation pipeline and settings.ts.

---

### DD-V2-176
**Area**: Analytics — GAIA's Report (Player-Facing)
**Date**: 2026-03-03

**Context**: DD-V2-134 defines internal learning effectiveness metrics. Players and parents also need visibility into learning progress.

**Decision**: Build a "GAIA's Report" screen in the Archive room showing: facts mastered this week, quiz accuracy by category (radar chart), longest SM-2 interval achieved, and strongest/weakest knowledge areas. Make it beautiful and shareable (screenshot-ready). Three purposes: (1) players see evidence of learning (intrinsic motivation), (2) parents verify educational value (acquisition driver), (3) data creates goal-setting ("Can you get Astronomy above 80%?"). Always positive-framed: never "failing at History," always "History is your next frontier to explore." Extends DD-V2-134. Affects Phase 21.3 and Archive room.

---

### DD-V2-177
**Area**: Platform — Multiple Player Profiles
**Date**: 2026-03-03

**Context**: The save system uses a single PlayerSave object. Families sharing a tablet is extremely common for educational games.

**Decision**: Support up to 4 player profiles per device. Each profile has its own save state, age setting, interest preferences, and Knowledge Tree. Profile switching on the title screen with simple avatar selection. A parent playing at Adult difficulty must not see their 8-year-old's KID mode content. Technically: keyed localStorage or IndexedDB per profile. This single feature could double household penetration — one family member downloads, four end up playing. Affects Phase 19 and saveService.ts.

---

### DD-V2-178
**Area**: Accessibility — Launch vs Post-Launch
**Date**: 2026-03-03

**Context**: No accessibility design exists. The game uses pixel art (small elements), quiz overlays, and touch controls. Accessible games have 15–20% larger addressable markets.

**Decision**: Launch requirements: (1) Colorblind-safe rarity indicators using shapes AND colors, not colors alone (current rarity relies purely on color). (2) Scalable text size. (3) High-contrast mode for quiz text. (4) VoiceOver/TalkBack compatibility for quiz questions and answers. Post-launch additions: (5) Dyslexia-friendly font option (OpenDyslexic). (6) One-handed play mode. (7) Reduced motion option (disable screen shake and particle bursts for photosensitive players). Affects Phase 20 and all UI components.

---

### DD-V2-179
**Area**: Analytics — Learning Effectiveness Publishing
**Date**: 2026-03-03

**Context**: DD-V2-134 tracks internal metrics. Publishing aggregate learning outcomes establishes educational credibility and generates press coverage.

**Decision**: Build an internal Learning Effectiveness Dashboard tracking the five metrics from DD-V2-134. Publish an annual "Terra Gacha Learning Report" with aggregate anonymized data — e.g., "Our players retained 78% of learned facts after 30 days, compared to the typical 20% without spaced repetition." This establishes credibility with educators and parents, generates press coverage, and differentiates from every "educational" game that never proves it works. Extends DD-V2-134. Affects Phase 21.3 and post-launch marketing.

---

### DD-V2-180
**Area**: Social — Referral Mechanic
**Date**: 2026-03-03

**Context**: No referral system exists. Phase 22 covers social features but not referrals.

**Decision**: "Invite a friend, you both receive a fossil egg." The fossil egg is exciting (gacha anticipation), does not break the economy (cosmetic companion), and rewards both parties. First reward triggers on the invitee completing their first dive. Second bonus if the invitee maintains a 7-day streak. Keep referral rewards modest — the goal is organic sharing, not incentive pyramids. Affects Phase 22.

---

### DD-V2-181
**Area**: Analytics — 10 Critical Pre-Beta Events
**Date**: 2026-03-03

**Context**: Phase 21.3 mentions analytics but no specific instrumentation plan exists. Without these events dashboarded, development is flying blind.

**Decision**: Instrument these 10 events before any beta user touches the game: (1) Tutorial step completion (granular funnel: each step as named event). (2) First dive completion rate. (3) First artifact ingestion rate. (4) D1/D7/D30 retention cohorts. (5) Session length distribution with screen-time breakdown. (6) Study session initiation rate (voluntary vs prompted). (7) Streak break events (with streak length at break). (8) Purchase funnel (view → tap buy → confirm → complete). (9) Oxygen depletion context (loot carried, depth reached, quiz performance at time of death). (10) Fact engagement (keep vs sell ratio, mastery speed by category, "not interesting" flag rate). Analytics infrastructure must be a Phase 19 prerequisite, not a Phase 21 afterthought. Affects Phase 19 and 21.3.

---

## Batch 4: Technical Architecture Decisions

*Date: 2026-03-03 | Source: Technical Architecture Q&A (50 questions)*
*Decisions DD-V2-182 through DD-V2-231*

---

### DD-V2-182
**Area**: Rendering — Tilemap Migration
**Date**: 2026-03-03

**Context**: MineScene currently renders tiles using Phaser Graphics API, drawing each block as a rectangle every frame. This approach scales poorly as mine grid size increases from 20x20 to 40x40 in Phase 8, and is incompatible with the autotiling system planned for Phase 7.

**Decision**: Migrate MineScene from Graphics-based tile rendering to Phaser.Tilemaps.TilemapLayer with pre-computed autotile bitmask indices per MineCell. Pre-compute tile indices on cell change (mine, reveal, earthquake), not per-frame. Single highest-impact rendering optimization. Prerequisite for Phase 7 autotiling. Affects Phase 7.1.

---

### DD-V2-183
**Area**: Rendering — Draw Call Budget
**Date**: 2026-03-03

**Context**: Mobile GPU throughput is a hard constraint. Chrome DevTools CPU/GPU throttling dramatically understates real mobile pressure, leading to optimizations that feel adequate in dev but perform poorly on actual hardware.

**Decision**: Hard cap of 50 draw calls per frame on mobile. Consolidate tiles into one tilemap draw, fog/overlays into a RenderTexture updated only on visibility changes, reserve dynamic draws for particles + player + loot physics. Profile on a real Pixel 6a — Chrome DevTools throttling dramatically understates mobile GPU pressure. Affects Phase 7, Phase 20.

---

### DD-V2-184
**Area**: Rendering — Sprite Pool Ceiling
**Date**: 2026-03-03

**Context**: Each mine layer allocates sprite pools for entities and overlays. Without a ceiling, memory and GPU overhead grow unbounded across the 20-layer mine system planned in Phase 8, particularly on low-end devices.

**Decision**: Hard ceiling of 500 pooled sprites with frustum culling. Only allocate sprites for cells within camera viewport + 2-tile margin. Recycle sprites when cells leave viewport. Essential for the 20-layer model where each layer allocates fresh pools. Affects Phase 7, Phase 8.

---

### DD-V2-185
**Area**: Rendering — Block Idle Animations
**Date**: 2026-03-03

**Context**: Phase 7.7 calls for animated blocks (lava flowing, gas swirling, crystal pulsing). Two approaches exist: per-sprite animation objects (one Sprite per animated block) or tilemap cycle animation (swapping tile indices at intervals). Mixing approaches creates maintenance and performance inconsistencies.

**Decision**: Hybrid approach: terrain blocks (lava, gas) animate by cycling tile indices on the tilemap at fixed intervals (single update, not per-sprite). Overlay objects (artifact glow, crystal sparkle) use Phaser sprite-based animations since fewer in number. Never mix per-frame Graphics procedural animation with sprite-based — pick one system per block type. Affects Phase 7.7.

---

### DD-V2-186
**Area**: Rendering — Ambient Particle Budget
**Date**: 2026-03-03

**Context**: Phase 7.4 calls for per-biome ambient particles (dust motes, spores, embers). Uncapped particle counts are a common mobile performance killer. Battery drain from continuous particle updates also affects user session length.

**Decision**: Cap at 200 active particles (mobile), 500 (desktop). Two emitter managers: one "ambient" per biome (camera-centered, drifts within viewport) and one "event" pool for bursts (break, loot, achievement). Reduce ambient frequency when battery saver detected via navigator.getBattery(). Budget 3-5% of frame time for particles. Affects Phase 7.4.

---

### DD-V2-187
**Area**: Rendering — Native Camera System
**Date**: 2026-03-03

**Context**: MineScene uses manual camera lerp code instead of Phaser's built-in camera follow system. Phase 7.3 adds pinch-to-zoom and a mini-map, both of which are significantly easier to implement with native Phaser camera APIs.

**Decision**: Switch to Phaser's native camera.startFollow() with deadzone, remove manual lerp code entirely. For pinch-to-zoom: Phaser input.on('wheel') for desktop + native gesture listener for mobile. Mini-map: second Phaser camera at 0.1x zoom with fixed position overlay. Affects Phase 7.3.

---

### DD-V2-188
**Area**: Architecture — Dome Phaser Scene Migration
**Date**: 2026-03-03

**Context**: The dome is currently rendered via DomeCanvas.svelte, a custom Svelte canvas component with manual offscreen canvas caching. Phase 10 calls for multi-floor dome with floor transition animations, pet movement physics, and animated objects — all of which would require re-implementing Phaser features from scratch in vanilla canvas.

**Decision**: Migrate dome from Svelte canvas (DomeCanvas.svelte) to a dedicated Phaser scene (DomeScene). Gives sprite batching, animation state machines, tweens for floor transitions, physics for pet movement. Svelte overlay layer stays as DOM overlays on top. Use Phaser scene manager to switch between DomeScene and MineScene sharing one Game instance. Affects Phase 10.

---

### DD-V2-189
**Area**: Rendering — Per-Biome Texture Atlases
**Date**: 2026-03-03

**Context**: Phase 9 introduces 25 biomes with unique tile sets. Loading all biome tiles upfront would increase initial load time and memory pressure. Each biome has distinct tile artwork that must be swapped on layer transitions.

**Decision**: Implement per-biome texture atlases loaded on demand. Pack all tiles for one biome into a single atlas PNG + JSON coordinate map (Phaser this.load.atlas()). Load next biome during descent animation, unload previous after transition. Max 3 biome atlases in memory (current + next + previous). Build atlases at build time with TexturePacker or Sharp. Affects Phase 7, Phase 9.

---

### DD-V2-190
**Area**: Rendering — Force WebGL
**Date**: 2026-03-03

**Context**: Phaser supports both WebGL and Canvas2D renderers. Canvas2D fallback was added historically for broad compatibility but introduces subtle cross-renderer bugs and prevents use of WebGL-only features like custom shaders.

**Decision**: Force Phaser.WEBGL in config, drop Canvas2D fallback entirely. Every modern mobile browser and Capacitor WebView supports WebGL. Avoids cross-renderer bugs, unlocks WebGL-only features (custom shaders for fog, post-processing for screen shake). Unsupported devices get "device not supported" message. Affects Phase 7.

---

### DD-V2-191
**Area**: Performance — Mine Generation Threading
**Date**: 2026-03-03

**Context**: Phase 8 increases mine grid from 20x20 to 40x40 at deep layers. Large BFS flood-fill operations and complex structure placement could cause frame drops on low-end devices if run on the main thread. Web Workers would isolate this but add significant complexity.

**Decision**: Profile mine generation on mid-range phone at 40x40 first — likely still under 50ms, masked by descent animation. Only move to Web Worker if profiling shows >100ms on target devices. The seeded RNG (mulberry32) and pure-function code are already Worker-compatible. Cap BFS depth at 200 cells to prevent worst-case flood-fill explosions. Affects Phase 8.

---

### DD-V2-192
**Area**: Save System — PlayerSave Sub-Documents
**Date**: 2026-03-03

**Context**: PlayerSave is a single monolithic object uploaded on every save event. As the object grows with Knowledge Tree state, fossil collection, cosmetics, and behavioral data, the upload payload becomes large and conflict resolution becomes an all-or-nothing operation.

**Decision**: Split PlayerSave into versioned sub-documents: PlayerEconomy (minerals, crafting), PlayerKnowledge (reviews, facts, KP), PlayerCollection (fossils, cosmetics, relics), PlayerProgress (stats, streaks, milestones), PlayerPreferences (interests, GAIA settings). Each with its own lastModifiedAt timestamp. Per-subdocument conflict resolution (economy: max, knowledge: latest review date). Enables partial sync reducing bandwidth 80-90%. Affects Phase 19.

---

### DD-V2-193
**Area**: Save System — IndexedDB Migration
**Date**: 2026-03-03

**Context**: Save data is stored in localStorage, which has a 5-10MB limit per origin. An endgame save with 5K fact review states, fossil collection, cosmetics, and crafting history could exceed this limit and cause silent data loss.

**Decision**: Migrate persistence from localStorage to IndexedDB via idb-keyval library (600 bytes). Measure synthetic endgame save first — at 5K facts + collections could be 2-3MB. IndexedDB has unlimited storage + structured cloning faster than JSON.stringify. Keep localStorage only for save version number. Do before Phase 11. Affects Phase 19.

---

### DD-V2-194
**Area**: Save System — Field-Level Sync Merge
**Date**: 2026-03-03

**Context**: Players who play on multiple devices (tablet and phone) will generate sync conflicts. Last-write-wins would cause SM-2 review history to be overwritten, which is the most catastrophic possible data loss in an educational game. Extends DD-V2-043.

**Decision**: Implement field-level merge for sync conflicts instead of last-write-wins. Review states merge by latest lastReviewAt per fact ID; mineral counts take max; stats take max; inventory unions with dedup. Pure merge function with exhaustive unit tests. Max-merge on minerals is slightly exploitable but vastly preferable to data loss (losing SM-2 state is catastrophic). Extends DD-V2-043. Affects Phase 19.

---

### DD-V2-195
**Area**: Security — Token Storage
**Date**: 2026-03-03

**Context**: Auth tokens stored in localStorage are accessible to any JavaScript on the page, making them vulnerable to XSS attacks. Capacitor native environments have platform-specific secure storage options that should be used instead.

**Decision**: Layered approach per platform. Web: refresh tokens in httpOnly + Secure + SameSite=Strict cookies managed by Fastify backend; access token in-memory only (15-min expiry). Capacitor: @capacitor/preferences (iOS Keychain / Android EncryptedSharedPreferences). Remove all tokens from localStorage. Affects Phase 19.

---

### DD-V2-196
**Area**: Architecture — Service Worker Strategy
**Date**: 2026-03-03

**Context**: Service Workers enable offline-first behavior for web users, but they introduce cache invalidation complexity that can cause stale assets to persist across deploys. Capacitor native bundles assets in the APK and doesn't need a Service Worker for offline use.

**Decision**: Build Service Worker in Phase 19, not before. Capacitor native doesn't need it (assets bundled in APK). For web: use vite-plugin-pwa with precache for dist/ assets, stale-while-revalidate for facts.db, network-first for API with cached fallback. Before Phase 19 it adds cache invalidation headaches that slow iteration. Affects Phase 19, Phase 20.

---

### DD-V2-197
**Area**: Data — Facts DB Sizing & Loading
**Date**: 2026-03-03

**Context**: Phase 11 targets 5K+ facts. The current approach bundles all facts in a single facts.db file loaded at boot. At 5K facts with full metadata (gaiaComment, explanation, distractors, wowFactor, embeddings), this file could become too large for acceptable initial load times.

**Decision**: 5K facts ≈ 10-15MB uncompressed, ~3-5MB gzipped. Capacitor: bundle baseline facts.db in APK + delta sync for updates. Web: fetch minimal facts-core.db (~2MB, question+answer only) at boot, lazy-fetch full metadata when quiz triggers. Affects Phase 11, Phase 20.

---

### DD-V2-198
**Area**: Data — Fact Delta Sync Protocol
**Date**: 2026-03-03

**Context**: New facts are added continuously via the Phase 11 content pipeline. Requiring app store releases to distribute new facts would create weeks of latency and require frequent forced updates. A delta sync protocol allows content to update independently of app releases.

**Decision**: Server exposes GET /api/facts/delta?since={version} returning adds/mods. Client stores factDbVersion in PlayerSave. Check on foreground/post-dive. Apply via INSERT OR REPLACE to local sql.js. Persist updated DB to IndexedDB. APK-bundled facts.db serves as offline fallback for first launch. Decouples content delivery from app releases. Affects Phase 11, Phase 23.

---

### DD-V2-199
**Area**: Save System — Durability on App Kill
**Date**: 2026-03-03

**Context**: Mobile OS aggressively kills background apps. If a player mines for 20 minutes and the OS kills the app during a cloud sync debounce window, all progress since the last sync would be lost. This is unacceptable for an educational game tracking SM-2 review states.

**Decision**: Two-pronged: (1) visibilitychange + Capacitor App.addListener('appStateChange') triggers immediate sync bypassing debounce. (2) Write every save to IndexedDB synchronously as primary persistence; cloud sync is eventually-consistent backup. Debounce only throttles cloud uploads, never local writes. Zero data loss on abrupt termination. Affects Phase 19.

---

### DD-V2-200
**Area**: UX — Sync Status Indicator
**Date**: 2026-03-03

**Context**: Players with connectivity issues will not know if their progress is being saved to the cloud. Technical error messages break immersion. GAIA's personality should be leveraged for all system communication. Extends DD-V2-143.

**Decision**: Cloud icon in dome UI: green (synced <1hr), yellow (pending), red (failed or >24hr). Tap for timestamp + manual "Sync Now". After 3+ failures: GAIA toast "My databanks are having trouble connecting to the satellite. Your progress is safe locally." Never show technical errors — always through GAIA's personality. Extends DD-V2-143. Affects Phase 19.

---

### DD-V2-201
**Area**: Architecture — Offline Feature Tiers
**Date**: 2026-03-03

**Context**: Phase 22 adds social features that require connectivity. Future social features must not degrade the core offline experience, which is the primary value proposition for mobile players with inconsistent connectivity. Implements DD-V2-043.

**Decision**: Three tiers: (1) Always offline: mining, quizzes, study, Knowledge Tree, crafting, farm, dome, fossils — core loop never needs connectivity. (2) Cached when available: leaderboards (last snapshot), daily deals (client-seeded), GAIA journey memory (local templates). (3) Online-only: duels, hub visiting, guilds, fact trading, IAP — show "Requires connection" badge when offline. Implements DD-V2-043. Affects Phase 20.

---

### DD-V2-202
**Area**: Database — PostgreSQL jsonb + Denormalized Columns
**Date**: 2026-03-03

**Context**: The save system stores the entire PlayerSave as a JSON blob. Analytics queries that need to filter by last_played_at or sort by total_dives would require deserializing every row, making aggregate queries prohibitively slow at scale.

**Decision**: Use jsonb for save blob + extract hot analytics columns: last_played_at, total_dives, total_facts_learned, current_streak, account_tier. Updated atomically with save blob on each upload. Enables fast analytics queries without deserializing every row. Affects Phase 19.

---

### DD-V2-203
**Area**: Database — Save History Retention
**Date**: 2026-03-03

**Context**: The save system needs to support rollback for corrupted saves while preventing unbounded table growth. Querying for the latest active save must be fast regardless of how many historical saves exist per user.

**Decision**: is_active boolean with partial unique index (CREATE UNIQUE INDEX ON saves(user_id) WHERE is_active = TRUE). On upload: atomically flip old→inactive, insert new as active, in transaction. Keep 10 most recent per user, prune via scheduled job. Latest-save queries become O(1). Affects Phase 19.

---

### DD-V2-204
**Area**: Database — Leaderboard Scaling
**Date**: 2026-03-03

**Context**: Phase 22 adds global leaderboards. Naive leaderboard implementations (insert every score, query top-N) degrade as user base grows. The top-100 display is the most common read pattern and must be fast.

**Decision**: Three changes: (1) Composite index (category, score DESC). (2) Upsert model: best score per (userId, category) only, not every submission. (3) Cache top-100 per category in memory with 60-second refresh. Separate leaderboard_history table for score progression tracking if needed. Affects Phase 19.

---

### DD-V2-205
**Area**: Security — Argon2id Password Hashing
**Date**: 2026-03-03

**Context**: PBKDF2-SHA512 is the current password hashing algorithm. Argon2id has superseded PBKDF2 as the OWASP recommendation due to its memory-hard properties that resist GPU-accelerated cracking attacks.

**Decision**: Migrate from PBKDF2-SHA512 to Argon2id via argon2 npm package. Memory-hard, async (no event loop blocking), OWASP-recommended. Transparent migration: on login, if stored hash is PBKDF2, verify then re-hash with Argon2id and update row. Config: type=argon2id, memoryCost=19456, timeCost=2, parallelism=1. Affects Phase 19.

---

### DD-V2-206
**Area**: Auth — Social Login + Guest Linking
**Date**: 2026-03-03

**Context**: Phase 19 requires authentication. Requiring email/password registration before players can start is a major conversion barrier for casual mobile users. Guest accounts reduce friction but create an upgrade path problem when players want to secure their progress. Implements DD-V2-042.

**Decision**: Capacitor OAuth plugins for native flows. Backend: POST /api/auth/social accepts provider token, verifies with provider API, finds or creates user. Guest accounts: UUID on first launch, "guest" user row, JWT issued. POST /api/auth/link associates guest save with authenticated identity. Add auth_provider + provider_id columns. Implements DD-V2-042. Affects Phase 19.

---

### DD-V2-207
**Area**: Backend — LLM Pipeline Architecture
**Date**: 2026-03-03

**Context**: Phase 11 requires automated generation of distractors, gaiaComment, explanation, and wowFactor fields for thousands of facts. Local models (Ollama, llama.cpp) were considered to reduce cost, but distractor quality is critical to learning effectiveness.

**Decision**: Cloud LLM API (Claude Sonnet or GPT-4o-mini) for fact content pipeline. ~$0.005/fact, 5K facts ≈ $25 total. Server-side batch job with facts_processing_queue table, rate-limited 10 req/sec. Store raw LLM responses alongside parsed fields for debugging and regeneration. Local models lack nuance for distractor generation. Affects Phase 11.

---

### DD-V2-208
**Area**: Backend — Semantic Duplicate Detection
**Date**: 2026-03-03

**Context**: The Phase 11 content pipeline ingests facts from multiple sources. Naive string matching fails to detect semantically identical facts with different wording. Without duplicate detection, the fact database accumulates redundant entries that waste SM-2 slots and confuse players.

**Decision**: Text embeddings with cosine similarity using text-embedding-3-small ($0.02/1M tokens). Store in PostgreSQL via pgvector extension. On ingestion: compute embedding, query nearest 5, flag >0.85 similarity as potential duplicate. HNSW index scales to 100K+ facts. Affects Phase 11.

---

### DD-V2-209
**Area**: Database — SQLite to PostgreSQL Migration
**Date**: 2026-03-03

**Context**: The server currently uses SQLite for the facts database. Phase 19 requires a production-grade database for user accounts, save sync, and leaderboards. SQLite's single-writer limitation is acceptable during development but not for multi-instance Fastify deployments.

**Decision**: Phased: (1) Write Drizzle schema targeting PostgreSQL. (2) Deploy PostgreSQL alongside SQLite. (3) Idempotent data migration script. (4) Dual-write for 1 week. (5) Switch reads to PostgreSQL, verify, remove SQLite. Migration script must be re-runnable. Affects Phase 19.

---

### DD-V2-210
**Area**: Security — Refresh Token Hashing
**Date**: 2026-03-03

**Context**: Storing refresh tokens in plaintext allows any database breach to immediately compromise all user sessions. Token rotation without family tracking is vulnerable to replay attacks where a stolen rotated token can be re-used.

**Decision**: SHA-256 hash before storage. Store hash as primary key; client holds raw token. Add family_id column (UUID per login session, shared across rotations). If rotated token reused, revoke ALL tokens in that family (replay attack detection). OAuth 2.0 Security BCP recommended pattern. Affects Phase 19.

---

### DD-V2-211
**Area**: Security — Rate Limiting Strategy
**Date**: 2026-03-03

**Context**: Auth endpoints are vulnerable to brute force. Save upload endpoints could be abused to inflate storage costs. LLM-backed endpoints have direct monetary cost that must be protected against abuse.

**Decision**: @fastify/rate-limit per-route. Auth: 5/min per IP. Save upload: 2/min per user. Leaderboard submit: 10/min per user. Fact ingestion: 10/min per admin. Cost-based LLM rate limit: daily spend counter, circuit-break at $5/day threshold. Return 429 + Retry-After header. Affects Phase 19.

---

### DD-V2-212
**Area**: Mobile — Capacitor Plugin Roadmap
**Date**: 2026-03-03

**Context**: Multiple Capacitor plugins are planned across different phases. Adding them all at once risks instability and makes it difficult to attribute regressions. Each plugin requires real-device testing to validate.

**Decision**: Add incrementally: Phase 7: @capacitor/haptics. Phase 19: @capacitor/preferences, @capacitor/app, @capacitor/filesystem. Phase 20: @capacitor/keyboard. Phase 21: capacitor-purchases (RevenueCat). Phase 23: @capacitor/push-notifications. Test each on real device immediately after adding. Affects Phases 7, 19, 20, 21, 23.

---

### DD-V2-213
**Area**: Mobile — Haptic Feedback Vocabulary
**Date**: 2026-03-03

**Context**: Phase 7.8 adds haptic feedback. Without a defined vocabulary, different systems independently implement haptics producing an incoherent tactile experience. Android and iOS have different haptic motor characteristics requiring cross-device testing.

**Decision**: Block hit = impact.light, block break = impact.heavy, rare loot = notification.success, hazard damage = notification.warning, achievement = custom 200ms vibrate. Wrap in hapticService that no-ops on web. Fire haptic at animation impact keyframe, not in input handler. Test on Samsung + Pixel (different motors). Affects Phase 7.8.

---

### DD-V2-214
**Area**: Build — Bundle Size & Code Splitting
**Date**: 2026-03-03

**Context**: Phaser and sql.js are large dependencies. Loading all application code upfront creates a slow initial load that is disproportionately harmful on mobile networks. Screens like KnowledgeTree and FossilGallery are only accessed by engaged players and don't need to be in the initial bundle.

**Decision**: Target under 500KB gzipped initial JS (excluding Phaser/sql.js). Dynamic import() for heavy screen components (KnowledgeTree, FossilGallery, Zoo, StudySession). Chunks: core, mine, dome, study, social. sql.js WASM loaded async, only init when first quiz needed. Measure with vite-bundle-visualizer. Affects Phase 20.

---

### DD-V2-215
**Area**: DevOps — CI/CD Pipeline
**Date**: 2026-03-03

**Context**: No automated CI/CD exists. PRs are merged without typecheck or build verification. Mobile builds are manual. As the team grows and the codebase expands, manual processes become bottlenecks and sources of regressions.

**Decision**: Three GitHub Actions workflows: (1) CI (every PR): typecheck, build, Vitest, API tests, bundle size assertion. (2) Deploy API (merge to main): Docker build, push, deploy to Fly.io, health check. (3) Build Mobile (git tag v*): cap sync android, Gradle build, sign from Secrets, upload AAB to Play Console internal track. Add Dependabot for security alerts. Affects Phase 18.

---

### DD-V2-216
**Area**: Testing — Strategy (Highest ROI)
**Date**: 2026-03-03

**Context**: No test suite exists. Phase 18 adds dev tooling but no testing strategy has been defined. The question is where to invest limited test-writing time for maximum confidence and minimum maintenance burden in a game codebase.

**Decision**: Three tiers with Vitest: (1) Pure function unit tests (highest ROI): SM-2 transitions, mine gen determinism (snapshot tests), quiz selection, save migration, mineral conversion. Target 90% on src/services/ and src/data/. (2) API integration tests: Fastify app.inject() for all routes, 95% on server/src/routes/. (3) Single E2E smoke: Playwright boots, enters mine, verifies HUD. Skip Svelte component tests (poor ROI for game UI). Affects Phase 18.

---

### DD-V2-217
**Area**: Testing — Seed Determinism Protection
**Date**: 2026-03-03

**Context**: Mine generation uses a seeded RNG for deterministic output. Any refactor to MineGenerator.ts risks silently breaking determinism, causing different mine layouts from the same seed — which would corrupt save states that reference specific cell positions.

**Decision**: Snapshot tests for mine generation: 20 fixed seeds × 3 layer depths = golden snapshot files. Any PR changing generation breaks snapshots, forcing review. Plus: generate 1K random seeds asserting invariants (spawn clear, exit exists, descent shaft exists, no sealed pockets). Affects Phase 18, Phase 8.

---

### DD-V2-218
**Area**: DevOps — Docker Strategy
**Date**: 2026-03-03

**Context**: The Fastify backend will be containerized for deployment. Docker build strategy affects image size, build time, dependency isolation, and production environment consistency.

**Decision**: Multi-stage Dockerfile: Stage 1 builds TypeScript + native deps. Stage 2 copies to slim node:22-slim image. Build arg DB_DRIVER for SQLite/PostgreSQL swap. Pin Node version. Add HEALTHCHECK for /health. Set NODE_ENV=production as env var, not build arg. Affects Phase 20.

---

### DD-V2-219
**Area**: Infrastructure — CDN Asset Delivery
**Date**: 2026-03-03

**Context**: Biome atlases, facts.db, and sprite assets are large binary files that should not be served from the Fastify API server. As Phase 9 adds 25 biomes with unique atlases, asset volume grows significantly. Extends DD-V2-174.

**Decision**: Split serving: Game HTML/JS/CSS on Cloudflare Pages (free tier). Large assets (atlases, facts.db, images) on Cloudflare R2 + CDN with content-addressed filenames for infinite cache. Capacitor: bundle essential assets in APK, lazy-fetch biome atlases from CDN. Keep APK under 50MB, support 100MB+ total. Extends DD-V2-174. Affects Phase 20.

---

### DD-V2-220
**Area**: Mobile — Android WebView Profiling
**Date**: 2026-03-03

**Context**: Performance profiles vary dramatically across Android device tiers. Mid-range phones from 2021-2023 represent the largest slice of the target market. Without profiling on real hardware, performance budgets are guesswork.

**Decision**: Test on 3 device tiers: low-end (Samsung A13, 3GB), mid-range (Pixel 6a, 6GB), high-end (Pixel 8, 12GB). Critical metrics: time to interactive, mining FPS with particles, memory after 5 layer transitions, battery drain per 15min. Set performance budgets, fail CI on regression. Use chrome://inspect with USB debugging. Affects Phase 20.

---

### DD-V2-221
**Area**: Infrastructure — Error Monitoring & Observability
**Date**: 2026-03-03

**Context**: No error monitoring exists. When players encounter bugs in production, there is no visibility into what failed, on which devices, or how often. Analytics for learning effectiveness (DD-V2-134) also need an infrastructure home. Extends DD-V2-159.

**Decision**: Three layers: (1) Client: Sentry (free 5K events/month) wrapping Phaser boot and service calls. (2) Server: Sentry for Node.js or structured JSON logging parsed by host. (3) Analytics: lightweight custom events (dive_started, quiz_answered, fact_learned, session_ended) to PostgreSQL analytics table. Avoid heavyweight SDKs (Firebase, Amplitude). Extends DD-V2-159. Affects Phase 20.

---

### DD-V2-222
**Area**: Architecture — GameManager Decomposition v2
**Date**: 2026-03-03

**Context**: GameManager was partially decomposed in the 2026-03-02 refactor, extracting QuizManager, StudyManager, GaiaManager, and InventoryManager. However, dive lifecycle (layer transitions, biome selection, oxygen scaling) and dome management (floor navigation, pet idle, farm ticks) remain in GameManager and will grow substantially with Phase 8 and Phase 10 work.

**Decision**: Extract DiveManager (dive lifecycle, layers, biomes) and DomeManager (floors, pets, farm, GAIA idle) from GameManager. GameManager becomes thin coordinator owning Phaser Game instance, routing between managers. Each subscribes to shared typed event bus. Keeps each manager under 500 lines. Affects Phase 7.

---

### DD-V2-223
**Area**: Architecture — No ECS Framework
**Date**: 2026-03-03

**Context**: Entity Component System (ECS) frameworks like bitecs are sometimes proposed for Phaser games to improve data locality and update performance. The question is whether Terra Gacha's architecture would benefit from adopting ECS.

**Decision**: Do NOT adopt full Entity Component System. Grid cells are uniform structs, not free-moving heterogeneous entities where ECS shines. Instead, enrich MineCell with optional component-like fields (animation state, particle config, hazard timer) + dedicated update systems (animation, hazard, visibility). Separation-of-concerns without framework overhead. Affects Phase 7, Phase 25.

---

### DD-V2-224
**Area**: Architecture — Typed Event Bus
**Date**: 2026-03-03

**Context**: Communication between Phaser systems and Svelte UI currently relies on a mix of shared stores, direct callbacks, and GameManager method calls. As the codebase grows with additional managers, this coupling makes changes in one system produce unexpected side effects in others.

**Decision**: Singleton EventBus with TypeScript generics: eventBus.emit<BlockMinedEvent>('block-mined', data) / eventBus.on<BlockMinedEvent>(). Both Phaser and Svelte use same bus. Central src/events/types.ts for all event types. Synchronous for game-critical events, async (microtask queue) for UI updates to prevent frame drops. Fully decouples systems. Affects Phase 7.

---

### DD-V2-225
**Area**: Security — Anti-Cheat Layered Deterrents
**Date**: 2026-03-03

**Context**: Leaderboards and social features create incentives for save editing via browser DevTools. Full server-side game state validation is impractical for an offline-first game. The goal is to deter casual cheating without building a complex anti-cheat system.

**Decision**: Accept imperfection. (1) Server plausibility checks: reject impossible saves (factsLearned > quizzesTaken, etc). (2) Rate anomaly detection: flag 3σ+ outliers. (3) Leaderboard sanitization: top-100 requires plausibility check. (4) Signed save checksums: HMAC of critical fields using per-session server secret. Stops casual DevTools editing. Affects Phase 19.

---

### DD-V2-226
**Area**: Security — CSP Per Environment
**Date**: 2026-03-03

**Context**: A single Content Security Policy cannot serve development (needs hot reload, blob: URLs, eval for Vite HMR), web production (needs strict restrictions), and Capacitor native (different origin model) simultaneously. Applying prod CSP in development blocks Vite HMR.

**Decision**: Three configurations: Dev (permissive localhost:*), Production web (strict with explicit CDN + API domains), Capacitor (use @capacitor/http or add API domain to server.allowNavigation). Inject CSP via Vite HTML transform plugin. Add blob: to worker-src for sql.js WASM. Affects Phase 19, Phase 20.

---

### DD-V2-227
**Area**: Security — Asymmetric JWT (ES256)
**Date**: 2026-03-03

**Context**: The current JWT implementation uses symmetric HMAC signing (HS256), requiring every service that verifies tokens to possess the secret key. Phase 22+ may introduce edge functions or microservices that need to verify tokens without access to the signing secret.

**Decision**: Migrate to ES256 (ECDSA) asymmetric signing. Private key in secrets manager for token signing only. Public key distributable to any verifying service (future microservices, edge functions). Smaller tokens + faster verification than RS256. Affects Phase 19.

---

### DD-V2-228
**Area**: Privacy — GDPR Behavioral Consent
**Date**: 2026-03-03

**Context**: Phase 12 introduces behavioral learning that infers player interests from mining patterns and quiz performance. This constitutes profiling under GDPR and requires explicit informed consent with granular controls. Implements DD-V2-041.

**Decision**: Full GDPR compliance for Phase 12 behavioral learning: (1) Explicit opt-in toggle with clear explanation, consent timestamp + version. (2) GET /api/account/data-export. (3) DELETE /api/account/behavioral-data. (4) "Reset My Preferences" UI button. (5) Privacy policy with separate processing purpose. Opt-in granular — manual interest sliders without behavioral inference. Implements DD-V2-041. Affects Phase 12, Phase 19.

---

### DD-V2-229
**Area**: Privacy — GDPR Right to Erasure
**Date**: 2026-03-03

**Context**: GDPR Article 17 requires complete data deletion on request within 30 days. The save system, analytics table, leaderboards, and auth tokens all hold user data that must be purged. Retained anonymized analytics must not be re-identifiable.

**Decision**: DataDeletionService: (1) CASCADE delete user row (saves, leaderboards, tokens). (2) Anonymize retained analytics. (3) Signed deletion confirmation. (4) Client: clear all terra_* localStorage, clear IndexedDB, reset stores. (5) 30-day soft-delete grace period. Add deleted_at check in JWT verification middleware. Affects Phase 19.

---

### DD-V2-230
**Area**: Architecture — Monorepo Workspaces
**Date**: 2026-03-03

**Context**: The client (packages/client) and server (packages/server) share types and constants (balance values, fact schema, event types) but currently duplicate these definitions. As the codebase grows with Phase 11 pipeline and Phase 18 dashboard, the number of consumers of shared types increases.

**Decision**: Formalize with pnpm workspaces: packages/client, packages/server, packages/shared (types, constants, validators, balance values). Add packages/pipeline (Phase 11) and packages/dashboard (Phase 18) later. Use Turborepo for orchestrated builds. Changing shared type produces immediate build errors in all consumers. Affects Phase 18.

---

### DD-V2-231
**Area**: Infrastructure — Launch Deployment Architecture
**Date**: 2026-03-03

**Context**: Phase 20 defines the launch deployment target. The risk of over-engineering the infrastructure before product-market fit is real — building for 100K concurrent users before having 1K DAU wastes engineering time and ops budget.

**Decision**: Start lean: (1) Client: Cloudflare Pages (web) + Capacitor APK/IPA. (2) API: single Fastify on Fly.io with auto-scale 1-3 instances. (3) DB: Fly.io Postgres or Supabase. (4) CDN: Cloudflare R2. (5) Monitoring: Sentry + structured logs + custom analytics table. Phase 22: @fastify/websocket. Phase 21: receipt validation inline. Do NOT architect for >10K concurrent until >1K DAU. Affects Phase 20.

---

## Batch 5: Visuals & Art Direction Decisions

*Date: 2026-03-03 | Source: Visuals & Art Direction Q&A (50 questions)*
*Decisions DD-V2-232 through DD-V2-281*

### DD-V2-232
**Area**: Autotiling — Bitmask Complexity
**Date**: 2026-03-03

**Context**: Terra Gacha plans 25 biomes, each requiring tiled block rendering that matches neighbors. The choice between 4-bit (16-variant) and 8-bit (47-variant) autotiling has significant art production implications: 8-bit requires ~3x more sprites per material and proportionally more ComfyUI generation time.

**Decision**: Start with 4-bit (16-variant) autotiling for all 25 biomes at launch. The visual leap from zero to 4-bit is approximately 90% of the quality gain. Ship 4-bit everywhere, then upgrade the 5 most-visited biomes (Sedimentary, Topsoil, Volcanic, Crystalline, Fungal Forest) to 8-bit (47-variant) post-launch based on player time-spent data. Affects Phase 7.1.

---

### DD-V2-233
**Area**: Autotiling — Cross-Material Transitions
**Date**: 2026-03-03

**Context**: When two different block materials are adjacent (e.g., dirt next to stone), the boundary looks harsh with no blending. A naive solution of creating combined sprites for every material pair creates quadratic combinatorial explosion — 25 biome materials would require 300+ unique transition sets.

**Decision**: Two-layer approach: (1) each block renders its autotiled base sprite using a neighbor-of-same-type bitmask, (2) a semi-transparent edge mask overlay shows adjacent material "creeping in" from different-type neighbors. Only 4-8 edge sprites per material are needed (top/bottom/left/right + corners), which scales linearly not quadratically. This is the Starbound pattern. Affects Phase 7.1, Phase 9.

---

### DD-V2-234
**Area**: Autotiling — Dirty-Rect System
**Date**: 2026-03-03

**Context**: The current tilemap renderer redraws the full visible grid every frame. At 20x20 grids this is tolerable, but Phase 8 scales to 40x40 grids (1,600 tiles), and autotiling adds bitmask-lookup overhead per tile. On mobile hardware this creates a sustained draw bottleneck during active mining.

**Decision**: Move from full-grid-every-frame redraws to a dirty-rect system where only changed tiles and their 8 neighbors re-render per frame. This drops per-frame draw cost from O(visible_grid) to O(changed_tiles). Essential for 40x40 grids on mobile. Extends DD-V2-182 (tilemap migration). Affects Phase 7.

---

### DD-V2-235
**Area**: Autotiling — Biome Boundary Transitions
**Date**: 2026-03-03

**Context**: Phase 9 places multiple biomes within a single layer. Where two biomes border each other, their distinct palettes and tile shapes will clash visually, creating jarring hard edges. Creating custom transition sprites for every biome pair (25×24 = 600 pairs) is not feasible.

**Decision**: Create a neutral transition tileset with desaturated earth tones capable of bridging any two biome palettes. Place in a 2-3 tile transition zone between biome regions. This avoids the combinatorial explosion of 600 biome pairs while providing visual continuity. Affects Phase 9.

---

### DD-V2-236
**Area**: Art Direction — Biome Visual Tiers
**Date**: 2026-03-03

**Context**: With 25 biomes planned, giving every biome full unique sprite treatment is not feasible within the production timeline. Yet all biomes looking identical defeats the purpose of the biome system. A tiered approach balances artistic quality with production reality.

**Decision**: Three tiers of uniqueness: Tier 1 (5-6 hero biomes: Fungal Forest, Data Ruins, Ancient City, Living Cave, Coral Reef) = fully unique silhouettes and textures recognizable at thumbnail size. Tier 2 (10-12 biomes) = unique textures, similar shapes, different grain and color. Tier 3 (7-8 biomes) = shared structural sprites with heavy palette variation plus 2-3 unique accent tiles each. Affects Phase 9.

---

### DD-V2-237
**Area**: Art Direction — 25-Biome Color Matrix
**Date**: 2026-03-03

**Context**: Without a formal color planning step, 25 biomes generated individually risk color collisions — multiple biomes sharing the same dominant hue with no visual differentiation. This has happened in the existing sprite set where several mid-depth biomes look similar at a glance.

**Decision**: Create a hue wheel matrix before generating any sprites. No two adjacent-layer biomes share a dominant hue. Sibling biomes (e.g., Volcanic vs Magma Core) are differentiated by structural silhouette, not color. Add a formal palette object — { dominant, accent, highlight } — to the Biome interface as a contract. If two biomes must share a hue, their shape language must be opposite. Affects Phase 9.

---

### DD-V2-238
**Area**: Art Direction — Depth Visual Gradient
**Date**: 2026-03-03

**Context**: Players need an intuitive sense of depth as they descend through 20 layers. Without a consistent visual language, all depths feel equivalent, undermining the tension and progression of the descent. The game's loop depends on players feeling they are going somewhere dangerous.

**Decision**: Topsoil (L1-5): warm earth tones (amber/ochre/sage), organic rounded shapes, high brightness, no hazard particles. Mid-depth (L6-10): cooler palette (teal/gray/slate), more angular forms, moderate brightness, scattered ambient particles. Deep (L16-20): cold palette (indigo/purple/void), sharp jagged geometry, low brightness with high-contrast glow, heavy ambient particles. Warm to cold, round to angular, bright to dark — universally intuitive depth communication. Affects Phase 9, Phase 14.

---

### DD-V2-239
**Area**: Animation — Per-Biome Animated Tile Budget
**Date**: 2026-03-03

**Context**: Animated tiles (lava flow, crystal shimmer, gas drift) significantly increase visual richness but also per-frame CPU cost. With up to 144 visible tiles and potentially many animated, naive implementation causes frame drops on mobile, especially in animation-heavy biomes like Volcanic or Crystalline.

**Decision**: 3-4 animated tile types per biome, 4-6 frames each. At approximately 144 visible tiles with 20% animated = roughly 29 updating per frame. Use a global animation timer with staggered phase offsets seeded by grid position (prevents synchronized pulsing across all tiles). Use sprite-sheet frame cycling, not per-pixel shaders. Pre-calculate which tiles are animated during reveal, not per-frame. Affects Phase 7.7.

---

### DD-V2-240
**Area**: Art Direction — Remove Biome Tint Overlays
**Date**: 2026-03-03

**Context**: The current implementation uses a programmatic 0.15 alpha biome tint overlay as a stopgap to differentiate biomes that share sprites. Once per-biome tile sprites are generated and in place, this overlay conflicts with the authentic palette of the authored sprites, desaturating them and making them look washed out.

**Decision**: Remove the 0.15 alpha biome tint once per-biome tile sprites are in place. Keep a very subtle 0.05-0.08 alpha wash as a unifying "color grade" to tie heterogeneous block types within a single biome together. The authored sprites carry the biome identity. Affects Phase 7, Phase 9.

---

### DD-V2-241
**Area**: Art Direction — Special Block Biome Adaptation
**Date**: 2026-03-03

**Context**: Some blocks are gameplay-critical waypoints that players must find to progress (Descent Shaft, Exit Ladder, Quiz Gate). Others are incidental discoverable objects. Fully redesigning waypoint blocks per biome risks making them unrecognizable to players who learned their shape in earlier biomes.

**Decision**: Gameplay-critical blocks (Quiz Gate, Descent Shaft, Exit Ladder) keep their universal recognizable silhouette across all biomes; only rune color, frame material, and glow hue adapt to the biome palette. Less critical blocks (Quote Stone, Relic Shrine) get full biome-specific redesigns. Rule: if a player must find it to progress, its shape is universal. Affects Phase 9.

---

### DD-V2-242
**Area**: Animation — Miner Frame Count
**Date**: 2026-03-03

**Context**: The miner character's animations (walking and mining) are the most-seen animations in the game, visible every second of play. The number of frames determines both the smoothness of motion and the total sprite art production cost. Too few frames feels robotic; too many is prohibitive to generate.

**Decision**: 6 frames per walk direction, 5-6 frames per mine/swing direction. Mine animation breakdown: 2 anticipation frames (slow) → 1 swing frame (fast) → 1 impact frame (hold 2-3 ticks) → 1-2 recovery frames. This "wind-up, snap, settle" formula is the Stardew Valley approach. Total approximately 48 character frames. Affects Phase 7.2.

---

### DD-V2-243
**Area**: Animation — Compressed Swing for Tap
**Date**: 2026-03-03

**Context**: Touch-based mining relies on rapid tapping. If the mine swing animation must complete before the next tap registers damage, players experience input lag that breaks the tactile mining loop. The animation must not block gameplay input.

**Decision**: The impact frame plays instantly on tap and damage is applied immediately; the follow-through animation plays purely as visual feedback after the fact. For multi-tap: recovery blends into the next anticipation frame, creating a rhythmic flow. The player must never wait for an animation to complete before the next tap registers. Separate the gameplay event (damage on tap) from the animation event (visuals play through). Affects Phase 7.2, Phase 7.8.

---

### DD-V2-244
**Area**: Workflow — Prototype Mining Feel First
**Date**: 2026-03-03

**Context**: Generating pixel art via ComfyUI requires precise timing specifications baked into the animation (frame count, hold duration, particle timing). If the mining feel is iterated after art is generated, many assets must be regenerated to match revised timings — a costly cycle.

**Decision**: Build the entire mining feel system first using colored rectangles (rotating arm, circle burst, procedural shake, placeholder particles). Iterate on timing curves until the feel is definitively right, then generate final pixel art designed to match the proven timing. This saves dozens of hours of wasted ComfyUI generation. Affects Phase 7.8.

---

### DD-V2-245
**Area**: VFX — Per-Block Impact Profiles
**Date**: 2026-03-03

**Context**: Every block type in the game currently produces identical impact feedback (same particles, same shake, same sound). This misses an opportunity to make mining feel materially distinct — dirt should feel soft and crumbly, crystal should feel sharp and resonant, lava should feel dangerous and hot.

**Decision**: Distinct impact profiles per block type. Dirt: 6 small brown particles, slow gravity, soft impact. Stone: 4 sharp gray plus white spark flash, medium shake. Crystal: 8 multi-colored slow-float particles, prismatic flash. Hard Rock: 3 heavy fast-gravity particles plus lingering dust cloud, strong shake. Lava: orange ember spray upward, heat shimmer, sizzle effect. Each profile differs in particle count, velocity, gravity, lifespan, color spread, shake intensity, and flash color. Affects Phase 7.4.

---

### DD-V2-246
**Area**: VFX — Progressive Hit Satisfaction
**Date**: 2026-03-03

**Context**: Multi-hit blocks require 3-8 hits before breaking. If each hit feels identical, there is no escalating tension or reward feedback during the mining process. The final break needs to feel meaningfully bigger than intermediate hits to create a satisfying completion moment.

**Decision**: Scale three parameters linearly with damage percentage: particle count 4→10, screen shake 1px→3px, crack overlay opacity 0.4→0.8. Add a subtle one-frame "bulge" on later hits (sprite scales to 1.03x for a single frame). Final break: 15 particles, 5px shake, 150ms white flash, and 50ms freeze-frame. The freeze-frame is the single most impactful juice technique for the break moment. Affects Phase 7.4, Phase 7.8.

---

### DD-V2-247
**Area**: Art Direction — Pickaxe Tier Visual Upgrades
**Date**: 2026-03-03

**Context**: Five pickaxe tiers (Stone, Iron, Steel, Diamond, Plasma) should feel visually and tactilely different. Generating 5 completely different miner sprites with different pickaxe shapes is expensive. The alternative must communicate tier clearly without full character redraws.

**Decision**: Generate a recolorable swing trail overlay as a separate 4-frame sprite sheet, tinted per tier at runtime. Trail colors: Stone=gray, Iron=silver, Steel=blue-white, Diamond=cyan sparkle, Plasma=magenta energy. Higher tiers also emit more particles (6→8→10→14→20) and produce stronger screen shake. One animation set plus a recolorable trail handles all tiers. Affects Phase 7.8.

---

### DD-V2-248
**Area**: Art Direction — Gear Visibility at 32px
**Date**: 2026-03-03

**Context**: The miner character is rendered at 32px on mobile. At this size, equipment changes drawn directly onto the base sprite (different pickaxe shape, backpack size, scanner antenna) are essentially invisible to players. Generating 40+ character variants for every equipment combination is also prohibitive.

**Decision**: Represent gear as small overlay icons following the miner position, not as modifications to the base sprite. A tiny pickaxe icon to the right (colored by tier), a scanner antenna dot above (if equipped), and a subtle backpack glow when full. These communicate status without requiring character sprite variants. Affects Phase 7.2.

---

### DD-V2-249
**Area**: VFX — Block Break Climactic Moment
**Date**: 2026-03-03

**Context**: The block break is the central reward moment of mining — it is when loot drops and progress is made. It must feel categorically different from intermediate hits to provide satisfying punctuation to the mining loop. Three specific elements distinguish it.

**Decision**: Block breaks include three elements not present in intermediate hits: (1) 50ms freeze-frame (the most powerful juice technique — world stops, then explodes), (2) radial particle burst of 15+ particles in all directions, (3) block-shatter animation where the sprite splits into 4 quadrants flying outward. After the freeze-frame, loot items pop with physics arcs. Total duration approximately 400ms. Affects Phase 7.4, Phase 7.5.

---

### DD-V2-250
**Area**: VFX — Loot Pop Physics
**Date**: 2026-03-03

**Context**: Loot appearing as a static sprite that immediately teleports to the inventory feels unsatisfying. The moment of reward needs to be extended and visually compelling to create the dopamine loop that makes mining addictive. The physics of loot movement communicates value.

**Decision**: Parabolic arc with random initial velocity (30-80 degrees upward, 60-120 px/sec), 2-3 diminishing bounces, hold for 200ms, then vacuum-suck to player using ease-in-cubic over 300ms. Show "+1" text pop on collection and flash the inventory slot. Multi-item drops stagger 100ms per item to fan out visually. Total 600-900ms. The vacuum phase is when the reward emotionally registers. Affects Phase 7.5.

---

### DD-V2-251
**Area**: Art Direction — 4 Crack Damage Stages
**Date**: 2026-03-03

**Context**: Players need visual feedback on block health during multi-hit mining. Numbers floating above blocks are cluttered and undermine the pixel art aesthetic. A crack progression system communicates health intuitively without UI clutter.

**Decision**: Four crack stages triggering at 25%, 50%, 75%, and 90% damage. Stage 1: hairline stress marks. Stage 2: fractures radiating from center plus a small chip. Stage 3: wide cracks with chunks visually separating. Stage 4: visibly fragmented, pieces appearing to wobble. Implemented as semi-transparent overlays at both 32px and 256px resolutions. Block-type variation via interior tint color (stone=dark gray, crystal=prismatic, dirt=darker earth). Affects Phase 7.

---

### DD-V2-252
**Area**: VFX — Particle Device Tiers
**Date**: 2026-03-03

**Context**: Particle effects vary enormously in GPU cost. A Legendary break with 15+ particles plus ambient biome particles plus screen effects can drop a 2019-era phone to 30fps. A particle budget system is needed that degrades gracefully without requiring manual configuration from players.

**Decision**: Three automatic tiers. Low (older phones): max 40 particles, no ambient particles, 3-particle block breaks. Medium (2020+ phones): max 80, 10 ambient, full break effects. High (2022+ phones and desktop): max 150, 20 ambient, enhanced break effects. Auto-detect via framerate check during the first 5 seconds of play, stored in settings. Manual override available. Hard maxParticles cap per tier enforced. Affects Phase 7.4.

---

### DD-V2-253
**Area**: VFX — Viewport-Culled Ambient Particles
**Date**: 2026-03-03

**Context**: Ambient biome particles (floating spores in Fungal Forest, embers in Volcanic, shimmering motes in Crystalline) enhance immersion but can accumulate offscreen, wasting processing resources and causing "particle creep" where hundreds of invisible particles continue updating.

**Decision**: Spawn ambient particles only within the camera rect plus a 2-tile margin. Any particle drifting outside this boundary is immediately recycled to the pool. Hard cap of 15-20 ambient particles visible at any time. Multi-type biomes split the budget (example: Volcanic = 10 embers + 5 shimmer = 15 total). Particles never persist outside the viewport. Affects Phase 7.4, Phase 9.

---

### DD-V2-254
**Area**: VFX — Screen Shake Tiers
**Date**: 2026-03-03

**Context**: Screen shake is one of the most effective juice techniques but also one of the most abused. Random glitchy displacement feels chaotic; Perlin noise displacement feels physical. Three distinct shake intensities must feel meaningfully different without inducing motion sickness.

**Decision**: Three tiers using Perlin noise displacement (physical feel, not random jitter). Micro (1-2px, 50ms): individual block hits. Medium (3-5px, 150ms): block breaks and bomb explosions. Heavy (6-10px, 300ms): earthquakes and cave-ins. The HUD layer is NEVER shaken — only the game camera. "Screen shake intensity" slider in settings at 0/25/50/100% is a mandatory accessibility feature. Affects Phase 7.4.

---

### DD-V2-255
**Area**: VFX — Gacha Reveal Animation Tiers
**Date**: 2026-03-03

**Context**: Artifact reveals are a primary excitement moment in Terra Gacha. If all rarities receive the same reveal animation, the rarity system loses emotional weight. The contrast between tiers creates anticipation and makes Legendary pulls feel genuinely special.

**Decision**: Design animations from Legendary DOWN, not Common up. Legendary: full-screen gold flash, 50 particles, 5px shake, light rays, 3-second hold, unique sound. Each lower tier subtracts one element: Epic drops screen flash, Rare drops light rays, Uncommon drops shake, Common = pop-out plus 8 particles only. Duration scales: Common 1.5s → Legendary 4-5s. Always provide a "Skip" button available after 1 second. Affects Phase 7.5.

---

### DD-V2-256
**Area**: VFX — Descent Shaft Transition
**Date**: 2026-03-03

**Context**: Entering a descent shaft currently causes an abrupt scene reload that breaks immersion. The scale shift from one layer to the next (different size, different biome, random spawn) deserves a cinematic moment that communicates "you have gone deeper" and introduces the new environment.

**Decision**: 3-phase transition totaling 3 seconds. Phase 1 — Fall (1s): camera zooms out, miner drops with acceleration, shaft walls blur-scroll, trailing particles. Phase 2 — Biome card (1.5s): full-screen display with biome name, layer number, biome icon, and GAIA comment, using the new biome's palette as background. Phase 3 — Arrive (0.5s): camera zooms in on new spawn point with a dust-settle particle burst. Transforms a jarring restart into a cinematic moment. Affects Phase 7.5, Phase 8.

---

### DD-V2-257
**Area**: UI — No Per-Block Health Bar
**Date**: 2026-03-03

**Context**: Floating health bars above blocks are a common game UI pattern but have specific drawbacks for Terra Gacha: they clutter the visual field, require constant repositioning relative to camera, and conflict with the pixel art aesthetic of crack-stage overlays already handling the same information.

**Decision**: Do not add floating health bars above blocks. Use the 4 crack stages (25/50/75/90%) supplemented by micro shake and particle bursts on each threshold transition to communicate remaining health. Optionally show a brief "2/5 HP" text indicator in pixel font for 0.5 seconds after each hit, then fade. Affects Phase 7.

---

### DD-V2-258
**Area**: VFX — Scanner Sonar Pulse
**Date**: 2026-03-03

**Context**: Players with a scanner upgrade need to locate the descent shaft to progress. Text-based distance indicators ("shaft nearby") break immersion. An in-world visual signal that communicates proximity without revealing exact location provides both atmosphere and directional information.

**Decision**: A radial "ping" wave emanates from the player every 2 seconds when within 5-8 tiles of the descent shaft. The wave is a thin expanding circle (1px stroke, 30% opacity) in the shaft's purple color (0x6633cc), fading as it expands. The shaft tile briefly glows when the wave passes over it. This gives directional awareness without revealing the exact location. Available at scanner tier 2+. Affects Phase 7.5.

---

### DD-V2-259
**Area**: VFX — Loot Rarity Break Preview
**Date**: 2026-03-03

**Context**: The rarity of a block's loot drop is unknown until the break overlay appears. Escalating the break effect itself based on hidden rarity creates a "wait, what was THAT?" moment that builds excitement in the 400ms before the overlay reveals the reward, making rare drops feel more special even before the player reads the rarity label.

**Decision**: Break effects escalate by hidden rarity before the overlay appears. Common: standard break. Uncommon: larger particle burst plus green flash. Rare: blue burst plus 1-tile glow ring. Epic: purple burst plus expanding ring plus micro-shake. Legendary: gold burst plus 3-tile glow ring plus heavy shake plus 100ms freeze-frame. Affects Phase 7.5.

---

### DD-V2-260
**Area**: Dome — Multi-Floor Layout
**Date**: 2026-03-03

**Context**: Phase 10 adds multiple dome floors. The current room-selection approach (separate screen per room) does not communicate the spatial relationship between floors. A simultaneous view of all floors creates a sense of home-building progress that individual screens cannot achieve.

**Decision**: Side-view cutaway layout (Fallout Shelter style) with all floors visible simultaneously, stacked vertically. DomeCanvas/DomeScene becomes taller (192 × 128 × floorCount pixels), with the viewport scrolling vertically. The elliptical dome silhouette transitions to a cylindrical tower with glass panels per floor. Affects Phase 10.

---

### DD-V2-261
**Area**: Dome — Empty vs Upgraded Floor Visual Language
**Date**: 2026-03-03

**Context**: Players need to immediately distinguish unlocked-but-empty floors from furnished floors. Empty floors must look obviously incomplete to create the urge to fill them, while furnished floors should feel warm and rewarding. The visual contrast drives the upgrade motivation loop.

**Decision**: Empty floors: desaturated palette, exposed structural beams, flickering dim lighting, "under construction" visual treatment. Furnished floors: warm lighting, decorative objects, ambient dust motes. Key cue: ghosted silhouette outlines at 15% opacity of the placeable objects specific to that floor type, using the existing obj_locked_silhouette.png. Affects Phase 10.

---

### DD-V2-262
**Area**: Art Direction — GAIA Expression Count
**Date**: 2026-03-03

**Context**: GAIA currently has 6 expressions. Phase 15 expands GAIA's personality and mood system significantly, adding new behavioral states (excited about rare finds, worried during streak warnings, smug during snarky commentary, etc.). More expressions enable richer emotional communication without additional dialogue requirements.

**Decision**: Expand from 6 to 10-12 expressions. New expressions to add: excited (rare finds and milestones), worried (streak warnings), smug (snarky comments), sleepy (idle and absence greetings), angry (consistency penalties), mysterious (lore hints). Only the face region changes since GAIA is a terminal. Generate all 12 in one ComfyUI batch with identical prompt structure varying only the expression descriptor. Affects Phase 15.

---

### DD-V2-263
**Area**: Dome — GAIA Thought Bubbles
**Date**: 2026-03-03

**Context**: GAIA currently communicates through a separate HTML overlay panel that feels disconnected from the DomeCanvas world. Keeping GAIA's commentary visually integrated with the game canvas reinforces that GAIA is a physical presence in the dome, not a UI notification system.

**Decision**: Pixel art speech bubbles rendered on DomeCanvas/DomeScene. 2px border in GAIA's teal/cyan palette, translucent dark fill, pixel-font text (maximum 2 lines, 60 characters), triangular tail pointing to the terminal. Clicking the bubble opens an HTML overlay for longer messages that require more space. Keeps GAIA visually in-world. Affects Phase 15.

---

### DD-V2-264
**Area**: UI — Unified Overlay Style Guide
**Date**: 2026-03-03

**Context**: Terra Gacha has 10+ distinct overlay screens (quiz, artifact reveal, GAIA, knowledge tree, settings, crafting, inventory, etc.) that have been built incrementally over multiple phases. Each uses different border styles, backdrop opacity, and interaction color palettes, making the game feel visually fragmented.

**Decision**: Three mandatory shared elements across all overlays: (1) 70% dark backdrop with subtle blur effect, (2) rounded-corner panel frame with 2px pixel art border in neutral dark-steel color, (3) shared interactive palette — gold for primary actions, teal for secondary actions, red for wrong/destructive, green for correct/success. Apply these retroactively to all existing overlays. Consistent chrome matters more than consistent content. Affects Phase 7, Phase 14.

---

### DD-V2-265
**Area**: UI — Resource Bar Mobile Optimization
**Date**: 2026-03-03

**Context**: The resource HUD currently shows all 7 resource types simultaneously. On mobile at 375px width, 7 resource icons with numbers are illegible and compete for space with the game canvas. Players rarely need all 7 at once, and the most relevant resources vary by context (mine vs dome).

**Decision**: Abbreviate numbers above 999 (1.2K, 3.4M). Show only the 3-4 most contextually relevant resources by default, with a tap-to-expand gesture revealing all 7. Context-specific defaults: Mine HUD shows oxygen and backpack capacity only; Dome screen shows minerals and oxygen. A horizontally scrollable row serves as the fallback for devices where expansion is impractical. Affects Phase 7.

---

### DD-V2-266
**Area**: Dome — Knowledge Tree Growth Stages
**Date**: 2026-03-03

**Context**: The knowledge tree in the dome is one of the most emotionally meaningful visual elements — it represents the player's accumulated learning. Its growth stages must be dramatic enough that players notice the change after a study session, creating a visual reward for time invested in learning.

**Decision**: 5-6 distinct growth stages: tiny sapling (0-10 facts mastered) → small bush (11-50) → young tree (51-150) → mature tree (151-500) → grand tree (501-1000) → ancient world tree (1001+). Each stage adds visible structural complexity: more branches, leaves, flowers, and at the highest stage a golden aura. The growth change between stages must be dramatic enough to notice at a glance. Affects Phase 10.

---

### DD-V2-267
**Area**: Dome — Procedural Structural Elements
**Date**: 2026-03-03

**Context**: The dome uses procedural rendering for large structural elements (dome shell, floor platforms, glass panels) which scales without texture memory cost. These large surfaces currently look flat and lifeless without surface detail.

**Decision**: Keep procedural rendering for large structural elements, which scales perfectly with zero texture memory cost. Enhance with procedural detail: panel line patterns on glass shell surfaces, rivet dot patterns on load-bearing platforms, subtle noise texture on floor fill areas, condensation drip effects on interior glass surfaces. Procedural enhancements add life without authored sprite cost. Affects Phase 10.

---

### DD-V2-268
**Area**: UI — Hybrid Font Strategy
**Date**: 2026-03-03

**Context**: Pixel fonts (Press Start 2P, bitmap) are visually consistent with the pixel art aesthetic but are illegible at mobile scale for body text. System sans-serif fonts are readable but break the aesthetic for UI chrome. The two font roles must be clearly separated to avoid both illegibility and aesthetic inconsistency.

**Decision**: Pixel fonts for: HUD labels, biome name cards, GAIA name labels, button text, and in-world canvas text (short strings only). System sans-serif at 16px minimum for: quiz question text, fact card content, explanations, study session text, and all settings text. Never use pixel fonts for body text longer than one line — they are unreadable at mobile scale. Pixel aesthetic lives in the borders, icons, labels, and chrome. Affects Phase 7, Phase 14.

---

### DD-V2-269
**Area**: Art Direction — Intro Comic Panels
**Date**: 2026-03-03

**Context**: Phase 14 includes an introductory sequence establishing the narrative (miner crash-landing, GAIA awakening). This sets the emotional tone for the entire game. The intro needs a different visual treatment than gameplay sprites — more dramatic, more compositional, more cinematic — while remaining stylistically coherent.

**Decision**: 5 panels at 384x512 (3:4 portrait ratio) generated at 1024x1024 via SDXL, then center-cropped. Use a different prompt approach: dramatic lighting, strong composition, narrative clarity prioritized over tile-readability. At least one panel must include a dramatic moment (crash impact or GAIA terminal flickering to life). Use lower LoRA strength (0.7 vs the standard 0.9) for more painterly results. These panels set the emotional tone for the entire game. Affects Phase 14.1.

---

### DD-V2-270
**Area**: Accessibility — Fog Visibility
**Date**: 2026-03-03

**Context**: The fog of war system uses Ring-1 (partially revealed) tiles at 10-20% brightness at the edges. On OLED mobile screens in daylight conditions, this range is at the threshold of visibility, meaning players may not perceive the fog at all and miss the entire exploration tension mechanic.

**Decision**: Increase Ring-1 brightness to 25-30% for mobile as the new default (up from 10-20%). Add a "fog contrast" accessibility slider in settings ranging from 15% (subtle) to 45% (high visibility). The slider is a mandatory accessibility feature — missing fog rings means missing the core exploration mechanic. Affects Phase 7.

---

### DD-V2-271
**Area**: VFX — Biome Fog Glow (Not Tint)
**Date**: 2026-03-03

**Context**: The proposal to tint the fog overlay itself per biome (purple for Fungal, orange for Volcanic) would create a visually muddied result where the fog's depth-communication role conflicts with biome-identification color. An alternative approach provides atmospheric cues without compromising fog readability.

**Decision**: Do not tint the fog overlay itself. Instead, add a radial glow emanating from specific block types that "leaks" into adjacent fog zones. Lava blocks emit a warm orange 1-tile radius glow into surrounding fog; crystal blocks emit a cool blue glow. The fog itself remains neutral dark. This is more atmospheric and doubles as a gameplay hint — players sense lava before revealing it. Partially implements the scanner shimmer system. Affects Phase 7, Phase 9.

---

### DD-V2-272
**Area**: Art Pipeline — Formal Palette System
**Date**: 2026-03-03

**Context**: Sprites generated for each biome in separate ComfyUI sessions will drift in color palette unless formally constrained. Without a palette contract, biomes 15-25 (generated months after biomes 1-5) will look like a different game, creating visual incoherence across the full 25-biome set.

**Decision**: Create palette.ts defining 8-12 colors per biome: background, 3 block fill levels, accent, highlight, shadow, fog tint, and particle color. Enforce during sprite generation via exact hex values in ComfyUI prompts or palette quantization post-processing (Aseprite palette remap or ImageMagick dither). This palette contract is the single most important quality control for long-term art consistency. Affects Phase 9.

---

### DD-V2-273
**Area**: Art Pipeline — Texture Atlas Build Pipeline
**Date**: 2026-03-03

**Context**: At 500+ sprites, loading each as an individual PNG creates 500+ HTTP requests on game start, with a combined overhead that causes visible loading delays on mobile networks. Phaser supports atlas loading natively and this capability should be exploited from the moment the sprite count makes individual loading impractical.

**Decision**: Pack sprites into 2048x2048 atlas sheets (the maximum safe size for mobile GPU compatibility) with accompanying JSON sprite maps at build time, using TexturePacker or free-tex-packer. Load via Phaser's this.load.atlas() API. Reduces 500+ individual HTTP requests to approximately 10 atlas loads. Extends DD-V2-189. Affects Phase 7, Phase 9.

---

### DD-V2-274
**Area**: Art Pipeline — 3-Gate Sprite QC
**Date**: 2026-03-03

**Context**: ComfyUI sprite generation currently has an estimated 30% rejection rate due to multi-object outputs (4-up sprite sheets instead of single sprites), incomplete background removal, and palette drift. Manual review of every generated sprite is a bottleneck in the pipeline.

**Decision**: Automated 3-gate QC check between generation and human review. Gate 1 — Composition: edge detection rejects images containing multiple separated objects (catches 4-up sprite sheet outputs). Gate 2 — Background: post-rembg, reject if the outer 10% pixel ring has mean alpha greater than 30% (incomplete removal). Gate 3 — Palette: reject if dominant colors deviate from the target biome palette beyond threshold. Target: reduce 30% rejection rate to under 5%. Affects Phase 11.

---

### DD-V2-275
**Area**: VFX — Dome-to-Mine Scale Transition
**Date**: 2026-03-03

**Context**: The dome operates at a large architectural scale and the mine operates at a character-level scale. Cutting directly between these contexts without a transitional animation makes the scale shift feel arbitrary and breaks spatial continuity. Players need a visual bridge that makes the transition feel intentional.

**Decision**: Zoom bridge animation in 3 steps: (1) Camera zooms into the dive hatch in the dome floor over 0.5 seconds. (2) Cross-fade from dome scene to a dark tunnel view over 0.3 seconds. (3) Tunnel opens into the mine's first frame. On surfacing, reverse the sequence. Creates a "portal" effect that makes the scale change feel deliberate and connected. Relevant for DD-V2-188 (DomeScene migration). Affects Phase 7, Phase 10.

---

### DD-V2-276
**Area**: Rendering — 1x CSS Resolution for Pixel Art
**Date**: 2026-03-03

**Context**: Modern mobile devices have 2x-3x DPI ratios. Rendering the Phaser canvas at native DPI would triple GPU fill rate (rendering at 96px tiles instead of 32px at 3x DPI) for no visible quality improvement, since pixel art scaled with nearest-neighbor filtering looks identical at any integer multiple.

**Decision**: Render the Phaser canvas at 1x CSS pixel resolution, not native device DPI. Use CSS image-rendering: pixelated to handle the upscale with correct nearest-neighbor interpolation. Optionally switch to the 256px hi-res sprite set at 2x rendering for tablets where additional crispness is visible. Never render at native DPI for pixel art content. Affects Phase 7, Phase 20.

---

### DD-V2-277
**Area**: Performance — 80-100MB Texture Memory Budget
**Date**: 2026-03-03

**Context**: Mobile devices typically allow 150-256MB GPU texture memory before performance degrades. With 25 biomes each requiring unique tilesets, loading all biome atlases simultaneously would exceed safe texture budgets on mid-range devices.

**Decision**: Use the 32px sprite set as the default mobile texture resolution (approximately 500 sprites = 2MB). Load only the current biome's atlas plus the shared UI atlas. Unload the previous biome atlas on biome transition. Consider a 64px intermediate sprite set (approximately 8MB for 500 sprites) as a quality/memory sweet spot for newer devices. Never load all 25 biome atlases simultaneously. Extends DD-V2-189. Affects Phase 7, Phase 9.

---

### DD-V2-278
**Area**: DevOps — Build-Time Asset Audit
**Date**: 2026-03-03

**Context**: At 500+ sprite assets, it becomes impossible to manually track which assets are referenced in code and which are orphaned. Orphaned assets waste bundle size. Code references to deleted or renamed assets cause runtime errors that TypeScript cannot catch since asset filenames are strings.

**Decision**: Automated audit script integrated into npm run build. The script scans all sprites under src/assets/sprites/, then searches the codebase (spriteManifest.ts, domeManifest, MineScene, Svelte components) for string references to each filename. Unreferenced sprite files produce a build warning. Code references to missing sprite files produce a build error that blocks the build. Cannot rely on human memory at 500+ assets. Affects Phase 18.

---

### DD-V2-279
**Area**: Art Direction — Special Block Silhouettes
**Date**: 2026-03-03

**Context**: Extending DD-V2-241 with a more explicit silhouette design specification. Gameplay-critical waypoint blocks must remain identifiable to players who learned their silhouette shape in early biomes with different palettes. The shape is the identifier; the palette is the decoration.

**Decision**: Gameplay-critical blocks (Quiz Gate, Descent Shaft, Exit Ladder) maintain their universal recognizable silhouette shape across all 25 biomes; only palette (rune color, frame material, glow hue) adapts to the host biome. Less critical discoverable blocks (Quote Stone, Relic Shrine) receive full biome-specific redesigns including shape changes. Guiding rule: if the player must find this block to progress, its silhouette is universal. Companion to DD-V2-241. Affects Phase 9.

---

### DD-V2-280
**Area**: Animation — Block Idle Animation Hybrid
**Date**: 2026-03-03

**Context**: The current block animation system uses Math.sin overlay for subtle glow pulsing on all animated blocks. This is low-cost but limited — it cannot represent shapes that change meaningfully over time (lava flow patterns, gas cloud swirl, shaft vortex). A hybrid approach assigns the right technique to the right animation type.

**Decision**: Use sprite-sheet frame cycling for blocks with distinct animation shapes: lava flow, gas cloud swirl, descent shaft vortex, and quiz gate barrier ripple. Keep Math.sin overlay exclusively for subtle glow pulsing on nodes that do not change shape: mineral nodes, relic shrines, and crystal glint highlights. Budget 4-6 frames per sprite-sheet animated type, using a shared global timer with per-tile phase offset seeded by grid position to prevent synchronized pulsing. Extends DD-V2-185. Affects Phase 7.7.

---

### DD-V2-281
**Area**: VFX — Scanner Proximity and Rarity Preview
**Date**: 2026-03-03

**Context**: Two related anticipation-building VFX systems that create excitement moments at different stages of play: scanner sonar communicates spatial proximity to the descent shaft, and rarity preview break effects build excitement in the 400ms window before a loot overlay appears. Both systems are consolidated here from their separate early design notes (DD-V2-258 and DD-V2-259) for implementation reference.

**Decision**: Scanner sonar pulse: radial ping wave emanating from player every 2 seconds when within 5-8 tiles of descent shaft; thin purple circle (0x6633cc, 30% opacity) fading as it expands; shaft tile glows briefly when wave passes. Available at scanner tier 2+. Loot rarity preview via escalating break effects before overlay: Common = standard break, Uncommon = larger burst plus green flash, Rare = blue burst plus 1-tile glow ring, Epic = purple burst plus expanding ring plus micro-shake, Legendary = gold burst plus 3-tile glow ring plus heavy shake plus 100ms freeze-frame. Both create anticipation moments that make discovery more exciting. Affects Phase 7.5.
