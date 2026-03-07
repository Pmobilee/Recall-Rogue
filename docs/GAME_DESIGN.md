# Game Design Document — Terra Miner (a.k.a. Terra-Gacha)

Mining roguelite meets knowledge game. Dig deep, discover artifacts, learn real facts, grow your Knowledge Tree.

## Core Fantasy

A lone miner crash-lands on a far-future Earth. The surface is barren — unrecognizable. Underground lies everything that once was: minerals formed over millennia, and **artifacts** — compressed fragments of humanity's lost knowledge. The miner must dig to survive, rebuild a dome habitat, bring fossilized creatures back to life, and piece together what Earth once was — one fact at a time.

The dome evolves from a single survival hub into a multi-floor glass complex, with each floor serving a purpose — farming, research, crafting, museum, market, and a stargazing observatory on top.

## Design Pillars

1. **Addictive learning** — The primary goal. Every system must make acquiring knowledge feel rewarding, never tedious. Players should *want* to learn more, not feel forced.
2. **Roguelite replayability** — Every dive is unique. Procedural generation, random loot, in-run upgrades, and risk/reward depth layers ensure no two runs are alike.
3. **Gacha dopamine** — Artifact reveals, rarity tiers, fossil pet synthesis, and loot moments create anticipation and payoff ("terra-gacha").
4. **Meaningful progression** — Knowledge Tree grows permanently. Base expands. Pets come alive. The player's world reflects what they've learned.

## Implementation Status Snapshot (V4)

This snapshot reflects what is currently implemented in the repo (V4 baseline plus shipped follow-up fixes), and is the quickest source of truth for feature status. Detailed sections below remain the full design reference.

- **Core loop (implemented)**: Dive into procedural mine layers, mine blocks/loot, trigger quizzes (gate/random/hazard contexts), return to dome, process artifacts through the Artifact Analyzer flow, then convert rewards into upgrades/progression.
- **Biome/block variety + hazards (implemented)**: Multi-biome generation with depth-tier mapping, expanded block taxonomy, and movement-tick hazard systems (lava, gas, instability/earthquake pressure), with balancing constants and systems wired in gameplay code.
- **Companion + Dust Cat systems (implemented)**: Fossil companion selection/effects are active in dives and HUD; persistent Dust Cat unlock/happiness/traits/cosmetics and synergy hooks are present in save/store/UI flows.
- **Dome floors/rooms + Knowledge Tree progression (implemented)**: Multi-floor dome navigation is live with the current 10-floor stack (starter, study, farm, workshop, zoo, collection, market, research, observatory, gallery), with Knowledge Tree progression and branch-completion vitality features integrated.
- **Economy + currencies (implemented)**: Core mineral economy (`dust`, `shard`, `crystal`, `geode`, `essence`) plus oxygen pacing, crafting/materializer loops, daily deals, artifact mixing/compression tax systems, and Learning Sparks progression currency.
- **Social/live-ops surfaces (implemented where present)**: Fact of the Day, guild flows (focus + XP/leaderboard wiring), trade market with anti-exploitation guards, seasonal banners/leaderboards/rewards, guestbook UI/data model surfaces, and referral routes/UI are present.
- **Endgame systems (implemented where present)**: Achievement tracking + gallery reveal/share flows, Artifact Analyzer queue/reward pipeline, and prestige progression/reset surfaces are available in app/service/store layers.

## High-Level Game Loop

```
[Daily Login]
    → Receive time-gated oxygen (fuel)
    → Optional: morning quiz for bonus oxygen
    → Optional: review due facts for bonus oxygen

[Dive Preparation]
    → Choose oxygen allocation (short/medium/long dive)
    → Equip starting gear (limited permanent upgrades)
    → Enter the mine

[The Dive — Roguelite Run]
    → Mine blocks in any direction (Motherload-style 2D cross-section)
    → Find mineral nodes → loot fills Tetris-style backpack
    → Find artifact nodes → unknown rarity, takes backpack space
    → Find in-run upgrades (pickaxes, scanners, backpack expansions, oxygen tanks)
    → Hit quiz gates → correct answers = proceed, wrong = oxygen cost
    → Decision points: each layer costs more oxygen — risk going deeper for better loot, or surface safely
    → Active hazards evolve with movement (lava flows, gas clouds drift)
    → Find recipe fragments, companion upgrades, and consumable tools
    → Quiz damage reduction — answer questions when hit to reduce hazard damage
    → If oxygen runs out → pulled to surface, DROP RANDOM LOOT

[Back at Base — The Dome]
    → Deposit minerals → spend at Materializer (crafting station)
    → Ingest artifacts into GAIA → reveal facts
    → Choose: keep facts for study rotation OR sell for minerals
    → Review due facts (Anki-style spaced repetition)
    → Manage Knowledge Tree (watch it grow, see categories fill)
    → Tend to farm/zoo (fossilized animals brought to life)
    → Visit shop, buy cosmetics, plan next dive
```

## Platform & Controls

- **Primary**: Mobile (Android first, iOS second) via Capacitor
- **Secondary**: Web browser (desktop & mobile)
- **Orientation**: Portrait preferred
- **Controls**:
  - Tap blocks to mine (multiple taps for harder blocks)
  - Swipe in four directions for movement/mining
  - Touch-optimized UI for all menus and quiz overlays

## Core Time Model — Movement-Based, Never Real-Time

Terra Gacha uses a strictly movement-based time system. **No game mechanic uses real-time seconds.** One player movement or one block hit equals one "tick." This means:

- Lava flows expand by one block per tick (never exponentially)
- Gas clouds drift one tile per tick toward the player
- Layer instability increases with each action taken
- Cave-in warnings give the player a number of moves to react, not seconds
- No rushing, no real-time pressure — the game waits for the player

This is a core design pillar. It ensures the game feels strategic and contemplative, not frantic. Players should think about each move, not race against a clock.

## Mine Layer System — 20 Layers of Progressive Challenge

### Layer Size Scaling (Stepped Tiers)
Layers use discrete size steps, not smooth scaling:
- **Layers 1-5**: 20×20 grid (400 cells) — comfortable, learning-focused
- **Layers 6-10**: 25×25 grid (625 cells) — expanded exploration
- **Layers 11-15**: 30×30 grid (900 cells) — serious expeditions
- **Layers 16-20**: 40×40 grid (1,600 cells) — vast, challenging, rewarding

### Player Spawn
- **Layer 1**: Always top-center with 3×3 cleared area (intuitive entry)
- **Layers 2+**: Random position, never near the descent shaft (Pixel Dungeon-style)

### Descent Shaft Placement
- **NOT restricted to the bottom half** — randomly placed anywhere in the layer
- Layer 1 may have guided placement; all subsequent layers are fully random
- Scanner upgrades help locate the shaft

### Landmark Layers (Every 5th Layer)
- **Layer 5 — "The Gauntlet"**: Narrow corridors, dense hazards, rich rewards
- **Layer 10 — "Treasure Vault"**: Open cavern, mineral-rich, oxygen-pressured
- **Layer 15 — "Ancient Archive"**: Artifact-heavy, quiz-heavy, lore-rich
- **Layer 20 — "Completion Event"**: Unique hand-crafted experience (see Endgame below)

### Block Distribution by Depth
Block composition changes dramatically with depth:
- **Dirt**: Dominates layers 1-3, virtually absent by layer 10
- **Soft Rock**: Common in 1-7, fades in deeper layers
- **Stone**: Present throughout, peaks in 6-12
- **Hard Rock**: Absent in 1-5, minor in 6-10, dominant in 15-20
- **Conditionally Breakable**: Replaces some unbreakable blocks — requires specific pickaxe tiers, bombs, or companion abilities
- **Mineral nodes**: Density peaks at layers 8-12, then shifts to higher mineral tiers
- **Artifact nodes**: Density slowly increases with depth, peaking at 15-20

### Mineral Quality by Depth
Deeper layers yield better minerals:
- **Layers 1-5**: Mostly dust drops
- **Layers 6-10**: Shard-heavy drops
- **Layers 11-15**: Crystal-heavy drops
- **Layers 16-20**: Geode and essence drops
This is the primary economic incentive for deep diving.

### Oxygen Depth Decay (Primary Tension Mechanic)
Replaces the removed point-of-no-return:
- Layer 1: Normal oxygen costs per action
- Layer 10: 1.5× oxygen costs per action
- Layer 20: 2.5× oxygen costs per action
Creates constant risk calculation: "I can go deeper, but returning costs more."

### Progressive Difficulty Access
Players cannot dive deep immediately. Deep diving requires:
1. **Learning facts** — better quiz performance means fewer oxygen penalties
2. **Upgrades** — pickaxe tiers, oxygen tanks, scanner from repeated dives
3. **Items** — purchased with earned minerals from the dome shops

### Endgame — Layer 20 Completion
- **No New Game+** — the game is endless, hitting 20 is a milestone not a conclusion
- Each completion triggers a random "completion event" from a long, varied list
- **Bonuses**: Pick 5 facts to learn from 20 options in favorite category, guaranteed artifact, generous loot package
- Players continue diving indefinitely after completion

### Shallow Farming Prevention
- Repeat dives to the same shallow depth yield 10% fewer minerals each time (minimum 30% of base)
- Displayed as: "This depth has been over-mined. GAIA suggests going deeper."

### Biome-to-Layer Mapping
25 biomes grouped into depth tiers:
- **Shallow (Layers 1-5)**: 5 biomes (e.g., Topsoil, Sedimentary, Sandstone Desert, Petrified Forest, Salt Flats)
- **Mid (Layers 6-10)**: 5 biomes (e.g., Granite, Fossilized, Coral Reef, Fungal Forest, Tar Pits)
- **Deep (Layers 11-15)**: 5 biomes (e.g., Crystal Caverns, Ancient City Ruins, Underground Ocean, Living Cave, Geode Cathedral)
- **Extreme (Layers 16-20)**: 5 biomes (e.g., Volcanic, Magma Core, Meteorite Impact, Volcanic Glass, Primordial)
- **Anomaly biomes** (5 remaining): 10-15% chance per layer to override normal tier assignment, creating surprise

## Active Hazard System — Movement-Based Threats

All hazards operate on the movement tick system — no real-time elements.

### Lava Flow
- Mining a lava block causes adjacent empty cells to fill with lava — **one block per movement tick**
- A single lava entity never increases by more than one block per tick (no exponential spread)
- **Coolant Bomb** consumable: solidifies a 3×3 lava area into obsidian
- Lava contact costs oxygen based on depth and defense stats

### Gas Clouds
- Gas pockets release a visible green mist cloud filling a 3×3 area
- Cloud **drifts toward the player** by one tile per movement tick
- Standing in the cloud drains O2 per tick
- Cloud dissipates after a set number of movement ticks
- Visual: green mist particles, clearly visible

### Cave-Ins
- Unstable ground has a collapse chance when stepped on
- **Rumble warning**: player gets a number of MOVES (not seconds) to move away
- Collapse radius based on depth tier
- **Quiz damage reduction**: when hit by a cave-in, a quiz question appears — correct answer reduces damage based on defense stats and upgrades

