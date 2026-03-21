# AR-111: Lore-Driven Per-Enemy Animations

## Overview

Replace the 8 generic animation archetypes with **per-enemy custom animations** that match each creature's visual form and lore identity. Every enemy in the bestiary gets a bespoke idle behavior, attack style, and hit reaction that makes it feel alive and memorable.

**Goal**: When a player encounters The Burnout, its charred moth wings should flap asymmetrically. The Writer's Block should blink like a cursor. The Pressure Cooker's lid should rattle. Every animation should make the player think "of course it moves like that."

**Dependencies**: AR-105 (enemy bestiary overhaul — sprites complete), EnemySpriteSystem.ts, enemyAnimations.ts
**Complexity**: Medium-high (data-heavy, but system changes are small)
**Risk**: Low — purely additive, all changes are in animation data layer

---

## Sub-step 1: Extend the Animation Pattern System

### 1a. Add `rotate` step type
Tweens the container's `angle` to a target value. Essential for spinning/tilting creatures.

```typescript
// In IdlePatternStep:
{ type: 'rotate', angle: 15, duration: 2000, ease: 'Sine.easeInOut', yoyo: true }
```

**Implementation in `runPatternStep`:**
```typescript
case 'rotate': {
  const tween = this.scene.tweens.add({
    targets: this.container,
    angle: step.angle ?? 0,
    duration: step.duration,
    ease: step.ease ?? 'Sine.easeInOut',
    yoyo: step.yoyo ?? false,
    onComplete: () => this.runPatternStep(pattern, nextIndex),
  })
  this.customIdleTweens.push(tween)
  break
}
```

### 1b. Add `fade` step type
Tweens the container's `alpha`. Essential for ghostly/glitching creatures.

```typescript
{ type: 'fade', alpha: 0.3, duration: 500, ease: 'Sine.easeInOut', yoyo: true }
```

### 1c. Add `angle` and `alpha` fields to `IdlePatternStep`

```typescript
export interface IdlePatternStep {
  type: 'move' | 'pause' | 'flip' | 'squash' | 'pulse' | 'jitter' | 'drift' | 'rotate' | 'fade'
  duration: number
  dx?: number
  dy?: number
  scaleX?: number
  scaleY?: number
  ease?: string
  yoyo?: boolean
  intensity?: number
  interval?: number
  flipX?: number
  angle?: number    // NEW: target angle for 'rotate'
  alpha?: number    // NEW: target alpha for 'fade'
}
```

### 1d. Add per-enemy override map

```typescript
// In enemyAnimations.ts:
const ENEMY_ANIM_OVERRIDES: Record<string, AnimConfig> = { /* ... */ }

export function getAnimConfig(archetype?: AnimArchetype, enemyId?: string): AnimConfig {
  if (enemyId && ENEMY_ANIM_OVERRIDES[enemyId]) {
    return ENEMY_ANIM_OVERRIDES[enemyId]
  }
  if (!archetype) return DEFAULT_ANIM_CONFIG
  return ARCHETYPE_CONFIGS[archetype] ?? DEFAULT_ANIM_CONFIG
}
```

### 1e. Thread `enemyId` through the call chain

In `CombatScene.ts`, the `setEnemy` method already has `this.currentEnemyId`. Pass it to `setAnimConfig`:

```typescript
this.enemySpriteSystem.setAnimConfig(animArchetype, this.currentEnemyId)
```

Update `EnemySpriteSystem.setAnimConfig` to forward the ID:

```typescript
public setAnimConfig(archetype?: AnimArchetype, enemyId?: string): void {
  this.animConfig = getAnimConfig(archetype, enemyId)
}
```

**Files affected**: `src/data/enemyAnimations.ts`, `src/game/systems/EnemySpriteSystem.ts`, `src/game/scenes/CombatScene.ts`

**Acceptance criteria**:
- [x] `rotate` and `fade` step types work in pattern sequences
- [x] `getAnimConfig` checks per-enemy overrides before falling back to archetype
- [x] `enemyId` flows from CombatScene through EnemySpriteSystem to the config resolver

---

## Sub-step 2: Per-Enemy Animation Specifications

### Design Principles

1. **Form dictates motion** — a moth flaps, a slug oozes, a cursor blinks
2. **Lore dictates personality** — The Perfectionist is frozen with tension, The Group Project can't agree on a direction
3. **Scale dictates weight** — commons are quick and light, bosses are heavy and ominous
4. **Attacks match the creature** — a vine strangles (slow lunge), a bat dive-bombs (fast diagonal swoop)
5. **Hits match durability** — a heavy golem barely flinches, a fragile ghost phases out and back

---

### SHALLOW DEPTHS — COMMONS

#### Page Flutter (cave_bat) — Paper Bat
**Idle**: Wing flapping via rapid scaleX compression. Squeeze to 0.7x width every 350ms (wings folding in), snap back (wings spreading). Slight vertical bob between flaps. Gentle left-right drift like circling prey.
```
suppressBase: true
pattern:
  squash(scaleX:0.7, scaleY:1.06, dur:180, yoyo:true)
  pause(120)
  squash(scaleX:0.7, scaleY:1.06, dur:180, yoyo:true)
  drift(dx:-10, dur:1500)
  squash(scaleX:0.7, scaleY:1.06, dur:180, yoyo:true)
  pause(120)
  squash(scaleX:0.7, scaleY:1.06, dur:180, yoyo:true)
  drift(dx:10, dur:1500)
```
**Attack**: Diagonal dive-bomb — lungeX:-20, lungeY:35, rotation:-25, scale:1.1, fast (130ms). Return with Back.easeOut.
**Hit**: Tumble upward — knockbackY:-25, rotation:20, scale:0.95. Elastic return.

#### Thesis Construct (crystal_golem) — Paper Golem
**Idle**: Heavy and creaky. Almost no bob (amplitude 1). Very slow breathe (2.5s). Periodic heavy "settling" squash — knees buckling under its own weight, then straightening.
```
base: bob(1, 2200), breathe(1.02, 2500), wobble(0.3, 3000)
pattern:
  pause(5000)
  squash(scaleX:1.08, scaleY:0.92, dur:300, ease:'Power2', yoyo:true)
  pause(400)
  squash(scaleX:0.97, scaleY:1.03, dur:200, yoyo:true)
```
**Attack**: Topple forward — lungeY:30, rotation:8, scale:1.12, dur:250. Bounce return (its mass).
**Hit**: Barely moves — knockbackY:-5, rotation:-3, scale:1.01, dur:150. It's too heavy.

#### Mold Puff (toxic_spore) — Mushroom with Book Cap
**Idle**: Gentle breathe (spore puffing). Periodic "spore release" — quick upward pulse (scale to 1.15) then slow deflation back. Slight wobble like it's top-heavy from the book cap.
```
base: bob(4, 1800), breathe(1.04, 1600), wobble(2, 2200)
pattern:
  pause(3500)
  pulse(scaleX:1.15, scaleY:1.15, dur:150, yoyo:true)
  pause(200)
  pulse(scaleX:1.08, scaleY:1.08, dur:100, yoyo:true)
```
**Attack**: Spore burst — minimal lunge (lungeY:5), big scale pulse (1.25). Shake intensity 0.002.
**Hit**: Wobble hard — knockbackY:-12, rotation:-15, scale:1.08. Elastic return (squishy).

#### Ink Slug (mud_crawler) — Sentient Ink Blob
**Idle**: Oozing lateral drift. Suppress base bob entirely. Slow slide left, long pause (pooling), slow slide right. Squash on direction changes (body compressing before extending).
```
suppressBase: true
pattern:
  squash(scaleX:1.15, scaleY:0.88, dur:400, yoyo:false)
  move(dx:-15, dy:2, dur:2500, ease:'Sine.easeInOut')
  squash(scaleX:0.9, scaleY:1.08, dur:300, yoyo:false)
  pause(3000)
  squash(scaleX:1.15, scaleY:0.88, dur:400, yoyo:false)
  move(dx:15, dy:-2, dur:2500, ease:'Sine.easeInOut')
  squash(scaleX:0.9, scaleY:1.08, dur:300, yoyo:false)
  pause(3000)
```
**Attack**: Elongate and snap — lungeX:15, lungeY:15, scale:1.08, rotation:5. Slow lunge (250ms) like stretching toward prey.
**Hit**: Splash back — knockbackX:-15, knockbackY:-8, scale:1.1 (spreads on impact). Slow Sine return.

#### Bookmark Vine (root_strangler) — Ribbon Vine Creature
**Idle**: Vine swaying. Gentle angle oscillation (like a plant in breeze). Periodic tendril reach — drift one direction, pause, drift back. No jitter (plants are smooth).
```
base: bob(3, 2000), breathe(1.01, 2200), wobble(0, 3000)
pattern:
  rotate(angle:5, dur:2000, ease:'Sine.easeInOut', yoyo:true)
  pause(500)
  rotate(angle:-5, dur:2000, ease:'Sine.easeInOut', yoyo:true)
  pause(500)
  drift(dx:8, dur:1500, ease:'Sine.easeInOut')
  drift(dx:-8, dur:1500, ease:'Sine.easeInOut')
```
**Attack**: Vine lash — lungeX:20, lungeY:10, rotation:15. Fast (140ms). Whip-like.
**Hit**: Recoil and curl — knockbackX:-10, knockbackY:-15, rotation:-12. Elastic return (springy vine).

#### Staple Bug (iron_beetle) — Office Supply Beetle
**Idle**: Metallic chittering. Near-still with periodic tiny jitter bursts (legs clicking). Very slight bob. Occasional squash like it's clamping down.
```
base: bob(1, 2000), breathe(1.01, 2400), wobble(0.3, 3000)
pattern:
  pause(4000)
  jitter(intensity:2, interval:60, dur:300)
  pause(1000)
  squash(scaleX:1.1, scaleY:0.92, dur:100, yoyo:true)
  pause(3000)
```
**Attack**: Clamp — lungeY:20, rotation:3, scale:1.08. Quick (150ms). Moderate shake.
**Hit**: Barely moves (armored) — knockbackY:-6, rotation:-4, dur:120. Back.easeOut.

#### Margin Gremlin (limestone_imp) — Pencil-Wielding Gremlin
**Idle**: Hyperactive bouncing. Fast bob, quick lateral jitters. Periodic mischievous lean to one side (about to scribble). Rapid small hops.
```
suppressBase: true
pattern:
  move(dx:0, dy:-8, dur:200, ease:'Power2')
  move(dx:0, dy:0, dur:150, ease:'Bounce.easeOut')
  pause(800)
  move(dx:10, dy:-6, dur:150, ease:'Power2')
  move(dx:0, dy:0, dur:200, ease:'Bounce.easeOut')
  pause(600)
  jitter(intensity:3, interval:80, dur:400)
  pause(1200)
  move(dx:-8, dy:-6, dur:150, ease:'Power2')
  move(dx:0, dy:0, dur:200, ease:'Bounce.easeOut')
  pause(700)
```
**Attack**: Pencil stab — lungeX:-12, lungeY:28, rotation:12, scale:1.06. Very fast (100ms). Sharp.
**Hit**: Flung backward — knockbackX:10, knockbackY:-18, rotation:-15. Fast elastic return (resilient).

