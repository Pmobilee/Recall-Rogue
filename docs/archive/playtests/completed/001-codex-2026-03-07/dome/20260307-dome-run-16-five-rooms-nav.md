# Dome Floor Navigation Check - Run 16 (five_rooms)

- Run ID: `20260307-dome-run-16-five-rooms-nav`
- Run type: `dome floor navigation check`
- Scenario preset: `five_rooms`
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=five_rooms`
- Timestamp: `2026-03-07T14:11:36.598Z`
- Result: `COMPLETED`

## Entry Flow

- `cutscene` -> `onboarding` -> `studySession` -> `base`
- Navigation checks executed from `base` using DEV panel `Navigation` controls (2 repeated passes)

## Repeated Navigation Attempts and Observed Screen States

Pass pattern was consistent in both passes:

1. `Quick Dive (with O2)`: `base|premiumMaterializer` -> `mining`
2. `Mine`: `mining` -> `mining` (no state change)
3. `Study`: `mining` -> `studySession`
4. `Materializer`: `studySession` -> `materializer`
5. `Farm`: `materializer` -> `farm`
6. `Zoo`: `farm` -> `zoo`
7. `Knowledge Tree`: `zoo` -> `knowledgeTree`
8. `Streak Panel`: `knowledgeTree` -> `streakPanel`
9. `Cosmetics`: `streakPanel` -> `cosmeticsShop`
10. `Prem. Workshop`: `cosmeticsShop` -> `premiumMaterializer`
11. `Base`: control not found after `Quick Dive` (both passes)

- Total nav attempts: `22`
- Found/clicked controls: `20`
- State transitions observed: `18`
- Dead-end transitions observed: `2`
- Final screen: `premiumMaterializer`

## Nav Dead-Ends

- `Mine` is a dead-end while already on `mining` (`mining -> mining` in both passes)
- `Base` control is unavailable/not found after entering `mining` via `Quick Dive`, blocking direct return to `base` from this nav sequence

## Hidden Controls

- `Navigation` section toggle (`▶ Navigation`) is rendered off-viewport at 1280x720:
  - Rect: `x=961, y=910, w=319, h=44`
  - Visible in DOM but not reachable in viewport without non-standard interaction
- All room nav buttons used in this check were positioned below viewport (`y >= 960`), indicating hidden/offscreen controls at this viewport

## Runtime Diagnostics

- Console/network issues observed during run:
  - `500 http://localhost:3001/api/facts/packs/all`
  - `404 http://localhost:5173/api/facts/delta?since=0&limit=500`
  - `400 http://localhost:3001/api/analytics/events`

## Notes

- This run completed as a single playthrough navigation check.
- No code edits were made.
