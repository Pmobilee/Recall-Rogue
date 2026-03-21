# Scenario 10: Settings, Library & Profile Screens

## Goal
Inspect non-run hub screens for completeness: settings panel, knowledge library, profile, and deck builder.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Settings
1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load settings: `window.__terraScenario.load('settings')`
4. Wait 500ms, take **Screenshot #1 (settings)**
5. CHECK: settings panel renders with options
6. CHECK: no "undefined"/"null" text
7. Check for audio, accessibility, language sections
8. Navigate back to hub

### Library
9. Load library: `window.__terraScenario.load('library')`
10. Wait 500ms, take **Screenshot #2 (library)**
11. CHECK: card browser renders
12. CHECK: deck builder section accessible
13. CHECK: study mode options visible
14. Snapshot DOM — check for data artifacts
15. Navigate back to hub

### Profile
16. Load profile: `window.__terraScenario.load('profile')`
17. Wait 500ms, take **Screenshot #3 (profile)**
18. CHECK: player stats displayed (runs completed, facts learned, etc.)
19. CHECK: values are numbers not NaN/undefined
20. Navigate back to hub

### Deck Builder (if accessible from library)
21. Load library again: `window.__terraScenario.load('library')`
22. Navigate to deck builder section
23. Take **Screenshot #4 (deck-builder)**
24. CHECK: cards listed
25. CHECK: deck size displayed

### Final
26. Run filtered console check across all screen visits
27. Return to hub

## Checks
- Settings renders without errors
- Library shows card collection
- Profile shows valid stats
- Deck builder accessible and functional
- No data artifacts on any screen
- All navigation works bidirectionally

## Report
Write JSON to `/tmp/playtest-10-screens.json` and summary to `/tmp/playtest-10-screens-summary.md`
