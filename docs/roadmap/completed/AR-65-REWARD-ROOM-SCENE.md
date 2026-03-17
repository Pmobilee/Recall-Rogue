# AR-65: Reward Room — Phaser Scene with Loot Interaction

## Overview
Complete overhaul of the post-encounter reward experience. Replaces the current Svelte-only card altar screen with a full Phaser scene featuring a dungeon loot room with interactive items on a cloth-draped boulder, ambient firefly particles, and tap-to-collect interactions for gold, health vials, cards, and relics.

**Goals:**
1. Preprocess source assets into game-ready sprites + JSON metadata (zero runtime image processing)
2. Build a new `RewardRoomScene` in Phaser with the dungeon background, cloth spawn system, and ambient VFX
3. Implement tap-to-collect interactions for gold, health vials, cards, and relics
4. Add atmospheric firefly particles with depth/parallax near the light rays
5. Wire into existing game flow (replaces `CardRewardScreen.svelte` altar)

**Dependencies:** None — new scene, additive
**Complexity:** Large (multi-phase: preprocessing + scene + interactions + VFX + integration)

## Source Assets

All source files live at `data/generated/reward_room/`:

| File | Dimensions | Description |
|------|-----------|-------------|
| `Reward_room_Background.png` | 1536×2752 | Full dungeon scene — boulder with cloth, light rays, cobblestone, plants |
| `Cloth Area.png` | 1536×2752 | Isolated cloth on white bg — same dimensions as background, used as spawn mask |
| `Gold-sheet.png` | 2528×1696 | 3×2 sprite sheet of gold/treasure piles (tier 0–5, small coins to treasure hoard) |
| `small health vial.png` | 512×512 | Round potion bottle, red liquid, cork top |
| `larger health flash.png` | 512×512 | Ornate flask, red liquid, gold-banded neck |

---

## Phase 1: Asset Preprocessing (Node Scripts — Run Once)

All preprocessing outputs go to `public/assets/reward_room/`. Zero runtime image processing on mobile.

### 1A: Slice & Auto-Crop Gold Sprite Sheet
- **Input:** `data/generated/reward_room/Gold-sheet.png` (2528×1696, 3 cols × 2 rows)
- **Process:**
  - Slice into 6 frames (left-to-right, top-to-bottom → tiers 0–5)
  - Auto-crop each frame to tight pixel bounds (trim fully-transparent rows/columns)
  - Resize each tier proportionally for game use (nearest-neighbor, no anti-aliasing):
    - Tier 0 (few coins): ~32×32 target
    - Tier 1 (small pile): ~38×38
    - Tier 2 (medium pile): ~44×44
    - Tier 3 (large pile): ~50×50
    - Tier 4 (treasure + trophy): ~58×58
    - Tier 5 (hoard + crown): ~64×64
  - Save: `public/assets/reward_room/gold_tier_0.png` through `gold_tier_5.png`
- **Output JSON:** `public/assets/reward_room/gold_tiers.json`
  ```json
  {
    "tiers": [
      { "tier": 0, "file": "gold_tier_0.png", "width": 32, "height": 28, "minGold": 1, "maxGold": 10 },
      { "tier": 1, "file": "gold_tier_1.png", "width": 38, "height": 33, "minGold": 11, "maxGold": 30 },
      { "tier": 2, "file": "gold_tier_2.png", "width": 44, "height": 38, "minGold": 31, "maxGold": 60 },
      { "tier": 3, "file": "gold_tier_3.png", "width": 50, "height": 44, "minGold": 61, "maxGold": 100 },
      { "tier": 4, "file": "gold_tier_4.png", "width": 58, "height": 50, "minGold": 101, "maxGold": 200 },
      { "tier": 5, "file": "gold_tier_5.png", "width": 64, "height": 56, "minGold": 201, "maxGold": null }
    ]
  }
  ```
  (Use actual measured dimensions after crop+resize)
- **Acceptance:** 6 individual PNGs, tight crops, correct tier sizing, JSON sidecar with real dimensions

