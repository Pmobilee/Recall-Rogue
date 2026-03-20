# AR-106: Ascension Redesign — Challenge + Reward at Every Level

## Overview

**Goal:** Redesign all 20 ascension levels so each one adds a meaningful challenge AND a small player buff. Players should feel excited to unlock the next ascension, not dread it. Every level should change HOW you play, not just make numbers bigger.

**Design Philosophy:**
- **STS Principle:** Each ascension should force strategic adaptation, not just punish
- **Our Innovation:** Every ascension level gives players a small compensation buff — a new tool that partially offsets the new challenge, creating fresh build possibilities
- **Pacing:** Difficulty should ramp smoothly. Current system has dead zones (A5-A10 identical) and cliffs (A13 halves HP)

**Key STS Reference (from research):**
- A1: +60% elites (more risk, more reward)
- A5: Heal only 75% at boss rest
- A10: Start with curse card (deck pollution)
- A17-19: Enemy improved AI/movesets
- A20: Double boss fight

---

## The 20 Ascension Levels

### Tier 1: Learning to Adapt (A1-A5)
*Gentle ramp. Each challenge has an obvious counter-strategy.*

| Level | Challenge (Curse) | Buff (Blessing) | Design Intent |
|-------|------------------|-----------------|---------------|
| **A1** | Elites appear on the map (+1 elite per segment) | **Choose 1 of 3 Starter Relics** before run begins | Forces relic-aware deckbuilding from turn 1. The starter relic defines the run. |
| **A2** | Enemies deal +10% damage | +1 AP on the first turn of every encounter | Encourages aggressive openers — kill fast before the damage adds up. |
| **A3** | Rest rooms heal 25% instead of 30% | Card removal at rest is free (normally costs gold) | Shifts rest value from healing to deck thinning. Rewards lean decks. |
| **A4** | Quiz timer -1 second on all questions | Start each run with a random uncommon card added to deck | Tighter timing, but better starting tools. Forces faster recall. |
| **A5** | Start with 12 cards instead of 15 | All shops offer one free card removal per visit | Thinner starting deck, but free thinning. Rewards understanding which cards to keep. |

### Tier 2: Strategic Pressure (A6-A10)
*Real challenge begins. Builds on Tier 1 knowledge.*

| Level | Challenge (Curse) | Buff (Blessing) | Design Intent |
|-------|------------------|-----------------|---------------|
| **A6** | No fleeing from encounters | Heal 5 HP when you achieve a 3+ combo | Trapped in fights — must play well. Combo healing rewards correct answers. |
| **A7** | Close-distractor answers more common (harder questions) | Charged correct answers deal +15% damage | Harder questions, but bigger payoff. Risk/reward on charging. |
| **A8** | Mini-bosses gain boss-tier attack patterns | Mini-boss victories always drop a relic | Harder mini-bosses, but guaranteed relic reward. Worth the fight. |
| **A9** | Enemy HP regenerates 2 per turn | Start each encounter with 3 shield | Enemies are tankier over time. Starting shield gives you a buffer to set up. |
| **A10** | Start with a Curse card in deck (unplayable, clogs hand) | One free relic reroll per boss reward | Deck pollution, but more control over relic selection. Classic STS A10. |

### Tier 3: Expert Territory (A11-A15)
*Only skilled players progress. Every decision matters.*

| Level | Challenge (Curse) | Buff (Blessing) | Design Intent |
|-------|------------------|-----------------|---------------|
| **A11** | Boss relic choices reduced to 2 | Relics trigger +50% more often | Fewer choices, but the relics you have are stronger. Quality over quantity. |
| **A12** | Tier 1 cards use 4-option MCQ (harder) | Tier 1 cards deal +20% more damage when charged correctly | Harder Tier 1 questions, but more rewarding. Mastery of basics matters. |
| **A13** | Player max HP reduced to 80 (from 100) | Start with Vitality Ring relic (free +20 HP = net 100 HP, but takes a relic slot) | Same effective HP but burns a relic slot. Opportunity cost. |
| **A14** | Combo resets at end of each turn (no carry-over) | Perfect turns (all correct) grant +1 AP next turn | Can't coast on combo. Must earn it every turn. Perfect play = faster turns. |
| **A15** | Bosses gain +25% HP | Defeating a boss fully heals the player | Longer boss fights, but winning means you're ready for next segment. |

### Tier 4: Mastery (A16-A20)
*The final gauntlet. Only the dedicated survive.*

