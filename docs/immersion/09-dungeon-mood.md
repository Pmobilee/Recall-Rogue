---
status: implemented
delete-after-implementation: true
priority: ambitious
effort: L
impact: high
owner-agent: game-logic
depends-on: 01-turn-transitions, 03-chain-escalation, 05-knowledge-reactive
---

# Dynamic Dungeon Mood System

## What It Is

A persistent mood state (continuous 0.0 to 1.0 value representing calm-to-desperate) driven by real-time game signals that continuously modulates all visual atmosphere parameters: vignette intensity, ambient color temperature, particle rate and chaos, light flicker rate, fog density, and scene desaturation. The mood value smooth-interpolates toward its target over 2-3 seconds, never jumping instantly. The system is the orchestration baseline layer that specs 01, 03, and 05 build their transient spikes on top of.

## Why It Matters

Currently the combat screen looks the same at full HP with a 10-chain going as it does at 5 HP with three wrong answers in a row. The only game-state-reactive visual is the near-death red vignette pulse in `CombatScene.ts:628-641`, which is binary and jarring. A unified mood layer means the dungeon environment continuously communicates game state to the player through peripheral sensation — not through explicit UI numbers, but through the *feeling* of the room. When a player is winning, the room warms and brightens. When they are losing, it grows colder, darker, and more agitated. This is the emotional backbone that all other immersion specs reinforce.

## Current State

- `CombatAtmosphereSystem.ts` — configured once per encounter from floor theme. No runtime modulation API exists. Parameters (particle rate, particle velocity, fog settings) are static after initialization.
- `DepthLightingSystem.ts` — exposes `setPointLight()`, `setAmbientLight()`, `setFogParams()`. These can be called at runtime but nothing currently does so dynamically during combat.
- `CombatScene.ts:628-641` — near-death red vignette: the ONLY existing game-state-reactive visual. It pulses when HP drops below threshold. Independent of atmosphere system.
- `gaiaAvatar.ts` — keeper expression states (happy/worried/excited) triggered per-event. Per-event transient, not continuous mood.
- Specs 01 (turn transitions), 03 (chain escalation), 05 (knowledge-reactive): planned but not yet implemented. DungeonMoodSystem is the baseline they stack on top of.
- **Gap:** No unified system reads multiple game signals, calculates a continuous mood value, and routes modifiers to all atmosphere subsystems simultaneously.

## Implementation Spec

### Files to Create

**`src/game/systems/DungeonMoodSystem.ts`**

```typescript
export interface MoodInputs {
  playerHpRatio: number;          // 0.0 (dead) to 1.0 (full)
  chainLength: number;            // current active chain length (0 = no chain)
  consecutiveCorrect: number;     // streak of correct answers this encounter
  enemyThreatLevel: number;       // 0.0 to 1.0 (computed from enemy HP ratio + intent damage)
  floorDepth: number;             // 1-15+ (raw floor number)
}

export interface MoodModifiers {
  vignetteMultiplier: number;       // multiplied against base vignette intensity
  colorTempShift: number;           // -1.0 (warm) to +1.0 (cold), 0.0 = neutral
  particleRateMultiplier: number;   // multiplied against base particle emission rate
  particleChaosMultiplier: number;  // 1.0 = base velocity, 1.5 = 50% more jitter
  lightFlickerMultiplier: number;   // multiplied against base flicker frequency
  fogDensityMultiplier: number;     // multiplied against base fog density
  desaturationAmount: number;       // 0.0 = none, 0.15 = -15% saturation
}

export class DungeonMoodSystem {
  private currentMood: number = 0.5;     // 0.0 calm, 1.0 desperate
  private targetMood: number = 0.5;
  private readonly LERP_SPEED = 0.0003;  // per ms — reaches target in ~2500ms at 0.5 distance

  constructor(
    private atmosphere: CombatAtmosphereSystem,
    private lighting: DepthLightingSystem,
    private scene: Phaser.Scene
  ) {}

  /** Call each frame with current game state. */
  update(delta: number, inputs: MoodInputs): void

  /** Called by specs 01/03/05 to push transient modifier on top of mood baseline. */
  applyTransientModifier(mod: Partial<MoodModifiers>, durationMs: number): void

  /** Reset to neutral at encounter start. */
  reset(): void

  getCurrentMood(): number
  getCurrentModifiers(): MoodModifiers
}
```

