# AR-100: Bot Polish, Commit Session Work & Cleanup

## Overview

**Goal:** Commit all session work, polish the Playwright bot to complete full runs reliably, and defer/archive items that depend on the bot working first.

**Context:** This session produced AR-97 through AR-99 — relic balance, floor scaling, player profiles, healing nerf, enemy HP/traits, and a working Playwright bot prototype. All uncommitted. The bot plays real combat but can't complete a full run yet due to speed, missing screen handlers, and broken shop exit.

**Estimated complexity:** MEDIUM — mostly iteration on existing bot code + git hygiene

---

## Phase 1: Commit All Session Work

### 1.1 Commit balance changes
All AR-97/97b/98/99 game code changes in a single commit:
- `src/data/balance.ts` — healing nerf, floor scaling, food prices, aegis cap
- `src/data/enemies.ts` — HP reductions, chargeResistant/chainVulnerable/quickPlayPunish traits
- `src/data/relics/starters.ts` — relic balance (iron_shield, vitality_ring, herbal_pouch, combo_ring, steel_skin, volatile_core, aegis_stone)
- `src/data/relics/unlockable.ts` — relic balance (phoenix_feather, echo_chamber, chain_reactor, festering_wound, domain_mastery_sigil, time_warp, scholars_crown, bastions_will, capacitor)
- `src/services/relicEffectResolver.ts` — updated combat math
- `src/services/cardEffectResolver.ts` — chargeResistant damage reduction
- `src/services/turnManager.ts` — chainVulnerable bonus, quickPlayPunish
- `src/dev/playtestAPI.ts` — quickPlayCard/chargePlayCard APIs
- Test updates for new values

### 1.2 Commit simulator updates
- `scripts/mass-simulate.ts` — new profiles, maxTotalTurns 3000
- `tests/playtest/core/types.ts` — chargeRate/surgeChargeRate fields
- `tests/playtest/core/combat-strategies.ts` — profile-driven charge rates
- `tests/playtest/core/headless-combat.ts` — turn limit

### 1.3 Commit Playwright bot
- `tests/playtest/playwright-bot/` — all 5 files (types, state-reader, actions, bot, runner)
- AR docs for 97-100

### 1.4 Move completed AR docs
- `AR-97-RELIC-BALANCE.md` → `completed/`
- `AR-98-PLAYER-PROFILE-REWORK.md` → `completed/`

---

## Phase 2: Bot Speed Optimization

### 2.1 Cut wait times
Current waits are 200-1500ms per action. The game's `__terraPlay` API is synchronous — we don't need to wait for animations in headless mode.

**Changes:**
- Map node click: 1500ms → 200ms
- Card play: 400ms → 100ms
- End turn: 400ms → 200ms
- Screen transitions: 1000ms → 300ms
- Main loop breathe: 100ms → 50ms

**Target:** Full 24-floor run in < 60 seconds

### 2.2 Remove debug logging
Strip all `console.log('[DEBUG]...')` and `[MAP]` lines from bot.ts.

---

## Phase 3: Bot Run Completion

### 3.1 Fix run-end detection
Add all terminal screen names to the game-over check:
- `run_end`, `game_over`, `victory`, `defeat`, `runEnd`, `runComplete`, `runSummary`

Check `__terraPlay.getRunState()` for a `completed` flag as backup.

### 3.2 Fix shop exit
The `exitRoom` API returns `{ ok: true }` but goes to "unknown" screen. Need to find the correct shop exit mechanism:
- Check for `shop-leave`, `shop-exit`, `btn-back` test IDs
- Try `__terraPlay.navigate('dungeonMap')` as fallback
- Or click the X/close button in the shop overlay

### 3.3 Handle treasure rooms
Treasure rooms give free gold. They likely show a `treasureRoom` screen with a continue button. Add:
```
case 'treasureRoom':
case 'treasure': {
  await clickTestId(page, 'btn-continue') || await clickTestId(page, 'btn-collect');
  break;
}
```

### 3.4 Handle relic reward screen
After bosses/elites, a relic reward screen appears. Add handling to pick a relic.

### 3.5 Fix floor tracking
The `readGameState` reads `runState?.floor` but `getRunState()` returns null during combat. Try reading floor from `__terraDebug().stores` or the combat state's floor field.

---

## Phase 4: Bot Strategy Layer

### 4.1 Smart card selection (not random)
Instead of random card index 0-4, read the hand and pick based on strategy:
- **basic**: play first available card
- **intermediate**: shield when enemy intent is attack, attack otherwise
- **optimal**: chain-aware (prefer same chainType), buff before attack, shield when needed

### 4.2 Context-aware charge decision
Instead of flat chargeRate, consider:
- Always charge on surge turns (free)
- Don't charge if AP would run out with cards remaining
- Charge more against chargeResistant enemies

### 4.3 Smart room selection on map
Instead of random first-row node, read node types and prefer:
- **basic**: avoid elite, prefer rest/treasure
- **intermediate**: balanced path
- **optimal**: seek elite for better rewards, rest when low HP

---

## Phase 5: Deferred Items

### 5.1 Quick Play combo damage (deferred to AR-101)
+1 damage per consecutive QP card (cap +3). Implement after bot can verify it.

### 5.2 Chain bonus damage (deferred to AR-101)
4+ chain with all correct = +20 flat bonus. Implement after bot can verify it.

### 5.3 Headless simulator archival (deferred)
Once bot is completing 100+ runs reliably:
- Move `tests/playtest/core/headless-combat.ts` to `src/_archived/`
- Keep `scripts/mass-simulate.ts` as reference but add deprecation notice
- The Playwright bot becomes the canonical balance testing tool

---

## Verification Gate

- [ ] All changes committed (3 commits: balance, simulator, bot)
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` — same pass count
- [ ] Bot completes at least 1 full run (victory or defeat at floor 10+)
- [ ] Bot run takes < 120 seconds
- [ ] No debug logging in production bot output

---

## Files Affected

### Phase 1 (commit only — already modified)
All files from AR-97 through AR-99 + bot files

### Phase 2-3 (bot fixes)
- `tests/playtest/playwright-bot/bot.ts`
- `tests/playtest/playwright-bot/runner.ts`
- `tests/playtest/playwright-bot/state-reader.ts`

### Phase 4 (strategy)
- `tests/playtest/playwright-bot/bot.ts`
- `tests/playtest/playwright-bot/actions.ts`
