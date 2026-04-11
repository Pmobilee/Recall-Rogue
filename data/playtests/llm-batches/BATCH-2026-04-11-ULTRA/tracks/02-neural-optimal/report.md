# Track 02 — Neural-Optimal (Rogue Brain PPO Analysis)

**Date:** 2026-04-11
**Verdict:** BLOCKED
**Model Checkpoint:** rogue_brain_v2_masked_2M.zip (attempted), rogue_brain_v2_2M.zip (attempted)
**Episodes Attempted:** 0 (all fail within 1-4 steps)
**Downgraded:** Yes — full 200-episode analysis blocked; 50-episode smoke test also blocked

---

## Executive Summary

The Rogue Brain RL pipeline is **completely non-functional** due to a gym-server drift bug. The field `comboCount` was removed from `TurnState` in `src/services/turnManager.ts` at some point after the last model training run (2026-03-25), but `tests/playtest/headless/gym-server.ts` was never updated. This produces two cascading failures:

1. **Observation corruption**: `ts.comboCount / 10` → NaN → JSON null at obs[6]. On MaskablePPO models, this causes all 30 action logits to become NaN on the first combat step, and `MaskablePPO.predict()` raises an immediate `ValueError`.

2. **Reward signal corruption**: `0.1 * ts.comboCount` → NaN → JSON null. On plain PPO models, this causes `float(None)` → `TypeError` in the Python env on any correct charge action.

All 6 model checkpoints were tested. None can complete a single episode:
- `rogue_brain_100k.zip` / `rogue_brain_500k.zip` — obs-space mismatch (80 vs 120 float)
- `rogue_brain_v2_500k.zip` / `rogue_brain_v2_2M.zip` — Bug B (reward TypeError)
- `rogue_brain_v2_masked_2M.zip` / `rogue_brain_v3_economy_2M.zip` — Bug A (logit NaN)

The `latest/` model directory symlink points to an empty folder.

**There is no RL strategy analysis to report because zero episodes completed.** However, the investigation surface was valuable — the bugs found are high-severity findings in their own right.

---

## Investigation Methodology

Rather than just reporting "blocked," this track performed root-cause analysis:

1. Verified Python dependencies (stable-baselines3 2.7.1, sb3-contrib 2.7.1, gymnasium) — all present.
2. Verified all 6 model checkpoints load with `MaskablePPO.load()` / `PPO.load()` — all load.
3. Verified gym-server launches and responds to protocol — it does.
4. Traced observation vector values step by step — found NaN at index 6 on step 2.
5. Mapped obs index 6 → `buildCombatObsSlice` line 381 → `ts.comboCount`.
6. Confirmed `comboCount` is absent from `TurnState` in `src/services/turnManager.ts`.
7. Identified replacement fields: `consecutiveCorrectThisEncounter`, `chainLength`.
8. Verified Bug B in reward calculation: `calculateCombatReward` line 628.
9. Enumerated all 10 stale `comboCount` references in gym-server.ts.

---

## 17-Category Report — Status Per Category

Since zero episodes completed, all 17 categories are blocked. The status and blockage reason are noted for each.

| # | Category | Status | Note |
|---|----------|--------|------|
| 1 | Overview (win rate, HP preservation) | BLOCKED | Zero complete episodes |
| 2 | Action Distribution (charge/quick/skip) | BLOCKED | — |
| 3 | Card Index Preference | BLOCKED | — |
| 4 | Charge vs Quick Strategy | BLOCKED | Reward for correct charge was broken throughout ALL prior training |
| 5 | Knowledge Chain Behavior | BLOCKED | comboCount was proxy for chain behavior; model never got signal |
| 6 | Per-Enemy Difficulty | BLOCKED | — |
| 7 | Death Analysis | BLOCKED | — |
| 8 | Combat Efficiency | BLOCKED | — |
| 9 | Skip Turn Behavior | BLOCKED | — |
| 10 | Room Selection Strategy | BLOCKED | First step (room_select) succeeds; analysis halts at combat entry |
| 11 | Deck Building (card rewards) | BLOCKED | — |
| 12 | Relic Strategy | BLOCKED | — |
| 13 | Shop Behavior | BLOCKED | — |
| 14 | Rest Site Strategy | BLOCKED | — |
| 15 | Retreat vs Delve | BLOCKED | — |
| 16 | Floor Progression | BLOCKED | All episodes die on floor 1 |
| 17 | Balance Recommendations | BLOCKED — partial | See secondary analysis below |

