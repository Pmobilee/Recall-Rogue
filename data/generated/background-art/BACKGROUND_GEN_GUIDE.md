# Background Art Generation Guide — Recall Rogue

## Specs

- **Aspect ratio:** 9:16 (portrait mobile)
- **Generate at:** 768 × 1344 px
- **Upscale to:** 1536 × 2688 px (2× nearest-neighbor)
- **Format:** PNG, no transparency, full canvas fill

## NanoBanana Pro System Instructions

Paste this into your NanoBanana Pro (Gemini 2.5 Pro) system prompt / model instructions field. Then you can just type short descriptions and get consistent results.

---

### SYSTEM PROMPT

```
You are a pixel art background generator for a mobile card roguelite game called "Recall Rogue".

EVERY image you generate MUST follow these rules exactly:

STYLE:
- Chunky pixel art, 16-32px visible tile grain
- Limited palette: 8-12 colors per scene plus 2-3 shading tones per color
- Subtle dithering for gradients — NO smooth gradients, NO anti-aliasing
- NO outlines on background elements (outlines are only for foreground character/card sprites)
- Hand-pixeled look, like a 16-bit SNES/GBA RPG background
- Atmospheric but not cluttered — leave breathing room for UI overlays

COMPOSITION:
- Portrait orientation, 9:16 aspect ratio (768×1344 pixels)
- Visual weight and detail concentrated in the TOP 55% of the image
- The BOTTOM 45% will be covered by card UI — keep it simple/dark/atmospheric down there
- No text, no UI elements, no HUD mockups, no borders, no watermarks, no signatures
- No characters, no creatures, no card sprites — ONLY environment/architecture/nature

MOOD:
- Underground fantasy dungeon aesthetic
- Mysterious, faintly magical, slightly eerie
- Knowledge/library/arcane undertones throughout
- Warm light sources against dark surroundings (torches, crystals, magic, lava)

COLOR RULES:
- Rich saturated colors for focal elements (crystals, fire, magic)
- Muted/dark tones for walls, floors, ceilings
- Strong value contrast between light sources and shadows
- Each scene has a dominant color temperature (specified per prompt)

TECHNICAL:
- Output exactly 768×1344 pixels
- PNG format
- No transparency — fill the entire canvas
- The image should tile-able at the LEFT and RIGHT edges if possible (horizontal wrap)
```

---

## Combat Backgrounds

### Segment 1 — Shallow Depths (Floors 1-6)

**Quick prompt:**
> Underground limestone cave, close to the surface. Stalactites dripping from a rough ceiling, faint daylight filtering through cracks above. Uneven limestone walls with exposed tree roots poking through, patches of moss and lichen. Small amber crystals catching torchlight. Flat stone floor with shallow puddles reflecting warm light. Floating dust motes. Palette: warm browns, tans, mossy greens, pale amber torchlight. Welcoming but slightly eerie first-cave atmosphere.

**Filename:** `bg-combat-s1-shallow.png`

---

### Segment 2 — Deep Caverns (Floors 7-12)

**Quick prompt:**
> Deep underground basalt cave system, no daylight at all. Angular basalt columns and dark coal veins streaking through the walls. Occasional granite slabs. Dim glowing fungus clusters providing blue-white light. Faint orange-red lava glow from deep cracks in the far background, not dominant. Darker stone floor with cracks showing faint orange underglow. Palette: cool grays, slate blues, dark charcoal, sparse orange-red magma accents. Cold, industrial, oppressive atmosphere.

**Filename:** `bg-combat-s2-deep.png`

---

### Segment 3 — The Abyss (Floors 13-18)

**Quick prompt:**
> Alien crystal cavern deep underground. Jagged obsidian ceiling formations with crystalline growths refracting light into prismatic shards. Massive crystal geode formations protruding from walls, cracked and glowing cyan from within. A few crystal fragments floating suspended in the air. Lava rivers visible far below through gaps in the floor, deep orange and distant. Faint heat shimmer distortion at edges. Palette: deep purples, obsidian blacks, electric cyan crystal glow, magenta accents. Alien, dangerous, awe-inspiring.

