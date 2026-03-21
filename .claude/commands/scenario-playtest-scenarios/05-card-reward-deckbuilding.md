# Scenario 05: Card Reward & Deck Building

## Goal
Test card reward selection after combat: verify reward options display card types, selection works, and deck grows.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`, wait 4s
2. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
3. Load card reward: `window.__terraScenario.load('card-reward-attacks')`
4. Wait 500ms, take **Screenshot #1 (reward-options)**

### Reward Selection
4. Read DOM: find all `[data-testid^="reward-type-"]` buttons
5. CHECK: at least 2 reward type options visible
6. CHECK: each option has text label (card type name)
7. Click first reward type option, wait 0.5s
8. CHECK: a card preview appears or selection is highlighted
9. Click `[data-testid="reward-accept"]`, wait 1s
10. Take **Screenshot #2 (reward-accepted)**
11. Verify screen transitioned (roomSelection or combat)

### Second Reward (if reachable)
12. Load alternate reward: `window.__terraScenario.load('card-reward-mixed')`
13. Wait 500ms, test selecting a DIFFERENT reward type
14. Accept it

### Verify Deck Growth
15. Read run state — check deck size increased by number of rewards accepted

## Checks
- Reward screen shows 2+ card type options
- Each option has readable text
- Clicking a type selects it
- Accept button works and transitions screen
- Deck size increases after accepting
- No "undefined" text in reward cards

## Report
Write JSON to `/tmp/playtest-05-card-reward.json` and summary to `/tmp/playtest-05-card-reward-summary.md`
