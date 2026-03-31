# Background Art Brief — Recall Rogue

All backgrounds are **pixel art**, portrait orientation (9:16 mobile), rendered at **360×640px** base resolution. Transparent or solid-color margins are fine where UI chrome overlays. The top ~55% of the screen is the Phaser "display zone" (enemy sprite, HP bars, effects). The bottom ~45% is the Svelte card hand / quiz overlay (mostly obscured by UI). Backgrounds should have their visual weight and detail concentrated in the **top 60%**.

Art style: chunky pixel art (16–32px tile grain), limited palette per scene (8–12 colors + shading), subtle dithering for gradients, no outlines on background elements (outlines reserved for foreground sprites). Mood: mysterious, underground, faintly magical.

---

## 1. Combat Backgrounds (per segment)

These are the primary backgrounds seen during every encounter. One per segment, reused across all encounters in that segment.

### 1a. Segment 1 — Shallow Depths (Floors 1–6)

**Setting:** Natural limestone cave, close to the surface.
**Palette:** Warm browns, tans, mossy greens, pale amber torchlight.
**Elements (top to bottom):**
- Rough cave ceiling with stalactites dripping, faint daylight filtering through cracks above
- Mid-ground: uneven limestone walls, exposed tree roots poking through, patches of moss/lichen
- Scattered small crystals catching torchlight (amber glow points)
- Floor area: flat stone with shallow puddles reflecting warm light
- Faint dust motes / floating particles (these will be overlaid by Phaser particle system, but suggest them in the static art too)

**Mood:** Welcoming but slightly eerie. The entrance to something deeper. Safe enough — for now.

### 1b. Segment 2 — Deep Caverns (Floors 7–12)

**Setting:** Industrial-depth cave system, darker and more structured.
**Palette:** Cool grays, slate blues, dark charcoal, orange-red magma glow accents.
**Elements:**
- Ceiling: rough basalt formations, no more daylight — only artificial/magical light sources
- Mid-ground: angular basalt columns, veins of coal visible in walls (dark streaks), occasional granite slab
- Dim lanterns or glowing fungus clusters providing blue-white light
- Faint lava glow from deep cracks in the far background (not dominant, just hints)
- Floor: darker stone, cracks with faint orange underglow

**Mood:** The comfort of the surface is gone. Cold, industrial, oppressive. You're deep enough that getting out isn't trivial.

### 1c. Segment 3 — The Abyss (Floors 13–18)

**Setting:** Alien crystal caverns, hostile and beautiful.
**Palette:** Deep purples, obsidian blacks, electric cyan crystal glow, magenta accents.
**Elements:**
- Ceiling: jagged obsidian formations, crystalline growths refracting light into prismatic shards
- Mid-ground: massive crystal geode formations protruding from walls, some cracked and glowing from within
- Floating crystal fragments (suspended, gently rotating — suggests magical instability)
- Lava rivers visible far below through gaps in the floor (deep orange, distant)
- Faint heat shimmer / distortion effect around edges

**Mood:** Alien, dangerous, awe-inspiring. The rules of the surface don't apply here. Beauty and threat in equal measure.

### 1d. Segment 4 — The Archive (Floors 19–24)

**Setting:** Ancient underground library/temple — the source of all knowledge.
**Palette:** Deep navy, gold leaf accents, warm parchment tones, teal magical glow.
**Elements:**
- Ceiling: carved stone arches, ancient runes faintly glowing in gold
- Mid-ground: towering bookshelves carved into the cave walls, scrolls and tomes visible, some floating
- Arcane circles or glyphs etched into the floor, pulsing with soft teal light
- Stone pillars with knowledge motifs (eye symbols, open books, constellation maps)
- Dust and magical particles drifting upward (knowledge ascending)

**Mood:** Sacred, ancient, reverent. This is where knowledge lives. The final challenge feels earned — you've descended through rock and crystal to reach the source.

### 1e. Endless — Beyond the Archive (Floors 25+)

