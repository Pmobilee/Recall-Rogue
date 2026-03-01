# Game Design Document — Terra Miner (a.k.a. Terra-Gacha)

Mining roguelite meets knowledge game. Dig deep, discover artifacts, learn real facts, grow your Knowledge Tree.

## Core Fantasy

A lone miner crash-lands on a far-future Earth. The surface is barren — unrecognizable. Underground lies everything that once was: minerals formed over millennia, and **artifacts** — compressed fragments of humanity's lost knowledge. The miner must dig to survive, rebuild a dome habitat, bring fossilized creatures back to life, and piece together what Earth once was — one fact at a time.

## Design Pillars

1. **Addictive learning** — The primary goal. Every system must make acquiring knowledge feel rewarding, never tedious. Players should *want* to learn more, not feel forced.
2. **Roguelite replayability** — Every dive is unique. Procedural generation, random loot, in-run upgrades, and risk/reward depth layers ensure no two runs are alike.
3. **Gacha dopamine** — Artifact reveals, rarity tiers, fossil pet synthesis, and loot moments create anticipation and payoff ("terra-gacha").
4. **Meaningful progression** — Knowledge Tree grows permanently. Base expands. Pets come alive. The player's world reflects what they've learned.

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
    → Decision points: go deeper (no return) for better loot, or surface safely
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

## Visual Style

- 2D pixel art (power-of-2 dimensions: 16x16, 32x32, 64x64)
- Dark underground palette with glowing minerals and artifacts
- Retro RPG-inspired UI
- Particle effects for mining, discovery, and gacha reveals
- Achievement paintings: pixel art versions of real paintings/posters related to knowledge categories

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

## Monetization

- **Free to play, free to learn** — no knowledge is paywalled
- **Oxygen refills over time** — play for free with patience
- **Subscription**: Unlimited oxygen for unlimited play
- **Premium Materializer**: Special crafting station; limited free materials can be found during play, but not enough for everything. Cosmetics, special pets, decorations
- **Top players who ace quizzes can earn enough bonus oxygen to play indefinitely** — skill and knowledge mastery = free unlimited play
- **Philosophy**: The goal is to make learning addictive, not to maximize revenue

## Target Audience

- Anyone who is curious
- No specific age range — content scales from "fun facts" to deep knowledge
- Casual players (daily 5-minute dives), dedicated players (long study sessions)
- Trivia enthusiasts, lifelong learners, students

## Onboarding — The First 5 Minutes

The crash-landing is the perfect tutorial. Here's the flow:

### First Launch
1. **Age selection**: KID / TEEN / ADULT (affects which facts appear)
2. **Crash cutscene** — 3 pixel art comic panels, ~15 seconds. Ship plummets, screen shakes, dust settles. Skip button available from second 1.
3. **GAIA introduces itself** — "Oh! You survived! I'm GAIA, your ship's knowledge database. My data banks are nearly empty after the crash... Let's see what we can find down here."

### First Dive (Handcrafted Tutorial Mine)
4. **Crawl out of wreckage** — find basic pickaxe in the debris
5. **Mine first few blocks** — teach tap/swipe controls naturally (soft blocks, instant break)
6. **Find first artifact** — teach the backpack system, GAIA reacts excitedly
7. **Find a fossil** — the hook moment. Player sees 3 options: "Looks like some sort of feline type?" / "Seems canine..." / "Could be... avian?" Player chooses.
8. **Surface with loot** — see the empty, damaged dome

### Back at Base (Slow Unlocks Begin)
9. **First artifact ingestion** — GAIA's first gacha reveal, guaranteed Rare+ fact with snarky comment. Player learns their first fact.
10. **See the fossil unlock path** — "Learn 10 facts about [chosen animal type] to revive this creature!"
11. **End of first session** — dome is mostly locked. GAIA hints at what's to come.

### Second Dive & Beyond (Progressive Unlocks)
- **Dive 2**: Guaranteed to find a **Knowledge Tree seed**. Plant it at base. "This will grow with everything you learn."
- **Dive 3**: GAIA's full codex functionality unlocks (study sessions available)
- **Dive 4+**: Materializer unlocks, more dome areas progressively open
- Each unlock feels like a reward, not a gate

**Key design rules for onboarding:**
- First artifact is guaranteed **Rare or better** — hook them with a mind-blowing fact
- First fossil gives the player an immediate emotional goal (bring this animal to life!)
- Unlocks are spread across first several dives — always something new to discover at base
- Tutorial mine is **handcrafted** — guaranteed layout with specific teaching moments
- Tutorial should feel like gameplay, not instructions
- GAIA guides without being overbearing

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
