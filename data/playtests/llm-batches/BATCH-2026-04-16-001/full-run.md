# Full Run Playtest Report — BATCH-2026-04-16-001
**Date**: 2026-04-16 | **Deck**: Ancient Rome (domain: ancient_rome) | **Target Floors**: 3 | **Actual Outcome**: Died Floor 1 | **Accuracy Simulated**: ~60% natural FSRS pattern

---

## Run Summary
- **Floors attempted**: 1 (Floor 1 only — died on 4th combat encounter)
- **Total rooms visited**: 4 combat rooms (0 shop, 0 rest, 0 mystery, 0 boss)
- **Run outcome**: DEFEAT — killed by Thesis Construct (65 HP) in 4th encounter at 2 HP
- **Final gold**: 40
- **HP curve**: 100 → 85 → 83 → 62 → 44 → 26 → 16 → 2 → 0 (dead)
- **Total bugs found**: 4 (1 HIGH, 2 MEDIUM, 1 LOW)

---

## Verdict: ISSUES

The game is playable and the core combat loop functions correctly. However several bugs need attention: a persistent FPS performance problem in CombatScene, a rewardRoom Continue button that doesn't function (requiring API bypass), and a map node state display bug where completed nodes show as "current" rather than "completed" after navigate()-bypass. Balance is also a concern — the damage scaling (especially charged attacks with displayDamage inflating significantly above the base value) creates harsh attrition on Floor 1 without rest opportunities.

---

## Bug Report

### HIGH

**BUG-001: Persistent CombatScene FPS degradation**
- **Screen**: combat
- **Action**: Playing through any extended combat encounter
- **Expected**: Stable 60 fps
- **Actual**: FPS degraded continuously from 31fps at combat start → 20fps at 63s → 15fps at 123s → 12fps at 427s, eventually hitting 11fps at 791s. Performance worsened progressively over the 24-minute session.
- **FPS alerts logged**: 19 separate low-FPS alerts over the run
- **Evidence**: `getRecentEvents()` at end of session contained 19 FPS events; session summary: `{"eventCount":22,"typeCounts":{"state-change":3,"fps":19},"durationMs":1458015}`
- **Severity**: HIGH — this will affect all players during longer sessions and is clearly noticeable during combat

---

### MEDIUM

**BUG-002: rewardRoom Continue button non-functional after combat**
- **Screen**: rewardRoom
- **Action**: Clicking the "Continue" DOM button (`btn-reward-room-continue`) after defeating an enemy
- **Expected**: Transition to dungeonMap
- **Actual**: Button click registers but screen stays on rewardRoom. The button is flagged as HIDDEN in layout dump. Manually forcing `display:block` and clicking still fails to transition.
- **Workaround**: `window.__rrPlay.navigate('dungeonMap')` successfully bypasses the stuck screen
- **Side effect of workaround**: Node completion state is not properly registered on the map (see BUG-003)
- **Evidence**: Step 21 — "clicked-continue-dom" returned but getScreen() still showed rewardRoom. Multiple attempts over steps 17-22 all failed.

**BUG-003: Map node states don't update after navigate() bypass**
- **Screen**: dungeonMap
- **Action**: After completing 3 combats using navigate() bypass of rewardRoom
- **Expected**: Completed nodes show as "completed" class, new row unlocks properly
- **Actual**: r0-n0 remains stuck as "state-current" (not "state-completed") throughout the entire run after 3 combat completions. Row 1 did unlock (r1-n0, r1-n1 available) but r0-n0 never transitioned to completed. Row 2+ nodes never became available.
- **Root cause**: navigate() bypasses the reward room flow which likely triggers the map state update
- **Evidence**: Node listing at step 49 showed `{"testId":"map-node-r0-n0","state":"current"}` after 3 completed combats

---

### LOW

