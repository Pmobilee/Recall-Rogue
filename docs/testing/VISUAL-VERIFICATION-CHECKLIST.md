<!-- 
  Purpose: Master visual verification checklist for Docker-based testing.
  Sources: src/data/mechanics.ts, src/data/enemies.ts, src/data/relics/, 
           src/data/statusEffects.ts, src/data/enemyPowers.ts,
           src/dev/scenarioSimulator.ts, src/dev/playtestAPI.ts
  Last rebuilt: 2026-04-13
-->

# Recall Rogue — Visual Verification Checklist (Docker / `__rrScenario` + `__rrPlay`)

This is the master TODO checklist for every visual element verifiable through the Docker test infrastructure. Each item specifies the scenario setup, what to observe in the layout dump, and what to validate in the screenshot.

Legend for scenario setup notation:
- `SC.loadCustom(...)` = `__rrScenario.loadCustom({ ... })`
- `SC.patch(...)` = `__rrScenario.patch({ turn: {...}, run: {...} })`
- `SC.forceHand(...)` = `__rrScenario.forceHand([...])`
- `SC.addRelic(...)` = `__rrScenario.addRelic('id')`
- `LD()` = `__rrLayoutDump()` — spatial check
- `SS()` = `__rrScreenshotFile()` — pixel check

---

## SECTION 1 — STATUS EFFECTS & ENEMY PASSIVES (Layout Correctness)

### 1.1 Enemy Status Effect Bar — Baseline

- [ ] **Poison (enemy) renders with correct icon and stack count**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike'] })` then `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'poison',value:3,turnsRemaining:3}] } } })`
  Check LD(): `StatusEffectBar[position=enemy]` x/y is below HP bar, `gap:6px` flex row, icon visible; SS(): green poison icon with "3" label visible below enemy HP bar

- [ ] **Burn (enemy) renders correctly with halving indicator**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'burn',value:8,turnsRemaining:99}] } } })`
  Check LD(): burn icon present in enemy status row; SS(): orange fire icon with "8" label

- [ ] **Bleed (enemy) renders correctly**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'bleed',value:4,turnsRemaining:99}] } } })`
  Check SS(): red droplet icon with "4" label in enemy status bar

- [ ] **Strength (enemy) renders correctly with permanent sentinel**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'strength',value:2,turnsRemaining:9999}] } } })`
  Check SS(): gold strength icon with "∞" turns label (not raw "9999")

- [ ] **Weakness (enemy) renders correctly**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'weakness',value:1,turnsRemaining:2}] } } })`
  Check SS(): purple weakness icon with "2" turns remaining

- [ ] **Vulnerable (enemy) renders correctly**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'vulnerable',value:1,turnsRemaining:2}] } } })`
  Check SS(): red target icon in enemy status bar

- [ ] **Immunity (enemy) renders correctly**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'immunity',value:1,turnsRemaining:99}] } } })`
  Check SS(): blue shield icon visible

- [ ] **Regen (enemy) renders correctly**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'regen',value:3,turnsRemaining:3}] } } })`
  Check SS(): green heart icon with "3" label

- [ ] **All 8 core status effects on enemy simultaneously — no overflow, no wrapping outside container**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[ {type:'poison',value:3,turnsRemaining:3}, {type:'burn',value:6,turnsRemaining:99}, {type:'bleed',value:2,turnsRemaining:99}, {type:'strength',value:2,turnsRemaining:9999}, {type:'weakness',value:1,turnsRemaining:2}, {type:'vulnerable',value:1,turnsRemaining:2}, {type:'immunity',value:1,turnsRemaining:99}, {type:'regen',value:2,turnsRemaining:3} ] } } })`
  Check LD(): all 8 icons within viewport, no y-coordinate below HP bar + 60px; SS(): icons clearly readable, no overlap with enemy sprite

### 1.2 Player Status Effect Bar

- [ ] **Poison (player) renders correctly**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'poison',value:4,turnsRemaining:3}] } } })`
  Check SS(): poison indicator visible in player area

- [ ] **Strength (player) renders with permanent sentinel**
  Setup: via Warcry card: `SC.forceHand(['warcry'])`, play it; OR `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'strength',value:1,turnsRemaining:9999}] } } })`
  Check SS(): gold clarity icon with "∞" turns label

- [ ] **Regen (player) displays correctly**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'regen',value:5,turnsRemaining:3}] } } })`
  Check SS(): regen icon visible in player status area

- [ ] **charge_damage_amp_percent (player) — Curse of Doubt visual**
  Setup: `SC.forceHand(['curse_of_doubt'])`, play it; or `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'charge_damage_amp_percent',value:30,turnsRemaining:5}] } } })`
  Check SS(): curse status icon visible in player status bar

- [ ] **charge_damage_amp_flat (player) — Mark of Ignorance visual**
  Setup: similar to above with `charge_damage_amp_flat`
  Check SS(): mark icon visible

### 1.3 Display-Only Status Effects (non-combat, card-induced)

- [ ] **Thorns status badge on player renders**
  Setup: `SC.forceHand(['thorns'])`, quick-play it; or `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'thorns',value:3,turnsRemaining:1}] } } })`
  Check SS(): thorns icon visible

- [ ] **Empower status badge renders**
  Setup: `SC.forceHand(['empower'])`, play it
  Check SS(): empower icon visible in player status bar

- [ ] **Double Strike status badge renders**
  Setup: `SC.forceHand(['double_strike'])`, play it
  Check SS(): double strike badge visible

- [ ] **Focus status badge renders**
  Setup: `SC.forceHand(['focus'])`, play it
  Check SS(): focus orb icon visible

- [ ] **Foresight status badge renders**
  Setup: `SC.forceHand(['foresight'])`, play it
  Check SS(): foresight eye icon visible

- [ ] **Fortify (block persist) visual indicator**
  Setup: `SC.forceHand(['fortify'])`, play it
  Check SS(): fortify castle icon visible

- [ ] **Overclock badge renders**
  Setup: `SC.forceHand(['overclock'])`, play it
  Check SS(): overclock gear icon visible

- [ ] **Slow badge on enemy renders**
  Setup: `SC.forceHand(['slow'])`, play it (adds slow to enemy); OR `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'slow',value:1,turnsRemaining:2}] } } })`
  Check SS(): snail icon visible in enemy status bar

- [ ] **Stunned badge on enemy renders (after Pop Quiz correct charge)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'pop_quiz' })`, charge correct
  Check SS(): star/stunned icon visible on enemy status bar

- [ ] **Hardcover badge on enemy renders (The Textbook)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'textbook' })`
  Check SS(): hardcover/book icon visible in enemy status bar with armor value

- [ ] **Locked badge on enemy renders (Trick Question)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'trick_question' })`, charge wrong
  Check SS(): lock icon visible in enemy status bar

- [ ] **Freeze badge renders**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'freeze',value:1,turnsRemaining:2}] } } })`
  Check SS(): ice crystal icon visible

- [ ] **Brain Fog badge renders at fog level >= 7**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'brain_fog',value:8,turnsRemaining:99}] } } })`
  Check SS(): fog icon visible with fog level label

- [ ] **Flow State badge renders at fog level <= 2**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'flow_state',value:2,turnsRemaining:99}] } } })`
  Check SS(): sparkle icon visible with correct threshold description

- [ ] **accuracy_s (S Grade) badge renders**
  Setup: `SC.patch({ turn:{ playerState:{ statusEffects:[{type:'accuracy_s',value:1,turnsRemaining:99}] } } })`
  Check SS(): star "S Grade" badge visible

### 1.4 Enemy Power Badges — All 12 Types

- [ ] **QP Resist badge renders (e.g. page_flutter — chargeResistant)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter' })`
  Check LD(): `EnemyPowerBadges` positioned right of enemy, z-index 10; SS(): purple "QP Resist" badge icon visible

- [ ] **Chain Weak badge renders (e.g. bookmark_vine — chainVulnerable)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'bookmark_vine' })`
  Check SS(): green "Chain Weak" badge visible

- [ ] **QP Immune badge renders (enemy with quickPlayImmune)**
  Setup: use Librarian or any enemy with `quickPlayImmune`; `SC.loadCustom({ screen:'combat', enemy:'librarian' })`
  Check SS(): red "QP Immune" badge visible

- [ ] **QP Reduced badge renders (enemy with quickPlayDamageMultiplier fraction)**
  Setup: Find enemy with `quickPlayDamageMultiplier` < 1; `SC.loadCustom({ screen:'combat', enemy:'curriculum' })`
  Check SS(): yellow "QP Reduced" badge with percentage value

- [ ] **Chain Null badge renders (dunning_kruger — chainMultiplierOverride: 1.0)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'dunning_kruger' })`
  Check SS(): red "Chain Null" badge visible

- [ ] **Hardcover badge renders (textbook)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'textbook' })`
  Check SS(): blue "Hardcover" badge visible with initial armor value (16)

- [ ] **Punish Wrong badge renders (onPlayerChargeWrong hook)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'trick_question' })`
  Check SS(): red "Punish Wrong" badge visible

- [ ] **Punish Correct badge renders (onPlayerChargeCorrect hook)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'pop_quiz' })`
  Check SS(): orange "Punish Correct" badge visible

- [ ] **Punish Skip badge renders (onPlayerNoCharge hook)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'comparison_trap' })`
  Check SS(): orange "Punish Skip" badge visible

- [ ] **Escalates badge renders (onEnemyTurnStart enrage)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'all_nighter' })`
  Check SS(): red "Escalates" badge visible

- [ ] **Phase 2 badge renders (phaseTransitionAt, phase=1)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'bookwyrm' })`
  Check SS(): purple "Phase 2" badge visible before transition; verify badge disappears after patch to phase 2

- [ ] **Quiz Boss badge renders (quizPhases configured)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'final_exam' })`
  Check SS(): blue "Quiz Boss" badge visible

- [ ] **Stacking all applicable power badges simultaneously — no overflow beyond right edge of viewport**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'first_question' })` (has multiple passives)
  Check LD(): all badges within x <= viewport width; SS(): badges readable, not clipped

### 1.5 Status Effects During Quiz Active State

- [ ] **Enemy status bar remains visible during quiz backdrop (z-index: 25)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter' })`, `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'poison',value:3,turnsRemaining:3},{type:'burn',value:4,turnsRemaining:99}] } } })`, play a charge card to trigger quiz
  Check LD(): `.status-effect-bar-enemy` z-index > 25 (or override applied); SS(): status icons visible above quiz backdrop

- [ ] **Enemy power badges remain visible during quiz overlay**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'bookwyrm' })`, play charge card
  Check LD(): `.enemy-power-badges` z-index >= 26 per `.layout-landscape.quiz-active .enemy-power-badges`; SS(): badges visible while quiz panel open

- [ ] **Enemy name header visible during quiz**
  Setup: any combat with charge card, trigger quiz
  Check SS(): enemy name visible above quiz backdrop

- [ ] **Enemy intent bubble hidden during quiz (cardPlayStage === 'committed')**
  Setup: play charge card, observe committed state
  Check LD(): intent bubble not rendered; SS(): no intent bubble obscuring quiz

- [ ] **Layout: landscape quiz — enemy shifts right, status effects follow**
  Setup: landscape viewport `(1280×720)`, `SC.loadCustom({ screen:'combat', enemy:'page_flutter' })`, play charge card
  Check LD(): enemy sprite x > viewport_width/2; status bar x matches enemy x region; SS(): enemy in right panel, quiz on left

---

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

## SECTION 4 — ENEMY-SPECIFIC BEHAVIORS (Visual)

### 4.1 Common Enemies

- [ ] **page_flutter — swoop animation in portrait**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter' })`
  Check SS(): sprite renders, no placeholder rectangle; idle animation running

- [ ] **thesis_construct — golem sprite in portrait**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'thesis_construct' })`
  Check SS(): thesis_construct sprite visible; correct size (common tier)

- [ ] **mold_puff — mold enemy sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'mold_puff' })`
  Check SS(): sprite renders

- [ ] **crib_sheet — paper/note enemy sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'crib_sheet' })`
  Check SS(): sprite renders

- [ ] **ink_slug — slug enemy sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'ink_slug' })`
  Check SS(): sprite renders; correct positioning

- [ ] **bookmark_vine — vine enemy (chainVulnerable badge)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'bookmark_vine' })`
  Check SS(): sprite + green Chain Weak badge

- [ ] **staple_bug — bug enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'staple_bug' })`
  Check SS(): sprite renders

- [ ] **margin_gremlin — gremlin enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'margin_gremlin' })`
  Check SS(): sprite renders

- [ ] **index_weaver — weaver enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'index_weaver' })`
  Check SS(): sprite renders

- [ ] **overdue_golem — golem enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'overdue_golem' })`
  Check SS(): sprite renders; larger than common

- [ ] **pop_quiz (common variant) — test sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'pop_quiz' })`
  Check SS(): sprite renders; Punish Correct + Punish Skip badges visible

- [ ] **eraser_worm — worm enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'eraser_worm' })`
  Check SS(): sprite renders

- [ ] **citation_needed — floating citation enemy**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'citation_needed' })`
  Check SS(): sprite renders

- [ ] **All remaining common enemies render without placeholder rectangles** (batch):
  Each of: `spark_note`, `watchdog`, `red_herring`, `anxiety_tick`, `dropout`, `brain_fog`, `thesis_dragon`, `burnout`, `information_overload`, `rote_memory`, `outdated_fact`, `hidden_gem`, `rushing_student`, `echo_chamber`, `blank_spot`, `grade_curve`, `burnout_phantom`, `prismatic_jelly`, `ember_skeleton`, `moth_of_enlightenment`, `hyperlink`, `unknown_unknown`, `fake_news`, `gut_feeling`, `bright_idea`, `sacred_text`, `devils_advocate`, `institution`, `rosetta_slab`
  Setup per enemy: `SC.loadCustom({ screen:'combat', enemy:'ENEMY_ID' })`
  Check SS(): sprite visible (not solid color rectangle placeholder); HP bar visible

