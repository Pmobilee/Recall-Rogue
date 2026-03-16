# AR-55: Card Mechanic Rebalance — Eliminate Dead Draws

**Status:** Pending
**Created:** 2026-03-16
**Estimated complexity:** Medium (balance changes + some mechanic redesigns)

---

## Core Design Principle

**Every card play costs the player a QUIZ QUESTION + AP.** If the player gets the question wrong, the card fizzles and the AP is wasted. This means every card effect must be **worth the risk of fizzle**. Low-impact effects that cost 1 AP feel terrible because the downside (fizzle + wasted AP) is often worse than the upside.

**The math that matters:** With 3 AP per turn and 5 cards in hand, each AP point is 33% of your turn. Spending 33% of your turn on "+30% to next card" or "draw 1 extra card" is almost never correct when you could spend it on 8 damage or 6 block.

---

## Mechanic-by-Mechanic Analysis

### ✅ GOOD — Keep As-Is

| Mechanic | Cost | Effect | Why It Works |
|----------|------|--------|-------------|
| **Strike** | 1 AP | 8 damage | Bread and butter. Always worth playing. |
| **Block** | 1 AP | 6 block | Reliable defense. |
| **Quicken** | 0 AP | +1 AP | FREE extra action. Incredible design — answering a quiz gives you more plays. |
| **Heavy Strike** | 3 AP | 20 damage | All-in. One question, one turn, massive payoff. High risk, high reward. |
| **Piercing** | 1 AP | 6 damage (ignores block) | Niche but clearly useful when enemy blocks. |
| **Reckless** | 1 AP | 12 damage, 3 self-damage | Clear risk/reward trade. Players understand it immediately. |
| **Execute** | 1 AP | 6 + 8 bonus below 30% | Satisfying finisher. |
| **Lifetap** | 2 AP | 8 damage + heal 20% | Attack + sustain in one card. Worth the premium. |
| **Brace** | 1 AP | Block = enemy telegraph | Perfect block. Feels smart to use. |
| **Weaken** | 1 AP | -25% enemy damage, 2 turns | Clear defensive value. |
| **Hex** | 1 AP | 3 poison × 3 turns = 9 total | Better than Strike over time. Feels different. |
| **Multi-Hit** | 2 AP | 4 × 3 hits = 12 | One question for multi-hit. Synergizes with buffs. |
| **Cleanse** | 1 AP | Remove debuffs + draw 1 | Situationally powerful, draw is a nice bonus. |
| **Transmute** | 1 AP | Transform random hand card | Fun gamble. Exciting to play. |
| **Mirror** | 1 AP | Copy previous card | Powerful with setup. High skill ceiling. |
| **Adapt** | 1 AP | Auto-picks best effect | Smart design — always useful. |
| **Emergency** | 1 AP | 4 block, 8 if HP < 30% | Desperation mechanic. Clear identity. |
| **Parry** | 1 AP | 3 block + draw if attacked | Conditional value. The draw makes it worthwhile. |

### ❌ PROBLEMATIC — Need Fixing

#### 1. Scout (Draw 1 card) — THE WORST CARD IN THE GAME

**Current:** 1 AP, answer a quiz, draw 1 card.

**Problem:** You have 5 cards and 3 AP. You can only play 3 cards per turn. Drawing a 6th card when you can't play 4 is almost always worthless. You spent 1/3 of your turn and risked a fizzle for... one more card you probably can't use this turn anyway.

**The question test:** "Would I rather play Strike (8 damage) or Scout (draw 1 card)?" The answer is ALWAYS Strike. Scout never competes.

**Fix options (pick one):**
- **A) Draw 2 cards instead of 1.** Still costs 1 AP but now you're digging deep for what you need. This makes it a real cycling tool.
- **B) Make it 0 AP (free).** Like Quicken, answering the quiz IS the cost. Drawing a card for free feels like a bonus for knowing the answer.
- **C) Draw 1 + gain 1 AP.** Combines Scout and Quicken — answering correctly draws a card AND refunds the AP, letting you play the drawn card.

**Recommended: Option A (draw 2 cards).** Simple, powerful enough to be worth playing, maintains the 1 AP cost.

#### 2. Empower (+30% to next card) — TOO WEAK

**Current:** 1 AP, answer a quiz, next card does +30%.

**Problem:** Empower (1 AP) + Strike (1 AP) = 2 AP, 10.4 damage, 2 quiz questions. Two Strikes = 2 AP, 16 damage, 2 quiz questions. Empower is **strictly worse** in damage-per-AP. The only time it's good is buffing Heavy Strike, but that's a 4 AP combo (Empower + Heavy Strike = 1+3 = 4 AP, more than a full turn).

