# CR-20: Asset Integration + Visual Verification

## Summary

**Phase:** P2 — Art Pipeline + First Asset Pass
**Priority:** BLOCKER
**Depends on:** CR-15, CR-16, CR-17, CR-18, CR-19 (all asset generation CRs)
**Estimated scope:** M

Replace all placeholder sprites and colored rectangles with the generated assets from CR-15 through CR-19. Run comprehensive visual regression testing via Playwright to verify every asset renders correctly at mobile resolution (390x844, Pixel 7 emulation). This CR produces no new assets — it wires existing assets into the game and validates the result.

---

## Design Reference

**Current placeholder state** (from codebase):
- Phaser CombatScene: colored rectangles for player and enemy sprites
- Card hand UI (`CardCombatOverlay.svelte`): CSS-only card styling, no frame sprites
- Room selection (`RoomSelection.svelte`): text-based room cards, no door sprites
- Domain selection (`DomainSelection.svelte`): text labels, no domain icons
- Main menu (`CardApp.svelte`): solid #0D1117 background, no title screen image
- Rest/mystery/run-end screens: solid color backgrounds

**Asset sources:**
- CR-15: Enemy sprites (cave_bat, crystal_golem, shadow_wisp, mushroom_brute, bone_knight — idle/hit/death)
- CR-16: Player sprites (7 poses — idle, attack, hit, defend, cast, victory, death)
- CR-17: Combat backgrounds (dungeon tileset, room backgrounds)
- CR-18: Menu/UI backgrounds (title screen, rest area)
- CR-19: Card frames (10), domain icons (9), room doors (6)

**Target viewport:** 390x844 (Pixel 7), portrait orientation, split-stage layout (top 55% Phaser display, bottom 45% Svelte interaction).

---

## Implementation

### A. Phaser CombatScene — Player + Enemy Sprites

**File:** `src/game/scenes/CombatScene.ts`

**Current state:** Colored rectangles created with `this.add.rectangle()` for player and enemy.

**Changes:**
1. Load sprite assets in `preload()`:
   ```typescript
   // Player sprites
   this.load.image('player_idle', 'assets/sprites/player/player_idle.png');
   this.load.image('player_attack', 'assets/sprites/player/player_attack.png');
   this.load.image('player_hit', 'assets/sprites/player/player_hit.png');
   this.load.image('player_defend', 'assets/sprites/player/player_defend.png');
   this.load.image('player_cast', 'assets/sprites/player/player_cast.png');
   this.load.image('player_victory', 'assets/sprites/player/player_victory.png');
   this.load.image('player_death', 'assets/sprites/player/player_death.png');

   // Enemy sprites (per enemy template)
   this.load.image('cave_bat_idle', 'assets/sprites/enemies/cave_bat_idle.png');
   this.load.image('cave_bat_hit', 'assets/sprites/enemies/cave_bat_hit.png');
   this.load.image('cave_bat_death', 'assets/sprites/enemies/cave_bat_death.png');
   // ... repeat for all enemy types
   ```
2. Replace `this.add.rectangle()` player with `this.add.image(x, y, 'player_idle')`
3. Replace enemy rectangle with appropriate idle sprite based on `enemyId`
4. On player action: swap texture to corresponding pose, then back to idle after 400ms
5. On enemy hit: swap to hit texture for 300ms, then back to idle
6. On enemy death: swap to death texture, play dissolve tween (alpha 1→0 over 600ms)

**Fallback:** If a sprite key fails to load, catch the error in `preload()` and fall back to the existing colored rectangle. Log a console warning: `[AssetIntegration] Missing sprite: ${key}, using placeholder`.

### B. Phaser CombatScene — Combat Background

**File:** `src/game/scenes/CombatScene.ts`

**Changes:**
1. Load: `this.load.image('bg_combat', 'assets/backgrounds/combat/dungeon.png')`
2. Add as background in `create()`: `this.add.image(centerX, centerY, 'bg_combat').setDepth(-1)`
3. Scale to fill the Phaser canvas area (top 55% of screen) using `setDisplaySize(canvasWidth, canvasHeight)`
4. Fallback: if bg fails to load, keep existing solid color background

### C. Card Hand UI — Card Frame Sprites

**File:** `src/ui/components/CardCombatOverlay.svelte` (and/or child card components)

**Changes:**
1. Map `card.cardType` to frame sprite path:
   ```typescript
   function getFramePath(card: CombatCard): string {
     if (card.isEcho) return '/assets/sprites/cards/frame_echo.png';
     return `/assets/sprites/cards/frame_${card.cardType}.png`;
   }
   ```
