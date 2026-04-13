<!--
  Purpose: Card effect visual verification — attack/shield/buff/debuff/utility/wild VFX, mastery popups, card picker.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 2.1-2.8
-->

## SECTION 2 — CARD EFFECTS (Functional + Visual)

### 2.1 Attack Cards — Individual Visual Verification

- [ ] **strike — damage number floats on hit**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike'] })`, quick-play strike
  Check SS(): damage number visible floating above enemy

- [ ] **multi_hit — multiple damage numbers (multi-hit)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['multi_hit'] })`, play it
  Check SS(): 2+ damage numbers floating (or sequential animation)

- [ ] **heavy_strike — single large damage number**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'thesis_construct', hand:['heavy_strike'] })`, play it
  Check SS(): damage number larger value than strike

- [ ] **piercing — damage number (bypasses block)**
  Setup: `SC.patch({ turn:{ enemy:{ block:10 } } })`, `SC.forceHand(['piercing'])`, play it
  Check SS(): damage lands even with block

- [ ] **reckless — damage + self-damage visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['reckless'], playerHp:80 })`, play it
  Check SS(): enemy takes damage; player HP decreases

- [ ] **execute — instant-kill visual on low-HP enemy**
  Setup: `SC.patch({ turn:{ enemy:{ currentHP:5 } } })`, `SC.forceHand(['execute'])`, play it
  Check SS(): enemy death animation or HP drops to 0

- [ ] **lifetap — damage + player heals visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['lifetap'], playerHp:70 })`, play it
  Check SS(): enemy takes damage, player HP tick upward visible

- [ ] **power_strike — AP-scaling damage**
  Setup: `SC.patch({ turn:{ apCurrent:4 } })`, `SC.forceHand(['power_strike'])`, play it
  Check SS(): damage number reflects AP bonus

- [ ] **twin_strike — two hits in sequence**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['twin_strike'] })`, play it
  Check SS(): two damage numbers appear

- [ ] **iron_wave — damage + block combo**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['iron_wave'] })`, play it
  Check SS(): damage number AND block gain in player HP area

- [ ] **bash — damage + vulnerable debuff on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['bash'] })`, play it
  Check SS(): vulnerable status icon appears on enemy status bar

- [ ] **rupture — damage + bleed on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['rupture'] })`, charge correct
  Check SS(): bleed icon appears in enemy status bar

- [ ] **kindle — damage + burn on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['kindle'] })`, play it
  Check SS(): burn icon appears in enemy status bar

- [ ] **overcharge — damage scaling with AP**
  Setup: `SC.patch({ turn:{ apCurrent:5 } })`, `SC.forceHand(['overcharge'])`, play it
  Check SS(): large damage number

- [ ] **riposte — damage when player has block**
  Setup: `SC.patch({ turn:{ playerState:{ shield:5 } } })`, `SC.forceHand(['riposte'])`, play it
  Check SS(): damage number reflects block bonus

- [ ] **precision_strike — ignores enemy block**
  Setup: `SC.patch({ turn:{ enemy:{ block:8 } } })`, `SC.forceHand(['precision_strike'])`, play it
  Check SS(): enemy block doesn't absorb full damage

- [ ] **siphon_strike — damage + block gain**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['siphon_strike'] })`, play it
  Check SS(): enemy hit and player block increases

- [ ] **gambit — random damage variance**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['gambit'] })`, play it
  Check SS(): damage number appears (variance doesn't prevent rendering)

- [ ] **chain_lightning — damage + chain to second enemy (or splash)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['chain_lightning'] })`, charge correct
  Check SS(): lightning effect or double damage number

- [ ] **volatile_slash — damage + card forget**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['volatile_slash','strike','block'] })`, charge correct
  Check SS(): damage number + forget pile count increases (forget-pile-indicator shows if count > 0)

- [ ] **smite — bonus damage vs debuffed enemy**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'vulnerable',value:1,turnsRemaining:2}] } } })`, `SC.forceHand(['smite'])`, play it
  Check SS(): elevated damage number

- [ ] **feedback_loop — damage scales with enemy status count**
  Setup: multiple enemy statuses + `SC.forceHand(['feedback_loop'])`, play
  Check SS(): damage reflects stack count

- [ ] **recall — damage based on discard pile**
  Setup: `SC.patch({ turn:{ deck:{ discardPile:['card1','card2','card3'] } } })`, `SC.forceHand(['recall'])`, play it
  Check SS(): damage number present