#### Index Weaver (cave_spider) — Card Catalogue Spider
**Idle**: Patient web-builder. Still for long periods. Then quick precise lateral move (repositioning on web). Slight angle adjustments. Mechanical precision unlike organic creatures.
```
suppressBase: true
pattern:
  pause(4000)
  move(dx:-18, dy:-5, dur:200, ease:'Power3')
  pause(3000)
  move(dx:12, dy:8, dur:200, ease:'Power3')
  pause(2500)
  move(dx:0, dy:0, dur:300, ease:'Sine.easeOut')
  pause(3500)
  jitter(intensity:1.5, interval:100, dur:200)
```
**Attack**: Web pounce — lungeX:20, lungeY:20, rotation:8, scale:1.06. Fast (120ms).
**Hit**: Scuttle back — knockbackX:-15, knockbackY:-12, rotation:-8. Quick return (agile).

#### Overdue Golem (peat_shambler) — Shambling Book Pile
**Idle**: Lumbering sway. Slow heavy lean to one side, pause (about to topple), slow correction. Books shifting. Very heavy breathe scale.
```
base: bob(2, 2400), breathe(1.03, 2000), wobble(0, 3000)
pattern:
  rotate(angle:4, dur:2500, ease:'Sine.easeInOut', yoyo:false)
  pause(1500)
  rotate(angle:-4, dur:2500, ease:'Sine.easeInOut', yoyo:false)
  pause(1500)
  squash(scaleX:1.05, scaleY:0.96, dur:400, yoyo:true)
```
**Attack**: Topple forward — lungeY:25, rotation:10, scale:1.1, dur:280. Bounce.easeOut return.
**Hit**: Books scatter — knockbackY:-10, rotation:-8, scale:1.06. Slow return (reassembling).

#### Pop Quiz (fungal_sprout) — Question Mark Mushroom
**Idle**: Urgent pulsing glow. Fast rhythmic pulse (ticking clock energy). Slight bounce. The "!" urgency of a surprise quiz.
```
base: bob(5, 800), breathe(1.01, 600), wobble(1, 1000)
pattern:
  pulse(scaleX:1.12, scaleY:1.12, dur:150, yoyo:true)
  pause(400)
  pulse(scaleX:1.08, scaleY:1.08, dur:120, yoyo:true)
  pause(600)
  pulse(scaleX:1.15, scaleY:1.15, dur:100, yoyo:true)
  pause(300)
```
**Attack**: Surprise burst — lungeY:12, scale:1.3, rotation:0, dur:100. Explosive. High shake (0.005).
**Hit**: Bounce away — knockbackY:-20, rotation:-10. Elastic (bouncy mushroom).

#### Eraser Worm (blind_grub) — Pale Segmented Grub
**Idle**: Peristaltic undulation. Body compresses horizontally (segments bunching) then extends vertically (stretching forward), creating a worm-crawl wave. Slow lateral drift (searching by vibration). No bob — it's grounded.
```
suppressBase: true
pattern:
  squash(scaleX:1.12, scaleY:0.88, dur:500, ease:'Sine.easeIn', yoyo:false)
  squash(scaleX:0.88, scaleY:1.12, dur:500, ease:'Sine.easeOut', yoyo:false)
  move(dx:-8, dy:0, dur:300, ease:'Linear')
  squash(scaleX:1.12, scaleY:0.88, dur:500, ease:'Sine.easeIn', yoyo:false)
  squash(scaleX:0.88, scaleY:1.12, dur:500, ease:'Sine.easeOut', yoyo:false)
  move(dx:8, dy:0, dur:300, ease:'Linear')
  squash(scaleX:1.0, scaleY:1.0, dur:200)
  pause(1500)
```
**Attack**: Lunge bite frenzy — lungeX:15, lungeY:20, rotation:5, scale:1.06. Fast (130ms). Moderate shake.
**Hit**: Curl up — knockbackY:-8, scale:0.9 (defensive curl). Slow return as it uncurls.

---

### SHALLOW DEPTHS — MINI-BOSSES

#### The Card Catalogue (root_mother) — Filing Cabinet Monster
**Idle**: Drawers rattling. Heavy base with periodic squash bursts (drawers sliding open/shut). Slight forward lean (looming). Occasional jitter (something shifting inside).
```
base: bob(2, 2200), breathe(1.02, 2000), wobble(0.5, 3000)
pattern:
  pause(3000)
  squash(scaleX:1.08, scaleY:0.94, dur:120, yoyo:true)
  pause(200)
  squash(scaleX:0.96, scaleY:1.04, dur:100, yoyo:true)
  pause(3500)
  jitter(intensity:2, interval:80, dur:300)
```
**Attack**: Drawer slam — lungeY:25, rotation:5, scale:1.12. Dur:200. High shake (0.005).
**Hit**: Drawers rattle — knockbackY:-8, rotation:-5. Slow return (heavy furniture).

