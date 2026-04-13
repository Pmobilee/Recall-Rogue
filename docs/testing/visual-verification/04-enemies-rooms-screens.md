<!--
  Purpose: Enemy behaviors, room/screen visual correctness, sprite audit, misc screens.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 4.1-4.6 (enemies), 5.1-5.15 (rooms/screens), 9.1-9.3 (sprites), 10.1-10.4 (misc)
-->

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
