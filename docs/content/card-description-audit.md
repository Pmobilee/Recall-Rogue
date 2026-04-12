# Card Description Audit — 2026-04-11

> **Purpose:** Four-source drift audit for all 98 card mechanics. Identifies gaps between the seed definition, mastery stat table, resolver behavior, and rendered description.
> **Source files audited:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts` (`MASTERY_STAT_TABLES`), `src/services/cardEffectResolver.ts`, `src/services/cardDescriptionService.ts`

---

## Summary

- **Mechanics audited:** 98
- **Severity A (resolver hardcodes QP/CC instead of using stat table):** 14
- **Severity B (rendered L0 number disagrees with resolver L0 behavior):** 22
- **Severity C (missing variance — description hides QP/CC/CW branching):** 18
- **Severity D (missing rider — unmentioned side-effect in resolver):** 31
- **Severity E (ambiguity — accurate but misleading to first-time player):** 8
- **Severity F (dead seed — seed fields disagree with stat table in non-runtime ways):** 28
- **Clean (no severities):** 3 (`adapt`, `transmute`, `conjure` — all use stat tables and descriptions match their resolver's delegate-to-picker pattern)

Note: many mechanics carry multiple severities simultaneously. The totals above count mechanics, not occurrences.

---

## Root-Cause Notes

**The four-source problem.** The game has four separate places that each describe or implement card behavior: (1) the `MechanicDefinition` seed in `mechanics.ts`, (2) the `MASTERY_STAT_TABLES` entry in `cardUpgradeService.ts`, (3) the switch case in `cardEffectResolver.ts`, and (4) the switch case in `cardDescriptionService.ts`. These evolved at different times. The seed predates the stat table system. The resolver was largely written to match the stat tables (Phase 2, 2026-04-03) but a cohort of older mechanics still use direct hardcoded literals. The description service was comprehensively updated in Phase 4 (2026-04-09) but used `card.baseEffectValue` (the pre-mastery seed value) as its `power` variable — meaning many descriptions show seed values, not stat-table L0 values.

**Most common drift patterns:**
1. **Seed `quickPlayValue` vs stat table L0 `qpValue`:** Almost every mechanic that was rebalanced (9 cards in Pass 8 alone) has a stale `quickPlayValue` in the seed that doesn't match the current L0 stat table value. This is severity F (informational, no runtime effect because the resolver always calls `getMasteryStats`), but it pollutes codebase search results and confuses agents reading the seed.
2. **Description uses `card.baseEffectValue` as `power`:** `getDetailedCardDescription` sets `const power = powerOverride ?? Math.round(card.baseEffectValue)`. `baseEffectValue` is set by `cardFactory.ts` from `BASE_EFFECT[cardType]` (attack=4, shield=3, others=0) — NOT from the stat table. For attack cards the description will show `Deal 4 damage` at L0 even when the resolver applies 3, 5, 6, or 7 depending on the mechanic. This is the root of most Severity B findings.
3. **Resolver hardcodes QP on flagged mechanics:** A cohort of Phase 2 flagship mechanics (warcry, gambit, recall, hemorrhage, feedback_loop, smite, precision_strike) either partially or fully override `finalValue` with hardcoded literals derived from `mechanic.quickPlayValue` or a literal constant, rather than uniformly delegating to `getMasteryStats().qpValue`. These are Severity A.
4. **Description hides QP/CC/CW variance:** Many mechanic descriptions only show the QP scenario or use the phrasing "CC: higher values" without stating numbers. This is correct prose style for some mechanics but a genuine problem on others where the CC branch does something qualitatively different (forget, lockout, self-damage reversal).

---

## Per-Mechanic Table

| ID | Name | Type | Resolver class | Severities | Rendered @ L0 | Resolver L0 QP behavior | Notes |
|---|---|---|---|---|---|---|---|
| strike | Strike | attack | reads-stat-table | D, F | "Deal 4 damage." (shows BASE_EFFECT) | Applies `stats.qpValue=4` | D: strike_tempo3 rider at L5 not mentioned |
| multi_hit | Multi-Hit | attack | reads-stat-table | B, D, F | "Deal 4 damage 3 times." | Applies `qpValue=2` per hit, `hitCount=2` | B: shows `baseEffectValue=4` not stat-table L0 `qpValue=2` |
| heavy_strike | Heavy Strike | attack | reads-stat-table | B, D, F | "Deal 4 damage." | Applies `qpValue=7` | B: shows BASE_EFFECT=4, resolver uses 7 |
| piercing | Piercing | attack | reads-stat-table | D, F | "Ignores enemy Block." | Applies `qpValue=3` pierce | D: pierce_strip3 (L3) not shown; pierce_vuln1 (L5) not shown |
| reckless | Reckless | attack | reads-stat-table | C, F | "Deal 4 damage. Take 4 self-damage." | Applies `qpValue=4`, selfDmg=4 from extras | **Fixed 2026-04-12:** description and resolver now read extras.selfDmg — selfDmg shows 4 (was 3 via seed secondaryValue). C: CW shows same self-damage as QP |
| execute | Execute | attack | D, F | — | "Deal 2 damage. +8 bonus if enemy below 30% HP (40% at L3, 50% at L5)." | Applies `qpValue=2`; QP execBonus and threshold now from stat-table extras | **Fixed 2026-04-12:** description and resolver QP path now read extras.execBonus and extras.execThreshold. CC remains hardcoded at 24 (intentional — 3:1 CC:QP ratio). D: execBonus progression not shown |
| lifetap | Lifetap | attack | reads-stat-table | B, C, D, F | "Deal 4 damage. Heal 20% of damage dealt." | Applies `qpValue=5` | B: shows 4, resolver uses 5; C: no CC/CW mention; D: lifetap_heal30 (L2) not shown |
| block | Block | shield | reads-stat-table | B, D, F | "Gain 3 Block." | Applies `qpValue=4` | B: shows BASE_EFFECT=3, resolver uses 4; D: block_consecutive3 (L5) not shown |
| thorns | Thorns | shield | A (partial), B, C, F | — | "Gain 3 Block. Reflect 3 damage when hit." | Uses seed secondaryValue=3 for reflect not stat table | A/B: resolver hardcodes `thornsBaseReflect` as 9/2/3 (CC/CW/QP), stat table L0 secondaryValue=1; reflect shows 3 (seed) not 1 (table L0) |
| emergency | Emergency | shield | A (partial), B, F | — | "Gain 2 Block. Double if HP below 30%." | Resolver uses `finalValue` (stat-table qpValue=2) but uses hardcoded 0.3 threshold | A: emergThreshold extras field (L3+) ignored by resolver — resolver always uses hardcoded 0.3 |
| fortify | Entrench | shield | A, B, F | — | "Gain 7 Block. Persists into next turn." | Resolver uses `playerState.shield * 0.5` for QP, ignores finalValue entirely | A: resolver ignores qpValue from stat table for this mechanic; B: description says "Gain 7 Block" but card actually scales with current block amount |
| brace | Brace | shield | A (partial), C, F | — | "Gain Block equal to enemy's telegraphed attack damage." | Resolver uses `enemy.nextIntent.value × braceMultiplier`, card value is floor | A: brace_exceed2 extras (L3) not read consistently; C: CC multiplier (3.0×) vs QP (1.0×) not shown |
| overheal | Overheal | shield | B, C, D, F | — | "Gain 3 Block. Double if HP below 50%." | Applies `qpValue=6`, doubles at 60% HP threshold | B: shows BASE_EFFECT=3, resolver uses 6; C: threshold is actually 60% not 50% (resolver: `healthPercentage < 0.6`); D: overheal_heal2, overheal_heal_pct5 (L3/L5) not shown |
| parry | Parry | shield | reads-stat-table | B, C, D, F | "Gain 2 Block. Draw 1 card if enemy attacks." | Applies `qpValue=1` | B: shows BASE_EFFECT=2, resolver uses 1; D: parry_counter3 (L5) not shown |
| empower | Empower | buff | reads-stat-table | B, C, F | "Next card deals 30% more damage." | Applies `qpValue=30` (stat table) | B: seed quickPlayValue=50 disagrees with stat table L0=30 — description reads stat table correctly; C: CC vs QP% difference hidden |
| quicken | Quicken | buff | reads-stat-table | C, D, F | "Gain +1 AP this turn." | Applies grantsAp=1 (always same on QP/CC/CW) | C: CC draws a card but description omits it; D: quicken_draw1/draw2/ap2 tags not shown |
| focus | Focus | buff | reads-stat-table | C, D, F | "Next card costs 1 less AP to play." | CC: focusCharges=2 (two cards get AP reduction) | C: CC gives 2 focus charges but description implies 1; D: focus_draw1 (L2), focus_next2free (L5) not shown |
| double_strike | Double Strike | buff | reads-stat-table | C, D, F | "Next attack card hits twice at 75% power each (scales to 100% at L5)." | Applies applyDoubleStrikeBuff; CC: doubleStrikeAddsPierce=true | **Fixed 2026-04-12:** description now reads extras.hitMult (75 at L0, 100 at L5). C: CC also pierces — not shown; D: double_strike_pierce (L5) not shown |
| weaken | Weaken | debuff | reads-stat-table | B, C, D, F | "Apply 1 Weakness. Enemy deals less damage." | Applies stacks from finalValue=qpValue=0, but resolver uses `Math.max(1, round(finalValue))` | B: description says "Apply 1 Weakness" — correct for L0 but resolver adds CC duration = 2t vs QP = 1t, not shown; D: weaken_shield30 (L5) not shown |
| expose | Expose | debuff | reads-stat-table | B, C, D, F | "Apply 1 Vulnerable. Enemy takes more damage." | qpValue=0, stacks from extras.stacks=1, duration=1t QP / 2t CC | C: duration difference QP 1t vs CC 2t not shown; D: expose_dmg3 (L5 deals 3 damage), expose_vuln75 (75% vuln amp) not shown |
| hex | Hex | debuff | A, B, F | — | "Apply 2 Poison over 3 turns." | Resolver hardcodes poisonValue as 8/2/3 for CC/CW/QP | A: hardcodes poison values instead of reading stat-table extras.stacks; B: description shows 2 Poison, resolver at L0 QP applies 3 |
| slow | Slow | debuff | reads-stat-table | B, C, D, F | "Skip enemy's next defend or buff action." | Applies applySlow=true; CC also applies Weakness 1t | B: description omits `(2 AP cost)` shown by seed apCost=2; C: CC Weakness not mentioned; D: slow_any_action, slow_weak1t (L2/L5) not shown |
| cleanse | Cleanse | utility | reads-stat-table | D, F | "Purge all debuffs. Draw 1 card." | applyCleanse=true + extraCardsDrawn=1 always | D: cleanse_heal3 (L3), cleanse_block3 (L5) not shown; F: seed quickPlayValue=1 meaningless |
| scout | Scout | utility | reads-stat-table | B, D, F | "Draw 1 extra card(s) this turn." | extraCardsDrawn from stat-table drawCount=1 (L0) | B: description uses `secondary ?? power ?? 2` not stat table drawCount — shows "1" at L0 correctly by coincidence; D: scout_scry2 (L3/L5) not shown |
| recycle | Recycle | utility | reads-stat-table | C, D, F | "Draw 3 cards." | QP: extraCardsDrawn=3, CC: 4 draw + drawFromDiscard=1 | C: CC draws from discard pile too — not shown; D: recycle_discard_pick (L3/L5) not shown |
| foresight | Foresight | utility | reads-stat-table | B, C, D, F | "Draw 1 cards." | QP: extraCardsDrawn=2 | B: description uses `power` (= baseEffectValue=2, seed) but resolver reads stat-table drawCount=1 at L0; C: CC draws 3, QP draws 2, CW draws 1 — description shows one number; D: foresight_intent (L3/L5) not shown |
| conjure | Conjure | utility | reads-stat-table | F | "Summon 1 of 3 cards to your hand for this encounter." | Opens pendingCardPick correctly | F: seed quickPlayValue/chargeCorrectValue=0 fine; stat table extras.tier not mentioned in description |
| forge | Forge | buff | reads-stat-table | C, D, F | "Grant +1 mastery to 1 card(s) in your hand for this encounter. CC: upgrade 2 cards." | pendingCardPick; pickCount = L3+ 2 else 1 | C: CC in resolver always picks same count as QP (from `pickCount = L3+ ? 2 : 1`), description implies CC is different; D: stat-table extras.amount (upgrade depth) not surfaced |
| transmute | Transmute | utility | reads-stat-table | D, F | "QP: Auto-transform...CC: Choose 1 of 3..." | pendingCardPick or applyTransmuteAuto | D: transmute_choose (L2), transmute_upgrade1 (L3) tags not shown; F: seed quickPlayValue=1 meaningless |
| immunity | Immunity | utility | reads-stat-table | B, D, F | "Absorb next damage instance (up to 4)." | applyImmunity=true (limit from stat table extras.absorb=4 at L0) | B: description uses `power` = baseEffectValue=8 (seed), stat table L0 absorb=4; D: immunity_reflect50 (L5) not shown |
| mirror | Mirror | wild | reads-stat-table | C, D, F | "Copy the previous card's effect." | mirrorCopy=true | C: copy multiplier (L0: 70%) not shown; D: mirror_chain_inherit (L5) not shown |
| adapt | Adapt | wild | reads-stat-table | — | "Smart action: enemy attacking → Block...Charged: 1.5× power. Wrong: 0.7×." | pendingCardPick; adapt_dual at L5 | Clean relative to other mechanics; stat-table qpValue used as baseDmg/baseBlock |
| overclock | Overclock | wild | reads-stat-table | B, C, D, F | "Next card's effect is doubled." | applyOverclock=true | B: "doubled" is wrong at L0 (stat table extras.mult=150, i.e. 1.5×); D: overclock multiplier progression not shown |
| power_strike | Power Strike | attack | reads-stat-table | B, C, D, F | "Deal 4 damage. CC: +3 bonus damage. L5: also applies Vulnerable 1 turn." | Applies `qpValue=4` at L0 | B: shows BASE_EFFECT=4, stat table L0 qpValue=4 — coincidentally correct for this one; C: description shows CC bonus as 0.75× which is wrong — resolver applies no special CC scalar for power_strike (it uses finalValue via standard pipeline); D: power_vuln2t / power_vuln75 not shown |
| twin_strike | Twin Strike | attack | reads-stat-table | B, C, D, F | "Deal 3 damage 2 times. CC: 3 hits at L3+." | Applies `qpValue=2`, hitCount=2 from stat table | B: description uses `power` (baseEffectValue=5) not stat table qpValue=2; C: twin_burn2 (L5) not shown in short or detailed description |
| iron_wave | Iron Wave | attack | A (partial), B, C, F | — | "Deal 3 damage and gain 3 Block." | Applies `qpValue=2` dmg; block uses `mechanic.quickPlayValue × CHARGE_CORRECT_MULTIPLIER + getMasterySecondaryBonus` for CC path | A: CC block computation calls deprecated `getMasterySecondaryBonus()` instead of `_masteryStats.secondaryValue`; B: description shows power=3 (baseEffectValue), resolver L0 applies qpValue=2 |
| reinforce | Reinforce | shield | reads-stat-table | B, C, D, F | "Gain 4 Block. CC: 7 Block." | Applies `qpValue=5` at L0 | B: description uses `power × 1.75` formula with baseEffectValue=8 giving 14 for CC — wrong, stat table CC = 5 × 1.5 = 7.5; D: reinforce_draw1, reinforce_perm1 (L5) not shown |
| shrug_it_off | Shrug It Off | shield | reads-stat-table | B, C, F | "Gain 3 Block and draw 1 card. No draw on CW." | Applies `qpValue=2` + drawCount=1 from stat table | B: description uses baseEffectValue=6 for `power`, resolver uses qpValue=2; C: CW handling mentioned but block value on CW not shown |
| bash | Bash | attack | reads-stat-table | B, C, D, F | "Deal 4 damage. Apply Vulnerable 1 turn (CC: 2 turns)." | Applies `qpValue=4` + Vulnerable 1t (2t on CC) | B: baseEffectValue=10, stat table qpValue=4; D: bash_weak1t (L5 Weakness) not shown |
| guard | Guard | shield | reads-stat-table | B, C, D, F | "Gain 4 Block. CC: 21 Block." | Applies `qpValue=8` at L0 | B: description uses `power = baseEffectValue=14`, CC shown as `14 × 1.75 = 24.5` → 25; stat table L0 qpValue=8, CC = 12; D: guard_taunt1t (L5) not shown |
| sap | Sap | debuff | reads-stat-table | B, C, D, F | "Deal 3 damage and apply Weakness 1 turn. CC: more damage." | Applies `qpValue=1` + Weakness | B: description uses baseEffectValue=3, resolver uses qpValue=1; D: sap_weak2t (L2), sap_strip3block (L5) not shown |
| rupture | Rupture | attack | reads-stat-table | B, C, D, F | "Deal 5 damage and apply 2 Bleed. CC: double Bleed stacks." | Applies `qpValue=2` + bleed=2 (from secondaryValue) | B: description uses baseEffectValue=5, resolver uses qpValue=2; D: rupture_bleed_perm (L5) not shown |
| lacerate | Lacerate | debuff | A (partial), B, C, F | — | "Deal 4 damage and apply 3 Bleed. CC: massive Bleed bonus." | Resolver hardcodes `lacerateBleed` as 8/2/`secondaryValue` | A: bleed stacks not read from stat-table; B: description shows baseEffectValue=4 for damage, resolver uses qpValue=1 (stat table L0) |
| kindle | Kindle | attack | A, B, F | — | "Deal 4 damage, apply 2 Burn, then trigger Burn immediately." | Resolver hardcodes `kindleBurn` as 8/2/`secondaryValue` | A: Burn stacks hardcoded, not read from stat-table secondaryValue; B: description shows baseEffectValue=4, resolver uses qpValue=1 |
| ignite | Ignite | buff | reads-stat-table | C, D, F | "Next attack applies 2 Burn stacks. CC: double stacks." | applyIgniteBuff=finalValue (stat-table extras.burnStacks=2) | C: "double stacks" on CC is imprecise — resolver passes `finalValue` which is already CC-scaled; D: ignite_2attacks (L3/L5) not shown |
| overcharge | Overcharge | attack | A, B, C, F | — | "Deal 3 damage. CC: deal 5 damage + 2 per correct Charge." | Resolver ignores `finalValue` for CC; turnManager handles CC scaling | A: resolver just calls `applyAttackDamage(finalValue)` for all modes; CC handled by turnManager reading `mechanicId === 'overcharge'`; B: description shows "deal 3 damage" using baseEffectValue=6 / 2 — actually stat table L0 qpValue=2; C: CC scaling formula shown incorrectly as `power × 1.75` |
| riposte | Riposte | attack | A (partial), B, D, F | — | "Deal 3 damage and gain 3 Block. CC: both scale." | CC block hardcoded as `12 × focusAdjustedMultiplier` | A: CC block hardcoded to literal 12, not from stat table; B: description uses baseEffectValue=5, resolver uses qpValue=2 at L0; D: riposte_block_dmg40 (L5) shown in description but phrased ambiguously |
| absorb | Absorb | shield | reads-stat-table | B, C, D, F | "Gain 3 Block. CC: also draw 1 card (2 at L3+)." | Applies `qpValue=2` at L0 | B: description uses baseEffectValue=5, resolver uses qpValue=2; D: absorb_heal1cc (L5), absorb_ap_on_block (L5) not shown |
| reactive_shield | Reactive Shield | shield | A (partial), B, C, F | — | "Gain 2 Block and apply 1 Thorns for 1 turn. CC: more of each." | CC: rsThornValue=5 (hardcoded), CW=1 (hardcoded), QP from secondaryValue | A: CC/CW thorns values hardcoded (5/1), not from stat table; B: shows baseEffectValue=4 for block, resolver uses qpValue=2 |
| sift | Sift | utility | reads-stat-table | C, D, F | "Look at top 2 cards of your draw pile and discard any. CC: look at more cards." | siftParams based on isChargeCorrect ? 5 : (isChargeWrong ? 2 : card.baseEffectValue=3) | C: CW and CC look-at counts not shown; D: sift_draw1 (L3), sift_discard_dmg2 (L5) not shown |
| scavenge | Scavenge | utility | reads-stat-table | D, F | "Put 1 card from your discard pile on top of your draw pile. CC: same effect." | pendingCardPick from discard | D: scavenge_draw1 (L2), scavenge's L5 0-AP not shown; F: description says "CC: same effect" which is wrong — CC at L0 is identical to QP via pendingCardPick |
| precision_strike | Precision Strike | attack | A, B, C, F | — | "Deal 8 damage (QP). CC: scales with question difficulty (8 × options). CW: 4 damage." | CC: hardcodes `psBonusMult × (distractorCount + 1)` | A: CC path uses hardcoded `psBaseMult=8`, `psBonusMult=6/12`; B: description says "Deal 8 damage (QP)" — stat table L0 qpValue=5; C: description shows L0-correct CC formula but psBonusMult is not level-described |
| stagger | Stagger | debuff | reads-stat-table | B, C, D, F | "Skip the enemy's next action. Turn counter still advances. CC: same. L2+: also apply Weakness 1 turn." | applyStagger=true; CC also applies Vulnerable 1t | B: description says "CC: same" but resolver applies Vulnerable on CC; C: QP always stuns but CC grants Vulnerable 1t — this is a meaningful CC difference not clearly communicated; D: stagger_draw1 (L3/L4/L5) not shown |
| corrode | Corrode | debuff | A, B, C, F | — | "QP: Remove enemy Block and apply Weakness 1 turn. CC: Remove ALL enemy Block + Weakness 2 turns. CW: Remove 3 Block + Weakness 1t." | QP removes `finalValue` block; finalValue at L0 = stat-table qpValue=2; CC removes all (-1 sentinel) | A: QP uses `finalValue` which IS from stat table — correct for that branch; CC/CW behavior hardcoded | B: description says "remove enemy block" (QP) but resolver removes `finalValue=2` specific blocks, not "all" — this distinction matters |
| swap | Swap | utility | reads-stat-table | C, D, F | "Discard 1 card and draw 1 replacement (free). CC: draw 2 (3 at L3+). CW: discard 1, draw 1 (same as QP)." | swapDiscardDraw with QP draw=1, CC draw=2 | D: swap_cc_draw3 shown in description but drawCount at L0 QP = 1 (stat table) not shown as actual number |
| siphon_strike | Siphon Strike | attack | A (partial), B, C, F | — | "Deal 3 damage. Heal based on overkill damage (min 1, max 6 HP). CC: more damage and heal range." | overkillHeal sentinel=2 (minHeal) sent to turnManager; CC applies same heal sentinel | A: minHeal uses hardcoded mastery level check (`>= 3 ? 3 : 2`) not stat table extras.minHeal; B: description says "min 1, max 6" but stat table L0 extras.minHeal=1, maxHeal=6 — actually correct; D: description correctly states overkill heal |
| aegis_pulse | Aegis Pulse | shield | reads-stat-table | B, C, D, F | "Gain 2 Block. CC: same-chain cards in hand gain +2 Block (3 at L3+)." | shieldApplied=finalValue (qpValue=2 at L0); CC: chainBuff = L3+? 3 : 2 | B: description shows qpValue correctly; D: aegis_draw1cc (L5) not shown |
| inscription_fury | Inscription of Fury | buff | reads-stat-table | C, D, F | "Forgets on play. All attacks deal +1 bonus damage for the rest of combat. CC: double bonus." | finalValue = qpValue=1 at L0; CC "double" via standard pipeline | D: insc_fury_cc_bonus2 (L5 CC gets +2 extra flat damage) not shown |
| inscription_iron | Inscription of Iron | buff | reads-stat-table | C, D, F | "Forgets on play. Gain +1 Block at the start of each turn for the rest of combat. CC: double." | finalValue = qpValue=1 at L0 | D: insc_iron_thorns1 (L5) not shown |
| gambit | Gambit | attack | A, B, C, F | — | "Deal 4 damage and lose 4 HP (QP). CC: deal damage and heal 3 HP instead. CW: deal damage and lose extra HP." | CC: hardcodes `gambitHeal=5`; QP/CW self-damage from mastery check not stat table | A: gambitHeal hardcoded to 5 ignoring stat-table extras.healOnCC (L0=3); QP selfDmg hardcoded from mastery check not stat table extras; B: description says "lose 4 HP" (QP) — stat table L0 selfDmg=4, description correct by coincidence; but "heal 3 HP" on CC is wrong — resolver hardcodes gambitHeal=5 |
| chain_lightning | Chain Lightning | attack | A, B, C, F | — | "Deal 4 damage (QP). CC: deal 4 × chain length damage (counts itself). L5: costs 1 AP." | CC: sentinel via `finalValue` (stat table qpValue=4 L0); turnManager overrides CC damage | A: CC damage fully delegated to turnManager, resolver sets sentinel only; B: description says "deal 4 damage QP" — stat table L0 qpValue=4, resolver matches; C: CW behavior (deals `finalValue` = same as QP) not shown |
| volatile_slash | Volatile Slash | attack | reads-stat-table | C, D, F | "Deal 4 damage. CC: 7 damage then Forget this card. L5: CC no longer Forgets." | Applies `qpValue=4` at L0; CC: `finalValue` (= qpValue × 1.5 = 6) then forgetOnResolve | C: CC damage shown as `power × 1.75` = baseEffectValue×1.75=17.5 — wrong; resolver uses standard pipeline CC = 6 at L0; D: description is already somewhat correct but CC value is imprecise |
| burnout_shield | Burnout Shield | shield | reads-stat-table | C, D, F | "Gain 4 Block. CC: 7 Block then Forget this card. L5: CC no longer Forgets." | Applies `qpValue=5` at L0; CC = 5 × 1.5 = 7.5 | B/C: description shows `power=baseEffectValue=8`, so CC shows 14 — wrong; resolver L0 CC = 7.5 ≈ 7; D: burnout_no_forget mentioned in description |
| knowledge_ward | Knowledge Ward | shield | A, B, C, F | — | "Gain Block scaled by correct Charges this encounter. QP: 6×Charges. CC: 10×Charges. CW: 4 Block." | CC: hardcodes `10 × correctCharges`; QP: hardcodes `6 × correctCharges`; CW: hardcodes 4 | A: all multipliers hardcoded; stat table qpValue ignored (set to 6 which happens to match the hardcoded multiplier); D: knowledge_ward_cleanse (L3+) not shown |
| warcry | Warcry | buff | A, C, D, F | — | "QP: gain +1 Strength this turn. CC: gain Strength permanently and next Charge costs 0 AP. L5: +3 Str permanent." | CC: hardcodes `{ value: 2, permanent: true }` + warcryFreeCharge; QP: hardcodes `{ value: 2, permanent: false }` | A: resolver ignores stat table extras.str (L0=1 for QP); hardcodes value=2 on CC/QP and value=1 on CW; D: warcry_perm_str L3 QP permanent bonus handled in turnManager but not shown in description |
| battle_trance | Battle Trance | buff | reads-stat-table | C, D, F | "Draw 2 cards. QP/CW: cannot play or Charge more cards this turn. CC: no restriction." | drawCount from stat table (L0=2); lockout via applyBattleTranceRestriction | C: CW also draws 2 (but hardcodes 2 not stat-table drawCount); D: trance_cc_ap1 (L5) not shown |
| curse_of_doubt | Curse of Doubt | debuff | reads-stat-table | B, C, F | "Enemy takes +15% more damage from Charged attacks for 1 turn(s)." | applyChargeDamageAmpPercent from finalValue (stat-table pctBonus) | B: description shows defaults pctBonus=15, turns=1 — but stat table L0 is pctBonus=15, turns=1. Actually correct by coincidence; C: QP=2t, CC=3t, CW=1t duration variance hidden |
| mark_of_ignorance | Mark of Ignorance | debuff | reads-stat-table | C, F | "Enemy takes +2 flat damage from every Charged attack for 1 turn(s)." | applyChargeDamageAmpFlat from finalValue | C: QP=2t, CC=3t, CW=1t duration hidden — same as curse_of_doubt pattern |
| corroding_touch | Corroding Touch | debuff | A, C, F | — | "Free. Apply 1 Weakness for 1 turn(s). CC: more stacks + Vulnerable 1t." | Resolver hardcodes stacks: CC=3 weak 2t + 2 vuln; QP=2 weak; CW=1 weak | A: hardcodes stack values rather than reading stat-table extras.weakStacks/weakTurns; duration uses deprecated getMasteryBaseBonus |
| phase_shift | Phase Shift | wild | reads-stat-table | C, D, F | "QP/CW: choose 4 damage OR 4 Block. CC: deal 7 damage AND gain the same Block." | pendingChoice or both-simultaneously; values from stat-table qpValue | C: description uses `power × 1.75` for CC value — wrong, CC uses standard pipeline qpValue × 1.5; D: phase_shift_draw1 (L5) not shown |
| chameleon | Chameleon | wild | reads-stat-table | C, D, F | "Copy the previous card's effect at 100% power (QP). CC: 130% power and inherit its chain type. CW: 70% power." | chameleonMultiplier from hardcoded literals, stat-table extras used by turnManager | C: description says "100% QP" — stat table L0 extras.qpMult=70 (70%) — description wrong; D: chameleon_chain (L5) not shown |
| dark_knowledge | Dark Knowledge | wild | reads-stat-table | B, C, F | "Deal 2 damage per cursed fact in your deck. CC: higher multiplier." | dkStats?.extras?.dmgPerCurse (stat table) — reads-stat-table | B: description shows "2 damage per cursed fact" — stat table L0 dmgPerCurse=2, correct; C: CC multiplier not shown; D: dark_heal1_per_curse (L5) not shown |
| chain_anchor | Chain Anchor | wild | reads-stat-table | C, D, F | "Draw 1 card. CC: set your chain counter to 2 for the next chain card played, then draw 1." | extraCardsDrawn=1 always; CC: applyChainAnchor=true | C: CC also draws 1 extra (2 total) but description implies same 1 draw; D: chain_anchor_set3 (L3), chain_anchor_ap0 (L5) not shown |
| unstable_flux | Unstable Flux | wild | A (partial), B, C, F | — | "QP/CW: apply a random effect (damage, Block, draw, or debuff) at 5 power." | QP baseDmg = `Math.round(10 * fluxMult)` — hardcoded 10 not stat table | A: QP/CC effect values derive from hardcoded literal 10, not stat-table qpValue (L0=4); B: description shows `power=5` (baseEffectValue=10/2), resolver uses 10; C: description summarizes but does not show CC choice |
| smite | Smite | attack | A, B, C, F | — | "Deal 10 damage (QP). CC: 10 + (6 × Aura level) damage. CW: 6 damage + Aura −1." | CC: hardcodes `10 + (6 × (10-fogLevel))` independent of stat table | A: hardcoded formula ignores stat-table qpValue; B: description says "10 damage QP" — stat table L0 qpValue=7; C: CW extra fog penalty shown but QP value is wrong |
| feedback_loop | Feedback Loop | attack | A, B, C, F | — | "Deal 5 damage (QP). CC: 40 damage (+16 in Flow State). CW: 0 damage + Aura −3 crash." | CC: hardcodes mechanicBaseValue=28 (+12 in flow state) | A: CC hardcodes 28/40 regardless of stat table; B: description still says "CC: 40 damage" but Pass 8 reduced it to 28/40 (done in code, description not updated — shows stale value); also description says "QP: 5 damage" but stat table L0 qpValue=3 |
| recall | Recall | attack | A, C, F | — | "Deal 10 damage (QP). CC: 20 damage (30 on Review Queue fact). CW: 6 damage." | CC: hardcodes mechanicBaseValue=20 (30 on review fact); QP/CW use `finalValue` | A: CC path hardcodes 20/30 ignoring stat table; stat table L0 qpValue=5, but QP/CW delegate to `finalValue` (uses stat-table correctly for those branches) |
| hemorrhage | Hemorrhage | attack | C, F | — | "Deal 4 damage plus 3× enemy Bleed stacks (L0 QP bleedMult). CC: 6×. CW: 2×." | hemoBase = stat-table qpValue; QP bleedMult from extras.bleedMult | **Fixed 2026-04-12:** resolver QP bleedMult now reads extras.bleedMult from stat table (L0=3, not hardcoded 4). C: CC bleedMult still hardcoded at 6 (intentional) |
| eruption | Eruption | attack | reads-stat-table | C, D, F | "Spend all remaining AP. Deal 6 damage per AP spent (QP). CC: 9 per AP. CW: 3 per AP. L5: refund 1 AP." | statDmgPerAp = _masteryStats?.extras?.dmgPerAp ?? fallback | C: description states "9 per AP" for CC at L0 but resolver: ccPerAp = round(6 × 1.5) = 9 — correct; D: eruption_refund1 shown in description |
| bulwark | Bulwark | shield | reads-stat-table | C, D, F | "Gain 9 Block. CC: 15 Block then Forget this card. L3+: CC no longer Forgets." | Applies qpValue from stat table; CC = qpValue × 1.5; L3+ bulwark_no_forget | C: CC value shown as `power × 1.75` = baseEffectValue×1.75=15.75 → 15 — almost correct by coincidence (stat table L0 CC = 9×1.5=13.5); B: description says "Gain 9 Block" and stat table L0 qpValue=9 — correct |
| conversion | Shield Bash | shield | reads-stat-table | C, D, E, F | "Gain 3 Block, then deal damage equal to your current Block (consuming it). CC: deal 1.5× your Block instead." | playerBlock × modePct × cursedMult × bonusMult | C: CW mode (0.5× block damage) not shown; D: conversion_keep_block (L5) shown but conversion_bonus_50pct (L3) not shown; E: "Gain X Block then deal Block as damage" — player might think block persists before damage |
| ironhide | Ironhide | shield | reads-stat-table | B, C, D, F | "Gain 3 Block and +1 Strength this turn (QP) or permanently (CC)." | shieldApplied=qpValue=6 at L0; Strength from extras.str | B: description shows "3 Block" (baseEffectValue=6 for shield, no — baseEffectValue comes from BASE_EFFECT[shield]=3, resolver uses stat-table qpValue=6); C: CW (block only, no Strength) not shown; D: stat-table shows strPerm=1 for all levels meaning QP str is also permanent from L0, but description says "this turn" for QP |
| frenzy | Frenzy | buff | reads-stat-table | C, D, F | "Next 1 card(s) cost 0 AP (QP). CC: 2 free cards. CW: 1 free card." | frenzyFreeCards from stat-table extras.freeCards | C: description shows `freeCards` and `freeCards+1` for CC, but stat table L0 extras.freeCards=1 and CC gives freeCards ?? 3 = 3 at L0; D: frenzy_draw1 (L5) not shown |
| mastery_surge | Mastery Surge | buff | reads-stat-table | C, D, F | "QP: randomly grant +1 mastery to 1 card(s) in hand. CC: choose which cards. CW: no effect." | surgeTargets from stat table; CW intentional fizzle | D: msurge_choose (L3), msurge_plus2 (L5), msurge_ap_on_l5 (L5) not shown |
| war_drum | War Drum | buff | reads-stat-table | C, F | "All cards in your hand gain +1 base effect this turn. CC: +2. CW: +0." | warDrumBonus from finalValue (stat-table extras.bonus=1 via qpValue mechanism) | C: CW gives `Math.round(bonus × 0.5) = 0` at L0 — description correctly shows `+0.5` → 0; D: war_drum_draw1 (L5) not shown |
| entropy | Entropy | debuff | reads-stat-table | C, D, F | "Apply 2 Burn and 1 Poison for 2 turn(s). CC: higher values and more turns." | Burn from finalValue=qpValue=0+extras.burn=2; poison hardcoded in resolver | C: CW (1 Burn, 1 Poison, 1t) not shown; A (partial): resolver hardcodes poisonStacks/Duration (4/3/1 for CC/QP/CW) instead of reading extras |
| archive | Archive | utility | reads-stat-table | C, D, F | "Choose 1 card(s) in hand to retain past turn end. CC: retain 2." | archiveRetainCount from stat-table extras.retain | D: archive_block2_per (L3), archive_draw1 (L5) not shown |
| reflex | Reflex | utility | reads-stat-table | C, D, F | "Draw 1 card(s). PASSIVE: when discarded from hand, gain 2 Block. CC: draw more." | extraCardsDrawn from stat-table drawCount | C: CC draws from stat-table drawCount=1 at L0 but resolver uses hardcoded 2 for CC — differs from stat table; D: reflex_draw3cc (L3), reflex_enhanced not shown |
| recollect | Recollect | utility | reads-stat-table | C, D, F | "Return 1 forgotten card(s) to your discard pile. CC: return 2." | forgottenCardsToReturn from stat-table (indirectly via mastery check) | D: recollect_upgrade1 (L3), recollect_play_free (L5) not shown |
| synapse | Synapse | utility | reads-stat-table | C, D, F | "Draw 1 card(s). CC: also extend the active chain by 1 (wildcard link). L3+ only." | extraCardsDrawn from stat-table drawCount=1 at L0 | C: CC always draws 2 (hardcoded `synapseDraw=2`) not 1 (stat table L0 drawCount=1); D: synapse_chain_plus1 (L5) not shown |
| siphon_knowledge | Siphon Knowledge | utility | reads-stat-table | C, D, F | "Draw 1 card(s) and briefly show all current quiz answers for 2 seconds." | siphonDraw/previewSeconds from stat-table at L0 | D: siphon_eliminate1 (L5) not shown; C: CW: draw 1 + 2s — description shows QP values which match |
| tutor | Tutor | utility | reads-stat-table | C, D, F | "Search your draw pile; choose a card and add it to hand. CC: that card costs 0 AP this turn." | tutoredCardFree from CC/tag check | D: tutor_free_play (L2+) shown partially; stat-table extras.search (L3: 2 choices, L5: 3 choices) not shown |
| sacrifice | Sacrifice | wild | A, B, C, F | — | "Lose 5 HP. Draw 2 cards and gain +1 AP (QP). CC: draw 3 cards and gain +2 AP. CW: draw 1 card and gain +1 AP. (Free)" | selfDamage hardcoded to 5; sacrificeDraw from mastery check not stat table | A: resolver uses `masteryL3Sacrifice` check not stat-table extras.draw; B: "Lose 5 HP" — stat table L0 extras.hpCost=6; stat table ignored; D: description correct for QP numbers but all values are hardcoded |
| catalyst | Catalyst | wild | reads-stat-table | C, D, F | "Double all enemy Poison stacks. CC: also double enemy Burn." | Doubled/tripled behavior from tags | C: description says "L2+: always also doubles Burn" — resolver checks `isChargeCorrect || hasTag('catalyst_burn')` which is correct; D: catalyst_triple (L5) shown as "TRIPLE" — actually mentioned in description |
| mimic | Mimic | wild | reads-stat-table | C, D, F | "Play a random card from your discard pile at 60% power (QP). CC: choose which card at 100% power. CW: random at 30%." | mimicChoose from stat-table tag; qpMult from extras | C: cwMult shown as 30% but stat table L0 extras has no cwMult defined, defaults used in description; D: mimic_choose (L3) shown in description |
| aftershock | Aftershock | wild | A, B, C, F | — | "Repeat the last card played this turn at 40% power (QP). CC: repeat last Charged card at 50% with no quiz. CW: 30%." | qpMult/ccMult from mastery-level math `0.5 + (level × 0.1)` | A: resolver computes mults inline with `masteryLevelAftershock × 0.1` not from stat-table extras; B: description uses extras fallback (40%/50%) — stat table L0 extras.qpMult=40, ccMult=50 — correct by coincidence; D: aftershock_no_quiz (L5) shown in description |
| knowledge_bomb | Knowledge Bomb | wild | reads-stat-table | C, D, F | "QP/CW: deal 4 damage. CC: deal 3 × total correct Charges this encounter as damage (own CC counts)." | perCorrect from stat-table; QP/CW hardcoded to 4 | C: QP/CW hardcoded to 4 regardless of mastery; A (partial): QP/CW path hardcoded; D: kbomb_count_past (L3/L5) not shown |
| inscription_wisdom | Inscription of Wisdom | buff | reads-stat-table | C, D, F | "Forgets on play. QP: each future Charge Correct draws 1 extra card. CC: also heals 1 HP per CC. CW: fizzles completely — card is lost." | inscriptionWisdomActivated.extraDrawPerCC=1, healPerCC from CC branch | C: stat table shows extraDrawPerCC and healPerCC per level but description only shows L0 values; D: inscription_wisdom_heal2 tag path mentioned but stat table shows healPerCC changes at L2 (not L3 as resolver checks) |

---

## Full Detail — Flagged Mechanics (Severity A first, then B, C, D, E, F)

### execute — Execute

**Severities:** A, D, F

**Seed:** `quickPlayValue: 3, chargeCorrectValue: 18, chargeWrongValue: 2`
**Stat table L0:** `qpValue: 2, extras: { execBonus: 4 }`
**Resolver:** `hybrid` — `case 'execute':` applies `applyAttackDamage(finalValue)` for base, then hardcodes `bonusBaseValue` as `isChargeCorrect ? 24 : (isChargeWrong ? 4 : 8)`. The execute bonus does NOT come from `_masteryStats?.extras?.execBonus`. Instead the resolver reads `mechanic?.secondaryThreshold ?? 0.3` for the HP trigger threshold — ignoring the L3+ `execThreshold: 0.4` and L5 `execThreshold: 0.5` from stat table.
**Renderer:** `case 'execute':` returns `Deal ${power} damage. +${bonusDmg} bonus if enemy below 30% HP.` where `bonusDmg = secondary ?? 8` (seed.secondaryValue=8). The threshold is always shown as 30%.
**Renders as @ L0:** "Deal 4 damage. +8 bonus if enemy below 30% HP."
**What the player sees wrong:** The execute bonus is shown as +8 always (from seed secondaryValue) even though stat table L0 execBonus=4. At L3 the threshold widens to 40% HP but the description always shows 30%. At L5 threshold widens to 50%.
**Recommended fix:** Resolver: read `_masteryStats?.extras?.execBonus` for bonus value and `_masteryStats?.extras?.execThreshold ?? mechanic.secondaryThreshold ?? 0.3` for threshold. Description: read `stats?.extras?.execBonus` and `stats?.extras?.execThreshold` and display them.

---

### hex — Hex

**Severities:** A, B, F

**Seed:** `quickPlayValue: 2, chargeCorrectValue: 8, chargeWrongValue: 1, secondaryValue: 3`
**Stat table L0:** `qpValue: 0, extras: { stacks: 2, turns: 2 }`
**Resolver:** `hardcoded` — `case 'hex':` hardcodes `poisonValue` as `isChargeCorrect ? 8 : (isChargeWrong ? 2 : 3)`. Poison duration always reads `3 + resolvePoisonDurationBonus(activeRelicIds)` (hardcoded 3-turn base). Neither reads from stat table extras.stacks or extras.turns.
**Renderer:** `case 'hex':` returns `Apply ${power} Poison over ${turns} turns.` where `power = card.baseEffectValue` and `turns = secondary ?? 3`.
**Renders as @ L0:** "Apply 4 Poison over 3 turns." (baseEffectValue=4, secondaryValue=3)
**What the player sees wrong:** Resolver L0 QP actually applies 3 stacks for 3 turns. Description shows 4 stacks (from `baseEffectValue`) not 3. At L2 the stat table has stacks=3, turns=3 — resolver still hardcodes 3 so it accidentally matches; at L4 table has stacks=4 but resolver still hardcodes 3 for QP. Description is always wrong.
**Recommended fix:** Resolver: read `_masteryStats?.extras?.['stacks']` and `_masteryStats?.extras?.['turns']` for each play mode, applying CC multiplier. Description: read `stats?.extras?.['stacks']` and `stats?.extras?.['turns']` for display.

---

### fortify — Entrench

**Severities:** A, B, F

**Seed:** `quickPlayValue: 6, chargeCorrectValue: 21, chargeWrongValue: 4, id: 'fortify', name: 'Entrench'` (note: id and name differ)
**Stat table L0:** `qpValue: 5, apCost: 2`
**Resolver:** `hardcoded` — `case 'fortify':` ignores `finalValue` entirely. QP: `Math.floor(cappedBlock * 0.5)`. CC: `Math.floor(cappedBlock * 0.75) + applyShieldRelics(finalValue)`. CW: `Math.floor(cappedBlock * 0.25)`. The card provides block proportional to current block, not a flat value from stat table.
**Renderer:** `case 'fortify':` returns `Gain ${power} Block. Persists into next turn.` — uses `baseEffectValue` (=7, the old seed baseValue) as a flat number.
**Renders as @ L0:** "Gain 7 Block. Persists into next turn."
**What the player sees wrong:** The mechanic does not give flat block. It scales current block by 50% (QP) or 75% + card value (CC). The description "Gain 7 Block" is completely wrong. A first-time player will be confused when they see 0 block with empty shield. Also "Persists into next turn" is shown at L0 but `fortify_carry` tag (which enables persistence) only activates at L5.
**Recommended fix:** Description: "Gain block based on your current block (QP: 50%, CC: 75% + base). L5: block persists into next turn." Remove flat "Gain X" pattern. This is the most misleading description in the entire set.

---

### lacerate — Lacerate

**Severities:** A, B, C, F

**Seed:** `quickPlayValue: 2, chargeCorrectValue: 12, chargeWrongValue: 2, secondaryValue: 4`
**Stat table L0:** `qpValue: 1, secondaryValue: 3`
**Resolver:** `hardcoded` — `case 'lacerate':` hardcodes `lacerateBleed` as `isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 4))`. Bleed stacks do not come from `_masteryStats.secondaryValue`.
**Renderer:** `case 'lacerate':` `const bleed = stats?.secondaryValue ?? 3;` — reads stat table secondaryValue for description. At L0, stat table secondaryValue=3 so description shows 3.
**Renders as @ L0:** "Deal 4 damage and apply 3 Bleed. CC: massive Bleed bonus." (`power=baseEffectValue=4`)
**What the player sees wrong:** Damage shown as 4 (baseEffectValue), resolver applies qpValue=1. Bleed description uses stat-table value (3) correctly, but resolver uses `secondaryValue ?? 4` (which is 4 from seed, not 3 from table). So description says 3, resolver applies 4. Severity C: "CC: massive Bleed bonus" doesn't show the actual value (8 stacks).
**Recommended fix:** Resolver: read `_masteryStats?.secondaryValue` for bleed stacks. Description: read damage from stat-table qpValue not baseEffectValue.

---

### kindle — Kindle

**Severities:** A, B, F

**Seed:** `quickPlayValue: 2, chargeCorrectValue: 8, chargeWrongValue: 2, secondaryValue: 4`
**Stat table L0:** `qpValue: 1, secondaryValue: 2`
**Resolver:** `hardcoded` — `case 'kindle':` hardcodes `kindleBurn` as `isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 4))`. QP Burn at L0 resolves to 4 (from seed secondaryValue=4, fallback chain). Stat table L0 secondaryValue=2.
**Renderer:** `case 'kindle':` `const burn = stats?.secondaryValue ?? 2;` — reads stat table secondaryValue. Shows 2.
**Renders as @ L0:** "Deal 4 damage, apply 2 Burn, then trigger Burn immediately. CC: more Burn. L5: trigger twice." (`power=baseEffectValue=4`)
**What the player sees wrong:** Damage shown as 4, resolver applies qpValue=1. Burn shown as 2 (correct from stat table), but resolver applies 4 (from seed secondaryValue). CC Burn shown vaguely as "more Burn" — actual value is 8.
**Recommended fix:** Resolver: read `_masteryStats?.secondaryValue` for kindleBurn QP base. Description: read damage from stat-table qpValue.

---

### overcharge — Overcharge

**Severities:** A, B, C, F

**Seed:** `quickPlayValue: 3, chargeCorrectValue: 6, chargeWrongValue: 2`
**Stat table L0:** `qpValue: 2`
**Resolver:** `missing-CC` — `case 'overcharge':` calls `applyAttackDamage(finalValue)` for ALL modes including CC. The actual CC scaling happens in turnManager by checking `mechanicId === 'overcharge'`. The resolver itself provides no CC logic — it's fully delegated.
**Renderer:** `case 'overcharge':` returns `Deal ${power} damage. CC: deal ${Math.round(power * 1.75)} damage + 2 per correct Charge...` where power = baseEffectValue.
**Renders as @ L0:** "Deal 6 damage. CC: deal 10 damage + 2 per correct Charge used this encounter (own CC counts)." (baseEffectValue=6)
**What the player sees wrong:** QP damage shown as 6 (baseEffectValue), resolver applies qpValue=2 (stat table). CC formula in description doesn't match actual turnManager implementation (which uses the charge-count-scaling independently). The `power × 1.75` formula for CC is fabricated.
**Recommended fix:** Description: show qpValue from stat table. Remove the fabricated CC formula; state "CC: 3 + 2 per correct Charge this encounter" or similar. Resolver: ensure turnManager path is documented with a comment.

---

### warcry — Warcry

**Severities:** A, C, D, F

**Seed:** `quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1, extras.str: 1 (via warcry stat table)`
**Stat table L0:** `qpValue: 1, extras: { str: 1, strTurns: 1 }`
**Resolver:** `hardcoded` — `case 'warcry':` CC: hardcodes `value: 2` permanent. QP: hardcodes `value: 2` temporary. CW: hardcodes `value: 1` temporary. The `str` field from stat table is NOT used. At L0, stat table extras.str=1 but resolver applies value=2 on CC/QP.
**Renderer:** `case 'warcry':` `const str = stats?.extras?.['str'] ?? 1;` — reads stat table str=1. Shows 1.
**Renders as @ L0:** "QP: gain +1 Strength this turn. CC: gain Strength permanently and next Charge costs 0 AP. L5: +3 Str permanent."
**What the player sees wrong:** Description shows +1 Strength (from stat table extras.str=1), but resolver hardcodes +2 Strength on CC and QP. The player experiences +2 but is told +1. Severity D: the description says "next Charge costs 0 AP" which is the warcryFreeCharge rider — this is actually shown. But the L3 partial-permanent QP bonus (handled in turnManager via `warcry_perm_str` tag) is not described.
**Recommended fix:** Resolver: read `_masteryStats?.extras?.['str']` for Strength value at each play mode. The warcry stat table has str=1 at L0, str=2 at L1, str=3 at L5 — the resolver should use these. This is the root cause of the Warcry confusion mentioned in task context.

---

### gambit — Gambit

**Severities:** A, B, C, F

**Seed:** `quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4`
**Stat table L0:** `qpValue: 4, extras: { selfDmg: 4, healOnCC: 3 }`
**Resolver:** `hardcoded` — `case 'gambit':` CC: hardcodes `gambitHeal = 5` regardless of stat table (L0 healOnCC=3). QP selfDmg: `masteryL3 ? 1 : 2` (hardcoded — L0 should be 4 from stat table). CW selfDmg: `masteryL3 ? 4 : 5` (hardcoded).
**Renderer:** `case 'gambit':` reads `stats?.extras?.['selfDmg']` and `stats?.extras?.['healOnCC']` — reads stat table.
**Renders as @ L0:** "Deal 4 damage and lose 4 HP (QP). CC: deal damage and heal 3 HP instead. CW: deal damage and lose extra HP."
**What the player sees wrong:** Description says "lose 4 HP" (QP) and "heal 3 HP" (CC) — from stat table extras, correct. Resolver hardcodes selfDmg=2 (QP at L0, not L3) and gambitHeal=5 (not 3). The player sees 3 HP heal described but gets 5. They see "lose 4 HP" described but lose 2. Both diverge.
**Recommended fix:** Resolver: read `_masteryStats?.extras?.['healOnCC']` for CC heal. Read `_masteryStats?.extras?.['selfDmg']` for QP self-damage. Remove hardcoded mastery level checks.

---

### feedback_loop — Feedback Loop

**Severities:** A, B, C, F

**Seed:** `quickPlayValue: 5, chargeCorrectValue: 40, chargeWrongValue: 0`
**Stat table L0:** `qpValue: 3`
**Resolver:** `hardcoded` — CC: hardcodes `mechanicBaseValue = 28` (+12 in Flow State = 40). QP: `applyAttackDamage(finalValue)` — uses stat-table qpValue=3 at L0. CW: hardcodes 0 damage (correct for base behavior) + fog crash.
**Renderer:** description says "Deal 5 damage (QP). CC: 40 damage (+16 in Flow State). CW: 0 damage + Aura −3 crash." — uses seed quickPlayValue=5, not stat-table qpValue=3. CC damage shown as 40 but Pass 8 reduced CC to 28 (+12 = 40 in flow state) — the description was not updated to reflect the flow-state-only 40.
**Renders as @ L0:** "Deal 5 damage (QP). CC: 40 damage (+16 in Flow State). CW: 0 damage + Aura −3 crash."
**What the player sees wrong:** QP description shows 5, resolver applies 3. CC description says "+16 in Flow State" but Pass 8 reduced this to +12 (cap 40). Description is stale post-Pass-8.
**Recommended fix:** Update description: "Deal 3 damage (QP). CC: 28 damage (40 in Flow State). CW: 0 damage + Aura crash." Resolver CC could read stat-table qpValue for base but the complex formula warrants keeping hardcoded with a comment referencing the Pass 8 values.

---

### smite — Smite

**Severities:** A, B, C, F

**Seed:** `quickPlayValue: 10, chargeCorrectValue: 40, chargeWrongValue: 6`
**Stat table L0:** `qpValue: 7, apCost: 2`
**Resolver:** `hardcoded` — CC: `10 + (6 × (10 - fogLevel))` — entirely independent of stat table. QP: `applyAttackDamage(finalValue)` where finalValue derives from stat-table qpValue=7 at L0.
**Renderer:** description says "Deal 10 damage (QP). CC: 10 + (6 × Aura level) damage. CW: 6 damage + Aura −1." — shows QP as 10 (seed quickPlayValue), stat table L0 qpValue=7.
**Renders as @ L0:** "Deal 10 damage (QP). CC: 10 + (6 × Aura level) damage. CW: 6 damage + Aura −1."
**What the player sees wrong:** QP described as 10, resolver applies 7. CC formula uses fog-level (0-10 scale, where 0=flow) not the Aura level the description mentions (aura is different from fog). The description says "Aura level" but resolver uses `10 - fogLevel` as a proxy for aura state. These are related but not identical terms.
**Recommended fix:** Description: show "Deal 7 damage (QP)" at L0. Clarify Aura/fog relationship in text.

---

### precision_strike — Precision Strike

**Severities:** A, B, C, F

**Seed:** `quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 4`
**Stat table L0:** `qpValue: 5`
**Resolver:** `hardcoded` — CC: `psBonusMult × (distractorCount + 1)` where `psBaseMult=8` (unused), `psBonusMult = hasTag('precision_bonus_x2') ? 12 : 6`. QP: `applyAttackDamage(finalValue)` — uses stat-table qpValue=5 at L0. CW: `applyAttackDamage(finalValue)` — stat table L0 qpValue=5, but then CW should be FIZZLE_RATIO × qpValue = 2.5 ≈ 2 from the standard pipeline; description says "4 damage" using seed chargeWrongValue.
**Renderer:** description says "Deal 8 damage (QP). CC: scales with question difficulty (8 × options). CW: 4 damage." — uses seed values throughout, not stat-table.
**Renders as @ L0:** "Deal 8 damage (QP). CC: scales with question difficulty (8 × options). CW: 4 damage."
**What the player sees wrong:** QP shows 8 (seed), resolver applies 5 (stat table). CW shows 4 (seed chargeWrongValue), resolver applies CW pipeline = standard fizzle on finalValue=5 ≈ 2. The CC multiplier literal (6) differs from the seed chargeCorrectValue=24 (which would imply 8× not 6×).
**Recommended fix:** Description: show "Deal 5 damage (QP). CC: 6 × (distractor count + 1). CW: 2 damage." Resolver is correctly using stat-table for QP/CW path but the CC formula is fully hardcoded.

---

### ironhide — Ironhide

**Severities:** B, C, D, F

**Seed:** `quickPlayValue: 3, chargeCorrectValue: 6, chargeWrongValue: 2, apCost: 2`
**Stat table L0:** `qpValue: 6, apCost: 2, extras: { str: 1, strPerm: 1 }`
**Resolver:** reads-stat-table — `case 'ironhide':` reads `_masteryStats?.extras?.strPerm` and `_masteryStats?.extras?.str`. At L0, strPerm=1 (nonzero), so QP Strength IS applied as permanent. Resolver correctly reads stat table.
**Renderer:** `case 'ironhide':` `const str = stats?.extras?.['str'] ?? 1;` — reads stat table. Shows: "Gain 3 Block and +1 Strength this turn (QP) or permanently (CC)."
**Renders as @ L0:** "Gain 3 Block and +1 Strength this turn (QP) or permanently (CC). L5: costs 1 AP."
**What the player sees wrong:** Block shown as 3 (BASE_EFFECT[shield]=3), resolver applies qpValue=6. QP Strength described as "this turn" but stat table strPerm=1 at L0 means QP Strength is also permanent. Description is wrong about QP permanence.
**Recommended fix:** Description: show "Gain 6 Block and +1 Strength" at L0. QP permanence text should read "permanently (QP and CC)" since strPerm=1 from L0.

---

### overheal — Overheal

**Severities:** B, C, D, F

**Seed:** `quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4`
**Stat table L0:** `qpValue: 6, apCost: 2`
**Resolver:** `case 'overheal':` `healthPercentage < 0.6 ? 2.0 : 1.0` — threshold hardcoded at 60%. Stat table has no emergThreshold (unlike emergency). Block = `applyShieldRelics(Math.round(finalValue × bonusMultiplier))` where finalValue = stat-table qpValue=6.
**Renderer:** description says "Gain 5 Block. Double if HP below 50%." — uses baseEffectValue=3... wait, actually `power = baseEffectValue` for shield cards from `BASE_EFFECT[shield]=3`... No: looking at the seed, `baseValue:10` — `createCard` uses `BASE_EFFECT[cardType]` not mechanic.baseValue. So `baseEffectValue=3` (shield). But the description says "Gain 5 Block" — that's wrong too. The description uses `power` which comes from `powerOverride ?? Math.round(card.baseEffectValue)`. For a shield card baseEffectValue=3 from factory. But the displayed description shows 5 — let me re-check. Seed `quickPlayValue: 5`. The description for overheal: `return \`Gain ${power} Block. Double if HP below 50%.\`` — `power = baseEffectValue` = 3 (from factory). But displayed as 5? Actually `getDetailedCardDescription` may receive a `powerOverride` in some call paths. In the card hand display, it's called with `liveCardStats.qpValue` as `powerOverride`. So in practice the player sees the live stat value. But the issue remains: the threshold displayed (50%) is wrong — resolver uses 60%.
**Renders as @ L0:** "Gain [liveQP=6] Block. Double if HP below 50%." — threshold wrong (actually 60%).
**Recommended fix:** Description: fix threshold to 60%. This is a concrete factual error visible to first-time players.

