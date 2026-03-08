# Save/Resume Integrity Run 07 (Post Tutorial)

- Date: 2026-03-07
- Run type: save/resume integrity
- Scenario: `post_tutorial` preset -> perform actions -> reload without preset
- Playthrough count: exactly 1 run

## Actions Performed

1. Loaded `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`.
2. Opened DEV panel.
3. Clicked `+500 Dust`.
4. Clicked `+3 O2 Tanks`.
5. Clicked `10 Dives Done`.
6. Reloaded with `http://localhost:5173?skipOnboarding=true` (no preset).

## Persistence Validation (>= 3 fields required)

- `minerals.dust`: `180 -> 680`, persisted after reload (`680`).
- `oxygen`: `3 -> 6`, persisted after reload (`6`).
- `stats.totalDivesCompleted`: `1 -> 10`, persisted after reload (`10`).

Result: **3 persisted deltas validated**.

## Save Key / Profile Namespace Check

- Active profile id: `null`
- Profile count: `0`
- Active save key: `terra_save`
- Save-related keys observed: `terra_save`
- Namespace anomalies: none detected

## Verdict

**PASS**
