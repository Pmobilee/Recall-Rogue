# Full Run Bug Report — BATCH-2026-04-15-001
**Tester**: Full Run Bug Hunter | **Model**: claude-sonnet-4-6 | **Date**: 2026-04-15

---

## Run Summary
- **Floors attempted**: 2 (Floor 1 complete + Floor 2 partial)
- **Total rooms visited**: 10 (3 combats, 2 treasure, 1 shop, 1 rest, 1 boss, 1 special event, plus delve screen)
- **Room types visited**: combat(4), treasure(2), shop(1), rest(1), boss(1), special-event(1), retreat-or-delve(1)
- **Mystery rooms visited**: 0 (did not appear on chosen path)
- **Run outcome**: **STUCK** — softlock bug on Floor 2 first combat; enemy at 0 HP, combat loop did not resolve to reward room

**Floor 1 sequence**: Hub → triviaDungeon selection → onboarding → dungeonMap → combat(Pop Quiz) → reward → treasure → combat(Mold Puff) → reward → combat(Pop Quiz v2) → reward → treasure → shop → rest(meditate) → boss(The Curriculum) → special-event(Deck Thin) → retreatOrDelve → delve

**Floor 2 sequence**: dungeonMap(Deep Caverns) → combat(The Burnout) → **STUCK** at 0 HP

---

## Verdict: ISSUES

Multiple issues found including one **CRITICAL softlock** and one medium FPS regression. Core gameplay loop is functional and enjoyable. Room variety and visual quality are high.

---

## DIFFICULTY ASSESSMENT (User's Primary Focus)

### Floor 1 — Shallow Depths
| Combat | Enemy | Enemy HP | HP Lost | Turns |
|--------|-------|----------|---------|-------|
| Combat 1 | Pop Quiz | 29 | 0 HP | ~3 turns |
| Combat 2 | Mold Puff | 36 | 13 HP (100→87) | ~6 turns |
| Combat 3 | Pop Quiz (scaled) | 47 | 5 HP (87→95, healed) | ~10 turns |
| Boss | The Curriculum | 163 | 17 HP (100→83) | ~11 turns |

**Average HP loss per regular combat**: ~6 HP  
**Total HP lost floor 1**: ~35 HP (ended boss at 83/100, then healed to 91 via special event)  
**Overall floor difficulty**: **Easy-Medium**

Key observation: Enemies scale HP between rooms (29 → 36 → 47 HP on the same floor), which feels natural. Pop Quiz re-appears but at 47 HP (vs 29) — this shows scaling is working. The boss at 163 HP is a significant difficulty spike.

The poison mechanics on Mold Puff created genuine pressure with status effects stacking. The Pop Quiz at 47 HP with 15 displayDamage intent (up from 11 at 29 HP) shows attack scaling also works.

### Floor 2 — Deep Caverns
| Combat | Enemy | Enemy HP | HP Lost | Turns |
|--------|-------|----------|---------|-------|
| Combat 1 | The Burnout | **78** | ~1 HP (99→99) | ~8 turns |

**Floor 2 starting enemy HP: 78 vs Floor 1 starting enemy HP: 29 — that's 2.7× harder at the start of the floor.**

Player barely took damage (only 1 HP total) due to an extreme chain multiplier (3.5× "Azure" chain) that was pumping cards to 49/62/85 block values and 94 damage per strike. The difficulty gap would be much harder for a player without a chain built up.

**Overall floor 2 difficulty** (based on enemy HP scaling): **Hard** (but chain mechanics can trivialize it)

### Difficulty Curve Assessment
- **Floor 1 start → Floor 1 end**: Gradual ramp from 29→47 HP regular enemies, then 163 HP boss. Good pacing.
- **Floor 1 → Floor 2 jump**: 29 HP (floor 1 start) → 78 HP (floor 2 start) = **very sharp difficulty spike** between floors.
- **Chain multiplier skew**: By floor 2, the player had a 3.5× chain multiplier ("Azure") making cards absurdly powerful (85 block from a single block card). This likely masks the difficulty increase.
- **HP pressure**: Floor 1 provided meaningful pressure (lost 35 HP total). Floor 2 was easier due to chain stacking.

**Verdict**: Difficulty curve is good within each floor but the inter-floor jump is steep. The chain multiplier accumulation over a long run can trivialize floor 2 difficulty.

---

## BOSS DIFFICULTY REPORT

### Boss: The Curriculum (Floor 1)
- **HP**: 163 (vs 29-47 for regular floor 1 enemies)
- **Phase 1 moves**: 
  - Shard storm (multi-attack, 3 hits, ~8 total displayDamage)
  - Prismatic slash (single attack, 11-13 displayDamage)
  - Crystal barrier (defensive move)