**BUG-004: Crystal Crush displayDamage vs value field mismatch (confusing to developers)**
- **Screen**: combat
- **Action**: Reading enemy intent before an attack
- **Expected**: value field and displayDamage field should be consistent or clearly labeled
- **Actual**: Crystal Crush intent shows `value: 12, displayDamage: 26` (or `displayDamage: 14`). Actual HP damage delivered matches displayDamage (14 - 8 block = 6 HP lost, confirmed). The `value` field appears to be the pre-amplification base value; displayDamage is the actual post-multiplier damage.
- **Impact**: Not a gameplay bug — damage is calculated correctly. But confusing for tooling/testing that reads `value` and expects it to equal actual damage delivered.

---

## Balance & Difficulty Assessment

### Floor-by-floor HP Curve
| Combat | Enemy | HP Before | HP After | Damage Taken | Turns |
|--------|-------|-----------|----------|--------------|-------|
| 1 | Pop Quiz (37 HP) | 100 | 100 | 0 | 6 |
| 2 | Thesis Construct (55 HP) | 100 | 26 | 74 | 9 |
| 3 | Overdue Golem (72 HP) | 26 | 2 | 24 | 9+ |
| 4 | Thesis Construct (65 HP) | 2 | 0 | 2 (fatal) | 1 |

### Enemy Difficulty Progression
- **Pop Quiz** (37 HP): Manageable opener. Debuff-heavy (weakness, poison via "Spore shower"). 6 turns to kill at low damage output. GOOD DESIGN — teaches debuff mechanics without lethal threat.
- **Thesis Construct** (55 HP): Major spike. Crystal barrage (multi-hit) + charge mechanic (Crystal Crush) deals 18-26 actual damage per charged turn. Very dangerous. 9 turns. Correct ramp but steep.
- **Overdue Golem** (72 HP): Brutal combination of weakness debuff cycling + heal (5 HP/turn) + hard attacks (Sludge swing: 21 actual damage). The heal mechanic counteracts player DPS effectively. This enemy felt overtuned for a first-floor encounter — the net DPS after healing required nearly 10 turns.

### Balance Concerns
1. **No healing available on Floor 1 main path**: The map structure in this run had only combat nodes in the first two rows, with mystery events locked behind completing those rows. Players can reach 2 HP before ever seeing a rest room.
2. **Weakness stacking is brutal at low HP**: The Overdue Golem applies weakness every other turn. When combined with low HP, there's no recovery window.
3. **Charged attack multipliers seem high**: Crystal Crush shows base value 12 but delivers 26+ actual damage. This nearly doubles the expected damage figure. Players reading the telegraph see "attack 12" but receive 26 — the displayDamage shows the actual but isn't the primary field.
4. **Combat length**: Pop Quiz took 6 turns (within spec 4-7). Thesis Construct took 9 turns. Overdue Golem took 9+ turns. Longer than expected.

---

## FSRS Progression Analysis

### Unique Facts Seen
From 4 combats (~35+ quiz charges), the following factIds appeared repeatedly:

| FactId | Subject | Times Seen | Mastery |
|--------|---------|-----------|---------|
| myth-huitzilopochtli-aztec-sun-war-god | Aztec war god Huitzilopochtli's weapon | 6+ | Started cursed, ended CURSED+UPGRADED |
| aw-caecilian-legless-amphibian | Limbless underground amphibian | 5+ | masteryLevel 1, UPGRADED |
| us_states_nebraska_unicameral | Nebraska unicameral legislature | 5+ | masteryLevel 1, UPGRADED |
| animals_wildlife-cygnus-clutch-size | Swan clutch size (8 eggs) | 4+ | masteryLevel 1, UPGRADED |
| world_religions_oth_avesta | Zoroastrianism sacred scripture (Avesta) | 5+ | masteryLevel 1, UPGRADED, became Strike type |
| general_knowledge-c-language-successor-to-b | Programming language preceding C | 4+ | masteryLevel 1, UPGRADED |
| ww_sac_hagia_sophia_dome | Hagia Sophia dome diameter | 3+ | Standard |
| hbh_repro_ovarian_reserve | Egg cells at birth | 3+ | UPGRADED |
| animals_wildlife-starfish-stomach-eversion | Starfish stomach eversion | 3+ | Standard |
| general_knowledge-gutenberg-movable-type | Year Gutenberg invented movable type | 2+ | UPGRADED |

