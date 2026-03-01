# Architecture Decision Records — Terra Miner

Log of key technical and design decisions with context and rationale. Newest first.

---

## Design Decisions (Game)

### DD-021: "The Sacrifice" Loot Loss Model
- **Date**: 2026-02-27
- **Context**: What happens to loot when oxygen runs out?
- **Decision**: Player gets a "sacrifice screen" where they choose which items to drop. Amount to drop scales with depth (deeper = drop more). Player has agency over what to keep.
- **Rationale**: Player agency prevents frustration from random loss. Depth-scaling creates real risk for deep dives. Creates memorable moments ("I saved the Legendary artifact but lost all my crystals"). Model B from our options — "The Sacrifice."

### DD-022: Biome Shuffling Per Run
- **Date**: 2026-02-27
- **Context**: Should layers always follow the same order?
- **Decision**: Biome order is randomized per run. Difficulty still scales with depth. Pool of 7+ biomes, each run draws 3-5 and shuffles them.
- **Rationale**: Massive replayability boost. Players can't memorize a fixed progression. Each run feels genuinely different. Combined with procedural generation for maximum variety.

### DD-023: Descent Shaft Layer Transitions with Entrance Challenges
- **Date**: 2026-02-27
- **Context**: How do players move between layers?
- **Decision**: Descent Shafts are visually distinct, detectable by scanner. Prompt shows layer name + oxygen bonus. Falling animation for transition. Each layer has an entrance challenge (3-question quiz gate or mini-puzzle).
- **Rationale**: Shafts make layer transitions a discoverable event, not just a depth counter. Entrance challenges make each new layer feel earned. Oxygen bonus on descent rewards the risk.

### DD-024: Card-Flip Study Sessions with Tree Growth
- **Date**: 2026-02-27
- **Context**: What does the study/review experience look like?
- **Decision**: Card flip UI (see question → think → flip to see answer → self-rate). Miner sits in comfy chair, helmet off. Knowledge Tree visible and reacts to correct answers (leaf shimmers/grows). Session size: 5-10 facts, player's choice. Calm, relaxed contrast to diving.
- **Rationale**: Card flip is the gold standard for spaced repetition UIs. The relaxed setting creates a deliberate contrast to the action of diving. Tree growth provides immediate visual feedback that learning has impact.

### DD-025: Pixel Art Illustration Per Fact with Greyscale-to-Color Mastery
- **Date**: 2026-02-27
- **Context**: Should facts have images?
- **Decision**: Every fact gets a unique pixel art illustration generated via ComfyUI. Images must NOT reveal the answer. Greyscale-to-color progression based on mastery level (new = grey, mastered = full color), mirroring the Knowledge Tree leaf system.
- **Rationale**: Visual learning reinforcement. Greyscale-to-color creates a tangible "unlock" feeling as you master each fact. GPU resources available via existing ComfyUI pipeline. Adds huge visual polish to the learning experience.

### DD-026: In-Run Quiz Gates Award Bonus Oxygen Tanks
- **Date**: 2026-02-27
- **Context**: How do mastery players earn free unlimited play?
- **Decision**: Quiz gates at milestones (5th, 10th, 15th, 20th gate passed) award bonus oxygen tanks. A perfect deep run can earn +4 tanks. Tanks are stored for future dives. Anti-spam: shallow gates give less oxygen, minimum entry cost always applies.
- **Rationale**: Creates a self-sustaining loop for knowledge masters. The better you learn, the more you can play, the more you learn. Milestone gates (not every gate) prevent exploitation.

### DD-027: Oxygen Only Buys Playtime — Economy Separate
- **Date**: 2026-02-27
- **Context**: Could mastery players bypass the mineral economy?
- **Decision**: Oxygen exclusively buys dive access. All upgrades, crafting, pets, cosmetics, and base building require minerals. Mastery players have unlimited playtime but still need to engage with mining/economy for progression.
- **Rationale**: Prevents mastery from trivializing the entire game. Unlimited play ≠ unlimited power. Maintains the economic loop for all player types.