### Category 17 — Balance Recommendations (Partial, from Bug Analysis)

While the RL agent cannot give strategy data, the bugs found reveal important structural insights:

**Finding 17A — Charge reward signal was broken during all training:**
The reward for correct charges (`0.1 * ts.comboCount`) was NaN (serialized as null) throughout all training runs from v2 onward. This means the models NEVER received a positive signal for answering charges correctly. The models' charge-vs-quick decisions reflect a corrupted reward landscape. Specifically: the model was incentivized for damage dealt and shield gained (lines 623-624 work fine), chain extension (line 625 works), but NOT for quiz accuracy. The trained models may systematically prefer quick-play over charge-play (since charge play had no demonstrable reward advantage from the model's perspective).

**Finding 17B — The v3_economy model name suggests economic tuning, but its core combat signal was also broken:**
The `rogue_brain_v3_economy_2M.zip` model (latest trained, 2026-03-25) presumably added shop/gold reward signals, but since it also uses `comboCount`, both the combat charge bonus AND the comboCount obs dimension were still broken. The economic tuning improvements (shop/gold rewards) may be genuine but the combat optimization is suspect.

**Finding 17C — Room-select phase observation is fine:**
The observation is valid at `room_select` phase (no TurnState = no comboCount read). If a future fixed model were trained and analyzed, room selection behavior from the first step would be trustworthy. Current models correctly identify room_select as the starting phase and pick option 0 (action 18) on reset.

---

## Secondary Findings (Beyond Blocking Bugs)

### gym-server action mask behavior (verified working)
The `getActionMask()` function works correctly. On reset (room_select phase), 3 actions are enabled (18, 19, 20 = pick room option 0/1/2). This is structurally correct.

### Environment one-step behavior (verified working)
- Reset produces valid 120-float observation (no NaN)
- `room_select → combat` transition works (action 18)
- First combat action mask is produced correctly (cards 0-4 + 8-12 + 16 enabled based on AP)
- Protocol (cmd/opts format) is correct and functional

### Obs space is stable at 120 floats
The environment correctly emits 120-float observations. The v2 and v3 models were trained with the right obs dimension. The only issue is the NaN at position 6.

---

## What Would a Working Analysis Show?

Based on the game's mechanics and the headless sim data (Track 01), the expected RL findings would be:

- **Dominant pick pattern**: Relics that grant AP or floor-advance bonuses would likely show high pick rates (e.g., Swift Boots, Vitality Ring). The model optimizes for survival.
- **Quick vs Charge**: With the broken reward signal, models likely learned to quick-play more than is optimal. A fixed model trained with correct charge bonuses would likely shift toward charging.
- **Room selection**: Rest rooms should be attractive when HP < 60%. Shop when gold > 80g. The v3 economy model may have learned this.
- **Death floor**: Floor 1-2 early deaths in earlier models (harder enemies); late models may get further.

These are inferences only — not RL-derived conclusions.

---

## Issues Found

4 issues filed in `issues.json`:
- `issue-1775871222977-02-001` — CRITICAL: comboCount NaN blocks entire RL pipeline
- `issue-1775871222977-02-002` — HIGH: latest/ checkpoint directory is empty
- `issue-1775871222977-02-003` — HIGH: all trained models have corrupted charge-reward signal
- `issue-1775871222977-02-004` — MEDIUM: 5 additional stale comboCount references in gym-server

---

## Fix Priority

**To unblock RL testing (minimal):**
1. In `gym-server.ts`, line 381: replace `ts.comboCount` with `(ts as any).consecutiveCorrectThisEncounter ?? 0`
2. In `gym-server.ts`, line 628: replace `ts.comboCount` with `(ts as any).consecutiveCorrectThisEncounter ?? 0`
3. These two changes allow the environment to run. Test with 10-episode smoke run.

**To have trustworthy RL data (full):**
4. Fix all 10 comboCount references in gym-server.ts
5. Update TypeScript types (remove stale interface field from PrevState)
6. Retrain a new model (v4) from scratch — all existing models have corrupted reward histories
7. Run the 200-episode analysis on the new model
