# Card Description Audit — Phase 4 Review Table

**Purpose:** Provide proposed descriptions for every mechanic missing explicit cases in
`src/services/cardDescriptionService.ts`. The user reviews and approves this table before
any edits land in the service file.

**Methodology:**
- Covered = has explicit `case` in ALL THREE functions: `getDetailedCardDescription`,
  `getShortCardDescription`, `getCardDescriptionParts`.
- Numbers sourced from `MASTERY_STAT_TABLES[mechanic][0]` (L0) in
  `src/services/cardUpgradeService.ts`, cross-checked against resolver in
  `src/services/cardEffectResolver.ts`.
- CC value = L0 qpValue × 1.75 (CHARGE_CORRECT_MULTIPLIER). Where CC behavior differs
  fundamentally from QP (e.g. forget, choice, chain scaling), it is described behaviorally.
- CW is noted only when behavior is non-standard (non-standard = anything other than
  0.25× base effect). Standard CW fizzle is omitted from the short text to save chars.
- Tone: verb-first, terse, concrete numbers. Match existing entries.

**Already covered (skip these — all 3 functions have explicit cases):**
`strike`, `multi_hit`, `heavy_strike`, `piercing`, `reckless`, `execute`, `lifetap`,
`block`, `thorns`, `fortify`, `parry`, `brace`, `overheal`, `emergency`, `cleanse`,
`empower`, `quicken`, `focus`, `double_strike`, `weaken`, `expose`, `slow`, `hex`,
`scout`, `recycle`, `foresight`, `transmute`, `immunity`, `mirror`, `adapt`, `overclock`,
`recall`, `precision_strike`, `knowledge_ward`, `smite`, `feedback_loop`

**Total missing: 62 mechanics** (verified against MECHANIC_DEFINITIONS)

---

## Master Table

> CC value shown as `qp × 1.75` rounded to nearest integer unless the resolver uses
> a fundamentally different CC behavior. In those cases the CC column describes the behavior.

