# AR-234: Damage Number Improvements

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 21, 22, 23
**Complexity:** Medium — animation system, event wiring
**Dependencies:** AR-222 (Turn Flow/Combat Feedback)

---

## Overview

Three damage number issues: (1) Enemy attack damage numbers are not showing at all — they need to be wired up. (2) The animation must be an arc trajectory (impact point → arc sideways and downward) rather than floating straight up. (3) Player-dealt damage numbers must appear to the side of the enemy, not on top of it.

---

## User's Exact Words

> "When the enemy attacks, I did NOT see any damage number pop up. There should be red font with black border, RPG style."

> "Damage numbers should fall toward the side and downward in an arc — like how mobile games show damage numbers. Not just floating up. They need to feel impactful, like the number physically gets knocked away."

> "Doing damage TO an enemy does show the damage number, but it should appear to the SIDE of the enemy, not on the enemy itself — otherwise we can't read it."

---

## Sub-Steps

### Step 1 — Wire Enemy Attack Damage Numbers to Player
**File:** `src/ui/components/DamageNumber.svelte` and/or `src/ui/components/CardCombatOverlay.svelte`

- Locate where enemy attack damage is calculated and applied (likely `src/services/encounterBridge.ts` or `src/services/turnManager.ts`).
- Ensure an event is emitted (store update, event bus, or callback) when the enemy deals damage to the player.
- In `CardCombatOverlay.svelte`, subscribe to this event and spawn a `DamageNumber` at the player's HP bar position.
- Style: red text, black border/stroke (RPG style), larger than current player-dealt numbers if they are small.

**Acceptance:** When enemy attacks, a red damage number appears near the player HP bar area. Visible in screenshot after enemy turn.

---

### Step 2 — Arc Animation Trajectory
**File:** `src/ui/components/DamageNumber.svelte`

Replace the current float-up animation with an arc trajectory:
- Number starts at impact position.
- Animates along a parabolic arc: moves sideways (left or right, randomly chosen) AND downward.
- Uses CSS keyframes or JS animation. Example keyframe structure:
  ```
  0%:   translate(0, 0),         scale(1.4),  opacity: 1
  30%:  translate(±40px, -20px), scale(1.0)   (apex of arc)
  100%: translate(±80px, 60px),  scale(0.7),  opacity: 0
  ```
- All translate values must use `calc(Npx * var(--layout-scale, 1))`.
- Duration: ~700ms. Easing: ease-in on the descent portion.
- Direction: randomize left vs right on each spawn.

**Acceptance:** Damage number visually arcs sideways and downward like a physical impact. Does not float straight up.

---

### Step 3 — Reposition Player-Dealt Numbers to Side of Enemy
**File:** `src/ui/components/CardCombatOverlay.svelte`

- Currently damage numbers appear at the enemy's center position.
- Change spawn position: offset horizontally by approximately 60% of the enemy sprite width to the right (or left if enemy is on the right side of screen).
- Vertically: spawn at the enemy's vertical center or slightly above.
- The arc animation (Step 2) will then carry the number further to the side, keeping it readable throughout.

**Acceptance:** Player-dealt damage numbers spawn visibly to the side of the enemy sprite, not overlapping the enemy's center. Readable throughout the arc animation.

---

### Step 4 — Differentiate Player vs Enemy Damage Number Style
**File:** `src/ui/components/DamageNumber.svelte`

- Player takes damage: red number, black stroke, spawns near player HP bar area.
- Player deals damage: white or yellow number, black stroke, spawns to side of enemy.
- Accept a `variant` prop: `'player-hit'` | `'enemy-hit'`.
- Apply different color via CSS class based on `variant`.

**Acceptance:** Two distinct color styles for the two damage number types. Easy to distinguish in screenshot.

---

## Files Affected

- `src/ui/components/DamageNumber.svelte` — arc animation, variant styling
- `src/ui/components/CardCombatOverlay.svelte` — enemy attack damage wiring, spawn position for player-dealt numbers

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual: Enemy attack triggers red damage number near player HP bar
- [ ] Visual: Arc trajectory — number moves sideways AND downward, not straight up
- [ ] Visual: Player-dealt damage spawns to side of enemy, not on enemy center
- [ ] Visual: Two distinct color styles (red for player-hit, white/yellow for enemy-hit)

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

For arc animation: disable the `data-pw-animations` attribute ONLY after triggering a damage event so you can catch the number mid-arc. Or use a slow-motion CSS override to inspect the trajectory.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
