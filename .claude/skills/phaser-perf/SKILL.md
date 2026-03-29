---
name: phaser-perf
description: |
  Phaser 3 performance optimization and debugging. Canvas vs WebGL benchmarking, mobile-specific optimizations, Phaser Debugger Chrome extension, __rrDebug extensions, draw call monitoring, and texture atlas management. PROACTIVELY SUGGEST when FPS drops, rendering issues, or mobile performance problems arise.
user_invocable: true
---

# Phaser Performance & Debugging

## When to Use

- FPS drops below 30 on any target device
- Visual glitches, flickering, or rendering artifacts
- Memory warnings or crashes on mobile
- Adding many new sprites or animations
- **PROACTIVE TRIGGER**: Any discussion of performance, rendering issues, or mobile optimization

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

## Extending __rrDebug

Add these to the existing `window.__rrDebug()` output:
```typescript
{
  fps: game.loop.actualFps,
  renderer: game.config.renderType === 1 ? 'Canvas' : 'WebGL',
  drawCalls: game.renderer.drawCount, // WebGL only
  textureCount: game.textures.getTextureKeys().length,
  activeTweens: game.tweens.getTweens().length,
  gameObjectCount: scene.children.list.length,
  canvasSize: `${game.canvas.width}x${game.canvas.height}`,
  memoryMB: performance.memory?.usedJSHeapSize / 1024 / 1024, // Chrome only
}
```

## Performance Budget

| Metric | Target | Action if exceeded |
|--------|--------|-------------------|
| FPS | >30 on all devices | Profile, reduce draw calls |
| Load time | <3s on 4G | Lazy-load non-critical assets |
| Memory | <150MB heap | Audit texture sizes, destroy unused |
| Active tweens | <20 simultaneous | Queue animations, use callbacks |
| Canvas pixels | <500K on mobile | Reduce resolution, CSS scale |

## References

- [Phaser 3 Optimization Guide (2025)](https://franzeus.medium.com/how-i-optimized-my-phaser-3-action-game-in-2025-5a648753f62b)
- [Phaser 3.60 Mobile Performance Notes](https://github.com/phaserjs/phaser/blob/v3.60.0/changelog/3.60/MobilePerformance.md)
- [Phaser Debugger Extension](https://chromewebstore.google.com/detail/phaser-debugger/aigiefhkiaiihlploginlonehdafjljd)
- [WebGL vs Canvas Performance Discussion](https://phaser.discourse.group/t/webgl-vs-canvas-performance/805)
