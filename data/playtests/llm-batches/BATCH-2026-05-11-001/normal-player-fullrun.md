# Normal-Player Full Run — BATCH-2026-05-11-001

**Tester**: normal-player-fullrun
**Domain**: general_knowledge
**Goal**: Verify damage-scale change (1.60→1.07) doesn't make game too easy, reach Act 2 Room 2
**Commit context**: `8337003dd` — GLOBAL_ENEMY_DAMAGE_MULTIPLIER 1.60 → 1.07

## Verdict
**ISSUES** — Game is now CLEARLY too easy until the boss, then the run **softlocked at the boss-reward Yes/No modal** (cannot dismiss via DOM, API, or canvas event dispatch).

## Quick Stats
- Floors reached: **7** (defeated Floor-7 boss "The Algorithm", got stuck on its reward screen)
- Reached Act 2 Room 2: **NO** — softlocked on Act-1 boss reward modal before delve/retreat option
- Encounters completed: **5** (4 combat + 1 mystery + 1 rest + 1 shop + 1 boss = 7 nodes)
  - Combats: Staple Bug (49 HP), Overdue Golem (54 HP), Eraser Worm (52 HP), Ink Slug (84 HP), The Algorithm (144 HP — boss)
  - All five WON
- Final HP: **31 / 100**
- Final outcome: **softlock** after boss victory (could not progress to retreat/delve)
- Quiz accuracy this run: **~88%** by simulation (I called wrong on 1 charge intentionally, the rest correct because choices were mostly trivial — see content quality below)
- Total runtime: ~25 minutes in real time (130 batches)

## Subjective Feel Assessment

### Difficulty: **2/5** (was hoping for 3/5)
- The earlier 1.60 multiplier was clearly too high; 1.07 is now CLEARLY too low for floors 1–4.
- Enemy intents repeatedly land on `defend` / `debuff` / `heal` / `Memory wipe (0 dmg)` / `System scan (0 dmg)` — I got **multiple consecutive turns where the enemy did literally 0 damage**.
- The Algorithm (the boss) used "Self-repair" then "System scan" then "Memory wipe" — three turns of 0 damage. I never feared dying.
- Only HP loss came from one Ink Slug `Mud slash` (14 dmg, unblocked) and one Overdue Golem `Sludge swing` (12 dmg). Both were optional consequences of not blocking.

### Tension: **2/5**
- Only one "oh no" moment: Eraser Worm's `Mandible crush 14` while I was at 23 HP — I had to play perfectly to survive. Felt great.
- But that tension came from MY mistake (wasted a card on a misindexed shield), not from enemy power. Every other combat felt routine.
- The boss fight should have been climactic but felt like a long damage race because the boss spent most turns doing 0 damage.

### Card decisions: **3/5**
- Choices feel meaningful when I had 5+ AP and 3+ strikes (surge turns) — those were fun "spend it all" moments.
- BUT the hand reindexing is a serious problem: every time I play a card, every higher-index card shifts down by 1, but my plan was written against the old indices. **I made 4+ accidental shield/transmute plays when I meant to play strikes** purely because indices shifted between actions.

### Quiz integration: **2/5**
- The questions don't feel like a real part of the game — they feel like obstacles to ignore.
- A huge fraction of charge questions had **only one plausible answer** because the distractors were nonsense (see Content Quality section).
- I never had to think harder than "which of these four words is a fraction?" or "which name am I being asked about?"
- For a game whose CORE mechanic is "every card is a fact," the friction the player should feel between knowing-vs-not-knowing barely exists.

### Overall fun: **3/5**
- The combat rhythm (preview → charge → quick → end turn) is solid and fast.
- The audio/visual juice is good — strike animations, the surge effect, the chain-multiplier feedback all feel snappy.
- BUT: once it became obvious the enemies weren't dangerous, I stopped engaging with quiz answers seriously. I'd just charge whatever and trust the chain multiplier. The game lost me before the boss.
- Would I keep playing? Yes, to see Act 2 content. No, if Act 1 stays this loose.

## Combat Log

