# Card Mechanics Reference

> **Purpose:** Complete table of all card mechanics — attack, shield, buff, debuff, utility, and wild
> **Last verified:** 2026-04-04 (bulwark/overheal/ironhide buffs)
> **Source files:** `src/data/mechanics.ts`, `src/services/cardEffectResolver.ts`, `src/services/cardUpgradeService.ts`

> **See also:** [`cards.md`](cards.md) — Card entity, types, tiers, damage formula, mastery system, and card creation pipeline.

---

## Mechanic Pool — Complete List

Mechanics are assigned by the run pool builder and stored on the `Card` as `mechanicId`. All defined in `MECHANIC_DEFINITIONS` in `mechanics.ts`. Phase 1 = available at launch; Phase 2 = post-launch expansion.

### Attack Mechanics

| ID | Name | Ph | QP | AP | Key Behavior |
|----|------|----|----|----|-------------|
| `strike` | Strike | 1 | 4 | 1 | Basic damage; L5 (`strike_tempo3`): +4 damage if 3+ cards played this turn |
| `multi_hit` | Multi-Hit | 1 | 2 | 2 | Hits 3× (`secondaryValue: 3`) |
| `heavy_strike` | Heavy Strike | 1 | 10 | 2 | High damage |
| `piercing` | Piercing | 1 | 3 | 1 | Ignores enemy block |
| `reckless` | Reckless | 1 | 6 | 1 | +self-damage `secondaryValue: 3`; L5 (`reckless_selfdmg_scale3`): add `selfDamageTakenThisEncounter × 3` bonus damage |
| `execute` | Execute | 1 | 3 | 1 | +`secondaryValue: 8` bonus below 30% HP |
| `lifetap` | Lifetap | 1 | 4 | 2 | Heal 20% of damage dealt |
| `power_strike` | Power Strike | 1 | 5 | 1 | Heavier basic strike; L5 (`power_vuln2t`, `power_vuln75`): Vulnerable lasts 2 turns + passive 1.75× Vuln multiplier |
| `twin_strike` | Twin Strike | 1 | 3 | 1 | Hits 2×, triggers Burn/Bleed per hit; L5 (`twin_burn2`, `twin_burn_chain`): 2 Burn/hit, Burn stacks don't halve on each hit |
| `iron_wave` | Iron Wave | 1 | 3 | 1 | Damage + block (`secondaryValue: 5`); L5 (`iron_wave_block_double`): double damage component if player has 10+ block |
| `bash` | Bash | 1 | 5 | 2 | Damage + Vulnerable; L3+ (`bash_vuln2t`): Vuln lasts 2t even on QP |
| `rupture` | Rupture | 1 | 3 | 1 | Damage + Bleed |
| `kindle` | Kindle | 1 | 2 | 1 | Damage + Burn + trigger immediately |
| `overcharge` | Overcharge | 1 | 3 | 1 | CC scales with Charges this encounter |
| `riposte` | Riposte | 1 | 3 | 1 | Damage + block; L5 (`riposte_block_dmg40`): +40% of current block as bonus damage |
| `precision_strike` | Precision Strike | 1 | 8 | 1 | CC scales with question difficulty |
| `siphon_strike` | Siphon Strike | 1 | 3 | 1 | Overkill heals (min 2, max 10) |
| `gambit` | Gambit | 2 | 5 | 1 | QP: dmg + self-HP loss; CC: dmg + heal |
| `chain_lightning` | Chain Lightning | 2 | 4 | 2 | CC: 8 × chain length |
| `volatile_slash` | Volatile Slash | 2 | 5 | 1 | CC: 30 dmg then EXHAUST |

### Shield Mechanics

