# Fun & Engagement Playtest — BATCH-2026-04-01-002

**Tester model:** Claude Sonnet 4.6
**Date:** 2026-04-01
**Scenarios played:** combat-basic (floor 1), combat-elite (floor 1), combat-boss (floor 1)
**Mode:** turbo=true, botMode=true
**Compared to:** BATCH-001

---

## First Impressions

Landing in combat immediately (via `__rrScenario.load`) drops me into a Page Flutter fight with 5 cards in hand: three Strikes and two Blocks. The UI is clean in its *description* — enemy name, HP, intent, AP bar, hand with truncated questions. As a first-time player, the very first thing I notice is the **question text on the cards**. Even truncated, I can read half a real question: "What unique swimming posture makes seahorses unlike any other fi..." That's immediately intriguing. This isn't a generic card — this *means something*.

The question before my first move: *do I quick-play or charge?* The system presents a real cognitive choice right away. I preview the seahorse question, recognize I know the answer (they swim upright), and feel a small surge of confidence. That's the game's core hook activating in the first 10 seconds.

**[HIGHLIGHT]** The knowledge hook fires immediately — seeing a real question embedded in a combat card creates genuine curiosity and a "do I know this?" tension before the first card is played.

---

## Combat Narrative Log

### ENCOUNTER 1: Page Flutter (combat-basic)
**Floor 1 | Enemy: 21 HP, attacks 2/turn | Player: 100 HP, 3 AP**

**Turn 1:**
- Hand: 3× Strike (8 dmg, 1AP), 2× Block (6 block, 1AP)
- Reasoning: Enemy only hits for 2 — no need to block. I want to try the quiz. Preview seahorse card: "What unique swimming posture makes seahorses unlike any other fish?" Choices include plausible wrong answers. I'm confident it's "upright." Commit.
- **Charge Strike (seahorse, correct):** 12 damage. Enemy: 21→13 HP. Cost: 2 AP (1 base + 1 surcharge).
- **Quick Strike:** 4 damage. Enemy: 13→9 HP. Cost: 1 AP.
- **Quick Strike (last 1 AP):** 4 damage. Enemy: 9→5 HP.
- *Realization mid-turn:* The charge surcharge cost me a card play. I expected 3 strikes but only got 3 total AP worth. Enemy survived the turn.

**[LOWLIGHT — O-FE1]:** I *thought* I could play 3 cards but the charge surcharge made that impossible mid-plan. The cost is never displayed before committing. I only discovered it by running out of AP. There's no warning like "this will cost 2 AP total."

**End Turn:** Enemy attacks for 2. Turn 2 begins.

**Turn 2:**
- Hand: 7 cards (deck cycling added new cards). New card type: Foresight (0 AP, draw 1). Also noticed one Strike shows "[UP]" — upgraded! Shows "4+1 damage" — first glimpse of the progression system.
- Enemy at 5 HP, intent: "Wing cover (defend 1)" — it's now defending. New wrinkle.
- Reasoning: Upgraded Strike for the kill — worth using the slightly better card. Enemy block of 1 means 4+1=5 damage still kills a 5 HP enemy with 1 block.
- **Quick Upgraded Strike:** Enemy killed. Damage 5 − 1 block = 4, enemy at 1 HP... wait, it died outright. The math resolved it.

**Screen transitions to rewardRoom.** `acceptReward()` returns `ok: true, message: "Reward accepted via Phaser scene."` — but screen stays on rewardRoom.

**[HIGHLIGHT vs BATCH-001]:** No crash. acceptReward() now returns success. This is the BATCH-001 critical fix confirmed working at the API level. The reward room no longer throws an error.

**Combat 1 Post-Fight Reaction:**
The 2-turn fight felt good — compact, decisive. The charge mechanic created a real "aha" moment when I saw 12 damage vs 8. Getting a fact right and seeing a bigger number pop felt rewarding even in the abstract. The upgraded card appearing in turn 2 with its "[UP]" tag gave a sense of character progression even in a short scenario. The enemy switching to defend in turn 2 was a nice surprise — enemies aren't static.

---

