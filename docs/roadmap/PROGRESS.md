# Terra-Gacha Progress Tracker & Roadmap

Last updated: 2026-02-28 (Phase 1 Complete)

## How This Roadmap Works

- **This file** (`PROGRESS.md`) is the master index of all phases
- **`completed/`** contains detailed records of finished phases with all sub-tasks checked off
- **`in-progress/`** contains detailed, codex-executable task documents for active phases
- Each in-progress document has step-by-step instructions a coding agent can follow without creative interpretation
- When a sub-phase is complete, its document moves from `in-progress/` to `completed/`
- The Opus model (planner) creates these documents; Codex models (builders) execute them

## Vision

Terra-Gacha is a mobile-first 2D pixel-art mining roguelite where each dive fuels a long-term knowledge journey. The player crash-lands on a far-future Earth, excavates procedural mines for minerals and artifacts, and returns to the dome to ingest discoveries through GAIA (the ship AI), review facts with spaced repetition, and grow a living Knowledge Tree. The core fantasy is rediscovering Earth one artifact at a time while building an emotionally sticky loop of risk, reward, and curiosity.

The full vision extends far beyond the MVP: layered biome progression, in-run relic builds, meaningful economy and crafting, fossilized pet revival, base expansion, social systems, seasonal live ops, and eventually language-learning depth. Every system serves four pillars from `docs/GAME_DESIGN.md`: addictive learning, roguelite replayability, gacha dopamine, and visible permanent progression.

## Current State: Phase 1 Complete + Post-Phase 1 Improvements ✅

The MVP is fully polished with complete content pipeline, audio integration, balance tuning, and mobile optimization. The game now features 500+ seed vocabulary entries with spaced repetition, particle effects and animations, varied audio feedback, refined gameplay balance, and optimized mobile controls.

### Post-Phase 1 Improvements (added 2026-02-28)
These features were added after Phase 1 completion as gameplay enhancements:

- [x] **Upgrade Crate system**: 4 upgrade types (pickaxe boost, scanner boost, backpack expand, O2 efficiency) drop from UpgradeCrate blocks in the mine
- [x] **Stackable upgrades**: Upgrades can be collected multiple times and stack their effects (linear scaling for pickaxe/scanner/backpack, exponential for O2 efficiency)
- [x] **Run Stats panel**: New overlay panel (like backpack) shows all active upgrades with stack counts, computed effect values, and current run stats (depth, blocks mined, oxygen)
- [x] **Depth-based block distribution**: Block composition changes with depth (more stone/hardrock deeper)
- [x] **Depth-based mineral tiers**: Shards appear after 40% depth, crystals after 70% depth
- [x] **Exit room with multi-question gate**: Exit room at mine bottom with a golden quiz gate requiring 3 correct answers to pass
- [x] **Dive streak tracking**: Daily streak system with +1 bonus oxygen tank at 3+ day streak
- [x] **Dive results screen**: Post-dive summary showing dust, shards, crystals, artifacts, blocks mined, and streak info
- [x] **Upgrade crate visual improvements**: Bright gold color, pulsing glow border, white up-arrow symbol
- [x] **HUD upgrade indicators**: Letter badges (P/S/B/O) with stack count badges, tap to open Run Stats panel
- [x] **Upgrade toast notifications**: Center-screen toast when collecting upgrades

The foundation is solid and ready for knowledge system expansion in Phase 2.

### Visual & System Improvements (added 2026-02-28)
- [x] **Fog of war with sprite textures**: Ring-1 and ring-2 fog blocks now render actual tile/block sprites with dimming overlays instead of flat color fills
- [x] **Sprite resolution toggle**: Settings card on BaseView with Low (32px) / High (256px) toggle, persisted in localStorage, reload to switch
- [x] **Manifest-driven sprite loading**: `spriteManifest.ts` uses `import.meta.glob` to dynamically load sprites by resolution; BootScene loads from manifest instead of static imports
- [x] **MineralNode/ArtifactNode rendering fix**: All block types now render their sprites in fog (ring-1/ring-2) — previously MineralNode and ArtifactNode showed as pure black
- [x] **Migrate facts storage from static JSON imports to in-browser SQLite via sql.js**: `scripts/build-facts-db.mjs` builds `public/facts.db` at build time; `src/services/factsDB.ts` provides async singleton interface; `main.ts` initializes before boot

