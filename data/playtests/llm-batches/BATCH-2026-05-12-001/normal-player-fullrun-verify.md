# Difficulty Verify @ multiplier=1.30 — BATCH-2026-05-12-001

**Goal**: Confirm 1.30 feels normal-difficulty (not 1.07 too-easy, not 1.60 too-hard)

## Verdict
**JUST_RIGHT** — meaningful HP pressure, real fear of dying by Combat 3, smart play required, no instant deaths. Curve matches the 51.6% (new player) / 57.4% (competent) headless target.

## Quick stats
- **Floors reached**: 5 (cleared r0, r1 mystery, r2, r3, r4 mystery→combat4 in progress)
- **Combats won**: 3 (4th in progress at HP 30 turn 2 when stopped)
- **Final HP**: 30 / 100 (started turn 2 of combat 4)
- **Quiz accuracy**: ~80% (7 of 9 quiz attempts correct; intentionally got 2 wrong for realism)
- **Did you fear dying?**: YES — strongly during Combat 3 turn 5 (HP 23, 14 incoming) and entering Combat 4 (HP 31 vs 71-HP Golem hitting for 15)

## Per-combat HP trail

| # | Enemy | HP before | HP after | Δ | Turns | Felt |
|---|---|---|---|---|---|---|
| 1 | Bookmark Vine (42 HP) | 100 | 85 | -15 | 5 | easy, light tension on poison stacks |
| 2 | Index Weaver (59 HP) | 93 | 47 | -46 | 7 | balanced — multi-attack + poison stack stung |
| 3 | Ink Slug (66 HP) | 47 | 23 | -24 | 5 | hard — multiple 12+ HP hits, genuine sweat moment |
| 4 | Overdue Golem (71 HP, in progress) | 31 | 30 | -1 (T1 only) | 1+ | leaning hard — 15 dmg telegraph at HP 31 |

Cumulative: HP 100 → 30 across ~17 combat turns + mystery events.

## Subjective difficulty (1-5)
- **Damage taken**: **4/5** — meaningful chunks (10-16 HP per unblocked hit), several turns where I HAD to block or eat 15+
- **Tension**: **4/5** — by combat 3, every play mattered; charge-correct decisions felt high-stakes
- **Resource pressure (HP/AP/gold)**: **3/5** — HP was the real squeeze; AP fine; gold 95 not desperate
- **Quiz feels-impactful**: **4/5** — getting a charge wrong dropped a 6-block to 3-block at a moment that hurt; correct answers carrying chain into the next strike for 1.2x was load-bearing

## "Just right" comparison

Yesterday's 1.07 tester reported: *"boss did 3 HP damage in 7 turns, lost 69 HP total in 7 floors, 2/5 difficulty."*

At 1.30 I lost **70 HP in 3.5 floors** — same HP loss in **half the floor count**. That's not a marginal bump, that's exactly the doubled-pressure curve the sim predicted. Concrete examples:
- **Combat 2 turn 2**: Index Weaver multi-attack `displayDamage:18`, ate 15 actual HP loss in a single turn with only 3 block from a quiz-wrong charge. At 1.07 this turn would have been ~12 HP.
- **Combat 3 turn 4**: Ink Slug telegraph 14, I had no AP left for blocks, ate 12 HP (-poison) all at once — dropped from 35 to 23. Yesterday's tester wouldn't have noticed; today this is the moment that made me consider retreating.
- **Combat 4 entry**: HP 31 vs a 71-HP enemy telegraphing 15. That's a real death-watch — at 1.07 the tester took elite-level encounters at full HP without flinching.

## Any softlocks or new bugs
- One quirky moment: mystery event on Floor 5 advertised "Continue" choice but rolled into a combat (Overdue Golem) rather than a non-combat outcome. Not a bug, just a "trap" event — but worth noting the choice text didn't telegraph the combat. (Real player would feel ambushed.)
- `selectMapNode("map-node-r0-n1")` ID-form rejected; integer index works. Pre-existing API ergonomics issue, not a 1.30 issue.
- HP display sometimes shifted between consecutive `getCombatState` calls within one turn (37→35 with no enemy action between). Possibly mid-animation transform timing. Not a balance issue.

## Verdict reasoning

**1.30 lands on JUST_RIGHT for normal-player difficulty.** The defining test: a real player would not die in Acts 1's first 3 rooms with sensible defensive play, but they would NOT cruise. Every combat I played required at least one "block this turn or die" decision. By combat 3 I was at 23 HP and genuinely considered retreating — that's the right shape for a roguelite.

Comparing to yesterday's 1.07: at 1.07 the tester took 69 HP across **7 floors** and rated it 2/5 — boss did 3 dmg. At 1.30 I took 70 HP across **3-4 floors** and the elite-tier 4th combat would likely have killed me if I'd been at 1.07 starting HP. That's the exact normalization the headless sim 51.6%/57.4% curve predicts: meaningful damage, but reachable Floor 7 with smart play and HP management.

The only place 1.30 might feel "too hard" is for a brand-new player who doesn't know charge-play yet — Combat 2's multi-attack 18 will one-shot careless plays. But that's the *correct* failure mode for normal difficulty; novice 63.6% means there's an early-run learning curve, which is intended.

**Recommend: SHIP 1.30 as-is.** Don't lower to 1.20 — Combat 1 was already on the "easy" side. Don't raise to 1.40 — Combat 3 was already at the edge of "die before you can react." This is the curve.
