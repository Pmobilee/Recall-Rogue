# Playtest Batch Summary — BATCH-2026-04-15-001
**Date**: 2026-04-15 | **Testers**: 5 | **Domain**: mixed | **Runs**: 3 per tester | **Floors**: 2 target

---

## Overall Verdict: ISSUES

No testers reported FAIL. All 5 reported ISSUES. 1 CRITICAL bug (combat softlock), 4 HIGH issues, several MEDIUM/LOW.

---

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Full Run Bug Hunter | ISSUES | 1 | 2 | 2 | 2 |
| Balance Curve | ISSUES | 0 | 0 | 1 | 2 |
| Fun/Engagement | ISSUES | 0 | 2 | 1 | 0 |
| Quiz Quality | ISSUES | 0 | 2 | 2 | 2 |
| Study Temple | PASS | 0 | 0 | 0 | 2 |

---

## DIFFICULTY PER FLOOR — Primary User Focus

### Floor 1 (Shallow Depths)

| Enemy | HP | Turns | Player HP Lost |
|-------|----|-------|----------------|
| Pop Quiz | 29 | ~3 | 0 HP |
| Mold Puff | 36 | ~6 | 13 HP |
| Pop Quiz (scaled) | 47 | ~10 | 5 HP |
| Page Flutter | 29 | 4 | 17 HP |
| Ink Slug (floor 2 node) | 51 | 9 | 18 HP |

**Average HP loss per regular combat**: ~10–17 HP (out of 100)
**Overall difficulty**: **Easy-Medium** ✅ Appropriate for early floors.

Enemy HP scales naturally within the floor (29 → 36 → 47). Enemies have distinct mechanics: Pop Quiz is a straightforward intro, Mold Puff applies poison pressure, Page Flutter strips block. Good variety.

**Concern**: A single Golem-type enemy at row 5 dealt 27 HP damage across 9 turns, which is a sudden spike. Not dangerous but longer than intended.

### Floor 2 (Deep Caverns)

| Enemy | HP | Turns | Player HP Lost |
|-------|----|-------|----------------|
| The Burnout | 78 | ~8 | 0 (chain-trivialized) |
| Overdue Golem | 71 | ~9 | 27 HP |

**Floor jump at entrance**: Floor 1 starts at 29 HP enemies; Floor 2 starts at 78 HP enemies — a **2.7× spike** at the floor boundary.

**Chain multiplier distortion**: By floor 2, accumulated chains can reach 3.5× ("Azure"), producing 94 damage strikes and 85-point block cards. This **trivializes floor 2 difficulty** for players who built a chain. The difficulty experience varies wildly based on chain accumulation.

**Overall difficulty**: Nominally **Hard** — but **actually variable (Easy to Hard)** depending on chain state.

### Difficulty Curve Assessment

- ✅ Within-floor scaling: Gradual, well-paced (enemies HP ramps 29 → 47 on floor 1)
- ⚠️ Floor-to-floor jump: Sharp spike (29 → 78 HP) feels steep at the transition point
- ⚠️ Chain multiplier skew: 3.5× chain by floor 2 breaks the difficulty curve for experienced players
- ✅ HP pressure: Meaningful on floor 1 (~35 HP lost over full floor). Floor 2 data limited due to softlock.

---

## BOSS DIFFICULTY — Primary User Focus

### The Curriculum (Floor 1 Boss)

| Stat | Value |
|------|-------|
| HP | 163 |
| Regular enemy HP range | 29–47 |
| HP multiplier vs regular | ~4–5× |
| Turns to defeat | ~11 |
| Player HP lost to boss | 17 HP |
| Difficulty rating | **6/10** |

**Moveset**: Shard storm (multi-hit, 3× 8 total damage), Prismatic slash (11–13 single), Crystal barrier (defense), Final Exam: Prismatic barrage (phase 2 upgrade).

**Verdict**: Well-designed. The boss felt genuinely different from regular enemies — multi-hit attacks require block management, the Crystal barrier creates tactical timing decisions, and the "Final Exam" phase naming is excellent. At 6/10 difficulty the boss is challenging but not punishing; appropriate for a floor 1 boss.

**Both testers who encountered it** agreed the boss felt fair and satisfying. The thematic theming (The Curriculum / Final Exam) is the game's best design work.

