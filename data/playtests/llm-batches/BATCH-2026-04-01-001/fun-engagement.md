# Fun/Engagement Report — BATCH-2026-04-01-001
**Tester**: Fun/Engagement | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge | **Encounters Played**: 3

## Verdict: ISSUES

---

## First Impressions

Landing in combat for the first time, the layout reads immediately: HP bar top-left, AP counter (orange bubble) center-left, cards fanned at bottom, END TURN bottom-left. The card art is gorgeous pixel work — distinct color-coded borders (red/attack, blue/block, purple/utility) communicate card type at a glance. The enemy is a named text label at the top with a tiny sprite icon beneath it — barely visible and not viscerally threatening. The combat arena is a dark starfield with ambient particles, atmospheric but sparse.

The very first moment of intrigue: seeing "Foresight" at 0 AP next to four Strikes. Immediately creates a micro-decision: should I draw more cards for free before committing AP? That's a good hook in the first five seconds.

---

## Combat Narrative Log

### Encounter 1 — Floor 1, vs Staple Bug (27 HP, intent: defend)

**Turn 1:**
- Quick Play Foresight (0 AP) — Drew 2 cards for free. Felt clever and efficient. Reward: 6-card hand.
- Charge Strike, Mussolini trains question ("Is 'Mussolini made the trains run on time' accurate?") — answered correctly (No — myth). Spent 2 AP. Enemy: 27→16 HP. Satisfying 11-point hit.
- Charge Strike, Wozniak question ("What did Wozniak invent after leaving Apple?") — answered correctly (Universal remote control). Chain Momentum may have triggered (budget math suggests second charge cost only 1 AP). Spent... 1 AP? Enemy: 16→5 HP.
- Quick Play Strike (Soft Robotics) — 1 AP. Enemy: 5→2 HP. Unexpectedly only 3 damage; expected 8.

*Confusion note: Quick Play Strike deals variable damage (3 vs 8 in different instances). The inconsistency wasn't explained anywhere — frustrating for a new player trying to build mental models.*

**Turn 2:**
- Quick Play Strike (Oceania) — dealt 8 damage, broke 2 block, but enemy stayed at 2 HP. Seemed like damage should have killed it.
- Quick Play Strike (Ice phases, upgraded/mastery 1) — finally killed enemy.

*Frustration note: Enemy survived at 2 HP through two 8-base Strikes. Unclear why. Block absorption math felt opaque.*

**Post-combat reaction (Encounter 1):** Took no damage (100 HP). Two correctly-answered charge questions gave a genuine sense of "I know things and it's paying off." The mastery level-up on the ice phases card (mastery 0→1 mid-combat) was a pleasant surprise discovery. However, the reward room immediately broke — completely black screen, no buttons, no feedback. The sense of victory deflated instantly into a stuck screen. Zero death animation, zero victory fanfare.

---

### Encounter 2 — Floor 1, vs Page Flutter (19 HP, intent: attack for 2)

*Scenario loaded manually due to reward room bug.*

**Turn 1:**
- Charge Strike, compiler question ("What does a compiler translate into?") — answered correctly (Machine code). Enemy: 19→11 HP. 8 damage.
- Charge Strike, punched cards question ("What did keyboards replace?") — answered correctly (Punched cards). AP math suggests Chain Momentum triggered (second charge cost 1 AP not 2). Enemy: 11→3 HP.
- Quick Play Strike (Wozniak) — killed enemy. Enemy: 3→dead.

**Post-combat reaction (Encounter 2):** One-turn kill with 0 damage taken. The tech-themed questions appearing together (compiler, punched cards, keyboards, Wozniak) created an organic "chain" of knowledge that felt thematically coherent — like the game is testing a domain of understanding together. This was the most satisfying engagement moment of the session. However, Chain Momentum either fired silently or the AP math is just weird — I couldn't tell which. No UI indicator that "Chain Momentum: next charge is free!" happened.

Reward room broke again (same blank screen bug). Manually loaded card-reward-attacks scenario to see choices. Three distinct attack cards (Heavy Strike 20 dmg, Multi-Hit 4×3, Lifetap 8 drain) — genuinely different strategic options. Took Multi-Hit.

---

### Encounter 3 — Floor 1, vs The Final Lesson / Elite (68 HP)

*Started at 80 HP (scenario), relics: whetstone + iron_shield.*

**Turn 1 (enemy: buff — Ancient Wisdom, +2 strength for 3 turns):**
- Charge Heavy Strike, Soft Robotics question — answered correctly. Enemy: 68→43 HP. 25 damage. Entire AP budget used.
- Quick Play Block (1 AP, 6 block) — insurance vs incoming multi-attack.

