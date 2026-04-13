<!--
  Purpose: Card functional correctness — damage/block/DoT formulas at all mastery levels for every card.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 11.1-11.6
-->

## SECTION 11 — CARD FUNCTIONAL CORRECTNESS

Legend: QP = Quick Play, CC = Charge Correct (QP × 1.50), CW = Charge Wrong (QP × 0.50 = FIZZLE_EFFECT_RATIO), L# = mastery level.

Chain multipliers from `CHAIN_MULTIPLIERS`: `[1.0, 1.2, 1.5, 2.0, 2.5, 3.5]` (indices 0–5).
CC formula: `floor(qpValue × 1.50 × chainMultiplier × strengthMod × vulnMult + flatBonuses)`.

### 11.1 Attack Cards — Functional Correctness

- [x] **strike L0 QP — deals 4 damage (qpValue=4)**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter', hand:['strike']})`, snapshot `CS = getCombatState()`, `quickPlayCard(0)`
  Check: `getCombatState().enemyHp` delta = 4

- [x] **strike L0 CC — deals 6 damage (floor(4 × 1.50) = 6)**
  Setup: same, `chargePlayCard(0, true)` after correct answer
  Check: enemyHp delta = 6

- [x] **strike L3 QP — deals 6 damage (qpValue=6)**
  Setup: card at masteryLevel=3, QP
  Check: enemyHp delta = 6

- [x] **strike L5 QP — deals 8 damage + strike_tempo3 tag activates when ≥3 cards played this turn**
  Setup: card at masteryLevel=5; play 2 other cards first, then QP strike
  Check: enemyHp delta = 8 baseline; with ≥3 prior cards, tempo bonus activates

- [x] **strike CW — deals 2 damage (floor(4 × 0.50) = 2)**
  Setup: `chargePlayCard(0, false)` (wrong answer)
  Check: enemyHp delta = 2

- [x] **multi_hit L0 QP — 2 hits × 2 = 4 total damage**
  Setup: L0 multi_hit (hitCount=2, qpValue=2), QP
  Check: enemyHp delta = 4

- [x] **multi_hit L0 CC — 2 hits × 3 = 6 total damage (floor(2 × 1.50) = 3 per hit)**
  Setup: same, CC
  Check: enemyHp delta = 6

- [x] **multi_hit L3 — applies multi_bleed1 tag (1 Bleed per hit)**
  Setup: L3 multi_hit (hitCount=3), CC
  Check: `getCombatState().enemyStatusEffects` contains bleed stacks ≥ 3

- [x] **multi_hit L5 — 4 hits × floor(3 × 1.50) = 4 × 4 = 16 CC damage + bleed**
  Setup: L5 (hitCount=4, qpValue=3), CC
  Check: enemyHp delta = 16; bleed applied (multi_bleed1)

- [x] **heavy_strike L0 QP — deals 7 damage**
  Setup: L0 heavy_strike (qpValue=7), QP
  Check: enemyHp delta = 7

- [x] **heavy_strike L0 CC — deals 10 damage (floor(7 × 1.50) = 10)**
  Setup: CC
  Check: enemyHp delta = 10

- [x] **heavy_strike L5 AP cost reduced to 1**
  Setup: L5 heavy_strike, check `getCombatState().hand[i].apCost`
  Check: apCost = 1 (down from 2)

- [x] **heavy_strike L5 CC — deals 18 damage (floor(12 × 1.50) = 18)**
  Setup: L5 (qpValue=12, apCost=1), CC
  Check: enemyHp delta = 18

- [x] **piercing L0 — damage ignores enemy block**
  Setup: `SC.patch({turn:{enemy:{block:10}}})`, L0 piercing (qpValue=3), QP
  Check: enemyHp delta = 3 (not reduced by block); enemyBlock unchanged or stripped by pierce logic

- [x] **piercing L3 — pierce_strip3 tag strips 3 enemy block**
  Setup: `SC.patch({turn:{enemy:{block:8}}})`, L3 piercing, QP
  Check: enemyBlock decreases by 3; enemyHp delta = 4

- [x] **piercing L5 — pierce_vuln1 applies Vuln 1 turn on CC**
  Setup: L5 piercing (qpValue=6), CC
  Check: `getCombatState().enemyStatusEffects` contains `{type:'vulnerable'}`

