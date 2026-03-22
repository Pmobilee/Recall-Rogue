# AR-209: Dynamic Scaling — Settings Panel + Profile Screen

**Priority:** P1 — Critical
**Estimated complexity:** Medium
**Rule:** ZERO hardcoded px for layout/sizing/spacing/fonts. Use `calc(Npx * var(--layout-scale, 1))` for layout, `calc(Npx * var(--text-scale, 1))` for fonts.

---

## Overview

SettingsPanel.svelte and ProfileScreen.svelte contain 118 combined hardcoded px values in their landscape desktop overrides. These must all be converted to use CSS custom property scaling.

## Sub-steps

### 1. SettingsPanel.svelte — Convert all landscape overrides

**File:** `src/ui/components/SettingsPanel.svelte`

Replace all `:global([data-layout="landscape"])` hardcoded values:

```
.settings-card-landscape grid-template-columns: 200px 1fr → calc(200px * var(--layout-scale, 1)) 1fr

:global([data-layout="landscape"]) .settings-overlay margin-left: 100px → calc(100px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .toggle-row/.slider-row:
  font-size: 15px → calc(15px * var(--text-scale, 1))
  min-height: 56px → calc(56px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .slider-row:
  grid-template-columns: calc(140px * var(--layout-scale, 1)) minmax(280px, 1fr) auto
  → calc(140px * var(--layout-scale, 1)) minmax(calc(280px * var(--layout-scale, 1)), 1fr) auto

:global([data-layout="landscape"]) .settings-section h3:
  font-size: 20px → calc(20px * var(--text-scale, 1))
  margin-bottom: 12px → calc(12px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .settings-panel-content:
  gap: 32px → calc(32px * var(--layout-scale, 1))

:global([data-layout="landscape"]) input[type='checkbox']:
  width: 44px → calc(44px * var(--layout-scale, 1))
  height: 44px → calc(44px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .category-btn:
  font-size: 13px → calc(13px * var(--text-scale, 1))

:global([data-layout="landscape"]) .chip:
  font-size: 13px → calc(13px * var(--text-scale, 1))

.settings-panel-content .settings-section:
  max-width: 560px → calc(560px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .settings-panel-content .settings-section:
  max-width: 800px → calc(800px * var(--layout-scale, 1))
```

Also fix base values that are hardcoded:
```
.chip min-height: 48px → calc(48px * var(--layout-scale, 1))
.back-btn min-height: 48px → calc(48px * var(--layout-scale, 1))
```

Add hover states for settings controls:
```css
:global([data-layout="landscape"]) .category-btn:hover {
  background: rgba(30, 41, 59, 0.8);
  color: #93c5fd;
  transition: background 150ms ease, color 150ms ease;
}

:global([data-layout="landscape"]) .chip:hover:not(.selected):not(:disabled) {
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(15, 33, 53, 0.5);
  transition: all 150ms ease;
}

:global([data-layout="landscape"]) .toggle-row:hover,
:global([data-layout="landscape"]) .slider-row:hover {
  background: rgba(255, 255, 255, 0.03);
  border-radius: calc(8px * var(--layout-scale, 1));
  transition: background 150ms ease;
}
```

**Acceptance criteria:**
- [ ] No hardcoded px values remain in SettingsPanel.svelte landscape overrides
- [ ] Settings scales proportionally from 720p to 1440p+
- [ ] Hover states on category buttons, chips, and toggle rows
- [ ] Checkboxes, sliders, and buttons are properly sized at all resolutions

### 2. ProfileScreen.svelte — Convert all landscape overrides

**File:** `src/ui/components/ProfileScreen.svelte`

Replace all `:global([data-layout="landscape"])` hardcoded values:

```
:global([data-layout="landscape"]) .profile-screen:
  padding: 32px 48px → calc(32px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .stat strong:
  font-size: 28px → calc(28px * var(--text-scale, 1))

:global([data-layout="landscape"]) .stat span:
  font-size: 13px → calc(13px * var(--text-scale, 1))

:global([data-layout="landscape"]) .hero p:
  font-size: 15px → calc(15px * var(--text-scale, 1))

:global([data-layout="landscape"]) .domain-item:
  font-size: 15px → calc(15px * var(--text-scale, 1))

:global([data-layout="landscape"]) .domain-item strong:
  font-size: 22px → calc(22px * var(--text-scale, 1))

:global([data-layout="landscape"]) .stats-grid-landscape:
  gap: 16px → calc(16px * var(--layout-scale, 1))

:global([data-layout="landscape"]) .avatar:
  width: 96px → calc(96px * var(--layout-scale, 1))
  height: 96px → calc(96px * var(--layout-scale, 1))
  font-size: 48px → calc(48px * var(--text-scale, 1))

:global([data-layout="landscape"]) .hero h3:
  font-size: 20px → calc(20px * var(--text-scale, 1))

:global([data-layout="landscape"]) .empty-domains:
  font-size: 18px → calc(18px * var(--text-scale, 1))
  margin-top: 64px → calc(64px * var(--layout-scale, 1))
```

Also fix base values:
```
.back min-height: 44px → calc(44px * var(--layout-scale, 1))
```

Add hover states for stat cards and domain items:
```css
:global([data-layout="landscape"]) .stat:hover {
  border-color: rgba(255, 215, 0, 0.3);
  box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.1);
  transition: all 150ms ease;
}

:global([data-layout="landscape"]) .domain-item:hover {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(148, 163, 184, 0.4);
  transition: all 150ms ease;
}
```

**Acceptance criteria:**
- [ ] No hardcoded px values remain in ProfileScreen.svelte landscape overrides
- [ ] Profile scales proportionally from 720p to 1440p+
- [ ] Hover states on stat cards and domain items
- [ ] Avatar and stats are properly sized at all resolutions

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual inspection at 1920x1080 — settings and profile properly sized
- [ ] Visual inspection at 1280x720 — everything readable
- [ ] No text below 10px at any resolution
- [ ] Update `data/inspection-registry.json` lastChangedDate for settings, profile screens
