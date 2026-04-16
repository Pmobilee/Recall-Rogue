# Full Run Playtest v5 — BATCH-2026-04-16-005

**Date:** 2026-04-16  
**Agent:** Claude Sonnet 4.6 (sub-agent)  
**Duration:** ~35 minutes  
**Container:** rr-warm-llm-playtest-BATCH-2026-04-16-005

---

## Run Summary

- **Run 1:** Floor 1–4, reached pre-boss row. Player died at 0 HP with no game-over trigger (bug). Abandoned via hub.
- **Run 2 (partial):** Died in Floor 1 combat (turn 11+), properly triggered runEnd screen.
- **Scenario Loading:** Used `__rrScenario.load()` to directly test shop, rest-site, and combat-boss scenes.
- **Total rooms visited:** 2× combat, 2× mystery event, 1× treasure, 1× shop (scenario), 1× rest site (scenario), 1× boss combat (scenario)

## Verdict: ISSUES

Core bug fixes verified as working. One new bug found: player surviving at 0 HP without game-over trigger.

---

## Bug Fix Verification

### drawImage crash: **FIXED**
No `drawImage` crash observed during any combat → reward → map transition. Tested in combats 1 and 2 of Run 1, and treasure room transition. All clean.

### rewardRoom stuck: **FIXED**
`acceptReward()` successfully auto-transitioned to `dungeonMap` in every case tested:
- After Combat 1 (Floor 1): `rewardRoom → dungeonMap` ✅
- After Treasure room (Floor 3): `rewardRoom → dungeonMap` ✅  
- After Mystery event (card reward via `Continue` button): `cardUpgradeReveal → dungeonMap` (via DOM click) ✅

### mystery continue: **FIXED**
Two mystery event types tested:

**Type A — Continue button:** "The Whispering Shelf" — book slides into bag, `getMysteryEventChoices()` returned `[{index:0, text:"Continue"}]`, `mysteryContinue()` resolved to `cardUpgradeReveal` (free card: PIERCING). ✅

**Type B — Quiz type:** "The Inscription" — 1 quiz question, "Begin Quiz" button. Selected answer via button click, answered wrong (Equatorial Guinea, not South Africa). Result: "Q1: ✗ Take 10 damage". `mysteryContinue()` from results screen resolved to `dungeonMap`. ✅

---

## Bugs Found

### BUG-001: Player survives at 0 HP — no game-over trigger (HIGH)
**Observed in Run 1, Floor 4 combat (turn 6+).** Player HP reached 0 via poison + enemy attacks, but the game stayed on the `combat` screen indefinitely. `endTurn()` continued to return `ok:true, "Turn ended. Screen: combat"`, turn counter stuck at 6, hand never refreshed (always 0 cards), AP never restored. The game did not transition to runEnd/gameOver. Player was stuck in an unwinnable infinite combat loop.

**Note:** Run 2 eventually triggered `runEnd` properly (player died on turn 11+), suggesting the bug may be turn-count or poison-related.

**Contrast:** Run 2 properly showed runEnd after HP depletion. Difference may be that Run 1 had `poison` status effect active at time of death; Run 2 died from direct attack damage.

**Reproduction:** Play to Floor 4, get poison applied, reduce HP to 0 via multiple small damage sources while poisoned. Turn 6 seemed to be the trigger point.

---

## Balance & Difficulty

### Per-Floor HP Curve (Run 1)
| Floor | Event | HP Before | HP After | Delta |
|-------|-------|-----------|----------|-------|
| 1 | Combat 1 vs "Pop Quiz" (36HP, 6 turns) | 100 | 64 | -36 |
| 2 | Combat 2 vs "Pop Quiz" (47HP) | 72* | ~72 | — |
| 3 | Treasure (no combat) | 72 | 72 | 0 |
| 4 | Mystery "The Inscription" quiz (wrong) | 72 | 62 | -10 |
| 4 | Combat 3 vs "Pop Quiz" (47HP) | 62 | 0 | -62 (died) |

*Player HP increased from 64→72 between combats suggesting a healing vial was auto-consumed.

### Enemy Difficulty Rankings
- **Pop Quiz** (Floor 1): 36HP, manageable in 6 turns. Weakness debuff + Cap strike rotation.
- **Pop Quiz** (Floor 2): 47HP, harder. Spore shower (poison 2) is dangerous.
- **Pop Quiz** (Floor 4): 47HP, same but player was weakened. Very dangerous with poison.
- **Thesis Construct** (Run 2, Floor 1): 37HP, "Hardening Crystals" defense (+10 block). Slower to kill, but manageable.
- **The Algorithm** (Boss scenario): 71HP. Multimodal — Data beam (attack), System scan (debuff), Firewall (defend). HP dropped from 71→54 in 2 turns of decent play.