### 1B: Compute Cloth Spawn Zone
- **Input:** `data/generated/reward_room/Cloth Area.png` (1536×2752)
- **Process:**
  - Read all pixel data
  - Any pixel with brightness < 240 (not white/near-white) = valid cloth area
  - Compute bounding box of cloth region (minX, minY, maxX, maxY)
  - Compute simplified convex hull polygon (array of {x, y} vertices)
  - Sample valid spawn points on a regular grid (every 10px) within the cloth, keeping only points that pass brightness check
  - Store coordinates normalized to background dimensions (1536×2752)
- **Output:** `public/assets/reward_room/cloth_spawn_zone.json`
  ```json
  {
    "bounds": { "minX": 180, "minY": 850, "maxX": 1350, "maxY": 1650 },
    "polygon": [ {"x": 200, "y": 870}, {"x": 1340, "y": 860}, ... ],
    "spawnGrid": [ {"x": 200, "y": 860}, {"x": 210, "y": 860}, ... ],
    "maskWidth": 1536,
    "maskHeight": 2752
  }
  ```
  (Values are examples — use actual computed data)
- **Acceptance:** JSON has reasonable bounding box (cloth is in the middle-upper area of the image), polygon has 8+ vertices, spawnGrid has 100+ points, no points outside cloth area

### 1C: Trim & Resize Health Vial Sprites
- **Input:** `data/generated/reward_room/small health vial.png` and `larger health flash.png` (both 512×512)
- **Process:**
  - Auto-crop each to tight pixel bounds
  - Resize to game-appropriate size: small vial ~48×48, large vial ~56×64 (keep aspect ratio, nearest-neighbor)
- **Output:**
  - `public/assets/reward_room/health_vial_small.png`
  - `public/assets/reward_room/health_vial_large.png`
- **Acceptance:** Crisp pixel art at game resolution, tight crops, no blurring

### 1D: Resize Background for Mobile
- **Input:** `data/generated/reward_room/Reward_room_Background.png` (1536×2752)
- **Process:**
  - The source is already at ~mobile resolution (1536 wide). If needed, create a WebP version for faster loading
  - Copy or convert to `public/assets/reward_room/reward_room_bg.webp` (quality 90)
  - Also keep a PNG fallback: `public/assets/reward_room/reward_room_bg.png`
- **Acceptance:** Background loads cleanly, fits mobile viewport when scaled

### 1E: Preprocessing Validation
- Print summary table: every output file with final dimensions
- Confirm cloth polygon is reasonable (not empty, not entire image)
- Confirm gold tiers are visually distinct at their target sizes
- Flag issues: mask all white, sprite sheet not evenly divisible, any frame entirely transparent

---

## Phase 2: SpawnPointService

### 2A: Create SpawnPointService
- **File:** `src/services/rewardSpawnService.ts`
- **What:**
  - Loads `cloth_spawn_zone.json` at init
  - Exposes `getLayoutPositions(count: number, padding: number): {x: number, y: number}[]`
  - Layout logic based on item count:
    - 1 item: center of bounding box
    - 2 items: side by side, horizontally centered
    - 3 items: evenly spaced row
    - 4 items: 2×2 grid, centered
    - 5 items: 3 top + 2 bottom (pyramid)
    - 6 items: 3×2 grid
  - Each ideal position snaps to nearest point in `spawnGrid` (guarantees on-cloth placement)
  - Adds ±4–8px random jitter per item for organic feel
  - Enforces minimum 48px between any two items
  - All coordinates scaled from mask dimensions (1536×2752) to actual scene dimensions
- **Acceptance:** Positions always land on the cloth, proper spacing, deterministic with seed

---

## Phase 3: RewardRoomScene (Phaser)

### 3A: Scene Setup & Background
- **File:** `src/game/scenes/RewardRoomScene.ts`
- **What:**
  - New Phaser scene registered as `'RewardRoom'`
  - Preloads: background, gold tier PNGs, health vial PNGs, cloth_spawn_zone.json, gold_tiers.json
  - Displays `reward_room_bg` scaled to fill the game viewport (maintain aspect ratio, letterbox if needed)
  - Scene receives reward data on start:
    ```ts
    interface RewardRoomData {
      rewards: RewardItem[]
      goldEarned: number
      comboBonus: number
      healAmount: number
    }
    type RewardItem =
      | { type: 'card'; card: Card }
      | { type: 'gold'; amount: number }
      | { type: 'relic'; relic: RelicDefinition }
      | { type: 'health_vial'; size: 'small' | 'large'; healPercent: number }
    ```
