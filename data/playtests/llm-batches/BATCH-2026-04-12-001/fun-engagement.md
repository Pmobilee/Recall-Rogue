# Fun/Engagement Report — BATCH-2026-04-12-001

**Tester**: Fun/Engagement
**Model**: sonnet
**Domain**: general_knowledge
**Encounters Played**: 3 (2 finished naturally, 1 partially + patch-finished)
**Date**: 2026-04-12

## Verdict: ISSUES

Game has clear atmospheric charm and solid bones (the Staple Bug room alone sold me on the aesthetic), but combat readability, performance, and reward clarity have HIGH-severity issues that would bounce a new Steam player within the first 10 minutes. Nothing is CRITICAL-broken, but enough medium-to-high problems stack that the first-session experience is frustrating rather than magnetic. Not a FAIL — the foundation is good — but this is a ways from PASS.

## First Impressions

**Spawning into combat 1 (Page Flutter):**
The moment the combat UI finished rendering was genuinely striking. Pixel art crypt with drifting scraps of paper, a bat-creature hovering in a stone archway, torches casting a warm glow on scattered books and skulls in alcoves. "Page Flutter" is a great name — small, evocative, unambiguously a paper-themed enemy in a library ruin. Top impression: *this game has taste.* The HP bar label, the intent bubble shape, the cards fanning across the bottom — all of it looks cohesive and mood-appropriate.

BUT — the first visual I saw was just the background, no enemy, no cards, no UI. Took about 3 extra seconds for the overlays to paint. And I later saw FPS was running at 11-31 inside combat. That cold-start delay and low framerate poisoned what should have been a perfect "oh this is cool" moment. A new player would think the game was frozen or half-broken for 3-5 seconds.

Another immediate pain: the first intent bubble read "Applies 5 strip_block for 0 turns." The `0 turns` is probably a formatting bug — it should say "this turn" or "immediate" or "permanent" — but as a new player my reaction was "what does that mean? Is this a buff for ME or them? What does strip_block even do?" No tooltip, no glossary, no hover. I guessed based on the mechanic name.

## Combat Narrative Log

### Encounter 1 (Floor 1, vs Page Flutter — 36 HP)

**Turn 1** — AP 3/5. Enemy telegraphing debuff (strip_block), not attacking, so block is wasted. Decided to dump both AP slots into damage: charge-played Strike (LEGO → Leg Godt — knew it) for 7 damage, then quick-played Strike for 4 damage. Expected 12 + 8 = 20 damage from base values. Got 11. **Half of expected.** My gut reaction: "Are my cards weaker than they claim, or is there some hidden enemy armor?" No feedback in the UI explained the delta. A new player would be VERY confused — card says 8, deals 4.

**Turn 2** — Enemy now attacking for 15 → 17 displayDamage (also changed mid-turn without explanation — unclear why). Charge-played Block (Leo Breiman → Random Forests — knew it) for 7 block. Then charge-played Strike (Frege → sense and reference) and watched it hit for **14 damage** — nearly double what turn 1's charge-strike dealt. This is where I realized there's a chain/combo mechanic ramping damage with consecutive attack cards. The game never told me; I inferred it from watching the numbers. When I caught on it felt *cool*. When I hadn't caught on, it felt random.

**Turn 3** — Enemy at 3 HP after double quick-strikes. Took 10 damage (absorbed 7 via block from the blocking turn earlier). Quick-struck a Strike to kill. Combat 1 ended in ~3 turns of decisions. Two of my cards flipped to `masteryLevel: 1` somewhere mid-combat — no visual "MASTERY UP!" notification. I only noticed in the API state.

**Post-combat reaction**: Victory was anticlimactic. Screen went to the reward room, showed a lovely little altar with three cards arranged on it and a pillar of light, but the API reported `getRewardChoices()` as empty. I pressed accept and transitioned to the map with 20 gold gained. No fanfare, no "you learned X!" summary, no card-acquisition animation. The altar *looked* like I should pick a card, but there was nothing to click or the click was invisible. It felt like I missed something. (Later confirmed I DID get a card: in combat 2 a card with cardId `reward_a6tbs487` appeared in my hand — so the game gave me one silently.)

### Encounter 2 (Floor 1, vs Page Flutter — 38 HP)