### Combat Length
- Floor 1 combats: 5–7 turns consistently
- Floor 4 combats: 6+ turns (player died at turn 6)

### Healing Vial Drops
- 1 vial observed auto-consumed between combat 1 (HP 64) and combat 2 (HP 72) — +8 HP healed.

---

## Room Coverage

### Mystery Events
1. **"The Whispering Shelf"** (Floor 2) — Continue type. Book slides into bag. Free card reward: PIERCING (Deal 3 damage, Pierce 1). No narrative at mystery room itself, but narration fired on dungeonMap return.
2. **"The Inscription"** (Floor 4) — Quiz type. 1 question: "Which country is highlighted on this map?" Options: Equatorial Guinea, South Africa, Morocco. Correct: Equatorial Guinea. Wrong answer: -10 HP. Resolved correctly.

### Shop (Scenario: `shop`)
- Screen: `shopRoom` ✅
- 3 relics: Whetstone (150g, +3 attack/-1 block), Iron Shield (150g, block at turn start), Vitality Ring (150g, +20 max HP)
- 8 cards priced 54g–79g
- Card Removal (75g), Card Transform (35g)
- `shopBuyCard(2)` worked: returned `{ok:true, "Bought shop card 2"}`
- Gold: 500g in dev scenario

### Rest Site (Scenario: `rest-site`)
- Screen: `restRoom` ✅
- Options: ❤️ Rest (Heal 20% HP), 📖 Study (Quiz 3 questions → upgrade cards), 🧘 Meditate (Remove 1 card, needs 6+)
- `restHeal()` returned `{ok:true, "Healed at rest room"}` ✅
- Study/Meditate locked in scenario due to no deck cards available

### Boss (Scenario: `combat-boss`)
- Enemy: **"The Algorithm"** HP 71/71 ✅
- Intents observed: "Data beam" (attack, 8 dmg), "System scan" (debuff), "Firewall" (defend)
- HP reduced from 71→54 in 2 turns of normal play
- Standard combat mechanics applied (quick play, end turn, enemy attacks back)
- Player HP: 50→42 after 2 turns

### Treasure Room (in-run)
- Entered as map node r3-n3, Screen: `rewardRoom` immediately ✅
- Accept button worked, `acceptReward()` → `dungeonMap` ✅
- Narration: "The grief-guardian falls. Whatever it was mourning, it has mourned long enough. The fragments it protected are yours to witness now."

---

## Chain Strategy Effectiveness

- Chain length stayed at 0 throughout (no charge cards triggered chain bonuses)
- `chargePlayCard(index, true)` functioned correctly — "answered correctly" but chain type mismatch likely prevented chain activation
- Chain momentum opportunities limited by mixed deck composition
- Mastery upgrades: 0 observed (no charged plays with same chainType)

---

## FSRS Progression

- Fact repetition observed: same facts reappeared in subsequent turns (biryani origin, Great Pyramid blocks, Scorpius/Orion)
- 8-10 unique facts per 20 card plays — consistent with FSRS spacing behavior
- Questions included diverse domains: food_cuisine, art_architecture, space_astronomy, mythology_folklore, animals_wildlife, natural_sciences, general_knowledge, geography

---

## Narration Quality

All narration captured and assessed:

1. **"The descent continues. Knowledge is the light you carry. It does not get heavier — only brighter. / The first floor — where curiosity and dread are still balanced. That balance will not last."** — ✅ Evocative. Appropriate tone. Good pacing between the two lines. Small concern: "curiosity and dread" is somewhat familiar phrasing.

2. **"The grief-guardian falls. Whatever it was mourning, it has mourned long enough. The fragments it protected are yours to witness now."** — ✅ Strong. Original concept (grief-guardian). Feels earned. Very good.

3. **"Some questions refuse categorization. They belong to every domain and none. The labyrinth was built to hold them — the questions that fell between the cracks of every organized archive."** — ✅ Excellent thematic resonance. Meta-commentary on knowledge domains. The em-dash usage is clean (single instance). This one stands out as particularly good flavor text.

**Overall narration quality: HIGH.** Three distinct narrations, all on-theme, no AI tells (no "tapestry", no rule-of-three). The grief-guardian and archive lines are standout.

---

## Fun & Engagement

