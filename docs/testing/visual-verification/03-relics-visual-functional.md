<!--
  Purpose: Relic visual rendering + functional correctness.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 3.1-3.4 (visual), 12.1-12.3 (functional)
-->

## SECTION 3 — RELIC EFFECTS (Functional + Visual)

### 3.1 Relic Tray Rendering

- [ ] **Single relic in tray renders correctly**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['whetstone'] })`
  Check LD(): `.relic-slot` 1 item visible; SS(): whetstone icon in tray

- [ ] **5 relics (full tray) renders without overflow**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['whetstone','iron_shield','vitality_ring','swift_boots','gold_magnet'] })`
  Check LD(): 5 relic slots, all within viewport; SS(): all 5 icons visible in tray, no clipping

- [ ] **Relic trigger flash animation (triggered relic glows)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['whetstone'], hand:['strike'] })`, play strike
  Check SS(): whetstone briefly glows/animates

- [ ] **Relic tooltip on hover — correct name, description, rarity**
  Setup: 5-relic scenario above, hover over relic 2
  Check SS(): tooltip box visible with relic name and description text

### 3.2 Starter Common Relics (13)

- [ ] **whetstone — attack damage bonus visible in damage number**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['whetstone'], hand:['strike'] })`, play strike
  Check SS(): damage number higher than baseline

- [ ] **iron_shield — block bonus**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['iron_shield'], hand:['block'] })`, play block
  Check SS(): block value higher than baseline

- [ ] **vitality_ring — increased max HP shown in HP bar**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['vitality_ring'] })`
  Check LD(): player max HP element shows higher value; SS(): HP bar shows extended max

- [ ] **swift_boots — first-turn AP bonus**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['swift_boots'] })`
  Check SS(): AP orb shows +1 on first turn

- [ ] **gold_magnet — extra gold visible in reward screen**
  Setup: `SC.loadCustom({ screen:'rewardRoom', relics:['gold_magnet'] })`
  Check SS(): gold reward amount higher

- [ ] **merchants_favor — shop discount**
  Setup: `SC.loadCustom({ screen:'shopRoom', gold:500, relics:['merchants_favor'] })`
  Check SS(): shop item prices reduced

- [ ] **lucky_coin — gold bonus trigger flash**
  Setup: trigger lucky_coin (e.g. enemy kill)
  Check SS(): coin flash animation + gold gain notification

- [ ] **scavengers_eye — extra card draw**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['scavengers_eye'] })`
  Check LD(): hand shows +1 card from normal draw

- [ ] **quick_study — card mastery bonus**
  Setup: use quick_study relic in combat with charges
  Check SS(): mastery level increments faster

- [ ] **thick_skin — block at turn start**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['thick_skin'] })`, end turn
  Check SS(): player starts with block next turn

- [ ] **tattered_notebook — knowledge bonus**
  Setup: tattered_notebook in relic tray, correct charge
  Check SS(): relic flashes on trigger

- [ ] **battle_scars — HP bonus on enemy kill**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['battle_scars'], playerHp:80 })`, kill enemy
  Check SS(): player HP increases

- [ ] **brass_knuckles — multi-hit bonus**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['brass_knuckles'], hand:['multi_hit'] })`, play multi_hit
  Check SS(): extra hit damage number appears

### 3.3 Starter Uncommon Relics (Select Coverage)

- [ ] **herbal_pouch — cleanse on turn start**
  Setup: add poison/debuff to player, equip herbal_pouch, end turn
  Check SS(): debuff clears at turn start

- [ ] **steel_skin — damage reduction**
  Setup: equip steel_skin, take damage
  Check SS(): reduced damage number

- [ ] **last_breath — prevent death once**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['last_breath'], playerHp:5 })`, take lethal hit
  Check SS(): player survives at 1 HP, last_breath visual trigger flash

- [ ] **adrenaline_shard — AP bonus on damage taken**
  Setup: equip adrenaline_shard, take damage from enemy
  Check SS(): AP orb gains extra charge after enemy attack

- [ ] **volatile_core — explosion effect on kill**
  Setup: equip volatile_core, kill enemy with a card
  Check SS(): explosion/AoE damage visual when enemy dies