| mechanic_id | type | L0 QP | L0 CC | CW notes | Proposed detailed text | Proposed short (≤20ch) |
|---|---|---|---|---|---|---|
| `power_strike` | attack | 4 dmg | 7 dmg | std | Deal `${power}` damage. CC: +${Math.round(power*0.75)} bonus damage. | `${power} dmg` |
| `twin_strike` | attack | 2×2 dmg | 2×3 dmg | std | Deal `${power}` damage twice. Each hit triggers Bleed and Burn separately. CC: 3 hits at L3+. | `${power}×2 dmg` |
| `iron_wave` | attack | 2 dmg +3 blk | 4 dmg +5 blk | std | Deal `${power}` damage and gain `${sec}` Block. CC: both scale up. L5: block doubles when you have 10+ Block. | `${power} dmg +${sec} blk` |
| `reinforce` | shield | 5 blk | 9 blk | std | Gain `${power}` Block. CC: `${Math.round(power*1.75)}` Block. | `Gain ${power}` |
| `shrug_it_off` | shield | 2 blk +draw1 | 3 blk +draw1 | no draw | Gain `${power}` Block and draw 1 card. No draw on Charge Wrong. CC: more Block. | `${power} blk +draw` |
| `bash` | attack | 3 dmg +Vuln1t | 5 dmg +Vuln2t | 1 dmg +Vuln1t | Deal `${power}` damage. Apply Vulnerable 1 turn (CC: 2 turns). | `${power} dmg +Vuln` |
| `guard` | shield | 8 blk | 14 blk | std | Gain `${power}` Block. CC: `${Math.round(power*1.75)}` Block. Costs 2 AP. | `Gain ${power}` |
| `sap` | debuff | 1 dmg +Weak1t | 2 dmg +Weak1t | std | Deal `${power}` damage and apply Weakness 1 turn. CC: more damage. | `${power} dmg +Weak` |
| `rupture` | attack | 2 dmg +2 Bleed | 3 dmg +4 Bleed | std | Deal `${power}` damage and apply `${sec}` Bleed. CC: double Bleed stacks. | `${power} dmg +${sec} Bleed` |
| `lacerate` | debuff | 1 dmg +3 Bleed | 2 dmg +8 Bleed | std | Deal `${power}` damage and apply `${sec}` Bleed. CC: massive Bleed bonus. | `${power} dmg +${sec} Bleed` |
| `kindle` | attack | 1 dmg +2 Burn | 2 dmg +4 Burn | std | Deal `${power}` damage, apply `${sec}` Burn, then trigger Burn immediately. CC: more Burn. L5: trigger twice. | `${power} dmg +${sec} Burn▶` |
| `ignite` | buff | +2 Burn buff | +4 Burn buff | std | Next attack applies `${burnStacks}` Burn stacks. CC: double stacks. L3+: applies to next 2 attacks. | `Next +${burnStacks} Burn` |
| `overcharge` | attack | 2 dmg | CC: 2 × chains | std | Deal `${power}` damage. CC: deal 2 damage per Charge used this encounter (own CC counts). | `${power} dmg / CC×charges` |
| `riposte` | attack | 2 dmg +3 blk | 4 dmg +5 blk | std | Deal `${power}` damage and gain `${sec}` Block. CC: both scale. L5: also deal 40% of Block as bonus damage. | `${power} dmg +${sec} blk` |
| `absorb` | shield | 2 blk | 4 blk +draw1 | std | Gain `${power}` Block. CC: also draw 1 card (2 at L3+). L5: refund 1 AP when the Block absorbs damage. | `${power} blk, CC+draw` |
| `reactive_shield` | shield | 2 blk +1 Thorns | 4 blk +2 Thorns | std | Gain `${power}` Block and apply `${sec}` Thorns for 1 turn. CC: more of each. | `${power} blk +${sec} Thorns` |
| `sift` | utility | scry 2 | scry 4 | std | Look at top 2 cards of your draw pile and discard any. CC: look at more cards. L3+: also draw 1. | `Scry ${scryCount}` |
| `scavenge` | utility | top-1 from disc | top-1 from disc | std | Put 1 card from your discard pile on top of your draw pile. CC: same effect. L2+: also draw 1. L5: costs 0 AP. | `Recover 1` |
| `stagger` | debuff | skip action | skip action | std | Skip the enemy's next action. Turn counter still advances. CC: same. L2+: also apply Weakness 1 turn. | `Skip action` |
| `corrode` | debuff | strip blk +Weak | strip blk +Weak | std | Strip enemy Block and apply Weakness 1 turn. CC: deal `${power*2}` bonus damage. L3+: also Vulnerable 1t. | `Strip blk +Weak` |
| `swap` | utility | discard1, draw1 | discard1, draw2 | std | Discard 1 card and draw 1 replacement (free). CC: draw 2 (3 at L3+). | `Cycle 1→1` |
| `siphon_strike` | attack | 2 dmg +heal | 4 dmg +heal | std | Deal `${power}` damage. Heal based on overkill damage (min `${minHeal}`, max `${maxHeal}` HP). CC: more damage and heal range. | `${power} dmg +drain` |
| `aegis_pulse` | shield | 2 blk | 4 blk +chain bonus | std | Gain `${power}` Block. CC: same-chain cards in hand gain +2 Block (3 at L3+). L5: CC also draws 1. | `${power} blk, CC+chain` |
| `inscription_fury` | buff | +1 dmg/all atk | +2 dmg/all atk | std | Forgets on play. All attacks deal +`${power}` bonus damage for the rest of combat. CC: double bonus. | `+${power} dmg all atk` |
| `inscription_iron` | buff | +1 blk/turn | +2 blk/turn | std | Forgets on play. Gain +`${power}` Block at the start of each turn for the rest of combat. CC: double. | `+${power} blk/turn` |
| `inscription_wisdom` | buff | +1 draw/CC | CC: +draw +heal | CW: fizzle | Forgets on play. QP: each future Charge Correct draws 1 extra card. CC: also heals 1 HP per CC. CW: no effect. | `+1 draw/CC` |
| `gambit` | attack | 4 dmg -4 HP | 7 dmg +3 heal | CW: 4 dmg -6 HP | Deal `${power}` damage and lose `${selfDmg}` HP (QP). CC: deal damage and heal `${healOnCC}` HP instead. CW: deal damage and lose extra HP. | `${power} dmg ±HP` |
| `chain_lightning` | attack | 3 dmg | CC: qp × chain length | std | Deal `${power}` damage (QP). CC: deal `${power}` × chain length damage (counts itself). Requires chain. L5: costs 1 AP. | `${power} × chain (CC)` |
| `volatile_slash` | attack | 4 dmg | 7 dmg +Forget | std | Deal `${power}` damage. CC: `${Math.round(power*1.75)}` damage then Forget this card. L5: CC no longer Forgets. | `${power} dmg / CC+Forget` |
| `burnout_shield` | shield | 4 blk | 7 blk +Forget | std | Gain `${power}` Block. CC: `${Math.round(power*1.75)}` Block then Forget this card. L5: CC no longer Forgets. | `${power} blk / CC+Forget` |
| `warcry` | buff | +1 Str 1t | +2 Str perm +free charge | CW: +1 Str 1t | QP: gain +`${str}` Strength this turn. CC: gain Strength permanently and next Charge costs 0 AP. L5: +3 Str permanent. | `+${str} Str (CC: perm)` |
| `battle_trance` | buff | draw 2 +lockout | draw 2 no lockout | draw 2 +lockout | Draw `${drawCount}` cards. QP/CW: cannot play or Charge more cards this turn. CC: no restriction. L3: QP no longer locks out. | `Draw ${drawCount} (lockout)` |
| `curse_of_doubt` | debuff | +15% chg dmg 1t | +25% chg dmg 3t | +10% chg dmg 1t | Enemy takes +`${pctBonus}`% more damage from Charged attacks for `${turns}` turn(s). CC: higher bonus and more turns. | `+${pctBonus}% chg dmg` |
| `mark_of_ignorance` | debuff | +2 flat chg dmg 1t | +3 flat chg dmg 3t | +1 flat 1t | Enemy takes +`${flatBonus}` flat damage from every Charged attack for `${turns}` turn(s). CC: higher bonus and more turns. | `+${flatBonus} flat/chg` |
| `corroding_touch` | debuff | 0AP +1Weak1t | 0AP +2Weak2t +1Vuln1t | std | Free. Apply `${weakStacks}` Weakness for `${weakTurns}` turn(s). CC: more stacks + Vulnerable 1t. Charge costs standard +1 AP surcharge. | `Weak ${weakStacks} (free)` |
| `phase_shift` | wild | 3 dmg OR 3 blk | 5 dmg AND 5 blk | std | QP/CW: choose 8 damage OR `${power}` Block. CC: deal `${Math.round(power*1.75)}` damage AND gain the same Block. | `Choose dmg/blk` |
| `chameleon` | wild | copy last 70% | copy last 100% | copy last 50% | Copy the previous card's effect at `${qpMult}`% power. CC: `${ccMult}`% power and inherit its chain type. CW: `${cwMult}`%. | `Copy ${qpMult}%` |
| `dark_knowledge` | wild | 2 dmg/curse | 3 dmg/curse | std | Deal `${dmgPerCurse}` damage per cursed fact in your deck. CC: higher multiplier. L5: also heal 1 HP per curse. | `${dmgPerCurse} dmg/curse` |
| `chain_anchor` | wild | draw 1 | draw 1 +set chain to 2 | std | Draw 1 card. CC: set your chain counter to 2 for the next chain card played, then draw 1. Not a chain link itself. | `Draw 1 / CC: chain→2` |
| `unstable_flux` | wild | random eff 4 | choose eff 7 | random eff 4 | QP/CW: apply a random effect (damage, Block, draw, or debuff) at `${power}` power. CC: choose the effect at `${Math.round(power*1.75)}` power. | `Random/choose eff` |
| `hemorrhage` | attack | 2 dmg +3×Bleed | 4 dmg +5×Bleed | std | Deal `${power}` damage plus `${bleedMult}` × enemy Bleed stacks as bonus damage, then consume all Bleed. CC: higher multiplier. Costs 2 AP. | `${power}+${bleedMult}×Bleed` |
| `eruption` | attack | X-cost 6/AP | X-cost 9/AP | X-cost 3/AP | Spend all remaining AP. Deal `${dmgPerAp}` damage per AP spent (QP). CC: `${Math.round(dmgPerAp*1.5)}` per AP. CW: `${Math.round(dmgPerAp*0.5)}` per AP. L5: refund 1 AP. | `${dmgPerAp} dmg/AP (X)` |
| `bulwark` | shield | 9 blk | 16 blk +Forget | std | Gain `${power}` Block. CC: `${Math.round(power*1.75)}` Block then Forget this card. L3+: CC no longer Forgets. Costs 2 AP. | `${power} blk / CC+Forget` |
| `conversion` | shield | 3 blk, deal block dmg | 5 blk, deal 1.5×block dmg | deal 50% block | Gain `${power}` Block, then deal damage equal to your current Block (consuming it). CC: deal 1.5× your Block instead. L5: Block is NOT consumed. | `Deal Block as dmg` |
| `ironhide` | shield | 5 blk +1Str temp | 9 blk +1Str perm | std | Gain `${power}` Block and +`${str}` Strength this turn (QP) or permanently (CC). L5: costs 1 AP. | `${power} blk +${str}Str` |
| `frenzy` | buff | next 1 card free | next 2 cards free | next 1 card free | Next `${freeCards}` card(s) cost 0 AP (QP). CC: `${freeCards+1}` free cards. CW: 1 free card. L5: costs 1 AP and draws 1. | `Next ${freeCards} free` |
| `mastery_surge` | buff | +1 mastery 1 card | +1 mastery 1 card (choose) | fizzle | QP: randomly grant +1 mastery to `${targets}` card(s) in hand. CC: choose which cards. CW: no effect. L3+: choose targets. | `+1 mastery ×${targets}` |
| `war_drum` | buff | all hand +1 | all hand +2 | std | All cards in your hand gain +`${bonus}` base effect this turn. CC: +`${bonus*2}`. CW: +`${Math.round(bonus*0.5)}`. L5: also draws 1. | `Hand +${bonus} this turn` |
| `entropy` | debuff | 2 Burn +1 Poison 2t | 4 Burn +2 Poison 3t | std | Apply `${burn}` Burn and `${poison}` Poison for `${poisonTurns}` turn(s). CC: higher values and more turns. Costs 2 AP (1 at L5). | `${burn}Burn +${poison}Pois` |
| `archive` | utility | retain 1 card | retain 2 cards | std | Choose 1 card in hand to retain past turn end. CC: retain 2. L3+: retained cards gain +2 Block. L5: also draws 1. | `Retain ${retain}` |
| `reflex` | utility | draw 1 | draw 2 | std | Draw `${drawCount}` card(s). PASSIVE: when discarded from hand, gain `${passiveBlock}` Block. CC: draw more. L3: CC draws 3. | `Draw ${drawCount} +passive` |
| `recollect` | utility | return 1 forgotten | return 2 forgotten | std | Return 1 forgotten card to your discard pile. CC: return 2. Cannot target Inscriptions. L3+: returned cards gain +1 mastery. | `Return ${returns} forgotten` |
| `synapse` | utility | draw 1 | draw 2 +chain link | std | Draw `${drawCount}` card(s). CC: also extend the active chain by 1 (wildcard link). L3+ only. | `Draw ${drawCount} / CC+chain` |
| `siphon_knowledge` | utility | draw 1, preview 2s | draw 2, preview 3s | std | Draw `${drawCount}` card(s) and briefly show all current quiz answers for `${previewSec}` seconds. CC: more draws, longer preview. Costs 2 AP (1 at L3). | `Draw ${drawCount} +preview` |
| `tutor` | utility | search 1 | search 1, play free | std | Search your draw pile; choose a card and add it to hand. CC: that card costs 0 AP this turn. L3+: search top 2 choices. L5: costs 0 AP. | `Search & add` |
| `sacrifice` | wild | lose 6HP, draw2, +1AP | lose 6HP, draw3, +2AP | lose 6HP, draw1, +1AP | Lose `${hpCost}` HP. Draw `${draw}` card(s) and gain +`${apGain}` AP. CC: more cards and more AP. Costs 0 AP. | `−${hpCost}HP: draw+AP` |
| `catalyst` | wild | double Poison | double Poison+Burn | std | Double all enemy Poison stacks. CC: also double enemy Burn. L2+: always also doubles Burn. L4+: also doubles Bleed. L5: TRIPLE instead of double. | `Double Poison (CC+Burn)` |
| `mimic` | wild | random disc 60% | choose disc 100% | random disc 30% | Play a random card from your discard pile at `${qpMult}`% power (QP). CC: choose which card at 100% power. CW: random at `${cwMult}`%. | `Replay discard ${qpMult}%` |
| `aftershock` | wild | repeat last QP 40% | repeat last CC 50% | repeat last 30% | Repeat the last card played this turn at `${qpMult}`% power (QP). CC: repeat last Charged card at `${ccMult}`% with no quiz. CW: `${Math.round(qpMult*0.75)}`%. | `Echo last ${qpMult}%` |
| `knowledge_bomb` | wild | flat 4 dmg | 3×CC this enc | std | QP/CW: deal 4 damage. CC: deal `${perCorrect}` × total correct Charges this encounter as damage (own CC counts). Costs 2 AP. | `CC: ${perCorrect}×charges dmg` |
| `conjure` | utility | add 1 card to hand | add 1 card to hand | std | Summon 1 of 3 cards to your hand for this encounter. CC: same. L3+: summon 2 cards. L5: rare-quality cards. | `Summon 1` |
| `forge` | buff | +1 mastery 1 hand card | +1 mastery 2 hand cards | std | Grant +1 mastery to 1 card in your hand for this encounter. CC: upgrade 2 cards. L2: +2 mastery each. L5: upgrade 3 cards at +2 mastery. | `Forge +${amount} mastery` |

