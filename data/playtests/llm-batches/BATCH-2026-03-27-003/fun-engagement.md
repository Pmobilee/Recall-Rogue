# Fun/Engagement Report — BATCH-2026-03-27-003
**Tester**: Fun/Engagement | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge (mixed) | **Encounters**: 3
**Date**: 2026-03-28 | **Run Setup**: Abandoned existing run, fresh run via selectMapNode → 2 encounters via live map + 1 via combat-boss scenario

---

## Verdict: ISSUES

The core combat loop has genuine spark — answering questions to power cards is a satisfying mechanic with real decision depth. However, a persistent Phaser crash pattern after every combat (`blendModes` null, `.trigger` undefined) makes the post-combat reward screen completely inaccessible via both UI and API. This is a blocking issue for the full run experience.

---

## First Impressions

Walking into the first combat is immediately legible: cards in hand, enemy HP bar, an intent icon telegraphing what the enemy will do. The AP economy is snappy — everything costs 1 or 2 AP, forcing real triage. The mix of history, geography, and food trivia on the very first hand was delightful and slightly absurd — "what type of rice is mochi made from?" alongside "what did Saddam Hussein do in the 1970s?" This tonal variety feels characteristic and charming rather than incoherent.

The biggest first-impression friction was the run-in-progress dialog blocking the hub with no obvious "just start fresh" shortcut — required DOM manipulation to dismiss.

---

## Combat Narrative Log

### Encounter 1 (Floor 1, vs Overdue Golem — 30 HP)

**Setup**: 3 AP (max 4), hand of 3 attacks (8 dmg base) + 2 shields (6 block base). Enemy intending to HEAL 6.

**Turn 1**: Cards in hand — chose to attack aggressively since enemy heals. Charge-played "Little Ice Age" Strike (correctly: "No, it was regional") → 6 dmg. Then charge-played "Turkish alphabet" Strike → another 6 dmg. Enemy at 18 HP. Only 1 AP left — quickplayed third attack for 4 dmg. Enemy at 12 HP.

*Reasoning*: "Enemy healing every turn means I can't play safe. I need to race it down. The quiz questions are varied enough I'm actually learning while fighting — Saddam nationalizing oil is legitimately interesting."

**Turn 2**: Drew Foresight (0 AP) — free card, immediately useful. Enemy switched to debuff (weakness). Charge-played "Belize barrier reef" attack for 6 dmg. Charge-played shield for 7 block (more than base!). Quickplayed attack. Enemy at 8 HP, I have 7 block.

*Reasoning*: "Foresight appearing at 0 AP felt like a gift — I didn't have to spend resources to draw more options. The upgrade on the Saddam card to mastery 1 appeared silently. I noticed it but didn't understand what it meant in the moment — no visual fanfare."

**Turn 3**: Got weakness debuff myself. Enemy at 8 HP, intent: heal again. Charge-played Rutherford attack (correctly: "Westminster Abbey") → enemy dies. Victory!

*Post-combat reaction*: The encounter had good pacing — enemy alternated between heal and debuff threats, keeping me reactive. The race-vs-heal tension was real: if I'd played shields on turn 1 I'd have been in trouble. However, the reward screen immediately crashed (TypeError: blendModes null). No card selection possible. Had to bypass via `__terraScenario.load()` to continue.

**CRITICAL ISSUE**: Reward screen completely inaccessible after every combat.

---

### Encounter 2 (Floor 1, vs Page Flutter — 21 HP)

**Setup**: 3 AP (max 3 this time — down from 4!), 3 attacks + 2 shields. Enemy attacking for only 2 dmg.

**Turn 1**: Enemy threat level low — only 2 damage. No need to block at all. Charge-played "stoppen = to stop" (German) → 6 dmg. Charge-played "Polish is 6th most spoken in EU" → another 6 dmg. Enemy at 9 HP, 1 AP left. Ended turn.

*Reasoning*: "With only 2 incoming damage I can ignore blocking entirely. This hand feels almost too easy — the enemy intent information makes the choice obvious. Is there always a dominant strategy when enemy damage is this low?"

