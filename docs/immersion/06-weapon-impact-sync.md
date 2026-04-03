---
status: pending
delete-after-implementation: true
priority: quick-win
effort: S
impact: high
owner-agent: game-logic
depends-on: none
---

# Weapon-Enemy Impact Timing Choreography

## What It Is

Synchronize the sword slash and tome cast animations so the enemy hit reaction fires at the
weapon's contact frame — not independently — and add 4-6 contact spark particles spawned at
the enemy's position at the moment of impact.

## Why It Matters

The weapon visually reaches the enemy and then the enemy reacts to something that already
finished. That temporal disconnect breaks the illusion of contact. This is a quick-win fix
because all the assets and systems are already in place — the only change is the sequencing.

## Current State

Weapon animations and enemy hit reactions both exist but fire on independent timelines:

`CombatScene.ts` lines 1453-1466, `playPlayerAttackAnimation()`: calls
`playSwordSlash(enemyX, enemyY)` (250ms animation) and simultaneously starts a tiny bob
tween on the enemy container (y−8, 110ms yoyo). The sword's 250ms slash completes and
triggers micro screen shake. Separately, `juiceManager.fireCorrect()` fires
`onEnemyHit` at T+150ms from its own start, which is NOT synchronized with the weapon
completion.

Current timeline (sword): T+0ms weapon slash begins + bob tween on enemy starts →
T+150ms juiceManager fires enemy hit reaction independently → T+250ms sword reaches apex +
micro shake fires → T+400ms sword fades out, enemy already mid-reaction.

Tome cast: T+0ms arm rises (250ms) → T+250ms glow burst peak (80ms) → T+330ms radial
pulse. Enemy hit fires from juiceManager independently at T+150ms — before the tome
even finishes its upward arc.

`CombatParticleSystem.burstImpact()` exists (4px squares, radial 0-360°, speed 60-160,
400ms, tintable) but is not spawned at the weapon-enemy contact point. It fires via
juiceManager at an unrelated position/time.

## Implementation Spec

### Files to Modify

- `src/game/systems/WeaponAnimationSystem.ts` — add `onImpact?: () => void` callback
  parameter to `playSwordSlash()` and `playTomeCast()`. Fire the callback at the contact
  frame (defined below per weapon type).
- `src/game/scenes/CombatScene.ts` — restructure `playPlayerAttackAnimation()` to pass an
  `onImpact` callback into the weapon animation. Move the enemy hit reaction call and impact
  spark spawn into that callback. Remove the independent 110ms enemy bob tween (enemy
  `playHit()` handles knockback).
- `src/services/juiceManager.ts` — add `onWeaponImpact` callback. `fireCorrect()` calls
  `onWeaponImpact(enemyX, enemyY, cardChainColor)` instead of calling `onEnemyHit` directly
  at T+150ms. `onWeaponImpact` is satisfied by the weapon animation's `onImpact`, which then
  fires enemy hit + sparks. For non-attack cards (block, other), `onWeaponImpact` can still
  fire at the existing T+150ms fallback.

### Files to Create (if any)

None.

### Technical Details

**Contact frame definitions:**

Sword slash contact frame = end of the 250ms slash tween (perspective reaches 1,
foreshortening maximum — the blade is at its furthest forward point). The `onImpact`
callback fires at T+250ms inside `playSwordSlash()` using the tween's `onComplete` handler.

Tome cast contact frame = glow burst peak = T+250ms arm rise + T+80ms glow = T+330ms
inside `playTomeCast()`. Fire `onImpact` in the `onComplete` of the glow burst tween.

Shield raise has no enemy contact — no `onImpact` needed. juiceManager's block path is
unchanged.

**Impact spark particles (new):**

Spawn via `CombatParticleSystem.burstDirectional()` or a new `burstSparks(x, y, color,
count)` convenience method. Position: enemy center (the same `enemyX, enemyY` passed to
`playSwordSlash`). Properties:
- Count: 4-6 particles
- Shape: 1.5px squares (scale 1.5 → 0 over lifespan)
- Speed: 80-150
- Angle spread: 120° fan, centered in the direction away from the player (rightward, so
  roughly 270-30° i.e. the fan faces right and slightly up/down)
- Lifespan: 300ms
- Gravity: 40 (slight downward drift)
- Color: white/yellow (`0xFFFF88`) for sword; chain color (passed from juiceManager via the
  `onWeaponImpact` callback) for tome

The 4-6 count is well within the existing particle budget on all device tiers.

**Removal of redundant enemy bob tween:**