- [ ] **aegis_stone — block bonus after correct charge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['aegis_stone'] })`, charge correct
  Check SS(): block increases after correct quiz answer

- [ ] **regeneration_orb — HP regen badge**
  Setup: equip regeneration_orb
  Check SS(): regen icon in player status bar; HP recovers each turn

- [ ] **plague_flask — poison on enemy turn start**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['plague_flask'] })`, end turn
  Check SS(): poison icon appears on enemy at start of enemy turn

- [ ] **memory_nexus — mastery retention**
  Setup: equip memory_nexus, wrong charge
  Check SS(): mastery doesn't decrease (no downgrade popup despite wrong answer)

- [ ] **insight_prism — domain bonus**
  Setup: equip insight_prism with domain cards in hand
  Check SS(): card damage higher for domain match

- [ ] **blood_price — HP cost for AP**
  Setup: equip blood_price, start turn
  Check SS(): player loses HP but AP is increased

- [ ] **reckless_resolve — self-damage resistance**
  Setup: equip reckless_resolve, play reckless card
  Check SS(): reduced self-damage

- [ ] **overflow_gem — extra effect when block overflows**
  Setup: equip overflow_gem, play block when already have block
  Check SS(): overflow trigger visual

- [ ] **resonance_crystal — chain bonus**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['resonance_crystal'] })`, build chain
  Check SS(): relic flashes on chain extend; damage higher

- [ ] **pocket_watch — turn-based effect**
  Setup: equip pocket_watch, wait 3+ turns
  Check SS(): relic triggers on correct turn, visual flash

- [ ] **chain_link_charm — chain length bonus**
  Setup: equip chain_link_charm, build chain
  Check SS(): chain counter bar extends further

- [ ] **worn_shield — starting block**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['worn_shield'] })`
  Check SS(): player starts with block value > 0

- [ ] **bleedstone — bleed amplifier**
  Setup: equip bleedstone, apply bleed then attack
  Check SS(): elevated bleed damage numbers

- [ ] **ember_core — burn relic**
  Setup: equip ember_core, apply burn + attack
  Check SS(): burn triggers with extra damage

- [ ] **gamblers_token — critical hit visual**
  Setup: equip gamblers_token, play attacks
  Check SS(): occasional extra damage number (crit proc)

- [ ] **thoughtform — knowledge-synergy relic**
  Setup: equip thoughtform, charge correct
  Check SS(): relic triggers visually

- [ ] **scar_tissue — HP loss triggers block**
  Setup: equip scar_tissue, take damage
  Check SS(): block appears after taking HP damage

- [ ] **living_grimoire — card-play scaling**
  Setup: equip living_grimoire, play multiple cards in a turn
  Check SS(): damage increases with each card played

- [ ] **surge_capacitor — surge turn bonus**
  Setup: equip surge_capacitor, reach surge turn
  Check SS(): extra effect on surge turn, relic flashes

- [ ] **obsidian_dice — variable damage die**
  Setup: equip obsidian_dice, play cards
  Check SS(): damage numbers vary (die roll)

- [ ] **gladiators_mark — kill streak bonus**
  Setup: equip gladiators_mark, kill multiple enemies across floors
  Check SS(): relic charge count increases; damage bonus on trigger

### 3.4 Unlockable Rare/Legendary Relics (Select Coverage)

- [ ] **chain_reactor — chain damage cascade**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:['chain_reactor'] })`, build 3+ chain
  Check SS(): chain reaction damage numbers cascade

- [ ] **quicksilver_quill — speed bonus on correct answer**
  Setup: equip quicksilver_quill, charge correct quickly
  Check SS(): speed bonus multiplier shown

- [ ] **time_warp — extra turn effect**
  Setup: equip time_warp, trigger condition
  Check SS(): extra turn visual or AP reset

- [ ] **crit_lens — crit on mastery match**
  Setup: equip crit_lens, play high-mastery card
  Check SS(): crit! damage number or special animation

- [ ] **thorn_crown — thorns on damage taken**
  Setup: equip thorn_crown, take damage
  Check SS(): enemy takes thorns damage; thorn_crown relic flashes

- [ ] **bastions_will — block threshold effect**
  Setup: equip bastions_will, reach high block
  Check SS(): relic triggers at block threshold

- [ ] **festering_wound — stacking bleed relic**
  Setup: equip festering_wound, attack enemy with bleed
  Check SS(): bleed stacks higher per hit

- [ ] **capacitor — AP charge mechanic**
  Setup: equip capacitor, build AP charges
  Check SS(): capacitor charge counter shown (or relic has charge tracking visual)

- [ ] **double_down — double bet on correct charge**
  Setup: equip double_down, charge correct
  Check SS(): double damage number

- [ ] **scholars_crown — knowledge domain all-bonus**
  Setup: equip scholars_crown
  Check SS(): bonus on all correct charges

- [ ] **phoenix_feather — death prevention with rage state**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'algorithm', relics:['phoenix_feather'], playerHp:1 })`, take lethal hit
  Check SS(): phoenix revival visual, rage mode active (screen pulse or badge)

