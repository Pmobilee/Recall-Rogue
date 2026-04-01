# Mystery Room Redesign — Design Document

> **Purpose:** Comprehensive overhaul of the mystery room event system, modeled after Slay the Spire's event design philosophy.
> Covers design intent, event catalog, new effect types, distribution changes, and implementation roadmap.
>
> **Source files this doc covers:**
> - `src/services/floorManager.ts` — event definitions, effect types, generation logic
> - `src/services/gameFlowController.ts` — effect resolution, room flow
> - `src/ui/components/MysteryEventOverlay.svelte` — event presentation UI
> - `src/ui/components/EventQuiz.svelte` — quiz/rivalDuel UI
> - `src/data/balance.ts` — balance constants

---

## Current State — What's Broken

### Problems with the existing 24 events

- Most events are passive: walk in, click Continue, get small reward — no agency
- Multiple events are mechanically identical: 3x `upgradeRandomCard`, 2x `removeRandomCard`
- "Nothing" outcomes exist — "Dust and Silence" literally does nothing
- Choices are mathematically obvious with no real dilemma
- Rewards capped too low to matter: 20% heal cap, 25-40g cap
- Worst outcome is only 10-15 damage on 100 HP — no real danger
- 4 quiz-integrated events partially or fully unimplemented (tutor, rival, burning library, meditation)
- No relics available from mystery rooms
- No events scaled meaningfully to act (all feel similar regardless of floor)

---

## Design Philosophy — StS-Informed

| Principle | Application to Recall Rogue |
|---|---|
| Reward scales with risk | Events CAN exceed rest/shop/combat value, but cost scales proportionally |
| Knowledge quizzes are our unique risk lever | StS uses HP/curses; we ALSO gate rewards behind quiz performance |
| Every event does something | No pure "nothing" outcomes — minimum 3-5g or 2% heal on any branch |
| Choices depend on run state | No universally correct option — deck size, HP%, gold all matter |
| Act progression = escalating stakes | Act 1 training, Act 2 run-defining, Act 3 desperate gambles |
| "Do nothing" is always available but never optimal | Decline/leave branches get consolation, not nothing |
| Curses balance overpowered rewards | 0.7x damage multiplier curse system — use it to gate big rewards |
| Max HP loss is the "permanent" cost | Reserved for biggest rewards only |
| Multi-step escalating commitment | Like StS's Knowing Skull — once you start, costs escalate |

---

## New Balance Framework

Replace hard ceilings with a tiered system:

| Reward Tier | Gate | Examples | Typical Cost |
|---|---|---|---|
| **Free** (shrine) | Nothing | Upgrade 1 card, remove 1 card, 15g | Nothing |
| **Modest** (= rest/combat) | Low risk | Heal 20%, 25g, free card | Small gold or mild gamble |
| **Strong** (> rest/combat) | Quiz or HP cost | Heal 40%, 60g, upgrade 2 cards | Answer correctly OR pay HP/max HP |
| **Run-defining** (>> any room) | Major cost + quiz | Remove all weak cards, massive gold | Permanent max HP loss, curse cards |

**Current game numbers for reference:**
- Player HP: 100/100 max
- Rest site heals 30% HP
- Combat gold: 10g base (common), scaling +15%/floor
- Shop card removal: 50g + 25g per subsequent
- Shop cards: 50-140g by tier
- Curse system: `isCursed` flag, 0.7x damage multiplier

---

## Master Event Table

