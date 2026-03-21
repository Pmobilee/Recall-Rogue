# Shared Playtest Protocol

This document is included in every playtest worker's prompt. It contains the universal rules, selectors, helpers, and report format.

---

## Selector Lookup Table

| Action | Selector | Wait After |
|--------|----------|------------|
| Start run | `[data-testid="btn-start-run"]` | 2s |
| Select domain | `[data-testid="domain-card-{id}"]` | 1s |
| Select archetype | `[data-testid="archetype-{id}"]` | 2s |
| Select card in hand | `[data-testid="card-hand-{n}"]` | 1s |
| Answer quiz | `[data-testid="quiz-answer-{n}"]` | 2s |
| End turn | `[data-testid="btn-end-turn"]` | 2s |
| Select room | `[data-testid="room-choice-{n}"]` | 1.5s |
| Accept reward | `[data-testid="reward-accept"]` | 1s |
| Select reward type | `[data-testid="reward-type-{type}"]` | 0.5s |
| Retreat (cash out) | `[data-testid="btn-retreat"]` | 2s |
| Delve deeper | `[data-testid="btn-delve"]` | 2s |
| Heal (rest room) | `[data-testid="rest-heal"]` | 1s |
| Upgrade (rest room) | `[data-testid="rest-upgrade"]` | 1s |
| Buy relic (shop) | `[data-testid="shop-buy-relic-{id}"]` | 1s |
| Buy card (shop) | `[data-testid="shop-buy-card-{n}"]` | 1s |
| Mystery continue | `[data-testid="mystery-continue"]` | 1s |
| Special event skip | `[data-testid="special-event-skip"]` | 1s |
| Mastery answer | `[data-testid="mastery-answer-{n}"]` | 1s |
| Play again | `[data-testid="btn-play-again"]` | 2s |
| Return to hub | `[data-testid="btn-home"]` | 2s |
| Share run | `[data-testid="btn-share-run"]` | 1s |

---

## Instant Scene Loading (PREFERRED)

Instead of clicking through hub -> domain -> archetype -> combat, use `__terraScenario` to instantly jump to any game state:

```javascript
// In browser_evaluate:
await window.__terraScenario.load('combat-basic');     // instant combat
await window.__terraScenario.load('combat-boss');      // boss encounter
await window.__terraScenario.load('shop-loaded');      // shop with 1000g
await window.__terraScenario.load('mystery-healing-fountain'); // specific mystery event
await window.__terraScenario.load('run-end-victory');  // victory screen
await window.__terraScenario.load('card-reward-attacks'); // card reward

// Custom config:
await window.__terraScenario.loadCustom({
  screen: 'combat',
  enemy: 'the_archivist',
  playerHp: 30,
  hand: ['heavy_strike', 'strike', 'block'],
  relics: ['whetstone', 'combo_ring'],
  floor: 8,
});
```

**ALWAYS disable animations before screenshots:**
```javascript
document.documentElement.setAttribute('data-pw-animations', 'disabled');
```

**Full preset list:** Call `window.__terraScenario.list()` or see `/visual-inspect` skill.

**Rule:** ALWAYS prefer `__terraScenario` over manual navigation. Manual clicks through menus are fragile and slow. Use manual navigation ONLY when testing the navigation flow itself (e.g., onboarding scenario).

---

## Screen Detection

Read the current screen via `browser_evaluate`:

```javascript
(() => {
  const s = globalThis[Symbol.for('terra:currentScreen')];
  if (!s) return 'unknown';
  let v; s.subscribe(x => { v = x })();
  return v;
})()
```

---

## Compact State Read (single evaluate call)

```javascript
(() => {
  const read = (key) => {
    const s = globalThis[Symbol.for(key)];
    if (!s) return null;
    let v; s.subscribe(x => { v = x })(); return v;
  };
  const save = read('terra:playerSave');
  const turn = read('terra:activeTurnState');
  const run = read('terra:activeRunState');
  return {
    screen: read('terra:currentScreen'),
    playerHp: turn?.playerHP,
    enemyHp: turn?.enemy?.health,
    enemyName: turn?.enemy?.name,
    handSize: turn?.deck?.hand?.length,
    combo: turn?.comboMultiplier,
    turnNum: turn?.turn,
    floor: run?.currentFloor,
    segment: run?.currentSegment,
    gold: run?.currency,
    factCount: save?.learnedFacts?.length,
  };
})()
```

---

## Filtered Console Check

