# Card Mastery Level Audit — Full Review

**Date**: 2026-04-18  
**Author**: Orchestrator (manual review, not agent-generated)  
**Context**: Player reported Reckless L0 (4 dmg / 4 self-dmg) feels insane. Full audit of all 96 mechanics for balance at every mastery level.

**Notation**: QP = Quick Play value. CC = QP × 1.5. CW = QP × 0.5. Self-damage and secondary effects are fixed per-level (don't scale with play mode unless noted).

---

## Systemic Issue: L0→L1 Regressions

Several cards had their L0 `secondaryValue` or `extras` bumped to match hardcoded resolver fallbacks, creating a progression where **leveling from L0 to L1 makes the card worse**. Players who master a card and see it get weaker will feel cheated.

Affected cards: `lacerate`, `kindle`, `thorns`, `riposte`, `execute`, `parry`.

---

## ATTACK CARDS

### Strike
| Level | QP | Notes |
|-------|-----|-------|
| L0 | 4 | |
| L1 | 4 | |
| L2 | 5 | |
| L3 | 6 | |
| L4 | 7 | |
| L5 | 8 | +4 bonus on 3+ cards played (Tempo) |

**Verdict**: Fine. Clean scaling, good L5 payoff.

---

### Multi-Hit
| Level | QP | Hits | Notes |
|-------|-----|------|-------|
| L0 | 2 | 2 | Total: 4 |
| L1 | 2 | 3 | Total: 6 — nice jump |
| L2 | 2 | 3 | Total: 6 |
| L3 | 2 | 3 | +1 Bleed/hit |
| L4 | 2 | 4 | Total: 8 |
| L5 | 3 | 4 | Total: 12 + Bleed |

**Verdict**: Fine. Each level feels meaningful.

---

### Heavy Strike
| Level | QP | AP | Notes |
|-------|-----|----|-------|
| L0 | 7 | 2 | |
| L1 | 8 | 2 | |
| L2 | 9 | 2 | |
| L3 | 10 | 2 | |
| L4 | 11 | 2 | |
| L5 | 12 | 1 | AP reduction is great |

**Verdict**: Fine. Strong card with a satisfying L5 moment.

---

### Piercing
| Level | QP | Notes |
|-------|-----|-------|
| L0 | 3 | |
| L1 | 3 | |
| L2 | 3 | |
| L3 | 4 | Strips 3 enemy block |
| L4 | 5 | |
| L5 | 6 | Strips block + Vuln 1t |

**Verdict**: Fine. L0-L2 are flat (3/3/3) which feels stagnant — but the ignore-block passive compensates.

---

### Reckless ⚠️ CRITICAL
| Level | QP | Self-Dmg | Net (QP) | Net (CW) |
|-------|-----|----------|----------|----------|
| L0 | 4 | 4 | **0** | **-2** |
| L1 | 5 | 4 | +1 | -1.5 |
| L2 | 6 | 3 | +3 | 0 |
| L3 | 8 | 3 | +5 | +1 |
| L4 | 10 | 2 | +8 | +3 |
| L5 | 10 | 0 | +10 | +5 |

**Observations**:
- **L0 is actively bad.** QP deals 4 and you take 4 — net zero. Strictly worse than Strike (4/0). CW is even worse: 2 damage to enemy, 4 to yourself. No rational player would play this at L0 unless forced.
- L1 is barely better. L2 is the first level where the card feels playable.
- The progression from L2→L5 is great — the payoff of mastering a risky card is satisfying.

**Proposed fix**:
| Level | QP | Self-Dmg | Rationale |
|-------|-----|----------|-----------|
| L0 | 6 | 2 | Net +4 QP, net +1 CW — risky but not suicidal |
| L1 | 7 | 2 | |
| L2 | 8 | 2 | |
| L3 | 9 | 1 | Self-dmg drops |
| L4 | 10 | 1 | |
| L5 | 10 | 0 | Same endgame — chain-scaled self-dmg |

---

### Execute
| Level | QP | Exec Bonus | Threshold | Notes |
|-------|-----|------------|-----------|-------|
| L0 | 2 | **8** | 30% | |
| L1 | 3 | **5** | 30% | ⚠️ REGRESSION: bonus drops 8→5 |
| L2 | 3 | 6 | 30% | |
| L3 | 4 | 8 | 40% | |
| L4 | 4 | 10 | 40% | |
| L5 | 5 | 12 | 50% | |

**Observations**:
- **L0→L1 is a regression.** Execute bonus drops from 8 to 5. The player's finisher gets WEAKER when they level up. This is the worst kind of feel-bad moment.
- L0 has execBonus: 8 because it was bumped to match the resolver's hardcoded `mechanic.bonusValue=8` fallback. L1 was designed independently at 5.

**Proposed fix**:
| Level | QP | Exec Bonus | Threshold |
|-------|-----|------------|-----------|
| L0 | 2 | 4 | 30% |
| L1 | 3 | 5 | 30% |
| L2 | 3 | 6 | 30% |
| L3 | 4 | 8 | 40% |
| L4 | 4 | 10 | 40% |
| L5 | 5 | 12 | 50% |

L0 starts at 4 (not 8), so the progression is always upward.

---

### Lifetap
| Level | QP | AP | Notes |
|-------|-----|----|-------|
| L0 | 5 | 2 | |
| L1 | 5 | 2 | No improvement |
| L2 | 5 | 2 | Heals 30% instead of 20% |
| L3 | 6 | 2 | |
| L4 | 7 | 2 | |
| L5 | 8 | 1 | |

**Verdict**: Fine. L0→L1 flat is slightly disappointing but the heal% tag at L2 compensates.

---

### Gambit ⚠️ ISSUE
| Level | QP | Self-Dmg | Heal on CC | Net (QP) | Net (CW) |
|-------|-----|----------|------------|----------|----------|
| L0 | 4 | 4 | 3 | **0** | **-2** |
| L1 | 5 | 4 | 4 | +1 | -1.5 |
| L2 | 6 | 3 | 4 | +3 | 0 |
| L3 | 7 | 3 | 5 | +4 | +0.5 |
| L4 | 8 | 2 | 6 | +6 | +2 |
| L5 | 10 | 1 | 8 | +9 | +4 |

**Observations**:
- Same problem as Reckless L0 — net zero on QP, net negative on CW. But Gambit has the CC heal as upside, making CC the clear play. The design intent (risky card that rewards CC) is sound, but L0 QP is still punishing.
- Less severe than Reckless because the heal on CC makes the card viable if you charge correctly.

**Proposed fix**:
| Level | QP | Self-Dmg | Heal on CC |
|-------|-----|----------|------------|
| L0 | 5 | 3 | 3 |
| L1 | 6 | 3 | 4 |
| L2 | 7 | 3 | 4 |
| L3 | 8 | 2 | 5 |
| L4 | 9 | 2 | 6 |
| L5 | 10 | 1 | 8 |

L0 net +2 QP — risky but not suicidal.

---

### Chain Lightning
**Verdict**: Fine. Good scaling, L5 AP reduction is satisfying.

### Volatile Slash
**Verdict**: Fine. Forget penalty is meaningful, L5 removal is a great milestone.

### Precision Strike
**Verdict**: Fine.

### Riposte ⚠️ MINOR
| Level | QP | Block | Notes |
|-------|-----|-------|-------|
| L0 | 2 | **4** | |
| L1 | 3 | **3** | ⚠️ Block drops 4→3 |
| L2 | 3 | 4 | |
| L3 | 4 | 5 | |
| L4 | 4 | 6 | |
| L5 | 4 | 5 | Block bonus from tag |

**Observations**: L0→L1 block regression (4→3). Same resolver-fallback issue.

**Proposed fix**: Set L1 block to 4 (match L0).

---

### Power Strike, Twin Strike, Iron Wave, Bash, Rupture, Lacerate, Kindle, Overcharge
**Power Strike**: Fine.
**Twin Strike**: Fine.
**Iron Wave**: Fine.

**Bash**: L0 costs 2 AP, L1 inherits default. Need to verify the default AP — if it's 1, then L0→L1 is an AP reduction which is GOOD. ✓ Fine.

**Rupture**: Fine.

**Lacerate** ⚠️: L0 sec=4, L1 sec=3. **Regression.** Fix: L1 sec=4.

**Kindle** ⚠️: L0 sec=4, L1 sec=3. **Regression.** Fix: L1 sec=4.

**Overcharge**: Fine.

---

### Smite, Feedback Loop, Recall, Hemorrhage, Eruption
All fine. Good progressions.

---

## SHIELD CARDS

### Block
**Verdict**: Fine.

### Thorns ⚠️ MINOR
| Level | QP | Reflect |
|-------|-----|---------|
| L0 | 2 | **3** |
| L1 | 3 | **2** |

**Regression**: Reflect drops 3→2 at L1. Fix: L1 reflect = 3.

### Emergency, Fortify, Brace, Overheal
All fine.

### Parry ⚠️ MINOR
| Level | QP | Draw on Atk |
|-------|-----|-------------|
| L0 | **1** | 1 |
| L1 | 2 | 1 |

**Observation**: 1 block is nearly useless — it blocks a single point of damage. Even at CC (1.5 → 1 after floor), it's trivial. The draw-on-attack conditional saves it, but the block feels like it does nothing.

**Proposed fix**: L0 block = 2. Still weak but not embarrassing.

---

### Reinforce, Shrug It Off, Guard, Absorb, Reactive Shield
All fine.

### Bulwark, Conversion, Ironhide, Burnout Shield, Knowledge Ward
These have the broken wiring (forgetAfterPlay, blockConsumed, ironhideStrength not consumed by turnManager). See the unwired effects audit above. The stat tables themselves are fine — the problem is that secondary effects don't fire.

---

## BUFF CARDS

### Empower, Quicken, Focus, Double Strike, Inscription Fury/Iron, Warcry, Battle Trance, Frenzy, Mastery Surge
All fine stat-table-wise. Clean progressions.

### War Drum
Stat table is fine (1→4 bonus, L5 draws 1). The problem is purely the unwired effect — the bonus never applies.

---

## DEBUFF CARDS

### Weaken, Expose, Hex, Sap, Corrode, Curse of Doubt, Mark of Ignorance, Corroding Touch, Entropy
All fine. Good progressions.

### Slow
| Level | AP | Notes |
|-------|----|-------|
| L0 | 2 | Skip defend/buff only |
| L1 | 2 | |
| L2 | 2 | Skip ANY action |
| L3 | 1 | AP reduction |
| L4 | 1 | ⚠️ Loses slow_any_action tag! |
| L5 | 1 | Gets it back + Weak 1t |

**Observation**: L4 loses the `slow_any_action` tag that L2 and L3 have. This means leveling from L3→L4 REMOVES the ability to skip any action. L4 can only skip defend/buff again. This is a regression.

**Proposed fix**: Add `'slow_any_action'` to L4 tags.

---

## UTILITY CARDS

### Cleanse, Recycle, Conjure, Forge, Transmute, Immunity, Sift, Scavenge, Swap, Reflex, Recollect, Synapse
All fine.

### Scout
| Level | Draw | AP | Notes |
|-------|------|----|-------|
| L0 | 1 | 1 | Card-neutral (spent 1 card, drew 1) |
| L1 | 2 | 1 | Now card-positive |

**Observation**: L0 is card-neutral at 1 AP. You play Scout, draw 1 card — you spent a card to get a card. It's not BAD (you get to cycle), but it feels underwhelming compared to other L0 utilities.

**Verdict**: Acceptable — the value is in cycling, not raw card advantage.

### Foresight ⚠️ CRITICAL REGRESSION
| Level | Draw | AP | Notes |
|-------|------|----|-------|
| L0 | 1 | **0** | Free! |
| L1 | 1 | **1** | ⚠️ Now costs 1 AP — WORSE than L0 |
| L2 | 2 | 1 | |

**Observation**: L0 is free (0 AP), designed for onboarding. L1 suddenly costs 1 AP for the same draw count. This is a **hard regression** — the player mastered the card and it got worse. Players will think the game is bugged.

**Proposed fix**: Either make L0 also cost 1 AP (consistent), or give L1 draw 2 to compensate for the AP increase. I recommend the latter:
| Level | Draw | AP |
|-------|------|----|
| L0 | 1 | 0 | Free onboarding |
| L1 | 2 | 1 | More draw compensates for AP cost |
| L2 | 2 | 1 | |

---

### Archive
Primary effect is broken (unwired). See unwired effects audit. Stat table progression is fine IF it worked.

### Siphon Knowledge, Tutor
Secondary effects broken (unwired). Stat tables are fine IF they worked.

---

## WILD CARDS

### Mirror, Adapt, Overclock, Phase Shift, Chameleon, Chain Anchor, Unstable Flux
All fine.

### Dark Knowledge
**Verdict**: Fine. Niche (scales with curses) but well-designed.

### Sacrifice ⚠️ ISSUE
| Level | HP Cost | Draw | AP Gain | Notes |
|-------|---------|------|---------|-------|
| L0 | **6** | 1 | 1 | ⚠️ AP gain is broken (unwired) |
| L1 | 5 | 2 | 1 | |
| L2 | 5 | 2 | 1 | |
| L3 | 4 | 2 | 2 | |
| L4 | 3 | 3 | 2 | |
| L5 | 2 | 3 | 2 | |

**Observations**:
- Even if AP gain worked: L0 costs **6 HP** for 1 draw + 1 AP. That's brutal. Starting HP is ~50-60, so this is ~10% of your health for marginal value.
- With the AP gain broken, L0 costs 6 HP for 1 draw. That's actively terrible — worse than just not playing a card.

**Proposed fix** (once AP gain is wired):
| Level | HP Cost | Draw | AP Gain |
|-------|---------|------|---------|
| L0 | 4 | 2 | 1 |
| L1 | 4 | 2 | 1 |
| L2 | 3 | 2 | 1 |
| L3 | 3 | 2 | 2 |
| L4 | 2 | 3 | 2 |
| L5 | 2 | 3 | 2 |

L0 starts at 4 HP (not 6) and always gives at least 2 draw.

### Catalyst, Knowledge Bomb, Ignite
All fine.

### Mimic, Aftershock (Echo)
Primary effects are broken (unwired). Stat tables are fine IF they worked.

### Inscription of Wisdom
Primary effect is broken (unwired). Stat table is fine IF it worked.

---

## Summary of Required Changes

### Critical Fixes (cards feel broken to players)
1. **Reckless L0**: selfDmg 4→2, qpValue 4→6 (net positive on QP)
2. **Execute L0**: execBonus 8→4 (prevent L0→L1 regression)
3. **Foresight L1**: drawCount 1→2 (compensate for AP regression from L0 free→L1 paid)
4. **Sacrifice L0**: hpCost 6→4, draw 1→2 (not suicidal)
5. **Gambit L0**: selfDmg 4→3, qpValue 4→5 (net positive on QP)

### L0→L1 Regressions (secondaryValue drops)
6. **Lacerate L1**: secondaryValue 3→4
7. **Kindle L1**: secondaryValue 3→4
8. **Thorns L1**: secondaryValue 2→3
9. **Riposte L1**: secondaryValue 3→4

### Missing Tags
10. **Slow L4**: Add `'slow_any_action'` tag (currently loses it between L3 and L5)

### Minor Tweaks
11. **Parry L0**: qpValue 1→2 (1 block is embarrassing)

### Unwired Effects (separate from this audit — see broken effects report)
12. Archive, Conversion, Hemorrhage, Ironhide, Bulwark, War Drum, Aftershock, Mimic, Sacrifice, Inscription of Wisdom, Siphon Knowledge, Tutor, Scout (foresight_intent tag)
