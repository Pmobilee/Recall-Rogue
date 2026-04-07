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

## When to Optimize

- Only optimize when a metric is measured and failing
- Profile FIRST with Chrome DevTools / Phaser debug overlay — never guess
- Document the before/after numbers in the commit message
- The headless sim is NOT a performance test — it tests balance, not FPS

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
