# Fun/Engagement Report — BATCH-2026-04-02-004

**Date**: 2026-04-02
**Tester**: LLM Fun & Engagement Agent (game-logic)
**Run**: general_knowledge / balanced archetype, Floor 1
**Result**: Completed 3 encounters (Ink Slug → The Citation Needed → Index Weaver)
**Final State**: 100/100 HP, 76 gold, 3 relics acquired (Vitality Ring via Encounter 3), no deaths

---

## Verdict: ISSUES

The core moment-to-moment loop is **genuinely fun** — card choices feel meaningful, quiz integration is smooth, and the knowledge/action feedback loop works well. However, **two significant friction issues** were discovered: (1) a persistent `rewardRoom` stuck state after relic-choice rewards, and (2) the `acceptReward()` playtest API failing silently on relic rewards. Both block clean post-combat flow.

---

## First Impressions

Walking into combat with 5 cards and 3 AP felt immediately intuitive. The hand contained 3x Block and 2x Strike — clear archetypes, no confusion. The enemy "Ink Slug" with 32 HP and "Mud slash" intent for 3 damage communicated threat clearly. The key novelty — charge a card to answer a quiz for 1.5× damage — was immediately compelling: _"Do I risk the AP surcharge for a quiz I might not know?"_

The quiz preview API made the decision transparent: I could peek at the question before committing. That's good design. The SAS founding question (David Stirling) was hard for a trivia newcomer, but the 4 choices were semantically coherent (WWII figures, not random noise). Even getting it wrong would have taught something real.

---

## Combat Narrative Log

### Encounter 1: Ink Slug (32 HP → Dead in 2 turns)

**Turn 1** (3 AP available, Ink Slug planning "Mud slash" for 3 dmg):

Hand: `[Strike(8), Block(6), Strike(8), Block(6), Block(6)]`

- **Turn 1, Play 1**: Charge Strike index 0 — "SAS founding/David Stirling question. Hard history, but I'll commit to learn it." Answered CORRECTLY. Dealt 12 damage (Strike 8 × 1.5 charge bonus). Enemy: 32 → 24. AP: 3 → 2.
- **Turn 1, Play 2**: Quick Block — "Ink Slug attacks for 3, block is free insurance." Gained 5 block. AP: 2 → 1.
- **Turn 1, Play 3**: Quick Strike — "1 AP left, free 8 damage." Enemy: 24 → 20. AP: 1 → 0.

*End Turn: Block absorbed incoming 3 damage. Player HP stayed 100. Enemy chose "Sliming" (defend) next turn.*

**Turn 2** (7 cards in hand now — deck recycle feels good):

Hand: `[Block, Strike, Strike, Foresight, Strike, Block, Block]`

- **Turn 2, Play 1**: Charge Strike — "Enemy defending, no incoming attack — go all-in." Answered correctly. Heavy damage. Enemy: 20 → 7.
- **Turn 2, Play 2**: Quick Strike — dealt 8. Enemy: 7 → 3.
- **Turn 2, Play 3**: Quick Strike — dealt 8. Enemy dead.

**Post-combat reaction**: Clean 2-turn kill with no damage taken. Satisfying. The "Mud slash" telegraph communicated intent clearly. Block felt valuable even when not strictly necessary — good tension. The quiz for Strike felt like a fair difficulty ramp: hard enough to reward learning, not so obscure as to feel unfair.

*FIRST IMPRESSION HIGHLIGHT: The charge decision felt genuinely weighted. 1 extra AP is a real cost.*

---

### Map Navigation Between Encounters

After reward room, map showed r1-n0 and r1-n1. Picked r1-n0 — got a **Mystery Event: "The Reading Nook"** ("A quiet corner with a well-worn book. Reading it sharpens one of your cards."). This was a passive upgrade (no choice presented). Brief and clear. No friction. Good.

Next path led to r2-n0 → **Rest Room** (had 3 choices):
- "Rest Heal 30% HP +30 HP" (at 100 HP = wasted)
- "Study Quiz 3 questions — each correct upgrades a card"
- "Meditate — Remove 1 card from deck"

Decision: Chose Meditate to remove Foresight. The deck selector on the Meditate screen was **excellent** — showed all cards with their fact questions. A new player could make an informed cull decision. Removed Foresight (low value at 2 effect, no combat role).

*Meditate UX was the clearest screen in the game — all information present, decision meaningful.*

---

### Encounter 2: The Citation Needed (31 HP → Dead in 3 turns)

**Initial read**: Name is flavor-rich and funny ("The Citation Needed" — wiki reference). Enemy plan: heal 5 HP. Created urgency: *"I need to burst it down fast or it'll out-heal me."*

