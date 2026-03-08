# Mine Playthrough Report - Run 17 (mid_dive_active-long)

- Timestamp (start): 2026-03-07T13:03:50.933Z
- Timestamp (end): 2026-03-07T13:04:26.565Z
- Scenario preset: `mid_dive_active`
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=mid_dive_active`
- Status: partial (blocked on telemetry visibility)
- Key actions sent: 140

## Hazard Effects and O2 Drain

- Hazard effects observed: none detected during this run
- O2 drain pattern: could not be measured (no readable HUD O2 element or debug O2 value exposed in this run)
- O2 samples captured at actions 1/10/.../140: all `null` (no accessible value)

## Quiz Encounters and Outcomes

- Quiz overlays encountered: 0 detected
- Quiz responses made: 0
- Correct outcomes: 0 observed
- Incorrect outcomes: 0 observed

## Blocking Notes

- The run completed with 140 key actions, but runtime telemetry hooks and HUD selectors used for observation returned no usable values.
- This report is therefore partial: movement input was executed, but hazard/O2/quiz state could not be confirmed from accessible headless runtime signals.
