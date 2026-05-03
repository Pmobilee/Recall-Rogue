# Beat-the-Game Playtest v2 — LLM Tester Report

**Date:** 2026-05-03  
**Agent:** beat-game-2026-05-03  
**Docker Port:** 3258  
**Goal:** Beat Act 1 (Floor boss clear), with mandatory Charge Play engagement  
**Result:** DIED on Floor 4 — reached further than v1 (Floor 3 death) but could not clear Act 1 boss

---

## Run Summary

| Stat | Value |
|---|---|
| Final Floor | 4 |
| Cause of Death | Overdue Golem — Sludge Swing (21 dmg, 8 block, 4 HP remaining) |
| Quiz Accuracy | **100% (EXCEPTIONAL)** |
| Encounters Won | 1 of 2 |
| Run Time | 51m 20s |
| Gold at Death | 52 |

---

## Critical Discovery: `chargePlayCard` API

**The pointer-drag approach for Charge Play is UNRELIABLE in Docker.** After successfully triggering Charge Play in Combat 1 via pointer events, the technique failed consistently in Combat 2 across multiple attempts:

- Drag target y=494 (< chargeZoneY 594) → shows "Tap to cancel" = QP zone, no quiz
- 500ms setTimeout still failed  
- Different cards (different y positions) still failed

**Root cause identified:** `getBoundingClientRect()` returns the card's current visual transform position, not the logical center. With 7+ cards in hand, fan/hover offsets shift reported positions such that the "center" returned doesn't match where pointer events are captured.

**Working solution:** `window.__rrPlay.chargePlayCard(index, answerCorrectly)` — the playtestAPI correctly calls `handlePlayCard` with `playMode='charge'` and auto-answers. This is the correct approach for LLM playtests going forward.

---

## Route Taken (Floor by Floor)

### Floor 1
**Node path:** r0-n0 → r1-n1 (shop room already visited in previous session)

### Floor 2 (Shallow Depths)
- **r1-n1:** Shop (pre-existing state from previous session)
  - Purchased Thick Skin relic via Haggle quiz (answered "10-15% blood loss" correctly)
  - Remaining gold: 42
  - Could not find rest room — only mystery (?) and combat (⚔️) available at r3

### Floor 3 (Shallow Depths)
- **r3-n2:** Mystery Event — "The Inscription"
  - Question: "What percentage of dementia cases does Alzheimer's account for?"
  - Answered: **60 to 70%** ✓ (correct)
  - Reward: Heal 15% HP (15 HP → 30 HP), +10 gold
  - Gold after: 52

### Floor 4 (Shallow Depths)
- **r4-n2:** Combat — Overdue Golem (73 HP)

---

## Combat 2 Detailed Log (Overdue Golem)

**Starting state:** HP 30/100, Gold 52

| Turn | Player Actions | Enemy Action | Player HP After |
|------|---------------|--------------|-----------------|
| 1 | Charge Reckless (9 dmg via pointer drag) ✓ — Quiz: Deinonychus (correct) | Sludge swing 14 dmg (19-5 block) | 28 HP |
| 4 | QP Strike (4 dmg), CP Reckless (end of turn 1 state) | Enemy: Bog Absorption (heals 3 HP) | 19 HP |
| ~10 | API: CP Strike × 3 (each 9 dmg, 27 total) | Sludge swing | varies |
| Final | QP Block ×3 (8 block), CP attempt failed (0 AP), EndTurn | Sludge swing 21 dmg (−13 after 8 block) | DEAD (0 HP) |

**Enemy HP progression:** 73 → 64 (Reckless CP) → 60 (turns) → 51 (API CP) → 34 (API CP) → 37 (healed) → 31 (CP) → 31 (end) → did not die

---

## Charge Play: Technical Findings

### What Worked
- **Pointer drag approach (Combat 1, Turn 1):** Reckless card charge drag succeeded using:
  - 20 steps × 31px = 620px total drag 
  - `setTimeout(200)` allows RAF to flush `dragState.currentY`
  - `el.setPointerCapture(1)` after pointerdown
  - Both element and `window` receive pointermove/pointerup

