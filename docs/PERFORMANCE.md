# Performance

## Target Metrics

See `.claude/rules/performance.md` for hard limits. Summary:

| Metric | Target | Fail Threshold |
|--------|--------|----------------|
| Combat FPS | 60 sustained | <45 sustained |
| Quiz response | <100ms | >300ms |
| Save/load | <500ms | >2s |
| Facts.db decode | <2s cold start | >5s |
| Scene transition | <1s | >3s |
| Memory (1hr) | <300MB | >500MB |
| Bundle (no audio) | <15MB | >25MB |

## Target Hardware

Steam Hardware Survey baseline (2026):
- **CPU**: Intel i5-8400 or equivalent
- **GPU**: GTX 1050 or equivalent
- **RAM**: 8GB
- **Display**: 1920x1080

## Current Baselines

> **Note**: Baselines should be measured and updated before each release.

| Metric | Last Measured | Value | Date |
|--------|-------------|-------|------|
| Combat FPS | TBD | — | — |
| Bundle size | Check `npm run build` output | — | — |
| Test suite | 1900+ tests | ~15s | 2026-04-08 |
| Headless sim | 6000 runs | ~5s | 2026-04-04 |

## FPS Monitoring

### Architecture

FPS monitoring is wired in `src/dev/debugBridge.ts` and activated by `src/game/CardGameManager.ts` immediately after the Phaser game instance is created.

**Key components:**

| Symbol | File | Purpose |
|--------|------|---------|
| `startFpsMonitoring(game)` | `src/dev/debugBridge.ts` | Sets up 1s interval sampling `game.loop.actualFps`; call once after Phaser boot |
| `getFpsStats()` | `src/dev/debugBridge.ts` | Returns `{ current, min, avg }` from last 60 samples |
| `fpsWindow` | `src/dev/debugBridge.ts` | Module-level rolling array, 60 samples max (60s window) |
| `fps` field | `RRDebugSnapshot` | Included in every `__rrDebug()` call |

### Accessing FPS in Dev

In the browser console or via Playwright `browser_evaluate`:

```js
// Full debug snapshot including FPS
const snap = window.__rrDebug();
console.log(snap.fps); // { current: 60, min: 58, avg: 60 }

// Direct FPS stats (if you only need FPS)
// Note: getFpsStats is not directly exposed to window — use __rrDebug()
```

### Low-FPS Analytics Alert

The monitor fires a `low_fps_alert` analytics event when performance degrades:

- **Threshold**: FPS < 40 for 3+ consecutive samples (3+ seconds)
- **Cooldown**: Maximum one alert per 60 seconds per session
- **Event payload**:
  ```ts
  { fps: number, scene: string, sustained_seconds: number }
  ```
- **Analytics guard**: The alert uses a dynamic import of `analyticsService` to avoid circular deps. The analytics service itself gates on user consent and COPPA rules as normal.
- **In headless bot mode**: `game.loop.actualFps` returns 0 — this triggers the low-FPS path, which is harmless since analytics won't fire in test environments.

### Low-FPS Alert Anti-Spam

The streak counter (`lowFpsStreak`) resets to 0 whenever FPS recovers to ≥ 40. This means transient dips do not accumulate toward the 3-sample threshold. The 60-second cooldown (`lastLowFpsAlertTs`) prevents repeated alerts during prolonged slowdowns.

## Monitoring Tools

### Development
- **FPS via debug API**: `window.__rrDebug().fps` — `{ current, min, avg }` from last 60s
- **FPS log entries**: Check `window.__rrLog` for `type: 'fps'` entries (written on each low-FPS alert)
- **Chrome DevTools Performance**: Profile combat scenes for 30s
- **Bundle Analyzer**: `npm run build` — check Vite chunk output

### Production
- **Analytics**: `low_fps_alert` events tracked when sustained <40 FPS (with 60s cooldown)
- **Memory**: Snapshot every 60s in dev mode via `performance.memory`

## Optimization Guidelines

1. **Measure first**: Never optimize without profiling data
2. **Combat scene is critical path**: This is where FPS matters most
3. **Texture atlases**: Combine small sprites into atlases to reduce draw calls
4. **Lazy loading**: Deck data loaded on demand, not at boot
5. **Audio compression**: .m4a format, not .wav
6. **Tree shaking**: Vite handles this — keep imports clean

## Known Bottlenecks

- Particle effects during chain escalation (many particles + bloom shader)
- Large deck loading (77 decks × facts.db query)
- WebGL shader compilation on first scene load

## Memory Leak Prevention

- Phaser: destroy sprites/tweens/timers in `shutdown()`
- Svelte: clean up `$effect` subscriptions
- Events: always remove listeners in cleanup
- Test: 100 encounters, heap growth should be <5MB per 10 encounters