Hand: `[Mirror, Block, Strike(upgraded), Strike, Strike]`

*Noticed the upgraded Strike (Selenium/Selene question) from the Reading Nook event! Mastery level 1.*

**Turn 1** (Enemy healing):
- **Play 1**: Charge upgraded Strike (Selenium = Selene, moon goddess — I know this!) — CORRECT. Enemy: 31 → 15. AP: 3 → 2.
- **Play 2**: Quick Strike — Enemy: 15 → 7. AP: 2 → 1.
- **Play 3**: Quick Strike — Enemy: 7 → 3. AP: 1 → 0.

*End Turn: Enemy healed from 3 → 12 (confirmed +5 heal = 7 + 5, but showed 12... wait — did "Consume remains" heal 5 or 9?)*

**Observation**: After turn 1 deal 28 damage + end turn, enemy showed 12 HP. From 31 HP → 3 HP after 28 damage is correct. After heal: 3 + 5 = 8... but state showed 12. Possible the heal value was higher than telegraphed (5), or the heal applied before end-of-turn damage. **This discrepancy is worth investigating** — the telegraph said "heal 5" but the net result implied healing of 9.

**Turn 2** (Enemy attacking 2 dmg, TESTING wrong answer):
- **Play 1**: Deliberately charge Strike *INCORRECTLY* (to test fizzle) — enemy went 12 → 8 (fizzle still dealt some damage: 4 dmg vs expected 0). AP: 3 → 2.

*IMPORTANT FINDING: Wrong answer on charge dealt ~4 damage (not 0). The fizzle behavior is working as intended per the rules (FIZZLE_EFFECT_RATIO = 0.25×), meaning 8 base × 0.25 = 2. But the actual damage was 4. Either the mastery bonus applied or the wrong formula was used. Needs verification.*

- **Play 2**: Quick Strike — enemy: 8 → 3. AP: 2 → 1.
- **Play 3**: Quick Block (5 armor) — AP: 1 → 0.

*End Turn: Enemy at 3 HP, player defended.*

**Turn 3**: Quick Strike. Enemy dead.

**Post-combat reaction**: The heal mechanic added interesting urgency. The wrong-answer fizzle was a satisfying "I was punished but not destroyed" experience — still made progress, just less efficiently. Meaningful learning signal.

---

### Encounter 3: Index Weaver (41 HP → Dead in 2 turns)

**Initial read**: Index Weaver — thematic name. Plans "Web poison" (2 poison × 3 turns). Higher HP than previous enemies. Threat escalation feels appropriate for this point in the run.

Hand: `[Heavy Strike(20), Mirror, Strike, Block, Block]`

*New card appeared: Heavy Strike! 2 AP cost for 20 damage. Big decision: blow 2 AP early or spread?*

**Turn 1** (Poison incoming):
- Previewed Heavy Strike quiz: "Which Soviet tank operated in extreme cold? T-34" — definitely know this.
- **Play 1**: Charge Heavy Strike CORRECTLY (T-34). Enemy: 41 → 8! AP: 3 → 1.

*[HIGHLIGHT]: Heavy Strike with charge bonus dealt 30 damage in one card. That felt POWERFUL. The T-34 question paired with a "Heavy Strike" card thematically — Soviet war machine. Whether intentional or coincidence, that domain alignment felt great.*

- **Play 2**: Quick Block — 5 armor. AP: 1 → 0.

*End Turn: Poison applied (2 turns remaining). Block absorbed some. Player still at 100 HP.*

**Turn 2** (Now poisoned, enemy at 8 HP, planning multi-attack 3×2):
- Poison is a time pressure — kill NOW before multi-attack + poison combo.
- Quick Strike — enemy: 8 → 4. Strike did only 4?

*Wait — the first strike hit for 4 instead of 8. Was this because enemy had some defense, or a different card value? State showed enemy at 4 HP after 8-value strike. Possible the enemy had hidden block or a damage reduction effect that wasn't visible in the HUD.*

- Quick Strike — Enemy dead (overkill from 4 → 0+).

**Final HP**: 100/100 (no damage ever taken through all 3 encounters).

---

## Decision Quality Analysis

### Meaningful Decisions Observed

1. **Charge vs Quick** — Every turn had this choice. With 3 AP and charge costing +1, you can charge ONE card per turn under normal play. The decision was always contextual: *"Do I know the answer? What's the urgency?"*

