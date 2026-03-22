# Environmental Presence Phase — Master Overview

**Phase Goal:** Transform combat scenes from "sprite pasted on background" to "creature inhabiting a space" using 7 layered visual techniques inspired by Dead Cells, Sea of Stars, and Celeste.

**Research Source:** `docs/RESEARCH/sprite-environmental-presence-phaser3.md`

**Total GPU Budget:** ~2.7ms worst-case (of 16.6ms available at 60fps)

## AR Dependency Graph

```
AR-215 (Config Foundation)
  |
  +---> AR-216 (Color Grading + Shadows)     [~0.6ms]
  +---> AR-217 (Particles + Depth Layers)    [~0.5ms]
  |     AR-218 (Normal Map Pipeline)          [0ms runtime — asset pipeline]
  |       |
  |       +---> AR-219 (Dynamic Lighting)    [~1.0ms]
  |       +---> AR-220 (Rim Lighting)*       [~0.1ms]
  +---> AR-220 (Rim Lighting, alpha path)    [~0.3ms without normal maps]
  +---> AR-221 (Parallax + Haze + Micro)     [~0.5ms]
```

*AR-220 has two paths: alpha-based (no dependencies beyond AR-215) and Fresnel-based (requires AR-218).

## Recommended Implementation Order

### Tier 1 — Immediate Impact, Low Risk (do first)

| Order | AR | Technique | GPU Cost | Risk |
|-------|-----|-----------|----------|------|
| 1 | AR-215 | Config Foundation | 0ms | None — pure data |
| 2 | AR-216 | Color Grading + Ground Shadows + AO | ~0.6ms | Low — uses built-in FX only |
| 3 | AR-217 | Enhanced Atmospheric Particles | ~0.5ms | Low — extends existing system |

**After Tier 1:** Combat scenes have room-specific color temperature, proper ground shadows, AO, and layered atmospheric particles. This alone is a significant visual upgrade with zero shader work.

### Tier 2 — Transformative, Medium Risk (do second)

| Order | AR | Technique | GPU Cost | Risk |
|-------|-----|-----------|----------|------|
| 4 | AR-218 | Normal Map Pipeline | 0ms runtime | Medium — asset pipeline work |
| 5 | AR-219 | Dynamic Lighting (Light2D) | ~1.0ms | Medium — first custom shader, Light2D pipeline |
| 6 | AR-221 | Parallax + Haze + Micro-animation | ~0.5ms | Low-Medium — camera math, displacement shader |

**After Tier 2:** Full Dead Cells-style per-pixel lighting, camera depth, environmental shimmer. The biggest single-technique impact (Light2D) ships here.

### Tier 3 — Polish (do last)

| Order | AR | Technique | GPU Cost | Risk |
|-------|-----|-----------|----------|------|
| 7 | AR-220 | Rim Lighting | ~0.1ms | Medium — PostFX shader |

**After Tier 3:** Dramatic edge separation on enemy sprites. The cherry on top.

## Cumulative Performance Budget

| After AR | Total GPU Added | Remaining (of 16.6ms) |
|----------|----------------|----------------------|
| AR-215 | 0ms | 16.6ms |
| AR-216 | ~0.6ms | 16.0ms |
| AR-217 | ~1.1ms | 15.5ms |
| AR-218 | ~1.1ms (no change) | 15.5ms |
| AR-219 | ~2.1ms | 14.5ms |
| AR-221 | ~2.6ms | 14.0ms |
| AR-220 | ~2.7ms | 13.9ms |

**13.9ms remaining** for game logic, UI rendering, and sprite animation. Comfortable headroom.

## Device Tier Behavior

| AR | High-End | Mid-Tier | Low-End |
|----|----------|----------|---------|
| AR-215 | Full config | Full config | Full config |
| AR-216 | All effects | Tint + shadow (skip ColorMatrix + AO) | Tint + shadow only |
| AR-217 | Full particles + shafts | 70% particles, shafts | 40% particles, no shafts |
| AR-218 | Normal maps loaded | Normal maps loaded | Normal maps loaded |
| AR-219 | Full lighting (5 lights) | 3 lights | Skipped entirely |
| AR-220 | Fresnel rim | Fresnel rim | Skipped entirely |
| AR-221 | Sway + mouse parallax + haze + micro | Sway + micro (skip haze, mouse) | Skipped entirely |

