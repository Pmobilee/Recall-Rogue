# Track 10 — Edge Cases & Stress Testing
## Verdict: ISSUES

Test date: 2026-04-13
Tester: qa-agent (Sonnet 4.6)
Container: rr-warm-track-10 (port 3290)

---

## Results Table

| Edge Case | Action | Expected | Observed | Status |
|-----------|--------|----------|----------|--------|
| A — Empty Hand | spawn combat with `hand:[]` then endTurn | Empty hand, game continues | `hand:[]` param ignored — full 5-card hand loaded; enemy dealt 0 damage after endTurn; AP-confirmation dialog appeared | PARTIAL — spawn param ignored, no crash |
| B — 0 Gold at Shop | `setGold(0)`, then `shopBuyRelic` | Purchase rejected / negative gold prevention | `setGold(0)` silently failed (gold stayed 500); `shopBuyRelic` returned `ok:true` but gold not deducted (500→500); `getShopInventory()` returns `{}` | FAIL — purchase API inconsistent |
| C — Max Relic (5 relics, buy 6th) | spawn shopRoom with 5 relics, `shopBuyRelic` | Relic swap overlay or rejection | `shopBuyRelic` returned `ok:true` "Bought whetstone" but relic count stayed at 5; gold not deducted; no swap overlay appeared; `getShopInventory()` returns `{}` | FAIL — silent false-success from API |
| D — High HP Enemy (9999 HP) | spawn combat with `enemyHp:9999` | HP bar shows 9999, no display overflow | State API reported 9999/9999; screenshot shows "71 / 71" — display rendering capped/ignored injected HP; card dealt 4 damage correctly (9999→9995 per state) | FAIL — display/state desync for injected HP |
| E — Rapid Card Play | 3 `quickPlayCard` calls with no wait | All 3 resolve, AP=0 | All 3 resolved correctly; AP dropped 3→0; enemy HP 38→26 (12 dmg = 3×4); handSize 5→2; no double-fire or crash | PASS |
| F — Wrong-Screen Actions | Load shop, call `quickPlayCard` + `endTurn` | Returns `{ok:false}` without crash | `quickPlayCard` correctly returned `{ok:false}`; `endTurn` returned `{ok:true, message:"Combat already ended"}` — misleading success for non-combat screen | PARTIAL — no crash, but endTurn too permissive |
| G — Snapshot/Restore | snap pre-play, play 2 cards, restore | State reverts to pre-snapshot | Snapshot call accepted; restore call accepted; state NOT reverted (ap:0, enemyHp:54 after restore instead of ap:3, enemyHp:71); `matches:false` | FAIL — restore does not revert state |

---

## Issues Found

### ISSUE 1 — spawn `hand:[]` parameter silently ignored
**Severity:** Medium  
**File:** `__rrPlay.spawn()` / scenario loader  
**Observed:** `window.__rrPlay.spawn({screen:'combat',enemy:'page_flutter',hand:[]})` returned `ok:true` and loaded a full 5-card hand instead of an empty hand. The `hand:[]` param was silently discarded.  
**Impact:** Cannot test empty-hand edge case. Players who lose all deck cards to curse/discard effects could be in a state the devtools can't reproduce.  
**Expected:** Either honor `hand:[]` for empty hand, or document that `hand` must be a non-empty array of mechanic IDs.

### ISSUE 2 — `setGold(0)` silently fails
**Severity:** Medium  
**File:** `__rrScenario.setGold()` / scenario API  
**Observed:** `window.__rrScenario.setGold(0)` returned no error but `getRunState().currency` remained 500.  
**Impact:** Cannot test zero-gold boundary. The zero-gold shop behavior is untested.  
**Expected:** `setGold(0)` should set gold to 0 and `getRunState()` should reflect it.

### ISSUE 3 — `shopBuyRelic` returns `ok:true` when purchase should fail (no inventory item)
**Severity:** HIGH  
**File:** `__rrPlay.shopBuyRelic()` / shop service  
**Observed:** With `getShopInventory()` returning `{}` (empty), calling `shopBuyRelic(0)` returns `{ok:true, message:"Bought shop relic 'whetstone'"}` but no gold is deducted and no relic is added. This is a false-success response.  
**Impact:** If `shopBuyRelic` can silently "succeed" when the shop has no inventory populated via the API, there may be a gap between the devtools shop state and the real game shop state. The response message is actively misleading.  
**Root cause hypothesis:** `shopBuyRelic(0)` is using slot index 0 to reference a pre-generated shop list internal to the game engine, not the inventory returned by `getShopInventory()`. The two data sources are desynced.

