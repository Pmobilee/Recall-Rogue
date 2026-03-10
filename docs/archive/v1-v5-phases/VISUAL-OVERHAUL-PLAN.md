# Visual & UX Overhaul Plan — Recall Rogue

> **Status**: PLANNING (do not build yet)
> **Last updated**: 2026-03-01
> **Scope**: Dome hub, Mining experience, UI/UX across all screens
> **Priority**: Critical — current state has major quality issues blocking alpha testing

---

## Current State Analysis

### What's Wrong Right Now

#### Dome (Critical Issues)
1. **Sprite quality — 4-up sprite sheets**: `obj_gaia_terminal.png`, `gaia_neutral.png`, `gaia_thinking.png`, and `deco_ceiling_light.png` all show 4 different views in one image instead of a single sprite. Root cause: SDXL prompt didn't specify "single centered object" and the model generated a sprite sheet.
2. **Sprite quality — washed out**: `obj_bookshelf.png` is almost entirely white/grey — rembg stripped too much because the bookshelf was originally light-colored against white background.
3. **Sprite quality — wrong subjects**: `obj_dive_hatch.png` shows a door + floating orbs, not a floor hatch. `interior_wall.png` looks like a control panel split into 3 sections, not a wall tile.
4. **GAIA redundancy**: There's both a "GAIA" floating character rendered on the canvas AND a "GAIA Terminal" interactive object. User confused: "there's GAIA and GAIA TERMINAL?" — need to consolidate into one.
5. **Room panel routing bug**: Clicking ANY dome object opens the panel but ALWAYS shows the Command tab. Root cause: `DomeView.svelte` sets `activeRoom = room` but never passes it to `BaseView.svelte`. BaseView has `let currentRoom = $state<string>('command')` hardcoded with no incoming prop.
6. **Tile textures are not seamlessly tileable**: `dome_glass.png`, `dome_frame.png`, `stone_floor.png` have visible seams when tiled because they were generated as standalone images, not as seamless tiles.
7. **Canvas sizing**: On mobile (400x800), the dome canvas only takes up the top ~40% of the screen, with empty dark space below. The canvas internal resolution is fixed at 768x512 (24*32, 16*32) and doesn't scale to fill viewport.
8. **No visual feedback on tap**: Tapping a dome object does nothing visible — no highlight, no bounce, no tooltip shown before the panel opens.
9. **Sky gradient rendered programmatically**: The sky area above the dome uses a code gradient, but `sky_stars.png` exists (and is beautiful) — it should be used instead.

#### Mining / Digging (Moderate Issues)
10. **13 block types rendered procedurally**: MineralNode, ArtifactNode, DescentShaft, RelicShrine, QuoteStone, SendUpStation, LavaBlock, GasPocket, UnstableGround, OxygenTank, DataDisc, FossilNode — all drawn with canvas lines/shapes each frame instead of PNG sprites. This causes: (a) visual inconsistency with sprite-rendered blocks, (b) per-frame redraw cost, (c) no way to add detail/polish.
11. **No biome-specific tile variants**: All dirt looks the same in Sedimentary/Volcanic/Crystalline biomes. Only `fogTint` color changes, not the actual block sprites.
12. **No block damage visualization**: Mining a 3-hit block shows no visual progress. No cracks, no wear states.
13. **Scanner hints too small**: Gold shimmer dots for minerals are 4-5px — invisible on mobile. Hazard warning triangles are tiny red triangles.
14. **No particle effects on special events**: Finding a relic shrine, oxygen tank, or fossil has no celebration. Breaking a block has basic particles but special discoveries are silent.
15. **Hazard blocks lack animation**: Lava blocks don't pulse/glow. Gas pockets don't bubble. These should have subtle idle animations.

#### UI/UX (Minor-to-Moderate Issues)
16. **Quiz overlay has no animation**: Result appears instantly. Should fade/slide in.
17. **GAIA reactions are static emoji**: Just a text emoji (🤖) + message. Should use the actual GAIA character sprites with expression changes.
18. **21+ screens with no hierarchy**: Navigation is flat. No grouping, no back-button history.
19. **Choice buttons don't show keyboard shortcuts**: Press 1-4 to answer, but buttons don't show these numbers.
20. **Resource bar is text-only**: Just "O2 3 ◆ 0 ◇ 0 ✦ 0" — could use mini pixel art icons.

---

## Part 1: Dome Overhaul

### 1.1 Sprite Regeneration (ALL sprites)

