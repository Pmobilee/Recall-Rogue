# Current State — Existing Visual & Audio Systems

> TEMPORARY FILE. DELETE AFTER IMPLEMENTATION. This is the "what we already have"
> reference. Read this before any spec to avoid reimplementing existing behavior.

## 1. Enemy Sprite System

**Source:** `src/game/systems/EnemySpriteSystem.ts`, `src/data/enemyAnimations.ts`

8 animation archetypes: `swooper`, `slammer`, `crawler`, `caster`, `floater`, `lurcher`, `striker`, `trembler`.

**Hit reaction** (lines 714-792): white flash (0xffffff, 60ms), knockback (configurable X/Y offset, ~95ms), rotation (~-12°), scale (~1.06×), elastic spring-back (350ms). Respects atmosphere tint. Reduce-motion: flash only.

**Attack animation** (lines 666-708): lunge forward (configurable Y ~22px, rotation ~10°, scale ~1.1×, 180ms Power2 ease), spring return with elastic ease. Medium screen shake.

**Death animation** (lines 798+): red tint, jitter, ash disintegration with 25 gray particles (upward, 600ms), second burst at 500-800ms.

**Idle:** bob, breathe, wobble patterns per archetype.

**Enrage:** glowing rectangle overlay, particle timer, scale pulse.

---

## 2. Weapon Animation System

**Source:** `src/game/systems/WeaponAnimationSystem.ts`

**Sword slash** (lines 290-365): Pseudo-3D Minecraft-style with perspective taper. Canvas-based, rotate + foreshorten over 250ms. Positioned at enemy coords. Micro screen shake at impact. 150ms fade-out.

**Tome cast** (lines 374-462): Arm+tome rises from bottom-right (250ms), glow burst (1.15× scale, 80ms), radial pulse ring (250ms), 12 colored particle burst, drop back (200ms). Color-coded by card type.

**Shield raise** (lines 469-553): Vertical rise from bottom-left (200ms), white flash (60ms), blue radial pulse, blue-white particles, micro shake, 180ms hold.

All use bitmap masking, respect reduce-motion and turbo mode.

---

## 3. Screen Shake System

**Source:** `src/game/systems/ScreenShakeSystem.ts`

3 tiers: micro (2px/100ms/40Hz), medium (4px/200ms/28Hz), heavy (8px/400ms/18Hz).

Perlin-noise-based smooth oscillation, linear fade-out in last 30%. Priority system (higher tiers replace lower), intensity multiplier. Camera scroll offset approach (not Phaser `camera.shake`). Respects `prefers-reduced-motion`.

Usage: enemy hit=micro, enemy attack=medium, player damage=medium, kill=heavy, shield block=micro.

---

## 4. Combat Particle System

**Source:** `src/game/systems/CombatParticleSystem.ts`

- Impact burst: 4px squares, radial 0-360°, speed 60-160, 400ms, tintable (gold/red)
- Directional burst: 2×8 streaks, angle spread, speed 100-200, 350ms
- Combo milestone: scales with combo level (3/4/5/6+), gold ring
- Enemy death: 25 gray ash particles, upward, 600ms + second burst
- Weapon bursts: tome 12 colored rects, shield 10 blue-white particles
- Device-tier scaling (0.65× on low-end), budget-aware

---

## 5. Status Effect Visual System

**Source:** `src/game/systems/StatusEffectVisualSystem.ts`

| Effect | Color | Direction | Gravity | Rate | Duration |
|---|---|---|---|---|---|
| Poison | 0x44ff44 (green) | downward drips | +60 | 3/sec | 800ms |
| Burn | 0xff6600 (orange) | upward embers | -40 | 3/sec | 800ms |
| Freeze | 0x88ccff (light blue) | gentle drift | +5 | 2/sec | 800ms |
| Bleed | 0xcc0000 (red) | heavy drips | +80 | 2/sec | 800ms |
| Buff | 0xffd700 (gold) | rotating ring + pulsing alpha | — | — | 4s rotation, radius 60px |
| Debuff | 0x9b59b6 (purple) | rotating ring | — | — | same as buff |

