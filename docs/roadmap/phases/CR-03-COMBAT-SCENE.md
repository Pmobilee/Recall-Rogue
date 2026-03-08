# CR-03: Combat Scene

> **Goal:** Phaser 3 scene for card combat with split-stage portrait layout. Renders the top 55% display zone (enemy, HP bars, intent telegraph, floor counter, passive relics). The bottom 45% interaction zone (card hand, answers) is handled by Svelte overlays in CR-04.

## Overview

| Field | Value |
|-------|-------|
| Dependencies | CR-01 (Card Foundation), CR-02 (Encounter Engine) |
| Estimated Complexity | Medium (1-2 days) |
| Priority | P0 — Core Prototype |

The CombatScene is a Phaser 3 scene that renders the display-only top portion of the combat screen. It receives state updates from the TurnManager (CR-02) and renders enemy sprites, HP bars, intent telegraphs, floor/encounter counters, and passive relic icons. It does NOT handle card rendering or touch interaction — those are Svelte components overlaid on the bottom 45% of the screen (CR-04).

**Design rationale (from GAME_DESIGN.md Section 12):** Portrait mode with top 55% as display zone and bottom 45% as interaction zone. No interactive elements in the top zone (tap accuracy drops to 61% in the top third vs 96% in the bottom third). The Phaser canvas covers the full viewport height but only the top portion contains interactive Phaser game objects.

---

## Sub-steps

### 1. Create CombatScene class

**File:** `src/game/scenes/CombatScene.ts`

Create a new Phaser.Scene subclass with key `'CombatScene'`.

```typescript
export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' })
  }
}
```

**Lifecycle methods to implement:**
- `preload()` — Load placeholder enemy sprites (use existing sprite assets or colored rectangles as placeholders)
- `create()` — Set up all display elements, subscribe to TurnManager events
- `update()` — Minimal; use event-driven updates, not polling

**Layout constants (define at top of file):**
```typescript
const DISPLAY_ZONE_HEIGHT_PCT = 0.55  // Top 55% of screen
const ENEMY_Y_PCT = 0.20              // Enemy sprite vertical position (% of screen)
const PLAYER_HP_Y_PCT = 0.48          // Player HP bar position (bottom of display zone)
const ENEMY_HP_Y_PCT = 0.12           // Enemy HP bar position (above enemy)
const FLOOR_COUNTER_Y = 16            // px from top
const INTENT_ICON_OFFSET_Y = -40      // px above enemy sprite
const RELIC_TRAY_Y_PCT = 0.52         // Just below display zone boundary
```

### 2. Enemy display

**File:** `src/game/scenes/CombatScene.ts`

Render the current enemy in the center of the display zone.