| ID | Name | Ph | QP | AP | Key Behavior |
|----|------|----|----|----|-------------|
| `block` | Block | 1 | 3 | 1 | Basic block; L5 (`block_consecutive3`): +3 block if player played a shield card last turn |
| `thorns` | Thorns | 1 | 3 | 1 | Block + reflect `secondaryValue: 3` on hit; L5 (`thorns_persist`): thorns don't reset at encounter end |
| `emergency` | Emergency | 1 | 2 | 1 | Block; doubled if HP < 30% |
| `fortify` | Entrench | 1 | 4 | 2 | QP: 50% of current block. CC: 75% block + card value. CW: 25%; L5 (`fortify_carry`): block persists next turn, AP cost reduced to 1 |
| `brace` | Brace | 1 | 0 | 1 | Block = enemy telegraph value; L3+ (`brace_exceed2`): +2 block bonus; L5 (`brace_draw1`): also draws 1 |
| `overheal` | Overheal | 1 | 5 | 2 | L0: 5 block (was 3); doubled if HP < 60% (was 50%); L3+ (`overheal_heal2`): also heals 2 HP, AP cost reduced to 1; L5 (`overheal_heal_pct5`): also heals 5% max HP (AP=1) |
| `reinforce` | Reinforce | 1 | 4 | 1 | More block than basic shield; L5 (`reinforce_draw1`, `reinforce_perm1`): draws 1 + gains stacking +1 permanent block each play |
| `shrug_it_off` | Shrug It Off | 1 | 3 | 1 | Block + draw (1 or 2 from stat table); L5 (`shrug_cleanse1`): also removes 1 debuff |
| `guard` | Guard | 1 | 7 | 2 | Large block; L5 (`guard_taunt1t`): enemy must attack player next turn, AP cost reduced to 1 |
| `absorb` | Absorb | 1 | 3 | 1 | Block; CC draws 1 (or 2 at L3+ via `absorb_draw2cc`); L5 (`absorb_draw2cc`, `absorb_ap_on_block`): CC draws 2 + grants +1 AP |
| `reactive_shield` | Reactive Shield | 1 | 2 | 1 | Block + Thorns (value from stat secondaryValue); L5 (`reactive_thorns_persist`): thorns persist encounter |
| `aegis_pulse` | Aegis Pulse | 1 | 3 | 1 | Block; CC: same-chain cards in hand +2 block |
| `parry` | Parry | 2 | 2 | 1 | Block + draw if enemy attacks; L5 (`parry_counter3`): deals 3 damage back to attacker |
| `burnout_shield` | Burnout Shield | 2 | 4 | 1 | CC: 24 block then EXHAUST |
| `knowledge_ward` | Knowledge Ward | 2 | 6 | 1 | Block scales with correct Charges |
| `bulwark` | Bulwark | 3 | 9 | 2 | Massive block; CC exhausts card; L0: 2 AP (was 3); L3+ (`bulwark_no_exhaust`): no exhaust on CC (was L5 only); L5: 1 AP |
| `conversion` | Shield Bash | 3 | 3 | 1 | Deals damage = current block; L3+ (`conversion_bonus_50pct`): 1.5× block multiplier; L5 (`conversion_keep_block`): block not consumed |
| `ironhide` | Ironhide | 3 | 5 | 2 | L0: 5 block + 1 permanent Str on CC (was 3 block + temp Str); L1-L2: 6 block; permanence driven by `extras.strPerm` in stat table (all levels from L0); L4+: +2 Str; L5: 1 AP |

### Buff Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `empower` | Empower | 1 | Next card deals +X% damage; L3+ (`empower_2cards`): next 2 cards get the buff; L5 (`empower_2cards`, `empower_weak2`): also applies 2 Weakness to enemy when buffed attack fires |
| `quicken` | Quicken | 1 | +1 AP this turn (or +2 at L5 via `quicken_ap2`); L1+ (`quicken_draw1`): also draws 1; L3+ (`quicken_draw2`): draws 2 |
| `focus` | Focus | 1 | Next card -1 AP; CC: 2 cards get AP reduction; L2+ (`focus_draw1`): also draws 1; L5 (`focus_next2free`): next 2 cards cost 0 AP |
| `double_strike` | Double Strike | 1 | Next attack hits twice; L3+: AP cost reduced to 1; CC (`double_strike_pierce`): next attack also pierces |
| `ignite` | Ignite | 1 | Next attack applies Burn; L3+ (`ignite_2attacks`): applies to next 2 attacks |
| `warcry` | Warcry | 2 | QP: +2 Str (turn); CC: +2 Str (perm) + next Charge free |
| `battle_trance` | Battle Trance | 2 | Draw cards (count from stat table); QP/CW: no more cards this turn unless `trance_no_lockout_qp`; L5 (`trance_cc_ap1`): CC also grants +1 AP |
| `inscription_fury` | Inscription of Fury | 1 | All attacks deal bonus dmg rest of combat; L3+: AP cost reduced to 1; L5 (`insc_fury_cc_bonus2`): CC attacks deal +2 extra flat damage |
| `inscription_iron` | Inscription of Iron | 1 | Gain block at start of each turn rest of combat; L3+: AP cost reduced to 1; L5 (`insc_iron_thorns1`): also +1 thorns per turn |
| `inscription_wisdom` | Inscription of Wisdom | 1 | Each future CC draws 1 extra card (and heals at higher levels) rest of combat; L3+: AP cost reduced to 1; L5: draws 2 + heals 2 per CC |

