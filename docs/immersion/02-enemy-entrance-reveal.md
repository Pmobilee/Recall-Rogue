---
status: pending
delete-after-implementation: true
priority: mid-term
effort: M
impact: medium-high
owner-agent: game-logic
depends-on: none
---

# Enemy Entrance Reveal

## What It Is

When a new encounter begins, the enemy emerges from shadow and depth rather than popping in abruptly. A deliberate reveal sequence — scale, alpha, and tint — building anticipation before combat starts.

## Why It Matters

First impressions of an enemy are lost in the current implementation. Players never get a moment to register what they're fighting. A cinematic reveal is the single biggest return on a brief animation investment: it sets tone, builds dread for elites/bosses, and gives the player a beat to read the enemy before cards are dealt.

## Current State

`EnemySpriteSystem.playEntry()` (line 928) already exists and IS called from `CombatScene.playEncounterEntry()` (line 1836) via a 1800ms `delayedCall` after the scene fades in. The current behavior:

- Sets container alpha to 0, scale to `startScale` (0.1 for commons, 0.05 for bosses)
- Tweens to overshoot scale (1.15× common, 1.25× boss) over 300/400ms with `Back.Out` ease
- Triggers a micro/medium screen shake on landing
- Settles back to scale 1.0 over 180/250ms with `Sine.easeInOut`
- Then calls `startIdle()`

This is a **pop-in** effect — small to big with a bounce. It does not do shadow-to-light reveal, no tint clearing, no vertical position shift. The `DepthLightingSystem` is not coordinated with the entry sequence at all. The `applyAtmosphereTint()` call happens in `setEnemy()` (line 980 area) before the 1800ms entry delay, so the sprite sits at full tint before entry.

**The spec below replaces `playEntry()` with a new `playEntranceReveal()` method and updates the call site in `CombatScene.playEncounterEntry()`.**

## Implementation Spec

### Files to Modify

- `src/game/systems/EnemySpriteSystem.ts` — add `playEntranceReveal(isBoss: boolean, onComplete?: () => void)` method; keep `playEntry()` as deprecated fallback
- `src/game/scenes/CombatScene.ts` — in `playEncounterEntry()` (line 1836), replace the call to `this.enemySpriteSystem.playEntry(isBoss)` with `this.enemySpriteSystem.playEntranceReveal(isBoss, () => { /* idle starts inside */ })`

### Files to Create

None.

### Technical Details

#### Standard Reveal (commons and elites, 800ms after the 1800ms scene fade)

All values are in container-local space. The container is at `(baseX, baseY)` set by `setSprite()`.

**Initial state** (set immediately before tween chain begins):
```
container.setAlpha(0)
container.setScale(0.3)
container.y = baseY - 40      // pushed 40px higher ("behind" the scene)
container.setTint(0x000000)   // full shadow — use mainSprite.setTint() not container
```

