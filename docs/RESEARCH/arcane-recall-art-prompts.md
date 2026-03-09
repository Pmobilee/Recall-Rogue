# Arcane Recall — Art Asset Prompt Templates
## For: NB1 (google/gemini-2.5-flash-image) via OpenRouter
## Version: 1.0 — March 2026

---

## Generation Notes

- **Model:** NB1 (`google/gemini-2.5-flash-image`) via OpenRouter — $0.04/image
- **All sprite prompts** must end with: `solid bright green (#00FF00) background` for chroma key removal
- **Background prompts** (combat, menu, room selection) do NOT use green screen — generate directly, use as-is
- **Post-pipeline (sprites):** Generate at native resolution (~1024x1024) → green screen chroma key removal (tolerance-based, corner pixel detection) → edge despill → auto-crop → nearest-neighbor downscale to target → optional palette quantize (32 colors) → PNG export with alpha
- **Post-pipeline (backgrounds):** Generate at native resolution → crop to portrait aspect (540x1200) → nearest-neighbor downscale to 270x600 → PNG export (no alpha needed)
- See `docs/IMAGE_GENERATION.md` for full API config, request/response format, and green screen pipeline details
- **Human review required** for every generated asset before integration

---

## 1. ENEMY / CHARACTER SPRITES

**Target size:** 48x64 virtual pixels

**Style suffix** (append to every enemy prompt):
```
full body visible with padding around edges, standing in a neutral pose, pixel art sprite, 32-bit era JRPG style, hand-pixeled, 48x64 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background
```

### Enemy Roster — Idle Poses

**Cave Bat** (Common)
```
A large golden pale bat with leathery wings spread wide, flying ominously with sharp fangs visible, [STYLE SUFFIX]
```

**Crystal Golem** (Common)
```
A crystal golem made of jagged purple and blue minerals, hulking bipedal stance with massive crystalline fists, [STYLE SUFFIX]
```

**Toxic Spore** (Common)
```
A small toxic mushroom creature emitting green spores from its cap, stubby legs, mischievous expression, [STYLE SUFFIX]
```

**Shadow Mimic** (Common)
```
A dark shadowy mimic with shifting amorphous form and glowing yellow eyes, tendrils of darkness wisping off its body, [STYLE SUFFIX]
```

**Dungeon Wyrm** (Elite)
```
A serpentine metallic worm with segmented armored body, iron-colored scales, rows of grinding teeth, coiled upright, [STYLE SUFFIX]
```

**Fossil Guardian** (Elite)
```
An armored skeleton warrior holding a bone shield and ancient sword, tattered cape, glowing eye sockets, imposing stance, [STYLE SUFFIX]
```

**Gate Guardian** (Boss)
```
A massive drill-armed mechanical construct with riveted iron plating, glowing red eye slit, imposing boss creature towering over the frame, [STYLE SUFFIX]
```

**Magma Wyrm** (Boss)
```
A molten fire elemental dragon with flowing lava body, cracks of orange light across dark basalt skin, large boss creature radiating heat, [STYLE SUFFIX]
```

**The Archivist** (Boss)
```
A spectral librarian figure with floating ancient scrolls orbiting around it, tall ethereal boss with a hooded robe of starlight and hollow glowing eyes, [STYLE SUFFIX]
```

### Pose Variants

Append one of these to the main character description (replacing "standing in a neutral pose" in the style suffix):

**Hit:**
```
recoiling from impact, slight knockback pose, brief pain expression, arms pulled back
```

**Death:**
```
crumbling apart, defeated and collapsing, breaking into pieces, fading away
```

---

## 2. PLAYER CHARACTER

**Target size:** 32x48 virtual pixels

**Style suffix** (append to every player prompt):
```
full body visible with padding around edges, pixel art sprite, 32-bit era JRPG hero style, hand-pixeled, 32x48 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background
```

**Base character description:**
```
An adventurous explorer character with a helmet lamp and pickaxe strapped to back, leather armor with arcane rune accents, determined expression, facing right
```

### Animation State Variants

Replace the pose portion for each state:

**Idle:**
```
[BASE CHARACTER], standing relaxed, subtle breathing pose, weight on one foot, arms at sides, [STYLE SUFFIX]
```