2. Replace CSS-only card backgrounds with frame sprite as `<img>` or CSS `background-image`
3. Overlay card text (mechanic name, effect value) on top of frame using absolute positioning
4. For face-down cards (draw pile display), use `card_back.png`
5. Tier glow overlays applied via CSS:
   - Tier 1: no extra styling
   - Tier 2: `box-shadow: 0 0 8px 2px rgba(192, 192, 192, 0.6)` (silver)
   - Tier 3: `box-shadow: 0 0 8px 2px rgba(255, 215, 0, 0.6)` (gold)

### D. Room Selection — Door Sprites

**File:** `src/ui/components/RoomSelection.svelte`

**Changes:**
1. Replace text-based room option cards with door sprite images
2. Map room type to door sprite:
   ```typescript
   const doorMap: Record<string, string> = {
     combat: '/assets/sprites/doors/door_combat.png',
     mystery: '/assets/sprites/doors/door_mystery.png',
     rest: '/assets/sprites/doors/door_rest.png',
     treasure: '/assets/sprites/doors/door_treasure.png',
     shop: '/assets/sprites/doors/door_shop.png',
     boss: '/assets/sprites/doors/door_boss.png',
   };
   ```
3. Room label text overlaid below door sprite
4. Preserve existing tap interaction (onselect callback)
5. Door displayed at 80x100 (2x) with CSS scaling to fit layout

### E. Domain Selection — Domain Icons

**File:** `src/ui/components/DomainSelection.svelte`

**Changes:**
1. Add domain icon `<img>` next to each domain name
2. Map domain to icon:
   ```typescript
   const iconMap: Record<string, string> = {
     science: '/assets/sprites/icons/icon_science.png',
     history: '/assets/sprites/icons/icon_history.png',
     geography: '/assets/sprites/icons/icon_geography.png',
     language: '/assets/sprites/icons/icon_language.png',
     math: '/assets/sprites/icons/icon_math.png',
     arts: '/assets/sprites/icons/icon_arts.png',
     medicine: '/assets/sprites/icons/icon_medicine.png',
     technology: '/assets/sprites/icons/icon_technology.png',
   };
   ```
3. Locked domains show `icon_locked.png` instead of domain icon
4. Icons displayed at 32x32dp inline with domain text

### F. Main Menu — Title Background

**File:** `src/CardApp.svelte`

**Changes:**
1. Add title background image behind main menu
2. CSS: `background-image: url('/assets/backgrounds/menu/title.png'); background-size: cover; background-position: center;`
3. Keep existing text and button overlay
4. Add semi-transparent dark overlay if text readability is affected: `background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6))`

### G. Rest/Mystery/Run-End Screens — Backgrounds

**Files:** `src/ui/components/RestRoomOverlay.svelte`, `src/ui/components/MysteryEventOverlay.svelte`, `src/ui/components/RunEndScreen.svelte`

**Changes:**
1. Rest screen: use `bg_rest_area.png` as CSS background-image
2. Mystery screen: reuse combat bg or use a dark overlay (no dedicated mystery bg in P2)
3. Run-end screen: use `bg_menu_title.png` with dark overlay

### H. Sprite Loader Helper

**File (new):** `src/game/helpers/spriteLoader.ts`

**Purpose:** Centralize sprite key mapping so CombatScene doesn't hardcode paths.

```typescript
/** Map enemy template IDs to their sprite asset keys */
export function getEnemySpriteKeys(enemyId: string): { idle: string; hit: string; death: string } {
  return {
    idle: `${enemyId}_idle`,
    hit: `${enemyId}_hit`,
    death: `${enemyId}_death`,
  };
}

/** Map player poses to sprite asset keys */
export const PLAYER_SPRITES = {
  idle: 'player_idle',
  attack: 'player_attack',
  hit: 'player_hit',
  defend: 'player_defend',
  cast: 'player_cast',
  victory: 'player_victory',
  death: 'player_death',
} as const;

/** All asset paths for Phaser preloading */
export function getAllAssetPaths(): Array<{ key: string; path: string }> { ... }
```

### System Interactions

- **CombatScene:** Reads enemy template ID from encounter data to select correct sprite
- **encounterBridge.ts:** No changes needed — it passes enemy data which already contains template IDs
- **CardGameManager.ts:** No changes needed — Phaser scene handles its own asset loading
- **Svelte components:** Use standard `<img>` tags or CSS background-image — no new Svelte stores or services needed