Note: `Phaser.GameObjects.Container` does not have `setTint()`. Apply `setTint(0x000000)` to `mainSprite`, `shadowSprite`, and each `outlineSprites[i]` individually. Use alpha on the outlines to hide them initially (they're black outlines on a black tint — invisible either way, so this is fine).

**Tween chain (single `scene.tweens.chain` call):**

```typescript
this.scene.tweens.chain({
  tweens: [
    {
      targets: this.container,
      alpha: 1,
      scaleX: 1.05,
      scaleY: 1.05,
      y: this.baseY,
      duration: 650,
      ease: 'Sine.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        // Gradually clear tint on mainSprite from 0x000000 toward atmosphere tint
        // Progress 0→1 over the 650ms phase
        const p = tween.progress
        const targetTint = this._currentAtmosphereTint ?? 0xffffff
        // Lerp from black (0x000000) to targetTint
        const r = Math.round(((targetTint >> 16) & 0xff) * p)
        const g = Math.round(((targetTint >> 8)  & 0xff) * p)
        const b = Math.round(((targetTint)        & 0xff) * p)
        const lerpedTint = (r << 16) | (g << 8) | b
        this.mainSprite?.setTint(lerpedTint)
      },
    },
    {
      targets: this.container,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 150,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Restore full atmosphere tint (in case lerp left a rounding artifact)
        if (this._currentAtmosphereTint) {
          this.mainSprite?.setTint(this._currentAtmosphereTint)
        } else {
          this.mainSprite?.clearTint()
        }
        // Micro shake on full reveal
        if (this.scene?.scene?.isActive()) {
          ;(this.scene as any).screenShake?.trigger('micro')
        }
        this.startIdle()
        onComplete?.()
      },
    },
  ],
})
```

Total common entrance: **800ms** (650ms rise + 150ms settle).

#### Boss Variant (1200ms)

Same tween chain but with adjusted values and a mid-reveal hold:

```
Initial: alpha=0, scale=0.2, y=baseY-60, tint=0x000000

Phase 1 — Slow rise (700ms, Sine.easeOut):
  alpha: 0 → 1
  scale: 0.2 → 0.85
  y: baseY-60 → baseY-8
  tint: lerp 0x000000 → 80% of atmosphereTint

Phase 2 — Hold (200ms, no movement):
  Achieved by a short tween with duration:200, ease:'Linear' targeting same values.
  During this hold: pulse DepthLightingSystem light intensity (see Integration Points).

Phase 3 — Final reveal (300ms, Back.Out):
  scale: 0.85 → 1.0
  y: baseY-8 → baseY
  tint: 80% → 100% atmosphere tint
  onComplete: heavy screen shake, then startIdle()
```

Heavy screen shake call for boss: `(this.scene as any).screenShake?.trigger('heavy')` at completion.

Optional camera zoom (boss only):
```typescript
const cam = (this.scene as any).cameras?.main
if (cam) {
  const baseZoom = cam.zoom
  this.scene.tweens.add({
    targets: cam,
    zoom: baseZoom * 1.03,
    duration: 700,
    yoyo: true,
    ease: 'Sine.easeInOut',
  })
}
```

#### DepthLightingSystem Coordination

Add a method to `DepthLightingSystem`:

```typescript
/**
 * Animate all point light intensities from 0 to their configured base values
 * over the specified duration. Used during enemy entrance to fade lighting in.
 * @param durationMs Total fade-in duration in milliseconds
 */
animateLightsIn(durationMs: number): void {
  if (!this.enabled || !this.activePipeline) return
  // Store base intensities, zero them, then restore via per-frame lerp
  const bases = this.pointLights.map(pl => pl.baseIntensity)
  this.pointLights.forEach(pl => { pl.baseIntensity = 0 })
  const startTime = this.scene.time.now
  const timer = this.scene.time.addEvent({
    delay: 16,  // ~60fps
    loop: true,
    callback: () => {
      const elapsed = this.scene.time.now - startTime
      const t = Math.min(elapsed / durationMs, 1)
      this.pointLights.forEach((pl, i) => {
        pl.baseIntensity = bases[i] * t
      })
      this.pushPointLightsToShader(this.scene.time.now / 1000)
      if (t >= 1) {
        timer.destroy()
        // Restore exact base values
        this.pointLights.forEach((pl, i) => { pl.baseIntensity = bases[i] })
      }
    },
  })
}
```

Call from `CombatScene.playEncounterEntry()` right after `this.enemySpriteSystem.playEntranceReveal(...)`:
```typescript
this.depthLightingSystem.animateLightsIn(isBoss ? 1200 : 800)
```

Note: `pushPointLightsToShader` is currently private. Change it to `private pushPointLightsToShader` → either expose as `public` or move `animateLightsIn` into `DepthLightingSystem` itself (preferred — keeps shader state internal).

### Integration Points

- **Call site:** `CombatScene.playEncounterEntry()` at line 1836. The `time.delayedCall(1800, ...)` callback currently calls `this.enemySpriteSystem.playEntry(isBoss)`. Replace with `playEntranceReveal(isBoss)`.
- **Atmosphere tint access:** `EnemySpriteSystem` already stores the current atmosphere tint in `this._currentAtmosphereTint` (set by `applyAtmosphereTint()`, line 241). The tween's `onUpdate` lerps toward this value. If it's null, lerp toward `0xffffff` (neutral).
- **`startIdle()` timing:** `startIdle()` is called at the end of the tween chain, inside `onComplete`. It guards against `this.isAnimating` — ensure `isAnimating` is set to `true` at the start of `playEntranceReveal()` and cleared at the start of `startIdle()`.
- **Reduce-motion path:** If `this.reduceMotion`, call the existing `playEntry()` behavior (instant appear + `startIdle()`). Or set alpha/scale/tint to final values immediately and call `startIdle()`.

### Reduce-Motion Handling

```typescript
if (this.reduceMotion) {
  this.container.setAlpha(1).setScale(1)
  this.container.setPosition(this.baseX, this.baseY)
  if (this._currentAtmosphereTint) {
    this.mainSprite?.setTint(this._currentAtmosphereTint)
  } else {
    this.mainSprite?.clearTint()
  }
  this.startIdle()
  onComplete?.()
  return
}
```

`DepthLightingSystem.animateLightsIn()` should also short-circuit: if `!this.enabled`, call `pushPointLightsToShader(0)` directly to set full intensity instantly.

### Device Tier Handling

No tier branching needed. The entrance is a single tween chain on one container — cost is negligible on all tiers. The `DepthLightingSystem.animateLightsIn()` is only active on mid/flagship (the `this.enabled` check already gates low-end devices).

## Verification

1. Start a new combat encounter. Observe the enemy fading in from shadow over ~800ms with a subtle scale rise from 0.3×.
2. Verify the tint clears progressively — the sprite goes from silhouette to full color during the reveal.
3. Verify a micro screen shake fires at full reveal for commons, heavy for bosses.
4. Start a boss encounter. Verify the slower 1200ms reveal with the mid-reveal pause at 85% scale.
5. Verify `startIdle()` begins cleanly after the entrance completes (no stutter, no double-bob at start).
6. Toggle reduce-motion. Verify the sprite appears instantly with no animation but correct tint.
7. Run the headless sim — verify no Phaser errors related to tweens running on destroyed scenes.

## Effort Estimate

**M (Medium).** The tween chain logic is straightforward, but three integration points need care: tint lerp in `onUpdate`, `DepthLightingSystem` light fade, and ensuring `isAnimating` state doesn't conflict with the existing entry guard in `startIdle()`. The boss hold phase adds a second tween to the chain. Expect 2–3 hours including verification.