**Setting:** The void between knowledge — abstract, unstable, infinite.
**Palette:** Black void, white/gold constellation points, shifting purple-blue nebula washes.
**Elements:**
- No ceiling or walls — open void with distant star-like points
- Floating stone platforms (remnants of the Archive, crumbling at edges)
- Ghostly book pages drifting in the void
- Faint constellation lines connecting knowledge points (stars)
- Central platform area where combat takes place, edges dissolving into nothing

**Mood:** Transcendent, infinite, slightly unsettling. You've gone beyond what was meant to be explored. Reality is optional here.

---

## 2. Boss Arena Variant

One variant overlay/modification applied on top of the segment combat background for boss encounters (floors 6, 12, 18, 24).

**Modifications to base segment background:**
- Darken edges by 30% (vignette effect baked in)
- Add symmetrical stone pillars or archway framing left and right edges
- Floor gains a circular arena pattern (concentric rings, faintly glowing)
- Ceiling gains hanging chains or banners (segment-themed: roots for S1, iron chains for S2, crystal shards for S3, torn scrolls for S4)
- Overall slightly more saturated and dramatic than the base

**Mood:** "This fight matters." Arena framing signals a significant encounter.

---

## 3. Room Selection — Hallway

**Setting:** Stone corridor with perspective depth, three doorways ahead.
**Palette:** Neutral stone grays, warm torchlight from sconces, colored light spilling from doorways.
**Elements:**
- Vanishing-point perspective corridor (stone floor tiles receding)
- Three arched doorways at the far end (these are overlaid by Svelte UI door components, so leave the archway shapes as empty/dark openings)
- Wall sconces with flickering torchlight on left and right walls
- Stone floor with worn path down the center
- Cobwebs in upper corners, minor rubble at base of walls
- Ceiling: low stone arch, slightly claustrophobic

**Mood:** Anticipation. What's behind each door? Brief respite between encounters.

**Note:** The door contents/colors are handled by the Svelte overlay. The background just needs the corridor and empty archway shapes.

---

## 4. Rest Room — Campfire Chamber

**Setting:** Small cave alcove with a warm campfire.
**Palette:** Warm oranges, deep browns, golden firelight, dark shadows at edges.
**Elements:**
- Central campfire (crackling, warm glow illuminating the small space)
- Smooth cave walls curving inward (cozy, enclosed feel)
- A bedroll or rough blanket laid out near the fire
- A small wooden stool or flat rock for sitting
- Steam rising from a pot or kettle near the fire
- Scattered supplies: a pack, a water skin, a small lantern (unlit — the fire is enough)
- Warm light falloff: bright center, deep shadow at edges

**Mood:** Safety. Warmth. A moment to breathe. The only truly safe room in the dungeon.

---

## 5. Shop Room — Underground Merchant

**Setting:** Carved-out merchant stall in a wider cave junction.
**Palette:** Rich purples, gold coins/accents, warm lantern light, wooden browns.
**Elements:**
- A wooden merchant counter/table with a cloth draped over it
- Shelves behind the counter displaying various wares (bottles, scrolls, trinkets — decorative only)
- Hanging lanterns (2–3) casting warm overlapping light
- Gold coins scattered on the counter surface
- A mysterious merchant silhouette or empty space behind the counter (the merchant character is a separate sprite if we add one later)
- Cave walls visible at the edges, but this space feels more "built" than natural — wooden supports, a rug on the floor

**Mood:** Commerce in the dark. Someone set up shop down here, which is both comforting and suspicious.

---

## 6. Mystery Room — Arcane Chamber

**Setting:** A strange, ancient chamber with magical anomalies.
**Palette:** Deep purple, electric violet, teal wisps, dark stone.
**Elements:**
- Circular chamber with smooth, unnaturally polished stone walls
- A central pedestal or altar with a faint glow (event interaction point)
- Arcane symbols carved into the floor in a radial pattern
- Floating motes of light drifting unpredictably
- One wall partially collapsed, revealing strange crystalline growth behind it
- Faint ghostly afterimages or echoes at the edges (suggesting time/space instability)