**Resolution**: Generate at 1024x1024 via ComfyUI, downscale to 256px (hi-res) and 32px (lo-res).

**Pipeline for each sprite**:
1. Generate at 1024x1024 with SDXL + pixel-art-xl LoRA (strength 0.85)
2. Remove background with rembg
3. **Visually inspect** with Read tool — reject if 4-up, wrong subject, washed out
4. Downscale to 256px with ImageMagick (`convert -resize 256x256`)
5. Downscale to 32px with ImageMagick (`convert -resize 32x32`)
6. Save to `src/assets/sprites-hires/dome/` and `src/assets/sprites/dome/`

**Sprites to regenerate** (with improved prompts):

| Sprite Key | New Prompt | Notes |
|---|---|---|
| `obj_gaia_terminal` | "single pixel art sci-fi computer terminal with green holographic screen, centered, white background, 16-bit, NOT a sprite sheet" | Was 4-up |
| `gaia_neutral` | "single pixel art cute blue robot character, standing, front view, centered, white background, 16-bit, NOT a sprite sheet" | Was 4-up |
| `gaia_happy` | Keep — this one is actually good (single centered character in blue circle). Just remove the circle border. | OK quality |
| `gaia_thinking` | "single pixel art cute blue robot with hand on chin, thinking pose, centered, white background, 16-bit" | Was 4-up |
| `obj_bookshelf` | "single pixel art dark wooden bookshelf with colorful glowing data tablets, sci-fi, front view, centered, dark background" | Use dark bg to prevent rembg issues, then mask manually |
| `obj_dive_hatch` | "single pixel art glowing trapdoor hatch in metal floor, top-down view, open with yellow light below, centered, white background, 16-bit" | Was wrong subject |
| `interior_wall` | "single pixel art sci-fi metal wall panel tile, dark grey with green indicator lights, seamless tileable, 16-bit" | Was split panel, needs to be tileable |
| `dome_glass` | "single pixel art translucent glass panel tile, cyan tint, seamless tileable, dark background visible through glass, 16-bit" | Needs to be seamlessly tileable |
| `dome_frame` | "single pixel art metal beam tile, dark steel grey, rivets, industrial, seamless tileable horizontal, 16-bit" | Needs seamless tiling |
| `stone_floor` | "single pixel art stone floor tile, grey cobblestone, seamless tileable, top-down view, 16-bit" | Needs seamless tiling |
| `dome_glass_curved` | "single pixel art curved glass dome corner piece, translucent cyan, metal frame edges, 16-bit" | Corner piece |
| `deco_ceiling_light` | "single pixel art hanging ceiling lamp, warm golden glow, industrial sci-fi style, centered, white background, 16-bit" | Was 4-up |
| `deco_wall_monitor` | Keep if acceptable quality, or regenerate: "single pixel art small wall-mounted screen with data display, centered, white background, 16-bit" | Check quality |
| `deco_plant_pot` | Keep — good quality (centered crystal plant in pot) | OK |
| `obj_workbench` | Keep — good quality (wooden workbench with tools) | OK |
| `obj_knowledge_tree` | Keep — good quality (teal crystal tree) | OK |
| `obj_display_case` | Keep — good quality (glass case with crystal) | OK |
| `obj_market_stall` | Keep — good quality (market stand with awning) | OK |
| `obj_farm_plot` | Keep — decent quality (terrarium with plants) | OK |
| `surface_ground` | Keep — good quality (desert landscape with rocks) | OK |
| `sky_stars` | Keep — good quality (night sky with stars) | OK |
| `dirt_ground` | Check quality and regenerate if needed | Tile texture |
| `metal_platform` | Check quality and regenerate if needed | Tile texture |

**New sprites to add**:

| Sprite Key | Prompt | Purpose |
|---|---|---|
| `obj_streak_board` | "single pixel art wooden notice board with flame icon, centered, white background, 16-bit" | Streak panel clickable |
| `obj_locked_silhouette` | "single pixel art mysterious dark covered crate with padlock, centered, white background, 16-bit" | Generic locked room placeholder |
| `gaia_snarky` | "single pixel art cute blue robot with smirk and raised eyebrow, centered, white background, 16-bit" | Snarky mood GAIA |
| `gaia_surprised` | "single pixel art cute blue robot with wide eyes and open mouth, surprised, centered, white background, 16-bit" | Surprised mood GAIA |
| `gaia_calm` | "single pixel art cute blue robot meditating, eyes closed, peaceful, centered, white background, 16-bit" | Calm mood GAIA |

