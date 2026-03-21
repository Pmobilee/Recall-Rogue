# Scenario 04: Special Rooms (Shop, Rest, Mystery)

## Goal
Test all special room types: shop (buy relic/card), rest room (heal/upgrade), and mystery event (resolve).

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`

### Shop Room
3. Load shop: `window.__terraScenario.load('shop-loaded')`
4. Wait 500ms, take **Screenshot #1 (shop-room)**
5. Check shop UI: relic items displayed with prices? Buy buttons visible?
6. Click a buy button if affordable

### Rest Room
7. Load rest: `window.__terraScenario.load('rest-site')`
8. Wait 500ms, take **Screenshot #2 (rest-room)**
9. Check: heal button visible? Study button visible?

### Mystery Event
10. Load mystery: `window.__terraScenario.load('mystery-healing-fountain')`
11. Wait 500ms, take **Screenshot #3 (mystery-event)**
12. Check: event name "The Healing Fountain"? Continue button visible?
13. Click continue, verify screen transitions

### End
14. Run filtered console check
15. Take **Screenshot #4 (final)**

## Checks
- Shop displays items with prices
- Rest room shows heal and upgrade options
- Mystery event shows text and continue button
- No "undefined" or empty text in any overlay
- Button clicks produce expected state changes
- No JS errors

## Report
Write JSON to `/tmp/playtest-04-special-rooms.json` and summary to `/tmp/playtest-04-special-rooms-summary.md`