#### The Headmistress (iron_matriarch) — Stern Desk Administrator
**Idle**: Authoritative stillness. Very minimal movement. Slight forward lean (disapproval). Periodic sharp tap (ruler strike) — quick tiny downward move then back. She doesn't fidget. She judges.
```
base: bob(1, 3000), breathe(1.01, 2800), wobble(0, 4000)
pattern:
  pause(4000)
  move(dx:0, dy:3, dur:80, ease:'Power3')
  move(dx:0, dy:0, dur:150, ease:'Back.easeOut')
  pause(5000)
  rotate(angle:2, dur:1000, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Ruler slam — lungeY:30, rotation:8, scale:1.15. Fast (160ms). Bounce return. Heavy shake (0.006).
**Hit**: Indignant recoil — knockbackY:-10, rotation:-8, scale:1.02. Back.easeOut (she recovers her composure).

#### The Tutor (bog_witch) — Corrupted Teacher with Blackboard
**Idle**: Floating blackboard energy. Medium bob (hovering). Periodic pointer wave — slight angle swing. Occasional pulse (chalk glow). Smooth and deliberate.
```
base: bob(6, 1600), breathe(1.03, 1800), wobble(0, 2500)
pattern:
  rotate(angle:3, dur:1200, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
  pulse(scaleX:1.1, scaleY:1.1, dur:200, yoyo:true)
  pause(2500)
  rotate(angle:-3, dur:1200, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Pointer zap — lungeY:8, scale:1.2, rotation:0. Dur:180. Caster-style (power channel, not physical lunge).
**Hit**: Knocked back while hovering — knockbackY:-20, rotation:-8. Elastic return.

#### The Study Group (mushroom_sovereign) — Five-Faced Amalgam
**Idle**: Chaotic disagreement. Fast wobble. Random jitter bursts (heads arguing). Occasional sharp lean one direction then correction (one personality briefly taking control). Never at rest.
```
suppressBase: true
pattern:
  rotate(angle:6, dur:600, ease:'Power2', yoyo:true)
  jitter(intensity:3, interval:100, dur:500)
  pause(400)
  rotate(angle:-8, dur:500, ease:'Power2', yoyo:true)
  pause(300)
  move(dx:8, dy:0, dur:300, ease:'Power3')
  move(dx:0, dy:0, dur:500, ease:'Sine.easeOut')
  jitter(intensity:2, interval:120, dur:400)
  pause(600)
  rotate(angle:4, dur:400, ease:'Power2', yoyo:true)
  move(dx:-6, dy:0, dur:250, ease:'Power3')
  move(dx:0, dy:0, dur:400, ease:'Sine.easeOut')
```
**Attack**: Uncoordinated lunge — lungeX:5, lungeY:20, rotation:12, scale:1.08. Dur:200. The rotation is high because the heads disagree on attack direction.
**Hit**: Chaotic wobble — knockbackY:-12, rotation:-18, scale:1.06. Elastic (arguing about whose fault it was).

#### The Plagiarist (venomfang) — Patchwork Creature
**Idle**: Unsettling shifting. The stitched-together body doesn't quite fit. Periodic squash (parts settling), slight jitter (seams straining). Occasional flip (showing different stolen side).
```
base: bob(3, 1600), breathe(1.02, 1400), wobble(1.5, 1800)
suppressBase: false
pattern:
  pause(3000)
  squash(scaleX:0.94, scaleY:1.06, dur:200, yoyo:true)
  pause(1000)
  jitter(intensity:2, interval:80, dur:300)
  pause(4000)
  flip(flipX:-1, dur:300)
  pause(3000)
  flip(flipX:1, dur:300)
```
**Attack**: Stolen lunge — lungeX:15, lungeY:15, rotation:10, scale:1.08. Dur:170.
**Hit**: Seams strain — knockbackX:-10, knockbackY:-12, rotation:-12. Elastic.

---

### SHALLOW DEPTHS — ELITES

#### The Bookwyrm (ore_wyrm) — Serpentine Book Dragon
**Idle**: Coiling serpentine motion. Slow sinusoidal drift (body undulating). Slight vertical bob. Periodic rise (rearing up) then settle. Majestic and threatening.
```
base: bob(5, 1800), breathe(1.02, 2000), wobble(1, 2400)
pattern:
  drift(dx:-12, dur:2500, ease:'Sine.easeInOut')
  move(dx:0, dy:-8, dur:800, ease:'Sine.easeOut')
  pause(1200)
  move(dx:0, dy:0, dur:600, ease:'Sine.easeIn')
  drift(dx:12, dur:2500, ease:'Sine.easeInOut')
  pause(1500)
```
**Attack**: Serpent strike — lungeX:-10, lungeY:30, rotation:-15, scale:1.1. Fast (140ms). High shake.
**Hit**: Coil back — knockbackY:-15, rotation:10, scale:1.04. Elastic.

#### The Librarian (cave_troll) — QUIET Sign Enforcer
**Idle**: Looming silence. Very slow, deliberate forward lean (approaching). Long pauses (watching). Occasional finger-to-lips shush — tiny squash then pulse. Everything is slow because QUIET.
```
base: bob(1, 3000), breathe(1.03, 2800), wobble(0, 4000)
pattern:
  pause(5000)
  move(dx:0, dy:5, dur:2000, ease:'Sine.easeInOut')
  pause(3000)
  move(dx:0, dy:0, dur:1500, ease:'Sine.easeInOut')
  pause(2000)
  pulse(scaleX:1.06, scaleY:1.06, dur:300, yoyo:true)
```
**Attack**: QUIET slam — lungeY:35, rotation:5, scale:1.18. Slow windup (250ms). MASSIVE shake (0.007).
**Hit**: Barely registers — knockbackY:-6, rotation:-3, scale:1.02, dur:130. Back.easeOut.

---

### SHALLOW DEPTHS — BOSSES

#### The Final Exam (the_excavator) — Clock Machine Golem
**Idle**: Ticking clock energy. Rhythmic small lateral moves like a pendulum tick. Periodic heavier "tock" squash. The clock is counting down. Mechanical precision.
```
suppressBase: true
pattern:
  move(dx:6, dy:0, dur:400, ease:'Power2')
  pause(600)
  move(dx:-6, dy:0, dur:400, ease:'Power2')
  pause(600)
  move(dx:6, dy:0, dur:400, ease:'Power2')
  pause(600)
  move(dx:-6, dy:0, dur:400, ease:'Power2')
  squash(scaleX:1.06, scaleY:0.95, dur:150, yoyo:true)
  pause(800)
```
**Attack**: Pencil barrage — lungeY:35, rotation:5, scale:1.15. Dur:220. Bounce.easeOut return. Shake 0.006.
**Hit**: Gears jam — knockbackY:-8, rotation:-4. Slow return (heavy machinery resuming).

#### The Burning Deadline (magma_core) — Screaming Clock Sphere
**Idle**: FRANTIC. Constant micro-jitter (always trembling). Rapid pulsing (about to explode). Slight erratic rotation. Never still — pure panic energy. The jitter should feel like the sprite is vibrating.
```
suppressBase: true
pattern:
  jitter(intensity:3, interval:40, dur:800)
  pulse(scaleX:1.08, scaleY:1.08, dur:150, yoyo:true)
  jitter(intensity:4, interval:35, dur:600)
  rotate(angle:3, dur:300, ease:'Power2', yoyo:true)
  jitter(intensity:3, interval:45, dur:700)
  pulse(scaleX:1.1, scaleY:1.1, dur:120, yoyo:true)
  jitter(intensity:5, interval:30, dur:500)
  rotate(angle:-4, dur:250, ease:'Power2', yoyo:true)
```
**Attack**: Explosion — lungeY:5, rotation:0, scale:1.3. Dur:80. Return dur:80. LINEAR ease. MAX shake (0.008). It doesn't lunge — it detonates in place.
**Hit**: Barely notices — knockbackY:-3, scale:1.02. It's too panicked to react. Dur:60.

---

### DEEP CAVERNS — COMMONS

#### The Crib Sheet (shadow_mimic) — Snapping Paper Trap
**Idle**: Snap-trap rhythm. Stays flat (compressed scaleY), then sudden spring open (tall scaleY) — like paper jaws opening and closing. Slight lateral drift between snaps. Menacing.
```
suppressBase: true
pattern:
  squash(scaleX:1.15, scaleY:0.8, dur:200, yoyo:false)
  pause(2500)
  squash(scaleX:0.85, scaleY:1.15, dur:120, ease:'Power3', yoyo:false)
  pause(300)
  squash(scaleX:1.15, scaleY:0.8, dur:150, yoyo:false)
  pause(3000)
  drift(dx:10, dur:1500, ease:'Sine.easeInOut')
  drift(dx:-10, dur:1500, ease:'Sine.easeInOut')
```
**Attack**: Snap shut on prey — lungeY:25, scale:1.1, rotation:0. Very fast (100ms). Back.easeOut.
**Hit**: Paper crumple — knockbackY:-15, scale:0.92. Elastic return (springs back).

#### The Citation Needed (bone_collector) — Skeleton Scholar
**Idle**: Accusatory pointing. Periodic lean forward (demanding sources). Slight jitter (agitation). Long authoritative pauses.
```
base: bob(3, 1400), breathe(1.02, 1600), wobble(1, 2000)
pattern:
  pause(3000)
  move(dx:0, dy:5, dur:300, ease:'Power2')
  pause(800)
  move(dx:0, dy:0, dur:400, ease:'Sine.easeOut')
  pause(3500)
  jitter(intensity:2, interval:100, dur:300)
```
**Attack**: Citation hurl — lungeX:-10, lungeY:15, rotation:-8, scale:1.06. Dur:160.
**Hit**: Rattled bones — knockbackX:8, knockbackY:-12, rotation:12. Elastic (bones clattering back).

#### The All-Nighter (salt_wraith) — Exhausted Coffee Ghost
**Idle**: Swaying droop. Heavy slow wobble like it's about to fall over. Periodic sinking (drowsing off) then correction. Alpha fading in and out (ghostly exhaustion). Desperately clinging to consciousness.
```
base: bob(6, 2200), breathe(1.02, 2400), wobble(3, 1800)
pattern:
  move(dx:0, dy:6, dur:2000, ease:'Sine.easeIn')
  fade(alpha:0.6, dur:1000, ease:'Sine.easeIn', yoyo:true)
  move(dx:0, dy:0, dur:800, ease:'Power2')
  pause(1500)
  rotate(angle:5, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  pause(1000)
```
**Attack**: Caffeine surge — lungeY:18, scale:1.1, rotation:0. Dur:200. Brief desperate energy.
**Hit**: Phases out — knockbackY:-20, scale:1.03. Long return (400ms). Sine.easeOut (drifting).

#### The Spark Note (coal_imp) — Burning Cliff Notes Imp
**Idle**: Flickering fire energy. Fast bob (flame licking). Rapid tiny jitter (ember sparking). Periodic bright pulse (flare up). Chaotic and hot.
```
base: bob(6, 700), breathe(1.02, 600), wobble(1.5, 900)
pattern:
  jitter(intensity:2, interval:70, dur:400)
  pulse(scaleX:1.1, scaleY:1.1, dur:100, yoyo:true)
  pause(500)
  jitter(intensity:3, interval:60, dur:300)
  pause(800)
```
**Attack**: Highlighter slash — lungeX:-12, lungeY:22, rotation:10, scale:1.06. Very fast (100ms).
**Hit**: Spark scatter — knockbackX:8, knockbackY:-16, rotation:-12. Fast elastic.

#### The Watchdog (granite_hound) — Floating Armor with Eye
**Idle**: Patrol scan. Slow deliberate drift left, pause (scanning), drift right, pause. The eye is always watching. Periodic pulse (eye flash). Mechanical and vigilant.
```
suppressBase: true
pattern:
  drift(dx:-15, dur:2000, ease:'Sine.easeInOut')
  pause(2000)
  pulse(scaleX:1.06, scaleY:1.06, dur:200, yoyo:true)
  drift(dx:15, dur:2000, ease:'Sine.easeInOut')
  pause(2000)
  pulse(scaleX:1.08, scaleY:1.08, dur:150, yoyo:true)
```
**Attack**: Rules enforcement — lungeY:25, rotation:5, scale:1.1. Dur:180.
**Hit**: Armor rattle — knockbackY:-10, rotation:-6. Back.easeOut.

#### The Red Herring (sulfur_sprite) — Glowing Mischievous Fish
**Idle**: Misleading drift. Floats one direction then suddenly changes course. Playful and deceptive. High bob (floating). Periodic flip (changing direction mischievously).
```
base: bob(10, 1800), breathe(1.02, 2000), wobble(2, 2400)
pattern:
  drift(dx:-12, dur:1500, ease:'Sine.easeInOut')
  pause(500)
  flip(flipX:-1, dur:150)
  drift(dx:12, dur:1500, ease:'Sine.easeInOut')
  pause(500)
  flip(flipX:1, dur:150)
  drift(dx:6, dur:800, ease:'Sine.easeInOut')
  pause(300)
  drift(dx:-6, dur:800, ease:'Sine.easeInOut')
```
**Attack**: Misleading strike — lungeX:10, lungeY:12, rotation:0, scale:1.08. Dur:200. Comes from unexpected angle.
**Hit**: Scatter — knockbackY:-22, rotation:-6. Sine return (floaty).

#### The Anxiety Tick (magma_tick) — Heat-Glowing Parasite
**Idle**: Feeding frenzy. Slight constant jitter (burrowing). Periodic scale pulse (swelling with stolen energy). Getting larger. Agitated.
```
base: bob(2, 1000), breathe(1.03, 800), wobble(0.5, 1200)
pattern:
  jitter(intensity:2, interval:80, dur:600)
  pulse(scaleX:1.08, scaleY:1.08, dur:250, yoyo:true)
  pause(800)
  jitter(intensity:3, interval:60, dur:400)
  pause(1200)
  pulse(scaleX:1.12, scaleY:1.12, dur:200, yoyo:true)
```
**Attack**: Latch and drain — lungeX:8, lungeY:18, rotation:8, scale:1.06. Dur:180.
**Hit**: Detach — knockbackY:-14, rotation:-10. Elastic.

#### The Trick Question (deep_angler) — Angler Fish with Lure
**Idle**: Patient predator. Near-still body with high-amplitude lure bob (implied by slow scale pulse). Very slow drift. The lure is the movement — body stays menacingly still. Occasional bioluminescent pulse.
```
base: bob(8, 2500), breathe(1.01, 3000), wobble(0.5, 3500)
pattern:
  pause(3000)
  pulse(scaleX:1.06, scaleY:1.06, dur:400, yoyo:true)
  pause(4000)
  drift(dx:-5, dur:3000, ease:'Sine.easeInOut')
  drift(dx:5, dur:3000, ease:'Sine.easeInOut')
```
**Attack**: Ambush snap — lungeY:30, rotation:0, scale:1.12. Fast (120ms). The patience snaps.
**Hit**: Drift back — knockbackY:-18, rotation:-4. Slow Sine return.

#### The Dropout (rock_hermit) — Student Behind Book Fort
**Idle**: Defensive huddle. Nearly still. Periodic tiny peek upward (small bob up then quick retract). Occasional nervous squash (ducking). Trying to be invisible.
```
base: bob(1, 2800), breathe(1.01, 3000), wobble(0, 4000)
pattern:
  pause(5000)
  move(dx:0, dy:-5, dur:400, ease:'Sine.easeOut')
  pause(600)
  move(dx:0, dy:0, dur:200, ease:'Power3')
  pause(4000)
  squash(scaleX:1.06, scaleY:0.94, dur:150, yoyo:true)
```
**Attack**: Reluctant shove — lungeY:15, rotation:3, scale:1.04. Slow (250ms). Doesn't want to fight.
**Hit**: Retreat deeper — knockbackY:-5, scale:0.94 (shrinking). Slow return.

#### The Brain Fog (gas_phantom) — Amorphous Text Cloud
**Idle**: Churning fog. Slow continuous rotation. Expanding and contracting (breathing fog). Drift in unpredictable directions. Feels like it's swirling and dissolving at the edges.
```
suppressBase: true
pattern:
  rotate(angle:8, dur:4000, ease:'Linear', yoyo:false)
  rotate(angle:0, dur:200)
  rotate(angle:-8, dur:4000, ease:'Linear', yoyo:false)
  rotate(angle:0, dur:200)
```
(Combine with non-suppressed base for simultaneous bob + breathe + rotation)
Actually — use base layer for bob/breathe, pattern for rotation:
```
base: bob(8, 2500), breathe(1.06, 2000), wobble(0, 3000)
suppressBase: false
pattern:
  rotate(angle:6, dur:3000, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:-10, dur:2500, ease:'Sine.easeInOut')
  rotate(angle:-6, dur:3000, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:10, dur:2500, ease:'Sine.easeInOut')
```
**Attack**: Engulf — lungeY:10, scale:1.25, rotation:0. Dur:250. Low shake (fog doesn't impact hard).
**Hit**: Disperses then reforms — knockbackY:-25, scale:0.9, alpha approach via scale. Slow Sine return (500ms).

#### The Thesis Dragon (stalactite_drake) — Ceiling Drake
**Idle**: Hanging and swaying. High position with downward bob (gravity pulling). Slight angle swing (pendulum on ceiling). Periodic sudden drop-lurch then recovery. Predatory patience.
```
base: bob(6, 1400), breathe(1.01, 1800), wobble(2, 1600)
pattern:
  pause(3000)
  move(dx:0, dy:8, dur:200, ease:'Power3')
  pause(200)
  move(dx:0, dy:0, dur:400, ease:'Elastic.easeOut')
  pause(4000)
  rotate(angle:4, dur:1500, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Ceiling drop — lungeY:40, rotation:-10, scale:1.08. Fast (130ms). High shake. Gravity-powered.
**Hit**: Swing away — knockbackY:-20, rotation:15. Elastic (swinging on perch).

#### The Burnout (ember_moth) — Half-Charred Moth
**Idle**: Tragic asymmetric wing flap. One wing works, the other is charred. ScaleX compression is ASYMMETRIC — achieved by combining scaleX squash with slight angle tilt (the charred side droops). Slower than Page Flutter. Fading embers. Occasional fade (embers dimming).
```
suppressBase: true
pattern:
  squash(scaleX:0.75, scaleY:1.04, dur:300, yoyo:true)
  rotate(angle:3, dur:300, ease:'Sine.easeOut', yoyo:true)
  pause(200)
  squash(scaleX:0.8, scaleY:1.03, dur:350, yoyo:true)
  rotate(angle:2, dur:350, ease:'Sine.easeOut', yoyo:true)
  drift(dx:-6, dur:2000, ease:'Sine.easeInOut')
  fade(alpha:0.7, dur:1000, ease:'Sine.easeInOut', yoyo:true)
  squash(scaleX:0.75, scaleY:1.04, dur:300, yoyo:true)
  rotate(angle:3, dur:300, ease:'Sine.easeOut', yoyo:true)
  pause(200)
  squash(scaleX:0.8, scaleY:1.03, dur:350, yoyo:true)
  drift(dx:6, dur:2000, ease:'Sine.easeInOut')
```
**Attack**: Ember dive — lungeX:-10, lungeY:25, rotation:-15, scale:1.06. Dur:160.
**Hit**: Flutter and fade — knockbackY:-20, rotation:12, scale:0.95. Long elastic return. Sad.

---

### DEEP CAVERNS — MINI-BOSSES

#### The Tenure Guardian (crystal_guardian) — Bureaucratic Shield Bearer
**Idle**: Immovable object. Barely any movement. Solid. Periodic slight forward lean (blocking passage). Occasional jitter (paperwork rustling behind shield).
```
base: bob(1, 2800), breathe(1.02, 3000), wobble(0.2, 3500)
pattern:
  pause(6000)
  move(dx:0, dy:3, dur:1000, ease:'Sine.easeInOut')
  pause(2000)
  move(dx:0, dy:0, dur:1000, ease:'Sine.easeInOut')
  jitter(intensity:1.5, interval:100, dur:200)
```
**Attack**: Bureaucratic denial — lungeY:15, rotation:0, scale:1.08. Dur:200.
**Hit**: Won't budge — knockbackY:-4, rotation:-2. Back.easeOut.

#### The Proctor (stone_sentinel) — Stone Tablet Monitor
**Idle**: Surveillance sweep. Slow lateral scanning. Multiple eyes watching in all directions. Very deliberate, very patient. Authoritative presence.
```
base: bob(1, 2500), breathe(1.01, 2800), wobble(0, 3500)
pattern:
  drift(dx:-10, dur:3000, ease:'Sine.easeInOut')
  pause(2000)
  drift(dx:10, dur:3000, ease:'Sine.easeInOut')
  pause(2000)
  pulse(scaleX:1.04, scaleY:1.04, dur:300, yoyo:true)
```
**Attack**: Confiscation — lungeY:25, rotation:3, scale:1.1. Dur:200. Bounce return.
**Hit**: Barely flinches — knockbackY:-6, rotation:-3. Slow return.

#### The Harsh Grader (sulfur_queen) — Red Pen Wielder
**Idle**: Marking furiously. Quick jitter bursts (pen strokes). Periodic sharp downward moves (stamping F). Severe and relentless.
```
base: bob(2, 1400), breathe(1.01, 1600), wobble(0.5, 2000)
pattern:
  jitter(intensity:2, interval:60, dur:500)
  pause(800)
  move(dx:0, dy:4, dur:100, ease:'Power3')
  move(dx:0, dy:0, dur:200, ease:'Back.easeOut')
  pause(1200)
  jitter(intensity:2, interval:70, dur:400)
  pause(1500)
```
**Attack**: Red pen slash — lungeX:-15, lungeY:20, rotation:-12, scale:1.08. Fast (130ms).
**Hit**: Affronted recoil — knockbackY:-12, rotation:8. Back.easeOut.

#### The Textbook (granite_colossus) — Walking Textbook
**Idle**: Predictable mechanical plod. Perfect metronome rhythm. Move left, pause exactly, move right, pause exactly. No randomness. No wobble. It IS the curriculum.
```
suppressBase: true
pattern:
  move(dx:-8, dy:0, dur:800, ease:'Sine.easeInOut')
  pause(1500)
  move(dx:8, dy:0, dur:800, ease:'Sine.easeInOut')
  pause(1500)
  move(dx:0, dy:0, dur:400, ease:'Sine.easeInOut')
  pause(2000)
```
**Attack**: Chapter slam — lungeY:35, rotation:0, scale:1.15. Dur:250. Heavy bounce. Shake 0.006.
**Hit**: Page dent — knockbackY:-5, rotation:-2. It's a textbook. Very slow return.

#### The Imposter Syndrome (deep_lurker) — Shadow Whisperer
**Idle**: Lurking in shadows. Periodic fade to near-invisible (hiding). Then sudden return. Slight shrink (trying to disappear). Occasional panicked jitter burst. The creature IS anxiety.
```
base: bob(3, 2000), breathe(1.02, 1800), wobble(0, 2500)
pattern:
  fade(alpha:0.4, dur:2000, ease:'Sine.easeIn', yoyo:true)
  pause(1500)
  squash(scaleX:0.92, scaleY:0.92, dur:800, ease:'Sine.easeIn', yoyo:true)
  pause(2000)
  jitter(intensity:4, interval:50, dur:400)
  pause(1000)
  fade(alpha:0.5, dur:1500, ease:'Sine.easeIn', yoyo:true)
```
**Attack**: Shadow strike — lungeX:15, lungeY:18, rotation:0, scale:1.06. Dur:100. Comes from nowhere.
**Hit**: Phases out — knockbackY:-15, scale:0.9. Slow fade-back return.

#### The Pressure Cooker (lava_salamander) — Exploding Pressure Cooker
**Idle**: Building pressure. Constant rapid vertical jitter (lid rattling). Periodic scale-up (pressure building) then quick squash release (steam venting). Gets more frantic. The lid is always about to blow.
```
suppressBase: true
pattern:
  jitter(intensity:2, interval:50, dur:1000)
  pulse(scaleX:1.06, scaleY:1.06, dur:600, yoyo:false)
  jitter(intensity:3, interval:40, dur:800)
  squash(scaleX:1.1, scaleY:0.9, dur:100, yoyo:true)
  pulse(scaleX:1.0, scaleY:1.0, dur:200)
  pause(800)
  jitter(intensity:2, interval:55, dur:900)
  pulse(scaleX:1.08, scaleY:1.08, dur:500, yoyo:false)
  squash(scaleX:1.12, scaleY:0.88, dur:80, yoyo:true)
  pulse(scaleX:1.0, scaleY:1.0, dur:200)
  pause(600)
```
**Attack**: Steam explosion — lungeY:10, scale:1.25, rotation:0. Dur:100. MAX shake (0.008). Return dur:100. It blows its top.
**Hit**: Pressure release — knockbackY:-8, scale:0.95 (deflating). Slow return.

---

### DEEP CAVERNS — ELITES & BOSSES

#### The Peer Reviewer (fossil_guardian) — Skeptical Scholar
**Idle**: Examining everything. Periodic lean forward with pulse (magnifying glass inspection). Slow, critical, methodical.
```
base: bob(2, 2000), breathe(1.01, 2200), wobble(0, 3000)
pattern:
  pause(3000)
  move(dx:0, dy:5, dur:600, ease:'Sine.easeOut')
  pulse(scaleX:1.05, scaleY:1.05, dur:200, yoyo:true)
  pause(1000)
  move(dx:0, dy:0, dur:500, ease:'Sine.easeIn')
  pause(3500)
```
**Attack**: Rejection stamp — lungeY:20, rotation:5, scale:1.1. Dur:200.
**Hit**: Indignant — knockbackY:-12, rotation:-8. Back.easeOut.

#### The Deadline Serpent (magma_serpent) — Coiling Clock Serpent
**Idle**: Constricting. Slow tightening scale pulse (wrapping around you). Sinusoidal drift. The clock faces on its body tick. Ominous and inevitable.
```
base: bob(4, 1800), breathe(1.03, 1600), wobble(1, 2200)
pattern:
  pulse(scaleX:1.06, scaleY:1.06, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:-10, dur:2000, ease:'Sine.easeInOut')
  pulse(scaleX:1.08, scaleY:1.08, dur:1200, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:10, dur:2000, ease:'Sine.easeInOut')
```
**Attack**: Constrict — lungeX:10, lungeY:25, rotation:12, scale:1.1. Dur:180.
**Hit**: Uncoil and recoil — knockbackY:-15, rotation:-10. Elastic.

#### The Standardized Test (basalt_titan) — Scantron Golem
**Idle**: Industrial. Huge and impersonal. Minimal movement — it doesn't need to try. Very slow breathe. Occasional heavy ground-pound squash (seismic).
```
base: bob(1, 3000), breathe(1.03, 2800), wobble(0, 4000)
pattern:
  pause(6000)
  squash(scaleX:1.1, scaleY:0.88, dur:200, ease:'Power3', yoyo:true)
  pause(400)
  squash(scaleX:0.97, scaleY:1.04, dur:150, yoyo:true)
```
**Attack**: Standardized slam — lungeY:30, rotation:0, scale:1.15. Dur:250. Bounce. Shake 0.007.
**Hit**: Immovable — knockbackY:-4, rotation:-2. Almost nothing.

#### The Algorithm (the_archivist) — Digital Eye Entity [BOSS]
**Idle**: Uncanny stillness punctuated by processing bursts. Perfectly still for long stretches. Then sudden micro-jitter (computing). Then still again. Periodic eye pulse (scanning). The stillness IS the menace. Like a server that's watching you.
```
base: bob(2, 3000), breathe(1.01, 3500), wobble(0, 5000)
pattern:
  pause(4000)
  jitter(intensity:3, interval:30, dur:200)
  pause(200)
  pulse(scaleX:1.08, scaleY:1.08, dur:250, yoyo:true)
  pause(5000)
  jitter(intensity:2, interval:40, dur:150)
  pause(4000)
  jitter(intensity:4, interval:25, dur:300)
  pulse(scaleX:1.1, scaleY:1.1, dur:200, yoyo:true)
```
**Attack**: Data blast — lungeY:5, scale:1.25, rotation:0. Dur:150. Caster-style (power channel). Shake 0.004.
**Hit**: Buffer — knockbackY:-10, scale:1.06. Elastic. Processing error.

#### The Curriculum (crystal_warden) — Giant Standing Textbook [BOSS]
**Idle**: Opening and closing. The textbook periodically "opens" (scaleX widens) and "closes" (scaleX narrows). Stern. Measured. The ruler arms implied by slight angle corrections. Authoritative metronome.
```
base: bob(2, 2200), breathe(1.01, 2500), wobble(0, 3500)
pattern:
  squash(scaleX:1.1, scaleY:0.97, dur:800, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
  squash(scaleX:1.1, scaleY:0.97, dur:800, ease:'Sine.easeInOut', yoyo:true)
  pause(1500)
  rotate(angle:2, dur:600, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
```
**Attack**: Ruler strike — lungeY:30, rotation:8, scale:1.12. Dur:200. Bounce. Heavy shake.
**Hit**: Barely registers — knockbackY:-5, rotation:-3. Slow return.

---

### THE ABYSS — COMMONS

#### The Writer's Block (obsidian_shard) — Text Cursor Monolith
**Idle**: CURSOR BLINK. This is the signature animation. Perfectly still. Then alpha drops to 0.15 (cursor off), holds, then snaps back to 1.0 (cursor on). Steady rhythm like a real blinking cursor. No other movement. The stillness and rhythmic blinking creates dread — creative paralysis incarnate.
```
suppressBase: true
pattern:
  pause(800)
  fade(alpha:0.15, dur:60, yoyo:false)
  pause(500)
  fade(alpha:1.0, dur:60, yoyo:false)
  pause(800)
  fade(alpha:0.15, dur:60, yoyo:false)
  pause(500)
  fade(alpha:1.0, dur:60, yoyo:false)
  pause(800)
  fade(alpha:0.15, dur:60, yoyo:false)
  pause(500)
  fade(alpha:1.0, dur:60, yoyo:false)
```
**Attack**: Creative paralysis wave — lungeY:3, scale:1.15, rotation:0. Dur:200. Sine ease. Low shake (0.002). It doesn't move AT you — it radiates.
**Hit**: Cracks — knockbackY:-8, rotation:-5, scale:1.04. Elastic. The monolith wobbles.

#### The Information Overload (magma_slime) — Melted Book Blob
**Idle**: Bubbling ooze. Slow irregular breathe (expanding/contracting asymmetrically). Alternating scaleX and scaleY squashes (not synchronized). Slight drift. Chaotic and organic.
```
base: bob(4, 2000), breathe(1.04, 1800), wobble(0, 3000)
pattern:
  squash(scaleX:1.1, scaleY:0.92, dur:600, yoyo:true)
  pause(300)
  squash(scaleX:0.92, scaleY:1.1, dur:700, yoyo:true)
  drift(dx:-8, dur:2000, ease:'Sine.easeInOut')
  squash(scaleX:1.08, scaleY:0.94, dur:500, yoyo:true)
  drift(dx:8, dur:2000, ease:'Sine.easeInOut')
```
**Attack**: Engulf and burn — lungeY:15, scale:1.15, rotation:0. Dur:250. Slow ooze.
**Hit**: Splatter — knockbackY:-12, scale:1.08 (spreads). Sine return.

#### The Rote Memory (quartz_elemental) — Crystal Mannequin
**Idle**: Mechanical recitation. Rigid and hollow. Very slight bob. Periodic micro-pulse (text scrolling inside). No organic movement — it's automated. Unnervingly perfect posture.
```
base: bob(2, 2000), breathe(1.01, 2500), wobble(0, 4000)
pattern:
  pause(3000)
  pulse(scaleX:1.04, scaleY:1.04, dur:200, yoyo:true)
  pause(2500)
  pulse(scaleX:1.06, scaleY:1.06, dur:150, yoyo:true)
  pause(3500)
```
**Attack**: Memorized strike — lungeY:15, rotation:0, scale:1.12. Dur:180. Perfect form, no personality.
**Hit**: Cracks — knockbackY:-12, rotation:-6. Elastic (crystal resonance).

#### The Outdated Fact (fossil_raptor) — Dinosaur Professor
**Idle**: Confident strut. Periodic forward lean (lecturing). Small lateral pacing. Head held high. Completely unaware it's wrong. Charming and dangerous.
```
suppressBase: true
pattern:
  move(dx:-10, dy:0, dur:1200, ease:'Sine.easeInOut')
  pause(1500)
  move(dx:0, dy:-4, dur:300, ease:'Sine.easeOut')
  pause(800)
  move(dx:0, dy:0, dur:300, ease:'Sine.easeIn')
  move(dx:10, dy:0, dur:1200, ease:'Sine.easeInOut')
  pause(1500)
  rotate(angle:3, dur:800, ease:'Sine.easeInOut', yoyo:true)
  pause(1000)
```
**Attack**: Lecture lunge — lungeX:-12, lungeY:22, rotation:8, scale:1.08. Dur:140. Fast (still quick for a dinosaur).
**Hit**: Indignant stagger — knockbackX:8, knockbackY:-14, rotation:-10. Back.easeOut.

#### The Hidden Gem (geode_beetle) — Dull Rock with Crystal Interior
**Idle**: Stone still. The ONLY movement is a periodic inner glow pulse — very subtle scale pulse representing light shining through the crack. Nearly imperceptible. Then nothing. Patience incarnate.
```
base: bob(0.5, 3000), breathe(1.005, 4000), wobble(0, 5000)
pattern:
  pause(5000)
  pulse(scaleX:1.03, scaleY:1.03, dur:400, ease:'Sine.easeInOut', yoyo:true)
  pause(6000)
  pulse(scaleX:1.02, scaleY:1.02, dur:300, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Rock slam — lungeY:18, rotation:0, scale:1.06. Dur:220. Moderate shake.
**Hit**: Rock solid — knockbackY:-4, rotation:-2. Almost nothing moves.

#### The Rushing Student (lava_crawler) — Speed-Blurred Student
**Idle**: Never stops moving. Fast lateral scuttle — sharp move left, brief pause, sharp move right, brief pause. Speed lines energy. Dropping things as it goes. Frantic.
```
suppressBase: true
pattern:
  move(dx:-20, dy:0, dur:300, ease:'Power3')
  pause(200)
  move(dx:15, dy:0, dur:250, ease:'Power3')
  pause(150)
  move(dx:-10, dy:0, dur:200, ease:'Power3')
  pause(300)
  move(dx:20, dy:0, dur:300, ease:'Power3')
  pause(200)
  move(dx:-15, dy:0, dur:250, ease:'Power3')
  pause(150)
  move(dx:0, dy:0, dur:200, ease:'Power3')
  pause(500)
```
**Attack**: Speed rush — lungeX:25, lungeY:15, rotation:5, scale:1.04. Very fast (80ms).
**Hit**: Trip and tumble — knockbackX:-15, knockbackY:-10, rotation:-20. Fast elastic (bounces back up).

#### The Echo Chamber (crystal_bat) — Reflective Crystal Bat
**Idle**: Wing flap similar to Page Flutter but with periodic "echo" pulses — after each flap pair, a delayed scale pulse (the echo returning). Crystal resonance. Slightly slower flap than Page Flutter (heavier crystal wings).
```
suppressBase: true
pattern:
  squash(scaleX:0.75, scaleY:1.05, dur:220, yoyo:true)
  pause(150)
  squash(scaleX:0.75, scaleY:1.05, dur:220, yoyo:true)
  pulse(scaleX:1.06, scaleY:1.06, dur:200, yoyo:true)
  drift(dx:-8, dur:1500, ease:'Sine.easeInOut')
  squash(scaleX:0.75, scaleY:1.05, dur:220, yoyo:true)
  pause(150)
  squash(scaleX:0.75, scaleY:1.05, dur:220, yoyo:true)
  pulse(scaleX:1.06, scaleY:1.06, dur:200, yoyo:true)
  drift(dx:8, dur:1500, ease:'Sine.easeInOut')
```
**Attack**: Crystal swoop — lungeX:-18, lungeY:30, rotation:-20, scale:1.08. Dur:140.
**Hit**: Shatter echo — knockbackY:-22, rotation:15. Elastic with overshoot.

#### The Blank Spot (void_mite) — Humanoid Void Hole
**Idle**: GLITCHING. Erratic alpha. Rapid jitter. It's fighting to exist. Periods of near-invisibility then sudden snapping back. Position jitters like a corrupted texture. The edges of reality are broken.
```
suppressBase: true
pattern:
  fade(alpha:0.3, dur:200, yoyo:false)
  jitter(intensity:5, interval:40, dur:400)
  fade(alpha:0.9, dur:100, yoyo:false)
  pause(600)
  fade(alpha:0.15, dur:150, yoyo:false)
  pause(300)
  fade(alpha:1.0, dur:80, yoyo:false)
  jitter(intensity:3, interval:60, dur:300)
  pause(800)
  fade(alpha:0.4, dur:300, yoyo:false)
  jitter(intensity:6, interval:30, dur:500)
  fade(alpha:0.85, dur:200, yoyo:false)
  pause(400)
```
**Attack**: Void touch — lungeY:12, scale:1.08, rotation:0. Dur:80. Instant. No windup.
**Hit**: Phase out — alpha drops, jitters, reforms. knockbackY:-15. Slow return.

#### The Burnout Phantom (ash_wraith) — Fading Ash Ghost
**Idle**: Dissolving. Slow fade cycles. Slight upward drift (ascending like smoke). Gentle wobble (ash caught in air current). Getting thinner and more transparent. Tragic.
```
base: bob(7, 2500), breathe(1.01, 2800), wobble(2, 2200)
pattern:
  fade(alpha:0.5, dur:2500, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:-6, dur:2000, ease:'Sine.easeInOut')
  fade(alpha:0.6, dur:2000, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:6, dur:2000, ease:'Sine.easeInOut')
  move(dx:0, dy:-5, dur:1500, ease:'Sine.easeOut')
  move(dx:0, dy:0, dur:1000, ease:'Sine.easeIn')
```
**Attack**: Ash engulf — lungeY:10, scale:1.15, rotation:0. Dur:200. Low shake.
**Hit**: Scatter like ash — knockbackY:-25, scale:0.9. Very slow return (800ms).

---

### THE ABYSS — MINI-BOSSES & ELITES

#### The Perfectionist (obsidian_knight) — Frozen Porcelain Samurai
**Idle**: Agonizing near-stillness. Frozen mid-draw. Micro-trembles from the stress of being unable to commit. Every ~6 seconds, a slight pull-back (about to strike!) then... nothing. The tension IS the animation. Hairline cracks shown by tiny jitter.
```
base: bob(0.5, 3000), breathe(1.005, 3500), wobble(0, 5000)
pattern:
  pause(6000)
  move(dx:0, dy:3, dur:300, ease:'Sine.easeOut')
  jitter(intensity:1.5, interval:50, dur:400)
  move(dx:0, dy:0, dur:500, ease:'Sine.easeIn')
  pause(5000)
  jitter(intensity:1, interval:60, dur:300)
```
**Attack**: Finally commits — lungeX:-15, lungeY:30, rotation:-20, scale:1.12. Dur:100. FAST. The buildup was the idle; the release is instant.
**Hit**: Cracks spread — knockbackY:-10, rotation:8. Slow Back.easeOut (composure shattering).

#### The Hydra Problem (quartz_hydra) — Multi-Headed Question Hydra
**Idle**: Heads swaying independently. Multiple overlapping oscillations at different speeds. Base wobble + pattern rotation at different frequency = complex organic multi-headed feel.
```
base: bob(4, 1600), breathe(1.02, 1800), wobble(2.5, 1400)
pattern:
  rotate(angle:5, dur:1800, ease:'Sine.easeInOut', yoyo:true)
  pause(200)
  rotate(angle:-7, dur:2200, ease:'Sine.easeInOut', yoyo:true)
  pulse(scaleX:1.05, scaleY:1.05, dur:200, yoyo:true)
  pause(300)
```
**Attack**: Multi-bite — lungeX:5, lungeY:25, rotation:10, scale:1.1. Dur:180.
**Hit**: All heads reel — knockbackY:-15, rotation:-12. Elastic.

#### The Ivory Tower (fossil_wyvern) — Imperious Perched Wyvern
**Idle**: Looking down imperiously. High position. Minimal movement — it's above all this. Slight slow breathing. Occasional condescending angle adjustment (tilting chin up).
```
base: bob(3, 2500), breathe(1.02, 2800), wobble(0, 4000)
pattern:
  pause(4000)
  rotate(angle:-3, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  pause(5000)
  pulse(scaleX:1.04, scaleY:1.04, dur:300, yoyo:true)
```
**Attack**: Swooping dismissal — lungeX:-20, lungeY:35, rotation:-25, scale:1.1. Dur:150. Swooper-style.
**Hit**: Offended — knockbackY:-18, rotation:12. Back.easeOut.

#### The Helicopter Parent (magma_broodmother) — Overprotective Hen
**Idle**: Defensive flutter. Wings spread protectively (periodic scaleX widening). Body positioned over nest. Occasional agitated jitter (perceived threat). Squash patterns like ruffling feathers.
```
base: bob(3, 1400), breathe(1.03, 1200), wobble(1, 1800)
pattern:
  squash(scaleX:1.12, scaleY:0.95, dur:300, yoyo:true)
  pause(2000)
  jitter(intensity:2, interval:80, dur:400)
  pause(1500)
  squash(scaleX:1.15, scaleY:0.92, dur:250, yoyo:true)
  pause(2500)
```
**Attack**: Protective charge — lungeY:30, rotation:5, scale:1.15. Dur:180. Heavy shake.
**Hit**: Puffed up — knockbackY:-8, scale:1.1 (gets BIGGER when hit, more protective). Slow return.

#### The Comparison Trap (shade_stalker) — Mirror Creature
**Idle**: Reflective shifting. Periodic horizontal flip (showing "your reflection"). Between flips, slight angle sway. Pulse on flip (mirror flash).
```
base: bob(3, 1800), breathe(1.01, 2000), wobble(0.5, 2500)
pattern:
  pause(3000)
  pulse(scaleX:1.08, scaleY:1.08, dur:150, yoyo:true)
  flip(flipX:-1, dur:200)
  pause(3500)
  pulse(scaleX:1.08, scaleY:1.08, dur:150, yoyo:true)
  flip(flipX:1, dur:200)
  pause(2500)
  rotate(angle:3, dur:1000, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Mirror strike — lungeX:12, lungeY:18, rotation:0, scale:1.08. Dur:140. Fast.
**Hit**: Cracks in the mirror — knockbackY:-15, rotation:-8. Elastic.

#### The Emeritus (geode_king) — Ancient Crystal Scholar
**Idle**: Ancient power. Very slow, very deep breathe. Crystalline shimmer (periodic subtle pulse). Heavy presence. Barely moves because it doesn't need to.
```
base: bob(1, 3000), breathe(1.03, 3500), wobble(0, 4000)
pattern:
  pause(5000)
  pulse(scaleX:1.05, scaleY:1.05, dur:500, ease:'Sine.easeInOut', yoyo:true)
  pause(4000)
  pulse(scaleX:1.06, scaleY:1.06, dur:400, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Wisdom blast — lungeY:8, scale:1.2, rotation:0. Dur:200. Caster pulse.
**Hit**: Crystal resonance — knockbackY:-8, rotation:-4. Slow elastic.

#### The Student Debt (abyssal_leviathan) — Monstrous Piggy Bank
**Idle**: Oppressive lean. Slow forward press (bearing down). Heavy breathe (getting heavier). Scale slowly grows (it's always growing). Chains implied by jitter. Inescapable.
```
base: bob(2, 2200), breathe(1.04, 2000), wobble(0.5, 3000)
pattern:
  move(dx:0, dy:4, dur:2000, ease:'Sine.easeIn')
  pulse(scaleX:1.06, scaleY:1.06, dur:800, yoyo:false)
  pause(1500)
  pulse(scaleX:1.0, scaleY:1.0, dur:600)
  move(dx:0, dy:0, dur:1500, ease:'Sine.easeOut')
  pause(1500)
  jitter(intensity:2, interval:100, dur:400)
```
**Attack**: Crushing debt — lungeY:30, rotation:5, scale:1.15. Dur:220. Heavy. Shake 0.006.
**Hit**: Won't stop — knockbackY:-6, rotation:-3. It barely flinches. The debt always grows.

#### The Publish-or-Perish (crystal_lich) — Undead Desk Professor
**Idle**: Furious writing. Constant small jitter (scribbling). Periodic forward lean (reaching for the next paper). Never stops working. Undead determination. Slight breathe pulse (supernatural energy).
```
base: bob(2, 1600), breathe(1.02, 1400), wobble(0, 2000)
pattern:
  jitter(intensity:2, interval:70, dur:800)
  pause(500)
  move(dx:0, dy:3, dur:200, ease:'Power2')
  move(dx:0, dy:0, dur:300, ease:'Sine.easeOut')
  jitter(intensity:2, interval:80, dur:600)
  pause(800)
  pulse(scaleX:1.06, scaleY:1.06, dur:200, yoyo:true)
```
**Attack**: Paper hurl — lungeX:-10, lungeY:12, rotation:-8, scale:1.08. Dur:160.
**Hit**: Never stops — knockbackY:-10, rotation:6. Fast return (400ms). Still writing.

---

### THE ABYSS — BOSSES

#### The Group Project (shadow_hydra) — Four-Headed Hydra [BOSS]
(Detailed above in mini-bosses section for The Study Group, but this is the BOSS version — bigger, more chaotic)

**Idle**: Amplified chaos. More extreme angle swings. Longer jitter bursts. The four heads visible in the sprite — sleeping blue, panicking green, angry red, working purple — all pulling in different directions. The body lurches as different heads take control.
```
suppressBase: true
pattern:
  rotate(angle:8, dur:500, ease:'Power2', yoyo:true)
  jitter(intensity:4, interval:80, dur:600)
  pause(300)
  rotate(angle:-10, dur:600, ease:'Power2', yoyo:true)
  move(dx:10, dy:0, dur:300, ease:'Power3')
  pause(400)
  move(dx:-10, dy:0, dur:400, ease:'Sine.easeOut')
  jitter(intensity:3, interval:100, dur:500)
  rotate(angle:6, dur:400, ease:'Power2', yoyo:true)
  move(dx:0, dy:0, dur:300, ease:'Sine.easeOut')
  pause(500)
  move(dx:-8, dy:5, dur:250, ease:'Power3')
  move(dx:0, dy:0, dur:400, ease:'Sine.easeOut')
```
**Attack**: All heads lunge (disagreeing) — lungeX:8, lungeY:30, rotation:15, scale:1.12. Dur:200. High shake.
**Hit**: Blame game — knockbackY:-15, rotation:-20. Elastic with high overshoot.

#### The Rabbit Hole (void_weaver) — Thing Between Spaces [BOSS]
**Idle**: Reality distortion. Slow rotation (the space around it warps). Periodic fade (phasing between dimensions). Drift that seems to defy logic — moves one direction then appears offset from where it should be. Unsettling.
```
base: bob(6, 2200), breathe(1.04, 2000), wobble(0, 3000)
pattern:
  rotate(angle:5, dur:2500, ease:'Sine.easeInOut', yoyo:true)
  fade(alpha:0.5, dur:1500, ease:'Sine.easeIn', yoyo:true)
  drift(dx:-10, dur:2000, ease:'Sine.easeInOut')
  rotate(angle:-5, dur:2500, ease:'Sine.easeInOut', yoyo:true)
  fade(alpha:0.6, dur:1200, ease:'Sine.easeIn', yoyo:true)
  drift(dx:10, dur:2000, ease:'Sine.easeInOut')
```
**Attack**: Reality tear — lungeY:8, scale:1.2, rotation:10. Dur:200. Caster-style.
**Hit**: Phase shift — knockbackY:-20, scale:0.95. Slow fade-return.

---

### THE ARCHIVE — COMMONS

#### The Thesis Djinn (pressure_djinn) — Air Pressure Elemental
**Idle**: Compressed air energy. Fast unpredictable drifts. Quick direction changes. Feels like bottled pressure constantly escaping. High bob amplitude.
```
base: bob(10, 1400), breathe(1.02, 1200), wobble(1.5, 1600)
pattern:
  drift(dx:-15, dur:800, ease:'Power2')
  drift(dx:10, dur:600, ease:'Power2')
  pause(300)
  drift(dx:5, dur:400, ease:'Power2')
  drift(dx:-12, dur:700, ease:'Power2')
  pause(400)
  drift(dx:0, dur:500, ease:'Sine.easeOut')
  pause(500)
```
**Attack**: Pressure burst — lungeY:15, scale:1.15, rotation:0. Dur:120. Fast.
**Hit**: Deflation — knockbackY:-22, scale:0.92. Fast return (re-pressurize).

#### The Gut Feeling (core_worm) — Iron Core Worm
**Idle**: Similar to Eraser Worm but heavier and more aggressive. Deeper undulation. Wider lateral movement. The iron body has weight.
```
suppressBase: true
pattern:
  squash(scaleX:1.15, scaleY:0.85, dur:400, ease:'Sine.easeIn', yoyo:false)
  squash(scaleX:0.85, scaleY:1.15, dur:400, ease:'Sine.easeOut', yoyo:false)
  move(dx:-12, dy:0, dur:250, ease:'Linear')
  squash(scaleX:1.15, scaleY:0.85, dur:400, ease:'Sine.easeIn', yoyo:false)
  squash(scaleX:0.85, scaleY:1.15, dur:400, ease:'Sine.easeOut', yoyo:false)
  move(dx:12, dy:0, dur:250, ease:'Linear')
  squash(scaleX:1.0, scaleY:1.0, dur:150)
  pause(1000)
```
**Attack**: Bite frenzy — lungeX:10, lungeY:22, rotation:8, scale:1.06. Dur:140.
**Hit**: Curl and recoil — knockbackY:-10, scale:0.92. Slow uncurl.

#### The Bright Idea (biolume_jellyfish) — Bioluminescent Jellyfish
**Idle**: Jellyfish bob. Float up slowly, then quick gentle drop, float up slowly again. Tentacles implied by trailing scaleY stretch on the downbeat. Gentle glow pulse.
```
suppressBase: true
pattern:
  move(dx:0, dy:-10, dur:1500, ease:'Sine.easeOut')
  squash(scaleX:1.05, scaleY:0.92, dur:200, yoyo:false)
  move(dx:0, dy:0, dur:400, ease:'Power2')
  squash(scaleX:0.95, scaleY:1.08, dur:300, yoyo:false)
  squash(scaleX:1.0, scaleY:1.0, dur:200)
  pause(800)
  pulse(scaleX:1.06, scaleY:1.06, dur:300, yoyo:true)
  move(dx:0, dy:-10, dur:1500, ease:'Sine.easeOut')
  squash(scaleX:1.05, scaleY:0.92, dur:200, yoyo:false)
  move(dx:0, dy:0, dur:400, ease:'Power2')
  squash(scaleX:0.95, scaleY:1.08, dur:300, yoyo:false)
  squash(scaleX:1.0, scaleY:1.0, dur:200)
  drift(dx:6, dur:1000, ease:'Sine.easeInOut')
  drift(dx:-6, dur:1000, ease:'Sine.easeInOut')
```
**Attack**: Sting — lungeY:15, rotation:0, scale:1.1. Dur:200.
**Hit**: Float away — knockbackY:-25, rotation:-5. Slow Sine return.

#### The Sacred Text (tectonic_scarab) — Massive Plated Beetle
**Idle**: Heavy immovable. Barely any bob. Very slow breathe. Occasional heavy ground-pound (same as Standardized Test).
```
base: bob(1, 3000), breathe(1.02, 3500), wobble(0, 4000)
pattern:
  pause(6000)
  squash(scaleX:1.06, scaleY:0.95, dur:250, yoyo:true)
```
**Attack**: Shell bash — lungeY:20, scale:1.1. Dur:230.
**Hit**: Impenetrable — knockbackY:-3. Almost nothing.

#### The Devil's Advocate (mantle_fiend) — Mantle-Born Demon
**Idle**: Provocative energy. Quick sharp movements. Periodic lunge-feints (moves toward player then pulls back). Mischievous and aggressive.
```
base: bob(4, 1000), breathe(1.02, 900), wobble(1, 1200)
pattern:
  pause(2000)
  move(dx:0, dy:8, dur:150, ease:'Power3')
  pause(200)
  move(dx:0, dy:0, dur:300, ease:'Back.easeOut')
  pause(2500)
  jitter(intensity:3, interval:70, dur:400)
  pause(1500)
```
**Attack**: Advocate's strike — lungeX:-12, lungeY:25, rotation:10, scale:1.08. Fast (110ms).
**Hit**: Dodges partially — knockbackX:10, knockbackY:-14, rotation:-10. Fast elastic.

#### The Institution (iron_core_golem) — Stone Gargoyle on Rulebooks
**Idle**: Imperious authority. Very still. Periodic gavel tap (small downward squash). Forward lean of judgement.
```
base: bob(1, 2800), breathe(1.02, 3000), wobble(0, 4000)
pattern:
  pause(4000)
  move(dx:0, dy:4, dur:150, ease:'Power3')
  move(dx:0, dy:0, dur:250, ease:'Back.easeOut')
  pause(5000)
  squash(scaleX:1.05, scaleY:0.96, dur:200, yoyo:true)
```
**Attack**: Gavel slam — lungeY:30, rotation:5, scale:1.12. Dur:220. Bounce. Heavy shake.
**Hit**: Gargoyle stoic — knockbackY:-5, rotation:-3. Barely moves.

#### The Rosetta Slab (glyph_sentinel) — Floating Inscribed Tablet
**Idle**: Ancient floating rotation. Slow continuous angle spin (like a display case rotating). High bob (levitating). Smooth and mystical. The inscriptions glow as it turns.
```
base: bob(8, 2200), breathe(1.02, 2500), wobble(0, 3000)
pattern:
  rotate(angle:10, dur:5000, ease:'Linear', yoyo:false)
  rotate(angle:0, dur:100)
  rotate(angle:-10, dur:5000, ease:'Linear', yoyo:false)
  rotate(angle:0, dur:100)
```
**Attack**: Rune blast — lungeY:8, scale:1.15, rotation:0. Dur:200. Caster-style pulse.
**Hit**: Tablet wobble — knockbackY:-15, rotation:-8. Elastic.

#### The Moth of Enlightenment (archive_moth) — Stained Glass Moth
**Idle**: Majestic slow wing beats. Grand and deliberate. ScaleX compression is slower and deeper than Page Flutter — these are HUGE stained glass wings. Between beats, slight upward drift (ascending toward light). Periodic glow pulse (all-seeing eye on wings). This is the most beautiful animation in the game.
```
suppressBase: true
pattern:
  squash(scaleX:0.65, scaleY:1.08, dur:500, ease:'Sine.easeInOut', yoyo:true)
  pause(400)
  squash(scaleX:0.65, scaleY:1.08, dur:500, ease:'Sine.easeInOut', yoyo:true)
  move(dx:0, dy:-6, dur:1000, ease:'Sine.easeOut')
  pulse(scaleX:1.08, scaleY:1.08, dur:400, yoyo:true)
  move(dx:0, dy:0, dur:800, ease:'Sine.easeIn')
  drift(dx:-8, dur:1500, ease:'Sine.easeInOut')
  squash(scaleX:0.65, scaleY:1.08, dur:500, ease:'Sine.easeInOut', yoyo:true)
  pause(400)
  squash(scaleX:0.65, scaleY:1.08, dur:500, ease:'Sine.easeInOut', yoyo:true)
  pulse(scaleX:1.06, scaleY:1.06, dur:350, yoyo:true)
  drift(dx:8, dur:1500, ease:'Sine.easeInOut')
```
**Attack**: Enlightenment flash — lungeY:5, scale:1.2, rotation:0. Dur:250. The scale-up IS the attack (light blast). Low shake.
**Hit**: Wing fold — knockbackY:-15, scaleX narrows. Slow recovery (800ms). Majestic even in pain.

#### The Hyperlink (rune_spider) — URL Jellyfish
**Idle**: Jellyfish pulse-drift (same bob rhythm as Bright Idea). But with periodic horizontal flip (link being "followed" — redirecting). URL tentacles implied by elongation on drop.
```
suppressBase: true
pattern:
  move(dx:0, dy:-8, dur:1200, ease:'Sine.easeOut')
  squash(scaleX:1.06, scaleY:0.9, dur:180, yoyo:false)
  move(dx:0, dy:0, dur:350, ease:'Power2')
  squash(scaleX:0.94, scaleY:1.1, dur:250, yoyo:false)
  squash(scaleX:1.0, scaleY:1.0, dur:150)
  drift(dx:-10, dur:1200, ease:'Sine.easeInOut')
  pause(500)
  flip(flipX:-1, dur:150)
  move(dx:0, dy:-8, dur:1200, ease:'Sine.easeOut')
  squash(scaleX:1.06, scaleY:0.9, dur:180, yoyo:false)
  move(dx:0, dy:0, dur:350, ease:'Power2')
  squash(scaleX:0.94, scaleY:1.1, dur:250, yoyo:false)
  squash(scaleX:1.0, scaleY:1.0, dur:150)
  drift(dx:10, dur:1200, ease:'Sine.easeInOut')
  pause(500)
  flip(flipX:1, dur:150)
```
**Attack**: Link click — lungeY:15, scale:1.08, rotation:0. Dur:180.
**Hit**: 404 — knockbackY:-20, scale:0.95. Slow drift return.

#### The Unknown Unknown (void_tendril) — Tendril from Elsewhere
**Idle**: Reaching and retracting. Slow vertical stretch (reaching out) then squash back (retracting). Combined with slight lateral drift. Alien and unsettling.
```
base: bob(5, 2000), breathe(1.01, 2200), wobble(1, 2800)
pattern:
  squash(scaleX:0.9, scaleY:1.15, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  pause(1000)
  drift(dx:-8, dur:1500, ease:'Sine.easeInOut')
  squash(scaleX:0.9, scaleY:1.15, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:8, dur:1500, ease:'Sine.easeInOut')
```
**Attack**: Tendril lash — lungeX:15, lungeY:15, rotation:0, scale:1.08. Dur:200.
**Hit**: Retract — knockbackY:-20, scaleY:0.9. Elastic.

#### The Fake News (tome_mimic) — Skeleton Newspaper Reader
**Idle**: Casual menace. Slight paper rustle (quick tiny squash — newspaper shake). Periodic lean to one side (reading). Smooth confidence. Occasional forward lean (showing you the "headline").
```
base: bob(2, 2000), breathe(1.01, 2200), wobble(0, 3000)
pattern:
  pause(3000)
  squash(scaleX:1.04, scaleY:0.98, dur:100, yoyo:true)
  pause(300)
  squash(scaleX:1.04, scaleY:0.98, dur:80, yoyo:true)
  pause(3500)
  rotate(angle:3, dur:1200, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
  move(dx:0, dy:4, dur:500, ease:'Sine.easeOut')
  pause(800)
  move(dx:0, dy:0, dur:400, ease:'Sine.easeIn')
```
**Attack**: Newspaper slap — lungeX:10, lungeY:18, rotation:8, scale:1.06. Dur:170.
**Hit**: Stumbles — knockbackY:-12, rotation:-10. Back.easeOut.

---

### THE ARCHIVE — MINI-BOSSES

#### The First Question (primordial_wyrm) — Floating Stone Head
**Idle**: Eternal question. Majestic slow float (high bob amplitude). Very slight angle oscillation (the head turning to examine you). Slow deep breathe scale (the mouth eternally asking). Ancient and ominous. The weight of the first question ever asked.
```
base: bob(8, 3000), breathe(1.04, 3500), wobble(0, 5000)
pattern:
  rotate(angle:3, dur:3000, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
  pulse(scaleX:1.06, scaleY:1.06, dur:600, ease:'Sine.easeInOut', yoyo:true)
  pause(3000)
  rotate(angle:-3, dur:3000, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Existential blast — lungeY:5, scale:1.2, rotation:0. Dur:250. Caster pulse. Shake 0.004.
**Hit**: Ancient resonance — knockbackY:-10, rotation:-4. Very slow Sine return (600ms).

#### The Dean (iron_archon) — Iron-Forged Magnetic Authority
**Idle**: Magnetic presence. Slight constant pull toward center (recentering after any drift). Periodic pulse (magnetic field). Authoritative but not aggressive.
```
base: bob(3, 2000), breathe(1.03, 2200), wobble(0, 3000)
pattern:
  pulse(scaleX:1.06, scaleY:1.06, dur:300, yoyo:true)
  pause(3000)
  drift(dx:6, dur:1500, ease:'Sine.easeInOut')
  drift(dx:-6, dur:1500, ease:'Sine.easeInOut')
  pulse(scaleX:1.08, scaleY:1.08, dur:250, yoyo:true)
  pause(3000)
```
**Attack**: Magnetic slam — lungeY:25, rotation:0, scale:1.12. Dur:200. Heavy shake.
**Hit**: Magnetic recovery — knockbackY:-10. Fast Back.easeOut (magnetically pulls back to position).

#### The Dissertation (pressure_colossus) — Ultra-Dense Golem
**Idle**: Barely moves. So dense that movement itself is an event. Ultra-slow breathe. When it does squash, the ground should feel like it shakes. Heaviest enemy in the game.
```
base: bob(0.5, 3500), breathe(1.02, 4000), wobble(0, 5000)
pattern:
  pause(8000)
  squash(scaleX:1.08, scaleY:0.92, dur:350, ease:'Power2', yoyo:true)
```
**Attack**: Thesis slam — lungeY:25, rotation:0, scale:1.15. Dur:300 (slow heavy windup). Bounce. MAX shake (0.008).
**Hit**: Immovable — knockbackY:-2, rotation:-1. Almost completely still.

#### The Eureka (biolume_monarch) — Bioluminescent Butterfly
**Idle**: Majestic slow wing beats like Moth of Enlightenment but with more lateral drift (butterfly flight path is more wandering than moth). Brighter pulse moments (eureka flashes). Beautiful and dangerous.
```
suppressBase: true
pattern:
  squash(scaleX:0.7, scaleY:1.06, dur:450, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:-10, dur:1000, ease:'Sine.easeInOut')
  squash(scaleX:0.7, scaleY:1.06, dur:450, ease:'Sine.easeInOut', yoyo:true)
  pulse(scaleX:1.1, scaleY:1.1, dur:200, yoyo:true)
  drift(dx:10, dur:1000, ease:'Sine.easeInOut')
  squash(scaleX:0.7, scaleY:1.06, dur:450, ease:'Sine.easeInOut', yoyo:true)
  move(dx:0, dy:-5, dur:800, ease:'Sine.easeOut')
  squash(scaleX:0.7, scaleY:1.06, dur:450, ease:'Sine.easeInOut', yoyo:true)
  move(dx:0, dy:0, dur:600, ease:'Sine.easeIn')
  drift(dx:5, dur:800, ease:'Sine.easeInOut')
  drift(dx:-5, dur:800, ease:'Sine.easeInOut')
```
**Attack**: Light curse — lungeY:5, scale:1.2, rotation:0. Dur:200. Caster pulse.
**Hit**: Wing fold — knockbackY:-18, scaleX narrows. Slow recovery.

#### The Paradigm Shift (tectonic_titan) — Living Earthquake
**Idle**: Seismic. Constant micro-jitter (the ground trembles around it). Periodic heavy squash (tectonic plate shift). The animation itself should feel geological.
```
base: bob(1, 2800), breathe(1.02, 3000), wobble(0, 4000)
pattern:
  jitter(intensity:2, interval:80, dur:2000)
  pause(1000)
  squash(scaleX:1.12, scaleY:0.88, dur:250, ease:'Power3', yoyo:true)
  pause(500)
  jitter(intensity:3, interval:60, dur:1500)
  squash(scaleX:0.95, scaleY:1.06, dur:200, yoyo:true)
  pause(1500)
```
**Attack**: Tectonic slam — lungeY:30, rotation:3, scale:1.15. Dur:250. Bounce. MAX shake.
**Hit**: Geological — knockbackY:-4, rotation:-2. Almost nothing.

#### The Ancient Tongue (glyph_warden) — Protective Rune Construct
**Idle**: Rune glow cycle. Steady, rhythmic pulse (runes activating in sequence). Slight hover. Healing implied by periodic scale growth then settle.
```
base: bob(4, 2200), breathe(1.02, 2500), wobble(0, 3000)
pattern:
  pulse(scaleX:1.05, scaleY:1.05, dur:400, yoyo:true)
  pause(2000)
  pulse(scaleX:1.06, scaleY:1.06, dur:350, yoyo:true)
  pause(2500)
  pulse(scaleX:1.04, scaleY:1.04, dur:300, yoyo:true)
  pause(3000)
```
**Attack**: Rune blast — lungeY:8, scale:1.15, rotation:0. Dur:200. Caster pulse.
**Hit**: Rune flicker — knockbackY:-10, rotation:-5. Elastic.

#### The Lost Thesis (archive_specter) — Librarian Ghost
**Idle**: Spectral cataloguing. Floating (high bob). Periodic fade (phasing through shelves). Lateral drift (patrolling aisles). Territorial but ghostly.
```
base: bob(8, 2000), breathe(1.02, 2200), wobble(1, 2800)
pattern:
  fade(alpha:0.4, dur:2000, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:-12, dur:2000, ease:'Sine.easeInOut')
  fade(alpha:0.5, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  drift(dx:12, dur:2000, ease:'Sine.easeInOut')
```
**Attack**: Spectral swipe — lungeX:10, lungeY:12, rotation:-8, scale:1.08. Dur:180.
**Hit**: Phase out — knockbackY:-20, alpha drops. Slow return.

---

### THE ARCHIVE — ELITES

#### The Dunning-Kruger (mantle_dragon) — Overconfident Dragon
**Idle**: Arrogant swoop. Wide confident swooping drift. High amplitude bob (flying high). Occasional puff-up pulse (inflated ego). It thinks it's the best.
```
base: bob(8, 1200), breathe(1.02, 1400), wobble(2, 1600)
pattern:
  drift(dx:-18, dur:1800, ease:'Sine.easeInOut')
  pulse(scaleX:1.08, scaleY:1.08, dur:200, yoyo:true)
  drift(dx:18, dur:1800, ease:'Sine.easeInOut')
  pulse(scaleX:1.1, scaleY:1.1, dur:200, yoyo:true)
```
**Attack**: Overconfident dive — lungeX:-20, lungeY:35, rotation:-25, scale:1.1. Dur:140. Swooper.
**Hit**: Ego bruised — knockbackY:-18, rotation:15. Long elastic (overreacts to damage).

#### The Singularity (core_harbinger) — Knowledge Density Boss
**Idle**: Gravitational pull. Slow inward pulse (drawing things toward it). Slight rotation. Intense stillness between pulses. A black hole of knowledge.
```
base: bob(2, 2800), breathe(1.03, 3000), wobble(0, 3500)
pattern:
  pulse(scaleX:0.95, scaleY:0.95, dur:1000, ease:'Sine.easeIn', yoyo:true)
  pause(2000)
  pulse(scaleX:0.93, scaleY:0.93, dur:800, ease:'Sine.easeIn', yoyo:true)
  pause(2500)
  rotate(angle:3, dur:2000, ease:'Sine.easeInOut', yoyo:true)
```
**Attack**: Gravitational blast — lungeY:5, scale:1.25, rotation:0. Dur:200. Caster pulse. Heavy shake.
**Hit**: Density absorbs — knockbackY:-5, rotation:-3. Minimal.

---

### THE ARCHIVE — BOSSES

#### The Omnibus (knowledge_golem) — Compressed Book Golem [BOSS]
**Idle**: Massive and heavy. Deep slow breathe. Occasional page-rustle jitter. Forward lean of judgment. The weight of all knowledge compressed into one form.
```
base: bob(2, 2500), breathe(1.04, 2200), wobble(0, 3500)
pattern:
  pause(4000)
  jitter(intensity:2, interval:80, dur:300)
  pause(2000)
  squash(scaleX:1.08, scaleY:0.93, dur:300, ease:'Power2', yoyo:true)
  pause(3000)
  move(dx:0, dy:4, dur:1000, ease:'Sine.easeInOut')
  pause(1500)
  move(dx:0, dy:0, dur:1000, ease:'Sine.easeInOut')
```
**Attack**: Knowledge crush — lungeY:35, rotation:5, scale:1.18. Dur:250. Bounce. MAX shake.
**Hit**: Barely notices — knockbackY:-5, rotation:-3. Slow return.

#### The Final Lesson (the_curator) — Final Guardian [BOSS]
**Idle**: Calm authority. Smooth controlled movements. Periodic teaching gestures (slight angle swings with pulse — pointing at things). This is the endgame boss. Its composure never breaks. Slow, measured, patient.
```
base: bob(4, 2000), breathe(1.03, 2200), wobble(0, 3000)
pattern:
  rotate(angle:3, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
  pulse(scaleX:1.08, scaleY:1.08, dur:300, yoyo:true)
  pause(2500)
  rotate(angle:-3, dur:1500, ease:'Sine.easeInOut', yoyo:true)
  pause(2000)
  move(dx:0, dy:3, dur:800, ease:'Sine.easeOut')
  pulse(scaleX:1.06, scaleY:1.06, dur:250, yoyo:true)
  move(dx:0, dy:0, dur:600, ease:'Sine.easeIn')
```
**Attack**: Final lesson — lungeY:10, scale:1.2, rotation:0. Dur:200. Caster. The lesson arrives.
**Hit**: Composure crack — knockbackY:-12, rotation:-6. Back.easeOut. Recovers dignity.

---

### REMAINING ENEMIES (Prismatic Jelly, Ember Skeleton)

These two retain their old sprites and use their existing archetypes:
- **Prismatic Jelly** (prismatic_jelly) — Keep `floater` archetype
- **Ember Skeleton** (ember_skeleton) — Keep `striker` archetype

---

## Sub-step 3: Wire Up and Verify

1. Implement the two new step types (`rotate`, `fade`) in `EnemySpriteSystem.runPatternStep`
2. Create the `ENEMY_ANIM_OVERRIDES` map in `enemyAnimations.ts` with all 84 custom configs
3. Modify `getAnimConfig` signature to accept `enemyId`
4. Thread `enemyId` through `CombatScene.setEnemy` → `EnemySpriteSystem.setAnimConfig`
5. Visual verification: Load combat with at least 10 different enemies via `__terraScenario` and confirm:
   - Wing-flappers (Page Flutter, Burnout, Moth of Enlightenment) visibly flap
   - Writer's Block blinks like a cursor
   - Blank Spot glitches in and out
   - Pressure Cooker rattles
   - Eraser Worm undulates
   - Group Project wobbles chaotically

**Files affected**:
- `src/data/enemyAnimations.ts` — new step types, override map, modified `getAnimConfig`
- `src/game/systems/EnemySpriteSystem.ts` — `rotate`/`fade` step handlers, updated `setAnimConfig`
- `src/game/scenes/CombatScene.ts` — pass `enemyId` to `setAnimConfig`

**Acceptance criteria**:
- [ ] All 84 custom-animated enemies have unique idle behaviors
- [ ] `rotate` and `fade` step types work correctly
- [ ] Wing-flappers produce visible wing-fold effect via scaleX compression
- [ ] Writer's Block produces cursor-blink via alpha toggling
- [ ] Blank Spot produces glitch effect via erratic alpha + jitter
- [ ] No regressions — Prismatic Jelly and Ember Skeleton still use archetype fallback
- [ ] Typecheck and build pass
- [ ] Visual verification of at least 10 enemies via Playwright

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (no animation logic is tested but ensure no imports break)
- [ ] Playwright visual inspection of 10+ enemies across all 4 regions
- [ ] No console errors during combat transitions
- [ ] Reduce-motion mode still works (all animations skipped)
- [ ] Enrage overlay still works on top of custom patterns
