---
name: visual-inspect
description: Instantly jump to any game state for visual inspection using Playwright + __rrScenario. Use for ALL visual testing, UI verification, screenshot capture, and playtest scenarios. Replaces manual navigation entirely.
user_invocable: true
model: sonnet
---

# Visual Inspect -- Instant Game State Viewer

Jump to ANY game state instantly via Playwright MCP + `window.__rrScenario`. This is the ONLY way to visually verify the game. Never navigate through menus manually.

## ⚠️ CRITICAL — Read This Before Diagnosing Any Visual Bug

These rules exist because a full playtest produced 15 confident "bug reports" that were all false positives (2026-04-09). Do not repeat those mistakes.

### Source of truth for screenshots

- **`screenshot.png`** (1920×1080 full-resolution PNG) is **the ONLY valid source of truth** for what the game actually looks like. Always read this first.
- **`rr-screenshot.jpg`** is a composited/downscaled thumbnail. It is useful for size/network economy but it can make landscape layouts look portrait and crunch details. **Never diagnose a visual bug from the JPG alone** — always cross-check against the PNG.
- The `Read` tool renders PNG/JPG downscaled in the display; the *file dimensions* are what matter. Run `file <path>` if unsure.

### Layout-dump pitfalls — do NOT treat as ground truth

`__rrLayoutDump()` returns `getBoundingClientRect()` values. These have two major failure modes:

1. **Mid-animation capture**. If a CSS `transition` or WAAPI animation is running when the dump fires, `getBoundingClientRect` returns the *current transformed* size. Example real false positive: card-hand-4 reported as 12×17 px because the card-deal scale transition was mid-frame. The Docker runners now inject a global `transition-duration: 0s !important` stylesheet to prevent this, but if you're running outside Docker, you must inject the same style or wait for animations to complete.
2. **"HIDDEN" false positives**. The dump's hidden-detection flags elements with specific opacity/transform/clip states as HIDDEN even when they render perfectly. Examples that almost always false-flag: `card-app`, `topbar`, `dungeon-map` wrapper, `enemy-name-header`, `btn-end-turn`, `player-hp-track`, `card-combat-overlay`. **Never report a HIDDEN flag as a bug** without confirming in the PNG that the element is actually invisible.

**Rule: if a claim comes from the layout dump but is contradicted by the PNG, the PNG wins.**

### Wait-time floors

Combat, dungeon map, and shop scenes can take **>4 seconds** to fully initialize (background art, sprites, HP init, card deal). Capturing too early produces "pure black" screens and mismatched HP values that look like bugs but are just init-timing artifacts.

- **Minimum `--wait` for combat/map/shop scenarios: 5000ms**
- If a capture shows a black/empty scene, try again with 7000–8000ms before reporting it as a bug
- Combat HP desync (Phaser dump says `32/32`, screenshot shows `0/0`): always an init-timing issue, never a real bug

### Pre-claim checklist (run mentally before every "bug" you report)

1. Did I read `screenshot.png`, not just `rr-screenshot.jpg`?
2. Is my layout-dump claim consistent with the PNG? If not, drop the claim.
3. Was the wait ≥5000ms? If the scene is black, re-capture with 8000ms.
4. Is the element I'm flagging "broken size" possibly mid-animation? (Docker runners now kill transitions — but confirm.)
5. Am I interpreting a HIDDEN flag without verifying the PNG?
6. Have I actually played this part of the game manually? If the user says "I don't see this bug in normal play", the bug is almost certainly in my capture methodology.

**When in doubt, ask the user before writing a long report.** A wrong report wastes more time than an unanswered question.

## Prerequisites

- Dev server running: `npm run dev` (port 5173)
- Playwright installed: `npx playwright --version`
- Note: Playwright MCP tools may not always be available. Use the direct Node.js script approach below as the primary method.

## Core Workflow

### Docker Method: Isolated Container (Parallel-Safe) — RECOMMENDED FOR PARALLEL AGENTS

