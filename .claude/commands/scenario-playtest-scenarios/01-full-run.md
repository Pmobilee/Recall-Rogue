# Scenario 01: Full Run Smoke Test

> **IMPORTANT: For combat portions, use `window.__rrScenario.load('combat-basic')` to instantly enter combat instead of navigating manually. Do NOT navigate through hub → dungeon → map → node manually unless specifically testing the navigation flow itself. Always call `document.documentElement.setAttribute('data-pw-animations', 'disabled')` before screenshots.**

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

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol (Step 1: discover, Step 2: generate checklist, Step 3: evaluate). You MUST do this — do not skip it.

### Scenario-Specific Evaluation Questions

At each checkpoint, also answer these scenario-specific questions:

**Hub (#1):**
- Run the element discovery scan. How many buttons, text elements, and images were found?
- For every button discovered: what does its label say? Is it clear what it does? Is it reachable with a thumb?
- Is Start Run the most prominent interactive element? Does the hub make you want to start a run?
- Are streak counter and dust balance showing valid numbers?
- Does the camp feel like a cozy home base or a cluttered menu?

**Combat Start (#2):**
- Run discovery. List every element found: enemy name, HP bars, AP orb, cards in hand, buttons.
- For each card in hand: can you read the AP cost, type, and name at this size?
- Is the enemy sprite loaded (not a placeholder)? Does it look threatening?
- Is enemy intent visible BEFORE you make any decision?
- Does the combat screen feel exciting or overwhelming for a first encounter?

**Quiz Answered (#3):**
- Run discovery on the quiz overlay. How many answer buttons? What does each say?
- Is the question text readable? Is it educational and interesting?
- Are all 3 answer choices unique and plausible?
- Does correct/wrong feedback feel proportionate? Does wrong feel like learning, not punishment?
- Is the quiz overlay blocking any critical combat information?

**Card Reward (#4):**
- Run discovery. What reward options are shown? How many?
- Can you evaluate each card option without tapping to expand?
- Is the accept button clearly the primary action?
- Does choosing a reward feel exciting or tedious?

**Run End (#5):**
- Run discovery. What stats are shown? Are all numbers valid (not NaN)?
- Does the run end screen make you feel accomplished (even in defeat)?
- Is Play Again the most prominent button? Does it make you want to replay?
- Is the Share button discoverable but not intrusive?

## Checks
- All screen transitions happen within 5s
- Quiz has exactly 3 non-empty, unique answer choices
- HP values are numbers (not NaN/undefined)
- Enemy name is a string (not undefined)
- No JS errors in filtered console
- Card hand shows 1-5 cards

## Report
Write JSON to `/tmp/playtest-01-full-run.json` and summary to `/tmp/playtest-01-full-run-summary.md`