- [ ] **mirror_of_knowledge — card copy effect**
  Setup: equip mirror_of_knowledge, correct charge on strong card
  Check SS(): card effect echoes/doubles

- [ ] **red_fang — lifesteal on attacks**
  Setup: equip red_fang, attack enemy
  Check SS(): player heals + damage number simultaneously

- [ ] **soul_jar — death soul capture**
  Setup: equip soul_jar, kill enemy
  Check SS(): soul captured visual; jar charges up

- [ ] **null_shard — nullify enemy power**
  Setup: equip null_shard, face enemy with power badges
  Check SS(): power badge removed or nullified visual

- [ ] **hemorrhage_lens — bleed amplify on attack**
  Setup: equip hemorrhage_lens, attack bleeding enemy
  Check SS(): extra damage number from bleed amplification

- [ ] **inferno_crown — burn stack amplifier**
  Setup: equip inferno_crown, kindle/burn enemy, attack
  Check SS(): burn damage elevated

- [ ] **mind_palace — knowledge chain max bonus**
  Setup: equip mind_palace, build long chain
  Check SS(): exceptional chain multiplier shown

- [ ] **entropy_engine — entropy stacking**
  Setup: equip entropy_engine, use entropy card
  Check SS(): escalating entropy effect

- [ ] **bloodstone_pendant — HP-loss scaling**
  Setup: equip bloodstone_pendant, take damage
  Check SS(): attack power increases as HP drops

- [ ] **dragon_s_heart — full-HP bonus**
  Setup: equip dragon_s_heart, stay at full HP
  Check SS(): bonus damage from full-HP condition

- [ ] **omniscience — all-knowledge bonus**
  Setup: equip omniscience, correct charges across multiple domains
  Check SS(): massive multiplier shown

- [ ] **paradox_engine — paradox condition**
  Setup: equip paradox_engine, trigger wrong+correct cycle
  Check SS(): paradox visual effect

- [ ] **akashic_record — run-wide mastery bonus**
  Setup: equip akashic_record
  Check SS(): high-mastery card bonus evident

- [ ] **singularity (relic) — ultimate relic effect**
  Setup: equip singularity relic
  Check SS(): singularity effect visible when triggered

- [ ] **volatile_manuscript — self-damage for power**
  Setup: equip volatile_manuscript
  Check SS(): self-damage + power amplification visual

---

## Relic Functional Correctness

## SECTION 12 — RELIC FUNCTIONAL CORRECTNESS

For each relic, the test loads the relic via `SC.loadCustom({..., relics:['relic_id']})` or `SC.addRelic('relic_id')`, then verifies the trigger fires and produces the correct numeric or state change.

### 12.1 Starter Common Relics (13)

- [ ] **whetstone — attack damage +2 on all attacks**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter', relics:['whetstone'], hand:['strike']})`, QP strike
  Check: enemyHp delta = strike_base + 2 (vs no-relic baseline)

- [ ] **iron_shield — all shield cards grant +2 extra block**
  Setup: `SC.loadCustom({..., relics:['iron_shield'], hand:['block']})`, play block
  Check: playerBlock delta = block_base + 2

- [ ] **vitality_ring — max HP increased**
  Setup: `SC.loadCustom({..., relics:['vitality_ring']})`
  Check: `getCombatState().playerMaxHp` > default maxHp

- [ ] **swift_boots — first turn of each encounter grants +1 AP**
  Setup: `SC.loadCustom({..., relics:['swift_boots']})`, check first turn
  Check: `getCombatState().ap` = default + 1 on turn 1

