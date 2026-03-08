# CR-05: Game Juice

> **Goal:** Feedback effects for correct/wrong answers that make the game FEEL incredible. The correct answer juice stack fires within 200ms and combines haptics, screen flash, damage numbers, card animation, enemy hit reaction, sound stubs, and combo counter visuals. Wrong answer feedback is intentionally muted to avoid shaming the learner.

## Overview

| Field | Value |
|-------|-------|
| Dependencies | CR-01 (Card Foundation), CR-02 (Encounter Engine), CR-03 (Combat Scene), CR-04 (Card Hand UI) |
| Estimated Complexity | Medium (1-2 days) |
| Priority | P0 — Core Prototype |

This is where Terra Miner differentiates from every other educational game. Getting an answer right in Duolingo feels like nothing — a green checkmark. Getting an answer right in Terra Miner should feel like landing a critical hit in a fighting game. The juice stack is the core dopamine loop that makes learning addictive (GAME_DESIGN.md Section 13, 03_UX_IMPROVEMENTS.md Section 3).

**Anti-shame principle (GAME_DESIGN.md Section 11):** Wrong answer feedback is deliberately muted. No red X, no "WRONG!" text, no screen shake, no damage numbers. The ABSENCE of positive juice IS the feedback.

---

## Sub-steps

### 1. Create JuiceManager service

**File:** `src/services/juiceManager.ts`

Create a central orchestrator for the juice effect sequence. It coordinates timing across Phaser (screen effects, particles, enemy reactions) and Svelte (card animations, damage numbers) and native (haptics).

```typescript
export interface JuiceEvent {
  type: 'correct' | 'wrong'
  damage?: number              // For correct: the damage/effect value dealt
  isCritical?: boolean         // Speed bonus achieved
  comboCount: number           // Current combo count (1-5)
  cardScreenPosition: { x: number, y: number }  // Where the card was on screen
  enemyScreenPosition: { x: number, y: number }  // Where the enemy is
}

export class JuiceManager {
  private phaserScene: Phaser.Scene | null = null
  private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  /** Connect to the active CombatScene for Phaser-side effects */
  setScene(scene: Phaser.Scene): void

  /** Fire the full juice stack for a correct or wrong answer */
  fire(event: JuiceEvent): void

  /** Cleanup on scene shutdown */
  destroy(): void
}
```

**Timing orchestration for correct answer (all within 200ms window):**
```
T+0ms:   Haptic pulse fires
T+0ms:   Screen flash begins (white overlay)
T+0ms:   Card launch animation starts (CSS/Svelte)
T+50ms:  Damage number spawns, begins arc trajectory
T+100ms: Card dissolves into particles toward enemy
T+150ms: Screen flash fades out
T+150ms: Damage number impacts enemy position
T+150ms: Enemy knockback begins
T+150ms: Enemy HP bar starts depleting
T+200ms: Enemy knockback returns to rest
T+300ms: Particles fully dissipated
T+400ms: HP bar tween complete
```

Export a singleton instance:
```typescript
export const juiceManager = new JuiceManager()
```

### 2. Correct answer juice — Haptic pulse

**File:** `src/services/juiceManager.ts`

Use the existing `src/services/hapticService.ts` (already in codebase).

- On correct answer: call `tapHeavy()` — single sharp pulse
- On critical (speed bonus): call `tapHeavy()` twice with 80ms delay
- On perfect turn (5/5 combo): call `tapHeavy()` three times with 80ms delays
- Haptics fire at T+0ms (first thing in the juice stack)
- No-op on web/desktop (hapticService already handles this gracefully)

### 3. Correct answer juice — Screen flash

**File:** `src/services/juiceManager.ts` (triggers) + `src/game/scenes/CombatScene.ts` (renders)