### Floor 1 — Staple Bug (49 HP) — VICTORY
- Multi-turn (5 turns due to indexing mishaps eating cards).
- Final HP: 73/100 (lost 27 across 5 turns, all from one `Chittering strike 14` that I couldn't block).
- Felt: very easy. Enemy spent 3 of 5 turns on `Harden shell` (0 dmg defend).
- Quiz: 4 correct (lion-witch-wardrobe, Rastafari, Hellespont, Watchmen=Alan Moore). Distractor for fraction-of-stars was nonsense.

### Floor 2 — Overdue Golem (54 HP) — VICTORY
- 5 turns. HP 73 → 42. Took 4× of `Sludge swing 12` unblocked because I kept misplaying shields as wasted clicks.
- Felt: routine.
- Quiz: 4 correct, 1 deliberate-wrong. Wrong-charge damage (3) feels too generous — charging blindly still nets bonus damage.

### Floor 3 — Skipped reward room got 30 gold from mystery
- The Floor-3 reward room handed me 3 card choices (Multi-Hit, Adapt, Scout). Picked Adapt (wild card).

### Floor 3 combat node #2 (Combat r1-n3) — same combat, see Golem.

### Floor 3 — Shop visit
- Bought Surge Capacitor for ~42g (advertised 52g — possible discount or display error).
- Now 38g, HP 42.

### Floor 4 — Eraser Worm (52 HP) — VICTORY (closest call)
- 4 turns. HP 42 → 23.
- Worm's `Bite frenzy 12` (4 hits) and final `Mandible crush 14` were the only real threats this run.
- I was 1 HP away from being one-shot by Mandible crush. Saved by a charge-strike that killed the worm with 1 HP to spare.

### Floor 5 — Mystery event
- Single-choice "Continue" mystery. Granted +30 gold.
- **Feels like wasted content** — no real choice. Just a flavor card with one button.

### Floor 6 — Rest room
- Healed 14 → 34 HP. Standard.

### Floor 7 — Boss: The Algorithm (144 HP) — VICTORY
- 7 turns. HP 34 → 31 (only lost 3 HP all fight!).
- Boss intent sequence: `Self-repair` → `System scan` (0 dmg) → `Data beam 7` → `System scan` → `Archive purge 8` → `Memory wipe` (0 dmg) → `Archive purge 8`.
- **Four of the 7 boss turns were 0-damage intents.** This is the END BOSS of Act 1. It should feel dangerous.
- Felt: anticlimactic. I rolled through it with one full HP bar left, never even using my Fortify reward card.

### After-boss: SOFTLOCK
- A Phaser-canvas Yes/No modal "Leave items behind?" appeared.
- No DOM button click on Yes, No, Continue, Accept, or Leave dismisses it.
- API calls `acceptReward()`, `delve()`, `mysteryContinue()`, `selectRelic(0)`, `selectRewardType('card')` all fail or return "Screen: rewardRoom" unchanged.
- Synthetic pointerdown/pointerup/click on the Phaser canvas at the Yes-button coordinates does NOT trigger Phaser's input system.
- **A normal player WITH A MOUSE would not hit this softlock**, but for headless / programmatic / testing this is broken. See bug #1 below.

## Bugs Found

### BUG #1 — CRITICAL (testability) — Boss reward Yes/No modal not dismissible via __rrPlay
- After defeating the Floor-7 boss, a "Leave items behind?" Yes/No confirm appears as a Phaser canvas overlay.
- The 3 DOM overlay buttons (Continue, Accept, Leave) are visible in DOM but clicks have no effect on screen state.
- The Phaser canvas Yes/No buttons cannot be triggered via dispatched PointerEvent/MouseEvent.
- `__rrPlay.delve()` returns "Delve button not found"; `selectRelic`/`acceptReward`/`mysteryContinue` are no-ops.
- **Impact**: ANY automated playtest that beats Act-1 boss cannot progress past this point. This blocks LLM playtests, RL agent training runs, and headless verification of the retreat/delve mechanic.
- **Repro**: full run, defeat The Algorithm, observe screenshot `20-after-canvas-click.rr.jpg`.
- **Suggested fix**: add an `__rrPlay.confirmLeave(true|false)` or expose the Phaser modal as a DOM-clickable element.

### BUG #2 — HIGH — Charge cost displayed as 1 AP but actually costs 2 AP
- Every card displays `apCost: 1` in `getCombatState()` and on the visual card.
- Quick play costs 1 AP. Charge play costs 2 AP. There is no UI indication of this delta.
- I repeatedly tried to charge cards when I had 1 AP and got "Not enough AP" errors.
- **Suggested fix**: show "1 AP / 2 AP charge" on the card OR show the actual charge cost on hover (already shown? — not in DOM I could find).

### BUG #3 — HIGH — Hand-index reshuffle after every play
- When a card at index N is played, all higher-index cards shift down. After 1-2 plays my mental model of the hand is desynced.
- Multiple times I called `quickPlayCard(2)` thinking it was a Strike and played a Shield/Transmute instead.
- **Impact**: every accidental play wastes AP, which compounded across combats added several turns.
- **Suggested fix for API**: take cardId not handIndex, OR return the actual played card type in the success response with a "did you mean X?" indicator. The UI may have drag-to-charge that solves this for mouse users but API users (RL/LLM) hit this constantly.

### BUG #4 — MEDIUM — Quiz distractors trivialized by category
- Stroke-cases-per-100K question had **only one choice** ("213 cases") returned by `previewCardQuiz` — possibly a content bug where the pool only contains the correct answer.
- Stars-Arabic-names fraction question had distractors `["Homer's Iliad", "Guest star", "Halley's Comet", "Over half"]` — only one is a fraction.
- Herodotus question had `["Remember the Athenians", "Whipped the Hellespont 300 times", "Father of History", "Achaemenid Empire"]` — only one is an action.
- **Impact**: charge plays are nearly free damage because answers are trivially derivable from question grammar.
- **Suggested fix**: run a homogeneity check on every fact's distractor pool (the same type/grammar as correct answer).

### BUG #5 — MEDIUM — Boss intent loadout is way too defensive
- The Algorithm spent 4 of 7 turns on 0-damage intents (`Self-repair`, `System scan`, `Memory wipe`).
- Even at 1.07× damage multiplier the boss feels like a punching bag because half its turns deal no damage.
- **Suggested fix**: review The Algorithm's intent table. 50% non-damaging turns is too many for a boss. Maybe 20-30% non-damaging max.

### BUG #6 — LOW — Mystery event with single "Continue" choice
- The floor-5 mystery offered exactly one "Continue" button + a gold reward.
- It's labeled "Mystery event" on the map but has no real choice. Feels like a content slot wasn't filled.
- **Suggested fix**: either flesh out the event content or remove the "mystery event" label and call it "gold pile."

### BUG #7 — LOW — Shop relic price discrepancy
- Surge Capacitor listed at 52g. After purchase, gold dropped 80 → 38 (= 42g, not 52g).
- Possible: a relic-discount mechanic exists but isn't surfaced. Or display bug.

### BUG #8 — LOW — `previewCardQuiz` for some cards shows truncated choices
- One stroke-cases question returned `choices: ["213 cases"]` (single entry) — possibly the rest were lost in JSON encoding OR genuinely missing.
- The combat actually completed normally, suggesting the question worked, but the preview API was broken.

## Softlocks / Stuck States
1. **Boss-reward Yes/No modal** — see Bug #1 above. ~10 minutes of attempts could not dismiss.
2. **End-Turn confirm modal** — twice during Combat 1 the "End turn anyway?" confirm appeared when I still had AP. It was dismissible via the Cancel button, but the modal is jarring — it implies I shouldn't end turn but I had no good play left. UX-wise, a "you have 1 AP left, are you sure?" toast is friendlier.

## Console Errors of Note
**None.** `consoleErrors: []` on every batch (modulo benign `ERR_CONNECTION_REFUSED` not seen here). Clean run from an engine-error perspective.

## What a Normal Player Would Complain About
1. **"The enemies barely hit me."** — Across 4 normal combats + 1 boss, I lost 69 HP total over ~25 minutes. Most of that was from ONE Mud slash and ONE Bite frenzy. The boss took 3 HP off me total. This is way too easy.
2. **"I can't tell what I'm doing on the card."** — Charge vs quick AP cost not shown clearly. I'd play wrong cards then realize too late.
3. **"The quiz answers are obvious."** — When 3 of 4 choices are clearly the wrong category, the quiz isn't testing knowledge, it's testing reading comprehension.
4. **"What's the point of this mystery event?"** — One-choice "Continue" mystery feels like dev placeholder content.
5. **"Why did the boss heal turn 1 and just stand there?"** — The Algorithm's opener is `Self-repair` then `System scan` — the player gets two free turns of damage. Bosses should pressure immediately.

## Recommendations (priority-ordered)

1. **Fix the boss-reward softlock for headless testing** (Bug #1). Without this, no automated playtest can verify Act 2 content. This blocks balance regression testing.
2. **Re-tune enemy intent tables.** 1.07× damage is fine, but the issue is the *frequency* of 0-damage intents. Specifically: Staple Bug's `Harden shell`, The Algorithm's `Self-repair`/`System scan`/`Memory wipe`, Overdue Golem's `Peat decay` (debuff only). Reduce non-damaging intents to <25% of any enemy's intent table.
3. **Surface charge AP cost on the card itself** (Bug #2). "1 AP / 2 AP ⚡" or similar.
4. **Card-ID-based play APIs.** Add `quickPlayCardById(id)` and `chargePlayCardById(id, correct)` so automated players don't suffer from hand reindexing (Bug #3). Keep the index-based ones for compat.
5. **Run a distractor-quality pass on the quiz database** (Bug #4). Specifically: ensure all 4 choices share grammar/category with the correct answer. This is the single biggest quality issue affecting the "is this a learning game?" perception.
6. **Audit single-choice and content-deficient mystery events** (Bug #6).

## Self-Verification
- Report file: `data/playtests/llm-batches/BATCH-2026-05-11-001/normal-player-fullrun.md`
- Final getRunState: `{currency: 197, playerHp: 31, playerMaxHp: 100}`
- Final stats: `{totalQuizCorrect: 84, totalQuizWrong: 1, learnedFactCount: 10}` (cumulative across sessions)
- Relics acquired: Surge Capacitor (f2), Blood Price (f3), Chain Reactor (f4), Aegis Stone (f6)
- 130 docker-visual-test batches consumed; key screenshots in `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-11-001_none_*/`
- Console errors observed: ZERO across all 130 batches.