**Mood:** Unpredictable. Something happened here — or is about to. Could be wonderful, could be terrible.

---

## 7. Treasure Room — Hidden Cache

**Setting:** A small vault or natural alcove filled with glittering rewards.
**Palette:** Gold, amber, warm browns, sparkle highlights (white pixel dots).
**Elements:**
- A natural cave alcove or carved niche
- Piles of gold coins (small mounds, pixel-art style)
- An open chest in the center, golden light emanating from within
- Gemstones embedded in the walls (ruby red, sapphire blue, emerald green — 2–3 each)
- Cobwebs suggesting this cache hasn't been found in ages
- Faint golden ambient light from the treasure itself

**Mood:** Jackpot. A small, focused space that's all about the reward. Brief and satisfying.

---

## 8. Floor Transition

**Setting:** Descending deeper — a vertical shaft or stairway.
**Palette:** Dark with the destination segment's palette bleeding in from below.
**Elements:**
- A carved stone stairway spiraling downward into darkness
- Walls narrowing as they descend (claustrophobic perspective)
- Light from above fading, new light source from below (color matches next segment)
- Dust and small rocks falling (sense of motion/descent)
- Carved depth markers or runes on the wall (floor numbers)

**Mood:** Transition. Deeper. No going back (until the next boss checkpoint).

**Note:** This may be a brief animation rather than a static background. Design as a static that could also work as a parallax scroll.

---

## 9. Segment Boss Defeated — Retreat or Delve