**Low-end floor:** Sprite tinting + ground shadow + 40% particles. Still noticeably better than current.
**Mid-tier:** All techniques at reduced quality. The full "Dead Cells" effect minus some lights.
**High-end:** Everything, full quality.

## Files Touched Across All ARs

| File | ARs | Changes |
|------|-----|---------|
| `src/data/roomAtmosphere.ts` | 215, 217 | Created (215), possibly adjusted (217) |
| `src/game/systems/CombatAtmosphereSystem.ts` | 215, 216, 217 | Refactored to consume config (215), minor (216), major upgrade (217) |
| `src/game/scenes/CombatScene.ts` | 215, 216, 217, 219, 221 | Config storage (215), tinting (216), atmosphere wiring (217), lighting (219), parallax/haze (221) |
| `src/game/systems/EnemySpriteSystem.ts` | 216, 219, 220, 221 | Shadow+tint+AO (216), Light2D (219), rim (220), micro-anim (221) |
| `src/game/CardGameManager.ts` | 219, 220, 221 | Pipeline registration (219, 220), roundPixels (221) |
| `src/game/shaders/QuantizedLight2D.ts` | 219 | Created |
| `src/game/shaders/RimLightFX.ts` | 220 | Created |
| `src/game/shaders/RimLightFresnelFX.ts` | 220 | Created |
| `src/game/shaders/HeatHazeFX.ts` | 221 | Created |
| `scripts/generate-normal-maps.py` | 218 | Created |
| `scripts/deploy-enemy-sprites.mjs` | 218 | Modified |
| `src/data/normalMapManifest.ts` | 218 | Created |

## Cross-AR Integration Notes

1. **setTint (AR-216) + Light2D (AR-219):** Light2D shader respects `outTint` varying — vertex tint composites with per-pixel lighting. Tint darkens, lighting adds directional variation. They stack correctly.

2. **AO gradient (AR-216) + Light2D (AR-219):** AO runs as `preFX` (before pipeline). Light2D runs as the main pipeline. AO darkens the texture data that Light2D then lights. This produces slightly different results than AO-after-lighting but is visually acceptable and avoids the complexity of post-lighting AO.

3. **Rim (AR-220) + Light2D (AR-219):** Rim runs as `postFX` (after pipeline). It sees the already-lit sprite and adds edge glow on top. This is the correct order — rim should glow regardless of shadow areas.

4. **Heat haze (AR-221) + everything:** Haze is a camera-level `postFX`. It displaces the FINAL composited frame. All other effects (tinting, lighting, rim, particles) are already rendered when haze applies. No conflicts.

5. **Camera sway (AR-221) + scroll factors (AR-221):** Sway drives `scrollX/Y` on the camera. Scroll factors on game objects automatically create parallax. Back particles at 0.5 move half as fast, front particles at 1.2 move 20% faster. The parallax is emergent from the combination.

6. **Atmosphere particles (AR-217) + Light2D (AR-219):** Particles are NOT on Light2D pipeline. They use the default pipeline with their own tint colors. This is intentional — atmospheric particles are ambient, not lit by point lights.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Light2D shader compilation fails on some GPUs | Medium | High | Fallback to no lighting (just tinting) on shader error |
| Normal map auto-generation quality too low | Medium | Medium | Hand-touch boss sprites; flat fallback for worst cases |
| PostFX stacking causes unexpected interactions | Low | Medium | Each AR tests in isolation AND with all prior ARs active |
| Heat haze causes pixel-art edge artifacts | Medium | Low | Strength capped at 0.008; easy to reduce or disable |
| Camera sway causes nausea on sensitive players | Low | Low | Respect `reduceMotion` preference — disable sway + haze |
| Performance regression on integrated GPUs | Low | Medium | Device tier gating; low-end skips everything except tint+shadow |

## Accessibility: Reduce Motion

All ARs must respect the `reduceMotion` user preference:

```typescript
if (getReduceMotion()) {
  // Skip: camera sway, heat haze, micro-animations, light flicker, particle front layer
  // Keep: static tinting, ground shadow, AO, static lighting (no flicker), back particles
}
```

This is already partially implemented in `CombatParticleSystem` — extend the pattern to all new systems.
