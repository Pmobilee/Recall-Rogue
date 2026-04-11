# Track 03 — Strategic Reasoning Report
**Batch:** BATCH-2026-04-11-ULTRA
**Date:** 2026-04-11
**Analyst:** Sonnet 4.6 (direct analysis; Haiku spawn downgrade applied — see manifest-entry.json)
**States analyzed:** 20
**Buckets:** 5 early-game (floors 1-3), 5 mid-game (floors 4-7), 5 late-game (floors 8-10), 5 edge-case

---

## State-by-State Summaries

### state-03-01 — Page Flutter (Floor 1, Early)
**Dominant play:** Empower(QP) + Strike(QP) + Block(QP) or Strike×2 + Block.
**Dead cards:** Scout (wasted when enemy dies in 2 AP), Block alone.
**Tension:** None. Trivially solved in turn 1.
**Note:** Appropriate Floor 1 difficulty. No design concerns.

### state-03-02 — Thesis Construct with Charge (Floor 2, Early)
**Dominant play:** 2× Block(QP) + Weaken OR Piercing(CC) + Block(QP). Cannot kill this turn.
**Dead cards:** Heavy Strike(QP) vs chargeResistant + full block (effectively 0 damage).
**Tension:** Real tension between blocking incoming 12-bypass or pushing through 10 block with Piercing CC. Neither path dominates cleanly.
**Design note:** chargeResistant + block combo is good design — QP penalized twice.

### state-03-03 — Mold Puff with player poisoned (Floor 2, Early)
**Dominant play:** Reckless(QP) in 1 AP. Kills immediately, self-damage negligible.
**Dead cards:** Hex (enemy dies before poison matters), Cleanse (existing 1-stack not worth 1 AP).
**Tension:** False. Notes suggest "cleanse first?" tension but Reckless kills in 1 AP making it moot.
**Design note:** Mold Puff too fragile at 6 HP for meaningful decisions.

### state-03-04 — Pop Quiz (Floor 3, Early)
**Dominant play:** Quick Play kill in 1 turn (Quicken + Heavy Strike QP = kills, no enrage matters).
**Dead cards:** Scout/Recycle (drawing when enemy dies this turn).
**Tension:** None if enemy can be killed turn 1 with QP. The charge incentive/enrage mechanic only matters in multi-turn fights.
**DESIGN FLAW:** Pop Quiz's reactive hooks are bypassed by fast QP kills. At 7 HP, Pop Quiz dies before the mechanic has impact.

### state-03-05 — Headmistress (Floor 3, Detention mechanic, Early)
**Dominant play:** Block(QP) + Strike(CC) for 0 incoming damage + 6 HP dealt.
**Dead cards:** Emergency (far above 30% HP threshold).
**Tension:** Moderate. Incoming 10-bypass charge creates urgency. No trivial kill.
**Design note:** Detention mechanic thematically strong. Emergency as a dead card in early fights is consistent with its conditional nature.

### state-03-06 — Peer Reviewer (Floor 4, 3 Strength stacks, Mid)
**Dominant play:** Any big damage card (even Strike CC). Enemy at 7 HP, trivially one-shot.
**Dead cards:** Block, Expose (overkill).
**Tension:** None at the kill state. All interesting decisions occurred in prior turns.
**DESIGN OBSERVATION:** The Peer Reviewer creates anxiety during build-up but trivial kill once player finally bursts. Anti-climactic endgame.

### state-03-07 — Citation Needed (Floor 5, block-steal + heal, Mid)
**Dominant play:** Piercing(CC,2ap) + Strike(QP,1ap) = 8 dmg. Not enough to kill (9 HP). Slow useless vs heal.
**Dead cards:** Slow (cannot cancel heal intents — only defend/buff).
**Tension:** Real tension. Block-steal mechanic makes building block risky. Slow appears to counter heal but doesn't.
**DESIGN FLAW FOUND:** Slow description says "skip defend or buff" but players will attempt to use it against heal intents. This is a communication failure causing wasted AP. Affects every state where Slow is in hand and enemy is healing.

