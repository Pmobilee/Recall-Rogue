# Combat Mechanics

> **Purpose:** Turn-based combat loop, AP system, damage pipeline, and play modes as implemented in code.
> **Last verified:** 2026-04-22 (reactive-damage victory path fix, handleEndTurn reentrancy guard, intent-source-of-truth + multi_attack per-hit cap, card-preview source-of-truth, determinism fixes: Transmute mechanic pick, Scavenge/Forge/Mimic/MasterySurge shuffle, tag-magnetism draw roll — all seeded)
> **Source files:** `src/services/turnManager.ts`, `src/services/cardEffectResolver.ts`, `src/services/playerCombatState.ts`, `src/data/balance.ts`, `src/services/coopEffects.ts`, `src/services/enemyDamageScaling.ts`, `src/services/intentDisplay.ts`, `src/services/multiplayerCoopSync.ts`

---

## Turn Structure

Phases are defined by the `TurnPhase` type: `'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end'`.

The encounter begins with `startEncounter()`: initializes `TurnState`, resets chain/aura/review-queue, draws 5 opening cards via `drawHand()`.

**Player action phase:** Player calls `playCardAction()` repeatedly until AP is exhausted, then calls `endPlayerTurn()`.

**`endPlayerTurn()` executes in order:**
1. `onPlayerNoCharge` enemy callback (if player made no Charge plays)
2. `dispatchEnemyTurnStart()` — enrage and Brain Fog hooks
3. `enemy.block = 0` — enemy block decays
4. `executeEnemyIntent()` — enemy attacks/defends/buffs (or skipped if staggered/slowed)
5. `takeDamage(playerState)` — shield absorbs first, then HP
6. `resolveLethalEffects()` — death-save relic checks (`last_breath`, `phoenix_feather`)
7. `tickPlayerStatusEffects()` — poison/regen tick on player
8. `tickEnemyStatusEffects()` — poison tick on enemy; Bleed decays by `BLEED_DECAY_PER_TURN`
9. `resolveTurnEndEffects()` — relic hooks (perfect turn bonus, etc.)
10. `resetTurnState(playerState, currentAct)` — shield decays (act-aware: 15%/25%/35% for Act 1/2/3), AP refills, chain resets
11. `drawHand()` — draw 5 new cards for next turn

**Turn counters:** `turnNumber` is global (run-level, drives Surge system); `encounterTurnNumber` resets to 1 per encounter. **Note:** Enrage system removed (Pass 3 balance, 2026-04-09) — `getEnrageBonus()` always returns 0. Fights are balanced via enemy stats, not invisible timers.

> **See also:** For floor transition effects between encounters, see Floor Descent Ceremony in `docs/mechanics/progression.md`.

---

## Enemy Entrance Reveal

When a new encounter begins, the enemy emerges from shadow rather than popping in abruptly. `EnemySpriteSystem.playEntranceReveal(isBoss)` is called 1800ms into `CombatScene.playEncounterEntry()` (after the scene fade-in and HUD pop-in complete). `DepthLightingSystem.animateLightsIn()` runs in parallel.

**Common/elite (800ms total):**
- Initial state: container alpha=0, scale=0.3, y=baseY-40, mainSprite tint=0x000000
- Phase 1 (650ms, Sine.easeOut): alpha to 1, scale to 1.05, y to baseY; tint lerps from black to atmosphere tint in `onUpdate`
- Phase 2 (150ms, Sine.easeInOut): scale to 1.0; micro screen shake fires on complete; `startIdle()` begins

**Boss (1200ms total):**
- Initial state: alpha=0, scale=0.2, y=baseY-60, tint=0x000000; 3% camera zoom (yoyo, 700ms)
- Phase 1 (700ms, Sine.easeOut): alpha to 1, scale to 0.85, y to baseY-8; tint lerps to 80% of atmosphere tint
- Phase 2 (200ms hold): constant values (suspense pause)
- Phase 3 (300ms, Back.Out): scale to 1.0, y to baseY; tint lerps to 100%; heavy screen shake on complete; `startIdle()` begins

**Reduce-motion path:** Sets final values immediately, calls `startIdle()`. No animation.

**Lighting sync:** `DepthLightingSystem.animateLightsIn(durationMs)` zeroes all point light intensities then lerps them back to their base values over the same duration as the sprite reveal, using a 16ms timer. No-op on low-end devices or when no pipeline is active.

**Scene-alive guard:** All `screenShake?.trigger()` calls inside `onComplete` are wrapped with `if (this.scene?.scene?.isActive())` to prevent errors when `tweens.killAll()` fires during shutdown.

**Legacy fallback:** `playEntry(isBoss)` (the pop-in effect) is kept as a deprecated method but is no longer called by `CombatScene`.

---

## Turn Transition Breathing Room

`encounterBridge.handleEndTurn()` uses a **two-beat timing structure** so the enemy attack visually lands at the correct moment (not at the same instant the player turn begins):

**Beat 1 — Enemy turn begins (1s):**
- Cards hidden immediately via a `preAnimTurnState` with `deck.hand = []` — stale hand cannot be interacted with during the enemy phase
- `playCardAudio('enemy-turn-start')` fires
- `CombatScene.playTurnTransitionToEnemy()` runs concurrently:
  - Transient `Rectangle` overlay (depth 2, black, alpha 0 → 0.12 over 250ms) darkens the arena
  - Enemy container scales to 1.02× and back over 200ms (awakening pulse)
  - `atmosphereSystem.spikeParticleRate(400)` doubles front emitter rate for 400ms
- `await sleep(turboDelay(1000))` — player registers that the enemy turn has begun

**Beat 2 — Enemy attack resolves (1s):**
- `endPlayerTurn(turnState)` executes all enemy logic (damage, status ticks, draw)
- `activeRunState` updated with post-damage `playerHp` immediately — HP commit and attack animation fire at the same visible moment
- Enemy VFX/SFX dispatched based on `result.executedIntentType`
- Chain visuals updated for post-turn chain state
- Co-op: `broadcastPartnerState()` called with post-damage values
- `await sleep(turboDelay(1000))` — damage settles visually

**Player turn begins:**
- `activeTurnState.set(freshTurnState(result.turnState))` — real hand restored, player regains control
- `playCardAudio('turn-chime')` + `CombatScene.playTurnTransitionToPlayer()`:
  - Fades and destroys the overlay from Beat 1
  - `pulseFlash(0xFFEEAA, 0.06, 200)` — warm flash signals player agency returning
  - Dispatches `rr:player-turn-start` CustomEvent for `CardHand.svelte` to animate cards in

**Timing totals:** 2s normal (1s + 1s), both beats shortened by `turboDelay()` in turbo mode.

**Reduce-motion / turbo-mode:** All Phaser tweens suppressed. The overlay is still destroyed if present.

**State:** The transient overlay is held in `CombatScene._turnOverlay` (private field, cleaned up in `onShutdown()`).

> **Updated 2026-04-09:** Previously used a single 2s dead-air delay with `endPlayerTurn` called before the pause, causing the enemy attack VFX to fire at the same instant as the new player turn. The two-beat structure ensures each phase has a clear 1s window.

## Turn-End Hand Hiding

`encounterBridge.handleEndTurn()` immediately publishes a `preAnimTurnState` with `deck.hand = []` when the player ends their turn. This hides the player's cards before the enemy phase plays out, preventing interaction with stale hand state. The real hand is restored when `activeTurnState` is updated at the start of the next player turn.

```typescript
// encounterBridge.ts — Beat 1 setup
const preAnimTurnState = { ...freshTurnState(turnState), deck: { ...turnState.deck, hand: [] } };
activeTurnState.set(preAnimTurnState);
// ... 1s beat 1 ...
const result = endPlayerTurn(turnState);
// ... enemy VFX, 1s beat 2 ...
activeTurnState.set(freshTurnState(result.turnState)); // restore real hand
```

The empty-hand trick uses the current (pre-damage) `turnState` — it does not require `endPlayerTurn` to have run yet, which is why Beat 1 can safely hide cards before the enemy phase executes.

## handleEndTurn Reentrancy Guard (2026-04-18)

`handleEndTurn` is `async` with two 1-second `await` pauses. During these pauses, the function is suspended and the event loop can dispatch other events. Before this fix, the `preAnimTurnState` set at Beat 1 had `phase: 'player_action'` (from the spread of the current turn state), which left the End Turn button enabled — `endTurnDisabled` in CardCombatOverlay only checked `phase`. A second End Turn call during the enemy phase would:

1. Both calls share references to the same `drawPile`/`discardPile` arrays
2. Both calls run `endPlayerTurn()` which mutates these shared arrays
3. The second call's result overwrites the first's in the store
4. Deck state corrupts — double-draws, empty hands, AP anomalies
5. Game freezes permanently

**Fix:** Module-level `_endTurnInProgress` flag + exported `endTurnInProgress` writable store in `encounterBridge.ts`. The flag is set at the top of `handleEndTurn` and cleared in a `finally` block. The store is the reactive mirror consumed by `endTurnDisabled` in `CardCombatOverlay.svelte`.

**Reset points:** `_endTurnInProgress` is reset to `false` in:
- `startEncounterForRoom()` — new encounter begins
- `resetEncounterBridge()` — new run / playAgain

**UI wiring:** `endTurnDisabled` in `CardCombatOverlay.svelte` now includes `$endTurnInProgress`, so both the End Turn button and the keyboard Enter shortcut (which checks `endTurnDisabled`) are blocked during the enemy phase.