- **Phase 2 moves** (triggered at ~50% HP?):
  - Final Exam: Prismatic barrage (appears to be upgraded slash)
- **Enemy status effects**: Susceptible to poison; accumulated 8+ stacks during fight
- **Difficulty rating**: 6/10
- **Is boss significantly harder than regular enemies?** Yes — 3-5× more HP, special moves, phase change
- **Did the boss feel fair?** Yes. Manageable once you understand the block-and-chip strategy. Poison synergy made it satisfying.
- **Turns to kill**: ~11 turns
- **HP lost to boss**: 17 HP (100 → 83)

The "Final Exam" phase name when the boss enters its final phase is a great thematic touch. The boss felt genuinely different from regular enemies due to multi-hit attacks and crystal barrier. The 163 HP felt proportionally correct for a floor boss.

---

## MYSTERY ROOM QUALITY

**NOT ENCOUNTERED IN-RUN** — the path chosen (combat → treasure → combat → combat → treasure → shop → rest → boss) did not include any mystery room nodes. Mystery rooms were visible on the map (? icons in rows 1 and 5) but were never unlocked by the chosen path's connections.

**Observation**: The player never had an available mystery room node on their path. This is worth investigating — if mystery rooms only appear off specific branching paths and the default path never forces one, players may go entire runs without seeing them.

**Mystery event content review (from source files)**:

The mystery event narrative text in `/public/data/narratives/mystery-pools/` is high quality. Sample events reviewed:

- **"flashcard_merchant"**: "The merchant's eyes glint with borrowed wisdom — every card a debt unpaid." / "Knowledge has its price. The merchant knows yours." — **Clarity: 4/5, Thematic: 5/5**. Excellent voice, avoids AI tells, fits dungeon setting.

- **"riddle_stranger"**: "The stranger has no face that you can hold in memory afterward. Only the question remains, persistent and needle-sharp." / "The stranger's riddles are not tests of intelligence. They are tests of what you are willing to admit you do not know." — **Clarity: 5/5, Thematic: 5/5**. Excellent prose. This is the best writing I saw — specific, strange, and memorable.

- **"wrong_answer_museum"**, **"burning_library"**, **"tutors_office"**: Not read but names suggest strong thematic alignment with the knowledge/dungeon concept.

**Assessment**: The mystery event writing quality is strong from the source files. The main concern is reachability — players may never see these events if their natural path doesn't unlock mystery nodes.

---

## SHOP QUALITY REPORT

### Shop Visit (Floor 4, gold: 70)
**Items in stock**:
| Item | Type | Price | Notes |
|------|------|-------|-------|
| Merchant's Favor | Relic | 40g | Shops offer +1 card, +1 relic choice |
| Thoughtform | Relic | 48g | When ALL cards charged correctly → +1 perm Strength |
| Scavenger's Eye | Relic | 40g | Exhausting a card draws 1 from pile |
| Empower | Card | 40g | Next card +30% damage (text showed "+30-5%" — minor display issue) |
| Strike+ | Card | 44g | Deal 4 damage |
| Immunity | Card | 44g → **22g** (haggled) | Absorb next hit up to 5 |
| Card Removal | Service | 50g | Remove a card permanently |
| Card Transform | Service | 35g | Transform a card |

**Gold at visit**: 70g  
**Are prices reasonable?** Yes — with 44-70g from 3 combats + 2 treasures, the player can comfortably afford 1-2 items. Prices feel well-calibrated.

**Haggling system** — WORKING:
1. Clicking a card showed a purchase modal with "Buy (22g)" and **"Haggle — correct: 30% off"** button
2. Haggle posed a real knowledge question: "What is the estimated global annual cost of Alzheimer's disease?" (US$500b / US$1t / US$100b)
3. Answering correctly (US$1 trillion) reduced the 22g price by 30% → paid **~15g**
4. Gold went from 70 → 55 (confirming ~15g final price)

The haggle system is excellent — it reinforces the knowledge mechanic in the economy layer. The "Leave the shop?" confirmation dialog when exiting with unspent gold is a nice UX touch.

**Minor issue**: The EMPOWER card description showed "+30-5% damage" — this looks like a display formatting bug (should probably be "+30% damage" or "+30±5% damage").

**Selection usefulness**: High. Relics are interesting strategic choices. Immunity card (bought) was immediately useful in the boss fight. Card Removal (50g) and Card Transform (35g) provide deck-building depth.

---

## BUGS FOUND

### CRITICAL