Particles spawn at enemy position ±30px offset. Device-tier scaled.

---

## 6. Damage Numbers

**Source:** `src/ui/components/DamageNumber.svelte`

10 types with colors:

| Type | Color |
|---|---|
| damage | #FF4444 |
| critical | #E74C3C |
| block | #4499FF |
| heal | #44FF88 |
| poison | #AA44FF |
| burn | #FF8833 |
| bleed | #CC1111 |
| gold | #FFD700 |
| status | #4ADE80 |
| buff | #38BDF8 |

Proportional scaling: ≤5 = 24-32px, ≥20 = 36-44px, critical +8-12px. Arc trajectory (1000ms), random left/right jitter, color-matched text shadow glow. Position anchors: enemy 65%/35%, player 15%/82%.

---

## 7. Depth Lighting PostFX

**Source:** `src/game/shaders/DepthLightingFX.ts`, `src/game/systems/DepthLightingSystem.ts`, `src/data/lightSourceManifest.ts`

GLSL fragment shader: Sobel-filter depth normals, 5-step quantization for pixel art aesthetic.

- Directional lighting: NdotL dot product, 5-step quantization
- Point lights: up to 8, smooth distance attenuation, depth-aware, multi-frequency flicker noise, optional ray-march shadow (flagship only, 6 steps)
- SSAO: 4-tap (mid) or 8-tap (flagship), smoothstep 0.15
- Fog: depth-based smoothstep blend
- Parallax breathing: sinusoidal UV displacement with edge fade

3 quality tiers: low (disabled), mid (4-tap SSAO + point lights), flagship (8-tap + ray-march + color bleeding).

Light source manifest: torch, campfire, lantern, crystal, etc. with flicker params.

---

## 8. Combat Atmosphere System

**Source:** `src/game/systems/CombatAtmosphereSystem.ts`, `src/data/roomAtmosphere.ts`

5 themes by floor range:

| Theme | Floors |
|---|---|
| dust | 1-3 |
| embers | 4-6 |
| ice | 7-9 |
| arcane | 10-12 |
| void | 13+ |

`AtmosphereConfig` covers: color grading, fog, particles, light shafts, lighting, rim lighting, heat haze, micro-animation.

Dual-depth particle emitters: back (depth 3, large slow) + front (depth 12, smaller faster). Fog layer (depth 2), light shafts repositioned to enemy X. Boss amplification: fog ×1.5, particles ×1.3, lighting ×1.2, rim ×1.3. Reduce-motion: entire system disabled, config still accessible.

---

## 9. Room Transitions

**Source:** `src/ui/components/ParallaxTransition.svelte`

WebGL parallax dolly-zoom with depth map displacement. 3 animation types: `enter`, `exit-forward`, `exit-backward` (3000ms each). Walking bob: sine wave (8 cycles × amplitude × easing). Vignette darkening, brightness grading, opacity fade. Persist mode: canvas remains as static background for Svelte rooms, `onSettle` callback. Plays room-transition audio.

---

## 10. Staggered Pop-In

**Source:** `src/ui/utils/roomPopIn.ts`

`staggerPopIn()`: sine-eased delay distribution, scale 0→1.08→1.0, opacity fade. 200ms per element with `cubic-bezier(0.34, 1.56, 0.64, 1)`. Last element gets extra 250ms dramatic delay. Plays `ui_pop_in` sound per element. Used in shop, rest, rewards, mystery events via `onSettle` callback. Respects reduce-motion and turbo mode.

---

## 11. Audio Systems

**Sources:** `src/services/ambientAudioService.ts`, `src/services/musicService.ts`, `src/services/cardAudioManager.ts`, `src/game/systems/AudioManager.ts`, `src/data/biomeAudio.ts`