---

## AP (Action Points) System

| Constant | Value |
|---|---|
| `START_AP_PER_TURN` | 3 |
| `MAX_AP_PER_TURN` | 5 |
| `AP_PER_ACT` | `{ 1: 3, 2: 4, 3: 4 }` — Act 2+ gives 4 AP/turn |
| Normal card cost | `getEffectiveApCost(card)` — prefers `MASTERY_STAT_TABLES[id].levels[N].apCost`, falls back to seeded `card.apCost` (`src/services/cardUpgradeService.ts`) |
| Charge surcharge | +1 AP added to `apCost` |
| `FIRST_CHARGE_FREE_AP_SURCHARGE` | 1 (constant kept for save-format compatibility; the free-charge branch was removed from `playCardAction` on 2026-04-10) |
| `SURGE_BONUS_AP` | 1 — bonus AP at the start of Surge turns |
| `RunState.startingAp` | `START_AP_PER_TURN = 3`; set at run creation in `gameFlowController.onArchetypeSelected()` |
| `TurnState.startingApPerTurn` | Mirrors `RunState.startingAp`; threaded in by `encounterBridge.startEncounterForRoom()`. Per-turn floor: `baseAp = Math.max(AP_PER_ACT[act], startingApPerTurn)` in `endPlayerTurn`. |

**Act-aware AP:** Floors 1-6 = Act 1 (3 AP), floors 7-12 = Act 2 (4 AP), floors 13+ = Act 3 (4 AP). More AP in later acts gives players room to charge and combo under heavier enemy pressure.

> **Issue 7 fix (2026-04-11):** Prior to this fix, `encounterBridge` set `apMax = startingAp` instead of `apCurrent = startingAp`, causing Act 2's 4 AP unlock to be ignored. Fixed by threading `startingApPerTurn` through `TurnState` and using `Math.max(AP_PER_ACT[act], startingApPerTurn)` as the per-turn base.

**Surge turns** (`isSurgeTurn(turnNumber)`; turns 2, 6, 10, 14, ...) grant two bonuses at the start of the turn:

- `+SURGE_BONUS_AP` (+1 AP) — a flexible resource; surge still pays full `CHARGE_AP_SURCHARGE`. Changed from surcharge-waiver to AP-grant (Pass 3 balance, 2026-04-09).
- `+SURGE_DRAW_BONUS` (+1 card drawn) — added to `drawCount` in `endPlayerTurn` alongside the base draw and any flow-state bonus.

**Combined draw on surge turns:** base 5 + `SURGE_DRAW_BONUS` 1 + `flow_state` bonus 1 (when fog ≤ 2) = **7 cards total**. The flow-state bonus fires when `getAuraState() === 'flow_state'`; fog starts at 0 each encounter so flow_state is active from the first turn unless the player has accumulated fog from wrong answers.

Charge plays add +1 AP surcharge. Surcharge waivers (checked in priority order in `playCardAction`):
1. **Warcry buff** — `warcryFreeChargeActive` flag (consumed on use)
2. **Chain Momentum** — `CHAIN_MOMENTUM_ENABLED = true`; previous correct Charge waives surcharge for next same chain-type Charge
3. **Active Chain Color Match** (7.6 fix) — `card.chainType === getActiveChainColor()`; charging a card that matches the current active chain color waives the surcharge. After a mid-turn color switch (see chains.md), `getActiveChainColor()` returns the newly pivoted color — so the switched-to color immediately benefits from this waiver.
4. **Free First Charge** (REMOVED, 2026-04-10) — The `else if (isFirstChargeFree(...))` branch was deleted from `playCardAction`. `FIRST_CHARGE_FREE_AP_SURCHARGE` constant and `firstChargeFreeFactIds` RunState field are kept for save-format compatibility but no longer written or read during charge resolution. Chain color matching is the intended free-charge mechanism.
5. **Free Play Charges** — `turnState.freePlayCharges > 0` — set by frenzy mechanic or `focus_next2free` tag; reduces AP cost to 0 (highest priority — checked AFTER Focus discount)

If `apCurrent < apCost`, card is blocked (`blocked: true`, no AP deducted). AP cost is resolved via `getEffectiveApCost(card)` which reads the mastery-level override before falling back to the seeded `card.apCost`.

---

## Damage Pipeline

Computed in `resolveCardEffect()` (`cardEffectResolver.ts`):

1. **Mechanic base** — `getMasteryStats(mechanicId, masteryLevel).qpValue` (QP) or `qpValue × CHARGE_CORRECT_MULTIPLIER` (CC = 1.50×) or `FIZZLE_EFFECT_RATIO × baseEffectValue` (CW = 0.50×)
   - Note: stat table `qpValue` at L0 may be LOWER than `mechanic.quickPlayValue` — stat tables override the mechanic definition
   - `chargeCorrectValue` field on `MechanicDefinition` is dead data — never read by the resolver
   - CW has `Math.max(0, ...)` floor to prevent negative values
2. **Player strength/weakness modifier** — `getStrengthModifier(playerState.statusEffects)` — multiplied against base attack damage. Strength: +25% per stack; Weakness: −25% per stack; floor: 0.25×. Applied inside `applyAttackDamage()` in `cardEffectResolver.ts`. Does NOT affect shield cards.
3. **Cursed multipliers** (if `card.isCursed`) — QP: 0.7×, CC: 1.0×, CW: 0.5×
4. **Inscription of Fury bonus** — flat add for attack cards from `activeInscriptions`
5. **Speed/trick bonus** — speed bonus (`SPEED_BONUS_MULTIPLIER = 1.0×` — disabled as of 2026-04-09; timer still enforces urgency but no damage multiplier. Speed bonus is relic-only via Quicksilver Quill) × trick question unlock (2.0×)
6. **Chain base adjustment** — `chainAdjustedBase = round(qpValue × chainMultiplier)` — chain scales the mechanic base value only, before all other multipliers. See docs/mechanics/chains.md for per-card-type behavior.
7. **Relic modifiers** — `resolveAttackModifiers()` / `resolveShieldModifiers()`
8. **Enemy modifiers** — QP damage multiplier, hardcover armor, `chargeResistant` (−50% QP), `chainVulnerable` (+50% chain damage)
9. **Burn trigger** — `triggerBurn()`: bonus = current stacks, then stacks halve (multi-hit fires per hit)
10. **Bleed bonus** — `getBleedBonus()`: flat `BLEED_BONUS_PER_STACK` per stack

Final damage: `applyDamageToEnemy(enemy, damageDealt)`. Enemy HP ≤ 0 → `result = 'victory'`.

**Tier multipliers (@deprecated):** `card.effectMultiplier` is set by `TIER_MULTIPLIER[tier]` in `cardFactory.ts` but has no gameplay effect for active tiers — T1/T2a/T2b all = 1.0, making it a no-op multiplier. Tiers drive quiz difficulty ONLY. T3 = 0× (card becomes a passive and leaves the active hand). Power scaling is governed exclusively by mastery stat tables.

**Knowledge Chain multipliers** (`CHAIN_MULTIPLIERS`): [1.0, 1.2, 1.5, 2.0, 2.5, 3.5] at chain lengths 0–5.
Chains decay **proportionally** per turn end (`CHAIN_DECAY_RATE=0.5`): `ceil(length × 0.5)` points removed each turn, so higher chains lose more absolute length while retaining partial momentum. Source: `chainSystem.ts: decayChain()`.
Chain applies at step 6 to the mechanic base value only — overclockMultiplier and buffMultiplier are separate pipeline steps applied to the chain-adjusted base (rework 2026-04-13). See docs/mechanics/chains.md.

---

## Play Modes

**Quick Play (`playMode = 'quick'`)**
- No quiz; fires at `getMasteryStats(mechanicId, level).qpValue`
- No +1 AP surcharge
- Breaks the Knowledge Chain
- Locked cards (Trick Question) cannot be played Quick
- If no Charge play was made the entire turn (Quick Play only, or no cards played), fog drifts up by 1 (`adjustAura(1)`) at `endPlayerTurn()` — AR-261

**Charge Correct (`playMode = 'charge'`, `answeredCorrectly = true`)**
- Damage = `getMasteryStats().qpValue × CHARGE_CORRECT_MULTIPLIER (1.50×)`
- The qpValue already encodes full mastery progression — no separate masteryBonus added
- Extends Knowledge Chain
- Mastery upgrade eligible
- Costs `apCost + 1` (with waivers)
- Decrements fog by 1 (`adjustAura(-1)`)
- Clears fact from review queue

**Charge Wrong (`playMode = 'charge'`, `answeredCorrectly = false`)**
- Partial effect at `FIZZLE_EFFECT_RATIO = 0.50×` of base effect — always resolves, never zero
- Raised from 0.25→0.40 (Pass 4) then 0.40→0.50 (Pass 6): wrong charges are tempo costs not punishment. At CC=1.50×, 0.50× fizzle is still below QP (1.0×)

### Charge Wrong Values

Each mechanic defines explicit `chargeWrongValue` — typically 60-75% of `quickPlayValue`:
- Strike: QP=4, CW=3 (75%)
- Block: QP=3, CW=2 (67%)
- Heavy Strike: QP=10, CW=7 (70%)