**Attack:**
```
[BASE CHARACTER], lunging forward with arm extended, dynamic action pose, motion lines implied, [STYLE SUFFIX]
```

**Hit:**
```
[BASE CHARACTER], flinching backward, arms up defensively, pain expression, slight recoil, [STYLE SUFFIX]
```

**Heal:**
```
[BASE CHARACTER], standing with arms slightly out to sides, peaceful expression, eyes closed, soft glow implied around hands, [STYLE SUFFIX]
```

**Shield:**
```
[BASE CHARACTER], bracing with arms crossed in front of body, defensive stance, gritted teeth, solid footing, [STYLE SUFFIX]
```

**Death:**
```
[BASE CHARACTER], collapsed on ground face-down, defeated pose, weapon fallen beside them, [STYLE SUFFIX]
```

**Victory:**
```
[BASE CHARACTER], fist raised triumphantly in the air, celebrating with a grin, standing tall, [STYLE SUFFIX]
```

---

## 3. COMBAT BACKGROUNDS

**Target size:** 540x1200 native → 270x600 final (portrait orientation)

**NO green screen.** Generate directly and use as-is — backgrounds do not need transparency.

**Style suffix** (append to every combat background prompt):
```
wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG battle backdrop style, layered depth with darker foreground edges and lighter center, focal point in upper third of image, flat ground plane at vertical center for enemy to stand on, atmospheric but not busy, muted saturation so foreground sprites pop, limited color palette per material, clean pixel clusters, hand-pixeled, no blur, no depth of field, no photorealism, game asset, parallax-ready layered composition
```

### Combat Background Prompts

**Dark Stone Dungeon:**
```
A dark stone dungeon corridor with flickering wall torches casting warm orange light, crumbling brick walls, cobblestone floor, [STYLE SUFFIX]
```

**Crystal Cavern:**
```
A crystalline cavern with towering purple and blue crystal formations, ambient glow from mineral deposits, reflective rocky ground, [STYLE SUFFIX]
```

**Volcanic Chamber:**
```
A molten volcanic chamber with rivers of lava along the edges, obsidian pillars, orange-red ambient glow, heat shimmer, dark basalt floor, [STYLE SUFFIX]
```

**Frozen Ice Cavern:**
```
A frozen ice cavern with hanging icicle stalactites, pale blue ice walls, frost-covered stone floor, cold blue ambient light, [STYLE SUFFIX]
```

**Ancient Temple Interior:**
```
An ancient temple interior with crumbling stone columns, faded murals on walls, overgrown with moss, dust motes in shafts of light from cracks above, [STYLE SUFFIX]
```

**Underground Garden:**
```
An overgrown underground garden with bioluminescent plants, giant mushrooms, vine-covered stone archways, soft teal and green ambient glow, [STYLE SUFFIX]
```

**Clockwork Chamber:**
```
A mechanical clockwork chamber with spinning bronze gears in the walls, steam pipes, riveted metal floor plates, warm amber lighting from furnace glow, [STYLE SUFFIX]
```

---

## 4. MENU / UI BACKGROUNDS

**Target size:** 540x1200 native → 270x600 final (portrait orientation)

**NO green screen.** Generate directly and use as-is.

**Style suffix** (append to every menu background prompt):
```
wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, large open areas of low-detail space for text overlay, dark or dim regions in lower half for UI readability, visual interest concentrated in upper third, atmospheric lighting with single dominant color temperature, limited color palette, clean pixel clusters, hand-pixeled, no blur, no photorealism, game asset, poster composition with negative space
```

### Menu Background Prompts

**Title Screen** (vast cavern entrance):
```
A vast cavern entrance with dramatic light streaming in from above, silhouette of a grand archway, deep underground vista beyond, sense of scale and adventure, [STYLE SUFFIX]
```

**Run Summary** (surface landscape):
```
A surface landscape at dawn with warm golden light over rolling hills, distant mountains, a path leading toward a dungeon entrance below, peaceful and reflective mood, [STYLE SUFFIX]
```