### FSRS Pattern Assessment
- **Repeat questions confirmed working**: Same factIds appeared across all 4 combats. The Huitzilopochtli question appeared 6+ times.
- **Mastery upgrades tracked**: Cards with correct answers across multiple combats showed masteryLevel increasing from 0 to 1, and card baseEffectValue increasing (4→5→6→7→8 seen on upgraded cards).
- **Card type transformation observed**: The Avesta card started as Block (mythology_folklore), was played correctly, and in subsequent combats appeared as Strike with masteryLevel 1. This card-type mutation on mastery is an interesting mechanic.
- **Domain mixing confirmed**: Cards from mythology_folklore, geography, animals_wildlife, human_body_health, and general_knowledge all appeared — NOT just ancient_rome cards. This may be expected (starter deck has mixed domains) but should be verified.
- **CONCERN**: The Huitzilopochtli card became CURSED after an enemy debuff action (not from incorrect answering). This persisted across the entire run through multiple combats. Is this intended — that curse persists run-wide?

---

## Fun & Engagement

### Positive
- **Tactical decision-making feels real**: Choosing between quick-play (safe 4 dmg) vs charge-play (risky 6 dmg or 2 dmg on wrong answer) creates genuine tension every turn. The quiz element is central and the risk/reward is well-calibrated.
- **Enemy variety is good**: Pop Quiz (debuffer), Thesis Construct (charging attacker), Overdue Golem (healer/debuffer) each require different strategies.
- **Card progression visible**: Watching Caecilians and Nebraska go from base-4 to base-6-7-8 over the run gives tangible FSRS reward feedback.
- **Death screen well-executed**: Showing the killing enemy with full HP and "Return to Hub" is clear and visually striking.
- **Transmute cards are interesting**: "Transform this card, choose from 3" is a fun wildcard mechanic.

### Negative
- **Floor 1 feels like an HP attrition death march**: Without rest opportunities, the player bled from 100 to 2 HP over 3 combats. The journey never felt comfortable after combat 2.
- **Cursed+Upgraded states on enemy deaths**: The Huitzilopochtli card being cursed by an enemy and that curse persisting makes the card a liability in your deck for the entire run. The debuff-into-curse mechanic feels punishing without clarity.
- **FSRS repetition can feel tedious**: Seeing the same 6-8 factIds across 30+ quiz events in a single ~24 minute session is noticeable. The facts are from a variety of domains but the same questions cycle very frequently on Floor 1.

### Fun Rating: 6/10
The core loop is engaging when you're not in a death spiral. The quiz integration works. But the difficulty curve on Floor 1 without healing feels wrong — a player who doesn't know the answers (true ~40-50% first exposure) will be devastated by weakness+attacks.

---

## Mystery Room & Shop Evaluation
**NOT REACHED** — Mystery events (r1-n2, r2-n0) were locked behind completing the first two combat rows. Given the map structure, players must complete 3-4 combats before accessing any special rooms on Floor 1. By that point in this run, the player was at 2 HP.

The map node listing confirmed mystery rooms exist (r1-n2 = "Mystery event — locked", r2-n0 = "Mystery event — locked") but their unlock conditions put them after combat encounters, not alongside them as branching paths.

**Recommendation**: Consider making at least one non-combat special room (rest/mystery) accessible earlier — e.g., at the end of the first combat row, to give players a potential heal before the difficulty ramps.

---

## Narration Quality
**No narration text was captured during this run.** The `getAllText()` function returned minimal content (only UI element labels like "Continue", "Accept", "Leave"), and `getNotifications()` returned empty arrays throughout. No story text appeared between rooms, no narration during combat, no flavor text on the dungeon map.

Possible explanations:
1. Narration requires specific triggers (e.g., first visit to new area) that weren't activated via API navigation
2. Narration exists but is displayed only in Phaser canvas layer (not accessible via getAllText/DOM)
3. The Ancient Rome domain has no narration content yet

This is a gap in the playtest — narration quality cannot be evaluated without visible text. If narration exists via Phaser/canvas text, the screenshot approach would be needed to capture it.

