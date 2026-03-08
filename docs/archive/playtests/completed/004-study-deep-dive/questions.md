# Playtest 004: Study System Deep Dive

10 targeted questions probing the study/review system's edge cases, UX, and SM-2 tuning.

---

## Q1: Leech Rescue Mission

### Setup
- **Preset**: `many_reviews_due`
- **Injections**: After loading, inject 3 facts with `lapseCount=7` (one below `SM2_LEECH_THRESHOLD` of 8) by modifying save state via `getSave()` then manipulating `reviewStates`.

### Protocol
1. Start study session (10 cards).
2. When a near-leech fact appears, press "Again" to push it to `lapseCount=8`.
3. Observe: does the card get suspended? Does GAIA warn about leeches?
4. End session, navigate to StudyStation.
5. Check the "Suspended" tab -- are the leeched facts there?
6. Unsuspend one fact.
7. Start another study session -- does the unsuspended fact appear as relearning?

### Observe / Measure
- Leech detection fires at `lapseCount=8`
- GAIA warning message shown (supportive tone)
- Suspended tab accessible and lists leeched facts
- Unsuspend resets fact to relearning state

### Success Criteria
- **PASS**: Leech detected at `lapseCount=8`, unsuspend flow works end-to-end, GAIA provides supportive message
- **FAIL**: Leech not detected, suspended tab missing/empty, unsuspend does not reset state, or GAIA message absent

### Output File
`results/q1-leech-rescue.md`

---

## Q2: Activation Cap Ceiling

### Setup
- **Preset**: `many_reviews_due` (save has enough facts to hit activation cap)
- **Injections**: None required; preset should have sufficient facts.

### Protocol
1. Navigate to StudyStation, check Active tab count vs cap display.
2. Go to Discovered tab, try to activate a fact when at cap.
3. Observe: is there a clear message about being at cap?
4. Use `fastForward(720)` (30 days) to push some facts to mastery.
5. Check if cap increased (formula: `5 + floor(masteredCount / 5)`).
6. Try activating again -- does it work now?

### Observe / Measure
- Cap value clearly communicated in UI
- Cap increases with mastery count per formula
- Activation succeeds after cap increase
- Error/info message when at cap is user-friendly

### Success Criteria
- **PASS**: Cap message shown, formula `5 + floor(masteredCount/5)` works correctly, UX is clear
- **FAIL**: No cap message, formula incorrect, activation silently fails, or UI gives no feedback

### Output File
`results/q2-activation-cap.md`

---

## Q3: Re-Queue Frustration Test

### Setup
- **Preset**: `many_reviews_due`
- **Injections**: None.

### Protocol
1. Start 10-card study session.
2. Press "Again" on 5 of the first 10 cards.
3. Continue through re-queued cards, count total cards seen.
4. Track: does any card appear more than 3 times total?
5. On re-queued cards, note if they feel easier the 2nd/3rd time.
6. Record emotional response: tedious or helpful?

### Observe / Measure
- Total cards seen in session
- Max appearances per card (expected: <=3 -- original + 2 re-queues)
- Subjective helpfulness rating (1-5)
- Whether session length feels proportional

### Success Criteria
- **PASS**: Max 2 re-queues per card enforced, session does not exceed ~15 cards for a 10-card session, re-queues feel productive
- **FAIL**: Card appears 4+ times, session balloons past 20 cards, or re-queues feel tedious/punishing

### Output File
`results/q3-requeue-frustration.md`

---

## Q4: Seven-Day SM-2 Drift

### Setup
- **Preset**: `post_tutorial`
- **Injections**: Inject 15 facts at various intervals (some new, some with 1-3 prior reps).

### Protocol
1. Record initial ease factors and intervals for all 15 facts.
2. Loop 7 times:
   a. `fastForward(24)` to advance one day.
   b. Start study session, review all due cards.
   c. Grade realistically: 60% Good, 25% Okay, 15% Again.
   d. Record ease factors, intervals, and card states after each day.
3. After 7 days, analyze: any ease below 1.5? Any runaway intervals? Again rate trend?

### Observe / Measure
- Daily ease factor distribution (min, max, mean)
- Interval growth curve per fact
- Again rate per day (target: 8-15%)
- Count of facts with ease < 2.0

### Success Criteria
- **PASS**: No ease death spiral (no fact below 1.5), intervals grow predictably, again rate stays 8-15%
- **FAIL**: Any fact drops below ease 1.5, intervals explode (>60 days after 7 reps), or again rate trends above 20%

### Output File
`results/q4-sm2-drift.md`

---

## Q5: Morning/Evening Ritual Motivation

### Setup
- **Preset**: `post_tutorial`
- **Injections**: None.

### Protocol
1. Use `fastForward()` to set game time to 8 AM (morning window: 7-11 AM).
2. Start study, complete 5 cards.
3. Check: ritual bonus claimed? Dust awarded? O2 tank added? GAIA message?
4. `fastForward()` to 3 PM (outside both windows).
5. Study 5 more cards -- verify NO ritual bonus.
6. `fastForward()` to 8 PM (evening window: 7-11 PM).
7. Study 5 more cards -- check evening bonus.
8. Record all GAIA messages and rewards.

### Observe / Measure
- Morning bonus granted (25 dust + 1 O2 tank)
- No bonus outside ritual windows
- Evening bonus granted
- Messaging clarity -- can user tell when they are in a ritual window?

### Success Criteria
- **PASS**: Both ritual windows work, rewards are meaningful, user can tell when they are in a ritual window
- **FAIL**: Bonus granted outside window, bonus missing inside window, or no indication of ritual window status

