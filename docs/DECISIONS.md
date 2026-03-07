# DD-V2 Decision Index

Canonical index of V2 design decisions sourced from `docs/DESIGN-DECISIONS-V2.md`.
Each entry includes a one-line summary and a roadmap phase cross-reference for implementation lookup.

## Quick Reference (High Impact)

| ID | Category | One-line Summary | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-001 | Content Pipeline | Create an API endpoint for fact ingestion that performs the following steps automatically: ... | PHASE-26-PRODUCTION-BACKEND |
| DD-V2-008 | Visuals | Implement Terraria-style autotiling with bitmasking. | PHASE-07-VISUAL-ENGINE |
| DD-V2-011 | Visuals | Implement full character animation with the following sprite sheets: ... | PHASE-29-CHARACTER-ANIMATION |
| DD-V2-012 | Visuals | Implement block idle animations including: ... | Cross-cutting (multiple phases) |
| DD-V2-014 | Visuals | Each of the 25 biomes needs its own unique tile sprite set. | PHASE-33-BIOME-VISUAL-DIVERSITY |
| DD-V2-019 | Visuals | All upgrades must be visually reflected in the hub. | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-023 | Gameplay | Layer sizes scale progressively. | PHASE-08-MINE-GAMEPLAY |
| DD-V2-031 | Learning | Fact spawning is weighted based on player interest preferences. | PHASE-12-INTEREST-PERSONALIZATION |
| DD-V2-043 | Platform | The game is fully locally playable. | Cross-cutting (multiple phases) |
| DD-V2-052 | Gameplay | The descent shaft is randomly placed anywhere in the layer, not restricted to the bottom half or any bounded sub-region. | PHASE-08-MINE-GAMEPLAY |
| DD-V2-055 | Gameplay | Every 5th layer has a distinct structural identity that differentiates it from standard layers. | Cross-cutting (multiple phases) |
| DD-V2-064 | Gameplay | A single lava entity - regardless of how many blocks wide it currently occupies - expands by exactly ONE block per movement tick. | Cross-cutting (multiple phases) |
| DD-V2-085 | Content Pipeline | Build a "fact extraction prompt" that takes highlighted passages from books or Wikipedia and outputs the full fact JSON schema. | Cross-cutting (multiple phases) |
| DD-V2-112 | Narrative and Companion | Three-tier failure escalation. | Cross-cutting (multiple phases) |
| DD-V2-135 | Gameplay | Design for two distinct session profiles. | PHASE-18-DEV-TOOLING |
| DD-V2-169 | Learning | Post-launch only, and only after consumer retention proves strong. | Cross-cutting (multiple phases) |
| DD-V2-199 | Architecture | Two-pronged: (1) visibilitychange + Capacitor App.addListener('appStateChange') triggers immediate sync bypassing debounce. | PHASE-19-AUTH-CLOUD |
| DD-V2-205 | Architecture | Migrate from PBKDF2-SHA512 to Argon2id via argon2 npm package. | PHASE-19-AUTH-CLOUD |
| DD-V2-218 | Architecture | Multi-stage Dockerfile: Stage 1 builds TypeScript + native deps. | PHASE-20-MOBILE-LAUNCH |
| DD-V2-250 | Visuals | Parabolic arc with random initial velocity (30-80 degrees upward, 60-120 px/sec), 2-3 diminishing bounces, hold for 200ms, then... | Cross-cutting (multiple phases) |

## Full Index by Category