**Verification**: After regeneration, visually inspect EVERY sprite with the Read tool. Take a full-dome screenshot with Playwright. Compare before/after.

### 1.2 Fix GAIA Redundancy

**Decision**: Remove the floating GAIA character from the canvas. Keep only the GAIA Terminal as an interactive object. When you tap the GAIA Terminal, the panel should open to the Command room where GAIA's dialogue is displayed.

**Changes**:
- `DomeCanvas.svelte`: Remove the separate GAIA rendering code (the floating blue robot drawn at col 12, row 7). The GAIA terminal object (`obj_gaia_terminal`) already exists and maps to `room: 'command'`.
- `domeLayout.ts`: Remove the separate `gaia_neutral`/`gaia_happy`/`gaia_thinking` object entries if they exist as placed objects. Keep only the GAIA expression sprites for use in the UI (GaiaToast, QuizOverlay, etc.) — but NOT as canvas objects.
- The GAIA expressions (`gaia_neutral`, `gaia_happy`, etc.) are still used in `GaiaToast.svelte`, `QuizOverlay.svelte`, and BaseView's GAIA card. These are IMG elements in HTML, not canvas objects. They stay.

### 1.3 Fix Room Panel Routing

**Root cause**: `DomeView.svelte` sets `activeRoom` state but never passes it to `BaseView.svelte`.

**Fix** (3 files):

1. **`BaseView.svelte`**: Add `initialRoom` prop to the Props interface:
   ```ts
   interface Props {
     initialRoom?: string  // NEW
     onDive: () => void
     // ... existing props
   }
   ```
   Then in the state initialization:
   ```ts
   let { initialRoom, ...rest }: Props = $props()
   let currentRoom = $state<string>(initialRoom ?? 'command')

   // React to prop changes (when user clicks different dome objects)
   $effect(() => {
     if (initialRoom) {
       currentRoom = initialRoom
     }
   })
   ```

2. **`DomeView.svelte`**: Pass `activeRoom` to BaseView:
   ```svelte
   <BaseView
     initialRoom={activeRoom}
     {onDive}
     {onStudy}
     ...
   />
   ```

3. **`domeLayout.ts`**: Verify all objects have correct `room` values matching BaseView's room identifiers: `'command'`, `'lab'`, `'workshop'`, `'museum'`, `'market'`, `'archive'`.

### 1.4 Improve Canvas Scaling

**Problem**: Internal canvas is fixed at 768x512 (24 tiles * 32px). On tall mobile screens (400x800), this leaves massive empty space below.

**Fix**: Make the canvas responsive:
1. In `DomeCanvas.svelte`, calculate the canvas dimensions based on the container size
2. Scale the internal tile grid to fill available space while maintaining aspect ratio
3. If viewport is portrait (mobile), zoom in on the dome interior and let the sky/underground be cropped
4. If viewport is landscape (desktop), show the full scene

**Implementation approach**:
- Use `ResizeObserver` on the canvas container to get actual pixel dimensions
- Calculate scale factor: `Math.min(containerW / INTERNAL_W, containerH / INTERNAL_H)`
- Apply via CSS `transform: scale(factor)` or redraw at the new resolution
- Ensure hit detection accounts for the scale factor

### 1.5 Add Tap Feedback

When the player taps a dome object:
1. **Highlight**: Draw a white glow/outline around the object for 200ms
2. **Bounce**: Apply a subtle scale-up (1.0 → 1.1 → 1.0) animation over 200ms
3. **Label tooltip**: Show the object's label above it briefly (already partially implemented)
4. **Then**: Open the room panel after the animation

### 1.6 Use sky_stars.png for Background

Replace the programmatic sky gradient in `DomeCanvas.svelte` with the `sky_stars.png` sprite tiled/stretched across the sky region. The sprite is beautiful pixel art and should be showcased.

---

## Part 2: Mining / Digging Overhaul

### 2.1 Generate Missing Block Sprites (13 blocks)

All 13 procedurally-drawn block types need proper PNG sprites. Generate at 1024x1024, downscale.

