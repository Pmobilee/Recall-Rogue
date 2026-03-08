# Playtest Report: High-Backlog Throttle Experience

## Session Narrative
I seeded a high-backlog save (`30` due reviews + `10` new) and measured new-card intake in a 20-card session. Under backlog pressure, the session showed `0` new cards with adaptive limit computed at `2`.

After clearing backlog state and advancing one day, adaptive limit rose to `3` and the next session surfaced `3` new cards. So the throttle gate and recovery path behaved as expected, but user-facing explanation remained unclear.

## Key Observations
- Throttle suppression under heavy due load worked.
- Recovery after backlog relief worked.
- UX still does not clearly explain why new cards disappear.

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Due before | 30 | High backlog | PASS |
| Adaptive limit before | 2 | 2 at high backlog | PASS |
| New cards before | 0 | 0-2 | PASS |
| Due after | 10 | Reduced backlog | PASS |
| Adaptive limit after | 3 | 3-5 range | PASS |
| New cards after | 3 | 3-5 | PASS |

## Emotional Arc
- Start: suspicious
- Mid: system seems strict
- End: confident in mechanics, still wanting explanation

## Issues Found
### UX gap: Throttle reason not clearly communicated
- Severity: medium
- Description: Mechanic works but player-facing reason is not obvious.
- Expected: Explicit message when new cards are suppressed by backlog.
- Suggested fix: Add study-session banner/tool-tip with due-count + current adaptive cap.

## Verdict
**PASS** on mechanics, with a UX clarity deficiency.