- [x] **reckless L0 QP — deals 4 damage, player takes 4 self-damage**
  Setup: L0 reckless (qpValue=4, selfDmg=4), QP
  Check: enemyHp delta = 4; playerHp decreases by 4

- [x] **reckless L5 — self-damage = 0 flat (reckless_selfdmg_scale3 instead)**
  Setup: L5 reckless (qpValue=10, selfDmg=0), QP with chain=0
  Check: playerHp unchanged (no flat self-damage at chain=0)

- [x] **execute L0 — base 2 dmg; bonus 8 dmg below 30% HP**
  Setup: `SC.patch({turn:{enemy:{currentHP:9, maxHP:30}}})` (30% HP), L0 execute, CC
  Check: enemyHp delta ≥ 10 (2 base + 8 execBonus, floor(2 × 1.50) + 8 = 11)

- [x] **execute L3 — threshold widens to 40% HP**
  Setup: enemy at 38% HP, L3 execute (execThreshold=0.4), CC
  Check: execBonus fires; enemyHp delta includes bonus

- [x] **execute L5 — threshold 50%, execBonus=12**
  Setup: enemy at 45% HP, L5 execute, CC
  Check: execBonus fires; delta = floor(5 × 1.50) + 12 = 19

- [x] **lifetap L0 QP — deals 5 damage, heals 20% of damage (1 HP)**
  Setup: L0 lifetap (qpValue=5), QP, playerHp=80
  Check: enemyHp delta = 5; playerHp +1

- [x] **lifetap L2 — lifetap_heal30 tag: heals 30% of damage**
  Setup: L2 lifetap (qpValue=5, tag: lifetap_heal30), CC
  Check: playerHp increases by floor(7 × 0.30) = 2

- [x] **lifetap L5 — apCost=1**
  Setup: L5 lifetap, check hand card apCost
  Check: apCost = 1

- [x] **power_strike L0 QP — deals 4 damage**
  Setup: L0 power_strike (qpValue=4), QP
  Check: enemyHp delta = 4

- [x] **power_strike L5 CC — applies vulnerable 2 turns + power_vuln75 tag**
  Setup: L5 (qpValue=8), CC
  Check: enemyHp delta = 12; `enemyStatusEffects` contains vulnerable with turnsRemaining=2

- [x] **twin_strike L0 QP — 2 hits × 2 = 4 total**
  Setup: L0 (qpValue=2, hitCount=2), QP
  Check: enemyHp delta = 4

- [x] **twin_strike L3 — 3 hits (third strike unlocked)**
  Setup: L3 (qpValue=3, hitCount=3), QP
  Check: enemyHp delta = 9

- [x] **twin_strike L5 CC — 3 hits + twin_burn2 (2 Burn per hit) + twin_burn_chain**
  Setup: L5 (qpValue=4, hitCount=3, tags: twin_burn2), CC
  Check: enemyHp delta = 18; `enemyStatusEffects` contains burn stacks ≥ 6 (2 per hit × 3 hits)

- [x] **iron_wave L0 QP — deals 3 damage AND grants 5 block**
  Setup: L0 iron_wave (qpValue=3, secondaryValue=5), QP
  Check: enemyHp delta = 3; playerBlock += 5

- [x] **iron_wave L5 — iron_wave_block_double doubles block**
  Setup: L5 (qpValue=5, secondaryValue=7, tags: iron_wave_block_double), CC
  Check: playerBlock increases by 7 × 2 = 14

- [x] **bash L0 — deals 4 damage + applies Vulnerable 1 turn**
  Setup: L0 bash (qpValue=4, apCost=2), CC
  Check: enemyHp delta = 6 (floor(4 × 1.5)); `enemyStatusEffects` contains vulnerable turnsRemaining=1

- [x] **bash L3 — bash_vuln2t: Vulnerable lasts 2 turns**
  Setup: L3 bash (qpValue=5, tags: bash_vuln2t), CC
  Check: `enemyStatusEffects.vulnerable.turnsRemaining` = 2

- [x] **bash L5 — bash_weak1t: also applies Weak 1 turn**
  Setup: L5 bash (qpValue=7, tags: bash_vuln2t + bash_weak1t), CC
  Check: enemyStatusEffects contains both vulnerable and weakness

- [x] **rupture L0 QP — 2 damage + 2 Bleed**
  Setup: L0 rupture (qpValue=2, secondaryValue=2), QP
  Check: enemyHp delta = 2; bleed stacks = 2

