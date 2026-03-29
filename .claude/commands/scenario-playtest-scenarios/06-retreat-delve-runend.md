# Scenario 06: Retreat, Delve & Run End

## Goal
Test the segment checkpoint (retreat vs delve) and run end screens.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Path A: Test Retreat
1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load retreat/delve checkpoint: `window.__rrScenario.load('retreat-or-delve')`
4. Wait 500ms, take **Screenshot #1 (checkpoint)**
5. CHECK: retreat button visible, delve button visible
6. CHECK: currency amount displayed, HP displayed, death penalty shown
7. Click `[data-testid="btn-retreat"]`, wait 2s
8. Verify screen = `runEnd`
9. Take **Screenshot #2 (run-end)**

### Run End Screen (Victory — direct load)
To also test the victory run end screen directly:
`window.__rrScenario.load('run-end-victory')`
Wait 500ms, take **Screenshot #2b (run-end-victory)**.

Or to test defeat:
`window.__rrScenario.load('run-end-defeat')`

### Run End Screen
10. CHECK: currency earned displayed
11. CHECK: play-again button visible (`btn-play-again`)
12. CHECK: home button visible (`btn-home`)
13. Click `[data-testid="btn-home"]`, wait 2s
14. Verify screen = `hub`

### Path B: Test Delve (separate run)
15. Load retreat/delve checkpoint again: `window.__rrScenario.load('retreat-or-delve')`
16. Wait 500ms, click `[data-testid="btn-delve"]`, wait 2s
17. Verify screen = `combat` or `roomSelection` (next segment started)
18. Take **Screenshot #3 (post-delve)**

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol.

### Scenario-Specific Evaluation Questions

**Checkpoint (#1):**
- Run element discovery. What elements are on the retreat/delve screen?
- Is the retreat button visually distinct from the delve button?
- Does retreat feel like a valid strategic choice, not a "give up" button?
- Does delve feel exciting and risky?
- Is the risk/reward info clear: what do you keep if you retreat? What might you gain by delving?
- Is current gold displayed? Current HP? Floor number?
- Does this screen create genuine tension about the decision?

**Run End (#2 / #2b):**
- Run discovery. List ALL stats shown on the run end screen.
- Are all stat values valid numbers (not NaN/undefined)?
- Is the result title correct (Victory/Defeat/Retreat)?
- Does victory feel celebratory? Does defeat feel like a learning moment, not punishment?
- Is "Play Again" the most prominent button (encouraging replay)?
- Is the Share button discoverable but not pushy?
- Is the Home button available but secondary?
- Does the overall presentation make you want to screenshot and share your results?
- Are bounties (if cleared) displayed with appropriate fanfare?

**Post-Delve (#3):**
- After delving: did the next segment start correctly?
- Is it clear you're now on a deeper floor?
- Does the transition feel like entering unknown territory?

## Checks
- Checkpoint shows retreat and delve buttons
- Currency and HP values are numbers
- Retreat transitions to runEnd
- Run end shows results and navigation buttons
- Delve transitions to next combat segment
- Home button returns to hub

## Report
Write JSON to `/tmp/playtest-06-retreat-delve.json` and summary to `/tmp/playtest-06-retreat-delve-summary.md`