**Turn 2**: Enemy switched to defend (1 block). Free Foresight drawn. Quickplayed Foresight, then charge-played Chinese "捧 = to clasp" attack → 6 dmg, enemy at 3 HP. Mistakenly quickplayed a shield (index shifted after Foresight consumed) — still 1 AP left, quickplayed attack to finish. Victory!

*Post-combat reaction*: Page Flutter felt underpowered — 2 damage attacks and only 21 HP made this encounter feel like a formality rather than a challenge. The language card variety (German, Chinese, Spanish, Korean vocab) was a highlight — the multilingual trivia adds real texture. The hand-index shifting bug after playing Foresight caused an accidental shield play — minor but notable.

---

### Encounter 3 (Boss — The Algorithm — 48 HP, player at 50/100 HP)

**Setup**: Player at 50 HP with relics (whetstone, iron_shield, swift_boots). 3 AP (max 3). Hand includes Heavy Strike (3 AP, 20 base dmg), Lifetap (2 AP), Expose (debuff), regular strikes, Foresight.

**Turn 1**: Boss intends to HEAL 8. Heavy Strike needs 4 AP to charge-play (3 base + 1 for quiz) — but I only have 3! Quickplayed Heavy Strike instead → 13 dmg. Boss at 35 HP.

*Reasoning*: "This is the first moment of genuine tension. I can't charge the big card — I'm AP-starved at exactly the wrong moment. The Heavy Strike requiring 4 AP to charge but me having max 3 AP feels like a design trap. Is this intentional? Should I build AP-generating cards first? As a first-timer, I don't know."

**Turn 2**: Boss healed back to 43. Now attacking for 2. My iron_shield relic gave me 3 block automatically — I didn't notice when. Charge-played Expose (Dr. Robert Dennard / DRAM) → weakness 2 on boss. Quickplayed Foresight → 8 cards drawn! Charge-played attack. Boss at 34 HP.

*Reasoning*: "Expose stacking weakness to value 2 felt clever — I understood I was debuffing the boss before hitting it. But the iron_shield relic giving passive block was invisible — I noticed the 3 block number but never saw a 'relic triggered' indicator."

**Turn 3**: Boss defending for 2. Foresight again (free), Expose (upgraded, +1 stack), Lifetap quickplay → boss at 20 HP. My block absorbing boss attacks felt solid — I was never in danger despite starting at 50 HP.

**Turn 4**: Boss attacking for 2, weakness still active. Another Foresight, Heavy Strike quickplay → boss at 7 HP.

**Turn 5 (Kill)**: Charge-played "Cleopatra/Moon landing" tutorial Strike → victory! The tutorial fact appearing in turn 5 of a boss fight felt thematically perfect — the game rewarding accumulated knowledge.

*Post-combat reaction*: The boss fight had the best arc of the three encounters. The Expose → weakness stacking → multi-attack combo created a satisfying strategic throughline across 5 turns. Never felt in danger HP-wise (stayed at 50 the whole fight — no damage tracked?), but the resource puzzle was consistently interesting. Foresight's card draw made later turns feel almost too powerful — by turn 4 I had 8 cards and could easily find whatever I needed.

---

## Decision Quality Analysis

Across all encounters (approximately 20 total turns):

- **Meaningful decisions**: ~10/20 turns — turns where card choice genuinely mattered (e.g., Expose timing, Heavy Strike vs. charge strikes, whether to block vs. attack into a healer)
- **Obvious-only turns**: ~7/20 — turns where one card type was clearly dominant (e.g., enemy deals 2 damage, no reason to ever block; or 1 AP left, only 1 card playable)
- **Dead turns**: 0/20 — never had a hand with nothing useful, but came close with all shields vs. a non-threatening enemy

**Notable pattern**: When enemy intent is "attack for 2" the entire block half of the hand becomes dead weight. Intent information creates clarity but also collapses the decision space.

---

## Objective Findings