| Event Name | Act | Status | Risk Level | Core Mechanic |
|---|---|---|---|---|
| The Reading Nook | 1 | KEEP | None | Upgrade a card (shrine) |
| Lost and Found | 1 | KEEP | None | Gain 15g (shrine) |
| The Lost Notebook | 1 | REWORK | Low | Quiz 2 easy Qs → upgrade per correct |
| Strange Mushrooms | 1 | REWORK | Medium | HIDDEN 50/50: heal OR damage + curse |
| The Whispering Shelf | 1 | REWORK | Low | Free card, 20% cursed chance |
| The Inscription | 1 | NEW | Low | Quiz 1 easy Q: correct = heal+gold, wrong = damage |
| Flashcard Merchant | 1 | WIRE UP | Low | Spend 25g → charge bonus 2 encounters |
| Dust and Silence | 1 | REPLACE | — | Replaced by The Inscription |
| Tutor's Office | 2 | KEEP | Low | Quiz 3 Qs, escalating rewards per correct |
| Rival Student | 2 | WIRE UP | Medium | Win = card + heal; Lose = 15 damage (not nothing) |
| Burning Library | 2 | WIRE UP | Medium | 4 Qs: each correct = reward, each wrong = 8 damage |
| Wrong Answer Museum | 2 | WIRE UP | Low | Review worst facts → 5g + confusion fix each |
| Strict Librarian | 2 | KEEP | Medium | Return card + heal vs take 12 damage |
| Merchant of Memories | 2 | REWORK | Medium | Trade max HP to CHOOSE upgrade (not random) |
| Donation Box | 2 | REWORK | Medium | 25g → +5 max HP; or gamble 50/50 gold/damage |
| Copyist's Workshop | 2 | KEEP | Low | Transform a card |
| The Knowing Skull | 2 | NEW | High | Multi-step: pay HP for escalating rewards, even leaving costs |
| The Forbidden Section | 2 | NEW | High | Take 10 damage for access; quiz hard Qs: correct = upgrade, wrong = curse |
| Study Group | 3 | REWORK | Low | Quiz-gated upgrade (replaces duplicate upgradeRandomCard) |
| Knowledge Gamble | 3 | REWORK | Very High | 3 hard Qs: all right = huge reward, 0 right = -15 max HP |
| Meditation Chamber | 3 | WIRE UP | Medium | Domain analysis → choose buff or hard quiz for permanent bonus |
| The Purge | 3 | REWORK | Medium | Player CHOOSES card to sacrifice for higher-tier replacement |
| Desperate Bargain | 3 | KEEP | High | -10 max HP for 2 removals + 20% heal |
| The Purification | 3 | REWORK | High | Remove all cards below mastery 2; 5 damage per card removed |
| The Breakthrough | 3 | REWORK | Low | Upgrade + temp +15% damage buff for 2 encounters |
| The Epiphany | 3 | NEW | Very High | Three run-defining choices — upgrade all / remove up to 3 / quiz 5 hard |
| The Doppelganger | 3 | NEW | High | Forced combat vs mirror deck; win = upgrade 3, lose = 2 cursed |
| Ambush! | 2 | KEEP | High | Regular combat ambush |
| Elite Ambush | 3 | KEEP | Very High | Elite combat, no post-combat reward |

---

## Event Catalog — Full Details

### Act 1 Events (Floors 1-4) — Training Ground

**Design goal:** Teach quiz-gate mechanic safely. Low stakes, clear cause-and-effect.

---

**The Reading Nook** — KEEP
- Branch: Upgrade a card of your choice
- Notes: Our "Living Wall" equivalent. Pure shrine, zero risk. Fine as-is.

---

**Lost and Found** — KEEP
- Branch: Gain 15g
- Notes: Minor consolation shrine. Acceptable filler.

---

