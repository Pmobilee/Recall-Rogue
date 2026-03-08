# Mine Long-Form Playthrough - Run 14 (`devpreset=many_reviews_due`)

- Timestamp: 2026-03-07T12:56:28.683Z
- Run type: mine long-form
- Scenario: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
- Status: complete
- Key presses sent: 200 (cap reached)

## Required Outcomes

- Quiz interactions attempted: 2
- Deliberate wrong answer included: yes (Quiz 1)
- Final screen: `sacrifice`

## Metrics

- O2 start: 100
- O2 end: 0
- O2 delta: -100
- Blocks mined start: 0
- Blocks mined end: 39
- Blocks mined delta: +39
- Quiz correct start/end/delta: 200 -> 201 (**+1**)
- Quiz wrong start/end/delta: 25 -> 26 (**+1**)

## Quiz Interaction Log

1. Quiz 1 (`source=gate`, `factId=cult-009`)
   - Correct index: 1
   - Selected index: 0
   - Result: deliberate wrong
2. Quiz 2 (`source=gate`, `factId=cult-001`)
   - Correct index: 0
   - Selected index: 0
   - Result: correct

## Errors

- Console errors: 5
- Page errors: 1
- Failed requests: 1

Observed error samples:
- `WebSocket connection to 'ws://100.74.153.81:5173/?token=...' failed: net::ERR_CONNECTION_REFUSED`
- `[vite] failed to connect to websocket (WebSocket closed without opened.)`
- `Failed to load resource: 500 (Internal Server Error)`
- `Failed to load resource: 404 (Not Found)`
- `Failed to load resource: 400 (Bad Request)`
- `GET /api/facts/delta?since=0&limit=500 :: net::ERR_ABORTED`