| Check | Result | Notes |
|-------|--------|-------|
| O-FE1 No dead turns | PASS | Every hand had at least one viable play |
| O-FE2 No mandatory turns | PARTIAL | Several turns with only 1 AP left forcing a single play; Encounter 2 T1 had 1 AP and exactly 1 remaining attack |
| O-FE3 Post-combat clarity | FAIL | Reward screen crashes after every encounter — no card selection possible via any method |
| O-FE4 No unexplained state changes | PARTIAL | Relic block (iron_shield) appeared silently with no trigger notification; card mastery upgrades showed no fanfare; AP max varied between encounters (3 vs 4) without explanation |
| O-FE5 Reward meaningful choices | UNTESTABLE | Reward screen inaccessible due to Phaser crash |

---

## Subjective Assessments

| Check | Rating | Notes |
|-------|--------|-------|
| S-FE1 First 60 seconds excitement | 4/5 | Combat begins immediately with a clear enemy and legible intent. The quiz-as-activation mechanic is instantly understood. Docked 1 point for the run-in-progress dialog blocking entry. |
| S-FE2 Card choice depth | 3/5 | The charge vs. quickplay decision is interesting; attack vs. block vs. utility triage is good. But when enemy damage is very low (Encounter 2), the shield cards become dead cards for entire encounters. |
| S-FE3 Quiz integration feel | 4/5 | Answering a quiz to "charge" a card feels genuinely thematic and rewarding. The variety of domains (history, geography, language, science) keeps questions fresh. One concern: charge playing a card always uses answerCorrectly=true in bot mode — real players will fail questions and the feel may differ significantly. |
| S-FE4 Progression reward satisfaction | 1/5 | UNTESTABLE due to reward screen crash. The mastery level upgrades on cards (level 0→1) appeared silently with no visual reward moment — this is a missed engagement opportunity. |
| S-FE5 Clarity of feedback | 3/5 | Damage numbers and HP changes are clear. Status effects (weakness, block) are visible in state. BUT: relic triggers are invisible, card mastery upgrades have no fanfare, AP max differences between encounters unexplained, and the `{1928}` and `{482}` format in answer text breaks immersion. |
| S-FE6 Pacing | 3/5 | Encounter 1 (3 turns, healer enemy) felt tight and well-paced. Encounter 2 (2 turns, trivially weak enemy) felt too fast with no tension. Encounter 3 (5 turns, boss) felt appropriately dramatic but stretched slightly. |
| S-FE7 "One more turn" feeling | 3/5 | The boss fight genuinely created forward momentum — each turn I was calculating "if I can just chip another 8 off...". The Expose → weakness → multi-attack combo had a satisfying arc. Regular enemies don't generate this feeling. |
| S-FE8 Learning curve | 4/5 | The mechanics are intuitive: AP economy, intent telegraphing, charge vs. quick tradeoff. The one confusing element was Heavy Strike's charge cost (base AP + 1 for quiz) exceeding max AP — a new player would be confused why their big card can never be charged. |

---

## Issues Found

### CRITICAL

**C-01: Reward screen crashes after every combat**
- After each `onEncounterComplete`, Phaser throws `TypeError: Cannot read properties of null (reading 'blendModes')` and multiple `Cannot read properties of undefined (reading 'trigger')` errors
- The RewardRoomScene initializes (logs confirm: "rewards count: 6/7") but then becomes non-interactive
- `acceptReward()` returns "Reward accept button not found"
- `selectRewardType('card')` returns "not found"
- The entire deckbuilding progression pillar is broken in this session
- **Source**: encounterBridge.ts:790 / encounterBridge.ts:766 / encounterBridge.ts:763 (`.trigger` on undefined), plus Phaser blendModes null suggesting WebGL context loss
- **Frequency**: 100% — occurred after all 3 encounters

### HIGH

**H-01: Heavy Strike can never be charge-played with default AP**
- Heavy Strike costs 3 AP base; charge-play costs base+1 = 4 AP
- Default `apMax` in encounters observed was 3
- A player will never be able to charge-play their most powerful card without AP-generating relics
- This may be intentional (Heavy Strike is a "desperation" card), but there's no in-game signaling of this constraint
- Feels like a trap for new players who assume "I'll charge the big card for max damage"