### 4.2 Elite Enemies

- [ ] **bookwyrm (elite) — Phase 2 badge + large sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'bookwyrm' })`
  Check SS(): elite-tier sprite (larger than common); Phase 2 badge visible; QP Resist badge

- [ ] **peer_reviewer (elite) — power badges**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'peer_reviewer' })`
  Check SS(): elite sprite; Punish Skip badge visible

- [ ] **librarian (elite) — QP Immune + Escalates**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'librarian' })`
  Check SS(): librarian sprite; QP Immune (or QP Reduced) badge + Escalates badge

- [ ] **deadline_serpent (elite) — serpent sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'deadline_serpent' })`
  Check SS(): serpent sprite; elite HP bar size

- [ ] **standardized_test (elite) — test enemy sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'standardized_test' })`
  Check SS(): sprite renders with elite badge area

- [ ] **emeritus, student_debt, publish_or_perish, dunning_kruger, singularity (elites)**
  Setup per enemy: `SC.loadCustom({ screen:'combat', enemy:'ENEMY_ID' })`
  Check SS(): each renders correctly at elite scale

### 4.3 Mini-Bosses

- [ ] **tenure_guardian (mini-boss) — large portrait sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'tenure_guardian' })`
  Check SS(): mini-boss tier sprite visibly larger than elite

- [ ] **plagiarist (mini-boss) — plagiarist sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'plagiarist' })`
  Check SS(): sprite renders; power badges visible

- [ ] **proctor (mini-boss) — proctor sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'proctor' })`
  Check SS(): proctor sprite; intent telegraph shown

- [ ] **grade_dragon (mini-boss) — dragon sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'grade_dragon' })`
  Check SS(): dragon sprite at mini-boss scale

- [ ] **comparison_trap (mini-boss) — Punish Skip**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'comparison_trap' })`
  Check SS(): sprite; Punish Skip badge prominent

- [ ] **card_catalogue (mini-boss) — catalogue sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'card_catalogue' })`
  Check SS(): mini-boss sprite

- [ ] **headmistress (mini-boss) — Detention mechanic badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'headmistress' })`
  Check SS(): headmistress sprite; power badges shown; 2 highest-mastery cards should be exhausted at encounter start (check forget pile indicator)

- [ ] **tutor (mini-boss) — Punish Wrong double-attack**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'tutor' })`
  Check SS(): tutor sprite; Punish Wrong badge

- [ ] **study_group (mini-boss) — group entity sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'study_group' })`
  Check SS(): sprite renders at mini-boss scale

- [ ] **textbook (mini-boss) — Hardcover armor visible in badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'textbook' })`
  Check SS(): textbook sprite; Hardcover badge showing "16"; hardcover armor visible in enemy status bar

- [ ] **trick_question (mini-boss) — lock mechanic badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'trick_question' })`, charge wrong
  Check SS(): Locked badge appears in enemy status bar after wrong charge

- [ ] **All remaining mini-bosses render at correct scale**: `harsh_grader`, `imposter_syndrome`, `pressure_cooker`, `perfectionist`, `hydra_problem`, `ivory_tower`, `helicopter_parent`, `first_question`, `dean`, `dissertation`, `eureka`, `paradigm_shift`, `ancient_tongue`, `lost_thesis`
  Setup per enemy: `SC.loadCustom({ screen:'combat', enemy:'ENEMY_ID' })`
  Check SS(): sprite at mini-boss scale, HP bar proportional

### 4.4 Boss Enemies

- [ ] **final_exam (boss) — boss-tier sprite + Quiz Boss badge**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'final_exam' })`
  Check SS(): massive sprite; Quiz Boss + Phase 2 badges; boss HP bar styled distinctly

- [ ] **burning_deadline (boss) — burning sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'burning_deadline' })`
  Check SS(): boss sprite; potential fire effect; Phase 2 badge

- [ ] **algorithm (boss) — algorithm sprite with phase badges**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'algorithm' })`
  Check SS(): boss sprite; Phase 2 badge; Quiz Boss badge

- [ ] **curriculum (boss) — curriculum sprite + QP override at phase 2**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'curriculum', enemyHp:10 })` (near phase threshold)
  Check SS(): boss sprite; phase 2 transition visual if HP < threshold

- [ ] **group_project (boss) — group boss sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'group_project' })`
  Check SS(): boss sprite renders at full scale

- [ ] **rabbit_hole (boss) — rabbit hole sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'rabbit_hole' })`
  Check SS(): boss sprite

- [ ] **omnibus (boss) — omnibus/library boss sprite**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'omnibus' })`
  Check SS(): boss sprite

- [ ] **final_lesson (boss) — final lesson boss**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'final_lesson' })`
  Check SS(): boss sprite; power badges; massive HP bar

### 4.5 Phase Transition Visual

- [ ] **Enemy phase 1 → phase 2 transition: sprite/color change visible**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'bookwyrm', enemyHp:20 })`, attack down to below 50% HP
  Check SS(): enemy sprite or color changes; Phase 2 badge disappears; phase 2 intent pool active (intent telegraph changes)

- [ ] **Quiz Boss HP threshold pause — quiz overlay spawns mid-combat**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'final_exam' })`, reduce enemy to 50% HP
  Check SS(): quiz boss overlay appears (quiz panel with count-down), combat paused

### 4.6 Enemy HP/Block Display

- [ ] **Enemy block value shown with shield icon**
  Setup: `SC.patch({ turn:{ enemy:{ block:8 } } })`
  Check SS(): shield icon left of HP bar showing "8"

- [ ] **Enemy at very low HP — HP bar color change or pulse**
  Setup: `SC.patch({ turn:{ enemy:{ currentHP:2 } } })`
  Check SS(): enemy HP bar red/critical state

- [ ] **Enemy HP bar correct width proportional to current/max HP**
  Setup: `SC.patch({ turn:{ enemy:{ currentHP:30, maxHP:100 } } })`
  Check LD(): HP bar fill width approximately 30% of bar width

---

## SECTION 5 — ROOM / SCREEN VISUAL CORRECTNESS

### 5.1 Combat Screen

- [ ] **Portrait combat — full layout (412×915 viewport)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike','block','heavy_strike','expose','lifetap'] })`
  Check LD(): enemy at top, AP orb mid-right, hand cards at bottom, draw/discard piles at bottom corners, end turn button visible; SS(): no overflow

- [ ] **Landscape combat — full layout (1280×720 viewport)**
  Setup: same but with landscape viewport
  Check LD(): enemy in right 30% panel, quiz area left 70%; SS(): all elements correctly positioned for landscape

- [ ] **AP Orb state — full (green)**
  Setup: `SC.patch({ turn:{ apCurrent:3, apMax:3 } })`
  Check SS(): AP orb green with "3" label

- [ ] **AP Orb state — partial (yellow)**
  Setup: `SC.patch({ turn:{ apCurrent:1, apMax:3 } })`
  Check SS(): AP orb yellow/amber with "1"

- [ ] **AP Orb state — empty (red/grey)**
  Setup: `SC.patch({ turn:{ apCurrent:0, apMax:3 } })`
  Check SS(): AP orb grey/red with "0"

- [ ] **Draw pile indicator — shows correct count and stack visual**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter' })`
  Check LD(): draw pile indicator in bottom-left; SS(): count label correct (e.g. "12"), stacked card visual proportional to count

- [ ] **Discard pile indicator — shows correct count**
  Setup: play a card, check discard pile
  Check LD(): discard pile indicator bottom-right; SS(): count increments after playing card

- [ ] **Forget pile indicator — appears only when forgetPileCount > 0**
  Setup: `SC.patch({ turn:{ deck:{ forgetPile:['card1','card2'] } } })`
  Check LD(): `[data-testid="forget-pile-indicator"]` present; SS(): "✕ 2" label visible; not present when 0 cards

- [ ] **Chain counter bar — shows active chain color at chain=0 (no chain)**
  Setup: `SC.patch({ turn:{ activeChainColor:0, chainLength:0, chainMultiplier:1.0 } })`
  Check LD(): `[data-testid="active-chain-bar"]` present; SS(): chain color bar shows "Play to chain!" or similar

- [ ] **Chain counter bar — shows multiplier and length at chain=3**
  Setup: `SC.patch({ turn:{ activeChainColor:2, chainLength:3, chainMultiplier:1.8 } })`
  Check SS(): chain bar shows "×1.8" multiplier; chain type color matches; tier-3 styling

- [ ] **Chain counter bar — all 6 chain type colors**
  For each chain type 0-5: `SC.patch({ turn:{ activeChainColor:N, chainLength:1, chainMultiplier:1.2 } })`
  Check SS(): bar uses correct distinct color per type

- [ ] **Chain break animation — multiplier drop triggers breakKey**
  Setup: build chain then play off-color card
  Check SS(): chain bar shows break animation (shake)

- [ ] **Perfect turn indicator on chain bar**
  Setup: `SC.patch({ turn:{ isPerfectTurn:true, chainLength:3, chainMultiplier:2.0 } })`
  Check SS(): perfect-turn CSS class applied to chain bar (golden glow or special styling)

- [ ] **Enemy intent telegraph visible and correctly formatted**
  Setup: any combat scenario
  Check LD(): intent bubble positioned below/near enemy HP; SS(): intent text and icon visible, color matches intent type

- [ ] **Intent bubble: attack intent (red)**
  Setup: `SC.patch({ turn:{ enemy:{ nextIntent:{ type:'attack', value:12, weight:1, telegraph:'Swooping strike' } } } })`
  Check SS(): red intent bubble with "⚔" icon and damage value

- [ ] **Intent bubble: defend intent (blue)**
  Setup: `SC.patch({ turn:{ enemy:{ nextIntent:{ type:'defend', value:10, weight:1, telegraph:'Wing cover' } } } })`
  Check SS(): blue intent bubble with shield icon

- [ ] **Intent bubble: buff intent (gold)**
  Setup: `SC.patch({ turn:{ enemy:{ nextIntent:{ type:'buff', value:2, weight:1, telegraph:'Screeching' } } } })`
  Check SS(): gold intent bubble with buff icon

- [ ] **Intent bubble: multi_attack intent (red, multiple hits)**
  Setup: `SC.patch({ turn:{ enemy:{ nextIntent:{ type:'multi_attack', value:4, hitCount:3, weight:1, telegraph:'Triple strike' } } } })`
  Check SS(): multi-attack intent shows hit count

- [ ] **Intent bubble: fully blocked (grey with strikethrough)**
  Setup: `SC.patch({ turn:{ playerState:{ shield:20 }, enemy:{ nextIntent:{ type:'attack', value:8, weight:1, telegraph:'Weak strike' } } } })`
  Check LD(): `[data-intent-blocked="true"]`; SS(): intent bubble grey with blocked styling

- [ ] **Enemy charging indicator when isCharging=true**
  Setup: `SC.patch({ turn:{ enemy:{ isCharging:true, chargedDamage:25 } } })`
  Check SS(): charged attack intent visible with high damage value

- [ ] **Turn banner — "Player Turn" / "Enemy Turn" banner transitions**
  Setup: normal combat, end turn
  Check SS(): turn banner flashes at turn start

- [ ] **Surge border overlay — active on surge turns**
  Setup: `SC.patch({ turn:{ isSurge:true } })`
  Check SS(): SurgeBorderOverlay pulsing border visible around screen

- [ ] **Low-HP vignette — visible at <= 40% HP**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', playerHp:35, playerMaxHp:100 })`
  Check SS(): red vignette visible at screen edges

- [ ] **Critical HP vignette pulse — visible at <= 25% HP**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', playerHp:20, playerMaxHp:100 })`
  Check SS(): pulsing critical red vignette; `.critical-hp` class applied

- [ ] **Damage shake animation — screen shakes on player taking damage**
  Setup: combat, end turn and take enemy damage
  Check SS(): briefly captures `.damage-shaking` class on overlay

- [ ] **Near-death tension — CSS class and Phaser sync**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', playerHp:5, playerMaxHp:100 })`
  Check LD(): `.near-death-tension` class on overlay; SS(): atmospheric darkening or color shift

- [ ] **Expert mode badge visible when active**
  Setup: use expert mode preset
  Check SS(): `[data-testid="expert-mode-badge"]` visible

- [ ] **Boss intro overlay on boss encounter entry**
  Setup: navigate to boss combat
  Check SS(): BossIntroOverlay shows boss name and cutscene-style intro animation

### 5.2 Shop Room

- [ ] **Shop room full layout**
  Setup: `SC.loadCustom({ screen:'shopRoom', gold:500 })`
  Check LD(): shop items rendered in grid, gold display top, buy buttons; SS(): shop layout correct

- [ ] **Shop items: relics listed with icon + price**
  Setup: `SC.loadCustom({ screen:'shopRoom', gold:500, shopRelics:['whetstone','iron_shield'] })`
  Check SS(): relic icons with price labels visible

- [ ] **Shop items: cards listed with mechanic name + price**
  Setup: `SC.loadCustom({ screen:'shopRoom', gold:500, shopCards:['heavy_strike','lifetap','block'] })`
  Check SS(): card items with price labels

- [ ] **Card removal service available in shop**
  Setup: shop scenario with player having cards
  Check SS(): "Remove Card" option visible

- [ ] **Insufficient gold — items greyed out**
  Setup: `SC.loadCustom({ screen:'shopRoom', gold:10 })` (less than any item cost)
  Check SS(): buy buttons disabled or greyed; items visually distinct from affordable ones

