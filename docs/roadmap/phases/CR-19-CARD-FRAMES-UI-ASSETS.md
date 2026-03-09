# CR-19: Card Frames + UI Assets

## Summary

**Phase:** P2 — Art Pipeline + First Asset Pass
**Priority:** HIGH
**Depends on:** CR-14 (NB1 art pipeline)
**Estimated scope:** M

Generate card frame sprites (8 card types + card back + echo), domain icon sprites (9 icons), and room door sprites (6 door types). These are the UI-facing visual assets that replace colored rectangles and text-only placeholders throughout the game. Total: 25 sprites across 3 categories.

---

## Design Reference

**Card types** (from `src/data/card-types.ts`):
```typescript
export type CardType = 'attack' | 'shield' | 'heal' | 'utility' | 'buff' | 'debuff' | 'regen' | 'wild';
```

**Domains** (from `src/data/card-types.ts`):
```typescript
export type FactDomain = 'science' | 'history' | 'geography' | 'language' | 'math' | 'arts' | 'medicine' | 'technology';
```

**Card dimensions** (from CLAUDE.md): 65x95dp collapsed, 300x350dp expanded, 48dp min touch targets.

**Room types** (from `src/services/floorManager.ts`): `'combat' | 'mystery' | 'rest' | 'treasure' | 'shop' | 'boss'`

**Tier border variants** (handled in code, not separate sprites):
- Tier 1: base frame (no modification)
- Tier 2a/2b: silver glow overlay (CSS/shader)
- Tier 3: gold glow overlay (CSS/shader)

---

## Implementation

### PART A: Card Frames (10 sprites)

**Card Frame Style Suffix:**
```
centered, pixel art game card frame template, ornate rectangular border with rounded corners, empty center area for text content, decorative corner flourishes, 32-bit era JRPG style, clean pixel edges, limited color palette, strong border lines, no text, no characters, no icons inside the frame, game UI asset, flat design, solid bright green (#00FF00) background
```

**8 Type-Colored Frames:**

| Card Type | Color Direction (prepend to suffix) | Filename |
|-----------|-------------------------------------|----------|
| Attack | "Red-orange toned ornate border" | `frame_attack.png` |
| Shield | "Blue-steel toned ornate border" | `frame_shield.png` |
| Heal | "Green toned ornate border" | `frame_heal.png` |
| Utility | "Teal-cyan toned ornate border" | `frame_utility.png` |
| Buff | "Purple toned ornate border" | `frame_buff.png` |
| Debuff | "Dark indigo toned ornate border" | `frame_debuff.png` |
| Regen | "Pink-white toned ornate border" | `frame_regen.png` |
| Wild | "Rainbow prismatic toned ornate border" | `frame_wild.png` |

**1 Card Back:**
- Prompt: "An ornate mystical card back design with an arcane recall symbol, dark blue and gold colors, pixel art game card back" + style suffix
- Filename: `card_back.png`

**1 Echo Card Frame Variant:**
- Prompt: "A ghostly translucent card frame with ethereal blue-purple wisps, dashed border style, pixel art game card frame, haunted appearance" + style suffix
- Filename: `frame_echo.png`

**Card Frame Dimensions:** 75x100 virtual pixels. Generate at native resolution, then: green screen removal, auto-crop, nearest-neighbor resize to 150x200 (2x). Also save 75x100 (1x).

