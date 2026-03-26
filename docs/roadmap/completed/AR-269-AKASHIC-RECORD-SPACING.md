# AR-269: Akashic Record Full Spacing Mechanic

## Overview
**Goal:** Complete the Akashic Record relic with per-fact encounter tracking so it rewards spaced recall (+50% damage + draw 1 on facts not seen in 3+ encounters).
**Dependencies:** AR-265 (base Akashic Record relic definition)
**Estimated complexity:** Small-Medium

---

## Sub-steps

### 1. Add lastSeenEncounter Tracking

Find where per-fact run state is tracked (likely `InRunFactState` or in the deck/FSRS state). Add:
- `lastSeenEncounter?: number` per fact
- Encounter counter on TurnState or run state (incremented at encounter start)

On every charge (correct or wrong), update the fact's `lastSeenEncounter` to current encounter number.

### 2. Wire Akashic Record Spacing Check

In `relicEffectResolver.ts` (~line 1608), replace flat +50% with:
- If `currentEncounter - fact.lastSeenEncounter >= 3` (or fact never seen) → +50% damage + draw 1
- Otherwise → no bonus (or keep small +10% base)

Pass `currentEncounterNumber` and `factLastSeenEncounter` via resolver context.

### 3. Wire Draw Bonus

The +1 draw needs to integrate into the draw system. Options:
- Set a flag `akashicBonusDraw = true` that adds +1 to `bonusDrawNextTurn`
- Or immediately draw 1 card (if mid-turn draw is supported)

---

## Files Affected
| File | Change |
|------|--------|
| `src/services/relicEffectResolver.ts` | Spacing check in Akashic Record resolution |
| `src/services/turnManager.ts` | Encounter counter, lastSeenEncounter update per fact |
| Per-fact state type | Add lastSeenEncounter field |

## Verification Gate
- [ ] `npm run typecheck && npm run build && npx vitest run`
- [ ] Unit test: fact seen this encounter → no bonus
- [ ] Unit test: fact not seen in 3+ encounters → +50% + draw 1
