---
status: pending
delete-after-implementation: true
priority: quick-win
effort: S
impact: medium-high
owner-agent: game-logic
depends-on: none
---

# Turn Transition Breathing Room

## What It Is

A 300–500ms visual "beat" between player turn end and enemy turn start, and vice versa. Not a loading screen — a brief atmospheric inhale that signals the phase change and gives the player a moment to register what just happened.

## Why It Matters

Turn changes currently fire instantly with no visual transition. The absence of a beat makes the game feel mechanical and rushed. A brief pause with subtle environmental response creates tension on the enemy turn start ("something is about to happen") and relief on the player turn start ("I'm back in control"). It costs almost nothing in real time.

## Current State

- Turn changes fire immediately — no visual transition exists anywhere in `CombatScene.ts`
- `this.vignetteGfx` (depth 1) is a `Phaser.GameObjects.Graphics` object created at lines 618–626 and redrawn on resize at lines 507–526. It is filled once with gradient rects and never modified at runtime — its alpha is always 1. No per-turn alpha mutations exist.
- `this.nearDeathVignette` (depth 3) has alpha-0 default and is pulsed only for low HP — unrelated to turns.
- `juiceManager.ts` declares `'turn-chime'` as a `JuiceSoundEvent` (line 12) and routes it through `emitSound()` (line 37) → `playCardAudio()`. It is declared but never called anywhere.
- `EnemySpriteSystem.container` is a `Phaser.GameObjects.Container` tweened extensively for hit/attack/death/entry — but no turn-transition pulse exists.
- `CombatAtmosphereSystem` back and front emitters have a `frequency` field (set at lines 123–156) that is configurable but never mutated after `start()`.
- `isTurboMode()` (from `src/utils/turboMode.ts`) returns true when headless sim is running. All transition tweens must be no-ops in turbo mode.

## Implementation Spec

### Files to Modify

- `src/game/scenes/CombatScene.ts` — add two public methods: `playPlayerToEnemyTransition()` and `playEnemyToPlayerTransition()`
- `src/services/juiceManager.ts` — add `fireTurnTransition(direction)` convenience wrapper (optional; the scene may call `emitSound` directly)

### Files to Create

None — all within existing files.

### Technical Details

#### Player Turn → Enemy Turn (300ms total budget)

Call site: wherever the orchestration layer signals end-of-player-turn. Add `playPlayerToEnemyTransition()` to `CombatScene` and call it from that hook before enemy logic runs.

```typescript
/** Called at the end of the player's turn, before enemy phase begins. */
public playPlayerToEnemyTransition(): void {
  if (this.reduceMotion || isTurboMode()) {
    // Reduce-motion: still insert a timing gap so UI has a beat to breathe
    return
  }

  // 1. Vignette tighten — overlay a new temporary graphics at depth 2,
  //    fade in alpha 0 → 0.15 over 200ms then hold until enemy turn starts.
  //    Do NOT modify vignetteGfx (it is redrawn on resize; modifying alpha
  //    during resize would cause a flash). Instead create a transient rect.
  const w = this.scale.width
  const h = this.scale.height
  const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setDepth(2)
  this.tweens.add({
    targets: overlay,
    alpha: 0.15,
    duration: 200,
    ease: 'Sine.easeIn',
    onComplete: () => {
      // Hold for remaining 100ms, then release overlay on enemy turn
      // (caller destroys via returned ref, or use a flag)
    },
  })

  // 2. Enemy awakening pulse — container scale 1.0 → 1.02 → 1.0 over 300ms
  this.tweens.add({
    targets: this.enemySpriteSystem.getContainer(),
    scaleX: 1.02,
    scaleY: 1.02,
    duration: 150,
    yoyo: true,
    ease: 'Sine.easeInOut',
  })

  // 3. Particle spike — temporarily double front emitter frequency for 300ms
  //    (if atmosphere is active and particles are enabled)
  const frontEmitter = (this.atmosphereSystem as any).frontEmitter as
    Phaser.GameObjects.Particles.ParticleEmitter | null
  if (frontEmitter) {
    const origFreq: number = (frontEmitter as any).frequency
    frontEmitter.setFrequency(Math.round(origFreq / 2))  // halving interval = double rate
    this.time.delayedCall(300, () => { frontEmitter.setFrequency(origFreq) })
  }

  // 4. Sound
  emitSound('turn-chime')

  // Return overlay ref so caller can destroy after enemy turn resolves
  return overlay  // adjust signature to return the ref
}
```

