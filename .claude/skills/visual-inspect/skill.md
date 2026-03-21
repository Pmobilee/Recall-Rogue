---
name: visual-inspect
description: Instantly jump to any game state for visual inspection using Playwright + __terraScenario. Use for ALL visual testing, UI verification, screenshot capture, and playtest scenarios. Replaces manual navigation entirely.
user_invocable: true
model: sonnet
---

# Visual Inspect -- Instant Game State Viewer

Jump to ANY game state instantly via Playwright MCP + `window.__terraScenario`. This is the ONLY way to visually verify the game. Never navigate through menus manually.

## Prerequisites

- Dev server running: `npm run dev` (port 5173)
- Playwright MCP available (`mcp__playwright__*` tools)

## Core Workflow

### Step 1: Navigate to the app

```
mcp__playwright__browser_navigate -> http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial
```

### Step 2: Disable animations for clean screenshots

```javascript
// via browser_evaluate:
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
```

### Step 3: Load a scenario

Use `browser_evaluate` to call `__terraScenario`:

```javascript
// Named preset:
await page.evaluate(() => window.__terraScenario.load('combat-boss'));

// Custom config:
await page.evaluate(() => window.__terraScenario.loadCustom({
  screen: 'combat',
  enemy: 'the_archivist',
  playerHp: 30,
  playerMaxHp: 100,
  hand: ['heavy_strike', 'strike', 'block', 'lifetap', 'expose'],
  relics: ['whetstone', 'combo_ring', 'momentum_gem'],
  gold: 500,
  floor: 8,
}));
```

### Step 4: Wait briefly, then screenshot + snapshot

```javascript
// Wait for scene to render (500ms for combat, 300ms for UI screens)
await new Promise(r => setTimeout(r, 500));
```

Then:
- `mcp__playwright__browser_take_screenshot` -- visual check (ALWAYS use this MCP tool, NEVER `page.screenshot()` via `browser_run_code` — Phaser's RAF loop blocks it permanently)
- `mcp__playwright__browser_snapshot` -- DOM state (fallback if screenshot fails)
- `mcp__playwright__browser_console_messages` -- errors
- **NEVER** use `page.context().newCDPSession()` — it hangs permanently

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

Use `__terraScenario.listMysteryEvents()` for all valid event IDs.

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
- Full list: `window.__terraScenario.help()` or check `src/data/enemies.ts`

**Mechanics** (sample): `strike`, `block`, `heavy_strike`, `multi_hit`, `lifetap`, `expose`, `reckless`, `thorns`, `focus`, `parry`, `brace`, `overheal`, `piercing`, `fortify`, `cleanse`, `quicken`, `adapt`, `execute`, `recycle`, `mirror`, `foresight`, `scout`, `empower`, `weaken`, `hex`
- Full list: check `src/data/mechanics.ts`

**Relics** (sample): `whetstone`, `iron_shield`, `swift_boots`, `combo_ring`, `momentum_gem`, `vitality_ring`, `scholars_hat`, `expanded_satchel`
- Full list: check `src/data/relics/index.ts`

**Domains**: `general_knowledge`, `natural_sciences`, `history`, `geography`, `animals_wildlife`, `space_astronomy`, `food`, `mythology`

## Mid-Combat State Overrides

After loading a combat scenario, use these to tweak state live:

```javascript
await page.evaluate(() => __terraScenario.setPlayerHp(50, 100));
await page.evaluate(() => __terraScenario.setEnemyHp(1));
await page.evaluate(() => __terraScenario.setGold(999));
await page.evaluate(() => __terraScenario.setFloor(20));
await page.evaluate(() => __terraScenario.forceHand(['heavy_strike', 'strike', 'block']));
await page.evaluate(() => __terraScenario.addRelic('combo_ring'));
await page.evaluate(() => __terraScenario.removeRelic('whetstone'));
await page.evaluate(() => __terraScenario.setPlayerBlock(15));
await page.evaluate(() => __terraScenario.setEnemyBlock(10));
await page.evaluate(() => __terraScenario.setCombo(8));
```

## Runtime Debug Tools

```javascript
// Full debug snapshot (screen, Phaser state, interactive elements, errors)
await page.evaluate(() => window.__terraDebug());

// Recent log events
await page.evaluate(() => window.__terraLog.slice(-20));

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
3. browser_evaluate -> __terraScenario.loadCustom({ screen: 'combat', enemy: 'the_archivist', playerHp: 30, hand: ['heavy_strike', 'block', 'lifetap'], relics: ['whetstone'] })
4. wait 500ms
5. mcp__playwright__browser_take_screenshot -> inspect visual (NEVER use page.screenshot() via browser_run_code — Phaser RAF blocks it)
6. browser_snapshot -> check DOM (fallback if screenshot times out)
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
- ALWAYS check console for errors after loading a scenario
- For Phaser canvas content, use `browser_evaluate` to check scene state when screenshots aren't enough
- After ANY code change, reload the page (navigate again) before loading a new scenario