- **Acceptance:** Background renders correctly, scene receives data, no console errors

### 3B: Firefly Particle System
- **File:** `src/game/scenes/RewardRoomScene.ts` (within scene create)
- **What:**
  - Ambient firefly particles near the top of the scene where the light rays fall
  - Spawn zone: upper 40% of the scene, concentrated around the light cone (roughly center-top)
  - 8–15 fireflies active at any time
  - Each firefly:
    - Tiny circle (2–4px radius), warm yellow-green color (#d4e157 to #fff176), alpha 0.4–0.8
    - Gentle wandering motion: randomized sine-wave path, speed 0.3–0.8px per frame
    - Fade in over 600ms, live for 3–8 seconds (randomized), fade out over 800ms
    - Subtle glow: additive blend mode or drop shadow for soft halo effect
  - **Depth/parallax feel:**
    - Each firefly assigned a random "depth layer" (0.6 to 1.0)
    - Depth affects: size (smaller = further), alpha (dimmer = further), speed (slower = further)
    - Creates illusion of 3D space within the light rays
  - Continuous emission — new fireflies spawn as old ones fade out
  - Performance: use Phaser particle emitter if possible, otherwise manual sprite pool (max 20 sprites)
- **Acceptance:** Fireflies visible near light rays, organic wandering motion, depth variation creates parallax feel, no performance impact on mobile

### 3C: Item Spawning & Visual Style
- **What:** For each `RewardItem`, create a sprite group on the cloth:
  - **Gold:** Look up `gold_tiers.json` to pick correct tier sprite based on amount
  - **Health vials:** Use small or large vial sprite
  - **Cards:** Use existing card frame sprite (from `getCardFrameUrl`) or fallback to card type icon
  - **Relics:** Use relic icon sprite (from relic definition)
- **Shared visual treatment for ALL items:**
  - **Elliptical shadow:** Dark ellipse (alpha 0.3, ~60% of item width) on the cloth beneath each item
  - **Float offset:** Item sprite sits 6–10px above its shadow
  - **Idle bob:** Sine-wave ±2–3px vertical, ~2s period, phase offset randomized per item
  - **Pixel outline:** 1–2px black outline around sprite (use Phaser postFX pipeline if available, or pre-rendered 8-direction shift technique)
  - **Shimmer particles:** 1–2 white/gold sparkle particles per item, random position, fade in/out 400ms. Higher-value items (tier 4–5 gold, relics) get more particles or colored tint
- **Spawn animation** (staggered, 150ms between items):
  - Starts 20px above final position, alpha 0, scale 0
  - Tweens to final position, alpha 1, scale 1 over 300ms ease-out
  - Shadow fades in simultaneously
  - Sparkle particle burst on landing
  - Soft chime SFX per spawn (pitch randomized 0.9–1.1)
- **Acceptance:** Items appear on cloth with proper floating/bob/shadow treatment, staggered reveal feels satisfying

---

## Phase 4: Tap Interactions

### 4A: Gold Tap
- Tap gold sprite:
  - Destroy sprite + shadow with scale-down tween (150ms)
  - Gold coin particle burst arcing upward (8–12 particles)
  - Coin pickup SFX
  - Floating "+{amount} gold" text — pixel font, gold color (#ffd700), 2px black stroke, rises 40px, fades over 800ms
  - Add gold to player's run state
  - No popup/modal
- **Acceptance:** Gold collected on single tap, particle + text feedback, state updated

### 4B: Health Vial Tap
- Tap vial sprite:
  - Destroy sprite + shadow with scale-down tween (150ms)
  - Green healing particles rising (6–10 particles, #4ade80)
  - Potion gulp SFX
  - Heal amount: small = 10–25% max HP (random), large = 30–50% max HP (random), clamped to max
  - Floating "+{amount} HP" in green (#4ade80), 2px black stroke, same rise-and-fade
  - Update player HP in run state
  - Flash HP bar if visible in HUD
- **Acceptance:** Vial collected on single tap, green particles + text, HP updated

### 4C: Card Tap
- Tap card sprite (do NOT destroy):
  - Dim scene with semi-transparent black overlay (alpha 0.5)
  - Show Card Detail Popup (centered):
    - Card frame art, mechanic name, full description, AP cost, effect value, domain
    - Upgrade badge if applicable
    - "Accept" button and "Leave" button
  - Popup scales in 0.8→1.0, 200ms ease-out
  - **Accept:** Add card to deck, confirmation SFX, sprite + shadow scale-down + fade, close popup
  - **Leave:** Close popup, card resumes idle bob, remains tappable
- **Acceptance:** Two-tap flow (inspect then accept/leave), card added to deck on accept

### 4D: Relic Tap
- Same flow as cards but with Relic Detail layout:
  - Relic icon, name, description, rarity badge, effect text
  - "Accept" / "Leave" buttons
  - Accept: equip relic via existing relic system
- **Acceptance:** Two-tap inspect flow, relic equipped on accept

### 4E: Tap Feedback Polish
- All tappable items: subtle scale pulse on pointerdown (1.05x, 80ms) before action resolves
- Disabled state after collection (prevent double-tap)
- Items have `setInteractive()` with proper hit areas matching sprite bounds

---

## Phase 5: Exit & Integration

### 5A: Continue Button
- "Continue" button or door element at bottom of screen
- Always tappable — player can leave uncollected items (forfeited, with confirmation if items remain)
- Transition: fade out scene, proceed to dungeon map or next encounter
- **Acceptance:** Player can exit at any time, uncollected items are forfeited

### 5B: Wire into Game Flow
- **File:** `src/services/gameFlowController.ts`
- Replace current `openCardReward()` flow:
  - Instead of setting screen to `'cardReward'` and generating card options for the Svelte component,
  - Launch `RewardRoomScene` with the appropriate `RewardRoomData`
  - Build rewards list from: encounter gold reward + combo bonus, heal amount (as health vial if > 0), card reward options (1–3 cards from `generateCardRewardOptionsByType`)
  - On scene complete callback: proceed to dungeon map / next room (existing flow)
- Keep `CardRewardScreen.svelte` as fallback (don't delete yet) — feature-flag the new scene
- **Acceptance:** After winning an encounter, the new Phaser reward room loads instead of the Svelte altar screen

### 5C: Scene Registration
- **File:** `src/game/scenes/index.ts` or wherever Phaser scenes are registered
- Register `RewardRoomScene` in the Phaser game config
- Ensure proper scene lifecycle (shutdown/destroy cleanup for particles, tweens, listeners)
- **Acceptance:** Scene loads/unloads cleanly, no memory leaks

---

## Files Affected

### New Files
- `scripts/preprocess-reward-room.ts` — Node preprocessing script (Phase 1)
- `src/services/rewardSpawnService.ts` — Cloth spawn point system (Phase 2)
- `src/game/scenes/RewardRoomScene.ts` — Main Phaser scene (Phase 3–5)

### Modified Files
- `src/services/gameFlowController.ts` — Wire reward room into game flow
- `src/game/scenes/index.ts` — Register new scene
- `src/data/balance.ts` — Health vial heal percentages if needed
- `docs/GAME_DESIGN.md` — Document reward room mechanics
- `docs/ARCHITECTURE.md` — Document new scene and spawn service

### Generated Asset Outputs (public/assets/reward_room/)
- `reward_room_bg.webp` / `.png`
- `gold_tier_0.png` through `gold_tier_5.png`
- `gold_tiers.json`
- `cloth_spawn_zone.json`
- `health_vial_small.png`
- `health_vial_large.png`

---

## Verification Gate
- [ ] Preprocessing script runs without errors, outputs summary table
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Cloth spawn zone JSON has valid bounding box and 100+ spawn points
- [ ] Gold tiers are visually distinct at game resolution
- [ ] RewardRoomScene loads with background, fireflies visible near light rays
- [ ] Items spawn on cloth with floating/bob/shadow treatment
- [ ] Gold tap: particles + floating text + state update
- [ ] Health vial tap: green particles + HP update
- [ ] Card tap: popup with accept/leave flow
- [ ] Relic tap: popup with accept/leave flow
- [ ] Continue button exits scene, proceeds to map
- [ ] Fireflies have depth variation (size/alpha/speed) creating parallax feel
- [ ] No performance regression on mobile (60fps target)
- [ ] Visual test via Playwright screenshot
- [ ] `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` updated