**Turn 2 (enemy: multi-attack — Archive Barrage, 4×2 hits; I have 8 block):**
- Charge Multi-Hit, Punched Cards question — answered correctly. Enemy: 43→13 HP. **30 damage.** Enormous hit — most impactful moment of the playtest.
- Enemy intent changed to "Archive restoration" (heal 10) — sudden urgency.
- Quick Play Strike (French "rien") — chip damage. Enemy: 13→5 HP. 0 AP.
- End turn. Enemy healed: 5→15 HP. Block refreshed to 11.

*"So close!" tension moment: enemy at 5 HP, out of AP, watch it heal back up. Mildly frustrating but creates genuine drama.*

**Turn 3 (enemy: attack 2 damage "Judgement" — absorbed by 11 block):**
- Quick Play Heavy Strike (20 base, mastery 1) — 2 AP. Enemy: 15→dead (dealt ~15+ damage).
- Victory. Final HP: 80/100 (scenario started me at 80, never took damage).

**Post-combat reaction (Encounter 3):** The elite felt meaningful. The name "The Final Lesson" is thematic gold for a knowledge dungeon. "Archive barrage" and "Archive restoration" as move names maintain the library aesthetic throughout. The enemy heal created genuine urgency. The upgraded Heavy Strike and Multi-Hit both hit for 25-30 damage, making each charge feel like a decisive, powerful moment. Clear high point of the session.

---

## Decision Quality Analysis

| Turn | Encounter | Decision Type | Rationale |
|------|-----------|---------------|-----------|
| E1-T1 | Staple Bug | Quick Play (Foresight) | Free draw — obvious value |
| E1-T1 | Staple Bug | Charge (Mussolini) | High confidence on answer |
| E1-T1 | Staple Bug | Charge (Wozniak) | High confidence, chain potential |
| E1-T1 | Staple Bug | Quick Play (finish) | Low AP, clean kill |
| E2-T1 | Page Flutter | Charge (compiler) | High confidence tech knowledge |
| E2-T1 | Page Flutter | Charge (punched cards) | High confidence, suspected chain |
| E2-T1 | Page Flutter | Quick Play (finish) | Clean kill |
| E3-T1 | Final Lesson | Charge (Heavy Strike) | Max damage on buff turn — correct aggression |
| E3-T1 | Final Lesson | Quick Play Block | Defensive hedge with remaining AP |
| E3-T2 | Final Lesson | Charge (Multi-Hit) | New mechanic, known answer, big damage |
| E3-T2 | Final Lesson | Quick Play Strike | Chip before heal |
| E3-T3 | Final Lesson | Quick Play Heavy | Safe kill — no need to risk charge |

- **Meaningful decisions**: 10/12 turns — high ratio
- **"Obvious only one play" turns**: 2/12 (the finisher quick plays with 1 AP left)
- **Dead turns**: 0 — there was always something useful to do
- **Decision that felt best**: Turn E3-T2 charging Multi-Hit — risky 3 AP all-in that paid off with 30 damage
- **Decision with most uncertainty**: E1-T1 ice phases preview — wanted to charge but unsure of answer, correctly quick-played Foresight instead

---

## Objective Findings

| ID | Check | Result | Notes |
|----|-------|--------|-------|
| O-FE1 | No dead turns | PASS | Every turn had multiple viable plays |
| O-FE2 | No mandatory turns | PASS | Always had choices (offense/defense/utility) |
| O-FE3 | Post-combat clarity | FAIL | Reward room completely blank — player would be stuck |
| O-FE4 | No unexplained state changes | PARTIAL | Block values and damage numbers sometimes inconsistent with stated base values |
| O-FE5 | Reward choices meaningful | PASS | Both reward screens showed 3 mechanically distinct options |

---

## Subjective Assessments

| ID | Check | Score (1-5) | Notes |
|----|-------|-------------|-------|
| S-FE1 | First 60 seconds excitement | 3/5 | Card art great; enemy barely visible; first decision (Foresight) is quietly clever but not thrilling |
| S-FE2 | Card choice depth | 4/5 | Quick vs charge decision is genuinely interesting every turn; AP budget creates real constraints |
| S-FE3 | Quiz integration feel | 4/5 | Feels like power amplification not interruption; commit-before-reveal creates retrieval practice naturally |
| S-FE4 | Progression reward | 3/5 | Mastery leveling mid-combat is satisfying; reward room is broken, deflating victory |
| S-FE5 | Clarity of feedback | 2/5 | No damage numbers visible, no chain bonus indicator, card text unreadable on card faces, enemy HP change only visible via API |
| S-FE6 | Pacing | 4/5 | Encounters moved at a good clip; 1-3 turns per fight felt right for early game |
| S-FE7 | "One more turn" feeling | 4/5 | The elite fight with the heal urgency created genuine "I need to finish this" momentum |
| S-FE8 | Learning curve | 3/5 | AP system intuitive; chain system opaque (no feedback when it triggers); mastery progression not explained |