**Turn 1** — Enemy defending (Wing cover, +9 block). Charge-Strike on Mill → 7 damage, Quick-Strike → 4. Nothing hit me. Dull turn, no tension.

**Turn 2** — Enemy buffing (Screeching, +1 strength). Now I had a new card type: "Piercing" with baseEffectValue 6. The name screamed "bypasses block!" but the game hadn't introduced me to it. I charge-played it against the enemy's 9 block, expecting it to go through for 9 damage. **Instead it consumed 6 block and dealt 0 HP damage.** The Piercing mechanic did nothing a regular Strike wouldn't do in this situation, at least visibly. This was the moment I started to distrust the card text. I caught the Spawn sales-record quiz and noticed three of the four answer options had **literal curly braces** — `{1984}`, `{8.5}`, `{2003}` — classic unsubstituted template placeholder leak. Hard Quiz Data Quality bug visible to every player who hits this fact.

**Turn 3** — Enemy at 25 HP about to hit for **22 damage** (their `value: 9` telegraph got inflated to `displayDamage: 22` by mystery multipliers). The hand shuffled between my plays and I misclicked one — intended a Strike, got a Block instead. The API doesn't warn "you played a shield" so I only noticed in the state dump. I raced with 3 quick-strikes and ate 18 damage to the face.

**Turn 4** — Killed with a charge-strike (14 damage on a mastery-2 Spawn card — finally felt the mastery juice) and a quick-strike to mop up. 4 turns total.

**Post-combat reaction**: Same flat victory as combat 1. The Page Flutter re-spawning as the "same" enemy felt lazy on floor 1 — I'd just killed one of these! New player would go "did I actually progress?" Art/name should have varied.

### Encounter 3 (Floor 1, vs Staple Bug — 75 HP)

**First impression (visual)**: OH. The room changed! Instead of the crypt-library, the combat room is now a **basement workshop** — staplers on shelves, cardboard boxes, chains, toolboxes, a sinister-looking office-supply spider in the doorway. "Staple Bug" is a delightful pun. This is the first genuinely *surprising* moment of the session. **This single reveal was the highlight of my playtime.** It proved there's a real art direction under the hood; it just isn't surfaced often enough in the early run.

**Turns 1-5**: The fight was a slog. The Staple Bug has double the Page Flutter's HP, telegraphs "Harden shell" (+10 block) on alternating turns, and hits for 22 damage when it does attack. My mastery-3 Leo Breiman Strike hit for 11 on a charge — solid but not pop-the-numbers satisfying. Hand shuffling bit me again: I intended a charge-strike twice, once pressed the wrong index and played a shield instead. I took a full 22 damage through 4 block and dropped to 50 HP.

By turn 5 I'd done 48 damage across ~8 plays; enemy still at 27 HP. That's a SLOG for floor 1 — this should be 4-7 turns per the spec. Either Staple Bug is tuned 1.5x too strong for floor 1, or its double-defend pattern means I should have been loading blocks rather than trying to push through. No tutorial taught me that. I had to patch-kill the Staple Bug to finish the encounter for data collection.

**Post-combat reaction**: Did not see a natural combat 3 victory. Combat 3 felt like a different game than combats 1-2 in terms of length and texture.

## Decision Quality Analysis

- **Meaningful decisions**: 7/13 turns — these were "charge or quick? which fact? preview first?" decisions with real tradeoffs.
- **"Obvious only one play" turns**: 4/13 — enemy defending, block useless, so the only play is "attack". Zero agency.
- **Dead turns**: 2/13 — hand shuffle + misclick turns where my intended play didn't execute.
- **Obvious racing turns**: 2/13 — enemy at low HP, just dump AP to finish.

The "charge vs quick" decision IS meaningful on attack turns because of the chain mechanic, but because the chain isn't explained on screen, I spent the first 1.5 combats treating the decision as random. Once I internalized the pattern it became interesting — but 1.5 combats is a lot to burn through fog before the core interaction clicks.

## Objective Findings