### DD-028: GAIA (Geological Analytical Intelligence Assistant) as AI Companion
- **Date**: 2026-02-27
- **Context**: Should the codex have personality? What should it be called?
- **Decision**: Named GAIA ("guy-ah"). Quirky, knowledge-hungry AI companion with cutesy pixel art avatar. Comments on artifacts, connections between facts, tree growth. Has a pre-generated snarky comment for every single fact. Random quips when idle. Personality: enthusiastic, nerdy, slightly obsessive. Chattiness: 4-5/10. Never annoying.
- **Rationale**: Adds character and warmth to the game. Makes the codex feel alive, not just a database. Creates moments of delight. Reinforces the "rediscovering knowledge" theme with genuine enthusiasm.

### DD-029: Ambient Environmental Storytelling in the Mine
- **Date**: 2026-02-27
- **Context**: Should the mine have atmospheric text?
- **Decision**: Subtle flavor text appears when mining certain blocks or entering special areas. Brief (1-2 sentences), evocative, low frequency. Different biomes have different themes. Not facts to learn — just atmosphere.
- **Rationale**: Enriches the world without adding learning load. Reinforces the "far-future Earth" setting. Makes the mine feel like a real place with history, not just a resource grid.

### DD-030: Language Learning Schema Designed Early
- **Date**: 2026-02-27
- **Context**: Should we design for language learning now or later?
- **Decision**: The fact schema includes `type` field (fact/vocabulary/grammar/phrase) and optional language-specific fields from the start. Knowledge Tree has a planned "Languages" branch.
- **Rationale**: Bolting on language learning later would require schema migration and system redesign. Designing the schema now is cheap and ensures language learning is a natural extension of the existing system.

### DD-032: Unique Procedural Generation Per Biome
- **Date**: 2026-02-28
- **Context**: Should biomes have distinct generation algorithms?
- **Decision**: Yes. Each biome has structurally unique generation (Sedimentary = horizontal fossil bands, Volcanic = lava rivers, Crystalline = open gem caverns, etc.). Not just palette swaps.
- **Rationale**: Biomes feeling genuinely different is critical for replayability. Combined with biome shuffling, this ensures each run looks AND plays differently.

### DD-033: Pathfinding Validation During Mine Generation
- **Date**: 2026-02-28
- **Context**: Can players get stuck in the mine?
- **Decision**: Run pathfinding validation during procedural generation. Ensure no sealed pockets of unbreakable blocks. All areas must be reachable.
- **Rationale**: Getting stuck with no way forward is the worst possible player experience. Validation is cheap at generation time and prevents frustration.

### DD-034: Spelunky-Style Micro-Structures in Procedural Mines
- **Date**: 2026-02-28
- **Context**: How to make procedural generation feel hand-crafted?
- **Decision**: Pre-designed micro-structures (ancient libraries, crystal caverns, rest alcoves, quote stones) are embedded within procedural grids. Biome-appropriate pool, not every layer has one.
- **Rationale**: Micro-structures create memorable moments within procedural variety. The Spelunky approach is proven to make generated levels feel designed.

### DD-035: Empty Caverns with Readable Content
- **Date**: 2026-02-28
- **Context**: The mine needs pacing — not just block after block.
- **Decision**: Pre-cleared caverns serve as "rest stops" with upgrade crates, oxygen caches, or readable content (famous quotes, philosophical passages — enrichment, not quiz material).
- **Rationale**: Pacing is critical for session enjoyment. Constant dense mining is exhausting. Breathing rooms with readable content fit the knowledge theme.

### DD-036: Descent Shaft Requires Exploratory Search
- **Date**: 2026-02-28
- **Context**: Where does the layer transition appear?
- **Decision**: Not at the bottom — placed randomly (biased lower half). Scanner detects it. Finding the shaft IS part of the gameplay.
- **Rationale**: Exploration is rewarded. Players balance "keep mining" vs "find the exit." Scanner becomes more valuable.