The `FIZZLE_EFFECT_RATIO` (0.50×) is a FALLBACK for cards without explicit CW values, not the default.
Additionally, the first Charge of any fact in a run uses 1.0× multiplier on wrong (same as QP) — see Discovery System.
- Breaks Knowledge Chain, loses Chain Momentum
- Mastery downgrade (skipped on first attempt at a fact, `isFirstAttempt` flag)
- Adds fact to `cursedFactIds` if `masteryLevel === 0` and not first attempt
- Increases fog by 1 (`adjustAura(1)`)
- AP deducted — no refund on wrong answer

After balance constant changes (fizzle ratio, charge multipliers, AP costs), run `/balance-sim` then `/advanced-balance` for per-card contribution and tension metrics.

---

## Card Acquisition and Catch-Up Mastery

When a player picks a new card as a reward mid-run, `encounterBridge.addRewardCardToActiveDeck()` calls `computeCatchUpMastery()` (`catchUpMasteryService.ts`) to assign a starting mastery level proportional to the deck's current average. This prevents late-game picks from being dead on arrival.

- Deck avg < 1 → new card starts at L0 (early game, no catch-up)
- Deck avg ≥ 1 → starting level = `floor(rand(0.5–1.5) × avgMastery)`, capped at mechanic's `maxLevel`

**Transmute (permanent, 2026-04-09):** The `transmute` mechanic permanently replaces a card in the run deck. `resolveTransmutePick()` in `turnManager.ts` removes the source card and inserts the transformed card with:
- `factId` kept from the source card (fact binding preserved)
- New `id: 'transmute_' + random` (independent identity)
- Catch-up mastery via `computeCatchUpMastery()` (same as reward cards)
- No `isTransmuted` flag — transformed cards are NOT reverted at encounter end

`revertTransmutedCards()` still runs at encounter end but only affects cards with `isTransmuted: true && originalCard` set (conjure, mimic) — not transmuted cards.

See `docs/mechanics/cards.md` — Catch-Up Mastery section for full details.

**Determinism (seeded RNG, 2026-04-22):** All random decisions that affect combat outcomes in a multiplayer run use the seeded RNG via `getRunRng(label)` from `src/services/seededRng.ts`. When no run RNG is active (tests, solo non-run contexts), these fall back to `Math.random()`. The affected systems and their fork labels are:

| System | Fork label | File |
|--------|-----------|------|
| Tag Magnetism draw-swap roll (`tag_magnet` relic) | `tagMagnetism` | `deckManager.ts` |
| Transmute mechanic pick from pool | `cardEffects` | `turnManager.ts` |
| Scavenge candidate shuffle | `debuffTarget` | `turnManager.ts` |
| Forge candidate shuffle | `debuffTarget` | `turnManager.ts` |
| Mimic random-3 shuffle (mastery < 2) | `debuffTarget` | `turnManager.ts` |
| Mastery Surge hand selection shuffle | `debuffTarget` | `turnManager.ts` |

All shuffles use `seededShuffled(rng, array)` from `seededRng.ts` — a correct Fisher-Yates implementation, replacing the biased `.sort(() => Math.random() - 0.5)` pattern that produced non-uniform permutations.

---

## Enemy Damage Scaling Pipeline

Enemy attack damage passes through two layers before `takeDamage()` is called:

**Layer 1 — `executeEnemyIntent()` in `enemyManager.ts`:**
1. `intent.value × strengthMod × getFloorDamageScaling(floor) × GLOBAL_ENEMY_DAMAGE_MULTIPLIER`
2. `enemy.difficultyVariance` (0.8–1.2× for common enemies, fixed at instance creation)
3. Brain Fog aura (+20% if aura state is 'brain_fog')
4. Segment damage cap — **single hit**: `min(damage, ENEMY_TURN_DAMAGE_CAP[segment])`; **multi_attack**: per-hit cap `min(perHit, floor(cap / hits))` then `total = perHit × hits`. Bypassed if `intent.bypassDamageCap`.

**Current tuned values (pass 2, 2026-04-09):**
- `GLOBAL_ENEMY_DAMAGE_MULTIPLIER = 1.60` (tuned 2.0→1.5→1.60: raised back in Pass 4d — 1.40 was too easy base; run-level Canary provides asymmetric adjustment)
- `ENEMY_TURN_DAMAGE_CAP = { 1: 16, 2: 22, 3: 32, 4: 56, endless: null }` (Act 2 capped 28→22, Act 3 capped 40→32)

**Layer 2 — `turnManager.ts` (applied to `intentResult.damage`):**
5. Enrage bonus (runtime: added after layer 1, re-capped — **excluded from intent display**)
6. Segment cap re-applied after enrage (only when enrage actually fired)
7. Glass Cannon relic penalty (runtime: depends on player HP — **excluded from intent display**)
8. Self-Burn bonus (runtime: depends on player burn stacks — **excluded from intent display**)

> **Intent as Source of Truth (2026-04-18):** Items 7-9 of the old layer 2 (relaxed/ascension/canary) are NO LONGER re-applied at execution time. They are baked into `lockedDisplayDamage` at intent-roll time. `turnManager.ts` uses `lockedDisplayDamage` as the incoming damage value, then adds only enrage (runtime-only) and player-side modifiers. This eliminates display drift where the UI showed 16 but the executor dealt 11 because canary scaled differently between snapshot and execution.

**Shared helper — `applyPostIntentDamageScaling(baseDamage, ctx)` in `src/services/enemyDamageScaling.ts`:**
Used by `computeIntentDisplayDamageWithPerHit()` (display pipeline) to apply relaxed/ascension/canary. NOT called in the execution path anymore — those multipliers are already baked into `lockedDisplayDamage`.

**Intent display pipeline — `src/services/intentDisplay.ts`:**

`computeIntentDisplayDamageWithPerHit(intent, enemy, scalingCtx?)` — the canonical computation function:
- Returns `{ total, perHit }` for multi_attack; `{ total, perHit }` where `total === perHit` for regular attack.
- For multi_attack: applies per-hit cap (`floor(segmentCap / hits)`), then `total = perHit × hits`.
- Ensures `total = perHit × hits` exactly — no rounding artifacts from hitting the total cap.
- `computeIntentDisplayDamage()` delegates here and returns just `total`.

`computeIntentDisplayDamageWithPerHitSnapshot(intent, enemy, playerState, scalingCtx?)` — snapshot variant:
- Returns `{ total, perHit }` pinned to state at intent-roll time.
- Called by `turnManager.ts` after every `rollNextIntent()`.
- Stores `total` on `enemy.lockedDisplayDamage`, `perHit` on `enemy.lockedDisplayDamagePerHit`.

`computeIntentHpImpact(intent, enemy, playerBlock, act, scalingCtx?)` — for UI display:
- Returns `{ raw, postDecayBlock, hpDamage }`.
- `raw` = TOTAL damage (same as `computeIntentDisplayDamage`).
- `postDecayBlock` = full current block (no decay — see Bug 2 fix).
- `hpDamage` = `Math.max(0, raw − postDecayBlock)`.

**multi_attack per-hit cap (2026-04-18):** The executor (`executeEnemyIntent`) and display pipeline (`computeIntentDisplayDamageWithPerHit`) both use per-hit capping for multi_attack: `perHitCap = floor(segmentCap / hits)`, then `total = min(perHit, perHitCap) × hits`. This ensures `total = perHit × hits` is exact — no split between what the display shows and what the player takes. Previously the display applied the total cap to the computed total, while the executor multiplied hits after computing per-hit; this produced total-cap vs per-hit-cap mismatches when hits > 1.

**Block does NOT decay before the enemy attacks (Bug 2 fix, 2026-04-18):** The previous implementation incorrectly applied act-aware block decay inside `computeIntentHpImpact` and in the `displayImpact` helper in `CardCombatOverlay.svelte`. The actual turn order in `endPlayerTurn()` is:
- Step 4: `executeEnemyIntent()` — enemy attacks
- Step 5: `takeDamage(playerState)` — uses the FULL current block
- Step 10: `resetTurnState(playerState, act)` — block decays HERE, after the attack

The `act` parameter on `computeIntentHpImpact` is retained for call-site compatibility but is no longer used — no decay is applied.

**UI wiring (updated 2026-04-18):** `CardCombatOverlay.svelte` `displayImpact(intent, enemy)` helper uses `enemy.lockedDisplayDamage` (TOTAL for multi_attack) as raw, subtracts the full current block (no decay), and returns `{ raw, postDecayBlock, hpDamage }`. Multi-attack bubble now shows `hits×perHit` (raw pre-block damage) so the player can see the breakdown at a glance — e.g. `3×5` for 3 hits of 5 each. `enemy.lockedDisplayDamagePerHit` is the source of truth; falls back to `Math.round(raw / hits)`. Intent detail line shows:
- No block: "${hits}×${perHit} = ${raw} HP damage"
- Partial block: "${hits}×${perHit} = ${raw} − ${block} block = ${hpDamage} HP"
- Fully blocked: "Fully blocked (${hits}×${perHit} = ${raw} absorbed)"

Buff follow-up intent (multi_attack): bubble shows `hits×perHit`; detail shows "Buffs ${desc}, then ${hits}×${perHit} = ${raw} damage".