| ID | Check | Result | Notes |
|----|-------|--------|-------|
| O-FE1 | No dead turns | **FAIL** | Hand index shuffled between plays in same turn. I intended a Strike, played a Block because "position 1" changed. No UI warning. |
| O-FE2 | No mandatory turns | **PASS** | Every turn had 2+ cards I could choose between. |
| O-FE3 | Post-combat clarity | **FAIL** | The reward room altar visually shows cards on it, but `getRewardChoices()` returned `[]`. No obvious way to read or interact with the offered card. I accepted blindly. Only found out later that a card HAD been added by seeing `cardId: "reward_..."` in combat 2's hand. |
| O-FE4 | No unexplained state changes | **FAIL** | Enemy `displayDamage` went 15 → 17 → 22 within one combat with no visible reason. My Strike damage went 7 → 14 → 4 → 11 within one combat with no visible reason (chain mechanic, never labeled on screen). Masteries silently upgraded mid-combat. |
| O-FE5 | Reward screen has choices | **FAIL** | Even if 3 cards were visually shown, from a player-interaction standpoint there was no choice to make — just "Accept". No "pick 1 of 3". |

4 out of 5 objective checks fail for a first-time-ish player.

## Subjective Assessments

| ID | Check | Rating | Notes |
|----|-------|--------|-------|
| S-FE1 | First 60s excitement | **2/5** | The art is lovely, but cold-start render delay + FPS drops + mysterious 0-turn debuff text poisoned the opening seconds. |
| S-FE2 | Card choice depth | **3/5** | Real tradeoffs on attack turns (charge vs quick, chain planning), but blocking/defending turns are often single-choice. The Piercing card not doing what its name implies is a trust-killer. |
| S-FE3 | Quiz integration feel | **4/5** | **This is actually the best part of the game.** Reading the LEGO question, instantly knowing "Leg Godt", watching the Strike charge and fire — that loop felt SPECIFIC and SMART. I wanted more of that feeling. Quiz + combat is the reason the game could be great. It's just undermined by the other issues. |
| S-FE4 | Progression reward | **2/5** | Silent card reward, silent mastery ups, silent gold gain, silent FPS drop — the game doesn't celebrate anything. |
| S-FE5 | Clarity of feedback | **1/5** | Damage numbers are non-deterministic from a new player's perspective. Nothing on screen tells you WHY the number changed. The chain mechanic, the mastery level, the tier system — none of it surfaces unless you dig in the API. |
| S-FE6 | Pacing | **2/5** | Combats 1 and 2 were fine (3-4 turns). Combat 3 was dragging at 5+ turns with no end in sight — too long for floor 1. Also, the *mental* pacing is fine but the *render* pacing is bad (low FPS = laggy feel). |
| S-FE7 | One more turn | **3/5** | I was genuinely interested after combat 1's big Frege strike moment. That "oh this gets BIG" spike is the kind of hook roguelikes live on. But combat 3 smothered the momentum. |
| S-FE8 | Learning curve | **2/5** | I figured out ~60% of mechanics by watching state. A new player without the API would be guessing for a full run. No tooltips, no glossary, no "new player hint" panel that I saw. |

**Average subjective rating: 2.4 / 5.**

## Issues Found

### CRITICAL
*(none — nothing soft-locks or crashes the game)*

### HIGH

1. **[H1] Combat FPS 11-31 during normal play.** `look()` returned a stream of FPS alerts: `Low FPS alert: 11 fps in CombatScene for 2172s`, `21 fps for 2111s`, etc. On SwiftShader inside Docker this is expected to be ~30% slower than native, but single-digit-teens FPS on floor 1 with a single enemy and 5-card hand is alarming. The cold-start delay where only the background rendered suggests the overlay compositor is fighting for frame budget. Players on lower-end hardware will see 5-10 FPS and refund.

2. **[H2] Piercing card does not pierce block.** Card `mechanic: "piercing"`, `type: "attack"`, `baseEffectValue: 6`. Played charge-correct against an enemy with 9 block: consumed 6 block, dealt 0 HP damage. A card literally named "Piercing" that is mechanically identical to "Strike" is a trust-breaker. Either the mechanic is bugged, or the name is misleading, or the effect requires a chain/setup I wasn't told about. Any of those is a HIGH-severity player-trust issue.