- [x] **rupture L5 — rupture_bleed_perm: Bleed doesn't decay**
  Setup: L5 rupture (qpValue=5, secondaryValue=5), CC; end turn
  Check: bleed stacks persist after turn (no decay)

- [x] **kindle L0 QP — 1 damage + 4 Burn stacks that trigger**
  Setup: L0 kindle (qpValue=1, secondaryValue=4), QP
  Check: enemyHp delta = 1 + burn trigger damage; burn icon appears

- [x] **kindle L5 — kindle_double_trigger fires Burn twice**
  Setup: L5 kindle (qpValue=4, secondaryValue=6, tags: kindle_double_trigger), CC
  Check: burn triggers 2× per play cycle

- [x] **overcharge L0 QP — base 2 damage**
  Setup: L0 overcharge (qpValue=2), QP
  Check: enemyHp delta = 2

- [x] **overcharge L3 — overcharge_bonus_x2: encounter charge scaling doubled**
  Setup: L3 (qpValue=4, tags: overcharge_bonus_x2), has 3 prior charges this encounter
  Check: bonus from encounter charges is 2× what it would be at L0

- [x] **riposte L0 QP — 2 damage + 4 block**
  Setup: L0 riposte (qpValue=2, secondaryValue=4), QP
  Check: enemyHp delta = 2; playerBlock += 4

- [x] **riposte L5 — riposte_block_dmg40: bonus damage = 40% of current block**
  Setup: `SC.patch({turn:{playerState:{shield:10}}})`, L5 riposte, CC
  Check: total damage includes floor(10 × 0.40) = 4 extra

- [x] **precision_strike L0 — deals 5 damage**
  Setup: L0 (qpValue=5), QP
  Check: enemyHp delta = 5

- [x] **precision_strike L3 — precision_timer_ext50: quiz timer +50%**
  Setup: L3 (qpValue=7), charge; observe quiz timer duration is extended
  Check: quiz timer bar visibly longer than baseline

- [x] **siphon_strike L0 QP — 3 damage + block gain**
  Setup: L0 siphon_strike, QP
  Check: enemyHp delta = 3; playerBlock increases

- [x] **gambit L0 QP — 4 damage + 4 self-damage**
  Setup: L0 gambit (qpValue=4, selfDmg=4), QP
  Check: enemyHp delta = 4; playerHp decreases by 4

- [x] **gambit L0 CC — deals 6 damage + heals 3 HP**
  Setup: L0 gambit (healOnCC=3), CC
  Check: enemyHp delta = 6; playerHp += 3

- [x] **gambit L5 CC — 15 damage + heals 8 HP (nearly free risk)**
  Setup: L5 gambit (qpValue=10, selfDmg=1, healOnCC=8), CC
  Check: enemyHp delta = 15; playerHp += 8

- [x] **chain_lightning L0 — base 4 damage (apCost=2)**
  Setup: L0 chain_lightning (qpValue=4, apCost=2), QP
  Check: enemyHp delta = 4

- [x] **chain_lightning CC — damage × chainLength**
  Setup: `SC.patch({turn:{chainLength:3}})`, L0 chain_lightning, CC
  Check: damage scales with chain length (3× base chain_lightning value)

- [x] **chain_lightning L3 — chain_lightning_min2: treats minimum chain as 2**
  Setup: L3, no active chain (chainLength=0), CC
  Check: damage treats chainLength as ≥ 2

- [x] **chain_lightning L5 — apCost=1**
  Setup: L5 (qpValue=6, apCost=1)
  Check: `getCombatState().hand[i].apCost` = 1

- [x] **volatile_slash L0 CC — fires + forgets card**
  Setup: L0 volatile_slash, CC
  Check: damage lands; card removed from deck (forgetPile increases)

- [x] **volatile_slash L5 CC — volatile_no_forget: no longer forgets**
  Setup: L5 (qpValue=12, tags: volatile_no_forget), CC
  Check: damage = 18; card stays in deck (forgetPile unchanged)

- [x] **smite L0 — deals 7 damage (apCost=2)**
  Setup: L0 smite (qpValue=7, apCost=2), QP
  Check: enemyHp delta = 7

- [x] **smite L3 — smite_aura_x2: Aura scaling doubled**
  Setup: enemy has status effects (Aura present), L3 smite, CC
  Check: damage bonus from Aura is 2× L0 equivalent

