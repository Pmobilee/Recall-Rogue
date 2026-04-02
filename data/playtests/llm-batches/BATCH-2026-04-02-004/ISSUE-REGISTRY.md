# BATCH-2026-04-02-004 — Complete Issue Registry

All issues from the full 5-tester LLM playtest batch, with exact file paths, line numbers, and reproduction context. Organized for handoff to a fixing agent.

**Date**: 2026-04-02 | **Batch**: BATCH-2026-04-02-004 | **Testers**: 5 (quiz-quality, balance-curve, fun-engagement, study-temple, full-run)

---

## Issue Categories

| Category | Count | Description |
|----------|-------|-------------|
| Test Infrastructure (API) | 5 | Bugs in `playtestAPI.ts` and missing test hooks — players unaffected |
| Balance | 3 | Enemy scaling, fizzle ratio, combat length |
| Content Quality | 2 | Distractor selection pulling wrong-domain answers at runtime |
| UX Polish | 2 | Animation blocking, reward phase clarity |

---

## CRITICAL (1)

### C-1: `fastForward()` uses wrong FSRS field names — zero scheduling effect
- **File**: `src/dev/playtestAPI.ts:946-963`
- **Problem**: Shifts `nextReview` / `lastReview` fields, but FSRS actually uses `nextReviewAt` / `lastReviewAt`
- **Impact**: `fastForward()` has zero effect on study card scheduling — makes SM-2/FSRS testing impossible via the API
- **Fix**: Rename field references to `nextReviewAt` / `lastReviewAt`
- **Source**: Study Temple tester
- **Player impact**: None — API-only bug
- **Effort**: Trivial

---

## HIGH (5)

### H-1: Enemy damage doesn't scale floors 1→2→3
- **File**: `src/data/enemies.ts` — enemy definitions for floor 1-3 enemies
- **Problem**: Floor 2 enemy (Overdue Golem) deals less damage than floor 1 enemies. Non-monotonic scaling. All floor 1-3 enemies deal 2-9 damage/turn, trivially absorbed by a single Block card.
- **Impact**: Zero tension in early floors. Combat ends in 2-4 turns instead of target 4-7.
- **Fix**: Audit floor 1-3 enemy intent values. Raise attack damage and HP. Target: floor 1 = 5-8 dmg, floor 2 = 8-12 dmg, floor 3 = 12-18 dmg. Enemy HP should be 45-70 for 4-7 turn combats.
- **Source**: Balance Curve tester, Fun/Engagement tester (converging)
- **Related**: M-3 (combat too short)
- **Effort**: Low — data tuning

### H-2: Charge wrong (fizzle) beats quick play damage
- **File**: `src/data/balance.ts:572` — `FIZZLE_EFFECT_RATIO = 0.5`
- **Problem**: Was buffed from 0.25 → 0.5 on 2026-04-01. At high chain multipliers, `chargeCorrectValue × 0.5` exceeds `quickPlayValue`. Balance tester measured fizzle=4 vs quick=2-3.
- **Impact**: Wrong answers should never deal MORE damage than not quizzing at all. Undermines the knowledge-as-power core mechanic.
- **Fix**: Either revert to 0.25, or apply fizzle to quickPlayValue (not chargeCorrectValue). Audit in `src/services/cardEffectResolver.ts` — check which base value fizzle multiplies.
- **Source**: Balance Curve tester, Fun/Engagement tester (converging)
- **Effort**: Low — audit + constant change

### H-3: `acceptReward()` fails on relic-only rewards
- **File**: `src/dev/playtestAPI.ts:474-486`
- **Problem**: Relic handling emits `pointerdown` on sprite, then calls `getCardDetailCallbacks().onAccept()`. But for relics, the overlay shows a Phaser `Graphics` accept button, not the Svelte card detail overlay. `getCardDetailCallbacks()` returns null → relic never accepted.
- **Impact**: Automated full-run testing can't progress past relic-only reward rooms. Players unaffected.
- **Fix**: Add a Phaser-level relic accept path — emit the overlay's accept button's pointerdown event directly, or add a dedicated `acceptRelic()` method.
- **Source**: Fun/Engagement tester, Full Run tester (converging)
- **Effort**: Medium

### H-4: EventQuiz.svelte choice buttons missing `data-testid`
- **File**: `src/ui/components/EventQuiz.svelte:159-168`
- **Problem**: Choice buttons are `<button class="choice-btn">` with no `data-testid` attribute. Automated testers can't click quiz answers during mystery events → permanent lock.
- **Impact**: Full-run automation blocked at mystery quiz events.
- **Fix**: Add `data-testid="quiz-answer-{i}"` to each button (matching the pattern used in `QuizOverlay.svelte`).
- **Source**: Full Run tester
- **Effort**: Trivial — 1 line per button

