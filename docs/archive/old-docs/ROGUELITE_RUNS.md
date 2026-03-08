# Roguelite Runs — Terra Miner

Detailed design for the dive system: the core gameplay loop where the player mines underground.

## Run Philosophy

Every dive is a **self-contained roguelite run**. The player starts weak and gets stronger through discoveries during the run. Permanent upgrades exist but are deliberately limited — the in-run power curve is the main experience. This ensures every dive feels fresh and meaningful, regardless of how long someone has played.

## Oxygen (Fuel System)

### Earning Oxygen
- **Time-gated refill**: Oxygen regenerates over time, starting from first daily login
- **Morning quiz bonus**: Answer review questions on login for extra oxygen
- **Evening quiz bonus**: Second daily boost available
- **Pop-up reviews**: A couple per day, answering due facts earns small oxygen top-ups
- **In-run finds**: Rare oxygen tank pickups extend the current dive
- **Mastery bonus**: Top players who consistently ace quiz gates can earn enough bonus oxygen to play indefinitely — knowledge mastery = free unlimited play
- **Subscription**: Unlimited oxygen for subscribers

### Oxygen Consumption
- **Pre-dive allocation**: Player chooses how much oxygen to bring (e.g., 1, 2, or 3 units)
- More oxygen = longer runs, ability to reach deeper layers
- **However**: A skilled player with 1 oxygen should be *able* to reach the same depth as a 3-oxygen player, if they play exceptionally well (efficient pathing, acing quiz gates for bonuses, finding oxygen tanks)
- **Oxygen depletes PER ACTION, not in real-time** — no time pressure. This is a thinking game, not a speed game. Players should never feel rushed.
  - Each block mined costs oxygen (amount varies by block hardness)
  - Moving through empty space costs a small amount
  - Quiz gate attempts cost oxygen (win or lose)
  - Hazard encounters cost oxygen
- **No real-time drain**: Players can sit and think about their next move, plan their path, read quiz questions carefully
- **Quiz gate failures cost oxygen** — wrong answers are punished mechanically, but players aren't rushed while answering
- **Layer oxygen recovery**: When descending to a new layer, the player receives a small oxygen bonus. This makes the "go deeper" risk more palatable — you get a reward for committing.
- **Running out**: Player is automatically pulled to surface using **"The Sacrifice"** system (see below)

### Oxygen Depletion: "The Sacrifice" (Loot Loss Model)
When oxygen hits zero:
1. **Emergency alert** — screen flashes, alarm sound, dramatic moment
2. **Sacrifice screen** appears — player sees their full backpack contents
3. Player must **choose what to drop** to reduce weight for emergency ascent
4. How much to drop scales with depth: deeper = must sacrifice more (e.g., Layer 1 = drop 20%, Layer 3 = drop 50%, Layer 5 = drop 70%)
5. Player picks which items to keep, discards the rest
6. **Ascent animation** — pulled to surface with remaining items

**Why "The Sacrifice" works:**
- Player has **agency** — they choose what matters most (that Epic artifact? or the pile of Crystals?)
- Creates memorable moments ("I had to drop 3 minerals to save that Legendary artifact")
- Depth-scaling punishment makes going deeper genuinely risky
- Less frustrating than random loss — you never feel cheated by bad RNG

### Rescue Beacon (Consumable)
- **Rare consumable** — craftable at the Materializer or found during dives
- When activated: emergency extraction with **no loot loss**
- Finding or crafting one is a significant event
- Creates a pre-dive decision: "Do I bring my rescue beacon on this run?"
- Economy sink: beacons cost meaningful minerals to craft

## Camera & Viewport

### View
- **Miner is always centered** on screen. The mine scrolls around them.
- **Relatively small viewport** — shows ~10-12 tiles in each direction. Claustrophobic by design: limited visibility creates tension and makes the scanner more valuable.
- Fog of war beyond visibility radius. No minimap (intentional — discovery over information).
- Player can scroll back within the **current layer** to review where they've been, but cannot physically return past a layer boundary.