---

## Visual Verification Plan (MANDATORY)

### Test 1: App Load & Title Screen
1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. Take screenshot of main menu
3. Verify: title background visible, text readable over background
4. Check console for any 404 errors on asset loading

### Test 2: Domain Selection
1. Click "Start Run" to navigate to domain selection
2. Take screenshot
3. Verify: domain icons visible next to each domain name
4. Verify: locked domains show padlock icon

### Test 3: Combat Scene
1. Select domains, enter first combat
2. Take screenshot
3. Verify: combat background fills Phaser canvas
4. Verify: player sprite (idle) visible on left side
5. Verify: enemy sprite (idle) visible on right side
6. Verify: card hand shows card frames with correct type colors

### Test 4: Card Interaction
1. Tap a card in hand
2. Take screenshot of expanded card
3. Verify: card frame visible at expanded size (300x350dp)
4. Verify: text overlays readable on frame

### Test 5: Room Selection
1. Complete an encounter, reach room selection
2. Take screenshot
3. Verify: door sprites displayed for each room option
4. Verify: room type labels visible below doors

### Test 6: Rest Room
1. Select a rest room
2. Take screenshot
3. Verify: rest area background with warm lighting visible

### Test 7: Mobile Resolution Check
1. All screenshots taken at 390x844 viewport (Pixel 7 emulation)
2. Verify: all sprites readable at mobile resolution
3. Verify: card frames work at 65dp collapsed width
4. Verify: no assets overflow viewport or overlap incorrectly

### Test 8: Performance Check
1. Check total asset file size: should be < 5MB for all P2 assets combined
2. Check load time: all assets should load within 3 seconds on simulated 3G
3. No console errors related to asset loading

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Asset file missing (404) | Graceful fallback to colored rectangle placeholder. Console warning logged. |
| Sprite dimensions wrong | Scale to fit using Phaser's `setDisplaySize()` or CSS `object-fit: contain` |
| Background aspect ratio mismatch | Scale to cover, crop excess via CSS `background-size: cover` |
| Card frame too dark on dark background | Add subtle border glow or 1px light outline in CSS |
| Enemy sprite ID not in asset map | Fallback to generic colored rectangle with enemy name text |
| Multiple asset loads cause frame drop | Use Phaser loader queue in `preload()`, not individual loads per encounter |
| Echo card shows type frame instead of echo frame | Check `card.isEcho` flag before selecting frame sprite path |
| Title background makes menu text unreadable | Apply semi-transparent dark overlay between bg and text |

---

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/game/scenes/CombatScene.ts` | Load and display player/enemy sprites and combat background |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Card frame sprites replace CSS-only cards |
| Modify | `src/ui/components/RoomSelection.svelte` | Door sprites replace text-based room cards |
| Modify | `src/ui/components/DomainSelection.svelte` | Domain icons added next to domain names |
| Modify | `src/CardApp.svelte` | Title background image on main menu |
| Modify | `src/ui/components/RestRoomOverlay.svelte` | Rest area background image |
| Modify | `src/ui/components/RunEndScreen.svelte` | Run-end background image |
| Create | `src/game/helpers/spriteLoader.ts` | Helper mapping enemy IDs to sprite keys, asset path registry |
| Create | `tests/e2e/04-visual-assets.cjs` | Playwright visual regression E2E test (8 verification screenshots) |
| Modify | `docs/GAME_DESIGN.md` | Update visual/art sections to reflect integrated assets |
| Modify | `docs/ARCHITECTURE.md` | Add spriteLoader.ts, document asset loading flow |

---

## Done When

- [ ] Main menu shows title background (not solid #0D1117)
- [ ] Combat scene shows background image behind sprites
- [ ] Player character rendered as sprite (not colored rectangle)
- [ ] Enemy rendered as sprite matching its template ID
- [ ] Card hand shows card frames with type-appropriate colors
- [ ] Echo cards use ghostly echo frame
- [ ] Room selection shows door sprites per room type
- [ ] Domain selection shows domain icons
- [ ] Rest screen shows rest area background
- [ ] All assets load without 404 errors (check console)
- [ ] All sprites readable at mobile resolution (390x844)
- [ ] Card frames work at 65dp collapsed width
- [ ] Total P2 asset size < 5MB
- [ ] Playwright visual regression test passes (8 verification screenshots)
- [ ] Fallback to colored rectangles works when asset is missing
- [ ] `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` updated