When multiple agents need to test simultaneously, use Docker. Each container has its own Xvfb + Chromium + SwiftShader WebGL — no chrome-lock needed, fully isolated.

**Requirements:** Docker Desktop must be running.

```bash
# Single scenario test — no chrome-lock needed
scripts/docker-visual-test.sh --scenario combat-basic --agent-id my-agent
```

After the script completes, read the outputs from the timestamped output directory:

```
# Directory: /tmp/rr-docker-visual/{agent-id}_{scenario}_{timestamp}/
#
# Screenshot (page.screenshot):
Read("/tmp/rr-docker-visual/{agent-id}_{scenario}_{timestamp}/screenshot.png")
#
# RR Screenshot (__rrScreenshotFile composite — Phaser + DOM):
Read("/tmp/rr-docker-visual/{agent-id}_{scenario}_{timestamp}/rr-screenshot.jpg")
#
# Layout Dump (__rrLayoutDump — exact pixel coordinates):
Read("/tmp/rr-docker-visual/{agent-id}_{scenario}_{timestamp}/layout-dump.txt")
#
# Result JSON (success flag, errors, timing):
Read("/tmp/rr-docker-visual/{agent-id}_{scenario}_{timestamp}/result.json")
```

**Key facts about the Docker method:**
- Full WebGL 2.0 support via SwiftShader software renderer (shaders, framebuffers, all Phaser features)
- No chrome-lock required — each container is fully isolated
- Supports 2-3 parallel containers — stagger launches by 3 seconds for reliability
- All scenario presets work (`combat-basic`, `combat-boss`, `shop`, `reward-room`, etc.)
- Both `page.screenshot()` and `__rrScreenshotFile()` work inside the container
- `__rrLayoutDump()` works perfectly
- Slower than native (~60-110s per test) due to software rendering
- Requires host dev server running on port 5173 (container uses `host.docker.internal:5173`)
- For single quick tests where no parallelism is needed, the Direct Node.js Script method below is faster

### Docker `--actions-file` Full Gameplay Driver (PREFERRED for multi-step playtests)

**The warm container now supports a full action DSL — native mouse clicks, keyboard, drag, waitFor, intermediate screenshots, `__rrPlay` calls, assertions.** This is the only way to drive real `onpointerdown` card-hand interactions (synthetic click events do NOT trigger them).

Write a JSON array of action steps to a temp file and pass with `--actions-file`:

```bash
cat > /tmp/rr-play-combat.json <<'EOF'
[
  { "type": "wait", "ms": 3000 },
  { "type": "screenshot", "name": "01-combat-start" },
  { "type": "click", "selector": "[data-testid='card-hand-0']", "waitAfter": 800 },
  { "type": "screenshot", "name": "02-card-selected" },
  { "type": "click", "selector": "[data-testid='card-hand-0']", "waitAfter": 3000 },
  { "type": "screenshot", "name": "03-card-played" },
  { "type": "click", "selector": "[data-testid='btn-end-turn']", "waitAfter": 4000 },
  { "type": "screenshot", "name": "04-after-end-turn" }
]
EOF

scripts/docker-visual-test.sh --warm test \
  --agent-id my-agent \
  --scenario combat-basic \
  --wait 6000 \
  --actions-file /tmp/rr-play-combat.json
```

Every `screenshot` action saves both `{name}.png` AND `{name}.layout.txt` in the test dir so you can reconstruct the full trace. The final `result.json` includes an `actionLog` with per-step success/error.

**Supported action types** (see `docker/playwright-xvfb/warm-server.mjs` `executeAction` for full reference):