#### BUG-001 [CRITICAL] — Combat Stuck on 0 HP Enemy (Softlock)
- **Screen**: `combat` (Floor 2, vs The Burnout)
- **Action**: Enemy reached 0 HP (via combat damage + heavy poison stacks)
- **Expected**: Combat ends, transition to `rewardRoom`
- **Actual**: Combat screen persists indefinitely. Enemy shows 0/78 HP. "End turn" button disappears (game detects end-turn impossible). `acceptReward` returns "RewardRoomScene not active after 3s wait". No DOM button to progress. `__rrScenario.load('mystery_event')` and `load('post_tutorial')` could not override the stuck state.
- **Repro conditions**: Enemy had `poison(5, 98t)` — an extremely long-duration poison stack (98 turns). The enemy's HP reached 0 while the poison stack was still tracking 98 turns of remaining duration.
- **Hypothesis**: When HP ≤ 0 but poison still has `turnsRemaining > 0`, the combat end condition may be checking for a clean HP kill without accounting for "death from prior state." Alternatively the 98-turn duration is an overflow/sentinel value.
- **Impact**: Complete run softlock — player cannot progress or retreat. Requires reload.
- **Evidence**: Screenshot at `/tmp/rr-docker-visual/.../f2-stuck-combat.rr.jpg` — shows enemy sprite at 0/78 HP, hand of 4 cards with inflated values, no end-turn button visible.

### HIGH

#### BUG-002 [HIGH] — `selectDomain('mixed')` API Fails on deckSelectionHub
- **Screen**: `deckSelectionHub`
- **Action**: `rrPlay.selectDomain('mixed')` called as instructed in the playtest brief
- **Expected**: Selects the Trivia Dungeon domain and advances to dungeon map
- **Actual**: Returns `{ok: false, message: "Trivia Dungeon panel not found on deckSelectionHub"}`. The panel is visible in the DOM as `.panel.panel--trivia`.
- **Workaround**: Direct DOM click on `.panel.panel--trivia` works fine.
- **Impact**: Any automated playtest that calls `selectDomain('mixed')` will fail at this step. The API appears to be looking for a different selector than what's rendered.

#### BUG-003 [HIGH] — Persistent Low FPS in CombatScene After Combat Ends
- **Screen**: All screens (FPS alert fires even in dungeonMap, rewardRoom, shop)
- **Action**: Ongoing throughout run
- **Expected**: CombatScene should pause or stop rendering when not active
- **Actual**: FPS alerts continued firing from CombatScene for 1200+ seconds, including from 11 fps to 38 fps, during screens that are not combat (map, shop, rest, reward). The FPS alert reads: `"Low FPS alert: 11 fps in CombatScene for 64s"` even while in the shop.
- **Impact**: CombatScene appears to be running in the background throughout the entire run, causing continuous CPU/GPU load. By floor 2 the CombatScene had been running for 1200+ seconds continuously.
- **Note**: This may be intentional for background rendering, but the FPS degrading to 11 fps suggests a resource leak or missing sleep/pause when not active.

### MEDIUM

#### BUG-004 [MEDIUM] — EMPOWER Card Description Shows "+30-5% damage"
- **Screen**: `shopRoom`
- **Action**: Viewed shop inventory
- **Expected**: Clear damage modifier text like "+30% damage" or "+25-35% damage"
- **Actual**: Card showed "+30-5% damage" — appears to be a formatting bug where a range calculation is not rendering correctly
- **Impact**: Minor clarity issue, could confuse players about the card's actual power

#### BUG-005 [MEDIUM] — Mystery Rooms Not Reachable on Default Path
- **Screen**: `dungeonMap` (Floor 1)
- **Observation**: Map had visible ? (mystery) nodes in the row above starting position and in later rows, but none were ever available to click given the chosen path. The player completed all 7 rows of floor 1 without being able to visit a mystery room.
- **Impact**: Players following a natural path (avoiding elite nodes) may never encounter mystery events, missing a key content pillar.
- **Recommendation**: Ensure at least 1 mystery room is always reachable from any valid floor 1 path.

### LOW

#### BUG-006 [LOW] — rewardRoom Sometimes Requires Two acceptReward Calls
- **Screen**: `rewardRoom`
- **Action**: `acceptReward` call after combat
- **Expected**: Single call advances to dungeonMap
- **Actual**: Several times (especially after boss), a first `acceptReward` returned `"Screen: rewardRoom"` (still in reward room), requiring a second call to actually advance. The first call seemed to accept a gold reward while the second accepted a card choice reward.
- **Impact**: Minor — automated tests need to loop on acceptReward until screen changes

#### BUG-007 [LOW] — Floor Counter Jumps (Says "Floor 7" at Floor 2 Entry)
- **Screen**: `dungeonMap` top bar
- **Observation**: After delving from floor 1 boss, the header showed "Deep Caverns — Floor 7" (not Floor 2). The counter may be tracking total rooms entered rather than dungeon floors.
- **Impact**: Minor UI confusion for players expecting a "Floor 2" label