### Floor 2 Boss

**Not reached** — run softlocked on a combat before the floor 2 boss. No data.

---

## MYSTERY ROOM QUALITY — Primary User Focus

**In-run encounters**: 0 (mystery nodes were visible on the map but never became available on the paths taken by either run)

**Source file review** (from `/public/data/narratives/mystery-pools/`):

| Event | Clarity | Thematic Quality | Notes |
|-------|---------|-----------------|-------|
| flashcard_merchant | 4/5 | 5/5 | "Knowledge has its price. The merchant knows yours." — strong voice |
| riddle_stranger | 5/5 | 5/5 | Best prose in the game. Specific, strange, memorable. |
| wrong_answer_museum | — | — | Untested, strong name |
| burning_library | — | — | Untested, strong name |

**Writing quality: 5/5** — the mystery event prose that was reviewed from source files is outstanding. It has a distinctive voice, avoids all AI tells, and matches the dungeon-as-examiner thematic identity.

**Critical finding**: **Mystery rooms appear to be functionally unreachable** on default paths. Both playtest runs traversed all of floor 1 without a mystery room ever becoming selectable. If mystery rooms only appear off specific branching paths that the default navigation never reaches, players may go entire runs without encountering them.

**Recommendation**: Guarantee at least 1 mystery room node is reachable per floor by placing it on the critical path or ensuring branch connections always include one.

---

## SHOP QUALITY — Primary User Focus

### Shop Visit Log (Floor 4, 70 gold available)

| Item | Type | Base Price | Notes |
|------|------|-----------|-------|
| Merchant's Favor | Relic | 40g | +1 card, +1 relic choice in future shops |
| Thoughtform | Relic | 48g | All correct → +1 perm Strength |
| Scavenger's Eye | Relic | 40g | Exhausting card draws 1 from pile |
| Empower | Card | 40g | Next card +30% damage |
| Strike+ | Card | 44g | Deal 4 damage |
| Immunity | Card | 44g → ~15g (haggled) | Absorb next hit up to 5 |
| Card Removal | Service | 50g | Remove a card permanently |
| Card Transform | Service | 35g | Transform a card |

**Gold economy**: 70g after 4 combats + 2 treasures. Most relics (40–48g) are affordable for 1 purchase.

**Haggle system** ✅ EXCELLENT:
- Every purchasable item has a "Haggle" button that poses a real knowledge question
- Correct answer → 30% price reduction
- Immunity card: 22g → ~15g after haggling
- This is the game's most elegant crossover of knowledge mechanic and economy

**Selection usefulness**: High. Relics offer meaningful strategic choices. Card Removal and Card Transform services add deckbuilding depth.

**Minor issue**: EMPOWER card description shows "+30-5% damage" — formatting bug.

---

## All Issues by Severity

### CRITICAL

**BUG-001 — Combat Stuck on 0 HP Enemy (Softlock)**
- **Tester**: Full Run Bug Hunter
- **Screen**: Combat, Floor 2
- **What happens**: Enemy dies with `poison(5, 98t)` status active. Enemy shows 0/78 HP. Combat loop does not resolve. End Turn button disappears. Player is completely stuck — no way to progress.
- **Root cause hypothesis**: End condition checks HP kill but doesn't handle "already at 0 HP with pending status ticks." The 98-turn poison duration may be an overflow/sentinel value.
- **Impact**: Complete run softlock, requires browser reload.

---

### HIGH

**BUG-002 — selectDomain('mixed') API Fails on deckSelectionHub**
- **Testers**: Full Run Bug Hunter
- **What happens**: `rrPlay.selectDomain('mixed')` returns `{ok:false}` — the API is looking for a different selector than what's rendered in the DOM (`.panel.panel--trivia` is present but not found).
- **Impact**: All automated playtest flows that call `selectDomain` break at run start. Workaround: direct DOM click.

**BUG-003 — CombatScene Runs in Background Throughout Entire Run (FPS Regression)**
- **Tester**: Full Run Bug Hunter
- **What happens**: CombatScene continues rendering after combat ends. FPS alerts fire from CombatScene even while in the shop, rest room, and dungeon map. Degraded to 11 FPS at times during non-combat screens. CombatScene had been running for 1200+ seconds continuously by floor 2.
- **Impact**: Performance degradation throughout the run; may cause battery drain and mobile performance issues.