---

## PHASE 0: MVP Core Loop ✅ COMPLETE

**Goal**: Test core hypothesis - "mining + artifacts + learning is fun"

### Completed Systems
- [x] Step 1: Rewrite `src/data/types.ts` with full content/run/save interfaces
- [x] Step 2: Create `src/data/balance.ts` with central gameplay constants
- [x] Step 3: Create `src/services/saveService.ts` (save/load/new player)
- [x] Step 4: Create `src/services/sm2.ts` for spaced repetition logic
- [x] Step 5: Create `src/services/quizService.ts` for question/choice/grading flow
- [x] Step 6: Add seed content in `src/data/seed/vocab-n3.json` (~50 entries)
- [x] Step 7: Build `MineGenerator` with seeded procedural generation
- [x] Step 8: Build `OxygenSystem` for dive oxygen state/cost handling
- [x] Step 9: Build `MiningSystem` for hardness/mining/content resolution
- [x] Step 10: Add `Player` entity for grid position/movement state
- [x] Step 11: Create `MineScene` with mining input/render/event emissions
- [x] Step 12: Update `GameManager` to register/start/end mine scenes
- [x] Step 13: Create Svelte stores in `gameState.ts` and `playerData.ts`
- [x] Step 14: Create `HUD.svelte`
- [x] Step 15: Create `QuizOverlay.svelte`
- [x] Step 16: Create `BackpackOverlay.svelte`
- [x] Step 17: Create `FactReveal.svelte`
- [x] Step 18: Create `DivePrepScreen.svelte`
- [x] Step 19: Create `BaseView.svelte`
- [x] Step 20: Update `App.svelte` screen router
- [x] Step 21: Implement event bridge between Phaser and Svelte
- [x] Step 22: Integrate full dive loop (prep -> mine -> surface -> resolve)
- [x] Step 23: Integrate base study loop for due-review quizzes
- [x] Step 24: Update `BootScene` to load/initialize seed content
- [x] Step 25: Complete typecheck/build/playability validation pass
- [x] Recent UX pass: camera centering, random spawn, directional movement, free empty-tile movement, auto-step after mining, click-to-pathfind

### What Works
- Full dive loop: prep -> mine -> collect -> surface -> review
- Spaced repetition (SM-2)
- Quiz system with distractors
- Oxygen management
- Procedural mine generation
- Save/load system

---

## PHASE 1: Content & Polish ✅ COMPLETE

**Goal**: Make the MVP feel complete and ready for alpha testing

### 1.1 Visual Polish ✅
- [x] Mining feedback: cracks/progress bars on multi-hit blocks
- [x] Block destruction particles (different colors per block type)
- [x] Loot collection animations ("suck" toward backpack)
- [x] Artifact rarity colors in backpack
- [x] Depth transition animations
- [x] Player visual states (dirty/scuffed as run progresses)

### 1.2 Content Pipeline ✅
- [x] Expand from 50 to 500 Japanese N3 vocabulary entries
- [x] Build automated distractor generation (25 per fact)
- [x] Fact verification system
- [x] Category tagging and organization
- [x] Quality scoring (`fun_score`, `novelty_score`)

### 1.3 Audio ✅
- [x] Mining sounds (varied by block type)
- [x] Collection sounds (minerals, artifacts)
- [x] Quiz feedback (correct ding, wrong buzz)
- [x] Ambient underground atmosphere
- [x] UI interaction sounds