**The Lost Notebook** — REWORK
- Old: `upgradeRandomCard` (passive)
- New:
  - "Read carefully" = quiz 2 easy questions; each correct = upgrade one card (player's choice)
  - "Stuff in bag" = free random card (may be weak)
- Design note: Introduces quiz-upgrade linkage. Wrong answers = no upgrade, not damage. Safe failure.

---

**Strange Mushrooms** — REWORK
- Old: Heal 15% (passive)
- New:
  - "Eat one" = HIDDEN outcome: 50/50 chance — either heal 25% OR take 15% damage + 1 card cursed
  - "Ignore" = consolation 5g
- Design note: Teaches hidden outcomes. Player doesn't know until committed. Low floor, interesting texture.

---

**The Whispering Shelf** — REWORK
- Old: Free random card (passive)
- New:
  - "Take the book" = free card; 20% chance it arrives cursed (0.7x damage)
  - "Leave it" = consolation 3g
- Design note: Small risk/reward. Run-state dependent — full deck players might skip.

---

**The Inscription** — NEW (replaces Dust and Silence)
- Dust and Silence currently does nothing. Replace entirely.
- "Decipher the runes" = quiz 1 easy question:
  - Correct: Heal 15% + 10g
  - Wrong: Take 10 damage
- "Ignore it" = consolation 3g
- Design note: First exposure to quiz-gate mechanic. Low stakes intro. Easy question = high confidence.

---

**Flashcard Merchant** — WIRE UP
- Currently has study effect unimplemented
- Branch: Spend 25g:
  - Preview 3 facts from upcoming encounters
  - Gain +20% charge bonus for next 2 encounters
- "No thanks" = consolation 3g
- Design note: Knowledge-as-investment. Pays off only if player uses charged cards.

---

### Act 2 Events (Floors 5-8) — Run-Defining

**Design goal:** Real dilemmas. Rewards scale meaningfully. Failure has teeth.

---

**Tutor's Office** — KEEP
- Quiz 3 questions (easy, escalating reward per correct):
  - 1st: +5% heal
  - 2nd: +10g
  - 3rd: Upgrade a card
- Notes: Well-designed quiz-gate. Keep as-is.

---

**Rival Student** — WIRE UP (rivalDuel effect)
- Currently unimplemented
- Outcomes:
  - Win: Free card + 10% heal
  - Lose: Take 15 damage (was "nothing" — change this)
  - Tie: 15g
- Design note: Fixing "lose = nothing" is critical. Stakes must exist.

---

**Burning Library** — WIRE UP (quiz effect)
- Currently unimplemented
- 4 sequential questions, each saves a "book":
  - Book 1 (correct): 15g
  - Book 2 (correct): Upgrade a card
  - Book 3 (correct): 10% heal
  - Book 4 (correct): Upgrade a card
  - Each WRONG: Take 8 damage
- Design note: Escalating commitment. Greedy players stay for all 4 and risk cumulative damage.

---

**Wrong Answer Museum** — WIRE UP (reviewMuseum effect)
- Currently unimplemented
- Show player's worst facts (highest error rate from confusion matrix)
- Each fact studied = 5g + reduces confusion matrix weight for that fact
- Minimum consolation: 3g even if no bad facts
- Design note: Ties knowledge review to gold reward. Incentivizes studying weaknesses.

---

**Strict Librarian** — KEEP
- "Return a card" = remove 1 card + heal 15%
- "Refuse" = take 12 damage
- Notes: Good compound choice. Run-dependent — good if deck is bloated.

---

**Merchant of Memories** — REWORK
- Old: Upgrade random card (passive)
- New:
  - "Trade your potential" (8 max HP): CHOOSE which card to upgrade
  - "Sacrifice more" (15 max HP): Upgrade chosen card + receive free card
  - "Decline" = consolation 3g
- Design note: Fixes "upgradeRandomCard" duplicate. Max HP cost = permanent, scarce resource. Choice agency = significant improvement over random.

---

**Donation Box** — REWORK
- Old: Donate 20g → gain 25g (net +5g, pointless)
- New:
  - "Donate 25g" = permanent +5 max HP
  - "Shake it" = 50/50: gain 15g OR take 10 damage
  - "Leave it" = consolation 3g
- Design note: Permanent max HP gain = unique outcome not found elsewhere at Act 2.

---

**Copyist's Workshop** — KEEP
- Transform a card into a different card of same tier
- Notes: Unique mechanic. Deck diversity tool. Keep as-is.

---

**The Knowing Skull** — NEW
- Multi-step escalating commitment. Modeled after StS's Knowing Skull.
- Step sequence:
  1. Ask first question: costs 8 HP → receive 20g
  2. Ask second question: costs 12 HP → upgrade a card (player's choice)
  3. Ask third question: costs 16 HP → receive free card
  4. "Leave" at any point: costs 5 HP (even leaving hurts)
- Can stop after step 1 or 2
- Design note: Total commitment = 36 HP for strong reward. Forces players to evaluate HP budget. "Leave" cost prevents zero-risk scouting.

---

**The Forbidden Section** — NEW
- "Break the glass" = take 10 damage, gain access
  - Quiz 3 hard questions sequentially:
    - Each correct: Choose a card to upgrade
    - Each wrong: That card gets cursed (0.7x damage)
- "Walk away" = consolation 3g
- Design note: Upfront damage cost + binary per-question outcome. Full success = 3 upgrades. Full failure = 3 cursed cards. Only viable with good quiz confidence.

---

### Act 3 Events (Floors 9-12) — Desperate Gambles

**Design goal:** Run-defining swings. Permanent costs justified by huge upside. No safe options.

---

**Study Group** — REWORK (resolves duplicate upgradeRandomCard)
- Old: upgradeRandomCard (passive, duplicate of Reading Nook/Breakthrough)
- New:
  - Quiz 2 questions:
    - Each correct: Upgrade a card of your choice
  - "Skip" = consolation 3g
- Design note: Quiz-gated version differentiates from other upgrade events.

---

**Knowledge Gamble** — REWORK
- Old: Gamble with low stakes
- New (3 hard questions):
  - All 3 correct: Full heal + upgrade 2 cards + 30g
  - 2 correct: Heal 30%
  - 1 correct: Nothing
  - 0 correct: Lose 15 max HP permanently
- "Don't gamble" = consolation 3g
- Design note: Catastrophic floor (0 correct = -15 max HP) justifies extraordinary ceiling. Hard questions = real risk.

---

**Meditation Chamber** — WIRE UP
- Currently unimplemented
- Show player's quiz accuracy by domain
- "Focus on strength" (highest accuracy domain):
  - +10% charge bonus for that domain, next 3 encounters
- "Confront weakness" (lowest accuracy domain):
  - Quiz 3 hard questions from that domain
  - Each correct: +15% charge bonus for that domain, permanent this run
  - Each wrong: -5 max HP
- "Leave" = consolation 3g
- Design note: Data-driven decision. Player chooses based on run needs.

---

**The Purge** — REWORK
- Old: Remove random card (passive, same as Eraser Storm)
- New:
  - Player CHOOSES which card to sacrifice to the altar
  - Altar offers a replacement from one tier higher
- "Decline" = consolation 3g
- Design note: Transforms passive removal into meaningful deck-shaping moment. Player agency = key upgrade over random.

---

**Desperate Bargain** — KEEP
- "Accept" = lose 10 max HP permanently → remove 2 cards of your choice + heal 20%
- Notes: Good design. Significant permanent cost, significant deck quality + healing reward.

---

**The Purification** — REWORK (was Eraser Storm)
- Old: Remove random cards (passive, duplicate)
- New: "Begin the ritual":
  - Remove ALL cards in deck below mastery level 2
  - Take 5 damage per card removed
  - Gain 5g per card removed (net positive if HP expendable)
- "Refuse" = consolation 3g
- Design note: Run-state dependent. Great if deck is full of undeveloped cards; dangerous if many low-mastery. Math visible to player.

---

**The Breakthrough** — REWORK
- Old: upgradeRandomCard (third duplicate!)
- New:
  - Upgrade a card of your choice
  - Gain temporary +15% damage buff for next 2 encounters
- Notes: Now differentiated by the encounter buff. Modest cost (none), modest reward, time-limited bonus.

---

**The Epiphany** — NEW (Mind Bloom equivalent)
- Three mutually exclusive, run-defining options:
  1. **"I Remember Everything"**
     - Upgrade ALL cards in deck
     - Add 3 cursed facts to deck (0.7x damage each)
     - Only viable late in run when deck is mostly strong
  2. **"I Know My Weakness"**
     - Remove up to 3 cards of your choice
     - Take permanent 20% max HP loss (e.g., 100 → 80 max HP)
  3. **"I Seek Knowledge"**
     - Quiz 5 hard questions
     - Each correct: +15g + 5% heal
     - Each wrong: 10 damage
     - All 5 correct: Bonus — receive a random relic
- "Turn away" = consolation 5g
- Design note: Signature Act 3 event. Each branch serves a different run state. No universally correct option.

---

**The Doppelganger** — NEW (replaces Mirror Scholar)
- Mirror Scholar was a plain combat event. Replace with:
- Forced combat (no decline option) against a mirror image with your exact deck
- Win: Choose 3 cards to upgrade
- Lose: 2 random cards cursed
- Design note: Skill test using your own deck. Players who know their deck well should win reliably.

---

**Ambush!** (T2) — KEEP
- Regular combat ambush, no pre-combat prep
- Notes: Combat variety. Keep as-is.

---

**Elite Ambush** (T3) — KEEP
- Elite-tier combat, no post-combat reward
- Notes: Highest stakes ambush. Act 3 exclusive.

---

## Mystery Room Distribution Changes

### Current (flat, no act scaling)
- 70% narrative / 20% combat ambush / 10% card reward

### Proposed (per-act escalation)

| Act | Narrative | Combat | Card Reward | Notes |
|---|---|---|---|---|
| Act 1 (floors 1-4) | 80% | 15% | 5% | Low combat, learn quiz-gate |
| Act 2 (floors 5-8) | 65% | 25% | 10% | Ramp up combat risk |
| Act 3 (floors 9-12) | 55% | 30% | 15% | Maximum tension, elite ambushes |

**Act 3 combat ambushes = always elite-tier.**

---

## New Effect Types Required

| Effect Type | Description | Used By |
|---|---|---|
| `percentDamage` | HP%-based damage instead of flat | Strange Mushrooms, Knowledge Gamble |
| `curseCards` | Add N cursed facts to deck | Whispering Shelf, Epiphany, Doppelganger |
| `conditionalReward` | Branch on run state (HP%, gold, deck size) | Donation Box, Purification |
| `chooseCard` | Player picks which card to upgrade/remove/transform | Merchant of Memories, Purge, Breakthrough |
| `multiStep` | Sequential screens with escalating commitment | Knowing Skull, Burning Library |
| `peekMap` | Reveal upcoming room types | (future use) |
| `tempBuff` | Status effect persisting N encounters | Flashcard Merchant, Breakthrough, Meditation |

---

## "Nothing" Outcome Elimination

Every "Ignore" / "Leave" / "Decline" branch must have a minimum consolation:
- **3-5g** (default consolation)
- **2% heal** (alternative when gold would be worthless)

No branch resolves with zero effect. Every event does *something*.

---

## Duplicate Event Resolution

Three events were identical `upgradeRandomCard`:

| Old Event | Resolution | New Differentiator |
|---|---|---|
| Study Group | Quiz-gated upgrade | Answer 2 Qs → upgrade per correct |
| The Breakthrough | Upgrade + temp buff | Upgrade + +15% damage for 2 encounters |
| The Reading Nook | Keep as shrine | Pure positive, no gate — teaching tool |

Two events were identical `removeRandomCard`:

| Old Event | Resolution | New Differentiator |
|---|---|---|
| The Purge | Player chooses card | Sacrifice chosen card → tier upgrade |
| The Purification | Mass removal, HP cost | All mastery-<2 cards removed, 5 damage each |

---

## Implementation Priority

| Priority | Work | Files | Type |
|---|---|---|---|
| 1 | Wire up 4 broken quiz events | `floorManager.ts`, `gameFlowController.ts` | Logic |
| 2 | Rework bland/duplicate events (data only) | `floorManager.ts` | Data |
| 3 | New effect types | `floorManager.ts`, `gameFlowController.ts` | Logic |
| 4 | `conditionalReward` state-aware events | `gameFlowController.ts` | Logic |
| 5 | New events (Inscription, Knowing Skull, Forbidden Section, Epiphany, Doppelganger) | `floorManager.ts`, `gameFlowController.ts` | Logic + Data |
| 6 | Multi-step UI (`multiStep` effect type) | `MysteryEventOverlay.svelte` | UI |
| 7 | Balance pass with headless sim | — | Testing |

---

## Cross-Act Event Chain (Future — Not v1)

A three-act story thread:
- **Act 1**: Find mysterious artifact (costs 10 HP from trap to take)
- **Act 2**: If still held, merchant offers: trade for a powerful relic OR quiz 5 questions for +10% all damage
- **Act 3**: If STILL held at Act 3, artifact transforms into a unique relic

Reward escalates with commitment across the entire run. Teaches "carry potential" mechanic.

---

## Ascension Scaling (Future)

| Change | Effect |
|---|---|
| Reduce rewards by 20% | Tighter margins throughout |
| Add curse chance to "free" events | Shrines become gambles |
| "Leave" options cost HP | No zero-cost exits |
| Remove safest T1 events from pool | Force harder choices earlier |

---

## Related Documents

- `docs/GAME_DESIGN.md` — GDD mystery room section (update after implementation)
- `docs/mechanics/progression.md` — Room type distribution, floor generation
- `src/services/floorManager.ts` — Ground truth for current event definitions
- `src/ui/components/MysteryEventOverlay.svelte` — Event UI component
- `src/ui/components/EventQuiz.svelte` — Quiz integration UI
