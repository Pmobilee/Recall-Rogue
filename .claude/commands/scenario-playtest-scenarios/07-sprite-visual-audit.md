# Scenario 07: Sprite & Visual Audit

> **IMPORTANT: Use `window.__terraScenario.load('combat-basic')` to instantly enter combat. Do NOT navigate through hub → dungeon → map → node manually. Other scenarios: 'combat-boss', 'combat-10-cards', 'combat-scholar', 'combat-elite'. Always call `document.documentElement.setAttribute('data-pw-animations', 'disabled')` before screenshots.**

## Goal
Verify enemy sprites load correctly, card art renders, backgrounds display, and no visual placeholders appear.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Take **Screenshot #1 (hub)** — check hub background, camp buttons have sprites

### Combat Visual Check
4. Load combat: `window.__terraScenario.load('combat-basic')`
5. Wait 500ms, take **Screenshot #2 (combat-enemy-1)**
6. Visual check: enemy sprite visible? Not a placeholder rectangle? Background loaded?

### Second Enemy (different preset)
7. Load elite encounter: `window.__terraScenario.load('combat-elite')`
8. Wait 500ms, take **Screenshot #3 (combat-enemy-2)**
9. Visual check: different enemy sprite? Still renders correctly?

### Boss Enemy
10. Load boss: `window.__terraScenario.load('combat-boss')`
11. Wait 500ms, verify boss sprite is distinct and renders at correct scale

### Card Hand Visual Check
12. (Using any of the above loaded combat scenarios) take **Screenshot #4 (card-hand)**
13. CHECK: 5 card slots visible in hand area
14. CHECK: cards have type icons/text
15. CHECK: no blank/empty card slots that should have content

### Quiz Overlay Visual Check
16. Click a card to open quiz
17. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
18. Take **Screenshot #5 (quiz-overlay)**
19. CHECK: question text visible and readable
20. CHECK: 3 answer buttons visible and styled
21. CHECK: overlay doesn't overflow viewport

### Shop Room Visual Check
22. Load shop: `window.__terraScenario.load('shop-loaded')`
23. Wait 500ms, take **Screenshot #6 (special-room-shop)**
24. CHECK: room background loaded, shop items displayed, prices visible

### Rest Room Visual Check
25. Load rest: `window.__terraScenario.load('rest-site')`
26. Wait 500ms, take **Screenshot #7 (special-room-rest)**
27. CHECK: rest room background loaded, heal/study buttons visible and styled

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