**QUIZ-001 — Broken Grammar: Mochi Question Template Substitution Failure**
- **Tester**: Quiz Quality
- **Fact ID**: `food_cuisine-mochi-glutinous-rice-cake`
- **Question**: "What is the term for a is used to make mochi?" — malformed template placeholder not substituted.
- **Impact**: Broken question visible to players in combat.

**QUIZ-002 — Era-Mismatched Distractors: The Liberator Question**
- **Tester**: Quiz Quality
- **Fact ID**: `apush_p4_garrison_liberator`
- **Issue**: Asks about an 1831 newspaper. All 3 distractors are 1960s–70s documents (Pentagon Papers, Port Huron Statement, Silent Spring). Any player with period awareness trivially eliminates all wrong answers.
- **Impact**: Trivially easy question for anyone with basic US history knowledge.

---

### MEDIUM

**BALANCE-001 — Combat Length Exceeds 3–8 Turn Target for Floor 2+ Enemies**
- **Testers**: Balance Curve (converging), Full Run Bug Hunter
- Floor 2+ combats consistently ran 9+ turns (target: 3–8).
- Root cause: AP bottleneck (charge costs 2 AP, max 5 AP/turn → max 2 charge plays per turn → ~10–12 damage/turn vs 51–71 HP enemies).
- Enemies with defend-then-attack patterns add effective buffer turns.

**FUN-001 — Charge Play Cost Not Communicated Upfront**
- **Tester**: Fun/Engagement
- Charge plays costing 2 AP is never surfaced in the tutorial or UI. Players discover it as a sudden rejection ("Not enough AP").
- Rating: HIGH friction for new players.

**MYSTERY-001 — Mystery Rooms Unreachable on Default Path**
- **Testers**: Full Run Bug Hunter (confirmed both runs)
- Both test runs traversed floor 1 completely without ever having a mystery room available to select.
- Mystery room content is strong; the routing problem means players may never see it.

**QUIZ-003 — Free Silver Answer Label Echoes Question Phrasing (Hint Leakage)**
- **Tester**: Quiz Quality
- Fact ID: `apush_p6_free_silver_ratio`. Answer contains phrasing from the question, creating a subtle hint.

---

### LOW

**BALANCE-002 — AP System Silently Blocks "Incorrect Charge" Scenario**
- Incorrect answers have no observable cost in practice because the AP check rejects charge attempts before the quiz penalty fires.
- The quick-vs-charge risk/reward tradeoff is weaker than intended.

**BALANCE-003 — Shield-Heavy Draw Order Extends Combat Length**
- Opening hands frequently contain 3–4 shields, 1–2 attacks. Extends combats by ~2 turns unnecessarily.

**BUG-004 — EMPOWER Card Description Shows "+30-5% damage" (Formatting Bug)**
- Should read "+30% damage" or a properly formatted range.

**BUG-006 — rewardRoom Sometimes Requires Two acceptReward Calls**
- First call accepts gold reward; second required for card pick. Minor; automated tests need to loop.

**BUG-007 — Floor Counter Shows "Floor 7" at Floor 2 Entry**
- Counter appears to track total rooms visited rather than dungeon floors.

**QUIZ-004 — Floor 1 Includes AP-Level Academic Content (Difficulty Mismatch)**
- Organic chemistry and AP US History Period 6 specifics appear on floor 1. May discourage early-run players.

**QUIZ-005 — Randomized Distractors Create Inconsistent Learning Signal**
- Same fact shows different distractor pools on each preview. Weakens "remember the wrong answers" learning reinforcement.

**STUDY-001 — getStudyCard() Returns answer:null (API Data Gap)**
- `getStudyCard().answer` and `.category` always return null (wrong testids for MCQ variant).
- Only affects automated testing scripts, not players.

**STUDY-002 — Tutorial Modal Overlaps Study Temple on First Encounter**
- Tutorial steps fire mid-session, stacking on top of the quiz card. Clears after dismissal.

---

## Cross-Tester Insights