- Create a full-screen white rectangle in CombatScene, initially invisible (`alpha: 0`)
- On correct: set `alpha: 0.3`, tween to `alpha: 0` over 150ms
- On critical: set `alpha: 0.45`, tween to `alpha: 0` over 200ms
- Use Phaser tween (GPU-accelerated), not CSS overlay
- The rectangle should be at max depth (renders on top of everything in the Phaser scene)
- Reuse the same rectangle object (don't create/destroy)

### 4. Correct answer juice — Damage numbers

**File:** `src/ui/components/DamageNumber.svelte`

Create a floating damage number component that arcs from card position to enemy position.

**Visual:**
- Font: bold, 24px (normal) or 32px (critical)
- Color: gold (#FFD700) for normal, red (#E74C3C) for critical
- Text shadow for readability: 2px black shadow
- Shows the damage/effect value (e.g., "12", "HEAL 8", "SHIELD 15")

**Animation (CSS keyframes):**
```
- Start: at card's screen position
- Arc: parabolic path (CSS cubic-bezier or JS animation)
  - Horizontal: linear from card X to enemy X
  - Vertical: up 60px then down to enemy Y (parabolic)
- Impact: slight bounce at enemy position (scale 1.2 then 1.0)
- Fade: opacity 1 → 0 over last 100ms
- Total duration: 500ms
```

**Implementation:**
- Use a Svelte component with absolute positioning
- Animate via CSS `@keyframes` with `transform: translate()` for GPU acceleration
- Spawn via a reactive array in the combat overlay store
- Auto-remove from DOM after animation completes (500ms timeout)
- Support multiple simultaneous damage numbers (for multi-hit effects)

### 5. Correct answer juice — Card launch animation

**File:** `src/ui/components/CardHand.svelte` (extends card state animations from CR-04)

When a card resolves correctly:
1. Card is already in "expanded/selected" position (from CR-04)
2. Card shrinks back to collapsed size over 100ms
3. Card launches upward with streak trail:
   - `transform: translateY(-800px) rotate(15deg) scale(0.5)`
   - Duration: 300ms, ease-in
4. Streak trail: 3 semi-transparent copies of the card at decreasing opacity (0.4, 0.2, 0.1), each delayed 30ms, following the same path
5. At Y = enemy position, card dissolves into particles (triggers Phaser particle burst)

**CSS implementation:**
```css
.card-launch {
  animation: cardLaunch 300ms ease-in forwards;
}
@keyframes cardLaunch {
  0%   { transform: translateY(0) rotate(0) scale(1); opacity: 1; }
  60%  { opacity: 1; }
  100% { transform: translateY(-600px) rotate(12deg) scale(0.4); opacity: 0; }
}
```

### 6. Correct answer juice — Particle burst at enemy

**File:** `src/game/scenes/CombatScene.ts`

When damage number impacts enemy position, trigger a particle burst.

- Use the shared Phaser particle emitter (created in CR-03, capped at 50 particles)
- Burst: 30 particles from enemy center position
- Particle config:
  - Speed: 100-200 (random)
  - Angle: 0-360 (full radial)
  - Lifespan: 300ms
  - Scale: start 0.5, end 0
  - Tint: gold (#FFD700) for normal, red (#FF4444) for critical
  - Alpha: start 1, end 0
  - Gravity: slight downward (50)
- Emitter is pre-configured in `create()`, triggered via `emitter.explode(30, x, y)`

### 7. Correct answer juice — Enemy hit reaction

**File:** `src/game/scenes/CombatScene.ts`

When damage is applied to the enemy:

1. **Knockback:** Enemy sprite tweens 5px to the right over 50ms, then back over 150ms (ease-out-bounce)
2. **Red flash:** Enemy sprite tint set to 0xFF4444 for 100ms, then restored to 0xFFFFFF
3. **HP bar depletion:** Smooth tween from current HP to new HP over 400ms (ease-out)
4. **HP text update:** Waits until tween is ~80% complete, then snaps to new value

**Implementation:**
```typescript
onEnemyDamage(damage: number): void {
  // Knockback
  this.tweens.add({
    targets: this.enemySprite,
    x: this.enemySprite.x + 5,
    duration: 50,
    yoyo: true,
    ease: 'Bounce.Out'
  })
  // Red flash
  this.enemySprite.setTint(0xFF4444)
  this.time.delayedCall(100, () => this.enemySprite.clearTint())
  // HP bar tween
  this.tweens.add({
    targets: this.enemyHpFill,
    width: newHpWidth,
    duration: 400,
    ease: 'Power2'
  })
}
```

### 8. Correct answer juice — Sound stubs

**File:** `src/services/juiceManager.ts`

Create placeholder hooks for P1 sound integration. No actual audio files yet, just the event emission pattern.

```typescript
/** Sound event types for future audio integration */
export type JuiceSoundEvent =
  | 'correct-impact'
  | 'correct-critical'
  | 'wrong-fizzle'
  | 'card-draw'
  | 'enemy-hit'
  | 'enemy-death'
  | 'turn-chime'
  | 'combo-3'
  | 'combo-5'

/** Emit a sound event. Currently no-op; wire to audioService in CR-17. */
export function emitSound(event: JuiceSoundEvent): void {
  // TODO CR-17: audioManager.playEffect(event)
  if (import.meta.env.DEV) {
    console.debug(`[juice:sound] ${event}`)
  }
}
```

Call `emitSound('correct-impact')` at T+0ms of the correct juice stack. Call `emitSound('wrong-fizzle')` for wrong answers.

### 9. Correct answer juice — Combo counter visual

**File:** `src/ui/components/ComboCounter.svelte`

This creates the visual display; the combo LOGIC and multiplier are in CR-06. This step creates the visual component that CR-06 will drive.

**Combo visuals by count (from GAME_DESIGN.md Section 6):**

| Combo | Visual |
|-------|--------|
| 1 (no combo) | Nothing displayed |
| 2 | "2x" text with slight golden glow, 20px font |
| 3 | "3x" text with particle ring (8 particles orbiting), 24px font |
| 4 | "4x" text with screen edge pulse (golden vignette), 28px font |
| 5 (perfect) | "PERFECT!" text with full celebration burst, screen-wide gold particle explosion, 36px font |

**Position:** Upper area of the interaction zone (just below the display/interaction boundary), right-aligned with 16dp padding.

**`data-testid="combo-counter"`**

**Animation:**
- Each combo increment: text scales up 1.5x then settles to 1.0x over 300ms (bounce ease)
- Particle ring at 3+: 8 gold particles orbit the combo text in a 30dp radius circle, 2s rotation period
- Screen edge pulse at 4: golden gradient on left/right screen edges, 0% to 5% opacity pulse over 400ms
- Perfect turn burst at 5: 50 gold particles from center, radial burst, 500ms lifespan

**Note:** The combo counter is driven by a `comboCount` prop. CR-06 manages the state; this component only handles rendering.

### 10. Wrong answer juice — Muted feedback

**File:** `src/services/juiceManager.ts` + `src/ui/components/CardHand.svelte` + `src/ui/components/CardExpanded.svelte`

Wrong answer feedback is intentionally subdued (GAME_DESIGN.md Section 11).

**At T+0ms:**
1. **Haptic:** Gentle double-tap via `notifyWarning()` from hapticService (already exists)
2. **Sound stub:** `emitSound('wrong-fizzle')`

**Card animation (in CardHand.svelte):**
1. Card dims to 40% opacity over 200ms
2. Subtle crack pattern overlay appears (CSS pseudo-element or SVG overlay)
3. Card dissolves downward: `transform: translateY(100px) scale(0.8)`, `opacity: 0` over 400ms
4. Think "sand falling" not "glass breaking" — soft, not violent

```css
.card-fizzle {
  animation: cardFizzle 400ms ease-out forwards;
}
@keyframes cardFizzle {
  0%   { transform: translateY(0) scale(1); opacity: 0.4; filter: grayscale(0.5); }
  100% { transform: translateY(100px) scale(0.8); opacity: 0; filter: grayscale(1); }
}
```

**Correct answer reveal (in CardExpanded.svelte):**
1. After wrong answer button turns gray (from CR-04), wait 400ms
2. Correct answer slides up from bottom of the card area
3. Highlighted in gentle blue (#3498DB) background
4. Lingers for 2000ms, then fades out over 300ms
5. Text: shows the correct answer text, 16px, white on blue

**What does NOT happen on wrong answer:**
- NO screen shake
- NO red flash
- NO damage numbers
- NO enemy reaction
- NO combo-related effects
- The absence of positive juice IS the feedback

### 11. Phaser particle configuration

**File:** `src/game/scenes/CombatScene.ts`

Configure the shared particle emitter for combat juice effects.

```typescript
// In CombatScene.create():
this.particleEmitter = this.add.particles(0, 0, 'particle', {
  speed: { min: 100, max: 200 },
  angle: { min: 0, max: 360 },
  scale: { start: 0.5, end: 0 },
  alpha: { start: 1, end: 0 },
  lifespan: 300,
  gravityY: 50,
  tint: 0xFFD700,
  emitting: false,      // Don't auto-emit; use explode()
  maxParticles: 50,      // Hard cap per performance budget
})
```

**Particle texture:** Create a simple 4x4 white pixel texture in `preload()`:
```typescript
// Generate a simple white pixel texture for particles
const graphics = this.make.graphics({ x: 0, y: 0 })
graphics.fillStyle(0xFFFFFF)
graphics.fillRect(0, 0, 4, 4)
graphics.generateTexture('particle', 4, 4)
graphics.destroy()
```

**Usage patterns:**
- Correct answer burst: `emitter.setTint(0xFFD700).explode(30, enemyX, enemyY)`
- Critical hit burst: `emitter.setTint(0xFF4444).explode(40, enemyX, enemyY)` (more particles, red)
- Perfect turn: `emitter.setTint(0xFFD700).explode(50, screenCenterX, screenCenterY)` (max particles, centered)
- Heal effect: `emitter.setTint(0x2ECC71).explode(15, playerHpX, playerHpY)` (fewer, green, at player HP)

### 12. Haptics integration

**File:** `src/services/juiceManager.ts`

Map juice events to existing haptic service functions from `src/services/hapticService.ts`:

| Event | Haptic Call |
|-------|------------|
| Correct answer | `tapHeavy()` |
| Critical (speed bonus) | `tapHeavy()` + 80ms delay + `tapHeavy()` |
| Wrong answer | `notifyWarning()` |
| Card tap (select) | `tapLight()` |
| Combo 3 milestone | `tapMedium()` |
| Combo 5 (perfect) | `tapHeavy()` x3, 80ms delays |
| Enemy death | `tapHeavy()` |

Web/desktop: all haptic calls are no-ops (hapticService already wraps in try/catch).

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | JuiceManager service created and exported as singleton | Import check, TypeScript compilation |
| 2 | Correct answer fires full juice stack within 200ms | Add timing logs, verify via console |
| 3 | Screen flash: white overlay appears and fades over 150ms | Playwright screenshot mid-flash (use sleep) |
| 4 | Damage numbers: arc from card to enemy, gold text | Visual inspection during combat |
| 5 | Card launch: upward with streak trail effect | Visual inspection |
| 6 | Particle burst: 30 gold particles at enemy on impact | Visual inspection, particle count via debug |
| 7 | Enemy knockback: 5px displacement and return | Visual inspection |
| 8 | Enemy HP bar: smooth 400ms depletion tween | Visual inspection |
| 9 | Sound stubs: console.debug output in dev mode | Check console for `[juice:sound]` messages |
| 10 | Wrong answer: card dims, cracks, dissolves downward | Visual inspection |
| 11 | Wrong answer: correct answer reveals in blue after 400ms | Visual inspection + timing |
| 12 | Wrong answer: NO screen flash, NO shake, NO damage numbers | Verify absence of effects |
| 13 | Combo counter visual renders at position with correct text | data-testid check + visual |
| 14 | Particle emitter capped at 50 concurrent | Spam 5 correct answers rapidly, verify no overflow |
| 15 | Haptics fire on correct/wrong (verified via device or console stub) | Test on device or verify function calls |

---

## Verification Gate

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] Correct answer juice stack fires all 7 elements (haptic, flash, numbers, card anim, particles, enemy reaction, sound stub) — verified via console logs + Playwright screenshot
- [ ] Wrong answer fires muted feedback only (haptic, card fizzle, answer reveal) — verified via screenshot
- [ ] No screen shake or red flash on wrong answer — verified via screenshot comparison
- [ ] Particle count stays <= 50 during rapid correct answers — verified via `browser_evaluate`
- [ ] 60fps maintained during juice animations — verified via performance timing
- [ ] Combo counter visual displays correctly for counts 2, 3, 4, 5
- [ ] No console errors during juice sequences
- [ ] Haptic calls map to correct service functions (verified via mock/spy in unit test)

---

## Files Affected

| Action | File |
|--------|------|
| CREATE | `src/services/juiceManager.ts` |
| CREATE | `src/ui/components/DamageNumber.svelte` |
| CREATE | `src/ui/components/ComboCounter.svelte` |
| MODIFY | `src/game/scenes/CombatScene.ts` — Add screen flash rect, particle emitter config, enemy hit reaction methods |
| MODIFY | `src/ui/components/CardHand.svelte` — Add card-launch and card-fizzle CSS animations |
| MODIFY | `src/ui/components/CardExpanded.svelte` — Add correct answer reveal for wrong answers |
| MODIFY | `src/ui/components/CombatOverlay.svelte` — Wire JuiceManager.fire() into card resolution flow |