- **ambientAudioService**: 16 named contexts (`hub`, `dungeon_map`, `shop`, `rest`, `mystery`, `combat_dust/embers/ice/arcane/void`, `boss_arena`, `mastery_challenge`, `run_end_victory/defeat`, `retreat_delve`, `silent`). Layered recipes, 800ms crossfade, quiz ducking (50%), music coexistence (30%).
- **musicService**: HTMLAudioElement + Web Audio API, AnalyserNode for visualization, cross-category shuffle, 1500ms crossfade.
- **cardAudioManager**: 150+ `CardAudioCue` types covering quiz, correct/wrong, card events, enemy events, chain system, status effects, run lifecycle.
- **AudioManager (Phaser)**: biome-specific ambient crossfading, hazard SFX, transition stings, 25 biome profiles.
- **biomeAudio**: 25 biome configurations with ambient loops, hazard SFX arrays, transition stings, volume profiles.

---

## 12. Juice Manager

**Source:** `src/services/juiceManager.ts`

Choreographed combat feedback via callbacks: `onScreenFlash`, `onDamageNumber`, `onEnemyHit`, `onParticleBurst`, `onSpeedBonusPop`, `onKillConfirmation`.

- `fireCorrect`: T+0ms haptic + screen flash (0.3/0.45), T+50ms damage number, T+150ms enemy hit + particles (30/40 count)
- Multi-hit stagger: 90ms between hits, increasing intensity, last hit heavier
- Kill confirmation: triple haptic burst (0/60/120ms), heavy screen shake, camera zoom punch (1.05×), gold edge glow
- Perfect turn: gold flash + 50 particles at T+500ms
- Sound events wired to `cardAudioManager`

---

## 13. Edge Glow / Screen Flash / Vignette

**Source:** `src/game/scenes/CombatScene.ts`

- Vignette: permanent side/top darkening (landscape 15%/12%, portrait 24%/16%)
- Near-death vignette: red edge glow, 32-step gradient, alpha scales with HP proximity (max 0.35), pulsing
- Edge glow pulses: top/left/right, tinted (white=kill, gold=gold, red=damage, blue=block), 250-330ms fade
- Flash overlay: full-viewport rect, parameterized tint/intensity/duration
- Screen flashes: correct (white 0.3), damage (red 0.15), kill (white 0.55), speed bonus (light blue 0.5), cast (0.12), block (0.1), perfect turn (gold 0.2)

---

## 14. Narrative Overlay

**Source:** `src/ui/components/NarrativeOverlay.svelte`, `src/services/narrativeEngine.ts`

4 concurrent threads: Descent, Echo, Seeker, Inhabitants, Ambient.

State machine: `REVEALING` → `DISSOLVING` → `DONE`.

- Line reveal: 800ms fade-in with text shadow glow, scale 0.95→1, translateY 12→0
- Ash dissolve exit: 800ms per line, blur 0→6px, translateY 0→-30px, letter-spacing 0.5→8px, 150ms inter-line stagger
- Fog layer: 3 radial gradient blurs, 15-23s drift cycles, 0.18 opacity
- ~580+ authored fragments, gravity-scored echo system
- Full-screen overlay z-index 950, dark bg `rgba(0,0,0,0.95)`

---

## 15. Device Tier + Reduce Motion

**Sources:** `src/services/deviceTierService.ts`, `src/services/cardPreferences.ts`, `src/services/accessibilityManager.ts`

3 device tiers: low-end, mid, flagship. GPU+CPU detection with localStorage override.

Quality presets:

| Setting | Low | Mid | Flagship |
|---|---|---|---|
| particleBudget | 40 | 80 | 150 |
| ambientParticleBudget | 10 | 20 | 50 |
| fogResolution | 0.5 | 1.0 | 1.0 |

Reduce motion: localStorage `card:reduceMotionMode`, synced to `body.reduced-motion` CSS class. `CombatAtmosphereSystem` fully disabled when reduce-motion on. All weapon and enemy animations check `isReduceMotionEnabled()`.