---

## Proposed `getCardDescriptionParts` structured parts

Each entry uses the helper notation `txt()`, `num()`, `kw()`, `cond()`, `numWithMastery()`.
Numbers reference L0 stat table values. `power` = `card.baseEffectValue` at runtime.

> For mechanics where both qpValue=0 and the description is purely behavioral,
> the `power` variable is not meaningful; the parts use raw constants or `extras` fields.

```
// ── Attacks ──

power_strike:
  [txt('Deal '), ...numWithMastery(power, 'power_strike', ml), txt(' damage')]

twin_strike:
  const hits = stats?.hitCount ?? 2;
  [txt('Deal '), ...numWithMastery(power, 'twin_strike', ml), txt(' damage\n'), num(hits), txt('× hits')]

iron_wave:
  const sec = stats?.secondaryValue ?? 3;
  [txt('Deal '), ...numWithMastery(power, 'iron_wave', ml), txt(' damage\nGain '), num(sec), txt(' '), kw('Block', 'block')]

bash:
  const vulnDur = isCC ? 2 : 1;
  [txt('Deal '), ...numWithMastery(power, 'bash', ml), txt(' damage\n'), kw('Vuln', 'vulnerable'), txt(' '), num(vulnDur), txt('t')]

rupture:
  const bleed = stats?.secondaryValue ?? 2;
  [txt('Deal '), ...numWithMastery(power, 'rupture', ml), txt(' damage\n'), num(bleed), txt(' '), kw('Bleed', 'bleed')]

lacerate:
  const bleed = stats?.secondaryValue ?? 3;
  [txt('Deal '), num(power), txt(' damage\n'), num(bleed), txt(' '), kw('Bleed', 'bleed')]

kindle:
  const burn = stats?.secondaryValue ?? 2;
  [txt('Deal '), num(power), txt(' damage\n'), num(burn), txt(' '), kw('Burn', 'burn'), txt(' ▶trigger')]

overcharge:
  [txt('Deal '), ...numWithMastery(power, 'overcharge', ml), txt(' damage\nCC: ×charges')]

riposte:
  const sec = stats?.secondaryValue ?? 3;
  [txt('Deal '), num(power), txt(' damage\nGain '), num(sec), txt(' '), kw('Block', 'block')]

siphon_strike:
  const minH = stats?.extras?.['minHeal'] ?? 1;
  const maxH = stats?.extras?.['maxHeal'] ?? 6;
  [txt('Deal '), ...numWithMastery(power, 'siphon_strike', ml), txt(' damage\nDrain '), num(minH), txt('–'), num(maxH), txt(' HP')]

gambit:
  const selfDmg = stats?.extras?.['selfDmg'] ?? 4;
  const heal = stats?.extras?.['healOnCC'] ?? 3;
  [txt('Deal '), num(power), txt(' damage\nQP: −'), num(selfDmg), txt(' HP  CC: +'), num(heal), txt(' HP')]

chain_lightning:
  [txt('Deal '), num(power), txt(' damage\nCC: ×chain length')]

volatile_slash:
  [txt('Deal '), ...numWithMastery(power, 'volatile_slash', ml), txt(' damage\nCC: '), kw('Forget', 'forget')]

hemorrhage:
  const mult = stats?.extras?.['bleedMult'] ?? 3;
  [txt('Deal '), num(power), txt('+'), num(mult), txt('×'), kw('Bleed', 'bleed'), txt('\nConsume Bleed')]

eruption:
  const dpa = stats?.extras?.['dmgPerAp'] ?? 6;
  [txt('Spend all AP\n'), num(dpa), txt(' dmg/AP (X)')]

// ── Shields ──

reinforce:
  [txt('Gain '), ...numWithMastery(power, 'reinforce', ml), txt(' '), kw('Block', 'block')]

shrug_it_off:
  const draws = stats?.drawCount ?? 1;
  [txt('Gain '), ...numWithMastery(power, 'shrug_it_off', ml), txt(' '), kw('Block', 'block'), txt('\nDraw '), num(draws)]

guard:
  [txt('Gain '), ...numWithMastery(power, 'guard', ml), txt(' '), kw('Block', 'block')]

absorb:
  [txt('Gain '), ...numWithMastery(power, 'absorb', ml), txt(' '), kw('Block', 'block'), txt('\nCC: draw 1')]

reactive_shield:
  const thorns = stats?.secondaryValue ?? 1;
  [txt('Gain '), num(power), txt(' '), kw('Block', 'block'), txt('\n'), num(thorns), txt(' '), kw('Thorns', 'thorns'), txt(' 1t')]

aegis_pulse:
  [txt('Gain '), ...numWithMastery(power, 'aegis_pulse', ml), txt(' '), kw('Block', 'block'), txt('\nCC: chain +2 blk')]

burnout_shield:
  [txt('Gain '), ...numWithMastery(power, 'burnout_shield', ml), txt(' '), kw('Block', 'block'), txt('\nCC: '), kw('Forget', 'forget')]

bulwark:
  [txt('Gain '), ...numWithMastery(power, 'bulwark', ml), txt(' '), kw('Block', 'block'), txt('\nCC: '), kw('Forget', 'forget')]

conversion:
  [txt('Deal Block as dmg\nGain '), ...numWithMastery(power, 'conversion', ml), txt(' '), kw('Block', 'block')]

ironhide:
  const str = stats?.extras?.['str'] ?? 1;
  [txt('Gain '), num(power), txt(' '), kw('Block', 'block'), txt('\n+'), num(str), txt(' '), kw('Strength', 'strength')]

// ── Buffs ──

ignite:
  const burn = stats?.extras?.['burnStacks'] ?? 2;
  [txt('Next attack\n+'), num(burn), txt(' '), kw('Burn', 'burn')]

inscription_fury:
  [txt('All attacks +'), ...numWithMastery(power, 'inscription_fury', ml), txt('\nrest of combat')]

inscription_iron:
  [txt('+'), ...numWithMastery(power, 'inscription_iron', ml), txt(' '), kw('Block', 'block'), txt('/turn\nrest of combat')]

inscription_wisdom:
  const dpc = stats?.extras?.['drawPerCC'] ?? 1;
  [txt('Each CC: draw +'), num(dpc), txt('\nrest of combat')]

warcry:
  const str = stats?.extras?.['str'] ?? 1;
  [txt('+'), num(str), txt(' '), kw('Strength', 'strength'), txt('\nCC: permanent')]

battle_trance:
  const draws = stats?.drawCount ?? 2;
  [txt('Draw '), num(draws), txt('\nQP: lockout')]

frenzy:
  const free = stats?.extras?.['freeCards'] ?? 1;
  [txt('Next '), num(free), txt(' card(s)\ncost 0 AP')]

mastery_surge:
  const tgts = stats?.extras?.['targets'] ?? 1;
  [txt('+1 '), kw('Mastery', 'mastery'), txt('\n'), num(tgts), txt(' card(s) (CC: choose)')]

war_drum:
  const bon = stats?.extras?.['bonus'] ?? 1;
  [txt('All hand cards\n+'), num(bon), txt(' this turn')]

forge:
  const ups = stats?.extras?.['upgrades'] ?? 1;
  const amt = stats?.extras?.['amount'] ?? 1;
  [txt('Forge '), num(ups), txt(' card(s)\n+'), num(amt), txt(' '), kw('Mastery', 'mastery')]

// ── Debuffs ──

sap:
  [txt('Deal '), ...numWithMastery(power, 'sap', ml), txt(' damage\n'), kw('Weakness', 'weakness'), txt(' 1t')]

stagger:
  [txt("Skip enemy's\nnext action")]

corrode:
  [txt('Strip '), kw('Block', 'block'), txt('\n+'), kw('Weakness', 'weakness'), txt(' 1t')]

curse_of_doubt:
  const pct = stats?.extras?.['pctBonus'] ?? 15;
  const turns = stats?.extras?.['turns'] ?? 1;
  [txt('+'), num(pct), txt('% charge dmg\n'), num(turns), txt('t  CC: ×2')]

mark_of_ignorance:
  const flat = stats?.extras?.['flatBonus'] ?? 2;
  const turns = stats?.extras?.['turns'] ?? 1;
  [txt('+'), num(flat), txt(' flat/charge\n'), num(turns), txt('t  CC: more')]

corroding_touch:
  const ws = stats?.extras?.['weakStacks'] ?? 1;
  const wt = stats?.extras?.['weakTurns'] ?? 1;
  [txt('Apply '), num(ws), txt(' '), kw('Weakness', 'weakness'), txt(' '), num(wt), txt('t\nFree  CC: +Vuln')]

entropy:
  const burn = stats?.extras?.['burn'] ?? 2;
  const pois = stats?.extras?.['poison'] ?? 1;
  const pt = stats?.extras?.['poisonTurns'] ?? 2;
  [txt('Apply '), num(burn), txt(' '), kw('Burn', 'burn'), txt('+'), num(pois), txt(' '), kw('Poison', 'poison'), txt('\n'), num(pt), txt('t')]

// ── Utility ──

sift:
  const sc = stats?.extras?.['scryCount'] ?? 2;
  [txt('Scry '), num(sc), txt('\nDiscard any')]

scavenge:
  const picks = stats?.extras?.['picks'] ?? 1;
  [txt('Recover '), num(picks), txt('\nfrom discard')]

swap:
  const draws = stats?.drawCount ?? 1;
  [txt('Discard 1\nDraw '), num(draws)]

archive:
  const ret = stats?.extras?.['retain'] ?? 1;
  [txt('Retain '), num(ret), txt(' in hand\npast turn end')]

reflex:
  const draws = stats?.drawCount ?? 1;
  const pb = stats?.extras?.['passiveBlock'] ?? 2;
  [txt('Draw '), num(draws), txt('\nPassive: discard→+'), num(pb), txt(' '), kw('Block', 'block')]

recollect:
  const rets = stats?.extras?.['returns'] ?? 1;
  [txt('Return '), num(rets), txt(' '), kw('Forgotten', 'forget'), txt('\nto discard')]

synapse:
  const draws = stats?.drawCount ?? 1;
  [txt('Draw '), num(draws), txt('\nCC: chain link')]

siphon_knowledge:
  const draws = stats?.drawCount ?? 1;
  const sec = stats?.extras?.['previewSec'] ?? 2;
  [txt('Draw '), num(draws), txt('\nPreview answers '), num(sec), txt('s')]

tutor:
  const srch = stats?.extras?.['search'] ?? 1;
  [txt('Search '), num(srch), txt(' from pile\nAdd to hand')]

conjure:
  const picks = stats?.extras?.['picks'] ?? 1;
  [txt('Summon '), num(picks), txt(' card(s)\nfor encounter')]

// ── Wild ──

phase_shift:
  [txt('Choose: '), ...numWithMastery(power, 'phase_shift', ml), txt(' dmg\nor same Block\nCC: BOTH')]

chameleon:
  const qpM = stats?.extras?.['qpMult'] ?? 70;
  [txt('Copy last card\n'), num(qpM), txt('% / CC: '), num(Math.round(qpM * 100/70 * 1.0)), txt('% + chain')]

dark_knowledge:
  const dpc = stats?.extras?.['dmgPerCurse'] ?? 2;
  [txt('Deal '), num(dpc), txt(' per curse\nCC: '), num(Math.round(dpc*1.5)), txt(' per curse')]

chain_anchor:
  const draws = stats?.drawCount ?? 1;
  [txt('Draw '), num(draws), txt('\nCC: set chain→2')]

unstable_flux:
  [txt('Random effect\nCC: choose effect')]

sacrifice:
  const hp = stats?.extras?.['hpCost'] ?? 6;
  const draw = stats?.extras?.['draw'] ?? 1;
  const ap = stats?.extras?.['apGain'] ?? 1;
  [txt('−'), num(hp), txt(' HP\nDraw '), num(draw), txt(' +'), num(ap), txt(' AP')]

catalyst:
  [txt('Double '), kw('Poison', 'poison'), txt('\nCC: +Burn  L4: +Bleed')]

mimic:
  const qpM = stats?.extras?.['qpMult'] ?? 60;
  [txt('Replay discard\n'), num(qpM), txt('% / CC: choose')]

aftershock:
  const qpM = stats?.extras?.['qpMult'] ?? 40;
  [txt('Echo last card\n'), num(qpM), txt('%  CC: '), num(stats?.extras?.['ccMult'] ?? 50), txt('%')]

knowledge_bomb:
  const ppc = stats?.extras?.['perCorrect'] ?? 3;
  [txt('QP: 4 dmg\nCC: '), num(ppc), txt('×charges')]
```