- [ ] **gold_magnet — extra gold in rewards**
  Setup: `SC.loadCustom({screen:'rewardRoom', relics:['gold_magnet'], rewards:[{type:'gold',amount:30}]})`
  Check: displayed gold amount > 30 (gold_magnet bonus added)

- [ ] **merchants_favor — shop prices reduced**
  Setup: `SC.loadCustom({screen:'shopRoom', relics:['merchants_favor'], gold:500})`
  Check: item prices lower than default shop prices

- [ ] **lucky_coin — triggers extra gold on enemy kill**
  Setup: `SC.loadCustom({..., relics:['lucky_coin']})`, kill enemy
  Check: gold amount increases by lucky_coin bonus at encounter end

- [ ] **scavengers_eye — draw one extra card at turn start**
  Setup: `SC.loadCustom({..., relics:['scavengers_eye']})`, check hand size at turn start
  Check: hand size = default draw + 1

- [ ] **quick_study — mastery XP gain increased**
  Setup: `SC.loadCustom({..., relics:['quick_study']})`, correct charge
  Check: mastery progression faster than baseline (verify via masteryLevel increment speed)

- [ ] **thick_skin — gain 2 block at start of each player turn**
  Setup: `SC.loadCustom({..., relics:['thick_skin']})`, end turn, start new turn
  Check: `getCombatState().playerBlock` ≥ 2 at turn start (before any card play)

- [ ] **tattered_notebook — correct charge grants +1 flat damage to all attacks this turn**
  Setup: `SC.loadCustom({..., relics:['tattered_notebook'], hand:['strike']})`, correct charge, then QP strike
  Check: strike damage includes +1 bonus from tattered_notebook trigger

- [ ] **battle_scars — gain 3 HP on enemy kill**
  Setup: `SC.loadCustom({..., relics:['battle_scars'], playerHp:80})`, kill enemy
  Check: playerHp = 83 after kill

- [ ] **brass_knuckles — multi-hit attack gains +1 hit**
  Setup: `SC.loadCustom({..., relics:['brass_knuckles'], hand:['multi_hit']})`, play multi_hit
  Check: hit count is L0 hitCount + 1

### 12.2 Starter Uncommon Relics (Select)

- [ ] **herbal_pouch — cleanse 1 debuff at turn start**
  Setup: player has poison; `SC.loadCustom({..., relics:['herbal_pouch']})`, end turn
  Check: poison stacks reduced by 1 at next turn start

- [ ] **steel_skin — reduce all incoming damage by 2**
  Setup: `SC.loadCustom({..., relics:['steel_skin']})`, end turn, enemy attacks
  Check: player takes enemy_damage - 2