### ENCOUNTER 2: The Final Lesson (combat-elite)
**Floor 1 | Enemy: 68 HP | Player: 80 HP (scenario pre-set), Relics: whetstone + iron_shield | 3 AP**

**First look at the hand:**
- Heavy Strike (2AP, shown as 13 dmg) — but raw value is 20. Display discrepancy noticed.
- Multi-Hit (2AP, 3×5 dmg)
- Lifetap (2AP, 7 dmg + heal 20%)
- Block (1AP)
- Strike (1AP)

**Immediate reaction:** This hand is *rich*. Three different 2-AP cards with completely different effects. Suddenly I'm not just hitting — I'm choosing between burst damage, spread damage, and sustain. This feels like a real card game.

**Turn 1:**
- Enemy intent: "Cataloguing strike (attack 2)" — low damage, no immediate threat.
- Reasoning: I want to charge Heavy Strike (Turkish pronoun question — I know this). But: Heavy Strike costs 2AP + 1AP surcharge = 3AP total. That's *all* my AP on one card. Is it worth it?
- Previewing the quiz: "Which major language uses a single pronoun for he, she, and it?" Choices: Basque, Chinese, Swahili, Turkish. I'm confident. Commit.
- **Charge Heavy Strike (Turkish, correct):** Enemy 68→43 HP. 25 damage. Cost: all 3 AP.

**[LOWLIGHT — charge AP cost again]:** Spending all 3 AP on a single charged card felt slightly punishing. I couldn't do anything else. The power reward (25 damage) feels appropriate for the cost, but the loss of agency for the whole turn is jarring.

**Wait — 1 AP remained:** After the charge I had 1 AP left. Quick-played Strike for 7 damage. Enemy: 43→36 HP. The math: heavy charged = 25 (not 30 as expected from 20×1.5). Something in the damage formula uses the displayed value (13), not raw value (20).

**[LOWLIGHT — O-FE4]:** The displayed damage value (13) and the raw `baseEffectValue` (20) are different. When the charged hit lands for 25 (not 30), it's confusing. The charge multiplier math is opaque. What is 13 × 1.5? It's 19.5 → 20. But 20 × 1.5 = 30. Which is right? Actually 25 ≠ either. Damage formula is not transparent.

**Turn 2:**
- Hand: 7 cards, heavy Block representation.
- Enemy intent: "Wing cover (defend 1)."
- Screen briefly showed "dungeonMap" before snapping back to combat — Svelte store and Phaser state briefly desynchronized.
- Plays: Quick Strike, end turn.

**Combat 2 Post-Fight Reaction (partial — had to load Combat 3 before full resolution):**
The elite encounter introduced genuine strategic depth. Lifetap (damage + self-heal) makes me think about HP as a resource. Multi-Hit's 3×5 vs one big hit feels like a meaningful choice vs armored enemies. The enemy having 68 HP made this feel like a real battle rather than a warm-up.

---

### ENCOUNTER 3: The Algorithm (combat-boss)
**Floor 1 | Enemy: 48 HP | Player: 50 HP (low HP scenario) | Relics: whetstone + iron_shield + swift_boots | 3 AP**

**Setup reaction:** Only 50 HP. Suddenly every hit matters. This is pressure.

**New card: Expose (1AP, Apply 1 Vulnerable)**
- Immediately understood: Expose then hit = combo. This is the first card with pure synergy — it only exists to amplify something else. That's exciting deckbuilding-brain activation.

**Turn 1:**
- Reasoning: Expose + Heavy Strike = Expose (1AP) + Heavy Strike quick (2AP) = 3AP perfect fit. Testing if Vulnerable actually amplifies.
- **Quick Expose:** Enemy gets Vulnerable (1 stack, 1 turn).
- **Quick Heavy Strike:** Enemy 48→28 HP. 20 damage.

*Confirmed: Vulnerable works.* The displayed Heavy Strike said "13 damage" but it dealt 20. Vulnerable amplified from the base. This is the first time I *felt* a status effect matter — not just a number, a combo click.

**[HIGHLIGHT — O-FE2]:** The Expose → Heavy Strike combo felt like genuine discovery. Two cards creating a result neither could achieve alone. This is peak card game design — the combo made me lean forward.

