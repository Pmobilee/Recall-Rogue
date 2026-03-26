# AR-260: Enemy HP Scaling + GDD Cleanup

## Overview

**Goal:** Double all enemy effective HP by changing `ENEMY_BASE_HP_MULTIPLIER` from 2.0 to 4.0. Simultaneously clean the GDD of all per-enemy hardcoded HP numbers, making `enemies.ts` the sole source of truth for HP values.

**Why:** Enemy HP is too low — commons die in ~2 Charge Correct turns, making fights feel trivially short. Doubling HP creates ~4-turn fights that give quiz performance, card synergies, and strategic decisions more room to matter. Existing card damage stays unchanged (fights are intentionally longer).

**Dependencies:** None (first AR in the overhaul chain)
**Estimated complexity:** Small (1 constant + doc cleanup + test audit)

---

## Sub-steps

### 1. Change ENEMY_BASE_HP_MULTIPLIER

**File:** `src/data/balance.ts` line 407

```typescript
// Before
export const ENEMY_BASE_HP_MULTIPLIER = 2.0;

// After
export const ENEMY_BASE_HP_MULTIPLIER = 4.0;
```

**Acceptance criteria:** The constant is 4.0. No other balance constants are changed.

### 2. Update GDD Section 8 — Remove All Per-Enemy HP Numbers

**File:** `docs/GAME_DESIGN.md` lines 1535-1967

Replace every enemy entry that currently reads like:
```
**Page Flutter** (`page_flutter`) — Common (standard, weight 10)
HP: 5 | Intents: Attack 2 (wt 3), Attack 2 (wt 2), ...
```

With a format that omits the HP number:
```
**Page Flutter** (`page_flutter`) — Common (standard, weight 10) | Glass tier
Intents: Attack 2 (wt 3), Attack 2 (wt 2), ...
```

**Tier labels to use:**
- **Commons:** Glass (baseHP 4), Standard (baseHP 5), Tanky (baseHP 7)
- **Mini-bosses:** Light (baseHP 6-7), Medium (baseHP 8-9), Heavy (baseHP 10-11)
- **Elites:** Reference `enemies.ts` (baseHP 7-12)
- **Bosses:** Reference `enemies.ts` (baseHP 11-19)

Add this note at the top of Section 8, after the design philosophy paragraph:

> **HP Source of Truth:** All enemy HP values live exclusively in `src/data/enemies.ts`. Effective HP = `baseHP × ENEMY_BASE_HP_MULTIPLIER × floorScaling`. The GDD documents enemy tiers and intent pools only — not specific HP numbers. See `balance.ts` for the current multiplier value.

**Acceptance criteria:** Zero `HP: N` lines remain in Section 8. Every enemy entry has a tier label instead. The source-of-truth note is present.

### 3. Update GDD Difficulty Section — Fix Multiplier Reference

**File:** `docs/GAME_DESIGN.md` line ~2026

Update this line:
```
Enemy HP scales with floor depth: 1.0 + (floor - 1) × 0.10 (10% per floor above floor 1). Multiplied by global ENEMY_BASE_HP_MULTIPLIER = 2.0, making floor 1 commons ~10 HP each
```

To:
```
Enemy HP scales with floor depth: 1.0 + (floor - 1) × 0.10 (10% per floor above floor 1). Multiplied by global ENEMY_BASE_HP_MULTIPLIER = 4.0, making floor 1 commons ~20 HP each
```

Also update the effective HP examples on lines 2028-2031:
- Glass (baseHP 4): Floor 1 effective HP: **16** (was 8)
- Standard (baseHP 5): Floor 1 effective HP: **20** (was 10)
- Tanky (baseHP 7): Floor 1 effective HP: **28** (was 14)
- Elites: Glass (7) → **28**, Standard (9) → **36**, Tanky (12) → **48**

**Acceptance criteria:** All multiplier references and effective HP examples reflect the 4.0 multiplier.

### 4. Audit and Fix Unit Tests

Search the test suite for assertions on specific enemy HP values:
```bash
grep -rn 'currentHP\|maxHP\|ENEMY_BASE_HP_MULTIPLIER' tests/
```

Update any hardcoded expected HP values to reflect the 4.0 multiplier. Common patterns:
- `expect(enemy.currentHP).toBe(X)` → double X
- `expect(enemy.maxHP).toBe(X)` → double X
- Tests that reference `ENEMY_BASE_HP_MULTIPLIER` directly should still pass

**Acceptance criteria:** `npx vitest run` passes with zero failures.

### 5. Run Headless Sim — Establish New Baseline

```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
```

Document the new baseline win rates. They WILL drop significantly — that's expected and intended. This baseline is the reference point for all subsequent ARs.

**Acceptance criteria:** Sim completes without errors. New win rates documented in this AR doc (fill in after running).

---

## Files Affected

| File | Change |
|------|--------|
| `src/data/balance.ts` | Line 407: 2.0 → 4.0 |
| `docs/GAME_DESIGN.md` | Section 8: remove all HP numbers, add tier labels. Lines ~2026-2035: update multiplier and examples |
| `tests/**` | Any tests asserting specific enemy HP values |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Headless sim completes, new baseline win rates documented
- [ ] No `HP: N` lines remain in GDD Section 8
- [ ] GDD difficulty section references 4.0 multiplier with correct effective HP examples
