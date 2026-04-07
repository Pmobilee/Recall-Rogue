# Accessibility

## Overview

Recall Rogue targets Steam PC first. Accessibility features are essential for reaching the widest audience and meeting platform expectations. This document tracks what's implemented and what's planned.

## Implementation Status

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Color-blind mode | Implemented | P0 | CSS SVG filters for deuteranopia/protanopia/tritanopia — selector in Settings > Accessibility |
| Keyboard navigation | Planned | P0 | Tab through UI, Enter to confirm, Esc to cancel |
| Text sizing | Partial | P1 | `--text-scale` CSS var exists, settings chips for Small/Medium/Large |
| Quiz timer pausable | Existing | P1 | Timer is speed bonus only, not hard deadline |
| High contrast mode | Implemented | P1 | Toggle in Settings > Accessibility; applies `body.high-contrast` |
| Remappable controls | Planned | P1 | All combat/quiz actions rebindable |
| Game speed control | Planned | P2 | 75%–150% speed slider |
| Screen reader support | Planned | P2 | ARIA labels on quiz, combat log |
| Photosensitivity | Review needed | P2 | Audit particle effects for >3Hz flashing |

## Color-Blind Mode

Three modes available in Settings > Accessibility via a dropdown:
- **Off** (default)
- **Deuteranopia** (red-green, most common ~8% of males) — missing M cones
- **Protanopia** (red-green variant) — missing L cones
- **Tritanopia** (blue-yellow, rare) — missing S cones

### Implementation

- `src/services/cardPreferences.ts` — `ColorBlindMode` type + `colorBlindMode` persisted store (key: `card:colorBlindMode`)
- `src/services/accessibilityManager.ts` — subscribes to `colorBlindMode`; injects hidden SVG `<feColorMatrix>` filters into `document.body`; sets `data-colorblind` attribute on `document.documentElement`
- `src/ui/styles/accessibility.css` — `:root[data-colorblind="<mode>"]` rules applying `filter: url(#cb-<mode>)`
- `src/ui/components/SettingsPanel.svelte` — dropdown selector in the Accessibility tab (both landscape and portrait layouts)

### Color Matrix Values (LMS-based, industry standard)

| Mode | Matrix |
|------|--------|
| deuteranopia | `0.625 0.375 0 0 0 / 0.7 0.3 0 0 0 / 0 0.3 0.7 0 0 / 0 0 0 1 0` |
| protanopia | `0.567 0.433 0 0 0 / 0.558 0.442 0 0 0 / 0 0.242 0.758 0 0 / 0 0 0 1 0` |
| tritanopia | `0.95 0.05 0 0 0 / 0 0.433 0.567 0 0 / 0 0.475 0.525 0 0 / 0 0 0 1 0` |

The filter is applied to `:root` (html element), which means both the Phaser canvas and all Svelte overlays are uniformly affected. The SVG filter element (`id="cb-svg-filters"`) is lazily injected into `document.body` on first activation.

## Keyboard Navigation

### Target Behavior
- **Tab** / **Shift+Tab**: Move focus between interactive elements
- **Enter** / **Space**: Activate focused element
- **Esc**: Close modal, cancel action, go back
- **1-4**: Quiz answer shortcuts (already implemented)
- **Arrow keys**: Navigate card hand, shop items

### Focus Management
- Visible focus ring on all interactive elements (2px solid, high contrast)
- Focus trapped inside modals (Tab cycles within modal, not behind it)
- Focus restored to trigger element when modal closes

## Text Sizing

The `--text-scale` CSS custom property scales all font sizes dynamically. Settings chips: Small (0.85×), Medium (1×), Large (1.2×). Full slider (80%–150%) is planned.

## Performance Considerations

Accessibility features must not degrade performance:
- SVG filters: GPU-accelerated, negligible FPS impact
- Focus management: DOM-only, no render cost
- Screen reader: ARIA attributes are metadata, zero render cost

## Testing

Before release, verify:
1. All UI reachable via keyboard only (no mouse)
2. Color-blind simulator: https://www.color-blindness.com/coblis-color-blindness-simulator/
3. WAVE (WebAIM) contrast checker on all screens
4. Tab order is logical (left-to-right, top-to-bottom)
5. No information conveyed by color alone
