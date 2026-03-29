# Scenario 04: Special Rooms (Shop, Rest, Mystery)

## Goal
Test all special room types: shop (buy relic/card), rest room (heal/upgrade), and mystery event (resolve).

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`

### Shop Room
3. Load shop: `window.__rrScenario.load('shop-loaded')`
4. Wait 500ms, take **Screenshot #1 (shop-room)**
5. Check shop UI: relic items displayed with prices? Buy buttons visible?
6. Click a buy button if affordable

### Rest Room
7. Load rest: `window.__rrScenario.load('rest-site')`
8. Wait 500ms, take **Screenshot #2 (rest-room)**
9. Check: heal button visible? Study button visible?

### Mystery Event
10. Load mystery: `window.__rrScenario.load('mystery-healing-fountain')`
11. Wait 500ms, take **Screenshot #3 (mystery-event)**
12. Check: event name "The Healing Fountain"? Continue button visible?
13. Click continue, verify screen transitions

### End
14. Run filtered console check
15. Take **Screenshot #4 (final)**

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol.

### Scenario-Specific Evaluation Questions

**Shop Room (#1):**
- Run element discovery. List ALL shop items found (relics and cards) with names and prices.
- For each shop item: is the name readable? Is the price visible and correctly formatted (number + gold icon)?
- Can you tell which items you can afford vs which are too expensive?
- Is the "Leave Shop" button clearly visible and not easy to accidentally press?
- Are relic descriptions useful enough to make an informed purchase decision?
- Does the shop feel like a meaningful strategic stop or a boring detour?
- Is card removal option discoverable?

**Rest Room (#2):**
- Run discovery. What options are available (heal, study/upgrade)?
- Does the heal option clearly show how much HP you'll recover?
- Does the upgrade/study option clearly explain what you gain?
- Is the trade-off between healing and upgrading clear?
- Does the rest room feel like a welcome respite from combat?
- Is the room background loaded and atmospheric?

**Mystery Event (#3):**
- Run discovery. What is the event title? What choices are presented?
- Is the narrative text readable and atmospheric?
- Do the choices present a genuine decision (not one obvious best option)?
- Is the outcome text clear about what you gained or lost?
- Does the event image load and match the narrative?
- Does the mystery event feel exciting and unpredictable?

**Final (#4):**
- Run discovery on whatever screen is showing.
- Across all 3 room types: did the visual style feel consistent?
- Were transitions between rooms smooth?
- Did any room type feel more polished than the others?

## Checks
- Shop displays items with prices
- Rest room shows heal and upgrade options
- Mystery event shows text and continue button
- No "undefined" or empty text in any overlay
- Button clicks produce expected state changes
- No JS errors

## Report
Write JSON to `/tmp/playtest-04-special-rooms.json` and summary to `/tmp/playtest-04-special-rooms-summary.md`
