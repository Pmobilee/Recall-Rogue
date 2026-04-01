# Fun & Engagement Playtest — BATCH-2026-04-01-003
**Date:** 2026-04-01
**Tester:** Claude Sonnet 4.6 (LLM agent)
**Retry of:** BATCH-2026-04-01-003 (prior run exhausted tool calls on rest room)
**Method:** Scenario loader (combat-basic ×2, combat-elite ×1)

---

## Session Summary

| Encounter | Enemy | Result | Player HP End | Turns |
|---|---|---|---|---|
| 1 | Page Flutter (basic) | Victory | 93/100 | 3 |
| 2 | Page Flutter (basic) | Victory | 100/100 | 3 |
| 3 | The Final Lesson (elite) | Victory | 79/80 | 3 |

All 3 encounters cleared. No deaths.

---

## Encounter 1 — Page Flutter (Basic)

**Setup:** 100HP, 3 AP, hand: 3×Strike(8), 2×Block(6). Enemy 23HP, intent: Attack 3.

**Narrative:**
The Page Flutter opened with a swooping strike intent — low-stakes but enough to keep me honest. I went in swinging with 3 quick Strikes, expecting ~24 damage but only got 12 (enemy landed at 11HP). Something is clearly dampening damage at mastery 0 and tier 1 — the cards feel weaker than their numbers suggest. This created an unexpected second-wind tension: I had to play another two rounds to close out a 23HP enemy with three 8-damage strikes. The Foresight card (0-cost draw) on turn 2 was a pleasant surprise — it ballooned my hand from 5 to 8 cards and introduced a Block that absorbed most of turn 2's incoming attack. The encounter stretched to 3 turns but felt appropriately measured for a tutorial-tier enemy.

**Key observations:**
- 3× Strike (base 8) only dealt ~12 total vs 23HP enemy — effective damage per quick strike ~4
- Foresight hand expansion felt impactful and rewarding
- Block from iron_shield wasn't active yet (encounter 1 uses basic preset, no relics)

---

## Encounter 2 — Page Flutter (Basic, Charge Testing)

**Setup:** 100HP, fresh run. Enemy 21HP. Same enemy, intentionally tested charge modes.