- [ ] **hemorrhage — damage + bleed stack amplify**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'bleed',value:3,turnsRemaining:99}] } } })`, `SC.forceHand(['hemorrhage'])`, play it
  Check SS(): elevated damage

- [ ] **eruption — AoE / burst damage with animation**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['eruption'] })`, play it
  Check SS(): eruption visual effect, damage number

### 2.2 Shield Cards

- [ ] **block — block value shown in player shield area**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['block'] })`, play it
  Check LD(): player block element visible; SS(): shield number increments

- [ ] **thorns — thorns status badge applied**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['thorns'] })`, play it
  Check SS(): thorns icon in player status bar

- [ ] **reinforced — extra block on CC**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['reinforce'] })`, charge correct
  Check SS(): large block gain shown

- [ ] **emergency — high block in emergency**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['emergency'], playerHp:20 })`, play it
  Check SS(): significant block number

- [ ] **fortify (entrench) — block persists turn badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['fortify'] })`, play it
  Check SS(): fortify badge + block value carries to next turn

- [ ] **brace — block + conditional effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['brace'] })`, play it
  Check SS(): block granted

- [ ] **overheal — block exceeds max HP**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['overheal'], playerHp:100, playerMaxHp:100 })`, play it
  Check LD(): player HP bar shows overheal extension (different color or overflow segment); SS(): overheal visually distinct

- [ ] **parry — block with counter**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['parry'] })`, play it
  Check SS(): block applied

- [ ] **shrug_it_off — block with cleanse**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'weakness',value:1,turnsRemaining:2}] } } })`, `SC.forceHand(['shrug_it_off'])`, play it
  Check SS(): block applied AND weakness removed from player status bar

- [ ] **guard — flat block**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['guard'] })`, play it
  Check SS(): block applied

- [ ] **absorb — block + absorb mechanic**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['absorb'] })`, play it
  Check SS(): block value increases

- [ ] **reactive_shield — block scaling with enemy damage**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'thesis_construct', hand:['reactive_shield'] })`, play it
  Check SS(): block granted based on incoming damage

- [ ] **aegis_pulse — block pulse visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['aegis_pulse'] })`, play it
  Check SS(): block applied, potential pulse animation

- [ ] **burnout_shield — block with burnout mechanic**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['burnout_shield'] })`, play it
  Check SS(): block applied; check for burnout side effect badge

- [ ] **knowledge_ward — block scales with chain length**
  Setup: `SC.patch({ turn:{ chainLength:3, chainMultiplier:2.0 } })`, `SC.forceHand(['knowledge_ward'])`, play it
  Check SS(): elevated block value

- [ ] **bulwark — large block**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['bulwark'] })`, play it
  Check SS(): high block number

- [ ] **conversion (shield_bash) — block converted to damage**
  Setup: `SC.patch({ turn:{ playerState:{ shield:8 } } })`, `SC.forceHand(['conversion'])`, play it
  Check SS(): player block drops; enemy takes damage

- [ ] **ironhide — block + resistance**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['ironhide'] })`, play it
  Check SS(): block applied

### 2.3 Buff Cards

- [ ] **empower — Empower status badge in player bar**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['empower'] })`, play it
  Check SS(): empower icon visible in player status bar with value

- [ ] **quicken — Focus (AP reduction) badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['quicken'] })`, play it
  Check SS(): AP orb shows cost reduction OR quicken badge visible

- [ ] **focus — Focus badge with count**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['focus'] })`, play it
  Check SS(): focus orb icon visible

- [ ] **double_strike — Double Strike badge visible**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['double_strike'] })`, play it
  Check SS(): double strike badge in player status bar

- [ ] **ignite — Burn applies on next attack**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['ignite','strike'] })`, play ignite then strike
  Check SS(): burn icon appears on enemy

- [ ] **inscription_fury — Inscription of Fury active**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['inscription_fury'] })`, charge correct
  Check SS(): inscription overlay/badge visible in UI

- [ ] **inscription_iron — Inscription of Iron active**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['inscription_iron'] })`, charge correct
  Check SS(): inscription defense badge visible

- [ ] **warcry — permanent Strength badge (∞ turns)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['warcry'] })`, charge correct
  Check SS(): gold strength icon with ∞ turns visible in player status bar

- [ ] **momentum — momentum stacks visible**
  Setup: play multiple cards in sequence with momentum card
  Check SS(): momentum indicator visible

- [ ] **battle_trance — draw bonus visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['battle_trance'] })`, play it
  Check SS(): draw pile count increases or cards added to hand

- [ ] **inscription_wisdom — Inscription of Wisdom active**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['inscription_wisdom'] })`, charge correct
  Check SS(): wisdom inscription badge visible