Note on particle emitter frequency: Phaser `ParticleEmitter.frequency` is the ms interval between emissions. A lower value = more frequent. Halving it doubles the emission rate. The field is accessible via `(emitter as any).frequency` until Phaser typings expose it.

Note on the returned overlay: change the return type to `Phaser.GameObjects.Rectangle` and destroy it inside `playEnemyToPlayerTransition()` or after a fixed 500ms timeout if no follow-up is called.

#### Enemy Turn → Player Turn (200ms total budget)

```typescript
/** Called at the start of the player's turn, after enemy phase completes. */
public playEnemyToPlayerTransition(vigOverlay?: Phaser.GameObjects.Rectangle): void {
  if (vigOverlay) {
    this.tweens.add({
      targets: vigOverlay,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => vigOverlay.destroy(),
    })
  }

  if (this.reduceMotion || isTurboMode()) return

  // Card hand "ready" pulse — dispatch a DOM event; CardHand.svelte listens
  // and plays a CSS keyframe: scale 0.98 → 1.0 on each card with 40ms stagger.
  window.dispatchEvent(new CustomEvent('rr:player-turn-start'))

  // Brief warm tint flash on the player HP area — reuse pulseFlash with low alpha
  this.pulseFlash(0xFFEEAA, 0.06, 200)
}
```

The `rr:player-turn-start` event is dispatched from the Phaser scene side. `CardHand.svelte` listens via `window.addEventListener` in an `onMount` / `$effect` and applies a CSS class `turn-ready` with a brief scale keyframe (0.98 → 1.0, 200ms, Sine ease) to each `.card-slot` element with a `40ms * index` delay.

#### Timing Summary

| Phase | Action | Duration |
|---|---|---|
| Player→Enemy | Vignette fade in | 200ms |
| Player→Enemy | Enemy sprite pulse | 300ms (concurrent) |
| Player→Enemy | Particle spike | 300ms (concurrent) |
| Player→Enemy | Sound chime | T+0ms |
| Enemy→Player | Vignette fade out | 200ms |
| Enemy→Player | Card hand pulse | 200ms (CSS, concurrent) |
| Enemy→Player | Warm flash | 200ms (concurrent) |

Total wall-clock addition per full turn pair: **300ms** (transitions overlap with natural pauses).

### Integration Points

- The orchestration layer that currently calls enemy logic directly must be wrapped to call `playPlayerToEnemyTransition()` first, `await`/`delayedCall` the 300ms budget, then proceed.
- Find the exact call site by searching for where enemy HP is first decremented or enemy attack begins — likely in `src/services/turnManager.ts` or `src/services/encounterBridge.ts`.
- `CardHand.svelte` needs the `rr:player-turn-start` event listener and `turn-ready` CSS class. This is a Svelte-side addition; route to ui-agent if needed.

### Reduce-Motion Handling

When `this.reduceMotion` is true OR `isTurboMode()` is true:
- Skip all tweens (vignette overlay, enemy pulse, particle spike, flash)
- Skip the DOM event for card hand CSS animation
- Still call `emitSound('turn-chime')` — audio is not motion
- Insert a **0ms timing gap** (no `delayedCall` needed — the calling code proceeds immediately)

### Device Tier Handling

No tier scaling needed — all operations are tween-based on existing objects. No new render allocations. Particle frequency mutation is negligible. The vignette overlay is a single `Rectangle` drawn in 1ms.

## Verification

1. Start a combat encounter and manually end a turn.
2. Observe: a slight darkening of the vignette edge simultaneously with the enemy sprite doing a subtle scale pulse. The chime sound fires.
3. After the enemy takes its action, observe: the vignette lightens and the card hand does a brief scale-up.
4. Confirm no added wall-clock time beyond the 300ms budget (use browser performance tab or add `console.time` guards).
5. Confirm `isTurboMode()` path skips all tweens — run the headless sim and verify no Phaser tween errors in output.
6. Toggle reduce-motion in settings; confirm no visual transitions fire but audio still plays.

## Effort Estimate

**S (Small).** All target objects already exist. No new systems, no new files. The largest risk is finding the exact call site in the orchestration layer to insert the 300ms gate.