Use this instead of raw console messages — filters out environment noise:

```javascript
(() => {
  const NOISE = [
    /WebSocket/i, /\[vite\]/i, /failed to load resource/i,
    /GPU stall/i, /net::ERR_/i, /CORS/i, /api\//i,
    /favicon/i, /service.worker/i, /hmr/i,
  ];
  const log = window.__terraLog;
  if (!Array.isArray(log)) return [];
  return log.filter(e => e.type === 'error' && !NOISE.some(p => p.test(e.detail))).slice(-10);
})()
```

---

## False Positives — NEVER Report These

| Pattern | Reason |
|---------|--------|
| WebSocket/HMR connection errors | No HMR server in test |
| API 404/500 errors | No backend server; app is offline-first |
| CORS errors | No API server deployed |
| GPU stall warnings | WebGL headless browser limitation |
| `net::ERR_CONNECTION_REFUSED` | No backend running |
| `favicon.ico` 404 | No favicon configured |
| Service worker warnings | Not relevant in test |

---

## Wait Time Standards

| After | Wait | Then Check |
|-------|------|------------|
| Page navigation | 4s | Screen store |
| Button click (screen transition) | 2s | Screen store |
| Quiz answer click | 2s | Quiz store is null |
| End turn | 2.5s | Turn state updated |
| Card tap | 1s | Quiz overlay appeared |
| Room selection | 1.5s | Screen changed |

**Rule**: After ANY click that should cause a screen transition, wait, then verify via screen store read. If wrong screen, retry click once. If still wrong, document and continue.

---

## Screenshot Rules

- **Max 8 screenshots per scenario** (use browser_take_screenshot)
- **Naming**: `/tmp/playtest-{scenario}-{checkpoint}.png`
- **Prefer browser_snapshot** (DOM text, cheap) over screenshots for state checks
- Take screenshots ONLY at designated checkpoints listed in each scenario

---

## Visual Check Checklist

**NOTE**: Screenshots are supplementary. Programmatic layout assertions (section below) are the PRIMARY layout check. Screenshots are for subjective quality (art, polish, readability).

After EVERY screenshot, evaluate ALL of these:

| # | Check | What to look for |
|---|-------|------------------|
| 1 | Sprites | Enemy sprite visible? Placeholder rectangles? Missing images? |
| 2 | Layout | Overflow, clipping, elements outside viewport? |
| 3 | Text | Readable? Truncated? Overlapping? "undefined"/"null"/"NaN"? |
| 4 | Colors | Readable contrast? Missing backgrounds? |
| 5 | Z-Order | Buttons hidden behind other elements? |
| 6 | Empty States | Expected content present? Unexpected "empty" messages? |
| 7 | Alignment | Proper alignment? Even spacing? |
| 8 | Mobile Fit | Everything fits 412x915 viewport? No horizontal scroll? |

---

## Programmatic Layout Assertions (MANDATORY)

After EVERY screen transition, run this check via `browser_evaluate` BEFORE taking screenshots. This catches layout bugs (off-screen buttons, clipped panels, invisible elements) that visual inspection misses.

```javascript
((selectors) => {
  const results = {};
  for (const [name, sel] of Object.entries(selectors)) {
    const el = document.querySelector(`[data-testid="${sel}"]`) || document.querySelector(sel);
    if (!el) { results[name] = { found: false }; continue; }
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const vh = window.innerHeight, vw = window.innerWidth;
    results[name] = {
      found: true,
      inViewport: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw,
      visible: s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0,
      clickable: s.pointerEvents !== 'none',
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) },
      clipped: r.bottom > vh ? 'below-viewport' : r.top < 0 ? 'above-viewport' : null,
      viewportHeight: vh,
    };
  }
  const fails = Object.entries(results).filter(([_, v]) => v.found && (!v.inViewport || !v.visible));
  return { allPassed: fails.length === 0, failures: fails.map(([k, v]) => ({ element: k, ...v })), results };
})(SELECTORS)
```

### Per-Screen Selector Maps

Pass these as the `SELECTORS` argument depending on the current screen:

