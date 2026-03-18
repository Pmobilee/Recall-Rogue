# Scenario 07: Sprite & Visual Audit

> **IMPORTANT: Use `window.__terraScenario.load('combat-basic')` to instantly enter combat. Do NOT navigate through hub → dungeon → map → node manually. Other scenarios: 'combat-boss', 'combat-10-cards', 'combat-scholar', 'combat-elite'. Always call `document.documentElement.setAttribute('data-pw-animations', 'disabled')` before screenshots.**

## Goal
Verify enemy sprites load correctly, card art renders, backgrounds display, and no visual placeholders appear.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to URL, wait 4s
2. Take **Screenshot #1 (hub)** — check hub background, camp buttons have sprites

### Combat Visual Check
3. Start a run (any domain, any archetype)
4. Wait for combat screen
5. Take **Screenshot #2 (combat-enemy-1)**
6. Visual check: enemy sprite visible? Not a placeholder rectangle? Background loaded?
7. Play through encounter (answer correctly)

### Second Enemy
8. After room selection, enter next combat
9. Take **Screenshot #3 (combat-enemy-2)**
10. Visual check: different enemy sprite? Still renders correctly?

### Card Hand Visual Check
11. During combat, before playing cards, take **Screenshot #4 (card-hand)**
12. CHECK: 5 card slots visible in hand area
13. CHECK: cards have type icons/text
14. CHECK: no blank/empty card slots that should have content

### Quiz Overlay Visual Check
15. Click a card to open quiz
16. Take **Screenshot #5 (quiz-overlay)**
17. CHECK: question text visible and readable
18. CHECK: 3 answer buttons visible and styled
19. CHECK: overlay doesn't overflow viewport

### Room Selection Visual Check
20. Navigate to room selection
21. Take **Screenshot #6 (room-selection)**
22. CHECK: 3 door options visible
23. CHECK: door type icons/labels present

### Special Room Visuals
24. If a rest/shop room is encountered:
25. Take **Screenshot #7 (special-room)**
26. CHECK: room background loaded, UI elements properly styled

## Checks
- Enemy sprites load (not placeholder rectangles)
- Card hand renders with 5 visible card slots
- Quiz overlay fits viewport (412x915)
- Room selection shows 3 distinct doors
- Text is readable everywhere (proper contrast, no truncation)
- No horizontal scrollbar on any screen
- Backgrounds load on all screens

## Report
Write JSON to `/tmp/playtest-07-sprites.json` and summary to `/tmp/playtest-07-sprites-summary.md`
