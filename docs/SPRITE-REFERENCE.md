# Sprite Reference

This document covers how sprite keys are generated, resolved at runtime, and loaded by Phaser.

## Asset sets and key generation

Source files:

- `scripts/gen-sprite-keys.mjs`
- `src/data/spriteKeys.ts` (auto-generated)

Pipeline:

1. Script scans `public/assets/sprites-hires` and `public/assets/sprites` for `.png` files.
2. Each filename becomes a key (basename without `.png`).
3. Script writes two maps into `src/data/spriteKeys.ts`:
   - `HIGH_RES_KEYS`
   - `LOW_RES_KEYS`

Do not hand-edit `src/data/spriteKeys.ts`; regenerate with:

```bash
node scripts/gen-sprite-keys.mjs
```

## Runtime URL resolution

Source file: `src/game/spriteManifest.ts`

Core functions:

| Function | Purpose |
| --- | --- |
| `getSpriteUrls(resolution)` | Full key -> URL map for selected resolution |
| `getSpriteUrlsForBiome(resolution, biomeId, secondaryBiomeId?)` | Shared sprites + biome-filtered tiles |
| `getBiomeAtlasUrl(biomeId)` | Atlas JSON/WebP URL pair |
| `getBiomeAtlasKey(biomeId)` | Phaser texture key (`mine_atlas_<biomeId>`) |
| `supportsWebP()` | Browser WebP feature check |

Resolution source:

- `SpriteResolution` is controlled by `src/ui/stores/settings.ts` (`low` or `high`).

Base URL:

- URLs are prefixed with `import.meta.env.VITE_ASSET_BASE_URL` when present.

## Biome atlas loading and eviction

Source files:

- `src/game/systems/TextureAtlasLRU.ts`
- `src/game/spriteManifest.ts`

Behavior:

- Atlases are loaded by key via Phaser loader (`scene.load.atlas`).
- LRU enforces a max atlas count (`maxAtlases`, default `3`).
- On eviction, `scene.textures.remove(key)` is called to free GPU texture memory promptly.
- `evictAll()` is used on scene teardown.

## Fact sprite manifest and on-demand loading

Source files:

- `src/services/factSpriteManifest.ts`
- `src/game/systems/FactSpriteLoader.ts`
- `src/assets/fact-sprite-manifest.json`
- `scripts/audit-fact-sprites.mjs`

Manifest flow:

1. Runtime fetches `/assets/fact-sprite-manifest.json` once per session.
2. IDs are cached as `Set<string>` in memory.
3. If fetch fails, loader falls back to empty set and UI can show placeholders.

FactSpriteLoader flow:

1. `preload(factId)` checks manifest availability.
2. Skips if already loaded or currently loading.
3. Loads `/assets/sprites/facts/<factId>.png` into Phaser key `fact_sprite_<factId>`.
4. `getKey(factId)` returns the texture key only when present in cache.

## Rendering touchpoints

Primary render code: `src/game/scenes/MineTileRenderer.ts`

- Uses sprite keys for block visuals, overlays, and crack stages.
- Falls back to graphics primitives when texture key is missing.
- Overlay key families include `overlay_*` (for artifacts, hazards, interactables).

Boot behavior:

- `src/game/scenes/BootScene.ts` no longer preloads full sprite sets.
- Asset loading is deferred to active gameplay paths for faster startup.

## Practical checks

- Validate key generation after sprite updates: `node scripts/gen-sprite-keys.mjs`
- Validate app build and chunking: `npm run build`
- If fact art changed, regenerate coverage/manifest via `scripts/audit-fact-sprites.mjs`
