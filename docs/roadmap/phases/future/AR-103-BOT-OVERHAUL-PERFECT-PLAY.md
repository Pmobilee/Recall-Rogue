# AR-103: Bot Overhaul — Perfect Play & Batch Infrastructure

## Overview

**Goal:** Make the Playwright bot play the game exactly like a skilled human player — no shortcuts, no skipped screens, no fake victories. Then build batch run infrastructure with timestamped result folders, auto-generated READMEs, and integration into the playtest skill.

**Why:** The current bot has critical blind spots:
- Declares "victory" when hitting hub/base screen instead of waiting for actual `runEnd`
- Skips shops entirely (never buys relics, cards, or food)
- Only heals at rest rooms (never studies/upgrades cards, never meditates/removes cards)
- Doesn't handle relic swap overlay (when slots full)
- Doesn't handle special events, upgrade selection, or post-mini-boss rest
- Segments completed is almost always 0 — bots aren't delving properly

**Estimated Complexity:** Medium-high (bot logic + infrastructure)

---

## Phase 1: Fix Run Lifecycle (CRITICAL)

### 1.1 Remove hub-as-victory detection

**File:** `tests/playtest/playwright-bot/bot.ts`

Remove or rework the block:
```typescript
if (['hub', 'base'].includes(state.currentScreen) && stats.totalCardsPlayed > 0) {
  stats.result = state.playerHP > 0 ? 'victory' : 'defeat';
  break;
}
```

Replace with: if the bot sees `hub`/`base` after playing cards, try to start a NEW run (the old one must have ended). Only mark as victory/defeat if `runEnd`/`runSummary` was seen in the screenLog.

### 1.2 Proper run-end detection

Only these screens are terminal:
- `runEnd`, `runSummary`, `runComplete` → check `runResult` for victory/defeat/retreat
- `victory`, `defeat`, `game_over`, `run_end` → explicit result
- `isGameOver` flag from state reader

The bot should ALSO detect run end via `__terraPlay.getRunState()?.completed === true`.

### 1.3 Fix delve/retreat flow

After segment boss, the game shows `retreatOrDelve` screen. The bot's `handleDelveRetreat` already handles this, but the screen name might not match. Add all variants:
- `retreatOrDelve`, `delve_retreat`, `floor_complete`, `checkpoint`, `segmentComplete`

The bot should delve until MAX_SEGMENTS (4), then retreat for victory. Scholar/dedicated/gamer profiles should always delve. Basic profiles retreat if HP < 25%.

---

## Phase 2: Shop Intelligence

### 2.1 Shop handler rewrite

**Current:** Bot immediately exits shop.
**New:** Bot browses inventory and makes purchases.

**Shop strategy by profile:**
- **All profiles:** Buy best affordable relic (priority: rare > common)
- **Low HP (<60%):** Buy food (ration first, elixir if affordable)
- **Optimal strategy:** Buy card removal if deck > 8 cards and can afford
- **Basic strategy:** Skip card purchases, buy food if very low HP

**Implementation:**

```typescript
case 'shop':
case 'shopRoom': {
  recordRoom(stats, 'shop');
  await page.waitForTimeout(500); // Let shop render

  // Read shop inventory and player gold
  const shopState = await page.evaluate(`(function() {
    var run = /* read activeRunState */;
    var gold = run?.currency || 0;
    // Find shop relic buttons
    var relicBtns = document.querySelectorAll('[data-testid^="shop-buy-relic-"]');
    var relics = [];
    for (var i = 0; i < relicBtns.length; i++) {
      var btn = relicBtns[i];
      var price = parseInt(btn.textContent) || 0;
      var id = btn.getAttribute('data-testid').replace('shop-buy-relic-', '');
      if (!btn.disabled) relics.push({ id, price });
    }
    // Find food buttons... card buttons... removal button...
    return { gold, relics, cards: [...], food: [...], hp: run.playerHp, maxHp: run.playerMaxHp };
  })()`);

  // Buy relic if affordable
  if (shopState.relics.length > 0) {
    const affordable = shopState.relics.filter(r => r.price <= shopState.gold);
    if (affordable.length > 0) {
      // Click buy button → confirm in modal
      await clickTestId(page, `shop-buy-relic-${affordable[0].id}`);
      await page.waitForTimeout(300);
      await clickTestId(page, 'shop-btn-buy'); // confirm purchase
      stats.goldSpent += affordable[0].price;
    }
  }

  // Buy food if HP < 60%
  const hpPct = shopState.maxHp > 0 ? shopState.hp / shopState.maxHp : 1;
  if (hpPct < 0.6 && shopState.food.length > 0) {
    // Buy cheapest food
    // ...
  }

  // Leave shop
  await clickTestId(page, 'btn-leave-shop') || exitRoom();
  break;
}
```

### 2.2 Haggle support (optional for v1)

Skip haggling in v1 — just buy at full price. Can add haggle in v2.

---

## Phase 3: Rest Room Intelligence

### 3.1 Rest strategy

