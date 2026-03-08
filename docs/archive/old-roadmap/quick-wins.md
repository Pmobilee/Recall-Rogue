# Mine Block Overlay Sprite System — TODO

## Phase 0: Art Style Refresh — Cel-Shaded 2D
- [ ] Define cel-shaded art style guide (docs/ART_STYLE_GUIDE.md)
- [ ] Update IMAGE_GENERATION.md prompts to cel-shaded style
- [ ] Update sprite-registry.json prompts for all 347 sprites
- [ ] Delete all existing generated sprites (167 sprites)
- [ ] Regenerate all sprites with cel-shaded style using NB1
- [ ] Generate 5 new dome floor backgrounds
- [ ] Build Decorator machine (place on Floor 0, unlocked)
- [ ] Run gen-sprite-keys.mjs to register new keys
- [ ] Visual verification via Playwright

---

## Context
Special mine blocks have baked-in grey rock backgrounds, breaking biome visual continuity. Switch to layered rendering: biome base tile + transparent overlay icon on top. Generate overlays as 5x5 sprite sheets via NB1, slice programmatically, visually inspect.

---

## Phase A: Data Layer
- [ ] Add `baseTerrainCategory?: 'soil' | 'rock'` to `MineCell` in `src/data/types.ts`
- [ ] Set `baseTerrainCategory` in `src/game/MineGenerator/MinePlacementPasses.ts` when placing special blocks
- [ ] Set `baseTerrainCategory` in `src/game/MineGenerator/MineRoomStamper.ts` when placing special blocks
- [ ] Default to `'rock'` when undefined (backwards compat)
- [ ] Run typecheck

## Phase B: Sheet Generation Script
- [ ] Create `sprite-gen/scripts/generate-overlay-sheets.mjs` with:
  - [ ] Sheet config for 6 categories (see below)
  - [ ] OpenRouter API call (reuse patterns from `generate-sprites.mjs`)
  - [ ] Green screen removal on full sheet
  - [ ] 5x5 grid slicing into individual PNGs
  - [ ] Downscale to 256px (hi-res) and 32px (lo-res)
  - [ ] Output to `public/assets/sprites{-hires}/tiles/overlays/`
  - [ ] CLI flags: `--sheet minerals`, `--all`, `--dry-run`, `--force`

### Sheet Prompt Style

All sheet generation prompts MUST use the cel-shaded style template:
```
cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color,
no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges,
top-left lighting, retro 16-bit game style, visible chunky pixels
```
See `docs/ART_STYLE_GUIDE.md` for full specification.

### 6 Sheets to Generate

**Sheet 1 — Minerals** (5 tiers x 5 variants = 25)
- Row 1: dust — faint sparkle specks peeking through cracks
- Row 2: shard — small crystal tips protruding from surface
- Row 3: crystal — medium crystal cluster in rock fissure
- Row 4: geode — cracked-open cavity with purple/pink glow
- Row 5: essence — radiant golden glow from deep fissures
- Keys: `overlay_mineral_dust_00` → `overlay_mineral_essence_04`

**Sheet 2 — Artifacts & Relics** (5 types x 5 variants = 25)
- Row 1: artifact common — corner of small trinket in crack
- Row 2: artifact uncommon — glowing circuit pattern through fissure
- Row 3: artifact rare+ — bright ancient device partially exposed
- Row 4: relic shrine — golden altar markings, mystical glyphs
- Row 5: recipe fragment — scroll/blueprint edge poking out
- Keys: `overlay_artifact_common_00` → `overlay_recipe_frag_04`

**Sheet 3 — Hazards** (5 types x 5 variants = 25)
- Row 1: lava seep — orange-red glow through hairline cracks
- Row 2: lava intense — bright lava veins through deep fissures
- Row 3: gas wisp — thin green vapor from small holes
- Row 4: gas dense — thick green fog pooling in cracks
- Row 5: unstable ground — tremor lines, shifting fractures
- Keys: `overlay_lava_seep_00` → `overlay_unstable_04`

**Sheet 4 — Collectibles** (5 types x 5 variants = 25)
- Row 1: fossil — bone/shell imprint in rock face
- Row 2: data disc — glowing cyan disc edge in crack
- Row 3: oxygen cache — blue O2 bubbles trapped in cavity
- Row 4: oxygen tank — metal cap/valve through crack
- Row 5: chest — gold corner/latch peeking through fracture
- Keys: `overlay_fossil_00` → `overlay_chest_04`

**Sheet 5 — Structural** (5 types x 5 variants = 25)
- Row 1: exit ladder — metal rungs, light from above
- Row 2: descent shaft — dark hole opening with depth
- Row 3: quiz gate — glowing question mark, golden runes
- Row 4: send-up station — pneumatic tube opening, upward arrow
- Row 5: upgrade crate — wooden/metal corner with gear emblem
- Keys: `overlay_exit_ladder_00` → `overlay_upgrade_crate_04`

**Sheet 6 — Text & Misc** (5 types x 5 variants = 25)
- Row 1: quote stone — faintly carved text on surface
- Row 2: wall text — glowing inscription characters
- Row 3: tablet — stone tablet edge in crack
- Row 4: offering altar — purple glyph, sacrificial bowl rim
- Row 5: locked/challenge — lock icon, barrier runes
- Keys: `overlay_quote_stone_00` → `overlay_locked_04`

## Phase C: Generate & Inspect
- [ ] Run generation for all 6 sheets
- [ ] Visually inspect each raw 5x5 sheet before slicing
- [ ] Slice into individual PNGs (150 total)
- [ ] Run `node scripts/gen-sprite-keys.mjs` to register new keys
- [ ] Visually inspect overlays composited on biome tiles (limestone, basalt, crystal_geode, magma_shelf)
- [ ] Verify transparency, sizing, visual coherence

## Phase D: Renderer Integration
- [ ] Add overlay spec mapping to `src/game/scenes/MineTileRenderer.ts`:
  - BlockType → `{ keyPrefix, variants, scale, alpha }`
  - Importance-based scale: subtle (0.4-0.55) → medium (0.55-0.7) → prominent (0.7-0.85) → full (0.85-1.0)
- [ ] Add variant selection: `(tileX * 7 + tileY * 13) % variants` for deterministic randomness
- [ ] Modify `drawBlockPattern()` for each special block type:
  1. Render biome base tile at depth 5 (using `resolveTileSpriteKey(biome, baseTerrainCategory, tileVariant)`)
  2. Render overlay at depth 5.5 with scale + alpha
  3. Keep shimmer (depth 6) and cracks (depth 7) on top
  4. Fallback to old full-tile sprite if overlay texture missing
- [ ] Run typecheck

## Phase E: Verification
- [ ] Playwright screenshots in 4+ biomes
- [ ] Verify biome texture visible through overlay
- [ ] Verify crack overlays render on top correctly
- [ ] Verify scanner hints and fog of war still work
- [ ] Verify animated overlays still animate
- [ ] Run `npx vitest run`
- [ ] Run `npm run typecheck`

---

## Critical Files
- `src/data/types.ts` — MineCell interface
- `src/game/MineGenerator/MinePlacementPasses.ts` — Set baseTerrainCategory
- `src/game/MineGenerator/MineRoomStamper.ts` — Set baseTerrainCategory
- `src/game/scenes/MineTileRenderer.ts` — Core rendering changes
- `sprite-gen/scripts/generate-overlay-sheets.mjs` — New script
- `sprite-gen/scripts/generate-sprites.mjs` — Pattern to follow

## Cost
6 API calls x $0.04 (NB1) = ~$0.24 total, effective $0.002/sprite