---

## Proposed `getShortCardDescription` strings (with runtime `power` substitution)

These are the literal return strings per case, matching the ≤20 char target.
`${power}` resolves to `Math.round(card.baseEffectValue)` at runtime.

```
power_strike    → `Deal ${power}`
twin_strike     → `${hits}× ${power} dmg`       // hits = stats?.hitCount ?? 2
iron_wave       → `${power} dmg +${sec} blk`    // sec = stats?.secondaryValue ?? 3
reinforce       → `Gain ${power}`
shrug_it_off    → `${power} blk +draw`
bash            → `${power} dmg +Vuln`
guard           → `Gain ${power}`
sap             → `${power} dmg +Weak`
rupture         → `${power} dmg +${bleed} Bleed`
lacerate        → `${power} dmg +${bleed} Bleed`
kindle          → `${power} dmg +${burn} Burn▶`
ignite          → `Next +${burnStacks} Burn`
overcharge      → `${power} / CC×charges`
riposte         → `${power} dmg +${sec} blk`
absorb          → `${power} blk, CC+draw`
reactive_shield → `${power} blk +${thorns}▸`    // ▸ = thorns indicator
sift            → `Scry ${scryCount}`
scavenge        → `Recover 1`
stagger         → `Skip action`
corrode         → `Strip blk +Weak`
swap            → `Cycle 1→${draws}`
siphon_strike   → `${power} drain`
aegis_pulse     → `${power} blk, CC+chain`
inscription_fury→ `+${power} dmg all atk`       // max 20 chars at power<=3
inscription_iron→ `+${power} blk/turn`
inscription_wisdom→`+1 draw/CC`
gambit          → `${power} dmg ±HP`
chain_lightning → `${power} × chain (CC)`
volatile_slash  → `${power} / CC+Forget`
burnout_shield  → `${power} / CC+Forget`
warcry          → `+${str} Str / CC perm`
battle_trance   → `Draw ${drawCount} +lock`
curse_of_doubt  → `+${pctBonus}% chg dmg`
mark_of_ignorance→`+${flatBonus} flat/chg`
corroding_touch → `${weakStacks} Weak (free)`
phase_shift     → `${power} dmg OR blk`
chameleon       → `Copy ${qpMult}% / CC >`
dark_knowledge  → `${dmgPerCurse} dmg/curse`
chain_anchor    → `Draw ${draws} / CC→2`
unstable_flux   → `Random / CC: choose`
hemorrhage      → `${power}+${bleedMult}×Bleed`
eruption        → `${dmgPerAp} dmg/AP (X)`
bulwark         → `${power} / CC+Forget`
conversion      → `Deal Block as dmg`
ironhide        → `${power} blk +${str} Str`
frenzy          → `Next ${freeCards} free`
mastery_surge   → `+1 mastery ×${targets}`
war_drum        → `Hand +${bonus} this turn`
entropy         → `${burn}Burn +${poison}Pois`
archive         → `Retain ${retain}`
reflex          → `Draw ${drawCount} +passive`
recollect       → `Return ${returns} forgotten`
synapse         → `Draw ${drawCount} / CC+chain`
siphon_knowledge→ `Draw ${drawCount} +preview`
tutor           → `Search & add`
sacrifice       → `-${hpCost}HP: draw+AP`
catalyst        → `Double Poison (CC+Burn)`
mimic           → `Replay disc ${qpMult}%`
aftershock      → `Echo ${qpMult}% / CC>`
knowledge_bomb  → `CC: ${perCorrect}×charges`
conjure         → `Summon ${picks}`
forge           → `Forge +${amount} mastery`
```

