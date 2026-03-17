# AR-83: Asset Specs & Placeholder Assets

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §19
> **Priority:** FOUNDATION
> **Complexity:** Small
> **Dependencies:** None

## Context

The desktop port needs new landscape-oriented assets. This AR documents exact specs, creates placeholder assets for development, and establishes naming conventions so workers can develop against placeholders while real art is commissioned.

## Directive

### Step 1: New Asset Specifications

| Asset | Dimensions | Format | Count | Priority | Directory |
|-------|-----------|--------|-------|----------|-----------|
| Landscape combat backgrounds | 1920×1080 | WebP | 15+ (3 per act × 5 variants) | Required | `public/assets/backgrounds/combat/landscape/` |
| Hub side panels | 565×1080 | WebP | 2 (left + right) | Required | `public/assets/camp/sprites/background/` |
| Landscape boot splash | 1920×1080 | WebP | 1 | Nice-to-have | `public/assets/boot/` |
| Chain type icons | 24×24 viewbox | SVG | 6 | Required | `src/assets/chain-icons/` |
| Steam store capsule | 460×215 | PNG | 1 | Required for Steam | `marketing/steam/` |
| Steam store header | 920×430 | PNG | 1 | Required for Steam | `marketing/steam/` |
| Steam library hero | 3840×1240 | PNG | 1 | Required for Steam | `marketing/steam/` |
| Steam library logo | 600×900 | PNG | 1 | Required for Steam | `marketing/steam/` |

### Step 2: Naming Convention

Landscape asset variants follow this pattern:
- Portrait: `{name}.webp` (existing)
- Landscape: `{name}_landscape.webp`

Example:
- `shallow-depths-1.webp` (portrait, 720×1280)
- `shallow-depths-1_landscape.webp` (landscape, 1920×1080)

Asset loader checks for `_landscape` variant first in landscape mode, falls back to portrait.

### Step 3: Create Placeholder Assets

Generate placeholder images for development:

**Landscape combat backgrounds (15):**
- Solid gradient matching biome color palette + "PLACEHOLDER: {biome} - Landscape" text
- One per act variant

**Hub side panels (2):**
- Dark gradient (#1a1a2e → #0f0f23) + subtle noise texture
- "SIDE PANEL" text (visible in dev only)

**Chain type icons (6):**
- Simple geometric shapes as specified in AR-82

### Step 4: Asset Loader Fallback

**File:** `src/game/scenes/CombatScene.ts` (or asset loading utility)

Add landscape fallback logic:
```typescript
function getBackgroundKey(bgKey: string, mode: LayoutMode): string {
  if (mode === 'landscape') {
    const landscapeKey = `${bgKey}_landscape`;
    if (this.textures.exists(landscapeKey)) return landscapeKey;
  }
  return bgKey; // fallback to portrait
}
```

### Step 5: Directory Structure

```
public/assets/
├── backgrounds/
│   └── combat/
│       ├── segment1/       (existing portrait)
│       ├── segment2/       (existing portrait)
│       └── landscape/      NEW
│           ├── segment1/
│           ├── segment2/
│           └── boss/
├── camp/sprites/background/
│   ├── camp-background.jpg     (existing)
│   ├── side-panel-left.webp    NEW
│   └── side-panel-right.webp   NEW
├── boot/
│   └── splash_landscape.webp   NEW (future)
marketing/
└── steam/                      NEW
    ├── capsule_460x215.png
    ├── header_920x430.png
    ├── hero_3840x1240.png
    └── logo_600x900.png
```

### Step 6: Verification

- [ ] All placeholder assets created and loadable
- [ ] Asset loader falls back to portrait when landscape variant missing
- [ ] Naming convention documented in this file
- [ ] Directory structure created

## Files Affected

| File | Action |
|------|--------|
| `public/assets/backgrounds/combat/landscape/` | NEW directory + placeholders |
| `public/assets/camp/sprites/background/side-panel-*.webp` | NEW placeholders |
| `marketing/steam/` | NEW directory |
| Asset loading code | MODIFY (fallback logic) |

## GDD Updates

None — asset specs, not gameplay.
