# Accessibility

## Overview

Recall Rogue targets Steam PC first. Accessibility features are essential for reaching the widest audience and meeting platform expectations. This document tracks what's implemented and what's planned.

## Implementation Status

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Color-blind mode | Implemented | P0 | CSS SVG filters for deuteranopia/protanopia/tritanopia |
| Keyboard navigation | Planned | P0 | Tab through UI, Enter to confirm, Esc to cancel |
| Text sizing | Partial | P1 | `--text-scale` CSS var exists, needs settings slider |
| Quiz timer pausable | Existing | P1 | Timer is speed bonus only, not hard deadline |
| High contrast mode | Planned | P1 | WCAG AA 4.5:1 on critical UI |
| Remappable controls | Planned | P1 | All combat/quiz actions rebindable |
| Game speed control | Planned | P2 | 75%–150% speed slider |
| Screen reader support | Planned | P2 | ARIA labels on quiz, combat log |
| Photosensitivity | Review needed | P2 | Audit particle effects for >3Hz flashing |

## Color-Blind Mode

Three modes available in Settings:
- **Deuteranopia** (red-green, most common ~8% of males)
- **Protanopia** (red-green variant)
- **Tritanopia** (blue-yellow, rare)

Implementation: SVG `<feColorMatrix>` filters applied to the root element. Chain colors and status effect indicators use icon+text, never color alone.

**Source files:**
- `src/ui/styles/accessibility.css` — SVG filter definitions
- Settings toggle in player preferences

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

The `--text-scale` CSS custom property scales all font sizes dynamically. Settings slider: 80% to 150% in 10% increments.

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
