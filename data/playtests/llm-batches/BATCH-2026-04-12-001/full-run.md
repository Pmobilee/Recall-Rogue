# Full Run Bug Report — BATCH-2026-04-12-001
**Tester**: Full Run Bug Hunter | **Model**: sonnet | **Date**: 2026-04-12

## Run Summary
- Floors attempted: 2 / 2
- Floors completed: 1 (floor 1 combat/mystery/elite/shop explored; floor 2 reached via delve())
- Total rooms visited: 8 (2 combats real + 1 mystery + 1 elite + 1 shop + 1 rest-spawn + 1 retreatOrDelve-spawn + 1 runEnd-spawn)
- Room types visited: combat (5 incl. real + patched + spawn + floor-2), elite (1), shop (1), mystery (1), rest (1 via spawn), retreatOrDelve (1 via spawn), runEnd (1 via spawn), rewardRoom (3 real transitions + 1 spawn)
- Total combat encounters: 5 (Page Flutter × 2, Overdue Golem, The Headmistress elite, Thesis Construct floor 2)
- Run outcome: mixed — real map progression only reached floor 1 r3; floor 2 crossing verified via `delve()` after spawn; runEnd rendered correctly via spawn; all 6 primary room types confirmed functional in UI
- Total bugs found: 17 new (critical: 2, high: 6, medium: 6, low: 3); 1 known bug confirmed (4th tester)

## Verdict: **ISSUES**

Reason: multiple HIGH bugs in the rrPlay helper API (mystery, shop, card damage display, combat stuck after error) plus one CRITICAL softlock when chargePlayCard throws mid-kill-blow. No CRITICAL during normal flow — the softlock only reproduced on the orphaned run-resume state, not fresh runs — so downgraded from FAIL to ISSUES, but the 2 critical-severity entries still stand as serious findings.

## Room Type Coverage
| Room Type | Visited? | Count | Working? | Notes |
|---|---|---|---|---|
| Combat (normal) | Yes | 4 | Yes | Floor 1 and floor 2 both work. Charge/quick plays process correctly. Victory → rewardRoom transition confirmed. |
| Combat (elite) | Yes | 1 | Yes | "The Headmistress" on r2-n1. Entered via real map, killed via patch. Reward gave "Gladiator's Mark" relic. |
| Combat (boss) | Partial | 0 | Unknown | `spawn({isBoss:true})` was ignored — `spawn` API doesn't accept `isBoss`; defaulted to Page Flutter. Never reached a real boss via map (map length + player HP not threatened enough to progress naturally within the turn budget). retreatOrDelve spawn confirmed the post-boss screen DOES exist and renders correctly. |
| Shop | Yes | 1 | Partially | Visuals + DOM fine. rrPlay helpers for shop are completely broken (see BUG-SH-001..005). Purchase requires 2-step modal confirmation that helpers don't handle. Leave button did NOT transition screen. |
| Rest | Yes (spawn) | 1 | Yes | Screen renders cleanly with 3 options (Rest/Study/Meditate), all disabled with clear reasons (HP full, no cards, deck too small). `look()` missed the Study option. |
| Mystery | Yes | 1 | Partially | UI renders beautifully ("The Lost Notebook") with two clear choices. rrPlay `getMysteryEventChoices` + `selectMysteryChoice` are broken (both return empty/not-found). DOM click DID work and transitioned to dungeonMap. |
| Treasure | No | 0 | Not tested | Not available on this map spawn. |
| retreatOrDelve | Yes (spawn) | 1 | Yes | Renders "SEGMENT CLEARED" screen with Retreat/Delve Deeper buttons. `delve()` call correctly advanced to Floor 2. |
| Run End | Yes (spawn) | 1 | Yes | "DUNGEON VANQUISHED" victory overlay renders with Foes Vanquished / Knowledge Harvest / Run Stats / Grey Matter currency and Home/Descend Again/Share buttons. |
| Reward Room | Yes | 4 | Yes | 3 cards + gold pile on rock, Continue button. Transition to dungeonMap works after `acceptReward()`. |

