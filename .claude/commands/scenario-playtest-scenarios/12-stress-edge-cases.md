# Scenario 12: Stress & Edge Cases

## Goal
Test edge cases: low HP combat, extended combo chains, rapid card play, and unusual game states.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Test 1: Extended Combo Chain
1. Navigate to URL, wait 4s
2. Start a run
3. In combat, answer 5+ consecutive quizzes CORRECTLY
4. After each correct answer, read combo multiplier via state
5. Record: [1.0, 1.15, 1.3, 1.5, 2.0, ...] — verify progression
6. CHECK: combo increases per consecutive correct answer
7. Take **Screenshot #1 (max-combo)**

### Test 2: Combo Reset on Wrong
8. After building combo, answer next quiz WRONG
9. Read combo — CHECK: reset to 1.0x
10. Answer correctly again — CHECK: combo starts climbing from 1.0x

### Test 3: All Cards Played
11. In a combat turn, play ALL available cards (hand-0 through hand-4)
12. After playing all, CHECK: end turn is the only option
13. End turn, verify new hand is drawn

### Test 4: Rapid Actions
14. Click 3 cards rapidly (500ms gaps) — do they queue correctly?
15. CHECK: no duplicate quiz overlays, no frozen state

### Test 5: Low HP Survival
16. Play until player HP is low (< 20% max HP)
17. Take **Screenshot #2 (low-hp)**
18. CHECK: HP bar shows correct low value
19. CHECK: game remains responsive at low HP

### Test 6: Defeat
20. If player reaches 0 HP, verify run end screen appears
21. Take **Screenshot #3 (defeat)**
22. CHECK: defeat is handled gracefully (not a crash)
23. CHECK: can return to hub after defeat

## Checks
- Combo progression: 1.0 → 1.15 → 1.3 → 1.5 → 2.0
- Combo resets on wrong answer
- All 5 cards can be played in one turn
- New hand drawn after end turn
- Low HP doesn't break UI
- Defeat transitions to run end, not crash
- Rapid clicks don't cause frozen state

## Report
Write JSON to `/tmp/playtest-12-edge-cases.json` and summary to `/tmp/playtest-12-edge-cases-summary.md`
