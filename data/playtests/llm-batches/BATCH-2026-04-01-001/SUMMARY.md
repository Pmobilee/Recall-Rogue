# Playtest Batch Summary — BATCH-2026-04-01-001
**Date**: 2026-04-01 | **Testers**: 4 | **Domain**: general_knowledge | **Runs**: 3 encounters each

## Overall Verdict: ISSUES

All 4 testers reported ISSUES. One critical bug (reward room crash) blocks normal gameplay progression. Core combat loop praised by all testers as genuinely fun and well-designed.

---

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | ISSUES | 0 | 2 | 3 | 3 |
| Balance Curve | ISSUES | 0 | 2 | 4 | 2 |
| Fun/Engagement | ISSUES | 1 | 3 | 3 | 0 |
| Study Temple | ISSUES | 0 | 1 | 1 | 2 |

**Totals**: 1 Critical, 8 High, 11 Medium, 7 Low

---

## Cross-Tester Insights

### CONVERGING (found by 2+ testers — high confidence)

- **[CRITICAL] Reward room crash / blank screen** — Fun tester hit blank screen with Phaser `blendModes` null reference after every combat. Balance tester hit `acceptReward()` returning `{ok: false}` with reward screen stuck on gold step. **This blocks ALL normal progression.** Players cannot collect card rewards or advance after combat.

- **[HIGH] Floor 1 enemies deal trivial damage** — Balance tester measured all 3 enemies dealing exactly 2 dmg/turn. Fun tester took 0 damage across all encounters. Floor 1 has zero tension. Both testers independently flagged this as the primary balance problem.

- **[HIGH] Combat too short (2 turns)** — Balance tester measured all combats at 2 turns (target: 3-8). Fun tester confirmed 1-2 turn kills on standard enemies. Starting deck is too efficient against floor 1 HP pools.

- **[HIGH] Fact repetition / pool diversity** — Quiz tester found same fact appearing 6 times in one 10-card hand. Balance tester's encounters used narrow fact pools. Study tester found duplicate questions in a 3-card session. Fact deduplication has gaps across multiple systems.

- **[MEDIUM] Distractor quality issues** — Quiz tester flagged Korean "g/k" artifact, self-answering nanotechnology question. Study tester flagged "vandalism" as distractor for a "which general" question, "three" as distractor for a year question. Distractor selection has blind spots in both general pool and curated decks.

### SOLO (found by 1 tester — needs corroboration)

- **[HIGH] Cognate language questions trivially easy** — Quiz tester only. Czech "ironie"→"irony", German "Argument"→"argument" give free 1.5x multipliers to English speakers. Needs difficulty analysis across all language decks.

- **[HIGH] No Chain Momentum visual feedback** — Fun tester only. Mechanic fires silently. Player can't learn to plan around it.

- **[HIGH] Card text unreadable on reward cards** — Fun tester only. Description areas render as pure black.

- **[MEDIUM] `getCombatState().playerHp` returns undefined** — Balance tester only. API gap that complicates automated testing.

- **[MEDIUM] `getScreen()` desyncs from Phaser state** — Balance tester only. Makes automated navigation unreliable.

- **[MEDIUM] Study API (`startStudy`/`getStudyCard`/`gradeCard`) targets wrong DOM** — Study tester only. API looks for StudySession elements but restStudy renders StudyQuizOverlay. SM-2 scheduling untestable via current API.

- **[MEDIUM] Fizzle block value higher than expected** — Balance tester measured 3 block from 6-block card at fizzle (expected 1.5 at 0.25x). Either fizzle ratio isn't 0.25x or mastery modifiers apply.

---

## All Issues by Severity

### CRITICAL (1)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| C-1 | Reward room crash | Fun, Balance | Post-combat reward screen renders blank (Phaser blendModes null reference). `acceptReward()` fails. Players cannot progress after combat. **Run-ending bug.** |

### HIGH (8)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| H-1 | Floor 1 enemy damage too low | Balance, Fun | All floor 1 enemies deal 2 dmg/turn. Single Block card negates entire turn. Zero tension. |
| H-2 | Combat too short | Balance, Fun | All combats end in 2 turns. Target is 3-8. Starting deck too efficient vs floor 1 HP. |
| H-3 | Extreme fact repetition in pools | Quiz | Same fact (keyboard/punched-cards) appeared 6x in one 10-card hand across combat-scholar scenario. |
| H-4 | Cognate language questions trivially easy | Quiz | Czech/German/French cognates give English speakers free 1.5x with zero knowledge. |
| H-5 | No Chain Momentum visual feedback | Fun | Core mechanic fires silently. Player can't learn or plan around it. |
| H-6 | Card text unreadable on reward cards | Fun | Description areas are pure black. Stats only visible on hover. |
| H-7 | Quick Play damage inconsistency | Fun | Strike dealt 3 dmg in one instance, 8 in another. No visible modifier explanation. |
| H-8 | Duplicate question in study session | Study | Same Hannibal Barca question appeared as Q2 and Q3 in a 3-card session. |

