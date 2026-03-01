# Next Session Questions — Terra Miner

Questions prepared for brainstorming. Batches 25-30 have been **answered** (session 4, 2026-02-28). Remaining batches 31-36 are still open for future discussion.

---

## Batch 25: Procedural Generation Deep Dive [ANSWERED]

The mine is the core experience. We need to get generation right.

**101.** Each biome needs a distinct **generation algorithm**. Sedimentary might have horizontal layers with fossils in bands. Volcanic might have lava rivers and obsidian pockets. Crystalline might have open caverns with gem clusters on the walls. Should we invest in unique generation per biome, or use one algorithm with different block palettes?

**102.** How dense should mineral/artifact nodes be? Too sparse = boring tunneling through dirt. Too dense = no scarcity, no excitement. Rough numbers: if a layer is 30x50 blocks, how many mineral nodes (10? 20? 50?) and how many artifact nodes (2? 5? 10?)?

**103.** Should the mine have **structures** — pre-designed rooms or formations embedded in the procedural grid? (e.g., an ancient library room with guaranteed artifacts, a crystal cavern with mineral clusters, a collapsed tunnel that forces a detour). This is how Spelunky makes procedural generation feel hand-crafted.

**104.** How do we ensure the mine is always **solvable**? If no gravity exists and the player can mine in any direction, is it possible to get stuck? (e.g., surrounded by unbreakable blocks). Do we need pathfinding validation during generation?

**105.** Should the mine have **empty pockets** — pre-cleared caverns the player can walk through? These could contain upgrade crates, quiz gates, or just a moment of breathing room before the next dense mining section. Pacing is everything.

**106.** How does the Descent Shaft get placed? Always at the bottom of the layer? Random position requiring exploration? Multiple possible shafts (find one, the others disappear)? This affects how directed vs. exploratory each layer feels.

---

## Batch 26: Tetris Backpack — The Micro-Decisions [ANSWERED — Redesigned to Darkest Dungeon stacking]

The backpack might be the most interaction-heavy UI in the game.

**107.** Should the player be able to **rotate** items in the backpack? Tetris allows rotation, which adds a puzzle layer. Without rotation, the grid is simpler but items might not fit.

**108.** When you find a mineral/artifact, should it **auto-place** in the first available spot, or should the player always manually place it? Auto-place is faster but removes the puzzle. Manual is more engaging but could be tedious during fast mining.

**109.** Should the backpack UI be **always visible** (like a sidebar), or pop up when you pick something up? Always visible = constant awareness of space. Pop-up = less screen clutter but could feel interrupting.

**110.** What shapes make sense for each item type? Proposal:
   - Common mineral (Dust): 1x1 (tiny, easy to fit)
   - Uncommon mineral (Shard): 1x2 or 2x1
   - Rare mineral (Crystal): L-shape or T-shape
   - Common artifact: 2x1
   - Rare artifact: 2x2
   - Legendary artifact: 3x2 or irregular
   - Fossil: 2x3 (huge — forces real sacrifice to carry one)

**111.** Should there be a **"quick drop"** gesture? If the backpack is full and you find something better, you should be able to quickly swap without going through multiple taps. Maybe: long-press an item in backpack to drop it, then tap the new item to collect.

---

## Batch 27: The Miner's Computer → GAIA [ANSWERED — Named GAIA]

**112.** What's the Computer's **name**? "The Miner's Computer" is functional but not lovable. Options:
   - ARIA (Artifact Research & Intelligence Assistant)
   - GAIA (after the Earth, since it's cataloging Earth's knowledge)
   - CHIP (quirky, fits the pixel art theme)
   - TEX (short for "text/codex")
   - The player names it?

**113.** Should the Computer have a **visual avatar**? A small pixel art face/icon that appears with dialogue? Or is it just text? A face would add personality. Could be a glowing screen with pixel expressions.