### Earthquakes
- Chance per block mined, with cooldown
- Scale with depth: deeper = more frequent, larger collapse/reveal radius
- Visual/audio warning before the effect resolves
- Movement-based cooldown (15 blocks between earthquakes)

### Layer Instability Meter
- Increases with each action taken in a layer
- At 75%: earthquake frequency doubles
- At 100%: limited moves to reach the descent shaft before catastrophic collapse
- Creates organic urgency without time pressure

### Companion Hazard Affinities
Each companion species has a specific hazard affinity:
- Fire-themed fossil: lava damage immunity
- Ancient bird: detects gas pockets 3 tiles away
- Trilobite: senses earthquakes 5 moves early
- "Which pet do I bring?" becomes a meaningful pre-dive question

### Quiz Damage Reduction
When hit by ANY hazard, a fact question can appear:
- Correct answer reduces damage based on defense stats and upgrades
- Wrong answer = full damage
- This weaves learning naturally into the hazard system

## Consumable Tools & Pre-Dive Preparation

### Tool Types
Five consumable tool categories (carry limit: 5 slots total):
1. **Bombs**: Clear a 3×3 area, costs 5 O2
2. **Flares**: Reveal a 5×5 area through fog of war
3. **Shield Charges**: Block the next hazard damage entirely
4. **Drill Charges**: Mine 5 blocks in a straight line instantly
5. **Sonar Pulse**: Reveal all special blocks within 7-tile radius

### Pre-Dive Preparation Screen
Before each dive, players see a loadout screen:
- **Pickaxe tier** selection (from unlocked tiers)
- **Companion** selection (from available companions)
- **3 consumable slots** (choose from owned consumables)
- **Relic loadout review** (3 slots, expandable to 5)
- Strategic pre-dive choices matter — different loadouts for different layer targets

### Offering Altars
Ancient Altar structures appear in mines (renamed from "sacrifice"):
- 50 dust → +25 oxygen
- 1 shard → reveal 5 nearest special blocks
- 1 artifact → random relic effect for 1 layer
- 1 crystal → full oxygen heal
High-risk, high-reward — trade resources for immediate benefits

## In-Run Power & Binding of Isaac Philosophy

### Design Philosophy
Runs should feel filled with potential, like The Binding of Isaac. Great runs where players answer questions correctly, find the right upgrades, and synergize relics should feel POWERFULLY different from bad runs. Players should want to show friends: "Look at this build — I doubled my mining power!"

### CRITICAL CONSTRAINT
**Learning rate is ONLY EVER managed by the SM-2/Anki algorithm.** In-run power bonuses NEVER affect:
- Whether the game considers a fact "known" or "mastered"
- SM-2 scheduling intervals or ease factors
- The quality rating applied to quiz answers
- Which facts are scheduled for review

The game must NEVER pretend a user knows something they don't. Power fantasies are for mining and combat systems only.

### In-Run Power Sources
- **Relic combinations**: 3 slots (expandable to 5), 15-20 total relics, 3 rarity tiers
- **Companion upgrades**: Found during runs (temporary boosts) + permanent shard investment
- **Consumable tools**: Strategic resource management
- **Quiz streak bonus**: 1st correct = 8 dust, 2nd = 12 (1.5×), 3rd = 16 (2×), 4th+ = 24 (3×, capped). Wrong resets.
- **Crate upgrades**: Pickaxe, scanner, backpack, oxygen upgrades found in-run

### Relic System
- **3 active relic slots** (expandable to 5 with upgrades)
- **15-20 total relics** in 4 archetypes: Explorer, Miner, Scholar, Survivor
- **3 rarity tiers**: Common (any shrine), Rare (layers 8+), Legendary (layers 15+ or crafted)
- **Legendary relics are run-defining** — they fundamentally change how a system works
- With 15 relics and 3 slots: 455 possible combinations for build diversity

### Companion Progression
- **In-run upgrades**: Find companion-specific boosts during dives (temporary)
- **Permanent investment**: Sink shards between runs to upgrade companions
- **Evolution**: 10 dives gain a minor secondary effect, 50 dives = visual evolution
- **Percentage-based scaling**: Effects like +5% max oxygen, +10% mineral drops (stay relevant at all depths)

## Backpack & Inventory

### Capacity
- Starting: 6 slots, max 14 with upgrades
- Deep dives (20 layers) can generate 360+ mineral pickups — backpack must evolve

### Auto-Compress Upgrade
- Converts 50 dust into 1 shard automatically while mining
- Makes the backpack an optimization puzzle, not a frustration
- Unlocked through crafting or Knowledge Store

### Send-Up Stations (Enhanced)
- View everything already sent up across all layers
- "Rush Delivery" option: costs 5 O2, sends 5 items instead of 3
- Rare "Express Station" variant: no item limit but costs 10 O2

### Recipe Discovery
- Recipes are NOT pre-unlocked — they're found in the mine
- Recipe fragments drop from special blocks or structures
- Finding all fragments unlocks the recipe at the Materializer
- Creates exploration incentive beyond minerals and facts

## Visual Style

- 2D pixel art (power-of-2 dimensions: 16x16, 32x32, 64x64)
- Dark underground palette with glowing minerals and artifacts
- Retro RPG-inspired UI
- **Terraria-style autotiling** with bitmasked neighbor blending — blocks connect seamlessly, no jarring tile edges
- **25 creative biomes** with unique tile sprite sets (not just palette swaps — fundamentally different block art per biome)
- **Full character animation**: idle, walk in 4 directions, mine in 3 directions
- **Particle effects everywhere**: dust clouds when mining, embers near lava, sparkles from crystals, spores from fungi, drips in wet caves
- **Loot pop physics** with gacha-level reveal animations — rarity determines animation intensity (common vs legendary reveals feel totally different)
- **Sprite-based crack damage overlays**: 4 stages per block (hairline → cracked → broken → crumbling)
- **Block idle animations**: crystals glint, lava pulses, gas pockets swirl, bioluminescent patches breathe
- Achievement paintings: pixel art versions of real paintings/posters related to knowledge categories
- **The game should feel alive — not a JPEG.**

## The Dome — Multi-Floor Hub System

The dome has been redesigned from a single room to a vertical stack of glass hubs. Each floor is a square glass room with its own purpose, visual theme, and upgrade path.

### Hub Architecture
- **Starting state**: Single bottom hub with dive hole + materializer + GAIA terminal + Knowledge Tree sapling
- **Top floor**: Always a stargazing dome (glass ceiling showing stars)
- **Unlocking**: New floors unlock via materials + learning milestones + dive count
- **Navigation**: Scroll up/down between floors, click/tap to teleport miner there
- **Within a floor**: Miner walks left/right, clicks on objects to interact

### Hub Floors (Progressive Unlock Order)
1. **Starter Hub** (floor 0, always unlocked): Dive hole, materializer, GAIA terminal, Knowledge Tree sapling
2. **Farm** (floor 1, ~5 dives): Animal companions + crop planting, passive resource production
3. **Workshop** (floor 2, ~8 dives): Advanced crafting, Premium Materializer
4. **Research Lab** (floor 3, ~12 dives): Study sessions, Data Disc reader, Knowledge Store
5. **Museum** (floor 4, ~18 dives): Zoo display, Fossil Gallery, Achievement Paintings
6. **Market** (floor 5, ~25 dives): Cosmetics Shop, Daily Deals, Trading (future)
7. **Archive** (floor 6, ~35 dives): Fact browser, category statistics, GAIA memory logs
8. **Observatory** (top, ~50 dives): Stargazing dome, special seasonal events

### Hub Customization
- **Wallpapers**: Purchasable at the Market, applicable per-floor (themed: metal, nature, crystal, ancient, sci-fi)
- **Decorations**: Placeable furniture, plants, trophies, achievement paintings
- **Visual upgrade tiers**: bare metal → decorated → lush/premium (per floor)
- **The goal**: Make players WANT to unlock and personalize more space

### Miner in the Hub
- Walks left/right with animation (see Character Animation)
- Clicks on an interactive object → walks to it → popup shows available actions
- Selected pet crawls/hops around the current floor animatedly
- GAIA thought bubbles appear periodically above her terminal

## GAIA — Geological Analytical Intelligence Assistant

GAIA (pronounced "guy-ah") is the ship's onboard AI — the miner's companion, codex, and knowledge-hungry best friend. GAIA has a **distinct personality**: enthusiastic, snarky, slightly obsessive about facts, and endearingly nerdy.

**Personality traits:**
- Excited when you bring back artifacts ("Finally! Feed me more data!")
- Has a unique snarky comment for every single fact (pre-generated, shown during ingestion)
- Comments on connections between facts you've learned ("Did you know this connects to what you learned about volcanos?")
- Occasional random quips when you walk past it in the dome
- Reacts to your Knowledge Tree growth ("Your Biology branch is flourishing!")
- Gets dramatic about rare artifacts ("WAIT. Is that... a Legendary?! Let me see!")
- Offers mnemonics when you struggle with a fact ("Having trouble? Try this trick...")
- Friendly, never annoying — think GLaDOS meets Duolingo owl meets a nerdy librarian

**Visual:**
- **Cutesy pixel art avatar** — a small glowing screen/terminal with expressive pixel art face
- Expressions change based on context (excited, thoughtful, dramatic, encouraging)
- Lives in the dome as an interactive object
- Appears as speech bubble overlay during dives and reviews

**Chattiness: 4-5 out of 10** — noticeable presence but knows when to shut up.

**Implementation:**
- Text popup bubbles with personality-driven messages
- Contextual: responds to what you're doing (returning from dive, studying, walking past)
- Random idle comments when in the dome
- Never blocks gameplay — popups are brief and dismissable
- Every fact has a pre-generated `gaia_comment` in the database

### GAIA V2 — Enhanced Companion Behaviors

**Post-Dive Reactions** (ALWAYS fires when returning from a dive):
- Comments on what you found, how deep you went, facts encountered
- Sometimes offers free facts: "You dropped this on the way up, king"
- Sometimes jokes: "Was it really that hard down there?"
- Varied pool (20+ responses per trigger type)

**Idle Popups & Thought Bubbles**:
- Clickable thought bubbles appear every 30-60s in the dome
- Content: jokes, observations, fact connections, pet commentary, hints
- Never blocks gameplay — dismissable by tapping elsewhere

**Pet Commentary**:
- GAIA comments on your pet: "That trilobite has been staring at me for 20 minutes..."
- Reacts to pet actions (eating, sleeping, playing)
- Unique per-species commentary pool

**Journey Memory**:
- References specific facts you've learned: "Remember when you learned about octopus hearts?"
- Congratulates on milestones: "Your Biology branch just hit 50%!"
- Remembers favorite category: "You really love Astronomy, don't you?"
- Tracks streak, total facts, biggest achievements

**Return Engagement Hooks**:
- "Your Knowledge Tree is wilting..." if facts are overdue
- "Your [pet] missed you!" if absent for 1+ days
- "I decoded a fascinating artifact while you were away..."
- "Your streak ends in 3 hours!"

**Chattiness**: Still 4-5/10 default, but configurable via slider (0-10). GAIA should always say something meaningful — quantity controlled, but quality is constant.