### MEDIUM (11)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| M-1 | Korean distractor artifact "g/k" | Quiz | Not a plausible word meaning — romanization artifact in deck data. |
| M-2 | Self-answering nanotechnology question | Quiz | "nano" in question + "Nanomedicine" as answer = trivially guessable. |
| M-3 | factAnswer brace markers in raw data | Quiz | `{13}`, `{1990}`, `{405}` in getCombatState hand data. OK in quiz UI but risky if surfaced elsewhere. |
| M-4 | `getCombatState().playerHp` undefined | Balance | API gap — must use getRunState() to track player HP. |
| M-5 | `getScreen()` desyncs from Phaser | Balance | Reports "rewardRoom" while visual shows dungeonMap. |
| M-6 | Fizzle block value mismatch | Balance | 6-block card at fizzle gave 3 (expected 1.5 at 0.25x). |
| M-7 | Study API targets wrong DOM | Study | `startStudy`/`getStudyCard`/`gradeCard` look for StudySession elements; restStudy uses StudyQuizOverlay. |
| M-8 | No enemy death animation | Fun | Combat ends with instant jump to reward room. No victory fanfare. |
| M-9 | Enemy presence weak | Fun | Text label + tiny sprite. Not visually threatening. |
| M-10 | Mastery level-up silent | Fun | Cards upgrade mid-combat with no announcement. Player would miss it. |
| M-11 | Poor study distractors | Study | "vandalism" for a generals question, "three" for a year question. |

### LOW (7)

| # | Issue | Source | Description |
|---|-------|--------|-------------|
| L-1 | Japanese kanji distractor phrasing mismatch | Quiz | Verbose distractor vs terse correct answer. |
| L-2 | Tech-topic concentration in GK pool | Quiz | 5/8 unique GK facts are computing-related. |
| L-3 | French over-represented in language pool | Quiz | 5+ French facts vs 1-2 for other languages. |
| L-4 | Gold reward rate may be low | Balance | 10g per encounter, 30g after 3 fights. |
| L-5 | navigate() workaround bypasses rewards | Balance | Deck growth testing invalid for this session. |
| L-6 | No scheduling feedback in study | Study | No "next review in X days" after answering. |
| L-7 | "Oceania" as smallest continent | Fun | Questionable factual accuracy — usually "Australia." |

---

## What's Working Well

All testers independently praised these aspects:

1. **Core combat decision loop** — Quick vs Charge is a genuinely interesting AP tradeoff every turn (Fun: 4/5, Balance: 3/5 agency)
2. **Quiz integration feels natural** — "Power amplification, not interruption" (Fun: 4/5). Commit-before-reveal creates real retrieval practice.
3. **Card art and visual identity** — Color-coded borders, pixel art, chain theme colors all communicate well at a glance
4. **Knowledge chain thematic coherence** — Tech questions appearing together felt like "testing a domain of understanding" (Fun highlight)
5. **Elite encounter design** — "The Final Lesson" with buff/barrage/heal pattern created genuine urgency and a satisfying 3-turn arc
6. **Educational content quality** — Rome deck facts are well-researched. Language vocab questions are genuinely educational (when not cognates)
7. **Mastery progression** — Cards leveling up mid-run provides tangible power growth

---

## Recommendations (Priority Order)

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| 1 | **Fix reward room crash** (Phaser blendModes null ref) | Unblocks ALL normal gameplay | Medium |
| 2 | **Increase floor 1 enemy damage** to 5-10 per turn | Restores tension, extends combat to 3-5 turns | Low |
| 3 | **Fix fact deduplication** — same fact should never appear 2+ times in one hand | Core quiz quality | Medium |
| 4 | **Add floating damage numbers** in combat | Players can't see what's happening without them | Medium |
| 5 | **Add Chain Momentum visual indicator** | Core mechanic is invisible | Low |
| 6 | **Filter trivial cognate questions** (Levenshtein < 3) | Language deck difficulty integrity | Medium |
| 7 | **Fix Study API DOM targeting** | Enables automated SM-2 testing | Low |
| 8 | **Fix Korean "g/k" distractor artifact** | Data quality | Low |
| 9 | **Add enemy death animation** | Polish / game feel | Medium |
| 10 | **Add mastery level-up announcement** | Player feedback | Low |

---

## Next Steps

- Run `/balance-sim --runs 1000` to get statistical confirmation of the floor 1 damage/HP imbalance
- Run `/visual-inspect` on combat screen to verify damage number rendering and chain UI
- Fix reward room crash (C-1) then re-run this playtest batch to get clean progression data
- Run `/inspect changed` after balance values are modified
- Investigate the fizzle ratio discrepancy (M-6) — check `cardEffectResolver.ts` for actual FIZZLE_EFFECT_RATIO