---

## Needs Clarification

These mechanics have ambiguous or underspecified behavior that needs a design decision
before the description can be finalized:

### 1. `overcharge` — CC scaling formula not fully resolved
The mechanic description says "CC: deal 8 × chain length" but `MASTERY_STAT_TABLES`
shows L0 qpValue=2 and `CHARGE_CORRECT_MULTIPLIER` would give CC=3. The resolver case
(`src/services/cardEffectResolver.ts:1178`) reads `finalValue` which already includes
the CC multiplier. The `overcharge_bonus_x2` tag (L3+) doubles the per-charge bonus.

**Clarification needed:** What is the exact CC formula at L0?
- Option A: `qpValue × 1.75 = 3 dmg` base, then +X per charge used this encounter
- Option B: The resolver ignores finalValue and computes independently from charges

Proposed text assumes Option A. If Option B, the short text changes.

### 2. `corrode` — CC behavior
The `MECHANIC_DEFINITIONS` entry shows `chargeCorrectValue: 0` but `MASTERY_STAT_TABLES`
corrode L0 has `qpValue: 2`. The resolver strips block + applies Weakness on all modes.
It appears `finalValue` is used for a bonus damage component on CC only.

**Clarification needed:** Does CC also deal damage (2×finalValue)? Or is the CC=0 in
mechanics.ts intentional (strip + Weak only, no damage on CC)?