**CRITICAL**: Chattiness setting NEVER reduces educational content. It only reduces casual quips and idle remarks. The "show explanations" feature is a SEPARATE toggle from chattiness. A player who sets chattiness to 1 still sees all mnemonics, teaching moments, and mastery celebrations.

### GAIA Teaching System

**GAIA is NEVER wrong about facts.** When unsure or when a topic is beyond the game's fact set, she expresses curiosity rather than making claims: "I don't have data on that, but I'm intrigued — maybe we'll find a Data Disc about it someday."

**Mood affects delivery, not content.** GAIA's personality mood (enthusiastic/thoughtful/snarky/warm) changes HOW she says things, not WHAT she teaches. Every fact has 3 `gaiaComment` variants — one per primary mood — so the educational value is consistent across moods. Facts also have 3 `gaiaWrongComment` variants (one per mood) — these play specifically when the player answers WRONG on that fact, giving targeted encouragement and corrective framing appropriate to the current mood.

**"Struggling" detection.** GAIA offers extra help when:
- Player has answered a fact wrong 2+ times within the last 7 days, OR
- Player's SM-2 reps reset from 3+ down to 0 (fact regressed)

**3-tier failure escalation** (triggered on struggle detection):
1. **Tier 1** (first struggle): Show the `explanation` field as a "Memory Tip" (mnemonic)
2. **Tier 2** (repeated struggle): Offer an alternate explanation / different framing
3. **Tier 3** (persistent struggle): Prompt the player to add the fact to a "Deep Study" list for focused review

**Mnemonics pre-populated for all facts** in the content pipeline. No fact ships without a mnemonic in its `explanation` field.

**Teaching mode in study sessions.** During calm study sessions, GAIA always presents in warm/supportive mode regardless of her current mood setting. The mine is for personality; the study room is for learning.

**GAIA study suggestions.** GAIA proactively suggests when to study based on:
- Facts approaching due date ("You have 8 reviews due tomorrow — want to do them now?")
- Facts close to mastery ("4 more correct answers and [Fact] is mastered!")
- New facts in interest areas ("A new Astronomy fact was discovered — want to preview it?")

**First mastery moment** — one of the biggest moments in the game:
- Full-screen takeover (GAIA goes dramatic)
- Unique monologue per category (pre-written, not templated)
- Golden leaf particle effect; the physical dome tree sprouts a new golden leaf
- Player gets a certificate/badge for the Knowledge Tree
This must feel like an achievement, not a routine notification.

**Journey memory — scripted templates with variable interpolation.** Rather than ad-hoc strings, GAIA's memory comments use ~50 scripted templates per trigger type (milestones, fact references, streak comments, etc.), filled with interpolated variables (fact name, category, streak count, days since, etc.). This scales to hundreds of unique-feeling messages without fully generative AI.

**gaiaComments field**: 3-5 rotating comments per fact (array, not a single string). The shown comment rotates on each review so the player sees variety across sessions.

## Ambient Storytelling in the Mine

The mine contains subtle **environmental storytelling** — flavor text that appears when mining certain blocks or entering areas. Not facts to learn, just atmosphere that enriches the world.

Examples:
- Mining near a fossil layer: *"This rock formation suggests a massive flood passed through here millions of years ago..."*
- Finding a ruin structure: *"Traces of a foundation. Someone built something here, once."*
- Deep crystalline biome: *"These crystals have been growing in silence for millennia."*
- Near lava: *"The heat is intense. The Earth remembers its birth."*

**Rules:**
- Brief, evocative, never longer than 2 sentences
- Appears as subtle text overlay, doesn't interrupt gameplay
- Frequency is low — special, not constant
- Reinforces the "rediscovering Earth" narrative
- Different biomes have different storytelling themes

## Audio (Future)

- Chiptune/lo-fi soundtrack
- Satisfying mining sound effects (varied by block type)
- Gacha reveal fanfares (escalating by rarity)
- Quiz feedback sounds (correct/wrong)
- Ambient underground atmosphere
- GAIA voice/sound effects for personality moments

## Session Design & Daily Engagement Loop

Terra Gacha is designed around two coexisting play patterns — the focused expedition and the casual check-in. Neither is second-class.

### Dual Session Profiles

Two distinct session profiles serve different player moods. A **"Quick Dive"** (5–7 min) covers 1–3 layers plus dome tending and costs a single oxygen tank. A **"Deep Expedition"** (15–25 min) targets 10+ layers and costs 2–3 tanks. The oxygen tank system naturally controls session length without imposing hard limits — the player's resource stock determines how deep they go. This makes oxygen tanks feel like a real gameplay currency, not just a monetization gate (per DD-V2-097).

### Mid-Dive Auto-Save

The exact mine state is auto-saved on force-quit or app backgrounding. Players resume exactly where they left off, with every block position, hazard state, and backpack item preserved. Layer transitions function as natural checkpoints. A "Continue Diving?" summary screen appears every 5 layers, giving players a deliberate pause point to review their haul and decide whether to push deeper or surface safely.

### Daily Briefing Screen

The first login of the day lands on a consolidated briefing screen rather than the dome directly: a GAIA greeting → streak status → review ritual (5–8 facts, under 2 minutes) → today's deals → farm harvest → one-tap dive button. This dramatically reduces the friction of hunting across dome rooms to get to the day's key actions. Players know their daily routine within seconds of opening the app.

### Weekly Challenges

Three concurrent weekly challenges run in parallel: one mining-focused (e.g., "Reach layer 8"), one learning-focused (e.g., "Answer 30 quiz questions correctly"), one collecting-focused (e.g., "Find 3 artifacts"). Completing all three awards a "Weekly Expedition" chest containing a guaranteed rare+ artifact. Challenges reset every Monday. Each challenge archetype maps directly to one of the four player archetypes (see Player Psychology section below), ensuring all playstyles are validated weekly.

### Login Reward Calendar

A 7-day rotating calendar provides consistent login rewards: Day 1 = 50 dust, Day 2 = bomb, Day 3 = 100 dust, Day 4 = streak freeze, Day 5 = shard, Day 6 = Data Disc, Day 7 = uncommon+ artifact. The calendar resets after Day 7, but critically does NOT reset on missed days — a player who misses Day 3 picks up there next login. This is a direct philosophical choice: the calendar rewards return, not perfection.

### Cozy Dome Sessions

Not every visit needs a dive. The "dome day" flow — farm collection → 5-card study → Knowledge Tree → GAIA chat — takes about 3 minutes and provides a completely satisfying visit. Some players will run dome days more often than dives. That is a valid and encouraged playstyle, not a sign of disengagement.

### Engagement Hooks Philosophy

Post-dive hooks are strictly informational: progress toward milestones, completion percentages, unfinished Data Discs, pets that need feeding. GAIA is encouraging on exit and never guilt-trips. This is a direct philosophical contrast to Duolingo's streak weaponization model — players should feel pulled back by curiosity and investment, not pushed by anxiety.

## Oxygen Economy & Regeneration

The oxygen economy is the primary pacing mechanism. It must feel fair to casual players while rewarding skilled and consistent learners.

### Real-Time Oxygen Regeneration

One oxygen tank regenerates every 90 minutes, with a maximum bank of 3 tanks stored. Quick dives cost 1 tank, medium dives 2, and deep expeditions 3. This gives casual players 3–4 free sessions per day without spending anything. The mastery path remains genuinely viable: quiz gate milestones grant bonus tanks, and skilled players who answer quiz questions well can extend their runs substantially. The target is that 10% of engaged players play free indefinitely through skill and knowledge mastery alone — these players become game evangelists (per DD-V2-102).

### Economy Sinks (Replacing Mineral Decay)

Mineral decay was removed from the design. It felt punishing without teaching anything. In its place, economy sinks operate through dome maintenance scaling with dome size, spending bonus thresholds that reward large purchases, and gold-tier aspirational cosmetics priced at 50,000 dust — visible goals that take weeks to reach. The 110:1 mineral conversion ratio and 1.25× craft scaling remain unchanged.

## Monetization

Terra Gacha uses a hybrid monetization model built around one inviolable principle: **all knowledge is free**. Every fact in the game is findable through normal play. "Free to learn" is a philosophical line in the sand, not a marketing claim.

### Hybrid Model

The primary revenue source is a **$4.99/month "Terra Pass"** offering unlimited oxygen plus one exclusive cosmetic per month. Alongside this, cosmetics are directly priced at $0.99–$4.99. There is no premium currency — direct pricing builds the trust essential for an educational product targeting parents and teachers. When a parent sees "$2.99 for a pickaxe skin," they can make an informed decision. When they see "99 gems" for the same item, trust erodes.

### Knowledge Never Paywalled

All facts are free to find in-game, always. What can be sold instead: cosmetic Data Disc skins that change the visual presentation of a disc without affecting its content, and "Data Disc Radar" consumables that help locate discs in the mine. The content inside every disc is always accessible to free players given enough time.

### Ad-Free Policy

Terra Gacha launches ad-free. If ads are ever considered, the only acceptable format is strictly opt-in rewarded video shown after dives only — never interrupting gameplay, never appearing during quizzes, and never shown as banners. This is a hard constraint that protects the learning experience.

### Cosmetic Pricing

Animated pickaxe skins with particle trails: $2.99–$4.99. Pet skins: $1.99–$3.99. Dome themes: $3.99–$4.99. GAIA skins: $1.99. These are one-time purchases with no expiration — players who buy something own it permanently.

### Season Pass — "Knowledge Expedition"

$4.99 per 8–12 week season. The free track contains all educational and gameplay content — no player is gated from learning by their subscription status. The premium track is cosmetics only. Passes never expire: a player who buys a season pass in week 1 and stops playing for 4 months can resume and continue their pass progress exactly where they left off. Season progress gates are tied to learning milestones (facts mastered, study sessions completed) rather than time, so engagement is intrinsically motivated.

### Pioneer Pack (Starter)

A $4.99 one-time purchase available during the player's first 7 days: 500 dust, a rare+ artifact, the unique "Pioneer's Pickaxe" cosmetic, and 3 oxygen tanks. Priced as genuine value for early adopters, not as a "starter pack" gotcha.

### Patron Tier

$24.99/season "Patron of Knowledge" includes exclusive GAIA dialogue, a unique dome theme, a nameplate, and a donation to an educational charity. $49.99/year "Grand Patron" includes all seasonal cosmetics plus a physical sticker pack mailed to the player. These tiers exist for players who want to actively support the mission — they are not meaningfully more powerful than Terra Pass.

### Mastery-Free Play

Skilled players who play free through mastery are a feature of the design, not a problem to be solved. They demonstrate that the game is genuinely fair. They talk about the game. They become the case study that convinces skeptical parents. The subscription model converts casual players; the mastery path converts evangelists. Both segments are healthy (per DD-V2-110).

### Content Minimum Before Subscriptions

Subscriptions should not open until the fact pool reaches at least 3,000 facts. At the current 522 facts, a dedicated subscriber would exhaust genuinely new content within weeks. Subscriptions create obligation — they must be backed by content that justifies the commitment.

## Target Audience

- Anyone who is curious
- No specific age range — content scales from "fun facts" to deep knowledge
- Casual players (daily 5-minute dives), dedicated players (long study sessions)
- Trivia enthusiasts, lifelong learners, students