### Mining Feedback ("Juice")
Every single tap must feel satisfying. The mining feedback loop:
1. **Tap** → block shows crack lines (visual, per tap for multi-tap blocks)
2. **Break** → block shatters with particles flying in all directions
3. **Loot pop** → minerals/artifacts bounce out with a small physics pop
4. **Collection** → most items auto-collect with a satisfying "suck" toward the backpack. Important/large items (artifacts, rare minerals) require a tap to collect, giving the player a moment to decide.
5. **Backpack feedback** → brief glow on the backpack UI showing the item slotted in

Different block types should have **different break sounds and particle colors**. Mining obsidian should feel vastly different from mining dirt.

### Miner Visual State (Low Priority — Future Polish)
The miner's appearance should reflect the run's progress:
- Starts clean and fresh
- Gets progressively dirtier/scuffed as blocks are mined
- Gear visually changes as in-run upgrades are found (new pickaxe visible, scanner antenna, etc.)
- Backpack visually bulges when inventory is nearly full
- This is purely cosmetic polish — implement after core gameplay is solid.

## Mine Structure

### Layout
- **Motherload-style 2D side-view cross-section**
- Procedurally generated grid of blocks
- Player starts at the surface and digs downward (and sideways, and upward — **no gravity**)
- Each run generates a completely new mine layout

### Procedural Generation
- **Unique generation algorithm per biome** — not just palette swaps. Each biome has distinct structural patterns:
  - Sedimentary: horizontal layers with fossil bands
  - Volcanic: lava rivers, obsidian walls, heat vents
  - Crystalline: open gem caverns, crystal clusters on walls
  - Fossilized: bone formations, amber deposits in clusters
  - etc.
- Random distribution of mineral nodes, artifact nodes, and empty/rock blocks
- Environmental hazards vary per run (lava pockets, gas vents, cave-ins — future: creatures)
- Density and quality of loot increases with depth
- **Pathfinding validation**: generation must verify the mine is always solvable — no sealed-off pockets of unbreakable blocks that trap the player. Run pathfinding check during generation to ensure all areas are reachable.

### Micro-Structures (Spelunky-Style)
Pre-designed small rooms/formations embedded within the procedural grid. These make procedural generation feel hand-crafted:
- **Ancient Library**: Small room with guaranteed artifact nodes and readable lore
- **Crystal Cavern**: Open space with mineral clusters on walls
- **Collapsed Tunnel**: Forces a detour, mining around debris
- **Rest Alcove**: Empty pocket with an oxygen cache and maybe an upgrade crate
- **Ruins**: Broken walls with embedded artifacts, ambient storytelling text
- **Quote Stones**: Readable blocks with famous quotes, philosophical musings, interesting passages — not quiz material, just enrichment

Micro-structures are selected from a biome-appropriate pool and placed during generation. Not every layer has one, making them a pleasant surprise.

### Empty Caverns (Pacing)
Pre-cleared spaces the player can walk through without mining. Essential for pacing:
- Break up dense mining sections with moments of breathing room
- Can contain upgrade crates, quiz gates, readable content, or just atmosphere
- Larger caverns at deeper layers (more dramatic reveals)
- Some caverns have ambient storytelling text on the walls

### Default Node Density (Tunable)
Starting values for a ~30x50 block layer (easily adjustable):
- **Mineral nodes**: 15-20 per layer
- **Artifact nodes**: 3-5 per layer
- **Upgrade crates**: 1-2 per layer
- **Quiz gates**: 1-2 per layer
- **Oxygen caches**: 1 per layer
- **Micro-structures**: 0-1 per layer (not guaranteed)
- **Empty caverns**: 1-2 per layer

All densities scale with depth (deeper = slightly denser, higher quality drops).

