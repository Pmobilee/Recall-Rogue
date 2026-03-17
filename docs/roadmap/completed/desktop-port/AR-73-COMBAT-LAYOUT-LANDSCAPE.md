# AR-73: Combat Layout — Landscape (Option D)

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §3
> **Priority:** CORE EXPERIENCE
> **Complexity:** Large — touches Phaser scene + Svelte overlay + VFX systems
> **Dependencies:** AR-71 (Layout System)

## Context

Combat currently uses a portrait split: top 58% = Phaser enemy display, bottom 42% = Svelte card hand overlay. In landscape, we adopt "Option D": enemy panel on the right ~30%, center stage on the left ~70% (for quiz + VFX), card hand as a full-width bottom strip.

**Portrait mode MUST remain pixel-identical to current implementation.** Use `{#if $layoutMode === 'landscape'}` branching, never modify portrait paths.

## Current Implementation

- `src/game/scenes/CombatScene.ts` (1508 lines) — all positioning uses percentages of viewport
  - `DISPLAY_ZONE_HEIGHT_PCT = 0.58` — top zone for enemy
  - `ENEMY_X_PCT = 0.50` — enemy centered
  - `ENEMY_HP_Y_PCT = 0.12` — HP bar near top
  - Enemy sprite at `scaleFactor = viewport.width / BASE_WIDTH`
- `src/ui/components/CardCombatOverlay.svelte` — full-screen Svelte overlay on top of Phaser
- `src/ui/components/CardHand.svelte` — fixed bottom, 390px base width

## Directive

### Step 1: Landscape Position Config

**File:** `src/game/scenes/CombatScene.ts`

Add a landscape position config object alongside existing portrait constants:

```typescript
const LANDSCAPE = {
  ENEMY_PANEL_X_START: 0.70,  // Right 30% of viewport
  ENEMY_X_PCT: 0.85,          // Centered within right panel
  ENEMY_Y_PCT: 0.45,          // Vertically centered
  ENEMY_HP_Y_PCT: 0.15,       // HP bar at top of right panel
  PLAYER_HP_BAR_X_PCT: 0.68,  // Left edge of enemy panel
  PLAYER_HP_BAR_TOP: 0.20,
  PLAYER_HP_BAR_BOTTOM: 0.80,
  FLOOR_COUNTER_X: 0.72,
  FLOOR_COUNTER_Y: 0.05,
  RELIC_TRAY_X: 0.02,         // Top-left in center stage
  RELIC_TRAY_Y: 0.05,
  CHAIN_COUNTER_X: 0.35,      // Top-center of center stage
  CHAIN_COUNTER_Y: 0.05,
  COMBO_COUNTER_X: 0.65,      // Top-right of center stage
  COMBO_COUNTER_Y: 0.05,
};
```

### Step 2: Implement `handleLayoutChange` in CombatScene

**File:** `src/game/scenes/CombatScene.ts`

Implement the `handleLayoutChange(mode: LayoutMode)` method (stubbed in AR-71):

1. Store current mode in scene property
2. Reposition enemy sprite container using landscape/portrait config
3. Reposition HP bars, intent text, status effects, floor counter
4. Reposition relic tray, chain counter, combo counter
5. Resize/reposition background image (cover mode for both orientations)
6. Update vignette graphics dimensions
7. Notify particle systems of new bounds

**Acceptance:** Enemy appears in right 30% in landscape, centered in portrait. All HUD elements reposition correctly.

### Step 3: Combat Background — Dual Mode

**File:** `src/game/scenes/CombatScene.ts` — `setCombatBackground()`

- In portrait: use existing 720×1280 backgrounds (current behavior)
- In landscape: look for `{bgKey}_landscape` variant first, fall back to portrait with cover-crop
- Background cover-scales to fill viewport in both modes

**File:** `src/data/backgroundManifest.ts` (if exists) — add landscape key convention

**Acceptance:** Background fills viewport in both modes without black bars.

### Step 4: Card Hand Landscape Layout

**File:** `src/ui/components/CardHand.svelte`

Add landscape branch:

```svelte
{#if $isLandscape}
  <div class="card-hand-landscape">
    <!-- Full viewport width, bottom 25-30% -->
    <!-- Cards spread horizontally in wider fan/arc -->
    <!-- More space between cards than portrait -->
    <!-- Each card shows more info (chain type badge visible) -->
  </div>
{:else}
  <!-- EXISTING portrait implementation, UNCHANGED -->
{/if}
```

Landscape card hand specifics:
- Position: `position: fixed; bottom: 0; left: 0; right: 0`
- Height: ~25-30% of viewport
- Cards: horizontal fan spread using full width
- Selected card rises vertically with Quick Play / Charge buttons
- AP counter positioned at left edge of hand strip
- Surge indicator at right edge

**Acceptance:** Card hand fills bottom strip in landscape. Card selection, drag-to-charge, and Quick Play all work.

### Step 5: Combat Overlay Landscape Layout

**File:** `src/ui/components/CardCombatOverlay.svelte`

Add landscape branch:
- Enemy info panel: right 30% overlay (or Phaser handles this entirely)
- Center stage: left 70%, above card hand — reserved for quiz panel (AR-76)
- HUD elements (AP, surge, chain) repositioned per landscape config
- Enemy hover tooltip: expanded info panel (next 2-3 intents, status durations)

**Acceptance:** All combat HUD elements render correctly in landscape. No overlap with Phaser enemy panel.

### Step 6: VFX System Adaptation

**Files:**
- `src/game/systems/CombatParticleSystem.ts` — particle spawn bounds update on layout change
- `src/game/systems/StatusEffectVisualSystem.ts` — enemy position tracking works in both modes
- `src/game/systems/CombatAtmosphereSystem.ts` — fog covers correct viewport region
- `src/game/systems/ScreenShakeSystem.ts` — shake works at both aspect ratios
- `src/game/systems/EnemySpriteSystem.ts` — sprite positioning respects landscape enemy panel

Each system: read layout mode, adjust bounds/positions accordingly.

**Acceptance:** Particles, status effects, atmosphere, and screen shake render correctly in landscape.

### Step 7: Verification

- [ ] `npm run typecheck` passes
- [ ] Portrait combat: pixel-identical to pre-AR-73
- [ ] Landscape combat: enemy in right panel, card hand at bottom, center stage clear
- [ ] Card selection works in landscape (tap/click to select, buttons appear)
- [ ] Charge play works in landscape (drag or button)
- [ ] VFX render in correct positions in landscape
- [ ] Background fills viewport in landscape
- [ ] Ctrl+Shift+L toggles layout mid-combat without crash

## Files Affected

| File | Action |
|------|--------|
| `src/game/scenes/CombatScene.ts` | MODIFY (landscape positions, handleLayoutChange) |
| `src/ui/components/CardHand.svelte` | MODIFY (landscape branch) |
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY (landscape branch) |
| `src/game/systems/EnemySpriteSystem.ts` | MODIFY (position awareness) |
| `src/game/systems/CombatParticleSystem.ts` | MODIFY (bounds update) |
| `src/game/systems/StatusEffectVisualSystem.ts` | MODIFY (position tracking) |
| `src/game/systems/CombatAtmosphereSystem.ts` | MODIFY (viewport bounds) |
| `src/game/systems/ScreenShakeSystem.ts` | MODIFY (aspect ratio) |

## GDD Updates

Update `docs/GAME_DESIGN.md` §17 (Portrait UX → Split-Stage Layout) to add a landscape subsection documenting Option D layout: right 30% enemy panel, left 70% center stage, bottom 25-30% card hand.