**`EnemyInstance.lockedDisplayDamage` / `lockedDisplayDamagePerHit` fields:**
Snapped at intent-roll time by `turnManager.ts` after every `rollNextIntent()` call.
- `lockedDisplayDamage` — TOTAL damage (Layer 1 + Layer 2 fully applied). Used as source of truth in execution.
- `lockedDisplayDamagePerHit` — per-hit value for multi_attack intents; `undefined` for single-hit intents.
- `lockedFollowUpDisplayDamage` / `lockedFollowUpDisplayDamagePerHit` — same for buff follow-up intents.

Backward compat: `undefined` on pre-fix saves — execution falls back to `executeEnemyIntent()` computed value.

---

## Card Preview Source of Truth (2026-04-18)

The card face shows the exact value the execution pipeline will apply -- no drift between display and effect.

### Architectural Principle

Two parallel "what you see is what you get" systems were introduced in the 2026-04-18 session:

1. **Enemy Intent SOT** -- enemy attack display is locked at intent-roll time (`lockedDisplayDamage`); executor reads this field directly.
2. **Card Preview SOT** -- after `resolveCardEffect()` and all post-resolver bonuses, the preview computed from the card face overrides `effect.shieldApplied` / `effect.damageDealt`.

Both systems eliminate the failure mode where two independent computation paths (display pipeline and execution pipeline) drift apart as card state changes between when the card is rendered and when it is played.

### Card Preview Pipeline

**Flow (commits ea74c7380, 2cb712323, 1d233c935):**

1. `CardCombatOverlay.svelte` computes `damagePreviews[cardId]` via `computeDamagePreview(card, ctx)` for every card in hand. This map holds `{ qpValue, ccValue }` -- the exact numbers shown on each card face.
2. When a card is played, the UI passes `damagePreviews[cardId]` (the ACTUAL displayed value) through the callback chain: `CardCombatOverlay` -> `encounterBridge.handlePlayCard()` -> `turnManager.playCardAction(cardPreview)`.
3. In `playCardAction`, the preview value is stored early for later use.
4. After `resolveCardEffect()` fires and all post-resolver bonuses apply, the preview override fires:
   - **Shield override** -- applied right before `applyShield()` so no subsequent modifier can mutate it.
   - **Damage override** -- applied right before Burn/Bleed bonuses, which are separate status effects that the preview intentionally excludes.

**Why pass the UI value instead of recomputing?** The state at play time has already changed: chain may have extended (adding one more correct answer), `cardsPlayedThisTurn` was incremented, buffs may have been consumed. Recomputing inside `turnManager` produces 0-1 value drift from what the player saw. Passing the UI value directly gives zero-drift.

### Skip Conditions (`_skipPreviewOverride` flag)

The preview override is suppressed in these cases -- the resolver value is used as-is:

| Condition | Reason |
|-----------|--------|
| Charge Wrong (fizzle) | Fizzle is intentional underperformance; preview shows CC value, not CW |
| Multi-hit cards | Per-hit structure differs; preview total does not map to a single override |
| `iron_wave` | Dual effect (damage + shield); single preview value cannot represent both |
| RNG bonus relics fired (`lucky_coin`, `crit_lens`, `mirror`, `scholars_crown`, `double_down`) | Preview correctly omits these surprise bonuses; they should land on top |

### Source Files

| File | Role |
|------|------|
| `src/services/damagePreviewService.ts` | `computeDamagePreview(card, ctx)` -- computes QP and CC preview values shown on card faces. Canonical source of truth for card display values. |
| `src/services/turnManager.ts` | `playCardAction(card, playMode, answeredCorrectly, cardPreview)` -- accepts preview from UI, applies override after resolver. `_skipPreviewOverride` flag controls suppression. |
| `src/services/encounterBridge.ts` | `handlePlayCard()` -- bridges UI callbacks to turnManager, forwards `previewValue`. |
| `src/ui/components/CardCombatOverlay.svelte` | Computes `damagePreviews` for all cards in hand. Passes preview at all 4 `onplaycard` call sites. |

---

## Win/Lose Conditions

**Victory:** `enemy.currentHP <= 0` via `applyDamageToEnemy()` or status ticks. Sets `result = 'victory'`, `phase = 'encounter_end'`.

**Reactive-damage victory (2026-04-18 fix):** The enemy can die during the *enemy turn* via reactive-damage sources — `pain_conduit` HP-reflect, `thorned_vest` thornReflect, `thorns` card mechanic, or `counterDamage` (parry_counter3). `endPlayerTurn()` now checks `result === 'victory'` immediately after all reactive-damage paths resolve and returns early (before resetting AP or drawing the next hand). `handleEndTurn()` in `encounterBridge.ts` checks the same flag after the post-combat 1s pause and executes the full victory cleanup path (cooldown, auto-cure, healing, currency, accuracy grade, `notifyEncounterComplete('victory')`) instead of reactivating the player turn. Without both guards the game freezes permanently: the guard at the top of `endPlayerTurn()` (`if (result !== null)`) fires on every subsequent call and returns an empty stub.

**Defeat:** `playerState.hp <= 0` after `takeDamage()` or poison ticks. `resolveLethalEffects()` checked first — `last_breath` relic saves to 1 HP (once per encounter); `phoenix_feather` saves to a % of maxHP and grants 1 turn of auto-Charge. If no save: `result = 'defeat'`, `phase = 'encounter_end'`.

## Run Termination State Machine (added 2026-04-10)

When an encounter ends with `result = 'defeat'` or the player retreats, the run must terminate correctly through the RunEndScreen. **No path may jump directly to hub.**

```
encounter result = 'defeat'  OR  player clicks Retreat
        |
gameFlowController.onEncounterComplete('defeat') / onRetreat()
        |
finishRunAndReturnToHub(run, endData, summary)
  - calls endRun(run, 'defeat'|'retreat') -> builds RunEndData
  - awards XP, currency, achievements
  - clears activeRunState
  - sets activeRunEndData (RunEndScreen reads this)
  - calls currentScreen.set('runEnd')  <- INVARIANT: always runEnd, never hub
        |
CardApp renders RunEndScreen (currentScreen === 'runEnd')
  - shows floor reached, facts, accuracy, XP gained, defeated enemies
        |
Player clicks 'Play Again' -> playAgain() -> currentScreen.set('hub')
Player clicks 'Return to Hub' -> returnToMenu() -> currentScreen.set('hub')
```

**Termination paths and their handler:**

| Trigger | Handler | Goes through finishRunAndReturnToHub? |
|---|---|---|
| playerHp <= 0 (combat death) | `onEncounterComplete('defeat')` | Yes |
| Player retreats (retreat/delve screen) | `onRetreat()` | Yes |
| Player abandons run (hub confirm dialog, `encountersWon >= 1`) | `abandonActiveRun()` | Yes — routes through `runEnd` screen as defeat, awards XP, records journal entry |
| Player abandons run (hub confirm dialog, `encountersWon === 0`) | `abandonActiveRun()` | No — silent discard, no data to show |
| RunPreview "Back" button (no encounters started) | `abandonActiveRun(returnScreen?)` | No — navigates to `returnScreen` (default `hub`), no encounters completed |
| Campfire exit (run preserved) | `returnToHubFromCampfire()` | No — run is saved, not ended |

**Regression test:** `src/services/gameFlowController.termination.test.ts` (MEDIUM-10).
**Rule doc:** `.claude/rules/save-load.md` (Run Lifecycle Termination Invariants subsection).

---

## Post-Encounter Healing

Post-encounter auto-heal is **disabled** (2026-04-01). All three heal constants in `balance.ts` are 0:

- `POST_ENCOUNTER_HEAL_PCT = 0` — no base heal after victory
- `RELAXED_POST_ENCOUNTER_HEAL_BONUS = 0` — no extra heal in Relaxed mode
- `POST_BOSS_ENCOUNTER_HEAL_BONUS = 0` — no extra heal after boss/mini-boss

Healing during a run comes exclusively from **potions** (consumable items). The heal-cap table (`POST_ENCOUNTER_HEAL_CAP`) is retained in `balance.ts` as it may be reused if the feature is re-enabled, but has no effect while base heal is 0.

The reward screen (`CardRewardScreen.svelte`) skips the heal UI step when `healAmount === 0`, so no UI change is needed.

---

## Debuff Mechanics — Explicit Cases

`expose` and `weaken` have explicit `case` branches in `cardEffectResolver.ts` (added 2026-04-01). Before this fix both fell through to the generic debuff fallback which applied wrong effects (weakness instead of vulnerable for expose; 0 stacks for weaken due to low finalValue).

- `expose` — applies Vulnerable stacks: QP=1 stack, 1 turn. CC=max(1, round(finalValue)) stacks, 2 turns.
- `weaken` — applies Weakness stacks: QP=1 stack, 1 turn. CC=max(1, round(finalValue)) stacks, 2 turns.
- **Player Weakness effect** — when the player has Weakness stacks, `getStrengthModifier(playerState.statusEffects)` returns < 1.0, and `applyAttackDamage()` multiplies base attack damage by that value (fixed 2026-04-01). Previously player Weakness had no effect on outgoing player damage.
- **Damage Preview** — `DamagePreviewContext.playerStrengthModifier` (optional, defaults to 1.0) mirrors this in the preview pipeline. Wired from `getStrengthModifier(ps.statusEffects)` in `CardCombatOverlay.svelte`.

---

## Shield (Block)