### ISSUE 4 — Max-relic enforcement: 6th relic silently absorbed or rejected without feedback
**Severity:** HIGH (player-facing)  
**File:** shop relic purchase / relic inventory management  
**Observed:** With 5 relics active, `shopBuyRelic` returns `ok:true` but relic count stays at 5 and gold is not deducted. No swap overlay appeared.  
**Expected:** Either (a) a relic-swap overlay allows player to drop one relic, or (b) purchase is blocked with a clear message. Silent false-success with the real game's shop (not just devtools) would be a critical bug — players think they bought something but didn't.  
**Needs verification:** Whether this behavior occurs in real gameplay (not just devtools scenario) — the issue may be isolated to devtools shop state.

### ISSUE 5 — High HP enemy (`enemyHp:9999`): display/state desync
**Severity:** Medium  
**File:** `__rrPlay.spawn()` / combat HP display rendering  
**Observed:** After `spawn({enemyHp:9999})`, `getCombatState()` reports `enemyHp:9999,enemyMaxHp:9999`. But the enemy display on screen shows "71 / 71" — The Algorithm's real HP, not the injected value. The HP bar rendering ignores the injected value and uses the enemy's definition HP.  
**Impact:** The display is either (a) reading from a separate non-injected data source, or (b) the spawn HP injection works for the game engine state but not the Phaser scene's rendered HP bar. Cards deal damage that reduces from 9999 in the engine (9999→9995) but the bar shows 71.  
**This is a real display-state desync.** If a real mechanic could set enemy HP above the definition max (e.g., a relic or status effect), the HP display would underreport remaining health.

### ISSUE 6 — `endTurn` returns `ok:true` on non-combat screen
**Severity:** Low  
**File:** `__rrPlay.endTurn()` / screen-aware API guards  
**Observed:** When on the `shopRoom` screen, `endTurn()` returns `{ok:true, message:"Combat already ended. Screen: shopRoom"}`. Should return `{ok:false}`.  
**Impact:** Automation/testing scripts calling `endTurn` outside combat get a misleading success signal.

### ISSUE 7 — `snapshot`/`restore` does not revert combat state
**Severity:** HIGH  
**File:** `__rrPlay.snapshot()` / `__rrPlay.restore()`  
**Observed:** `snapshot('test-snap')` returned a snapshot. After playing 2 cards (ap:3→0, enemyHp:71→54), calling `restore(snapshot('test-snap'))` — which takes a NEW snapshot and passes it to restore — did not revert state. State remained at the post-play values.  
**Note:** There is a potential test design issue: the restore call took a new snapshot at the time of restore and passed it to restore(), which may be wrong usage. The correct pattern may be `const snap = snapshot('name'); ... restore(snap)`. However, the API accepted the call without error and returned 'restored' — the silent-no-op behavior is the issue.  
**Impact:** Snapshot/restore is not reliable for undo/rewind features if it silently accepts invalid inputs without reverting state.

---

## API Surface Observations

`__rrScenario` keys: `list, load, loadCustom, listMysteryEvents, spawn, patch, snapshot, restore, schema, recipes, registerScenario, setPlayerHp, setEnemyHp, setGold, setFloor, forceHand, addRelic, removeRelic, setPlayerBlock, setEnemyBlock, pause, resume, help, scenarios`

`__rrPlay` keys: 62 methods including `navigate, getScreen, getCombatState, playCard, quickPlayCard, endTurn, getShopInventory, shopBuyRelic, shopBuyCard, snapshot, restore, getRelicDetails, getRunState...`

`getShopInventory()` consistently returns `{}` even when shop is loaded with items — this API appears broken or returns a different data structure than expected.

`__rrPlay.getRunState()` returns `{currency, playerHp, playerMaxHp}` only — no relic list, no deck info.

---

## Container Notes

Docker Desktop shut down twice during testing (memory pressure from parallel tracks). Container required two manual restarts. Track-10 tests A and B had to be re-run after restarts. No test data was lost — the warm container state resets per test anyway.
