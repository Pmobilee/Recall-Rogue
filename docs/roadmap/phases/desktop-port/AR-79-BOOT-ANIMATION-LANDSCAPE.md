# AR-79: Boot Animation — Landscape Adaptation

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §19
> **Priority:** CORE EXPERIENCE
> **Complexity:** Small
> **Dependencies:** AR-71 (Layout System)

## Context

The boot animation uses 1024×1835 portrait assets (logo, title, cave rings). The animation calculates `coverScale = Math.max(viewportW / 1024, viewportH / 1835)` — this works for portrait but will over-scale in landscape, cropping excessively.

## Current Implementation

- `src/game/scenes/BootAnimScene.ts` — 11-second cinematic
- Assets: `public/assets/boot/logo*.png` (1024×1835), cave rings, branding text
- Cover-scales to fill viewport

## Directive

### Step 1: Landscape Cover Scale Fix

**File:** `src/game/scenes/BootAnimScene.ts`

In `handleLayoutChange` (or in the existing scale calculation):

- Portrait: keep current `coverScale = Math.max(viewportW / 1024, viewportH / 1835)` — UNCHANGED
- Landscape: use `coverScale = Math.max(viewportW / 1024, viewportH / 1835)` but cap cropping so logo remains visible. OR: center the logo vertically and allow pillarboxing (dark bars on sides are fine for a splash screen)

The simplest acceptable approach:
- Center logo in viewport
- Scale to fit HEIGHT (logo fills vertical space)
- Dark bars on left/right sides (acceptable for a boot animation)
- Stars and particles fill the full viewport regardless
- Cave ring fly-past fills full viewport

### Step 2: Landscape Splash Asset (Future)

Add TODO comment:
```
// FUTURE: Create landscape boot assets (1920x1080) for desktop.
// For now, portrait assets centered with pillarboxing is acceptable.
```

### Step 3: Verification

- [ ] Portrait boot animation: pixel-identical
- [ ] Landscape boot animation: logo centered, no crash, no extreme crop
- [ ] Stars fill full viewport in landscape
- [ ] Cave rings fill full viewport in landscape
- [ ] Animation completes without errors in both modes

## Files Affected

| File | Action |
|------|--------|
| `src/game/scenes/BootAnimScene.ts` | MODIFY (landscape scale handling) |

## GDD Updates

None — boot animation is cosmetic, not gameplay.