### Files to Modify

**`src/game/scenes/CombatScene.ts`**
- Import and instantiate `DungeonMoodSystem` in `create()`, after atmosphere and lighting systems.
- In `update(time, delta)`: collect `MoodInputs` from game state and call `dungeonMood.update(delta, inputs)`.
- Remove or subsume the existing near-death vignette pulse (lines 628-641) — its functionality becomes part of `MoodModifiers.vignetteMultiplier` at `playerHpRatio < 0.25`.
- Expose `dungeonMood` property so specs 01/03/05 can call `applyTransientModifier`.

**`src/game/systems/CombatAtmosphereSystem.ts`**
- Add `applyMoodModifiers(mod: MoodModifiers): void` — adjusts particle emitter rate and velocity jitter in real time.
- Particle rate: `emitter.setFrequency(baseFrequency / mod.particleRateMultiplier)` (lower frequency = more particles).
- Velocity jitter: modify emitter's `speedX` and `speedY` bounds by `mod.particleChaosMultiplier`.
- Store `baseFrequency` and `baseVelocityBounds` at init so modifiers are always applied relative to the original values, never compounding.

**`src/game/systems/DepthLightingSystem.ts`**
- Add `applyMoodModifiers(mod: MoodModifiers): void`.
  - `vignetteMultiplier` → adjust vignette uniform: `uVignetteIntensity = baseVignette * mod.vignetteMultiplier`.
  - `colorTempShift` → add to `uAmbientColor.r` and subtract from `uAmbientColor.b` scaled by `mod.colorTempShift * 0.05` (so ±1.0 shift = ±0.05 color channel, subtle).
  - `lightFlickerMultiplier` → adjust `uFlickerSpeed` uniform (if it exists) or time scaling fed to flicker noise.
  - `fogDensityMultiplier` → multiply current fog density uniform.
  - `desaturationAmount` → set `uDesaturation` uniform (add if not present: `color.rgb = mix(color.rgb, vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114))), uDesaturation)`).
- Store base values for each parameter at init.

**`src/data/roomAtmosphere.ts`**
- Add `MoodModifiers` export (import from `DungeonMoodSystem` or co-locate definition here).

### Technical Details

**Mood calculation (inside `DungeonMoodSystem.update`):**
```typescript
computeTargetMood(inputs: MoodInputs): number {
  const hpSignal = (1.0 - inputs.playerHpRatio) * 0.40;          // low HP → high mood
  const chainSignal = Math.min(inputs.chainLength / 8, 1.0)       // chain → low mood
                      * -0.20;
  const streakSignal = Math.min(inputs.consecutiveCorrect / 5, 1.0)
                       * -0.15;                                    // streak → low mood
  const threatSignal = inputs.enemyThreatLevel * 0.15;            // threat → high mood
  const depthSignal = Math.min((inputs.floorDepth - 1) / 14, 1.0)
                      * 0.10;                                      // deeper → slightly higher

  const raw = 0.5 + hpSignal + chainSignal + streakSignal + threatSignal + depthSignal;
  return Math.max(0.0, Math.min(1.0, raw));
}
```

The 0.5 base means a player at full HP with no chain or threat settles around 0.5 (neutral, not calm). They must have a chain going AND a streak to push below 0.4 (calm); they must be low HP AND face a threatening enemy to push above 0.8 (desperate).

