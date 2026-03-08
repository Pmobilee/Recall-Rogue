# Mine Long-Form Playthrough — Run 13 (`devpreset=quiz_due`)

- Date: 2026-03-07
- Run mode: single run (no batching)
- Scenario: `/?skipOnboarding=true&devpreset=quiz_due`
- Entry path: DEV panel -> Navigation -> `Quick Dive (with O2)`
- Status: **PARTIAL (BLOCKED)**

## Required Metrics

- Start O2: **100**
- End O2: **47**
- Blocks mined (start): **0**
- Blocks mined (end): **29**
- Blocks mined delta: **+29**
- Quiz count encountered: **1**
- Console error count: **5**

## Keypress Execution

- Target key presses: 180
- Executed key presses before block: 76
- Dive ended early: No
- Final screen: `quiz`

## Quiz Requirement Outcome

- Requirement: intentionally answer one wrong and one correct if encountered
- Observed: only one quiz encounter during this run
- Outcome: blocked at first quiz state; wrong/correct pair could not both be completed in this single run

## Evidence

- Start state evidence: `Start screen=mining O2=100 blocks=0`
- End state evidence: `End screen=quiz O2=47 blocks=29`
- Block reason: `Quiz encountered (1) but required wrong/correct pair not both submitted`
- Runtime diagnostics observed during run:
  - `WebSocket connection to 'ws://100.74.153.81:5173/?token=...' failed: net::ERR_CONNECTION_REFUSED`
  - `[vite] failed to connect to websocket (WebSocket closed without opened.)`
  - `Failed to load resource: 500 (Internal Server Error)`
  - `Failed to load resource: 404 (Not Found)`
  - `Failed to load resource: 400 (Bad Request)`
