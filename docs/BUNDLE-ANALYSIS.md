# Bundle Analysis

Snapshot generated from `npm run build` on this branch.

## Build output highlights

Largest JS chunks reported by Vite:

| Chunk | Size (minified) | Gzip |
| --- | ---:| ---:|
| `dist/assets/phaser-CBdwEDE8.js` | 1208.08 kB | 332.18 kB |
| `dist/assets/index-Cv-3Jlru.js` | 888.68 kB | 269.84 kB |
| `dist/assets/social-DzWhuHx0.js` | 181.51 kB | 59.53 kB |
| `dist/assets/dev-CCYr7ZT2.js` | 84.28 kB | 22.08 kB |
| `dist/assets/sql-wasm-hcrc38Rc.js` | 39.68 kB | 14.42 kB |

Largest CSS asset:

| Asset | Size | Gzip |
| --- | ---:| ---:|
| `dist/assets/index-DIT0Y301.css` | 315.55 kB | 52.90 kB |

## Build-time warnings observed

- Vite warned about chunks larger than configured `chunkSizeWarningLimit` (500 kB).
- Dynamic import note: `@capacitor/core` appears in both dynamic and static paths.
- Dynamic import note: `achievementService` is both static and dynamic.

## Current chunking strategy (from `vite.config.ts`)

- Manual chunks:
  - `phaser`
  - `sql-wasm`
  - `social`
  - `seasons`
  - `dev`
- Fact sprite filenames are intentionally unhashed for stable ID-based addressing.

## Practical observations

- Main app chunk is still large (`index-*.js` ~889 kB minified), even with split chunks.
- Phaser remains isolated, which is good for caching but still a large initial fetch when game code is needed.
- SQL runtime is split and loaded lazily by `factsDB` to reduce boot-time pressure.

## Follow-up options

1. Split additional heavy UI feature groups (archive/materializer/social overlays) behind dynamic imports.
2. Reduce base CSS payload by splitting room-specific styles.
3. Run `npm run analyze` with visualizer enabled to target the largest import chains.
4. Track size drift with `npm run build:check` and tighten budget thresholds after refactors.