### Descent Shaft Placement
The Descent Shaft is **not at the bottom** — it requires exploratory search:
- Placed at a random position within the layer, biased toward the lower half
- Scanner can detect it from a moderate range (distinct ping)
- Finding the shaft IS part of the gameplay — exploration is rewarded
- Players must balance "keep mining for loot" vs. "find the shaft before oxygen runs low"

### Depth Layers & Point of No Return
- The mine is divided into discrete **layers** (depth zones)
- Each layer boundary is a **point of no return** — once you descend, you cannot go back up to the previous layer
- This creates a core risk/reward decision at every boundary:
  - **Surface now** with what you have (safe, guaranteed loot)
  - **Go deeper** for rarer minerals, better artifacts, more upgrades (risk losing loot if oxygen runs out)
- Deeper layers have:
  - Harder blocks (require better tools)
  - Rarer minerals and higher-tier artifacts
  - More dangerous hazards
  - Better in-run upgrade drops
  - Tougher quiz gates

### Biome Shuffling
**Biome order is randomized per run.** You might hit Ancient before Deep, or Crystalline before Fossilized. This is critical for replayability — players can't memorize a fixed progression. The only guarantee is that difficulty scales with depth (deeper = harder blocks, better loot, tougher gates), regardless of which biome appears.

### Biome Pool (Tentative)
| Biome | Theme | Visual Identity | Unique Features |
|---|---|---|---|
| Topsoil | Loose earth, roots | Brown/green, organic | Easy blocks, tutorial |
| Sedimentary | Clay, limestone | Tan/beige, layered | Fossils more common |
| Granite | Hard rock, ore veins | Grey/metallic, sparkles | Dense mining, rich minerals |
| Volcanic | Basalt, lava pockets | Red/orange, glowing | Hazard-heavy, rare loot |
| Fossilized | Ancient remains, amber | Gold/brown, bones | Fossil pets, artifact-rich |
| Crystalline | Gemstone caves | Blue/purple, prismatic | Highest-tier minerals |
| Primordial | Core material, unknown | Iridescent, alien | Extreme difficulty, mythic artifacts |

*Biome pool grows over time. Each run draws 3-5 biomes from the pool and shuffles them.*

### Layer Sizing
- Layers are not forced to a fixed time, but are **designed** with intended durations:
  - A "medium dive" (2 oxygen) targeting ~10 minutes total → ~3 min per layer across 3 layers
  - Layers get **physically larger** as you go deeper (more blocks to explore, more to find)
  - This naturally creates pacing: early layers are quick warm-ups, deeper layers are where you spend real time

### Layer Transition: The Descent Shaft
At certain depths within a layer, the player encounters a **Descent Shaft** — a visually distinct vertical tunnel glowing with the next biome's colors.

**Transition flow:**
1. Scanner picks up the shaft from a few blocks away (distinct ping)
2. Player mines to the shaft entrance
3. Prompt appears: *"Descend to [Biome Name]? No return. Oxygen bonus: +X"*
4. Player confirms → **falling animation** through a transition screen showing the biome change
5. Land in the new layer with a small oxygen recovery bonus

### Layer Entrance Challenge
Each layer transition includes a **gate challenge** — harder than standard quiz gates:
- **3 questions** instead of the usual 1
- Or a mini-puzzle (arrange blocks, decode a pattern)
- Or an especially hard block to mine through
- Failing the entrance challenge still lets you through but with a significant oxygen penalty
- This makes reaching each new layer feel **earned**

## Block Types

### By Hardness
- **Dirt/Soil**: 1 tap — tutorial blocks, no loot
- **Soft Rock**: 1-2 taps — occasional common minerals
- **Stone**: 2-3 taps — standard mining
- **Hard Rock**: 3-5 taps — contains better loot
- **Dense Ore**: 5-8 taps — guaranteed mineral node
- **Obsidian/Crystal**: 8+ taps — rare, high-tier loot
- **Unbreakable**: Cannot be mined — shapes pathways, creates puzzles