**Fix:** Increase to **+50%** (so Empower + Strike = 12 damage, closer to 2 Strikes' 16 but still weaker — justified by the flexibility of buffing any card type).

Or: **Make it affect ALL remaining cards this turn** at +20% each. If you play Empower first (1 AP), then Strike + Strike (2 AP), you get 9.6 + 9.6 = 19.2 total. That's actually worth the setup.

**Recommended: +50% to next card.** Simple buff, clear improvement.

#### 3. Double Strike (2 AP for next attack at 2x60%) — MATHEMATICALLY TERRIBLE

**Current:** 2 AP, answer a quiz, next attack card hits twice at 60% power each.

**Problem:** Double Strike (2 AP) + Strike (1 AP) = 3 AP, 8 × 0.6 × 2 = 9.6 damage, 2 quizzes. Three Strikes (3 AP) = 24 damage, 3 quizzes. Double Strike is **literally less than half** the damage of just playing attacks.

**Fix:** Change to **next attack hits at full power twice** (2x100%, not 2x60%). Double Strike + Strike = 3 AP, 16 damage, 2 quizzes. Three Strikes = 3 AP, 24 damage, 3 quizzes. Still weaker in raw damage, but only requires 2 quizzes instead of 3 — reducing fizzle risk. And it enables massive burst with Heavy Strike (2 × 20 = 40 damage in one combo).

**Recommended: Remove the 60% penalty. Make it true double at 100%.** The 2 AP cost is already the balancing factor.

#### 4. Thorns (2 AP for 6 block + 2 reflect) — TOO EXPENSIVE

**Current:** 2 AP, 6 block + 2 reflect damage.

**Problem:** Block (1 AP, 6 block) + Strike (1 AP, 8 damage) = 2 AP, 6 block + 8 damage. Thorns = 2 AP, 6 block + 2 reflect (conditional). Thorns gives the same block but 4x less damage, and the reflect only fires if the enemy attacks.

**Fix options:**
- **A) Reduce to 1 AP.** Same effect but affordable. Now it competes with Block (same block, plus 2 conditional damage for free).
- **B) Keep at 2 AP but increase reflect to 5.** Makes the reflect meaningful.
- **C) Reduce to 1 AP and increase reflect to 3.**

**Recommended: 1 AP, 6 block + 3 reflect.** Clean, simple, worth playing.

#### 5. Recycle (1 AP to cycle 1 card) — BARELY USEFUL

**Current:** 1 AP, answer a quiz, discard self, draw 1.

**Problem:** You spend 1 AP and a quiz to replace one card with a random one. Net effect: you've lost an action for a coinflip on getting something better. With only 3 AP, this is almost never the right play.

**Fix:** Make it **0 AP (free cycle).** Answer the quiz correctly, this card discards and you draw a replacement. No AP cost. Now it's a free filter on your hand quality — answer a quiz, swap a bad card for hopefully a better one. This feels great and is always worth considering.

**Recommended: 0 AP free cycle.** Like Quicken, the quiz IS the cost.

#### 6. Focus (1 AP for min 1.3x on next card) — CONFUSING AND WEAK

**Current:** 1 AP, next card effect gets minimum 1.3x multiplier.

**Problem:** 1.3x is the Tier 2a multiplier. If your cards are already Tier 2a+, Focus does nothing. Even when it helps, Focus + Strike = 2 AP for 10.4 damage. Two Strikes = 16 damage. Like Empower but worse because it has a ceiling.

**Fix:** Change to **+3 flat damage/block/effect to next card** (not percentage). This is always useful regardless of tier, and scales linearly. Focus + Strike = 2 AP, 11 damage. Not amazing, but predictable and always helpful.

Or: **Remove Focus entirely** and merge its concept into Empower (one buff mechanic is enough).

**Recommended: Remove Focus. Empower at +50% covers the "buff next card" design space sufficiently.**

#### 7. Foresight (1 AP to reveal 2 intents) — INFORMATION ISN'T WORTH AP

**Current:** 1 AP, answer a quiz, see enemy's next 2 moves.

**Problem:** Many enemies already telegraph their intents. Even when they don't, spending 1/3 of your turn on information (instead of damage or block) rarely changes your decisions enough to justify the cost.

**Fix:** Make it **0 AP + draw 1 card.** Reveal intents AND draw a card, for free. Now it's a useful scouting tool — peek at enemy plans while cycling your hand.

Or: **1 AP, reveal 2 intents + gain 2 block.** Give it a defensive floor so it's never completely wasted.

**Recommended: 0 AP, reveal 2 intents + draw 1 card.** Information + card advantage for free makes this an exciting find.

#### 8. Overclock (2 AP for 2x next card, -1 draw) — PUNISHING DOWNSIDE

**Current:** 2 AP, next card doubled, but draw -1 next turn.

**Problem:** Overclock + Strike = 3 AP, 16 damage (but next turn you draw 4 instead of 5). You've spent your whole turn on one boosted attack AND get punished next turn. Three Strikes = 24 damage, no downside.