---

## Card Mechanics Verification

### Verified Working
- **Quick play**: 1 AP, deals base damage (4 for Tier-1 Strike). Confirmed: quick-play Strike deals 4 damage.
- **Charge play correct**: 1.5x multiplier confirmed (base 4 → 6 damage on correct answer).
- **Charge play incorrect**: 0.5x multiplier confirmed (base 4 → 2 damage on wrong answer).
- **Block mechanic**: Absorbs damage equal to block value, confirmed working on multiple hits.
- **Weakness status effect**: Reduces attack damage. Observed: Strike deals 2-3 instead of 4-6 while under weakness.
- **Curse status**: Cursed cards deal severely reduced damage (1-2 instead of 4+). Confirmed via multiple cursed card plays.
- **FSRS mastery upgrades**: Cards gain baseEffectValue increases when mastery level rises (confirmed: 4→6→7→8 seen across run).
- **Transmute card type**: "Transform this card" utility; appears to change card mechanics (observed card transitioning between types).
- **Enemy healing mechanic**: Overdue Golem's "Bog absorption" healed 5 HP when combat state updated — confirmed working.
- **Enemy charge mechanic**: Thesis Construct charges Crystal Crush over 2 turns and releases — confirmed.

### Damage Math Discrepancy (BUG-004)
- Enemy intent shows `value` field (base) vs `displayDamage` (actual post-multiplier).
- Crystal Crush: value=12, displayDamage=26 → player took 26-8block=18 HP. displayDamage was the actual.
- Sludge Swing: value=8, displayDamage=21 → player took 21-11block=10 HP. displayDamage was the actual.
- Quick conclusion: `value` is the base damage; `displayDamage` includes enemy attack multipliers and is the real number.

### Chain System
Chain system (chainType 1/2/3 on cards) was observed but not explicitly tested. Cards had chainType values 1-3 throughout; no chain bonus was visibly triggered during combat.

---

## Per-Encounter Combat Log

| # | Enemy | HP Before→After | Turns | Dmg Taken | Gold | Notes |
|---|-------|-----------------|-------|-----------|------|-------|
| 1 | Pop Quiz (37 HP) | 100→100 | 6 | 0 | +10 | Poison debuff (tick not observed), weakness 2x applied |
| 2 | Thesis Construct (55 HP) | 100→26 | 9 | 74 | +10 | Crystal barrage 10-12dmg, Crystal Crush 26dmg |
| 3 | Overdue Golem (72 HP) | 26→2 | 9 | 24 | +10 | Heals 5/turn, Sludge swing 21dmg, weakness cycling |
| 4 | Thesis Construct (65 HP) | 2→0 | 1 | 2 (fatal) | — | Killed by Crystal barrage (12 dmg) with 2 HP |

---

## Raw Data

### FSRS Tracking Table
| FactId | Domain | Question (truncated) | Answer | Times in Hand | Mastery End |
|--------|--------|---------------------|--------|--------------|-------------|
| myth-huitzilopochtli-aztec-sun-war-god | mythology_folklore | Aztec war god Huitzilopochtli weapon? | Xiuhcoatl, fire serpent | 6+ | 0 (CURSED by enemy debuff) |
| aw-caecilian-legless-amphibian | animals_wildlife | Limbless underground amphibian? | Caecilians | 5+ | 1 (UPGRADED) |
| us_states_nebraska_unicameral | geography | Only unicameral US state? | Nebraska | 5+ | 1 (UPGRADED) |
| animals_wildlife-cygnus-clutch-size | animals_wildlife | Max swan clutch size? | 8 eggs | 4+ | 1 (UPGRADED) |
| world_religions_oth_avesta | mythology_folklore | Zoroastrian primary scriptures? | Avesta | 5+ | 1 (UPGRADED, type changed) |
| general_knowledge-c-language-successor-to-b | general_knowledge | Language preceding C? | B | 4+ | 1 (UPGRADED) |
| ww_sac_hagia_sophia_dome | geography | Hagia Sophia dome diameter? | 31.24 metres | 3+ | 0 |
| hbh_repro_ovarian_reserve | human_body_health | Egg cells at birth? | 1-2 million | 3+ | 1 (UPGRADED) |
| animals_wildlife-starfish-stomach-eversion | animals_wildlife | Starfish digestion method? | Everting stomach | 3+ | 0 |
| general_knowledge-gutenberg-movable-type | general_knowledge | Year Gutenberg invented movable type? | ~1450 | 2+ | 1 (UPGRADED) |
| myth-huitzilopochtli-aztec-sun-war-god | mythology_folklore | Same as above | Same | same | same |