### DD-037: Darkest Dungeon-Style Backpack with Stacking
- **Date**: 2026-02-28
- **Context**: Tetris shapes or something else for inventory?
- **Decision**: Darkest Dungeon-inspired slot system with stacking. Dust stacks 50/slot, Shards 20, Crystals 5, Core Fragments 2, Primordial Essence 1. Artifacts take 1-3 slots by rarity. Fossils take 3 slots. Items can be rotated. Auto-place first, manual rearrange available.
- **Rationale**: Stacking creates natural value tiers (rare items take proportionally more space). Simpler to implement than Tetris shapes while maintaining meaningful inventory decisions. Darkest Dungeon proved this system works.

### DD-038: The Decision Screen (Two-Panel Loot Management)
- **Date**: 2026-02-28
- **Context**: How does the player manage a full backpack when finding new loot?
- **Decision**: Split-screen: left panel shows new items on a stone slab with cloth ("The Cloth"), right panel shows current backpack. Player drags between them. Walking away = items on cloth lost forever.
- **Rationale**: Visual clarity for the most important micro-decisions in the game. The stone slab/cloth visual adds ceremony to loot moments. Walking away = permanent loss creates urgency without time pressure.

### DD-039: Per-Layer Send-Up Slots
- **Date**: 2026-02-28
- **Context**: How can players secure loot before going deeper?
- **Decision**: At each Descent Shaft (before descending), player can "send up" items to surface for safekeeping. Slots scale with depth: Layer 1→2 gets 1 slot, Layer 2→3 gets 2, etc. Sent items are guaranteed safe even if oxygen runs out later.
- **Rationale**: Brilliant strategic layer. "Do I send up this Rare artifact now (safe) or gamble deeper?" Reduces sting of oxygen depletion. Creates compound decisions at every layer boundary. Rewards careful players.

### DD-040: GAIA Named "Geological Analytical Intelligence Assistant"
- **Date**: 2026-02-28
- **Context**: The computer companion needs a name and identity.
- **Decision**: GAIA ("guy-ah"), cutesy pixel art avatar with expressive face. Every fact has a pre-generated snarky GAIA comment. Visual mnemonics offered when player struggles.
- **Rationale**: A named, visible companion creates emotional attachment. Pre-generated comments ensure personality without runtime AI cost. Mnemonics directly support the learning mission.

### DD-041: Snarky GAIA Comment Per Fact + Visual Mnemonics
- **Date**: 2026-02-28
- **Context**: How to make artifact ingestion feel personal?
- **Decision**: Every fact has a `gaia_comment` field generated during the content pipeline. Shown during gacha reveal. Also: `mnemonic` field with visual/verbal memory aids, offered by GAIA when player struggles.
- **Rationale**: Personality is content. Each fact feels like a conversation with GAIA, not just a database entry. Mnemonics are proven to dramatically improve retention.

### DD-042: Age Rating System (KID/TEEN/ADULT)
- **Date**: 2026-02-28
- **Context**: Facts range from universally safe to politically sensitive.
- **Decision**: Three age tiers selected at first launch (KID/TEEN/ADULT). Each fact has `age_rating` and `sensitivity_level` fields. Core safe set available to all before preferences set. Honor system, not gate-kept.
- **Rationale**: Widens audience from children to adults. Allows mature content (history, science) without alienating younger players. Category system + age rating = self-selecting content.

### DD-043: Handcrafted First Mine + Slow Progressive Dome Unlocks
- **Date**: 2026-02-28
- **Context**: How to handle onboarding and base progression?
- **Decision**: First mine is handcrafted (guaranteed layout, teaching moments). Dome unlocks progressively: Dive 1 = artifact + fossil. Dive 2 = Knowledge Tree seed. Dive 3 = GAIA codex. Dive 4+ = Materializer, more areas. Always something new.
- **Rationale**: Handcrafted first experience ensures quality first impression. Slow unlocks create anticipation and reward repeated play. Each dive has a "new thing to discover at base."