- [x] **smite L5 — apCost=1**
  Setup: L5 (qpValue=12, apCost=1)
  Check: apCost = 1

- [x] **feedback_loop L0 — deals 3 damage; CW = 0 + Aura crash**
  Setup: L0 feedback_loop, CW
  Check: damage = 0 (or minimal); Aura state resets

- [x] **feedback_loop L3 — feedback_crash_half: CW Aura crash halved**
  Setup: L3, CW
  Check: Aura loss on CW is 50% of L0

- [x] **recall L0 QP — deals 5 damage**
  Setup: L0 recall, QP
  Check: enemyHp delta = 5

- [x] **recall L3 — recall_heal3: heals 3 on review CC**
  Setup: L3, card in review queue, CC
  Check: playerHp += 3

- [x] **hemorrhage L0 — consumes all Bleed stacks (damage = bleedMult × stacks)**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[{type:'bleed',value:5,turnsRemaining:99}]}}})`, L0 hemorrhage (bleedMult=3), CC
  Check: damage = floor((4 + 5 × 3) × 1.5) = floor(29 × 1.5) = 43; bleed stacks cleared

- [x] **hemorrhage L5 — bleedMult=7, apCost=1**
  Setup: L5 hemorrhage (qpValue=6, apCost=1, bleedMult=7)
  Check: apCost = 1; damage with 5 bleed = floor((9 + 35) × 1.5) = 66

- [x] **eruption L0 — dmgPerAp=6, spends all AP**
  Setup: `SC.patch({turn:{apCurrent:3}})`, L0 eruption, QP
  Check: playerAp = 0 after play; enemyHp delta = 18 (6 × 3)

- [x] **eruption L5 — dmgPerAp=12, refunds 1 AP (eruption_refund1)**
  Setup: L5 eruption, 3 AP available, QP
  Check: playerAp = 1 after (refund); enemyHp delta = 36

- [x] **sap L0 — applies negative strength (strength debuff) to enemy**
  Setup: L0 sap, QP
  Check: `getCombatState().enemyStatusEffects` contains weakness or strength-reducing effect

- [x] **hemorrhage CW — deals qpValue × 0.50 damage, does NOT consume bleed**
  Setup: L0 hemorrhage, CW
  Check: bleed stacks unchanged; damage = floor(4 × 0.50) = 2

### 11.2 Shield Cards — Functional Correctness

- [x] **block L0 QP — grants 4 block**
  Setup: L0 block (qpValue=4), QP
  Check: `getCombatState().playerBlock` += 4

- [x] **block L0 CC — grants 6 block (floor(4 × 1.50) = 6)**
  Setup: CC
  Check: playerBlock += 6

- [x] **block L5 — block_consecutive3: bonus block when played 3+ consecutive times**
  Setup: L5 block, play block 3 turns in a row; check 3rd play
  Check: block gain on 3rd play is higher than baseline L5 (8)

- [x] **thorns L0 QP — grants 2 block + 3 reflect damage**
  Setup: L0 thorns (qpValue=2, secondaryValue=3), QP; enemy attacks player
  Check: playerBlock += 2; enemy takes 3 thorns damage when attacking

- [x] **thorns L5 — thorns_persist: thorns lasts entire encounter**
  Setup: L5 thorns, play it; end turn; verify thorns status persists next turn
  Check: thorns status badge still present next turn

- [x] **emergency L0 QP — grants 2 block; doubles to 4 if HP < 30%**
  Setup: `SC.loadCustom({..., playerHp:25, playerMaxHp:100})`, L0 emergency, QP
  Check: playerBlock += 4 (doubled because < 30% HP)

- [x] **emergency L3 — threshold widens to 40% HP**
  Setup: player at 38% HP, L3 emergency (emergThreshold=0.4), QP
  Check: double triggers; block doubled

- [x] **fortify L0 QP — grants 5 block**
  Setup: L0 fortify (qpValue=5, apCost=2), QP
  Check: playerBlock += 5

- [x] **fortify L5 — fortify_carry: block persists to next turn; apCost=1**
  Setup: L5 fortify, QP; end turn
  Check: playerBlock > 0 at start of next turn (persisted)

- [x] **brace L0 QP — grants 2 block**
  Setup: L0 brace, QP
  Check: playerBlock += 2

- [x] **brace L3 — brace_exceed2: block exceeds telegraph value by +2**
  Setup: L3 (qpValue=4, tags: brace_exceed2), enemy has attack telegraph
  Check: block = 4 + telegraphed_value + 2

- [x] **overheal L0 QP — grants 6 block (apCost=2)**
  Setup: L0 overheal (qpValue=6, apCost=2), QP
  Check: playerBlock += 6

- [x] **overheal L3 — overheal_heal2: also heals 2 HP; apCost=1**
  Setup: L3 overheal, playerHp=80, QP
  Check: playerBlock += 8; playerHp += 2; apCost = 1

- [x] **parry L0 — grants 1 block; draws 1 card when enemy attacks**
  Setup: L0 parry, QP; end turn; enemy attacks
  Check: hand size increases by 1 when enemy attacks after parry played

- [x] **parry L3 — draws 2 on enemy attack**
  Setup: L3 parry (secondaryValue=2), QP; enemy attacks
  Check: hand size increases by 2

- [x] **parry L5 — parry_counter3: deals 3 damage to attacker**
  Setup: L5 parry, QP; enemy attacks
  Check: enemyHp decreases by 3 when enemy attack lands

- [x] **reinforce L0 CC — block granted**
  Setup: L0 reinforce, CC
  Check: playerBlock increases

- [x] **shrug_it_off — block + cleanses one debuff from player**
  Setup: player has poison + weakness; play shrug_it_off
  Check: playerBlock increases; one status effect removed from player

- [x] **guard L0 QP — flat block granted**
  Setup: play guard, QP
  Check: playerBlock increases

- [x] **absorb L0 — block scales with enemy attack value**
  Setup: enemy with attack intent, play absorb
  Check: playerBlock = attack value + absorb base

- [x] **reactive_shield — block scales with enemy incoming damage**
  Setup: high-damage enemy intent, play reactive_shield
  Check: playerBlock proportional to enemy attack value

- [x] **aegis_pulse L0 — base block granted**
  Setup: play aegis_pulse
  Check: playerBlock increases

- [x] **burnout_shield L0 — grants block, applies Burn to player (burnout penalty)**
  Setup: L0 burnout_shield, play it
  Check: playerBlock increases; player statusEffects may contain burn penalty

- [x] **knowledge_ward L0 — block scales with chain length**
  Setup: `SC.patch({turn:{chainLength:3, chainMultiplier:2.0}})`, play knowledge_ward
  Check: playerBlock higher than baseline (chain bonus applied)

- [x] **bulwark L0 QP — large block granted**
  Setup: L0 bulwark, QP
  Check: playerBlock increases by bulwark base value

- [x] **bulwark CW — grants partial block (0.50× base)**
  Setup: bulwark, CW
  Check: playerBlock increased by floor(base × 0.50)

- [x] **conversion L0 — converts player block to damage**
  Setup: `SC.patch({turn:{playerState:{shield:8}}})`, play conversion
  Check: playerBlock = 0; enemyHp delta ≥ 8

- [x] **ironhide L0 — grants block + damage reduction status**
  Setup: play ironhide
  Check: playerBlock increases; ironhide status effect applied

### 11.3 Buff Cards — Functional Correctness

- [x] **empower L0 — grants Empower status (50% attack bonus)**
  Setup: L0 empower, QP; then play strike
  Check: strike damage increased by empower multiplier

- [x] **quicken L0 — grants 1 AP**
  Setup: L0 quicken (qpValue=1), QP
  Check: `getCombatState().ap` increases by 1

- [x] **focus L0 — grants Focus status (1 stack)**
  Setup: L0 focus, QP
  Check: `getCombatState().playerStatusEffects` contains focus with value=1

- [x] **double_strike L0 — grants Double Strike status (next attack hits twice)**
  Setup: L0 double_strike, QP; then play strike
  Check: strike triggers twice (2 hits); double_strike status consumed

- [x] **ignite L0 — next attack applies Burn**
  Setup: L0 ignite, QP; then play strike
  Check: enemy receives Burn status after strike

- [x] **inscription_fury L0 CC — Inscription of Fury buff active**
  Setup: play inscription_fury, CC
  Check: player status contains inscription_fury buff; subsequent attacks boosted

- [x] **inscription_iron L0 CC — Inscription of Iron buff active**
  Setup: play inscription_iron, CC
  Check: player status contains inscription_iron; subsequent shields boosted

- [x] **warcry L0 CC — grants permanent Strength (turnsRemaining=9999)**
  Setup: play warcry, CC
  Check: `playerStatusEffects` contains strength with turnsRemaining=9999

- [x] **battle_trance L0 — draws 2 cards**
  Setup: L0 battle_trance, QP; draw pile has ≥ 2 cards
  Check: hand size increases by 2; draw pile decreases by 2

- [x] **inscription_wisdom L0 CC — Inscription of Wisdom buff active**
  Setup: play inscription_wisdom, CC
  Check: player status contains inscription_wisdom; utility cards boosted

- [x] **frenzy L0 — attack damage buff for this turn**
  Setup: play frenzy, QP; then play strike
  Check: strike damage increased vs baseline

- [x] **mastery_surge L0 CC — upgrades a card's mastery level**
  Setup: deck has L0 card, play mastery_surge CC
  Check: one card's masteryLevel increases by 1

- [x] **war_drum L0 — grants Strength-like buff**
  Setup: play war_drum, QP
  Check: playerStatusEffects contains strength or equivalent buff

- [x] **forge L0 — triggers CardPickerOverlay; upgrades selected card**
  Setup: play forge with upgradeable cards in deck
  Check: CardPickerOverlay appears; selected card masteryLevel increases

### 11.4 Debuff Cards — Functional Correctness

- [x] **weaken L0 QP — applies 2 Weakness stacks to enemy**
  Setup: L0 weaken (qpValue=2), QP
  Check: `getCombatState().enemyStatusEffects` contains `{type:'weakness', value:2}`

- [x] **weaken L0 CC — applies floor(2 × 1.50) = 3 Weakness stacks**
  Setup: CC
  Check: weakness stacks = 3

- [x] **expose L0 — applies Vulnerable to enemy**
  Setup: L0 expose, QP
  Check: enemyStatusEffects contains vulnerable

- [x] **hex L0 — applies Hex debuff to enemy**
  Setup: L0 hex, QP
  Check: enemyStatusEffects contains hex effect

- [x] **slow L0 — applies Slow to enemy**
  Setup: L0 slow, QP
  Check: enemyStatusEffects contains slow

- [x] **lacerate L0 QP — 1 damage + 4 Bleed**
  Setup: L0 lacerate (qpValue=1, secondaryValue=4), QP
  Check: enemyHp delta = 1; bleed stacks = 4

- [x] **lacerate L5 — lacerate_vuln1t: also applies Vulnerable 1 turn**
  Setup: L5 lacerate, CC
  Check: enemyStatusEffects contains both bleed and vulnerable

- [x] **stagger L0 — applies Stagger debuff to enemy**
  Setup: play stagger, QP
  Check: enemyStatusEffects contains stagger

- [x] **corrode L0 — applies Corrode to enemy**
  Setup: play corrode, QP
  Check: enemyStatusEffects contains corrode

- [x] **curse_of_doubt L0 — applies charge_damage_amp_percent to player**
  Setup: play curse_of_doubt, QP
  Check: playerStatusEffects contains charge_damage_amp_percent (incoming CW penalty)

- [x] **mark_of_ignorance L0 — applies charge_damage_amp_flat to player**
  Setup: play mark_of_ignorance, QP
  Check: playerStatusEffects contains charge_damage_amp_flat

- [x] **corroding_touch L0 — applies layered Corrode**
  Setup: play corroding_touch, QP
  Check: enemyStatusEffects contains corrode with higher stacks than single corrode

- [x] **entropy L0 — applies Entropy debuff chain to enemy**
  Setup: play entropy, QP
  Check: enemyStatusEffects contains entropy; debuff chain starts

### 11.5 Utility Cards — Functional Correctness

- [x] **cleanse L0 — removes all debuffs from player**
  Setup: player has poison + weakness + vulnerable; play cleanse
  Check: all negative playerStatusEffects cleared

- [x] **scout L0 — draws 2 cards**
  Setup: L0 scout (qpValue=2, tag: draw), QP; draw pile ≥ 2
  Check: hand size increases by 2

- [x] **recycle L0 — removes selected hand card, draws 3**
  Setup: play recycle targeting strike; hand had 3+ other cards
  Check: targeted card removed from hand; 3 cards drawn

- [x] **foresight L0 — reveals next enemy intent + card is forgotten**
  Setup: play foresight, QP
  Check: foresight status applied; card added to forgetPile

- [x] **conjure L0 CC — triggers CardPickerOverlay with conjure pool**
  Setup: play conjure, CC
  Check: CardPickerOverlay appears; selected card added to hand

- [x] **transmute L0 — triggers CardPickerOverlay; transforms selected card**
  Setup: play transmute with 2+ cards in hand
  Check: CardPickerOverlay appears; selected card replaced with new card

- [x] **immunity L0 — applies Immunity status to player**
  Setup: play immunity, QP
  Check: playerStatusEffects contains immunity

- [x] **sift L0 — discard up to 2 cards, draw same amount**
  Setup: play sift with 3+ cards in hand
  Check: hand size stays same; 2 cards cycled

- [x] **scavenge L0 — triggers CardPickerOverlay with discard pile**
  Setup: discard pile has ≥ 1 card; play scavenge
  Check: CardPickerOverlay shows discard pile; selected card added to hand

- [x] **swap L0 — exchanges positions of two hand cards**
  Setup: hand has 3+ cards; play swap
  Check: card positions in hand rearranged

- [x] **archive L0 — permanently removes selected card from run**
  Setup: play archive targeting strike
  Check: targeted card removed from deck entirely (not just discarded)

- [x] **reflex L0 — draws 1 card immediately**
  Setup: L0 reflex, QP; draw pile ≥ 1
  Check: hand size increases by 1; draw pile decreases by 1

- [x] **recollect L0 — retrieves card from discard pile**
  Setup: discard pile has ≥ 1 card; play recollect
  Check: card moved from discardPile to hand

- [x] **synapse L0 — draws cards and applies focus**
  Setup: play synapse, QP
  Check: cards drawn; focus status applied

- [x] **siphon_knowledge L0 — draw scales with chain length**
  Setup: `SC.patch({turn:{chainLength:2}})`, play siphon_knowledge
  Check: draws 2+ cards (chain-scaled)

- [x] **tutor L0 — searches deck for specific card type**
  Setup: play tutor
  Check: CardPickerOverlay or direct fetch; chosen card type added to hand

### 11.6 Wild Cards — Functional Correctness

- [x] **mirror L0 — copies last played card's effect**
  Setup: play strike (QP), then play mirror
  Check: enemyHp delta matches strike QP damage again

- [x] **adapt L0 — triggers CardPickerOverlay for type selection**
  Setup: play adapt
  Check: CardPickerOverlay appears with card type or mechanic choices

- [x] **overclock L0 — doubles next card's effect**
  Setup: play overclock, then play strike
  Check: strike damage = 2 × baseline strike damage

- [x] **phase_shift L0 — grants evasion or phase effect**
  Setup: play phase_shift, QP; enemy attacks
  Check: playerHp unchanged or damage reduced (phase evasion resolves)

- [x] **chameleon L0 — changes card type in hand**
  Setup: play chameleon targeting a card
  Check: targeted card's type changes

- [x] **dark_knowledge L0 — damage + card draw at HP cost**
  Setup: play dark_knowledge, QP
  Check: enemyHp delta > 0; cards drawn; possible playerHp decrease

- [x] **chain_anchor L0 — sets active chain start to type 2**
  Setup: play chain_anchor
  Check: `getCombatState().chainLength` ≥ 2 or chain initialized to anchor type

- [x] **unstable_flux L0 — random effect from pool**
  Setup: play unstable_flux
  Check: one of multiple possible effects resolves (damage / block / draw / buff)

- [x] **sacrifice L0 — remove selected card for a power buff**
  Setup: play sacrifice with 2+ cards in hand
  Check: CardPickerOverlay appears; selected card removed; buff applied to player

- [x] **catalyst L0 — doubles next card's effect (similar to overclock)**
  Setup: play catalyst, then play kindle
  Check: kindle effect doubled (Burn stacks doubled)

- [x] **mimic L0 — copies enemy's next ability**
  Setup: play mimic; enemy has a defined ability
  Check: mimic resolves effect equivalent to enemy ability

- [x] **aftershock L0 — delayed damage triggers next turn start**
  Setup: play aftershock; end turn
  Check: enemyHp decreases at start of next player turn

- [x] **knowledge_bomb L0 CC — massive damage scaling with chain**
  Setup: `SC.patch({turn:{chainLength:4, chainMultiplier:2.5}})`, L0 knowledge_bomb, CC
  Check: enemyHp delta reflects chain-amplified damage burst


---