### Output File
`results/q5-ritual-motivation.md`

---

## Q6: Category Interleaving Quality

### Setup
- **Preset**: `many_reviews_due` (has mixed vocab Japanese + general science facts)
- **Injections**: None.

### Protocol
1. Start 20-card study session.
2. For each card, log: card index, factId, category (Language/Life Sciences/Natural Sciences/etc), content type (vocab/fact).
3. Count max consecutive same-category cards.
4. Note any jarring transitions (e.g., Japanese word -> geology -> Japanese word).
5. Assess: does mixing help or hurt focus?

### Observe / Measure
- Max consecutive same-category cards
- Category distribution across session
- Jarring transition count
- Subjective focus rating (1-5)

### Success Criteria
- **PASS**: No more than 4 consecutive same-category, reasonable category spread, interleaving does not feel chaotic
- **FAIL**: 5+ consecutive same-category, one category dominates >70% of session, or interleaving feels disorienting

### Output File
`results/q6-interleaving.md`

---

## Q7: Mnemonic Escalation Path

### Setup
- **Preset**: `many_reviews_due`
- **Injections**: Inject 3 facts with `wrongCount=2` (one below `STRUGGLE_WRONG_THRESHOLD` of 3).

### Protocol
1. Start study session.
2. When a `wrongCount=2` fact appears, press "Again" (pushing `wrongCount` to 3).
3. Check: does mnemonic hint appear? (`getStudyCardText()` should show mnemonic field.)
4. In next session, fail the same fact again (`wrongCount=4`).
5. Check: does GAIA escalate to "different angle" message?
6. Fail again (`wrongCount=5+`) -- check for "suggest study session" escalation.
7. Record all mnemonic text and GAIA messages.

### Observe / Measure
- Mnemonic appears at `wrongCount=3` threshold
- GAIA escalation progresses correctly through tiers
- Mnemonic content is relevant to the fact
- Messages feel supportive, not punishing

### Success Criteria
- **PASS**: Escalation triggers at correct thresholds, mnemonics are helpful, GAIA feels supportive
- **FAIL**: Mnemonic missing at threshold, escalation skips tiers, mnemonic is irrelevant, or tone is punishing

### Output File
`results/q7-mnemonic-escalation.md`

---

## Q8: High-Backlog Throttle Experience

### Setup
- **Preset**: `many_reviews_due`
- **Injections**: Use `fastForward()` to create 25+ overdue reviews. Ensure 10 discovered (not yet activated) facts exist.

### Protocol
1. Check `getAdaptiveNewCardLimit()` -- should return 2 (high backlog).
2. Start study session -- count how many new cards appear (should be 0-2).
3. Grade all cards "Good" to clear backlog.
4. `fastForward(24)` to next day.
5. Start another session -- new cards should now appear (limit should be 3-5).
6. Record new card counts in both sessions.

### Observe / Measure
- New cards suppressed when backlog is high (0-2 new cards)
- New cards restored after clearing backlog (3-5 new cards)
- Adaptive limit matches formula
- User confusion level -- is throttle explained anywhere?

### Success Criteria
- **PASS**: Throttle activates correctly, user does not feel confused about missing new cards, limit recovers after clearing
- **FAIL**: New cards not throttled during high backlog, throttle never releases, or user has no way to understand why new cards are missing

### Output File
`results/q8-backlog-throttle.md`

---

## Q9: Consistency Penalty Cross-System

### Setup
- **Preset**: `many_reviews_due`
- **Injections**: None.

### Protocol
1. Start study session, grade 5 facts as "Good" -- note which factIds.
2. End study session.
3. Start a mine dive (`startDive()`).
4. Mine blocks until a pop quiz triggers.
5. If the quiz fact matches one just studied, deliberately answer wrong.
6. Observe: O2 penalty (should drain 6 extra O2)? GAIA consistency warning shown?
7. After dive, check the fact's `reviewState` -- was ease penalized extra (-0.15 on top of -0.20)?
8. If quiz fact does not match studied facts, continue mining until one does (or note that matching is unlikely with current pool size).

### Observe / Measure
- Consistency penalty triggers on study-then-mine fail
- O2 cost is 6 (extra penalty)
- Ease drops by -0.35 total (base -0.20 + consistency -0.15)
- GAIA consistency warning message shown

### Success Criteria
- **PASS**: Penalty system works cross-system, feedback is clear, feels like fair accountability
- **FAIL**: Penalty does not trigger, O2 cost wrong, ease penalty incorrect, or no GAIA feedback

### Output File
`results/q9-consistency-penalty.md`

---

## Q10: Study Score Feedback Loop

### Setup
- **Preset**: `post_tutorial`
- **Injections**: 20 facts at various review states.

### Protocol
1. Check initial study score via `getStats()` -- note tier (diligent/average/neglectful).
2. Simulate 3 neglectful days: `fastForward(24)` x 3, NO study sessions.
3. Check score again -- should have dropped.
4. Simulate 3 diligent days: `fastForward(24)` + study all due cards each day.
5. Check score -- should have recovered.
6. Compare artifact quiz chance at each score level (via game state).

### Observe / Measure
- Score drops with neglect (quantify drop per day)
- Score recovers with diligence (quantify recovery per day)
- Tier transitions at correct thresholds
- Adaptive quiz chance responds to score changes

### Success Criteria
- **PASS**: Score accurately reflects behavior, recovery is achievable within 3 days, system feels motivating not punishing
- **FAIL**: Score does not drop with neglect, recovery takes >5 days, tier thresholds wrong, or quiz chance unaffected

### Output File
`results/q10-study-score.md`