| Block Type | Sprite Name | Prompt | Notes |
|---|---|---|---|
| MineralNode (dust) | `block_mineral_dust.png` | "single pixel art brown mineral ore node with small golden specks, rocky, centered, white background, 16-bit" | Tier 1 mineral |
| MineralNode (shard) | `block_mineral_shard.png` | "single pixel art blue crystalline shard embedded in rock, glowing, centered, white background, 16-bit" | Tier 2 |
| MineralNode (crystal) | `block_mineral_crystal.png` | "single pixel art large green crystal formation in stone, bright glow, centered, white background, 16-bit" | Tier 3 |
| MineralNode (geode) | `block_mineral_geode.png` | "single pixel art purple cracked geode with sparkling interior, centered, white background, 16-bit" | Tier 4 |
| MineralNode (essence) | `block_mineral_essence.png` | "single pixel art golden glowing ethereal essence orb in stone, radiant, centered, white background, 16-bit" | Tier 5 |
| ArtifactNode | `block_artifact.png` | "single pixel art ancient relic partially buried in dirt, mysterious glow, centered, white background, 16-bit" | |
| DescentShaft | `block_descent_shaft.png` | "single pixel art portal/vortex in stone floor, purple swirling energy, top-down, centered, white background, 16-bit" | |
| RelicShrine | `block_relic_shrine.png` | "single pixel art small golden pedestal shrine with mysterious artifact, centered, white background, 16-bit" | |
| QuoteStone | `block_quote_stone.png` | "single pixel art ancient stone tablet with glowing runes, centered, white background, 16-bit" | |
| SendUpStation | `block_send_up.png` | "single pixel art small teleporter pad with blue beam, sci-fi, centered, white background, 16-bit" | |
| LavaBlock | `block_lava.png` | "single pixel art lava pool tile, orange glowing molten rock, seamless tileable, 16-bit" | Animated (2-3 frames) |
| GasPocket | `block_gas.png` | "single pixel art cracked rock with green toxic gas seeping out, centered, white background, 16-bit" | |
| UnstableGround | `block_unstable.png` | "single pixel art cracked fragile ground tile, brown with cracks and loose pebbles, centered, white background, 16-bit" | |
| OxygenTank | `block_oxygen_tank.png` | "single pixel art cyan oxygen tank embedded in rock wall, sci-fi, centered, white background, 16-bit" | |
| DataDisc | `block_data_disc.png` | "single pixel art glowing cyan data disc embedded in stone, sci-fi holographic, centered, white background, 16-bit" | |
| FossilNode | `block_fossil.png` | "single pixel art dinosaur fossil bone partially exposed in rock, brown and white, centered, white background, 16-bit" | |

**Total: 16 new sprites** (13 block types + 5 mineral tiers - 2 shared = 16)

After generation:
1. Add to `spriteManifest.ts` sprite key list
2. Add to `BootScene.ts` texture loading
3. Update `MineScene.ts` `drawBlockPattern()` to use sprites instead of procedural drawing
4. Remove the procedural drawing code for each block type

### 2.2 Biome Tile Variants

Create 3 color variants for the 4 base tile sprites:

| Base Tile | Sedimentary Variant | Volcanic Variant | Crystalline Variant |
|---|---|---|---|
| `tile_dirt` | (default — earthy brown) | Red/dark orange tint | Light grey/purple tint |
| `tile_soft_rock` | (default — light grey) | Dark red-grey | Blue-grey |
| `tile_stone` | (default — grey) | Charcoal/obsidian | Cyan-grey |
| `tile_hard_rock` | (default — dark grey) | Black/red veins | Dark blue/crystal flecks |

**Implementation**: Instead of generating 12 new sprites, apply color tinting at load time using canvas color manipulation. In `MineScene.ts`, when drawing a tile:
1. Draw the base sprite
2. Apply a biome-specific color overlay (multiply blend or tint)
3. This can be done once at mine-load (pre-render tinted versions) to avoid per-frame cost

### 2.3 Block Damage States

When mining a multi-hit block, show visual damage progression:

1. **Approach**: Overlay a crack sprite on top of the block based on damage %
   - 0-33% damage: no overlay
   - 34-66% damage: `crack_small.png` overlay (few thin cracks)
   - 67-99% damage: `crack_large.png` overlay (heavy cracking, pieces falling)

2. **Sprites needed**: 2 crack overlays (generate transparent PNG crack patterns)
   - `crack_small.png`: thin diagonal cracks
   - `crack_large.png`: heavy cracking with fragments

3. **Code change**: In `MineScene.ts` `drawBlockPattern()`, after drawing the block sprite, check `block.hits / block.maxHits` ratio and overlay the appropriate crack sprite.

### 2.4 Enhanced Scanner Hints

Make scanner hints more visible on mobile:

1. **Mineral hints**: Instead of 4px dots, draw a full-cell shimmer effect — a semi-transparent golden overlay that pulses slowly
2. **Hazard hints**: Instead of tiny red triangles, draw a pulsing red border around the cell edge
3. **Rarity hints**: Instead of colored dots, add a subtle colored glow to the entire fog cell (gold for artifact, cyan for data disc, etc.)

### 2.5 Special Discovery Celebrations

When the player finds a special block for the first time in a dive:

1. **Relic Shrine**: Golden starburst particle effect, 1-second slow-mo, GAIA exclamation
2. **Fossil Node**: Paleontology dust puff, bone reveal animation
3. **Oxygen Tank**: Cyan rings expanding outward, O2 refill sound
4. **Data Disc**: Holographic scan effect, digital glitch particles
5. **Descent Shaft**: Purple vortex swirl animation, gravitational pull effect

Implementation: Add a `celebrateDiscovery(blockType)` function to MineScene that plays type-specific particle animations.

### 2.6 Hazard Idle Animations

Lava and gas blocks should have subtle idle animations:

1. **LavaBlock**: Orange glow that pulses between bright and dim (sine wave on overlay alpha)
2. **GasPocket**: Small green bubble particles that float upward periodically
3. **UnstableGround**: Occasional tiny dust particles falling from cracks

Implementation: In MineScene's `update()` loop, apply time-based effects to visible hazard blocks.

---

## Part 3: UI/UX Overhaul

### 3.1 Quiz Overlay Polish

1. **Entry animation**: Fade in backdrop (0→85% opacity over 300ms) + slide up quiz card from bottom
2. **Choice reveal**: Stagger choice buttons appearing (50ms delay between each)
3. **Result animation**: Correct = green pulse + checkmark icon. Wrong = red shake + X icon.
4. **GAIA reaction**: Replace static emoji with actual GAIA sprite image (`gaia_happy.png` for correct, `gaia_thinking.png` for wrong, `gaia_surprised.png` for consistency penalty)
5. **Number key badges**: Show small "1", "2", "3", "4" badges on the left edge of each choice button
6. **Memory tip**: Style as a distinct card below the result (yellow border, lightbulb icon, "Memory Tip" header)

### 3.2 GAIA Sprite Integration in UI

Replace all emoji GAIA representations with actual sprite images:

| Location | Current | New |
|---|---|---|
| `GaiaToast.svelte` | Emoji (🤖) | `<img src={gaiaSprite}>` |
| `BaseView.svelte` GAIA card | Red robot emoji (🤖) | `<img>` with expression-based sprite |
| `QuizOverlay.svelte` | Emoji reaction | `<img>` with expression-based sprite |
| `FactReveal.svelte` | Emoji | `<img>` with expression-based sprite |

Use `gaiaAvatar.ts` to resolve expression → sprite URL. The sprites already exist in `sprites/dome/gaia_*.png`, just need to be used as `<img>` elements in the Svelte components.

### 3.3 Resource Bar Icons

Replace text-based resource indicators with mini pixel art icons:

| Resource | Current | New |
|---|---|---|
| Oxygen | "O2" text | Tiny blue oxygen tank icon (8x12px inline) |
| Dust | "◆" | Tiny brown dust pile icon |
| Shard | "◇" | Tiny blue crystal icon |
| Crystal | "✦" | Tiny green crystal icon |
| Streak | "🔥" | Tiny flame icon (pixel art style) |

Generate these as a single sprite sheet or individual tiny PNGs.

### 3.4 Screen Navigation Improvements

1. **Back button support**: Add a navigation history stack in a store. Each screen push adds to stack, back button pops.
2. **Screen grouping**: Group screens into categories:
   - **Hub**: dome, base
   - **Mining**: divePrepScreen, mining, backpack, runStats
   - **Learning**: quiz, factReveal, studySession, knowledgeTree
   - **Collection**: fossilGallery, zoo, farm
   - **Economy**: materializer, premiumMaterializer, cosmeticsShop, knowledgeStore
   - **Meta**: settings, streakPanel, diveResults
3. **Transition animations**: Add slide transitions between screen groups (left/right for lateral moves, up/down for hub→sub-screen)

### 3.5 Mobile Responsiveness Pass

1. **Font sizes**: Minimum 14px for body text, 16px for interactive elements
2. **Touch targets**: Minimum 44x44px for all buttons
3. **Safe areas**: Respect `env(safe-area-inset-*)` for notch/home-bar phones
4. **Scrolling**: All panels must have momentum scrolling (`-webkit-overflow-scrolling: touch`)
5. **Viewport**: Test at 375x667 (iPhone SE), 375x812 (iPhone X), 390x844 (iPhone 14), 412x915 (Pixel 7)