### Debuff Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `weaken` | Weaken | 1 | Apply Weakness stacks (no damage). QP: 1 stack, 1t. CC: 1+ stacks, 2t. L5 (`weaken_shield30`): passive — player gains +30% block bonus when enemy is Weakened. |
| `expose` | Expose | 1 | Apply Vulnerable stacks (no damage). QP: 1 stack, 1t. CC: 1+ stacks, 2t. L5 (`expose_dmg3`, `expose_vuln75`): also deals 3 damage; passive — Vulnerable multiplier becomes 1.75× for entire encounter. |
| `hex` | Hex | 1 | Apply Poison 3 for 3 turns; L3+ (`hex_vuln1t`): also applies Vulnerable 1t |
| `slow` | Slow | 1 | Skip enemy's next defend/buff; CC: also applies Weakness 1t; L2+ (`slow_any_action`): can skip ANY action; L5 (`slow_weak1t`): QP/CW also apply Weakness 1t |
| `sap` | Sap | 1 | Damage + Weakness; L2+ (`sap_weak2t`): Weakness lasts 2t; L5 (`sap_strip3block`): also strips 3 enemy block |
| `lacerate` | Lacerate | 1 | Damage + Bleed |
| `stagger` | Stagger | 1 | Skip enemy's next action entirely; CC: applies Vulnerable; L2+ (`stagger_weak1t`): QP/CW also apply Weakness 1t |
| `corrode` | Corrode | 1 | Remove enemy block + Weakness; L3+ (`corrode_vuln1t`): also Vulnerable 1t; L5 (`corrode_strip_all`): removes ALL block on QP/CW too |
| `corroding_touch` | Corroding Touch | 2 | 0 AP Weakness debuff; CC: +Vulnerable; L3+ (`corrtouch_vuln1t`): QP/CW also apply Vulnerable 1t |
| `curse_of_doubt` | Curse of Doubt | 2 | Enemy takes +30% damage from Charged attacks |
| `mark_of_ignorance` | Mark of Ignorance | 2 | Enemy takes +3 flat damage from Charged attacks |

### Utility Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `cleanse` | Cleanse | 1 | Remove all debuffs + draw 1; L3+ (`cleanse_heal3`): also heal 3 HP; L5 (`cleanse_block3`): also gain 3 block |
| `scout` | Scout | 1 | Draw 2; L3+ (`scout_scry2`): also scry 2 (look at top 2, discard some) |
| `recycle` | Recycle | 1 | Draw 3; CC: also draw from discard; CC + `recycle_discard_pick`: player chooses which discard card |
| `foresight` | Foresight | 1 | Draw 2, 0 AP; CC: reveal enemy intent; L3+ (`foresight_intent`): also show enemy's NEXT intent |
| `sift` | Sift | 1 | Look at top cards, discard some; L3+ (`sift_draw1`): also draw 1; L5 (`sift_discard_dmg2`): discarded cards deal 2 dmg each |
| `scavenge` | Scavenge | 1 | Retrieve card from discard (player picks); L3+ (`scavenge_draw1`): also draw 1 |
| `swap` | Swap | 1 | Discard 1, draw 1 (QP) or 2 (CC); CC + `swap_cc_draw3`: CC draws 3 instead |
| `conjure` | Conjure | 2 | Summon 1 of 3 cards to hand this encounter |
| `transmute` | Transmute | 2 | Transform weakest hand card to different type |
| `immunity` | Immunity | 2 | Absorb next damage instance up to 8 |