**Highlights:**
- Mystery event variety is excellent — "Continue" type (free reward) vs "Quiz" type (risk/reward) creates real decision tension.
- The "The Inscription" failure (-10 HP) felt fair and readable. The results screen showing "Q1: ✗ Take 10 damage" was clear.
- PIERCING card from "The Whispering Shelf" felt like a meaningful find.
- The Algorithm boss has genuinely interesting intent variety — "Firewall" and "System scan" force tactical thinking beyond pure DPS.

**Lowlights:**
- Combat at Floor 4 with Poison + weakness was brutal and somewhat unreadable. The combination of status effects made the HP drain feel chaotic rather than strategic.
- The turn-stuck-at-0-HP bug completely killed the run momentum. After 13 minutes of play, hitting a hard lock is very damaging to "one more turn" feeling.
- Combat is slow (6+ turns per encounter) for a Floor 1 enemy with only 36HP. Quick cards deal ~4 damage each; with AP=3-4, dealing 12-16 damage/turn against 36HP means 3+ turns minimum. Feels slightly underpowered.

**"One more turn" assessment:** Present before the death bug. The FSRS fact cycling creates genuine learning momentum. Mystery event variety adds exploration incentive. The death bug (HP=0 no game-over) is the single biggest engagement killer discovered.

---

## Per-Encounter Log

| # | Floor | Room Type | Enemy/Event | Turns | HP Before→After | Reward? | Vial? |
|---|-------|-----------|-------------|-------|-----------------|---------|-------|
| 1 | 1 | Combat | Pop Quiz (36HP) | 6 | 100→64 | acceptReward ✅ | Yes (+8) |
| 2 | 2 | Combat | Pop Quiz (47HP) | 3+ | 72→72 | — | — |
| 3 | 2 | Mystery | The Whispering Shelf | 1 | 72→72 | Card: PIERCING | No |
| 4 | 3 | Treasure | — | 0 | 72→72 | acceptReward ✅ | No |
| 5 | 4 | Mystery | The Inscription (quiz) | 1 | 72→62 | None (wrong answer) | No |
| 6 | 4 | Combat | Pop Quiz (47HP) | 6+ | 62→0 | **DIED — no game-over** | No |
| — | Scenario | Shop | shop-loaded | — | 100 | Card bought ✅ | — |
| — | Scenario | Rest | rest-site | — | 100 | Healed ✅ | — |
| — | Scenario | Boss | The Algorithm (71HP) | 2 | 50→42 | (not completed) | — |

---

## Raw Data

### Narration Lines (all)
1. "The descent continues. Knowledge is the light you carry. It does not get heavier — only brighter."
2. "The first floor — where curiosity and dread are still balanced. That balance will not last."
3. "The grief-guardian falls. Whatever it was mourning, it has mourned long enough. The fragments it protected are yours to witness now."
4. "Some questions refuse categorization. They belong to every domain and none. The labyrinth was built to hold them — the questions that fell between the cracks of every organized archive."

### Key Screen Transitions Observed
- `dungeonMap → combat` ✅ (selectMapNode r0-n0)
- `combat → rewardRoom → dungeonMap` ✅ (acceptReward fixed)
- `dungeonMap → mysteryEvent → cardUpgradeReveal → dungeonMap` ✅ (Continue type)
- `dungeonMap → mysteryEvent [quiz] → dungeonMap` ✅ (Quiz type, wrong answer)
- `dungeonMap → rewardRoom → dungeonMap` ✅ (treasure room)
- `combat → runEnd` (death, run 2) ✅ (eventually)
- `runEnd → hub → deckSelectionHub → dungeonMap` ✅ (new run flow)
- `hub → "Run In Progress" → Abandon Run → runEnd` ✅
- Scenario loading via `__rrScenario.load()`: shopRoom ✅, restRoom ✅, combat (boss) ✅

### Console Errors
- `Failed to load resource: net::ERR_CONNECTION_REFUSED` — recurring, appears to be an analytics/tracking endpoint that's unreachable in Docker environment. Non-blocking, no observable game impact.

### Bug-001 Reproduction Notes
- Occurs on Floor 4, turn 6
- Player had `poison (value:2, turnsRemaining:1)` status effect
- Hand=0, AP=0, cardsPlayedThisTurn=3 when stuck
- `endTurn()` returned `{ok:true, "Turn ended. Screen: combat"}` but turn counter stayed 6
- HP stayed at 0 across multiple endTurn calls
- Running `startRun()` while in this state returned `{ok:false, "Start Run button not found"}`
- Only way to exit: navigate to hub via `window.location.href` (breaks __rrPlay context)

---

*Generated by Claude Sonnet 4.6 sub-agent, BATCH-2026-04-16-005, 2026-04-16*
