<!--
  Purpose: Status effect bars, enemy power badges, quiz-active state visual verification.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 1.1-1.5
-->

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
