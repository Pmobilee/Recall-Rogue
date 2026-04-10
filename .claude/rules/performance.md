# Performance Rules

## Target Metrics

| Metric | Target | Hard Fail |
|---|---|---|
| Combat scene FPS | 60 sustained | <45 sustained |
| Quiz panel response | <100ms | >300ms |
| Save/load time | <500ms | >2s |
| Facts.db decode (cold) | <2s | >5s |
| Scene transition | <1s | >3s |
| Memory (1hr session) | <300MB resident | >500MB |
| Production bundle | <15MB (excluding audio) | >25MB |

**The 45 fps hard floor applies to real GPU hardware only.**
Docker/CI environments run SwiftShader (CPU-emulated WebGL) which is capped at
~22 fps on a 1920x1080 canvas regardless of optimization — this is the
software-renderer ceiling, not a bug. Never assert FPS targets in Docker CI.

## Software Renderer Detection — MANDATORY

SwiftShader (Docker/headless Chrome), llvmpipe (Linux CI), and softpipe
**must be classified as `low-end` device tier** to prevent the expensive
`DepthLightingFX` PostFX pipeline from running in CI.

The `probeGPU()` function in `deviceTierService.ts` checks for software
renderers before any CPU core count fallback:
```typescript
if (/swiftshader|llvmpipe|softpipe|microsoft basic render driver/.test(r)) return 'low-end'
```

**Do NOT remove or reorder this check.** Without it, Docker's 14-CPU-core
count triggers the flagship tier → enables DepthLightingFX → 12-14 fps
(was HIGH-4, 2026-04-10). See `docs/testing/perf-baselines.md`.

## When to Optimize

- Only optimize when a metric is measured and failing
- Profile FIRST with Chrome DevTools / Phaser debug overlay — never guess
- Document the before/after numbers in the commit message
- The headless sim is NOT a performance test — it tests balance, not FPS
- Use `__rrDebug().phaserPerf` in browser DevTools for live fps/drawCalls/tween count

## Memory Leak Prevention

- Phaser scenes: destroy all sprites, tweens, timers in `shutdown()`
- Svelte components: clean up `$effect` subscriptions
- Event listeners: always remove in cleanup/destroy
- After 100+ combat encounters: heap should not grow >5MB per 10 encounters

## What NOT to Optimize

- Don't optimize code that runs once (initialization, save migration)
- Don't optimize before measuring (premature optimization)
- Don't sacrifice readability for micro-optimization (<1ms gains)
- The headless balance sim speed (already 6000 runs/5s) is fine

## Bundle Size

- Audit with `npm run build` — check Vite output for chunk sizes
- Audio files are the largest assets — compress to .m4a, not .wav
- Lazy-load deck data — don't bundle all 77 decks into initial load
- Tree-shake unused imports — Vite handles this if imports are clean

## PostFX Pipeline by Device Tier

| Tier | DepthLightingFX | Camera ColorMatrix | particleChaos |
|------|-----------------|--------------------|---------------|
| flagship | Enabled (full: shadow ray-march) | Enabled | Enabled |
| mid | Enabled (no ray-march) | Enabled | Disabled |
| low-end | Disabled | Disabled | Disabled |

SwiftShader/software renderers → always `low-end` → DepthLightingFX disabled.

See `docs/testing/perf-baselines.md` for full baseline numbers and incident post-mortem.