**Smooth interpolation:**
```typescript
update(delta: number, inputs: MoodInputs): void {
  this.targetMood = this.computeTargetMood(inputs);
  // Exponential lerp: approaches target asymptotically
  const alpha = 1.0 - Math.pow(0.998, delta);  // ~0.998^16ms ≈ 0.031 per frame at 60fps
  this.currentMood = this.currentMood + (this.targetMood - this.currentMood) * alpha;
  this.pushModifiers();
}
```
At 60fps with `0.998^16 ≈ 0.031` per frame: reaching 95% of target takes `log(0.05)/log(0.998) ≈ 149 frames ≈ 2490ms`. This gives the desired 2-3 second feel.

**MoodModifiers output mapping:**
```typescript
private computeModifiers(mood: number): MoodModifiers {
  return {
    vignetteMultiplier:      lerp(0.8, 1.4, mood),
    colorTempShift:          lerp(-1.0, 1.0, mood),   // warm at calm, cold at desperate
    particleRateMultiplier:  lerp(0.8, 1.5, mood),
    particleChaosMultiplier: lerp(1.0, 1.5, mood),
    lightFlickerMultiplier:  lerp(1.0, 1.8, mood),
    fogDensityMultiplier:    lerp(0.9, 1.3, mood),
    desaturationAmount:      lerp(0.0, 0.15, mood),
  };
}
```
All outputs are linear interpolations — simple, predictable, easy to tune.

**Enemy threat level computation (in `CombatScene.update`, fed as input):**
```typescript
const enemyHpRatio = enemy.hp / enemy.maxHp;
const intentDamageRatio = Math.min(enemy.intentDamage / 20, 1.0);  // 20 damage = max threat
const enemyThreatLevel = (1.0 - enemyHpRatio) * 0.5 + intentDamageRatio * 0.5;
// High HP enemy about to deal 20+ damage = 0.5 threat; low HP enemy with low intent = 0.25
```

**Transient modifier stacking (for specs 01/03/05):**
```typescript
applyTransientModifier(mod: Partial<MoodModifiers>, durationMs: number): void {
  // Store in array with expiry timestamp
  this.transients.push({ mod, expiresAt: this.scene.time.now + durationMs });
}

// In pushModifiers(), merge transients on top of baseline:
private getMergedModifiers(): MoodModifiers {
  const base = this.computeModifiers(this.currentMood);
  const now = this.scene.time.now;
  this.transients = this.transients.filter(t => t.expiresAt > now);
  for (const t of this.transients) {
    // Multiply where applicable (rate, chaos, flicker), add where applicable (color temp, vignette)
    if (t.mod.particleRateMultiplier) base.particleRateMultiplier *= t.mod.particleRateMultiplier;
    if (t.mod.vignetteMultiplier)     base.vignetteMultiplier     *= t.mod.vignetteMultiplier;
    if (t.mod.colorTempShift)         base.colorTempShift         += t.mod.colorTempShift;
    // ... etc
  }
  return base;
}
```

### Integration Points

**Spec 01 (turn transitions):**
- On turn-start beat, call `dungeonMood.applyTransientModifier({ vignetteMultiplier: 1.3 }, 300)`.
- The vignette darkens for 300ms then returns to mood-driven baseline. At high mood, the darken is more pronounced (1.4 base × 1.3 transient = 1.82 peak).

**Spec 03 (chain escalation):**
- Chain escalation emits its own `applyTransientModifier` calls: at chain 4+, add warm color temp (`colorTempShift: -0.5`, duration 500ms per chain hit).
- Stacks multiplicatively on top of mood baseline — so desperate mood + active chain produces cool-baseline + warm-transient spikes = tense oscillation.

**Spec 05 (knowledge-reactive):**
- Correct streak handling: `consecutiveCorrect` feeds directly into `MoodInputs`, so the mood system automatically shifts calmer as the streak builds. No additional integration needed.
- Spec 05 may additionally fire `applyTransientModifier({ particleRateMultiplier: 1.3 }, 600)` on correct answers for immediate particle burst — that transient sits on top of the mood-driven baseline.

