<!--
  Purpose: Status effect mechanics, chain system, mastery progression, enemy mechanics, combo interactions.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 13.1-13.9 (status effects), 14.1-14.2 (chains), 15.1-15.2 (mastery), 16.1-16.3 (enemies), 17.1-17.12 (combos)
-->

## SECTION 13 — STATUS EFFECT FUNCTIONAL CORRECTNESS

### 13.1 Poison

- [ ] **Poison application — correct stacks applied**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[]}}})`, play hex or weaken with poison secondary; or `SC.patch({turn:{enemy:{statusEffects:[{type:'poison',value:3,turnsRemaining:3}]}}})`
  Check: `getCombatState().enemyStatusEffects` contains `{type:'poison', value:3}`

- [ ] **Poison tick — deals N damage per turn**
  Setup: enemy has 3 poison; end turn
  Check: enemyHp decreases by 3 at end of enemy turn; turnsRemaining decreases by 1

- [ ] **Poison stacking — additive**
  Setup: apply 3 poison, then apply 2 more poison
  Check: total poison stacks = 5

- [ ] **Poison expiry — removed when turnsRemaining reaches 0**
  Setup: apply 2 poison (turnsRemaining=2); end 2 turns
  Check: poison removed from enemyStatusEffects after 2 ticks

- [ ] **Poison on player — same tick/expiry behavior**
  Setup: `SC.patch({turn:{playerState:{statusEffects:[{type:'poison',value:4,turnsRemaining:2}]}}})`, end turn
  Check: playerHp decreases by 4; turnsRemaining decrements

### 13.2 Strength

- [ ] **Strength increases all attack damage by stacks × damage formula**
  Setup: `SC.patch({turn:{playerState:{statusEffects:[{type:'strength',value:2,turnsRemaining:9999}]}}})`, play strike
  Check: strike damage includes +2 per strength stack

- [ ] **Strength on enemy increases enemy attack damage**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[{type:'strength',value:3,turnsRemaining:9999}]}}})`, end turn
  Check: enemy attack deals base + 3 × strength_scale extra damage

- [ ] **Permanent strength (9999 turns) does not expire**
  Setup: strength turnsRemaining=9999; end 5 turns
  Check: strength still present after 5 turns

### 13.3 Weakness

- [ ] **Weakness reduces attack damage by ~33%**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[{type:'weakness',value:1,turnsRemaining:2}]}}})`, play attack
  Check: enemy attack damage reduced; player takes less damage

- [ ] **Weakness on player reduces player attack damage**
  Setup: `SC.patch({turn:{playerState:{statusEffects:[{type:'weakness',value:1,turnsRemaining:2}]}}})`, play strike
  Check: strike damage lower than baseline

- [ ] **Weakness + Strength combined — strength partially overrides weakness**
  Setup: player has both strength=2 and weakness=1; play strike
  Check: damage = baseline + strength_bonus, then weakness reduction applied

- [ ] **Weakness turnsRemaining decrements each turn**
  Setup: weakness turnsRemaining=2; end 1 turn
  Check: weakness turnsRemaining = 1

### 13.4 Vulnerable

- [ ] **Vulnerable increases damage taken by 50%**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[{type:'vulnerable',value:1,turnsRemaining:2}]}}})`, play strike
  Check: strike damage = floor(baseline × 1.5)

- [ ] **Vulnerable on player: player takes 50% more damage**
  Setup: player has vulnerable; end turn; enemy attacks
  Check: playerHp decreases by floor(enemy_damage × 1.5)

- [ ] **Vulnerable expires correctly**
  Setup: vulnerable turnsRemaining=1; end 1 turn
  Check: vulnerable removed from statusEffects

### 13.5 Burn

- [ ] **Burn ticks — deals N damage at start of enemy turn, then halves**
  Setup: enemy has burn=8; end turn
  Check: enemyHp decreases by 8; burn stacks halve to 4

- [ ] **Burn halving — stacks halve each tick (not decrement by 1)**
  Setup: burn=8; end 3 turns
  Check: stacks sequence: 8 → 4 → 2 → 1 (halves each turn)

- [ ] **Burn on-hit — attacks against burning enemy trigger extra damage**
  Setup: enemy has burn; play attack
  Check: damage number reflects burn interaction bonus