| Level | Challenge (Curse) | Buff (Blessing) | Design Intent |
|-------|------------------|-----------------|---------------|
| **A16** | Echo mechanic disabled (no free replays) | When a card is discarded, gain 1 shield | Lose echo safety net. Gain passive defense from discard. Changes card evaluation. |
| **A17** | Wrong answers deal 3 self-damage | Correct answers heal 1 HP | Every question is life-or-death. Knowledge literally keeps you alive. |
| **A18** | Start with 10 cards (tiny deck) | Choose starting hand each encounter (pick 5 from deck) | Tiny deck = faster cycling but less versatility. Hand selection adds skill ceiling. |
| **A19** | All questions force hard formats (fill-blank, production) | Charge plays cost 0 extra AP (free charging) | Hardest possible questions, but no AP penalty for attempting. Pure knowledge test. |
| **A20** | Floor 24 boss gains secret second phase | Start the run with 2 relics (choose from 5) | The ultimate challenge. Double relic start gives you tools to face it. |

---

## Starter Relic Choice (A1+)

From Ascension 1 onwards, before the run begins, players choose 1 of 3 starter relics from a curated pool:

### Starter Relic Pool (run-defining, not overpowered)

| Relic | Effect | Build Direction |
|-------|--------|-----------------|
| **Scholar's Lens** | First charge each turn costs 0 extra AP | Charge-heavy builds |
| **Warrior's Crest** | +3 base attack damage, -1 max AP | Aggressive, fewer but bigger hits |
| **Healer's Pendant** | Heal 5 HP after each encounter, -10 max HP | Sustain build, lower ceiling |
| **Gambler's Die** | +50% gold from all sources, start with 30 less HP | Economy build, risky |
| **Archivist's Tome** | Draw 1 extra card per turn, -5 max HP | Card advantage build |
| **Guardian's Seal** | Start each turn with 4 block, attacks deal -2 damage | Defensive/shield build |

Players see 3 random options from this pool. The choice should feel like it shapes the entire run.

---

## Implementation Plan

### Sub-step 1: Update AscensionModifiers interface
Add new fields for all buffs:
- `starterRelicChoice: boolean`
- `firstTurnBonusAp: number`
- `freeRestCardRemoval: boolean`
- `comboHealThreshold: number` / `comboHealAmount: number`
- `chargeCorrectDamageBonus: number`
- `miniBossGuaranteedRelic: boolean`
- `enemyRegenPerTurn: number`
- `encounterStartShield: number`
- `startWithCurseCard: boolean`
- `freeRelicReroll: boolean`
- `relicTriggerBonus: number`
- `tier1DamageBonus: number`
- `perfectTurnBonusAp: number`
- `bossDefeatFullHeal: boolean`
- `discardGivesShield: number`
- `correctAnswerHeal: number`
- `wrongAnswerSelfDamage: number`
- `chooseStartingHand: boolean`
- `freeCharging: boolean`
- `startingRelicCount: number`

### Sub-step 2: Update getAscensionModifiers()
Implement all 20 levels with both curse and blessing.

### Sub-step 3: Update turnManager to read new modifier fields
The turn manager already reads some fields. Add support for new ones.

### Sub-step 4: Update headless sim to apply new modifiers
The sim applies ascension modifiers to TurnState. Extend for new fields.

### Sub-step 5: Run sweep and tune
Run 500 × 6 profiles × 20 levels = 60,000 sims to verify smooth difficulty curve.

---

## Target Survival Rates

| Ascension | Scholar | Dedicated | Regular | Gamer | Casual | First Timer |
|-----------|---------|-----------|---------|-------|--------|-------------|
| A0 | 55% | 45% | 35% | 25% | 35% | 15% |
| A5 | 40% | 30% | 22% | 15% | 22% | 8% |
| A10 | 25% | 18% | 12% | 8% | 12% | 3% |
| A15 | 12% | 8% | 5% | 3% | 5% | 1% |
| A20 | 5% | 3% | 1% | <1% | 1% | 0% |

---

## Success Criteria

- [ ] All 20 levels have both a challenge AND a buff
- [ ] Survival rates form smooth curve from A0 to A20
- [ ] No dead zones (A5-A10 identical in old system)
- [ ] No cliff drops (A13 was devastating in old system)
- [ ] Starter relic choice feels meaningful and run-defining
- [ ] Each ascension changes HOW you play, not just how hard it is
- [ ] A20 is beatable by scholar at ~5% rate
