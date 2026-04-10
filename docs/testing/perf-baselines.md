# Performance Baselines

Source: `src/services/deviceTierService.ts`, `src/game/shaders/DepthLightingFX.ts`,
`tests/playtest/headless/perf-smoke.ts`, `tests/unit/deviceTierService.test.ts`

## Frame-Time Targets

| Tier | Renderer | Target FPS | Hard Floor | Frame Budget |
|------|----------|------------|------------|--------------|
| flagship | Real GPU (RTX/RX/Apple) | 60 fps | 45 fps | 22ms |
| mid | Real GPU (mid range) | 60 fps | 45 fps | 22ms |
| low-end | Real GPU (low end) | 45 fps | 30 fps | 33ms |
| N/A | SwiftShader/llvmpipe/softpipe | ~22 fps sustained | — | Not applicable |

The 45 fps hard floor applies to real hardware only. Docker/CI environments run
SwiftShader (CPU-emulated WebGL) which is capped at ~22 fps on a 1920x1080
canvas regardless of optimization. Software renderers must not be used for
frame-rate assertions.

## HIGH-4 Incident — 2026-04-10

**Symptom:** CombatScene measured at 12-14 fps in Docker CI during animation load;
39-43 fps idle. Confirmed by 3 independent LLM testers in BATCH-2026-04-10-003.

**Root cause:** SwiftShader (Docker/headless Chrome) was classified as `flagship` tier:
1. No `navigator.deviceMemory` API in Docker → skips memory detection
2. SwiftShader GPU string was unmatched by existing patterns in `probeGPU()`
3. Falls to CPU core count: 14 cores ≥ 8 → `flagship`
4. `flagship` enables `DepthLightingSystem` (Sobel filter + 8 point lights +
   ray-march shadow) → ~55ms/frame on SwiftShader → 12-14 fps

**Fix:** Added software renderer detection in `probeGPU()` before any other pattern:
```typescript
if (/swiftshader|llvmpipe|softpipe|microsoft basic render driver/.test(r)) return 'low-end'
```

This disables `DepthLightingSystem` (enabled only when tier !== 'low-end') and the
camera ColorMatrix PostFX on all CPU-emulated renderers.

**Measured after fix:**
- Docker SwiftShader sustained ceiling: ~22 fps (software renderer hardware limit)
- Docker SwiftShader during animations: ~22 fps (was 12-14 fps before fix)
- Real GPU (mid/flagship): unaffected, still 45-60 fps

**Profile data:** `data/playtests/llm-batches/BATCH-2026-04-10-003-fullsweep/HIGH-4-PROFILE.md`

## Device Tier Classification

Detection runs once at startup and is cached for the session. Priority order:

1. **localStorage override** (`device-tier-override` key) — developer testing only
2. **`navigator.deviceMemory`** — Chromium Android only; not available in Docker/Firefox/iOS
3. **WebGL renderer string** — most reliable cross-platform; software renderers detected first
4. **CPU core count** — coarse fallback when WebGL unavailable or unrecognized GPU

### Software Renderer Detection (HIGH-4, 2026-04-10)

Software renderers are classified as `low-end` **unconditionally**, regardless of
CPU core count. Pattern: `/swiftshader|llvmpipe|softpipe|microsoft basic render driver/`

Known software renderers:
- `swiftshader` — Google's CPU-emulated Vulkan (Docker CI, headless Chrome)
- `llvmpipe` — Mesa LLVMpipe (Linux CI environments)
- `softpipe` — Mesa softpipe (older Linux fallback)
- `microsoft basic render driver` — Windows software fallback

### Quality Presets

| Preset | particleBudget | ambientBudget | fogRes | maxAtlases | animInterval |
|--------|---------------|---------------|--------|------------|--------------|
| low-end | 40 | 10 | 0.5 | 2 | 6 frames |
| mid | 80 | 20 | 1.0 | 3 | 4 frames |
| flagship | 150 | 50 | 1.0 | 3 | 2 frames |

## Regression Tests

### Headless logic smoke test
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
        tests/playtest/headless/perf-smoke.ts
```
24 assertions covering:
- All software renderer strings → `low-end`
- HIGH-4 regression (14-core Docker + SwiftShader → not flagship)
- Real GPU pattern classification
- Regex latency < 100µs per call
- Quality preset ordering invariants

### Vitest unit tests
```bash
npx vitest run tests/unit/deviceTierService.test.ts
```
23 tests covering:
- All software renderer patterns (SwiftShader variants, llvmpipe, softpipe, MSBRD)
- HIGH-4 regression: 14-core CPU + SwiftShader = low-end
- Real hardware GPU classification
- CPU core count fallback behavior
- Manual override (localStorage)
- Quality preset values

## PostFX Pipeline by Tier

| Tier | DepthLightingFX | Camera ColorMatrix | particleChaos |
|------|-----------------|--------------------|---------------|
| flagship | Enabled (full: shadow ray-march) | Enabled | Enabled |
| mid | Enabled (no ray-march) | Enabled | Disabled |
| low-end | Disabled | Disabled | Disabled |

`DepthLightingFX` is the most expensive per-frame cost: Sobel edge filter (4 depth
samples/pixel), up to 8 point lights with distance attenuation, optional 6-step
ray-march shadow (flagship only), parallax breathing (sin+cos/pixel), torch flicker,
fog drift, water ripple. On SwiftShader (1920x1080): ~55ms per frame when enabled.

## Monitoring

`__rrDebug().phaserPerf` in DevTools console (dev mode only):
```typescript
{
  fps: number          // Phaser game.loop.actualFps
  renderer: string     // 'WebGL' | 'Canvas' | 'unknown'
  drawCalls: number    // renderer.gl draw calls (WebGL only)
  activeTweens: number // Total tweens across all active scenes
  gameObjectCount: number  // Game objects in CombatScene
  textureCount: number     // Loaded textures in texture manager
  canvasSize: string   // e.g. "1920x1080"
  memoryMB: number     // JS heap used (performance.memory, Chromium only)
}
```