### H-5: Rest room buttons invisible during `staggerPopIn` animation
- **File**: `src/ui/utils/roomPopIn.ts:47-51` (sets `pointerEvents: 'none'`), used in `src/ui/components/RestRoomOverlay.svelte:114-118` with `totalDuration: 2000`
- **Problem**: `staggerPopIn` sets `pointerEvents: 'none'` and `opacity: 0` on all elements, then staggers their appearance over 2 seconds. Automated testers (and fast human players) trying to click during this window find invisible, non-interactive buttons.
- **Impact**: Full-run automation gets stuck at rest rooms for up to 2s. Human players who click fast may also be confused.
- **Fix**: Either (a) add a `turbo`/`botMode` check that skips the animation, (b) reduce totalDuration, or (c) make the test harness wait for animation completion before interacting.
- **Source**: Full Run tester
- **Effort**: Low

---

## MEDIUM (5)

### M-1: Moai height fact — wrong-domain distractors at runtime
- **Fact ID**: `ww_mon_moai_paro_height`
- **Deck file**: `data/decks/world_wonders.json:3764-3788`
- **Problem**: The deck data has correct height-unit distractors ("3 metres", "20 metres", etc.), but the Quiz tester saw weight-unit distractors ("52,800 tonnes", "42,000 tonnes") at runtime. This means the `curatedDistractorSelector` is pulling from the wrong answer pool — likely matching on the Moai entity rather than the answer type.
- **Fix**: Audit `src/services/curatedDistractorSelector.ts` — ensure pool matching uses answer type (height), not just entity/theme.
- **Source**: Quiz Quality tester
- **Effort**: Medium — requires understanding the pool matching logic

### M-2: Neuschwanstein fact — wrong-domain distractors at runtime
- **Fact ID**: `ww_pal_neuschwanstein_disney`
- **Deck file**: `data/decks/world_wonders.json:2648-2672`
- **Problem**: Deck data has correct castle distractors ("Magic Kingdom Castle", "Snow White's Castle"), but Quiz tester saw World Wonders nicknames ("Mosi-oa-Tunya", "River of January") at runtime. Same root cause as M-1 — distractor selector pulling from wrong pool.
- **Fix**: Same as M-1 — audit `curatedDistractorSelector.ts` pool matching logic.
- **Source**: Quiz Quality tester
- **Effort**: Same fix as M-1

### M-3: Combat too short (2-4 turns instead of 4-7)
- **Related to**: H-1 (enemy damage scaling)
- **Problem**: Enemy HP 27-34 is too low. Player deals 8-20 damage/turn easily. All combats end in 2-4 turns.
- **Fix**: Raise floor 1-3 enemy HP to 45-70 range. See H-1.
- **Source**: Balance Curve tester
- **Effort**: Covered by H-1 fix

### M-4: Charge animation race condition — stale state on final kill
- **Problem**: When the final charge play kills an enemy, `chargePlayCard()` returns stale/zero damage because the combat end animation fires before the API reads the result.
- **Impact**: Automated testers see "0 damage" on the kill blow. Players unaffected (they see the animation).
- **Fix**: In `chargePlayCard()` implementation, capture damage before the combat-end transition fires.
- **Source**: Balance Curve tester
- **Effort**: Medium

### M-5: `getCombatState()` returns null briefly while `getScreen()` still returns 'combat'
- **File**: `src/dev/playtestAPI.ts:134-153`
- **Problem**: After enemy death, `activeTurnState` is cleared before `currentScreen` transitions away from 'combat'. Our guard (`if (!enemy || !turnState.playerState) return null`) returns null correctly, but the window exists.
- **Impact**: Automated testers must handle null return gracefully (they do now).
- **Fix**: Already mitigated by our null guard. Optionally make `getScreen()` transition synchronously with combat end.
- **Source**: Balance Curve tester, Full Run tester (converging)
- **Effort**: Already mitigated — optional further improvement

---

## LOW (9)

### L-1: Rome Metaurus — format mismatch distractor
- **Fact ID**: `rome_pun_metaurus`
- **Problem**: One distractor is a 5-emperor list vs. a single-person correct answer. Format mismatch makes the distractor obviously wrong.
- **Fix**: Replace with single-person distractor matching the answer format.
- **Source**: Quiz Quality tester
- **Effort**: Trivial — data fix