**Encounter lifecycle:**
- `reset()` called at encounter start: `currentMood = targetMood = 0.5`.
- `update()` called every frame in `CombatScene.update()`.
- System destroyed in `CombatScene.shutdown()`.

### Reduce-Motion Handling

When `prefersReducedMotion()` is true:
- Skip `particleRateMultiplier` and `particleChaosMultiplier` outputs — particle behavior is unchanged regardless of mood.
- Skip `lightFlickerMultiplier` — flicker rate does not change.
- Continue applying `vignetteMultiplier` and `colorTempShift` — these are color changes, not motion.
- Continue applying `fogDensityMultiplier` — fog density is not motion (no animated drift; see spec 08 for fog drift which has its own reduce-motion gate).
- Continue applying `desaturationAmount`.
- Result: mood is still communicated through color and vignette; all motion-based signals are suppressed.

### Device Tier Handling

| Output | Low Tier | Mid Tier | Flagship |
|---|---|---|---|
| vignetteMultiplier | On | On | On |
| colorTempShift | On | On | On |
| particleRateMultiplier | Off | On | On |
| particleChaosMultiplier | Off | Off | On |
| lightFlickerMultiplier | Off | On | On |
| fogDensityMultiplier | Off | On | On |
| desaturationAmount | On | On | On |

Low-tier devices get mood communicated via vignette and color temperature only — cheap uniform operations. Mid tier adds particle and fog modulation. Flagship adds particle chaos and the full set.

Implementation: `DungeonMoodSystem.pushModifiers()` checks tier before calling the relevant system methods. Cheapest modifiers (vignette, color) always pushed; expensive ones (particle chaos) skipped on low tiers.

## Verification

Play through the following scenarios, observing atmosphere continuously:

1. **Full HP + active chain (8+ links) + correct answer streak:** Room should shift warm (orange-amber tint), slightly brighter, lower particle density, less chaotic motion. Mood value should be near 0.2 (calm).

2. **Low HP (< 25%) + no chain + wrong answers + high enemy intent:** Room should shift cold (blue tint), vignette intensified, particles faster and more chaotic, fog thicker, slight desaturation. Mood value should be near 0.85 (desperate).

3. **State transition between above two scenarios (take heavy damage mid-chain):** Observe gradual 2-3 second lerp — never a jarring instant switch. Color temperature transitions through neutral.

4. **Encounter start:** Mood resets to 0.5 neutral. Room atmosphere should match encounter's baseline theme without mood skew.

5. **Reduce-motion mode:** Vignette and color temperature shift with HP/chain state. No particle behavior change. No flicker rate change.

6. **Low device tier:** Vignette and color shift function. Particle rates unchanged from base. Framerate unaffected.

7. **Spec integration test (after 01/03/05 implemented):** Verify transient modifier from chain escalation (spec 03) visibly stacks on top of mood baseline during chain — a desperate player getting a chain should see the room briefly pulse warm even while the baseline remains cold.

## Effort Estimate

**L (Large) — 4-6 days**
- Day 1: Implement `DungeonMoodSystem.ts` core: input collection, mood calculation, lerp, modifier output.
- Day 2: Add `applyMoodModifiers` to `CombatAtmosphereSystem` — particle rate and chaos modulation.
- Day 3: Add `applyMoodModifiers` to `DepthLightingSystem` — vignette, color temp, flicker, fog, desaturation uniforms.
- Day 4: Wire into `CombatScene.update()`, remove legacy near-death vignette code, implement tier gating.
- Day 5: Tune weights and output ranges per scenario (full HP/chain vs low HP/no chain) via visual inspection.
- Day 6: Implement `applyTransientModifier` API; verify correct stacking behavior; reduce-motion and tier verification.