- [ ] **Haggle button visible**
  Setup: shop scenario
  Check LD(): `[data-testid="shop-btn-haggle"]` present; SS(): haggle button renders

- [ ] **Purchase confirmation modal**
  Setup: attempt to buy item
  Check SS(): `[data-testid="shop-purchase-modal"]` visible with confirm/cancel buttons

- [ ] **Leave shop button visible**
  Setup: shop scenario
  Check LD(): `[data-testid="btn-leave-shop"]` present

### 5.3 Rest Site

- [ ] **Rest room full layout**
  Setup: `SC.loadCustom({ screen:'restRoom' })`
  Check LD(): heal, upgrade, study options visible; SS(): rest room UI with campfire visual

- [ ] **Heal option available when HP < max**
  Setup: `SC.loadCustom({ screen:'restRoom', playerHp:70, playerMaxHp:100 })`
  Check SS(): `[data-testid="rest-heal"]` button active; heal amount shown

- [ ] **Heal option greyed when at max HP**
  Setup: `SC.loadCustom({ screen:'restRoom', playerHp:100, playerMaxHp:100 })`
  Check SS(): heal button disabled or greyed

- [ ] **Upgrade option visible**
  Setup: `SC.loadCustom({ screen:'restRoom' })`
  Check LD(): `[data-testid="rest-study"]` or upgrade button present

- [ ] **Meditate option visible**
  Setup: rest room scenario
  Check LD(): `[data-testid="rest-meditate"]` present

- [ ] **Post-mini-boss rest with upgrade candidates**
  Setup: `SC.loadCustom({ screen:'postMiniBossRest', hand:['strike','block','heavy_strike','multi_hit','lifetap'] })`
  Check SS(): upgrade candidates listed; PostMiniBossRestOverlay renders

### 5.4 Mystery Events (30+ events)

For each mystery event, verify the event-specific UI renders correctly.

- [ ] **tutors_office — tutor's office event UI**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'tutors_office' })`
  Check SS(): event title, description, choice buttons visible; correct background

- [ ] **rival_student — rival student event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'rival_student', floor:4 })`
  Check SS(): event UI with combat option visible

- [ ] **knowledge_gamble — gamble event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'knowledge_gamble', floor:10 })`
  Check SS(): gamble choices visible

- [ ] **reading_nook — reading nook**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'reading_nook' })`
  Check SS(): event rendered correctly

- [ ] **flashcard_merchant — merchant event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'flashcard_merchant' })`
  Check SS(): merchant event UI with buy options

- [ ] **whispering_shelf — shelf event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'whispering_shelf' })`
  Check SS(): event rendered

- [ ] **dust_and_silence — dungeon ambience event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'dust_and_silence' })`
  Check SS(): atmospheric event UI

- [ ] **lost_notebook — notebook event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'lost_notebook' })`
  Check SS(): event with reward option

- [ ] **lost_and_found — found item event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'lost_and_found' })`
  Check SS(): event rendered with item options

- [ ] **strict_librarian — librarian event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'strict_librarian' })`
  Check SS(): strict librarian event UI

- [ ] **wrong_answer_museum — museum event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'wrong_answer_museum' })`
  Check SS(): museum event UI

- [ ] **copyists_workshop — workshop event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'copyists_workshop' })`
  Check SS(): workshop event rendered

- [ ] **strange_mushrooms — mushroom event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'strange_mushrooms' })`
  Check SS(): mushroom event UI

- [ ] **ambush — ambush combat event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'ambush' })`
  Check SS(): ambush event combat prompt visible

- [ ] **donation_box — donation event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'donation_box' })`
  Check SS(): donation UI rendered

- [ ] **double_or_nothing — gamble event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'double_or_nothing' })`
  Check SS(): bet UI visible

- [ ] **speed_round — speed quiz event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'speed_round' })`
  Check SS(): speed round event with timer visible

- [ ] **knowing_skull — skull event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'knowing_skull' })`
  Check SS(): skull event UI

- [ ] **burning_library — library fire event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'burning_library' })`
  Check SS(): fire-themed event UI

- [ ] **mirror_scholar — scholar mirror event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'mirror_scholar' })`
  Check SS(): mirror scholar event UI

- [ ] **merchant_of_memories — merchant event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'merchant_of_memories' })`
  Check SS(): memories merchant UI

- [ ] **cache_of_contraband — contraband cache event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'cache_of_contraband' })`
  Check SS(): cache event rendered

- [ ] **wishing_well — wishing well event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'wishing_well' })`
  Check SS(): wishing well event UI

- [ ] **study_group (mystery) — study group event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'study_group' })`
  Check SS(): study group event rendered

- [ ] **card_roulette — card roulette event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'card_roulette' })`
  Check SS(): roulette UI visible

- [ ] **fact_or_fiction — trivia event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'fact_or_fiction' })`
  Check SS(): fact/fiction quiz prompt

- [ ] **forbidden_section — forbidden room event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'forbidden_section' })`
  Check SS(): forbidden section UI

- [ ] **the_purge — deck purge event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'the_purge' })`
  Check SS(): purge card selection UI

- [ ] **meditation_chamber — meditation event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'meditation_chamber' })`
  Check SS(): meditation chamber UI

- [ ] **eraser_storm — eraser storm event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'eraser_storm' })`
  Check SS(): storm event UI

- [ ] **elite_ambush — elite combat event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'elite_ambush' })`
  Check SS(): elite ambush battle prompt

- [ ] **desperate_bargain — bargain event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'desperate_bargain' })`
  Check SS(): bargain UI with risky offer

- [ ] **the_breakthrough — breakthrough event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'the_breakthrough' })`
  Check SS(): breakthrough event UI

- [ ] **the_epiphany — epiphany event**
  Setup: `SC.loadCustom({ screen:'mysteryEvent', mysteryEventId:'the_epiphany' })`
  Check SS(): epiphany event UI

- [ ] **mystery continue button present on all events**
  For any mystery event: Check LD(): `[data-testid="mystery-continue"]` is present

### 5.5 Card Reward Screen

- [ ] **Card reward — 3 cards displayed correctly**
  Setup: `SC.loadCustom({ screen:'cardReward', cardRewardMechanics:['heavy_strike','block','lifetap'] })`
  Check LD(): 3 reward-card elements; SS(): all 3 cards visible with art and names

- [ ] **Card reward — attack, shield, buff variety**
  Setup: `SC.loadCustom({ screen:'cardReward', cardRewardMechanics:['strike','reinforce','empower'] })`
  Check SS(): different card frames for different types

- [ ] **Skip card reward button present**
  Setup: card reward scenario
  Check LD(): skip/pass button visible; SS(): button accessible

- [ ] **Reward reroll button present (if applicable)**
  Setup: card reward with reroll available
  Check LD(): `[data-testid="reward-reroll"]`

### 5.6 Reward Room

- [ ] **Reward room with mixed rewards**
  Setup: `SC.loadCustom({ screen:'rewardRoom', rewards:[{type:'gold',amount:50},{type:'card',mechanicId:'heavy_strike'},{type:'health_vial',size:'large',healAmount:30}] })`
  Check SS(): gold pile, card, and health vial all visible with correct labels

- [ ] **Reward room with relic reward**
  Setup: `SC.loadCustom({ screen:'rewardRoom', rewards:[{type:'relic',relicId:'whetstone'},{type:'gold',amount:30}] })`
  Check SS(): relic icon visible; gold reward; continue button

- [ ] **Continue button visible**
  Setup: reward room scenario
  Check LD(): `[data-testid="btn-reward-room-continue"]` present

- [ ] **Accept relic button for relic rewards**
  Setup: relic reward scenario
  Check LD(): `[data-testid="btn-reward-room-relic-accept"]` present

### 5.7 Dungeon Map

- [ ] **Dungeon map renders with node graph**
  Setup: `SC.loadCustom({ screen:'dungeonMap' })`
  Check LD(): `[data-testid="dungeon-map"]` present; node elements visible; SS(): map grid with room types

- [ ] **Boss preview banner shows at floor 5**
  Setup: `SC.loadCustom({ screen:'dungeonMap', floor:5 })`
  Check SS(): `[data-testid="boss-preview-banner"]` visible with boss image/name

- [ ] **Map nodes selectable (room-choice buttons)**
  Setup: dungeon map scenario
  Check LD(): `[data-testid="map-node-{id}"]` elements present; SS(): clickable room nodes

- [ ] **Floor counter shown on map**
  Setup: `SC.loadCustom({ screen:'dungeonMap', floor:3 })`
  Check SS(): floor indicator showing "Floor 3" or equivalent

### 5.8 Retreat or Delve Screen

- [ ] **Retreat or delve options visible**
  Setup: `SC.loadCustom({ screen:'retreatOrDelve', gold:200, floor:3 })`
  Check LD(): `[data-testid="btn-retreat"]` and `[data-testid="btn-delve"]` both present; SS(): both buttons visible with rewards/penalties shown

### 5.9 Run End Screens

- [ ] **Victory screen renders correctly**
  Setup: `SC.loadCustom({ screen:'runEnd', runEndResult:'victory', floor:10, runEndStats:{...} })`
  Check SS(): victory heading; stats visible (accuracy, floor, encounters); share button present

- [ ] **Defeat screen renders correctly**
  Setup: `SC.loadCustom({ screen:'runEnd', runEndResult:'defeat', floor:4, runEndStats:{...} })`
  Check SS(): defeat heading with stats; play again button visible

- [ ] **Retreat screen renders correctly**
  Setup: `SC.loadCustom({ screen:'runEnd', runEndResult:'retreat', floor:6, runEndStats:{...} })`
  Check SS(): retreat heading with stats

- [ ] **Low-grade explanation line renders (high accuracy, low floor)**
  Setup: `SC.loadCustom` with run-end-low-grade config
  Check SS(): grade explanation text visible ("You aced what you faced...")

- [ ] **Play Again and Home buttons present on run end**
  Check LD(): `[data-testid="btn-play-again"]` and `[data-testid="btn-home"]` present

- [ ] **Defeated enemy list renders correctly (many enemies)**
  Setup: `runEndStats.defeatedEnemyIds` with 15 entries
  Check SS(): enemy list displayed without overflow

- [ ] **Share run button present**
  Check LD(): `[data-testid="btn-share-run"]` present

### 5.10 Hub Screen

- [ ] **Hub screen loads cleanly**
  Setup: `SC.loadCustom({ screen:'hub', gold:500 })`
  Check LD(): start run button present; SS(): hub environment visible with animated pet

- [ ] **Start run button prominent**
  Check LD(): `[data-testid="btn-start-run"]` present and within viewport

- [ ] **Hub with many relics in collection display**
  Setup: `SC.loadCustom({ screen:'hub', relics:['whetstone','iron_shield','swift_boots','insight_prism'], gold:5000 })`
  Check SS(): relic collection area visible; gold displayed

- [ ] **Campfire resume button (hub)**
  Check LD(): `[data-testid="btn-campfire-resume"]` or `[data-testid="btn-campfire-hub"]` present

### 5.11 Library, Profile, Settings, Journal

- [ ] **Library screen renders**
  Setup: `SC.loadCustom({ screen:'library' })`
  Check LD(): card browser visible; SS(): card grid or list layout

- [ ] **Profile screen renders**
  Setup: `SC.loadCustom({ screen:'profile' })`
  Check SS(): profile stats, run history; progress bars visible

- [ ] **Settings screen renders**
  Setup: `SC.loadCustom({ screen:'settings' })`
  Check LD(): `[data-testid="btn-settings-back"]` present; SS(): settings categories listed

- [ ] **Journal screen renders**
  Setup: `SC.loadCustom({ screen:'journal' })`
  Check SS(): journal entries visible; back navigation present

### 5.12 Onboarding Flow

- [ ] **Onboarding screen renders first card**
  Setup: `SC.loadCustom({ screen:'onboarding' })`
  Check SS(): onboarding tutorial card with tip text visible; navigation dots present

- [ ] **Archetype selection screen renders all archetypes**
  Setup: `SC.loadCustom({ screen:'archetypeSelection' })`
  Check LD(): archetype buttons present; SS(): 3+ archetype cards with images and descriptions

- [ ] **Domain selection screen renders all domains**
  Setup: navigate to domain selection
  Check LD(): `[data-testid="domain-card-{domain}"]` for each domain; SS(): domain grid layout

### 5.13 Relic Sanctum

- [ ] **Relic sanctum loads with relic grid**
  Setup: `SC.loadCustom({ screen:'relicSanctum' })`
  Check SS(): relic collection grid with all relics (locked/unlocked states); rarity categories

- [ ] **Locked relic shows locked state**
  Setup: new player with no unlocks
  Check SS(): locked relics shown with lock icon or greyed out

### 5.14 Study Quiz (Rest Room Study)

- [ ] **Study quiz renders question and 4 answers**
  Setup: `SC.loadCustom({ screen:'restStudy' })`
  Check LD(): `[data-testid="study-card-question"]` and `[data-testid="study-card-answer"]` present; SS(): question text, 4 answer buttons, progress bar

- [ ] **Study back button always present**
  Check LD(): `[data-testid="study-back-btn"]` present in all study states

- [ ] **Study empty state with back button**
  Setup: trigger empty study state
  Check LD(): `[data-testid="study-empty-state"]` and `[data-testid="study-back-btn"]` present

- [ ] **Study with curated deck (ancient_rome)**
  Setup: `SC.loadCustom({ screen:'restStudy', deckId:'ancient_rome' })`
  Check SS(): deck name/logo visible; question from Rome domain

- [ ] **Study progress indicator**
  Check LD(): `[data-testid="study-progress"]` present; SS(): "X / Y" or progress bar visible

### 5.15 Special Event Overlays

