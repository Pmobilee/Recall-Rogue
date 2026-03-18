# Scenario 01: Full Run Smoke Test

> **IMPORTANT: For combat portions, use `window.__terraScenario.load('combat-basic')` to instantly enter combat instead of navigating manually. Do NOT navigate through hub → dungeon → map → node manually unless specifically testing the navigation flow itself. Always call `document.documentElement.setAttribute('data-pw-animations', 'disabled')` before screenshots.**

## Goal
Complete a standard run from hub to run-end screen, verifying all major screen transitions work.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to URL, wait 4s
2. Verify screen = `hub`, take **Screenshot #1 (hub)**
3. Click `[data-testid="btn-start-run"]`, wait 2s
4. Verify screen = `domainSelection`
5. Click `[data-testid="domain-card-animals_wildlife"]`, wait 1s (use first visible domain card if this one doesn't exist)
6. Verify screen = `archetypeSelection`
7. Click `[data-testid="archetype-balanced"]`, wait 2s (use first visible archetype button if this one doesn't exist)
8. Verify screen = `combat`, take **Screenshot #2 (combat-start)**
9. Read compact state — note player HP, enemy name, hand size

### Combat Encounter 1 (play 2 cards)
10. Click `[data-testid="card-hand-0"]`, wait 1s — quiz should appear
11. Read quiz question + 3 choices. CHECK: question not empty, 3 unique choices
12. Click `[data-testid="quiz-answer-0"]`, wait 2s — take **Screenshot #3 (quiz-answered)**
13. Click `[data-testid="card-hand-1"]`, wait 1s — next quiz
14. Click `[data-testid="quiz-answer-1"]`, wait 2s
15. Click `[data-testid="btn-end-turn"]`, wait 2.5s — enemy attacks
16. Read state — check HP changed, enemy HP changed
17. Repeat steps 10-16 until enemy defeated OR 5 turns max

### Post-Encounter
18. If screen = `cardReward`: click first `[data-testid^="reward-type-"]`, then `[data-testid="reward-accept"]`, wait 1s. Take **Screenshot #4 (card-reward)**
19. If screen = `roomSelection`: click `[data-testid="room-choice-0"]`, wait 1.5s
20. If screen = `combat`: play 1-2 more turns (simplified — just answer correctly)
21. If screen = `retreatOrDelve`: click `[data-testid="btn-retreat"]`, wait 2s

### Run End
22. Verify screen = `runEnd`, take **Screenshot #5 (run-end)**
23. Read run results (currency, encounters)
24. Click `[data-testid="btn-home"]`, wait 2s
25. Verify screen = `hub`

### Fallback
If stuck on any screen for >10s, take a screenshot, log the issue, and attempt to navigate home.

## Screenshot Checkpoints
1. hub — Hub screen loaded
2. combat-start — First combat encounter
3. quiz-answered — Quiz overlay with answer feedback
4. card-reward — Card reward selection (if reached)
5. run-end — Run results screen

## Checks
- All screen transitions happen within 5s
- Quiz has exactly 3 non-empty, unique answer choices
- HP values are numbers (not NaN/undefined)
- Enemy name is a string (not undefined)
- No JS errors in filtered console
- Card hand shows 1-5 cards

## Report
Write JSON to `/tmp/playtest-01-full-run.json` and summary to `/tmp/playtest-01-full-run-summary.md`
