# Scenario 03: Combat Deep Dive

> **IMPORTANT: Use `window.__rrScenario.load('combat-basic')` to instantly enter combat. Do NOT navigate through hub → dungeon → map → node manually. Other scenarios: 'combat-boss', 'combat-10-cards', 'combat-scholar', 'combat-elite'. Always call `document.documentElement.setAttribute('data-pw-animations', 'disabled')` before screenshots.**

## Goal
Play 3 full combat encounters testing card play mechanics, quiz answers (correct + wrong), damage numbers, combo counter, and turn flow.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load combat scenario: `window.__rrScenario.load('combat-basic')`
4. Wait 500ms, take **Screenshot #1 (combat-start)**

### Encounter 1: Basic combat
(use combat-basic — already loaded)

### Encounter 2: Elite combat
After encounter 1, reload: `window.__rrScenario.load('combat-elite')`

### Encounter 3: Boss combat
`window.__rrScenario.load('combat-boss')`

### For Each Encounter (repeat 3 times):

#### Phase A: Observe Initial State
4. Read compact state (HP, enemy, hand, combo, turn)
5. CHECK: player HP > 0, enemy HP > 0, hand size 1-5, combo = 1.0

#### Phase B: Play Cards (2-3 per turn)
6. Click `card-hand-0`, wait 1s — quiz should appear
7. Read quiz: question + 3 choices
8. CHECK: question not empty, 3 unique non-empty choices, no "undefined"/"null"
9. Answer CORRECTLY: click `quiz-answer-{correctIndex}` (use `window.__rrPlay.getQuiz().correctIndex` if available, otherwise click `quiz-answer-0`)
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

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol. Combat is the most element-dense screen — be thorough.

### Scenario-Specific Evaluation Questions

**Combat Start (#1) — Run for EACH of the 3 encounters:**
- Run element discovery. Record total element counts per encounter type (basic vs elite vs boss).
- Enemy sprite: does the elite look more threatening than the basic? Does the boss look distinct from both?
- Enemy HP: does the boss have visibly more HP? Is the HP bar scaling appropriate?
- Cards in hand: are all cards readable? Do card types (attack/shield/special) look visually distinct?
- AP orb: is current AP clearly visible? Does it update instantly when you play a card?
- Intent bubble: what does the enemy intend? Is the intent icon + number readable?
- Relic tray (boss fight): are relics visible? Are their icons distinguishable at display size?

**Mid-Combat (#2):**
- After playing cards and taking damage: do damage numbers float up visually?
- Is the combo counter visible? Does it escalate visually as combo grows?
- After a wrong answer: does the combo reset feel clear?
- Is the card hand updated after playing cards (fewer cards showing)?
- Are status effects (if any) showing with stack counts and turns remaining?
- Does mid-combat feel tense and strategic, or chaotic and confusing?

**Final State (#3):**
- Run discovery on whatever screen is active (reward, map, run end).
- If reward screen: are options clearly presented? Can you evaluate choices?
- If combat continues: is the HP bar accurately reflecting damage taken?
- Overall across 3 encounters: did anything feel broken, unfair, or unclear?
- Which encounter was most fun? Why? Which was least fun? Why?

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
