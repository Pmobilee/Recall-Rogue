# AR-96: Combat Landscape — Proper Option D Implementation

## Context

The Option D layout spec (DESKTOP-PORT-MASTER-INSTRUCTIONS.md §3) was never properly implemented in the Phaser scene. The Svelte overlay elements moved to approximate positions, but the actual Phaser sprite rendering is broken:

1. **Enemy sprite is 3-4× too large** — sprite sizing constants designed for 390px canvas are being used at 1920px. The enemy fills/clips the entire viewport.
2. **No spatial split** — Enemy should be in the RIGHT 30% panel, quiz in LEFT 70% center stage. Instead, enemy is centered and quiz floats on top.
3. **End Turn button awkwardly placed** — should be bottom-right of card hand strip.

## The Spec (from master doc)

```
+----------------------------------------------------+
| [Relics] [Chain Counter] [Combo]  |   ENEMY        |
|                                   |   Sprite       |
|                                   |   HP Bar       |
|        CENTER STAGE               |   Intent       |
|    (Quiz panel appears here       |   Status FX    |
|     when Charge is committed)     |   Damage nums  |
|                                   |                |
+-----------------------------------+----------------+
|  [Card1]  [Card2]  [Card3]  [Card4]  [Card5]      |
|              [AP: 3/3]  [Surge indicator]          |
|         [Quick Play]  [CHARGE +1 AP]               |
+----------------------------------------------------+
```

Enemy panel: RIGHT 30% (~576px at 1920). Center stage: LEFT 70% (~1344px). Card hand: bottom 25%.

## Fixes Required

### Fix 1: Enemy Sprite Scaling for Landscape

**File:** `src/game/scenes/CombatScene.ts`

The enemy display sizes (`ENEMY_SIZE_COMMON = 300`, etc.) are pixel values designed for a 390px-wide portrait canvas. In landscape mode (1280×720 game resolution), the enemy needs to be MUCH smaller relative to the canvas.

In the `handleLayoutChange` or enemy setup code:
- When landscape: scale enemy to fit within the RIGHT 30% of the canvas (384px at 1280 width)
- Max enemy display size in landscape: ~200px for common, ~240px for elite, ~280px for boss
- Position enemy container at x = canvas.width * 0.85, y = canvas.height * 0.40

### Fix 2: Enemy Position — Right 30% Panel

**File:** `src/game/scenes/CombatScene.ts`

The landscape position constants exist but aren't being used effectively. The enemy sprite container must be positioned in the RIGHT 30%:
- `ENEMY_X_PCT = 0.85` (85% of canvas width = 1088px at 1280)
- `ENEMY_Y_PCT = 0.40` (40% of canvas height = 288px at 720)
- Enemy HP bar: above the enemy, within the right panel
- Intent icon: above HP bar, in right panel

Verify that `handleLayoutChange` actually repositions the enemy container. The `repositionAll()` method must move:
- Enemy sprite container
- Enemy HP bar/block bar
- Intent text
- Floor counter
- All to the right 30%

### Fix 3: Quiz Panel — Left 70% Center Stage

**File:** `src/ui/components/CardExpanded.svelte`

The quiz panel currently floats as a centered dialog. In landscape, it must:
- Be positioned within the LEFT 70% of the viewport
- NOT overlap the enemy panel (right 30%)
- `right: 30vw` or `max-width: min(50vw, 640px); margin-right: 30vw`

The quiz answers should be in a horizontal row (side by side) with keyboard hints [1][2][3][4], matching the user's second screenshot.

### Fix 4: End Turn Button — Bottom Right

**File:** `src/ui/components/CardCombatOverlay.svelte`

Move End Turn button to bottom-right corner of the card hand strip in landscape:
```css
.layout-landscape .end-turn-btn {
  position: absolute;
  right: 20px;
  bottom: 26vh; /* top of card hand */
  /* or position within the card hand strip at the right end */
}
```

### Fix 5: Background — Vertical Divider

In landscape, add a subtle visual divider between center stage (left 70%) and enemy panel (right 30%):
- A thin vertical line or gradient fade at x = 70% viewport width
- Very subtle (opacity 0.1-0.2), just enough to suggest the spatial separation

## Acceptance Criteria

- [ ] Enemy sprite fits within right 30% panel, not clipping
- [ ] Enemy HP bar, intent, name all within right 30%
- [ ] Center stage (left 70%) is clear for quiz panel
- [ ] Quiz panel appears in left 70%, enemy visible on right during quiz
- [ ] Quiz answers in horizontal row with [1][2][3] hints
- [ ] End Turn button at bottom-right
- [ ] Portrait mode UNCHANGED
- [ ] Verified with ACTUAL SCREENSHOTS at 1920×1080