| Screen | Selectors Object |
|--------|-----------------|
| `hub` | `{ startRun: 'btn-start-run' }` |
| `combat` | `{ card0: 'card-hand-0', endTurn: 'btn-end-turn' }` |
| `quizOverlay` | `{ answer0: 'quiz-answer-0', answer1: 'quiz-answer-1', answer2: 'quiz-answer-2' }` |
| `cardReward` | `{ accept: 'reward-accept' }` — also check all `[data-testid^="reward-type-"]` |
| `roomSelection` | `{ room0: 'room-choice-0', room1: 'room-choice-1', room2: 'room-choice-2' }` |
| `retreatOrDelve` | `{ retreat: 'btn-retreat', delve: 'btn-delve' }` |
| `runEnd` | `{ playAgain: 'btn-play-again', home: 'btn-home' }` |
| `restRoom` | `{ heal: 'rest-heal', upgrade: 'rest-upgrade' }` |
| `shopRoom` | `{ shopPanel: '.shop-panel' }` |

### Rules
- **MANDATORY**: Run layout assertions after EVERY screen transition, BEFORE screenshots
- If ANY interactive element is `found: true` but `inViewport: false` → log as **CONFIRMED-BUG**, severity **high**
- If an element is `found: false` when it should exist → log as **LIKELY-BUG**, severity **medium**
- Programmatic failures OVERRIDE visual impressions — if code says it's off-screen, it IS off-screen regardless of what a screenshot looks like
- Include the `rect` and `clipped` data in bug reports for debugging

---

## Issue Report Format

Report issues as JSON array:

```json
[
  {
    "id": "ISS-001",
    "confidence": "CONFIRMED-BUG",
    "severity": "high",
    "screen": "combat",
    "title": "Short description (max 100 chars)",
    "description": "Detailed explanation with evidence",
    "steps": ["Step 1", "Step 2"]
  }
]
```

**Confidence tags**:
- `CONFIRMED-BUG` — Evidence in data/screenshots proves real code bug
- `LIKELY-BUG` — Suspicious but needs investigation
- `DESIGN-QUESTION` — Working as coded, may not be intended
- `COSMETIC` — Visual polish, not functional
- `ENVIRONMENT` — Test infrastructure artifact (EXCLUDE from report)

**Severity**: `critical`, `high`, `medium`, `low`, `cosmetic`

---

## Report Template

Write your report as a JSON file to `/tmp/playtest-{scenario}.json`:

```json
{
  "scenario": "01-full-run",
  "timestamp": "ISO string",
  "screensVisited": ["hub", "combat", ...],
  "metrics": {
    "encountersCompleted": 0,
    "quizzesAnswered": 0,
    "quizzesCorrect": 0,
    "cardsPlayed": 0
  },
  "issues": [],
  "observations": [],
  "visualChecks": [
    { "checkpoint": "hub", "allPassed": true, "failures": [] }
  ],
  "verdict": "PASS | FAIL | PASS_WITH_ISSUES"
}
```

Also write a short markdown summary to `/tmp/playtest-{scenario}-summary.md`.

---

## Codex / Script Path Boilerplate

For workers WITHOUT MCP Playwright tools, use this Node.js script pattern:

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 412, height: 915 });

  // Pre-flight
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    localStorage.clear();
  });

  // Navigate with dev bypass
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial',
    { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Helper: read current screen
  const getScreen = () => page.evaluate(() => {
    const s = globalThis[Symbol.for('terra:currentScreen')];
    if (!s) return 'unknown';
    let v; s.subscribe(x => { v = x })(); return v;
  });

  // Helper: click by data-testid
  const click = async (testId) => {
    await page.click(`[data-testid="${testId}"]`, { force: true, timeout: 5000 });
  };

  // Helper: wait for screen
  const waitScreen = async (expected, ms = 5000) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (await getScreen() === expected) return true;
      await page.waitForTimeout(500);
    }
    return false;
  };

  // === SCENARIO CODE HERE ===

  await browser.close();
})();
```

---

## Dev Server Prerequisite

Before starting, verify the dev server is running:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```
If not 200, start it: `cd /root/terra-miner && npm run dev &` and wait 8 seconds.

---

## Game Flow Reference

```
Hub → btn-start-run → Domain Selection → domain-card-{id} → Archetype Selection → archetype-{id}
→ Combat Loop:
    Play cards (card-hand-{n}) → Quiz (quiz-answer-{n}) → End Turn (btn-end-turn)
    Enemy attacks → Repeat until victory or defeat
→ Card Reward (reward-type-{type} → reward-accept)
→ Room Selection (room-choice-{n})
→ Next encounter OR special room (rest/shop/mystery/mastery)
→ Every 3 floors: Retreat/Delve (btn-retreat / btn-delve)
→ Run End (btn-play-again / btn-home)
```