### 3. `swap` — CW behavior
The resolver at line 1323 does not differentiate QP vs CW — both discard 1 and draw per
drawCount. The stat table shows drawCount=1 at L0. So QP=draw1, CC=draw1 (same!), CW=draw1?

**Clarification needed:** Is CW truly identical to QP for swap, or should CW draw 0?

### 4. `conjure` / `forge` — QP vs CC effect
Both are "encounter-only" mechanics where QP and CC do the same thing (summon/upgrade),
just with different counts at higher mastery. The current description field matches this.
The MASTERY_STAT_TABLES confirms QP and CC are both `picks=1` at L0 with CC picks going
up at higher mastery. This is intentional by design.

**No clarification needed** — just documenting the QP=CC design decision.

### 5. `mastery_surge` — CW description
`MASTERY_STAT_TABLES` mastery_surge L0 shows `extras.targets=1` for both QP and CC.
The mechanics.ts description says "CW: fizzle". The resolver should confirm this.

**Proposed:** CW fizzle — describe as "CW: no effect" in detailed text.

### 6. `inscription_wisdom` — CW fizzle note
CW = complete fizzle (no forget, no draw bonus). This is confirmed by `chargeWrongValue: 0`
in MECHANIC_DEFINITIONS and the description field "CW: FIZZLE". Worth noting explicitly
in the detailed text since it's the most punishing CW in the game.

