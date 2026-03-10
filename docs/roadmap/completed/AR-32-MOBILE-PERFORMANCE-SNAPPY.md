# AR-32: Mobile Performance & Snappiness Deep Pass

## Summary
AR-32 delivers a full mobile-first performance hardening pass focused on reducing startup cost, runtime CPU/GPU churn, and rendering stutter while preserving gameplay behavior.

This phase includes:
- A deep code audit across core runtime paths (boot, combat, fact lookup, library aggregation, cardback manifest loading).
- Immediate implementation of highest-impact optimizations.
- Verification via release gate (typecheck + critical unit + critical Playwright).

## Design Reference
From `docs/GAME_DESIGN.md`:

> "Phaser performance: 60fps target. ~15 game objects in combat. 50 particle cap (correct answer burst = 30 particles, 300ms lifespan). Phaser tweens only (GPU-accelerated, no CSS). Sprite pool for card fan (5 pre-created, reposition don't create/destroy)."

> "Desktop layout: On screens wider than 430px, the game renders in a centered phone-sized column (430px max-width) ... On mobile (< 430px), the game fills the full viewport width ..."

> "Wrong answer (total ~400ms): Fizzle animation — card shakes and fades out."

> "Correct answer — with cardback art (total ~1200ms) ..."

AR-32 aligns implementation with these constraints by reducing avoidable JS/module overhead, reducing object churn during effects, and speeding repeated data lookups used in gameplay/UI paths.

## Deep Audit Findings (Hyper Pass)

### P0 / High Impact
1. `src/ui/utils/cardbackManifest.ts`
- Issue: `import.meta.glob('/public/assets/cardbacks/lowres/*.webp')` generated massive JS module fanout (hundreds/thousands of tiny chunks).
- Impact: severe bundle-size overhead and startup/module graph cost, especially on mobile CPUs.
- Fix: removed glob-based static ID generation; switched to runtime manifest fetch only.
- Result: `build:check` initial JS gzip estimate dropped from **497 KB** to **198 KB**.

2. `src/services/factsDB.ts`
- Issue: repeated SQL.js full-table scans and point lookups (`getAll()`, `getById()`, `getByCategory()`) across game flow and library paths.
- Impact: repeated CPU work and GC pressure on lower-end devices.
- Fix: added in-memory indexes (`allFactsCache`, `factByIdCache`, `topCategoryIndex`, `ageRatingIndex`) and routed high-frequency methods to cached lookups.
- Result: hot-path fact lookups avoid repeated SQL row materialization.

3. `src/game/scenes/CombatScene.ts`
- Issue: per-event transient object allocation for damage/heal effects (new rectangles + destroy per trigger).
- Impact: animation GC spikes, frame pacing jitter on mobile.
- Fix: reused shared flash overlay via `pulseFlash()` and converted heal effect to particle burst path with low-end scaling.
- Result: lower object churn in combat effects.

### P1 / Medium Impact
4. `src/services/libraryService.ts`
- Issue: domain summary and entry builders used multiple pass/filter patterns over large fact arrays.
- Impact: unnecessary repeated O(n) passes when opening/sorting library with large datasets.
- Fix: rewrote aggregation to single-pass counters; reduced intermediate arrays.

5. `src/services/domainResolver.ts`
- Issue: repeated domain resolution scans through category arrays for the same fact IDs.
- Impact: redundant string/category work in list-building flows.
- Fix: added per-fact domain cache map keyed by fact ID.

6. `src/game/scenes/BootScene.ts`
- Issue: preloading unused first-person-irrelevant player sprites and PNG-first combat assets.
- Impact: slower combat bootstrap and larger decode/upload overhead.
- Fix: removed unused player sprite preloads; switched combat/enemy preloads to WebP and low-end `_1x.webp` variants.

7. `src/ui/utils/domainAssets.ts`, `src/ui/components/CardHand.svelte`, `src/ui/components/CardExpanded.svelte`, `src/ui/components/CardRewardScreen.svelte`, `src/ui/utils/campArtManifest.ts`
- Issue: PNG-first paths where WebP equivalents exist.
- Impact: larger transfer/decode for UI sprites.
- Fix: switched to WebP asset paths for domain icons, card frames, doors, echo frame refs, and camp sprites.

8. `src/ui/components/CardHand.svelte`
- Issue: repeated cardback preloading created duplicate `Image()` objects for same URLs.
- Impact: avoidable decode/preload work and memory churn.
- Fix: added session-level preload dedupe set.

