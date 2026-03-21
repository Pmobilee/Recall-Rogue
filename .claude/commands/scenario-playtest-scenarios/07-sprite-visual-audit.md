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

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol. This scenario is PRIMARILY visual — the subjective evaluation is especially important.

### Scenario-Specific Evaluation Questions

**Hub (#1):**
- Run discovery for images specifically. List every image found with dimensions and load status.
- Is the camp background loaded and the correct orientation?
- Do all camp button sprites load (not broken images)?
- Is the art style consistent across all hub elements?
- Does the hub feel like a cohesive scene or a collection of mismatched assets?

**Combat Enemy 1 (#2):**
- Run discovery. Is the enemy sprite visible and loaded?
- What are the sprite dimensions? Is it appropriately sized for the enemy type?
- Is the sprite a real pixel art asset or a colored rectangle placeholder?
- Does the sprite have transparent background (no white/black box around it)?
- Does the enemy look threatening/appropriate for a cave_bat?
- Is the combat background loaded and atmospheric?

**Combat Enemy 2 (#3):**
- Same sprite checks as enemy 1, but for the elite enemy.
- Does the elite look more dangerous than the basic enemy?
- Is the art quality consistent between enemy types?
- Are there any visual artifacts (stretched pixels, wrong colors, aliasing)?

**Card Hand (#4):**
- For each card in hand: does the card frame render correctly?
- Are card borders color-coded by type? Are the colors correct?
- Does card art (if any) load within the frame?
- Are AP cost numbers rendered clearly?
- Do the cards look like they belong in the same game?

**Quiz Overlay (#5):**
- Is the quiz overlay properly styled (not raw unstyled HTML)?
- Are answer buttons consistently sized and spaced?
- Is the question text formatted correctly (no HTML tags showing)?
- Does the overlay fit within the viewport without scrolling?

**Shop Room (#6):**
- Is the shop background distinct from combat backgrounds?
- Do shop item icons/images load?
- Are prices formatted with a gold icon?
- Does the shop feel like a physical merchant's space?

**Rest Room (#7):**
- Is the rest room background loaded?
- Are heal/study button icons rendered?
- Does the room feel peaceful and restorative?
- Is the atmosphere distinctly different from combat?

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