**Current:** Always heals.
**New:**
- **HP > 80% + optimal strategy:** Study (upgrade cards) — `rest-study`
- **HP > 80% + deck > 8 cards:** Meditate (remove a card) — `rest-meditate`
- **HP ≤ 80% or basic strategy:** Heal — `rest-heal`

### 3.2 Study flow handling

After clicking `rest-study`, the game enters a quiz session (3 questions). Answer them using profile accuracy. Then handle `upgradeSelection` screen — pick first candidate via `upgrade-candidate-*` and confirm via `upgrade-confirm`.

### 3.3 Meditate flow handling

After clicking `rest-meditate`, the game shows cards to remove. Click first eligible card to remove it. Track `stats.cardsRemoved++`.

---

## Phase 4: Missing Screen Handlers

### 4.1 Relic swap overlay (`relicSwapOverlay`)

When relic slots are full and a new relic is offered:
- Click `btn-pass` to decline (simplest strategy)
- OR sell weakest equipped relic and accept new one (optimal)
- For v1: just pass (decline)

### 4.2 Special events (`specialEvent`)

Handle: `relic_forge`, `card_transform`, `deck_thin`, `knowledge_spring`
- Click `special-event-skip` or `btn-continue` or `mystery-continue`
- These mostly auto-resolve

### 4.3 Upgrade selection (`upgradeSelection`)

After study at rest room:
- Click first `upgrade-candidate-*` button
- Then click `upgrade-confirm`
- Track `stats.cardsUpgraded++`

### 4.4 Post-mini-boss rest (`postMiniBossRest`)

- Same as rest room but heal-only
- Click `rest-heal` or `post-miniboss-continue`

---

## Phase 5: Batch Run Infrastructure

### 5.1 Timestamped output folders

Every batch run creates: `data/playtests/runs/YYYY-MM-DD_HH-MM-SS/`

Contents:
- `combined.json` — all run stats
- `README.md` — auto-generated with:
  - Date/time, duration, total runs
  - Profile breakdown (runs per profile, win rates)
  - What was being tested (CLI arg `--description "testing shop relic buying"`)
  - Comparison to previous batch (if exists)
  - Key findings (auto-generated: win rate, avg floor, avg relics, etc.)
- `balance-report.txt` — auto-generated analysis (from analyze.ts)
- Per-profile batch JSONs (incremental saves)
- `progress.log` — timestamped activity log

### 5.2 Runner CLI updates

```bash
# Quick test run (5 per profile = 30 total)
npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 5

# Mass run with description
npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 100 \
  --description "Post shop-buying fix, testing relic acquisition"

# Overnight indefinite
npx tsx tests/playtest/playwright-bot/overnight.ts \
  --description "Overnight mass collection after bot overhaul"
```

### 5.3 Latest symlink

After each batch: `data/playtests/runs/latest -> YYYY-MM-DD_HH-MM-SS/`

### 5.4 Comparison helper

`analyze.ts --compare data/playtests/runs/latest data/playtests/runs/2026-03-19_03-00-00`

Shows delta: win rate change, relic change, floor change per profile.

---

## Phase 6: Skill Integration

### 6.1 Update playtest skill

The `/playtest` skill should support:
- `/playtest quick` — 5 runs per profile, auto-analyze
- `/playtest mass --runs 100` — mass run with analysis
- `/playtest overnight` — indefinite collection
- `/playtest results` — show latest batch README + key stats
- `/playtest compare` — compare latest vs previous batch

---

## Acceptance Criteria

- [ ] Bot NEVER declares victory/defeat from hub screen — only from `runEnd`
- [ ] Bot completes 4 segments on most runs (scholar avg floor ≥ 6)
- [ ] Bot buys relics in shop when affordable (avg relics per run ≥ 2.5 for scholar)
- [ ] Bot buys food in shop when HP < 60%
- [ ] Bot studies at rest when HP > 80% (optimal profiles)
- [ ] Bot handles relic swap overlay (at least passes)
- [ ] Bot handles upgrade selection, special events, post-mini-boss rest
- [ ] Per-encounter tracking works (avg 4+ encounters per full run)
- [ ] Batch runs create timestamped folders with README
- [ ] `/playtest` skill works for quick/mass/overnight modes
- [ ] Single verified run shows: shop purchase, rest study, 4+ segments, 2+ relics

## Files Affected

- `tests/playtest/playwright-bot/bot.ts` — major rewrite of screen handlers
- `tests/playtest/playwright-bot/runner.ts` — timestamped output, description flag
- `tests/playtest/playwright-bot/overnight.ts` — timestamped output
- `tests/playtest/playwright-bot/analyze.ts` — comparison mode
- `.claude/skills/playtest.md` — skill update

## Verification Gate

- [ ] Typecheck passes
- [ ] Single scholar run: 4 segments, 2+ relics, shop purchase, rest study
- [ ] 30-run batch (5 per profile): all profiles complete, avg floor ≥ 4
- [ ] Timestamped folder created with README
- [ ] Skill commands work