### Wild Mechanics

| ID | Name | Ph | Notes |
|----|------|----|-------|
| `mirror` | Mirror | 1 | Copy previous card's full effect; L5 (`mirror_chain_inherit`): copy also inherits chain type |
| `adapt` | Adapt | 1 | Choose attack/block/cleanse; L3+ (`adapt_draw1`): also draw 1; L5 (`adapt_dual`): does BOTH attack AND block (no choice) |
| `overclock` | Overclock | 2 | Next card 2× effect, costs 2 AP |

---

## Tag-Based Mastery Feature Flags

All mastery tags are checked in `resolveCardEffect()` via `hasTag('tag_name')`. Tags are cumulative — a card at L5 has all lower-level tags active. Tags are defined in `MASTERY_STAT_TABLES` in `cardUpgradeService.ts` and read via `getMasteryStats().tags`.

The `hasTag` helper and `activeTags` array are defined once near the top of `resolveCardEffect()`, after `_masteryStats` is computed:

```typescript
const stats = _masteryStats;
const activeTags = _masteryStats?.tags ?? [];
const hasTag = (tag: string) => activeTags.includes(tag);
```

### `CardEffectResult` fields for tag effects

| Field | Type | Tag that sets it | Description |
|-------|------|-----------------|-------------|
| `thornsPersist` | `boolean` | `thorns_persist`, `reactive_thorns_persist` | Thorns don't reset at encounter end |
| `blockCarries` | `boolean` | `fortify_carry` | Block persists to next turn |
| `counterDamage` | `number` | `parry_counter3` | Deals N damage back to attacker when hit |
| `healPctApplied` | `number` | `overheal_heal_pct5` | Heals N% of max HP |
| `tauntDuration` | `number` | `guard_taunt1t` | Enemy must attack player next N turns |
| `removeDebuffCount` | `number` | `shrug_cleanse1` | Remove N debuffs from player |
| `empowerTargetCount` | `number` | `empower_2cards` | How many cards receive the empower buff (default 1) |
| `freePlayCount` | `number` | `focus_next2free` | N future cards cost 0 AP |
| `slowAnyAction` | `boolean` | `slow_any_action` | Slow can skip ANY enemy action type |
| `inscriptionFuryCcBonus` | `number` | `insc_fury_cc_bonus2` | Extra flat damage on CC attacks via Inscription of Fury |
| `inscriptionIronThorns` | `number` | `insc_iron_thorns1` | Thorns per turn from Inscription of Iron |
| `archiveBlockBonus` | `number` | `archive_block2_per` | Block bonus applied to each retained card |
| `scryCount` | `number` | `scout_scry2` | After drawing, also scry N top cards |
| `recycleChoose` | `boolean` | `recycle_discard_pick` | Player picks which discard card to draw |
| `showNextIntent` | `boolean` | `foresight_intent` | Show enemy's NEXT intent (after current) |
| `discardDamage` | `number` | `sift_discard_dmg2` | Each sift-discarded card deals N damage to enemy |
| `eliminateDistractor` | `number` | `siphon_eliminate1` | Eliminate N wrong answers from quiz |
| `recollectUpgrade` | `number` | `recollect_upgrade1` | Returned exhausted cards get +N mastery |
| `recollectPlayFree` | `boolean` | `recollect_play_free` | Play 1 returned card free this turn |
| `synapseChainBonus` | `number` | `synapse_chain_plus1` | Wildcard chain link grants +N chain bonus |
| `fluxDouble` | `boolean` | `flux_double` | Unstable Flux effect fires twice |
| `catalystTriple` | `boolean` | `catalyst_triple` | Catalyst triples stacks instead of doubling |
| `mimicChoose` | `boolean` | `mimic_choose` | Player chooses from discard (not random) |
| `aftershockNoQuiz` | `boolean` | `aftershock_no_quiz` | CC Aftershock repeat doesn't require a quiz |
| `kbombCountPast` | `boolean` | `kbomb_count_past` | Knowledge Bomb CC counts charges for entire RUN |
| `darkHealPerCurse` | `number` | `dark_heal1_per_curse` | Dark Knowledge heals N HP per cursed fact |
| `igniteDuration` | `number` | `ignite_2attacks` | Ignite buff applies to next N attacks (default 1) |
| `apGain` | `number` | `trance_cc_ap1` | AP granted this turn (battle_trance CC) |
| `masteryBumpAmount` | `number` | `msurge_plus2` | Mastery Surge: +N mastery per bumped card (default 1) |
| `reinforcePermanentBonusIncrement` | `boolean` | `reinforce_perm1` | Signal to increment `reinforcePermanentBonus` in TurnState after block applied |
| `masteryReachedL5Count` | `number` | `msurge_ap_on_l5` | Signal that mastery_surge should grant +1 AP if any bumped card reached L5 |
| `apOnBlockGain` | `number` | `absorb_ap_on_block` | AP to grant on absorb Charge Correct |
| `twinBurnChainActive` | `boolean` | `twin_burn_chain` | Burn ticks don't halve during multi-hit loop |
| `empowerWeakStacks` | `number` | `empower_weak2` | Weakness stacks to apply to enemy when buffed attack fires |

