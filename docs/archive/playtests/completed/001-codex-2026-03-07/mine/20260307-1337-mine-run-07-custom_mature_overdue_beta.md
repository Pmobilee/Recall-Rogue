# Mine Playthrough Report - Run 07 (custom_mature_overdue_beta)

- Timestamp: 2026-03-07T12:37:03.960Z
- Scenario preset: `many_reviews_due`
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
- Status: complete
- Long-form target: yes
- Key presses sent: 81

## Metrics

- Start O2: 0 (oxygenCurrent store)
- End O2: 63 (oxygenCurrent store)
- Blocks mined delta: 0
- Quiz count: 0 (quiz overlays seen: 47)
- Correct delta: 0
- Wrong delta: 0
- Console error count: 6

## Abnormalities

- [high] Console/runtime errors observed (6)
- [medium] Blocks mined delta stayed zero despite mining inputs
- [medium] Long-form target not met before timeout/exit
- [low] Intentional wrong answer attempt not reflected in wrong delta

## Notes

- [info] Injected custom mature overdue cards
- [medium] Forced divePrepScreen due to missing dive entry path