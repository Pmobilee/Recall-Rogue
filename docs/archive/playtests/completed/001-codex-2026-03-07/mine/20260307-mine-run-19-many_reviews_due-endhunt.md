# Mine Long-Form Playthrough 19 - many_reviews_due (endhunt)

- Date: 2026-03-07
- Run type: mine long-form
- Scenario: `devpreset=many_reviews_due`
- Constraint: up to 240 key presses
- Result: partial (blocked before mine dive)

## Execution Summary

- URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
- Total key presses used: **53**
- Outcome: **partial-blocked-or-timebox**
- Block reason: no screen transition for 41 consecutive inputs on `studySession`
- Dive end reached: **No**
- `diveResults` availability observed: **No**

## Screen Transitions

1. `null` -> `cutscene` (initial load)
2. `cutscene` -> `onboarding` (after key 4: `Enter`)
3. `onboarding` -> `studySession` (after key 12: `Enter`)

No further transitions occurred through key 53.

## Dive Results Availability Tracking

- Runtime check used each step:
  - `__terraDebug().currentScreen`
  - deep scan of `__terraDebug().stores` for non-null `diveResults` fields
  - screen-name regex for results-like states
- Observation: never entered a dive/results state and no non-null `diveResults` path was detected.

## State Desync Check

- Compared on each sample:
  - `__terraDebug().currentScreen`
  - `__terraDebug().stores.currentScreen`
  - `globalThis[Symbol.for('terra:currentScreen')]?.get?.()`
- Desync events detected: **0**
- Final state:
  - debug screen: `studySession`
  - store screen: `studySession`
  - symbol screen: `null`

## Final UI Snapshot (at block)

- Visible buttons on `studySession`:
  - `5 Quick review` (disabled)
  - `10 Standard session` (disabled)
  - `20 Deep session` (disabled)
  - `Return to Base` (enabled)
  - `DEV` (enabled)

## Notes

- This run stayed within the keypress budget and remained a single playthrough session.
- Because session options were disabled on `studySession`, progression to mine/dive flow was blocked, so dive end could not be reached in this run.
