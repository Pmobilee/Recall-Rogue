# Visual Testing with Playwright

> **Purpose:** How to visually test Recall Rogue using Playwright MCP and E2E scripts — screenshots, scenario loading, debug tools, and known gotchas.
> **Last verified:** 2026-03-31
> **Source files:** `src/dev/screenshotHelper.ts`, `src/dev/scenarioSimulator.ts`, `src/dev/debugBridge.ts`, `src/dev/layoutDump.ts`, `tests/e2e/01-app-loads.cjs`, `tests/e2e/03-save-resume.cjs`

## Two Modes

### 1. MCP Playwright (interactive — use during development)

Tools: `mcp__playwright__browser_navigate`, `mcp__playwright__browser_evaluate`, `mcp__playwright__browser_snapshot`, etc. Persistent browser session, no scripts needed.

**Standard debug sequence:**
```
1. browser_navigate → http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial
2. browser_evaluate(() => window.__rrScreenshotFile())  → visual check
3. Read("/tmp/rr-screenshot.jpg")                       → view the image
4. browser_evaluate(() => window.__rrLayoutDump())      → exact pixel coordinates
5. browser_console_messages                             → check JS errors
```

### 2. E2E Scripts (automated — use for CI and end-of-session checks)

Scripts in `tests/e2e/`, run directly with Node.js:
```bash
node tests/e2e/01-app-loads.cjs    # App loads without JS errors, saves /tmp/e2e-01-loaded.png
node tests/e2e/03-save-resume.cjs  # Save/resume flow
node tests/e2e/04-desktop-layout.cjs
node tests/e2e/05-portrait-regression.cjs
```

Both use `chromium.launch({ headless: true, channel: 'chrome' })` — system Chrome is required.

## WebGL Requirement: Must Use System Chrome

Playwright's bundled Chromium does NOT have WebGL on macOS ARM64 (no SwiftShader). Phaser 3 requires WebGL. Always use:

```javascript
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
```

Never use `chromium.launch({ headless: true })` — it shows "Device Not Supported" because WebGL is unavailable.

## Screenshot Method: `__rrScreenshotFile()`

```javascript
// CORRECT — always use this
const path = await page.evaluate(() => window.__rrScreenshotFile());
// Then: Read(path) to view, path is typically /tmp/rr-screenshot.jpg
```

**NEVER use these — they hang permanently due to Phaser's `requestAnimationFrame` loop:**
- `mcp__playwright__browser_take_screenshot`
- `page.screenshot()` via `browser_run_code`
- `page.context().newCDPSession()` — hangs permanently, blocks the session
- Raw `__rrScreenshot()` via `browser_evaluate` — base64 exceeds tool output character limits

**How `__rrScreenshotFile()` works** (`src/dev/screenshotHelper.ts`):
1. Grabs the Phaser WebGL canvas pixels via `ctx.drawImage()` (requires `preserveDrawingBuffer: true` in Phaser config)
2. Runs `html2canvas(document.body, { ignoreElements: canvas })` to capture the Svelte DOM overlay
3. Temporarily clears opaque backgrounds on large viewport-covering elements so html2canvas doesn't paint over the Phaser layer
4. Composites: Phaser canvas first (background), then html2canvas result on top
5. Downscales to 50%, encodes as JPEG (quality 0.7)
6. POSTs the data URL to `/__dev/screenshot` Vite endpoint, which writes to `/tmp/rr-screenshot.jpg`
7. Returns the server-side file path

`window.__rrScreenshot()` is the same but returns the base64 data URL directly (for when the file endpoint is unavailable). Backward-compat aliases `__terraScreenshot` and `__terraScreenshotFile` exist until 2026-06-01.

**Known caveat:** `__rrScreenshotFile()` cannot render CSS animations or certain overlays correctly (html2canvas limitation). Cross-check with native `page.screenshot()` when things look wrong — though note `page.screenshot()` also hangs in some Phaser setups.

## Disable Animations Before Screenshots

Always disable animations before capturing to get stable screenshots:

```javascript
await page.evaluate(() =>
  document.documentElement.setAttribute('data-pw-animations', 'disabled')
);
```

## Scenario System: `__rrScenario`

Never navigate through hub → dungeon → map → node manually. Use `__rrScenario` to jump instantly to any game state.

```javascript
// Load a named scenario
await page.evaluate(() => window.__rrScenario.load('combat-basic'));
await page.evaluate(() => window.__rrScenario.load('combat-boss'));
await page.evaluate(() => window.__rrScenario.load('combat-10-cards'));
await page.evaluate(() => window.__rrScenario.load('shop'));          // 500g
await page.evaluate(() => window.__rrScenario.load('reward-room'));

// List all available scenarios
await page.evaluate(() => window.__rrScenario.list());
```

**Mid-combat state overrides** (callable any time during combat):
```javascript
window.__rrScenario.setPlayerHp(50)
window.__rrScenario.setEnemyHp(1)
window.__rrScenario.setPlayerBlock(10)
window.__rrScenario.setEnemyBlock(5)
window.__rrScenario.setGold(999)
window.__rrScenario.forceHand(['heavy_strike', 'strike', 'block'])
window.__rrScenario.addRelic('whetstone')
window.__rrScenario.setFloor(5)
```

`ScenarioConfig` fields (from `src/dev/scenarioSimulator.ts`) allow deep state control: `enemy`, `enemyHp`, `playerHp`, `hand`, `relics`, `gold`, `floor`, `domain`, `chainTypes`, `rewards`, `shopRelics`, `shopCards`, `mysteryEventId`, `ascension`, and more.

## Debug Tools

All tools are DEV MODE ONLY — never included in production builds.

### `window.__rrDebug()`
Returns an `RRDebugSnapshot` with:
- `currentScreen: string` — current screen name
- `phaser.running`, `phaser.activeScene`, `phaser.inputHandlerCount`, `phaser.lastPointerPosition`
- `stores` — current values of `currentScreen`, `gameManagerStore`, `inventoryStore`, `profileStore`, `settingsStore`
- `interactiveElements[]` — all `[data-testid]` elements with `visible`, `disabled`, `occluded`, `boundingRect`
- `recentErrors[]` — last 20 JS errors
- `recentLog[]` — last 20 events from the ring buffer

### `window.__rrLog`
Ring buffer of last 100 events (`{ ts, type, detail }`). Each event pushed by `rrLog(type, detail)` in game code. Useful for tracing what actually happened after an interaction.

### `window.__rrLayoutDump()`
Unified layout dump from `src/dev/layoutDump.ts`. Returns a plain-text document with:
- **Phaser layer:** all visible game objects with `(x, y)`, dimensions, depth, text content
- **DOM layer:** all significant DOM elements with bounding rects, `data-testid`, visibility, text content
- **Spatial relationships:** viewport regions, cross-layer proximity, overlap detection

Always use alongside `__rrScreenshotFile()` — screenshot for visual context, layout dump for precise coordinates. Never guess positions from screenshots alone.

## Dev Server URL

```
http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial
```

- `skipOnboarding=true` — bypasses the age gate and tutorial flow
- `devpreset=post_tutorial` — starts in a state with a deck and a run in progress
- `giveDust=20000` — grants dust (currency) for testing shop
- `setLevel=25` — sets character level

## `data-testid` Selectors

Key selectors for interactive elements:

| Selector | Element |
|----------|---------|
| `btn-start-run` | Hub start run button |
| `card-hand-0` … `card-hand-4` | Cards in combat hand |
| `quiz-answer-0` … `quiz-answer-2` | Quiz answer buttons |
| `btn-age-adult` | Age gate confirmation |
| `btn-retreat` | Retreat from dungeon |
| `btn-delve` | Delve deeper |
| `combo-counter` | Combo display |
| `room-choice-0` … `room-choice-2` | Dungeon map room choices |

Note: Playwright cannot click Phaser canvas objects — clicks do not reach Phaser's input system. Use `browser_evaluate` to trigger game actions programmatically, or use `__rrScenario` to set up the state you need.