### 1.4 Balance Tuning ✅
- [x] Oxygen costs per block type
- [x] Block hardness distribution
- [x] Artifact drop rates by depth
- [x] Mineral node density
- [x] Quiz gate frequency

### 1.5 Mobile Optimization ✅
- [x] Touch controls testing on real devices
- [x] Button size optimization for thumbs
- [x] Performance profiling (60fps target)
- [x] Battery usage optimization
- [x] Offline mode testing

---

## PHASE 2: Knowledge System Expansion (4-8 weeks)

**Goal**: Transform from vocab quiz to full knowledge game

### 2.1 Real Facts Content
- [x] Source 500+ high-quality facts across all categories (122 general facts + 400 vocab = 522 total)
- [x] Generate 25 plausible distractors per fact (all facts now 24-25)
- [x] Add `wowFactor` field (mind-blowing framing)
- [x] Add `explanation` depth pass for each fact
- [x] Source attribution (`sourceName`)
- [x] Age rating system validation (runtime filtering added)

### 2.2 Knowledge Tree Visualization
- [x] Tree rendering (trunk, branches, leaves)
- [x] Leaf color progression (greyscale -> color by mastery)
- [x] Branch thickness grows with category completion
- [x] Wilting leaves for facts needing review
- [x] Camera focus on active branch during study (category pill buttons, SVG viewBox zoom animation, branch glow highlight, dim non-focused branches)
- [x] Completion percentages per branch

### 2.3 GAIA Personality
- [x] Name/avatar presentation pass (gaiaAvatar.ts with 8 expressions, emoji avatar in GaiaToast/BaseView/QuizOverlay/FactReveal, GAIA_NAME/GAIA_FULL_NAME, expression context store)
- [x] Pre-generate `gaiaComment` for each fact
- [x] Contextual dialogue system (GaiaToast component + depth/O2/entry/exit/artifact/upgrade triggers)
- [x] Idle comments in dome (BaseView GAIA card with 15 rotating quips, 12s interval, fade transition)
- [x] Mnemonic suggestions for struggling facts (Memory Tip shown on wrong answers for struggled facts)
- [x] Personality tuning (3 moods: snarky/enthusiastic/calm, chattiness slider 0-10, gaiaDialogue.ts with 9 trigger categories, BaseView settings UI)

### 2.4 Pixel Art Per Fact — DEFERRED
Moved to post-launch polish (Phase 11). Structural gameplay features prioritized.

---

## PHASE 3: Roguelite Depth (8-12 weeks)

**Goal**: Make every dive unique and replayable

### 3.1 Multiple Biomes
- [x] Design 3 starter biome types (Sedimentary, Volcanic, Crystalline — with distinct palettes, block weights, hazard multipliers)
- [x] Unique generation algorithm per biome (block weight multipliers, hazard density scaling, mineral multiplier)
- [x] Biome shuffling (randomized order per run — Fisher-Yates shuffle of all biomes per dive seed, layer 0 no longer always Sedimentary)
- [x] Visual identity per biome (bgColor, blockColorOverrides, fogTint per biome — HUD shows biome name)
- [x] Biome-specific hazard multipliers (Volcanic 2.5x lava, Crystalline 1.6x minerals, etc.)

### 3.2 Layer System
- [x] Descent Shafts (DescentShaft block type, purple chevron rendering, layer transition system)
- [x] Layer entrance challenges (quiz gate on descent, wrong answer costs 10 O2, always proceeds)
- [x] Layer oxygen recovery bonus (+15 O2 on descent)
- [x] Send-up slots (SendUpStation block, overlay UI, secure up to 3 items, bypass loss penalty)
- [x] Point of no return mechanics (60% depth threshold, surface button disabled with "Too Deep", GAIA warning, pastPointOfNoReturn store)

