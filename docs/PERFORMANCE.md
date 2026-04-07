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

## Monitoring Tools

### Development
- **Phaser Debug Overlay**: `window.__rrDebug()` — FPS, draw calls, texture count
- **Chrome DevTools Performance**: Profile combat scenes for 30s
- **Bundle Analyzer**: `npm run build` — check Vite chunk output

### Production
- **Analytics**: Low FPS events tracked when sustained <40 FPS
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