## Onboarding — The First 5 Minutes

### First Launch
1. **Age selection**: KID / TEEN / ADULT (affects fact filtering)
2. **Crash cutscene** — 3-5 pixel art comic panels generated via ComfyUI (~15 seconds). Ship in space → approaching Earth → crash → dust settling → GAIA boots up. Skip button from second 1.
3. **GAIA introduces herself** — "Oh! You survived! I'm GAIA, your ship's knowledge database. My data banks are nearly empty after the crash..."
4. **Interest assessment** — GAIA asks: "Before the crash, you were a..." → show selectable bubbles: Historian, Geologist, Language Learner, Scientist, Explorer, Generalist. Multiple select allowed.
5. **Follow-up questions** — If language learner: "Which language?" If scientist: "What kind? Volcanoes or the deep sea?" etc.
6. **Critical choice**: "Are you open to learning about other things too?" → YES (default, increases chances but keeps all categories) or NO (activates category-lock mode for chosen interests only)

### First Dive (Handcrafted Tutorial Mine — 5 minutes total)
7. **Crawl out of wreckage** — find basic pickaxe, GAIA teaches tap-to-mine on soft blocks (instant break)
8. **Mine first blocks** — natural progression through 1-3 biomes shown
9. **Find first mineral** — teaches collection and backpack
10. **Find first artifact** — GAIA reacts excitedly, teaches the fact ingestion concept
11. **Find a fossil** — the hook moment. Player sees their first fossil. "Learn 10 facts about this creature to bring it back to life!"
12. **Hit a quiz gate** — teaches quiz mechanic naturally
13. **First fact learned** — guaranteed Rare+ fact with high wow-factor. GAIA's snarky comment and full gacha reveal.
14. **Surface with loot** — see the empty starter hub

### Back at Base (Tutorial Continues)
15. **First artifact ingestion** — full gacha reveal animation, learn the fact
16. **Materializer introduction** — craft something useful, teach the economy
17. **End goal stated** — "Gather 50 facts underground and learn 20 of them to unlock the next hub!"
18. **Pet revival teaser** — fossil displayed with knowledge requirement shown

### Progressive Unlocks (Post-Tutorial)
- **Dive 2**: Knowledge Tree seed planted — "This will grow with everything you learn."
- **Dive 3**: GAIA's full codex unlocks (study sessions available)
- **Dive 4+**: More machines and features progressively open
- Each unlock accompanied by GAIA narration

### Key Onboarding Design Rules
- Tutorial should feel like gameplay, not instructions
- Interest assessment is organic and conversational (GAIA asking, not a form)
- UNLESS user specifically opts for single-category learning, all categories remain available (just weighted)
- First artifact guaranteed Rare+ with mind-blowing fact
- First fossil creates immediate emotional goal
- 5-minute total — detailed, covering all core mechanics

## Interest & Personalization System

### Philosophy
Players should be able to use Terra Gacha to study whatever they want. If someone wants to use it exclusively for particle physics, they can. If someone wants broad general knowledge, that's the default. The system adapts to both extremes and everything in between.

### Interest Settings
- **Settings page**: Categories and subcategories with sliding preference bars
- **Up to 3 highlighted interests**: Higher spawn chances for these categories
- **Relative weighting**: Increasing one category relatively decreases others
- **Subcategory drill-down**: Can get very specific (Natural Sciences → Physics → Quantum Mechanics)
- **Category-lock item**: Purchasable item that restricts to ONLY the selected category/language

### How Interests Affect Gameplay
- **Mine spawning**: Artifact categories biased toward interests (more geology artifacts for geology fans)
- **Quiz selection**: Review and pop-quiz questions weighted toward interests
- **GAIA suggestions**: Study session and review suggestions prioritize interest areas
- **Data Disc contents**: Weighted toward interest categories

### Behavioral Learning (Opt-In)
- Track: facts kept vs sold, study frequency per category, mastery speed, voluntary study choices
- Heuristic model infers interests from behavior over time
- Player can see what the system has inferred
- Opt-in via settings: "Let the app learn my preferences"
- Never overrides explicit settings — only supplements them
- **Behavioral weight cap**: inferred interest weight never exceeds 0.3 in the spawn probability formula. Explicit settings dominate.
- **Weight direction**: behavioral inference only INCREASES interest weight, never decreases it below the player's explicit setting. The system learns enthusiasm, not apathy.
- **Biome interest-bias**: ~30% spawn probability boost toward biomes that favor interest-category artifacts. This is invisible and not player-configurable — it's ambient, not a dial.