**Knowledge Library** (scholar's study):
```
A scholar's underground study filled with towering bookshelves, floating candles, a large desk with open tome, arcane symbols faintly glowing on the walls, cozy and mysterious, [STYLE SUFFIX]
```

---

## 5. ROOM SELECTION BACKGROUNDS

**Target size:** 540x1200 native → 270x600 final (portrait orientation)

**NO green screen.** Generate directly and use as-is.

**Style suffix** (append to every room selection prompt):
```
symmetrical composition with three distinct paths or doorways visible side by side, wide view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG dungeon style, three entry points evenly spaced in the upper half, open floor area in lower half, atmospheric dim lighting with glow from each path entrance, limited color palette, clean pixel clusters, hand-pixeled, no blur, no photorealism, game asset, clear spatial separation between the three routes
```

### Room Selection Prompts

**Standard Dungeon Fork:**
```
A stone dungeon corridor opening into three distinct doorways, each with a different colored glow — amber left, blue center, red right — worn cobblestone floor, torch sconces between doors, [STYLE SUFFIX]
```

**Crystal Cavern Fork:**
```
A crystal cavern splitting into three tunnels, each lined with different colored crystal formations — purple left, teal center, gold right — sparkling ambient light, [STYLE SUFFIX]
```

---

## 6. SHOP / REST / TREASURE BACKGROUNDS

**Target size:** 540x1200 native → 270x600 final (portrait orientation)

**NO green screen.** Generate directly and use as-is.

### Shop Background

**Style suffix:**
```
wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, warm inviting merchant den atmosphere, shelves of goods and trinkets visible, lantern lighting with warm amber tones, wooden counter or display area, cozy underground market feel, limited color palette, clean pixel clusters, hand-pixeled, no blur, no photorealism, game asset
```

**Prompt:**
```
A cozy underground merchant den with wooden shelves stacked with potions and scrolls, a worn wooden counter, hanging lanterns casting warm amber light, rugs on the stone floor, [STYLE SUFFIX]
```

### Rest Background

**Style suffix:**
```
wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, peaceful campfire alcove atmosphere, warm orange firelight as dominant light source, sense of safety and respite, rocky walls enclosing a small sheltered area, limited color palette, clean pixel clusters, hand-pixeled, no blur, no photorealism, game asset
```

**Prompt:**
```
A sheltered campfire alcove in a dungeon wall, small crackling fire in the center, bedroll and backpack nearby, warm orange glow against cool blue stone walls, peaceful and safe feeling, [STYLE SUFFIX]
```

### Treasure Background

**Style suffix:**
```
wide establishing view, no characters, no creatures, portrait orientation tall narrow scene, pixel art game background, 32-bit era JRPG style, golden treasure chamber atmosphere, dramatic lighting from treasure glow, sense of discovery and reward, ornate stone architecture, limited color palette, clean pixel clusters, hand-pixeled, no blur, no photorealism, game asset
```

**Prompt:**
```
A golden treasure chamber with an ornate stone pedestal in the center, piles of gold coins and gems along the walls, shafts of golden light from above, ancient carved pillars, [STYLE SUFFIX]
```

---

## 7. CARD FRAMES

**Target size:** 150x200 native → 75x100 final

**Style suffix** (append to every card frame prompt):
```
rectangular card frame border design, portrait orientation, ornate but not busy, pixel art style, 32-bit era, clean hard pixel edges, limited color palette, flat shading with no gradients, strong outline, centered empty interior for card content, decorative corners, game asset, card game UI element, solid bright green (#00FF00) background
```

### Card Type Frames

**Attack (Red-Orange):**
```
A card frame border in fiery red-orange tones with small flame motifs at the corners, aggressive angular design, [STYLE SUFFIX]
```

**Shield (Blue-Steel):**
```
A card frame border in blue-steel metallic tones with small shield emblems at the corners, sturdy reinforced design, [STYLE SUFFIX]
```

**Heal (Green):**
```
A card frame border in emerald green tones with small leaf or heart motifs at the corners, flowing organic design, [STYLE SUFFIX]
```

**Utility (Teal-Cyan):**
```
A card frame border in teal-cyan tones with small gear or compass motifs at the corners, precise geometric design, [STYLE SUFFIX]
```

**Buff (Purple):**
```
A card frame border in royal purple tones with small star or arrow-up motifs at the corners, mystical arcane design, [STYLE SUFFIX]
```

**Debuff (Dark Indigo):**
```
A card frame border in dark indigo tones with small skull or chain motifs at the corners, ominous heavy design, [STYLE SUFFIX]
```

**Regen (Pink-White):**
```
A card frame border in soft pink-white tones with small pulsing heart motifs at the corners, gentle radiant design, [STYLE SUFFIX]
```

**Wild (Rainbow Prismatic):**
```
A card frame border with rainbow prismatic shifting colors, small diamond motifs at the corners, shimmering iridescent design, [STYLE SUFFIX]
```

### Card Back Design

```
A card back design with an arcane recall symbol — a glowing eye within a book — centered on a dark navy background, ornate border pattern, mysterious and magical feel, pixel art style, 32-bit era, clean hard pixel edges, limited color palette, flat shading, game asset, solid bright green (#00FF00) background
```

### Tier Variants

For Tier 2 and Tier 3 cards, add these modifiers to any card type frame prompt:

**Tier 2 (silver border):**
```
with an additional thin silver metallic border running inside the main frame, subtle silver shimmer accents
```

**Tier 3 (gold border):**
```
with an additional thin gold metallic border running inside the main frame, golden glow accents, small gem inset at the top center
```

---

## 8. DOMAIN ICONS

**Target size:** 64x64 native → 32x32 final

**Style suffix** (append to every domain icon prompt):
```
centered, single simple icon, pixel art style, 32-bit era, clean hard pixel edges, limited to 4-6 colors, strong black outline, flat shading, no gradients, no shadow, no environment, game UI icon asset, 32x32 pixel icon scaled up, solid bright green (#00FF00) background
```

### Domain Icon Prompts

**Science:**
```
A stylized atom icon with three electron orbits around a central nucleus, bright cyan and white, [STYLE SUFFIX]
```

**History:**
```
A stylized ancient scroll icon, partially unrolled, warm parchment tan and brown, [STYLE SUFFIX]
```

**Geography:**
```
A stylized compass icon with cardinal points and a red north needle, silver and red, [STYLE SUFFIX]
```

**Language:**
```
A stylized speech bubble icon with small text lines inside, bright blue and white, [STYLE SUFFIX]
```

**Math:**
```
A stylized pi symbol icon, bold and geometric, deep purple and white, [STYLE SUFFIX]
```

**Arts:**
```
A stylized artist palette icon with colorful paint dabs, warm wood brown with bright color spots, [STYLE SUFFIX]
```

**Medicine:**
```
A stylized medical heart icon with a pulse line across it, red and white, [STYLE SUFFIX]
```

**Technology:**
```
A stylized circuit board icon with trace lines and a central chip, electric green and dark grey, [STYLE SUFFIX]
```

**Locked (unavailable domain):**
```
A stylized padlock icon, closed and heavy, dark iron grey with a keyhole, [STYLE SUFFIX]
```

---

## 9. ROOM DOOR SPRITES

**Target size:** 80x100 native → 40x50 final

**Style suffix** (append to every door sprite prompt):
```
front-facing view, pixel art sprite, 32-bit era JRPG dungeon style, hand-pixeled, clean hard pixel edges, limited color palette, flat shading with no gradients, strong black outline, single door centered, no environment beyond the door frame, game asset, solid bright green (#00FF00) background
```

### Door Type Prompts

**Combat Door:**
```
A heavy iron-banded wooden dungeon door with crossed swords emblem, battle-scarred, imposing and foreboding, red glow seeping from edges, [STYLE SUFFIX]
```

**Mystery Door:**
```
A mysterious stone door covered in glowing runes and question mark symbol, purple arcane glow emanating from cracks, ancient and enigmatic, [STYLE SUFFIX]
```

**Rest Door:**
```
A warm wooden door with a campfire emblem carved into it, soft orange light glowing from underneath, inviting and safe feeling, [STYLE SUFFIX]
```

**Treasure Door:**
```
A gilded ornate door with a treasure chest emblem, golden glow from edges, jewel insets in the frame, rich and rewarding appearance, [STYLE SUFFIX]
```

**Shop Door:**
```
A sturdy merchant's door with a coin/scale emblem, warm lantern light visible through a small window, welcoming commercial feel, [STYLE SUFFIX]
```

**Boss Door:**
```
A massive imposing double door with skull and crown emblem, dark red glow, chains partially broken, ominous and climactic, larger than other doors, [STYLE SUFFIX]
```

---

## 10. PROPS AND OBJECTS

**Style suffix** (append to every prop prompt):
```
front-facing 3/4 angle view, pixel art sprite, 32-bit era JRPG style, hand-pixeled, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single object centered, no environment, no shadow, game asset, solid bright green (#00FF00) background
```

### Prop Prompts

**Treasure Chest** (32x32 → 16x16):
```
A wooden treasure chest with iron banding, slightly open with golden glow from inside, ornate latch, [STYLE SUFFIX]
```

**Campfire** (32x32 → 16x16):
```
A small campfire with stacked logs and bright orange-yellow flames, a few embers floating up, [STYLE SUFFIX]
```

**Anvil** (32x32 → 16x16):
```
A dark iron blacksmith's anvil, heavy and worn, sitting on a wooden stump base, [STYLE SUFFIX]
```

**Merchant Figure** (32x48 → 16x24):
```
A hooded merchant character with a large backpack and dangling wares, friendly posture, mysterious but welcoming, [STYLE SUFFIX]
```

---

## 11. EFFECT / PARTICLE NOTES

### Do NOT Generate with AI

The following assets are too small or too precise for AI generation. Create these manually:

- **Particles** (3-5px): damage numbers, sparkles, combo stars, healing motes, poison bubbles — hand-place individual pixels
- **Small effects** (24-40px): slash marks, shield flashes, buff/debuff icons over enemies — draw in a pixel editor
- **UI elements**: HP bars, AP gems, timer bars, buttons, text backgrounds — build programmatically or draw manually for pixel-perfect alignment
- **Status effect icons** (16x16): poison, burn, stun, weaken, empower — too small and detailed for AI, draw manually
- **Combo counter graphics**: number sprites, multiplier text — use bitmap font or draw manually

### Recommended Tools for Manual Assets

- Aseprite (pixel art editor with animation support)
- Piskel (free, browser-based)
- Programmatic generation via Canvas API for simple geometric shapes (bars, gems, frames)

---

## Cost Estimate — P2 Art Pipeline

| Category | Assets | Images to Generate | Cost/Image | Total Cost |
|---|---|---|---|---|
| Enemy sprites (9 enemies x 3 poses) | 27 | 27 | $0.04 | $1.08 |
| Player character (7 poses) | 7 | 7 | $0.04 | $0.28 |
| Combat backgrounds | 7 | 7 | $0.04 | $0.28 |
| Menu/UI backgrounds | 3 | 3 | $0.04 | $0.12 |
| Room selection backgrounds | 2 | 2 | $0.04 | $0.08 |
| Shop/Rest/Treasure backgrounds | 3 | 3 | $0.04 | $0.12 |
| Card frames (8 types + back) | 9 | 9 | $0.04 | $0.36 |
| Domain icons | 9 | 9 | $0.04 | $0.36 |
| Room door sprites | 6 | 6 | $0.04 | $0.24 |
| Props and objects | 4 | 4 | $0.04 | $0.16 |
| **Total** | **77** | **77** | | **$3.08** |

**P2 scope (prototype-critical only):** ~35-40 images at $0.04 each = ~$1.60

P2 prioritizes: 6 backgrounds (1 combat, 1 title, 1 room selection, 1 rest, 1 shop, 1 treasure), 7 player poses, 6 common enemy sprites (2 enemies x 3 poses), 3 boss sprites (1 boss x 3 poses), 9 card frames, 9 domain icons, 6 room doors. Remaining enemies and backgrounds can be generated in P3.

---

## Appendix: Full Prompt Assembly

To build a complete prompt, concatenate:

1. **Character/object description** (the unique part)
2. **Style suffix** (from the relevant category section above)

Example — full assembled prompt for Cave Bat idle:

```
A large golden pale bat with leathery wings spread wide, flying ominously with sharp fangs visible, full body visible with padding around edges, standing in a neutral pose, pixel art sprite, 32-bit era JRPG style, hand-pixeled, 48x64 pixel character scaled up, clean hard pixel edges, limited color palette, 4-5 colors per material, flat shading with no gradients, strong black outline, single character centered, no ground shadow, no environment, no blur, game asset sprite sheet style, solid bright green (#00FF00) background
```

Submit this as a single string to NB1 via the OpenRouter API. See `docs/IMAGE_GENERATION.md` for the exact request format.