### DD-044: Fact Voice — Concise Statement + Separate Wow Factor
- **Date**: 2026-02-28
- **Context**: How should facts be written for Anki effectiveness?
- **Decision**: Core `statement` is clear and concise (Anki-optimized for memorization). Separate `wow_factor` field has the mind-blowing framing (shown during gacha reveal). Quiz tests the concise statement.
- **Rationale**: Anki works best with clear, atomic facts. But discovery needs spectacle. Separating these serves both goals — clean quizzes AND exciting reveals.

### DD-045: Fact Source Credits Shown to Player
- **Date**: 2026-02-28
- **Context**: Should facts cite their sources?
- **Decision**: Yes. Source name shown on fact card detail view. Not during quizzes (would clutter).
- **Rationale**: Builds trust. Teaches source literacy. Distinguishes Terra-Gacha from trivia games with unverified content.

### DD-046: Japanese N3 Vocabulary as First Test Content
- **Date**: 2026-02-28
- **Context**: What content to start testing with?
- **Decision**: Generate initial test facts using Japanese JLPT N3 vocabulary. Distractors are semantically similar words (easy to auto-generate for vocabulary). No images needed for vocab. Enables testing core loop immediately.
- **Rationale**: Language vocabulary is the easiest content type to generate at scale (distractors from same-domain word lists). Tests the language learning schema early. Personally motivating for the developer.

### DD-031: Small Viewport, Centered Miner, No Minimap
- **Date**: 2026-02-27
- **Context**: How much of the mine should the player see?
- **Decision**: Small viewport (~10-12 tiles visible per direction), miner always centered, no minimap. Player can scroll within current layer to review explored areas.
- **Rationale**: Small viewport creates claustrophobia and tension. Makes the scanner upgrade genuinely valuable. No minimap preserves the feeling of exploration over information. Centering on the miner keeps the experience intimate.

### DD-001: Motherload-Style 2D Side-View Mining
- **Date**: 2026-02-27
- **Context**: Need to decide on mining perspective and movement model.
- **Decision**: 2D side-view cross-section (like Motherload/Terraria). No gravity — player moves freely in all directions.
- **Rationale**: Motherload is a proven, beloved format for mining games. No gravity allows strategic pathing in all directions, making exploration more interesting. Free movement means the player's choices determine their path, not physics.

### DD-002: Roguelite Run Structure with Point-of-No-Return Layers
- **Date**: 2026-02-27
- **Context**: How should dive progression work?
- **Decision**: Each dive is a self-contained roguelite run. Mine is divided into layers with point-of-no-return boundaries. Descending is a permanent commitment per run.
- **Rationale**: Creates meaningful risk/reward decisions at every layer boundary. Forces players to weigh "safe loot" vs "better loot deeper." Core to roguelite tension. Inspired by Spelunky/Inscryption commitment mechanics.

### DD-003: Weak Start, Strong In-Run Upgrades
- **Date**: 2026-02-27
- **Context**: How much should permanent upgrades vs. in-run upgrades matter?
- **Decision**: Permanent base upgrades are deliberately limited (slight starting improvements). In-run upgrades are the primary power source. All in-run upgrades lost after each run.
- **Rationale**: This ensures every run feels fresh and exciting regardless of player tenure. The discovery of upgrades during the run IS the fun. Prevents veterans from trivializing content through accumulated power.

### DD-004: Tetris-Style Backpack Inventory
- **Date**: 2026-02-27
- **Context**: How should inventory work during dives?
- **Decision**: Items have physical shapes that must fit into a small grid (Tetris/Resident Evil 4 style). Starting size is very small, expandable via permanent and in-run upgrades. Dropped items are lost forever.
- **Rationale**: Creates constant micro-decisions about what to keep. Physical shapes make rare items (bigger = more valuable) harder to carry, amplifying trade-off tension. Lost-forever drops prevent "I'll come back for it" — every decision is final.