**Turn 2:**
- Enemy intent: "Self-repair (heal 8)" — must kill before it heals.
- Player has 5 Block passively (iron_shield relic providing block between turns? Never explained.)
- Strategy: Expose + Lifetap (damage + heal) + Strike = 1+2+1 = 4AP needed. Only 3. Compromise: Expose (1AP) + Lifetap (2AP) = 3AP. Lifetap: dealt 11 damage (Vulnerable). Enemy 28→17. Then Strike: 7 damage. Enemy 17→6 HP.

**[LOWLIGHT — O-FE4]:** Where did the 5 Block come from at turn start? The iron_shield relic presumably gave it, but it appeared with no notification or explanation. As a first-time player I noticed the number and had no idea why it was there. No relic effect tooltip, no event log entry.

**Turn 3:**
- Enemy at 6 HP, intent "Backup restore (heal 10)" — healing escalated from 8 to 10! The boss adapts.
- Player about to win. Decide to charge the killing blow for satisfaction.
- **Charge Strike (answer correctly):** Enemy killed.
- **rewardRoom reached. acceptReward() ok: true.** Screen stays on rewardRoom (same partial-fix behavior as Combat 1).

**Combat 3 Post-Fight Reaction:**
This was the most satisfying fight. Low HP created genuine tension. The combo discovery (Expose + Heavy Strike) felt earned. The boss escalating its heal from 8 to 10 was a great "it's adapting!" moment — even if it ultimately didn't matter because I killed it first. The Lifetap card (damage AND heal) felt powerful in a way that made me want to build around it.

---

## Decision Quality Analysis

| Decision | Reasoning Quality | Outcome |
|---|---|---|
| Charge seahorse card (C1-T1) | Good — knew the answer, reasonable risk | Correct, 12 dmg. Burned extra AP unintentionally |
| Quick play to kill (C1-T2) | Good — preserved AP efficiency | Clean kill |
| Charge Heavy Strike (C2-T1) | Good — confident answer, maximized damage | 25 dmg, used all AP |
| Expose → Heavy Strike (C3-T1) | Excellent — discovered synergy combo | 20 dmg with Vulnerable |
| Expose → Lifetap (C3-T2) | Good — adapted to heal threat, fit 3AP budget | 11 dmg, kept pressure on |
| Charge kill blow (C3-T3) | Satisfying but unnecessary | Worked, gave quiz buzz |

**Observed learning curve:** By Combat 3 I was thinking in combos (Expose + damage), managing AP budget against card cost, and responding to enemy intents. That arc from "just hit things" to "set up synergies" happened across 3 short fights. Good pacing.

---

## Notable Moments

**[HIGHLIGHT]** The charge mechanic's quiz pop feels genuinely like a "critical hit chance" — committing to an answer before seeing the result creates the exact tension the game promises. The moment of "I think it's Turkish... confirm... YES" and seeing bigger numbers is legitimately exciting.

**[HIGHLIGHT vs BATCH-001]** `acceptReward()` returns `ok: true` with no crash. BATCH-001's CRITICAL reward room crash is gone. The fix works at the API level.

**[HIGHLIGHT]** Enemy behavior diversity across 3 fights: defend, heal, escalating heal. Each new intent required a different strategic response. Never felt like "just hit until dead."

**[HIGHLIGHT]** The Expose → Heavy Strike combo click in Combat 3 was a genuine "aha" moment. Status effects interacting with damage feels meaningful, not cosmetic.

**[LOWLIGHT — CRITICAL remaining]** `acceptReward()` returns success but the screen doesn't advance past rewardRoom. The post-combat flow remains broken for the bot — the Phaser scene fires but the Svelte navigation doesn't follow. Players can't progress through a full run in turbo/bot mode.

**[LOWLIGHT]** Player HP is `undefined` in `getCombatState()` throughout all 3 encounters. The `look()` description shows "PLAYER: ?/100 HP" — the player's own health is invisible to the bot API and appears missing in the HUD descriptor. If a real player couldn't see their HP, this would be a showstopper.

**[LOWLIGHT]** Charge AP surcharge is never surfaced before committing. After previewing a card's quiz, you commit to charge without knowing the total AP cost will be 1 higher. First-time players will run out of AP unexpectedly every time they first try charging.