### L-2: Hindi language fact — format mismatch distractor
- **Fact ID**: `general_knowledge-hindi-fourth-language-world`
- **Problem**: "Bengali" (single word) used as distractor against a 3-language-list correct answer.
- **Fix**: Replace with 3-language-list distractors matching the answer format.
- **Source**: Quiz Quality tester
- **Effort**: Trivial — data fix

### L-3: Citation Needed enemy heals +9 but telegraphed +5
- **File**: `src/data/enemies.ts:695` — heal intent `value: 5`
- **Problem**: Enemy definition says heal=5, but Fun tester observed +9 HP heal in gameplay.
- **Fix**: Investigate if enrage bonus or other modifier is adding to heal value. If intentional, update telegraph. If not, fix the heal calculation.
- **Source**: Fun/Engagement tester
- **Effort**: Low — investigate + data or code fix

### L-4: ~~Rest Heal visible at full HP~~ — **NOT A BUG**
- **File**: `src/ui/components/RestRoomOverlay.svelte:44,65,67`
- **Status**: RESOLVED — `healDisabled = $derived(playerHp >= playerMaxHp)` already correctly disables the button. Button is visible but correctly grayed/disabled.

### L-5: Two reward phases without visual separator
- **Problem**: Sequential gold→card reward phases in rewardRoom don't have a clear visual transition between them.
- **Fix**: Add a brief flash or separator animation between gold collection and card selection phases.
- **Source**: Fun/Engagement tester
- **Effort**: Low — UX polish

### L-6: `endTurn()` fails after enemy death
- **Problem**: After enemy dies, the End Turn button is removed from DOM before the API can click it. `endTurn()` returns `{ok: false}`.
- **Impact**: API-only. Not a game bug.
- **Fix**: Add guard in `endTurn()` — if combat is over (no enemy), return `{ok: true, message: 'combat ended'}`.
- **Source**: Full Run tester
- **Effort**: Trivial

### L-7: CSP violation from playtest dashboard polling
- **Problem**: Every 30s, a request to `http://100.74.153.81:5175/api/game/cardback-updates` violates CSP and fails.
- **Impact**: Non-blocking console noise.
- **Fix**: Disable dashboard polling in bot mode, or add the URL to CSP allowlist.
- **Source**: Full Run tester
- **Effort**: Trivial

### L-8: `startStudy()` wrong DOM selectors
- **File**: `src/dev/playtestAPI.ts` — `startStudy()` function
- **Problem**: Looks for `data-testid="study-size-N"` buttons that only exist in the unmounted `StudySession.svelte` component.
- **Impact**: API-only. Workaround exists via `__rrScenario.spawn({ screen: 'restStudy' })`.
- **Fix**: Update `startStudy()` to use the Study Temple panel flow instead.
- **Source**: Study Temple tester
- **Effort**: Medium — needs new flow

### L-9: Study FSRS flip-card not connected to any screen
- **Problem**: `StudySession.svelte` (Anki-style flip-card with again/okay/good buttons) exists in code but is never mounted. Only `StudyQuizOverlay.svelte` (multiple-choice mastery quiz) is live on the `restStudy` screen.
- **Impact**: Phase 13.4 TODO — known incomplete feature. Not a bug.
- **Source**: Study Temple tester

---

## Recommended Fix Order for Agent

### Batch 1 — Trivial (< 5 min each, unblock automation)
1. **C-1**: Fix `fastForward()` field names in `playtestAPI.ts`
2. **H-4**: Add `data-testid="quiz-answer-{i}"` to `EventQuiz.svelte` buttons
3. **L-6**: Guard `endTurn()` against post-combat calls

### Batch 2 — Balance audit (< 30 min)
4. **H-2**: Audit fizzle ratio — check if 0.5× applies to charge or quick value in `cardEffectResolver.ts`
5. **H-1 + M-3**: Raise floor 1-3 enemy HP and damage in `enemies.ts`
6. **L-3**: Investigate Citation Needed heal overshoot

### Batch 3 — API improvements (< 1 hour)
7. **H-3**: Fix `acceptReward()` relic handling
8. **H-5**: Add turbo/botMode skip for `staggerPopIn` or wait logic
9. **L-8**: Update `startStudy()` selectors

### Batch 4 — Content quality (< 30 min)
10. **M-1 + M-2**: Audit `curatedDistractorSelector.ts` pool matching — deck data is correct but runtime pulls wrong-domain distractors
11. **L-1 + L-2**: Fix format-mismatch distractors in Rome and Hindi facts

### Not bugs / already fixed
- **L-4**: Rest Heal correctly disabled at full HP
- **L-9**: StudySession is Phase 13.4 planned work
- **M-5**: getCombatState null guard already working
