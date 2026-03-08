# Economy & Crafting — Terra Miner

Currency, minerals, the Materializer, pets, farming, and economy sinks.

## Minerals (Currency)

### Philosophy
Minerals are the primary currency. They're found by mining mineral nodes during dives and by selling unwanted artifacts. They're spent at the Materializer to craft upgrades, cosmetics, and base improvements.

### Mineral Types
Minerals should be **thematically tied to real Earth geology** — finding them teaches players about what's actually inside the Earth. However, naming should feel evocative, not like a chemistry textbook.

**Tiering system** (evocative era-themed names):

| Tier | Name | Found At | Value | Visual |
|---|---|---|---|---|
| 1 | **Dust** | Surface/Shallow | Common, abundant | Dull grey particles |
| 2 | **Shard** | Shallow/Deep | Moderate | Translucent fragments |
| 3 | **Crystal** | Deep | Valuable | Glowing geometric shapes |
| 4 | **Core Fragment** | Ancient | Very valuable | Pulsing, deep-earth glow |
| 5 | **Primordial Essence** | Core | Extremely rare | Iridescent, otherworldly |

**Conversion**: 100 of a lower tier = 1 of the next tier (compressible at the Materializer).

**Design note**: While these names are fantasy-themed, the minerals players find in the mine can still be tied to real geology through their visual design and lore text, maintaining the educational angle.

### Mineral Properties
- Each mineral type has a **Tetris shape** for the backpack (common = small 1x1, rare = larger/awkward shapes)
- Visual distinction in the mine (different glow colors, particle effects)
- Found at different depth layers (deeper = rarer minerals)

## The Materializer (Crafting Station)

### Standard Materializer
Located in the player's dome. Converts minerals into useful items:

**Craftable Categories:**
- **Mining Gear**: Slightly better starting pickaxe tiers. Intentionally limited — in-run upgrades are the main power source.
- **Scanner Upgrades**: Marginally improve starting scanner range.
- **Backpack Mods**: Small permanent expansions to starting backpack grid.
- **Oxygen Tank Upgrades**: Slightly increase base oxygen capacity.
- **Base Structures**: Dome expansions, decorations, functional buildings.
- **Consumables**: Pre-run items (single-use bombs, flares, shields for the next dive).
- **Cosmetics**: Miner skins, pickaxe skins, dome decorations.
- **Pet Revival**: Turn fossilized animals into living pets (see Pets section).

**Design rule**: Permanent gear upgrades are **limited and cap out**. You can't buy your way to invincibility. The run itself should always be the primary source of power.

### Premium Materializer
A separate, special crafting station:
- Requires **premium materials** — a rare resource found in very limited quantities during dives
- Enough premium materials drop during normal play to craft a few premium items
- But not enough for everything — creates desire for more
- **Premium items**: Exclusive cosmetics, special pet variants, unique dome decorations, convenience items
- **Never pay-to-win**: No gameplay advantages over standard Materializer items

## Pets & Fossilized Animals

### Concept
During dives, players can find **fossilized remains** of Earth's ancient creatures. These fossils can be brought back to life at the Materializer, creating living pets that inhabit the player's dome.

### Revival Pipeline
1. **Find fossil** during a dive (rare drop, deeper layers have rarer species)
2. **Carry fossil back** in backpack (takes space, creating a meaningful choice)
3. **Spend minerals** at the Materializer to revive the creature
4. **Animal comes to life** in the dome (gacha-level reveal moment!)

### Pet Roles (Progressive Implementation)
**Phase 1**: Cosmetic companions in the dome. Visual variety, collectible.
**Phase 2**: Functional roles:
- **Dive companions**: Pets accompany you on dives (carry extra items, sniff out artifacts, alert to hazards)
- **Farm producers**: Place animals on the farm, they produce goods over time (eggs, milk, crystals)
- **Zoo display**: Arrange animals for visitors to admire

### The Farm
- Unlockable area in the dome
- Place revived animals to produce resources passively
- Resources produced over real time (collect on next login, like Stardew/Hay Day)
- Farm goods can be sold for minerals or used in Materializer recipes
- Farm expansion costs minerals (economy sink)
- **Future**: Grow plants, manage a small ecosystem

### The Zoo
- Display area for revived creatures
- Visitors can see your collection
- Rare/extinct species are prestige items

### Knowledge-Gated Revival (DECIDED)
**Reviving animals requires learning related facts first.** This is one of the most important systems tying the Knowledge Tree to base progression.

Example: To revive a T-Rex, the player must:
1. Find the T-Rex fossil during a dive
2. Learn 10 Paleontology/Dinosaur facts (from their study rotation)
3. Spend the required minerals at the Materializer

This means:
- Players are incentivized to **keep** artifacts related to animals they want to revive
- The Knowledge Tree directly gates exciting base content
- Each pet tells a story: "I learned about this creature, then I brought it back to life"
- Different animals require different knowledge branches, encouraging breadth of learning

