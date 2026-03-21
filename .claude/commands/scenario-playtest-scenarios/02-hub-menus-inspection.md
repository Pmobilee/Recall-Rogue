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

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint and after navigating to each screen, run the Runtime Element Discovery protocol from the Shared Protocol. You MUST discover all elements and evaluate each one.

### Scenario-Specific Evaluation Questions

**Hub Overview (#1):**
- Run element discovery. List ALL interactive elements found with their labels, positions, and sizes.
- For every camp button: is the sprite/icon appropriate for its function? Is the label readable against the background?
- Is the campfire animated? Does clicking it produce sparkles?
- Does the pet have personality (speech bubble on click)?
- Are streak/dust pills showing valid data?
- Would a new player know what each button does without instruction?
- Is the layout balanced or does one area feel empty/crowded?

**Library (#2):**
- Run discovery. What tabs exist? What content is shown in each?
- Are domain cards color-coded consistently with the rest of the game?
- Do progress bars show meaningful progress or feel discouraging?
- Is the mastery count motivating?
- Are fact lists scannable (not walls of text)?
- If no facts learned yet: does the empty state guide the player?

**Settings (#3):**
- Run discovery. What settings sections exist? What controls are in each?
- Is every toggle/slider large enough to tap (>= 44px)?
- Does each setting label clearly explain what it changes?
- Are current values shown for sliders (percentage)?
- Is the Accessibility section comprehensive and useful?
- Would a player find the setting they're looking for quickly?

**Hub Final (#4):**
- After visiting all screens and returning: is anything different from screenshot #1?
- Are all camp buttons still visible and not occluded?
- Has any state changed unexpectedly from navigating?

## Checks
- Every nav target loads the correct screen
- No screens show "undefined", "null", "NaN" text
- Navigation back to hub always works
- No JS errors during navigation
- Hub camp buttons are visible and not occluded
- All text is readable (no truncation, no overlap)

## Report
Write JSON to `/tmp/playtest-02-hub-menus.json` and summary to `/tmp/playtest-02-hub-menus-summary.md`