- [ ] **last_breath — prevent death once, survive at 1 HP**
  Setup: `SC.loadCustom({..., relics:['last_breath'], playerHp:5})`, take 10+ damage
  Check: playerHp = 1 (not 0 or dead); last_breath consumed (won't trigger again)

- [ ] **adrenaline_shard — +1 AP when player takes damage**
  Setup: `SC.loadCustom({..., relics:['adrenaline_shard']})`, end turn, enemy attacks
  Check: `getCombatState().ap` +1 after taking damage

- [ ] **volatile_core — enemy death causes 8 AoE splash**
  Setup: `SC.loadCustom({..., relics:['volatile_core']})`, kill enemy
  Check: encounter notes AoE explosion damage; in multi-enemy context next enemy takes 8 damage

- [ ] **aegis_stone — correct charge grants +3 block**
  Setup: `SC.loadCustom({..., relics:['aegis_stone']})`, correct charge
  Check: `getCombatState().playerBlock` += 3 after correct answer

- [ ] **regeneration_orb — regen 2 HP per turn**
  Setup: `SC.loadCustom({..., relics:['regeneration_orb'], playerHp:80})`, end turn
  Check: playerHp = 82 at start of next turn (regen tick)

- [ ] **plague_flask — encounter start: enemy gains 2 Poison**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter', relics:['plague_flask']})`
  Check: `getCombatState().enemyStatusEffects` contains `{type:'poison', value:2}` at combat start

- [ ] **memory_nexus — wrong charge does not decrease mastery**
  Setup: `SC.loadCustom({..., relics:['memory_nexus']})`, CW on a L1+ card
  Check: card masteryLevel unchanged after wrong answer

- [ ] **insight_prism — matching domain cards gain +3 damage**
  Setup: deck with domain-matching card; `SC.loadCustom({..., relics:['insight_prism']})`, play domain card
  Check: damage includes +3 domain bonus

- [ ] **blood_price — spend 3 HP to gain +1 AP at turn start**
  Setup: `SC.loadCustom({..., relics:['blood_price'], playerHp:50})`
  Check: each turn playerHp -= 3; ap += 1

- [ ] **reckless_resolve — reduce self-damage by 2**
  Setup: `SC.loadCustom({..., relics:['reckless_resolve'], hand:['reckless']})`, play reckless
  Check: player self-damage = reckless.selfDmg - 2

- [ ] **overflow_gem — extra effect when block already at max**
  Setup: player has max block; play another block card with overflow_gem
  Check: excess block triggers overflow_gem bonus

- [ ] **resonance_crystal — chain length +1 (or draw on chain extend)**
  Setup: `SC.loadCustom({..., relics:['resonance_crystal']})`, extend chain
  Check: relic triggers; chain bonus or draw occurs

- [ ] **pocket_watch — triggers effect every 3rd turn**
  Setup: `SC.loadCustom({..., relics:['pocket_watch']})`, end 3 turns
  Check: pocket_watch effect fires on turn 3

- [ ] **chain_link_charm — chain max multiplier cap increased**
  Setup: `SC.loadCustom({..., relics:['chain_link_charm']})`, build chain to max
  Check: chain multiplier can exceed standard max (3.5×)

- [ ] **worn_shield — start encounter with 4 block**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter', relics:['worn_shield']})`
  Check: `getCombatState().playerBlock` = 4 at combat start

- [ ] **bleedstone — attacks deal +50% damage to bleeding enemies**
  Setup: apply bleed to enemy; `SC.loadCustom({..., relics:['bleedstone']})`, attack
  Check: attack damage vs bleeding enemy = baseline × 1.5

- [ ] **ember_core — burn ticks deal +2 extra damage**
  Setup: apply burn to enemy; equip ember_core; end turn
  Check: burn tick damage includes +2 ember_core bonus

- [ ] **gambler_s_token — 20% chance of double damage on attacks**
  Setup: `SC.loadCustom({..., relics:['gambler_s_token'], hand:['strike']})`, play strike 10 times (batch)
  Check: damage varies; occasional 2× strike damage confirms crit proc

- [ ] **scar_tissue — gain 1 block per 5 HP lost this encounter**
  Setup: take 10 damage; equip scar_tissue; end turn
  Check: playerBlock includes +2 from scar_tissue scaling

- [ ] **living_grimoire — +1 damage per card played this turn**
  Setup: equip living_grimoire; play 3 non-attack cards then attack
  Check: attack damage = base + 3 (3 prior cards played)

- [ ] **surge_capacitor — surge turns grant double bonus AP**
  Setup: equip surge_capacitor; reach surge turn (turn 2, 6, 10…)
  Check: surge AP bonus = 2 (double the normal +1)

- [ ] **obsidian_dice — ±2 random variance on all attacks**
  Setup: equip obsidian_dice; play strike 5 times
  Check: damage varies between base-2 and base+2 across trials

- [ ] **gladiator_s_mark — +1 strength on encounter start**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter', relics:['gladiator_s_mark']})`
  Check: playerStatusEffects contains strength value≥1 at combat start

### 12.3 Unlockable Rare/Legendary Relics (Select)

- [ ] **chain_reactor — chain extends: deal 6 × chainLength splash damage**
  Setup: `SC.loadCustom({..., relics:['chain_reactor']})`, build chain to length 3, extend chain
  Check: enemyHp decreases by additional 18 (6 × 3) splash on chain-extend

- [ ] **quicksilver_quill — speed bonus on fast correct answer**
  Setup: `SC.loadCustom({..., relics:['quicksilver_quill']})`, answer quiz very quickly
  Check: damage multiplier higher than baseline for fast answer

- [ ] **time_warp — every 5th turn: extra turn granted**
  Setup: equip time_warp; play through 5 turns
  Check: on turn 5, player gets extra turn (AP restored mid-turn or bonus action)

- [ ] **crit_lens — L3+ card CC triggers 50% crit chance (1.5× damage)**
  Setup: `SC.loadCustom({..., relics:['crit_lens']})`, CC with L3 card multiple times
  Check: some CC hits deal 1.5× normal CC damage (crit fires)

- [ ] **thorn_crown — take damage: deal 5 thorns back to attacker**
  Setup: equip thorn_crown; end turn, enemy attacks
  Check: enemyHp decreases by 5 after attacking player

- [ ] **bastions_will — at 15+ block: attacks deal +4 bonus damage**
  Setup: `SC.patch({turn:{playerState:{shield:15}}})`, equip bastions_will; play strike
  Check: strike damage = base + 4 bonus

- [ ] **festering_wound — applying bleed also applies 1 extra bleed stack**
  Setup: equip festering_wound; play rupture (adds bleed)
  Check: bleed stacks = rupture bleed + 1 extra from festering_wound

- [ ] **capacitor — store charge on CC; release for damage on 5th charge**
  Setup: equip capacitor; correct charge 5 times
  Check: on 5th CC, capacitor releases stored energy (damage burst)

- [ ] **double_down — correct charge: double the effect value**
  Setup: `SC.loadCustom({..., relics:['double_down'], hand:['strike']})`, CC
  Check: strike CC damage = floor(qpValue × 1.5 × 2.0) (double_down doubles CC)

- [ ] **phoenix_feather — prevent death once; enter rage state**
  Setup: `SC.loadCustom({..., relics:['phoenix_feather'], playerHp:1})`, take 10+ damage
  Check: playerHp = 1 (survival); playerStatusEffects contains rage state

- [ ] **prismatic_shard — chain multiplier +0.5 per chain link**
  Setup: equip prismatic_shard; build chain length 3
  Check: effective chain multiplier = CHAIN_MULTIPLIERS[3] + (3 × 0.5) = 2.0 + 1.5 = 3.5

- [ ] **mirror_of_knowledge — correct charge repeats previous card's QP effect**
  Setup: equip mirror_of_knowledge; play strike QP, then correct charge any card
  Check: strike QP effect fires again on CC

- [ ] **red_fang — attacks heal player for 20% of damage dealt**
  Setup: equip red_fang; attack enemy for 10 damage
  Check: playerHp += 2 (20% of 10)

- [ ] **soul_jar — gain soul on enemy kill; release for damage**
  Setup: equip soul_jar; kill enemy
  Check: soul_jar charge count increases; release triggers damage

- [ ] **null_shard — strip one enemy power badge at encounter start**
  Setup: `SC.loadCustom({screen:'combat', enemy:'bookwyrm', relics:['null_shard']})`
  Check: one power badge removed from enemy at encounter start

- [ ] **hemorrhage_lens — attacking enemy with bleed: +50% attack damage**
  Setup: apply bleed to enemy; equip hemorrhage_lens; attack
  Check: attack damage = base × 1.5

- [ ] **inferno_crown — burn stacks: +1 burn damage per active burn stack on enemy**
  Setup: apply 5 burn to enemy; equip inferno_crown; end turn
  Check: burn tick damage = base + 5 extra

- [ ] **mind_palace — after 5-chain: +2 AP bonus**
  Setup: equip mind_palace; build chain to 5
  Check: `getCombatState().ap` += 2 when chain reaches 5

- [ ] **bloodstone_pendant — below 50% HP: +3 attack damage**
  Setup: equip bloodstone_pendant; drop to <50% HP; attack
  Check: attack damage = base + 3

- [ ] **dragon_s_heart — at full HP: CC deals +5 bonus damage**
  Setup: equip dragon_s_heart; playerHp = playerMaxHp; CC any attack
  Check: CC damage = normal CC + 5

- [ ] **chain_forge — chain break prevented once per turn**
  Setup: equip chain_forge; build chain 3; play off-color card
  Check: chain does NOT break (chain_forge consumed); chain continues

- [ ] **chromatic_chain — after chain break: next chain starts at length 2**
  Setup: equip chromatic_chain; break a chain; start new chain
  Check: chain counter shows length=2 immediately after first card of new chain

---