- `applyShield(state, amount)` — stacks additively
- `takeDamage()` — shield absorbs first, then HP; `immunity` status absorbs after shield
- `resetTurnState()` — block **persists** across turns (capped at `BLOCK_CARRY_CAP_MULTIPLIER × maxHP = 2× maxHP`). Block no longer decays to 0 each turn (changed 2026-04-01 balance pass).
- `persistentShield` — `fortress_wall` relic's `blockCarries` flag still applies; fortify mechanic remains differentiated as the primary persistent-block card
- Enemy block resets to 0 at start of enemy turn — enemies must re-defend each turn

## Thorns (Retaliation)

- `thorns` card mechanic: reflects `thornsValue` damage back to enemy after each enemy attack
- **Stacks additively** — multiple thorns plays in one encounter add to `turnState.thornsValue` (changed 2026-04-01)
- **Persists for entire encounter** — no longer resets after each enemy attack; resets only at `startEncounter()` (changed 2026-04-01)
- `aegis_stone` relic: grants `+2 thorns` at end of turn if block ≥ `RELIC_AEGIS_STONE_MAX_CARRY` — also additive
- `thorns_persist` tag (thorns L5) and `reactive_thorns_persist` tag (reactive_shield L5): sets `turnState.thornsPersistent = true`. When set, `thornsValue` is NOT reset to 0 at the end of the enemy attack phase — it persists across the turn boundary. `encounterBridge` must carry `thornsPersistent` + `thornsValue` into the next encounter's `TurnState` init.

---

## Tag-Based Mastery Features in cardEffectResolver (2026-04-06)

`resolveCardEffect()` now checks cumulative mastery tags via `hasTag('tag_name')`. Tags are set in `MASTERY_STAT_TABLES` and read via `getMasteryStats().tags`.

Key behavioral changes driven by tags:
- **Shield mechanics**: `fortify_carry` (blockCarries), `brace_exceed2/brace_draw1`, `overheal_heal2/pct5`, `parry_counter3`, `reinforce_draw1`, `shrug_cleanse1`, `guard_taunt1t`, `absorb_draw2cc/absorb_heal1cc`, `reactive_thorns_persist`, `bulwark_no_exhaust`, `conversion_bonus_50pct/keep_block`, `burnout_no_exhaust` (burnout_shield L5: CC no longer forgets), `knowledge_ward_cleanse` (knowledge_ward L3+: cleanse 1 debuff on any play)
- **Buff mechanics**: `empower_2cards`, `quicken_draw1/draw2/ap2`, `focus_draw1/next2free`, `insc_fury_cc_bonus2`, `insc_iron_thorns1`
- **Debuff mechanics**: `hex_vuln1t`, `slow_any_action/slow_weak1t`, `sap_weak2t/strip3block`, `corrode_vuln1t/strip_all`, `expose_dmg3`, `corrtouch_vuln1t`, `bash_vuln2t`, `stagger_weak1t`

## turnManager Wiring of CardEffectResult Fields (2026-04-06)

All new `CardEffectResult` fields are now wired in `playCardAction()` and `endPlayerTurn()`. New `TurnState` fields added to support them:

| TurnState field | Type | Driven by | Behavior |
|---|---|---|---|
| `freePlayCharges` | number | `frenzyChargesGranted`, `freePlayCount` | AP cost → 0 per play; decrements per card; reset at turn end |
| `counterDamagePerHit` | number | `counterDamage` (parry_counter3) | Deals N damage to enemy after each enemy attack; reset each turn |
| `timerExtensionPct` | number | `timerExtensionPct` (precision_timer_ext50) | Quiz system reads this to extend the timer; reset at turn end |
| `eliminateDistractors` | number | `eliminateDistractor` (siphon_eliminate1) | Quiz system removes N wrong answers; reset at turn end |
| `thornsPersistent` | boolean | `thornsPersist` (thorns_persist / reactive_thorns_persist) | Prevents thornsValue from clearing after enemy attack |
| `archiveBlockBonus` | number | `archiveBlockBonus` (archive_block2_per) | Bonus block applied to archive-retained cards; reset at turn end |
| `empowerRemainingCount` | number | `empowerTargetCount` (empower_2cards) | Keeps buffNextCard active for N cards; reset at turn end |
| `igniteRemainingAttacks` | number | `igniteDuration` (ignite_2attacks) | Ignite buff persists for N attack plays instead of 1 |
| `forcedAttackTurnsRemaining` | number | `tauntDuration` (guard_taunt1t) | Overrides rollNextIntent to select attack intent for N turns |
| `pendingScryCount` | number | `scryCount` (scout_scry2) | UI reads this to show scry picker; auto-resolves as fallback |

**Result fields handled inline (no new TurnState field):**

| Field | Tag | Wired behavior |
|---|---|---|
| `apRefund` | eruption_refund1 | Refunds N AP after card resolution |
| `apGain` | trance_cc_ap1 | Grants N additional AP this turn |
| `healPctApplied` | overheal_heal_pct5 | Heals N% of maxHP immediately |
| `removeDebuffCount` | shrug_cleanse1, knowledge_ward_cleanse | Removes N player debuffs (shortest duration first) |
| `bleedPermanent` | rupture_bleed_perm | Sets bleed `turnsRemaining = 99999` sentinel; bleed decay skips this status |
| `freePlayCount` | focus_next2free | Added to `freePlayCharges` pool |
| `frenzyChargesGranted` | frenzy | Added to `freePlayCharges` pool |
| `slowAnyAction` | slow_any_action | Sets `_slowAnyActionThisTurn` module flag; endPlayerTurn widens slow to any intent type |
| `empowerTargetCount` | empower_2cards | Sets `empowerRemainingCount`; buffNextCard persists until count exhausted |
| `igniteDuration` | ignite_2attacks | Sets `igniteRemainingAttacks`; ignite buff survives N attacks |
| `catalystTriple` | catalyst_triple | Multiplies poison/burn/bleed stacks by 3× instead of 2× |
| `poisonDoubled` | catalyst | Doubles enemy poison stacks |
| `burnDoubled` | catalyst_burn | Doubles enemy burn stacks |
| `bleedDoubled` | catalyst_bleed | Doubles enemy bleed stacks (skips permanent bleed) |
| `masteryBumpsCount` | mastery_surge | Bumps N random hand cards by `masteryBumpAmount` levels |
| `masteryBumpAmount` | msurge_plus2 | Controls levels per bump (default 1, msurge_plus2 = 2) |
| `blockCarries` | fortify_carry | Sets `persistentShield` to current shield value |
| `darkHealPerCurse` | dark_heal1_per_curse | Heals 1 HP per cursed fact at resolve time |
| `recollectUpgrade` | recollect_upgrade1 | Bumps mastery on the most recently returned forgotten cards |
| `recollectPlayFree` | recollect_play_free | Adds 1 to `freePlayCharges` |
| `synapseChainBonus` | synapse_chain_plus1 | Extra `extendOrResetChain()` calls when wildcard link is active |
| `fluxDouble` | flux_double | Re-fires the unstable_flux effect at 50% (damage) or 100% (block/draw) |
| `discardDamage` | sift_discard_dmg2 | Deals N × discardCount damage after sift |
| `inscriptionFuryCcBonus` | insc_fury_cc_bonus2 | Increases fury inscription's effectValue by N |
| `inscriptionIronThorns` | insc_iron_thorns1 | Grants N thorns immediately when iron inscription CC fires |

**UI-layer flags (no TurnState mutation — consumed by CardCombatOverlay/quiz system):**

| Field | Tag | Who reads it |
|---|---|---|
| `timerExtensionPct` | precision_timer_ext50 | Quiz system reads `turnState.timerExtensionPct` |
| `eliminateDistractors` | siphon_eliminate1 | Quiz system reads `turnState.eliminateDistractors` |
| `pendingScryCount` | scout_scry2 | CardCombatOverlay reads `turnState.pendingScryCount` |
| `recycleChoose` | recycle_discard_pick | CardCombatOverlay reads from `PlayCardResult.effect.recycleChoose` |
| `mimicChoose` | mimic_choose | CardCombatOverlay reads from `PlayCardResult.effect.mimicChoose` |
| `aftershockNoQuiz` | aftershock_no_quiz | Aftershock resolution UI |
| `kbombCountPast` | kbomb_count_past | Knowledge Bomb resolver (uses `totalChargesThisRun` vs encounter count) |

**Still pending (encounterBridge wiring needed):**
- `thornsPersist` — `encounterBridge` must carry `thornsPersistent` + `thornsValue` from one encounter's TurnState into the next `startEncounter()` call
- `blockConsumed` (conversion) — reduce player shield by this amount after damage is dealt

---

## Weapon-Enemy Impact Timing (2026-04-06)

Sword slash and tome cast animations defer the enemy hit reaction to the weapon's visual contact frame rather than firing at T+0 (when the card resolves):

- **Sword:** `playPlayerAttackAnimation(onImpact?)` passes a callback to `playSwordSlash()` that fires at T+250ms (slash apex). The old 110ms bob tween on the enemy container was removed — `EnemySpriteSystem.playHit()` provides richer knockback.
- **Tome:** `playPlayerCastAnimation(cardType?, onImpact?)` passes a callback to `playTomeCast()` that fires at T+330ms (glow burst peak = 250ms rise + 80ms glow).
- **Shield / wrong answers:** No weapon animation plays; enemy hit reaction fires immediately (no callback path).

