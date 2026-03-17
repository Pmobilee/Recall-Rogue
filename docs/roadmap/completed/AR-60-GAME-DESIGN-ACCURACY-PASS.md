# AR-60 — GAME_DESIGN.md Accuracy Pass

> **Type:** Documentation accuracy pass
> **Status:** COMPLETE
> **Priority:** High — stale docs = bugs
> **Estimated effort:** 2-4 hours
> **Dependencies:** AR-59 (all sub-ARs complete)

---

## Overview

The current `docs/GAME_DESIGN.md` was written by the AR-59.21 agent during implementation. Most of it is correct, but several sections contain stale references because AR-59.23 changed from a discovery overlay/cardHint design to the simpler "Free First Charge" mechanic after AR-59.21 was written. Additional drift exists around balance constants, removed mechanics, and system details that were tuned after the initial doc pass.

This AR is a **targeted accuracy pass**, not a full rewrite. The v2 GAME_DESIGN.md is already ~1780 lines and mostly correct. This AR fixes 10 known issues and scans for any additional inconsistencies found during verification.

---

## Known Issues to Fix

### Issue 1 — Free First Charge section (§2)

**Problem:** Section may still reference the old AR-59.23 design: cardHint amber glow on undiscovered Tier 1 facts, discovery overlay on first Quick Play, Tier 2+ auto-discover.

**Correct behavior (final implementation):**
- First Charge of any fact costs 0 AP (no surcharge)
- Wrong answer on a Free First Charge = 1.0× multiplier (same as Quick Play, no penalty)
- Subsequent Charges cost +1 AP and behave normally
- No cardHint UI element, no amber glow, no discovery overlay

**Source of truth:** `docs/RESEARCH/fact-discovery-system.md` (v2 revision at top of file)

**Action:** Read the current §2 text. If it references cardHint/overlay/amber glow, replace with the Free First Charge description above.

---

### Issue 2 — Timer table (§2)

**Problem:** Table currently shows floors 1-6, 7-12, 13-18, 19-24, 25+ (old v1 structure). v2 only has 12 floors across 3 acts (4 floors per act).

**Correct timer table:**
| Floors | Base Time |
|--------|-----------|
| 1–4 (Act 1) | 12s |
| 5–8 (Act 2) | 10s |
| 9–12 (Act 3) | 8s |

**Source of truth:** `src/data/balance.ts` (timer config), `docs/RESEARCH/recall-rogue-overhaul-v2.md`

**Action:** Read `balance.ts` for exact timer values. Replace the old floor-range timer table with the 3-act version.

---

### Issue 3 — Map config constants (§7)

**Problem:** Section likely shows `ROWS_PER_ACT = 15` (old value). AR-59.5 changed this to 8.

**Source of truth:** `src/data/balance.ts` (look for `ROWS_PER_ACT` or equivalent map constant)

**Action:** Read `balance.ts` for the actual `ROWS_PER_ACT` value and update §7 to match.

---

### Issue 4 — FSRS tier thresholds (§5)

**Problem:** D24 decision (post-implementation tuning) reduced `consecutiveCorrect` requirements:
- Tier 2b: 3 → 2
- Tier 3: 4 → 3

**Source of truth:** `src/data/mechanics.ts` or `src/services/cardEffectResolver.ts` (FSRS tier advancement logic)

**Action:** Read the actual tier threshold values from code. Verify §5 matches. Fix if stale.

---

### Issue 5 — Canary thresholds (§10)

**Problem:** D22/AR-59.19 retuned canary system thresholds:
- Deep Assist: 5 → 3 (consecutive wrong triggers deep assist)
- Assist: 3 → 2
- Challenge: 5 → 4 (consecutive correct triggers challenge mode)

**Source of truth:** `src/services/turnManager.ts` or wherever canary/adaptive difficulty is implemented

**Action:** Read the actual canary threshold values from code. Verify §10 matches. Fix if stale.

---

### Issue 6 — Parry mechanic (§6)

**Problem:** Parry is listed in the Shield mechanics table as an active mechanic. AR-59.9 archived it.

**Action:** Remove Parry from the active mechanics table in §6. If there's an "archived mechanics" section, it can be referenced there. Do NOT leave it in the active mechanics table.

---

### Issue 7 — Study at rest sites (§7)

