# Playtest Batch Summary — BATCH-2026-04-16-001
**Date**: 2026-04-16 | **Testers**: 1 (full-run) | **Domain**: ancient_rome | **Target Floors**: 3 | **Accuracy**: ~60% natural FSRS

## Overall Verdict: ISSUES

Player died on Floor 1 after 4 combat encounters. Core combat loop works but several bugs and balance concerns prevent clean full-game coverage.

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Full Run | ISSUES | 0 | 1 | 2 | 1 |

## Bugs Found

### HIGH
- **BUG-001: CombatScene FPS degradation** — 31fps down to 11fps over 24-minute session (19 FPS alerts). Classic memory accumulation pattern — particle/graphics objects not cleaned between encounters. Will affect all players in longer sessions.

### MEDIUM
- **BUG-002: rewardRoom Continue button non-functional** — `btn-reward-room-continue` is HIDDEN and clicking it doesn't transition to dungeonMap. Required `navigate('dungeonMap')` API bypass. This is blocking clean playtest coverage of shop/rest/mystery/boss rooms.
- **BUG-003: Map node states don't update after navigate() bypass** — r0-n0 stays `state-current` (never `state-completed`) after 3 completed combats. Side effect of BUG-002 workaround — the reward room flow normally triggers map state updates.

### LOW
- **BUG-004: Enemy intent value vs displayDamage inconsistency** — Crystal Crush shows `value:12` but delivers `displayDamage:26`. Not a gameplay bug (damage math is correct) but confusing for tooling.

## Balance Concerns

1. **Floor 1 HP death march** — No rest/mystery rooms accessible before completing 3+ combats. Player bled from 100 to 2 HP with zero healing window. Map structure put all special rooms behind combat rows.
2. **Overdue Golem overtuned for Floor 1** — 72 HP + 5 HP/turn heal + weakness cycling. Net DPS after healing required nearly 10 turns. This enemy feels like a Floor 2 encounter.
3. **Charged attack multipliers opaque** — Crystal Crush telegraphs `value:12` but actual damage is 26. Players see one number but take another.
4. **Combat length exceeded spec** — Thesis Construct and Overdue Golem both took 9 turns (spec: 4-7 turns for Floor 1).

## Domain Content Gap

The "ancient_rome" deck surfaced **zero ancient_rome-specific facts** across 30+ quiz charges. All facts came from animals_wildlife, geography, general_knowledge, human_body_health, and mythology_folklore. Either the deck falls back to generic starter cards or the domain label only affects enemy narrative, not card content.

## FSRS Assessment: WORKING

- ~10 unique facts drilled across 4 combats (~35 charges) — matches expected FSRS behavior
- Mastery upgrades confirmed (masteryLevel 0 to 1, baseEffectValue 4 to 8)
- Card type mutation on mastery observed (Avesta: Block to Strike) — interesting mechanic, should be documented
- Repeat question cycling confirmed working
- Cursed card state persists across combats (from enemy debuff) — may be intended but feels punishing

## Fun Rating: 6/10

**Positive**: Tactical quick/charge decisions feel meaningful, enemy variety is good, FSRS progression gives tangible power growth, death screen is clean.
**Negative**: Floor 1 feels like an HP attrition death march, FSRS repetition of 6-8 facts in 24 minutes is noticeable, cursed cards from enemy debuffs persist too long.

## Narration: NOT EVALUATED

No narration text was captured during the run. Either narration is Phaser-canvas only (not accessible via DOM), requires specific triggers not activated via API navigation, or the ancient_rome domain has no narration content. Needs manual verification or screenshot-based evaluation.

## Coverage Gaps

| Area | Covered? | Reason |
|------|----------|--------|
| Combat | YES | 4 encounters |
| Shop | NO | Not accessible before death |
| Rest | NO | Not accessible before death |
| Mystery | NO | Locked behind combat rows |
| Boss | NO | Died on Floor 1 |
| Retreat/Delve | NO | Died on Floor 1 |
| Narration | NO | Not visible via API |
| Floor 2-3 | NO | Died on Floor 1 |

## Recommendations

1. **Fix BUG-002 (rewardRoom Continue)** — This is the single biggest blocker for playtest coverage. Without it, post-combat flow breaks and map state corrupts.
2. **Investigate BUG-001 (FPS degradation)** — Memory leak in CombatScene. Profile particle/graphics object cleanup between encounters.
3. **Rebalance Floor 1 map layout** — Ensure at least one rest/mystery room is accessible after the first 1-2 combats, before the difficulty ramp.
4. **Review Overdue Golem placement** — 72 HP + heal + weakness cycling is overtuned for Floor 1. Consider moving to Floor 2 or reducing heal rate.
5. **Verify ancient_rome deck content** — Zero domain-specific facts appeared. Check if the deck is properly loaded or if starter cards override it.
6. **Document card type mutation on mastery** — The Avesta Block-to-Strike transformation is a cool mechanic but completely non-obvious to players.

## Next Steps
- Fix BUG-002, then re-run this exact playtest to get full 3-floor coverage
- Run `/balance-sim` to confirm Floor 1 attrition pattern statistically
- Run `/visual-inspect` on rewardRoom to diagnose the Continue button issue
- Manual playtest to evaluate narration quality (not API-accessible)