| type | purpose |
|---|---|
| `click` | Native mouse click — fires real pointerdown/up (required for card hand, anything with `onpointerdown`). Optional `force:true`, `button`, `clickCount`, `waitAfter`. |
| `dblclick`, `hover` | Self-explanatory |
| `mousedown` / `mouseup` | Press + release separately — for long-press or drag init |
| `drag` | `from` + `to` either selectors or `{x,y}`, with `steps` for intermediate moves |
| `type` / `fill` | Keystroke-level typing / instant fill into an input |
| `key` | Press a named key: `Enter`, `Escape`, `Space`, arrow keys, etc. |
| `wait` | Sleep `ms` |
| `waitFor` | Wait for selector to reach `state` (`visible` default) |
| `scenario` | Load an `__rrScenario` preset mid-sequence |
| `rrPlay` | Call `window.__rrPlay[method](...args)` — dev gameplay API |
| `eval` | Run arbitrary JS via `page.evaluate` |
| `screenshot` | Intermediate PNG + layout dump (`{name}.png` + `{name}.layout.txt`) |
| `rrScreenshot` | Intermediate composited capture (`{name}.rr.jpg`) |
| `layoutDump` | Layout dump only |
| `assert` | Fail the action on `selector` mismatch (`exists`/`text` checks) |
| `url` | Capture current URL into the action log |

**When to use actions vs `--eval`:**
- **Actions** — anything involving native input (clicks, keys, drags). CardHand `onpointerdown` requires this.
- **Actions** — multi-step flows where you want screenshots at each step.
- **`--eval`** — one-shot state manipulation (localStorage tweaks, calling internal services, reading values).
- Both can be combined in the same test.

**Gotcha — warm container state persistence:**
The warm container reuses the same page across tests, so state from a previous test (open narrative overlays, mid-combat hand, shop state) can leak into the next. If actions time out with `intercepts pointer events` errors, the previous test left a modal open. Add `{"type":"key","key":"Escape"}` at the start of your action list, or stop and restart the warm container.

### Docker `--eval` Custom JS Pattern (write to file, not inline)

The `--eval` flag lets you run custom JS after scenario load. Shell-escaping long inline JS is painful — **write the JS to a temp file and read via `$(cat ...)`**:

```bash
# 1. Write your custom eval to a temp file
cat > /tmp/rr-my-eval.js <<'EOF'
(async () => {
  // Must be a single async IIFE — the runner does page.evaluate(CUSTOM_EVAL)
  const r = await window.__rrScenario.loadCustom({
    screen: 'restStudy',
    deckId: 'japanese_n5_grammar'
  });
  await new Promise(res => setTimeout(res, 2500));
  // Write observables to document.title or globals — return values are NOT captured by the runner
  return { ok: true };
})()
EOF

# 2. Pass via $(cat ...) — preserves newlines and quotes
EVAL_JS="$(cat /tmp/rr-my-eval.js)" && \
  scripts/docker-visual-test.sh \
    --scenario rest-site \
    --agent-id my-test \
    --no-build \
    --wait 3000 \
    --eval "$EVAL_JS"
```

**Gotchas:**
- The eval MUST be a single expression (wrap in `(async () => { ... })()`). Top-level `await` outside a function errors with `"await is only valid in async functions"`.
- **Return values are NOT captured** by the runner — write observations to `document.title`, `window.__rrTestSummary`, or the DOM where `__rrLayoutDump()` will pick them up.
- To force specific `deckOptions` toggles before a scenario load, either `localStorage.setItem('card:deckOptions', ...)` OR dynamic-import the service: `const m = await import('/src/services/deckOptionsService.ts'); m.setRomajiEnabled(true);`. localStorage alone won't update the reactive Svelte store because it reads once at module init.
- `--scenario <preset>` is required even when your `--eval` does its own `loadCustom` — pass any fast-loading preset like `rest-site` as the wrapper.

### Reaching Curated-Deck Combat State (harder than study state)

- **Study / rest-room quiz** (`screen: 'restStudy'` + `deckId: 'japanese_n5_grammar'`) — works out of the box. `scenarioSimulator.ts:1336` sets `run.deckMode` after bootstrap before generating questions. Hits `StudyQuizOverlay.svelte`.
- **Combat quiz with a curated deck** — `loadCustom({screen: 'combat', deckId: ...})` does NOT set `run.deckMode`. Combat picks facts from the default trivia pool. To test combat with a curated deck you need to manually set `run.deckMode` via store mutation BEFORE `startEncounterForRoom` runs — not currently exposed via `__rrScenario`. Easier paths: (a) use the restStudy screen to verify the shared renderer components; (b) inject committed quiz data via direct store manipulation; (c) add a dedicated combat+deck preset to `scenarioSimulator.ts` if you need it repeatedly.