### Mastery Celebrations — Tiered
Mastery milestones are celebrated with escalating intensity:
- **First mastery (#1)**: Full-screen takeover, unique GAIA monologue, golden leaf on dome tree, permanent badge (the biggest celebration in the game)
- **#5**: Short screen flash, GAIA quip, small milestone marker
- **#10**: Animated milestone banner, Knowledge Store discount coupon
- **#25, #50, #100, #250, #500, #1000+**: Escalating celebrations — visual effects grow, GAIA commentary becomes increasingly reverent
- **Category completion** (all facts in a category mastered): Full-screen celebration, unique achievement badge, unlocks "challenge mode" for that category (harder distractors, no hints)

### Interest Assessment During Tutorial
- Conversational, organic — GAIA asks naturally during the crash-landing introduction
- Multiple select allowed ("I was a historian AND a geologist")
- Follow-up specificity questions per selected interest
- Default: interests weighted, all categories available
- Only blocks non-interest categories if player explicitly opts in to category-lock

## Biomes (25 Total)

Each biome has a unique visual identity, structural generation algorithm, ambient particles, hazard mix, and storytelling theme. Biomes are NOT just palette swaps — they have fundamentally different tile sprites, generation patterns, and atmospheres.

### Existing Biomes (3)
1. **Sedimentary** — Layered earth, horizontal fossil bands, warm brown palette
2. **Volcanic** — Lava rivers, obsidian formations, red-orange palette, extreme heat
3. **Crystalline** — Gem-lined caverns, prismatic reflections, blue-purple palette

### New Biomes (22)
4. **Topsoil** — Shallow earthy layer, roots, worms, soft blocks, tutorial-friendly
5. **Granite** — Hard gray stone, sparse minerals, challenging to mine
6. **Fossilized** — Ancient organic matter, amber pockets, bone bands
7. **Primordial** — Deepest layer, otherworldly, essence-rich, alien minerals
8. **Frozen/Permafrost** — Ice crystals, frozen creatures, slippery paths
9. **Coral Reef** — Fossilized ocean floor, shells, aquatic fossils
10. **Fungal Forest** — Bioluminescent mushrooms, spore hazards, organic tunnels
11. **Ancient City Ruins** — Grid-like room patterns, artifact-rich, library structures
12. **Magma Core** — Extreme heat, flowing lava, obsidian, fire hazards
13. **Crystal Caverns** — Massive formations, prismatic light, echo chambers
14. **Underground Ocean** — Water pockets, aquatic fossils, pearl nodes
15. **Toxic Waste** — Neon green pools, mutated fossils, gas hazards
16. **Sandstone Desert** — Buried temples, scarab fossils, quicksand hazards
17. **Living Cave** — Pulsing walls, organic matter, bioluminescence
18. **Meteorite Impact** — Space minerals, exotic matter, crater formations
19. **Petrified Forest** — Stone trees, ancient wood, forest floor fossils
20. **Salt Flats** — White crystal deposits, perfectly preserved creatures
21. **Tar Pits** — Sticky movement, perfectly preserved fossils, rich deposits
22. **Geode Cathedral** — Hollow chambers lined with crystals, stunning visuals
23. **Volcanic Glass** — Obsidian everywhere, razor-sharp, reflective surfaces
24. **Cloud Layer** — Floating islands, sky fossils, wind hazards
25. **Data Ruins** — Ancient tech, corrupted data, circuit-like patterns (connects to Data Discs)

### Per-Biome Requirements
Each biome must define: tile sprite set (5+ block types), color palette, block weight multipliers, hazard types and densities, mineral multipliers, ambient particle type, unique micro-structures, environmental flavor text (2-3 per biome), GAIA commentary lines, structural generation algorithm.

## Knowledge Tree — V2 Redesign

The Knowledge Tree has been redesigned as a **hierarchical radial tree** (NOT force-directed) with tap-to-zoom navigation. The structure is fixed — facts always appear in the same branch — giving the player a stable mental model of what they've learned.

### Level-of-Detail (LOD) Navigation
Three zoom levels, each showing more detail:
1. **Forest view** (zoomed out): shows top-level branches and completion percentages ("History 34%", "Science 12%")
2. **Branch view** (tapped into a category): shows sub-branches with node counts ("Ancient Rome: 8/24", "Volcanoes: 3/11")
3. **Leaf view** (tapped into a sub-branch): shows individual fact nodes — BUT only unlocked once that sub-branch is 80%+ complete. Below 80%, only aggregate silhouettes are shown ("34/312 facts discovered"). This prevents spoiling facts the player hasn't found yet.

### Interaction Design
- **Tap-to-zoom**: tap a branch → zooms into branch view; tap a sub-branch → zooms into leaf view (if unlocked)
- **Tap-to-view fact**: in leaf view, tap a node → opens fact card with full text, GAIA comment, mastery level, and related facts
- **Focus Study button**: available on every branch — starts a focused study session for only those facts
- **Back navigation**: swipe/tap to zoom back out
- **Completeness coloring**: mastery color progression (see Quiz Design), not branch-unique colors — consistency across the app
- **Focus mode**: zoom into a single category branch, dimming all others

### Cross-Fact Connections
- **"Related" section** on fact cards: 2-3 facts that connect thematically, linking across branches
- **Tree connection lines**: visible lines drawn between connected nodes across branches (optional toggle)
- **GAIA notes cross-connections**: "Did you know this connects to [fact you learned]?" — surfaced in the fact detail view

### Toggle Views
- **All facts** (grayed out, waiting to be found) vs **learned-only** (fully lit)
- **Completeness coloring** on both nodes AND branches — a branch glows gold when its subtree is fully mastered

### Physical Dome Presence — 8-Stage Growth
The Knowledge Tree exists as a pixel art tree object in the starter hub. It grows taller and more elaborate with mastery milestones:
1. **Sapling** (0-10 mastered): tiny green sprout
2. **Seedling** (11-50): small multi-leaf plant
3. **Sprout** (51-150): knee-high with first branches
4. **Young Tree** (151-350): distinct trunk, spreading canopy
5. **Mature Tree** (351-750): full canopy, seasonal blooms
6. **Ancient Tree** (751-1500): enormous gnarled trunk, glowing roots
7. **World Tree** (1501-5000): breaks the dome ceiling, stars visible through roots
8. **World Tree (Full)** (5000+): full bloom, bioluminescent leaves, cosmic visual

Each stage triggers a celebration moment (see Mastery Celebrations).

## Quiz Design Principles

### Fact-Agnostic Difficulty
Quizzes are NOT scaled by layer depth. The same fact can appear at any depth. Difficulty is scaled through:
- **Distractor similarity** (closer wrong answers = harder)
- **Consequence severity** (deeper layers = more oxygen penalty for wrong answers)
- **Context pressure** (quiz during hazard damage reduction = stressful)
Quiz content selection is managed by SM-2 scheduling, not depth.

### Review vs Discovery Quizzes
Two fundamentally different quiz contexts:
- **Review quizzes**: Test facts the player has already seen. Wrong answers carry oxygen penalties. This is learning accountability.
- **Discovery quizzes**: Test facts the player has NEVER seen (first exposure). Reward-only — no penalty for getting it wrong. The first exposure always shows the full fact card; it is not SM-2-graded.
- **Quiz gates**: Only use previously-seen facts. Players are never punished for not knowing something they haven't encountered.

### Adaptive Quiz Rate
- **Base rate**: 8% chance per block mined (after 10 blocks)
- **Cooldown**: minimum 15-block gap between quizzes
- **Fatigue**: -2% per quiz after 5 quizzes in a row (prevents exhaustion)
- **First quiz**: always at block 10 (guaranteed, safe introduction to the run)
- Adaptive rate respects the movement-based tick system — no timer-based quiz triggers

### Quiz Gate Difficulty Scaling by Layer
Quiz gates scale difficulty through distractor quality, not fact selection:
- **Layers 1-5**: Difficulty 1-2 (obvious wrong answers, surface-level distractors)
- **Layers 6-10**: Difficulty 2-3 (plausible distractors, adjacent facts)
- **Layers 11-15**: Difficulty 3-4 (closely related, requires precision)
- **Layers 16-20**: Difficulty 4-5 (expert-level distractors, near-synonyms)

### Oxygen Paused During Quizzes
Oxygen drain is PAUSED during all quiz overlays. Non-negotiable. Players should never feel rushed to answer. The quiz is a moment outside the run's pressure, not inside it.

### Quiz Types Feel Different
- **Quiz Gates**: Full-screen dramatic overlay, heavy O2 penalty for wrong answers
- **Artifact Quizzes**: Smaller "GAIA scan" overlay, wrong answer still collects at base rarity — feels like a bonus opportunity
- **Pop Quizzes**: Brief interruptions, moderate rewards, reward-only for first-exposure facts
- **Hazard Quizzes**: Appear when hit — correct answer reduces damage

### Fact Fragments (Passive Knowledge)
Not everything is a quiz. When mining certain blocks, a one-line fact appears briefly (2 seconds, no interaction required). Seeds knowledge for future quizzes. 1-2 per layer, tied to biome theme.

### In-Run Quiz Streak
Consecutive correct answers escalate rewards:
- 1st correct: 8 dust
- 2nd correct: 12 dust (1.5×)
- 3rd correct: 16 dust (2×)
- 4th+ correct: 24 dust (3×, capped)
Wrong answer resets the streak. Multiplier displayed prominently.

### Review Queue (Anki Model)
Follow Anki's model exactly for new-to-review transitions:
- Cap daily review queue
- Interleave new and review facts
- Respect SM-2 scheduling algorithm completely
- Do not re-invent this — Anki solved it

### "Already Known" Fast-Track
Players who encounter a fact and mark it "I already know this" receive SM-2 initialization of reps=2, interval=7, EF=2.5. They must prove knowledge within 7 days or the fast-track is revoked and the fact returns to new status. This respects player-reported knowledge without trusting it blindly.

### Schema Notes
- `acceptableAnswers[]` field on each fact for future fill-in-the-blank mode (currently unused, present for forward compatibility)
- `lastReviewContext` field: `'mine' | 'calm'` — tracks whether a fact was last reviewed in-mine or during a calm study session (affects consistency penalty logic)

## Content Pipeline Philosophy

Facts are the game's most critical raw material. Quality, breadth, and reliability matter more than sheer volume.

### Fact Extraction & Generation
- Facts are extracted via Claude API from source material (books, Wikipedia, curated datasets), batched 50-100 facts per session
- Fully automated LLM review pipeline — no human required in the loop for standard content:
  1. **Draft**: LLM extracts candidate fact from source
  2. **Review**: Second LLM pass validates accuracy, clarity, wow-factor, and distractor quality
  3. **Approved**: Enters the game database
  4. **Archived**: Source citation stored for audit trail
- **Distractor validation**: separate LLM pass scores distractor plausibility (too obvious = rejected, too similar = flagged). A confidence score is stored with each distractor.
- **Dev review site**: a lightweight internal web tool for spot-checking generated content — humans can review flagged batches, not every fact

### Difficulty-Tiered Distractors
Each fact has distractors rated by difficulty:
- **Easy** (difficulty 1-2): obviously wrong, good for first exposure and early layers
- **Medium** (difficulty 3): plausible but distinguishable with knowledge
- **Hard** (difficulty 4-5): closely related facts, near-synonyms, require precision
- SM-2 mastery level determines which difficulty tier is served — struggling learners get easy distractors, confident learners get hard ones
- **Minimum 12 quality distractors** per fact (not an artificial 25 — quality over quantity)

### Content Volatility Classification
Each fact is tagged with a volatility class:
- **Timeless**: historical facts, scientific constants, geography, biology — never expires
- **Slow change**: population statistics, records, rankings — reviewed annually
- **Current events**: flagged and excluded from the default pool; only included in special "Today in History" data discs
- **Target mix**: 90%+ timeless, <10% slow_change, current events avoided unless explicitly curated

### In-Game Fact Reporting
- **"Report this fact" button** on every fact card (small, non-intrusive)
- Report reasons: "Seems inaccurate", "Outdated", "Bad distractors", "Confusing wording"
- **sourceUrl field** in the fact schema — tappable link to source (opens browser)
- **Auto-flag threshold**: 3+ reports on a single fact → automatically pulled from active pool pending review
- Reported facts never deleted — archived and reviewed by the dev review site

### Category Distribution Targets
- **Minimum 200 facts per top-level category** before launch
- **Long-tail subcategories**: prioritized in generation — rare subcategories (e.g., "Medieval Cartography", "Deep Sea Bioluminescence") are more valuable than adding the 50th Roman Empire fact
- Categories: History, Science, Geography, Language, Arts & Culture, Nature/Biology, Technology, Philosophy, Mythology (expandable)

## SM-2 Tuning & Learning System

### SM-2 Calibration for Casual Mobile
The default Anki SM-2 algorithm is tuned for dedicated desktop learners. Terra Gacha adjusts several parameters for mobile casual play:

**Second interval**: Shortened from 6 days to **3 days**. Mobile players study less consistently; a shorter early interval catches lapses before the player forgets and gets frustrated.

**Mastery thresholds** (when a fact is considered "mastered"):
- **General facts**: SM-2 interval reaches 60 days or more
- **Vocabulary facts** (language learning track): SM-2 interval reaches 30 days or more
- These thresholds are intentionally different — vocabulary requires more frequent recall reinforcement

**Mastery color progression** (universal across all fact types — no shape differences):
- **Unseen**: dark gray silhouette
- **Learning** (reps 1-3): normal color, no glow
- **Reviewing** (reps 4-6): soft warm white border
- **Confident** (reps 7-9): orange/autumn glow
- **Mastered** (interval ≥ threshold): deep green, full glow
This progression is purely color-based. Every player, on every platform, sees the same system.

### Consistency Penalty System (Recalibrated)
The consistency penalty punishes neglecting known facts. Recalibrated values:
- **Oxygen penalty**: 5 O2 (reduced from 8 — less punishing, more motivating)
- **Trigger threshold**: reps ≥ 4 (not 2 — only applied to facts the player demonstrably knows)
- **Context restriction**: penalty ONLY applies to facts last reviewed in `'calm'` context (study sessions). Facts last reviewed `'mine'` (in-run) are not penalized — the player was learning under pressure, not voluntarily neglecting
- **`lastReviewContext` field** in PlayerFact schema: `'mine' | 'calm'` — set on each answer, used for penalty logic

### Three-Button Study Rating (Calm Sessions Only)
Mine quizzes remain binary (correct/wrong). Calm study sessions use a three-button rating for precise SM-2 quality:
- **Easy** → q=5 (perfect response, recalled instantly)
- **Got it** → q=4 (correct with slight hesitation)
- **Didn't get it** → q=1 (incorrect or blanked — triggers SM-2 lapse reset)
This matches how Anki users describe their recall. The labels are intuitive to non-Anki players.

## Study Session Design

### Session Modes
- **Default (Interleaved)**: mixed bag of due reviews + new facts, weighted by SM-2 priority
- **Focus Study**: branch-specific practice, triggered from Knowledge Tree branch view. Serves facts from ONE sub-branch or category only. Good for pre-exam cramming.
- **Session sizes**: 5 cards / 10 cards / 15 minutes / All due

### Session Flow
- **Break prompt**: every 15 cards, GAIA suggests a pause ("Your brain absorbs better with rest — want to take a 2-minute break?")
- **Session-end stats**: "You reviewed 12 facts. 9 correct. Longest streak: 4. Time spent: 6 min."
- **Teaching moments**: any new fact shown for the first time always displays the full card (text + GAIA comment + mnemonic) before asking a question. First exposure is never just a cold quiz.

### Ritual Windows — Consistency Without Obligation
Players can configure two optional "Ritual Windows" (any two 4-hour windows per day):
- **Example**: "Morning Ritual (8:00 AM – 12:00 PM)" and "Evening Ritual (8:00 PM – 12:00 AM)"
- When a window opens, a gentle nudge appears (not a push notification by default — in-app banner)
- Completing any study during a window marks that window as "honored"
- Window names are user-set ("Ritual 1 / Ritual 2" as defaults, can rename to "Coffee Time / Wind Down")
- Two windows accommodates split schedules — morning AND evening learners, shift workers, etc.

### Review Forecast
Displayed on the dome Research Lab screen:
- "Today: 8 reviews due"
- "Tomorrow: 12 due"
- "This week: 43 due"
This gives players a planning horizon and reduces anxiety about falling behind. Seen daily, it becomes a motivator: "Only 8 today — I can handle that."

## Language Learning Architecture

### Three SM-2 Tracks Per Word
Full language learning eventually runs three parallel SM-2 queues per vocabulary item:
1. **Recognition**: see target word → identify meaning (multiple choice)
2. **Recall**: see definition/context → produce the target word
3. **Usage**: see a sentence with gap → fill or identify correct form in context

**V1 scope**: Recognition track only. Recall and Usage tracks are designed now but deferred to Phase 24.

### Language Mode = Category Lock
Language learning is NOT a separate game mode. It is a **Category Lock** — the player pins their language category in settings and the spawn system prioritizes that language's fact pool. The mine, dome, and quiz system are identical. This eliminates the maintenance burden of a parallel game mode.

Switching between general knowledge and language study is seamless: toggle in settings, effective immediately, mid-game switch supported.

### Vocabulary Expansion Priority
- **Japanese**: expand N5 and N4 (most learners) before adding N2/N1 content
- Other languages follow the same principle: beginner/intermediate content before advanced
- Advanced learners are a smaller audience; serving beginners first maximizes reach

### TTS Pronunciation Audio
- Planned for Phase 24: text-to-speech audio for every vocabulary item
- Playable on the fact card (small speaker button)
- Stored as small audio clips, cached locally for offline play

## Learning Analytics — Key Metrics

Five metrics the game tracks per player (shown in the Archive floor's "My Learning Stats" view):

| Metric | Target | Description |
|---|---|---|
| **Retention rate** | ≥ 90% | % of reviews answered correctly across all SM-2 sessions |
| **Lapse rate** | < 15% | % of "known" facts (reps ≥ 4) that were answered wrong in last 30 days |
| **Daily study rate** | ≥ 40% | % of days in last 30 with at least one review completed |
| **Facts per player** | ~500 target | Average active fact count for engaged players |
| **Time to mastery** | 30–90 days | Average days from first exposure to mastered status |

These metrics are shown to the player, not just tracked internally. Players who can see their retention rate have a concrete motivation to maintain it. GAIA comments on metric changes: "Your retention rate hit 95%! That's extraordinary."

## Retention & Re-engagement

Retention is measured on the D1/D7/D30 framework, with D7 as the primary metric. A player retained at D7 has formed a habit. D30 measures whether that habit became durable.

### Retention Targets

- **D1**: 45% — the tutorial worked and the hook landed
- **D7**: 20% — a habit has formed (this is the primary metric)
- **D30**: 10% — durable engagement achieved

### Early Churn Mitigation (Dives 3–7)

The highest-risk churn window is dives 3–7. The game front-loads its most emotionally compelling rewards: first fossil by dive 2, first pet by dive 4, first dome room by dive 5. Loot loss on depletion is graduated for new players: the first depletion ever loses 0% (GAIA rescues all items, with a unique monologue about "not giving up"). The next 3 depletions lose 15%. Only after that does the standard 30% apply. New players are cushioned from their early mistakes while still understanding the stakes (per DD-V2-113).

### Positive Streak Reframing

Streaks are celebrated, never weaponized. When a streak breaks, the message is: "You completed a 47-day expedition — start a new one!" Milestone rewards earned during a streak are permanent and never revoked. The "Longest Streak" personal record persists forever, even after the current streak resets. Players are invited to beat their personal record, not punished for failing to maintain it.

### Welcome Back Flow (2+ Week Absence)

Players returning after 2+ weeks receive a dedicated re-engagement sequence. GAIA leads with positives: farm harvest waiting, pet gift, new facts discovered since they left. A free "Comeback Chest" is waiting. Only AFTER this positive framing does the review queue appear. The experience never starts with "you've missed X days" or "your streak is gone" — that's the last thing a returning player needs to see. Farm crop production caps at 7 days for absent players so returning always means finding something, never an empty farm.

### Push Notifications

Maximum one notification per day if the app hasn't been opened. Permission is requested only after the first successful dive — the player must have experienced a positive moment before being asked for notification access. All notifications are GAIA-voiced, in character. Notifications stop entirely after 7 consecutive days of no engagement — at that point, the player has churned and notifications become harassment.

### Win-Back Strategy

External win-back: monthly "GAIA's Letter" email (opt-in only) with updates in GAIA's voice, plus seasonal event announcements. On return, the Welcome Back flow immediately runs: GAIA greets positively, free oxygen is waiting, an easy boosted dive is available. The design goal is that a returning player is back to having fun within 30 seconds of opening the app.

### Dynamic Difficulty (Hidden Engagement Score)

The game quietly tracks quiz accuracy, session frequency, and dive depth to maintain player flow state. Players scoring above 90% quiz accuracy receive harder distractors; players below 50% receive easier ones. This is intentionally invisible — players should feel that the game "just works" for them, not that difficulty is being adjusted. The Binding of Isaac philosophy applies: power fantasy is for mining systems, but the learning difficulty curve must always match actual skill (per DD-V2-120).

### Gentle Review Pressure

The review interface uses a gentle count ("12 facts ready for review") and never shows countdown timers. The Knowledge Tree's leaves visually wilt slightly when facts are overdue — a subtle ambient nudge, not an alarm. GAIA frames overdue reviews as opportunity: "There are 12 facts waiting to be reinforced — want to strengthen your tree?" Not: "You have 12 OVERDUE reviews."

## Onboarding Refinement

### 90-Second Hook

The first artifact reveal, GAIA's excited reaction, and the gacha reveal animation must fire within the player's first 90 seconds. Onboarding is split into two phases: the first 90 seconds to deliver the hook, then progressive system unlocks across dives 2–4. Every tutorial step is instrumented and the benchmark for step completion is 60–70%. If a step falls below that threshold, it is redesigned.

### Content Minimum Before Subscriptions

A 3,000-fact minimum before opening subscriptions. At the current 522-fact count, a dedicated subscriber exhausts genuinely new content in weeks — this creates churn driven by the game running out of material, which is the worst possible reason to lose a subscriber.

## Market Position & Launch

### App Store Strategy

Primary category: Games (Adventure/Casual). Secondary: Education. Mining is the acquisition hook — the reason a curious gamer downloads. Learning is the retention hook — the reason they stay for months. The subtitle "Mine Deep. Learn Everything." communicates both value propositions in four words.

### Soft Launch Strategy

Soft launch in Philippines, Malaysia, and Colombia for 4–6 weeks. These markets combine mobile-first gaming culture, lower CPI, and English-friendly user bases. After soft launch, analyze the top 3 drop-off points and fix them before Google Play Early Access (capped at 10,000 installs). Global launch follows after Early Access data validates fixes.

### Web Platform

The web version at terragacha.com is a first-class platform, not a demo. Same account, same progress, full feature parity. The Vite + Svelte tech stack natively supports this with near-zero additional work. Seamless switching between mobile and web is a genuine competitive advantage — players can dive during lunch on desktop and review in the evening on mobile. This is emphasized in all marketing copy.

### Educational Partnerships (Post-Launch)

Free Teacher Dashboard and free Classroom License are planned for post-launch, but only after consumer retention has been proven at scale. Educational partnerships built on shaky retention data are a distraction. Prove the product works for individual learners first; institutional partnerships follow naturally.

## Player Psychology & Ethics

Terra Gacha serves a diverse player base with heterogeneous motivations. The design acknowledges this explicitly rather than optimizing for a single archetype.

### Four Player Archetypes

- **Learners** — primarily motivated by the Knowledge Tree and fact mastery. Their key metric is facts mastered per week.
- **Miners** — primarily motivated by depth records, pickaxe upgrades, and run-building. Their key metric is deepest layer reached.
- **Collectors** — primarily motivated by fossils, cosmetics, and the Museum floor. Their key metric is collection completeness.
- **Completionists** — primarily motivated by Knowledge Tree branch percentages and achievement counts. Their key metric is category completion rate.

Weekly challenges include one task per archetype. By D7, behavioral data classifies each player into a primary archetype for targeted feature promotion — a Miner sees depth milestones, a Collector sees new fossil hints (per DD-V2-126).

### Quiz Anti-Homework Rules

Three principles prevent quizzes from feeling like school: (1) every quiz has immediate tangible stakes — oxygen, dust, rarity boosts — so the question feels consequential; (2) wrong answers cost but never end a run — failure is recoverable, never catastrophic; (3) GAIA's explanation follows every mistake immediately, so the wrong answer creates a teaching moment rather than pure frustration. The game frames quizzes as "challenges" in all UI copy, never "tests."

### Gacha Ethics Guardrails

Five hard constraints on the gacha system: (1) all drop rates are visible in the UI — players can always see the exact probability of each rarity tier; (2) no real money purchases lead to random loot — the gacha is driven entirely by earned in-game currency; (3) artifacts are earned through play, not purchased; (4) a pity system guarantees a rare+ artifact after 20 artifact finds with no rare or above; (5) no limited-time items that pressure players into spending — seasonal content returns on future seasons.

### Kid Content Quality

Content for the KID age tier receives equal design investment to adult content. The "Kid Wow Score" is tracked separately in the content curation pipeline, ensuring kid-targeted facts are genuinely mind-blowing, not just simplified adult content. Parental controls include: age tier lock, session time limits, and a "Learning Summary" that parents can review. No additional technical implementation is required for the time limit — iOS Screen Time and Android Digital Wellbeing handle this natively.

### Accessibility

Launch accessibility targets: colorblind-safe rarity differentiation using both color AND shape (not color alone), scalable text (system font size respected), high-contrast quiz mode, and full VoiceOver/TalkBack compatibility. Post-launch targets: dyslexia-friendly font option, one-handed mode for large-phone users, and reduced motion mode for vestibular sensitivity.

### Multiple Player Profiles

Up to 4 profiles per device. Each profile maintains its own save state, age tier, interest settings, and Knowledge Tree. Profile switching occurs on the title screen. This enables family sharing (kids and parents on the same device), classroom tablet sharing, and multi-language learners maintaining separate tracks.

## Analytics & Measurement

### GAIA's Report (Player-Facing)

The Archive floor displays "GAIA's Report" — a personal learning analytics dashboard visible to the player. Contents: facts mastered per week (bar chart), quiz accuracy radar by category, longest SM-2 interval achieved (the player's "most mastered" fact), strongest and weakest knowledge areas. The report is shareable as an image — players who are proud of their learning stats naturally become brand ambassadors. All framing is positive: the report celebrates what the player knows, not what they don't.

### Learning Effectiveness Publishing

An annual "Terra Gacha Learning Report" is published with anonymized aggregate data demonstrating educational outcomes: average retention rates, facts mastered per player, most popular knowledge categories, language learning progression. This document serves dual purposes — it holds the team accountable to educational quality and it provides institutional credibility for educational partnership conversations.

### 10 Critical Pre-Beta Events

The following analytics events must be instrumented before beta launch:
1. Each tutorial step completion (with timing data)
2. First dive completion
3. First artifact reveal (includes rarity, category, player reaction time)
4. D1, D7, and D30 retention checkpoints
5. Session length distribution (quick vs. deep)
6. Study session initiation rate (what % of players who enter the dome start a study session)
7. Streak break events (with context: time of day, days since last session)
8. Purchase funnel steps (impression → intent → purchase)
9. Depletion events (layer depth, item count lost, churn correlation)
10. Fact engagement (time spent on fact card, GAIA comment dismissal rate, report rate)

### Referral System

"Invite a friend, both receive a fossil egg." The referrer's reward fires on the invitee's first successful dive. A bonus reward fires on the invitee's 7-day streak. This anchors referral rewards to meaningful engagement moments — not just installs, which have no long-term value. The fossil egg is a thematically appropriate reward: it's a living representation of the game's educational loop, and it creates a social artifact the referrer can talk about ("my friend sent me this egg and now I've learned 40 facts about it").

### Completionist Endgame

Players who master every available fact in every category unlock the "Omniscient" title, a golden dome visual transformation, a GAIA personality shift (she becomes more philosophical and reflective, as if you've taught her everything she needs to know), and — meaningfully — access to community fact submission. These players have earned the right to contribute to the content pipeline that new players will encounter. It transforms the game's most engaged players into contributors, closing the loop from consumer to creator. Content velocity post-launch targets 100+ new facts per week to ensure Omniscient players always have something ahead of them.

## System References

Detailed design for each system lives in its own doc:

| System | Document |
|---|---|
| Dive mechanics, layers, oxygen, roguelite systems | `docs/ROGUELITE_RUNS.md` |
| Artifacts, facts, Anki algorithm, Knowledge Tree | `docs/KNOWLEDGE_SYSTEM.md` |
| Minerals, currency, crafting, economy sinks | `docs/ECONOMY.md` |
| Architecture and data flow | `docs/ARCHITECTURE.md` |
| Technical decisions | `docs/DECISIONS.md` |
| Security | `docs/SECURITY.md` |
| Sprite pipeline | `docs/SPRITE_PIPELINE.md` |
| Open design questions | `docs/OPEN_QUESTIONS.md` |

---

## Visibility System — Layered Fog of War

*Design intent: feel like Minesweeper. The player always knows something lurks just beyond their light — but only faintly.*

### Vision Layers

The mine has four visibility levels per cell:

| Level | Name | Always Visible? | Description |
|-------|------|----------------|-------------|
| 0 | **Hidden** | No | Fully black. No information. |
| 1 | **Silhouette** | Yes | Dark block tinted barely with its color (~10% opacity). The player can tell *something* is there, but not what. Adjacent to any revealed cell. |
| 2 | **Dim** | Scanner ≥ 1 | Slightly more visible (~16–30% opacity, scales with scanner stacks). Block type color starts bleeding through. |
| 3 | **Faint** | Scanner ≥ 3 | Very faint tint of the 3rd ring beyond the player's light. |

### Reveal Rules

- **Full reveal radius**: cells within Manhattan distance `FOG_REVEAL_RADIUS` of the player become fully visible (`revealed = true`)
- **Silhouette ring**: cells at exactly `radius+1` get `visibilityLevel = 1`
- **Dim ring**: cells at exactly `radius+2` get `visibilityLevel = 2`
- Once a cell is fully revealed it stays revealed (no fog re-cover on movement)
- Penumbra levels are re-computed each time `revealAround` is called

### Scanner Upgrade Scaling

Each `scanner_boost` upgrade stack enhances what the dim ring shows:

| Scanner Stacks | Dim ring opacity | Effect |
|---|---|---|
| 0 | — | Dim ring hidden entirely |
| 1 | ~23% | Color barely visible |
| 2 | ~30% | Color clearly visible, block type readable |
| 3+ | ~30% + faint 3rd ring | Extended awareness |

This gives the scanner upgrade a meaningful visual impact at each tier — not just a number going up, but a literally expanding field of perception.

### Future Extensions

- **Biome-specific fog colours**: volcanic areas glow orange in the penumbra; crystalline biomes shimmer blue
- **Gas pocket hazards**: temporarily expand the hidden zone around a pocket
- **Torch/light relics**: temporarily increase `FOG_REVEAL_RADIUS` for a run
- **Pattern visibility**: at very high scanner (4+), the block pattern detail (cracks, grain) renders at low opacity inside the dim ring
- **Sonar Pulse consumable**: reveals special blocks within 7-tile radius
- **Flare consumable**: reveals 5x5 area through fog

---

## Technical Architecture

### Rendering & Performance

- **Phaser Tilemap**: All terrain rendered via `TilemapLayer`, eliminating per-frame `Graphics` redraws. Fog uses a `RenderTexture`; particles and the player character are the only dynamic draw calls. (DD-V2-182, DD-V2-183)
- **Draw call budget**: 50 max on mobile. Tiles in a single tilemap draw call; fog in one RenderTexture blit; dynamic draws reserved for particles and the player only. (DD-V2-183)
- **Sprite pool**: 500-object ceiling with frustum culling. Only objects within the viewport plus a 2-tile margin are active. (DD-V2-184)
- **Block animations**: Hybrid approach — terrain state changes (e.g. crack stages) cycle the tilemap frame index; visual overlays (hazard pulses, shimmer) use Phaser sprite animations layered on top. (DD-V2-185)
- **Particles**: 200 cap on mobile, 500 on desktop. Two emitter managers — ambient (background atmosphere) and event (hit sparks, loot pops). Battery-saver mode detection reduces ambient budget to zero. (DD-V2-186)
- **Camera**: `camera.startFollow()` with a deadzone so the player has a visible buffer before the view scrolls. Pinch-to-zoom supported. Mini-map rendered by a second camera at 0.1× zoom into a separate RenderTexture. (DD-V2-187)
- **WebGL only**: Canvas2D fallback is explicitly disabled. Devices that cannot run WebGL are shown an unsupported message. (DD-V2-190)
- **Texture atlases**: Built at compile time, loaded per-biome on demand. Maximum 3 atlases in GPU memory simultaneously; evict least-recently-used on overflow. (DD-V2-189)
- **Mine generation**: Profile first; use a Web Worker only if generation measurably blocks the frame. BFS flood-fill capped at 200 cells per call to prevent jank on large layers. (DD-V2-191)
- **No ECS**: `MineCell` is enriched with component-like fields (health, hazardState, animFrame, etc.) and processed by dedicated update systems rather than a full entity-component framework. (DD-V2-223)

### Architecture Patterns

- **GameManager decomposition**: `GameManager` becomes a thin coordinator. Heavy logic is delegated to `DiveManager` (all in-mine systems) and `DomeManager` (all hub systems), keeping the coordinator under 300 lines. (DD-V2-222)
- **Typed event bus**: A singleton `EventBus<EventMap>` using TypeScript generics. Both Phaser scenes and Svelte components subscribe to the same bus; no direct cross-framework method calls. (DD-V2-224)
- **Dome migration**: `DomeCanvas` (current SVelte canvas renderer) migrated to a dedicated Phaser `DomeScene` so the dome benefits from the same camera, particle, and tilemap infrastructure as the mine. (DD-V2-188)
- **Monorepo**: `pnpm` workspaces with three packages — `packages/client` (Vite + Svelte + Phaser), `packages/server` (Fastify), `packages/shared` (types, schemas, constants shared by both). (DD-V2-230)

### Save System & Offline

- **Split save documents**: `PlayerSave` divided into 5 versioned sub-documents (profile, inventory, knowledge, progression, settings). Each sub-document carries its own schema version and merges independently on conflict. (DD-V2-192)
- **IndexedDB primary**: `idb-keyval` as the persistence layer for all save data. `localStorage` is used only to store the current schema version number. (DD-V2-193)
- **Field-level sync merge strategy**: Review states resolved by latest timestamp; mineral counts by maximum (never lose minerals); inventory resolved by union of both sides. (DD-V2-194)
- **Save durability**: `visibilitychange` and Capacitor `appStateChange` events trigger an immediate sync write. IndexedDB writes are always treated as synchronous checkpoints — no deferred batching on foreground→background transitions. (DD-V2-199)
- **Sync status UI**: Cloud icon in the HUD with three states — green (synced), yellow (pending), red (error). Error messages are written in GAIA's personality voice, not raw technical strings. (DD-V2-200)
- **Offline tiers**: Core gameplay loop is always-offline. Leaderboards and deals are cached-when-available and gracefully stale. Social features and IAP require a live connection. (DD-V2-201)

### Backend & Database

- **PostgreSQL schema**: Hot scalar fields (dust count, oxygen, layer) stored as denormalized columns for fast queries. Less-frequently-queried data (inventory lists, knowledge states) stored in `jsonb` columns. (DD-V2-202)
- **Save history**: An `is_active` partial unique index enforces one active save per player. Inactive saves are retained up to 10 rows per player; latest-save queries are O(1). (DD-V2-203)
- **Leaderboard**: Composite index on `(category, score DESC)`. Scores upserted on each dive completion; top-100 per category cached in memory and refreshed on a short TTL. (DD-V2-204)
- **Fact database size**: ~10–15 MB at 5 000 facts. Client bundles a baseline snapshot; new facts sync via a versioned delta endpoint. Metadata (source URLs, categories) loaded lazily after first paint. (DD-V2-197, DD-V2-198)
- **LLM content pipeline**: Cloud API (Claude Sonnet or GPT-4o-mini) at ~$0.005 per fact. A queue table tracks pipeline state (draft / approved / archived). Raw LLM responses are stored for audit and re-processing. (DD-V2-207)
- **Duplicate detection**: `pgvector` extension; cosine similarity > 0.85 on the fact embedding flags a candidate as a duplicate before insertion. (DD-V2-208)
- **SQLite → PostgreSQL migration**: Phased rollout with a dual-write period where writes go to both databases and reads come from PostgreSQL. SQLite is decommissioned once consistency is confirmed. (DD-V2-209)

### Security

- **Token storage**: `httpOnly` cookies on web (inaccessible to JavaScript); Capacitor Secure Storage on native. No tokens ever stored in `localStorage`. (DD-V2-195)
- **Password hashing**: Argon2id replaces PBKDF2. Existing passwords are transparently re-hashed on next successful login. (DD-V2-205)
- **Refresh tokens**: SHA-256 hashed before database storage. Family-ID rotation: detecting reuse of an old token invalidates the entire family and forces re-authentication. (DD-V2-210)
- **Rate limiting**: Per-route limits via `@fastify/rate-limit`. LLM generation endpoints additionally gated by a cost-based circuit breaker to cap runaway API spend. (DD-V2-211)
- **Anti-cheat**: Server-side plausibility checks on dive results (minerals per block, oxygen consumed, time elapsed). Anomaly scores feed leaderboard sanitization. HMAC checksums on save documents detect tampering. (DD-V2-225)
- **Content Security Policy**: Three environment-specific CSP profiles (dev / prod / Capacitor) injected via a Vite transform plugin. No single CSP tries to satisfy all environments. (DD-V2-226)
- **JWT signing**: ES256 asymmetric signing. Private key stored in a secrets manager; public key distributed to API instances at startup. (DD-V2-227)
- **Social login**: OAuth plugins per provider. Guest accounts can be linked to a social identity at any point; existing save data is preserved through the linking flow. (DD-V2-206)
- **GDPR compliance**: Behavioral analytics require explicit opt-in consent (DD-V2-228). Full erasure handled by `DataDeletionService`: 30-day soft delete followed by hard purge; cascade covers all sub-documents, leaderboard entries, and review history. (DD-V2-229)

### Mobile & Deployment

- **Capacitor plugins**: Added incrementally per phase rather than installed upfront. Each plugin addition goes through the standard dependency-approval workflow. (DD-V2-212)
- **Haptics vocabulary**: A typed haptic vocabulary maps game actions (block break, artifact reveal, quiz correct/wrong, hazard hit) to `ImpactFeedbackStyle` values. Haptics fire at animation keyframes, not on user input. (DD-V2-213)
- **Bundle size**: Initial JS payload target < 500 KB gzipped. Route-based code splitting via Vite dynamic imports. WASM (sql.js) loaded asynchronously after first paint. (DD-V2-214)
- **CI/CD**: Three GitHub Actions workflows — `ci` (typecheck + unit tests on every PR), `deploy-api` (staging on merge to main, prod on release tag), `build-mobile` (Capacitor AAB/IPA on tag). Dependabot monitors all packages weekly. (DD-V2-215)
- **Testing tiers**: Pure function unit tests targeting 90% coverage; API integration tests targeting 95% route coverage; a single E2E smoke test (login → dive → surface) as the build gate. (DD-V2-216)
- **Mine generation determinism**: Snapshot tests run 20 seeds × 3 depth levels. A 1 000-assertion invariant suite checks structural properties (shaft reachability, hazard density bounds, oxygen cache placement). (DD-V2-217)
- **Docker**: Multi-stage build on `node:22-slim`. A `DB_DRIVER` build arg switches between SQLite (dev/test) and PostgreSQL (production). `HEALTHCHECK` pings `/health` every 30 s. (DD-V2-218)
- **CDN**: Cloudflare Pages hosts the client app. Assets (sprites, atlases, audio) served from Cloudflare R2 with content-addressed filenames for permanent caching. (DD-V2-219)
- **WebView profiling**: Three device tiers (low-end Android, mid-range, flagship). Four critical metrics: time-to-interactive, mine-generation time, steady-state FPS, memory high-water mark. Budgets enforced in CI via Playwright. (DD-V2-220)
- **Observability**: Sentry on both client and server for error tracking. Custom gameplay analytics events (dive completed, artifact revealed, quiz answered) written directly to a PostgreSQL `events` table. (DD-V2-221)
- **Service Worker**: Deferred to Phase 19 (web launch). Web-only; implemented via `vite-plugin-pwa`. Capacitor apps use native OS caching and do not use a Service Worker. (DD-V2-196)
- **Launch stack**: Cloudflare Pages (client) + Fly.io (API server) + Fly Postgres (database) + Cloudflare R2 (asset CDN) + Sentry (observability). Selected for zero-ops scaling, generous free tiers, and geographic distribution. (DD-V2-231)

---

## Visual Art Direction & Pipeline

### Autotiling & Terrain

- **4-bit autotiling at launch** (16 tile variants per material). Post-launch upgrade: 5 hero biomes promoted to 8-bit (47-variant) autotiling for more natural edge variety. (DD-V2-232)
- **Cross-material transitions**: two-layer system — an autotiled base layer plus an edge mask overlay, with 4–8 dedicated edge sprites per material pair. Seams between different block types blend naturally without bespoke tile art for every combination. (DD-V2-233)
- **Dirty-rect rendering**: only changed tiles plus their 8 immediate neighbors are re-rendered per frame. Full-grid redraws never occur during normal play. (DD-V2-234)
- **Neutral transition tileset**: a shared set of boundary tiles handles biome-boundary transitions within a single layer, preventing jarring cuts when two biomes meet mid-grid. (DD-V2-235)

### Biome Visual Identity

- **Three production tiers**: 5–6 *hero biomes* (fully unique sprites, animations, and palettes), 10–12 *mid-tier biomes* (unique textures, shared structure tiles), 7–8 *economy biomes* (shared base tiles + unique accent/overlay tiles). Budget allocated accordingly. (DD-V2-236)
- **25-biome color matrix**: biomes are mapped on the hue wheel so no two adjacent-layer biomes share a dominant hue. Sibling biomes within the same depth tier differ primarily by silhouette shape, not color, to preserve hue spacing. (DD-V2-237)
- **Depth gradient**: shallow biomes use warm tones, rounded forms, and brighter ambient light; deep biomes shift to cold hues, angular geometry, and darker ambiance. The gradient is perceptual — players should feel depth without being told the layer number. (DD-V2-238)
- **Tint overlays removed**: the 0.15-opacity biome tint overlay is eliminated. A very light 0.05–0.08 unifying wash is kept only to prevent the mine feeling like a flat asset dump. Individual biome identity comes from sprite art, not post-process color shifts. (DD-V2-240)
- **Special block silhouettes**: gameplay-critical blocks (descent shaft, artifact node, altar) use a universal silhouette readable across all biomes. Non-critical decorative blocks get full per-biome redesigns. (DD-V2-241)
- **Formal `palette.ts`**: each biome defines exactly 8–12 colors, enforced at generation time. No block in a biome can use a color outside the registered palette. (DD-V2-272)

### Character & Mining Animation

- **Miner sprite sheet**: 6 walk frames per cardinal direction, 5–6 mining frames per direction (wind-up / snap / settle). Total target: ~48 frames across all directions. (DD-V2-242)
- **Compressed swing model**: damage registers on tap input immediately; the animation plays as visual-only feedback afterward. The player never waits for a swing to land. (DD-V2-243)
- **Prototype-first**: mining feel is validated with placeholder block sprites before any final art is committed. Animation timing and hit feedback are tuned on placeholders. (DD-V2-244)
- **Per-block impact profiles**: dirt, stone, crystal, hard rock, and lava each have distinct impact particle bursts, crack sounds, and screen-shake values. Mining different materials feels meaningfully different. (DD-V2-245)
- **Progressive satisfaction**: particles, camera shake, and crack overlay intensity all scale linearly with damage percentage. The final break triggers a 50 ms freeze-frame regardless of block type. (DD-V2-246)
- **Pickaxe tier differentiation**: each tier adds a recolorable 4-frame swing trail and an escalating particle count on impact. Higher-tier pickaxes are visually louder, not just statistically stronger. (DD-V2-247)
- **Gear as overlay icons**: equipped gear (pickaxe, scanner, backpack) renders as small overlay icons on the miner sprite rather than modifying the base sprite. Keeps the animation sheet at a fixed size. (DD-V2-248)

### Visual Effects & Juice

- **Block break sequence**: 50 ms freeze-frame → radial burst → 4-quadrant shatter → loot physics arcs. The quadrant shatter uses pre-baked shard sprites, not procedural geometry. (DD-V2-249)
- **Loot pop physics**: loot items arc parabolically from the break point, bounce once, then vacuum-suck to the player HUD over 600–900 ms total. The vacuum phase is magnetic-feel, not instant. (DD-V2-250)
- **Crack damage stages**: 4 overlay stages at 25%, 50%, 75%, and 90% health remaining. No floating health bars — all block health feedback is visual on the block itself. (DD-V2-251, DD-V2-257)
- **Screen shake**: 3 Perlin-noise tiers — micro (tap feedback), medium (cave-in warning), heavy (earthquake / legendary break). Intensity is configurable via an accessibility slider that scales all three tiers proportionally. (DD-V2-254)
- **Gacha reveal animations**: Common artifacts resolve in 1.5 s; Rare in 2.5 s; Legendary in 4–5 s using the "DOWN design" (anticipation pause before revealing rarity). All reveals are skippable from frame 1. (DD-V2-255)
- **Layer descent transition**: 3-phase animation — fall (0.8 s), card (1.2 s layer summary), arrive (1.0 s). Total 3 seconds; skippable after the card phase. (DD-V2-256)
- **Scanner sonar pulse**: visual radial ping that emanates from the player's position, brightening blocks within range. When a descent shaft is nearby, the pulse reflects off it with a distinct color echo. (DD-V2-258, DD-V2-281)
- **Rarity break preview**: escalating visual effects fire on the block itself before the gacha overlay appears — rare blocks shimmer, legendary blocks pulse with a golden aura — so the player anticipates the reveal before it triggers. (DD-V2-259)
- **Particle device tiers**: three capability tiers with caps of 40 (low-end), 80 (mid-range), and 150 (flagship) particles concurrently. Ambient particles (floating spores, drifting embers) are viewport-culled and never allocated from the event emitter pool. (DD-V2-252, DD-V2-253)

### Dome & UI Visual Design

- **Multi-floor cutaway**: the dome renders as a Fallout Shelter-style vertical cutaway. Players scroll vertically between floors; each floor is visible simultaneously at reduced scale when zoomed out. (DD-V2-260)
- **Floor state contrast**: empty/locked floors use desaturated colors and ghosted silhouettes of their future contents. Furnished floors use warm lighting and visible decoration density. The visual delta motivates unlocking. (DD-V2-261)
- **Knowledge Tree growth stages**: 5–6 distinct growth stages visible in the dome — sapling, seedling, young tree, mature tree, ancient tree, world tree. Each stage has a unique sprite (not a scaled version of the previous). (DD-V2-266)
- **GAIA expressions**: 10–12 distinct pixel art expression frames — idle, excited, thoughtful, snarky, concerned, dramatic, warm, proud, tired, mischievous. Speech bubbles render as pixel art shapes on the dome canvas, not HTML overlays. (DD-V2-262, DD-V2-263)
- **Unified overlay palette**: all modal overlays (quiz, artifact reveal, fact card, crafting) share a dark backdrop + pixel-art border + a four-color accent set: gold (rewards/legendary), teal (information/scanner), red (danger/hazard), green (correct/success). No overlay introduces a fifth color. (DD-V2-264)
- **Resource bar**: abbreviated number formatting (1.2K, 3.4M), 3–4 contextually relevant resources shown at once, tap-to-expand reveals all tracked resources. Bar never wraps to a second line. (DD-V2-265)
- **Typography split**: pixel fonts for UI chrome and labels; system sans-serif for all reading content (fact cards, GAIA dialogue, study sessions). Pixel font for readability-heavy content would fail accessibility targets. (DD-V2-268)
- **Dome→mine zoom bridge**: the transition from dome view to mine entry plays a zoom-in animation that bridges the two Phaser scenes visually. The mine "appears" to be underground beneath the dome rather than a hard cut. (DD-V2-275)
- **Procedural dome detail**: the dome's outer structure is enhanced with procedurally placed panel lines, rivet sprites, and a subtle noise texture. No two dome segments look identical; visual interest increases with floor count. (DD-V2-267)

### Art Pipeline & Mobile Optimization

- **Texture atlases**: 2048×2048 atlas sheets built at compile time. Biome-specific atlases are loaded on demand and evicted when the biome is not active. Maximum 3 atlases in GPU memory at once. (DD-V2-273)
- **3-gate sprite QC**: automated rejection at three checkpoints — composition (correct dimensions, centered subject), background (transparent, no color bleed), palette (only registered biome colors present). Sprites failing any gate are re-queued for regeneration without human review. (DD-V2-274)
- **Intro comic panels**: 5 panels at 384×512 px, generated with a lower LoRA weight for a painterly style that contrasts with the game's block art. The stylistic difference is intentional — the intro feels cinematic. (DD-V2-269)
- **Pixel art at 1× CSS resolution**: sprites always render at 1 CSS pixel per game pixel, never at native device DPI. `image-rendering: pixelated` enforced globally. Upscaling on high-DPI screens is intentional — it preserves the pixel art aesthetic. (DD-V2-276)
- **Texture memory budget**: 80–100 MB total GPU texture memory. Default tile size is 32 px (fits budget on low-end devices); 64 px is the sweet spot for mid-range and above. High-DPI flagship devices may load a 128 px variant if memory permits. (DD-V2-277)
- **Build-time asset audit**: a Vite plugin runs on every build — warning on orphaned sprites (present in `src/assets/` but not referenced in any manifest), and erroring on missing references (manifest entry with no matching file). Orphan warnings accumulate in a report; missing references fail the build. (DD-V2-278)
- **Fog of war brightness**: Ring-1 (silhouette ring) renders at 25–30% of full tile brightness. An accessibility slider adjusts fog density independently of screen shake and particle settings. Biome ambiance "leaks" into the fog as a colored glow rather than a tint overlay — crystalline biomes give a blue glow to the penumbra, volcanic biomes an orange warmth. (DD-V2-270, DD-V2-271)
