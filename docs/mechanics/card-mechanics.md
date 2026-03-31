# Card Mechanics Reference

> **Purpose:** Complete table of all card mechanics — attack, shield, buff, debuff, utility, and wild
> **Last verified:** 2026-03-31
> **Source files:** `src/data/mechanics.ts`, `src/services/cardEffectResolver.ts`

> **See also:** [`cards.md`](cards.md) — Card entity, types, tiers, damage formula, mastery system, and card creation pipeline.

---

## Mechanic Pool — Complete List

Mechanics are assigned by the run pool builder and stored on the `Card` as `mechanicId`. All defined in `MECHANIC_DEFINITIONS` in `mechanics.ts`. Phase 1 = available at launch; Phase 2 = post-launch expansion.

### Attack Mechanics

| ID | Name | Ph | QP | AP | Key Behavior |
|----|------|----|----|----|-------------|
| `strike` | Strike | 1 | 4 | 1 | Basic damage |
| `multi_hit` | Multi-Hit | 1 | 2 | 2 | Hits 3× (`secondaryValue: 3`) |
| `heavy_strike` | Heavy Strike | 1 | 10 | 2 | High damage |
| `piercing` | Piercing | 1 | 3 | 1 | Ignores enemy block |
| `reckless` | Reckless | 1 | 6 | 1 | +self-damage `secondaryValue: 3` |
| `execute` | Execute | 1 | 3 | 1 | +`secondaryValue: 8` bonus below 30% HP |
| `lifetap` | Lifetap | 1 | 4 | 2 | Heal 20% of damage dealt |
| `power_strike` | Power Strike | 1 | 5 | 1 | Heavier basic strike |
| `twin_strike` | Twin Strike | 1 | 3 | 1 | Hits 2×, triggers Burn/Bleed per hit |
| `iron_wave` | Iron Wave | 1 | 3 | 1 | Damage + block (`secondaryValue: 5`) |
| `bash` | Bash | 1 | 5 | 2 | Damage + Vulnerable |
| `rupture` | Rupture | 1 | 3 | 1 | Damage + Bleed |
| `kindle` | Kindle | 1 | 2 | 1 | Damage + Burn + trigger immediately |
| `overcharge` | Overcharge | 1 | 3 | 1 | CC scales with Charges this encounter |
| `riposte` | Riposte | 1 | 3 | 1 | Damage + block |
| `precision_strike` | Precision Strike | 1 | 8 | 1 | CC scales with question difficulty |
| `siphon_strike` | Siphon Strike | 1 | 3 | 1 | Overkill heals (min 2, max 10) |
| `gambit` | Gambit | 2 | 5 | 1 | QP: dmg + self-HP loss; CC: dmg + heal |
| `chain_lightning` | Chain Lightning | 2 | 4 | 2 | CC: 8 × chain length |
| `volatile_slash` | Volatile Slash | 2 | 5 | 1 | CC: 30 dmg then EXHAUST |

### Shield Mechanics

| ID | Name | Ph | QP | AP | Key Behavior |
|----|------|----|----|----|-------------|
| `block` | Block | 1 | 3 | 1 | Basic block |
| `thorns` | Thorns | 1 | 3 | 1 | Block + reflect `secondaryValue: 3` on hit |
| `emergency` | Emergency | 1 | 2 | 1 | Block; doubled if HP < 30% |
| `fortify` | Fortify | 1 | 4 | 2 | Persistent block carries to next turn |
| `brace` | Brace | 1 | 0 | 1 | Block = enemy telegraph value |
| `overheal` | Overheal | 1 | 5 | 2 | 10 block; doubled if HP < 50% |
| `reinforce` | Reinforce | 1 | 4 | 1 | More block than basic shield |
| `shrug_it_off` | Shrug It Off | 1 | 3 | 1 | Block + draw on any play mode |
| `guard` | Guard | 1 | 7 | 2 | Large block |
| `absorb` | Absorb | 1 | 3 | 1 | Block; CC also draws a card |
| `reactive_shield` | Reactive Shield | 1 | 2 | 1 | Block + Thorns for 1 turn |
| `aegis_pulse` | Aegis Pulse | 1 | 3 | 1 | Block; CC: same-chain cards in hand +2 block |
| `parry` | Parry | 2 | 2 | 1 | Block + draw if enemy attacks |
| `burnout_shield` | Burnout Shield | 2 | 4 | 1 | CC: 24 block then EXHAUST |
| `knowledge_ward` | Knowledge Ward | 2 | 6 | 1 | Block scales with correct Charges |

### Buff Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `empower` | Empower | 1 | Next card deals +50% damage |
| `quicken` | Quicken | 1 | +1 AP this turn; `chargeBonusEffect: 'quicken_draw'` |
| `focus` | Focus | 1 | Next card -1 AP; `chargeBonusEffect: 'focus_double'` |
| `double_strike` | Double Strike | 1 | Next attack hits twice; CC: also pierces |
| `ignite` | Ignite | 1 | Next attack applies Burn |
| `warcry` | Warcry | 2 | QP: +2 Str (turn); CC: +2 Str (perm) + next Charge free |
| `battle_trance` | Battle Trance | 2 | Draw 3; QP/CW: no more cards this turn |
| `inscription_fury` | Inscription of Fury | 1 | All attacks deal bonus dmg rest of combat |
| `inscription_iron` | Inscription of Iron | 1 | Gain block at start of each turn rest of combat |

### Debuff Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `weaken` | Weaken | 1 | Apply Weakness stacks |
| `expose` | Expose | 1 | Apply Vulnerable stacks |
| `hex` | Hex | 1 | Apply Poison 3 for 3 turns |
| `slow` | Slow | 1 | Skip enemy's next defend/buff; `chargeBonusEffect: 'slow_weaken'` |
| `sap` | Sap | 1 | Damage + Weakness |
| `lacerate` | Lacerate | 1 | Damage + Bleed |
| `stagger` | Stagger | 1 | Skip enemy's next action entirely |
| `corrode` | Corrode | 1 | Remove enemy block + Weakness |
| `curse_of_doubt` | Curse of Doubt | 2 | Enemy takes +30% damage from Charged attacks |
| `mark_of_ignorance` | Mark of Ignorance | 2 | Enemy takes +3 flat damage from Charged attacks |

### Utility Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `cleanse` | Cleanse | 1 | Remove all debuffs + draw 1 |
| `scout` | Scout | 1 | Draw 2 |
| `recycle` | Recycle | 1 | Draw 3; CC: also draw from discard |
| `foresight` | Foresight | 1 | Draw 2, 0 AP; CC: reveal enemy intent |
| `sift` | Sift | 1 | Look at top cards of draw pile, discard some |
| `scavenge` | Scavenge | 1 | Return card from discard to top of draw |
| `swap` | Swap | 1 | Discard a card, draw a replacement, 0 AP |
| `conjure` | Conjure | 2 | Summon 1 of 3 cards to hand this encounter |
| `transmute` | Transmute | 2 | Transform weakest hand card to different type |
| `immunity` | Immunity | 2 | Absorb next damage instance up to 8 |

### Wild Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `mirror` | Mirror | 1 | Copy previous card's full effect |
| `adapt` | Adapt | 1 | Smart: block vs ATK, cleanse vs debuff, else attack |
| `overclock` | Overclock | 2 | Next card 2× effect, costs 2 AP |