### Primary Method: Direct Node.js Script

When Playwright MCP tools are unavailable (common), use this approach directly:

```javascript
// Run via: node -e "..." (in Bash tool)
const { chromium } = require('playwright');
(async () => {
  // MUST use system Chrome (channel: 'chrome') — Playwright's bundled Chromium lacks WebGL on macOS ARM64
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial');
  await page.waitForTimeout(5000);

  // Load scenario
  await page.evaluate(() => window.__rrScenario?.load('combat-basic'));
  await page.waitForTimeout(5000);

  // Visual: screenshot + layout dump (ALWAYS use both)
  const path = await page.evaluate(() => window.__rrScreenshotFile?.());
  console.log('Screenshot:', path);  // then Read("/tmp/rr-screenshot.jpg") to view

  const layout = await page.evaluate(() => window.__rrLayoutDump?.());
  console.log('Layout dump:', layout);  // exact pixel coordinates of ALL Phaser + DOM elements

  // Get DOM audit data
  const audit = await page.evaluate(() => { /* discovery script */ });
  console.log(JSON.stringify(audit, null, 2));

  await browser.close();
})();
```

Then use `Read("/tmp/rr-screenshot.jpg")` to view the screenshot.

### Alternative: Playwright MCP Tools

If `mcp__playwright__*` tools are loaded, they can be used instead of the script approach:
1. `mcp__playwright__browser_navigate` -> `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. `browser_evaluate` -> `window.__rrScenario.load('combat-basic')`
3. Wait 5 seconds
4. `browser_evaluate(() => window.__rrScreenshotFile())` -> saves to `/tmp/rr-screenshot.jpg`
5. `Read("/tmp/rr-screenshot.jpg")` to view
5b. `browser_evaluate(() => window.__rrLayoutDump())` -> returns exact pixel coordinates of ALL Phaser + DOM elements (ALWAYS run alongside screenshot)
6. `mcp__playwright__browser_snapshot` for DOM state (supplementary)

### CRITICAL: Fix Tools, Never Fallback

If ANY screenshot or browser tool fails (Playwright won't launch, Chrome not connected, `__rrScreenshotFile()` errors, MCP tools unavailable):
1. **STOP** — do NOT skip visual inspection or accept the failure
2. **DIAGNOSE** — check what's wrong (port in use, Chrome already open, missing deps, server not running)
3. **FIX** — resolve the root cause (kill stale processes, restart dev server, reconnect browser)
4. **RETRY** — take the screenshot with the fixed tool
5. **NEVER** report "couldn't verify" — verification is the whole point of this skill

### Screenshot Compositing

`__rrScreenshotFile()` uses html2canvas to composite:
1. Draws Phaser WebGL canvas directly (preserveDrawingBuffer: true)
2. Temporarily clears all opaque DOM backgrounds so Phaser layer shows through
3. Runs html2canvas on document.body (transparent bg, ignoring canvas elements)
4. Composites: Phaser first, DOM overlay on top
5. Result: full game view with enemy sprites + backgrounds + cards + UI

### CRITICAL RULES
- **ALWAYS use `channel: 'chrome'`** when launching Playwright natively (system Chrome has WebGL via Metal GPU; bundled Chromium does not)
- **NEVER use `page.screenshot()`** natively (Phaser RAF blocks it — 30s timeout) — inside Docker containers this works fine
- **NEVER use `mcp__playwright__browser_take_screenshot`** (same RAF issue)
- **NEVER use `page.context().newCDPSession()`** (hangs permanently)
- **ALWAYS wait 5 seconds** after scenario load before capturing

### Chrome Lock Protocol

The chrome-lock (`scripts/chrome-lock.sh`) is required for the Direct Node.js Script and Playwright MCP methods since they share the system Chrome process.

**The Docker method does NOT need chrome-lock** — each container runs its own isolated Chromium instance.

```bash
scripts/chrome-lock.sh check                    # Check if locked
scripts/chrome-lock.sh wait 60                  # Wait up to 60s
scripts/chrome-lock.sh acquire <task-id>        # Acquire lock (native methods only)
scripts/chrome-lock.sh release                  # Release lock
```

## Available Presets

### Combat
| Preset | Enemy | Notes |
|--------|-------|-------|
| `combat-basic` | cave_bat | 5-card hand (3 strike, 2 block) |
| `combat-boss` | the_archivist | 50 HP, 3 relics, mixed hand |
| `combat-elite` | the_librarian | 80 HP, 2 relics |
| `combat-mini-boss` | cave_guardian | 60 HP |
| `combat-scholar` | scholar | 10 cards, 2 relics |
| `combat-10-cards` | crystal_golem | 10-card hand |
| `combat-all-chains` | cave_bat | All 5 chain types |
| `combat-low-hp` | cave_bat | 10 HP player |
| `combat-near-death` | cave_bat | 3 HP player |
| `combat-relic-heavy` | cave_bat | 5 relics |
| `combat-big-hand` | cave_bat | 8-card hand |
| `combat-high-combo` | cave_bat | 5x combo, combo_ring |

### Reward Room
| Preset | Contents |
|--------|----------|
| `reward-room` | Random test rewards |
| `reward-gold-and-cards` | 50g, upgraded Heavy Strike, Block, large vial |
| `reward-relic` | 30g, Whetstone relic, Surge card |

### Shop
| Preset | Contents |
|--------|----------|
| `shop` | 500g, default inventory |
| `shop-loaded` | 1000g, 3 relics, 4 cards |

### Card Reward
| Preset | Choices |
|--------|---------|
| `card-reward` | Default random |
| `card-reward-attacks` | Heavy Strike, Multi Hit, Lifetap |
| `card-reward-mixed` | Strike, Block, Expose |

### Run End
| Preset | Result |
|--------|--------|
| `run-end-victory` | Floor 10, 92% accuracy, 2 bosses |
| `run-end-defeat` | Floor 4, 65% accuracy |
| `run-end-retreat` | Floor 6, 78% accuracy |

### Mystery Events (by ID)
| Preset | Event |
|--------|-------|
| `mystery-event` | Random event, floor 3 |
| `mystery-healing-fountain` | The Healing Fountain |
| `mystery-gamblers-tome` | Gambler's Tome, floor 4 |
| `mystery-final-wager` | Final Wager, floor 10 |

Use `__rrScenario.listMysteryEvents()` for all valid event IDs.

### Other Screens
| Preset | Screen |
|--------|--------|
| `rest-site` | Rest room |
| `dungeon-map` | Dungeon map |
| `retreat-or-delve` | Post-boss choice, floor 3, 200g |
| `hub-endgame` | Hub with 5 relics, 5000g |
| `hub-fresh` | Hub with 0g |
| `archetype-selection` | Choose Your Playstyle screen |
| `onboarding` | Dungeon entrance cutscene |
| `relic-sanctum` | Relic collection screen |
| `library` | Knowledge library |
| `profile` | Player profile |
| `journal` | Journal screen |
| `settings` | Settings screen |
| `study-quiz` | Study quiz (rest site variant) |
| `mastery-challenge` | Mastery challenge quiz |

## Custom Configs -- Full Reference

### ScenarioConfig fields

```typescript
{
  // REQUIRED
  screen: string;              // Target screen

  // COMBAT
  enemy?: string;              // Enemy template ID
  enemyHp?: number;            // Override enemy HP
  playerHp?: number;           // Player HP (default 100)
  playerMaxHp?: number;        // Player max HP
  playerBlock?: number;        // Player block
  enemyBlock?: number;         // Enemy block
  hand?: string[];             // Mechanic IDs for hand
  handSize?: number;           // Pad/trim hand to size
  chainTypes?: number[];       // Chain type per card (0-5)
  comboMultiplier?: number;    // Override combo
  turn?: number;               // Override turn number

  // RUN STATE
  relics?: string[];           // Relic IDs to equip
  gold?: number;               // Starting gold
  floor?: number;              // Floor number
  domain?: string;             // Knowledge domain
  ascension?: number;          // Ascension level

  // REWARD ROOM
  rewards?: Array<
    | { type: 'gold'; amount: number }
    | { type: 'health_vial'; size?: 'small'|'large'; healAmount?: number }
    | { type: 'card'; mechanicId: string; upgraded?: boolean }
    | { type: 'relic'; relicId: string }
  >;

  // SHOP
  shopRelics?: string[];       // Relic IDs to stock
  shopCards?: string[];        // Card mechanic IDs to stock

  // MYSTERY EVENT
  mysteryEventId?: string;     // Specific event ID (or random)

  // CARD REWARD
  cardRewardMechanics?: string[]; // Mechanic IDs for choices

  // RUN END
  runEndResult?: 'victory' | 'defeat' | 'retreat';
  runEndStats?: Partial<{
    floorReached, factsAnswered, correctAnswers, accuracy,
    bestCombo, cardsEarned, encountersWon, elitesDefeated,
    bossesDefeated, currencyEarned, relicsCollected
  }>;
}
```

### Valid IDs

**Enemies** (sample): `cave_bat`, `crystal_golem`, `the_archivist`, `cave_guardian`, `scholar`, `the_librarian`
- Full list: `window.__rrScenario.help()` or check `src/data/enemies.ts`

**Mechanics** (sample): `strike`, `block`, `heavy_strike`, `multi_hit`, `lifetap`, `expose`, `reckless`, `thorns`, `focus`, `parry`, `brace`, `overheal`, `piercing`, `fortify`, `cleanse`, `quicken`, `adapt`, `execute`, `recycle`, `mirror`, `foresight`, `scout`, `empower`, `weaken`, `hex`
- Full list: check `src/data/mechanics.ts`

**Relics** (sample): `whetstone`, `iron_shield`, `swift_boots`, `combo_ring`, `momentum_gem`, `vitality_ring`, `scholars_hat`, `expanded_satchel`
- Full list: check `src/data/relics/index.ts`

**Domains**: `general_knowledge`, `natural_sciences`, `history`, `geography`, `animals_wildlife`, `space_astronomy`, `food`, `mythology`

## State Spawning (Instant Scenario Setup — PREFERRED METHOD)

Use `__rrScenario.spawn()` for precise state control without menu navigation:

```javascript
// Spawn with custom overrides
await page.evaluate(() => __rrScenario.spawn({
  screen: 'combat',
  enemy: 'algorithm',
  playerHp: 30,
  hand: ['heavy_strike', 'block', 'lifetap'],
  relics: ['whetstone'],
  turnOverrides: { chainMultiplier: 2.5, isSurge: true }
}));