**114.** How **chatty** should it be? Scale of 1-10 (1 = rare comments, 10 = constant chatter). Too quiet = no personality. Too chatty = annoying. I'm thinking 4-5: noticeable presence, but knows when to shut up.

**115.** Should the Computer have **opinions** about facts? ("This one is my favorite!" "Hmm, I find geology facts a bit dry, but you seem to love them!") This creates a relationship between the player and their AI companion.

**116.** Could the Computer become a **tutor**? If a player keeps getting a fact wrong, the Computer could offer a mnemonic device or extra context. ("Having trouble with this one? Here's a trick: think of octopuses as the 'three-hearted aliens of the sea'...")

---

## Batch 28: Onboarding — Minute by Minute [ANSWERED]

**117.** The crash cutscene — how long, how elaborate? Options:
   - 3 panels, comic-style, 15 seconds (fast, gets to gameplay)
   - Animated pixel cutscene, 30 seconds (beautiful, sets the tone)
   - Playable crash landing (player controls descent, dodges debris) — expensive but immersive
   - Skip button available from second 1 (for replays)

**118.** After the crash, the player finds a pickaxe. But should they also find the Computer? Having the AI companion from the very first moment creates a guide. ("Oh! You survived! I'm your ship's knowledge computer. Let's see what we can find down here...")

**119.** The first mine session is essentially a tutorial. Should it be a **special, shorter, hand-designed mine** (guaranteed layout with specific teaching moments), or a normal procedural mine with guaranteed drops (first artifact at depth 10, first fossil at depth 20)?

**120.** When the player picks their fossil type ("feline?", "canine?", etc.) — should there be 3 options? 5? Should each option show a silhouette of what the animal might look like? This choice should feel exciting, not overwhelming.

**121.** After the first dive, the player returns to an empty dome. How much of the dome systems should be functional on day 1? Just the tree and computer? Or should the materializer also be available so they can taste crafting?

---

## Batch 29: Analytics & Metrics — What to Measure [STILL OPEN]

**122.** What **retention metrics** matter most for a learning game?
   - D1/D7/D30 retention (standard mobile)
   - Facts retained at 30 days (learning effectiveness)
   - Quiz accuracy over time (are players actually learning?)
   - Session length and frequency
   - Knowledge Tree growth rate

**123.** Should we track **which facts players find most interesting** (keep rate vs sell rate)? This data could inform future content creation — double down on popular categories.

**124.** Should there be an **A/B testing framework** from the start? e.g., testing different oxygen costs, backpack sizes, quiz gate frequencies. Or is this premature for MVP?

