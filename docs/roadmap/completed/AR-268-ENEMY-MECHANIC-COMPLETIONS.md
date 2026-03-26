# AR-268: Enemy Mechanic Completions (Trick Question + Brain Fog)

## Overview
**Goal:** Complete the two enemy quiz-reactive mechanics that were deferred in AR-263 due to complexity.
**Dependencies:** AR-263 (base enemy hooks already in place)
**Estimated complexity:** Medium

---

## Sub-steps

### 1. Brain Fog — Mastery Erosion

**Current:** TODO stub in `src/data/enemies.ts` ~line 1090. `EnemyTurnStartContext` lacks required fields.

**Full mechanic:** On enemy turn start, if player made 0 correct charges last turn, one random card in hand with mastery >= 2 loses 1 mastery level.

**Implementation:**
1. Extend `EnemyTurnStartContext` in `src/data/enemies.ts` with:
   - `playerChargedCorrectLastTurn: boolean`
   - `playerHand: Array<{ id: string; masteryLevel?: number }>` (minimal card info)
2. In `src/services/turnManager.ts`, track `chargedCorrectThisTurn: boolean` flag (set true on any correct charge, reset each turn start)
3. When calling `onEnemyTurnStart`, pass the flag and hand info
4. In Brain Fog's `onEnemyTurnStart`: if `!ctx.playerChargedCorrectLastTurn`, find eligible cards (mastery >= 2), pick random, decrement mastery

**Acceptance criteria:**
- 0 correct charges last turn + card with mastery >= 2 → 1 mastery lost
- At least 1 correct charge → no erosion
- Cards with mastery < 2 → immune

### 2. Trick Question — Full Card Lock Mechanic

**Current:** `onPlayerChargeWrong` heals enemy 8 HP only. TODO for full lock at ~line 1051.

**Full mechanic:**
1. On wrong charge vs Trick Question: store `_lockedFactId` on enemy instance + set `_lockTurnsRemaining = 2`
2. At next player turn start: if enemy has `_lockedFactId`, pick one random hand card and set `isLocked = true`, `lockedFactId = _lockedFactId` on that card
3. Locked card: QP disabled (tap shows "Locked" message). Can only be Charged. Quiz forced to use the locked factId.
4. Resolution: Correct retry → card plays at 2x power, lock clears. Wrong retry → enemy heals 8 HP, lock persists.
5. Lock auto-expires after `_lockTurnsRemaining` reaches 0 (decremented each turn)

**Files:**
- `src/data/enemies.ts` — expand Trick Question hooks, add `_lockedFactId`, `_lockTurnsRemaining` to EnemyInstance
- `src/data/card-types.ts` — add `isLocked?: boolean`, `lockedFactId?: string` to Card interface
- `src/services/turnManager.ts` — at player turn start, apply lock from enemy state; on card play, check lock state; handle lock resolution
- `src/ui/components/CardHand.svelte` — locked card visual (🔒 icon overlay, red-tinted border, QP tap disabled)

**Acceptance criteria:**
- Wrong charge vs Trick Question → one card locked next turn
- Locked card shows 🔒 visual, QP disabled
- Correct retry → 2x power, lock cleared
- Wrong retry → enemy heals 8 HP
- Lock expires after 2 turns if unresolved

---

## Files Affected
| File | Change |
|------|--------|
| `src/data/enemies.ts` | EnemyTurnStartContext extension, Brain Fog hook, Trick Question hook expansion |
| `src/data/card-types.ts` | Add isLocked, lockedFactId to Card |
| `src/services/turnManager.ts` | chargedCorrectThisTurn tracking, lock application/resolution, context passing |
| `src/ui/components/CardHand.svelte` | Locked card visual overlay |
| `docs/GAME_DESIGN.md` | Update §8 for both enemies |

## Verification Gate
- [ ] `npm run typecheck && npm run build`
- [ ] `npx vitest run` — all tests pass
- [ ] Unit tests for lock lifecycle and mastery erosion