- [ ] **Burn expires at 0 stacks**
  Setup: burn=1; end 1 turn (halves to 0 or 0.5 → floor 0)
  Check: burn removed after stack reaches 0

### 13.6 Bleed

- [ ] **Bleed applies N stacks**
  Setup: play rupture; verify bleed stacks in enemyStatusEffects

- [ ] **Bleed deals bonus damage based on stack count during attacks**
  Setup: enemy has 4 bleed; play attack
  Check: damage includes extra bleed contribution

- [ ] **Bleed per-stack — each additional stack adds to damage**
  Setup: compare attack damage at bleed=2 vs bleed=6
  Check: higher bleed = more bonus damage

- [ ] **Bleed decrements each turn (unless rupture_bleed_perm active)**
  Setup: bleed=4; end 2 turns
  Check: bleed stacks decrease

### 13.7 Regen

- [ ] **Regen heals N HP at turn start**
  Setup: `SC.patch({turn:{playerState:{statusEffects:[{type:'regen',value:3,turnsRemaining:3}]}}})`, playerHp=80; end turn
  Check: playerHp = 83 at next turn start

- [ ] **Regen turnsRemaining decrements**
  Setup: regen turnsRemaining=3; end 1 turn
  Check: turnsRemaining = 2

- [ ] **Regen expires at turnsRemaining=0**
  Setup: regen turnsRemaining=1; end 1 turn (after heal)
  Check: regen removed from statusEffects

### 13.8 Immunity

- [ ] **Immunity prevents debuff application**
  Setup: player has immunity; enemy applies poison
  Check: playerStatusEffects does not gain poison

- [ ] **Immunity does not prevent damage**
  Setup: player has immunity; enemy attacks
  Check: playerHp still decreases normally

- [ ] **Immunity expires correctly**
  Setup: immunity turnsRemaining=2; end 2 turns
  Check: immunity removed after 2 turns

### 13.9 charge_damage_amp_percent and charge_damage_amp_flat

- [ ] **charge_damage_amp_percent increases CW damage received**
  Setup: player has `{type:'charge_damage_amp_percent', value:30}`; enemy attacks during charged state
  Check: charge-phase damage amplified by 30%

- [ ] **charge_damage_amp_flat increases CW damage received by flat value**
  Setup: player has `{type:'charge_damage_amp_flat', value:5}`
  Check: flat +5 added to charge-phase incoming damage

---

## SECTION 14 — CHAIN SYSTEM FUNCTIONAL CORRECTNESS

### 14.1 Chain Building and Breaking

- [ ] **Chain extends on same-type CC — chainLength increments**
  Setup: `SC.patch({turn:{activeChainColor:1, chainLength:1}})`, CC with chain-type-1 card
  Check: `getCombatState().chainLength` = 2

- [ ] **Chain breaks on different-type CC — chainLength resets to 0**
  Setup: chain type 1 active at length 3; CC with chain-type-2 card
  Check: chainLength = 0 after play; chainMultiplier = 1.0