// Get auto-generated test conditions for any element
const recipe = await page.evaluate(() => __rrScenario.recipes('phoenix_feather'));
// Returns optimal config for testing that relic
await page.evaluate((r) => __rrScenario.spawn(r.config), recipe);

// Test a status effect with ideal setup
const poisonRecipe = await page.evaluate(() => __rrScenario.recipes('poison'));
await page.evaluate((r) => __rrScenario.spawn(r.config), poisonRecipe);
```

`spawn()` replaces menu navigation — it's faster, more reliable, and lets you test specific states that are hard to reach through normal gameplay.

## Mid-Combat State Overrides

After loading a scenario, use these to tweak state live:

```javascript
await page.evaluate(() => __rrScenario.setPlayerHp(50, 100));
await page.evaluate(() => __rrScenario.setEnemyHp(1));
await page.evaluate(() => __rrScenario.setGold(999));
await page.evaluate(() => __rrScenario.setFloor(20));
await page.evaluate(() => __rrScenario.forceHand(['heavy_strike', 'strike', 'block']));
await page.evaluate(() => __rrScenario.addRelic('combo_ring'));
await page.evaluate(() => __rrScenario.removeRelic('whetstone'));
await page.evaluate(() => __rrScenario.setPlayerBlock(15));
await page.evaluate(() => __rrScenario.setEnemyBlock(10));
await page.evaluate(() => __rrScenario.setCombo(8));
```

## Runtime Debug Tools

```javascript
// Full debug snapshot (screen, Phaser state, interactive elements, errors)
await page.evaluate(() => window.__rrDebug());