### DD-005: Oxygen as Fuel with Time-Gated Refill
- **Date**: 2026-02-27
- **Context**: How to limit play sessions and create monetization opportunity?
- **Decision**: Oxygen (fuel) is time-gated, refilling from first daily login. Players allocate oxygen to dives (more = longer run). Mastery of quiz system can earn enough bonus oxygen for unlimited play. Subscription offers unlimited oxygen.
- **Rationale**: Time-gating creates daily return habit. Oxygen allocation adds pre-dive strategy. Mastery-based unlimited play rewards the learning goal. Subscription is ethical monetization that doesn't gate knowledge.

### DD-006: Artifacts as the Knowledge Delivery System
- **Date**: 2026-02-27
- **Context**: How do players encounter facts to learn?
- **Decision**: Facts are wrapped in artifacts found during mining. Artifacts show rarity + category hint before opening. They take backpack space, competing with minerals. Most must be carried back to base; some can be scanned mid-dive with upgrades.
- **Rationale**: Wrapping facts in physical loot items ties learning to the gacha/collection dopamine loop. Backpack competition with minerals creates a meaningful "learn vs earn" choice. Category hints let players hunt topics they're interested in.

### DD-007: SM-2 Spaced Repetition, Hidden from Player
- **Date**: 2026-02-27
- **Context**: How to implement the Anki-style learning system?
- **Decision**: Use SM-2 algorithm internally. Player-facing interface is simple (right/wrong, possibly easy/hard modifier). Algorithm complexity is entirely hidden.
- **Rationale**: SM-2 is the gold standard for spaced repetition effectiveness. Exposing the algorithm would feel like homework. Players just see "review these facts" — the system handles optimal scheduling invisibly.

### DD-008: Knowledge Tree as Permanent Visual Progression
- **Date**: 2026-02-27
- **Context**: How to represent learning progress?
- **Decision**: A visual tree at the center of the dome. Leaves = mastered facts, branches = categories. Leaf color reflects mastery level. Leaves wilt when facts are forgotten but regrow easily. Tree is permanent — never reset.
- **Rationale**: Creates a beautiful, personalized, shareable visualization of what the player has learned. Wilting leaves provide gentle review nudges. Permanent progression ensures learning is never lost, unlike run-based gear.

### DD-009: Fossil Pets and Base as Hub
- **Date**: 2026-02-27
- **Context**: What does the player do between dives?
- **Decision**: Dome serves as hub. Players can revive fossilized animals into pets, manage a farm, display a zoo, view their Knowledge Tree, craft at the Materializer, and host visitors.
- **Rationale**: Gives long-term investment outside of runs. Fossil revival ties into the "rediscovering Earth" narrative. Farm provides passive resource income. Social visiting creates community and showing off.

### DD-010: Achievement Paintings
- **Date**: 2026-02-27
- **Context**: How to reward milestone achievements?
- **Decision**: Achievements unlock pixel art versions of famous paintings/posters related to the achievement category. Displayed in a Gallery in the dome.
- **Rationale**: Unique reward that's visually exciting, culturally relevant, and ties back to the knowledge theme. Collectible and shareable. Creates a secondary collection goal beyond the Knowledge Tree.

### DD-012: Per-Action Oxygen (No Real-Time Pressure)
- **Date**: 2026-02-27
- **Context**: How should oxygen (fuel) deplete during dives?
- **Decision**: Oxygen depletes per action only (mining, moving, quiz attempts, hazards). No real-time countdown. Players can think as long as they want.
- **Rationale**: This is a learning game. Time pressure contradicts the goal of thoughtful quiz answers. Per-action depletion creates strategic oxygen management without rushing. Combined with layer oxygen recovery bonuses.