### 3.3 In-Run Upgrades (Binding of Isaac style)
- [x] Passive relics system (6 starter relics: Oxygen Heart, Mineral Magnet, Tough Skin, Lucky Strike, Deep Breath, Quiz Master — RelicShrine block, HUD badges, RunStats display)
- [x] Tool upgrades (pickaxe tiers: Stone→Iron→Steel→Diamond→Plasma Cutter, 1→8 damage, colored HUD badges, RunStats display)
- [x] Scanner upgrades (4 tiers: Basic→Enhanced→Advanced→Deep, range 1→4, hazard warnings, rarity hints on fog blocks)
- [x] Backpack expansions (temporary, 3 max per run, +2/+2/+4 slots, re-roll when maxed, BackpackOverlay temp indicator)
- [x] Oxygen tank pickups (OxygenTank block, permanent +1 tank, max 8 total, found at 60%+ depth)
- [x] Consumables: Bombs (3x3 blast, 'B' key or HUD button, drops from crates, max 3 stack)
- [x] Synergy system (4 combos: Survivor's Kit, Treasure Hunter, Deep Diver, Scholar's Blessing — HUD golden badges, RunStats section)

### 3.4 Micro-Structures
- [x] Ancient Library rooms (7x5, Unbreakable walls, ArtifactNode center, QuizGate entrance)
- [x] Crystal Caverns (6x6, HardRock walls, 4 MineralNodes + OxygenCache, 2-wide entrance)
- [x] Collapsed Tunnels (7x3, Unbreakable ceiling/floor, rubble middle row, ArtifactNode reward)
- [x] Rest Alcoves (5x5, Stone walls, OxygenCache center, open entrance)
- [x] Ruins with lore (9x7, crumbled Stone/Unbreakable walls, 3 QuoteStones, ArtifactNode, 2 MineralNodes, OxygenCache)
- [x] Quote Stones (QuoteStone block, 20 lore quotes, displayed via GaiaToast, 3 per mine)
- [x] Empty caverns for pacing (3-5 cell natural caverns, organic shape, 3 per mine)

### 3.5 Hazards
- [x] Lava blocks (instant oxygen cost, depth-gated, procedural rendering)
- [x] Gas pockets (oxygen drain on break, depth-gated, green speckle rendering)
- [x] Unstable ground (UnstableGround block, cave-in radius 2, 40% collapse chance, screen shake, GAIA quips)
- [x] Environmental events: Earthquakes (0.8% per block, 8 blocks collapse, 4 revealed, screen shake, GAIA quips)

---

## PHASE 4: Economy & Base Building (12-16 weeks)

**Goal**: Create meaningful progression and economy loops

### 4.1 Mineral Tiers
- [x] 5-tier system (Dust, Shard, Crystal, Geode @85% depth, Essence @95% depth)
- [x] Conversion system (110:1 with 10% tax, MineralConverter overlay, BaseView button)
- [x] Visual distinction in mine (blue/green/red/purple/gold procedural rendering)
- [x] Depth-based distribution (shard@40%, crystal@70%, geode@85%, essence@95%)

### 4.2 Materializer
- [x] Crafting recipes (10 recipes: 6 permanent upgrades + 4 consumables, cost/maxCraft/unlock system)
- [x] Permanent upgrade caps (maxCrafts per recipe: 1-5, dive-gated unlocks)
- [x] Cosmetics shop (8 cosmetics across 4 categories: helmets/suits/trails/auras, buy/equip/lock UI, CosmeticsShop.svelte)
- [x] Daily rotating deals (3 per day from 8-deal pool, seeded by date, dailyDeals.ts, BaseView deals card with timer, purchaseDeal in saveService)
- [x] Recipe unlocks via progression (unlockAfterDives: 0-5 for each recipe)

### 4.3 Premium Materializer
- [x] Premium material drops (3 types: star_dust 3% from artifacts, void_crystal 1% from geodes, ancient_essence 0.5% from fossils)
- [x] Exclusive cosmetics (4 premium cosmetics: Nebula Suit, Void Helmet, Phoenix Trail, Aurora Aura)
- [x] Special pet variants (3 variants: Golden Trilobite, Crystal Mammoth, Ancient T-Rex — require fossil revival)
- [x] Convenience items (3 items: Auto-Collector, Deep Scanner Map, Time Capsule — single-use per dive)

