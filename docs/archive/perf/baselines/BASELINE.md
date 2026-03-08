# Phase 28 Performance Baselines

Captured 2026-03-05 before Phase 28 optimizations.

## Pre-Optimization Metrics

| Metric | Pre-28 Baseline | Phase-28 Target | Status |
|--------|----------------|-----------------|--------|
| FPS (mid-range, layer 1) | ~45 fps | 60 fps | TBD |
| FPS (low-end, layer 1) | ~20 fps | 30 fps floor | TBD |
| Draw calls / frame (mine) | ~80-120 | ≤ 50 | TBD |
| JS bundle gzipped (entry) | ~650 KB | < 200 KB | TBD |
| GPU texture memory (20 layers) | unknown | ≤ 80 MB | TBD |
| JS heap (active mine session) | unknown | < 150 MB | TBD |
| Save size (20-layer dive) | ~80 KB | < 200 KB | TBD |

## Sub-Phase Changes Applied

| Sub-Phase | Change | Expected Impact |
|-----------|--------|----------------|
| 28.1 | Device tier detection + quality presets | Baseline for all budgets |
| 28.2 | Bundle audit: sql.js lazy import, manualChunks | -300 KB initial bundle |
| 28.3 | DirtyRectTracker: O(changed_tiles) instead of O(viewport) | Draw calls ≤ 50 |
| 28.4 | Fog RenderTexture: single texture, dirty-rect updates | Fog overhead eliminated |
| 28.5 | TextureAtlasLRU: 3-atlas cap, evict on biome change | GPU mem ≤ 80 MB |
| 28.6 | Asset lazy loading: next-biome pre-warm, dynamic social imports | No stall on descent |
| 28.7 | DevPanel perf overlay: live FPS/draw/GPU/heap metrics | Monitoring infrastructure |

## Post-Optimization Metrics (to be filled after testing)

| Metric | Post-28 Result | Target Met? |
|--------|---------------|------------|
| FPS (mid-range, layer 1) | TBD | TBD |
| FPS (low-end, layer 1) | TBD | TBD |
| Draw calls / frame (mine) | TBD | TBD |
| JS bundle gzipped (entry) | TBD | TBD |
| GPU texture memory (20 layers) | TBD | TBD |
