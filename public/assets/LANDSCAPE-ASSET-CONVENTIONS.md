# Landscape Asset Naming Conventions

## Portrait vs Landscape Variants

All assets that need both portrait and landscape variants follow this naming convention:

- **Portrait** (existing): `{name}.webp` — 720×1280 px (or source dimensions)
- **Landscape** (new): `{name}_landscape.webp` — 1920×1080 px

### Examples

| Portrait | Landscape |
|----------|-----------|
| `shallow-depths-01.webp` | `shallow-depths-01_landscape.webp` |
| `boss-arena-03.webp` | `boss-arena-03_landscape.webp` |
| `side-panel-left.webp` | *(panels are landscape-only — no portrait variant)* |

## Asset Loader Fallback Behavior

When the game runs in landscape mode, the asset loader checks for the `_landscape` variant first.
If the landscape variant does not exist, it falls back to the portrait version (which Phaser will
stretch to fill — acceptable during development, should be replaced before ship).

```
landscape mode requested:
  1. try: {name}_landscape.webp  → use if exists
  2. fallback: {name}.webp       → stretch-to-fit (dev placeholder behavior)
```

This is implemented via `getBackgroundKey()` in `CombatScene.ts`.

## Directory Structure

```
public/assets/backgrounds/combat/
  segment1/                     ← portrait backgrounds (existing)
    shallow-depths-01.webp
    ...
  segment2/                     ← portrait backgrounds (existing)
  segment3/
  segment4/
  segment5/
  boss/
  landscape/                    ← landscape backgrounds (NEW)
    segment1/
      SPEC.txt                  ← art commission spec
      shallow-depths-01_landscape.webp   ← (to be created)
      ...
    segment2/
    segment3/
    segment4/
    segment5/
    boss/

public/assets/camp/sprites/background/
  camp-background.jpg           ← existing hub background
  SIDE-PANEL-SPEC.txt           ← art commission spec
  side-panel-left.webp          ← (to be created)
  side-panel-right.webp         ← (to be created)

src/assets/chain-icons/         ← SVG chain type icons (see AR-82)
  (6 SVG files, 24×24 viewbox)

marketing/steam/                ← Steam store assets
  SPEC.md                       ← full spec file
  capsule_460x215.png           ← (to be created)
  header_920x430.png            ← (to be created)
  hero_3840x1240.png            ← (to be created)
  logo_600x900.png              ← (to be created)
```

## Landscape Background Loading — Implementation Note

The fallback logic lives in `CombatScene.ts`:

```typescript
/**
 * Returns the appropriate background texture key for the current layout mode.
 * In landscape mode, checks for a _landscape-suffixed variant first.
 * Falls back to the portrait key if no landscape variant is loaded.
 */
private getBackgroundKey(bgKey: string): string {
  if (this.currentLayoutMode === 'landscape') {
    const landscapeKey = `${bgKey}_landscape`;
    if (this.textures.exists(landscapeKey)) return landscapeKey;
  }
  return bgKey;
}
```

When loading a landscape background dynamically, use `bgPath_landscape.webp` alongside
`bgPath.webp` and register the landscape key with the `_landscape` suffix so `getBackgroundKey()`
can find it.

## Format Requirements

| Asset Type | Format | Dimensions | Notes |
|------------|--------|------------|-------|
| Combat backgrounds (portrait) | WebP | 720×1280 | Existing |
| Combat backgrounds (landscape) | WebP | 1920×1080 | New for desktop |
| Hub side panels | WebP | 565×1080 | Landscape-only |
| Boot splash (landscape) | WebP | 1920×1080 | Future |
| Chain type icons | SVG | 24×24 viewbox | Vector, no raster |
| Steam capsule | PNG | 460×215 | Steam requirement |
| Steam header | PNG | 920×430 | Steam requirement |
| Steam library hero | PNG | 3840×1240 | Steam requirement |
| Steam library logo | PNG | 600×900 | Steam requirement |
| Steam screenshots | PNG | 1920×1080 | Min 5 required |