### DD-013: ~25 Distractors Per Fact (Prevent Answer Memorization)
- **Date**: 2026-02-27
- **Context**: Standard quiz games use 3 fixed wrong answers. Players memorize which answers are wrong instead of learning the right one.
- **Decision**: Each fact has a pool of ~25 plausible distractors. Each quiz shows 1 correct + 3 randomly selected from the pool.
- **Rationale**: With 25 distractors, a fact can be quizzed hundreds of times before repeating the same distractor set. This forces players to actually *know* the answer, which is the entire point. Critical for spaced repetition integrity.

### DD-014: Multiple Gacha Moments at Different Scales
- **Date**: 2026-02-27
- **Context**: Where should the gacha dopamine hit happen?
- **Decision**: Three distinct gacha moments: artifact reveal (frequent, moderate spectacle), dive reward chest (per-run, medium spectacle), and pet synthesis (rare, maximum spectacle). Visual/audio escalates with rarity.
- **Rationale**: Multiple gacha moments at different frequencies keeps the dopamine loop active throughout all play modes — not just during specific moments.

### DD-015: Artifact Rarity on Container, Not Fact
- **Date**: 2026-02-27
- **Context**: Should facts be "rare" or should their containers be?
- **Decision**: Rarity belongs to the artifact container. Facts are knowledge and aren't inherently rare. Higher rarity container = more interesting/memorable fact inside.
- **Rationale**: Philosophically, knowledge shouldn't be "rare." The delivery mechanism can be. This also keeps the gacha moment clean: you're excited about the artifact quality, not the fact's "tier."

### DD-016: Binding of Isaac-Style Passive In-Run Upgrades
- **Date**: 2026-02-27
- **Context**: How should in-run upgrades feel?
- **Decision**: Primarily passive relics that auto-apply as buffs. Players accumulate a unique combination each run. Synergies between items are designed from the start.
- **Rationale**: Passive relics are simple to understand, create emergent complexity through synergies, and make every run feel different based on what you find. Incredible players can build powerful combos but nobody becomes invincible.

### DD-017: Knowledge-Gated Pet Revival
- **Date**: 2026-02-27
- **Context**: Should reviving fossilized animals have requirements beyond minerals?
- **Decision**: Yes — reviving an animal requires learning X facts in the related knowledge category, plus minerals. e.g., T-Rex requires 10 Paleontology facts + 500 Crystals.
- **Rationale**: This is the strongest bridge between the knowledge system and base progression. Players are incentivized to keep artifacts, study, and grow their Knowledge Tree to unlock exciting pets. Each pet tells a story of learning.

### DD-018: Fossil Choice in First Run (Onboarding Hook)
- **Date**: 2026-02-27
- **Context**: How to hook the player in the first 5 minutes?
- **Decision**: First run guarantees a fossil find. Player chooses animal type ("feline?", "canine?", etc.). Immediately shown: "Learn 10 facts about [type] to revive!" — clear, exciting, achievable goal.
- **Rationale**: Gives the player an emotional attachment in the first session. The pet goal creates an immediate reason to keep artifacts and engage with the learning system. First artifact is also guaranteed Rare+ for a wow-factor fact.

### DD-019: Dust → Shard → Crystal → Core Fragment → Primordial Essence
- **Date**: 2026-02-27
- **Context**: What to name mineral currency tiers?
- **Decision**: Evocative era-themed names: Dust (common), Shard, Crystal, Core Fragment, Primordial Essence (legendary). 100:1 conversion between tiers.
- **Rationale**: Names are evocative and thematic ("the deeper you go, the more primordial the material"). Avoids boring real mineral names while maintaining the geological theme.