| Signal | Testers | Finding |
|--------|---------|---------|
| [CONVERGING] Combat too long at floor 2+ | Balance + Fun + Full Run | 9-turn combats consistently. AP bottleneck is the core cause. |
| [CONVERGING] Chain multiplier distorts difficulty | Full Run + Fun | 3.5× chain by floor 2 trivializes enemy HP pools. |
| [CONVERGING] Charge cost not communicated | Fun + Balance | 2 AP for charge is confusing and limits the quiz-decision frequency. |
| [CONVERGING] Mystery rooms hard to reach | Full Run (×2 runs) | Both runs never saw a selectable mystery room on floor 1. |
| [SOLO] CombatScene FPS leak | Full Run only | Background rendering at 11 FPS during non-combat screens. |
| [SOLO] 0 HP softlock | Full Run only | Poison + 0 HP combat stuck state. Needs a targeted fix. |

---

## Standout Positives

These were noted unprompted by multiple testers — things that are working well:

1. **The Curriculum boss** — unique phase transitions, named mechanics ("Final Exam"), appropriately scaled. Both testers who saw it called it the best-designed element in the game.
2. **Haggle system** — universally praised as elegant. The knowledge quiz as a price-reduction mechanic is a seamless fusion of economy and learning.
3. **Atmospheric narration** — reactive narration ("Unblooded this deep" appearing because player took no damage) demonstrates a sophisticated system. The dungeon-voice prose is the game's best writing. Fun tester specifically noted the victory screen text: *"Knowledge is the light you carry. It does not get heavier — only brighter."*
4. **Enemy theming** — Bookmark Vine, The Curriculum, Thesis Construct, Mold Puff, The Burnout — each name and design communicates its dungeon-library identity immediately.
5. **Shop + Retreat/Delve** — both flagged as polished. The pixel art room for retreat/delve and the "65% odds if you die" risk framing are clean.
6. **Study Temple content quality** — Questions across history, science, geography, music. Domain-coherent distractors. Strong "textbook replacement" ambition visible.

---

## Recommendations (Priority Order)

1. **[CRITICAL] Fix 0 HP + active poison softlock** — Check the combat end condition to also resolve when `enemyHp <= 0` regardless of remaining status effect ticks. The 98-turn poison duration looks like an overflow value; add a sanity cap (e.g., max 20 turns).

2. **[HIGH] Fix `selectDomain` API** — The `rrPlay.selectDomain('mixed')` method can't find the Trivia Dungeon panel. Update the selector to match `.panel.panel--trivia` or whatever the current DOM element is.

3. **[HIGH] Fix CombatScene background rendering** — Pause or stop CombatScene rendering when transitioning out of combat (to shop, map, rest, reward). This is both a performance bug and a battery drain issue.

4. **[HIGH] Fix mochi question template substitution** — `food_cuisine-mochi-glutinous-rice-cake` has a broken `{variable}` placeholder that shipped unfilled. Fix the source fact.

5. **[MEDIUM] Guarantee mystery room reachability** — Place at least one mystery node on the critical path of floor 1 (or ensure all valid paths include one). Mystery content is strong; players shouldn't be able to miss it entirely.

6. **[MEDIUM] Address combat length for floors 2+** — Options: (a) reduce charge AP cost from 2→1 with quiz bonus making up the difference, (b) cap row 2–3 enemy HP at ~35–40, or (c) add an AP scaling mechanic so later floors give more AP. The 9-turn combats drag pacing.

7. **[MEDIUM] Communicate charge play cost upfront** — Add a one-line UI hint on the first charge play attempt ("Charge plays cost 2 AP — answer correctly for 1.5× damage").

8. **[LOW] Fix The Liberator distractor era mismatch** — Replace 1960s–70s distractors with 1820s–1840s period documents.

9. **[LOW] Fix EMPOWER card description** — "+30-5% damage" → correct format.

10. **[LOW] Fix floor counter** — "Floor 7" on floor 2 entry suggests counter tracks rooms, not floors.

---

## Next Steps

- `/balance-sim --runs 2000` to get statistical confirmation of the 9-turn combat length problem and chain multiplier scaling
- Fix BUG-001 (0 HP softlock) — targeted code check in combat end-condition logic
- Investigate mystery room map routing — check if branching probability guarantees at least one reachable mystery node per floor
- Re-run `/llm-playtest fullrun floors=3` after softlock fix to get floor 2 boss data
