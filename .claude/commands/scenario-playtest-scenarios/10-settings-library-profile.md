# Scenario 10: Settings, Library & Profile Screens

## Goal
Inspect non-run hub screens for completeness: settings panel, knowledge library, profile, and deck builder.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Settings
1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load settings: `window.__rrScenario.load('settings')`
4. Wait 500ms, take **Screenshot #1 (settings)**
5. CHECK: settings panel renders with options
6. CHECK: no "undefined"/"null" text
7. Check for audio, accessibility, language sections
8. Navigate back to hub

### Library
9. Load library: `window.__rrScenario.load('library')`
10. Wait 500ms, take **Screenshot #2 (library)**
11. CHECK: card browser renders
12. CHECK: deck builder section accessible
13. CHECK: study mode options visible
14. Snapshot DOM — check for data artifacts
15. Navigate back to hub

### Profile
16. Load profile: `window.__rrScenario.load('profile')`
17. Wait 500ms, take **Screenshot #3 (profile)**
18. CHECK: player stats displayed (runs completed, facts learned, etc.)
19. CHECK: values are numbers not NaN/undefined
20. Navigate back to hub

### Deck Builder (if accessible from library)
21. Load library again: `window.__rrScenario.load('library')`
22. Navigate to deck builder section
23. Take **Screenshot #4 (deck-builder)**
24. CHECK: cards listed
25. CHECK: deck size displayed

### Final
26. Run filtered console check across all screen visits
27. Return to hub

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol. These screens are information-dense — be thorough with text evaluation.

### Scenario-Specific Evaluation Questions

**Settings (#1):**
- Run element discovery. List ALL settings controls found (toggles, sliders, chips, buttons).
- For every toggle: is it large enough to tap (>= 44px)? Is on/off state visually clear?
- For every slider: does it show its current value? Is the slider track wide enough to drag precisely on mobile?
- For text size chips: can you tell which size is currently selected?
- Is the category navigation clear (Audio, Accessibility, Notifications, Account)?
- Are all labels descriptive enough that a player knows what each setting does?
- Is the Accessibility section comprehensive? Does "High Contrast" toggle make a visible difference?
- Does "Reduce Motion" clearly communicate what animations it affects?
- Is "Slow Reader (+3s)" helpful or confusing as a label?
- Would a player find their desired setting within 3 seconds?

**Library (#2):**
- Run discovery. How many domains shown? How many facts listed (if any)?
- Are domain cards showing valid mastery counts (X/Y format, numbers not NaN)?
- Do progress bars visually match their percentage numbers?
- Are subcategory filters functional and not cluttered?
- Is the tier filter dropdown understandable (Learning, Proven, Mastered, etc.)?
- If fact detail view is accessible: does it show useful SM-2 data (stability, difficulty, next review)?
- Does the library make a player feel proud of their knowledge or overwhelmed?
- Is the deck builder tab discoverable?

**Profile (#3):**
- Run discovery. List ALL stat items found with their labels and values.
- Are all values valid numbers (>= 0, not NaN, not undefined)?
- Does the avatar look personalized?
- Is the stats grid layout clean (2 columns portrait, 3 landscape)?
- Does the "Runs Per Domain" section show interesting distribution data?
- Does the profile make a player feel accomplished or underwhelmed?
- Is there enough content here to make visiting the profile rewarding?

**Deck Builder (#4, if accessible):**
- Run discovery. Are cards listed? Is deck size shown?
- Can you identify card types visually in the builder?
- Is the deck builder useful for strategic planning, or just a list?

## Checks
- Settings renders without errors
- Library shows card collection
- Profile shows valid stats
- Deck builder accessible and functional
- No data artifacts on any screen
- All navigation works bidirectionally

## Report
Write JSON to `/tmp/playtest-10-screens.json` and summary to `/tmp/playtest-10-screens-summary.md`