- [ ] **Special event (post-boss) screen renders**
  Setup: `SC.loadCustom({ screen:'specialEvent', floor:10 })`
  Check SS(): special event options visible (relic forge, card transform, etc.)

- [ ] **Relic swap overlay renders**
  Setup: `SC.loadCustom({ screen:'relicSwapOverlay', relics:['whetstone','iron_shield','swift_boots','vitality_ring'], gold:500 })`
  Check SS(): swap overlay with current relics and new relic shown; confirm/cancel buttons

- [ ] **Upgrade selection overlay renders with candidates**
  Setup: `SC.loadCustom({ screen:'upgradeSelection', hand:['strike','block','heavy_strike','multi_hit','lifetap'] })`
  Check LD(): `[data-testid="upgrade-candidate-{id}"]` elements present; SS(): card upgrade candidates listed; skip and confirm buttons

---

## SECTION 6 — EDGE CASES & OVERFLOW

### 6.1 Hand Size Edge Cases

- [ ] **1-card hand — single card centered in hand area**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike'] })`
  Check LD(): 1 card element; SS(): card centered or flush-left without gaps

- [ ] **5-card hand — standard layout**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike','block','heavy_strike','expose','lifetap'] })`
  Check LD(): 5 cards in hand row; SS(): all 5 cards visible, no clipping

- [ ] **8-card hand — cards scale or scroll**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', handSize:8 })`
  Check LD(): 8 hand card elements all within viewport width; SS(): cards compressed or scrollable without overlap outside viewport

- [ ] **10-card hand (maximum) — extreme hand size**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'thesis_construct', handSize:10 })`
  Check LD(): all 10 cards visible in viewport; SS(): no cards clipped outside viewport

### 6.2 Relic Tray Edge Cases

- [ ] **Empty relic tray — no slots shown or graceful empty state**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', relics:[] })`
  Check SS(): relic tray area empty without layout breakage

- [ ] **Max relics in tray (5) — all visible**
  (Covered in 3.1 above)

- [ ] **Relic tray overflow check — 6th relic triggers swap overlay**
  Setup: 5 relics in run, buy 6th from shop
  Check SS(): RelicSwapOverlay appears; existing 5 relics shown for selection

### 6.3 Status Effect Stacking

- [ ] **Maximum status effects on enemy — 10+ effects simultaneously**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[ {type:'poison',value:3,turnsRemaining:3}, {type:'burn',value:6,turnsRemaining:99}, {type:'bleed',value:2,turnsRemaining:99}, {type:'strength',value:2,turnsRemaining:9999}, {type:'weakness',value:1,turnsRemaining:2}, {type:'vulnerable',value:1,turnsRemaining:2}, {type:'immunity',value:1,turnsRemaining:99}, {type:'regen',value:2,turnsRemaining:3}, {type:'slow',value:1,turnsRemaining:2} ] } } })`
  Check LD(): all status icons within viewport; no icon off-screen; SS(): status bar remains single row without vertical overflow

- [ ] **High stack count display — poison 999 stacks**
  Setup: `SC.patch({ turn:{ enemy:{ statusEffects:[{type:'poison',value:999,turnsRemaining:99}] } } })`
  Check SS(): "999" label fits in icon badge without overflow

- [ ] **Permanent sentinel display (turnsRemaining: 9999) shows ∞**
  Setup: any permanent status
  Check SS(): "∞" shown NOT "9999"

### 6.4 Damage Numbers

- [ ] **Small damage number (1 damage) visible**
  Setup: low-damage attack vs high-block enemy
  Check SS(): "1" damage number floats briefly

- [ ] **Large damage number (999 damage) readable**
  Setup: `SC.patch({ turn:{ apCurrent:10 } })`, play power_strike or knowledge_bomb with max chain
  Check SS(): large number fits without truncation

- [ ] **Multiple simultaneous damage numbers (multi-hit) don't overlap confusingly**
  Setup: multi_hit or chain_lightning
  Check SS(): each damage number distinct, not all stacked on same pixel

- [ ] **Heal number floats correctly (positive number in green)**
  Setup: play lifetap or have regen tick
  Check SS(): green heal number visible distinct from damage

### 6.5 Enemy + Status + Badges: All 3 Layers Simultaneously

- [ ] **Enemy sprite + HP bar + status effects + power badges all visible without overlap**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'textbook' })` + patch enemy with 3 status effects
  Check LD(): sprite bounds, HP bar bounds, status bar bounds, power badge bounds do not intersect; SS(): all 4 visual layers clearly readable

---

## SECTION 7 — INTERACTION STATES

### 7.1 Card Selection State