**Filename:** `bg-combat-s3-abyss.png`

---

### Segment 4 — The Archive (Floors 19-24)

**Quick prompt:**
> Ancient underground library temple carved into cavern stone. Carved stone arches on the ceiling with ancient runes faintly glowing gold. Towering bookshelves carved into cave walls, scrolls and tomes visible, some floating in midair. Arcane circles and glyphs etched into the stone floor pulsing with soft teal light. Stone pillars with knowledge motifs — eye symbols, open books, constellation maps. Dust and magical particles drifting upward. Palette: deep navy, gold leaf accents, warm parchment tones, teal magical glow. Sacred, ancient, reverent.

**Filename:** `bg-combat-s4-archive.png`

---

### Segment 5 — Endless Void (Floors 25+)

**Quick prompt:**
> Abstract void between worlds, no ceiling no walls no floor. Open black void with distant star-like white and gold constellation points. Floating crumbling stone platforms, remnants of an ancient library dissolving at their edges. Ghostly translucent book pages drifting through the void. Faint constellation lines connecting stars like a knowledge graph. A central stone platform area, edges dissolving into nothingness. Shifting purple-blue nebula washes in the far background. Palette: black void, white and gold star points, purple-blue nebula. Transcendent, infinite, slightly unsettling.

**Filename:** `bg-combat-s5-endless.png`

---

## Boss Arena Variant

**Quick prompt:**
> Dark dramatic underground arena. Symmetrical stone pillars framing left and right edges of a cavern. Heavy vignette darkening the edges by 30%. The floor has a circular arena pattern with concentric glowing rings. Hanging chains and tattered banners from the ceiling. The atmosphere is more saturated and intense than a normal cave. Foreboding, powerful, this-fight-matters energy. Palette: deep shadows, accent color glow from the floor rings, dramatic contrast.

**Note:** Generate one base version. We will create segment-specific tinted variants by color-shifting this in post.

**Filename:** `bg-combat-boss-overlay.png`

---

## Room Selection — Hallway

**Quick prompt:**
> Stone corridor with strong vanishing-point perspective, three dark arched doorways at the far end. Wall sconces with flickering torchlight on left and right walls. Worn stone floor tiles receding into the distance with a clear path down the center. Cobwebs in upper corners, minor rubble at base of walls. Low stone arch ceiling, slightly claustrophobic. The three doorways are empty dark openings — no doors, no light spilling out, just dark archway shapes. Palette: neutral stone grays, warm orange torchlight from sconces. Anticipation atmosphere, what is behind each door.

**Filename:** `bg-hallway.png`

---

## Rest Room — Campfire Chamber

**Quick prompt:**
> Small cozy cave alcove with a warm crackling campfire in the center. Smooth cave walls curving inward creating an enclosed intimate space. A rough bedroll laid out near the fire. A flat rock used as a seat. Steam rising from a small pot near the fire. Scattered supplies — a pack, a water skin, a small unlit lantern. Bright warm firelight in the center with deep shadows at the edges. Strong warm light falloff. Palette: warm oranges, deep browns, golden firelight, dark shadows. Safety and warmth, a moment to breathe.

**Filename:** `bg-room-rest.png`

---

## Shop Room — Underground Merchant

**Quick prompt:**
> Carved-out merchant stall in a wider underground cave junction. A wooden counter with a draped cloth. Shelves behind the counter displaying bottles, scrolls, and trinkets. Two or three hanging lanterns casting warm overlapping pools of light. Gold coins scattered on the counter surface. An empty shadowy space behind the counter where a merchant would stand. Wooden support beams, a small rug on the stone floor. This space feels more built and constructed than natural cave. Palette: rich purples, gold coin accents, warm lantern light, wooden browns. Commerce in the dark, comforting yet suspicious.

**Filename:** `bg-room-shop.png`

---

## Mystery Room — Arcane Chamber

**Quick prompt:**
> Strange ancient circular chamber with smooth unnaturally polished stone walls. A central stone pedestal or altar with a faint violet glow. Arcane symbols carved into the floor in a radial pattern emanating from the center. Floating motes of teal and violet light drifting unpredictably. One wall partially collapsed revealing strange crystalline growth behind it. Faint ghostly afterimages or echoes at the edges suggesting time-space instability. Palette: deep purple, electric violet, teal wisps, dark polished stone. Unpredictable, something happened here, could be wonderful could be terrible.

