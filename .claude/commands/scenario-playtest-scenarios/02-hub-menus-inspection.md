# Scenario 02: Hub & Menu Inspection

## Goal
Verify all hub navigation buttons work, each target screen renders without errors, and navigation back to hub succeeds.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to URL, wait 4s
2. Verify screen = `hub`, take **Screenshot #1 (hub-overview)**
3. Run filtered console check — note any errors

### Navigation Test Loop
For each target screen, do:
4. Click the navigation element (see table below)
5. Wait 2s, read screen store
6. CHECK: screen matches expected value
7. Run `browser_snapshot` — check for "undefined", "null", "NaN" text
8. Run filtered console check
9. Navigate back to hub (click back button or `[data-testid="btn-home"]`)
10. Verify screen = `hub`

### Navigation Targets

| Button / Element | Expected Screen | Notes |
|-----------------|----------------|-------|
| `[data-testid="btn-start-run"]` | `domainSelection` | Don't proceed further, navigate back |
| Library nav button | `library` | Bottom nav or camp button |
| Settings nav button | `settings` | Bottom nav or camp button |
| Profile nav button | `profile` | Bottom nav or camp button |

After testing navigation targets:
11. Take **Screenshot #2 (library)** on the library screen
12. Take **Screenshot #3 (settings)** on the settings screen

### Hub Visual Inspection
13. Return to hub, take **Screenshot #4 (hub-final)**
14. Run `window.__terraDebug()` — check interactiveElements for occluded buttons
15. Check all camp buttons are visible and not disabled

## Checks
- Every nav target loads the correct screen
- No screens show "undefined", "null", "NaN" text
- Navigation back to hub always works
- No JS errors during navigation
- Hub camp buttons are visible and not occluded
- All text is readable (no truncation, no overlap)

## Report
Write JSON to `/tmp/playtest-02-hub-menus.json` and summary to `/tmp/playtest-02-hub-menus-summary.md`