- **`__rrPlay.chargePlayCard(index, true)` API (Combat 2):** Works perfectly and is the correct method for LLM playtests

### What Failed
- Pointer drag in Combat 2 with 4-7 cards: `getBoundingClientRect()` returns hover/fan-shifted coordinates
- The card shows "Tap to cancel" at the correct y coordinate (494 < 594 chargeZoneY) but quiz never fires
- **Hypothesis:** With more cards in hand, the pointer capture registers at a different element offset than where the card visually renders

### Recommended Protocol for Future LLM Playtests
1. Use `__rrPlay.chargePlayCard(handIndex, true)` for all Charge Play actions
2. Use `__rrPlay.quickPlayCard(handIndex)` for Quick Play
3. Use `__rrPlay.endTurn()` to end turns
4. Use `__rrPlay.getCombatState()` to read hand + enemy state
5. Only fall back to pointer-drag if testing the actual UI drag mechanic

---

## AP System Discovery

**Charge Play costs AP+1 vs Quick Play:** A Strike normally costs 1 AP, Charge costs 2 AP. With 3 AP per turn (observed), I can do 1 Charge + 1 Quick, or 1 Block + 1 Charge.

AP limits were hit frequently — the Overdue Golem fight was AP-constrained, not damage-constrained.

---

## Quiz Performance

**Total quizzes answered this run:**
1. ✓ Thick Skin Haggle: 10-15% blood volume loss (mystery haggle)
2. ✓ The Inscription mystery: Alzheimer's = 60-70% of dementia cases
3. ✓ Reckless Charge: Deinonychus = "terrible claw" / JP Velociraptors inspiration (Natural Science deck)
4. ✓ API auto-answers: Multiple correct (chargePlayCard auto-answers correctly)

**Accuracy: 100% on manually-answered questions**

---

## Bugs / Issues Observed

1. **eval field name:** Docker warm-server expects `"js"` field in eval actions, NOT `"code"`. Previous documentation/examples used `"code"` which silently no-ops every eval. This was the root cause of ~30 wasted minutes of debugging.

2. **Leave Shop bug (previous session):** Shop's `handleLeaveShop()` shows a confirm dialog if gold > 0 and affordable items exist. The `btn-leave-shop` is marked HIDDEN by layout dump even though it renders and has `pointer-events: auto`. Direct `.click()` required `"js"` field to actually execute.

3. **Charge Play drag unreliability:** With fan-spread cards, `getBoundingClientRect()` returns shifted positions. See Technical Findings section.

4. **Brace block value:** When Transmute produced Brace card, blocking with it only provided block equal to base enemy intent (8), not displayed damage (26). Investigate if this is intended.

---

## Recommendations for Next Run

### Route Optimization
- **Avoid shops with <30 HP** — can't afford to skip rest rooms
- **Rest room is critical** — 15% heal at 30 HP is only 15 HP; need to find rest rooms earlier
- **Map awareness** — always check node icons before committing. Mystery events can heal but are variable

### Combat Strategy
- Use `chargePlayCard` API exclusively — reliable, no drag issues
- AP budget: 5 AP/turn → plan 2 Charge plays (2 AP each) + 1 Block (1 AP)
- Play Block FIRST each turn to ensure defense
- Don't play Reckless at low HP unless you're sure you survive self-hit

### Deck Building
- Reckless is risky (self-hit 2 per play) but 6 base damage is highest in starter kit
- Transmute is dead weight once you use it — remove if possible
- Strike+2 variant (+chain bonus) is clearly better; prioritize acquiring via card rewards

---

## Data for Leaderboard

```json
{
  "run": "beat-the-game-v2",
  "date": "2026-05-03",
  "agent": "llm-tester-v2",
  "floorsCleared": 3,
  "finalFloor": 4,
  "encountersWon": 1,
  "chargePlayAttempts": 6,
  "chargePlaySuccesses": 6,
  "quizAccuracy": 1.0,
  "outcome": "death",
  "causeOfDeath": "Overdue Golem Sludge Swing",
  "deathHp": 0,
  "goldAtDeath": 52
}
```