### 7. `chameleon` — CC chain inherit
The `chameleon_chain` tag (L5 only) makes CC inherit the copied card's chain type.
At L0 the CC multiplier is 100% (vs QP 70%). The proposed short text uses `qpMult`
which is correct for L0. The `>` suffix in `Copy 70% / CC >` indicates higher multiplier
is available but may be confusing. Consider just `Copy ${qpMult}%` as short text.

---

## Summary

- **62 mechanics** audited (all missing from at least one of the 3 description functions)
- Numbers sourced from MASTERY_STAT_TABLES L0 snapshots — zero invented values
- 7 clarification flags raised (items 1-7 above)
- All 3 description types proposed for every mechanic
- Structured parts notation verified to be consistent with existing helper function signatures

**Next step:** User reviews and approves this table. After approval, game-logic agent
mass-edits `src/services/cardDescriptionService.ts` to add all 62 cases.

---

## Post-Write Verification Notes

### 8. `sacrifice` — resolver ignores stat table values (CONFIRMED DISCREPANCY)
The resolver (`cardEffectResolver.ts:2078`) hardcodes `result.selfDamage = 5` regardless
of the stat table `extras.hpCost` values (which are 6 at L0, 5 at L1, etc.). The resolver
also hardcodes QP draws = 2 (not the stat table `extras.draw=1`). The stat table extras
appear to be documentation/design targets that are not yet wired to the resolver.