### Cat
- Every player gets a cat. Non-negotiable.

### Farm Balance
The farm should be attractive but not dominant:
- **Passive income is supplementary**, not a replacement for mining
- Farm production is slow enough that diving is always more efficient per-minute
- However, farm income accumulates while offline — it's a "welcome back" bonus
- Some players may enjoy the farm as their main loop, and **that's intentionally okay** — the more engagement surfaces we offer, the wider our audience net
- Farm expansion is gated by minerals (from mining) and knowledge (from studying), ensuring all systems stay connected

## Economy Sinks (Anti-Inflation)

Critical for long-term economy health. Without sinks, veteran players accumulate infinite minerals and nothing has value.

### Active Sinks
- **Materializer recipes** that scale in cost (each subsequent upgrade costs more)
- **Consumable purchases** for runs (bombs, flares, shields — spent every dive)
- **Pet feeding/care** (future — ongoing costs to maintain farm productivity)
- **Cosmetic rotating shop** ("Today only: Golden Pickaxe Skin — 500 Crystals")
- **Base expansion** (dome rooms, decorations — costs scale with size)
- **Mineral compression** (converting 100 Tier 1 → 1 Tier 2 has a small "loss" tax)

### Passive Sinks
- **Run failure** (dropping loot on oxygen depletion — minerals lost to the void)
- **Premium Materializer** incentive (desire to craft premium items motivates earning/spending)
- **Knowledge Store** purchases (spending learning-milestone currency on small items)

### Daily Deal / Rotating Shop
- Creates urgency: "This item is available today only"
- Prevents hoarding (if you don't spend, you miss the deal)
- Curated selection of cosmetics, consumables, recipes
- Refreshes daily with some items on longer rotations

## Base / Dome

### Overview
The dome is the player's **hub between dives**. It's where all non-mining activities happen.

### Areas
- **Materializer Room**: Crafting station + Premium Materializer
- **GAIA Terminal**: Artifact ingestion, fact review, study sessions
- **Knowledge Tree**: Central display, visual centerpiece
- **Farm**: Animal placement, passive resource generation
- **Zoo**: Display area for revived creatures
- **Shop**: Daily deals, rotating stock, premium items
- **Quarters**: Cosmetic customization for the miner
- **Gallery**: Achievement paintings displayed here (pixel art versions of real art, unlocked via milestones)

### Visiting
- Players can visit each other's domes
- View-only (for now): see their Knowledge Tree, zoo, farm, gallery
- Social flex: showing off a massive Knowledge Tree or rare pets
- **Future**: Gift sending, trading

## Achievement Paintings

A unique reward system: achievements unlock **pixel art versions of famous paintings/posters** related to the achievement category.

Examples:
- "Learn 50 Astronomy facts" → Pixel art Starry Night
- "Revive 10 dinosaurs" → Pixel art Jurassic-themed poster
- "Reach depth 500" → Pixel art Journey to the Center of the Earth

These are displayed in the player's Gallery in their dome. Collectible, shareable, visually rewarding.

## Mastery → Free Play: The Oxygen Economy

### Core Principle
**Oxygen only buys playtime.** It does not buy minerals, crafting, pets, or anything else. The entire economy of upgrades, cosmetics, and base building runs on minerals. Oxygen is purely the ticket to enter the mine.

This means mastery players who earn unlimited oxygen still need to engage with the mineral economy for progression. Unlimited play time ≠ unlimited resources.

### Earning Oxygen Through Mastery (In-Run)
During a dive, quiz gates are opportunities to **earn extra oxygen tanks**:
- Players start a dive with their allocated oxygen (1-3 tanks)
- **Gate 5** (5th quiz gate passed): earn +1 bonus oxygen tank
- **Gate 10**: earn +1 bonus oxygen tank
- **Gate 15**: earn +1 bonus oxygen tank
- **Gate 20**: earn +1 bonus oxygen tank
- A **perfect run** (all gates correct) in a deep dive could earn +4 tanks
- Bonus tanks are stored and can be used for future dives

**Anti-Spam Protection**: Players cannot just repeatedly do tiny shallow runs to farm quiz gates. Oxygen tanks earned are proportional to depth reached and quiz difficulty. Shallow gates give smaller oxygen rewards. Must always spend minimum oxygen to enter.

### Rescue Beacon
- Craftable consumable at the Materializer
- When activated during oxygen depletion: emergency extraction with **zero loot loss**
- Costs significant minerals to craft (economy sink)
- Can also be found very rarely during dives
- Pre-dive decision: bring the beacon (safety net) or save it for a harder run?

## Streak System

- **Daily review streak**: Consecutive days of completing fact reviews
- Streak rewards: bonus minerals, rare consumables, cosmetic items at milestones
- Streak protection: miss one day, lose streak (creates daily retention)
- **Duolingo-style**: Friendly but persistent reminders
- Streak counter visible in dome and on profile