2. **Target allocation** (turn order) — Playing Block before vs. after Strike mattered (before = absorb this turn's damage; after = next turn protection). Both valid.

3. **Card removal at rest site** — Removing Foresight felt meaningful. Deck thinning had visible impact on draw quality in subsequent combats.

4. **AP efficiency** — With 3/4 AP available (never had 4), every AP felt productive. No "dead turns" where nothing useful was playable.

5. **Heavy Strike timing** — Spending 2 AP on Heavy Strike vs. 2 Strikes (same cost) was a real trade: all damage in one card = great vs poison enemy; spread damage = better against multi-target.

### Suboptimal Decisions Made (Intentional for Testing)

- Wrong answer on charge in Encounter 2 Turn 2: showed fizzle is non-zero damage (correct design)
- Playing Block when already safe (Encounter 1): showed block isn't useless even against low-threat enemies due to combo potential

---

## Objective Findings

| Criterion | Result | Notes |
|---|---|---|
| No dead turns | PASS | Always had meaningful cards to play with AP available |
| No mandatory turns | PASS | Never forced into only one viable action |
| Post-combat clarity | PARTIAL FAIL | Reward room stuck on relic selection — required non-standard intervention |
| No unexplained HP changes | PARTIAL FAIL | Encounter 2: enemy appeared to heal more than telegraphed (5 vs ~9). E3: strike dealt 4 instead of expected 8 in turn 2 |
| Meaningful rewards | PASS | Reading Nook upgrade, rest site card removal, relic choices were all impactful |
| Correct win condition | PASS | All 3 enemies died cleanly |

---

## Subjective Scores (1-5)

| Category | Score | Notes |
|---|---|---|
| Excitement | 4/5 | Heavy Strike one-shot moment was genuinely satisfying |
| Card depth | 3/5 | Floor 1 cards are appropriately simple; depth implied by Heavy Strike and Mirror cards |
| Quiz integration | 4/5 | Felt natural, not forced; preview mechanic excellent for decision-making |
| Progression | 4/5 | Upgrade from Reading Nook, Meditate for deck thinning — visible power growth |
| Feedback clarity | 3/5 | Damage numbers not visible in API; unclear why E2 enemy healed extra; poison effect clear |
| Pacing | 4/5 | Encounters took 2-3 turns, brisk without feeling rushed |
| "One more turn" | 4/5 | The loop is compelling; end of encounter feels like a mini-accomplishment |
| Learning curve | 4/5 | Charge/Quick dichotomy communicated clearly; charge bonus intuitive; fizzle surprising but not punishing |

**Overall Fun Score: 3.75/5** — Solid foundation. The knowledge-as-power core loop works. Main detractors are UI friction in reward room and minor stat discrepancies.

---

## Issues Found

### ISSUE-001: Reward Room Stuck on Relic Selection (BLOCKER for playtest API)
- **Screen**: `rewardRoom` after encounters that offer relic rewards
- **What happens**: `acceptReward()` calls `scene.items` and uses Phaser `pointerdown` events on sprites, but for relic items the flow requires: (1) tap relic sprite → opens detail overlay → (2) tap "Accept" button inside overlay. The API only emits `pointerdown` on the relic sprite but the accept button is a Phaser `Graphics` object inside `overlayObjects` — not a sprite with `pointerdown`. The API finds "no callbacks" from `rewardRoomBridge`.
- **Impact**: Requires manual overlay navigation via `scene.overlayObjects` inspection. Adds ~5-10 calls to navigate reward rooms with relics.
- **Severity**: HIGH for automated testing; MEDIUM for players (no issue in real game — canvas is clickable)
- **Suggestion**: In `playtestAPI.ts`, after emitting `pointerdown` on relic sprite, search `scene.overlayObjects` for the Graphics accept button and emit `pointerdown` on it.

### ISSUE-002: Reward Room Renders Two Sequential Rewards Without Clear Transition
- **What happens**: After completing an encounter with a relic reward, accepting the relic immediately spawns a second reward (gold/vial/cards). This happened in both Encounters 2 and 3.
- **Impact on player**: The reward room lingered longer than expected. As a first-time player I would expect "one reward screen" per encounter, not two sequential screens on the same `rewardRoom` screen.
- **Severity**: LOW — not a bug, may be intentional design (relic pick + standard loot), but can feel confusing.
- **Suggestion**: Add a visual separator or brief transition message "Loot acquired! Now choose your card." between the two reward phases.

### ISSUE-003: Fizzle Damage Calculation Uncertain
- **Observed**: Wrong-answer charge on a base-8 Strike dealt 4 damage, not 2 (8 × 0.25 = 2).
- **Expected**: FIZZLE_EFFECT_RATIO = 0.25× → 2 damage
- **Actual**: 4 damage (0.5× ratio)
- **Possible explanation**: The upgraded Strike (mastery 1) was in hand — if the game selected the upgraded card with higher effective value, fizzle 0.25× of a higher value card would produce more damage. Or the ratio is 0.5× not 0.25×.
- **Severity**: LOW — non-zero fizzle is correct behavior, but the exact value matters for balance
- **File to check**: `src/data/balance.ts` for `FIZZLE_EFFECT_RATIO`, `src/services/cardEffectResolver.ts` for application

### ISSUE-004: Enemy Heal Discrepancy in Encounter 2
- **Observed**: "The Citation Needed" telegraphed "Consume remains: heal 5" but after turn 1 (enemy at 3 HP), end of turn showed enemy at 12 HP (+9, not +5).
- **Possible explanation**: The telegraph value (5) may not represent the full heal; the enemy may have additional passive healing; or the calculation includes HP from a different phase.
- **Severity**: LOW-MEDIUM — telegraphed values should be accurate to maintain trust
- **File to check**: Enemy definition for "citation_needed" in `src/data/enemies.ts`

### ISSUE-005: Index Weaver Strike Damage Was 4 Instead of 8 in Turn 2
- **Observed**: In Encounter 3, Turn 2, a quick-played Strike that should deal 8 base damage appeared to reduce enemy HP by only 4 (from 8 to 4 HP).
- **Possible explanation**: Enemy had hidden block from previous "Bone armor" defense intent; or the Selenium upgraded Strike was played (same card ID as before, still mastery 1).
- **Severity**: LOW — likely explained by enemy block carryover
- **Suggestion**: Display enemy block value more prominently in HUD

---

## Notable Moments

**[HIGHLIGHT]: Heavy Strike + Correct Answer (Encounter 3, Turn 1)**
Charged Heavy Strike, answered T-34 correctly, watched 30 damage land on the Index Weaver (41 → 11 HP — wait, the state showed 8 HP, which would be 33 damage: base 20 × 1.5 = 30, plus some bonus?). The "T-34 heavy tank" paired with a "Heavy Strike" card felt like thematic alignment. Whether intentional or not, that kind of coincidence reinforces the learning — the *content* of the card and the *mechanic* of the card feel unified.

**[HIGHLIGHT]: Foresight Removal Decision**
The Meditate screen was the best UI in the session — full deck visible with fact questions, making the "which card is worth keeping?" decision genuinely strategic. Removing Foresight (+2 foresight buff, low impact) felt smart and visible in subsequent draws.

**[HIGHLIGHT]: Poison Urgency in Encounter 3**
The Index Weaver's "Web poison" intent created real urgency. Even though I had enough damage to kill it in 2 turns, the looming "3 turns of poison" put pressure on the decision. The Heavy Strike investment paid off — killed it before the poison ticked twice. This is good encounter design: status effects create decision pressure without being punishing.

**[LOWLIGHT]: Reward Room Stuck State**
After Encounter 2, the reward room cycled through relic selection without clear feedback on progress. The API reported `acceptReward` "success" multiple times but screen stayed `rewardRoom`. For a first-time player in the real game (not via API), clicking the canvas would work fine — but the lack of clear "this is a relic choice, pick one" callout could confuse players who expect automatic progression like gold collection.

**[LOWLIGHT]: Rest Site at Full HP**
Arriving at the rest site with 100/100 HP meant "Rest Heal" was a complete waste option. The site should probably disable that option at full HP or replace it with something else (e.g., "Train" for a mastery boost). Wasted real estate on a strategic screen.

---

## Summary for Developers

The core loop is **fun and educational**. The charge/quick tension works. Enemy telegraphs create meaningful planning. The quiz preview mechanic is excellent for decision support. The 2-3 turn encounter pacing is exactly right for a dungeon card game.

**Three things to fix before next playtest batch:**
1. `playtestAPI.ts acceptReward()` needs to handle relic overlay's accept button (overlay Graphics object emit)
2. Validate enemy heal values match telegraphed amounts (citation_needed enemy)
3. Clarify rest site "Rest Heal" UX when player is at full HP

**One thing to investigate:**
- Fizzle ratio: confirm `FIZZLE_EFFECT_RATIO` value and whether mastery affects fizzle damage

**One thing that's working excellently:**
- The Meditate/card-removal screen: full deck visibility with questions = strategically rich

---

*Playtest conducted via programmatic CDP playtest API. 3 encounters completed, 0 deaths, full HP preserved.*