### DD-020: Duplicate Fact Mixing at Materializer
- **Date**: 2026-02-27
- **Context**: What to do with duplicate or unwanted facts?
- **Decision**: Multiple options: trade with players (future), mix at Materializer to reroll into a new potentially-higher-rarity artifact, or auto-convert to minerals. Players can also flag facts as "not interesting" for quality feedback.
- **Rationale**: Mixing duplicates into new artifacts is itself a gacha moment, keeping the loop engaging even with unwanted finds. The quality feedback loop helps improve the fact database over time.

### DD-011: Free-to-Play with Learning Never Paywalled
- **Date**: 2026-02-27
- **Context**: Monetization model.
- **Decision**: Free to play. Knowledge and learning are never paywalled. Revenue via subscription (unlimited oxygen) and premium cosmetic Materializer. Skilled learners can play for free indefinitely through quiz mastery bonuses.
- **Rationale**: The core mission is making learning addictive. Paywalling knowledge would contradict this. The mastery → free play loop means the best learners are rewarded with the most playtime, which is the ideal outcome.

---

## Technical Decisions

### ADR-001: Vite + Svelte + TypeScript for UI Layer
- **Date**: 2026-02-27
- **Context**: Need a frontend framework for menus, HUD, and quiz overlays around the Phaser game canvas.
- **Decision**: Svelte 5 with TypeScript, built with Vite 7.
- **Rationale**: Svelte compiles away at build time (tiny runtime), excellent Vite integration, minimal attack surface from fewer runtime dependencies, strong TypeScript support. Game rendering is 100% Phaser — Svelte only handles DOM UI.
- **Alternatives Considered**: React (heavier runtime, more deps), Vue (similar but less compile-time optimization), Vanilla TS (more boilerplate for quiz UI).

### ADR-002: Phaser 3 for Game Engine
- **Date**: 2026-02-27
- **Context**: Need a 2D game engine that runs in the browser and supports mobile.
- **Decision**: Phaser 3.
- **Rationale**: Most mature 2D web game framework, large community, excellent documentation, built-in tilemap support, mobile-optimized input handling, active development.
- **Alternatives Considered**: PixiJS (lower-level, more boilerplate), Kaboom.js (less mature), raw Canvas API (too much effort).

### ADR-003: Capacitor for Mobile Packaging
- **Date**: 2026-02-27
- **Context**: Need to package the web game as a native Android app (iOS later).
- **Decision**: Capacitor (Ionic).
- **Rationale**: Best ecosystem for wrapping web apps in native shells, access to native APIs (storage, haptics, push notifications), official Vite plugin, well-documented migration path.
- **Alternatives Considered**: Tauri Mobile (newer, less stable for mobile), TWA (limited native access).

### ADR-004: ComfyUI for Sprite Generation
- **Date**: 2026-02-27
- **Context**: Need agent-orchestratable pixel art sprite generation with transparent backgrounds.
- **Decision**: ComfyUI running locally in API mode with SDXL + pixel-art-xl LoRA.
- **Rationale**: REST API enables automation, node-based workflows are reproducible, runs on available RTX 3060 12GB, supports background removal nodes. SD 1.5 also available as fallback for faster generation.
- **Hardware**: RTX 3060 12GB VRAM, CUDA 13.1.

### ADR-005: Backend API with Fastify + TypeScript
- **Date**: 2026-02-27
- **Context**: Quiz data needs a backend for community contributions, progress tracking, and future multiplayer.
- **Decision**: Fastify + TypeScript, containerized with Docker.
- **Rationale**: Same language as frontend (TypeScript everywhere), Fastify has excellent performance and schema-based validation (security), Docker ensures portable deployment to any hosting provider.
- **Status**: Planned, not yet implemented. Starting with local JSON seed data.

### ADR-006: Online with Caching for Offline Support
- **Date**: 2026-02-27
- **Context**: Mobile game needs to work with intermittent connectivity.
- **Decision**: Online-first with aggressive caching via Service Worker.
- **Rationale**: Allows community quiz content and progress sync while remaining playable offline. Pre-fetch quiz batches, cache all assets, sync on reconnect.