### 4.4 Dome Expansion
- [x] Multiple rooms (6 rooms: Command Center, Research Lab, Workshop, Museum, Market, Archive — tab bar navigation)
- [x] Progressive unlocks (spread across 0-10 dives, auto-unlock in recordDiveComplete)
- [x] Decorations and customization (room-specific content distribution, cosmetic companion badge)
- [x] Dome visiting (view-only) — deferred to multiplayer phase, placeholder ready

### 4.5 Economy Sinks
- [x] Scaling crafting costs (1.25x multiplier per craft of same recipe, displayed in Materializer)
- [x] Consumable purchases (implemented via Materializer crafting system)
- [x] Mineral compression tax (10% tax on 100:1 conversion ratio)
- [x] Rescue beacon crafting (emergency_beacon recipe in Materializer)
- [x] Economy sinks: mineral decay (2% above 500 dust per dive), dive insurance (15% dust for loss protection), scaling craft costs

---

## PHASE 5: Pets & Fossilized Animals (16-20 weeks)

**Goal**: Bring extinct creatures back to life

### 5.1 Fossil System
- [x] Fossil drops during dives (FossilNode=25 block type, 2 per mine at 35%+ depth, bone pattern rendering, 10 species weighted by rarity)
- [x] 10 species at launch (trilobite, ammonite, raptor, mammoth, megalodon, pteranodon, trex, dodo, sabertooth, archaeopteryx)
- [x] Knowledge-gated revival (5-40 facts required per species, fragment collection 3-8 per species, FossilGallery revive button)
- [x] Revival in FossilGallery (progress bar, revive button, companion bonus display, revived badge)

### 5.2 Pet Roles
- [x] Cosmetic companions in dome (CompanionBadge.svelte, activeCompanion in PlayerSave, FossilGallery set/remove)
- [x] Dive companions (10 typed CompanionEffects: mineral_rate, max_oxygen, instant_break, hazard_resist, etc., HUD badge with flash)
- [x] Farm producers (Farm.svelte, time-based production, 3-6 slots, auto-collect on base return, 24h cap)
- [x] Zoo display system (Zoo.svelte, era-grouped, rarity stars, prestige badges Bronze→Platinum)

### 5.3 The Farm
- [x] Animal placement grid (Farm.svelte 2-column slots grid, place/remove revived fossils)
- [x] Passive resource production (time-gated: dust/shard/crystal per hour based on species rarity)
- [x] Collection on login (auto-collect on base screen load via App.svelte handleBackFromFarm)
- [x] Farm expansion (3→6 slots, scaling mineral costs per expansion)
- [x] Plant growing (future) — deferred, farm focuses on fossil companions

### 5.4 The Zoo
- [x] Display area for collection (Zoo.svelte full-screen museum layout, era grouping, species cards)
- [x] Visitor viewing — deferred to multiplayer phase
- [x] Rarity prestige (4-tier collector badges: Bronze 3/Silver 5/Gold 7/Platinum 10 species)

---

## PHASE 6: Advanced Learning Features (20-24 weeks)

**Goal**: Deepen the learning experience

### 6.1 Enhanced Quiz System
- [x] Artifact quiz flow (3-question appraisal, 60% boost chance per correct answer, rarity tier advancement)
- [x] Random mining quizzes (4% chance per block, +8 dust correct, -5 O2 wrong, "Pop Quiz!" overlay)
- [x] Morning/evening review rituals (7-11 AM / 7-11 PM windows, +25 dust bonus, gold pulsing banner in BaseView, auto-refresh timer)
- [x] Pop-up reviews (morning 7-11AM / evening 7-11PM review windows with dust bonus, gold banner in BaseView)
- [x] In-run consistency penalty (wrong in dive on facts with 2+ reps = -8 extra O2, GAIA callout, orange warning in QuizOverlay)

