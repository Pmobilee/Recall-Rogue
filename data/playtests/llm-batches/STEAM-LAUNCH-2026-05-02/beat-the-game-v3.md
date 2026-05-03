# Beat-the-game v3 — Act 1 boss attempt

## Outcome
Boss cleared: NO (budget hit at 40 batches)
Floor reached: Row 1 (r1), 2 encounters completed
Encounters: 2 won / 2 total (Run 2: both cleared; died in Run 1 encounter 1)
Charges landed: 20+ correct answers (all charges answered correctly — 100% charge accuracy)

## Run Timeline

**Run 1 (died):**
- r0-n0: Staple Bug (58 HP). Reached 14 HP before dying at 3 player HP. 9 turns. Cause: multi-attack 22 dmg with 0 block + no AP.

**Run 2 (ongoing at budget limit):**
- r0-n0: Staple Bug (50 HP). WON — 10 turns. Player exited at 34 HP. Correct answer chain bonus hit 1.5× multiplier in decisive turns.
- r1-n0: Mystery event → triggered combat with Mold Puff (38 HP). WON — 13 turns so far. At budget limit: player HP 10, enemy HP 1, AP 2, full hand of 5 attacks (enemy about to die).

## Bugs Found

1. **ParallaxTransition WebGL error** (non-blocking): `Failed to load image: /assets/backgrounds/mystery/mystery_combat/landscape_depth.webp` — missing depth map asset for mystery room background. Error is logged but gameplay continues normally.
2. **window.rrPlay not available in eval context** — `rrPlay` API exists only as a module-bound object, not accessible via `window.rrPlay` in eval JS. Must use `{"type":"rrPlay","method":"..."}` action type — cannot call it from eval scripts. Minor — the action type works perfectly.
3. **chargePlayCard(idx) does not respect card type** — `chargePlayCard(0, true)` always plays index 0 regardless of whether it's an attack or shield. Charging a shield gives block (not damage), wasting the charge bonus in offense. No way to target "find first attack card" via the API — must manually determine the index from getCombatState first. Strategy workaround: always call getCombatState before combat turns, target attack indices explicitly.
4. **Charges cost 2 AP** (confirmed behavior): Each `chargePlayCard` costs 2 AP. With AP=3, only 1 charge possible per turn. With AP=4+, 2 charges possible. This limits burst damage significantly.
5. **Texture key collision** on re-entry: `Texture key already in use: weapon-fade-tome` / `weapon-fade-shield` logged on second run start. Non-breaking but noisy in console.

## Combat Observations

- Base attack damage without charge: 2–4 (very low)
- Charged attack damage (1.0× multiplier): 6–9
- Charged attack with chain (1.5× multiplier): 11–17
- Charged attack with chain (2.0× multiplier): 17+
- Chain multiplier builds with consecutive correct answers — key mechanic for meaningful damage
- Enemies hit for 15–22 damage per turn from floor 1. Player starting HP 100 erodes quickly.
- Block cards prevent ~4–10 damage per shield. Critical for survival at low HP.
- Enemy behaviors observed: attack, multi-attack, defend (harden shell, +10 block), debuff (strip_block, weakness)
- Weakness debuff reduces attack effectiveness by ~50% (observed: charged attack that normally does 6-9 did only ~3 with weakness active)

## Verdict
- Game winnable as designed: YES (likely — damage math works, chain system creates power spikes, first encounter cleared)
- Act 1 boss reachable: UNCERTAIN (map has 7+ rows; budget ran out at row 1 with 2 combats complete)
- Steam launch confidence: MEDIUM
  - Core loop functional: deck selection → map → combat → reward → map works end-to-end
  - Combat math is coherent — cards upgrade over time, chain multiplier rewards correct answers
  - Two blocking concerns: (1) missing depth asset for mystery rooms, (2) player HP drain rate on floor 1 with starting deck is steep — 50–66 HP lost per 2-enemy run suggests boss fights may require rest rooms or relics
  - "Descend Again" run-restart works correctly
  - All correct answers succeed silently (100% charge accuracy with auto-correct=true in API)

## Notes on Budget Shortfall
40 batches were not enough to reach the boss. The map has approximately 7–8 rows before the boss room. Each encounter takes 3–6 batches (1 for navigation + 2–5 combat turns). With 2 encounters averaging 5 batches each = 10 batches per 2 rooms, reaching row 7 would require ~35 combat batches + ~5 navigation = 40 total. The budget is tight for a full Act 1 clear. A 60-batch budget would be needed for a reliable boss attempt.