### Tags that affect turnManager behavior (not CardEffectResult fields)

Some tags are read directly by `turnManager` without a dedicated result field:

| Tag | Mechanic | Effect |
|-----|---------|--------|
| `synapse_chain_link` | synapse | CC counts as wildcard chain link (sets `applyWildcardChainLink`) |
| `swap_cc_draw3` | swap | CC draws 3 instead of 2 |
| `archive_retain2_qp` | archive | QP retains 2 cards instead of 1 |
| `reflex_enhanced` | reflex | QP draws 3 instead of 2 |
| `reflex_draw3cc` | reflex | CC draws 3 instead of 2 |
| `recollect_qp2` | recollect | QP returns 2 exhausted cards |
| `synapse_draw3_qp` | synapse | QP draws 3 instead of 2 |
| `siphon_qp3_time4s` | siphon_knowledge | QP draws 3 with 4s preview |
| `tutor_free_play` | tutor | Tutored card costs 0 AP this turn |
| `mirror_chain_inherit` | mirror | Copy inherits chain type (reuses `chameleonInheritChain` field) |
| `adapt_dual` | adapt | Does BOTH attack and block (no choice; exits picker path) |
| `flux_choose_qp` | unstable_flux | QP lets player choose from options instead of random |
| `chain_anchor_set3` | chain_anchor | CC sets chain to 3 instead of 2 |
| `chain_anchor_ap0` | chain_anchor | Card costs 0 AP |
| `catalyst_burn` | catalyst | Also doubles/triples enemy Burn stacks |
| `catalyst_bleed` | catalyst | Also doubles/triples enemy Bleed stacks |
| `trance_no_lockout_qp` | battle_trance | QP no longer restricts further card plays |

### Conversion behavioral change (2026-04-03)

`conversion` (Shield Bash) previously NEVER consumed block (`blockConsumed` stayed 0). With tag support:
- Without `conversion_keep_block`: `blockConsumed = playerBlock` — block IS consumed after dealing damage.
- With `conversion_keep_block` (L5): block not consumed, `blockConsumed` stays undefined.

Turnmanager must be updated to apply `blockConsumed` by reducing `playerState.shield` by that amount.

### MASTERY_UPGRADE_DEFS vs MASTERY_STAT_TABLES

`getMasteryStats()` checks `MASTERY_STAT_TABLES` first. If an entry exists there, `MASTERY_UPGRADE_DEFS` is bypassed entirely for that mechanic. The stat tables are authoritative for all mechanics listed there. `MASTERY_UPGRADE_DEFS` entries with `addTagsAtLevel` (multi-tag support added 2026-04-03) serve as fallback for mechanics not yet in the stat tables.
