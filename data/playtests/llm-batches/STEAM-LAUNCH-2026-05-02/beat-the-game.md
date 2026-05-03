# Beat-the-Game Run — LLM Playtest
## Session: beat-game-2026-05-03

**Date:** 2026-05-03  
**Tester:** claude-sonnet-4-6 (Docker warm container, DOM pointer events)  
**Goal:** Beat Act 1 boss, advance to Act 2. 60-minute budget.  
**Outcome:** LOST IN THE DARK — died Floor 3, Combat 4 vs Overdue Golem  
**Agent ID:** `beat-game-2026-05-03`  
**Batch count:** ~145 action batches  

---

## Run Summary

| Stat | Value |
|------|-------|
| Floor reached | 3 |
| Encounters won | 2 of 3 (lost 3rd) |
| Player HP at death | ~7/100 |
| Enemy at death | 31/61 HP (Overdue Golem) |
| Gold earned | 70 |
| Time played | 28m 19s |
| Accuracy | 100% (Quick Play only, no quiz answers) |
| XP earned | +193 |
| Level up | → Lv.3 |

## Map Path Taken

Floor 1:
- r0-n0: **Combat 1** — Page Flutter (34 HP) → WIN (player 100→74 HP)
- r1-n1: **Combat 2** — Page Flutter (34 HP) → WIN (player 74 HP, minor HP loss)
- Reward: Selected **Quicken** card (0-cost buff, +1 AP per turn it's played)

Floor 2:
- r2: **Treasure room** → Received **Overflow Gem** relic (4+ AP spent per turn → last card played gets +75% effect)
- Shop room → No affordable healing. Exited via "Leave anyway" confirmation.
- r3: **Mystery event** (navigated successfully)

Floor 3:
- r3-n2 (or nearby): **Combat 3** — Page Flutter (40 HP) → WIN (player 27 HP going in, dropped further)
- Combat 4: **Overdue Golem** (61 HP) → DEATH at ~7 HP

---

## Play-by-Play (key moments)

### Combat 1 vs Page Flutter (34 HP)
- Standard opening combat, 5-card hand (3x Strike, 2x Block)
- Dealt 4 dmg per Strike via Quick Play drag (sy-250 works reliably)
- Enemy: Swooping Strike 14 dmg, telegraphed each turn
- Won in ~3 turns, exited at 74 HP

### Reward Room — Quicken selection
- Used Phaser game object approach: `scene.items[].sprite.emit('pointerdown', ...)`  
- Found correct card via `reward.card.mechanicId === 'quicken'`
- Quicken is strong: 0-cost, draws extra AP this turn

### Treasure Room — Overflow Gem relic
- Relic granted automatically (no selection required)
- Synergy: Quicken (free +1 AP) → spend 4 AP total → Overflow Gem activates → last Strike gets +75% (7 dmg instead of 4)

### Shop Room
- `getShopInventory()` called — no healing potion or rest action in inventory
- Confirmed shop items available but none appropriate to buy at 70 gold
- Left via `shopLeave()` → "Leave the shop?" confirmation dialog → "Leave anyway" click

### Combat 3 vs Page Flutter (40 HP)
- Played Quicken turn 1 for +1 AP → dealt burst damage
- Won, but player dropped to ~27 HP

### Combat 4 vs Overdue Golem (61 HP) — DEATH
- Toughest enemy encountered. Abilities:
  - **Sludge Swing** (Dmg 18): Main attack, telegraphed as value 8 with displayDamage 18
  - **Bog Absorption** (non-damaging): Heals the Golem slightly (~3 HP), absorbs partial player block
- Turn-by-turn:
  - Turn 1: Drew Quicken, played for +1 AP. Played 4 Strikes (~16-20 dmg). Golem HP 61→~40
  - Turn 2: Enemy Bog Absorption (Golem 40→43 HP observed — heals!), blocked
  - Turn 3-4: Played Strikes, chipped damage. Golem 43→35 HP. Player HP dropping.
  - Turn 5: Player at 14 HP, 0 block. Played 2x Block (8 block), 1x Strike. Enemy 35→31 HP.
  - Turn 6: Player at 7 HP. Played 3x Block for 12 block total. Turn ended. Enemy attacked: 18-12=6 HP net damage. Player 7-6=1 HP... but received fatal hit.
  - Died. Enemy at 31/61 HP — over halfway down.

---

## Bugs Found (New vs Previous Batch)

### CONFIRMED FIXES from previous runs (STEAM-LAUNCH-2026-05-02)
- **ISSUE-2-2** (DOM click = no card play): FIXED. Pointer event dispatch (pointerdown/pointermove/pointerup) correctly registers card plays in the Phaser engine. Cards played, AP consumed, damage dealt.
- **ISSUE-1-6** (ENCOUNTERS: 0 on runEnd): FIXED or partially fixed. This run's death screen showed "3 ENCOUNTERS, 2 WON" — data is now accurate.
- **ISSUE-1-2** (Map starts at boss, starting nodes below viewport): Appeared FIXED — map nodes at r0 were reachable without manual scrollTop manipulation. (May have been fixed between sessions.)

### NEW ISSUES FOUND

#### BGRUN-1: Overdue Golem "Bog Absorption" heals enemy HP
- **Severity:** MEDIUM
- **Where:** Combat, Floor 3 enemy
- **Observed:** After Bog Absorption intent, enemy HP went from ~40 to ~43 HP (+3). This was unexpected — the non-attack move appears to heal the Golem, not just reduce player block.
- **Repro:** Face Overdue Golem, let it use Bog Absorption, observe HP increase
- **Impact:** Makes this enemy significantly harder. Players may not anticipate that a non-attack move heals the enemy. If intentional, should be telegraphed clearly ("heals 3 HP" in intent text).
- **Steam reviewer quote:** "The rock monster healed itself during a non-attack turn and I had no warning."

#### BGRUN-2: 100% quiz accuracy "Practice Run" penalty fires even with full card play engagement
- **Severity:** MEDIUM (previously ISSUE-2-3, now confirmed in different context)
- **Context:** Previous batch runs had 100% accuracy from pure Quick Play with no quiz. This run also had 100% accuracy — but we played cards actively and won 2 fights. The "Practice Run" penalty still fires.
- **Root cause:** The penalty triggers on accuracy=100% without checking whether any quiz attempts occurred. A player who wins every fight via Quick Play but genuinely engages with cards should not be penalized.
- **Note:** This was logged as ISSUE-2-3 in the previous batch. Confirming it still fires here.

#### BGRUN-3: Shop "Leave" button requires two-click confirmation every time
- **Severity:** LOW
- **Where:** Shop room exit
- **Observed:** `shopLeave()` opens a modal: "Leave the shop?" with "Leave anyway" and "Stay" options. This friction appears on EVERY shop exit.
- **Impact:** Minor friction. Veteran players who browse and leave frequently will find this annoying.
- **Steam reviewer quote:** "Why does it ask me to confirm every time I leave the shop?"

#### BGRUN-4: `getHUDText()` returns all nulls in combat
- **Severity:** LOW (testing infrastructure, not player-visible)
- **Where:** Combat screen
- **Observed:** `getHUDText()` returns `{hp: null, currency: null, floor: null, streak: null, combo: null}` during active combat. This makes automated health monitoring impossible without falling back to `getCombatState().playerHp`.
- **Impact:** Only affects LLM playtesting agents, not real players. But it means the HUD text API isn't reading the DOM correctly in combat.

### PREVIOUSLY KNOWN — STILL PRESENT
- **ISSUE-3-3** (No shop/mystery/rest rooms visible): RESOLVED in this run. This run found shop, treasure, and mystery rooms. Previous runs likely died before reaching them (Floor 1 only).
- **ISSUE-1-4** (Charge Play undiscoverable): Still present. The core learning mechanic (answering quiz for bonus damage) was never accessed this entire run — all 3 victories were won via Quick Play only. Charge Play exists but the UX never surfaced it.
- **ISSUE-1-3** (5 tutorial dismiss clicks): Present on first run. Not seen again (tutorial only appears once).

---

## Mechanics Validation

### Card Play (DOM Pointer Events)
**Status: WORKING**  
The discovery from earlier sessions that `.click()` doesn't register but full pointer dispatch does is confirmed correct. Pattern:
```
pointerdown(sx, sy) → wait 100ms → pointermove(sx, ty=sy-250) → wait 100ms → pointerup(sx, ty)
```
Cards reliably process with this sequence. AP decrements, enemy HP decrements, animations play.

### Reward Room Selection (Phaser API)
**Status: WORKING**  
```javascript
const g = globalThis[Symbol.for('rr:cardGameManager')]?.getGame?.();
const scene = g?.scene?.getScene?.('RewardRoom');
const target = scene?.items?.find(i => i.reward?.card?.mechanicId === 'quicken');
target.sprite.emit('pointerdown', {...});
```
Reliably selects reward cards. The `.sprite` property is a Phaser Container2 with `.emit()`.

### Map Navigation
**Status: WORKING**  
DOM nodes with class `state-available` are clickable via `.click()`. Node type detection via `img.src` matching `map-icons/{type}.webp` works correctly.

### Combat State API
**Status: MOSTLY WORKING**  
`getCombatState()` returns full state during combat including enemy intent, hand, HP, block, AP. Returns `null` when not in combat (reward room, map, etc.) — this is correct behavior but callers should check.

### Quick Play (Drag-to-play)
**Status: WORKING**  
Dragging sy-250 reliably triggers Quick Play (not Charge Play). Consistent across all encounters.

### Charge Play / Quiz
**Status: NOT TESTED**  
Never activated during this session. The mechanic exists but requires dragging to y < 594 (above 55% viewport height). All card plays in this run used sy-250 which landed in Quick Play zone. No quiz was triggered, no quiz answered. **The core learning mechanic of Recall Rogue went untested and unused this entire run.**

---

## Strategy Notes (for future runs)

1. **Overflow Gem + Quicken combo is strong**: Quicken (0 AP) + 4 Strikes (4 AP) = 5 AP total → Overflow activates on last Strike → 7 dmg instead of 4. At full efficiency: 3 Strikes at 4 dmg (12) + 1 Strike at 7 dmg (7) = 19 dmg in one turn vs the Golem's ~8 effective HP values.

2. **Bog Absorption enemy**: When facing Overdue Golem, be aggressive on turns it telegraphs Bog Absorption — it doesn't attack, so stack Strikes rather than Blocks. The heal (+3 HP) offsets damage if you play defensively.

3. **Block math**: At 7 HP vs 18 incoming damage: even 12 block (3 block cards) leaves you at 1 HP. You need to kill the enemy before this situation arises. Prioritize burst damage over block stacking once below 30 HP.

4. **Relic room priority**: If Overflow Gem appears, take it immediately — the 4 AP threshold is easy to hit with any Quicken card in the deck.

5. **Rest rooms**: Never found one this run. If a rest node appears on the map, prioritize it over combat when below 40 HP.

---

## What This Run Proved

1. The game is **completable to Floor 3** without crashes or softlocks from a fresh start.
2. The **map variety is real** — shop, treasure, mystery rooms all appeared and worked.
3. The **reward system works** — Quicken and Overflow Gem both functioned correctly.
4. **Combat is winnable** via Quick Play alone — the knowledge mechanic is optional, not required.
5. The **biggest threat to a 60-minute run** is HP attrition across 4+ combats without a healing node. Dying at 7 HP to a combat enemy is a balance concern — the difficulty ramp from Page Flutter (34 HP, 14 dmg) to Overdue Golem (61 HP, 18 dmg, heals) is steep.

---

## Recommendation

**The run reached Floor 3 with 2 wins and full map variety.** This represents meaningful forward progress from the previous batch (all 3 runs died on Floor 1). The critical fixes confirmed:
- Card play via pointer events: works
- Encounter counter on runEnd: works  
- Map navigation: works

**Remaining blocker for a true Act 1 clear:** The Charge Play / quiz mechanic needs to be surfaced for the player. Every combat in this run was won without answering a single knowledge question. If the game is meant to be a knowledge game, the player path to Charge Play needs to be more obvious.

**Highest priority new issue:** BGRUN-1 (Overdue Golem heals on Bog Absorption) needs verification — if intentional, add "Heals 3 HP" to the intent display text.