**Filename:** `bg-room-mystery.png`

---

## Treasure Room — Hidden Cache

**Quick prompt:**
> Small natural cave alcove or carved niche filled with treasure. Piles of gold coins in small chunky pixel mounds. An open wooden chest in the center with golden light emanating from within. Gemstones embedded in the rough cave walls — a few ruby reds, sapphire blues, emerald greens. Thick cobwebs suggesting this cache has not been found in ages. Faint golden ambient light radiating from the treasure itself, illuminating the small space. Palette: gold, amber, warm browns, white sparkle highlight pixels. Jackpot energy, brief and satisfying.

**Filename:** `bg-room-treasure.png`

---

## Floor Transition — Descent

**Quick prompt:**
> A carved stone stairway spiraling downward into darkness, viewed from above looking down. Walls narrowing as they descend creating claustrophobic perspective. Light from above fading out, new mysterious colored light emerging from far below. Small rocks and dust particles falling downward suggesting motion and descent. Carved depth markers or ancient runes etched into the spiral wall. The stairway disappears into a glowing point of light far below. Palette: dark stone grays transitioning to a new color glow from below. Deeper, no going back.

**Filename:** `bg-floor-transition.png`

---

## Retreat or Delve — The Crossroads

**Quick prompt:**
> Grand underground crossroads cavern after a great battle. Wide open space with two clear paths visible. On the left, a lit stone stairway leading upward toward warm safe golden light representing retreat and safety. On the right, a dark shaft or stairway leading down into mysterious glowing depths representing danger and ambition. The central area shows cracked stone floor and scattered debris from a boss battle. The ceiling is cracked open showing light from above. A broken magical seal or defeated guardian mark on the floor. Palette: current cave tones plus golden victory accents. The pivotal decision moment.

**Filename:** `bg-retreat-delve.png`

---

## Run End — Victory

**Quick prompt:**
> The surface world at dawn, triumphant return from underground. A dark cave entrance mouth visible behind and below the viewpoint, receding. A dawn sky with golden clouds and warm first light breaking through. Green hillside or meadow stretching ahead into the distance. Silhouette of a small camp in the mid-distance with a tent and campfire smoke rising. Scattered scrolls and treasures in the foreground bottom edge. Birds flying in the golden sky. Palette: warm sunrise golds, soft sky blues, green grass, hopeful bright. Relief, triumph, the world feels bigger and brighter after the dark.

**Filename:** `bg-run-victory.png`

---

## Run End — Defeat

**Quick prompt:**
> A dark underground cavern scene, heavily desaturated and somber. The view is tilted slightly as if falling. Cracks spreading across the image like shattered glass or breaking stone. Two or three card silhouettes tumbling and falling away into darkness below. A single dim white light in the center, the last spark of consciousness fading. Heavy red-dark vignette at all edges. The cave environment is barely visible through the darkness and cracks. Palette: desaturated grays, muted reds, deep blacks, one fading white point. Loss but not despair, you will be back.

**Filename:** `bg-run-defeat.png`

---

## Hub / Camp Background

**Quick prompt:**
> Above-ground campsite near a dungeon entrance at evening time. An evening sky with purple-orange gradient and stars beginning to appear in the top portion. Rolling forested hills in the far background. A large carved stone archway built into a hillside on the left side, the dungeon entrance, dark inside. A central area with flat ground suitable for placing camp furniture sprites on top. A winding dirt path connecting the dungeon entrance to the camp area. Fireflies dotting the scene. Gentle smoke from where a campfire would be. Palette: warm earth tones, purple-orange evening sky, campfire warmth. Home base, safe, inviting, a place to prepare between expeditions.

**Filename:** `bg-hub-camp.png`

---

## Domain Selection — The Study