### Special Blocks
- **Mineral Node**: Glows subtly. Mining it yields minerals for the backpack.
- **Artifact Node**: Distinct visual (ancient symbol?). Yields an artifact of unknown rarity.
- **Oxygen Cache**: Rare. Restores some oxygen on mining.
- **Upgrade Crate**: Contains an in-run upgrade (tool, backpack slot, scanner boost).
- **Hazard Block**: Lava, gas, unstable ground. Damages or costs oxygen.
- **Quiz Gate**: Barrier block. Must answer a question to pass. Wrong answer = oxygen cost.

## Backpack (Inventory System)

### Darkest Dungeon-Style Stacking
Inspired by Darkest Dungeon's inventory rather than Tetris. Items occupy **slots** with **stacking**:
- Backpack has a limited number of **slots** (e.g., 6-8 starting slots)
- Common minerals (Dust) stack high: **50 per slot**
- Uncommon minerals (Shards) stack moderately: **20 per slot**
- Rare minerals (Crystals): **5 per slot**
- Epic minerals (Core Fragments): **2 per slot**
- Legendary minerals (Primordial Essence): **1 per slot**
- Artifacts occupy 1-3 slots depending on rarity (Common = 1, Rare = 2, Legendary = 3)
- Fossils are large: **3 slots** — real sacrifice to carry one

### Backpack UI
- **Not always visible** — a small backpack icon on screen shows fill level (color-coded: green/yellow/red)
- **Tap the icon** to open backpack overlay
- Backpack opens automatically when an important decision needs to be made (new loot when full)
- Items can be **rotated** when placing (adds puzzle element for tight fits)
- New loot **auto-places** in the first available spot — player can rearrange manually if they want

### The Decision Screen (When Full)
When the backpack is full and new loot is found:
1. Screen splits into two panels:
   - **Left: "The Cloth"** — a stone slab with cloth showing the new item(s) just found
   - **Right: "Your Backpack"** — current contents, fully interactable
2. Player can drag items between the cloth and backpack to swap
3. If the player **closes/walks away**, anything left on the cloth is **lost forever**
4. Creates those agonizing "what do I keep" moments with full visual clarity

### Send-Up Slots (Per Layer)
At each layer transition (before descending), the player can **send items to the surface** for safekeeping:
- **Layer 1 → 2**: 1 send-up slot available
- **Layer 2 → 3**: 2 send-up slots available
- **Layer 3 → 4**: 3 send-up slots available
- **Layer 4 → 5**: 4 send-up slots available

**How it works:**
- At the Descent Shaft, before choosing to descend, a "Send Up" panel appears
- Player selects items from their backpack to secure (matching the slot count for that layer)
- Sent items are **guaranteed safe** — even if oxygen runs out later, these are kept
- A slot can hold: one artifact, one stack of minerals, one fossil piece, etc.
- This creates a powerful strategic layer: "Do I send up this Rare artifact now (safe) or gamble that I'll find something better below?"

### Capacity Progression
- **Permanent upgrades** (at base): Slightly expand number of backpack slots
- **In-run upgrades**: Find backpack expansion drops during dives (temporary, lost after run)
- Both are intentionally limited — the tension of limited space is a core mechanic

### When Full (Mid-Layer)
- Player must **choose what to drop** via the Decision Screen
- Dropped items are **lost forever** (no going back, especially across layer boundaries)
- This decision pressure is intentional — it forces players to value what they carry

## In-Run Upgrades

### Philosophy
Starting gear should be deliberately weak. The excitement of a run comes from what you *find*. Permanent base upgrades improve your starting position slightly, but in-run upgrades are where the power comes from.

### Upgrade Style: Binding of Isaac Passives
In-run upgrades are primarily **passive relics/items** that modify the player's stats and abilities. The player accumulates these throughout a run, building a unique combination each time. This is inspired by The Binding of Isaac's item system.

**Design rule**: Incredible players should be able to build absurdly powerful combinations, but nobody should become truly invincible. There should always be a way to fail if you're careless with oxygen or make bad decisions.

