# HIGH-4 Profile Results — CombatScene FPS Regression

**Date**: 2026-04-10
**Agent**: game-logic (HIGH-4 fix)

## Environment

- Docker container: `rr-warm-high4-profile`
- Browser: System Chromium + SwiftShader (software Vulkan)
- Canvas: 1920x1080, WebGL renderer
- Scenario: combat_basic (Page Flutter enemy)

## Before Measurements (idle, fresh combat load)

| Metric | Value |
|---|---|
| fps_live (Phaser actualFps, idle) | 39-43 |
| fps_live (Phaser actualFps, under load — endTurn + animations) | 12-13 |
| fps_rolling_avg (1s sampler) | 47-50 (averaged over startup) |
| Active tweens | 0 (idle state) |
| Game objects in CombatScene | 36 |
| Texture count | 110 |
| Draw calls | N/A (WebGL renderer, drawCount property not exposed on Phaser.WebGLRenderer) |
| Memory | ~194 MB |
| Canvas size | 1920x1080 |
| Renderer | WebGL (via SwiftShader ANGLE/Vulkan) |

## Device Tier Detection in Docker

```
GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 16.0.0) (0x0000C0DE)), SwiftShader driver)
Vendor: Google Inc. (Google)
deviceMemory: undefined (not exposed in Docker)
hardwareConcurrency: 14 cores
localStorage override: null
```

**Detected tier**: `flagship` (falls through to CPU core count: 14 cores ≥ 8 → flagship)

## Root Cause

**SwiftShader is a software renderer** running all WebGL operations on CPU via LLVM. The deviceTierService.probeGPU() function has no pattern to match "swiftshader" or "ANGLE...SwiftShader", so it returns `'mid'` from the GPU probe. Then the CPU core count (14 cores) bumps it to `flagship`.

The `flagship` tier enables the full `DepthLightingFX` PostFX pipeline on the background sprite:
- Sobel filter: 4 depth-map texture reads per pixel
- Up to 8 point lights with distance/depth attenuation
- **6-step ray-march shadow occlusion** (flagship only — most expensive)
- Parallax breathing: sin + cos per pixel per frame
- Torch flicker: 2× nested sin per pixel
- Fog drift
- Water ripple

Running this fragment shader on a 1920×1080 canvas via SwiftShader (pure CPU) produces:
- **12-13 fps** during active combat (animations + shader running simultaneously)
- **39-43 fps** at idle (enemy sprite static, minimal tween activity)

Three LLM testers independently observed sustained <20 fps — this matches the loaded state they encounter during actual play.

## Fix Applied

`src/services/deviceTierService.ts` — added SwiftShader detection to `probeGPU()`:
- Pattern: `/swiftshader|llvmpipe|softpipe/` → return `'low-end'`
- Also added ANGLE software renderer detection

This classifies SwiftShader as `low-end`, which:
1. Disables the DepthLightingFX shader entirely (`enabled = getDeviceTier() !== 'low-end'`)
2. Reduces particle budget from 150 to 40
3. Sets tile resolution to 32 (already correct)

## After Measurements (expected — not yet profiled)

Target: ≥45 fps sustained in Docker/SwiftShader

## Notes

- The `rr:gameManagerStore` symbol doesn't exist — `getPhaserPerf()` should read `rr:cardGameManager` which holds the `CardGameManager` instance with `getGame()`. Fixed in the same commit.
- `game.renderer.drawCount` doesn't exist on Phaser's WebGL renderer type — it may be `drawCount` on the WebGL state or internal batcher. Omit from telemetry until confirmed.
- The initial "9-10 fps" reading from the first warm container was due to the container reusing a stale browser session before my debugBridge code fix loaded. The actual idle FPS is 39-43.