**125.** What **cheating vectors** exist and should we worry about them?
   - Looking up answers externally (is this actually bad? They're learning!)
   - Modifying local save data for infinite oxygen
   - Automated quiz answering bots
   - Should we even try to prevent these, or embrace that cheating = learning?

---

## Batch 30: The Fact Quality Problem [ANSWERED]

This is arguably the biggest non-technical challenge in the entire game.

**126.** Who is the "voice" of the facts? Should they be:
   - **Encyclopedic**: "The blue whale is the largest animal ever known to have existed."
   - **Conversational**: "Blue whales are so massive that their hearts are the size of a small car."
   - **Mind-blowing lead**: "The largest animal that has EVER lived — not just now, but in all of history — is still alive today. It's the blue whale."
   - The third style is the most engaging but hardest to write at scale.

**127.** How do we handle **controversial or politically sensitive facts**? History is full of them. Do we avoid them entirely? Include them with careful framing? Let the category system help players self-select?

**128.** Should facts have an **"age appropriateness" rating**? Some facts (wars, diseases, historical atrocities) might not suit young players. A filter toggle ("family mode") could help.

**129.** How do we **verify accuracy** at scale? A fact pipeline that produces 500 facts might have 5-10% errors. For a learning game, accuracy is existential. Need a verification system that goes beyond "the AI said so."

**130.** Should the game credit **fact sources** to the player? ("Source: NASA.gov") This builds trust and teaches source literacy. Or does it clutter the experience?

---

## Batch 31: Sound Design as Game Feel [STILL OPEN]

**131.** Mining sounds are critical to "juice." Should different block types have **completely different sounds** (crumbly dirt, sharp stone crack, crystalline chime) or variations of one sound?

**132.** The gacha reveal needs a **sound signature**. What's the audio equivalent of going from Common to Mythic? Thinking: subtle chime → fuller chord → dramatic buildup → symphonic burst → something transcendent?

**133.** Should the mine have **ambient audio** that changes with depth? Surface = wind, birdsong. Deep = echoes, dripping. Core = deep rumbling, ethereal hum. This creates an audio journey.

**134.** Quiz correct/wrong sounds — these play hundreds of times. They need to be **satisfying but not annoying**. The correct sound should feel rewarding. The wrong sound should be informative, not punishing (think Duolingo's gentle "boop" vs. a harsh buzzer).

**135.** Should the Miner's Computer have a **voice** (text-to-speech or recorded lines)? Or is it text-only with a characteristic "blip blip" text scroll sound?

---

## Batch 32: Edge Cases & Weird Player Behavior [STILL OPEN]

**136.** What if a player **only studies and never mines**? They'd have no new facts to study (no artifacts). Should the base provide a small trickle of facts via pop-up reviews, or force mining for new content?

**137.** What if a player **only mines and never studies**? Their Knowledge Tree doesn't grow, they can't revive pets, and they accumulate unreviewed facts. Should the game gently nudge them, or let them play their way?

**138.** What if a player **sells every artifact** and never keeps facts? They'd have lots of minerals but an empty tree. Valid playstyle? Or should we ensure some artifacts are "unsellable" (first few, rare ones)?

**139.** What happens if the player has **no facts due for review** and hits a quiz gate? Options:
   - Use a random new fact from their unlearned artifacts
   - Use a "general knowledge" question not tied to their collection
   - No quiz gate appears (only generate gates when reviews are due)
   - Let them pass for free with a note: "No pending reviews — pass freely!"

**140.** What if the **backpack is full and the player finds a fossil**? This is the worst-case scenario for frustration. They have to drop something important to carry it. Should fossils have a separate "pocket" that doesn't take backpack space? Or is this tension intentional?

---

## Batch 33: Competitive & Social Dynamics [STILL OPEN]

**141.** **Leaderboards** — what do they rank?
   - Deepest single dive
   - Most facts mastered (all time)
   - Longest study streak
   - Biggest Knowledge Tree (total leaves)
   - Fastest to complete a knowledge branch
   - Best quiz accuracy (%)
   - Most pets revived
   - Should these be global, friends-only, or both?

**142.** **Knowledge duels** — two players quiz each other. How does this work?
   - Both answer the same question, fastest correct answer wins?
   - Turn-based: you ask from your collection, they ask from theirs?
   - Both see a new random fact, first to answer correctly wins the fact?
   - Should duels cost oxygen to enter? Wager minerals?

**143.** Could there be **cooperative dives**? Two players in the same mine, shared oxygen, can split up to cover more ground. One player mines while the other answers quiz gates. This could be incredibly fun but technically complex.

**144.** **Dome visiting** — when you visit someone's dome, should you be able to:
   - See their full Knowledge Tree (or just its size/shape)?
   - Read their learned facts?
   - See which facts they've mastered vs. are still learning?
   - Leave a "guestbook" message?
   - Gift them a duplicate fact or minerals?

**145.** Should there be a **"fact of the day"** that everyone in the game learns? Creates a shared cultural moment. ("Today's global fact: ...") Could appear during morning quiz ritual.

---

## Batch 34: Long-Term Content & Live Ops [STILL OPEN]

**146.** How often should new facts be added? Weekly batch? Monthly? Should there be a content roadmap tied to game events?

**147.** **Seasonal events** — concrete examples:
   - "Age of Dinosaurs" (2 weeks): boosted fossil drops, dinosaur-themed artifacts, special Paleontology facts
   - "Space Month": astronomy-heavy, special Moon/Mars biome in the mine
   - "Language Festival": first language learning content drops
   - Should seasons have exclusive rewards that don't come back?

**148.** Could there be **user-submitted facts** (moderated)? A "community fact" system where players submit interesting facts, they get verified, and the best ones enter the game. The submitter gets credit.

**149.** What's the plan for when a player has **learned every available fact** in a category? This is a completionist's dream moment. Special achievement? Bonus? What keeps them engaged?

**150.** Should the game have **version milestones** tied to content? e.g., "v1.0: 500 facts, basic mining. v1.5: 2000 facts, pets, farm. v2.0: 5000 facts, language learning, multiplayer." This helps with roadmapping.

---

## Batch 35: The MVP — What to Build First [ANSWERED — Keep Everything Simple]

These questions are specifically about scoping the MVP to be buildable and testable.

**151.** For MVP, should we skip Tetris shapes and just use **slot-based inventory** (X slots, each holds one item)? Tetris is fun but complex to build. We could upgrade to Tetris shapes in v1.1 once the core loop is proven.

**152.** For MVP, should the mine be a **fixed size per run** (e.g., 30 wide x 100 deep) or infinite in width with depth as the only variable? Fixed is easier to generate and test.

**153.** Should the MVP have **one biome or multiple**? One biome is faster to build. But biome variety is part of the promise. Maybe: one biome with a visual depth gradient (lighter blocks near surface, darker blocks deeper)?

**154.** For the MVP quiz system, do we need all 25 distractors per fact, or can we start with **8-10** and expand later? Fewer distractors = faster content creation for the initial 500 facts.

**155.** Should the MVP include the **oxygen tank earning system** (quiz gates give oxygen), or just static oxygen that depletes? The earning system is the core of the mastery loop, but it adds complexity.

**156.** What's the **minimum viable onboarding**? Could we skip the crash cutscene and fossil choice for MVP, and just drop the player in a mine with a pickaxe and brief text prompts?

**157.** Should the MVP Knowledge Tree be a **real tree visualization**, or can it be a **list/grid view** of learned facts grouped by category? Tree visualization is visually powerful but technically demanding.

**158.** For pixel art fact images — should we include these in MVP, or are they a v1.1 feature? Generating 500 images is feasible but adds pipeline work.

**159.** What's the **minimum number of facts** needed to test the core loop? Could we start with 50-100 hand-curated facts for initial playtesting, before building the automated pipeline for 500?

**160.** Should MVP have the **Miner's Computer personality**, or just a neutral codex UI? Personality adds charm but requires writing hundreds of contextual messages.

---

## Batch 36: Technical Architecture for Game Systems [STILL OPEN]

**161.** State management: the game has complex state (mine grid, backpack contents, oxygen level, active upgrades, SM-2 data per fact, Knowledge Tree). Should this all live in Phaser's scene data, or do we need a separate **state management layer** (e.g., a central store that both Phaser and Svelte can read)?

**162.** Save system: how often do we save? After every action (safe but slow)? At layer transitions (could lose a layer of progress on crash)? When the app backgrounds (mobile-specific)?

**163.** The mine grid is potentially large (30x100+ blocks). What's the rendering strategy? Render only visible tiles? Use Phaser's tilemap system? How do we handle the fog of war efficiently?

**164.** Quiz questions need to be available offline. Cache strategy: pre-load all 500 facts on first launch? Or load on-demand with a rolling cache of 50-100? What's the storage footprint with 500 facts × 25 distractors × pixel art images?

**165.** The SM-2 algorithm needs precise timing (when was each fact last reviewed, when is it next due). Should this use server time (requires connectivity) or device time (can be manipulated)?

---

*Updated: 2026-02-28*
*Total: 160 questions asked, ~130 answered. Remaining open: Batches 29, 31-34, 36 (~35 questions)*
