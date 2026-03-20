# AR-110: Per-Enemy Dual-Size Backgrounds

## Overview

Replace the generic segment-based combat background pools with **unique backgrounds per enemy**, each reflecting that enemy's lore and identity. Every background ships in two aspect ratios:

- **Portrait (9:16)** — for phone/mobile play
- **Landscape (16:9, 1920x1080)** — for desktop/tablet play

Both versions are stretched to fill the viewport on varying device sizes. The runtime detects orientation and loads the appropriate version.

**Scope:** 88 enemies x 2 sizes = 176 combat backgrounds, plus ~30 room/screen backgrounds in dual sizes. Camp background is EXCLUDED (kept as-is).

**Dependencies:** Art Studio (`localhost:5175/artstudio.html`) via OpenRouter (Gemini Flash image gen)
**Complexity:** High (mostly asset generation volume + manifest/loading refactor)

---

## Sub-steps

### 1. Refactor `backgroundManifest.ts` for per-enemy combat backgrounds

**Current:** `getRandomCombatBg(floor, isBoss)` picks from segment pools.
**New:** `getCombatBgForEnemy(enemyId: string)` returns the path for that enemy's background, auto-selecting portrait or landscape based on current viewport.

- [ ] 1.1 Add `getCombatBgForEnemy(enemyId: string): string` that returns:
  - Portrait: `/assets/backgrounds/combat/enemies/{enemyId}/portrait.webp`
  - Landscape: `/assets/backgrounds/combat/enemies/{enemyId}/landscape.webp`
  - Selection based on `window.innerWidth / window.innerHeight` ratio (< 1 = portrait, >= 1 = landscape)
- [ ] 1.2 Keep `getRandomCombatBg()` as fallback for any enemy whose background hasn't been generated yet (graceful degradation)
- [ ] 1.3 Update room background pools to use dual-size pattern: `{roomType}/portrait.webp` and `{roomType}/landscape.webp` (one per room type, not 5 random variants)
- [ ] 1.4 Update screen backgrounds (defeat, victory) to dual-size pattern

**Files:** `src/data/backgroundManifest.ts`

**Acceptance:** TypeScript compiles. `getCombatBgForEnemy('cave_bat')` returns correct path. Fallback works for missing enemies.

### 2. Update CombatScene to pass enemy ID for background selection

**Current:** `setBackground(floor, isBoss)` in CombatScene.
**New:** `setBackground(floor, isBoss, enemyId)` — uses enemy ID to pick the per-enemy background.

- [ ] 2.1 Update `CombatScene.setBackground()` signature to accept optional `enemyId` parameter
- [ ] 2.2 When `enemyId` is provided, call `getCombatBgForEnemy(enemyId)` instead of `getRandomCombatBg()`
- [ ] 2.3 Update `encounterBridge.ts` to pass the current enemy's ID to `setBackground()`
- [ ] 2.4 Keep landscape/portrait swap logic in `_swapBackground()` — the cover-scale approach already works

**Files:** `src/game/scenes/CombatScene.ts`, `src/services/encounterBridge.ts`

**Acceptance:** Combat loads the correct per-enemy background. Fallback to segment pool if enemy bg missing.

### 3. Update Svelte room components for dual-size backgrounds

- [ ] 3.1 Update all room overlay components to detect orientation and load appropriate size:
  - `MysteryEventOverlay.svelte`
  - `CardRewardScreen.svelte`
  - `RestRoomOverlay.svelte`
  - `ShopRoomOverlay.svelte`
  - `RoomSelection.svelte`
  - `RetreatOrDelve.svelte`
  - `RunEndScreen.svelte`
- [ ] 3.2 Each component calls updated `getRandomRoomBg()` / `getRandomScreenBg()` which auto-selects size

**Files:** All room/screen Svelte overlays

**Acceptance:** Room screens show correct aspect ratio background for device orientation.

### 4. Add `backgrounds` category to Art Studio

The artstudio (`sprite-gen/cardback-tool/`) already supports OpenRouter image generation with categories. Add a `backgrounds` category with sub-types for portrait (9:16) and landscape (16:9).

- [ ] 4.1 Add `'backgrounds'` to `ARTSTUDIO_CATEGORIES` in `server.mjs`
- [ ] 4.2 Add `backgrounds: []` to initial state in `readArtStudioItems()`
- [ ] 4.3 Populate `artstudio-items.json` with 88 enemy background items (portrait + landscape each = 176 items), plus room/screen backgrounds
- [ ] 4.4 Each item's prompt must describe a dungeon room matching the enemy's lore, with clear center area, memorable details, consistent pixel art style
- [ ] 4.5 Portrait items: 576x1024 (9:16), Landscape items: 1024x576 (16:9)

**Naming convention:**
- Enemy portrait: `bg-{enemyId}-portrait` (e.g., `bg-cave_bat-portrait`)
- Enemy landscape: `bg-{enemyId}-landscape` (e.g., `bg-cave_bat-landscape`)
- Room portrait: `bg-room-{type}-portrait` (e.g., `bg-room-hallway-portrait`)
- Room landscape: `bg-room-{type}-landscape`

**Files:** `sprite-gen/cardback-tool/server.mjs`, `sprite-gen/cardback-tool/artstudio-items.json`

**Acceptance:** All 88 enemies + room/screen backgrounds appear in artstudio under the `backgrounds` category. Generation via OpenRouter works for both sizes.

### 5. Generate all backgrounds via Art Studio

Use the artstudio UI at `localhost:5175/artstudio.html` to batch-generate:

- [ ] 5.1 All 88 enemy portrait backgrounds (576x1024)
- [ ] 5.2 All 88 enemy landscape backgrounds (1024x576)
- [ ] 5.3 Room backgrounds (7 types x 2 sizes = 14)
- [ ] 5.4 Screen backgrounds (defeat, victory x 2 sizes = 4)
- [ ] 5.5 Menu title background (2 sizes = 2)
- [ ] 5.6 Accept best variants, export to `public/assets/backgrounds/`

**Output structure:**
```
public/assets/backgrounds/combat/enemies/
  cave_bat/portrait.webp, cave_bat/landscape.webp
  crystal_golem/portrait.webp, crystal_golem/landscape.webp
  ... (88 directories)
public/assets/backgrounds/rooms/
  hallway/portrait.webp, hallway/landscape.webp
  ... (7 room types)
public/assets/backgrounds/screens/
  defeat/portrait.webp, defeat/landscape.webp
  victory/portrait.webp, victory/landscape.webp
public/assets/backgrounds/menu/
  title/portrait.webp, title/landscape.webp
```

**Acceptance:** All backgrounds generated, accepted, and exported. Camp background untouched.

### 7. Clean up old background assets

- [ ] 7.1 Remove old segment pool directories (`segment1/` through `segment5/`, `boss/`)
- [ ] 7.2 Remove old room pool directories (the numbered variants like `hallway-01.webp` etc.)
- [ ] 7.3 Remove old `bg_combat_dungeon.png/webp`, `bg_menu_title.png/webp`, etc.
- [ ] 7.4 Update any remaining references to old paths

**Acceptance:** No dead asset references. Build succeeds. No 404s at runtime.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] All 88 enemy directories have portrait.webp + landscape.webp
- [ ] All room/screen backgrounds have portrait.webp + landscape.webp
- [ ] Camp background unchanged
- [ ] Playwright visual test: combat loads correct per-enemy background
- [ ] Playwright visual test: room screens load correct dual-size backgrounds
- [ ] No console 404 errors for missing backgrounds
- [ ] Cover-scale stretching works correctly on both portrait and landscape viewports