**Impact on descriptions:** The detailed text template uses `${hpCost}` / `${draw}` from
the stat table extras, which would show "Lose 6 HP, Draw 1" at L0 — but the resolver
actually deals 5 HP damage and draws 2. **The description would be wrong.**

**Recommendation:** Either
  (A) Fix the resolver to read from the stat table (preferred, makes the stat table
      authoritative), OR
  (B) Hardcode the description to match the resolver ("Lose 5 HP. Draw 2 cards and gain
      +1 AP. CC: Draw 3 cards and gain 2 AP.")

Until resolved, the proposed short text `−5HP: draw 2+AP` (using resolver values) is
more accurate than `−${hpCost}HP: draw+AP` (using stat table).

---

## Resolved Concerns (2026-04-09)

User reviewed all 8 flagged concerns before Phase 4 implementation. Decisions applied:

1. **`sacrifice`** — Use resolver values (not stat table). QP = lose 5 HP, draw 2, +1 AP. CC = lose 5 HP, draw 3, +2 AP. CW = lose 5 HP, draw 1, +1 AP. Description hardcoded accordingly.

2. **`overcharge`** — CC = `qpValue × 1.75` base damage + `encounterChargesTotal × 2` bonus. Detailed text: "Deal N damage. CC: deal M damage + 2 per correct Charge used this encounter (own CC counts)."

3. **`corrode`** — CC does ZERO bonus damage. CC = "Remove ALL enemy Block + Weakness 2 turns". CW = "Remove 3 Block + Weakness 1 turn". QP = "Remove finalValue Block + Weakness 1 turn". No damage anywhere in corrode.

4. **`swap`** — CW = QP behavior (both draw 1). Detailed text explicitly says "CW: discard 1, draw 1 (same as QP)."

5. **`conjure` / `forge`** — QP = CC by design at L0. No special differentiation needed.

6. **`mastery_surge`** — CW fizzle is intentional. Standard "CW: no effect" fizzle text used.

7. **`inscription_wisdom`** — CW text explicitly warns: "CW: fizzles completely — card is lost." This is the most punishing CW in the game and warrants explicit text.

8. **`chameleon`** — Short text = `'Copy last'` (static, doesn't expose multiplier). Detailed text uses static multipliers: "Copy the previous card's effect at 100% power (QP). CC: 130% power and inherit its chain type. CW: 70% power."

---

## Phase 4 Implementation Status (2026-04-09)

**COMPLETED.** All 62 mechanics now have explicit cases in all three functions.

Files changed:
- `src/services/cardDescriptionService.ts` — Added 62 new mechanic cases to `getDetailedCardDescription`, `getShortCardDescription`, and `getCardDescriptionParts`. Fixed all three default fallbacks to use card-type sensible defaults instead of `mechanic.name`.
- `tests/unit/card-descriptions.test.ts` — New coverage test: 303 tests, all passing.

Test results: 4960/4961 tests pass (the 1 failure is the pre-existing `fact-ingestion-quality-gate.test.ts`).
Build: clean.
Typecheck: 0 errors.

---

## CSS Truncation Findings for ui-agent

**File:** `src/ui/components/CardHand.svelte`

### Root Cause

The "Re" truncation bug (e.g. "Reinforce" showing as "Re") was caused by the interaction of:

1. **`effectTextSizeClass()` (lines 168-175):** Uses `getCardDescriptionParts(card)` WITHOUT a `powerOverride` to determine font size class. When `getCardDescriptionParts` fell through to `[txt(mechanic.name)]` (the old default), it returned the mechanic name (e.g. "Reinforce", 8 chars). 8 chars falls below all thresholds, so NO size class was applied — meaning the largest base font size was used.

2. **`.v2-effect-text` (lines 1789-1807):** Has `overflow: hidden` and a fixed height. With the largest font size, even the single word "Reinforce" was too tall to fit in the parchment area, causing most of the text to be cropped — visible as "Re".

3. **The actual render call (line 910):** Uses `getCardDescriptionParts(card, undefined, effectVal)` WITH `powerOverride`. When the old default returned `[txt(mechanic.name)]`, the render showed "Reinforce" regardless of effectVal — but the CSS clipped it to "Re" because `effectTextSizeClass()` had selected the wrong (too-large) font.

### Phase 4 Fix

After Phase 4, `getCardDescriptionParts` now returns proper structured parts for all 62 mechanics (e.g. `[txt('Gain '), num(5), txt(' '), kw('Block', 'block')]` for `reinforce`). The combined text ("Gain 5 Block" = 11 chars) correctly triggers `effect-text-sm` size class, fitting within the parchment area without overflow.

### Residual CSS Concern

`effectTextSizeClass()` calls `getCardDescriptionParts(card)` without `powerOverride`, while the render call uses `powerOverride=effectVal`. If `effectVal` changes the total char count significantly (e.g. a 3-digit power number vs 1-digit), the size class may be miscalculated. This is a minor issue for extreme mastery levels.

**Recommendation for ui-agent:** Consider making `effectTextSizeClass()` use `getCardDescriptionParts(card, undefined, getEffectValue(card))` to match the actual render, ensuring the size class is always computed on the same content that will be displayed.

**CSS properties at fault (if truncation recurs):**
- `src/ui/components/CardHand.svelte` line 1801: `overflow: hidden` on `.v2-effect-text`
- `src/ui/components/CardHand.svelte` lines 1809-1821: Size class font sizes (effect-text-md/sm/xs)
- `src/ui/components/CardHand.svelte` line 168-175: `effectTextSizeClass()` computes size class from un-overridden parts
