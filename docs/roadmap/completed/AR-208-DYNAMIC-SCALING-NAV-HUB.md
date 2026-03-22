# AR-208: Dynamic Scaling — Nav Sidebar + Hub HUD + Level Badge

**Priority:** P1 — Critical
**Estimated complexity:** Medium
**Rule:** ZERO hardcoded px for layout/sizing/spacing/fonts. Use `calc(Npx * var(--layout-scale, 1))` for layout, `calc(Npx * var(--text-scale, 1))` for fonts.

---

## Overview

The nav sidebar, camp HUD overlay, and level badge all contain hardcoded px values in their landscape overrides. These must be converted to use `--layout-scale` and `--text-scale` CSS variables so they scale correctly from 720p to 1440p+.

## Sub-steps

### 1. HubNavBar.svelte — Sidebar scaling

**File:** `src/ui/components/HubNavBar.svelte`

Replace all hardcoded landscape values:

```
.nav-sidebar width: 100px → calc(100px * var(--layout-scale, 1))
.nav-sidebar gap: 4px → calc(4px * var(--layout-scale, 1))
.nav-sidebar padding: 8px 4px → calc(8px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1))
.sidebar-btn min-height: 52px → calc(52px * var(--layout-scale, 1))
.sidebar-btn gap: 4px → calc(4px * var(--layout-scale, 1))
.sidebar-btn padding: 6px 4px → calc(6px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1))
.sidebar-btn font-size: calc(10px * var(--text-scale, 1)) → already scaled (KEEP)
.sidebar-btn border-left: 3px → calc(3px * var(--layout-scale, 1))
.sidebar-btn.active border-left-color stays
.sidebar-label font-size: 11px → calc(11px * var(--text-scale, 1))
.nav-icon-img width/height: 24px → calc(24px * var(--layout-scale, 1))
.nav-icon-fallback font-size: 20px → calc(20px * var(--text-scale, 1))
.nav-btn (portrait) min-height: 48px → calc(48px * var(--layout-scale, 1))
```

Also add hover states for desktop feel:
```css
.sidebar-btn:hover {
  background: rgba(255, 200, 100, 0.08);
  color: #dbeafe;
  transition: background 150ms ease, color 150ms ease;
}
```

**Acceptance criteria:**
- [ ] No hardcoded px values remain in HubNavBar.svelte
- [ ] Sidebar scales proportionally at 1280px, 1920px, and 2560px viewports
- [ ] Hover states visible on mouse-over
- [ ] Active state still highlights correctly

### 2. CampHudOverlay.svelte — HUD pill scaling

**File:** `src/ui/components/CampHudOverlay.svelte`

Replace all hardcoded values:

```
Portrait:
.hud-pill top: calc(12px + var(--safe-top)) → calc(calc(12px * var(--layout-scale, 1)) + var(--safe-top))
.hud-pill gap: 5px → calc(5px * var(--layout-scale, 1))
.hud-pill padding: 6px 12px → calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1))
.hud-left left: 12px → calc(12px * var(--layout-scale, 1))
.hud-right right: 12px → calc(12px * var(--layout-scale, 1))
.hud-icon font-size: 14px → calc(14px * var(--text-scale, 1))
.hud-value font-size: 13px → calc(13px * var(--text-scale, 1))

Landscape overrides:
.hud-overlay.landscape .hud-pill top: 14px → calc(14px * var(--layout-scale, 1))
.hud-overlay.landscape .hud-pill padding: 8px 16px → calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1))
.hud-overlay.landscape .hud-pill gap: 8px → calc(8px * var(--layout-scale, 1))
.hud-overlay.landscape .hud-icon font-size: 20px → calc(20px * var(--text-scale, 1))
.hud-overlay.landscape .hud-value font-size: 18px → calc(18px * var(--text-scale, 1))
.hud-overlay.landscape.banner-offset .hud-pill top: calc(76px) → calc(76px * var(--layout-scale, 1))
.hud-overlay.banner-offset .hud-pill top: calc(76px + var(--safe-top)) → calc(calc(76px * var(--layout-scale, 1)) + var(--safe-top))
```

**Acceptance criteria:**
- [ ] No hardcoded px values remain in CampHudOverlay.svelte
- [ ] HUD pills scale proportionally at all resolutions

### 3. HubScreen.svelte — Level badge scaling

**File:** `src/ui/components/HubScreen.svelte`

Replace landscape level badge overrides:

```
.hub-landscape .camp-level-badge: right: 20px → calc(20px * var(--layout-scale, 1)); bottom: 24px → calc(24px * var(--layout-scale, 1))
.hub-landscape .level-number font-size: 28px → calc(28px * var(--text-scale, 1))
.hub-landscape .level-xp-bar width: 90px → calc(90px * var(--layout-scale, 1)); height: 6px → calc(6px * var(--layout-scale, 1))
.hub-landscape .level-xp-text font-size: 13px → calc(13px * var(--text-scale, 1))
```

Also fix the replay-boot-btn:
```
.replay-boot-btn: bottom: calc(12px + ...) → calc(calc(12px * var(--layout-scale, 1)) + var(--safe-bottom, 0px))
.replay-boot-btn left: 12px → calc(12px * var(--layout-scale, 1))
.replay-boot-btn padding: 4px 10px → calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1))
.replay-boot-btn font-size: 11px → calc(11px * var(--text-scale, 1))
```

**Acceptance criteria:**
- [ ] No hardcoded px values remain in landscape overrides of HubScreen.svelte
- [ ] Level badge scales proportionally
- [ ] Still positioned correctly at bottom-right

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual inspection at 1920x1080 — all elements properly sized
- [ ] Visual inspection at 1280x720 — all elements still readable
- [ ] No text below 10px at any resolution
- [ ] Update `docs/GAME_DESIGN.md` if needed
- [ ] Update `data/inspection-registry.json` lastChangedDate for hub, settings screens
