# Batch 003: AI Playtester API Shakedown

8 questions designed to test the full __terraPlay API while producing useful game feedback. Each question exercises different API methods and requires rich qualitative output.

---

## Q1: Blind Miner — First Impressions

**What we're testing**: Can a fresh player figure out the mine with zero context?

**Setup**: `new_player` preset (empty save, no tutorial memory)

**Protocol**:
1. Start on the base screen. Call `look()` and describe what you see.
2. Try to start a dive. What happens? Is it obvious how?
3. Once in the mine, mine 15 blocks using ONLY `look()` to decide direction — pick whichever direction seems most interesting based on the text description.
4. When a quiz appears, read ALL the text via `getQuizText()`. Try to answer based on the question alone (don't use answerQuizCorrectly). Note: does the question make sense? Are the choices plausible?
5. After 15 blocks or when O2 runs out, surface.

**Observe/Measure**:
- How many actions before you understood the mine layout?
- How intuitive was direction choice from `look()` output alone?
- Quiz content quality (every quiz: question text, choices, was correct answer obvious?)
- Any `validateScreen()` issues?

**Success criteria**:
- [ ] `look()` provides enough info to make meaningful decisions (not just random)
- [ ] At least 1 quiz encountered in 15 blocks
- [ ] No validateScreen issues found
- [ ] Worker produces a 2+ paragraph narrative about the experience

**Report style**: Write as if you're a real player describing your first time in the mine to a friend.

---

## Q2: The Study Skeptic — Card Quality Audit

**What we're testing**: Are study cards well-written? Do explanations help? Are there any broken cards?

**Setup**: `many_reviews_due` preset (lots of cards ready for review)

**Protocol**:
1. Navigate to study. Start a "deep session" (20 cards).
2. For EVERY card:
   a. Read the front via `getStudyCardText()` — is the question clear and unambiguous?
   b. Before revealing, try to guess the answer yourself
   c. Reveal — read the back. Was the answer what you expected?
   d. Read explanation and mnemonic if present. Are they helpful or generic?
   e. Grade the card (use your honest assessment: again if confusing, okay if mediocre, good if clear)
   f. Call `validateScreen()` after each card
3. Track: cards where front is confusing, cards where explanation is missing/unhelpful, cards with any text issues

**Observe/Measure**:
- Total cards reviewed
- Grade distribution (how many again/okay/good based on CONTENT QUALITY, not your knowledge)
- Number of cards with missing explanations
- Number of cards with unclear questions
- Any validateScreen issues

**Success criteria**:
- [ ] All 20 cards have non-empty question and answer text
- [ ] At least 80% of cards have explanations
- [ ] No "undefined", "NaN", or garbled text found
- [ ] Worker grades each card and explains why

**Report style**: Write a card-by-card mini-review. "Card 1: 'What mineral...?' — Clear question, good distractors. Explanation about crystal structure was helpful. Grade: Good." Then a summary of overall card quality.

---

## Q3: Speed Runner vs Explorer — Two Mining Styles

**What we're testing**: Does the mine reward different play styles? Is one dominant?

**Setup**: `mid_game_3_rooms` preset

**Protocol**:
1. **Run A — Speed Runner**: Start a dive. Mine straight down as fast as possible for 30 blocks. Use `aggressiveMiner` strategy. Record: blocks mined, dust earned, artifacts found, O2 remaining, quizzes hit.
2. Return to base. Record session summary.
3. **Run B — Explorer**: Start another dive. This time, mine in ALL directions — go left, right, up, and down. Explore the full width of each layer before descending. For 30 blocks. Record same metrics.
4. Compare the two runs.

**Observe/Measure**:
- Dust earned: Run A vs Run B
- Artifacts found: Run A vs Run B
- O2 remaining at end: Run A vs Run B
- Quizzes encountered: Run A vs Run B
- Which run felt more rewarding?

**Success criteria**:
- [ ] Both runs complete without errors
- [ ] There's a measurable difference between strategies
- [ ] Neither strategy is strictly dominant (both have tradeoffs)
- [ ] Worker describes which felt more fun and why

**Report style**: Side-by-side comparison with a narrative opinion on which was more enjoyable.

---

## Q4: The GAIA Whisperer — NPC Feedback Quality

**What we're testing**: Does GAIA provide meaningful, contextual feedback?

**Setup**: `mid_game_3_rooms` preset

**Protocol**:
1. Start on base. Check for GAIA messages via `getNotifications()` and `look()`. Record what GAIA says.
2. Start a dive. Mine 10 blocks.
3. When a quiz appears: answer CORRECTLY. Check `getQuizText()` for GAIA's reaction text. Record it.
4. Continue mining. On the NEXT quiz: answer INCORRECTLY. Check GAIA's reaction. Record it.
5. Surface and check for GAIA messages on base screen.
6. Start a study session (5 cards). After each card, check for any GAIA feedback.
7. Visit the dome — check each room for GAIA presence via `getNotifications()`.

**Observe/Measure**:
- All GAIA messages collected (exact text)
- Do correct/wrong quiz reactions differ meaningfully?
- Are GAIA messages context-appropriate? (study nudges on base, encouragement in mine, etc.)
- Any "undefined" or template-string GAIA messages?

**Success criteria**:
- [ ] GAIA reacts differently to correct vs incorrect answers
- [ ] At least 3 distinct GAIA messages encountered across the session
- [ ] No broken/template GAIA text
- [ ] Worker rates GAIA's personality on a 1-5 scale (helpful, annoying, charming, etc.)

**Report style**: Collect every GAIA quote and annotate whether it was helpful, generic, or misplaced. Write a "GAIA personality review" paragraph.

---

## Q5: The Bug Hunter — Exhaustive Validation Sweep

**What we're testing**: Can validateScreen() catch real issues? Are there any lurking bugs?

**Setup**: `post_tutorial` preset

**Protocol**:
1. Visit EVERY reachable screen. For each:
   a. Call `navigate(screen)` for each screen from `getAvailableScreens()`
   b. Call `validateScreen()` — log ALL issues
   c. Call `getAllText()` — scan for "undefined", "NaN", "[object Object]", empty strings
   d. Take note of any screen that feels broken or incomplete
2. Start a dive. Mine 20 blocks. Call `validateScreen()` after EVERY block.
3. Start a study session (5 cards). Call `validateScreen()` after every card.
4. Visit dome rooms. Call `validateScreen()` in each.

**Observe/Measure**:
- Total screens visited
- Total validateScreen() calls made
- Every issue found (exact text from issues[])
- Any getAllText() anomalies (bad text patterns)
- Any screens that returned empty or threw errors

**Success criteria**:
- [ ] At least 8 different screens visited
- [ ] At least 30 validateScreen() calls made
- [ ] Every issue categorized by severity (critical/high/medium/low)
- [ ] Worker provides a "bug density" score (issues per screen)

**Report style**: Structured bug report. List every issue with screen, severity, and reproduction steps. End with a health rating (A-F) for the app.

---

## Q6: The Time Traveler — SM-2 Interval Testing

**What we're testing**: Does fastForward() work? Do SM-2 intervals make sense over simulated time?

**Setup**: `many_reviews_due` preset

**Protocol**:
1. Start a study session. Review 5 cards. Grade: 2 as "good", 2 as "okay", 1 as "again".
2. Call `getSave()` and record the reviewStates for those 5 facts (intervals, ease, nextReview dates).
3. Call `fastForward(24)` — advance 1 day.
4. Start another study session. Which cards came back? Are they the ones you'd expect?
5. Review them. Grade all as "good" this time.
6. Call `fastForward(72)` — advance 3 more days.
7. Start another session. Which cards are due now?
8. Compare the SM-2 intervals: did "again" cards come back sooner? Did "good" cards stay away longer?

**Observe/Measure**:
- Card intervals after first review (per grade)
- Which cards returned after 1 day
- Which cards returned after 4 days total
- Are intervals increasing for "good" grades?
- Are "again" cards re-appearing quickly?

**Success criteria**:
- [ ] fastForward() actually changes which cards are due
- [ ] "Again" cards return sooner than "good" cards
- [ ] Intervals increase with repeated "good" grades
- [ ] No cards stuck at 0 interval or infinite interval

**Report style**: Timeline narrative. "Day 0: Reviewed 5 cards. Day 1: Cards X and Y returned (as expected — they were graded 'again'). Day 4: Card Z returned..."

---

## Q7: The Completionist — Full Game Loop

**What we're testing**: Does the full play loop (dive → study → dome → repeat) feel cohesive?

**Setup**: `mid_game_3_rooms` preset

**Protocol**:
1. Call `look()` on base screen. What's available?
2. **Dive 1**: Mine 25 blocks. Handle all quizzes. Surface.
3. Call `getSessionSummary()`. Record stats.
4. **Study**: Review all due cards (up to 10). Grade honestly based on the question quality.
5. **Dome tour**: Visit lab, workshop, and 1 other room. Check what's available in each via `look()`.
6. **Dive 2**: Mine 25 more blocks. Did anything change from dive 1? Different biome? Harder?
7. Final `getSessionSummary()`.

**Observe/Measure**:
- Total time (in actions) for the full loop
- Dust earned across both dives
- Facts learned/reviewed
- Did dive 2 feel different from dive 1?
- Which part of the loop was most/least engaging?

**Success criteria**:
- [ ] All three phases (dive, study, dome) complete without errors
- [ ] Worker can articulate which phase was most fun
- [ ] Dive 2 has some variation from dive 1
- [ ] Full loop takes less than 80 API calls total

**Report style**: Write a "play session diary" — a flowing narrative of the full loop as if writing a game review. Include a rating out of 10 for overall cohesion.

---

## Q8: The Stress Tester — Edge Cases & Rapid Actions

**What we're testing**: Does the API handle weird/rapid/edge-case inputs gracefully?

**Setup**: `post_tutorial` preset

**Protocol**:
1. Try mining when NOT in the mine. What happens? Does the API return a clear error?
2. Try answering a quiz when no quiz is active. Error message?
3. Try grading a card when not in study. Error?
4. Navigate to an invalid screen name. Error?
5. Start a dive, mine 3 blocks, then call `endDive()` immediately. Does it work?
6. Start a study session, grade 1 card, then `endStudy()`. Clean exit?
7. Call `look()` 10 times rapidly. Same result each time? Any errors?
8. Call `fastForward(0)`. Then `fastForward(-1)`. Then `fastForward(99999)`. What happens?
9. Call `getQuiz()` when no quiz is active — returns null cleanly?
10. Call `mineBlock('diagonal')` — invalid direction, should error gracefully.

**Observe/Measure**:
- Error messages for each invalid action (exact text)
- Did any call crash or hang?
- Were error messages clear and helpful?
- Did any edge case leave the game in a broken state?

**Success criteria**:
- [ ] All invalid actions return `{ ok: false, message: "..." }` (not crashes)
- [ ] Error messages are descriptive (not just "error" or empty)
- [ ] Game remains functional after all edge cases (can still look/mine/study normally)
- [ ] No hangs or timeouts

**Report style**: Test matrix with action, expected behavior, actual behavior, and PASS/FAIL. End with an API robustness score (A-F).