- [ ] **Chain extends on QP — chainLength does NOT increment (QP doesn't chain)**
  Setup: chain active at length 2; QP with same-type card
  Check: chainLength = 2 (unchanged); multiplier unchanged

- [ ] **Chain multiplier [0] = 1.0 (no chain)**
  Setup: `SC.patch({turn:{chainLength:0}})`, play any attack
  Check: damage = floor(qpValue × 1.5 × 1.0) — no chain bonus

- [ ] **Chain multiplier [1] = 1.2 (first link)**
  Setup: chainLength=1, chainMultiplier=1.2; CC attack
  Check: damage = floor(qpValue × 1.5 × 1.2)

- [ ] **Chain multiplier [2] = 1.5**
  Setup: chainLength=2, chainMultiplier=1.5; CC attack
  Check: damage = floor(qpValue × 1.5 × 1.5)

- [ ] **Chain multiplier [3] = 2.0**
  Setup: chainLength=3, chainMultiplier=2.0; CC attack
  Check: damage = floor(qpValue × 1.5 × 2.0)

- [ ] **Chain multiplier [4] = 2.5**
  Setup: chainLength=4, chainMultiplier=2.5; CC attack
  Check: damage = floor(qpValue × 1.5 × 2.5)

- [ ] **Chain multiplier [5] = 3.5 (maximum)**
  Setup: chainLength=5, chainMultiplier=3.5; CC attack
  Check: damage = floor(qpValue × 1.5 × 3.5)

- [ ] **Chain break resets multiplier to 1.0**
  Setup: chain at length 4 (mult=2.5); play off-type card CC
  Check: chainMultiplier = 1.0; chainLength = 0

### 14.2 Chain Relic Interactions

- [ ] **chain_reactor splash: deal 6 × chainLength damage on chain extend**
  Setup: equip chain_reactor; chainLength=3; extend chain with CC
  Check: enemyHp decreases by extra 18 (6 × 3) on chain extension

- [ ] **prismatic_shard: +0.5 per chain link**
  Setup: equip prismatic_shard; chainLength=3
  Check: effective multiplier = 2.0 + (3 × 0.5) = 3.5 (instead of 2.0)

- [ ] **resonance_crystal: draw 1 card on chain extend**
  Setup: equip resonance_crystal; extend chain
  Check: hand size increases by 1 on each chain extension

- [ ] **null_shard: chain multiplier locked at 1.0 on enemies with chainMultiplierOverride**
  Setup: `SC.loadCustom({screen:'combat', enemy:'dunning_kruger', relics:['null_shard']})`
  Check: chainMultiplier = 1.0 regardless of chain length built

- [ ] **chain_forge: chain break prevented once per turn**
  Setup: equip chain_forge; build chain 3; play off-color CC
  Check: chain does NOT reset; chain_forge charge consumed

- [ ] **chromatic_chain: next chain starts at length 2 after break**
  Setup: equip chromatic_chain; break chain; play first card of new chain
  Check: chainLength = 2 immediately on first link of new chain

- [ ] **chain_lightning CC scales with chainLength**
  Setup: chainLength=4; chain_lightning L0, CC
  Check: damage = chain_lightning_base × chainLength (4× multiplier applied to card)

- [ ] **chain_anchor sets chain start to type 2**
  Setup: play chain_anchor (wild card)
  Check: activeChainColor set to anchor type; chainLength ≥ 2 on next CC in that type

---

## SECTION 15 — MASTERY LEVEL PROGRESSION

### 15.1 Representative Card Stat Verification (L0–L5)

- [ ] **strike progression: L0=4, L1=4, L2=5, L3=6, L4=7, L5=8 QP**
  Setup: card at each mastery level; QP each
  Check: enemyHp deltas match QP values: 4, 4, 5, 6, 7, 8

- [ ] **strike L5 CC = floor(8 × 1.5) = 12**
  Setup: L5 strike, CC
  Check: enemyHp delta = 12

- [ ] **block progression: L0=4, L1=4, L2=5, L3=6, L4=7, L5=8 block**
  Setup: card at each mastery level; QP each
  Check: playerBlock deltas match: 4, 4, 5, 6, 7, 8

- [ ] **multi_hit hitCount progression: L0=2, L1=3, L2=3, L3=3, L4=4, L5=4**
  Setup: play multi_hit at each mastery; count damage hits
  Check: hit count matches per-level spec

- [ ] **heavy_strike L5 AP cost = 1**
  Setup: L5 heavy_strike in hand
  Check: `getCombatState().hand[i].apCost` = 1

- [ ] **chain_lightning L5 AP cost = 1**
  Setup: L5 chain_lightning in hand
  Check: apCost = 1

- [ ] **transmute AP cost unchanged across levels**
  Setup: transmute at L0 and L5; check apCost
  Check: apCost consistent at 1 for all levels

- [ ] **L3 tag activation — strike has no L3 tag (no change), multi_hit gains multi_bleed1**
  Setup: multi_hit at L3; CC
  Check: bleed stacks applied after multi_hit CC

- [ ] **L5 tag activation — strike gains strike_tempo3; verify tempo bonus fires**
  Setup: L5 strike; play 3+ cards this turn, then CC strike
  Check: damage includes strike_tempo3 bonus (4+ extra damage)

- [ ] **hemorrhage L5 AP = 1 (down from 2)**
  Setup: L5 hemorrhage in hand
  Check: apCost = 1

- [ ] **catalyst L0 AP cost matches mechanic definition**
  Setup: L0 catalyst in hand
  Check: apCost matches `src/data/mechanics.ts` catalyst apCost

- [ ] **empower L0 QP — Empower badge appears in player status**
  Setup: L0 empower, QP
  Check: playerStatusEffects contains empower; next attack damage boosted

- [ ] **hex L0 → L3 → L5 — debuff potency increases each tier**
  Setup: hex at L0, L3, L5; compare enemy debuff stacks applied
  Check: hex stacks increase at L3 and L5

- [ ] **scout L5 — draw count increases vs L0**
  Setup: L5 scout; play; compare hand increase vs L0 scout
  Check: L5 draws more cards than L0

- [ ] **mirror copies last card correctly at all mastery levels**
  Setup: play L3 strike then mirror
  Check: mirror's triggered damage = L3 strike QP damage (6)

### 15.2 CW Consistent at 0.50× Across All Levels

- [ ] **CW multiplier 0.50× at L0**
  Setup: L0 strike (qpValue=4), CW
  Check: enemyHp delta = floor(4 × 0.50) = 2

- [ ] **CW multiplier 0.50× at L3**
  Setup: L3 strike (qpValue=6), CW
  Check: enemyHp delta = floor(6 × 0.50) = 3

- [ ] **CW multiplier 0.50× at L5**
  Setup: L5 strike (qpValue=8), CW
  Check: enemyHp delta = floor(8 × 0.50) = 4

- [ ] **CC multiplier 1.50× at L0**
  Setup: L0 strike, CC with no chain/buffs
  Check: enemyHp delta = floor(4 × 1.50) = 6

- [ ] **CC multiplier 1.50× at L5**
  Setup: L5 strike, CC with no chain/buffs
  Check: enemyHp delta = floor(8 × 1.50) = 12

---

## SECTION 16 — ENEMY MECHANIC CORRECTNESS

### 16.1 Phase Transitions

- [ ] **bookwyrm phase 1→2 at 50% HP — phase fires correctly**
  Setup: `SC.loadCustom({screen:'combat', enemy:'bookwyrm'})`, reduce enemy to < 50% HP
  Check: `getCombatState().enemyPhase` changes to 2; enemy intent pool switches; HP threshold logged

- [ ] **burning_deadline phase 1→2 — transition at configured threshold**
  Setup: reduce burning_deadline below phase threshold
  Check: phase changes; new intent pool active

- [ ] **algorithm phase transition — Quiz Boss pause fires**
  Setup: `SC.loadCustom({screen:'combat', enemy:'algorithm'})`, reduce to 50% HP
  Check: Quiz Boss overlay appears mid-combat; combat paused until quiz complete

- [ ] **curriculum phase 2 — quickPlayDamageMultiplier changes**
  Setup: `SC.loadCustom({screen:'combat', enemy:'curriculum'})`, trigger phase 2
  Check: QP multiplier updated to phase 2 value

### 16.2 Special Enemy Passive Abilities

- [ ] **Librarian — silences one card type at encounter start**
  Setup: `SC.loadCustom({screen:'combat', enemy:'librarian'})`
  Check: one card type in hand is silenced/unplayable at start; QP Immune badge present

- [ ] **Brain Fog enemy — erodes player mastery each turn**
  Setup: `SC.loadCustom({screen:'combat', enemy:'brain_fog'})`, end 1 turn
  Check: one player card loses 1 mastery level after enemy turn

- [ ] **Citation Needed — steals player block on player's turn**
  Setup: `SC.loadCustom({screen:'combat', enemy:'citation_needed'})`, gain block then let enemy steal
  Check: playerBlock decreases; enemyBlock increases by stolen amount

- [ ] **Trick Question — wrong charge locks card + heals enemy**
  Setup: `SC.loadCustom({screen:'combat', enemy:'trick_question'})`, CW on any card
  Check: charged card becomes locked (unplayable); enemy heals; Locked badge appears

- [ ] **Trick Question — correct charge: no lock, normal damage**
  Setup: same, CC correctly
  Check: damage resolves normally; no lock applied

- [ ] **Pop Quiz — correct charge stuns enemy**
  Setup: `SC.loadCustom({screen:'combat', enemy:'pop_quiz'})`, CC correctly
  Check: enemy gains stunned status; enemy skips next turn

- [ ] **Plagiarist — gains +1 Strength each turn (Escalates)**
  Setup: `SC.loadCustom({screen:'combat', enemy:'plagiarist'})`, end 3 turns
  Check: enemy strength stacks increase each turn

- [ ] **Textbook — Hardcover armor: 16 block that strips on CC, restores on CW**
  Setup: `SC.loadCustom({screen:'combat', enemy:'textbook'})`, CC attack
  Check: enemy block decreases by CC hit; hardcover badge value decrements

- [ ] **Textbook Hardcover — CW restores armor**
  Setup: after stripping some armor, CW next attack
  Check: enemy block increases (armor partially restored)

- [ ] **Publish or Perish — immune to natural_sciences domain attacks**
  Setup: `SC.loadCustom({screen:'combat', enemy:'publish_or_perish'})`, play natural_sciences domain card
  Check: damage = 0 (immunity); other domain cards still deal damage

- [ ] **Headmistress — exhausts 2 highest-mastery cards at encounter start**
  Setup: `SC.loadCustom({screen:'combat', enemy:'headmistress'})`, deck has L3+L4 cards
  Check: those 2 cards moved to forgetPile at encounter start; hand/deck lacks them

- [ ] **Comparison Trap — Punish Skip: gains strength when player skips charge**
  Setup: `SC.loadCustom({screen:'combat', enemy:'comparison_trap'})`, play QP cards (no CC)
  Check: enemy gains strength stacks for each skipped charge

- [ ] **Dunning Kruger — chainMultiplierOverride: 1.0 (chain gives no bonus)**
  Setup: `SC.loadCustom({screen:'combat', enemy:'dunning_kruger'})`, build chain to 4
  Check: damage multiplier = 1.0 regardless of chainLength; Chain Null badge present

- [ ] **All Nighter — escalates attack power each turn**
  Setup: `SC.loadCustom({screen:'combat', enemy:'all_nighter'})`, end 3 turns
  Check: enemy attack damage increases each turn

### 16.3 Punish Mechanics

- [ ] **onPlayerChargeWrong — enemy gains effect on player CW**
  Setup: `SC.loadCustom({screen:'combat', enemy:'trick_question'})`, CW
  Check: trigger fires; lock badge + enemy heal confirms trigger

- [ ] **onPlayerChargeCorrect — enemy deals extra damage on player CC**
  Setup: `SC.loadCustom({screen:'combat', enemy:'pop_quiz'})`, CC
  Check: pop_quiz punish fires; enemy gets stunned (or unique per-enemy reaction)

- [ ] **onPlayerNoCharge — enemy punishes Quick Play (no charge)**
  Setup: `SC.loadCustom({screen:'combat', enemy:'comparison_trap'})`, QP without charging
  Check: enemy's no-charge trigger fires; comparison_trap gains strength

---

## SECTION 17 — COMBO INTERACTIONS AND EDGE CASES

### 17.1 Buff + Damage Stacking

- [ ] **Empower + chain multiplier — both apply multiplicatively**
  Setup: player has Empower; chain at length 3 (mult=2.0); CC attack
  Check: damage = floor(qpValue × empower_mult × 1.5 × 2.0)

- [ ] **Double Strike + multi_hit — double-strike applies to each hit**
  Setup: play double_strike, then play multi_hit
  Check: multi_hit hits twice per normal hit (total hits = 2 × hitCount)

- [ ] **Overclock + chain_lightning — overclock doubles chain_lightning effect**
  Setup: play overclock, then CC chain_lightning at chain=3
  Check: chain_lightning damage = floor(2 × base × 1.5 × chain_mult)

- [ ] **Catalyst + poison (kindle) — catalyst doubles burn stacks applied**
  Setup: play catalyst, then play kindle
  Check: kindle applies 2× its normal burn stacks

- [ ] **Warcry (permanent strength) + high chain — stacking multiplicative**
  Setup: player has strength=2 (warcry); chain=3 (2.0×); CC strike
  Check: damage = floor(4 × (1 + 2 × strength_scale) × 1.5 × 2.0)

### 17.2 Self-Damage and Risk Mechanics

- [ ] **Volatile Core relic: self-damage on wrong answer + damage bonus**
  Setup: equip volatile_core; player takes lethal damage to trigger volatile_core explosion
  Check: volatile_core explosion fires on enemy death; 8 AoE applied to next encounter

- [ ] **Blood Price HP/AP trade: HP decreases each turn; AP increases**
  Setup: equip blood_price; end 3 turns
  Check: playerHp -= 3 × 3 = -9 over 3 turns; ap +1 per turn each turn

- [ ] **Reckless L0 self-damage: 4 HP lost per QP**
  Setup: `SC.loadCustom({..., playerHp:50})`, L0 reckless, QP
  Check: playerHp = 46 after play

- [ ] **Reckless L5: selfDmg=0 at chain=0; scales at chain > 0**
  Setup: L5 reckless; no chain; QP
  Check: playerHp unchanged (selfDmg=0 at no chain)

### 17.3 Death Prevention and Survival

- [ ] **Last Breath — survive lethal hit once at 1 HP**
  Setup: equip last_breath; playerHp=3; enemy attacks for 15
  Check: playerHp = 1; last_breath relic consumed (greyed out); survives

- [ ] **Phoenix Feather — survive lethal hit; enter rage state for 3 turns**
  Setup: equip phoenix_feather; take lethal hit
  Check: playerHp = 1 (phoenix trigger); rage status active; phoenix_feather consumed

- [ ] **Both last_breath and phoenix_feather equipped — last_breath triggers first**
  Setup: equip both; take lethal hit
  Check: last_breath triggers (first prevention); phoenix_feather intact for next lethal

### 17.4 Forget/Burn Mechanics

- [ ] **Volatile Slash L0 CC — card moves to forgetPile**
  Setup: L0 volatile_slash, CC; check forgetPile count
  Check: forgetPile increases by 1; card unavailable for future draws

- [ ] **Burnout Shield — block applied, burnout penalty applied to player**
  Setup: play burnout_shield; end turn
  Check: playerBlock gained; burnout debuff side effect applied

- [ ] **Bulwark CW — partial block at 0.50× base value**
  Setup: L0 bulwark, CW
  Check: playerBlock = floor(bulwark_base × 0.50)

- [ ] **Foresight forget mechanic — foresight card added to forgetPile after play**
  Setup: play foresight; check forgetPile
  Check: foresight card in forgetPile; foresight status applied to player

### 17.5 Inscription Combos

- [ ] **Inscription of Fury + all attack cards: +N damage per attack this turn**
  Setup: CC inscription_fury; play 3 attack cards
  Check: each attack gets Inscription of Fury bonus damage stacked

- [ ] **Inscription of Iron + all shield cards: +N block per shield this turn**
  Setup: CC inscription_iron; play block, thorns, guard
  Check: each shield gets inscription bonus block

- [ ] **Inscription of Wisdom + utility cards: bonus effect per utility played**
  Setup: CC inscription_wisdom; play scout, reflex
  Check: utility bonus (extra draw or effect) on each utility card

### 17.6 Surge and AP Mechanics

- [ ] **Surge turn (every 4th global turn) grants +1 AP**
  Setup: `SC.patch({turn:{isSurge:true, apCurrent:3, apMax:3}})` — or wait for turn 2
  Check: surge turn adds +1 AP (4 total instead of 3)

- [ ] **Surge capacitor relic: surge turn grants +2 AP (doubles surge bonus)**
  Setup: equip surge_capacitor; reach surge turn
  Check: AP = default + 2 on surge turn

- [ ] **Quicken L0 QP grants 1 AP**
  Setup: L0 quicken (qpValue=1); QP
  Check: `getCombatState().ap` += 1 immediately

- [ ] **Eruption spends all available AP**
  Setup: `SC.patch({turn:{apCurrent:4}})`, L0 eruption, QP
  Check: `getCombatState().ap` = 0 after play; damage = 6 × 4 = 24

- [ ] **Overclock (wild) doubles next card's effect; then consumed**
  Setup: play overclock; play block
  Check: block gain = 2× baseline; overclock status removed after next card

### 17.7 Cursed Card Penalties

- [ ] **curse_of_doubt — charge_damage_amp_percent: CW deals 30% more damage to player**
  Setup: player has curse_of_doubt (charge_damage_amp_percent=30); CW any attack
  Check: charge-phase feedback damage amplified by 30%

- [ ] **mark_of_ignorance — charge_damage_amp_flat: flat +N to CW damage**
  Setup: player has mark_of_ignorance; CW any card
  Check: CW damage to player = normal CW + flat bonus


### 17.8 Edge Cases — Damage Floor and Overflow

- [ ] **CW never deals 0 damage (Math.max floor applies)**
  Setup: any card, CW; even L0 low-value card
  Check: enemyHp delta ≥ 1 (CW always resolves at Math.max(1, floor(qpValue × 0.50)))

- [ ] **CC with chain=5 (3.5×) on strike L5 — maximum no-relic damage**
  Setup: L5 strike (qpValue=8), chainLength=5 (mult=3.5), CC, no buffs
  Check: enemyHp delta = floor(8 × 1.5 × 3.5) = floor(42) = 42

- [ ] **Block at 0 — attacks deal full damage (no reduction)**
  Setup: `SC.patch({turn:{enemy:{block:0}}})`, attack
  Check: enemyHp delta = full attack value

- [ ] **Enemy block fully absorbs attack**
  Setup: `SC.patch({turn:{enemy:{block:20}}})`, play L0 strike QP (4 damage)
  Check: enemyHp unchanged (4 < 20 block); enemyBlock = 16

- [ ] **Enemy block partially absorbs attack**
  Setup: `SC.patch({turn:{enemy:{block:3}}})`, play L0 strike QP (4 damage)
  Check: enemyHp delta = 1 (4 - 3 = 1); enemyBlock = 0

- [ ] **Multiple buffs apply in correct order (strength → chain → vuln)**
  Setup: player has strength=2; chainLength=2 (mult=1.5); enemy has vulnerable; CC strike L0
  Check: damage = floor(4 × strength_mult × 1.5 × 1.5 × 1.5) — order verified against formula

- [ ] **Healing cannot exceed max HP**
  Setup: playerHp = playerMaxHp = 100; play lifetap CC (heals)
  Check: playerHp stays at 100 (no overheal beyond max without overheal relic)

- [ ] **AP cannot exceed apMax through buffs**
  Setup: apMax=3; apply multiple AP gain buffs
  Check: ap capped at 3 (or appropriate max); no infinite AP exploit

### 17.9 Additional Mastery Edge Cases

- [ ] **L0 card always has masteryLevel=0 in hand state**
  Setup: newly acquired card; check `getCombatState().hand[i].masteryLevel`
  Check: value = 0

- [ ] **Correct charge at L4 increments to L5**
  Setup: card at masteryLevel=4; CC
  Check: masteryLevel = 5 after correct answer

- [ ] **Wrong charge at L1 decrements to L0**
  Setup: card at masteryLevel=1; CW
  Check: masteryLevel = 0 after wrong answer (unless memory_nexus equipped)

- [ ] **Wrong charge at L0 stays at L0 (cannot go below 0)**
  Setup: card at masteryLevel=0; CW
  Check: masteryLevel = 0 (floor applied; no underflow)

- [ ] **Mastery challenge win — card jumps to L5**
  Setup: complete mastery challenge for a card at L3
  Check: card masteryLevel = 5

### 17.10 Additional Enemy Mechanic Edge Cases

- [ ] **Enemy with no special passives (page_flutter) — attack resolves normally**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter'})`, end turn
  Check: playerHp decreases by page_flutter attack value; no passive triggers

- [ ] **Enemy block regenerates on enemy turn start (defend intent)**
  Setup: enemy has defend intent; end turn
  Check: `getCombatState().enemyBlock` increases after enemy defend action

- [ ] **Enemy with Strength: attack damage scales correctly**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[{type:'strength',value:3,turnsRemaining:9999}]}}})`, end turn
  Check: playerHp damage = enemy base + 3 × strength_scale

- [ ] **Quiz Boss — correct answer at HP threshold: resume combat**
  Setup: `SC.loadCustom({screen:'combat', enemy:'final_exam'})`, reduce to 50% HP threshold, answer quiz correctly
  Check: quiz Boss overlay dismisses; combat resumes; enemyHp unchanged during quiz pause

- [ ] **Quiz Boss — wrong answer at HP threshold: enemy heals or buffs**
  Setup: same, answer incorrectly
  Check: quiz penalty fires (enemy heals or player takes damage); combat resumes

### 17.11 Additional Relic Functional Tests

- [ ] **tag_magnet — card with matching tag draws at turn start**
  Setup: equip tag_magnet (configured for a tag); start turn
  Check: a card with the matching tag moved to hand at turn start

- [ ] **archive_codex — archived cards return as upgraded copies next run**
  Setup: archive a card with archive_codex equipped
  Check: card archived normally in run; archive_codex state updated for next run

- [ ] **berserker_s_oath — deal self-damage to gain massive attack boost**
  Setup: equip berserker_s_oath; trigger self-damage condition
  Check: attack buff applied; damage bonus active this turn

- [ ] **deja_vu — wrong answer: draw the same card again next turn**
  Setup: equip deja_vu; CW on a card
  Check: that card appears again in hand next turn (drawn again)

- [ ] **scholars_gambit — correct charge: 50% chance to gain a free copy of the card**
  Setup: equip scholars_gambit; CC multiple times
  Check: occasionally a copy of the charged card added to hand

- [ ] **domain_mastery_sigil — bonus damage per matching domain card in deck**
  Setup: equip domain_mastery_sigil; deck contains 5 same-domain cards; play domain attack
  Check: attack damage includes domain_mastery_sigil × 5 bonus

- [ ] **overclocked_mind — reduce AP cost of first card by 1 each turn**
  Setup: equip overclocked_mind; start turn; play most expensive card first
  Check: first card played costs 1 less AP than printed cost

- [ ] **mnemonic_scar — mastery level locked (no downgrade)**
  Setup: equip mnemonic_scar; CW on L3 card
  Check: masteryLevel stays at 3 (same as memory_nexus; verify via state)

- [ ] **knowledge_tax — correct charge: pay 5 gold for bonus effect**
  Setup: equip knowledge_tax; player has gold; CC
  Check: player gold decreases by 5; knowledge_tax bonus effect fires

- [ ] **bloodletter — deal N damage to self, add N to next attack**
  Setup: equip bloodletter; trigger self-damage mechanic
  Check: playerHp -= N; next attack deals N extra damage

- [ ] **chain_addict — at chain break: draw 1 card**
  Setup: equip chain_addict; build chain, then break it
  Check: hand size increases by 1 on chain break

- [ ] **quiz_master — correct charge: chance for double mastery XP**
  Setup: equip quiz_master; CC multiple cards
  Check: some correct charges grant 2× mastery progression

- [ ] **exhaustion_engine — every 3rd card played: draw 2 cards**
  Setup: equip exhaustion_engine; play 3 cards in one turn
  Check: on 3rd card, 2 extra cards drawn

- [ ] **momentum_wheel — building chain: AP cost of next card reduced by 1**
  Setup: equip momentum_wheel; extend chain to length 2
  Check: next card's effective AP cost = printed - 1

- [ ] **thorn_mantle — gain thorns equal to block at turn start**
  Setup: equip thorn_mantle; end turn with 5 block; start new turn
  Check: playerStatusEffects contains thorns=5 at start of new turn

### 17.12 Additional Status Effect Combinations

- [ ] **Strength + Vulnerable on enemy — multiplicative stacking**
  Setup: enemy has strength=0, player has vulnerable applied to enemy; CC attack
  Check: damage = floor(baseCC × 1.5 × vulnerable_mult)

- [ ] **Poison + Burn simultaneously — both tick independently**
  Setup: enemy has poison=3 + burn=4; end turn
  Check: enemy loses 3 HP (poison tick) AND burn ticks (4 → 2 halved); independent resolution

- [ ] **Immunity blocks curse_of_doubt application**
  Setup: player has immunity; enemy plays curse_of_doubt effect
  Check: charge_damage_amp_percent NOT applied to player

- [ ] **Regen on player + ongoing damage — net HP delta correct**
  Setup: player has regen=5, takes 3 poison damage per turn; end turn
  Check: playerHp net change = +5 regen - 3 poison = +2 per turn

- [ ] **Multiple weakness stacks — linear damage reduction**
  Setup: player has weakness=3; play attack
  Check: attack damage reduced proportionally to weakness=3

- [ ] **Bleed + hemorrhage combo — hemorrhage consumes all stacks**
  Setup: enemy has bleed=8; play hemorrhage L5 (bleedMult=7)
  Check: damage includes 8 × 7 = 56 from bleed consumption; bleed stacks = 0 after

- [ ] **CW with curse_of_doubt active — amplified penalty**
  Setup: player has curse_of_doubt; CW an attack card
  Check: player CW feedback damage = normal_CW_feedback × (1 + 0.30)


---