---

## Part 4: Technical Debt & Architecture

### 4.1 BaseView Decomposition

BaseView.svelte is ~2200 lines and does everything. Extract room content into sub-components:

| New Component | Lines from BaseView | Content |
|---|---|---|
| `rooms/CommandRoom.svelte` | ~200 | GAIA card, stats, dive button, resources |
| `rooms/LabRoom.svelte` | ~150 | Ritual banner, study button, knowledge store link |
| `rooms/WorkshopRoom.svelte` | ~120 | Minerals, materializer, converter |
| `rooms/MuseumRoom.svelte` | ~100 | Fossils, gallery, zoo links |
| `rooms/MarketRoom.svelte` | ~150 | Cosmetics, farm, daily deals |
| `rooms/ArchiveRoom.svelte` | ~150 | Knowledge tree, facts list, data discs |

BaseView becomes a thin shell: tab bar + router that renders the active room component.

### 4.2 GameManager Decomposition

GameManager.ts is 2000+ lines. Split into focused systems:

| New Module | Responsibility |
|---|---|
| `QuizManager.ts` | Quiz triggering, answer processing, penalties |
| `HazardManager.ts` | Lava/gas/unstable/earthquake handling |
| `DiscoveryManager.ts` | Block discovery rewards, celebrations |
| `CompanionManager.ts` | Pet companion effects during dives |
| `RelicManager.ts` | Relic collection, synergy activation |

Each manager is a class that GameManager instantiates and delegates to.

### 4.3 Sprite Caching for Procedural Blocks

Even after converting to PNG sprites, pre-render biome-tinted versions at mine-load time:

1. For each visible block type, create a tinted version on an offscreen canvas
2. Cache the tinted canvas as an ImageBitmap
3. Draw from cache instead of applying tint every frame
4. Invalidate cache only on biome change (descent shaft)

---

## Execution Order

### Phase A: Sprite Quality (Priority 1 — blocks alpha testing)
1. Regenerate all broken dome sprites (8-10 sprites at 1024x1024)
2. Visually inspect each one
3. Generate 16 mining block sprites
4. Visually inspect each one
5. Update sprite manifests and loading code
6. Screenshot verify dome + mine

### Phase B: Bug Fixes (Priority 1)
7. Fix room panel routing (pass initialRoom prop)
8. Fix GAIA redundancy (remove floating GAIA from canvas)
9. Fix canvas scaling for mobile viewports

### Phase C: Mining Visual Polish (Priority 2)
10. Wire new block sprites into MineScene.drawBlockPattern()
11. Add biome tinting system
12. Add crack overlay damage states
13. Enhance scanner hints
14. Add hazard idle animations

### Phase D: UI Polish (Priority 2)
15. Quiz overlay animations
16. GAIA sprite integration across all UI
17. Resource bar pixel art icons
18. Tap feedback on dome objects

### Phase E: Architecture Cleanup (Priority 3)
19. Extract BaseView room components
20. Split GameManager into focused managers
21. Add screen navigation history stack
22. Mobile responsiveness pass

---

## Verification Checklist

After each phase, verify:
- [ ] `npx tsc --noEmit -p tsconfig.app.json` — zero errors
- [ ] `npm run build` — production build succeeds
- [ ] Playwright screenshots of all changed screens
- [ ] Visual inspection of every new/changed sprite
- [ ] Mobile viewport test (375x812)
- [ ] All 13 callback props still work (dive, study, materializer, etc.)

---

## Estimated Sprite Count

| Category | Count |
|---|---|
| Dome sprites (regenerated) | 10 |
| Dome sprites (new) | 5 |
| Mining block sprites | 16 |
| Crack overlays | 2 |
| Resource bar icons | 5 |
| **Total new sprites** | **38** |

All generated at 1024x1024 → downscaled to 256px and 32px.

---

## Notes

- **DO NOT** delete BaseView.svelte yet — keep as fallback until DomeView is stable
- **DO NOT** change game mechanics — this is a visual/UX overhaul only
- **DO NOT** add new game systems — focus on polishing existing ones
- All sprite generation uses the pipeline documented in `memory/comfyui-pixel-art.md`
- All sprites MUST be visually inspected with the Read tool before committing
- Generate at 1024x1024 for maximum quality (SDXL sweet spot for detail)