**Note on domain mismatch**: The deck was "ancient_rome" but factIds from animals_wildlife, geography, general_knowledge, human_body_health, and mythology_folklore all appeared. No ancient_rome-specific factIds (like roman emperors, latin vocabulary, etc.) were observed in 30+ quiz charges. Either the ancient_rome deck is not yet content-filled and falls back to generic starter cards, or the domain label applies to the enemy narrative rather than the card content.

### Session Statistics
- Session duration: 24.3 minutes
- Total events tracked: 22 (3 state-change, 19 FPS alerts)
- FPS alert range: 11-36 fps (mostly 12-27 fps during combat)
- Combat screens visited: 4
- Gold at death: 40 (10 per combat)

### Map Structure Observed (Floor 1 - Shallow Depths)
```
Row 0 (start): r0-n0=Combat, r0-n1=Combat, r0-n2=Combat (3 paths)
Row 1:         r1-n0=Combat, r1-n1=Combat, r1-n2=Mystery (locked)
Row 2:         r2-n0=Mystery (locked), r2-n1=? (locked)
...            ... (more rows, presumably leading to boss)
```

### Screenshot Evidence
Key screenshots captured at:
- `/tmp/rr-docker-visual/.../step3-dungeon-map-floor1.rr.jpg` — initial map view
- `/tmp/rr-docker-visual/.../step7-after-click-node.rr.jpg` — combat 1 in progress
- `/tmp/rr-docker-visual/.../step16-combat1-state-check.rr.jpg` — reward room (black screen)
- `/tmp/rr-docker-visual/.../step23-dungeon-map-after-combat1.rr.jpg` — map after combat 1
- `/tmp/rr-docker-visual/.../step48-map-after-combat3-at-2hp.rr.jpg` — map at 2HP crisis point
- `/tmp/rr-docker-visual/.../step53-run-end-death-screen.rr.jpg` — death screen (Thesis Construct 65/65)

---

## Additional Observations

### Reward Room Visual Bug
During the rewardRoom transition after combat 1, the Phaser canvas went completely black — only the DOM HUD (HP bar, floor name, gold counter) was visible. The reward room content (3 mini cards + gold coin) was visible in the layout dump but not rendered on screen. This may be a frame-rendering order issue where the RewardRoom Phaser scene starts but the canvas fails to paint until a user interaction occurs.

### Player API Behavior
- `selectMapNode('map-node-r0-n0')` format failed; `selectMapNode('r0-n0')` format succeeded — the full `map-node-` prefix should not be included
- `endTurn()` returns `{}` (not ok/error feedback) — fine but minimal
- `chargePlayCard(index, bool)` returns `{}` regardless — no feedback on damage dealt
- `navigate('dungeonMap')` works as escape hatch but corrupts map state

### Performance Profile
The 11fps minimum (at 791 seconds of combat) suggests memory leaks or accumulated particle/graphics objects in CombatScene that aren't cleaned between encounters. The degradation curve (31→20→15→12→11 fps over 13 minutes) follows a classic memory accumulation pattern.

### Interesting Mechanic Discovery: Card Type Mutation on FSRS Mastery
The Avesta card (world_religions_oth_avesta) started as a Block card (mythology_folklore domain) and later appeared as a Strike card with masteryLevel:1 and isUpgraded:true. This type mutation when a card's mastery increases is a fascinating mechanic — it means the "same" fact can behave differently as you learn it better. This should be documented and surfaced to players since it's non-obvious.
