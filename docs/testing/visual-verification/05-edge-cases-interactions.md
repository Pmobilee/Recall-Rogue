<!--
  Purpose: Edge cases (hand size, relic tray, overflow), interaction states, batch megastate scenarios.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 6.1-6.5 (edge cases), 7.1-7.8 (interactions), 8.1-8.7 (batch scenarios)
-->

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
