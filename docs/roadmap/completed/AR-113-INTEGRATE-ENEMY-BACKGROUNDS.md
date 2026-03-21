# AR-113: Integrate Accepted Enemy Backgrounds into Game

## Overview

Export all 196 accepted backgrounds from Art Studio to the game's public assets, convert to optimized WebP, and verify the runtime loads them correctly per-enemy.

**Inventory:** 98 enemies × 2 orientations = 196 backgrounds, all accepted in artstudio.

---

## Sub-steps

### 1. Export script — copy accepted variants to game assets

- [ ] 1.1 Create `scripts/export-backgrounds.mjs` that:
  - Reads `artstudio-items.json` to find each accepted variant number
  - Copies the accepted PNG from `sprite-gen/cardback-tool/artstudio-output/backgrounds/{itemId}/variant-{N}.png`
  - Converts to WebP (lossy, quality 85) via sharp for smaller file sizes
  - Saves to `public/assets/backgrounds/combat/enemies/{enemyId}/portrait.webp` and `landscape.webp`
  - Logs progress and final asset count
- [ ] 1.2 Run the script

**Output structure:**
```
public/assets/backgrounds/combat/enemies/
  cave_bat/portrait.webp, landscape.webp
  crystal_golem/portrait.webp, landscape.webp
  ... (98 enemy directories × 2 files each)
```

### 2. Verify runtime loading

- [ ] 2.1 Start dev server, navigate to combat
- [ ] 2.2 Confirm per-enemy background loads (no fallback to segment pool)
- [ ] 2.3 Check console for 404s
- [ ] 2.4 Test portrait and landscape orientations

### 3. Clean up old segment pool backgrounds

- [ ] 3.1 Remove old `public/assets/backgrounds/combat/segment1/` through `segment5/` and `boss/`
- [ ] 3.2 Remove old `bg_combat_dungeon.png/webp`
- [ ] 3.3 Update `backgroundManifest.ts` to remove legacy segment pool arrays (keep the fallback function signature but have it return a default)
- [ ] 3.4 Verify no 404s

---

## Verification Gate

- [ ] `npm run build` succeeds
- [ ] All 196 WebP files exist in correct directories
- [ ] Combat loads per-enemy backgrounds in both orientations
- [ ] No console 404 errors
