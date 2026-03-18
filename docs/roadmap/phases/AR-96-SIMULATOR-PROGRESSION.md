# AR-96: Simulator Progression & Decision Fidelity

## Overview

**Goal:** Add all missing progression and strategic decision systems to the headless simulator so it accurately models a real player's run — deck growth, reward selection, deck thinning, relic rewards, and synergy-aware purchasing.

**Motivation:** AR-95 fixed the combat mechanics (play modes, chains, surge), but an audit revealed the simulator is playing with a **frozen starter deck** the entire run. Real players gain 6-12 cards from combat rewards, remove 2-3 weak cards, earn 2-4 relics from bosses/elites, and make strategic shop purchases based on deck synergy. Without these, simulation results don't reflect real gameplay.

**Dependencies:** AR-95 (complete)
**Estimated complexity:** HIGH — multiple decision systems with strategy-level awareness

---

## Gap Analysis

| System | Current State | Real Game | Coverage |
|--------|--------------|-----------|----------|
| Card rewards (post-combat) | Not modeled | Pick 1 of 3 cards after each combat | **0%** |
| Relic rewards (boss/elite) | Not modeled | Pick 1 of 3 relics after boss/elite encounters | **0%** |
| Rest site: Meditate | Not modeled | Remove 1 card from deck (deck thinning) | **0%** |
| Shop: Card removal | Not modeled | Pay gold to remove a card | **0%** |
| Shop: Synergy-aware card purchase | Random probability | Evaluate card fit for deck/chains | **20%** |
| Shop: Relic evaluation | Random probability | Evaluate relic fit for build | **40%** |
| Relic slot cap (5) | No limit | Must sell weakest to make room | **0%** |
| Haggling | Not modeled | Quiz for 30% discount on shop items | **0%** |

---

## Sub-Steps

### Phase 1: Post-Combat Card Rewards

#### 1.1 Generate card reward options after each combat encounter
- **Where:** After encounter victory in the combat loop (after encounter result recording, before post-encounter healing)
- **What:** Generate 3 card options using the existing `rewardGenerator.ts` service or a simplified version:
  - 1 attack-type card, 1 defense-type card, 1 utility/buff/debuff card
  - Each card gets a random chainType (0-5), appropriate mechanic, and tier based on floor depth
  - Floor-based pre-upgrade probability: floors 1-3: 0%, 4-6: 10%, 7-9: 20%, 10-12: 30%, 13+: 40%
- **Decision logic by strategy level:**
  - `basic`: Pick a random card, 20% chance to skip entirely
  - `intermediate`: Pick the card type the deck needs most (count attack/shield/utility ratio, pick the underrepresented type), 10% skip chance
  - `optimal`: Evaluate each option by:
    1. Deck composition need (underrepresented types get priority)
    2. Chain type synergy (prefer chainTypes already present 2+ times in deck for chain-building)
    3. Card tier (higher tier = better)
    4. Never skip unless deck is already 20+ cards
- **Acceptance:** Deep stats show deck size growing over a run (starting ~16, ending ~22-28)

#### 1.2 Track reward decisions in deep stats
- Add to `DeepRunStats`:
  ```typescript
  cardRewardsOffered: number;
  cardRewardsTaken: number;
  cardRewardsSkipped: number;
  ```

### Phase 2: Relic Rewards (Boss/Elite)

#### 2.1 Generate relic reward after boss and elite encounters
- **Where:** After boss or mini-boss victory (check `enemy.template.category`)
- **What:** Generate 3 relic options from `FULL_RELIC_CATALOGUE`, excluding already-owned relics
- **Decision logic:**
  - `basic`: Pick the first relic available
  - `intermediate`: Prefer relics matching current playstyle (attack relics for aggressive archetype, defense for defensive)
  - `optimal`: Score each relic by:
    1. Category match (offense/defense/sustain matching archetype)
    2. Synergy potential (check `detectActiveSynergies` with each candidate added)
    3. Tier (S-tier relics from our analysis always picked)
- **Relic slot cap:** If already at 5 relics:
  - `basic`: Don't pick (skip the reward)
  - `intermediate/optimal`: Evaluate weakest current relic vs best offered relic. Sell weakest if new one scores higher. Sell refund = 40% of relic base price → add to gold.

#### 2.2 Track relic reward decisions in deep stats
- Add to `DeepRunStats`:
  ```typescript
  relicRewardsOffered: number;
  relicRewardsTaken: number;
  relicsSold: number;
  ```

### Phase 3: Deck Thinning