`encounterBridge` constructs `hitCallback = () => scene.playEnemyHitAnimation()` when `damageDealt > 0 && !enemyDefeated && hasWeaponAnimation`. The `onImpact` closure in `CombatScene` also spawns 5 impact spark particles at the enemy position (warm yellow `0xFFFF88` for sword; chain color for tome).

Screen shake for the sword (micro shake) fires at the same T+250ms contact frame — it was already at the correct time and required no change.

---

## Enrage System

`getEnrageBonus(encounterTurnNumber, floor, enemyHpPercent)` returns flat bonus added to all enemy attacks.

Uses `ENRAGE_SEGMENTS` (floor-based): Phase 1 ramps at `ENRAGE_PHASE1_BONUS` (+2/turn, raised from +1 on 2026-04-09) for `ENRAGE_PHASE1_DURATION` (3) turns; Phase 2 escalates at `ENRAGE_PHASE2_BONUS` (+4/turn, raised from +2 on 2026-04-09 — fights dragging past enrage should get scary fast). Shallow Depths (floors 1–6) enrage starts at turn 8 (reduced from 12 on 2026-04-09 for earlier urgency). Enemies below `ENRAGE_LOW_HP_THRESHOLD` (30%) deal an extra `ENRAGE_LOW_HP_BONUS` (+3) regardless of segment.

**Damage cap enforcement (2026-04-04 fix):** The per-turn damage cap () is re-applied in  AFTER the enrage bonus is added. Previously,  capped damage before returning, then  added the enrage bonus on top — bypassing the cap entirely. At turn 40 in Act 3 this produced +114 uncapped flat damage. Fix: after adding enrage, re-cap using  to determine the segment (same floor-to-segment mapping as ). Charged attacks with  are still exempt.

---

## Knowledge-Reactive Dungeon Feedback (Spec 05, 2026-04-06)

Correct and wrong quiz answers modulate the dungeon atmosphere in real time, binding the knowledge system and combat environment together spatially.

### Per-Answer Pulses

**Correct answer (fires at T+0ms in parallel with existing juice):**
- `DepthLightingSystem.pulseLight(0xFFEECC, 0.6, 400, x, y)` — temporary warm white-gold radial glow at card play area (depth 997, ADD blend, rise 160ms/fall 240ms quadratic)
- `CombatAtmosphereSystem.pulseWarm(300)` — lowers gravityY by 30 units on both emitters for 300ms; particles visibly accelerate upward
- `pulseEdgeGlow(0xFFEEAA, 0.06, 500)` — subtle warm edge glow

**Wrong answer (fires at T+0ms in parallel with existing juice):**
- `CombatAtmosphereSystem.pulseCold(300)` — fog alpha +0.05 for 300ms; particle scatter velocity impulse (50 speed random direction, 200ms)
- `pulseFlash(0x4488CC, 0.06, 300)` — cold blue vignette flash
- `DepthLightingSystem.flickerOnePointLight(300)` — existing point light dims → 0 → restores over 300ms

### Consecutive Streak Tracking

`juiceManager` tracks `consecutiveCorrect` and `consecutiveWrong` counters. On each correct answer `consecutiveCorrect++`, `consecutiveWrong = 0`. On wrong: opposite.

Streak state is exposed via `juiceManager.getConsecutiveCorrect()` and `getConsecutiveWrong()`. `juiceManager.resetStreak()` clears both (called from `CombatScene.resetKnowledgeStreak()`).

### Persistent Ambient Shift (3+ streak)

When `consecutiveCorrect >= 3`:
- `CombatAtmosphereSystem.setStreakWarm(true, cb)` activates
- Saturation modifier shifts +5% per level beyond 2 (e.g. 3 correct = +5%, 4 = +10%)
- Clamped at +10% maximum

When `consecutiveWrong >= 3`:
- `CombatAtmosphereSystem.setStreakCold(true, cb)` activates
- Saturation modifier shifts −5% per level beyond 2, clamped at −10%

The saturation offset is applied on top of the base `atmosphereConfig.cameraColorMatrix.saturation`. Since Spec 09 (DungeonMoodSystem) also modulates saturation (desaturation at high mood), the two signals are combined: `finalSat = baseSat + streakOffset - moodDesaturation`. `CombatScene.applyMoodSaturation()` applies the combined value each frame. `applyStreakSaturation()` includes the current mood desaturation so event-driven updates are also correct.

Warm and cold streaks are mutually exclusive — activating one cancels the other.

### State Management

- **Reset per encounter:** `CombatScene.resetKnowledgeStreak()` is called at the start of `setEnemy()` and in `onShutdown()`. This calls `atmosphereSystem.resetStreak()` (clears modifier) and `juiceManager.resetStreak()` (clears counters).
- **Callback re-registration:** `juiceManager.setCallbacks({ onAtmosphereWarm, onAtmosphereCold })` is called in both `CombatScene.create()` and `CombatScene.onWake()` so the callbacks survive `CardCombatOverlay.clearCallbacks()` across sleep/wake cycles.

### Reduce-Motion Handling

- Particle velocity changes (`pulseWarm`, `pulseCold` scatter) are skipped under reduce-motion
- `pulseLight` and `flickerOnePointLight` are skipped (no-op on low-end devices per existing tier gating)
- Vignette alpha nudge (pulseCold fog) and saturation color shift are kept — they are brightness changes, not positional motion
- `pulseFlash` and `pulseEdgeGlow` already respect `this.reduceMotion` internally

### Integration Files

- `src/services/juiceManager.ts` — streak counters, `onAtmosphereWarm`/`onAtmosphereCold` callbacks
- `src/game/systems/CombatAtmosphereSystem.ts` — `pulseWarm`, `pulseCold`, `setStreakWarm`, `setStreakCold`, `resetStreak`, `getStreakSaturationModifier`
- `src/game/systems/DepthLightingSystem.ts` — `pulseLight`, `flickerOnePointLight`
- `src/game/scenes/CombatScene.ts` — `onCorrectAnswer`, `onWrongAnswer`, `resetKnowledgeStreak`, `updateKnowledgeSaturation`, `applyStreakSaturation`

---

## Dynamic Dungeon Mood (Spec 09, 2026-04-06)

A continuous mood state (0.0 calm → 1.0 desperate) driven by real-time combat signals that modulates all visual atmosphere parameters. The mood value smooth-interpolates toward its target over ~2.5 seconds, never jumping instantly. This is the orchestration baseline layer that all other immersion specs stack their transient spikes on top of.

### Mood Signals and Weights

| Signal | Max weight | Direction |
|---|---|---|
| Low HP `(1 - hpRatio) × 0.40` | 0.40 | High HP loss → desperate |
| Chain length `(/ 8) × 0.20` | 0.20 | Active chain → calm |
| Correct streak `(/ 5) × 0.15` | 0.15 | Winning → calm |
| Enemy threat `× 0.15` | 0.15 | Dangerous enemy → desperate |
| Floor depth `(/ 14) × 0.10` | 0.10 | Deeper = slightly more desperate |

Base offset 0.5: full HP player with no chain or threat settles at 0.5. Must have chain + streak to go below 0.4 (calm); must be low HP + high threat to go above 0.8 (desperate).

### Modifier Output Ranges

| Modifier | Calm (0.0) | Neutral (0.5) | Desperate (1.0) |
|---|---|---|---|
| vignetteMultiplier | 0.8 | 1.1 | 1.4 |
| colorTempShift | −1.0 (warm) | 0.0 | +1.0 (cold) |
| particleRateMultiplier | 0.8 (fewer) | 1.15 | 1.5 (more) |
| particleChaosMultiplier | 1.0 | 1.25 | 1.5 |
| lightFlickerMultiplier | 1.0 | 1.4 | 1.8 |
| fogDensityMultiplier | 0.9 | 1.1 | 1.3 |
| desaturationAmount | 0.0 | 0.075 | 0.15 |

### Integration

- **CombatScene.update()**: reads `activeTurnState` via `feedMoodInputs()`, calls `moodSystem.update(delta, inputs)`, then `applyMoodModifiers()` per frame
- **Vignette**: `moodVignetteOverlay` (depth 2 black rect) alpha driven by vignetteMultiplier; kept separate from turn/chain overlays
- **Particles**: `CombatAtmosphereSystem.setMoodParticleRate(mult)` adjusts raw base frequencies; chain modifiers apply on top
- **Flicker**: `DepthLightingSystem.setMoodFlickerSpeed(mult)` stacks with `chainFlickerSpeedMult`
- **Fog**: `DepthLightingSystem.setMoodFogMultiplier(mult)` scales stored `baseFogDensity`
- **Saturation**: `applyMoodSaturation()` combines `knowledgeSaturationOffset` (streak) and `desaturationAmount` (mood) additively

### Transient Modifier API

Specs 01, 03, 05 can push time-limited spikes on top of the mood baseline:
```typescript
// Example: turn transition darkens vignette for 300ms
combatScene.dungeonMood.applyTransientModifier({ vignetteMultiplier: 1.3 }, 300)
```
Multiplier fields stack multiplicatively; `colorTempShift` and `desaturationAmount` stack additively.

### Source Files
- `src/game/systems/DungeonMoodSystem.ts` — core mood system
- `src/game/scenes/CombatScene.ts` — `feedMoodInputs`, `calculateEnemyThreat`, `applyMoodModifiers`, `applyMoodSaturation`, `moodVignetteOverlay`
- `src/game/systems/CombatAtmosphereSystem.ts` — `setMoodParticleRate`
- `src/game/systems/DepthLightingSystem.ts` — `setMoodFlickerSpeed`, `setMoodFogMultiplier`