Delete the `scene.tweens.add({ targets: enemyContainer, y: y−8, duration: 110, yoyo: true
})` line from `playPlayerAttackAnimation()`. The existing `EnemySpriteSystem.playHit()`
already applies knockback (configurable X/Y offset, ~95ms), rotation (~−12°), and scale
(~1.06×) with elastic spring-back — this is the correct and richer version. The old
110ms bob was a weak substitute that fires out of sync.

**Screen shake timing:**

The micro shake that currently fires at sword's apex (T+250ms) should remain at that
timing — it is already at the contact frame, so it stays correct. No change needed there.
For the tome, confirm the existing shake fires at or after T+330ms (the glow burst peak);
adjust if it fires earlier.

**Revised sword timeline (after fix):**

- T+0ms: Sword slash begins. Screen flash fires (unchanged).
- T+250ms: Sword reaches apex. `onImpact` fires → `enemy.playHit()` starts knockback +
  rotation + scale → 4-6 spark particles spawn at enemy center → micro screen shake.
- T+250ms: Damage number spawns (moved from T+50ms, or keep at T+50ms if it reads better —
  preserve existing timing for the number, only move the hit reaction and sparks).
- T+350ms-T+400ms: Sword fades out. Enemy in knockback.
- T+600ms-T+650ms: Enemy elastic spring-back to idle.

Note: the damage number at T+50ms (juiceManager default) shows before the visual hit, which
is conventional in card games (numbers appear on card activation, not on sprite contact).
Keep the damage number timing unchanged. Only the enemy hit reaction and impact sparks move
to T+250ms.

**Revised tome timeline (after fix):**

- T+0ms: Arm begins rising. Screen flash fires (unchanged).
- T+50ms: Damage number spawns (unchanged).
- T+330ms: Glow burst peaks. `onImpact` fires → `enemy.playHit()` → chain-colored spark
  particles at enemy center → screen shake (if not already firing here).
- T+400ms-T+530ms: Arm drops back. Radial pulse ring expands (already fires around this
  time from existing code — confirm it stays post-impact for visual coherence).
- T+600ms+: Enemy spring-back.

### Integration Points

`juiceManager.fireCorrect()` currently calls `onEnemyHit` at T+150ms unconditionally. After
this change, for attack cards it should NOT call `onEnemyHit` at T+150ms — instead the weapon
animation's `onImpact` callback (registered via `onWeaponImpact`) calls it at the correct
contact frame. A guard is needed: if `onWeaponImpact` is null or the card is not an attack
type, fall back to the existing T+150ms path to avoid breaking block and other card types.

`CombatScene.ts` is the coordinator that knows both the weapon system and the juice system.
It registers the `onWeaponImpact` callback on juiceManager and passes the enemy coords into
the weapon animation's `onImpact`. This keeps `juiceManager.ts` free of Phaser dependencies.

`EnemySpriteSystem.playHit()` is called from the `onImpact` closure that `CombatScene`
constructs — the same enemy reference that exists in the attack animation path today.

### Reduce-Motion Handling

When `isReduceMotionEnabled()` returns true: keep the current behavior unchanged (no weapon
animation plays, damage resolves instantly). The `onImpact` callback path is only reached
when weapon animations run, so reduce-motion users are unaffected automatically. No
additional guard needed.

### Device Tier Handling

No tier scaling needed. 4-6 impact sparks is far below the low-end particle budget of 40.
The timing change is free — no additional GPU cost.

## Verification

1. Play an attack card (sword mechanic). The enemy sprite must visibly recoil at the moment
   the sword reaches its furthest forward point — not before, not after. There should be no
   perceptible gap between weapon apex and enemy knockback start.
2. Play a tome/cast attack card. The enemy should recoil at the glow burst peak, not at
   T+150ms from card activation.
3. Confirm 4-6 small spark particles appear at the enemy's position at the moment of impact.
   Sword sparks should be white/yellow. Tome sparks should match the card's chain color.
4. Play a block card. Confirm blocking behavior is completely unchanged (no regression from
   the fallback path).
5. Kill an enemy with an attack. Confirm the kill confirmation sequence (triple haptic,
   heavy shake, zoom punch) still fires correctly — it must not be broken by the timing
   restructure.
6. Confirm no duplicate screen shakes (the micro shake at sword impact should fire once, not
   twice from both the old path and the new one).
7. Run `npx vitest run` to confirm no regressions in combat service tests.

## Effort Estimate

S — less than 1 day. `WeaponAnimationSystem.ts` gets a single `onImpact?: () => void`
parameter wired to each weapon's tween `onComplete`. `CombatScene.ts` restructures the
attack callback assembly (moving two lines into the `onImpact` closure). The spark particle
call is one `burstDirectional` invocation. The main risk is the fallback path in
`juiceManager` for non-attack cards — test that path explicitly before committing.