### P2 / Hardening / Test Reliability
9. Playwright critical suite hardening
- Updated hub assumptions to current camp-hub UI landmarks.
- Increased startup wait thresholds in critical tests to absorb dev-server cold-start variability.
- Stabilized retreat unlock assertion by validating persisted ascension state after deterministic in-page retreat click.

## Implementation

### Data Model
- `FactsDB` now maintains immutable-in-session cache/index state:
  - `allFactsCache`
  - `factByIdCache`
  - `topCategoryIndex`
  - `ageRatingIndex`
- No schema or persistent storage migration required.

### Logic
- Replaced repeated SQL query loops with index lookups for:
  - `getAll`
  - `getById`
  - `getByIds`
  - `getByCategory`
  - `getByAgeRating`
  - `getRandomFiltered`
- Reduced runtime aggregation passes in library services.
- Added domain resolution memoization.
- Added low-end-aware combat effect scaling and shared flash tween path.
- Reduced preload payload in BootScene by removing unused assets and preferring WebP/1x assets.

### UI/Rendering
- Replaced several PNG sprite references with WebP variants.
- Prevented repeated cardback preloading for same URLs.
- Camp/hub sprite URL resolver now emits WebP paths.

### System Interactions
- Content ingestion, fact generation, and cardback generation pipelines remain untouched in behavior.
- Runtime behavior preserved; optimizations are implementation-level and compatibility-safe.
- Release-gate tests updated to match current camp-hub structure and stabilize CI/dev execution.

## Measured Outcome
- `npm run build:check`
  - Before AR-32: initial JS gzip estimate failed at **497 KB** (limit 400 KB).
  - After AR-32: initial JS gzip estimate **198 KB** (passes).
- `npm run verify:release-gate`: pass
  - typecheck: pass
  - unit critical: pass
  - Playwright critical: pass

## Edge Cases
- If cardback manifest fetch fails, cardback availability now defaults to empty set instead of glob fallback; gameplay remains functional without cardback art.
- `FactsDB` index cache assumes DB content is stable per session (current architecture behavior).
- Combat flash effect now reuses one overlay; overlapping flash requests are intentionally coalesced into latest pulse.
- Low-end enemy asset path uses `_1x.webp`; if a future enemy lacks that variant, preload mapping should be updated in lockstep.

## Files To Modify
- `src/ui/utils/cardbackManifest.ts`
- `src/services/factsDB.ts`
- `src/services/libraryService.ts`
- `src/services/domainResolver.ts`
- `src/game/scenes/CombatScene.ts`
- `src/game/scenes/BootScene.ts`
- `src/ui/utils/domainAssets.ts`
- `src/ui/components/CardHand.svelte`
- `src/ui/components/CardExpanded.svelte`
- `src/ui/components/CardRewardScreen.svelte`
- `src/ui/utils/campArtManifest.ts`
- `tests/e2e/playwright/app-loads.spec.ts`
- `tests/e2e/playwright/hub-navigation.spec.ts`
- `tests/e2e/playwright/card-play-flow.spec.ts`
- `tests/e2e/playwright/ascension-flow.spec.ts`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist
- [x] Deep code audit completed with prioritized findings.
- [x] Startup-bundle inflation source removed (`cardbackManifest` glob fanout).
- [x] FactsDB hot-path lookups moved to in-memory index lookups.
- [x] Library aggregation reduced to single-pass counting.
- [x] Domain resolution memoized per fact.
- [x] Combat effect allocation churn reduced (shared flash + particle path).
- [x] Boot preload payload reduced (unused assets removed, WebP + 1x variants used).
- [x] UI sprite references shifted to WebP where available.
- [x] Critical release gate passes end-to-end.

## Follow-On Optimization Backlog (Not Required For AR-32 Completion)
1. Virtualize long list rendering in `KnowledgeLibrary` domain fact rows.
2. Introduce memoized selector layer for repeated `playerSave`-derived aggregates.
3. Add frame-time telemetry (P50/P95) and low-end quality auto-downgrade trigger.
4. Add optional low-power mode toggle in Settings to reduce combat effect intensity further.
5. Move expensive content/report transforms to worker thread where practical.
6. Consider moving large static JSON loading to incremental chunking for very old devices.
7. Add perf budget CI checks for CSS + image payload classes (not only JS chunks).
8. Precompute frequently used domain/category maps at content-build step to remove runtime normalization cost.
