# Mine Playthrough Report - Run 02 (many_reviews_due)

- Timestamp: 2026-03-07T12:12:16.297Z
- Scenario preset: `many_reviews_due`
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
- Status: partial
- Long-form target: yes
- Key presses sent: 266

## Metrics

- Start O2: 3 (playerSave.oxygen)
- End O2: 57 (oxygenCurrent store)
- Blocks mined delta: 0
- Quiz count: 0 (encounters observed: 0)
- Correct delta: 0
- Wrong delta: 0
- Console error count: 6

## Abnormalities

- [medium] Run capped at 180s safety timeout
- [high] Console/runtime errors observed (6)
- [medium] No block progress recorded despite active mining inputs

## Notes

- [medium] Preset landed on non-base gate screen; forced currentScreen to base
- [medium] Dive button path unavailable; forced currentScreen to divePrepScreen

## Error Snippets

- WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
- [vite] failed to connect to websocket (Error: WebSocket closed without opened.). 
- Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- Failed to load resource: the server responded with a status of 404 (Not Found)
- Failed to load resource: the server responded with a status of 400 (Bad Request)
- Error: WebSocket closed without opened.