---

## Co-op Exclusive Effects (coop / duel modes)

> **Source file:** `src/services/coopEffects.ts`
> **Last verified:** 2026-04-06

Six mechanics activate only in `coop` and `duel` multiplayer modes. They stack on top of the solo damage pipeline (GDD §15.5) without bypassing any existing steps.

### Lifecycle

| Call | When |
|------|------|
| `initCoopEffects()` | Encounter start in coop/duel mode |
| `processTurnActions(local, partner)` | After both players submit DuelTurnAction, before damage |
| `tickEndOfTurn()` | After all damage, block, and fog are applied |
| `destroyCoopEffects()` | Encounter end or multiplayer exit |

### The 6 Effects

| Effect | Mechanic | Value | Notes |
|--------|----------|-------|-------|
| **Synapse Link** | Both charge same chain type | +0.5× additive | `synapseLinkBonus`; resets each turn |
| **Guardian Shield** | Redirect own block to partner | Queued block amount | Opt-in via card tag `guardian_shield`; call `queueGuardianShield()` from resolver, `consumeGuardianShield()` from partner |
| **Knowledge Share** | Partner answers correctly | +0.25× additive, 1 turn | `knowledgeShareBuff`; refreshes if partner answers again before expiry |
| **Team Chain Bonus** | Both players have active chains | +0.5× additive | `teamChainBonus`; requires `chainLength > 0` for each |
| **Fog Contagion** | Wrong answers from either player | +1 fog per wrong | Applied to ALL players via `adjustAura()`; `getSharedFogIncrease()` |
| **Shared Surge** | Combined turn counter | Waives AP surcharge | Same 4-turn cycle as solo surge (turns 2, 6, 10, 14…); `isCoopSurgeTurn()` |

### Multiplier Stacking

All three additive bonuses (Synapse Link, Knowledge Share, Team Chain) stack additively — NOT multiplicatively — to limit maximum swing:

```
coopMultiplier = 1.0 + synapseLinkBonus + knowledgeShareBuff + teamChainBonus
               // max: 1.0 + 0.5 + 0.25 + 0.5 = 2.25×
```

`getCoopDamageMultiplier()` returns this value. Multiply the resolved solo damage by it in the damage pipeline when in coop/duel mode.

### Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `SYNAPSE_LINK_MULTIPLIER` | 0.5 | Additive bonus for linked chain |
| `KNOWLEDGE_SHARE_BUFF` | 0.25 | Additive buff from partner correct |
| `KNOWLEDGE_SHARE_DURATION` | 1 | Turns buff persists |
| `TEAM_CHAIN_BONUS` | 0.5 | Additive bonus for dual chains |
| `COOP_SURGE_INTERVAL` | 4 | Mirrors solo `SURGE_INTERVAL` |
| `FOG_PER_WRONG_ANSWER` | 1 | Fog per wrong answer (any player) |

### Guardian Shield Integration

Guardian Shield is opt-in: the card resolver must call `queueGuardianShield(blockAmount)` when a card tagged `guardian_shield` is played charged. The partner retrieves it via `consumeGuardianShield()` — returns 0 if nothing is queued. Any unconsumed pending block is discarded by `tickEndOfTurn()`.

### Fog Contagion Integration

After `processTurnActions()`, read `getSharedFogIncrease()` and call `adjustAura(n)` for BOTH players in encounterBridge. This is the accountability mechanic: wrong answers from either partner hurt everyone.

---

## Phase 2: TurnState Extensions (2026-04-09)

New fields added to `TurnState` to support Phase 3 tag mechanics. All initialized in `startEncounter()`.

### Encounter-Scoped Tracking Fields

| Field | Type | Purpose |
|-------|------|---------|
| `selfDamageTakenThisEncounter` | `number` | Cumulative self-damage from reckless/gambit. Used by `reckless_selfdmg_scale3` tag. Incremented at `effect.selfDamage` block in `playCardAction`. |
| `shieldsPlayedThisTurn` | `number` | Shield cards played this turn. Incremented when `card.cardType === 'shield'` in main play path. |
| `shieldsPlayedLastTurn` | `number` | Copied from `shieldsPlayedThisTurn` at turn end. Used by `block_consecutive3`. |
| `lastTurnPlayedShield` | `boolean` | Convenience flag: `shieldsPlayedLastTurn > 0`. |
| `reinforcePermanentBonus` | `number` | Stacking block bonus from `reinforce_perm1`. +1 each reinforce play, encounter-scoped. |
| `lockedCardType` | `string \| null` | Reserved for Librarian elite Silence mechanic (future). |
| `empowerWeakPending` | `number` | Weakness stacks to apply when next buffed attack fires (`empower_weak2`). Cleared at turn end. |

### Passive Fields (Computed at Encounter Start)

`startEncounter()` scans all deck cards (via `getMasteryStats(...).tags`) for these passive tags:

| Field | Type | Tag | Effect |
|-------|------|-----|--------|
| `vulnMultiplierOverride` | `number \| null` | `expose_vuln75` | Replaces default 1.5× Vulnerable multiplier in `applyAttackDamage()`. Set to 1.75 if any deck card has this tag. |
| `weakShieldBonusPercent` | `number` | `weaken_shield30` | When enemy is Weakened and `> 0`, shield block is multiplied by `(1 + weakShieldBonusPercent/100)`. Applied during shield card resolution. |

### AdvancedResolveOptions Extensions

New optional fields passed from `playCardAction` to `resolveCardEffect`:

| Field | Source |
|-------|--------|
| `vulnMultiplierOverride` | `turnState.vulnMultiplierOverride` |
| `cardsPlayedThisTurn` | `turnState.cardsPlayedThisTurn` |
| `selfDamageTakenThisEncounter` | `turnState.selfDamageTakenThisEncounter` |
| `lastTurnPlayedShield` | `turnState.lastTurnPlayedShield` |
| `reinforcePermanentBonus` | `turnState.reinforcePermanentBonus` |

---

## Phase 3: 13 Card Tags (2026-04-09)

Tag implementations in `cardEffectResolver.ts` and `turnManager.ts`. All tags are defined in `MASTERY_STAT_TABLES` in `cardUpgradeService.ts`.

### Attack Tags

| Tag | Mechanic | Effect |
|-----|---------|--------|
| `strike_tempo3` | `strike` (L5) | If `cardsPlayedThisTurn >= 3`, deal +4 bonus damage. New `case 'strike':` in switch. |
| `power_vuln2t` | `power_strike` (L5) | Vulnerable applied by `power_vuln1` lasts 2 turns instead of 1. |
| `power_vuln75` | `power_strike` (L5) | Passive: sets `vulnMultiplierOverride = 1.75` at encounter start. Vulnerable multiplier becomes 1.75× instead of 1.5×. |
| `iron_wave_block_double` | `iron_wave` (L5) | If player has 10+ current block when played, double the damage component (not the block component). |
| `riposte_block_dmg40` | `riposte` (L5) | Add `Math.floor(playerBlock * 0.4)` as bonus damage after base damage. |
| `twin_burn_chain` | `twin_strike` (L5) | During multi-hit Burn processing, Burn stacks do NOT halve after each hit. `triggerBurn(effects, skipHalving=true)` is called. |
| `reckless_selfdmg_scale3` | `reckless` (L5) | Add `selfDamageTakenThisEncounter * 3` as bonus damage. Rewards sustained reckless play. |

### Shield Tags

| Tag | Mechanic | Effect |
|-----|---------|--------|
| `block_consecutive3` | `block` (L5) | If `lastTurnPlayedShield === true`, add +3 to block value. New `case 'block':` in switch. |
| `reinforce_perm1` | `reinforce` (L5) | Add current `reinforcePermanentBonus` to block. Then signal turnManager to increment `reinforcePermanentBonus += 1`. |
| `absorb_ap_on_block` | `absorb` (L5) | On Charge Correct, grant +1 AP. Uses `result.apOnBlockGain`, processed in turnManager. |

### Buff Tags

| Tag | Mechanic | Effect |
|-----|---------|--------|
| `empower_weak2` | `empower` (L5) | When the buffed attack fires and consumes `buffNextCard`, also apply 2 Weakness to enemy. Signal via `empowerWeakPending` in TurnState. |
| `msurge_ap_on_l5` | `mastery_surge` (L5) | After bumping cards, if any bumped card is now at L5 in hand, grant +1 AP. |

### Passive Tags (Set at Encounter Start)

| Tag | Mechanic | Effect |
|-----|---------|--------|
| `weaken_shield30` | `weaken` (L5) | Passive: sets `weakShieldBonusPercent = 30`. Shield cards deal +30% block when enemy is Weakened. |
| `expose_vuln75` | `expose` (L5) | Passive: sets `vulnMultiplierOverride = 1.75`. All attack damage vs Vulnerable enemy uses 1.75× instead of 1.5×. |

### New CardEffectResult Fields