3. **[H3] Quiz data has unsubstituted template braces.** The Spawn sales-record fact returned choices `["{1984}", "{8.5}", "1.7", "{2003}"]`. Three of four distractors have literal curly braces from an un-executed template substitution. This is visible to every player who draws that fact. Instant "this is broken software" reaction. (Also a Quiz Quality bug, but from a fun/engagement standpoint it's the #1 most immersion-breaking thing I saw.)

4. **[H4] Reward room displays 3 cards visually but API exposes no choices.** I saw three cards arranged on the altar, expected to pick one, but `getRewardChoices()` returned `[]` both times. The game silently added a `reward_` card to my deck on accept. If that's a DOM-click bug on the Phaser scene's card buttons, a player who never clicks a card ends up with whatever the first-or-random one was. Critical UX gap between "3 cards drawn on screen" and "one card silently added to deck."

5. **[H5] `displayDamage` telegraphed value changes mid-turn with no explanation.** Page Flutter's Swooping Strike went 15 → 17 → 22 across consecutive combat states. Maybe it scales with chain, enemy status, player block level, or enemy strength stacking — but a player sees "this number is lying to me." At minimum the intent bubble needs to show the formula or the source of the bonus.

### MEDIUM

6. **[M1] Hand index shuffles between plays in a single turn, causing misclicks.** When I played card 0, the remaining hand re-indexes. My "play the strike at position 1" intent became "play the block at position 1" on the next play. The game gives no indication that position has changed. This is a position-based API issue; the Svelte UI presumably handles this with per-card IDs, but from an interaction standpoint you can end up with "I wanted a strike, you played a shield" with no warning.

7. **[M2] Strength buff showing `turnsRemaining: 9998` is visually a bug.** The Screeching telegraph said "2 turns". The resulting status effect reported 9998 turns (and 9997 after one end-turn). Either it's permanent (then display it as ∞) or the countdown is broken. Either way, players will see a gigantic number and think the game is broken.

8. **[M3] Intent text "Applies 5 strip_block for 0 turns" is unreadable.** A `0` where the player expects a duration looks like a bug. Either "immediately" or "(no duration)" or dropping the suffix entirely would read correctly.

9. **[M4] No chain multiplier UI feedback despite being the most important offensive mechanic.** The Strike that dealt 14 damage and the Strike that dealt 4 damage look identical to a new player. There's an "Azure chain" label in the bottom-left hint bar but nothing shows the *current* multiplier or the *pending* bonus. This is the biggest "why did the numbers change?" problem in the session.

10. **[M5] Page Flutter respawns as the very first AND second enemy.** Seeing the same enemy art, same name, same telegraph bubble in encounter 1 AND encounter 2 destroys the "I'm exploring a dungeon" fantasy. Even if they drop different loot, the player feels like they're fighting a placeholder twice. Needs either a name variation ("Greater Page Flutter"), a color swap, or better node diversity.

### LOW

11. **[L1] The post-combat transition shows a black/empty room for 3 seconds before reward UI loads.** It's the same cold-start-delay feel that hit combat intro. A simple "Victory!" banner or XP pop-up during that 3s would mask the load.

12. **[L2] "Mastery up" events are completely silent.** Leo Breiman went from mastery 0 → 1 → 2 → 3 across my session. Every time felt like it should have been a moment — a flash on the card, a small chime, "Mastery 2!" text. Instead I only found it by inspecting the API. This is free juice the game is leaving on the table.

13. **[L3] Card art is too generic to distinguish mechanics at a glance.** All 5-cards-in-hand look like reddish tiles with a keyword label. In actual play I'd want the card art to instantly communicate "attack" vs "block" vs "utility" vs "pierce" without reading the tiny keyword. The hand is where the game's art investment needs to pay off most; right now it's the least-distinct layer.

14. **[L4] Spawn-into-combat transition doesn't render enemy sprite in first frame.** Related to FPS issue but worth calling out: `__rrPlay.spawn({screen:'combat'})` gets the background up first (5-layer motion-trail enemy container at α:0.00, then fading in). A player triggering a real map→combat transition would see the same "empty crypt" for a beat before the enemy appears. Amplify the entry VFX or pre-cache.

## Notable Moments

### Highlights
- **[HIGHLIGHT] Staple Bug room reveal.** Opening combat 3 and seeing the completely new art environment — mail-room basement with actual staplers on shelves, an office-supply spider in the doorway — was the single best moment of the session. This is the game at its best: room-level storytelling, clever enemy concepts, art that rewards attention. Ship more of this.
- **[HIGHLIGHT] The "Frege 14-damage" spike.** Turn 2 of combat 1, the charge-Strike that landed for 14 damage was the one moment I felt "oh, THIS is what the game wants me to chase." The chain multiplier paying off visibly was genuinely exciting. Had my Steam-reviewer brain going "if every combat ended in a 14-damage finisher moment, this game slaps."
- **[HIGHLIGHT] Quiz-into-combat flow for a fact I knew.** Reading "LEGO comes from which Danish phrase" and knowing "Leg Godt" instantly, then seeing it translate to a charged Strike, is the core loop that makes Recall Rogue Recall Rogue. When it fires, it REALLY fires. The game has a reason to exist.

### Lowlights
- **[LOWLIGHT] Piercing charge-played for zero net damage.** The moment my "obviously-pierces-block" card did nothing the name implied was when my trust in card descriptions cratered. Can't overstate how damaging this is to the feel of the game.
- **[LOWLIGHT] The `{1984}` / `{8.5}` / `{2003}` quiz choices.** Seeing literal curly-brace template placeholders in production quiz data is a "this game is half-built" moment. Took me out of the experience cold.
- **[LOWLIGHT] Silent reward room.** Three cards on the altar, pillar of light, torchlight ambiance — perfect setup for a "which card do you want?" decision. Instead, I accepted and transitioned to the map with no feedback. The contrast between the art investment and the interaction vacuum was jarring.

## Creative Pass

1. **"While I was in there…"** — The `turnsRemaining: 9998` thing is almost certainly a sentinel value for "persistent" that should display as `∞` or `while in combat`. That's a one-line formatter change in the status-effect render path and would stop players from thinking strength is broken. Green-zone, ship it.

2. **"A senior dev would…"** — The single biggest fun-engagement problem I saw isn't any one bug — it's that **the game gives the player no feedback loop to understand WHY numbers are changing.** Chain ramps damage (invisible). Mastery levels up cards (silent). Block absorbs specific amounts (no breakdown). Strip_block shows `0 turns`. The underlying systems are real and interesting, but they're hidden behind opaque numbers. A floating "combo x1.5!" callout, a mastery-up sparkle, an expanded intent tooltip that shows "9 base + 1 strength × 2.5 chain = 22" — none of this requires new content, just exposing what the game is already doing. This is the cheapest path to a PASS verdict.

3. **"Player would want…"** — After combat 1 ended I expected a "cards you strengthened" screen — the one showing Leo Breiman 0 → 1 and Dong Nguyen 0 → 1 from facts I recalled correctly. That's the Anki-faithful "I learned something" loop that the marketing will lean on. Right now it's invisible; all mastery progress happens silently in the combat state. A tiny post-combat "study progress" panel would reinforce the game's identity with zero rebalance work.

## What's Next

**Form A — more work recommended.**

1. **Ship chain multiplier UI feedback.** Damage variability is the #1 "why is this happening" complaint. Float a `x1.5 chain` tag on the damage popup; highlight the current chain state in the chain bar. One afternoon's work for a huge clarity win.
2. **Fix the Piercing mechanic OR rename it.** Either make it actually bypass block like the name implies, or rename it ("Shred", "Ablation") so the name doesn't promise what it doesn't deliver. Player trust is the stake.
3. **Resolve the quiz template-brace bug in the Spawn fact (and audit the full corpus for `{` / `}` characters).** One broken-looking quiz is one-star review material. Grep the deck source for unescaped substitution tokens.
4. **Investigate floor 1 FPS.** 11-31 FPS inside combat on SwiftShader is a red flag. On a real player's GPU this should be 60+; if it's not, post-launch refunds will cite performance. Profile the CombatScene, check particle emitter children, check the 5-layer enemy motion trail at α:0.00 (those could be running pointlessly).
5. **Make the reward room exchange explicit.** If three cards are shown, three cards must be clickable with a "Pick one" prompt. If only one is offered, don't decorate the altar with three. The current state has the worst of both worlds.

---

*Session duration: ~15 minutes of combat play, 13 turns across 3 encounters. Data captured via `scripts/docker-visual-test.sh --warm test --actions-file` — 19 batches, all actions-files under `/tmp/rr-actions-BATCH-2026-04-12-001-fun-*.json`, all results under `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-04-12-001_*`.*