---

### chameleon — Chameleon

**Severities:** C, D, F

**Seed:** `quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1`
**Stat table L0:** `qpValue: 0, extras: { qpMult: 70, ccMult: 100, cwMult: 50 }`
**Resolver:** reads-stat-table — chameleonMultiplier hardcoded from `isChargeCorrect ? 1.3 : (isChargeWrong ? 0.7 : 1.0)` — does NOT read stat-table extras.qpMult.
**Renderer:** description says "Copy the previous card's effect at 100% power (QP). CC: 130% power and inherit its chain type. CW: 70% power." — uses hardcoded values matching the resolver, not stat table. Stat table L0 shows qpMult=70 (70%), ccMult=100 (100%), cwMult=50 (50%).
**Renders as @ L0:** "Copy the previous card's effect at 100% power (QP). CC: 130% power and inherit its chain type. CW: 70% power."
**What the player sees wrong:** Description says "100% QP" but stat table says 70% at L0. Resolver also hardcodes 1.0 for QP (100%). Both description and resolver disagree with stat table on QP power (70% vs 100%). Stat table progression (70%→80%→90%→100%→100%→100%) would create a meaningful QP mastery arc — currently ignored.
**Recommended fix:** Resolver: read `_masteryStats?.extras?.['qpMult'] / 100` for QP multiplier. Description: show "QP: copy at L0 70% power, grows to 100% at L3+."