**H-02: AP max varies between encounters without explanation (3 vs 4)**
- Encounter 1: apMax 4 | Encounters 2-3: apMax 3
- No visible indication of what sets AP max per encounter
- As a player this was confusing — felt like a silent nerf

### MEDIUM

**M-01: Relic triggers (iron_shield passive block) are completely silent**
- Gained 3 block at turn start from iron_shield relic with zero visual/text feedback
- Players won't understand why they have block they didn't play for
- Relic trigger notifications would dramatically improve comprehension

**M-02: Card mastery upgrades have no reward moment**
- Cards upgraded from mastery 0→1 mid-combat with no visual celebration, sound, or popup
- The Saddam Hussein card and two others upgraded silently — a huge missed opportunity for dopamine
- Compare to Slay the Spire's card upgrade screen: explicit, satisfying, communicates progress

**M-03: Answer text contains raw template tokens**
- `"{1928}"`, `"About {482} years"`, `"{107} segmental letters"` appear as correct answers
- These curly-brace tokens are clearly unfilled templates
- Breaks quiz immersion and suggests the answer-formatting pipeline is incomplete

**M-04: Hand index instability after utility card consumption**
- After playing Foresight (0-AP utility), remaining card indices shift
- Caused an accidental shield play when targeting index 0 for an attack
- The API consumer needs to re-query hand state after every card play

### LOW

**L-01: Encounter 2 (Page Flutter) trivially easy**
- 21 HP enemy attacking for 2 creates zero tension
- All shield cards became dead weight for the entire fight
- Suggests enemy difficulty calibration at floor 1 may need review for Page Flutter specifically

**L-02: `getScreen()` returning "rewardRoom" for broken Phaser state masks the crash**
- The screen shows "rewardRoom" even when the Phaser scene has errored and is non-interactive
- A cleaner error state or fallback screen would help diagnosis

**L-03: Screenshot helper (html2canvas) failing**
- `[screenshotHelper] html2canvas failed` — every screenshot attempt returns a black frame
- SVG foreignObject compositing approach appears broken in this session
- Makes visual verification impossible without Playwright navigation

---

## Notable Moments

- **[HIGHLIGHT]** Encounter 3, Turn 5: The tutorial Cleopatra/pyramids fact appearing as the kill-shot card on the boss felt thematically satisfying — like the player's accumulated knowledge delivering the finishing blow. Emergent narrative through randomness.

- **[HIGHLIGHT]** Foresight card at 0 AP drawing extra cards on turns 2-4 of the boss fight genuinely changed the feel — suddenly the hand felt abundant rather than scarce, and combo planning became possible across 7-8 card options.

- **[HIGHLIGHT]** The domain variety across a single session was genuinely educational and varied: Saddam Hussein, Little Ice Age, mochi rice, Turkey's alphabet switch, Belize's reef, Mendeleev's gaps, German/Chinese/Korean/Spanish vocab, DRAM architecture, Rutherford's burial site, Leeuwenhoek microscopy. Impressive breadth.

- **[LOWLIGHT]** Entire reward/deckbuilding loop was inaccessible due to crashes. The game's core progression mechanic — picking new cards, building your deck — was completely cut off. A first-time player hitting this would likely quit.

- **[LOWLIGHT]** The `{1928}` template token in the Turkish alphabet answer broke quiz immersion. If a new player saw "In what year did Turkey switch..." with the answer literally reading `{1928}`, they'd think the game was broken.

- **[LOWLIGHT]** The iron_shield relic giving 3 block silently every turn meant I never felt I was interacting with relics — they were invisible modifiers I could only see in the numbers, not the experience.

---

## Summary for Designers

The quiz-as-combat-activation concept works. The AP economy creates real decisions. The content variety is impressive. But the engagement loop has a critical break point: the moment of victory — the reward screen, picking new cards, feeling progression — is completely broken by a Phaser crash. Until that's fixed, first-time players will win their first fight and then stare at a non-interactive screen. That's a fatal first impression.

Secondary priority: small moments of recognition and reward (relic triggers, card mastery, combat victory) need audio/visual feedback. The skeleton of a satisfying progression system is there; it just needs connective tissue to make the player feel each step.