- [ ] **frenzy — Frenzy attack buff visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['frenzy'] })`, play it
  Check SS(): frenzy buff badge visible

- [ ] **mastery_surge — Mastery Surge effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['mastery_surge'] })`, charge correct
  Check SS(): mastery popup or buff visible

- [ ] **war_drum — War Drum buff**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['war_drum'] })`, play it
  Check SS(): strength-like buff badge visible

- [ ] **forge — card upgrade visual from Forge popup**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['forge','strike','block'] })`, play forge
  Check SS(): CardPickerOverlay appears with card choices; after pick: upgraded card mastery popup visible

### 2.4 Debuff Cards

- [ ] **weaken — Drawing Blanks icon on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['weaken'] })`, play it
  Check SS(): purple weakness icon in enemy status bar

- [ ] **expose — Exposed (vulnerable) icon on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['expose'] })`, play it
  Check SS(): red vulnerable icon in enemy status bar

- [ ] **hex — Hex status on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['hex'] })`, play it
  Check SS(): hex debuff icon in enemy status bar

- [ ] **slow — Slow snail icon on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['slow'] })`, play it
  Check SS(): snail icon in enemy status bar with turns remaining

- [ ] **lacerate — Bleed icon on enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['lacerate'] })`, play it
  Check SS(): bleed icon in enemy status bar

- [ ] **stagger — Stagger debuff visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['stagger'] })`, play it
  Check SS(): stagger debuff badge visible on enemy

- [ ] **corrode — Corrode debuff visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['corrode'] })`, play it
  Check SS(): corrode icon in enemy status bar

- [ ] **curse_of_doubt — charge_damage_amp_percent on player**
  Setup: `SC.forceHand(['curse_of_doubt'])`, play it
  Check SS(): curse status badge on player side

- [ ] **mark_of_ignorance — charge_damage_amp_flat on player**
  Setup: `SC.forceHand(['mark_of_ignorance'])`, play it
  Check SS(): mark badge on player side

- [ ] **corroding_touch — layered corrode**
  Setup: `SC.forceHand(['corroding_touch'])`, play it
  Check SS(): corrosion badge on enemy

- [ ] **entropy — Entropy debuff chain**
  Setup: `SC.forceHand(['entropy'])`, play it
  Check SS(): entropy debuff badge visible

- [ ] **sap — Sap debuff (strength reduction)**
  Setup: `SC.forceHand(['sap'])`, play it
  Check SS(): negative buff or weakness icon on enemy

### 2.5 Utility Cards

- [ ] **cleanse — debuffs removed from player**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'poison',value:3,turnsRemaining:3},{type:'weakness',value:1,turnsRemaining:2}] } } })`, `SC.forceHand(['cleanse'])`, play it
  Check SS(): player status bar clears

- [ ] **scout — extra card drawn visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['scout'] })`, play it
  Check LD(): draw pile count decrements; SS(): new card appears in hand

- [ ] **recycle — card recycled to draw pile**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['recycle','strike'] })`, play recycle with target
  Check SS(): hand count decreases by 1, draw pile increases

- [ ] **foresight — enemy intent revealed ahead**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['foresight'] })`, play it
  Check SS(): foresight eye badge on player; intent telegraph visible (may already be shown)

- [ ] **conjure — CardPickerOverlay spawns for conjure card pick**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['conjure'] })`, charge correct
  Check SS(): CardPickerOverlay appears with card selection list; after pick: conjured card in hand

- [ ] **transmute — CardPickerOverlay for transmute target**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['transmute','strike','block'] })`, play transmute
  Check SS(): CardPickerOverlay shows current hand cards to transmute; after pick: transmuted card replaced

- [ ] **sift — multiple card discard/draw**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['sift','strike','block','heavy_strike'] })`, play sift
  Check SS(): hand refreshes with draw

- [ ] **scavenge — CardPickerOverlay for scavenge card recovery**
  Setup: `SC.patch({ turn:{ deck:{ discardPile:[/* cards */] } } })`, `SC.forceHand(['scavenge'])`, play it
  Check SS(): picker overlay shows discard cards to recover

- [ ] **swap — hand card swap visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['swap','strike','block'] })`, play swap
  Check SS(): card position swapped or replaced

- [ ] **archive — card archived from hand**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['archive','strike','block','heavy_strike'] })`, play archive
  Check SS(): one card exits hand; discard or forget pile indicator updates