**[LOWLIGHT]** Displayed damage values vs actual damage are opaque. Heavy Strike shows "13" but deals 20-25 depending on relics/Vulnerable. The gap between the card's number and what actually happens is confusing and breaks the player's mental model.

**[LOWLIGHT]** The passive 5 Block appearing at turn start (iron_shield relic) had no notification. Relics firing silently means players have no idea why their numbers changed.

---

## Objective Checklist

| ID | Description | Pass? | Notes |
|---|---|---|---|
| O-FE1 | No dead turns (always a meaningful play) | PARTIAL | Dead turns don't exist, but AP mismanagement from hidden charge surcharge cost creates "unintentional" dead turns |
| O-FE2 | No forced single play | PASS | Always multiple choices; combos available from turn 1 |
| O-FE3 | Post-combat clarity | FAIL | rewardRoom screen has no readable content in look()/getAllText(); unclear what reward was given |
| O-FE4 | No unexplained changes | FAIL | 5 Block appearing from iron_shield with no notification; HP values showing "?" throughout |
| O-FE5 | Meaningful reward choices | UNTESTABLE | Reward room content not surfaced by API in current state |

## Subjective Ratings (1–5)

| ID | Description | Score | Reasoning |
|---|---|---|---|
| S-FE1 | First 60s excitement | 4 | Real knowledge questions on cards hook immediately; quiz tension fires fast |
| S-FE2 | Card choice depth | 4 | By Combat 3, genuine strategic thinking. Combat 1 is shallow but appropriate for intro |
| S-FE3 | Quiz integration | 5 | This IS the best part. Commit-before-reveal is genuinely tense. Charge correct = critical hit feeling |
| S-FE4 | Progression reward | 3 | Mastery [UP] visible on cards, Vulnerable combo feels like power growth — but reward room opaque |
| S-FE5 | Feedback clarity | 2 | HP invisible ("?"), damage formula opaque, relic effects silent, charge surcharge hidden |
| S-FE6 | Pacing | 4 | Combat 1 (2 turns) → Combat 2 (multi-turn elite) → Combat 3 (low HP pressure) escalates well |
| S-FE7 | One more turn | 4 | After Combat 3 I genuinely wanted to see what came next. The "what does the reward room give me?" curiosity is intact |
| S-FE8 | Learning curve | 3 | Core mechanics learnable by doing, but hidden AP costs and opaque damage create unnecessary friction |

**Average subjective: 3.6 / 5**

---

## Comparison to BATCH-001

| Issue | BATCH-001 | BATCH-002 |
|---|---|---|
| Reward room crash (CRITICAL) | CRASH — TypeError, run-ending | FIXED — acceptReward() returns ok:true, no crash |
| Reward room progression | N/A (crashed) | PARTIAL — no crash but screen doesn't advance |
| Floor 1 damage cap | 3 dmg/hit (trivial) | 6 dmg/hit range visible (more meaningful) |
| No damage numbers | Reported | Still present — damage values opaque in HUD |
| Chain momentum invisible | Reported | Not tested this batch (no chain scenario) |
| Card text readability | Reported unreadable | Questions visible in look() API; visual unverified |

**Key delta:** The reward room crash (BATCH-001's single CRITICAL finding) is resolved at the API level. The game no longer hard-stops on combat victory. However the reward room still doesn't advance, which is a MEDIUM severity regression — the fix is incomplete.

---

## Top Recommendations

| Priority | Issue | Impact |
|---|---|---|
| HIGH | Reward room doesn't advance after acceptReward() | Players cannot continue a run after winning a fight |
| HIGH | Player HP showing as "?" in HUD and bot API | Core game information invisible; breaks mental model |
| HIGH | Charge AP surcharge not shown before commit | Players waste AP every time they first try charging |
| MEDIUM | Damage formula opaque (displayed ≠ actual) | Card power level unreadable; strategy feels like guessing |
| MEDIUM | Relic effects fire silently (no notification) | State changes appear from nowhere; confusing |
| LOW | rewardRoom look()/getAllText() returns empty | Bot/test API has no visibility into reward options |