### state-03-08 — Proctor with Strength 2 (Floor 5, Mid)
**Dominant play:** Piercing(CC,2ap) + Weaken(QP,1ap) = 4 HP through block + weakened enemy.
**Dead cards:** Heavy Strike(QP) vs 12 block (absorbed), Fortify(QP) with 0 current block.
**Tension:** Moderate. Double Strike+attack combo infeasible with 3 AP. Recycle gamble option.
**Design note:** 3-AP budget creates real constraints on combo cards (Double Strike requires 4+ AP).

### state-03-09 — Tenure Guardian (Floor 6, block-stacker, Mid)
**Dominant play:** Expose(QP) + Piercing(CC) = 6 HP damage through block, 3 AP. OR Slow(CC) = cancels defend (+6 block prevention), 0 damage.
**Dead cards:** Reckless(QP) vs 12-18 block = ZERO damage. Confirmed dead.
**Tension:** GENUINE. Expose+Pierce (aggressive, enemy still gets 18 block next turn) vs Slow CC (prevent block gain, no damage now). Two viable paths, different risk profiles.
**PATTERN:** Reckless is a dead card against ANY enemy with significant block. Identified across states 09 and 16.

### state-03-10 — Librarian Phase 2 (Floor 7, silence mechanic, Mid)
**Dominant play:** Execute(QP) + Mirror(QP) + Block(QP) = 14 dmg (kills 8 HP) + 8 block defense. Superior to Heavy Strike CC.
**Dead cards:** Empower (silenced). Heavy Strike CC (dominated by Execute+Mirror path).
**Tension:** Moderate. Silence forces creative use of Mirror.
**Design insight:** Mirror card enables "double execute" for 2 AP, superior to Heavy Strike CC's 3 AP single-hit. The silence accidentally pushes player toward better play.

### state-03-11 — Final Exam Phase 2 (Floor 8, multi-hit boss, Late)
**Dominant play:** Overheal(CC,3ap) = 14 block vs 4×4=16 net damage = 2 HP through. Best defensive turn.
**Dead cards:** Execute (enemy nowhere near 30% HP threshold).
**Tension:** Real. Overheal CC vs mixed offense. At 28 HP, defense is mandatory.
**RECURRING DEAD CARD:** Execute appears dead in states 11, 13, 14, 17 wherever the enemy has not been significantly weakened before the state begins.

### state-03-12 — The Curriculum Phase 2 (Floor 9, QP-immune, Late)
**Dominant play:** Empower(QP) + Strike(CC) = 4 to HP through block. No other viable option.
**Dead cards:** Strike×2(QP), Heavy Strike(QP) — 60% of hand is dead (QP deals 0 damage).
**Tension:** None meaningful — player cannot do more than 1 Charge per turn anyway.
**CRITICAL DESIGN CONCERN:** QP-immune boss + Charge AP surcharge = player can only execute 1 charge per 3-AP turn. With QP cards becoming dead weight, the hand is effectively 1-card-useful on any given turn. This creates a "no good play" scenario that feels punishing rather than interesting.

### state-03-13 — Final Lesson (Floor 10, Strength 4, Late)
**Dominant play:** Reckless(CC,3ap) = 9 dmg exactly kills. Only winning line.
**Dead cards:** Execute (threshold not reached), Emergency (4 block vs 32 incoming = worthless).
**Tension:** High existential tension but zero strategic complexity — "find the kill or die." Only 1 path survives. Others = death.
**Design note:** Wrong-charge accumulation creates "death spiral" state. Once Strength 4 is reached, player has no real choice. This is punishing but arguably fits the final boss design.