**Problem:** Rest site "Study" option may be described as upgrading a random deck card.

**Correct behavior (D20 decision):** Player is shown 3 random cards from their deck and CHOOSES which one to upgrade. Not random.

**Source of truth:** `src/services/gameFlowController.ts` (rest site logic)

**Action:** Verify §7 rest site description. If it says "random card", change to "choose 1 of 3 random cards from your deck to upgrade".

---

### Issue 8 — Chain description (§3)

**Problem:** May incorrectly describe chain-building as "Charge-only" or vice versa.

**Correct behavior:** Chains can be built by BOTH Quick Play and Charge plays of the same domain — OR by consecutive Charge plays. (Verify the exact rule against implementation.)

**Source of truth:** `src/services/gameFlowController.ts` or chain-related logic (search for `chain` in services)

**Action:** Read chain-building logic. Verify §3 accurately describes what triggers chain increments and resets.

---

### Issue 9 — Enemy roster (§8)

**Problem:** Enemy HP/damage/ability values in §8 may not match the final implemented values from AR-59.13.

**Source of truth:** `src/data/enemies.ts` (or equivalent enemy definition file)

**Action:** Read `enemies.ts`. For each enemy listed in §8, verify HP, damage, and special ability description matches. Fix any discrepancies. If an enemy exists in code but not docs, add it. If an enemy is in docs but not code, mark as "(planned)" or remove.

---

### Issue 10 — Relic catalogue (§16)

**Problem:** Relic names, effects, and counts in §16 may not match the final implemented relics from AR-59.11.

**Source of truth:** `src/data/relics/starters.ts` and `src/data/relics/unlockable.ts` (or equivalent relic definition files — search for relic data)

**Action:** Read relic data files. Verify §16 relic catalogue matches. Fix names, effect descriptions, and counts that are stale. Add missing relics. Remove relics that no longer exist.

---

## Implementation Approach

The implementing agent should work through each issue in order:

1. Read `docs/GAME_DESIGN.md` (relevant sections)
2. Read the source-of-truth files listed for each issue
3. Apply targeted fixes — edit only the specific lines/tables that are wrong
4. After fixing all 10 issues, do a final scan of the full doc for any other obvious inconsistencies (wrong numbers, references to removed mechanics like "Fizzle" if it was removed, etc.)
5. Do NOT rewrite sections that are correct — minimal diff preferred

---

## Files Affected

- `docs/GAME_DESIGN.md` — targeted fixes only (10 known issues + any additional found during scan)

### Reference files to read (do NOT modify):
- `src/data/balance.ts`
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/turnManager.ts`
- `src/services/gameFlowController.ts`
- `src/data/enemies.ts` (or wherever enemy data lives)
- Relic data files (search `src/data/` for relic definitions)
- `docs/RESEARCH/fact-discovery-system.md`
- `docs/RESEARCH/recall-rogue-overhaul-v2.md`

---

## Acceptance Criteria

- [x] Free First Charge section matches implementation (already correct — no changes needed)
- [x] Timer table matches balance.ts FLOOR_TIMER (doc was already correct — same segmented structure)
- [x] Map config constants match actual code values (already correct — ROWS_PER_ACT=15, BOSS_ROW=14, PRE_BOSS_ROW=13)
- [x] FSRS tier advancement thresholds match code in tierDerivation.ts (already correct — Tier 2b: ≥3, Tier 3: ≥4)
- [x] Canary thresholds match code constants in balance.ts (already correct — Deep Assist=5, Assist=3, Challenge=5)
- [x] Parry removed from active mechanics table in §6 (FIXED)
- [x] Study at rest site describes player choice (FIXED — "choose 1 eligible card from deck to upgrade")
- [x] Chain description matches chainSystem.ts (already correct — chains built by correct Charge plays only)
- [x] Enemy stats in §8 match enemies.ts (already correct — HP/damage values verified)
- [x] Relic catalogue in §16 matches relic data files (FIXED — removed Momentum Gem which was absent from relic data files)

---

## Verification Gate

After implementation:
1. `npm run typecheck` — must pass (no changes to .ts files, but confirm)
2. Manually review the 10 changed sections in GAME_DESIGN.md for correctness
3. No other doc files need updating — this AR only touches GAME_DESIGN.md