---

## Per-Encounter Combat Log
| # | Floor | Enemy | HP | Turns (est.) | HP Before | HP After | HP Lost | Notes |
|---|-------|-------|----|--------------|-----------|----------|---------|-------|
| 1 | 1 | Pop Quiz | 29 | ~3 | 100 | 100 | 0 | First combat, tutorialized |
| 2 | 1 | Mold Puff | 36 | ~6 | 100 | 87 | 13 | Poison debuff (2 for 3 turns) + weakness status |
| 3 | 1 | Pop Quiz (v2) | 47 | ~10 | 87→95 | 95 | -8 (healed?) | Damage 13 was healed at some point |
| 4 | 1 (Boss) | The Curriculum | 163 | ~11 | 100 | 83 | 17 | Multi-phase. Final Exam mechanic. Shard storm + Prismatic slash |
| 5 | 2 | The Burnout | 78 | ~8 | 91→99 | 99 | 0 | Heavy chain (3.5×), barely took damage. **STUCK at 0 HP** |

---

## Room Type Coverage
| Room Type | Visited? | Working? | Notes |
|-----------|----------|----------|-------|
| Combat | ✅ Yes (4×) | ✅ Yes | Enemy HP scales within floor. Pop Quiz, Mold Puff, The Burnout all feel distinct |
| Elite | ❌ No | ❓ Unknown | r2-n2 elite was visible but path didn't require it |
| Boss | ✅ Yes | ✅ Yes | The Curriculum is excellent — unique phase change, named mechanics |
| Shop | ✅ Yes | ✅ Yes (minor issues) | Haggle system works beautifully. "Leave anyway" dialog is polished |
| Rest | ✅ Yes | ✅ Yes | Meditate → card removal confirmation dialog works. Study/Heal/Meditate options visible |
| Mystery | ❌ No | ❓ Untested in-run | Path never unlocked a mystery node. Content looks strong from source files |
| Treasure | ✅ Yes (2×) | ✅ Yes | Shows as rewardRoom — unclear visual distinction from combat reward |
| Special Event | ✅ Yes | ✅ Yes | "Deck Thin" post-boss event — drop 2 cards. Elegant mechanic |
| Retreat/Delve | ✅ Yes | ✅ Yes | Beautiful pixel art room. Risk/reward framing ("65% if you die") is clear |
| Reward Room | ✅ Yes | ✅ Yes | Card-on-rock visual is great. Multiple rewards flow works (sometimes needs 2× acceptReward) |

---

## Narration System
The narration system fired twice during the run with excellent atmospheric text:
1. **"From here, it is still possible to return. The dungeon does not say this to encourage retreat — only to mark the moment when it ceases to be true."** (appeared when entering dungeonMap at floor 1 start)
2. **"Unblooded this deep. The dungeon finds this interesting. So does something below."** (appeared after completing multiple rooms without taking damage on floor 1 — reactive to player performance!)
3. **"Untouched. The dungeon has not yet decided what you are worth."** (appeared before boss room)

These are outstanding. The performance-reactive narration ("Unblooded this deep" because player had taken minimal damage) shows the system working intelligently. The writing has a distinctive voice — dry, ominous, slightly amused.

---

## Chain Multiplier Observation
By Floor 2, the "Azure" chain had reached **3.5×**, resulting in:
- Block cards dealing 49/62/85 block per play
- Strike cards dealing **94 damage**

This is either working as intended (long runs reward chain mastery) or represents a potential balance issue where late-run power levels trivialize floor 2 difficulty. Worth flagging for the balance team. If a 3.5× chain is achievable by floor 2, floor 2 enemies (78 HP) become trivial.

---

## What Worked Well
1. **Core combat loop** — charge plays, quiz integration, block/attack decisions all feel tight and responsive
2. **Boss design** — The Curriculum with 163 HP, phase transitions, and named moves ("Final Exam: Prismatic barrage") is excellent boss design
3. **Shop + haggle system** — Outstanding mechanic. Knowledge quiz gates price discounts seamlessly
4. **Visual environments** — Pop Quiz classroom, The Burnout moth creature (Deep Caverns), The Curriculum library setting — all look great and match their themes
5. **Atmospheric narration** — The dungeon-voice text is the best writing in the game. Reactive to player state ("Unblooded this deep")
6. **Post-boss Deck Thin event** — Elegant decision point without being intrusive
7. **Rest site** — Three options (Rest/Study/Meditate) with clear descriptions and a deck-thinning confirmation dialog is well-designed
8. **Retreat/Delve screen** — The pixel art room with the descending staircase pit is stunning. Risk communication is clear.