---

## Issues Found

### CRITICAL

**BUG-FE1: Reward room renders blank after every combat victory**
- Reproducible: Happened after Encounters 1 and 2 (both natural combat endings)
- Root cause: Phaser `blendModes` null reference error fires post-combat, preventing Svelte reward overlay from mounting
- Impact: Player cannot progress after winning — run-ending bug in normal play
- Workaround found: `__rrScenario.load('card-reward-mixed')` bypasses it

### HIGH

**BUG-FE2: No visual feedback when Chain Momentum triggers**
- Chain Momentum is a core mechanic (correct charge → next charge is free), but fires silently
- Evidence: AP budget math in E2 suggests it triggered, but there was no banner, animation, or indicator
- Player impact: Cannot learn to plan around chain momentum without feedback

**BUG-FE3: Card text areas are unreadable (pure black) on card face**
- Reward screen cards show gorgeous art but zero visible text in the card description area
- Player must hover to read stats — no fallback for players who don't know to hover
- All three reward screens observed showed this

**BUG-FE4: Quick Play Strike damage inconsistency**
- E1: Quick Play Strike dealt 3 damage to an enemy at 5 HP with 0 block (expected 8)
- E2: Quick Play Strike dealt 8 damage normally
- Unclear why variance; no indication of damage modifiers in effect

### MEDIUM

**UX-FE1: No enemy death animation or victory moment**
- Combat ends → instant jump to (broken) reward room
- The kill shot lands with zero ceremony; player never sees the enemy die
- Missing opportunity for dopamine hit at fight completion

**UX-FE2: Enemy presence is weak**
- Enemy is represented only by a text label and a 16px sprite icon
- "The Final Lesson" sounds terrifying but the visual is underwhelming
- No health bar visible; no visual indicator of incoming attack

**UX-FE3: Mastery level-up has no announcement**
- Cards leveling up mid-combat (mastery 0→1) is exciting but silent
- Discovered only by re-reading card state in getCombatState()
- Real player would likely miss this entirely

**CONTENT-FE1: "Oceania" as smallest continent is questionable**
- factId: `geo-oceania-smallest-continent`, answer: "Oceania"
- Australia is typically listed as the smallest continent in standard geography curricula
- "Oceania" is a region designation, not a continent in most classification systems
- This could teach players incorrect information

---

## Notable Moments

**[HIGHLIGHT]** Encounter 2, Turn 1: Three tech-knowledge questions appeared together (compiler, punched cards, Wozniak) creating an organic chain of related facts — answered all three confidently, watched the enemy melt. Felt genuinely smart and satisfying. This is the core fantasy of the game working perfectly.

**[HIGHLIGHT]** Encounter 3, Turn 2: Charged Multi-Hit on a 68-HP elite and watched it rip 30 damage. The commitment moment (spending all 3 AP on one card) followed by the payoff felt like a critical hit landing.

**[HIGHLIGHT]** "The Final Lesson" + "Archive Barrage" + "Archive restoration" as move names — excellent thematic consistency. The dungeon-as-library aesthetic is cohesive and clever.

**[LOWLIGHT]** After killing the Staple Bug: screen goes black, nothing happens, no buttons appear, no reward. First-time player would think the game crashed.

**[LOWLIGHT]** Enemy HP changes were only discoverable by calling `getCombatState()` — no floating damage numbers, no HP bar animation visible. The combat system works but feels mute. Playing against an invisible enemy.

**[LOWLIGHT]** Chain Momentum possibly fired twice across the session and I couldn't confirm either time. A mechanic described as a core loop feature should be announced clearly when it activates.

---

## Summary

The **core decision loop is strong** — the Quick vs Charge tradeoff creates genuine tension every turn, the AP budget is tight enough to force real choices, and the quiz integration feels like power amplification rather than interruption. The three distinct encounters showed meaningful variety (defend, attack, multi-attack, heal, buff patterns). Questions were largely answerable with real-world knowledge, making correct charges feel earned.

However, **feedback systems are underdeveloped**: no damage numbers, no chain bonus indicators, no mastery-up announcement, no death ceremony. The game works mechanically but plays silently, leaving players unable to build intuitions about what's happening. The reward room crash is a hard blocker that would end most players' sessions.

The elite encounter "The Final Lesson" was the clearest evidence of the game's potential — urgent decisions, genuine stakes, a satisfying three-turn arc. More encounters with that level of mechanical texture will make this compelling.

**Recommended priority fixes:**
1. Reward room blank screen (run-ending crash)
2. Floating damage numbers in combat
3. Chain Momentum visual trigger announcement
4. Enemy death animation / victory moment
5. Card text legibility on reward cards