**Setting:** A grand underground crossroads after defeating the segment guardian.
**Palette:** Current segment palette + golden victory accents.
**Elements:**
- Wide cavern opening with two clear paths:
  - LEFT: A lit stairway leading UP (warm, safe light — retreat path)
  - RIGHT: A dark shaft/stairway leading DOWN (next segment's color glow — delve path)
- Central area: remnants of the boss battle (cracked floor, scattered debris)
- Overhead: the ceiling is cracked open, showing either the previous segment above or the sky (for segment 1)
- Victory banner or magical seal broken on the floor (the guardian's mark)

**Mood:** The pivotal decision. Safety or ambition. Both paths are clearly visible and feel meaningful.

---

## 10. Run End — Victory

**Setting:** The surface, dawn breaking, triumphant return.
**Palette:** Warm sunrise golds, soft sky blues, green grass, hopeful.
**Elements:**
- The dungeon entrance behind the viewer (dark cave mouth, receding)
- Dawn sky with golden clouds and first light
- Green hillside or meadow stretching ahead
- Silhouette of the camp in the mid-distance (tent, campfire smoke)
- Scattered treasures/scrolls the player is carrying (foreground, bottom)
- Birds or butterflies in the sky (life, freedom)

**Mood:** Relief. Triumph. You made it back with knowledge and treasure. The world feels bigger and brighter after the dark.

---

## 11. Run End — Defeat

**Setting:** Fading consciousness in the deep, echoes of knowledge slipping away.
**Palette:** Desaturated version of the segment where the player died, red/gray tones.
**Elements:**
- The segment background but heavily darkened and desaturated
- Cracks spreading across the image (like shattered glass or breaking stone)
- Cards scattering / falling away into darkness (2–3 card silhouettes tumbling)
- A single dim light in the center (the last spark of consciousness)
- Red vignette at edges (damage/danger)

**Mood:** Loss, but not despair. You'll be back. The knowledge you gained is still yours.

---

## 12. Hub / Camp Background

**Setting:** An above-ground campsite near the dungeon entrance.
**Palette:** Warm earth tones, evening sky (purple-orange gradient), campfire warmth.
**Elements:**
- Evening sky with stars beginning to appear (top 20%)
- Rolling hills or forest edge in the far background
- The dungeon entrance: a large carved stone archway built into a hillside (mid-left)
- Central campfire with warm glow
- Flat ground area for modular camp elements (tent, seating, bookshelf, anvil — these are separate sprites placed on top)
- A path connecting the dungeon entrance to the camp
- Ambient: fireflies, gentle smoke from the campfire

**Mood:** Home base. Warm, safe, inviting. A place to prepare, reflect, and grow between expeditions.

**Note:** Camp element sprites (tent, bookshelf, anvil, quest board, etc.) are placed separately on top. This background just provides the environment and ground plane.

---

## 13. Domain Selection

**Setting:** A mystical study or map room.
**Palette:** Parchment tones, ink blues, warm candlelight, leather browns.
**Elements:**
- A large table or desk covered with maps, scrolls, and open books
- Candles providing warm light (2–3 clustered)
- Shelves in the background with categorized tomes (suggesting the domains)
- A world map or star chart pinned to the back wall
- Ink pots, quills, and a magnifying glass on the table surface
- Warm but focused lighting — this is a place of study and preparation

**Mood:** Scholarly preparation. Choosing your focus before the expedition. Intellectual and intentional.

---

## 14. Archetype Selection

**Setting:** An armory or training hall adjacent to the study.
**Palette:** Steel grays, weapon-warm tones (leather, wood), accent colors per archetype.
**Elements:**
- Stone walls with weapon/armor racks (swords, shields, staffs, books — representing archetypes)
- A training dummy or sparring circle in the center
- Five distinct light sources or banners representing the archetypes:
  - Balanced: white/silver
  - Aggressive: red/orange
  - Defensive: blue/steel
  - Control: purple/teal
  - Hybrid: green/gold
- Worn stone floor with footwork patterns etched in

**Mood:** Choosing your combat identity. Martial but also cerebral — this isn't just fighting, it's strategy.

---

## Technical Notes

- **File format:** PNG, transparent background where applicable, or solid fills
- **Base resolution:** 360×640px (scales to device via CSS/Phaser)
- **Phaser integration:** Combat backgrounds loaded as scene background images, positioned at (0,0), scaled to fill
- **Svelte screens:** Set as CSS `background-image` on the screen container div
- **Layering:** All backgrounds sit behind game objects, sprites, and UI. Design with the expectation that 40–50% of the bottom will be obscured by card hand UI
- **Future variations:** Each background will later get 2–3 variations (lighting changes, weather, time-of-day) to prevent visual repetition across runs. Design the base version as the "default/neutral" state

---

## Delivery Checklist

| # | Background | Filename | Count |
|---|-----------|----------|-------|
| 1a | Shallow Depths Combat | `bg-combat-s1-shallow.png` | 1 |
| 1b | Deep Caverns Combat | `bg-combat-s2-deep.png` | 1 |
| 1c | The Abyss Combat | `bg-combat-s3-abyss.png` | 1 |
| 1d | The Archive Combat | `bg-combat-s4-archive.png` | 1 |
| 1e | Endless Void Combat | `bg-combat-s5-endless.png` | 1 |
| 2 | Boss Arena Overlay | `bg-combat-boss-overlay.png` | 1 |
| 3 | Room Selection Hallway | `bg-hallway.png` | 1 |
| 4 | Rest Room Campfire | `bg-room-rest.png` | 1 |
| 5 | Shop Room Merchant | `bg-room-shop.png` | 1 |
| 6 | Mystery Room Arcane | `bg-room-mystery.png` | 1 |
| 7 | Treasure Room Cache | `bg-room-treasure.png` | 1 |
| 8 | Floor Transition | `bg-floor-transition.png` | 1 |
| 9 | Retreat or Delve | `bg-retreat-delve.png` | 1 |
| 10 | Run End Victory | `bg-run-victory.png` | 1 |
| 11 | Run End Defeat | `bg-run-defeat.png` | 1 |
| 12 | Hub Camp | `bg-hub-camp.png` | 1 |
| 13 | Domain Selection | `bg-domain-select.png` | 1 |
| 14 | Archetype Selection | `bg-archetype-select.png` | 1 |
| **Total** | | | **18** |