- Create a sprite pool with 1 enemy sprite slot (reposition/retexture, don't create/destroy)
- Position: horizontally centered, vertically at ~20% of screen height
- Scale to fit within 120x120dp maximum
- Add enemy name text below sprite (16px, white, center-aligned)
- On enemy change (new encounter), swap texture and reset position

**Enemy HP bar:**
- Position above enemy sprite, centered
- Width: 160dp, Height: 12dp
- Background: dark gray (#333333), Fill: red (#E74C3C)
- Smooth tween on damage (300ms ease-out)
- Show HP text centered on bar: "45 / 80"
- On damage: flash bar white for 100ms, then animate fill decrease

**Intent icon telegraph:**
- Position: above enemy HP bar (INTENT_ICON_OFFSET_Y from enemy top)
- Show icon representing enemy's next action:
  - Sword icon = attack (show damage value, e.g., "8")
  - Shield icon = defending
  - Skull icon = special attack
  - "?" icon = unknown intent
- Use Phaser.GameObjects.Image for icon + Phaser.GameObjects.Text for value
- Animate in with slight bounce (tween scaleX/scaleY from 0 to 1 over 200ms) at start of player turn

### 3. Player HP bar

**File:** `src/game/scenes/CombatScene.ts`

Render player HP at the bottom of the display zone.

- Position: horizontally centered, at PLAYER_HP_Y_PCT of screen height
- Width: 200dp, Height: 16dp
- Background: dark gray (#333333), Fill: green (#2ECC71)
- Color transitions: green (>50%), yellow (#F1C40F, 25-50%), red (#E74C3C, <25%)
- Smooth tween on damage/heal (400ms ease-out)
- Show HP text centered: "65 / 100"
- Small heart icon to the left of the bar
- On damage: screen tint red at 10% opacity for 150ms (display zone only, not full screen)
- On heal: brief green particle burst (8 particles, 200ms lifespan)

### 4. Floor/encounter counter

**File:** `src/game/scenes/CombatScene.ts`

Display current progress in the top-left corner of the display zone.

- Position: top-left, 16dp padding from edges
- Format: "Floor 2 — Encounter 1/3"
- Font: 14px, white, slight shadow for readability
- Update when floor or encounter number changes
- Add a small divider line or background pill for visual separation from the scene background

### 5. Passive relic display

**File:** `src/game/scenes/CombatScene.ts`

Show mastered card (Tier 3) passive buffs as small icons along the boundary between display and interaction zones.

- Position: horizontal row at RELIC_TRAY_Y_PCT, centered
- Each relic: 24x24dp icon with domain-colored border
- Max 8 visible relics; if more, show count badge "+3"
- Relic types match domain passive buffs (GAME_DESIGN.md Section 3):
  - Attack relic (Science) = sword icon, red border
  - Shield relic (History) = shield icon, blue border
  - Heal relic (Language) = heart icon, green border
  - Utility relic (Geography) = star icon, yellow border
  - Buff relic (Math) = arrow-up icon, purple border
  - Debuff relic (Arts) = arrow-down icon, orange border
  - Regen relic (Medicine) = plus icon, teal border
  - Wild relic (Technology) = diamond icon, gray border
- Tap on relic row: NO interaction (display only; tooltip can come in a future phase)
- When a new relic is added mid-run, animate it in (scale from 0 to 1, slight bounce)

### 6. Scene lifecycle and TurnManager integration

**File:** `src/game/scenes/CombatScene.ts`

Wire the scene to the encounter engine from CR-02.

- **Scene start:** Receive encounter data via `scene.data` or a shared service/store
  ```typescript
  // In create():
  // Subscribe to turnManager events
  this.events.on('enemy-update', this.onEnemyUpdate, this)
  this.events.on('player-hp-update', this.onPlayerHpUpdate, this)
  this.events.on('intent-update', this.onIntentUpdate, this)
  this.events.on('encounter-start', this.onEncounterStart, this)
  this.events.on('encounter-end', this.onEncounterEnd, this)
  ```
- **Encounter start:** Set enemy sprite, HP, intent, reset animations
- **Card resolved (correct):** Trigger enemy damage animation (see CR-05 for juice details; this scene just handles the HP bar update and enemy hit reaction placeholder)
- **Card resolved (wrong):** No visual change in display zone (wrong answer feedback is in interaction zone)
- **Enemy turn:** Show enemy attack animation (simple: sprite lunges forward 20px, returns), apply damage to player HP bar
- **Encounter end:** Enemy death animation (fade out + particle burst), brief pause (500ms), then emit 'encounter-complete' event

**File:** `src/game/GameManager.ts`

Register CombatScene in the Phaser game config:
```typescript
import { CombatScene } from './scenes/CombatScene'
// In the config.scene array:
scene: [BootScene, MineScene, DomeScene, CombatScene],
```

### 7. Performance: sprite pool and object budget

**File:** `src/game/scenes/CombatScene.ts`

Maintain a sprite pool to avoid create/destroy overhead.

- **Sprite pool:** Pre-create 5 reusable game objects in `create()`:
  1. Enemy sprite (Phaser.GameObjects.Sprite)
  2. Enemy HP bar background (Phaser.GameObjects.Rectangle)
  3. Enemy HP bar fill (Phaser.GameObjects.Rectangle)
  4. Player HP bar background (Phaser.GameObjects.Rectangle)
  5. Player HP bar fill (Phaser.GameObjects.Rectangle)
- **Additional objects (created once, reused):**
  - Enemy HP text (Phaser.GameObjects.Text)
  - Player HP text (Phaser.GameObjects.Text)
  - Floor counter text (Phaser.GameObjects.Text)
  - Intent icon (Phaser.GameObjects.Image)
  - Intent value text (Phaser.GameObjects.Text)
  - Enemy name text (Phaser.GameObjects.Text)
  - Relic icons container (Phaser.GameObjects.Container with up to 8 children)
- **Total: 12 game objects maximum** (matching the performance budget in GAME_DESIGN.md Section 22)
- **Particle emitter:** 1 shared emitter, capped at 50 concurrent particles (configured in create(), triggered on demand)
- **Target:** 60fps on mobile (Pixel 7 class device)

### 8. Wire CombatScene to Svelte app router

**File:** `src/ui/stores/gameState.ts`

The `Screen` type already includes `'combat'`. Verify it exists; if not, add it.

**File:** `src/App.svelte` (or equivalent router component)

When `$currentScreen === 'combat'`:
- Ensure the Phaser canvas is visible (it may be hidden during non-game screens)
- Start the CombatScene: `gameManager.game.scene.start('CombatScene', encounterData)`
- Render the Svelte combat overlay (from CR-04) on top of the canvas, positioned in the bottom 45%

**File:** `src/game/scenes/CombatScene.ts`

On scene shutdown/sleep:
- Stop all tweens
- Reset sprite positions
- Emit cleanup event so Svelte overlay can unmount

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | CombatScene loads without errors | Navigate to combat screen, check console for errors |
| 2 | Enemy sprite renders in top-center of display zone | Screenshot at 390x844 viewport |
| 3 | Enemy HP bar shows correct value and animates on damage | Call damage function, verify smooth tween |
| 4 | Player HP bar shows correct value with color transitions | Set HP to 75%, 40%, 15% — verify green/yellow/red |
| 5 | Intent icon appears above enemy with correct icon/value | Start encounter, verify telegraph matches enemy pattern |
| 6 | Floor counter displays correct floor and encounter number | Verify text updates on encounter progression |
| 7 | Passive relic icons render in a row below display zone | Add 3 test relics, verify they appear with correct icons |
| 8 | Scene registered in Phaser game config | `gameManager.game.scene.keys` includes 'CombatScene' |
| 9 | Total game objects in scene <= 12 | `scene.children.length` check via browser_evaluate |
| 10 | 60fps on combat scene | Check Phaser debug FPS counter or performance.now() frame timing |
| 11 | Scene starts/stops cleanly when navigating to/from combat | Navigate away and back, no orphaned sprites or memory leaks |

---

## Verification Gate

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] CombatScene renders correctly at 390x844 (Pixel 7) viewport — Playwright screenshot
- [ ] Enemy HP bar animates smoothly (no jank)
- [ ] Player HP bar color transitions work at 75%, 40%, 15% HP
- [ ] Intent telegraph icon visible and correctly positioned
- [ ] Floor counter text readable and correctly formatted
- [ ] Scene object count <= 12 (verified via `browser_evaluate`)
- [ ] No console errors during combat scene lifecycle
- [ ] Scene properly cleans up on shutdown (no orphaned event listeners)

---

## Files Affected

| Action | File |
|--------|------|
| CREATE | `src/game/scenes/CombatScene.ts` |
| MODIFY | `src/game/GameManager.ts` — Add CombatScene to scene array import and config |
| MODIFY | `src/ui/stores/gameState.ts` — Verify 'combat' in Screen type (already exists) |
| MODIFY | `src/App.svelte` — Add combat screen routing (show Phaser canvas + Svelte overlay) |