**Visual Inspection for Card Frames:**
1. Display all 10 frames in a grid at 65x95dp (collapsed card size)
2. Verify: each type's color is distinct and identifiable at small size
3. Verify: frames have clear empty center for text/content overlay
4. Verify: frames look good on dark background (#0D1117)
5. Test card_back.png at collapsed size — must be attractive and recognizable

### PART B: Domain Icons (9 sprites)

**Domain Icon Style Suffix:**
```
centered, single simple icon, pixel art style, 32-bit era, clean hard pixel edges, limited to 4-6 colors, strong black outline, flat shading, no gradients, no shadow, no environment, game UI icon asset, 32x32 pixel icon scaled up, solid bright green (#00FF00) background
```

**9 Icons:**

| Domain | Prompt | Filename |
|--------|--------|----------|
| Science | "A stylized atom symbol with orbiting electrons" | `icon_science.png` |
| History | "An ancient scroll or classical column" | `icon_history.png` |
| Geography | "A compass rose or small globe" | `icon_geography.png` |
| Language | "A speech bubble with small characters inside" | `icon_language.png` |
| Math | "A pi symbol or small abacus" | `icon_math.png` |
| Arts | "A painter's palette with colorful paint dots" | `icon_arts.png` |
| Medicine | "A medical heart with pulse line" | `icon_medicine.png` |
| Technology | "A circuit board or microchip" | `icon_technology.png` |
| Locked | "A locked padlock, gray tones" | `icon_locked.png` |

**Domain Icon Dimensions:** 32x32 virtual pixels. Generate at native resolution, then: green screen removal, auto-crop, nearest-neighbor resize to 64x64 (2x). Also save 32x32 (1x).

**Visual Inspection for Icons:**
1. Display all 9 icons in a row at 32x32
2. Verify: each icon is recognizable at 32px
3. Verify: icons are visually distinct from each other
4. Verify: clean edges, no fringing

### PART C: Room Door Sprites (6 sprites)

**Room Door Style Suffix:**
```
centered, single doorway or entrance viewed from front, pixel art sprite, 32-bit era JRPG dungeon style, clean hard pixel edges, limited color palette, strong outlines, no characters, no creatures, flat shading, game asset, 40x50 pixel door scaled up, solid bright green (#00FF00) background
```

**6 Doors:**

| Room Type | Prompt | Filename |
|-----------|--------|----------|
| Combat | "A stone archway entrance with a red glow and crossed sword emblem" | `door_combat.png` |
| Mystery | "A mysterious dark doorway with a glowing question mark" | `door_mystery.png` |
| Rest | "A warm lit entrance with campfire glow visible inside" | `door_rest.png` |
| Treasure | "A golden ornate doorway with a treasure chest visible inside" | `door_treasure.png` |
| Shop | "A wooden door with a hanging lantern and merchant sign" | `door_shop.png` |
| Boss | "A large imposing gate with skull emblem and red glow" | `door_boss.png` |

**Room Door Dimensions:** 40x50 virtual pixels. Generate at native resolution, then: green screen removal, auto-crop, nearest-neighbor resize to 80x100 (2x). Also save 40x50 (1x).

**Visual Inspection for Doors:**
1. Display all 6 doors side by side
2. Verify: each door type clearly communicates its room type
3. Verify: doors readable at 40x50 (1x)
4. Test in RoomSelection.svelte by replacing text-based room cards

### System Interactions

- **CR-14 (NB1 art pipeline):** All generation uses the pipeline established in CR-14 (ComfyUI workflows, green screen removal, auto-crop, resize).
- **sprite-gen/arcane-prompts.json:** All 25 prompt entries added here following the existing schema.
- **sprite-gen/sprite-registry.json:** All 25 assets registered with metadata (dimensions, category, filename).
- **CR-20 (Asset Integration):** CR-20 consumes these sprites and wires them into the UI. CR-19 generates only; CR-20 integrates.

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Heal frame (green) conflicts with green screen | Use distinct green (#00CC44) in prompt, different from chroma key green (#00FF00) |
| Card frame center not empty enough for text | Regenerate with "large empty center area, border only around edges" |
| Domain icons too detailed at 32px | Regenerate with simpler shapes, fewer details |
| Door types look too similar | Add more distinct visual cues (color, emblems, lighting) |
| Rainbow frame (wild) too busy | Regenerate with "subtle prismatic shimmer" not full rainbow |
| Echo frame not ghostly enough | Increase emphasis: "very translucent, ethereal, spirit-like" |

---

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `sprite-gen/arcane-prompts.json` | Add 25 UI asset entries |
| Create | `public/assets/sprites/cards/frame_attack.png` | Attack card frame |
| Create | `public/assets/sprites/cards/frame_shield.png` | Shield card frame |
| Create | `public/assets/sprites/cards/frame_heal.png` | Heal card frame |
| Create | `public/assets/sprites/cards/frame_utility.png` | Utility card frame |
| Create | `public/assets/sprites/cards/frame_buff.png` | Buff card frame |
| Create | `public/assets/sprites/cards/frame_debuff.png` | Debuff card frame |
| Create | `public/assets/sprites/cards/frame_regen.png` | Regen card frame |
| Create | `public/assets/sprites/cards/frame_wild.png` | Wild card frame |
| Create | `public/assets/sprites/cards/card_back.png` | Card back |
| Create | `public/assets/sprites/cards/frame_echo.png` | Echo card frame |
| Create | `public/assets/sprites/icons/icon_science.png` | Science domain icon |
| Create | `public/assets/sprites/icons/icon_history.png` | History domain icon |
| Create | `public/assets/sprites/icons/icon_geography.png` | Geography domain icon |
| Create | `public/assets/sprites/icons/icon_language.png` | Language domain icon |
| Create | `public/assets/sprites/icons/icon_math.png` | Math domain icon |
| Create | `public/assets/sprites/icons/icon_arts.png` | Arts domain icon |
| Create | `public/assets/sprites/icons/icon_medicine.png` | Medicine domain icon |
| Create | `public/assets/sprites/icons/icon_technology.png` | Technology domain icon |
| Create | `public/assets/sprites/icons/icon_locked.png` | Locked domain icon |
| Create | `public/assets/sprites/doors/door_combat.png` | Combat room door |
| Create | `public/assets/sprites/doors/door_mystery.png` | Mystery room door |
| Create | `public/assets/sprites/doors/door_rest.png` | Rest room door |
| Create | `public/assets/sprites/doors/door_treasure.png` | Treasure room door |
| Create | `public/assets/sprites/doors/door_shop.png` | Shop room door |
| Create | `public/assets/sprites/doors/door_boss.png` | Boss room door |
| Modify | `sprite-gen/sprite-registry.json` | Register all 25 assets |

---

## Done When

- [ ] 10 card frames generated (8 types + back + echo)
- [ ] Each card type frame has distinct, identifiable color
- [ ] Card frames have clear empty center for text overlay
- [ ] Card frames look correct at 65x95dp collapsed size
- [ ] Card back is attractive and recognizable at small size
- [ ] Echo frame looks ghostly/translucent
- [ ] 9 domain icons generated and recognizable at 32x32
- [ ] 6 room door sprites generated and distinct per room type
- [ ] All green screens cleanly removed
- [ ] All 25 assets registered in sprite-registry.json
- [ ] Playwright screenshots taken for all 3 categories at target sizes
- [ ] All assets display correctly on dark (#0D1117) background