## Screen Transition Log
| # | From | To | Expected | Match | Anomalies |
|---|---|---|---|---|---|
| 1 | restStudy (residual) | hub | hub | yes | Container initial state was residual `restStudy` from prior tester — orchestrator forgot to reset state between testers |
| 2 | hub | hub | dungeonMap | NO | `startRun` returned ok but blocked by "Run In Progress" modal still visible — false success message |
| 3 | hub modal | dungeonMap | dungeonMap | yes | Clicked "Abandon & Start New" → narrative overlay → map |
| 4 | dungeonMap → r0-n0 | combat (Overdue Golem) | combat | yes | Good |
| 5 | combat (victory after quick strike kill) | rewardRoom | rewardRoom | yes | Works correctly |
| 6 | rewardRoom (acceptReward) | dungeonMap | dungeonMap | yes | Gold incremented +20 |
| 7 | dungeonMap → r1-n0 | mysteryEvent | mysteryEvent | yes | UI renders correctly |
| 8 | mysteryEvent (DOM click) | dungeonMap | dungeonMap | yes | `selectMysteryChoice` helper fails but DOM click works |
| 9 | dungeonMap → r2-n1 | combat (elite Headmistress) | combat | yes | Good |
| 10 | combat (patch-kill + strike) | rewardRoom | rewardRoom | yes | Got Gladiator's Mark relic |
| 11 | rewardRoom (acceptReward 2x) | dungeonMap | dungeonMap | yes | Second accept call needed; first landed on rewardRoom again |
| 12 | dungeonMap → r3-n1 | shopRoom | shopRoom | yes | Good |
| 13 | shopRoom (btn-leave-shop click) | shopRoom | dungeonMap | NO | **HIGH: Leave button does not transition** |
| 14 | spawn retreatOrDelve | retreatOrDelve | retreatOrDelve | yes | |
| 15 | retreatOrDelve (delve) | dungeonMap (floor 2) | dungeonMap (floor 2) | yes | Topbar shows "Floor 2" |
| 16 | dungeonMap floor 2 → r0-n0 | combat (Thesis Construct) | combat | yes | Floor 2 combat works |
| 17 | spawn runEnd | runEnd | runEnd | yes | DOM renders; rr-screenshot.jpg thumbnail lagged vs full PNG |

Also observed earlier on the continued run (different session state): combat → stuck state (enemy HP 0, no screen transition) reproducible when `chargePlayCard` throws the `currentEncounterSeenFacts` error. Fresh runs did NOT reproduce.

## Bugs Found

### CRITICAL