#### 3.1 Add Meditate option to rest sites
- **Where:** Rest site decision block (currently binary heal/upgrade)
- **What:** Add a third option: Meditate (remove 1 card from deck)
- **Decision logic:**
  - `basic`: Never mediates (doesn't understand deck thinning)
  - `intermediate`: Meditate when deck > 20 cards and HP > 70%
  - `optimal`: Meditate when deck > 18 cards and HP > 60%. Remove the weakest card (lowest baseEffectValue among non-attack cards, or the card type with most copies)
- **Card removal logic:** Remove from pool array, track in deep stats

#### 3.2 Add shop card removal service
- **Where:** Shop purchase block
- **What:** After buying relics/cards/food, consider paying for card removal
- Pricing: 50g + 25g per previous removal
- **Decision logic:**
  - `basic`: Never removes
  - `intermediate`: Remove 1 card if deck > 22 cards and gold > 150
  - `optimal`: Remove 1 card if deck > 18 cards and gold > 100. Choose weakest card (same logic as Meditate)

#### 3.3 Track deck management in deep stats
- Add:
  ```typescript
  cardsRemoved: number;
  meditateCount: number;
  shopRemovalCount: number;
  deckSizeByFloor: number[]; // deck size at each floor start
  ```

### Phase 4: Synergy-Aware Shopping

#### 4.1 Improve shop card purchasing
- **Replace** the random probability check with evaluation logic:
  - Count card types in current deck
  - Calculate need score per type: `needScore = idealRatio - actualRatio`
  - Check chainType overlap: bonus if card's chainType already appears 2+ times in deck
  - `optimal`: Buy the highest-need card that also has chain synergy, only if gold allows
  - `intermediate`: Buy the highest-need card type, 70% of the time
  - `basic`: Buy randomly (current behavior), 50% of the time

#### 4.2 Improve shop relic purchasing
- **Replace** the random probability check with relic evaluation:
  - Score each relic by: tier (S/A/B/C from our analysis), category match, synergy count
  - `optimal`: Buy only A-tier+ relics, or any relic that creates a new synergy
  - `intermediate`: Buy only if the relic category matches archetype, 70% chance
  - `basic`: Buy randomly (current behavior)
  - Respect the 5-relic cap (Phase 2 logic)

### Phase 5: Haggling

#### 5.1 Model haggling quiz before shop purchases
- **Where:** Before each shop purchase
- **What:** Roll answer accuracy (same as `rollAnswer`) to determine if haggle succeeds
- If haggle succeeds: 30% discount applied to item price
- `basic`: Never attempts haggle (doesn't know about it)
- `intermediate`: Haggles 50% of the time
- `optimal`: Always haggles (free upside — wrong answer = full price, no penalty)
- **Track:** `haggleAttempts`, `haggleSuccesses` in deep stats

### Phase 6: Enhanced Deep Stats & Mass Simulate

#### 6.1 Update mass-simulate to report progression metrics
- New metrics in accumulator:
  - `avgDeckSizeEnd`: average deck size at run end
  - `avgCardsGainedFromRewards`: average cards picked up from rewards
  - `avgCardsRemoved`: average cards removed (meditate + shop removal)
  - `avgRelicsFromRewards`: average relics gained from boss/elite rewards
- Print these in the summary table

#### 6.2 Add "progression" tracking to deep analysis
- Track deck size at each floor boundary
- Track card type distribution evolution over the run
- Track chain type distribution evolution

---

## Files Affected

### Modified
- `tests/playtest/core/headless-combat.ts` — card rewards, relic rewards, rest choices, shop logic, haggling
- `tests/playtest/core/combat-strategies.ts` — card reward evaluation, relic evaluation, deck thinning heuristics (new exported functions)
- `tests/playtest/core/types.ts` — new deep stat fields
- `scripts/mass-simulate.ts` — new accumulator metrics

### Read-Only Reference
- `src/services/rewardGenerator.ts` — card reward generation logic
- `src/data/relics/index.ts` — relic catalogue for reward generation
- `src/services/shopService.ts` — shop pricing and generation
- `src/data/balance.ts` — reward probabilities, pricing

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Deep stats show deck size growing over run (16 → 22-28)
- [ ] Optimal profiles build better decks than basic profiles (measured by win rate delta)
- [ ] Relic count capped at 5 for all runs
- [ ] Card removal happening for intermediate/optimal profiles
- [ ] Haggle success rate matches profile accuracy
- [ ] Mass simulation results differ meaningfully from pre-AR-96 (higher survival expected)

---

## Expected Impact

Adding card rewards alone should dramatically change simulation results:
- **Survival rates will increase** — decks improve over the run instead of stagnating
- **Relic rewards will create power spikes** at boss/elite floors
- **Deck thinning will improve late-game consistency** — fewer dead draws
- **Overall simulation accuracy** should improve from ~60% fidelity to ~90% fidelity

The remaining 10% gap is inherent to headless simulation: no timer pressure, no visual reading, no quiz question difficulty variance — these can't be meaningfully simulated.