### Upgrade Types
- **Passive Relics** (Binding of Isaac style): Permanent buffs for the rest of the run
  - "Magnetite" — nearby mined minerals auto-collect
  - "Deep Lungs" — 15% reduced oxygen consumption
  - "Geologist's Eye" — mineral nodes glow brighter, visible from further
  - "Lucky Strike" — 10% chance to not consume oxygen when mining
  - "Artifact Attunement" — artifact rarity roll gets a small bonus
- **Tool Upgrades**: Better pickaxe/drill found during the run. Reduces taps needed, allows mining harder blocks.
- **Scanner Upgrades**: Reveals nearby nodes through fog of war. Improves with better scanner tiers found in-run.
- **Backpack Expansions**: Extra row or column added to inventory grid.
- **Oxygen Tanks**: Extend current dive duration.
- **Consumables**: Bombs (clear area), flares (reveal large area), shields (protect from hazard).

### Synergies
Certain upgrades should combo, and discovering synergies is one of the most addictive elements of roguelites:
- **Magnetite + Blast Mining** = explosions pull loot to you
- **Deep Lungs + Lucky Strike** = extremely efficient oxygen usage
- **Geologist's Eye + Artifact Attunement** = treasure hunter build
- Design the upgrade pool so that players discover new combinations over many runs
- Synergies should feel emergent, not scripted — players feel clever when they find them

### After the Run
- **All in-run upgrades are lost** when the run ends — no exceptions
- This is core to the roguelite feel — every run you rebuild your power
- Permanent gear at base (see Economy doc) only gives a slight starting edge

## Visibility & Exploration

### Fog of War
- Player has a limited visibility radius
- Unexplored blocks are dark/hidden
- **Scanner** (upgradeable) reveals nearby special nodes (minerals, artifacts) through the fog
- Creates exploration tension — you don't know what's around the next block

### Scanner Mechanic
- Base scanner: very limited range, only shows adjacent special blocks
- Upgraded scanners (found in-run): larger range, show rarity hints, reveal hazards
- Permanent scanner upgrades (at base): slightly improve starting scanner
- Scanner pings could be visual (sonar-style pulse) for satisfying feedback

## Mining Controls

### Input Methods
- **Tap**: Tap an adjacent block to mine it. Multiple taps for harder blocks. Most precise.
- **Swipe**: Swipe in a direction to mine the next block in that direction. Faster, less precise.
- **Hold** (potential): Hold direction to auto-mine in a line. Useful for tunneling.
- All controls must work well one-handed in portrait mode on mobile.

### Movement
- **No gravity** — player can mine and move in any direction freely
- Player occupies mined (empty) spaces
- Movement is grid-based, one tile at a time

## Hazards (Progressive Implementation)

### Phase 1 (MVP)
- Oxygen depletion (running out = forced surface with loot loss)
- Hard blocks (natural pacing/walls)
- Quiz gates (knowledge checks)

### Phase 2
- Lava blocks (instant oxygen cost on contact)
- Gas pockets (cloud that reduces visibility + drains oxygen)
- Unstable ground (cave-in after mining nearby blocks)

### Phase 3
- Underground creatures (combat system)
- Environmental events (earthquake shifts blocks)
- Boss encounters at layer boundaries

## Run End Conditions

1. **Voluntary surface**: Player chooses to return. Keep all loot. Best outcome.
2. **Oxygen depleted**: "The Sacrifice" — choose what to drop based on depth penalty. Painful but player has agency.
3. **Rescue beacon used**: Emergency extraction, keep everything. Rare and valuable.
4. **Reached maximum depth**: Surface with everything. Rare achievement.

## Key Metrics to Track Per Run

- Depth reached
- Blocks mined
- Minerals collected (by type)
- Artifacts found (by rarity)
- Quiz gates passed/failed
- Oxygen remaining at surface
- In-run upgrades found
- Time spent