- [ ] **Selected card shows hover/selected highlight**
  Setup: click a card in hand (select but don't play)
  Check SS(): selected card visually elevated or highlighted; other cards de-emphasized

- [ ] **Selected card shows quick-play vs charge mode indicators**
  Setup: select a card with charge mode unlocked
  Check SS(): QP and Charge mode buttons visible below/above selected card

- [ ] **AP cost on card correctly shown for current mastery level**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike'] })`
  Check SS(): AP cost number on card face matches expected value

- [ ] **Locked card type visual (Librarian silence mechanic)**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'librarian' })`, let librarian take a turn
  Check SS(): silenced card type cards appear greyed out or have lock overlay

### 7.2 Quiz Overlay During Combat

- [ ] **Quiz overlay appears after card charge commit**
  Setup: `SC.loadCustom({ screen:'combat', enemy:'page_flutter', hand:['strike'] })`, select strike, choose charge, commit
  Check SS(): quiz backdrop visible; quiz question text shown; 3-4 answer buttons visible

- [ ] **Quiz answer buttons labeled correctly**
  Check LD(): `[data-testid="quiz-answer-0"]` through `[data-testid="quiz-answer-3"]` present; SS(): each button has answer text

- [ ] **Timer bar visible on quiz overlay**
  Check SS(): countdown timer or progress bar visible

- [ ] **Quiz correct answer — flash visual**
  Setup: answer quiz correctly
  Check SS(): correct answer button flashes green; damage resolves

- [ ] **Quiz wrong answer — flash visual**
  Setup: answer quiz incorrectly
  Check SS(): wrong answer button flashes red; partial damage resolves

- [ ] **Quiz skip — effect at 50% (FIZZLE_EFFECT_RATIO)**
  Setup: let timer run out or use `__rrPlay.answerQuizIncorrectly()`
  Check SS(): effect resolves at reduced value

### 7.3 Card Picker Overlay During Combat (Conjure, Transmute, etc.)

- [ ] **CardPickerOverlay renders on top of combat (z-index correct)**
  Setup: play Conjure, picker appears
  Check LD(): picker overlay z-index > quiz-backdrop z-index (25); SS(): picker visible, combat background visible below

- [ ] **Skip button present in picker overlay**
  Setup: any picker overlay
  Check SS(): "Skip" button visible

- [ ] **Picker overlay title matches card that triggered it**
  Setup: play transmute → title should say "Transmute"; conjure → "Conjure"
  Check SS(): overlay title text correct

### 7.4 Mastery Challenge

- [ ] **Mastery challenge screen renders with question + timer**
  Setup: `SC.loadCustom({ screen:'masteryChallenge' })`
  Check LD(): `[data-testid="mastery-question"]` present; timer visible; SS(): question text and 4 answers rendered

- [ ] **Mastery challenge answer buttons accessible**
  Check LD(): `[data-testid="mastery-answer-0"]` through `[data-testid="mastery-answer-3"]` present

### 7.5 Boss Intro Overlay

- [ ] **Boss intro overlay renders boss name and art**
  Setup: navigate to boss encounter
  Check SS(): BossIntroOverlay shows boss name prominently; boss sprite or illustration; tap-to-continue indicator

### 7.6 Narrative Overlay (Woven Narrative)

- [ ] **Narrative overlay appears after room transitions**
  Setup: complete a mystery event or boss fight
  Check SS(): narrative text overlay visible with character quote; dismiss button

### 7.7 Near Miss Banner

- [ ] **Near miss banner shows when player nearly dies**
  Setup: trigger near-death state and survive
  Check SS(): NearMissBanner flashes momentarily

### 7.8 Comeback Bonus

- [ ] **Comeback bonus shows when player on losing streak**
  Setup: simulate losing conditions
  Check LD(): `[data-testid="comeback-bonus"]` present; SS(): bonus indicator visible

---

## SECTION 8 — BATCH TEST SCENARIOS (Multiple Concerns at Once)

### 8.1 Combat Megastate — All Combat UI Elements

- [ ] **Batch: Full combat with every UI layer active**
  Setup:
  ```
  SC.loadCustom({
    screen: 'combat',
    enemy: 'bookwyrm',          // elite with phase badges
    hand: ['strike','block','heavy_strike','expose','overclock'],
    relics: ['whetstone','iron_shield','resonance_crystal','aegis_stone'],
    playerHp: 65, playerMaxHp: 100,
    floor: 4,
    turnOverrides: {
      apCurrent: 3, apMax: 3,
      isSurge: true,
      chainLength: 3,
      chainMultiplier: 2.0,
      activeChainColor: 1,
      enemy: {
        statusEffects: [
          {type:'poison',value:3,turnsRemaining:2},
          {type:'burn',value:4,turnsRemaining:99},
          {type:'vulnerable',value:1,turnsRemaining:1}
        ]
      },
      playerState: {
        shield: 5,
        statusEffects: [{type:'strength',value:1,turnsRemaining:9999}]
      }
    }
  })
  ```
  Check LD(): all elements within viewport — enemy sprite, HP bars, intent bubble, status bars, power badges, relic tray, chain counter, AP orb, draw/discard piles, hand cards; SS(): no overlap, all readable

### 8.2 Near-Death Megastate

- [ ] **Batch: Extreme low HP + poison + enemy charging**
  Setup:
  ```
  SC.loadCustom({
    screen: 'combat',
    enemy: 'algorithm',
    hand: ['lifetap','block','strike'],
    relics: ['last_breath','regeneration_orb'],
    playerHp: 3, playerMaxHp: 100,
    turnOverrides: {
      playerState: {
        statusEffects: [{type:'poison',value:5,turnsRemaining:3}]
      },
      enemy: {
        isCharging: true,
        chargedDamage: 30,
        statusEffects: [{type:'strength',value:3,turnsRemaining:9999}]
      },
      apCurrent: 1
    }
  })
  ```
  Check SS(): critical vignette pulse, near-death tension CSS, low AP orb, charging intent visible, poison badge on player, strength badge on enemy

### 8.3 All Enemy Power Badges Simultaneously

- [ ] **Batch: Enemy with maximum power badge variety**
  Setup:
  ```
  SC.loadCustom({
    screen: 'combat',
    enemy: 'first_question',     // has multiple passives
    turnOverrides: {
      enemy: { phase: 1 }
    }
  })
  ```
  Check LD(): all badges within a single row, none clipped; SS(): badges readable side-by-side without text overlap

### 8.4 Shop Full Inventory

- [ ] **Batch: Shop fully stocked**
  Setup:
  ```
  SC.loadCustom({
    screen: 'shopRoom',
    gold: 1000,
    shopRelics: ['whetstone','iron_shield'],
    shopCards: ['heavy_strike','lifetap','reckless','multi_hit']
  })
  ```
  Check SS(): 4 cards + 2 relics + removal service all visible; gold amount correct; leave button present

### 8.5 Run End Victory — All Stats

- [ ] **Batch: Victory run end with maximum stat display**
  Setup: run-end-victory scenario (full `runEndStats`)
  Check SS(): all stat rows visible — floor, accuracy, best combo, encounters won, bosses defeated, gold earned, relics collected, fact mastery summary; no overflow

### 8.6 Landscape Combat With Quiz Active

- [ ] **Batch: Landscape mode, quiz active, enemy status effects visible**
  Setup: landscape viewport, combat with enemy having 3 status effects, play charge card
  Check LD(): enemy x position in right 42% of viewport; quiz panel in left 58%; status effects y-coordinate within enemy panel; power badges z-index above quiz backdrop; SS(): all layers visually clear

### 8.7 Maximum Relics + Status Effects

- [ ] **Batch: 5 relics + 8 status effects on enemy + 3 on player**
  Setup:
  ```
  SC.loadCustom({
    screen: 'combat',
    enemy: 'thesis_construct',
    relics: ['whetstone','iron_shield','resonance_crystal','aegis_stone','last_breath'],
    turnOverrides: {
      enemy: {
        statusEffects: [
          {type:'poison',value:2,turnsRemaining:2},
          {type:'burn',value:4,turnsRemaining:99},
          {type:'bleed',value:2,turnsRemaining:99},
          {type:'strength',value:1,turnsRemaining:9999},
          {type:'weakness',value:1,turnsRemaining:2},
          {type:'vulnerable',value:1,turnsRemaining:2},
          {type:'immunity',value:1,turnsRemaining:99},
          {type:'regen',value:2,turnsRemaining:3}
        ]
      },
      playerState: {
        statusEffects: [
          {type:'strength',value:1,turnsRemaining:9999},
          {type:'regen',value:3,turnsRemaining:3},
          {type:'immunity',value:1,turnsRemaining:99}
        ]
      }
    }
  })
  ```
  Check LD(): relic tray stays in tray bounds; enemy status bar stays below HP bar; player status bar stays above HP bar; no elements collide; SS(): comprehensive screenshot showing full state

---

## SECTION 9 — SPRITE & ART AUDIT

### 9.1 Enemy Sprites — No Placeholder Rectangles

For each of the 89 enemies, verify sprite renders as art (not colored rectangle):

- [ ] **Act 1 commons batch**: `page_flutter`, `thesis_construct`, `mold_puff`, `crib_sheet`
- [ ] **Act 1 elites batch**: `bookwyrm`, `peer_reviewer`
- [ ] **Act 1 bosses batch**: `final_exam`, `burning_deadline`
- [ ] **Act 2 commons batch**: `ink_slug`, `bookmark_vine`, `staple_bug`, `margin_gremlin`, `index_weaver`, `overdue_golem`, `pop_quiz`, `eraser_worm`, `citation_needed`
- [ ] **Act 2 mini-bosses batch**: `card_catalogue`, `headmistress`, `tutor`, `study_group`
- [ ] **Act 2 elites batch**: `librarian`
- [ ] **Act 2 bosses batch**: `algorithm`, `curriculum`
- [ ] **Act 3 batch**: `spark_note`, `watchdog`, `red_herring`, `anxiety_tick`, `trick_question`, `dropout`, `brain_fog`, `thesis_dragon`, `burnout`, `harsh_grader`, `textbook`, `imposter_syndrome`, `pressure_cooker`
- [ ] **Act 4 batch**: `deadline_serpent`, `standardized_test`, `writers_block`, `information_overload`, `rote_memory`, `outdated_fact`, `hidden_gem`, `rushing_student`, `echo_chamber`, `blank_spot`, `grade_curve`, `burnout_phantom`, `prismatic_jelly`, `ember_skeleton`, `perfectionist`, `hydra_problem`, `ivory_tower`, `helicopter_parent`, `emeritus`, `student_debt`, `publish_or_perish`, `thesis_djinn`, `gut_feeling`, `bright_idea`, `sacred_text`, `devils_advocate`, `institution`, `rosetta_slab`, `moth_of_enlightenment`, `hyperlink`, `unknown_unknown`, `fake_news`, `first_question`, `dean`, `dissertation`, `eureka`, `paradigm_shift`, `ancient_tongue`, `lost_thesis`, `dunning_kruger`, `singularity`
  For each: `SC.loadCustom({ screen:'combat', enemy:'ENEMY_ID' })` → Check SS(): actual sprite art, not placeholder color rect

### 9.2 Card Art / Frame Rendering

- [ ] **Attack card frame is red/orange-tinted**
  Setup: hand with attack cards
  Check SS(): attack cards have distinct frame color from shield cards

- [ ] **Shield card frame is blue-tinted**
  Check SS(): shield card frames visually distinct

- [ ] **Buff card frame is gold-tinted**
  Check SS(): buff card frames distinct

- [ ] **Wild card frame is iridescent/multi-color**
  Check SS(): wild card frames visually unique

- [ ] **Mastery level badges on cards display correctly (level 0-5)**
  Setup: cards at various mastery levels
  Check SS(): mastery level indicator visible on card face

- [ ] **Upgraded card visual indicator**
  Setup: card reward with upgraded:true card
  Check SS(): upgraded card has visual indicator (glow, badge, or marker)

### 9.3 Relic Icon Rendering

- [ ] **All starter relics show correct sprite icons (not emoji fallback)**
  Setup: combat with all 13 starter common relics (split into batches)
  Check SS(): sprite icons visible, not raw emoji fallback characters

- [ ] **Rarity badge on relic icon (common/uncommon/rare)**
  Setup: combat with relics of different rarities
  Check SS(): RarityBadge component visible on relic icons

---

## SECTION 10 — MISCELLANEOUS SCREENS

### 10.1 Dungeon Selection Hub

- [ ] **Deck selection hub renders**
  Setup: `SC.loadCustom({ screen:'deckSelectionHub' })`
  Check SS(): dungeon selection screen with available knowledge domains listed

### 10.2 Trivia Round Screen

- [ ] **Trivia round screen renders in waiting phase**
  Setup: `SC.loadCustom({ screen:'triviaRound' })`
  Check SS(): trivia round lobby/waiting screen visible

### 10.3 Run Deck Overlay

- [ ] **Run deck overlay shows current deck**
  Setup: combat scenario, open run deck overlay
  Check LD(): `[data-testid="run-deck-overlay"]` or card browser present; SS(): all deck cards listed

- [ ] **Run deck overlay empty state**
  Check LD(): `[data-testid="run-deck-overlay-empty"]` when deck is empty

### 10.4 Relic Pickup Overlay

- [ ] **Relic pickup toast/overlay when gaining relic**
  Setup: accept relic from reward room
  Check SS(): RelicPickupToast or RelicPickupOverlay visible briefly with relic name

---

## SECTION 11 — CARD FUNCTIONAL CORRECTNESS

Legend: QP = Quick Play, CC = Charge Correct (QP × 1.50), CW = Charge Wrong (QP × 0.50 = FIZZLE_EFFECT_RATIO), L# = mastery level.

Chain multipliers from `CHAIN_MULTIPLIERS`: `[1.0, 1.2, 1.5, 2.0, 2.5, 3.5]` (indices 0–5).
CC formula: `floor(qpValue × 1.50 × chainMultiplier × strengthMod × vulnMult + flatBonuses)`.

### 11.1 Attack Cards — Functional Correctness

- [ ] **strike L0 QP — deals 4 damage (qpValue=4)**
  Setup: `SC.loadCustom({screen:'combat', enemy:'page_flutter', hand:['strike']})`, snapshot `CS = getCombatState()`, `quickPlayCard(0)`
  Check: `getCombatState().enemyHp` delta = 4

- [ ] **strike L0 CC — deals 6 damage (floor(4 × 1.50) = 6)**
  Setup: same, `chargePlayCard(0, true)` after correct answer
  Check: enemyHp delta = 6

- [ ] **strike L3 QP — deals 6 damage (qpValue=6)**
  Setup: card at masteryLevel=3, QP
  Check: enemyHp delta = 6

- [ ] **strike L5 QP — deals 8 damage + strike_tempo3 tag activates when ≥3 cards played this turn**
  Setup: card at masteryLevel=5; play 2 other cards first, then QP strike
  Check: enemyHp delta = 8 baseline; with ≥3 prior cards, tempo bonus activates

- [ ] **strike CW — deals 2 damage (floor(4 × 0.50) = 2)**
  Setup: `chargePlayCard(0, false)` (wrong answer)
  Check: enemyHp delta = 2

- [ ] **multi_hit L0 QP — 2 hits × 2 = 4 total damage**
  Setup: L0 multi_hit (hitCount=2, qpValue=2), QP
  Check: enemyHp delta = 4

- [ ] **multi_hit L0 CC — 2 hits × 3 = 6 total damage (floor(2 × 1.50) = 3 per hit)**
  Setup: same, CC
  Check: enemyHp delta = 6

- [ ] **multi_hit L3 — applies multi_bleed1 tag (1 Bleed per hit)**
  Setup: L3 multi_hit (hitCount=3), CC
  Check: `getCombatState().enemyStatusEffects` contains bleed stacks ≥ 3

- [ ] **multi_hit L5 — 4 hits × floor(3 × 1.50) = 4 × 4 = 16 CC damage + bleed**
  Setup: L5 (hitCount=4, qpValue=3), CC
  Check: enemyHp delta = 16; bleed applied (multi_bleed1)

- [ ] **heavy_strike L0 QP — deals 7 damage**
  Setup: L0 heavy_strike (qpValue=7), QP
  Check: enemyHp delta = 7

- [ ] **heavy_strike L0 CC — deals 10 damage (floor(7 × 1.50) = 10)**
  Setup: CC
  Check: enemyHp delta = 10

- [ ] **heavy_strike L5 AP cost reduced to 1**
  Setup: L5 heavy_strike, check `getCombatState().hand[i].apCost`
  Check: apCost = 1 (down from 2)

- [ ] **heavy_strike L5 CC — deals 18 damage (floor(12 × 1.50) = 18)**
  Setup: L5 (qpValue=12, apCost=1), CC
  Check: enemyHp delta = 18

- [ ] **piercing L0 — damage ignores enemy block**
  Setup: `SC.patch({turn:{enemy:{block:10}}})`, L0 piercing (qpValue=3), QP
  Check: enemyHp delta = 3 (not reduced by block); enemyBlock unchanged or stripped by pierce logic

- [ ] **piercing L3 — pierce_strip3 tag strips 3 enemy block**
  Setup: `SC.patch({turn:{enemy:{block:8}}})`, L3 piercing, QP
  Check: enemyBlock decreases by 3; enemyHp delta = 4

- [ ] **piercing L5 — pierce_vuln1 applies Vuln 1 turn on CC**
  Setup: L5 piercing (qpValue=6), CC
  Check: `getCombatState().enemyStatusEffects` contains `{type:'vulnerable'}`

- [ ] **reckless L0 QP — deals 4 damage, player takes 4 self-damage**
  Setup: L0 reckless (qpValue=4, selfDmg=4), QP
  Check: enemyHp delta = 4; playerHp decreases by 4

- [ ] **reckless L5 — self-damage = 0 flat (reckless_selfdmg_scale3 instead)**
  Setup: L5 reckless (qpValue=10, selfDmg=0), QP with chain=0
  Check: playerHp unchanged (no flat self-damage at chain=0)

- [ ] **execute L0 — base 2 dmg; bonus 8 dmg below 30% HP**
  Setup: `SC.patch({turn:{enemy:{currentHP:9, maxHP:30}}})` (30% HP), L0 execute, CC
  Check: enemyHp delta ≥ 10 (2 base + 8 execBonus, floor(2 × 1.50) + 8 = 11)

- [ ] **execute L3 — threshold widens to 40% HP**
  Setup: enemy at 38% HP, L3 execute (execThreshold=0.4), CC
  Check: execBonus fires; enemyHp delta includes bonus

- [ ] **execute L5 — threshold 50%, execBonus=12**
  Setup: enemy at 45% HP, L5 execute, CC
  Check: execBonus fires; delta = floor(5 × 1.50) + 12 = 19

- [ ] **lifetap L0 QP — deals 5 damage, heals 20% of damage (1 HP)**
  Setup: L0 lifetap (qpValue=5), QP, playerHp=80
  Check: enemyHp delta = 5; playerHp +1

- [ ] **lifetap L2 — lifetap_heal30 tag: heals 30% of damage**
  Setup: L2 lifetap (qpValue=5, tag: lifetap_heal30), CC
  Check: playerHp increases by floor(7 × 0.30) = 2

- [ ] **lifetap L5 — apCost=1**
  Setup: L5 lifetap, check hand card apCost
  Check: apCost = 1

- [ ] **power_strike L0 QP — deals 4 damage**
  Setup: L0 power_strike (qpValue=4), QP
  Check: enemyHp delta = 4

- [ ] **power_strike L5 CC — applies vulnerable 2 turns + power_vuln75 tag**
  Setup: L5 (qpValue=8), CC
  Check: enemyHp delta = 12; `enemyStatusEffects` contains vulnerable with turnsRemaining=2

- [ ] **twin_strike L0 QP — 2 hits × 2 = 4 total**
  Setup: L0 (qpValue=2, hitCount=2), QP
  Check: enemyHp delta = 4

- [ ] **twin_strike L3 — 3 hits (third strike unlocked)**
  Setup: L3 (qpValue=3, hitCount=3), QP
  Check: enemyHp delta = 9

- [ ] **twin_strike L5 CC — 3 hits + twin_burn2 (2 Burn per hit) + twin_burn_chain**
  Setup: L5 (qpValue=4, hitCount=3, tags: twin_burn2), CC
  Check: enemyHp delta = 18; `enemyStatusEffects` contains burn stacks ≥ 6 (2 per hit × 3 hits)

- [ ] **iron_wave L0 QP — deals 3 damage AND grants 5 block**
  Setup: L0 iron_wave (qpValue=3, secondaryValue=5), QP
  Check: enemyHp delta = 3; playerBlock += 5

- [ ] **iron_wave L5 — iron_wave_block_double doubles block**
  Setup: L5 (qpValue=5, secondaryValue=7, tags: iron_wave_block_double), CC
  Check: playerBlock increases by 7 × 2 = 14

- [ ] **bash L0 — deals 4 damage + applies Vulnerable 1 turn**
  Setup: L0 bash (qpValue=4, apCost=2), CC
  Check: enemyHp delta = 6 (floor(4 × 1.5)); `enemyStatusEffects` contains vulnerable turnsRemaining=1

- [ ] **bash L3 — bash_vuln2t: Vulnerable lasts 2 turns**
  Setup: L3 bash (qpValue=5, tags: bash_vuln2t), CC
  Check: `enemyStatusEffects.vulnerable.turnsRemaining` = 2

- [ ] **bash L5 — bash_weak1t: also applies Weak 1 turn**
  Setup: L5 bash (qpValue=7, tags: bash_vuln2t + bash_weak1t), CC
  Check: enemyStatusEffects contains both vulnerable and weakness

- [ ] **rupture L0 QP — 2 damage + 2 Bleed**
  Setup: L0 rupture (qpValue=2, secondaryValue=2), QP
  Check: enemyHp delta = 2; bleed stacks = 2

- [ ] **rupture L5 — rupture_bleed_perm: Bleed doesn't decay**
  Setup: L5 rupture (qpValue=5, secondaryValue=5), CC; end turn
  Check: bleed stacks persist after turn (no decay)

- [ ] **kindle L0 QP — 1 damage + 4 Burn stacks that trigger**
  Setup: L0 kindle (qpValue=1, secondaryValue=4), QP
  Check: enemyHp delta = 1 + burn trigger damage; burn icon appears

- [ ] **kindle L5 — kindle_double_trigger fires Burn twice**
  Setup: L5 kindle (qpValue=4, secondaryValue=6, tags: kindle_double_trigger), CC
  Check: burn triggers 2× per play cycle

- [ ] **overcharge L0 QP — base 2 damage**
  Setup: L0 overcharge (qpValue=2), QP
  Check: enemyHp delta = 2

- [ ] **overcharge L3 — overcharge_bonus_x2: encounter charge scaling doubled**
  Setup: L3 (qpValue=4, tags: overcharge_bonus_x2), has 3 prior charges this encounter
  Check: bonus from encounter charges is 2× what it would be at L0

- [ ] **riposte L0 QP — 2 damage + 4 block**
  Setup: L0 riposte (qpValue=2, secondaryValue=4), QP
  Check: enemyHp delta = 2; playerBlock += 4

- [ ] **riposte L5 — riposte_block_dmg40: bonus damage = 40% of current block**
  Setup: `SC.patch({turn:{playerState:{shield:10}}})`, L5 riposte, CC
  Check: total damage includes floor(10 × 0.40) = 4 extra

- [ ] **precision_strike L0 — deals 5 damage**
  Setup: L0 (qpValue=5), QP
  Check: enemyHp delta = 5

- [ ] **precision_strike L3 — precision_timer_ext50: quiz timer +50%**
  Setup: L3 (qpValue=7), charge; observe quiz timer duration is extended
  Check: quiz timer bar visibly longer than baseline

- [ ] **siphon_strike L0 QP — 3 damage + block gain**
  Setup: L0 siphon_strike, QP
  Check: enemyHp delta = 3; playerBlock increases

- [ ] **gambit L0 QP — 4 damage + 4 self-damage**
  Setup: L0 gambit (qpValue=4, selfDmg=4), QP
  Check: enemyHp delta = 4; playerHp decreases by 4

- [ ] **gambit L0 CC — deals 6 damage + heals 3 HP**
  Setup: L0 gambit (healOnCC=3), CC
  Check: enemyHp delta = 6; playerHp += 3

- [ ] **gambit L5 CC — 15 damage + heals 8 HP (nearly free risk)**
  Setup: L5 gambit (qpValue=10, selfDmg=1, healOnCC=8), CC
  Check: enemyHp delta = 15; playerHp += 8

- [ ] **chain_lightning L0 — base 4 damage (apCost=2)**
  Setup: L0 chain_lightning (qpValue=4, apCost=2), QP
  Check: enemyHp delta = 4

- [ ] **chain_lightning CC — damage × chainLength**
  Setup: `SC.patch({turn:{chainLength:3}})`, L0 chain_lightning, CC
  Check: damage scales with chain length (3× base chain_lightning value)

- [ ] **chain_lightning L3 — chain_lightning_min2: treats minimum chain as 2**
  Setup: L3, no active chain (chainLength=0), CC
  Check: damage treats chainLength as ≥ 2

- [ ] **chain_lightning L5 — apCost=1**
  Setup: L5 (qpValue=6, apCost=1)
  Check: `getCombatState().hand[i].apCost` = 1

- [ ] **volatile_slash L0 CC — fires + forgets card**
  Setup: L0 volatile_slash, CC
  Check: damage lands; card removed from deck (forgetPile increases)

- [ ] **volatile_slash L5 CC — volatile_no_forget: no longer forgets**
  Setup: L5 (qpValue=12, tags: volatile_no_forget), CC
  Check: damage = 18; card stays in deck (forgetPile unchanged)

- [ ] **smite L0 — deals 7 damage (apCost=2)**
  Setup: L0 smite (qpValue=7, apCost=2), QP
  Check: enemyHp delta = 7

- [ ] **smite L3 — smite_aura_x2: Aura scaling doubled**
  Setup: enemy has status effects (Aura present), L3 smite, CC
  Check: damage bonus from Aura is 2× L0 equivalent

- [ ] **smite L5 — apCost=1**
  Setup: L5 (qpValue=12, apCost=1)
  Check: apCost = 1

- [ ] **feedback_loop L0 — deals 3 damage; CW = 0 + Aura crash**
  Setup: L0 feedback_loop, CW
  Check: damage = 0 (or minimal); Aura state resets

- [ ] **feedback_loop L3 — feedback_crash_half: CW Aura crash halved**
  Setup: L3, CW
  Check: Aura loss on CW is 50% of L0

- [ ] **recall L0 QP — deals 5 damage**
  Setup: L0 recall, QP
  Check: enemyHp delta = 5

- [ ] **recall L3 — recall_heal3: heals 3 on review CC**
  Setup: L3, card in review queue, CC
  Check: playerHp += 3

- [ ] **hemorrhage L0 — consumes all Bleed stacks (damage = bleedMult × stacks)**
  Setup: `SC.patch({turn:{enemy:{statusEffects:[{type:'bleed',value:5,turnsRemaining:99}]}}})`, L0 hemorrhage (bleedMult=3), CC
  Check: damage = floor((4 + 5 × 3) × 1.5) = floor(29 × 1.5) = 43; bleed stacks cleared

- [ ] **hemorrhage L5 — bleedMult=7, apCost=1**
  Setup: L5 hemorrhage (qpValue=6, apCost=1, bleedMult=7)
  Check: apCost = 1; damage with 5 bleed = floor((9 + 35) × 1.5) = 66

- [ ] **eruption L0 — dmgPerAp=6, spends all AP**
  Setup: `SC.patch({turn:{apCurrent:3}})`, L0 eruption, QP
  Check: playerAp = 0 after play; enemyHp delta = 18 (6 × 3)

- [ ] **eruption L5 — dmgPerAp=12, refunds 1 AP (eruption_refund1)**
  Setup: L5 eruption, 3 AP available, QP
  Check: playerAp = 1 after (refund); enemyHp delta = 36

- [ ] **sap L0 — applies negative strength (strength debuff) to enemy**
  Setup: L0 sap, QP
  Check: `getCombatState().enemyStatusEffects` contains weakness or strength-reducing effect

- [ ] **hemorrhage CW — deals qpValue × 0.50 damage, does NOT consume bleed**
  Setup: L0 hemorrhage, CW
  Check: bleed stacks unchanged; damage = floor(4 × 0.50) = 2

### 11.2 Shield Cards — Functional Correctness

- [ ] **block L0 QP — grants 4 block**
  Setup: L0 block (qpValue=4), QP
  Check: `getCombatState().playerBlock` += 4

- [ ] **block L0 CC — grants 6 block (floor(4 × 1.50) = 6)**
  Setup: CC
  Check: playerBlock += 6

- [ ] **block L5 — block_consecutive3: bonus block when played 3+ consecutive times**
  Setup: L5 block, play block 3 turns in a row; check 3rd play
  Check: block gain on 3rd play is higher than baseline L5 (8)

- [ ] **thorns L0 QP — grants 2 block + 3 reflect damage**
  Setup: L0 thorns (qpValue=2, secondaryValue=3), QP; enemy attacks player
  Check: playerBlock += 2; enemy takes 3 thorns damage when attacking

- [ ] **thorns L5 — thorns_persist: thorns lasts entire encounter**
  Setup: L5 thorns, play it; end turn; verify thorns status persists next turn
  Check: thorns status badge still present next turn

- [ ] **emergency L0 QP — grants 2 block; doubles to 4 if HP < 30%**
  Setup: `SC.loadCustom({..., playerHp:25, playerMaxHp:100})`, L0 emergency, QP
  Check: playerBlock += 4 (doubled because < 30% HP)

- [ ] **emergency L3 — threshold widens to 40% HP**
  Setup: player at 38% HP, L3 emergency (emergThreshold=0.4), QP
  Check: double triggers; block doubled

- [ ] **fortify L0 QP — grants 5 block**
  Setup: L0 fortify (qpValue=5, apCost=2), QP
  Check: playerBlock += 5

- [ ] **fortify L5 — fortify_carry: block persists to next turn; apCost=1**
  Setup: L5 fortify, QP; end turn
  Check: playerBlock > 0 at start of next turn (persisted)

- [ ] **brace L0 QP — grants 2 block**
  Setup: L0 brace, QP
  Check: playerBlock += 2

- [ ] **brace L3 — brace_exceed2: block exceeds telegraph value by +2**
  Setup: L3 (qpValue=4, tags: brace_exceed2), enemy has attack telegraph
  Check: block = 4 + telegraphed_value + 2

- [ ] **overheal L0 QP — grants 6 block (apCost=2)**
  Setup: L0 overheal (qpValue=6, apCost=2), QP
  Check: playerBlock += 6

- [ ] **overheal L3 — overheal_heal2: also heals 2 HP; apCost=1**
  Setup: L3 overheal, playerHp=80, QP
  Check: playerBlock += 8; playerHp += 2; apCost = 1

- [ ] **parry L0 — grants 1 block; draws 1 card when enemy attacks**
  Setup: L0 parry, QP; end turn; enemy attacks
  Check: hand size increases by 1 when enemy attacks after parry played

- [ ] **parry L3 — draws 2 on enemy attack**
  Setup: L3 parry (secondaryValue=2), QP; enemy attacks
  Check: hand size increases by 2

- [ ] **parry L5 — parry_counter3: deals 3 damage to attacker**
  Setup: L5 parry, QP; enemy attacks
  Check: enemyHp decreases by 3 when enemy attack lands

- [ ] **reinforce L0 CC — block granted**
  Setup: L0 reinforce, CC
  Check: playerBlock increases

- [ ] **shrug_it_off — block + cleanses one debuff from player**
  Setup: player has poison + weakness; play shrug_it_off
  Check: playerBlock increases; one status effect removed from player

- [ ] **guard L0 QP — flat block granted**
  Setup: play guard, QP
  Check: playerBlock increases

- [ ] **absorb L0 — block scales with enemy attack value**
  Setup: enemy with attack intent, play absorb
  Check: playerBlock = attack value + absorb base

- [ ] **reactive_shield — block scales with enemy incoming damage**
  Setup: high-damage enemy intent, play reactive_shield
  Check: playerBlock proportional to enemy attack value

- [ ] **aegis_pulse L0 — base block granted**
  Setup: play aegis_pulse
  Check: playerBlock increases

- [ ] **burnout_shield L0 — grants block, applies Burn to player (burnout penalty)**
  Setup: L0 burnout_shield, play it
  Check: playerBlock increases; player statusEffects may contain burn penalty

- [ ] **knowledge_ward L0 — block scales with chain length**
  Setup: `SC.patch({turn:{chainLength:3, chainMultiplier:2.0}})`, play knowledge_ward
  Check: playerBlock higher than baseline (chain bonus applied)

- [ ] **bulwark L0 QP — large block granted**
  Setup: L0 bulwark, QP
  Check: playerBlock increases by bulwark base value

- [ ] **bulwark CW — grants partial block (0.50× base)**
  Setup: bulwark, CW
  Check: playerBlock increased by floor(base × 0.50)

- [ ] **conversion L0 — converts player block to damage**
  Setup: `SC.patch({turn:{playerState:{shield:8}}})`, play conversion
  Check: playerBlock = 0; enemyHp delta ≥ 8

- [ ] **ironhide L0 — grants block + damage reduction status**
  Setup: play ironhide
  Check: playerBlock increases; ironhide status effect applied

### 11.3 Buff Cards — Functional Correctness

- [ ] **empower L0 — grants Empower status (50% attack bonus)**
  Setup: L0 empower, QP; then play strike
  Check: strike damage increased by empower multiplier

- [ ] **quicken L0 — grants 1 AP**
  Setup: L0 quicken (qpValue=1), QP
  Check: `getCombatState().ap` increases by 1

- [ ] **focus L0 — grants Focus status (1 stack)**
  Setup: L0 focus, QP
  Check: `getCombatState().playerStatusEffects` contains focus with value=1

- [ ] **double_strike L0 — grants Double Strike status (next attack hits twice)**
  Setup: L0 double_strike, QP; then play strike
  Check: strike triggers twice (2 hits); double_strike status consumed

- [ ] **ignite L0 — next attack applies Burn**
  Setup: L0 ignite, QP; then play strike
  Check: enemy receives Burn status after strike

- [ ] **inscription_fury L0 CC — Inscription of Fury buff active**
  Setup: play inscription_fury, CC
  Check: player status contains inscription_fury buff; subsequent attacks boosted

- [ ] **inscription_iron L0 CC — Inscription of Iron buff active**
  Setup: play inscription_iron, CC
  Check: player status contains inscription_iron; subsequent shields boosted

- [ ] **warcry L0 CC — grants permanent Strength (turnsRemaining=9999)**
  Setup: play warcry, CC
  Check: `playerStatusEffects` contains strength with turnsRemaining=9999

- [ ] **battle_trance L0 — draws 2 cards**
  Setup: L0 battle_trance, QP; draw pile has ≥ 2 cards
  Check: hand size increases by 2; draw pile decreases by 2

- [ ] **inscription_wisdom L0 CC — Inscription of Wisdom buff active**
  Setup: play inscription_wisdom, CC
  Check: player status contains inscription_wisdom; utility cards boosted

- [ ] **frenzy L0 — attack damage buff for this turn**
  Setup: play frenzy, QP; then play strike
  Check: strike damage increased vs baseline

- [ ] **mastery_surge L0 CC — upgrades a card's mastery level**
  Setup: deck has L0 card, play mastery_surge CC
  Check: one card's masteryLevel increases by 1

- [ ] **war_drum L0 — grants Strength-like buff**
  Setup: play war_drum, QP
  Check: playerStatusEffects contains strength or equivalent buff

- [ ] **forge L0 — triggers CardPickerOverlay; upgrades selected card**
  Setup: play forge with upgradeable cards in deck
  Check: CardPickerOverlay appears; selected card masteryLevel increases

### 11.4 Debuff Cards — Functional Correctness

- [ ] **weaken L0 QP — applies 2 Weakness stacks to enemy**
  Setup: L0 weaken (qpValue=2), QP
  Check: `getCombatState().enemyStatusEffects` contains `{type:'weakness', value:2}`

- [ ] **weaken L0 CC — applies floor(2 × 1.50) = 3 Weakness stacks**
  Setup: CC
  Check: weakness stacks = 3

- [ ] **expose L0 — applies Vulnerable to enemy**
  Setup: L0 expose, QP
  Check: enemyStatusEffects contains vulnerable

- [ ] **hex L0 — applies Hex debuff to enemy**
  Setup: L0 hex, QP
  Check: enemyStatusEffects contains hex effect

- [ ] **slow L0 — applies Slow to enemy**
  Setup: L0 slow, QP
  Check: enemyStatusEffects contains slow

- [ ] **lacerate L0 QP — 1 damage + 4 Bleed**
  Setup: L0 lacerate (qpValue=1, secondaryValue=4), QP
  Check: enemyHp delta = 1; bleed stacks = 4

- [ ] **lacerate L5 — lacerate_vuln1t: also applies Vulnerable 1 turn**
  Setup: L5 lacerate, CC
  Check: enemyStatusEffects contains both bleed and vulnerable

- [ ] **stagger L0 — applies Stagger debuff to enemy**
  Setup: play stagger, QP
  Check: enemyStatusEffects contains stagger

- [ ] **corrode L0 — applies Corrode to enemy**
  Setup: play corrode, QP
  Check: enemyStatusEffects contains corrode

- [ ] **curse_of_doubt L0 — applies charge_damage_amp_percent to player**
  Setup: play curse_of_doubt, QP
  Check: playerStatusEffects contains charge_damage_amp_percent (incoming CW penalty)

- [ ] **mark_of_ignorance L0 — applies charge_damage_amp_flat to player**
  Setup: play mark_of_ignorance, QP
  Check: playerStatusEffects contains charge_damage_amp_flat

- [ ] **corroding_touch L0 — applies layered Corrode**
  Setup: play corroding_touch, QP
  Check: enemyStatusEffects contains corrode with higher stacks than single corrode

- [ ] **entropy L0 — applies Entropy debuff chain to enemy**
  Setup: play entropy, QP
  Check: enemyStatusEffects contains entropy; debuff chain starts

### 11.5 Utility Cards — Functional Correctness

- [ ] **cleanse L0 — removes all debuffs from player**
  Setup: player has poison + weakness + vulnerable; play cleanse
  Check: all negative playerStatusEffects cleared

- [ ] **scout L0 — draws 2 cards**
  Setup: L0 scout (qpValue=2, tag: draw), QP; draw pile ≥ 2
  Check: hand size increases by 2

- [ ] **recycle L0 — removes selected hand card, draws 3**
  Setup: play recycle targeting strike; hand had 3+ other cards
  Check: targeted card removed from hand; 3 cards drawn

- [ ] **foresight L0 — reveals next enemy intent + card is forgotten**
  Setup: play foresight, QP
  Check: foresight status applied; card added to forgetPile

- [ ] **conjure L0 CC — triggers CardPickerOverlay with conjure pool**
  Setup: play conjure, CC
  Check: CardPickerOverlay appears; selected card added to hand

- [ ] **transmute L0 — triggers CardPickerOverlay; transforms selected card**
  Setup: play transmute with 2+ cards in hand
  Check: CardPickerOverlay appears; selected card replaced with new card

- [ ] **immunity L0 — applies Immunity status to player**
  Setup: play immunity, QP
  Check: playerStatusEffects contains immunity

- [ ] **sift L0 — discard up to 2 cards, draw same amount**
  Setup: play sift with 3+ cards in hand
  Check: hand size stays same; 2 cards cycled

- [ ] **scavenge L0 — triggers CardPickerOverlay with discard pile**
  Setup: discard pile has ≥ 1 card; play scavenge
  Check: CardPickerOverlay shows discard pile; selected card added to hand

- [ ] **swap L0 — exchanges positions of two hand cards**
  Setup: hand has 3+ cards; play swap
  Check: card positions in hand rearranged

- [ ] **archive L0 — permanently removes selected card from run**
  Setup: play archive targeting strike
  Check: targeted card removed from deck entirely (not just discarded)

- [ ] **reflex L0 — draws 1 card immediately**
  Setup: L0 reflex, QP; draw pile ≥ 1
  Check: hand size increases by 1; draw pile decreases by 1

- [ ] **recollect L0 — retrieves card from discard pile**
  Setup: discard pile has ≥ 1 card; play recollect
  Check: card moved from discardPile to hand

- [ ] **synapse L0 — draws cards and applies focus**
  Setup: play synapse, QP
  Check: cards drawn; focus status applied

- [ ] **siphon_knowledge L0 — draw scales with chain length**
  Setup: `SC.patch({turn:{chainLength:2}})`, play siphon_knowledge
  Check: draws 2+ cards (chain-scaled)

- [ ] **tutor L0 — searches deck for specific card type**
  Setup: play tutor
  Check: CardPickerOverlay or direct fetch; chosen card type added to hand

### 11.6 Wild Cards — Functional Correctness

- [ ] **mirror L0 — copies last played card's effect**
  Setup: play strike (QP), then play mirror
  Check: enemyHp delta matches strike QP damage again

- [ ] **adapt L0 — triggers CardPickerOverlay for type selection**
  Setup: play adapt
  Check: CardPickerOverlay appears with card type or mechanic choices

- [ ] **overclock L0 — doubles next card's effect**
  Setup: play overclock, then play strike
  Check: strike damage = 2 × baseline strike damage

- [ ] **phase_shift L0 — grants evasion or phase effect**
  Setup: play phase_shift, QP; enemy attacks
  Check: playerHp unchanged or damage reduced (phase evasion resolves)

- [ ] **chameleon L0 — changes card type in hand**
  Setup: play chameleon targeting a card
  Check: targeted card's type changes

- [ ] **dark_knowledge L0 — damage + card draw at HP cost**
  Setup: play dark_knowledge, QP
  Check: enemyHp delta > 0; cards drawn; possible playerHp decrease

- [ ] **chain_anchor L0 — sets active chain start to type 2**
  Setup: play chain_anchor
  Check: `getCombatState().chainLength` ≥ 2 or chain initialized to anchor type

- [ ] **unstable_flux L0 — random effect from pool**
  Setup: play unstable_flux
  Check: one of multiple possible effects resolves (damage / block / draw / buff)

- [ ] **sacrifice L0 — remove selected card for a power buff**
  Setup: play sacrifice with 2+ cards in hand
  Check: CardPickerOverlay appears; selected card removed; buff applied to player

- [ ] **catalyst L0 — doubles next card's effect (similar to overclock)**
  Setup: play catalyst, then play kindle
  Check: kindle effect doubled (Burn stacks doubled)

- [ ] **mimic L0 — copies enemy's next ability**
  Setup: play mimic; enemy has a defined ability
  Check: mimic resolves effect equivalent to enemy ability

- [ ] **aftershock L0 — delayed damage triggers next turn start**
  Setup: play aftershock; end turn
  Check: enemyHp decreases at start of next player turn

- [ ] **knowledge_bomb L0 CC — massive damage scaling with chain**
  Setup: `SC.patch({turn:{chainLength:4, chainMultiplier:2.5}})`, L0 knowledge_bomb, CC
  Check: enemyHp delta reflects chain-amplified damage burst


---

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

## SECTION 18 — CARD DESCRIPTION ACCURACY (DISPLAY vs ACTUAL)

> **Critical Steam-launch concern:** The damage/effect values shown on cards in the player's hand frequently diverge from what resolves when the card is played. Four independent root causes produce this gap. Section 18 verifies each systematically.
>
> Root causes:
> - **RC1 — Chain multiplier invisible:** `damagePreviewService.ts` `computeDamagePreview()` does not include the chain multiplier. A card showing "Deal 6 damage" with a 3.5× chain will actually deal 21.
> - **RC2 — 14 mechanics have resolver hardcodes:** Resolvers ignore stat-table values, so the card face shows a different number than what the resolver computes.
> - **RC3 — CC/CW branching absent from descriptions:** 18 mechanics show only the QP number and "CC: more" without the actual CC value.
> - **RC4 — Mastery milestone riders missing:** L3/L5 bonus effects are not reflected in card descriptions.

---

### 18.1 Chain Multiplier Display Gap

Test whether the card face updates when the chain multiplier rises, and whether the actual damage dealt matches `base × chain × other modifiers`.

- [ ] **Chain 1.0 (no chain) — strike: displayed vs actual**
  Setup: combat start, no chain active; hold strike in hand
  Check: card face shows base QP value (e.g. 4); play card QP; actual damage = 4; no chain bonus

- [ ] **Chain 1.2× — strike: displayed vs actual**
  Setup: chain multiplier = 1.2 (1 chain card played); check strike in hand
  Check: card face shows same base number (chain invisible to preview); play card QP; actual damage = floor(4 × 1.2) = 4 or 5 depending on floor logic; note discrepancy if face still shows 4

- [ ] **Chain 1.5× — strike: displayed vs actual**
  Setup: chain multiplier = 1.5; check strike in hand
  Check: card face number; play QP; actual damage = floor(4 × 1.5) = 6; document if face shows 4 (gap = 2)

- [ ] **Chain 2.0× — heavy_strike: displayed vs actual**
  Setup: chain multiplier = 2.0; check heavy_strike in hand
  Check: card face shows base (e.g. 8); play QP; actual damage = floor(8 × 2.0) = 16; document gap

- [ ] **Chain 2.5× — multi_hit: displayed vs actual**
  Setup: chain multiplier = 2.5; check multi_hit in hand (3 hits × base)
  Check: card face per-hit value; play QP; actual total = floor(base × 2.5) × 3; document face vs actual

- [ ] **Chain 3.5× — strike: maximum chain discrepancy**
  Setup: chain multiplier = 3.5 (6-card chain); check strike in hand
  Check: card face still shows base 4; play QP; actual = floor(4 × 3.5) = 14; player sees "4", deals 14 — document this gap

- [ ] **Chain 3.5× — chain_lightning: compound gap**
  Setup: chain multiplier = 3.5; check chain_lightning in hand
  Check: card face value; play CC; actual damage = chain delegates to turnManager (chain × base), not stat table; document triple compounding: invisible chain + CC delegate + stat mismatch

- [ ] **CC mode at chain 2.0× — strike CC: displayed vs actual**
  Setup: chain multiplier = 2.0; switch to CC mode; check strike in hand
  Check: card face shows CC value (not QP); play CC; actual damage = CC_base × 2.0; verify face matches or note gap

- [ ] **Chain display regression — after chain resets to 1.0**
  Setup: build chain to 2.5×, then break chain; check hand
  Check: card face values reset to base (not stuck at chain-boosted preview if any preview existed)

---

### 18.2 Severity A — Resolver Hardcode Drift (14 mechanics)

For each mechanic, play QP and CC variants and compare the card face display to the actual resolved value. Discrepancies indicate resolver hardcodes ignoring the stat table.

- [ ] **thorns — CC/CW reflect values hardcoded**
  Setup: equip thorns card; note card face reflect value
  Check QP: play QP; actual reflect damage to attacker; record value
  Check CC: play CC; actual reflect damage; record value
  Expected: face value, QP value, CC value all sourced from stat table; flag if resolver uses a different hardcode

- [ ] **fortify — resolver uses playerState.shield × 0.5, ignores qpValue**
  Setup: player has 10 shield; note fortify card face value
  Check QP: play QP; actual block gained = shield × 0.5 = 5; card face likely shows a fixed number ≠ 5
  Check CC: play CC; actual block gained; compare to face
  Expected: face should show "50% of current shield" dynamically; flag if face shows static number

- [ ] **gambit — CC heal hardcoded to 5, stat table says 3**
  Setup: note gambit card face heal value
  Check QP: play QP; actual heal = 3 (stat table); face should show 3
  Check CC: play CC; actual heal = 5 (hardcode, not stat table); face still shows 3
  Expected: CC face should show 5; currently shows 3 — gap = 2

- [ ] **chain_lightning — CC delegates to turnManager (chain × base), not stat table**
  Setup: chain multiplier = 2.0; note chain_lightning card face value
  Check QP: play QP; actual damage from stat table; note value
  Check CC: play CC; actual damage = chain × base via turnManager, independent of qpValue; compare to face
  Expected: face should reflect CC path; currently likely shows QP-derived number

- [ ] **overcharge — CC delegates to turnManager**
  Setup: note overcharge card face value
  Check QP: play QP; actual effect; note value
  Check CC: play CC; actual effect via turnManager delegation; compare to face
  Expected: face shows QP value; CC path diverges — document delta

- [ ] **lacerate — burn stacks hardcoded**
  Setup: note lacerate card face burn-stack value
  Check QP: play QP; actual burn stacks applied; compare to face
  Check CC: play CC; actual burn stacks; compare to face
  Expected: all values should match stat table; flag any hardcoded burns that differ

- [ ] **kindle — burn stacks hardcoded**
  Setup: note kindle card face burn-stack count
  Check QP: play QP; actual burn stacks applied; compare to face
  Check CC: play CC; actual burn stacks; compare to face
  Expected: all values from stat table; flag deviations

- [ ] **precision_strike — CC uses hardcoded psBaseMult=8, stat table qpValue=5**
  Setup: note precision_strike card face value (should show 5 from qpValue)
  Check QP: play QP; actual damage = 5; face ✓ matches
  Check CC: play CC; actual damage = 8 (hardcoded psBaseMult); face shows 5; gap = 3
  Expected: CC face should show 8; currently shows 5

- [ ] **lifetap — shows 4, resolver uses 5**
  Setup: note lifetap card face HP drain value (should show 4)
  Check QP: play QP; actual HP drain = 5; face shows 4; gap = 1
  Check CC: play CC; actual HP drain; compare to face
  Expected: face should show 5; currently shows 4

- [ ] **shrug_it_off — shows 6 block, resolver uses 2**
  Setup: note shrug_it_off card face block value (should show 6)
  Check QP: play QP; actual block gained = 2; face shows 6; gap = 4
  Check CC: play CC; actual block; compare to face
  Expected: face should show 2; currently shows 6 — severe overclaim

- [ ] **guard — shows 8 block, resolver uses 14**
  Setup: note guard card face block value (should show 8)
  Check QP: play QP; actual block gained = 14; face shows 8; gap = 6
  Check CC: play CC; actual block; compare to face
  Expected: face should show 14; currently shows 8 — severe underclaim

- [ ] **absorb — shows 3 block, resolver uses 2**
  Setup: note absorb card face block value (should show 3)
  Check QP: play QP; actual block gained = 2; face shows 3; gap = 1
  Check CC: play CC; actual block; compare to face
  Expected: face should show 2; currently shows 3

- [ ] **rupture — shows 5 damage, resolver uses 2**
  Setup: note rupture card face damage value (should show 5)
  Check QP: play QP; actual damage = 2; face shows 5; gap = 3
  Check CC: play CC; actual damage; compare to face
  Expected: face should show 2; currently shows 5 — severe overclaim

- [ ] **sap — shows 3 damage, resolver uses 1**
  Setup: note sap card face damage value (should show 3)
  Check QP: play QP; actual damage = 1; face shows 3; gap = 2
  Check CC: play CC; actual damage; compare to face
  Expected: face should show 1; currently shows 3 — severe overclaim

---

### 18.3 Modifier Reflection on Card Face

Verify whether the card face number updates live when modifiers are applied. A green tinted or increased number indicates the modifier is reflected; an unchanged number indicates a display gap.

- [ ] **Strength (+25% per stack) — card number turns green and increases**
  Setup: apply strength=2 to player; check an attack card in hand
  Check: card face damage value should increase by ~50% and display green tint; actual damage on play should match displayed value

- [ ] **Weakness (-25% per stack) — card number turns red and decreases**
  Setup: apply weakness=2 to player; check an attack card in hand
  Check: card face damage value should decrease by ~50% and display red tint; actual damage on play should match

- [ ] **Enemy Vulnerable (1.5×) — card number increases**
  Setup: apply vulnerable to enemy; check an attack card in hand
  Check: card face damage should increase by ×1.5; actual damage on play matches new displayed value; flag if face does not update

- [ ] **Whetstone relic (+3 flat damage) — number includes +3**
  Setup: equip whetstone relic; check any attack card in hand
  Check: card face shows base + 3 (e.g. strike shows 7 not 4); play card; actual damage matches face

- [ ] **Inscription of Fury relic (flat bonus) — reflected on face**
  Setup: equip inscription_of_fury; check attack card in hand
  Check: card face shows boosted value; play card; actual damage matches; flag if face still shows un-boosted value

- [ ] **Empower buff (+50%/+75%) — card number updates**
  Setup: apply empower buff to player; check attack card in hand
  Check: card face reflects +50% (or +75% at CC); play card; actual damage matches

- [ ] **Overclock status (2× damage) — card face doubles**
  Setup: apply overclock to player; check attack card in hand
  Check: card face should show doubled value; actual damage = base × 2; flag if face unchanged

- [ ] **Double Strike mechanic (2×) — card face reflects multiplier**
  Setup: trigger double_strike buff; check attack card in hand
  Check: card face should reflect 2× output; actual damage on play is doubled; flag if face shows single-hit value

- [ ] **Surge turn bonus — card face includes surge multiplier**
  Setup: trigger surge condition (e.g. play required surge cards); check attack card
  Check: card face should update with surge bonus applied; actual damage matches; flag if face does not include surge

- [ ] **Cursed card penalty (QP × 0.70) — card face shows reduced value**
  Setup: card is cursed; view it in hand
  Check: card face damage shows 70% of base; play QP; actual = base × 0.70; flag if face shows full base

- [ ] **Blood Price AP change — reflected in AP cost display**
  Setup: blood_price effect active; check card AP cost in hand
  Check: AP cost display updates to reflect blood price cost change; actual cost on play matches display

- [ ] **Glass Lens relic (+50% CC damage) — CC face value updated**
  Setup: equip glass_lens; switch to CC mode; check attack card
  Check: CC face value = normal_CC × 1.5; play CC; actual damage matches; flag if face shows un-boosted CC

- [ ] **Volatile Core relic (+50%) — card face includes bonus**
  Setup: equip volatile_core; check attack card in hand
  Check: card face shows boosted value; actual damage on play = base × 1.5; flag if face unchanged

- [ ] **Reckless Resolve (<40% HP: +50%) — conditional update**
  Setup: reduce player HP below 40%; equip reckless_resolve; check attack card
  Check: card face increases by 50% when below threshold; returns to normal above threshold; flag if face never updates

---

### 18.4 CC vs QP Display Mode

- [ ] **Default display shows QP value**
  Setup: fresh combat encounter; do not enter charge mode; view cards in hand
  Check: all card face numbers reflect QP values from stat table; no CC values shown by default

- [ ] **CC mode number switch when charge mode entered**
  Setup: enter charge mode (hold or toggle charge); view same cards in hand
  Check: card face numbers switch to CC values; verify against stat table CC column; flag if numbers unchanged

- [ ] **Mode toggle clarity — player can tell which mode is active**
  Setup: toggle between QP and CC modes
  Check: visual indicator (color change, icon, label) clearly distinguishes QP from CC mode; a new player can determine mode without tooltip

- [ ] **CC value for gambit shows 5 (not 3) in CC mode**
  Setup: enter CC mode; view gambit card
  Check: gambit face shows 5 (the hardcoded CC heal); if it shows 3 (QP value), flag as description accuracy failure

- [ ] **CC value for precision_strike shows 8 (not 5) in CC mode**
  Setup: enter CC mode; view precision_strike card
  Check: face shows 8 (hardcoded psBaseMult); if shows 5 (qpValue), flag as description accuracy failure

- [ ] **After exiting CC mode — values revert to QP**
  Setup: enter CC mode then exit; view cards
  Check: all card face numbers return to QP values; no CC values persist

---

### 18.5 Mastery Level Tag Display

For cards with L3/L5 mastery tags, verify that the card description explicitly mentions the bonus effect unlocked at that tier.

- [ ] **strike L5 — description mentions "+4 if 3+ cards played this turn"**
  Setup: view strike card at mastery L5 (or in expanded card detail)
  Check: description text references the L5 bonus strike_tempo3 rider; flag if description reads same as L1

- [ ] **block L5 — description mentions consecutive-play block bonus**
  Setup: view block card at mastery L5
  Check: description references block_consecutive3 or equivalent; flag if absent

- [ ] **chain_lightning L3 — description mentions minimum chain=2**
  Setup: view chain_lightning at mastery L3
  Check: description notes that chain_lightning_min2 activates (chain treated as minimum 2 even if lower); flag if absent

- [ ] **chain_lightning L5 — description mentions AP cost reduction**
  Setup: view chain_lightning at mastery L5
  Check: description notes AP cost reduced at L5; flag if absent

- [ ] **transmute L3 — description mentions +1 mastery on use**
  Setup: view transmute at mastery L3
  Check: description references transmute_upgrade1 bonus; flag if absent

- [ ] **transmute L5 — description mentions 2 transforms per use**
  Setup: view transmute at mastery L5
  Check: description references double-transform rider; flag if absent

- [ ] **hemorrhage L5 — description mentions AP cost = 1**
  Setup: view hemorrhage at mastery L5
  Check: description notes AP cost drops to 1 at L5; flag if absent

- [ ] **catalyst L3 — description mentions burn stack doubling**
  Setup: view catalyst at mastery L3
  Check: description references burn doubling on apply; flag if absent

- [ ] **catalyst L5 — description mentions TRIPLE burn stacks**
  Setup: view catalyst at mastery L5
  Check: description explicitly says 3× (not 2×) burn stacks at L5; flag if absent or unclear

- [ ] **volatile_slash L5 — description mentions no-forget on miss**
  Setup: view volatile_slash at mastery L5
  Check: description notes card is not forgotten if quiz missed at L5; flag if absent

- [ ] **bulwark L3 — description mentions no-forget rider**
  Setup: view bulwark at mastery L3
  Check: description notes bulwark_no_forget behavior at L3+; flag if absent

- [ ] **multi_hit L3 — description mentions extra hit count**
  Setup: view multi_hit at mastery L3
  Check: description references increased hit count at L3; flag if absent

- [ ] **multi_hit L5 — description mentions maximum hit count**
  Setup: view multi_hit at mastery L5
  Check: description references L5 hit count (highest tier); flag if absent or shows L3 count

---

### 18.6 Shield Card Block Value Accuracy

Same verification structure as Section 18.2 but for block/shield cards.

- [ ] **shrug_it_off: QP displayed block vs actual (face=6, resolver=2)**
  Setup: note shrug_it_off face block value (6); player has no existing shield
  Check: play QP; actual shield gained = 2; gap = 4; this is Severity A resolver hardcode

- [ ] **guard: QP displayed block vs actual (face=8, resolver=14)**
  Setup: note guard face block value (8)
  Check: play QP; actual shield gained = 14; gap = 6 (underclaim — player receives more than shown)

- [ ] **absorb: QP displayed block vs actual (face=3, resolver=2)**
  Setup: note absorb face block value (3)
  Check: play QP; actual shield gained = 2; gap = 1

- [ ] **fortify: dynamic vs static display**
  Setup: player has shield=10; note fortify face value
  Check: fortify face should dynamically show "50% of current shield = 5"; play QP; actual block = shield × 0.5; if face shows static number, flag as display gap

- [ ] **standard block card: face matches actual**
  Setup: play any standard block card (not one of the 4 above) at no modifiers
  Check: face value = actual shield gained; no gap; confirm as baseline

- [ ] **block card + Strength modifier — does block card face update?**
  Setup: apply strength=2 to player; view block card in hand
  Check: block cards should NOT scale with strength (strength is attack-only); face should not show boosted value; if it does, flag as incorrect modifier application

- [ ] **block card + Relic bonus to block — face reflects bonus**
  Setup: equip a relic that adds flat block (e.g. iron_will); view block card
  Check: face should include relic bonus; actual block gained matches face + bonus; flag if face unchanged

---

### 18.7 Cross-Reference: Card Face vs API vs Actual Resolved

For each of the 5 representative cards below: (a) read the face value from screenshot, (b) read `getCombatState().hand[i].baseEffectValue` from the JS API, (c) play the card and measure actual damage/block delta. Document all three.

- [ ] **strike — face vs baseEffectValue vs actual damage**
  Setup: no modifiers, chain=1.0; note strike in hand
  Check: (a) card face value; (b) `getCombatState().hand[i].baseEffectValue` for strike; (c) actual enemy HP delta after QP play
  Expected: all three agree at base QP value; document any divergence

- [ ] **heavy_strike — face vs baseEffectValue vs actual damage**
  Setup: no modifiers, chain=1.0; note heavy_strike in hand
  Check: (a) face; (b) API baseEffectValue; (c) actual HP delta after QP
  Expected: all three agree; heavy_strike face/API should be ~8; flag if resolver diverges

- [ ] **block — face vs baseEffectValue vs actual shield gained**
  Setup: no modifiers, no existing shield; note block card in hand
  Check: (a) face; (b) API baseEffectValue; (c) actual shield delta after QP
  Expected: all three agree; flag if shield gained ≠ face value

- [ ] **chain_lightning — face vs baseEffectValue vs actual damage (CC path)**
  Setup: no modifiers, chain=1.0; enter CC mode; note chain_lightning in hand
  Check: (a) CC face value; (b) API baseEffectValue; (c) actual HP delta after CC play
  Note: chain_lightning CC delegates to turnManager — expect (b) API value to differ from (c) actual; document delta

- [ ] **empower — face vs baseEffectValue vs actual buff applied**
  Setup: no modifiers; note empower card in hand
  Check: (a) face value (the buff magnitude shown); (b) API baseEffectValue; (c) actual empower buff magnitude applied to player after play
  Expected: all three agree; flag if empower applies a different bonus than displayed


## Implementation Notes

**Viewport presets for Docker containers:**
- Portrait: `412 × 915` (default mobile, primary)
- Landscape: `1280 × 720` (Steam primary target)
- Tablet: `1024 × 768` (secondary check)

**Standard test sequence per item:**
1. `await __rrScenario.loadCustom(config)` or `__rrScenario.load('preset-name')`
2. `await __rrScenario.patch(overrides)` if needed
3. `const layout = await __rrLayoutDump()` — verify spatial correctness
4. `const path = await __rrScreenshotFile()` — capture visual state
5. Read screenshot + layout dump together for full verification

**Key spatial assertions from `__rrLayoutDump()`:**
- Status effects: y-position should be > (enemy HP bar y + HP bar height) and < (enemy sprite bottom)
- Power badges: x-positions all within `[0, viewportWidth]`, y within `[0, viewportHeight]`
- Hand cards: all card bottom edges < viewport height (no clipping below fold)
- Relic tray: all relic slots x within `[0, viewportWidth]`
- AP orb: x/y within viewport, clickable

**Key pixel assertions from screenshots:**
- Status effect icons: minimum 24px visible height; label text readable
- Power badge icons: minimum 32px visible; no overlap with adjacent badges
- Chain counter: multiplier text clearly readable; color bar matches chain type
- Damage numbers: at least 30px font size; contrast ratio sufficient against background
- HP bars: fill width visually proportional to HP percentage

---

### Critical Files for Implementation

- `/Users/damion/CODE/Recall_Rogue/src/dev/scenarioSimulator.ts`
- `/Users/damion/CODE/Recall_Rogue/src/ui/components/CardCombatOverlay.svelte`
- `/Users/damion/CODE/Recall_Rogue/src/ui/components/EnemyPowerBadges.svelte`
