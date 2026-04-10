---
name: phaser-perf
description: |
  Phaser 3 performance optimization and debugging. Canvas vs WebGL benchmarking, mobile-specific optimizations, Phaser Debugger Chrome extension, __rrDebug extensions, draw call monitoring, and texture atlas management. PROACTIVELY SUGGEST when FPS drops, rendering issues, or mobile performance problems arise.
user_invocable: true
---

# Phaser Performance & Debugging

## When to Use

- FPS drops below 45 on any real-hardware target device (see FPS warning below)
- Visual glitches, flickering, or rendering artifacts
- Memory warnings or crashes on mobile
- Adding many new sprites or animations
- **PROACTIVE TRIGGER**: Any discussion of performance, rendering issues, or mobile optimization

## FPS Warning — Check `__rrDebug().phaserPerf` First

When FPS is reported as low, **always check the renderer before investigating**:

```javascript
// In browser DevTools console (dev build only):
const perf = await __rrDebug().phaserPerf
console.log(perf)
// { fps, renderer, drawCalls, activeTweens, gameObjectCount, textureCount, canvasSize, memoryMB }
```

**If `fps < 45` and the renderer string contains `swiftshader`, `llvmpipe`, or `softpipe`:**
- This is a Docker/CI software renderer — ~22 fps is the hardware ceiling, NOT a bug
- Check `deviceTierService.getDeviceTier()` returns `'low-end'`
- If it returns `'mid'` or `'flagship'`, the software renderer detection is broken — file a HIGH-priority bug
- See HIGH-4 case study below

**If `fps < 45` on a real GPU:**
- Proceed with profiling below

## HIGH-4 Case Study — SwiftShader Misclassified as Flagship (2026-04-10)

**Symptom:** CombatScene reported 12-14 fps in Docker CI during animation load.

**Diagnosis steps taken:**
1. Extended `__rrDebug()` with `phaserPerf` (fps, drawCalls, activeTweens, etc.)
2. Booted Docker warm container, loaded combat-basic scenario
3. Sampled `phaserPerf` at idle and under animation load
4. Idle: 39-43 fps. During endTurn animation: 12-14 fps
5. Identified 36 game objects in CombatScene, 110 textures loaded
6. Checked `depthEnabled` via eval: was `true` (wrong — should be false on software renderer)

**Root cause:**
- SwiftShader GPU string unmatched by `probeGPU()` patterns
- Fell through to CPU core count fallback: 14 cores → `flagship`
- `flagship` → `DepthLightingSystem.enabled = true`
- DepthLightingFX runs Sobel filter + 8 point lights + 6-step ray-march shadow per fragment
- On SwiftShader 1920x1080: ~55ms/frame → 12-14 fps during animation load

**Fix:** Added to `probeGPU()` BEFORE other pattern checks:
```typescript
if (/swiftshader|llvmpipe|softpipe|microsoft basic render driver/.test(r)) return 'low-end'
```

**Lesson:** NEVER add new GPU pattern checks after the software renderer check.
The software renderer check MUST fire before CPU core count is consulted.

**Profile data:** `data/playtests/llm-batches/BATCH-2026-04-10-003-fullsweep/HIGH-4-PROFILE.md`

## Phaser Debugger Chrome Extension

