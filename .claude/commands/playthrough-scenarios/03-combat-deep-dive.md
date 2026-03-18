# Scenario 03: Combat Deep Dive

> **IMPORTANT: Use `window.__terraScenario.load('combat-basic')` to instantly enter combat. Do NOT navigate through hub → dungeon → map → node manually. Other scenarios: 'combat-boss', 'combat-10-cards', 'combat-scholar', 'combat-elite'. Always call `document.documentElement.setAttribute('data-pw-animations', 'disabled')` before screenshots.**

## Goal
Play 3 full combat encounters testing card play mechanics, quiz answers (correct + wrong), damage numbers, combo counter, and turn flow.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to URL, wait 4s
2. Start a run: click `btn-start-run` → first domain card → first archetype button
3. Wait for screen = `combat`, take **Screenshot #1 (combat-start)**

### For Each Encounter (repeat 3 times):

#### Phase A: Observe Initial State
4. Read compact state (HP, enemy, hand, combo, turn)
5. CHECK: player HP > 0, enemy HP > 0, hand size 1-5, combo = 1.0

#### Phase B: Play Cards (2-3 per turn)
6. Click `card-hand-0`, wait 1s — quiz should appear
7. Read quiz: question + 3 choices
8. CHECK: question not empty, 3 unique non-empty choices, no "undefined"/"null"
9. Answer CORRECTLY: click `quiz-answer-{correctIndex}` (use `window.__terraPlay.getQuiz().correctIndex` if available, otherwise click `quiz-answer-0`)
10. Wait 2s, read state — CHECK: enemy HP decreased or card effect applied
11. Record: { question, answered, correct, hpBefore, hpAfter, combo }

12. Click `card-hand-1`, wait 1s — another quiz
13. Answer WRONG deliberately: click a different answer than correct
14. Wait 2s — CHECK: combo reset to 1.0x (if it was > 1)

15. If more cards available, play `card-hand-2` correctly
16. Take **Screenshot #2 (mid-combat)** after first encounter's card plays

#### Phase C: End Turn
17. Click `btn-end-turn`, wait 2.5s
18. Read state — CHECK: turn number incremented, enemy may have attacked (player HP changed)
19. If enemy HP <= 0: encounter won, proceed to rewards
20. If player HP <= 0: run ended, skip to run end
21. Otherwise: repeat Phase B for next turn (max 5 turns per encounter)

#### Phase D: Post-Encounter
22. Handle screen transition:
    - `cardReward`: select first reward type, accept, wait 1s
    - `roomSelection`: click `room-choice-0`, wait 1.5s
    - `retreatOrDelve`: click `btn-retreat` (after encounter 3)

### After 3 Encounters (or run end)
23. Take **Screenshot #3 (final-state)**
24. Run filtered console check
25. Compile combat log with all quiz data

## Checks
- Cards can be selected and quiz appears
- Correct answers deal damage (enemy HP decreases)
- Wrong answers do NOT deal damage (or reduced damage)
- Combo counter increments on consecutive correct answers
- Combo resets on wrong answers
- End turn causes enemy to attack (player HP may decrease)
- Turn number increments each turn
- No JS errors during combat

## Report
Write JSON to `/tmp/playtest-03-combat.json` and summary to `/tmp/playtest-03-combat-summary.md`