---

### conversion — Shield Bash

**Severities:** C, D, E, F

**Seed:** `quickPlayValue: 5, chargeCorrectValue: 15, chargeWrongValue: 3`
**Stat table L0:** `qpValue: 3`
**Resolver:** reads-stat-table for block gain. Damage path: `playerBlock × modePct × cursedMult × bonusMult` — QP modePct=1.0, CC=1.5, CW=0.5.
**Renderer:** description says "Gain X Block, then deal damage equal to your current Block (consuming it). CC: deal 1.5× your Block instead. L5: Block is NOT consumed."
**Renders as @ L0:** "Gain 3 Block, then deal damage equal to your current Block (consuming it). CC: deal 1.5× your Block instead. L5: Block is NOT consumed."
**What the player sees wrong:** CW (0.5× block damage) is not shown. The description says "gain X Block then deal Block as damage" which implies Block is gained and then immediately spent — true, but a first-time player may not realize the Block gained is included in the damage calculation, making timing critical (E flag). Severity D: conversion_bonus_50pct (L3: ×1.5 bonus multiplier on all modes) not mentioned.
**Recommended fix:** Add CW behavior. Clarify timing: "Gain Block, then immediately deal damage equal to all your Block (QP: 1×, CC: 1.5×, CW: 0.5×)." Mention L3 bonus.