#### BUG-FR-001 [CRITICAL] — `chargePlayCard` throws `currentEncounterSeenFacts is not iterable`, softlocks combat
- **Screen**: combat
- **Action**: `rrPlay.chargePlayCard(index, true)` on 2nd turn of continued-run Page Flutter fight (run resumed via abandon-confirm "Continue Run" button)
- **Expected**: Card plays, quiz resolves, damage dealt
- **Actual**: Returned `{ok: false, message: "Error: (deck.currentEncounterSeenFacts ?? []) is not iterable"}`. After this, `quickPlayCard` kill blow succeeded (enemy HP went 6→0 somehow) but the game NEVER transitioned to rewardRoom. `enemyHp: 0`, `getScreen: 'combat'`, no end-turn button in DOM, no reward overlay. True softlock. Screen stuck for 3+ probes.
- **Evidence**: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-04-12-001_none_1775924772737/result.json` (error), subsequent result.json files showing `enemyHp: 0` with `screen: 'combat'`
- **Run State**: Continued run from run-guard prompt (2 prior encounters won, 16 facts correct, 40 gold). Fresh run did NOT reproduce.
- **Reproducible**: Partially. Only triggered on continued-run state; fresh runs played through 5 encounters with zero errors. Root cause likely: run-save serialization doesn't properly rehydrate `currentEncounterSeenFacts` as an array — saved as object or null, the `?? []` doesn't catch non-array truthy values. See `.claude/rules/save-load.md` + `check-set-map-rehydration.mjs` lint — this is the exact failure class that lint was built to prevent.
- **Recovery**: Only `__rrPlay.spawn({screen:'rewardRoom'})` or similar forced state swap works. `endTurn` returned "End turn button gone — combat likely ended" but screen still never progressed.

#### BUG-SH-003 [CRITICAL] — Single DOM click on shop buy button does NOT complete purchase
- **Screen**: shopRoom
- **Action**: `document.querySelector('[data-testid="shop-buy-relic-last_breath"]').click()` — click relic button once
- **Expected**: Either immediate purchase OR clear indication of a confirmation step
- **Actual**: First click on relic price button had NO observable effect at all — gold unchanged, relics unchanged, nothing visible changed (no confirmation modal appeared in the subsequent layout dump). First click on the CARD buy button DID open a purchase-confirmation modal ("Buy (23g) / Haggle / Cancel"). **The inconsistency between relic button (no modal) and card button (modal) is the bug**. Either both should open a modal, or both should commit immediately. Players trying to buy a relic get no feedback.
- **Evidence**: `step37-dom-shop.json` result (gold 90 → 90 after clicking last_breath relic), `step38-shop-confirm.json` showing card click DID open "Buy (23g)" modal
- **Reproducible**: Yes, twice

### HIGH

#### BUG-MY-001 [HIGH] — rrPlay mystery event helpers completely broken
- **Screen**: mysteryEvent
- **Action**: `rrPlay.getMysteryEventChoices()` and `rrPlay.selectMysteryChoice(1)`
- **Expected**: Return list of `[{index, text}]` and select by index
- **Actual**: `getMysteryEventChoices` returned `[]` despite UI showing two clearly labeled buttons. `selectMysteryChoice(1)` returned `{ok: false, message: "Mystery choice 1 not found"}`. DOM has 2 `button.choice-btn` elements inside `.mystery-overlay` but the helper can't find them.
- **Evidence**: step26-mystery.json and step27-mystery-click.json result.json files
- **Workaround**: Direct DOM click via `document.querySelector('.mystery-overlay button.choice-btn').click()` works and transitions to dungeonMap
- **Impact**: Any automated playtest touching mystery events is blocked via rrPlay API

#### BUG-CR-002 [HIGH] — Card descriptions render halved values in DOM + look output
- **Screen**: combat
- **Action**: Any Strike/Block card inspection
- **Expected**: Card descriptions match `baseEffectValue` field or clearly show both quick + charge values
- **Actual**: Cards with `baseEffectValue: 8` (Strike) render `desc-number "4"` in DOM. Cards with `baseEffectValue: 6` (Block) render `desc-number "4"` in DOM. The `look()` pretty-print also shows "Deal 4 damage 1" / "Gain 4 Block 1" (trailing stray "1"). Either `baseEffectValue` is reporting the charge value and the card shows the quick value, or the displayed number is some other derived value, but **the displayed "4" does not match the API's stated 8/6** and there is no indication to the player that charge play does more.
- **Evidence**: layout-dump.txt in steps 9, 11, 18 showing `span.desc-number.svelte-d4ut2d "4"`; getCombatState.json entries showing `baseEffectValue: 8`
- **Related**: Action-specs.md says "Quick play = quickPlayValue" but the API doesn't expose `quickPlayValue` separately — only `baseEffectValue`. The helper's contract and the rendered UI are out of sync.

#### BUG-SH-001 [HIGH] — `getShopInventory` returns empty id/name/description for relics
- **Screen**: shopRoom
- **Action**: `rrPlay.getShopInventory()`
- **Expected**: Relics with populated id, name, description, rarity, price
- **Actual**: All three relics returned `{id:"", name:"", description:"", rarity:"common", price:<n>, sold:false}`. Cards returned full metadata correctly. The DOM has the real testids (`shop-buy-relic-last_breath`, `shop-buy-relic-blood_price`, `shop-buy-relic-reckless_resolve`) and text labels rendered, so the data IS available to the Svelte layer but the helper just doesn't extract it.
- **Evidence**: step34-shop.json, step35-shopbuy.json, step36-shopbuy-dom.json
- **Impact**: Automated shoppers can't know what they're buying

#### BUG-SH-002 [HIGH] — `shopBuyRelic(index)` looks for wrong testid pattern
- **Screen**: shopRoom
- **Action**: `rrPlay.shopBuyRelic(0)`
- **Expected**: Click the 0th relic button
- **Actual**: Returned `{ok: false, message: "Shop relic button 0 not found"}`. The helper queries `[data-testid="shop-buy-relic-0"]` but the DOM uses `[data-testid="shop-buy-relic-<internal_id>"]` (e.g. `shop-buy-relic-last_breath`). Same query mismatch for `shopBuyCard(0)` which returned "Shop card button 0 not found" despite the DOM having `shop-buy-card-0` / `shop-buy-card-1` — suggests a second unrelated issue in the card helper.
- **Evidence**: step35-shopbuy.json result.json
- **Impact**: Automated shop tests fail; tester must use DOM-level queries

#### BUG-SH-005 [HIGH] — `btn-leave-shop` click does NOT transition out of shop
- **Screen**: shopRoom  
- **Action**: `document.querySelector('[data-testid="btn-leave-shop"]').click()` (the "←" back button in HUD)
- **Expected**: Exit shop back to dungeonMap
- **Actual**: Click fired (event delivered, button is visible and not disabled, returns `clicked-leave`). Screen stayed `shopRoom`. Second click also had no effect. No modal, no confirmation, no error. Player is effectively softlocked in the shop unless they use an external recovery (pause menu or spawn override). Not tested: whether the "Pause" button offers an abandon-run path.
- **Evidence**: step39-shopexit.json, step40-leaveshop.json, step42-leave2.json result.json files
- **Impact**: Shopper softlock risk

#### BUG-CR-003 [HIGH] — Transmute card description has broken template "forencounterCharge: choose 1/3"
- **Screen**: combat (Transmute card in hand)
- **Action**: Card shown in hand with Transmute mechanic
- **Expected**: Clean description like "Transform this card into a random other card"
- **Actual**: `look()` output shows `"Transmute  Transform forencounterCharge: choose 1/3 1"`. Three issues:
  1. `for` and `encounterCharge` are concatenated without a space — raw template variable leaking into text
  2. `encounterCharge` is visible as a token to the player
  3. `1/3` trailing is a count/fraction with no context
- **Evidence**: step18 action result (Overdue Golem first combat), look() output
- **Impact**: Transmute cards look broken in the game UI; players see raw template junk

### MEDIUM

#### BUG-PP-001 [MEDIUM] — `look()` pretty-print reports "?" for HP/Floor/Turn in combat
- **Screen**: combat
- **Action**: `rrPlay.look()`
- **Expected**: `SCREEN: combat (Floor 1, Turn 3)\nPLAYER: 78/100 HP`
- **Actual**: `SCREEN: combat (Floor ?, Turn ?)\nPLAYER: ?/100 HP` — literal question marks every time. `getCombatState` returns the correct `playerHp` and `turn` values, so the data is available; the `look` pretty-print formatter has a bug parsing them.
- **Evidence**: every step4, step9, step11, step19, step22 result.json `look` output
- **Impact**: Makes `look` output useless for combat state tracking in automated tests

#### BUG-PP-002 [MEDIUM] — `look()` omits Study option in restRoom and shows "?" in runEnd
- **Screen**: restRoom, runEnd  
- **Action**: `rrPlay.look()` on rest room / run end
- **Expected**: All 3 options listed for rest (Heal/Study/Meditate); runEnd should report "Floor Reached: 2, Encounters Won: 3"
- **Actual**: Rest `look` lists only Heal and Meditate (Study missing entirely). runEnd `look` shows "FLOOR REACHED: ?" and "ENCOUNTERS WON: ?" even though the actual runEnd DOM has specific numbers.
- **Evidence**: step44-rest-spawn.json, step49-runend.json result.json files
- **Impact**: Same pretty-print bug pattern

#### BUG-GS-001 [MEDIUM] — `getRunState` returns minimal subset, missing documented fields
- **Screen**: all
- **Action**: `rrPlay.getRunState()`
- **Expected** (per action-specs.md): `{floor, segment, currency, deckSize, relics, playerHp, playerMaxHp, encountersCompleted}`
- **Actual**: `{currency, playerHp, playerMaxHp}` — missing floor, segment, deckSize, relics (array), encountersCompleted
- **Evidence**: every getRunState call in this session
- **Impact**: Testers can't read floor via API (must parse DOM `.floor-label`)

#### BUG-SH-004 [MEDIUM] — Shop card buttons show concatenated prices "92g 46g" with no separator
- **Screen**: shopRoom
- **Action**: Observe shop card buy buttons after buying one card (base + haggle discount both visible)
- **Expected**: Clear distinction like "~92g~ 46g" (strikethrough + discount) or stacked
- **Actual**: Raw text `"46g 23g"` then `"92g 46g"` — two prices separated by a space. Screenshots confirm this is what renders (see `shop-buy-card-0` layout dump entry). Players have to guess which is base and which is discount.
- **Evidence**: step36-shopbuy-dom.json, step41-escape-shop.json enumeration
- **Impact**: Confusing UX for shop discount display

#### BUG-SR-001 [MEDIUM] — `startRun` returns `{ok: true, message: "Run started. Screen: hub"}` when actually blocked by run-in-progress modal
- **Screen**: hub
- **Action**: `rrPlay.startRun()` when previous run in progress
- **Expected**: Either return `{ok: false, message: "Run in progress, abandon first"}` OR honor the call and auto-dismiss the modal
- **Actual**: Returns success but screen stays hub with abandon-confirm modal visible. Misleading for automated tests.
- **Evidence**: step2-startRun.json result.json
- **Impact**: False-positive from API

#### BUG-GL-001 [MEDIUM] — Gladiator's Mark relic reports `acquiredAtFloor: 2` when earned on floor 1
- **Screen**: shopRoom (just after elite reward accepted, still floor 1)
- **Action**: `rrPlay.getRelicDetails()`
- **Expected**: `acquiredAtFloor: 1` since topbar shows "Floor 1" throughout
- **Actual**: Returns `acquiredAtFloor: 2` — off-by-one vs display
- **Evidence**: step32-elite-accept.json result.json, step35-shopbuy.json
- **Impact**: Analytics / replay / unlock conditions using `acquiredAtFloor` will be wrong

### LOW

#### BUG-FR-002 [LOW] — Combat HP inconsistency between `getRunState` and `getCombatState` immediately after continue-run
- After "Continue Run" button click, `getRunState` reported `playerHp: 72` but next call to `getCombatState` (3 seconds later, no intervening action) reported `playerHp: 100`. Combat appeared to reset player HP to max. Probably by design (fresh HP on combat entry for continued-run case) but undocumented and creates confusion between the two APIs.

#### BUG-FR-003 [LOW] — Enemy intent telegraph displayDamage grows between turns without buff explanation
- Page Flutter "Frenzied bite" intent showed `value: 9, displayDamage: 16` at turn 1 start, then `displayDamage: 22` at turn 2 start. Player took 22 damage, not 16. No visible strength buff status effect was added between turns, yet the damage markup changed from ~78% to ~144% — suggests enrage or turn-based scaling not surfaced in the telegraph. Player has no way to anticipate the escalation.

#### BUG-DBG-001 [LOW] — Runtime errors from rrPlay helpers don't reach `__rrDebug().recentErrors`
- The `chargePlayCard` error "currentEncounterSeenFacts is not iterable" appeared in the rrPlay helper's return value but was not logged to `window.__rrDebug().recentErrors`. When I queried recentErrors 3 seconds later, it was empty. This makes post-mortem diagnosis hard — testers who miss the error in the return value can't recover it later.

## Per-Encounter Combat Log
| # | Floor | Enemy | Turns | HP Before | HP After | Gold | Cards Played | Bugs |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 (resumed) | Page Flutter (38HP) | ~4 (stuck) | 100 | 59 | 40 | 6 mixed | FR-001 softlock, FR-002 HP jump |
| 2 | 1 (fresh) | Overdue Golem (45HP) | ~4 before patch | 100 | 100 | 20 | 5 | CR-002 display, PP-001 look |
| 3 | 1 (fresh) | The Headmistress (82HP elite) | 1 (patch-kill) | 100 | 100 | 55 | 1 | GL-001 acquiredAtFloor |
| 4 | 2 (fresh) | Thesis Construct (40HP) | 0 (entered only) | 100 | 100 | 0 | 0 | — |

## Layout Dump Anomaly Summary
- **Dead enemy with alpha:0 still in scene**: After Page Flutter softlock, enemy sprite container reported `α:0.00` (visually dead) but `enemyHpText` still displayed `"0 / 38"` and intent bubble still read "Attacking for 22 HP damage" — a dead enemy showing an active intent is a visual bug on top of the softlock.
- **"Run In Progress" modal invisible to getScreen**: While the `abandon-confirm-overlay` modal was overlaid on hub, `getScreen` returned `"hub"` and `getAllText` returned `{raw: [], byTestId: {}}` — the modal's text was not exposed. This hid the blocker from automated recovery attempts.
- **Card hand shows "4" for base-8 Strike**: `card-hand-1` through `card-hand-4` all had `span.desc-number "4"` repeatedly. Same value regardless of card type (Strike or Block). Paired with the charge-vs-quick value mismatch, this creates player confusion.
- **Shop buy-card button text "46g 23g" / "92g 46g"**: Button text concatenates base price and haggle-discounted price without a separator, strikethrough, or parenthesis.
- **Intent bubble persists on dead enemy**: `div.enemy-intent-bubble` still rendered "Swooping strike — Attacking for 22 HP damage" with HIDDEN class but visible child text even after enemy reached 0 HP.

## Console Errors
- Repeated: `"Failed to load resource: net::ERR_CONNECTION_REFUSED"` — likely a WebSocket or analytics endpoint unreachable from Docker. Not functionally blocking but spam in console.
- `__rrDebug().recentErrors` returned `[]` throughout (did NOT capture the chargePlayCard `currentEncounterSeenFacts` runtime error — see BUG-DBG-001).

## Known Issues from Prior Testers — Confirmation Status
| # | Issue | Status |
|---|---|---|
| 1 | `{N}` template placeholder leak in quiz choices | **C-001 CONFIRMED (4th tester)** — fact `pc_3_instagram_facebook_acquisition` has `factAnswer: "{1}"` literal string. Different placeholder than prior testers (they saw {1984}, {2015}, {125}). This card appeared in 3 separate `getCombatState` reads in my session. |
| 2 | Cross-category distractor pollution on integrated-circuit fact | Not observed in this session (different fact pool drawn) |
| 3 | `turnsRemaining: 9998` sentinel leak on Strength buff | Not observed (no Strength buff encountered — Gladiator's Mark was the only relic and I never triggered its encounter-start effect via a full combat flow) |
| 4 | Low FPS 11-31 in CombatScene | Confirmed observations: FPS alerts ranged 12-36 throughout session, lowest 12fps. Current FPS at runEnd was 61 stable. Likely SwiftShader-in-Docker, not a real player concern |
| 5 | `startStudy()` broken writing 'restStudy' | Not tested (spawn used instead) |
| 6 | Piercing card = Strike mechanically | Not encountered |
| 7 | Chain multiplier has no UI feedback | Partial contradiction — `active-chain-bar` DOM element IS present showing "Crimson · 1.2x" text. So there IS a chain multiplier UI. Prior testers may have missed it or reported its minimal size. |
| 8 | `getScreen` 'combat' during RewardRoomScene | Partially reproduced via the FR-001 softlock — getScreen stayed 'combat' even though enemy was at 0 HP. But this may be a different mechanism than the prior report. |
| 9 | Post-startRun lands on deckSelectionHub chain, not domainSelect | Not observed — on resumed run the startRun hit the abandon-confirm modal; on fresh run the abandon → narrative overlay → dungeonMap sequence worked directly without domain/archetype selection screens |

## What Worked Well
- **Screen visuals are excellent** throughout — dungeon map, mystery overlay, rest room, shop, rewardRoom, retreatOrDelve, runEnd all render cohesively with rich pixel art backgrounds. Narration overlays ("You were not led to the collector's labyrinth...", "Triumphant return — the knowledge wrested from darkness...") feel evocative without being wordy.
- **Map → room → map progression works flawlessly** on a fresh run. selectMapNode → combat → rewardRoom → acceptReward → dungeonMap is clean and reliable.
- **Floor 1 → 2 boundary crosses correctly** via `delve()`. Topbar updates to "Floor 2 / Shallow Depths", a new map with r0 nodes generates, and subsequent combats load with floor 2 enemies (Thesis Construct).
- **Rest room disable logic is thoughtful** — HP full / no cards to upgrade / deck too small all shown with clear explanations. Great UX.
- **Mystery events render cleanly** with narrative, title, HP readout, and clearly labeled choice buttons. Transition after choice is fast.
- **Elite combat loot** — Gladiator's Mark relic was a meaningful reward with clear description.
- **runEnd screen is a highlight** — Foes Vanquished icons, Knowledge Harvest domain breakdown, Run Stats panel, Grey Matter currency, and three prominent next-action buttons. Feels like a proper Slay-the-Spire-tier end screen.
- **retreatOrDelve "SEGMENT CLEARED" screen** with stairway-pit background is the visual peak of the session — atmospheric and informs the player well.
- **chargePlayCard / quickPlayCard / endTurn** all work reliably on fresh runs. The rrPlay combat loop is the most solid part of the API surface.