**Fix:** Remove the draw penalty. **2 AP, next card effect doubled.** Still expensive (2/3 of turn budget) and requires a follow-up card, but no lingering punishment. The 2 AP cost IS the downside.

**Recommended: Remove -1 draw penalty.** The 2 AP cost is sufficient downside.

#### 9. Overheal (2 AP, 9 block, 1.5x if low HP) — SLIGHTLY OVERCOSTED

**Current:** 2 AP for 9 block (13.5 if HP < 50%).

**Problem:** Two Blocks = 2 AP, 12 block. Overheal = 2 AP, 9 block (13.5 conditional). Only better than two Blocks when HP is low.

**Fix:** **Either reduce to 1 AP with 7 base block**, or **keep 2 AP but increase base to 10 and conditional multiplier to 2x** (20 block when desperate).

**Recommended: 2 AP, 10 block, 2x if HP < 50%.** Makes it a real emergency shield that's distinctly better than stacking Blocks when you're in trouble.

#### 10. Slow (2 AP to skip enemy action) — MAYBE TOO EXPENSIVE

**Current:** 2 AP, skip enemy's next action.

**Analysis:** This is actually fine against bosses doing 15+ damage per turn. Spending 2 AP to negate a big hit is efficient. But against weak enemies it's overkill.

**Verdict:** ✅ Keep as-is. Niche but correct.

#### 11. Fortify (2 AP, 5 persistent block) — SLIGHTLY WEAK

**Current:** 2 AP, 5 block that persists to next turn.

**Problem:** Two Blocks = 12 block this turn. Fortify = 5 block this turn + 5 next turn. Only better if you need block spread across turns.

**Fix:** Increase base to **7 persistent block.** Now it's 7 this turn + 7 next turn = 14 total block for 2 AP, clearly better than two Blocks (12) when played proactively.

**Recommended: 7 persistent block.**

#### 12. Immunity (1 AP, absorb next status) — TOO NICHE

**Current:** 1 AP, absorb next status damage instance.

**Problem:** Only useful against enemies that apply debuffs/poison. Against most enemies, it's a dead draw.

**Fix:** Broaden to **absorb next damage instance entirely (including direct damage), max 8.** Now it's a mini-shield that blocks one attack completely (up to 8 damage). Useful against any enemy.

**Recommended: Absorb next hit up to 8 damage.** Universal defense option.

---

## Summary of Changes

| Mechanic | Before | After | Impact |
|----------|--------|-------|--------|
| **Scout** | 1 AP, draw 1 | 1 AP, **draw 2** | No longer a dead draw |
| **Empower** | 1 AP, +30% | 1 AP, **+50%** | Worth the setup |
| **Double Strike** | 2 AP, 2×60% | 2 AP, **2×100%** | Enables burst combos |
| **Thorns** | 2 AP, 6 block + 2 reflect | **1 AP**, 6 block + **3** reflect | Playable at 1 AP |
| **Recycle** | 1 AP, cycle 1 | **0 AP**, cycle 1 | Free hand filter |
| **Focus** | 1 AP, min 1.3x | **REMOVE** (merge into Empower) | One buff mechanic is enough |
| **Foresight** | 1 AP, reveal 2 | **0 AP**, reveal 2 + **draw 1** | Information + card advantage |
| **Overclock** | 2 AP, 2x, -1 draw | 2 AP, 2x, **no penalty** | Downside is the 2 AP cost |
| **Fortify** | 2 AP, 5 persistent | 2 AP, **7 persistent** | Clearly better than 2× Block |
| **Overheal** | 2 AP, 9 (1.5x if <50%) | 2 AP, **10 (2x if <50%)** | Real emergency shield |
| **Immunity** | 1 AP, absorb status | 1 AP, **absorb hit up to 8** | Useful against any enemy |

**0 AP cards after change: Quicken, Recycle, Foresight** — three free actions that reward answering quizzes correctly without spending AP. This creates exciting "bonus play" moments.

---

## Files Affected

| File | Change |
|------|--------|
| `src/data/mechanics.ts` | Update base values, AP costs, descriptions for 11 mechanics. Remove Focus. |
| `src/data/balance.ts` | Update any related constants |
| `src/services/cardEffectResolver.ts` | Update Double Strike to 100%, Immunity to damage absorb, Thorns reflect value |
| `src/services/cardDescriptionService.ts` | Update descriptions |
| `docs/GAME_DESIGN.md` | Update mechanic table and descriptions |

## Acceptance Criteria

- [ ] No "dead draw" cards — every mechanic is worth playing in at least some situations
- [ ] Scout draws 2, making it a real cycling tool
- [ ] Three 0-AP cards (Quicken, Recycle, Foresight) create exciting free-play moments
- [ ] Double Strike enables massive burst (2 × Heavy Strike = 40 damage)
- [ ] Focus removed, Empower buffed to +50%
- [ ] Typecheck passes, all mechanic descriptions updated
- [ ] Playtested: verify no mechanic is strictly dominated by alternatives