**Narrative:**
This encounter I deliberately varied my play modes to measure the charge differential. Charge-correct Strike dealt 8 damage (vs quick Strike's 4) — confirming a 2× bonus at mastery 0, rather than the documented 1.5×. Charge also cost 2 AP instead of 1, making it feel expensive on a 3 AP budget. The charge-wrong fizzle (answered incorrectly on purpose) dealt 4 damage — same as quick play, which contradicts the 0.25× fizzle spec (should be ~2). The damage numbers suggest either the ratios differ from docs at mastery 0, or there's a floor preventing fizzle from going below quick-play value.

The encounter itself felt clean and readable. Drawing 7 cards turn 2 (after Foresight + end-of-turn draw) gave a satisfying sense of abundance. Finished without taking any damage by stacking blocks while enemy was low.

**Key observations:**
- Charge-correct: 2× effective damage vs quick (expected 1.5×)
- Charge-wrong fizzle: same as quick play, NOT the expected 0.25× — possible floor behavior
- Batching multiple quickPlayCard() calls in same JS frame only processes one — sequential calls required

---

## Encounter 3 — The Final Lesson (Elite)

**Setup:** 80HP start (preset), relics: whetstone + iron_shield. Enemy 68HP, opens with Weakness debuff (2 stacks, 2 turns).

**Narrative:**
The Final Lesson felt like a meaningful difficulty step up. Its opening move was "Forgotten Lore" — applying Weakness before attacking. This forced me to think: burn my big cards NOW before debuff lands, or hold and accept reduced damage? I chose aggression, leading with a charged Heavy Strike that dealt **25 damage** in one blow (base 20, whetstone bonus). The strategic depth here was genuine — the debuff-first pattern creates a real tension between playing immediately at full power vs. trying to block/counter.

Turn 2 under Weakness still landed another charged Heavy Strike for 21 damage (about 84% of full power — weakness appeared to apply ~15-16% reduction). The iron_shield relic consistently added 5 block at start of each enemy turn, which meaningfully absorbed the 2-damage attacks and kept me near full health. The encounter concluded on turn 3 with a final charged Heavy Strike — clean, decisive, satisfying.

The elite fight felt noticeably more textured than the basic encounters: the debuff telegraphing created forward-planning, the higher HP required multi-turn commitment, and the relic synergy (whetstone boosting attacks, iron_shield providing passive defense) made the loadout feel cohesive.

**Key observations:**
- Heavy Strike charged-correct: 25 damage (vs base 20) — whetstone adding ~5
- Weakness reduced damage by ~15-16%, subtle but noticeable
- iron_shield: +5 block per enemy turn — very consistent, felt reliable
- Foresight on turn 2 drew Heavy Strike from discard/deck — clutch timing
- Enemy "Judgement" telegraph added narrative flavor without mechanical complexity

---

## Objective Checklist (O-FE1–5)

| ID | Objective | Pass/Fail | Notes |
|---|---|---|---|
| O-FE1 | Combat resolves without softlock or infinite loop | PASS | All 3 encounters completed cleanly |
| O-FE2 | Enemy intent telegraphing is legible before player acts | PASS | Debuff/attack intents clearly labeled in state |
| O-FE3 | Charge play creates meaningful choice vs quick play | PASS | 2× damage reward for charge-correct is felt |
| O-FE4 | Relics affect combat in observable ways | PASS | Whetstone +dmg and iron_shield +block both verified |
| O-FE5 | Encounters complete in reasonable turn counts | PASS | All done in 3 turns; no attrition grind |

---

## Subjective Ratings (S-FE1–8, scale 1–5)

| ID | Dimension | Score | Rationale |
|---|---|---|---|
| S-FE1 | Turn-to-turn decision quality | 3/5 | Basic encounters are too simple — strike/block with obvious plays. Elite had real decisions. |
| S-FE2 | Card variety feel | 3/5 | Hand often felt Strike-heavy. Multi-hit and Lifetap never got used — more variety would help. |
| S-FE3 | Damage feedback clarity | 2/5 | Damage numbers feel inconsistent with card values. 3×Strike(8) dealing 12 total is confusing without tooltip. |
| S-FE4 | Pacing / flow | 4/5 | 3-turn fights feel snappy. No drag. Reward screen transition was instant. |
| S-FE5 | Relic synergy satisfaction | 4/5 | Whetstone + iron_shield is a compelling duo. Shield block felt protective, whetstone bonus felt tangible. |
| S-FE6 | Elite enemy design interest | 4/5 | "The Final Lesson" debuff-first pattern is thematically fun (learning = facing what you don't know). |
| S-FE7 | Knowledge/quiz integration | 3/5 | Facts are interesting (Barbegal mill, Jack Kilby, Heinrich Hertz) but the charge mechanic is disconnected from actual answering in bot mode — need real quiz flow to rate properly. |
| S-FE8 | Overall fun | 3/5 | Functional and clean. Basic encounters feel mechanical; the elite adds flavor. Needs more card diversity in starting hand. |

**Average: 3.25/5**

---

## Issues & Anomalies

| Severity | Issue | Details |
|---|---|---|
| HIGH | Damage numbers don't match card values | 3×Strike(8) = 12 damage total, not 24. Quick strike effectively deals ~4 not 8. Mastery 0 scaling needs tooltip/explanation. |
| MEDIUM | Fizzle damage = Quick damage | Charge-wrong (0.25× spec) dealt same as quick play (1.0×). Either floor behavior or spec deviation. |
| MEDIUM | Charge-correct = 2× not 1.5× | At mastery 0, charge-correct multiplier appears to be 2.0× not 1.5×. May be intended given no mastery bonus. |
| LOW | Batched JS calls process only 1 | `quickPlayCard(0); quickPlayCard(0)` in same evaluate() only processes first call. Not a game bug but worth noting for test tooling. |
| LOW | console errors (33 total) | Phaser `blendModes` null error fires repeatedly. Not game-breaking but noisy. |
| INFO | Multi-hit / Lifetap never played | 7 cards drawn across 3 encounters, only Strike/Block/Foresight/HeavyStrike were useful. Felt like dead draws. |

---

## Comparison vs BATCH-001/002

- **Stability:** Scenario loader worked perfectly — no map/rest room bugs encountered (previous runs had selectMapNode failures). This approach is strictly better for automated testing.
- **Elite encounter:** First time running the elite in a completed batch. "The Final Lesson" significantly more engaging than Page Flutter — adds needed depth.
- **Flow:** 3 encounters completed in ~25 tool calls vs previous batches timing out. Efficiency improvement confirmed.
- **Damage confusion:** Same issue observed in prior batches — the gap between card `baseEffectValue` and actual damage dealt remains unexplained without in-game tooltips.

---

## Recommendations

1. **Damage tooltip or formula display** — Players will be confused when a Strike(8) card visually deals 4. Even a small "×0.5 quick" indicator would help.
2. **Verify fizzle floor** — Charge-wrong should feel punishing (0.25× spec) but currently feels identical to quick play. If this is intentional as a floor, document it.
3. **Basic encounter hand diversity** — Starting hand of 3× identical Strike + 2× Block is flat. Even one non-strike attack card in the starter deck would add decisions.
4. **The Final Lesson is a keeper** — The debuff-before-attack pattern creates genuine planning. Consider more elites with this "anticipatory threat" design.
5. **Real quiz flow needed** — Bot mode bypasses the actual answering experience. A semi-manual playtest where a human answers trivia is needed to rate S-FE7 properly.