**Quick prompt:**
> A mystical underground study or map room. A large wooden table or desk in the lower portion covered with maps, scrolls, and open books. Two or three candle clusters providing warm focused light. Bookshelves in the background filled with categorized tomes and volumes. A large world map or star chart pinned to the back stone wall. Ink pots, quills, and a magnifying glass on the table surface. Warm but focused candlelight illumination. Palette: parchment tones, ink blues, warm candlelight, leather browns. Scholarly preparation before an expedition.

**Filename:** `bg-domain-select.png`

---

## Archetype Selection — The Armory

**Quick prompt:**
> An underground stone armory or training hall. Stone walls lined with weapon racks and armor stands displaying swords, shields, wooden staffs, and thick spellbooks representing different combat styles. A training dummy or sparring circle in the center of the room. Five distinct colored banners or light sources hanging from the ceiling — silver-white, red-orange, steel-blue, purple-teal, and green-gold — each representing a different combat archetype. Worn stone floor with etched footwork training patterns. Palette: steel grays, leather and wood warm tones, with the five accent banner colors. Choosing your combat identity, martial but cerebral.

**Filename:** `bg-archetype-select.png`

---

## Post-Processing Checklist

After generating each background:

1. **Verify resolution** — must be 768×1344 exactly
2. **Upscale 2× nearest-neighbor** → 1536×2688 final
3. **Save as PNG** in `public/assets/backgrounds/`
4. **Check bottom 45%** — should be dark/simple enough that card UI reads clearly on top
5. **Check top 55%** — enough detail and atmosphere for the Phaser display zone
6. **Color check** — palette matches the segment/room description
7. **No text/UI** — regenerate if any text, labels, or UI elements appear

## Quick Reference Table

| Asset | Prompt Keywords | Palette | Filename |
|-------|----------------|---------|----------|
| S1 Combat | limestone, stalactites, roots, moss, amber | warm browns, tans, greens | `bg-combat-s1-shallow.png` |
| S2 Combat | basalt, coal veins, glowing fungus, lava cracks | cool grays, slate blues, charcoal | `bg-combat-s2-deep.png` |
| S3 Combat | obsidian, crystal geodes, floating shards, prismatic | purples, blacks, cyan, magenta | `bg-combat-s3-abyss.png` |
| S4 Combat | library temple, runes, bookshelves, arcane circles | navy, gold, parchment, teal | `bg-combat-s4-archive.png` |
| S5 Combat | void, constellations, crumbling platforms, nebula | black, white-gold, purple-blue | `bg-combat-s5-endless.png` |
| Boss Arena | pillars, arena rings, chains, vignette | deep shadows, glow accents | `bg-combat-boss-overlay.png` |
| Hallway | corridor, vanishing point, 3 archways, torches | stone grays, warm torchlight | `bg-hallway.png` |
| Rest Room | campfire, cozy alcove, bedroll, warm glow | oranges, browns, golden fire | `bg-room-rest.png` |
| Shop Room | merchant counter, lanterns, gold coins, shelves | purples, gold, lantern warmth | `bg-room-shop.png` |
| Mystery Room | arcane chamber, altar, glowing symbols, polished | purple, violet, teal, dark stone | `bg-room-mystery.png` |
| Treasure Room | gold piles, open chest, gemstones, cobwebs | gold, amber, browns, sparkles | `bg-room-treasure.png` |
| Floor Transition | spiral stairway, descent, narrowing, runes | dark grays, new glow from below | `bg-floor-transition.png` |
| Retreat/Delve | crossroads, up-path light, down-path dark | cave tones, golden victory | `bg-retreat-delve.png` |
| Victory | dawn surface, cave behind, meadow, camp silhouette | sunrise golds, sky blues, greens | `bg-run-victory.png` |
| Defeat | dark cave, shattered, falling cards, fading light | desaturated grays, reds, blacks | `bg-run-defeat.png` |
| Hub Camp | evening campsite, dungeon arch, hills, fireflies | earth tones, evening sky | `bg-hub-camp.png` |
| Domain Select | study room, maps, candles, bookshelves | parchment, ink blue, candlelight | `bg-domain-select.png` |
| Archetype Select | armory, weapon racks, 5 banners, training circle | steel grays, 5 accent colors | `bg-archetype-select.png` |

**Total: 18 backgrounds**
