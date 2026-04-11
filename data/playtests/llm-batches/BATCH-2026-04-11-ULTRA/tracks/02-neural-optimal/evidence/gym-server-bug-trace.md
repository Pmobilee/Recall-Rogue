# Gym-Server Bug Trace — Track 02 Neural-Optimal

## Root Cause

`comboCount` was removed from `TurnState` interface in `src/services/turnManager.ts` (replaced by `consecutiveCorrectThisEncounter` and `chainLength`), but `tests/playtest/headless/gym-server.ts` was never updated. This breaks the RL pipeline in two locations.

## Bug A — Observation NaN at index 6

**File:** `tests/playtest/headless/gym-server.ts:381`
```typescript
obs.push(Math.min(ts.comboCount / 10, 1));
// ts.comboCount = undefined → NaN → JSON null
```

**Effect:** On every step after the first (when TurnState is populated), obs[6] = NaN (serialized as null in JSON). This NaN propagates through the neural network, producing NaN logits for all 30 action outputs. `MaskablePPO.predict()` raises a `ValueError` immediately.

**Verified by running:**
```
obs shape: (120,)
obs has NaN: True at index 6 after step 1
```

## Bug B — Reward NaN

**File:** `tests/playtest/headless/gym-server.ts:628`
```typescript
if (actionResult.wasCorrect) reward += 0.1 * ts.comboCount;
// ts.comboCount = undefined → 0.1 * undefined = NaN → JSON null
```

**Effect:** Any charge action that was correct returns `reward = null` from the server. The Python env tries `float(response["reward"])` → `TypeError`.

## Additional stale comboCount references in gym-server

Lines 89, 750, 810, 870, 977, 982, 1111, 1212 — all reference `comboCount` on `TurnState` or `PrevState`. The `PrevState` interface still defines it. All of these produce undefined at runtime.

## Fix Required (NOT done by this track — detection only)

In `gym-server.ts`:
1. Line 381: Replace `ts.comboCount` with `ts.consecutiveCorrectThisEncounter` (the replacement field in TurnState)
2. Line 628: Replace `ts.comboCount` with `ts.consecutiveCorrectThisEncounter`
3. Lines 870, 977, 982, 1111, 1212: Replace all remaining `comboCount` references with `consecutiveCorrectThisEncounter` or `chainLength` as appropriate
4. Update `PrevState` interface at line 89 (rename field)
5. Retrain or verify model still performs after obs space stabilizes

## Model Checkpoint Status

All 6 zip checkpoints in `tests/playtest/rl/models/` exist but none can run:
- `rogue_brain_100k.zip` — obs space 80, env is 120 → shape mismatch
- `rogue_brain_500k.zip` — obs space 80, env is 120 → shape mismatch
- `rogue_brain_v2_500k.zip` — obs space 120, NaN bug B (reward)
- `rogue_brain_v2_2M.zip` — obs space 120, NaN bug B (reward)
- `rogue_brain_v2_masked_2M.zip` — obs space 120, NaN bug A + B
- `rogue_brain_v3_economy_2M.zip` — obs space 120, NaN bug A + B

The `latest/` symlink points to an empty directory: `tests/playtest/rl/models/20260325_162724/` (empty).

## Evidence of Single-Step Success

The environment CAN produce valid observations on reset (before any TurnState exists). The first action in `room_select` phase (no TurnState) also succeeds. The failure occurs precisely when `buildCombatObsSlice` is called with a live `TurnState` that lacks `comboCount`.
