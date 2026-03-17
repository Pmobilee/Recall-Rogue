# AR-84: Desktop Port QA Matrix

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §20
> **Priority:** FINAL (after all other desktop ARs)
> **Complexity:** Medium
> **Dependencies:** All other desktop-port ARs

## Context

Comprehensive QA pass to verify the desktop port works across all target viewports and that portrait mode remains pixel-identical to the pre-port version.

## Directive

### Layout Testing Matrix

| Viewport | Mode | Priority | Notes |
|----------|------|----------|-------|
| 390×844 (iPhone 14) | Portrait | **Must pass** | Reference device |
| 844×390 (iPhone landscape) | Landscape | Must pass | |
| 1024×768 (iPad portrait) | Portrait | Must pass | |
| 1366×1024 (iPad landscape) | Landscape | Must pass | |
| 1920×1080 (Desktop FHD) | Landscape | **Must pass** | Primary desktop target |
| 2560×1440 (Desktop QHD) | Landscape | Should pass | |
| 1280×800 (Steam Deck) | Landscape | **Must pass** | Steam Deck |
| 3440×1440 (Ultrawide) | Landscape + letterbox | Should pass | Letterbox acceptable |

### Functional Checklist

**Layout:**
- [ ] Portrait mode pixel-identical to pre-port version (screenshot comparison)
- [ ] Layout toggle works via window resize
- [ ] Layout toggle works via Ctrl+Shift+L (dev)
- [ ] No layout glitches when resizing window during combat
- [ ] No layout glitches when resizing during quiz

**Combat:**
- [ ] Full combat flow works in portrait
- [ ] Full combat flow works in landscape
- [ ] Enemy visible during quiz in landscape
- [ ] Card selection, Quick Play, Charge — all work in both modes
- [ ] VFX render correctly in both modes
- [ ] Chain visuals work in both modes

**Input:**
- [ ] All keyboard shortcuts work in landscape
- [ ] All actions mouse-clickable (no keyboard-only)
- [ ] Card hover preview shows in landscape
- [ ] Enemy hover tooltip shows in landscape
- [ ] Right-click card context menu works
- [ ] `?` opens keyboard help
- [ ] Touch still works in portrait (Capacitor)

**Screens:**
- [ ] Hub/camp renders correctly in both modes
- [ ] Nav bar: bottom in portrait, sidebar in landscape
- [ ] All modals: full-screen portrait, centered landscape
- [ ] Card reward screen: chain badges visible in landscape
- [ ] Shop: horizontal layout in landscape
- [ ] Settings: sidebar layout in landscape
- [ ] Boot animation plays in both modes

**Steam:**
- [ ] Achievements unlock correctly
- [ ] Cloud save writes and reads
- [ ] Rich presence updates
- [ ] Steam Overlay opens (Shift+Tab)
- [ ] No crash on non-Steam launch

**Performance:**
- [ ] 60fps at 1920×1080
- [ ] 60fps at 1280×800 (Steam Deck)
- [ ] No memory leaks on layout toggle
- [ ] No memory leaks on repeated combat encounters

### Automated Test Updates

- Update existing Playwright tests to run in both portrait and landscape viewports
- Add landscape-specific test cases for combat flow
- Add keyboard shortcut test cases

### Regression Prevention

- Add viewport size to Playwright test config
- Screenshot comparison tests for portrait regression
- CI runs tests at both 390×844 and 1920×1080

## Files Affected

| File | Action |
|------|--------|
| `tests/e2e/*.cjs` | MODIFY (add landscape viewport tests) |
| `playwright.config.ts` | MODIFY (add landscape project) |
| Test fixtures | NEW (landscape test data) |

## GDD Updates

None — QA process, not gameplay.
