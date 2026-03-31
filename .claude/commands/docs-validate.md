---
description: Prediction-test documentation accuracy — read docs only, predict code structure, verify
---

Validate documentation accuracy by testing whether docs alone can predict code reality.

## Step 1: Predict from Docs Only

Read ONLY these files (NO source code yet):
- `CLAUDE.md`
- `docs/INDEX.md`
- `docs/architecture/services.md` (or `docs/ARCHITECTURE.md` if sub-files don't exist yet)
- `docs/mechanics/combat.md` (or relevant GDD sections)

From docs alone, predict:
1. **Services**: List all services you expect to find in `src/services/`
2. **Folders**: List all top-level folders you expect under `src/`
3. **Damage Pipeline**: Describe the order of operations for card damage resolution
4. **Card Charge Flow**: Which files are involved when a player charges a card?
5. **Chain Multipliers**: What are the exact multiplier values?

Write predictions to a temporary note.

## Step 2: Check Predictions vs Code

Now read the actual source code and compare each prediction:
- ✅ CORRECT — doc prediction matches code exactly
- ⚠️ PARTIAL — roughly right but missing details or slightly wrong values
- ❌ WRONG — doc prediction contradicts code

## Step 3: Report

```
# Docs Validation Report — [date]

## Prediction Accuracy: X/5

### 1. Services — [✅/⚠️/❌]
Predicted: [list]
Actual: [list]
Missing from docs: [list]

### 2. Folders — [✅/⚠️/❌]
...

### 3. Damage Pipeline — [✅/⚠️/❌]
...

### 4. Card Charge Flow — [✅/⚠️/❌]
...

### 5. Chain Multipliers — [✅/⚠️/❌]
...

## Verdict
- 4/5+ correct: ✅ Docs are trustworthy
- 3/5 or below: ⚠️ Recommend running /docs-freshness and fixing gaps
```