### 6.2 Study Session UX
- [x] Calm setting (floating particles, breathing guide circle, mini Knowledge Tree in corner, card glow effects, progress color transitions, confetti on completion)
- [x] Card flip interface (CSS 3D transform, tap to reveal, front/back card design)
- [x] Self-rating (Got it / Didn't get it buttons, SM-2 quality mapping)
- [x] Tree growth animation during study (mini Knowledge Tree in study calm setting corner, opacity 0.22, grows as progress advances)
- [x] Session size choice (5, 10, or All due — selector before session starts)

### 6.3 Data Discs
- [x] Deep dive content packs (6 Data Discs: Stellar Archives, Bioscan Records, Chronicle Fragments, Tech Blueprints, Geological Survey, Cultural Memory Bank)
- [x] Rare dive drops (DataDisc block type, 1 per mine, rarity-weighted selection, cyan disc rendering)
- [x] Shop purchases for specific categories (Knowledge Store with category boost items purchasable with KP)

### 6.4 Knowledge Store
- [x] Learning milestone currency (Knowledge Points: totalFactsLearned + masteredCount*2 + floor(quizCorrect/10), synced via syncKnowledgePoints in playerData)
- [x] Small powerups tied to categories (4 category boost items in knowledgeStore.ts, +10% quiz accuracy per category)
- [x] Cosmetics unlocks (2 cosmetic items purchasable with KP in Knowledge Store)
- [x] Branch completion bonuses (4 powerup items: O2 Efficiency, Mineral Sense, Quiz Intuition, Deep Scanner — permanent buffs)

---

## PHASE 7: Social & Multiplayer (24-30 weeks)

**Goal**: Create community and social engagement

### 7.1 Dome Visiting
- [ ] View others' Knowledge Trees
- [ ] See their zoo/farm
- [ ] Gallery viewing
- [ ] Guestbook messages
- [ ] Gift sending (facts, minerals)

### 7.2 Leaderboards
- [ ] Deepest dive
- [ ] Most facts mastered
- [ ] Longest streak
- [ ] Biggest tree
- [ ] Best quiz accuracy
- [ ] Global + friends-only

### 7.3 Knowledge Duels
- [ ] Turn-based quiz battles
- [ ] Wager system (oxygen or minerals)
- [ ] Duel history and stats

### 7.4 Fact Trading
- [ ] Marketplace system
- [ ] Direct trades
- [ ] Duplicate mixing (reroll for higher rarity)
- [ ] Anti-exploitation measures

### 7.5 Guilds/Clubs
- [ ] Knowledge-focused groups ("The Historians")
- [ ] Guild challenges
- [ ] Shared progress tracking

---

## PHASE 8: Live Ops & Seasons (Ongoing)

**Goal**: Keep the game fresh with regular content

### 8.1 Seasonal Events
- [ ] "Age of Dinosaurs" (boosted fossils, paleo facts)
- [ ] "Space Month" (astronomy, special biome)
- [ ] "Language Festival" (first language content)
- [ ] Exclusive seasonal rewards

### 8.2 Content Cadence
- [ ] Weekly fact batches
- [ ] Monthly biome additions
- [ ] Quarterly major features
- [ ] Version milestones (`v1.5`, `v2.0`, etc.)

### 8.3 User-Generated Content
- [ ] Community fact submissions (moderated)
- [ ] Fact verification pipeline
- [ ] Submitter credit system

### 8.4 Streak System
- [x] Daily review streaks (consecutive day tracking in recordDiveComplete, streak flame display)
- [x] Milestone rewards (6 milestones 3d→100d: oxygen bonus, dust, crystals, geode, essence, title)
- [x] Streak protection (streak freezes: max 3 stored, 200 dust each, auto-apply on missed day)
- [x] Duolingo-style notifications (BaseView "Streak at risk!" orange warning, clickable streak panel, milestone badge pulse)

---

## PHASE 9: Language Learning Expansion (30+ weeks)

**Goal**: Extend to full language learning platform

### 9.1 Vocabulary System
- [ ] Multi-language support (Spanish, Japanese, French, etc.)
- [ ] Pronunciation guides (IPA, audio)
- [ ] Example sentences
- [ ] Audio clips
- [ ] Auto-generated distractors (semantic similarity)

### 9.2 Grammar & Phrases
- [ ] Grammar rule facts
- [ ] Common phrases
- [ ] Contextual usage
- [ ] Language-specific Knowledge Tree branches

### 9.3 Language-Specific Features
- [ ] Speaking practice (future)
- [ ] Listening comprehension
- [ ] Writing exercises
- [ ] Conversation scenarios

---

## PHASE 10: Mobile Launch & Monetization (32+ weeks)

**Goal**: Ship to app stores and establish revenue

### 10.1 Capacitor Build
- [ ] Android build and testing
- [ ] iOS build and testing
- [ ] App store assets (screenshots, videos)
- [ ] Store listings
- [ ] Beta testing (TestFlight, Play Console)

### 10.2 Monetization
- [ ] Subscription system (unlimited oxygen)
- [ ] Premium Materializer integration
- [ ] IAP implementation
- [ ] Analytics and conversion tracking
- [ ] Fair-play balance (top players can play free via mastery)

### 10.3 Backend Infrastructure
- [ ] Fastify + TypeScript API
- [ ] PostgreSQL + Drizzle ORM
- [ ] JWT auth with refresh tokens
- [ ] Save sync (cloud + local)
- [ ] Docker deployment (Railway/Fly.io)

### 10.4 Launch Prep
- [ ] Privacy policy
- [ ] Terms of service
- [ ] COPPA compliance (kid mode)
- [ ] Marketing materials
- [ ] Press kit
- [ ] Community Discord/Reddit

---

## PHASE 11: Advanced Features (Post-Launch)

### 11.1 Combat System
- [ ] Underground creatures
- [ ] Boss encounters at layer boundaries
- [ ] Combat mechanics (turn-based or real-time)
- [ ] Loot from creatures

### 11.2 Cooperative Dives
- [ ] 2-player shared mines
- [ ] Split up to cover ground
- [ ] Shared oxygen pool
- [ ] One mines, one answers quizzes

### 11.3 Achievement Paintings
- [ ] Pixel-art versions of famous paintings
- [ ] Unlock via milestones
- [ ] Gallery display
- [ ] Shareable capture flow

### 11.4 Ambient Storytelling
- [ ] Environmental flavor text
- [ ] Biome-specific lore
- [ ] Readable blocks
- [ ] Ruins with history

### 11.5 Pixel Art Per Fact
- [ ] ComfyUI pipeline for fact illustrations
- [ ] Greyscale-to-color progression by mastery
- [ ] Quality checks (image does not reveal answer)
- [ ] Batch processing automation
- [ ] 500+ images generated

---

## Open Questions & Decisions Needed

Unresolved design and scope decisions are tracked in `docs/OPEN_QUESTIONS.md`.

---

## Testing Access

- Dev server: `npm run dev` -> `http://0.0.0.0:5173`
- Tailscale: `http://100.74.153.81:5173`
- LAN: `http://192.168.122.96:5173`
- DevPanel: Click "DEV" button (top-right) for god-mode testing

## Architecture Reference

- Full vision: `docs/GAME_DESIGN.md`
- MVP spec: `docs/MVP_PLAN.md`
- Roguelite systems: `docs/ROGUELITE_RUNS.md`
- Knowledge system: `docs/KNOWLEDGE_SYSTEM.md`
- Economy: `docs/ECONOMY.md`
- Agent workflow: `CLAUDE.md`