// Recent log events
await page.evaluate(() => window.__rrLog.slice(-20));

// Read any store
await page.evaluate(() => {
  const sym = Symbol.for('terra:activeTurnState');
  const store = globalThis[sym];
  let val; store.subscribe(v => val = v)();
  return val;
});
```

## Example: Complete Visual Inspection Workflow

```
1. browser_navigate -> http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial
2. browser_evaluate -> disable animations
3. browser_evaluate -> __rrScenario.loadCustom({ screen: 'combat', enemy: 'the_archivist', playerHp: 30, hand: ['heavy_strike', 'block', 'lifetap'], relics: ['whetstone'] })
4. wait 500ms
5. browser_evaluate(() => window.__rrScreenshotFile()) -> saves to /tmp/rr-screenshot.jpg (Phaser + DOM composite). Use Read("/tmp/rr-screenshot.jpg") to view.
5b. browser_evaluate(() => window.__rrLayoutDump()) -> returns exact pixel coordinates of ALL Phaser + DOM elements (ALWAYS run alongside screenshot)
6. browser_snapshot -> check DOM state (supplementary)
7. browser_console_messages -> check errors
8. If issues found -> fix code -> repeat from step 3
```

## Exhaustive Element Evaluation Protocol — MANDATORY

After loading any scenario and taking a screenshot, you MUST perform a full element discovery and evaluation. Do NOT just glance at the screenshot — systematically discover and question every element.

### Discovery Phase (browser_evaluate)

Run this after every scenario load:

```javascript
(() => {
  const els = { buttons: [], texts: [], images: [], bars: [], cards: [], overlays: [] };

  document.querySelectorAll('button, [role="button"], [data-testid], .clickable').forEach(el => {
    if (!el.offsetParent && el.offsetWidth === 0) return;
    const r = el.getBoundingClientRect();
    els.buttons.push({
      id: el.dataset?.testid || el.className?.split(' ')[0] || el.tagName,
      text: el.textContent?.trim().slice(0, 60),
      w: Math.round(r.width), h: Math.round(r.height),
      y: Math.round(r.y), visible: getComputedStyle(el).display !== 'none',
      disabled: el.disabled,
    });
  });

  document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, label, [class*="text"], [class*="label"], [class*="title"], [class*="stat"], [class*="value"]').forEach(el => {
    const t = el.textContent?.trim();
    if (!t || !el.offsetParent) return;
    els.texts.push({
      content: t.slice(0, 100),
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      hasArtifacts: /undefined|null|NaN|\[object/.test(t),
    });
  });

  document.querySelectorAll('img, [style*="background-image"]').forEach(el => {
    if (!el.offsetParent && el.offsetWidth === 0) return;
    els.images.push({
      src: (el.src || el.style?.backgroundImage || '').slice(0, 80),
      broken: el.tagName === 'IMG' && !el.complete,
      w: Math.round(el.getBoundingClientRect().width),
    });
  });

  document.querySelectorAll('[class*="bar"], [class*="progress"], [role="progressbar"]').forEach(el => {
    if (!el.offsetParent) return;
    els.bars.push({
      class: el.className?.split(' ')[0],
      w: Math.round(el.getBoundingClientRect().width),
    });
  });

  document.querySelectorAll('[data-testid^="card-"], [class*="card-hand"]').forEach(el => {
    if (!el.offsetParent) return;
    const r = el.getBoundingClientRect();
    els.cards.push({
      id: el.dataset?.testid,
      w: Math.round(r.width), h: Math.round(r.height),
      hasContent: el.textContent?.trim().length > 0,
    });
  });

  return {
    screen: (() => { const s = globalThis[Symbol.for('terra:currentScreen')]; if (!s) return 'unknown'; let v; s.subscribe(x => v = x)(); return v; })(),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    counts: Object.fromEntries(Object.entries(els).map(([k, v]) => [k, v.length])),
    elements: els,
  };
})()
```

### Evaluation Phase — Question Every Element

For EVERY discovered element, you must ask and answer:

**Buttons/Interactives:**
- Is it visible and not hidden behind anything?
- Is the text readable and meaningful (not empty, not "undefined")?
- Is it large enough to tap (>= 44x44px)?
- Is it disabled when it should be enabled, or vice versa?
- Does the label clearly communicate what happens when you tap it?
- Is it positioned where a player would expect it?

**Text Elements:**
- Is the font size readable (>= 11px)?
- Does the text contain data artifacts ("undefined", "null", "NaN")?
- Is the text truncated or overflowing?
- Is the content correct and meaningful?
- Is the contrast sufficient against its background?
- Is this text useful to the player in this context?

**Images/Sprites:**
- Did the image load (not broken)?
- Is it the right size (not stretched/squished)?
- Is it a real asset or a placeholder?
- Does it look correct for what it represents?
- Is the art quality consistent with the game's style?

**Progress Bars:**
- Does the fill match the displayed number?
- Is the bar clearly visible?
- Does the color communicate the right state?

**Cards:**
- Does the card have content (not blank)?
- Are AP cost, type, name, and effect all visible?
- Can you read the card at this size?
- Is the card visually distinguishable from adjacent cards?

**Overall Screen:**
- Any horizontal scroll or content overflow?
- Any elements outside the viewport?
- Any console errors?
- What is the first thing your eye is drawn to?
- Does the screen feel complete and polished?
- What would you improve first?
- Does this screen make a new player feel welcome or confused?
- Rate visual polish 1-10 and explain the score.

### Immersion Systems Checklist (added 2026-04-03)
When inspecting combat visuals, also verify:
- **Enemy entrance:** Enemy emerges from shadow (800ms common, 1200ms boss) — not instant pop-in
- **Weapon impact sync:** Enemy recoils at sword apex (T+250ms) / tome peak (T+330ms), not before
- **Turn transitions:** Brief vignette darken between turns, enemy pulse, particle spike
- **Foreground parallax:** 1-3 semi-transparent elements at screen edges (depth 13), gentle breathing drift
- **Mood vignette:** `moodVignetteOverlay` alpha scales with HP (0.15 full → 0.27+ near-death)
- **Chain escalation:** At chain 3+ lights brighten/shift hue, chain 5+ vignette pulses, chain 7+ depth pulses
- **Background micro-anim:** Subtle torch flicker in bright depth regions (mid+ quality only)

### Report Format

After evaluation, your report must include:
1. Total elements discovered (by type)
2. Total elements evaluated (MUST match discovered)
3. Per-element pass/fail for objective questions
4. Per-element subjective assessments
5. Holistic screen impressions
6. List of issues found (with severity: critical/high/medium/low/cosmetic)
7. Top 3 improvements ranked by impact

## Rules

- ALWAYS use this skill for visual verification -- never click through menus
- ALWAYS disable animations before screenshots
- ALWAYS take BOTH screenshot AND layout dump — never one without the other:
  - Screenshot: `browser_evaluate(() => window.__rrScreenshotFile())` → saves to `/tmp/rr-screenshot.jpg`, then `Read()` to view
  - Layout dump: `browser_evaluate(() => window.__rrLayoutDump())` → returns text with exact pixel coordinates of ALL Phaser + DOM elements
- ALWAYS check console for errors after loading a scenario
- For Phaser canvas content, use `browser_evaluate` to check scene state when screenshots aren't enough
- After ANY code change, reload the page (navigate again) before loading a new scenario

### Registry Update (AUTO)
After completing visual inspection, update the registry:
```bash
npx tsx scripts/registry/updater.ts --ids "{comma-separated inspected element IDs}" --type visualDate
```
