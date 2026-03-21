# Scenario 09: Domain & Archetype Matrix

## Goal
Test multiple domain × archetype combinations to verify all combos start correctly and produce valid combat states.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Test 3 Combinations
Test these pairs (or first available if exact IDs don't match):

#### Combo 1: animals_wildlife + aggressive
1. Navigate to URL, wait 4s
2. Click `btn-start-run`, select domain `animals_wildlife`, archetype `aggressive`
3. Verify combat starts: check enemy exists, hand has cards
4. Play 1 card correctly, end turn
5. Note: enemy name, hand composition
6. Retreat or navigate back to hub

#### Combo 2: history + defensive
7. Start new run with `history` domain, `defensive` archetype
8. Verify combat starts
9. Play 1 card, note state
10. Navigate back to hub

#### Combo 3: space_astronomy + control
11. Start new run with `space_astronomy` domain, `control` archetype
12. Verify combat starts
13. Take **Screenshot #1 (combat-combo3)**
14. Note state

### Cross-Combo Checks
15. For each combo, record:
    - Domain selected → quiz questions match domain topic?
    - Archetype selected → card types in hand weighted toward archetype?
    - Enemy generated is valid (has name, HP)

## Checks
- All 3 domain selections work
- All 3 archetype selections work
- Combat starts correctly for each combo
- Quiz questions are relevant to selected domain
- Enemy stats are valid (HP > 0)
- No errors during domain/archetype selection

## Report
Write JSON to `/tmp/playtest-09-domain-matrix.json` and summary to `/tmp/playtest-09-domain-matrix-summary.md`