| Field | Type | Set By | Consumed By |
|-------|------|--------|-------------|
| `reinforcePermanentBonusIncrement` | `boolean` | `reinforce` with `reinforce_perm1` | turnManager: increments `reinforcePermanentBonus` |
| `masteryReachedL5Count` | `number` | `mastery_surge` with `msurge_ap_on_l5` | turnManager: grants +1 AP if hand has L5 card |
| `apOnBlockGain` | `number` | `absorb` with `absorb_ap_on_block` | turnManager: grants N AP |
| `vulnDurationOverride` | `number` | `power_strike` with `power_vuln2t` | Informational; actual duration set at status apply time |
| `twinBurnChainActive` | `boolean` | `twin_strike` with `twin_burn_chain` | turnManager multi-hit loop: passes `skipHalving=true` to `triggerBurn()` |
| `riposteBlockDmgBonus` | `number` | Unused (inline in riposte case) | — |
| `ironWaveDoubleDmg` | `boolean` | Unused (inline in iron_wave case) | — |
| `empowerWeakStacks` | `number` | `empower` with `empower_weak2` | turnManager: stores to `empowerWeakPending` |

### `triggerBurn` Signature Change

`triggerBurn(effects: StatusEffect[], skipHalving = false)` — new optional second parameter. When `true` (set by `twin_burn_chain`), Burn stacks are not halved after the tick. All existing callers pass no second argument and retain default behavior (halving).


---

## Adaptive Difficulty Design Philosophy

**The Canary system intentionally makes the game harder for extremely well-performing players.** This is not a bug — it is a core design principle.

### Why Expert Players Face Harder Enemies

Recall Rogue is a **knowledge game**, not a pure combat game. The goal is to keep players in their **optimal learning range** — the zone where questions are challenging enough to produce genuine retrieval practice but not so easy that answers are automatic. This aligns with Bjork's Desirable Difficulties framework (GDD §1).

When a player answers 85%+ of questions correctly over a sustained window, the Canary system increases enemy HP (+12%) and damage (+20%). This serves three purposes:

1. **Learning incentive:** Higher difficulty makes charging riskier, pushing players to engage more carefully with questions rather than autopiloting through familiar material.
2. **Mastery validation:** If you truly know the material, you can handle tougher enemies. The challenge confirms mastery rather than punishing it.
3. **Preventing trivial runs:** A player who knows every answer shouldn't steamroll every run — that's boring. The difficulty scaling keeps even expert runs engaging.

### Why "Master" Players May Have Lower Win Rates Than "Experienced"

In headless simulation data, the `master` profile (85% accuracy) sometimes shows a lower win rate than `experienced` (76% accuracy). **This is intentional and correct.** The master profile triggers the challenge tier (1.15–1.20× enemy damage, 1.12–1.25× enemy HP), while the experienced profile sits in the mild assist/neutral zone. The result is that experienced players get a slight tailwind while masters face a headwind.

This mirrors real roguelite design: the best players should be pushed toward harder content (ascension levels, challenge modifiers) rather than coasting. In Recall Rogue, the Canary system applies this automatically based on quiz performance — no manual difficulty selection needed.

### The Optimal Learning Range

| Accuracy Range | Canary Response | Design Intent |
|----------------|-----------------|---------------|
| < 60% | Strong assist (−12% dmg, −10% HP) | Player is struggling — reduce pressure so they can focus on learning |
| 60–70% | Mild assist | Player is in the learning zone — gentle support |
| 70–85% | Mild challenge to moderate challenge | Player is performing well — increase engagement |
| > 85% | Strong challenge (+20% dmg, +12% HP) | Player is coasting — push them toward harder material or accept harder combat |

The system rewards players who are **actively learning** (60–80% accuracy range) with the most favorable difficulty curve, while both extremes (too easy, too hard) receive corrective pressure.

---

## Canary Adaptive Difficulty — v2 HP Scaling (2026-04-09)

The Canary system (`src/services/canaryService.ts`) now modulates **enemy HP** in addition to enemy damage, giving struggling players easier enemies to defeat and challenging experts with beefier foes.

### CanaryState Fields

| Field | Type | Description |
|-------|------|-------------|
| `enemyDamageMultiplier` | number | Applied to incoming player damage per attack |
| `enemyHpMultiplier` | number | **NEW** — Applied at enemy creation via `createEnemy()` |

### HP Multiplier Table

| Mode | Trigger | `enemyHpMultiplier` | `enemyDamageMultiplier` |
|------|---------|---------------------|------------------------|
| `neutral` | Default | 1.0 | 1.0 |
| `assist` | 2+ wrong this floor | 0.85 (`CANARY_ASSIST_ENEMY_HP_MULT`) | 0.70 |
| `deep_assist` | 4+ wrong this floor | 0.70 (`CANARY_DEEP_ASSIST_ENEMY_HP_MULT`) | 0.55 |
| `challenge` | 5+ correct streak | 1.25 (`CANARY_CHALLENGE_ENEMY_HP_MULT_5`) | 1.15 |

**Note:** The `CANARY_CHALLENGE_ENEMY_HP_MULT_3` constant (1.1) is reserved for a future "entry challenge" sub-tier (correct streak 3–4) that hasn't been implemented yet — the current threshold check always uses the `_5` constant when in challenge mode.

### Wiring

`encounterBridge.ts` multiplies `run.canary.enemyHpMultiplier` into the `enemyHpMultiplier` variable (alongside ascension modifiers) **before** calling `createEnemy()`:

```typescript
let enemyHpMultiplier = (
  ascensionModifiers.enemyHpMultiplier *
  (ascensionTemplate.category === 'boss' ? ascensionModifiers.bossHpMultiplier : 1) *
  run.canary.enemyHpMultiplier   // ← Canary v2
);
```

Enemy damage multiplier is threaded through `TurnState.canaryEnemyDamageMultiplier` (unchanged from v1) — applied per incoming attack in `takeDamage()`.

### Run-Level Canary Layer (Pass 4, 2026-04-09)

A second layer stacks **multiplicatively** on top of encounter-level scaling, tracking rolling accuracy over the last 40 answers (`CANARY_RUN_WINDOW`) across all floors and encounters.

**Minimum data gate:** run-level multipliers only activate after ≥10 answers are in the window. Before that both run-level multipliers are 1.0.

Multipliers are **linearly interpolated** between anchor points — not discrete tiers. There is no neutral zone: the 0.70 threshold is shared between mild assist and mild challenge, and accuracy above 0.70 scales continuously toward the challenge ceiling.

| Accuracy Anchor | `runDamageMultiplier` | `runHpMultiplier` | Notes |
|---|---|---|---|
| ≤ 0.60 (strong assist) | 0.88 | 0.90 | -12% enemy damage, -10% enemy HP |
| 0.70 (mild assist / challenge crossing) | 0.86 | 0.90 | Interpolated; also the challenge floor |
| 0.70 (mild challenge, crossing point) | 1.0 | 1.0 | Neutral — no assist, no challenge |
| ≥ 0.85 (strong challenge) | 1.20 | 1.12 | +20% enemy damage, +12% enemy HP |

**Between anchors**, values interpolate linearly. For example, at 0.65 accuracy (midway between 0.60 and 0.70) the damage multiplier is lerp(0.88, 0.86, 0.5) = 0.87. At 0.775 accuracy (midway between 0.70 and 0.85), damage multiplier is lerp(1.0, 1.20, 0.5) = 1.10.

**Pass 5** removed the neutral zone (0.70–0.80), making everyone receive either assist or challenge. **Pass 6b/6c** retuned the assist values (strong assist 0.82→0.88; mild assist 0.93→0.86) after `first_timer` hit 39.5% and `competent` hit only 25.7% win rates.

The final `enemyDamageMultiplier` and `enemyHpMultiplier` on `CanaryState` are the **product** of both layers. All callers read only these combined values — no changes needed in encounterBridge, turnManager, or simulator.

**Run-level state persists across floor resets** — `resetCanaryFloor()` zeroes `wrongAnswersThisFloor` but keeps `runAnswers` intact. This is the defining feature: run-level tracking accumulates context that encounter-level tracking cannot.

**New CanaryState fields:**

| Field | Type | Description |
|---|---|---|
| `runAnswers` | `boolean[]` | Rolling window of recent answers (max 40) |
| `runAccuracy` | number | Computed accuracy (0–1); 0 if < 10 answers |
| `runDamageMultiplier` | number | Run-level damage multiplier before stacking |
| `runHpMultiplier` | number | Run-level HP multiplier before stacking |

**Balance constants** in `src/data/balance.ts` under `// === RUN-LEVEL CANARY (Pass 4) ===`.


---

## Co-op Combat

> **See also:** `docs/architecture/multiplayer.md` for the full sync flow.

In co-op mode:

- **Shared enemy**: both players fight one enemy with HP scaled by `getCoopHpMultiplier(playerCount)` (1.6× at 2P). Each client maintains a local copy; clients converge to the host-authoritative state at end-of-turn.
- **Full damage to all players**: the enemy's attack intent is executed locally on EACH client against EACH player's own HP. Damage is not split or halved — both players take the full hit.
- **Canary disabled**: `canaryEnemyDamageMultiplier` is forced to `1.0` and `canary.enemyHpMultiplier` is excluded from the enemy HP calculation. The canary adaptive-difficulty system does not apply in coop.
- **Turn sync**: players end turns simultaneously. At end-of-turn, each client sends a `EnemyTurnDelta` (damage dealt this turn) to the host, which merges all deltas and broadcasts the authoritative new enemy state. Non-host clients await the broadcast before running the enemy phase.
- **Mid-turn drift**: during a turn, clients may show different enemy HP (each sees only their own damage). This is expected and resolves at end-of-turn when both clients receive the host-merged state.