- [ ] **reflex — draw after card play**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['reflex'] })`, play it
  Check SS(): draw pile decrements; new card appears in hand

- [ ] **recollect — card returned from discard**
  Setup: `SC.patch({ turn:{ deck:{ discardPile:['card_abc'] } } })`, `SC.forceHand(['recollect'])`, play it
  Check SS(): discard pile decrements; card appears in hand

- [ ] **synapse — draw + effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['synapse'] })`, play it
  Check SS(): card drawn, draw pile decrements

- [ ] **siphon_knowledge — knowledge/chain synergy draw**
  Setup: `SC.patch({ turn:{ chainLength:2 } })`, `SC.forceHand(['siphon_knowledge'])`, play it
  Check SS(): draw effect; chain counter possibly updates

- [ ] **tutor_card — tutor card search visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['tutor'] })`, play it
  Check SS(): tutor overlay or card draw from deck

- [ ] **immunity — Immunity status applied to player**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['immunity'] })`, play it
  Check SS(): blue shield mind icon in player status bar

### 2.6 Wild Cards

- [ ] **mirror — copies last played card**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike','mirror'] })`, play strike then mirror
  Check SS(): mirror plays strike effect again (damage number appears)

- [ ] **adapt — CardPickerOverlay for type choice**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['adapt'] })`, play it
  Check SS(): picker overlay appears for card type selection

- [ ] **overclock — Overclock badge + doubled effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['overclock','strike'] })`, play overclock then strike
  Check SS(): overclock badge visible; doubled damage number on strike

- [ ] **phase_shift — player evades or phased effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['phase_shift'] })`, play it
  Check SS(): phase shift visual effect (transparency or glow)

- [ ] **chameleon — card type changes**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['chameleon'] })`, play it
  Check SS(): card visual color/frame changes to new type

- [ ] **dark_knowledge — dark damage/draw effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['dark_knowledge'] })`, play it
  Check SS(): effect visual

- [ ] **chain_anchor — chain type locked badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['chain_anchor'] })`, play it
  Check SS(): chain anchor indicator visible (chain bar reflects lock)

- [ ] **unstable_flux — random effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['unstable_flux'] })`, play it
  Check SS(): one of multiple possible effect visuals

- [ ] **sacrifice — card sacrificed for power**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['sacrifice','strike','block'] })`, play sacrifice
  Check SS(): picker for sacrifice target; card removed from hand; buff applied

- [ ] **catalyst — doubles next effect**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['catalyst','strike'] })`, play catalyst then strike
  Check SS(): doubled damage number

- [ ] **mimic — copies enemy ability**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['mimic'] })`, play it
  Check SS(): mimic effect visible

- [ ] **aftershock — delayed damage or rebound**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['aftershock'] })`, play it then end turn
  Check SS(): aftershock damage appears at start of next turn

- [ ] **knowledge_bomb — massive damage on chain**
  Setup: `SC.patch({ turn:{ chainLength:4, chainMultiplier:2.5 } })`, `SC.forceHand(['knowledge_bomb'])`, play it
  Check SS(): large damage number explosion visual

### 2.7 Card Mastery Popups

- [ ] **Mastery Upgrade popup appears on correct charge**
  Setup: any card with masteryLevel < 5, charge correct
  Check SS(): green "Upgraded!" mastery popup visible above card area

- [ ] **Mastery Downgrade popup appears on wrong charge**
  Setup: any card, charge wrong
  Check SS(): red "Downgraded!" mastery popup visible

### 2.8 CardPickerOverlay — All Trigger Scenarios

- [ ] **Transmute overlay — shows hand cards, single select**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['transmute','strike','block','heavy_strike'] })`, play transmute
  Check SS(): overlay visible with 3 card choices, "Skip" button present, title "Transmute"

- [ ] **Conjure overlay — shows pool cards, single select**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['conjure'] })`, charge correct
  Check SS(): conjure overlay with pool cards

- [ ] **Adapt overlay — card type choice**
  Setup: play adapt
  Check SS(): overlay with type options

- [ ] **Forge overlay — shows upgradeable cards**
  Setup: play forge
  Check SS(): forge overlay shows upgrade candidates

- [ ] **Mimic overlay — shows enemy abilities**
  Setup: play mimic
  Check SS(): mimic overlay visible

- [ ] **Scavenge overlay — shows discard pile**
  Setup: has discard cards, play scavenge
  Check SS(): discard overlay with card list

- [ ] **Card immediately appears in hand after picking from Conjure overlay**
  Setup: conjure, pick a card
  Check LD(): hand count increments; SS(): new card visually in hand area

---