### Gameplay (44)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-021 | Layer transitions require: ... | Mine - Layer Transitions | PHASE-08-MINE-GAMEPLAY |
| DD-V2-022 | Maximum 20 layers. Remove the point-of-no-return mechanic entirely. Depth is measured only in layers - within a single layer ev... | Mine - Layer Count and Depth Model | PHASE-08-MINE-GAMEPLAY |
| DD-V2-023 | Layer sizes scale progressively. | Mine - Layer Sizing | PHASE-08-MINE-GAMEPLAY |
| DD-V2-024 | The descent shaft becomes harder to find in deeper layers. | Mine - Descent Shaft Placement | PHASE-08-MINE-GAMEPLAY |
| DD-V2-025 | Add a mini-map showing explored areas. | Mine - Camera and Mini-Map | PHASE-08-MINE-GAMEPLAY |
| DD-V2-038 | Use pixel art panels generated via ComfyUI to tell an incredible backstory during the intro sequence. | Onboarding - Intro Screens | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-040 | The tutorial is approximately 5 minutes total and very detailed. | Onboarding - Tutorial Length and Content | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-041 | Interest assessment is woven into the tutorial. | Onboarding - Interest Assessment Integration | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-050 | Implement crop fossils - find fossils of crops underground and learn about them. | Fossils / Farm - Species Facts | PHASE-16-FOSSIL-FARMING-EXPANSION |
| DD-V2-051 | ALL game systems use movement/action-based timing, never real-time seconds. | Core Mechanics - Time Model | Cross-cutting (multiple phases) |
| DD-V2-052 | The descent shaft is randomly placed anywhere in the layer, not restricted to the bottom half or any bounded sub-region. | Mine - Descent Shaft Placement | PHASE-08-MINE-GAMEPLAY |
| DD-V2-053 | No New Game+ system. Layer 20 is a milestone reward, not a conclusion. Each time a player finishes layer 20, one event is selec... | Mine - Endgame and Layer 20 | PHASE-48-PRESTIGE-ENDGAME |
| DD-V2-054 | Use discrete stepped tiers instead of linear scaling: Layers 1-5 at 20×20, Layers 6-10 at 25×25, Layers 11-15 at 30×30, Layers... | Mine - Grid Scaling | Cross-cutting (multiple phases) |
| DD-V2-055 | Every 5th layer has a distinct structural identity that differentiates it from standard layers. | Mine - Layer Design Identity | Cross-cutting (multiple phases) |
| DD-V2-056 | Layer 1: player always spawns top-center with a 3×3 area pre-cleared. | Mine - Player Spawn Position | Cross-cutting (multiple phases) |
| DD-V2-057 | Implement a depth-based block distribution curve. | Mine - Block Distribution by Depth | Cross-cutting (multiple phases) |
| DD-V2-058 | Replace some unbreakable blocks with conditionally breakable variants. | Mine - Block Types | Cross-cutting (multiple phases) |
| DD-V2-059 | Group biomes into four depth tiers: Shallow (layers 1-5, 5 biomes), Mid (layers 6-10, 5 biomes), Deep (layers 11-15, 5 biomes),... | Mine - Biome Assignment | Cross-cutting (multiple phases) |
| DD-V2-060 | Implement movement-based active hazards: lava entities that expand outward and gas clouds that drift toward the player. | Hazards - Active Threats | Cross-cutting (multiple phases) |
| DD-V2-061 | Implement oxygen cost scaling by depth. | Mine - Tension Mechanic | Cross-cutting (multiple phases) |
| DD-V2-063 | Expand to 4-5 consumable types with a total carry limit of 5 slots across all types. | Items - Consumable Tools | Cross-cutting (multiple phases) |
| DD-V2-064 | A single lava entity - regardless of how many blocks wide it currently occupies - expands by exactly ONE block per movement tick. | Hazards - Lava Behavior | Cross-cutting (multiple phases) |
| DD-V2-066 | Implement a movement/action-based instability meter per layer. | Mine - Layer Urgency | Cross-cutting (multiple phases) |
| DD-V2-069 | Recipes are discovered in the mine, not pre-unlocked. | Crafting - Recipe Acquisition | Cross-cutting (multiple phases) |
| DD-V2-073 | Add a dedicated "Preparation" screen that appears before each dive. | UI - Pre-Dive Preparation | Cross-cutting (multiple phases) |
| DD-V2-074 | Add an "Auto-Compress" backpack upgrade that automatically converts 50 dust into 1 shard while mining, without player intervent... | Inventory - Backpack Upgrade | Cross-cutting (multiple phases) |
| DD-V2-075 | Rename the mechanic to "Offering." Ancient Altar structures appear in the mine as discoverable structures. | Mine - Structures and Offering Mechanic | Cross-cutting (multiple phases) |
| DD-V2-076 | Expand the Knowledge Store to 20 or more purchasable powerups. | Knowledge Store - Powerup Expansion | PHASE-21-MONETIZATION |
| DD-V2-081 | Implement 3 relic rarity tiers. | Relics - Rarity Tiers | Cross-cutting (multiple phases) |
| DD-V2-084 | The streak system rewards daily consistency above session intensity. | Streaks - Design Philosophy | Cross-cutting (multiple phases) |
| DD-V2-135 | Design for two distinct session profiles. | Session Design - Dual Session Profiles | PHASE-18-DEV-TOOLING |
| DD-V2-136 | Auto-save exact mine state on force-quit or app backgrounding. | Session Design - Mid-Dive Auto-Save | Cross-cutting (multiple phases) |
| DD-V2-137 | Post-dive hooks are strictly informational: "3 more facts to unlock Trilobite revival," "Your Biology branch is at 48%," "Unfin... | Session Design - Informational Engagement Hooks | PHASE-18-DEV-TOOLING |
| DD-V2-142 | Show a gentle count ("12 facts ready for review") but never show countdown timers or red urgency indicators. | Session Design - Gentle Review Pressure | Cross-cutting (multiple phases) |
| DD-V2-144 | Add a 7-day rotating login reward calendar with escalating value: Day 1 = 50 dust, Day 2 = 1 bomb, Day 3 = 100 dust, Day 4 = st... | Daily Loop - Login Reward Calendar | Cross-cutting (multiple phases) |
| DD-V2-154 | Target 3,000 facts minimum before opening subscriptions. | Content Strategy - Minimum Facts Before Subscriptions | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-156 | Front-load rewards: first fossil guaranteed by dive 2, first pet revived by dive 4 (reduced knowledge requirement for first spe... | Retention - Early Churn Mitigation | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-158 | Reframe streak breaks entirely. | Retention - Positive Streak Reframing | Cross-cutting (multiple phases) |
| DD-V2-159 | Maximum 1 push notification per day, only if the player has not opened the app. | Retention - Push Notification Strategy | Cross-cutting (multiple phases) |
| DD-V2-160 | External triggers bring back churned players. | Retention - Win-Back Strategy | Cross-cutting (multiple phases) |
| DD-V2-166 | Five priority keywords: (1) "mining game" (high volume, moderate competition), (2) "pixel art adventure" (enthusiast audience,... | Market Position - ASO Keywords | PHASE-20-MOBILE-LAUNCH |
| DD-V2-170 | Optional late-game feature, not a priority for early phases. | Community - User-Generated Facts | Cross-cutting (multiple phases) |
| DD-V2-177 | Support up to 4 player profiles per device. | Platform - Multiple Player Profiles | PHASE-19-AUTH-CLOUD |
| DD-V2-178 | Launch requirements: (1) Colorblind-safe rarity indicators using shapes AND colors, not colors alone (current rarity relies pur... | Accessibility - Launch vs Post-Launch | PHASE-20-MOBILE-LAUNCH |

### Learning (62)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-017 | The Knowledge Tree is a clickable physical object in the starter hub. | Dome - Knowledge Tree as Physical Object | PHASE-53-KNOWLEDGE-TREE-VITALITY |
| DD-V2-026 | Every layer must have exactly 1 quiz gate in a sealed room. | Quiz - Gate Placement | PHASE-64-STUDY-QUIZ-POLISH |
| DD-V2-027 | Increase pop quiz rate to 8-10% (up from the current 4%). | Quiz - Pop Quiz Rate | PHASE-64-STUDY-QUIZ-POLISH |
| DD-V2-028 | Fill-in-blank, true/false, image-based, and audio-based quiz formats are nice-to-have for the far future. | Quiz - Additional Formats | Cross-cutting (multiple phases) |
| DD-V2-029 | Full-screen overlay style is the correct approach and is better than inline. | Quiz - Display Style | Cross-cutting (multiple phases) |
| DD-V2-030 | Build a large settings page for interests. | Interests - Settings Page | PHASE-12-INTEREST-PERSONALIZATION |
| DD-V2-031 | Fact spawning is weighted based on player interest preferences. | Interests - Weighted Fact Spawning | PHASE-12-INTEREST-PERSONALIZATION |
| DD-V2-032 | Each Knowledge Tree branch needs sub-branches that are interactively added based on new cards found in-game. | Knowledge Tree - Sub-Branches | PHASE-53-KNOWLEDGE-TREE-VITALITY |
| DD-V2-048 | Add a toggle button for all available leaves vs all even remotely learned facts. | Knowledge Tree - Visualization and Interaction | PHASE-53-KNOWLEDGE-TREE-VITALITY |
| DD-V2-049 | Tapping a leaf in the Knowledge Tree shows the fact interactively. | Knowledge Tree - Leaf Interaction | PHASE-53-KNOWLEDGE-TREE-VITALITY |
| DD-V2-062 | When the player is hit by a hazard, a fact question is presented. | Hazards - Quiz Integration | Cross-cutting (multiple phases) |
| DD-V2-068 | Deep diving requires earned preparation across three dimensions: (1) quiz performance must be viable, requiring the player to h... | Progression - Depth Gating | PHASE-28-PERFORMANCE-OPTIMIZATION |
| DD-V2-070 | Great runs - where the player answers quizzes correctly and finds synergistic upgrades - must feel POWERFULLY different from av... | Core Design - Run Power Philosophy | Cross-cutting (multiple phases) |
| DD-V2-071 | REJECTED. Quizzes must be fact-agnostic - the same quiz can appear at any depth. Difficulty is scaled through other means: dist... | Quiz - Difficulty Scaling | Cross-cutting (multiple phases) |
| DD-V2-077 | Implement an in-run quiz streak multiplier. | Quiz - Reward Scaling | Cross-cutting (multiple phases) |
| DD-V2-078 | Add "Fact Fragments" - when mining certain blocks, a single-line fact briefly appears on screen for approximately 2 seconds wit... | Knowledge - Non-Quiz Learning Moments | Cross-cutting (multiple phases) |
| DD-V2-079 | Follow Anki's established model exactly for managing the new-to-review ratio. | SM-2 - Review Queue Management | PHASE-26-PRODUCTION-BACKEND |
| DD-V2-095 | Three buttons in study sessions: "Easy" (quality=5, pushes interval out faster), "Got it" (quality=4, standard progression), "D... | SM-2 - Study Session Button Count | Cross-cutting (multiple phases) |
| DD-V2-096 | Change the second interval from 6 days to 3 days. | SM-2 - Second Interval Length | Cross-cutting (multiple phases) |
| DD-V2-097 | Consistency penalty ONLY applies to facts where the player has studied calmly (study session or ritual) AND has repetitions >= 2. | SM-2 - Consistency Penalty Context | Cross-cutting (multiple phases) |
| DD-V2-098 | Two mastery profiles. General facts: new (0), learning (1-3d), familiar (4-14d), known (15-60d), mastered (60d+). Language voca... | SM-2 - Mastery Visual Progression | Cross-cutting (multiple phases) |
| DD-V2-099 | PAUSE oxygen drain during all quiz overlays. | SM-2 - Quiz Timer Policy | Cross-cutting (multiple phases) |
| DD-V2-100 | Separate "quiz" from "teach." When a player encounters a never-before-seen fact as a pop quiz, it becomes a "teaching moment":... | SM-2 - Teaching Moments for New Facts | Cross-cutting (multiple phases) |
| DD-V2-101 | Base rate 8% with a 15-block minimum cooldown between quizzes. | SM-2 - Adaptive Quiz Rate | Cross-cutting (multiple phases) |
| DD-V2-103 | Layers 1-5 select difficulty 1-2 facts; layers 6-10 from 2-3; layers 11-15 from 3-4; layers 16-20 from 4-5. | SM-2 - Quiz Gate Difficulty Scaling | Cross-cutting (multiple phases) |
| DD-V2-104 | For current multiple-choice: exact matching is correct, no changes needed. | SM-2 - acceptableAnswers Schema Field | Cross-cutting (multiple phases) |
| DD-V2-115 | Hierarchical RADIAL TREE with trunk at center, branches radiating outward, and tap-to-zoom-into-branch. | Knowledge Tree - Rendering Architecture | Cross-cutting (multiple phases) |
| DD-V2-116 | Three-level LOD rendering. | Knowledge Tree - Level of Detail Rendering | Cross-cutting (multiple phases) |
| DD-V2-117 | Show unknown facts at BRANCH level only: "Biology: 34 learned / 312 total" on the branch label. | Knowledge Tree - Unknown Fact Display | Cross-cutting (multiple phases) |
| DD-V2-118 | Explicit settings weight = 1.0 (constant), behavioral inference maximum = 0.3. | Knowledge Tree - Behavioral Inference Weight Cap | Cross-cutting (multiple phases) |
| DD-V2-119 | Mastery #1 = full-screen event (see DD-V2-108). | Knowledge Tree - Tiered Mastery Celebrations | Cross-cutting (multiple phases) |
| DD-V2-120 | Yes, subtly. Weight biome selection so interest-aligned biomes appear approximately 30% more frequently (Geology→Crystal Cavern... | Knowledge Tree - Interest-Biased Biome Selection | Cross-cutting (multiple phases) |
| DD-V2-121 | Surface related facts at three moments. | Knowledge Tree - Cross-Fact Connections | Cross-cutting (multiple phases) |
| DD-V2-122 | Add a "Focus Study" button on each Knowledge Tree branch. | Knowledge Tree - Focus Study Mode | Cross-cutting (multiple phases) |
| DD-V2-123 | Four responses to category completion. | Knowledge Tree - Category Completion Celebration | Cross-cutting (multiple phases) |
| DD-V2-124 | 8-10 visual stages based on total mastered facts: sapling (0-10), seedling (11-50), young tree (51-150), growing tree (151-400)... | Dome - Physical Knowledge Tree Growth Stages | Cross-cutting (multiple phases) |
| DD-V2-125 | Let the player customize two 4-hour ritual windows in settings. | Study Design - Customizable Ritual Windows | PHASE-66-SETTINGS-REPORTS |
| DD-V2-126 | Add a "15 minutes" option alongside 5/10/All due. | Study Design - Session Length Options | Cross-cutting (multiple phases) |
| DD-V2-127 | Default to interleaved study (mixed categories) for superior long-term retention. | Study Design - Interleaving Default | Cross-cutting (multiple phases) |
| DD-V2-128 | Three SM-2 tracks per vocabulary word: recognition (seeing word → knowing meaning), recall (seeing meaning → producing word), u... | Study Design - Vocabulary SM-2 Tracks | Cross-cutting (multiple phases) |
| DD-V2-129 | Initialize "already known" facts at repetitions = 2, interval = 7, easeFactor = 2.5. | Study Design - Already Known Initialization | Cross-cutting (multiple phases) |
| DD-V2-130 | Hide the math, teach the concept. | Study Design - Spaced Repetition Transparency | Cross-cutting (multiple phases) |
| DD-V2-131 | Reduce to 5 O2 (from 8). ONLY trigger when repetitions >= 4 (roughly 2 or more weeks of spaced review, placing the fact in the... | Study Design - Consistency Penalty Recalibration | Cross-cutting (multiple phases) |
| DD-V2-132 | Language Mode = the Category Lock feature (Phase 12.4) applied to language categories. | Study Design - Language Mode Architecture | Cross-cutting (multiple phases) |
| DD-V2-133 | Add a simple "upcoming reviews" indicator on the dome screen. | Study Design - Review Forecast Indicator | Cross-cutting (multiple phases) |
| DD-V2-134 | Track five metrics. (1) Retention rate: percentage of mastered facts (60d+ interval) still answered correctly when tested - tar... | Study Design - Learning Effectiveness Metrics | Cross-cutting (multiple phases) |
| DD-V2-140 | Three concurrent weekly challenges: one mining-focused (e.g., reach layer 12), one learning-focused (e.g., master 5 new facts),... | Daily Loop - Weekly Challenges | Cross-cutting (multiple phases) |
| DD-V2-163 | Implement a hidden "engagement score" tracking session frequency, quiz accuracy (rolling 20-question window), and dive depth. | Difficulty - Dynamic Engagement Scoring | PHASE-18-DEV-TOOLING |
| DD-V2-164 | NEVER hard-gate progress on learning. | Quiz - Brute-Force Philosophy | Cross-cutting (multiple phases) |
| DD-V2-165 | List in Games (Adventure or Casual subcategory) as primary category, with Education as secondary. | Market Position - App Store Category | PHASE-20-MOBILE-LAUNCH |
| DD-V2-168 | Study five games and apply specific lessons: (1) Duolingo - adopt the habit loop, drop the guilt and shame. | Market Position - Competitor Lessons | Cross-cutting (multiple phases) |
| DD-V2-169 | Post-launch only, and only after consumer retention proves strong. | Market Position - Educational Partnerships | Cross-cutting (multiple phases) |
| DD-V2-173 | Three rules to prevent homework feeling: (1) Every quiz must have immediate tangible stakes - correct answers boost artifact ra... | Quiz Design - Anti-Homework Philosophy | Cross-cutting (multiple phases) |
| DD-V2-176 | Build a "GAIA's Report" screen in the Archive room showing: facts mastered this week, quiz accuracy by category (radar chart),... | Analytics - GAIA's Report (Player-Facing) | Cross-cutting (multiple phases) |
| DD-V2-179 | Build an internal Learning Effectiveness Dashboard tracking the five metrics from DD-V2-134. | Analytics - Learning Effectiveness Publishing | Cross-cutting (multiple phases) |
| DD-V2-201 | Three tiers: (1) Always offline: mining, quizzes, study, Knowledge Tree, crafting, farm, dome, fossils - core loop never needs... | Architecture - Offline Feature Tiers | PHASE-20-MOBILE-LAUNCH |
| DD-V2-225 | Accept imperfection. (1) Server plausibility checks: reject impossible saves (factsLearned > quizzesTaken, etc). (2) Rate anoma... | Security - Anti-Cheat Layered Deterrents | PHASE-19-AUTH-CLOUD |
| DD-V2-228 | Full GDPR compliance for Phase 12 behavioral learning: (1) Explicit opt-in toggle with clear explanation, consent timestamp + v... | Privacy - GDPR Behavioral Consent | PHASE-12-INTEREST-PERSONALIZATION |
| DD-V2-241 | Gameplay-critical blocks (Quiz Gate, Descent Shaft, Exit Ladder) keep their universal recognizable silhouette across all biomes... | Art Direction - Special Block Biome Adaptation | PHASE-09-BIOME-EXPANSION |
| DD-V2-261 | Empty floors: desaturated palette, exposed structural beams, flickering dim lighting, "under construction" visual treatment. | Dome - Empty vs Upgraded Floor Visual Language | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-266 | 5-6 distinct growth stages: tiny sapling (0-10 facts mastered) → small bush (11-50) → young tree (51-150) → mature tree (151-50... | Dome - Knowledge Tree Growth Stages | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-279 | Gameplay-critical blocks (Quiz Gate, Descent Shaft, Exit Ladder) maintain their universal recognizable silhouette shape across... | Art Direction - Special Block Silhouettes | PHASE-09-BIOME-EXPANSION |

### Economy (16)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-067 | Implement shallow layer mineral depletion. | Economy - Anti-Grind | Cross-cutting (multiple phases) |
| DD-V2-083 | Deeper layers must drop higher-tier minerals at significantly higher rates. | Economy - Mineral Quality by Depth | Cross-cutting (multiple phases) |
| DD-V2-138 | 1 oxygen tank regenerates every 90 minutes, with a maximum bank of 3 tanks. | Economy - Oxygen Real-Time Regeneration | Cross-cutting (multiple phases) |
| DD-V2-143 | The first artifact reveal with GAIA's snarky comment and the gacha animation MUST happen within 90 seconds of gameplay start. | Onboarding - 90-Second Hook Moment | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-145 | Hybrid monetization: $4.99/month "Terra Pass" subscription (unlimited oxygen + 1 exclusive cosmetic per month) plus à la carte... | Monetization - Hybrid Model | Cross-cutting (multiple phases) |
| DD-V2-146 | Launch completely ad-free. | Monetization - Ad-Free Policy | PHASE-21-MONETIZATION |
| DD-V2-147 | ALL facts are free to find in-game. | Monetization - Knowledge Never Paywalled | PHASE-21-MONETIZATION |
| DD-V2-148 | Price by interactivity and visibility. | Monetization - Cosmetic Pricing Tiers | Cross-cutting (multiple phases) |
| DD-V2-149 | "Knowledge Expedition" season pass, $4.99 per 8-12 week season. | Monetization - Season Pass | Cross-cutting (multiple phases) |
| DD-V2-150 | $4.99 one-time "Pioneer Pack" available only during the first 7 days after install: 500 dust, 1 guaranteed rare+ artifact, a un... | Monetization - Starter Pack | Cross-cutting (multiple phases) |
| DD-V2-151 | Replace mineral decay with positive-framed sinks. | Economy - Replace Mineral Decay with Positive Sinks | Cross-cutting (multiple phases) |
| DD-V2-152 | Mastery-free play cannibalizing subscription revenue is acceptable and strategically correct. | Monetization - Mastery-Free Play Segmentation | PHASE-21-MONETIZATION |
| DD-V2-171 | Web is a full first-class platform at terragacha.com, NOT just a demo or teaser. | Platform - Web as First-Class Platform | PHASE-20-MOBILE-LAUNCH |
| DD-V2-174 | Five ethical guardrails: (1) All drop rates are displayed in-game with full transparency. | Ethics - Gacha Guardrails | PHASE-21-MONETIZATION |
| DD-V2-192 | Split PlayerSave into versioned sub-documents: PlayerEconomy (minerals, crafting), PlayerKnowledge (reviews, facts, KP), Player... | Save System - PlayerSave Sub-Documents | PHASE-19-AUTH-CLOUD |
| DD-V2-255 | Design animations from Legendary DOWN, not Common up. | VFX - Gacha Reveal Animation Tiers | Cross-cutting (multiple phases) |

### Architecture (35)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-044 | PostgreSQL for production. | Backend - Database | PHASE-19-AUTH-CLOUD |
| DD-V2-183 | Hard cap of 50 draw calls per frame on mobile. | Rendering - Draw Call Budget | PHASE-07-VISUAL-ENGINE |
| DD-V2-187 | Switch to Phaser's native camera.startFollow() with deadzone, remove manual lerp code entirely. | Rendering - Native Camera System | Cross-cutting (multiple phases) |
| DD-V2-188 | Migrate dome from Svelte canvas (DomeCanvas.svelte) to a dedicated Phaser scene (DomeScene). | Architecture - Dome Phaser Scene Migration | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-189 | Implement per-biome texture atlases loaded on demand. | Rendering - Per-Biome Texture Atlases | PHASE-07-VISUAL-ENGINE |
| DD-V2-190 | Force Phaser.WEBGL in config, drop Canvas2D fallback entirely. | Rendering - Force WebGL | PHASE-07-VISUAL-ENGINE |
| DD-V2-193 | Migrate persistence from localStorage to IndexedDB via idb-keyval library (600 bytes). | Save System - IndexedDB Migration | PHASE-19-AUTH-CLOUD |
| DD-V2-194 | Implement field-level merge for sync conflicts instead of last-write-wins. | Save System - Field-Level Sync Merge | PHASE-19-AUTH-CLOUD |
| DD-V2-195 | Layered approach per platform. | Security - Token Storage | PHASE-19-AUTH-CLOUD |
| DD-V2-196 | Build Service Worker in Phase 19, not before. | Architecture - Service Worker Strategy | PHASE-19-AUTH-CLOUD |
| DD-V2-197 | 5K facts ≈ 10-15MB uncompressed, ~3-5MB gzipped. | Data - Facts DB Sizing & Loading | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-198 | Server exposes GET /api/facts/delta?since={version} returning adds/mods. | Data - Fact Delta Sync Protocol | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-199 | Two-pronged: (1) visibilitychange + Capacitor App.addListener('appStateChange') triggers immediate sync bypassing debounce. | Save System - Durability on App Kill | PHASE-19-AUTH-CLOUD |
| DD-V2-200 | Cloud icon in dome UI: green (synced <1hr), yellow (pending), red (failed or >24hr). | UX - Sync Status Indicator | PHASE-19-AUTH-CLOUD |
| DD-V2-202 | Use jsonb for save blob + extract hot analytics columns: last_played_at, total_dives, total_facts_learned, current_streak, acco... | Database - PostgreSQL jsonb + Denormalized Columns | PHASE-19-AUTH-CLOUD |
| DD-V2-203 | is_active boolean with partial unique index (CREATE UNIQUE INDEX ON saves(user_id) WHERE is_active = TRUE). | Database - Save History Retention | PHASE-19-AUTH-CLOUD |
| DD-V2-205 | Migrate from PBKDF2-SHA512 to Argon2id via argon2 npm package. | Security - Argon2id Password Hashing | PHASE-19-AUTH-CLOUD |
| DD-V2-208 | Text embeddings with cosine similarity using text-embedding-3-small ($0.02/1M tokens). | Backend - Semantic Duplicate Detection | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-209 | Phased: (1) Write Drizzle schema targeting PostgreSQL. | Database - SQLite to PostgreSQL Migration | PHASE-19-AUTH-CLOUD |
| DD-V2-210 | SHA-256 hash before storage. | Security - Refresh Token Hashing | PHASE-19-AUTH-CLOUD |
| DD-V2-211 | @fastify/rate-limit per-route. | Security - Rate Limiting Strategy | PHASE-19-AUTH-CLOUD |
| DD-V2-212 | Add incrementally: Phase 7: @capacitor/haptics. | Mobile - Capacitor Plugin Roadmap | PHASE-20-MOBILE-LAUNCH |
| DD-V2-213 | Block hit = impact.light, block break = impact.heavy, rare loot = notification.success, hazard damage = notification.warning, a... | Mobile - Haptic Feedback Vocabulary | Cross-cutting (multiple phases) |
| DD-V2-214 | Target under 500KB gzipped initial JS (excluding Phaser/sql.js). | Build - Bundle Size & Code Splitting | PHASE-20-MOBILE-LAUNCH |
| DD-V2-215 | Three GitHub Actions workflows: (1) CI (every PR): typecheck, build, Vitest, API tests, bundle size assertion. | DevOps - CI/CD Pipeline | PHASE-18-DEV-TOOLING |
| DD-V2-218 | Multi-stage Dockerfile: Stage 1 builds TypeScript + native deps. | DevOps - Docker Strategy | PHASE-20-MOBILE-LAUNCH |
| DD-V2-219 | Split serving: Game HTML/JS/CSS on Cloudflare Pages (free tier). | Infrastructure - CDN Asset Delivery | PHASE-20-MOBILE-LAUNCH |
| DD-V2-220 | Test on 3 device tiers: low-end (Samsung A13, 3GB), mid-range (Pixel 6a, 6GB), high-end (Pixel 8, 12GB). | Mobile - Android WebView Profiling | PHASE-20-MOBILE-LAUNCH |
| DD-V2-221 | Three layers: (1) Client: Sentry (free 5K events/month) wrapping Phaser boot and service calls. | Infrastructure - Error Monitoring & Observability | PHASE-20-MOBILE-LAUNCH |
| DD-V2-223 | Do NOT adopt full Entity Component System. | Architecture - No ECS Framework | PHASE-07-VISUAL-ENGINE |
| DD-V2-224 | Singleton EventBus with TypeScript generics: eventBus.emit<BlockMinedEvent>('block-mined', data) / eventBus.on<BlockMinedEvent>(). | Architecture - Typed Event Bus | PHASE-07-VISUAL-ENGINE |
| DD-V2-226 | Three configurations: Dev (permissive localhost:*), Production web (strict with explicit CDN + API domains), Capacitor (use @ca... | Security - CSP Per Environment | PHASE-19-AUTH-CLOUD |
| DD-V2-227 | Migrate to ES256 (ECDSA) asymmetric signing. | Security - Asymmetric JWT (ES256) | PHASE-19-AUTH-CLOUD |
| DD-V2-230 | Formalize with pnpm workspaces: packages/client, packages/server, packages/shared (types, constants, validators, balance values). | Architecture - Monorepo Workspaces | PHASE-18-DEV-TOOLING |
| DD-V2-231 | Start lean: (1) Client: Cloudflare Pages (web) + Capacitor APK/IPA. | Infrastructure - Launch Deployment Architecture | PHASE-20-MOBILE-LAUNCH |

### Visuals (60)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-008 | Implement Terraria-style autotiling with bitmasking. | Mining Visuals - Block Rendering | PHASE-07-VISUAL-ENGINE |
| DD-V2-009 | Tiles must blend with their neighbors. | Mining Visuals - Tile Texture Continuity | PHASE-07-VISUAL-ENGINE |
| DD-V2-010 | Use sprite-based crack overlays with 3-4 distinct visual damage stages. | Mining Visuals - Crack Overlays | Cross-cutting (multiple phases) |
| DD-V2-011 | Implement full character animation with the following sprite sheets: ... | Mining Visuals - Character Animation | PHASE-29-CHARACTER-ANIMATION |
| DD-V2-012 | Implement block idle animations including: ... | Mining Visuals - Block Idle Animations | Cross-cutting (multiple phases) |
| DD-V2-013 | Implement loot pop physics. | Mining Visuals - Loot Pop Physics | PHASE-30-MINING-JUICE |
| DD-V2-014 | Each of the 25 biomes needs its own unique tile sprite set. | Mining Visuals - Biome Tile Sets | PHASE-33-BIOME-VISUAL-DIVERSITY |
| DD-V2-015 | Particle effects are a very high priority and critical for addictiveness. | Mining Visuals - Particle Effects | PHASE-30-MINING-JUICE |
| DD-V2-016 | Complete dome redesign. Replace the current single dome with a multi-floor glass hub system. Architecture: ... | Dome - Complete Redesign | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-018 | All dome upgrades are tied to materials players can buy with correct materials. | Dome - Upgrade System | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-019 | All upgrades must be visually reflected in the hub. | Dome - Visual Upgrade Reflection | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-020 | Rooms are physical floors and hubs. | Dome - Physical Navigation | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-065 | When a gas pocket block is triggered, it releases a visible cloud (green mist particle effect) that fills a 3×3 area and drifts... | Hazards - Gas Behavior | Cross-cutting (multiple phases) |
| DD-V2-082 | Earthquakes need explicit tutorial coverage and clear visual and audio warnings before and during occurrence. | Hazards - Earthquake Communication | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-182 | Migrate MineScene from Graphics-based tile rendering to Phaser.Tilemaps.TilemapLayer with pre-computed autotile bitmask indices... | Rendering - Tilemap Migration | Cross-cutting (multiple phases) |
| DD-V2-184 | Hard ceiling of 500 pooled sprites with frustum culling. | Rendering - Sprite Pool Ceiling | PHASE-07-VISUAL-ENGINE |
| DD-V2-185 | Hybrid approach: terrain blocks (lava, gas) animate by cycling tile indices on the tilemap at fixed intervals (single update, n... | Rendering - Block Idle Animations | Cross-cutting (multiple phases) |
| DD-V2-186 | Cap at 200 active particles (mobile), 500 (desktop). | Rendering - Ambient Particle Budget | Cross-cutting (multiple phases) |
| DD-V2-191 | Profile mine generation on mid-range phone at 40x40 first - likely still under 50ms, masked by descent animation. | Performance - Mine Generation Threading | PHASE-08-MINE-GAMEPLAY |
| DD-V2-232 | Start with 4-bit (16-variant) autotiling for all 25 biomes at launch. | Autotiling - Bitmask Complexity | Cross-cutting (multiple phases) |
| DD-V2-233 | Two-layer approach: (1) each block renders its autotiled base sprite using a neighbor-of-same-type bitmask, (2) a semi-transpar... | Autotiling - Cross-Material Transitions | Cross-cutting (multiple phases) |
| DD-V2-234 | Move from full-grid-every-frame redraws to a dirty-rect system where only changed tiles and their 8 neighbors re-render per frame. | Autotiling - Dirty-Rect System | PHASE-07-VISUAL-ENGINE |
| DD-V2-235 | Create a neutral transition tileset with desaturated earth tones capable of bridging any two biome palettes. | Autotiling - Biome Boundary Transitions | PHASE-09-BIOME-EXPANSION |
| DD-V2-236 | Three tiers of uniqueness: Tier 1 (5-6 hero biomes: Fungal Forest, Data Ruins, Ancient City, Living Cave, Coral Reef) = fully u... | Art Direction - Biome Visual Tiers | PHASE-09-BIOME-EXPANSION |
| DD-V2-237 | Create a hue wheel matrix before generating any sprites. | Art Direction - 25-Biome Color Matrix | PHASE-09-BIOME-EXPANSION |
| DD-V2-238 | Topsoil (L1-5): warm earth tones (amber/ochre/sage), organic rounded shapes, high brightness, no hazard particles. | Art Direction - Depth Visual Gradient | PHASE-09-BIOME-EXPANSION |
| DD-V2-239 | 3-4 animated tile types per biome, 4-6 frames each. | Animation - Per-Biome Animated Tile Budget | Cross-cutting (multiple phases) |
| DD-V2-240 | Remove the 0.15 alpha biome tint once per-biome tile sprites are in place. | Art Direction - Remove Biome Tint Overlays | PHASE-07-VISUAL-ENGINE |
| DD-V2-242 | 6 frames per walk direction, 5-6 frames per mine/swing direction. | Animation - Miner Frame Count | Cross-cutting (multiple phases) |
| DD-V2-243 | The impact frame plays instantly on tap and damage is applied immediately; the follow-through animation plays purely as visual... | Animation - Compressed Swing for Tap | Cross-cutting (multiple phases) |
| DD-V2-244 | Build the entire mining feel system first using colored rectangles (rotating arm, circle burst, procedural shake, placeholder p... | Workflow - Prototype Mining Feel First | Cross-cutting (multiple phases) |
| DD-V2-245 | Distinct impact profiles per block type. | VFX - Per-Block Impact Profiles | Cross-cutting (multiple phases) |
| DD-V2-247 | Generate a recolorable swing trail overlay as a separate 4-frame sprite sheet, tinted per tier at runtime. | Art Direction - Pickaxe Tier Visual Upgrades | Cross-cutting (multiple phases) |
| DD-V2-248 | Represent gear as small overlay icons following the miner position, not as modifications to the base sprite. | Art Direction - Gear Visibility at 32px | Cross-cutting (multiple phases) |
| DD-V2-249 | Block breaks include three elements not present in intermediate hits: (1) 50ms freeze-frame (the most powerful juice technique... | VFX - Block Break Climactic Moment | Cross-cutting (multiple phases) |
| DD-V2-250 | Parabolic arc with random initial velocity (30-80 degrees upward, 60-120 px/sec), 2-3 diminishing bounces, hold for 200ms, then... | VFX - Loot Pop Physics | Cross-cutting (multiple phases) |
| DD-V2-251 | Four crack stages triggering at 25%, 50%, 75%, and 90% damage. | Art Direction - 4 Crack Damage Stages | PHASE-07-VISUAL-ENGINE |
| DD-V2-252 | Three automatic tiers. Low (older phones): max 40 particles, no ambient particles, 3-particle block breaks. Medium (2020+ phone... | VFX - Particle Device Tiers | Cross-cutting (multiple phases) |
| DD-V2-253 | Spawn ambient particles only within the camera rect plus a 2-tile margin. | VFX - Viewport-Culled Ambient Particles | Cross-cutting (multiple phases) |
| DD-V2-254 | Three tiers using Perlin noise displacement (physical feel, not random jitter). | VFX - Screen Shake Tiers | Cross-cutting (multiple phases) |
| DD-V2-256 | 3-phase transition totaling 3 seconds. | VFX - Descent Shaft Transition | Cross-cutting (multiple phases) |
| DD-V2-257 | Do not add floating health bars above blocks. | UI - No Per-Block Health Bar | PHASE-07-VISUAL-ENGINE |
| DD-V2-258 | A radial "ping" wave emanates from the player every 2 seconds when within 5-8 tiles of the descent shaft. | VFX - Scanner Sonar Pulse | Cross-cutting (multiple phases) |
| DD-V2-259 | Break effects escalate by hidden rarity before the overlay appears. | VFX - Loot Rarity Break Preview | Cross-cutting (multiple phases) |
| DD-V2-260 | Side-view cutaway layout (Fallout Shelter style) with all floors visible simultaneously, stacked vertically. | Dome - Multi-Floor Layout | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-264 | Three mandatory shared elements across all overlays: (1) 70% dark backdrop with subtle blur effect, (2) rounded-corner panel fr... | UI - Unified Overlay Style Guide | PHASE-07-VISUAL-ENGINE |
| DD-V2-265 | Abbreviate numbers above 999 (1.2K, 3.4M). | UI - Resource Bar Mobile Optimization | PHASE-07-VISUAL-ENGINE |
| DD-V2-267 | Keep procedural rendering for large structural elements, which scales perfectly with zero texture memory cost. | Dome - Procedural Structural Elements | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-269 | 5 panels at 384x512 (3:4 portrait ratio) generated at 1024x1024 via SDXL, then center-cropped. | Art Direction - Intro Comic Panels | Cross-cutting (multiple phases) |
| DD-V2-270 | Increase Ring-1 brightness to 25-30% for mobile as the new default (up from 10-20%). | Accessibility - Fog Visibility | PHASE-07-VISUAL-ENGINE |
| DD-V2-271 | Do not tint the fog overlay itself. | VFX - Biome Fog Glow (Not Tint) | PHASE-07-VISUAL-ENGINE |
| DD-V2-272 | Create palette.ts defining 8-12 colors per biome: background, 3 block fill levels, accent, highlight, shadow, fog tint, and par... | Art Pipeline - Formal Palette System | PHASE-09-BIOME-EXPANSION |
| DD-V2-273 | Pack sprites into 2048x2048 atlas sheets (the maximum safe size for mobile GPU compatibility) with accompanying JSON sprite map... | Art Pipeline - Texture Atlas Build Pipeline | PHASE-07-VISUAL-ENGINE |
| DD-V2-274 | Automated 3-gate QC check between generation and human review. | Art Pipeline - 3-Gate Sprite QC | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-275 | Zoom bridge animation in 3 steps: (1) Camera zooms into the dive hatch in the dome floor over 0.5 seconds. | VFX - Dome-to-Mine Scale Transition | PHASE-07-VISUAL-ENGINE |
| DD-V2-276 | Render the Phaser canvas at 1x CSS pixel resolution, not native device DPI. | Rendering - 1x CSS Resolution for Pixel Art | PHASE-07-VISUAL-ENGINE |
| DD-V2-277 | Use the 32px sprite set as the default mobile texture resolution (approximately 500 sprites = 2MB). | Performance - 80-100MB Texture Memory Budget | PHASE-07-VISUAL-ENGINE |
| DD-V2-278 | Automated audit script integrated into npm run build. | DevOps - Build-Time Asset Audit | PHASE-18-DEV-TOOLING |
| DD-V2-280 | Use sprite-sheet frame cycling for blocks with distinct animation shapes: lava flow, gas cloud swirl, descent shaft vortex, and... | Animation - Block Idle Animation Hybrid | Cross-cutting (multiple phases) |
| DD-V2-281 | Scanner sonar pulse: radial ping wave emanating from player every 2 seconds when within 5-8 tiles of descent shaft; thin purple... | VFX - Scanner Proximity and Rarity Preview | Cross-cutting (multiple phases) |

### Social (7)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-033 | Factions are a planned social competitive element for later phases. | Social - Factions | PHASE-12-INTEREST-PERSONALIZATION |
| DD-V2-042 | Support all of: email and password login, social login (Google and Apple), and guest mode with optional account linking later. | Auth - Login Methods | PHASE-19-AUTH-CLOUD |
| DD-V2-180 | "Invite a friend, you both receive a fossil egg." The fossil egg is exciting (gacha anticipation), does not break the economy (... | Social - Referral Mechanic | PHASE-22-SOCIAL-MULTIPLAYER |
| DD-V2-204 | Three changes: (1) Composite index (category, score DESC). | Database - Leaderboard Scaling | PHASE-19-AUTH-CLOUD |
| DD-V2-206 | Capacitor OAuth plugins for native flows. | Auth - Social Login + Guest Linking | PHASE-19-AUTH-CLOUD |
| DD-V2-229 | DataDeletionService: (1) CASCADE delete user row (saves, leaderboards, tokens). | Privacy - GDPR Right to Erasure | PHASE-19-AUTH-CLOUD |
| DD-V2-246 | Scale three parameters linearly with damage percentage: particle count 4→10, screen shake 1px→3px, crack overlay opacity 0.4→0.8. | VFX - Progressive Hit Satisfaction | Cross-cutting (multiple phases) |

### Platform (4)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-043 | The game is fully locally playable. | Progress - Offline and Sync Model | Cross-cutting (multiple phases) |
| DD-V2-155 | Targets: D1: 45%, D7: 20%, D30: 10%. | Analytics - Retention Targets | Cross-cutting (multiple phases) |
| DD-V2-167 | Soft launch in Philippines, Malaysia, and Colombia (English-speaking, high mobile gaming engagement, representative demographic... | Market Position - Soft Launch Strategy | PHASE-20-MOBILE-LAUNCH |
| DD-V2-181 | Instrument these 10 events before any beta user touches the game: (1) Tutorial step completion (granular funnel: each step as n... | Analytics - 10 Critical Pre-Beta Events | PHASE-19-AUTH-CLOUD |

### Content Pipeline (19)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-001 | Create an API endpoint for fact ingestion that performs the following steps automatically: ... | Content Pipeline - Fact Ingestion API | PHASE-26-PRODUCTION-BACKEND |
| DD-V2-002 | All LLM-generated content fields (distractors, gaiaComment, explanation, wowFactor) are fully LLM-generated. | Content Pipeline - LLM Authorship | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-003 | A very intelligent categorization system is required with sub-sub-sub categories. | Content Pipeline - Category Taxonomy | Cross-cutting (multiple phases) |
| DD-V2-004 | Distractors are fully LLM-generated at scale. | Content Pipeline - Distractor Generation | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-005 | Multiple web dashboards are required: ... | Content Pipeline - Web Dashboards | Cross-cutting (multiple phases) |
| DD-V2-006 | Wikipedia with a citation URL stored in the fact record is sufficient for v1 verification. | Content Pipeline - Fact Verification | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-007 | Add a visual_description column to the fact schema. | Content Pipeline - Pixel Art Per Fact | PHASE-34-PIXEL-ART-PER-FACT |
| DD-V2-085 | Build a "fact extraction prompt" that takes highlighted passages from books or Wikipedia and outputs the full fact JSON schema. | Content Pipeline - Fact Extraction Process | Cross-cutting (multiple phases) |
| DD-V2-086 | A second LLM pass reviews each distractor against the correct answer and flags any that could be argued as partially correct. | Content Pipeline - Distractor Validation | Cross-cutting (multiple phases) |
| DD-V2-087 | Yes, distractors scale with mastery. | Content Pipeline - Difficulty-Tiered Distractors | Cross-cutting (multiple phases) |
| DD-V2-088 | No human interaction is required in the review pipeline. | Content Pipeline - Automated Fact Review | Cross-cutting (multiple phases) |
| DD-V2-089 | Add a "Report this fact" button on the fact detail card and post-quiz wrong-answer screen. | Content Pipeline - In-Game Fact Reporting | Cross-cutting (multiple phases) |
| DD-V2-090 | Minimum 12 high-quality distractors is the hard floor. | Content Pipeline - Minimum Distractor Count | Cross-cutting (multiple phases) |
| DD-V2-091 | Not equal distribution. Minimum 200 facts per top-level category before launch (5,000 total ≈ 700 average). Chase the long tail... | Content Pipeline - Category Distribution Strategy | Cross-cutting (multiple phases) |
| DD-V2-092 | Add a content_volatility enum: timeless (octopus hearts), slow_change (world records, population), current_events (leaders, pol... | Content Pipeline - Fact Content Volatility | Cross-cutting (multiple phases) |
| DD-V2-093 | Three-phase migration. (1) Server becomes source of truth for fact content; client downloads "fact packs" on first launch and p... | Content Pipeline - Database Migration Strategy | Cross-cutting (multiple phases) |
| DD-V2-094 | V1 is text and pixel art only. | Content Pipeline - Multimedia Scope | Cross-cutting (multiple phases) |
| DD-V2-175 | The kid version must have equal "wow!" density as the adult version - just different topics. | Content - Kid Content Quality | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-207 | Cloud LLM API (Claude Sonnet or GPT-4o-mini) for fact content pipeline. | Backend - LLM Pipeline Architecture | PHASE-11-FACT-CONTENT-ENGINE |

### QA and Reliability (8)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-034 | Add scenario preset buttons to the dev panel that switch the game to specific named test states, such as "just bought first pet... | Dev Tools - Scenario Presets | Cross-cutting (multiple phases) |
| DD-V2-035 | Implement save state snapshots that capture and restore specific game states for testing purposes. | Dev Tools - Save State Snapshots | PHASE-21-MONETIZATION |
| DD-V2-036 | The dev panel and all dev tools are accessible in dev builds only. | Dev Tools - Access Control | Cross-cutting (multiple phases) |
| DD-V2-037 | Manual visual inspection via Playwright is sufficient for now. | Dev Tools - Visual Testing | Cross-cutting (multiple phases) |
| DD-V2-080 | Build a simulation system capable of running thousands of simulated dives with configurable parameter sets. | Dev Tools - Balance Simulation | Cross-cutting (multiple phases) |
| DD-V2-102 | Two quiz categories. "Review quizzes" (testing facts with repetitions ≥ 1) carry O2 penalties because the player SHOULD know th... | SM-2 - Review vs Discovery Quiz Categories | Cross-cutting (multiple phases) |
| DD-V2-216 | Three tiers with Vitest: (1) Pure function unit tests (highest ROI): SM-2 transitions, mine gen determinism (snapshot tests), q... | Testing - Strategy (Highest ROI) | PHASE-18-DEV-TOOLING |
| DD-V2-217 | Snapshot tests for mine generation: 20 fixed seeds × 3 layer depths = golden snapshot files. | Testing - Seed Determinism Protection | PHASE-18-DEV-TOOLING |

### Narrative and Companion (26)

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-039 | GAIA delivers a scripted monologue during onboarding with player choices. | Onboarding - GAIA Introduction | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-045 | GAIA must be way more involved. | GAIA - Engagement Behavior | Cross-cutting (multiple phases) |
| DD-V2-046 | GAIA references specific facts the player has learned, congratulates them on milestones, and remembers their favorite category. | GAIA - Journey Memory | PHASE-28-PERFORMANCE-OPTIMIZATION |
| DD-V2-047 | GAIA is dome-only. No visual GAIA in the mine. During dives, only toast notifications appear (text-only). GAIA's full presence... | GAIA - Visual Presence | Cross-cutting (multiple phases) |
| DD-V2-072 | Two companion upgrade paths that both apply simultaneously. | Companions - Progression | Cross-cutting (multiple phases) |
| DD-V2-105 | Mood affects DELIVERY but not CONTENT. | GAIA - Mood Delivery vs Content | Cross-cutting (multiple phases) |
| DD-V2-106 | "Struggling" = getting the same fact wrong 2 or more times within a 7-day window, OR a ReviewState where repetitions resets fro... | GAIA - Struggling Detection and Mnemonics | Cross-cutting (multiple phases) |
| DD-V2-107 | Yes, GAIA suggests specific facts to study. | GAIA - Study Suggestions | Cross-cutting (multiple phases) |
| DD-V2-108 | One of the BIGGEST moments in the game. | GAIA - First Mastery Celebration | Cross-cutting (multiple phases) |
| DD-V2-109 | NEVER reduce educational content via the chattiness setting. | GAIA - Chattiness vs Educational Content | Cross-cutting (multiple phases) |
| DD-V2-110 | Scripted templates with variable interpolation for v1. | GAIA - Journey Memory Implementation | Cross-cutting (multiple phases) |
| DD-V2-111 | NO. GAIA is the authority figure and must never be wrong about facts. If GAIA is sometimes wrong, players distrust ALL informat... | GAIA - Factual Authority | Cross-cutting (multiple phases) |
| DD-V2-112 | Three-tier failure escalation. | GAIA - Failure Escalation Response | Cross-cutting (multiple phases) |
| DD-V2-113 | The study context for GAIA dialogue is always warm, encouraging, and pedagogically focused - regardless of mood setting. | GAIA - Study Session Teaching Mode | Cross-cutting (multiple phases) |
| DD-V2-114 | Generate 3-5 gaiaComments per fact (stored as array, not string). | GAIA - Rotating Fact Comments | Cross-cutting (multiple phases) |
| DD-V2-139 | Consolidate all daily activities into a single "Daily Briefing" screen that GAIA presents on first login each day: (1) streak s... | Daily Loop - Consolidated Briefing Screen | PHASE-18-DEV-TOOLING |
| DD-V2-141 | Design a "cozy session" flow: farm collection → 5-card study session → Knowledge Tree browsing → GAIA chat. | Session Design - Cozy Dome Sessions | PHASE-10-DOME-HUB-REDESIGN |
| DD-V2-153 | $24.99 per season "Patron of Knowledge" bundle: exclusive GAIA dialogue set, unique dome floor theme, "Patron" nameplate visibl... | Monetization - Patron Tier | Cross-cutting (multiple phases) |
| DD-V2-157 | Dedicated "Welcome Back" flow: GAIA greets with personality → shows positives first (farm produced X resources, pet has a gift,... | Retention - Welcome Back Flow | Cross-cutting (multiple phases) |
| DD-V2-161 | Upon mastering all available facts: (1) "Omniscient" title and exclusive golden dome cosmetic, (2) GAIA personality shift ("You... | Retention - Completionist Endgame | PHASE-11-FACT-CONTENT-ENGINE |
| DD-V2-162 | Graduated penalty system: first oxygen depletion ever = 0% loss (GAIA rescue, tutorial teaching moment), next 3 depletions = 15... | Economy - Graduated Loot Loss | PHASE-14-ONBOARDING-TUTORIAL |
| DD-V2-172 | Map four archetypes to primary engagement surfaces: Learners → Knowledge Tree and study sessions (GAIA celebrates knowledge mil... | Player Psychology - Four Archetypes | PHASE-12-INTEREST-PERSONALIZATION |
| DD-V2-222 | Extract DiveManager (dive lifecycle, layers, biomes) and DomeManager (floors, pets, farm, GAIA idle) from GameManager. | Architecture - GameManager Decomposition v2 | PHASE-07-VISUAL-ENGINE |
| DD-V2-262 | Expand from 6 to 10-12 expressions. | Art Direction - GAIA Expression Count | PHASE-15-GAIA-PERSONALITY-V2 |
| DD-V2-263 | Pixel art speech bubbles rendered on DomeCanvas/DomeScene. | Dome - GAIA Thought Bubbles | PHASE-15-GAIA-PERSONALITY-V2 |
| DD-V2-268 | Pixel fonts for: HUD labels, biome name cards, GAIA name labels, button text, and in-world canvas text (short strings only). | UI - Hybrid Font Strategy | PHASE-07-VISUAL-ENGINE |

## Supplemental IDs in Source

The source also contains a suffixed ID that is outside the strict numeric sequence:

| ID | One-line Summary | Source Area | Implementation Phase |
| --- | --- | --- | --- |
| DD-V2-012B | Design an ultra-satisfying mining feedback loop that rivals the best in the genre. | Mining Visuals & Game Feel | PHASE-30-MINING-JUICE |

## Integrity Check

- Indexed numeric decisions: **281**
- Expected numeric range: **DD-V2-001** to **DD-V2-281**
- First indexed ID: **DD-V2-001**
- Last indexed ID: **DD-V2-281**
- Missing IDs in numeric range: **None**