---

## Mechanics with No Severities (Clean)

Only 3 mechanics emerged fully clean from this audit:

1. **`adapt`** — resolver delegates to a pendingCardPick/pendingChoice system for all modes; the description accurately reflects the adaptive behavior. The stat-table qpValue is used as baseDmg correctly. adapt_dual (L5) IS mentioned in description as "does BOTH."
2. **`transmute`** — resolver delegates CC to pendingCardPick and QP to auto-pick; the description accurately describes QP/CC/CW distinction. Stat table tags (transmute_choose, transmute_upgrade1) are not shown in description but the mechanic's core behavior is accurately represented.
3. **`conjure`** — same pattern as transmute; pendingCardPick delegation, description matches.

These three share a common trait: their core behavior is "open a picker overlay" not "deal X damage," so there's no number to get wrong.

---

## Summary of Most Critical Issues

### Critical (player sees wrong number at L0)

| Mechanic | Described | Actual | Delta |
|---|---|---|---|
| `fortify` | "Gain 7 Block" | Scales with current block (0 at start) | Completely wrong |
| `warcry` | "+1 Str CC" | +2 Str CC (hardcoded) | Off by 2× |
| `gambit` | "heal 3 HP CC" | heal 5 HP CC (hardcoded) | Off by 66% |
| `smite` | "10 dmg QP" | 7 dmg QP (stat table) | Off by 30% |
| `feedback_loop` | "CC: +16 Flow" | CC: +12 Flow (Pass 8 stale) | Stale post-nerf |
| `precision_strike` | "8 dmg QP" | 5 dmg QP (stat table) | Off by 37% |
| `chameleon` | "100% QP copy" | 70% QP copy (stat table) | Off by 30% |

### Critical (resolver ignores stat-table progression — mastery milestones silently broken)

| Mechanic | What's broken |
|---|---|
| `execute` | Execute bonus and HP threshold don't scale with mastery levels |
| `hex` | Poison stacks and duration don't scale with mastery |
| `kindle` | Burn stacks don't scale with mastery from stat table |
| `lacerate` | Bleed stacks don't scale with mastery from stat table |
| `gambit` | All HP values are hardcoded, mastery progression is broken |
| `warcry` | Strength value hardcoded at 2 (CC/QP) and 1 (CW), ignores stat table str field |
| `hemorrhage` | Uses deprecated getMasteryBaseBonus; bleedMult hardcoded not from stat table |