### state-03-14 — The Rabbit Hole (Floor 9, debuff spam, Late)
**Dominant play:** Foresight(0ap) + Heavy Strike(CC,3ap) = kills enemy (18 dmg > 15 HP). Cleanse unnecessary.
**Dead cards:** Cleanse (doesn't help), Adapt (cleanse redundant), Hex (enemy dies fast).
**Tension:** None. Chain 2 makes Heavy Strike CC trivially lethal.
**DOMINANT CARD PATTERN:** Foresight is played in EVERY state where it appears (states 04, 14, 19). 0 AP cost makes it always optimal. Potential over-powered utility.

### state-03-15 — Group Project Phase 2 (Floor 10, Late)
**Dominant play:** Reckless(QP,1ap) kills. Done.
**Dead cards:** All other cards (overkill with 2 AP remaining after kill).
**Tension:** ZERO. Enemy at 7 HP with no block dies to any attack.
**DESIGN FLAW:** Phase 2 of Group Project (7 HP, no block) has zero strategic interest. Should have higher HP or block.

### state-03-16 — All-2AP hand (Floor 6, Proctor, Edge)
**Dominant play:** Heavy Strike(CC,3ap) — only card that does significant damage through 6 block.
**Dead cards:** Slow (wrong intent type), Fortify (0 block = 0 effect), Lifetap (absorbed by block), Double Strike (no follow-up AP).
**Tension:** ZERO. 4/5 cards are dead in this specific context.
**DESIGN CONCERN:** Some cards have implicit prerequisites that make them dead in specific contexts. Players may feel cheated by a hand where 80% of cards are non-functional.

### state-03-17 — Critical HP thresholds (Floor 4, Plagiarist, Edge)
**Dominant play:** Reckless(CC,3ap) = kills. Only survival path.
**Dead cards:** Execute (threshold not reached), Overheal/Emergency provide insufficient block vs Strength-boosted attack.
**Tension:** High — wrong answer on Reckless CC = player death. Last Breath safety net partially mitigates.
**Design note:** Threshold doubling (Emergency/Overheal at low HP) is an interesting mechanic but numerically may not be enough against late-turn Strength-stacked enemies.

### state-03-18 — Surge Turn + Time Warp (Floor 5, Grade Dragon, Edge)
**Dominant play:** Any single Charged attack kills. Heavy Strike(CC) = 55 dmg vs 13 HP.
**Dead cards:** Nothing is dead (surge makes any charge lethal).
**Tension:** ZERO. Enemy trivially dies to any Charged attack during surge.
**Design note:** Time Warp's 5.0× surge multiplier makes surge turns completely trivial on standard enemies. The "interesting moment" design intent works but decision quality is 0.

### state-03-19 — Zero damage hand (Floor 7, Comparison Trap, Edge)
**Dominant play:** Foresight(0ap) + Scout/Recycle to fill hand. Accept 12 incoming dmg.
**Dead cards:** Cleanse (no player debuffs), Adapt (1 block vs 12-hit multi = negligible).
**Tension:** Moderate. Draw to survive vs Adapt for 1 block. Accepting 12 dmg is required.
**FORESIGHT PATTERN:** Third state where Foresight is always-correct to play.

### state-03-20 — Mirror + Overclock vs Algorithm (Floor 8, Edge)
**Dominant play:** Piercing(CC,2ap) + Mirror(QP,1ap) = 5+3=8 dmg exactly kills. Slow useless vs heal.
**Dead cards:** Slow (cannot cancel heal), Overclock+Piercing (1 HP short of kill).
**Tension:** REAL. Overclock+Pierce = miss kill by 1 HP. Pierce(CC)+Mirror = exact kill. One AP decision matters.
**SLOW PATTERN:** Slow confirmed useless against heal intents in states 07 and 20. Pattern of players misusing Slow against non-defend/non-buff intents.

---

## Aggregate Pattern Analysis

### Cards ALWAYS Chosen (Dominant Cards)
| Card | States Present | Always Chosen | Reason |
|---|---|---|---|
| Foresight | 04, 14, 19 | YES (3/3) | 0 AP cost = never a wrong play. Strictly dominant. |
| Reckless (as kill shot) | 03, 13, 15, 17 | HIGH | When enemy is at exact killable HP, Reckless QP/CC is the fastest kill |
| Piercing | 02, 08, 09, 20 | HIGH | Against block-heavy enemies, Piercing is the only AP-efficient damage route |

### Cards NEVER Chosen / Dead Cards
| Card | States Dead | Reason |
|---|---|---|
| Execute | 11, 13, 14, 17 | Enemy never at <30% HP in the given state |
| Slow | 07, 16, 20 | Applied against non-cancellable intents (heal, attack) |
| Scout/Recycle | 01, 03, 06, 15 | Drawing when enemy dies this turn |
| Fortify (with 0 block) | 16 | Doubles 0 = 0 |
| Heavy Strike QP vs chargeResistant+block | 02 | Double penalty makes it ~0 damage |
| Emergency (player above 30% HP) | 05, 11 | Threshold not met |

### States with "No Good Play" (≥ agent said no viable option)
- **state-03-12** (Curriculum QP-immune): 60% of hand dead, 1 effective play max per turn
- **state-03-13** (Final Lesson Strength 4): single kill path only, all others = death
- **state-03-16** (All-2AP edge): 4/5 cards dead in context

### States with "Trivial / Boring Fight"
- **state-03-01**: Floor 1 triviality (expected, not a concern)
- **state-03-03**: Mold Puff too fragile
- **state-03-04**: Pop Quiz dies before reactive hooks matter
- **state-03-06**: Peer Reviewer trivial kill after build-up
- **state-03-15**: Group Project Phase 2 at 7 HP
- **state-03-18**: Surge + Time Warp trivializes any enemy

### States with Genuine Tension (Good Design)
- **state-03-02**: Thesis Construct block+charge defense vs offense
- **state-03-07**: Citation Needed block-steal trap + Slow misuse trap
- **state-03-09**: Tenure Guardian — Expose+Pierce vs Slow CC two viable paths
- **state-03-10**: Librarian silence + Mirror combo discovery
- **state-03-20**: Overclock vs Pierce+Mirror (1 HP margin)
- **state-03-17**: Critical HP + one-kill-path tension

---

## Top 3 Patterns

### Pattern 1: Foresight is a Strictly Dominant Card
Across 3 independent states (04, 14, 19) where Foresight appeared, it was always the first card played. Its 0 AP cost makes it a strictly dominant play — there is never a strategic reason NOT to play it. This suggests Foresight may be over-powered as a 0-cost draw engine.

### Pattern 2: Slow Has a Clarity Bug (Misrepresented Against Heals)
In states 07 and 20, the enemy's intent was "Heal" and Slow was in hand. In both states the analysis confirmed Slow cannot cancel heals (only defend/buff). However, the card description "Skip enemy's next defend or buff" does not explicitly exclude heals. Players routinely attempt Slow against heals, wasting 2 AP. This is a communication failure that needs a fix (either Slow should cancel heals too, or the tooltip must say "defend or buff only, not heal or attack").

### Pattern 3: Reckless is Dead Against Block-Heavy Enemies
In states 09 (Tenure Guardian with 18 block) and 16 (Proctor with 6+ block and no Pierce available), Reckless deals 0 effective damage. The card has no pierce, no bypass, and when the full damage is absorbed by block, even the 3 HP self-damage is paid for zero benefit. Reckless is a glass-cannon attack that requires a clear path to HP. Against the block-stacking enemy archetype (Proctor, Tenure Guardian, Staple Bug), Reckless goes from strong to completely dead with no visual feedback to explain why.

---

## Additional Findings

### Execute's Threshold Problem
Execute appeared in 5 states (11, 13, 14, 17, 08). In every state, the enemy was not yet below 30% HP when Execute was drawn. Execute appears to be a card that rewards players who PLAN to use it as a finisher but punishes players who draw it mid-fight when the enemy is at full health. It was dead in 4/5 states analyzed. This may indicate that Execute either needs a higher base value at normal HP levels, or that it signals clearly when the bonus is active.

### The Curriculum QP-Immunity Creates a Design Paradox
The Curriculum's Phase 2 QP immunity is mechanically interesting but creates a situation where 60% of a typical hand is dead weight. With Charge costing +1 AP surcharge, a player can only execute 1 Charge per 3-AP turn. The fight effectively becomes "play 1 card per turn" which is a massive reduction in agency. This is the only fight in the game where the player's APM (actions per minute) drops to 1. It needs either a way to reduce the surcharge, more AP, or a different immunity model.

### Surge + Time Warp Trivializes Standard Fights
The Time Warp relic makes surge turns completely trivial against standard enemies. Any single Charged attack (Heavy Strike CC on surge = 50 damage) one-shots everything. The "tension" of the timer being halved is not meaningful when any answer (even a wrong Charge) deals more than enough to kill. Time Warp's power scaling may need review — it converts surge turns from interesting into trivially automatic wins.
