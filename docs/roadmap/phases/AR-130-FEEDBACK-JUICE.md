# AR-130: Combat Feedback & Juice Fixes

**Source:** docs/COMBAT-UX-AUDIT.md (C-5, H-14, M-4, M-17, M-20, L-2, L-5, L-6, L-8, L-9, L-13)
**Priority:** Critical + High
**Estimated complexity:** Medium

## Overview

Coordinate visual feedback systems, fix near-death visual consistency, add damage number jitter, compress Quick Play animations, and suppress feedback clutter during quiz.

## Sub-steps

### 1. Near-death Phaser canvas coordination (C-5)
**File:** `src/game/scenes/CombatScene.ts`

Add a method `setNearDeath(active: boolean)` that applies a red vignette overlay to the Phaser canvas:
```typescript
setNearDeath(active: boolean): void {
  if (!this.vignetteGfx) return
  if (active) {
    this.vignetteGfx.clear()
    this.vignetteGfx.fillStyle(0xaa0000, 0.15)
    // Draw a radial vignette (dark edges)
    this.vignetteGfx.fillRect(0, 0, this.scale.width, this.scale.height)
    this.vignetteGfx.setVisible(true)
  } else {
    this.vignetteGfx.setVisible(false)
  }
}
```

**File:** `src/ui/components/CardCombatOverlay.svelte`

Call this method when `isNearDeath` changes:
```typescript
$effect(() => {
  const scene = getCombatScene()
  scene?.setNearDeath(isNearDeath)
})
```

### 2. Feedback priority suppression during quiz (H-14 partial)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Suppress non-essential feedback overlays during quiz (`cardPlayStage === 'committed'`):
- Wow factor overlay: already shows only during `cardPlayStage !== 'committed'` — verify
- Synergy flash: gate with `{#if synergyFlashText && cardPlayStage !== 'committed'}`
- Screen edge pulse: gate with `{#if comboCount >= 4 && cardPlayStage !== 'committed'}`

### 3. Damage number position jitter (M-4 / L-2)
**File:** `src/ui/components/DamageNumber.svelte`

Add random X offset to damage numbers to prevent stacking:
```typescript
const jitterX = (Math.random() - 0.5) * 50  // -25px to +25px
```
Apply via inline style `left: calc(50% + {jitterX}px)`.

### 4. Quick Play animation compression (M-4)
**File:** `src/ui/components/CardCombatOverlay.svelte`

In `handleCastDirect()`, use shorter animation durations:
```typescript
const QP_REVEAL = 100
const QP_SWOOSH = 150
const QP_IMPACT = 150
const QP_DISCARD = 100
// Total: 500ms instead of 1000ms
```

Replace the nested setTimeout chain with these shorter values. Keep the Charge (quiz) animations at their original durations.

### 5. Reshuffle indicator text (M-17)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add a "Reshuffling..." text label to the reshuffle animation zone:
```html
{#if showReshuffle}
  <div class="reshuffle-fly-zone">
    <div class="reshuffle-label">Reshuffling...</div>
    {#each Array(reshuffleCardCount) as _, i}
      <div class="reshuffle-fly-card" style="animation-delay: {i * 40}ms"></div>
    {/each}
  </div>
{/if}
```

### 6. HP number text pulse at critical (M-20)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Add `hp-critical` class to the HP text element when critical:
```html
<span class="player-hp-text" class:hp-critical-text={isHpCritical}>
```
CSS:
```css
.hp-critical-text {
  color: #ef4444;
  animation: hpCriticalPulse 1.2s infinite ease-in-out;
}
```

### 7. Charge Play distinct animation (L-8)
**File:** `src/ui/components/CardCombatOverlay.svelte`

In `handleAnswer` (correct Charge play), add a particle burst effect after the reveal phase:
```typescript
juiceManager.fire({
  ...
  isCritical: speedBonus,  // already done
})
```
The juice manager already fires particles for critical hits. Just ensure the `isCritical` flag triggers a visually distinct burst. No code change needed if already handled — verify.

### 8. End Turn pulse suppression during animation (L-9)
**File:** `src/ui/components/CardCombatOverlay.svelte`

Change the pulse condition to exclude committed state:
```typescript
class:end-turn-pulse={!endTurnDisabled && cardPlayStage !== 'committed' && (apCurrent === 0 || !hasPlayableCards)}
```

### 9. End Turn visual nudge when AP remains (L-13)
**File:** `src/ui/components/CardCombatOverlay.svelte`

When `apCurrent > 0 && hasPlayableCards`, slightly dim the End Turn button:
```css
.end-turn-btn.has-ap-remaining {
  opacity: 0.6;
}
```
Add class: `class:has-ap-remaining={apCurrent > 0 && hasPlayableCards && !endTurnDisabled}`

## Acceptance Criteria
- [ ] Near-death state applies red vignette to Phaser canvas
- [ ] Synergy flash and screen edge pulse suppressed during quiz
- [ ] Damage numbers have X jitter to prevent stacking
- [ ] Quick Play animation is 500ms total (was 1000ms)
- [ ] "Reshuffling..." text appears during deck reshuffle
- [ ] HP number text pulses red at critical HP
- [ ] End Turn pulse suppressed during card animation
- [ ] End Turn dimmed when AP remains

## Files Affected
- `src/game/scenes/CombatScene.ts`
- `src/ui/components/CardCombatOverlay.svelte`
- `src/ui/components/DamageNumber.svelte`

## Verification Gate
- `npm run typecheck` passes
- `npm run build` passes
- Visual inspection: near-death state, damage numbers, Quick Play speed, reshuffle
