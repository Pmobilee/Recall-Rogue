# Onboarding Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 20260307-123837-first-boot.md | first boot | FAIL |
| 20260307-1311-onboarding-run-07-first-boot-adult-path.md | first boot adult path | FAIL |
| 20260307-1312-onboarding-run-08-first-boot-teen-path.md | first boot teen path | FAIL |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- **Failure mode**: after 10 progression attempts, flow still on cutscene with disabled submit action.
  - Runs: 20260307-123837-first-boot

- **Onboarding progression**: FAIL (stuck on cutscene flow)
  - Runs: 20260307-123837-first-boot

- **Overall**: FAIL (blocked before base transition)
  - Runs: 20260307-123837-first-boot

- **Transition to base**: FAIL (`currentScreen` remained `cutscene`)
  - Runs: 20260307-123837-first-boot

- FAIL (blocked; partial report with screenshot and raw log evidence).
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path

### MEDIUM

- None

### LOW

- None

### INFO

- **Age gate**: PASS (`18+` option clicked; `terra_age_bracket=adult` observed)
  - Runs: 20260307-123837-first-boot

- **Blocked control**: `Start Exploring` button present but `disabled=true` through all observed onboarding steps.
  - Runs: 20260307-123837-first-boot

- **Observed interactive controls**: icon category buttons (`⛏`, `🪨`, `💎`, `🦕`, `🌋`, `🔭`, `🧬`, `🌿`) and `← Back`; none transitioned flow to base.
  - Runs: 20260307-123837-first-boot

- Age gate is reachable and clickable; adult path selection persists in localStorage.
  - Runs: 20260307-123837-first-boot

- Console shows environment/API issues (Vite HMR websocket + CORS to `127.0.0.1:3001`) that may impact data-dependent onboarding steps.
  - Runs: 20260307-123837-first-boot

- High: Onboarding progression blocked (`Start Exploring` not actionable).
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path

- High: Onboarding progression blocked for teen path as well.
  - Runs: 20260307-1312-onboarding-run-08-first-boot-teen-path

- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path

- No actionable primary progression button appears; repeated attempts to advance do not change state.
  - Runs: 20260307-123837-first-boot

- Post-age-gate onboarding shows a disabled `Start Exploring` button and never enables it during the run.
  - Runs: 20260307-123837-first-boot

- Runtime remained on `currentScreen: cutscene`; no base/hub/dome screen reached.
  - Runs: 20260307-123837-first-boot

## Metrics and State Trends

- age bracket in save | n/a | n/a | n/a
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path
- bestStreak | 0 | n/a | n/a
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path
- currentScreen | base | n/a | n/a
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path
- currentScreen | cutscene | n/a | n/a
  - Runs: 20260307-1312-onboarding-run-08-first-boot-teen-path
- currentStreak | 0 | n/a | n/a
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path
- Metric | Before | After | Delta
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path

## Unique Notes / Gaps

- **Console errors**: 7
  - Runs: 20260307-123837-first-boot
- **Failed network requests**:
  - Runs: 20260307-123837-first-boot
- **Notable console messages**:
  - Runs: 20260307-123837-first-boot
- **Page errors**: 1 (`WebSocket closed without opened.`)
  - Runs: 20260307-123837-first-boot
- `http://127.0.0.1:3001/api/analytics/events`
  - Runs: 20260307-123837-first-boot
- `http://127.0.0.1:3001/api/facts/packs/all`
  - Runs: 20260307-123837-first-boot
- `http://127.0.0.1:5173/api/facts/delta?since=0&limit=500`
  - Runs: 20260307-123837-first-boot
- Adult selector was attempted; next step blocked on `Start Exploring` click timeout.
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path
- CORS blocked requests to API on port 3001
  - Runs: 20260307-123837-first-boot
- Full machine-readable run log: `/tmp/first-boot-playthrough.json`
  - Runs: 20260307-123837-first-boot
- Snapshots captured during run (including blocked state):
  - Runs: 20260307-123837-first-boot
- Step trail: `not_found` then blocked timeout on progression button.
  - Runs: 20260307-1311-onboarding-run-07-first-boot-adult-path, 20260307-1312-onboarding-run-08-first-boot-teen-path
- Teen selector was attempted; progression blocked on `Start Exploring` click timeout.
  - Runs: 20260307-1312-onboarding-run-08-first-boot-teen-path
- Vite websocket refused (`ws://100.74.153.81:5173/...`)
  - Runs: 20260307-123837-first-boot

## Source Files

- onboarding/20260307-123837-first-boot.md
- onboarding/20260307-1311-onboarding-run-07-first-boot-adult-path.md
- onboarding/20260307-1312-onboarding-run-08-first-boot-teen-path.md