**Install immediately**: [Phaser Debugger](https://chromewebstore.google.com/detail/phaser-debugger/aigiefhkiaiihlploginlonehdafjljd)

Features:
- Real-time FPS meter
- Scene Manager inspector (list all scenes, their status)
- Display List browser (all game objects with live property editing)
- Position, rotation, scale, alpha, visibility — all editable live
- Container hierarchy inspection
- Spine and Text object support

This is the #1 tool for compensating for Claude's inability to "see" Phaser canvas state.

## Canvas vs WebGL Decision

| Factor | WebGL | Canvas |
|--------|-------|--------|
| Many sprites (>100) | Better | Slower |
| Low-end mobile | 30% slower (!) | 30% faster |
| Shader effects | Supported | Not supported |
| Blend modes | Full support | Limited |
| Text rendering | Bitmap text preferred | Native text OK |
| Our game (card UI, <50 sprites) | Overkill | Ideal for mobile |

**Recommendation for Recall Rogue:** Use Canvas renderer on mobile, WebGL on desktop. Auto-detect:
```typescript
const renderer = Capacitor.isNativePlatform() ? Phaser.CANVAS : Phaser.AUTO;
```

## Performance Optimization Checklist

### Texture Management
- [ ] Use texture atlases (pack sprites into single sheets)
- [ ] Compress textures to WebP (50-70% size reduction)
- [ ] Load only current scene's assets in `preload()`
- [ ] Destroy unused textures with `this.textures.remove(key)`

### Draw Call Reduction
- [ ] Batch similar sprites (same texture atlas)
- [ ] Minimize blend mode switches
- [ ] Use `setVisible(false)` instead of `destroy()` for recycled objects
- [ ] Object pooling for frequently created/destroyed objects (particles, damage numbers)

### Canvas Size
- Smaller canvas = fewer pixels to redraw per frame
- Mobile: cap at 360px width, scale with CSS
- Desktop: match container, cap at 1280px
- Test: `game.canvas.width * game.canvas.height` — keep under 500K pixels on mobile

### Animation
- [ ] Use sprite sheets, not individual frame images
- [ ] Limit simultaneous tweens (<20 active at once)
- [ ] Use `Phaser.Math.Interpolation` for simple movements instead of full tweens
- [ ] Pause off-screen animations

### Immersion System Performance Notes
- ForegroundParallaxSystem: max 3 sprites, idle breathing via position update (no tweens in update loop)
- DungeonMoodSystem: per-frame lerp + modifier push — lightweight (no GPU cost, just tween params)
- Background micro-animation: 3 extra sin() calls per fragment in DepthLightingFX shader — negligible on any GPU running existing PostFX
- Chain escalation overlays: max 2 additional Rectangle objects (vignette pulse + tint overlay)

## Extending __rrDebug (current implementation)

The `phaserPerf` field is already wired in `src/dev/debugBridge.ts`:
```typescript
{
  fps: number,          // game.loop.actualFps
  renderer: string,     // 'Canvas' | 'WebGL' | 'unknown'
  drawCalls: number,    // renderer.gl?.drawCount (WebGL only)
  activeTweens: number, // total tweens across all active scenes (NOT game.tweens — tweens are per-scene in Phaser 3)
  gameObjectCount: number, // children.list.length in CombatScene
  textureCount: number, // textures.getTextureKeys().length
  canvasSize: string,   // e.g. "1920x1080"
  memoryMB: number,     // performance.memory?.usedJSHeapSize / 1024 / 1024 (Chromium only)
}
```

**IMPORTANT:** Tweens in Phaser 3 are per-scene, not on `game.tweens`. To get all active tweens:
```typescript
let activeTweens = 0
for (const scene of game.scene.getScenes(true)) {
  activeTweens += (scene as SceneWithTweens).tweens?.getTweens?.()?.length ?? 0
}
```
Do NOT use `game.tweens.getTweens()` — `game.tweens` does not exist. This was the stale pattern
in the old SKILL.md note (the bridge used `rr:gameManagerStore` symbol which also doesn't exist).

## Performance Budget

| Metric | Target | Action if exceeded |
|--------|--------|-------------------|
| FPS (real GPU) | >45 on all real devices | Profile, reduce draw calls |
| FPS (Docker SwiftShader) | ~22fps ceiling | Normal — do NOT optimize for this |
| Load time | <3s on 4G | Lazy-load non-critical assets |
| Memory | <300MB heap | Audit texture sizes, destroy unused |
| Active tweens | <20 simultaneous | Queue animations, use callbacks |
| Canvas pixels | <500K on mobile | Reduce resolution, CSS scale |

## References

- `docs/testing/perf-baselines.md` — frame-time targets, HIGH-4 post-mortem, tier breakdown
- [Phaser 3 Optimization Guide (2025)](https://franzeus.medium.com/how-i-optimized-my-phaser-3-action-game-in-2025-5a648753f62b)
- [Phaser 3.60 Mobile Performance Notes](https://github.com/phaserjs/phaser/blob/v3.60.0/changelog/3.60/MobilePerformance.md)
- [Phaser Debugger Extension](https://chromewebstore.google.com/detail/phaser-debugger/aigiefhkiaiihlploginlonehdafjljd)
- [WebGL vs Canvas Performance Discussion](https://phaser.discourse.group/t/webgl-vs-canvas-performance/805)
