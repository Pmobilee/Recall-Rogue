# Terra Miner Beta Playtest: Anki Integration & Core Mining Loop (v1)

**Purpose:** Validate the two most critical unknowns — does the SM-2/Anki integration actually teach players, and does the core mining loop feel fun and well-paced?

**Who:** Beta testers (non-developers, ages 14-45, mix of gamers and education-curious)

**Duration:** 7-day playtest window, minimum 5 sessions per tester

**How to use this document:** Each question below is a self-contained test. Pick the questions most relevant to your current priorities. For each, follow the playtest protocol exactly, collect the measurements listed, then check the success criteria.

---

## Category 1: Learning Efficacy (Q1-Q7)

---

### Q1: First-Contact Fact Retention

**What we're testing:** Whether facts encountered through artifact appraisal are retained after a 24-hour gap, validating that the mine-to-learn pipeline produces genuine first-exposure learning rather than just passive scrolling.

**The question (for tester):** "Think back to the facts you learned from artifacts during yesterday's session. Without looking, write down as many facts (question + answer) as you can remember. Then open the Study Station and check how many you actually got right. How many did you remember? How many surprised you when you saw them again?"

**Why this matters:** The entire game thesis is that mining creates emotional context for facts, making them stickier than flashcard drilling alone. If testers recall fewer than 30% of facts after 24 hours (before any review), the artifact appraisal reveal sequence is not creating sufficient encoding. This would mean we need to strengthen the emotional framing (wow factor, GAIA comment, rarity reveal animation) or add an immediate recall quiz right after appraisal.

**Playtest protocol:**
- **Setup:** Complete 2 full dives, collecting and appraising at least 8 artifacts. Tell the tester to pay attention to what they learn.
- **Step 1:** Record which facts the tester learned (factIds from the session).
- **Step 2:** 24 hours later (no reviews in between), ask the tester to free-recall as many facts as they can.
- **Step 3:** Then open Study Station and review those same facts. Track how many the tester rates "Okay/Good" vs "Again".
- **Observe/Measure:** Free-recall count / total learned. Self-rating accuracy. Whether high-rarity artifacts (epic/legendary with longer reveal animations) are recalled more often.
- **Success criteria:** 30%+ free recall after 24 hours. Higher-rarity facts recalled at higher rate than common facts.

**What we'd change based on results:**
- Below 20% recall: Add a forced immediate recall quiz right after artifact appraisal (ask the fact back before moving to next artifact). Lengthen the reveal animation for common/uncommon tiers.
- Rarity has no effect on recall: The gacha reveal animation is not creating differential encoding. Increase suspense duration and add a second viewing of the fact during the reveal sequence.
- Above 50% recall: Current system works well. Could reduce reveal animation durations without harming learning.

---

### Q2: SM-2 Interval Accuracy Over 7 Days

**What we're testing:** Whether the SM-2 algorithm's interval scheduling matches actual player retention — specifically, are cards coming back too early (wasting time) or too late (player has forgotten)?

**The question (for tester):** "Over the past week of playing, when a fact comes up for review, how often do you already know it before seeing the answer? Does it feel like the app is showing you facts at the right time, or do they come back too early (boring) or too late (you've forgotten)?"

**Why this matters:** SM-2 initial ease is 2.5 with graduating interval of 1 day. If these are wrong, the entire learning curve is off. Too-early reviews cause review fatigue (player bored by easy cards). Too-late reviews cause frustration (player forgot everything, hits "Again" constantly).

**Playtest protocol:**
- **Setup:** Tester plays naturally for 7 consecutive days, completing at least 1 study session and 1 dive per day. Start with 15 facts already in the system.
- **Step 1:** Days 1-3: Tester learns 5-8 new facts per day through artifacts. Reviews each morning.
- **Step 2:** Days 4-7: Track the "Again" rate during Study Sessions. Tester notes after each card whether they knew it before flipping.
- **Observe/Measure:** Daily "Again" rate. "Knew it before flip" percentage. Time spent per card. Whether ease factors are drifting down below 2.0 for most cards.
- **Success criteria:** "Again" rate between 8-15% (Anki's target). "Knew it before flip" rate between 70-85% for review-state cards. No more than 20% of cards with ease below 2.0 by day 7.

**What we'd change based on results:**
- "Again" rate above 25%: Graduating interval too aggressive. Change `SM2_GRADUATING_INTERVAL` from 1 to 2 days.
- "Knew it before flip" above 90%: Intervals too short. Increase `SM2_EASY_BONUS_MULTIPLIER` from 1.3 to 1.5, or raise initial ease from 2.5 to 2.7.
- Ease factors tanking: The lapse penalty (`easeFactor - 0.20`) is too harsh in a game context where pressure causes errors. Reduce lapse ease penalty from 0.20 to 0.15.

---

### Q3: Distractor Interference

**What we're testing:** Whether the 3-distractor multiple choice format creates false learning — testers recognizing the answer by elimination rather than genuinely recalling it, leading to inflated quiz scores but poor actual retention.

**The question (for tester):** "When you answer a quiz during mining, are you usually recalling the answer from memory, or are you eliminating wrong answers? Can you tell me about a time the wrong answers looked really similar and you had to guess? After guessing correctly on a quiz, did you actually remember that fact the next time it appeared?"

**Why this matters:** Each fact has 8-25 distractors, and the game shows 3 random distractors + the correct answer. If distractors are too obviously wrong, players learn to pattern-match rather than recall. If distractors are too similar, the quiz becomes a frustrating coin flip.

**Playtest protocol:**
- **Setup:** Enter a dive with at least 30 overdue review facts. Mine blocks until at least 5 pop quizzes trigger.
- **Step 1:** Screen-record the session. After each quiz, tester rates: "I recalled it" / "I eliminated wrong answers" / "I guessed."
- **Step 2:** Note which specific facts used which strategy.
- **Step 3:** The next day, in Study Session, track whether "eliminated" and "guessed" facts are rated "Again" more often than "recalled" facts.
- **Observe/Measure:** Percentage of answers by strategy. Next-day retention by strategy. Whether difficulty-5 facts have more guessing than difficulty-1 facts.
- **Success criteria:** "Recalled" is the primary strategy for 60%+ of quiz answers. "Guessed" facts have 50%+ "Again" rate the next day (showing the system self-corrects). Difficulty levels correlate with strategy distribution.

**What we'd change based on results:**
- Too much elimination (above 40%): Improve distractor quality. Distractors need to be semantically closer to the correct answer. Consider reducing from 4 choices to 3 for high-difficulty facts.
- Guessing produces correct SM-2 credit: Add a "How confident were you?" follow-up after mine quizzes, and scale the SM-2 credit by confidence.
- Difficulty levels not correlating: The `difficulty` field is not calibrated to actual player experience. Collect per-fact accuracy rates and auto-calibrate difficulty.

---

### Q4: Vocab vs. General Fact Mastery Pace

**What we're testing:** Whether the dual mastery thresholds (60 days for general facts, 30 days for vocab) match actual learning speed for each content type.

**The question (for tester):** "Do the vocabulary words feel like they're getting easier at a different rate than the science/history facts? Which type feels more rewarding to study? Which type do you wish came up less often?"

**Why this matters:** Vocab has a 30-day mastery threshold vs 60 days for general facts. If vocab is actually harder than general facts for this player population, the shorter threshold creates an illusion of mastery. Conversely, if general facts are trivially easy, 60 days is frustratingly slow.

**Playtest protocol:**
- **Setup:** Player plays naturally for 5+ days with at least 10 vocab and 10 general facts in their review queue.
- **Step 1:** Over 5 days, track per-category "Again" rates and ease factor trends.
- **Step 2:** On day 5, give the tester a surprise written test: 10 random learned vocab words and 10 random learned general facts, answer from memory (no choices).
- **Observe/Measure:** Written test accuracy by category. In-game "Again" rate by category. Average ease factor by category.
- **Success criteria:** Written test accuracy within 15 percentage points between categories. Ease factor averages within 0.3 of each other. Neither category dominates the "Again" pile.

**What we'd change based on results:**
- Vocab much harder: Increase vocab mastery threshold from 30 to 45 days. Add furigana/romaji hints to vocab quiz question text.
- General facts too easy: Decrease mastery threshold from 60 to 45 days. Or add harder distractors.
- One category dominates review queue: Add category-balancing to quiz selection (currently picks earliest-due regardless of category).

---

### Q5: Leech Detection Sensitivity

**What we're testing:** Whether the leech threshold (8 lapses before auto-suspend) catches genuinely problematic facts without being so aggressive that it suspends facts the player could eventually learn.

**The question (for tester):** "Have you noticed any facts that seem to keep coming back even though you can never remember them? How does it feel when GAIA says 'This one is proving difficult'? Would you prefer to keep trying, get extra help, or have the app skip that fact?"

**Why this matters:** `SM2_LEECH_THRESHOLD = 8` lapses triggers auto-suspend. But 8 lapses could represent weeks of frustration. The `STRUGGLE_WRONG_THRESHOLD = 3` triggers GAIA mnemonics early, but if the mnemonic itself is unhelpful, leeches accumulate silently.

**Playtest protocol:**
- **Setup:** Create a custom save with 5 facts deliberately set to `lapseCount: 6, easeFactor: 1.3` (near-leech). Do 2 study sessions.
- **Step 1:** Observe how many of the pre-leeched facts the tester gets wrong again. Note GAIA's mnemonic responses.
- **Step 2:** If a fact suspends (reaches 8 lapses), note the tester's reaction.
- **Step 3:** Ask: "Were the hints GAIA gave helpful for the facts you kept getting wrong?"
- **Observe/Measure:** Lapse-to-suspend conversion rate. GAIA mnemonic usefulness rating (1-5). Number of facts that recover from 6 lapses back to stable review.
- **Success criteria:** At least 30% of near-leech facts recover. GAIA mnemonics rated 3+ out of 5 for helpfulness. Tester does not express frustration at seeing near-leech facts repeatedly.

**What we'd change based on results:**
- Recovery rate below 20%: Reduce threshold to 5 lapses. Or add an "alternative question format" at 5 lapses (e.g., fill-in-the-blank instead of multiple choice).
- GAIA mnemonics unhelpful: Queue a content pass to improve mnemonics. Consider showing the explanation field more prominently after wrong answers.
- Tester frustrated by repeated failures: Add a manual "Skip this fact" button that appears after 4 lapses.

---

### Q6: Morning/Evening Ritual Adherence

**What we're testing:** Whether the time-windowed study bonus (7-11 AM and 7-11 PM, awarding +25 dust and +1 O2 tank) actually motivates players to build a daily review habit, or whether the windows are too narrow/poorly timed.

**The question (for tester):** "Have you used the morning or evening study bonus? If yes, did it change when you play? If no, why not — did you not know about it, or did the timing not work for your schedule? What time do you usually play?"

**Why this matters:** The ritual system is designed to anchor learning to daily habits. But if testers play during lunch or late night, they never see the bonus. The rewards may be too small to change behavior, or the windows too narrow.

**Playtest protocol:**
- **Setup:** Tester plays naturally for 7 days with at least 10 learned facts. Track when they open the app.
- **Step 1:** After 7 days, check how many morning/evening rituals were completed (from save data).
- **Step 2:** Compare app-open times to ritual windows. Calculate "opportunity rate" (how often they played during a window) and "conversion rate" (when in window, did they study?).
- **Observe/Measure:** Ritual completion count / 14 possible (7 mornings + 7 evenings). Play time distribution. Whether the bonus is mentioned as motivating.
- **Success criteria:** At least 40% of opportunities converted. At least 1 tester adjusts their play time. Bonus rewards mentioned as motivating by 50%+ of testers.

**What we'd change based on results:**
- Low opportunity rate: Widen windows to 6 AM-12 PM and 6 PM-midnight. Or add a "flex ritual" that works during any 2-hour block the player chooses.
- Low conversion rate: Add a persistent banner when a ritual window is active. Make the bonus more visible.
- Rewards too small: Increase ritual dust from 25 to 50. Add exclusive "ritual streak" cosmetics.

---

### Q7: Knowledge Tree as Motivation Anchor

**What we're testing:** Whether the Knowledge Tree visualization creates a tangible sense of progress that motivates continued learning, or whether players ignore it as decorative noise.

**The question (for tester):** "How often do you look at your Knowledge Tree? Can you describe what it looks like right now? Does seeing branches grow or leaves appear make you want to learn more facts in that category? What would make the tree more interesting to you?"

**Why this matters:** The Knowledge Tree is the primary visual feedback for learning progress. Mastery levels map to leaf states, and Learning Sparks are awarded at milestones. If players don't look at it or understand it, all the development effort is wasted.

**Playtest protocol:**
- **Setup:** Player with 50+ facts and all rooms unlocked. Navigate to the Knowledge Tree screen.
- **Step 1:** Ask the tester to describe what they see without any guidance. Note what they understand and what confuses them.
- **Step 2:** Ask them to predict what will happen if they master 5 more History facts.
- **Step 3:** Have them do a study session, then check the tree again. Ask if anything changed.
- **Observe/Measure:** Unprompted comprehension of tree structure. Can they identify category branches? Do they notice leaf state changes?
- **Success criteria:** 70%+ testers correctly identify at least 3 category branches. 50%+ notice leaf state changes after studying. At least 1 tester mentions wanting to "fill in" a branch.

**What we'd change based on results:**
- Low comprehension: Add labels to branches. Add an onboarding tooltip on first view. Show a before/after comparison after each study session.
- No motivation effect: Make the tree more interactive — tap a branch to see which facts are in it. Add a "water the tree" mechanic tied to study streaks.
- Spark milestones not noticed: Add a toast/celebration when a spark milestone hits. Make sparks currency for something tangible.

---

## Category 2: Quiz Experience in Mining (Q8-Q14)

---

### Q8: Pop Quiz Frequency Sweet Spot

**What we're testing:** Whether the current pop quiz rate (8% base, 15-block cooldown, fatigue after 5 quizzes per dive, 2% floor) creates a rhythm that enhances mining without becoming annoying.

**The question (for tester):** "During your last dive, roughly how many quizzes popped up? Did it feel like the right amount, too many, or too few? Were there stretches of mining where you forgot quizzes were part of the game? Did quizzes ever pop up at a bad moment?"

**Why this matters:** `QUIZ_BASE_RATE = 0.08` means roughly 1 quiz every 12-13 blocks mined. If the rate is too high, mining feels like a quiz app with mining graphics. Too low, and the learning integration feels superficial.

**Playtest protocol:**
- **Setup:** Start a dive. Mine normally for a full dive (all 20 layers or until O2 runs out).
- **Step 1:** Count total pop quizzes encountered. Note block count between each quiz.
- **Step 2:** After the dive, ask the tester the question above.
- **Step 3:** Repeat with a second dive.
- **Observe/Measure:** Total quizzes per dive. Average blocks between quizzes. Tester's subjective rating (1-10 for frequency). Whether tester uses words like "annoying," "interrupting," vs "fun," "surprise."
- **Success criteria:** 3-7 quizzes per dive feels right to 70%+ of testers. Rating of 6+ for frequency. No tester uses "annoying" more than once.

**What we'd change based on results:**
- Too many: Lower `QUIZ_BASE_RATE` from 0.08 to 0.05. Increase `QUIZ_COOLDOWN_BLOCKS` from 15 to 20.
- Too few: Increase `QUIZ_BASE_RATE` to 0.12. Decrease first trigger from 10 to 5 blocks. Add a visual "data residue" shimmer on blocks near a pending quiz trigger.
- Bad timing: Add context-awareness — suppress quizzes within 3 blocks of a hazard or while O2 is below 15%.

---

### Q9: Quiz Interruption Impact on Flow State

**What we're testing:** Whether pop quizzes break the mining flow state in a way that feels jarring, or whether they create a satisfying micro-break rhythm.

**The question (for tester):** "When a quiz pops up while you're mining, does it feel like a natural pause or like being yanked out of what you were doing? After answering a quiz, do you remember what you were doing in the mine, or do you feel disoriented? How long do quizzes take to answer?"

**Why this matters:** The narrative frame system wraps quizzes as "Scanner pings" to maintain immersion. But the screen transition from mining canvas to quiz overlay is a hard break. If the average quiz takes 8+ seconds and mining runs at 2-3 seconds per block, quizzes represent a 3x tempo disruption.

**Playtest protocol:**
- **Setup:** Start a dive with 30 overdue facts so quizzes trigger frequently.
- **Step 1:** Time each quiz from appearance to answer. Note the tester's body language at each trigger.
- **Step 2:** After each quiz, observe: does the tester immediately resume mining, or pause/look around?
- **Step 3:** Ask the post-dive question above.
- **Observe/Measure:** Average quiz duration. Post-quiz hesitation time. Tester flow state self-report. Whether narrative frames are noticed.
- **Success criteria:** Average quiz under 6 seconds. Post-quiz hesitation under 2 seconds. 60%+ testers describe it as "a natural pause."

**What we'd change based on results:**
- Quiz takes too long: Reduce choices from 4 to 3. Add a 10-second auto-skip timer. Make the overlay semi-transparent so the mine is visible.
- Post-quiz disorientation: Add a brief visual cue showing the player's position after dismissal. Zoom the camera with a gentle pulse.
- Narrative frames not noticed: Make them larger or animated. Add a characteristic sound effect.

---

### Q10: Consistency Penalty Fairness

**What we're testing:** Whether the consistency penalty (extra -8 O2 and -0.15 ease when getting a previously-known fact wrong) feels like fair accountability or unfair punishment.

**The question (for tester):** "Have you seen the 'Consistency penalty!' message during a dive? How did it make you feel? Did you agree that you should have known that fact? Did losing the extra O2 feel fair or frustrating? After being penalized, did you study that fact more carefully?"

**Why this matters:** The penalty requires `repetitions >= 1` and `cardState === 'review'`. It's pedagogically motivated (retrieval under varied conditions strengthens memory). But 8 O2 is significant, and the ease penalty compounds with the standard lapse penalty for a total of -0.35 ease per inconsistency.

**Playtest protocol:**
- **Setup:** Start a dive with 50 overdue facts (all with 2+ reps). Answer some questions wrong naturally.
- **Step 1:** Count consistency penalties that trigger naturally (not intentionally wrong).
- **Step 2:** Track O2 impact. What percentage of total O2 was lost to consistency penalties?
- **Step 3:** Check affected cards' ease factors after the dive.
- **Observe/Measure:** Penalty frequency per dive. O2 lost as % of total budget. Tester emotional response. Whether penalized facts are studied harder next session.
- **Success criteria:** Penalties trigger on no more than 2-3 facts per dive. O2 impact under 10% of total budget. 60%+ testers agree the penalty is fair.

**What we'd change based on results:**
- Too frequent: Raise `CONSISTENCY_MIN_REPS` from 1 to 3.
- O2 impact too harsh: Reduce `CONSISTENCY_PENALTY_O2` from 8 to 5. Or cap total consistency O2 loss at 15 per dive.
- Perceived as unfair: Add a "I was distracted" acknowledgment button. Reduce ease penalty from 0.15 to 0.10.
- No behavior change: Make the penalty visible in Study Station — highlight recently-penalized cards with an orange border.

---

### Q11: Layer Entrance Quiz Pressure

**What we're testing:** Whether the 3-question layer entrance quiz (with -10 O2 per wrong answer) creates meaningful tension or feels like a toll booth.

**The question (for tester):** "When you reach the descent shaft, how do you feel about the 3-question quiz? Is it exciting, stressful, or just a speed bump? When you get one wrong and lose 10 O2, does that matter? Would you prefer fewer questions, easier questions, or no quiz at all?"

**Why this matters:** 3 questions with -10 O2 per wrong means a player could lose 30 O2 at a layer boundary (10% of total budget). On deeper layers where O2 costs are multiplied, this is devastating.

**Playtest protocol:**
- **Setup:** Start a dive and mine to at least 3 layer transitions.
- **Step 1:** Record the tester's reaction at each layer boundary quiz. Note questions right/wrong, O2 before and after.
- **Step 2:** On deeper layers (6+), calculate O2 cost of wrong answers as percentage of remaining budget.
- **Step 3:** Ask: "Did you ever consider NOT descending because you were worried about the quiz?"
- **Observe/Measure:** Correct rate on layer quizzes vs pop quizzes. O2 impact on deeper layers. Whether any tester avoided descending.
- **Success criteria:** 60-80% correct rate. O2 impact felt as "meaningful but not devastating." 0 testers avoid descending due to quiz fear.

**What we'd change based on results:**
- Too punishing: Reduce to 2 questions. Reduce wrong penalty from 10 to 5. Or scale penalty inversely by depth.
- Not meaningful (100% correct): Increase to 4 questions. Use difficulty-weighted selection matching layer depth.
- "Speed bump" sentiment: Add a reward for perfect layer quizzes — all 3 correct = bonus O2 or mineral bonus.

---

### Q12: Artifact Boost Quiz Value Perception

**What we're testing:** Whether the artifact boost quiz (35% trigger chance, 1-3 questions, rarity upgrade on correct) creates a satisfying "knowledge = power" moment.

**The question (for tester):** "When you mine an artifact and a quiz pops up, does it feel like your knowledge is directly affecting your loot? After answering correctly and seeing a rarity boost, is the payoff satisfying? When you answer wrong and miss the boost, how do you feel?"

**Why this matters:** This is the most direct "knowledge = game power" conversion in the entire game. If players don't perceive the connection, the core thesis fails.

**Playtest protocol:**
- **Setup:** Start a dive and mine until finding at least 3 artifacts.
- **Step 1:** Track which artifacts trigger the boost quiz. Record results and whether rarity upgraded.
- **Step 2:** Ask: can they tell whether quiz answers affected artifact rarity?
- **Step 3:** Show them the actual probabilities. Ask if the connection feels strong enough.
- **Observe/Measure:** Tester's perceived connection (1-10). Whether they notice rarity changes. Emotional reaction to boost vs no boost.
- **Success criteria:** 70%+ testers perceive a connection between quiz and loot. 50%+ report the boost feels "satisfying."

**What we'd change based on results:**
- Connection not perceived: Add explicit UI: "Knowledge Bonus! Rarity upgraded: Common -> Uncommon" with a visual flash.
- 15% per correct too low: Increase to 25%. Or make the first boost guaranteed on perfect quiz.
- 35% trigger too low: Increase to 50% for first 10 dives, then taper.

---

### Q13: Quiz Streak Motivation

**What we're testing:** Whether the in-dive quiz streak (3 correct = +20% dust, 5 = +35%, 7 = +50%, reset on wrong) creates "don't break the chain" tension.

**The question (for tester):** "Did you notice the streak counter during your dive? When you got several right in a row, did you feel pressure to keep it going? Was the dust bonus worth caring about? Did losing a streak feel bad enough to make you study harder?"

**Why this matters:** With ~5-7 quizzes per dive, reaching tier 3 (7 in a row) requires answering every single quiz correctly for the entire dive — nearly impossible.

**Playtest protocol:**
- **Setup:** Start a dive. Monitor `quizStreak` via `window.__terraDebug()`.
- **Step 1:** Track max streak across 3 dives. Note when streaks break.
- **Step 2:** Calculate dust bonus earned from streaks vs total dust.
- **Step 3:** Ask about awareness and motivation.
- **Observe/Measure:** Max streak per dive. Average streak before break. Dust bonus as % of total. Tester awareness. Emotional response to breaks.
- **Success criteria:** Most players reach tier 1 (3 streak) once per dive. Tier 2 (5) reached in ~30% of dives. Streak dust is 5-15% of total.

**What we'd change based on results:**
- Tier 3 unreachable: Reduce from 7 to 5. Or don't fully reset — degrade by 1 per wrong answer.
- Streak not noticed: Add a more prominent on-screen counter during mining.
- Dust bonus too small: Increase multipliers (tier 1: 1.30, tier 2: 1.50, tier 3: 2.0).

---

### Q14: Difficulty Weighting by Depth

**What we're testing:** Whether depth-based difficulty weighting (shallow layers prefer easy cards, deep layers prefer hard cards) creates a noticeable curve that enhances depth-exploration.

**The question (for tester):** "As you mine deeper, do the quiz questions get harder? Can you tell the difference between layer 1 and layer 15 questions? Does the difficulty ramp feel fair, or does it make deep layers doubly punishing?"

**Why this matters:** The system uses ease factor as a proxy for difficulty. But ease reflects personal difficulty, not inherent difficulty. Deep layers already have 2.5x O2 multiplier — adding harder quizzes may create a death spiral.

**Playtest protocol:**
- **Setup:** Start with 50 facts with varied ease factors. Mine through at least 10 layers.
- **Step 1:** Record the ease factor of each quiz fact along with the layer it occurred on.
- **Step 2:** Plot ease factor vs. layer depth.
- **Step 3:** Ask about perceived difficulty progression.
- **Observe/Measure:** Correlation between depth and quiz difficulty. Tester perception. "Again" rate by layer depth. Whether deep quizzes cause O2 death spirals.
- **Success criteria:** Visible correlation. Testers describe a "gentle ramp." Deep-layer quizzes don't cause more than 1 premature dive end per 5 dives.

**What we'd change based on results:**
- Death spiral: Cap hard-weighted quizzes at 2 per dive. Disable consistency penalty below layer 15.
- No perceived difference: Use the fact's `difficulty` field (1-5) instead of ease factor. Add visual cues (different frame color).
- Feels unfair: Decouple quiz difficulty from depth. Let the player choose difficulty at dive start.

---

## Category 3: Study Session UX (Q15-Q19)

---

### Q15: Three-Button Grading Clarity

**What we're testing:** Whether the 3-button self-rating system (Again / Okay / Good) is intuitive to non-Anki users, and whether interval previews are understood.

**The question (for tester):** "When you see the three buttons — Again, Okay, and Good — do you understand what each one does? What does the little text under each button mean (like '1m', '1d', '4d')? How do you decide which to press? Have you ever pressed the wrong one?"

**Why this matters:** Anki users understand instantly. Non-Anki users may interpret the buttons as a confidence scale rather than a scheduling decision. The center "Okay" button being wider is a nudge.

**Playtest protocol:**
- **Setup:** Navigate to Study Station and start a 10-card session.
- **Step 1:** Watch the tester's first interaction with the 3 buttons (before explanation). Note hesitation or confusion.
- **Step 2:** After the session, ask the question. Specifically: "What do you think will happen if you press 'Good' on a card?"
- **Step 3:** Check whether button presses match stated understanding.
- **Observe/Measure:** First-interaction hesitation time. Correct understanding rate. Button alignment with actual recall quality. Whether interval labels are read.
- **Success criteria:** 80%+ testers understand Again = "I didn't know this." 60%+ understand interval labels. No tester presses "Good" on a card they clearly didn't know.

**What we'd change based on results:**
- Misunderstood: Rename to "Didn't Know" / "Got It" / "Easy." Add a first-time tooltip.
- Interval labels ignored: Make them larger or use plain English ("See again in 1 minute" instead of "1m").
- Wrong button by accident: Add a 0.5s undo window. Or add haptic feedback with cancel delay.

---

### Q16: Study Session Length Satisfaction

**What we're testing:** Whether the 3 session sizes (5 Quick / 10 Standard / 20 Deep) match expectations, and whether the "Again" re-queue mechanic extends sessions unpredictably.

**The question (for tester):** "How long did your last study session take? Was that what you expected? If you picked '5 Quick,' how many cards did you actually see (including repeats)? Would you prefer a fixed time limit instead of fixed card count?"

**Why this matters:** A "5 Quick" session can become 15 cards if everything is re-queued twice. At ~8 seconds per card, that's 40 seconds vs 2 minutes — a 3x surprise.

**Playtest protocol:**
- **Setup:** Start with 50 overdue facts. Navigate to Study Station.
- **Step 1:** Tester does "5 Quick." Time it. Count total cards shown.
- **Step 2:** Tester does "10 Standard." Time it. Same measurements.
- **Step 3:** Ask about session length and re-queue perception.
- **Observe/Measure:** Actual duration vs expected. Total cards vs selected size. Re-queue rate. Satisfaction (1-10).
- **Success criteria:** "5 Quick" under 2 minutes. "10 Standard" under 5 minutes. Satisfaction 7+. Re-queues perceived as helpful by 60%+.

**What we'd change based on results:**
- Too long from re-queues: Reduce `MAX_AGAIN_REQUEUES` from 2 to 1. Or cap total cards at 1.5x selected size.
- Too short: Add a "Continue?" prompt after the selected size, offering 5 more cards.
- Time-based preference: Add a "Timed - 3 min" option that presents cards until time runs out.

---

### Q17: Card Ordering and Cognitive Load

**What we're testing:** Whether review-first, then learning, then new cards creates a smooth experience or causes jarring transitions.

**The question (for tester):** "During your study session, did you notice some cards felt familiar while others were brand new? Did the transition feel smooth or jarring? Would you prefer new cards at the beginning, end, or mixed in?"

**Why this matters:** The queue is `[...reviewDue, ...learningDue, ...newCards]`. Sessions start with the most overdue (potentially hardest) cards. Cognitive science suggests interleaving categories aids learning, but interleaving difficulty can be demotivating.

**Playtest protocol:**
- **Setup:** Have 30 overdue reviews + 5 new unlearned facts. Start a Study Session.
- **Step 1:** Track card state of each presented card. Note visible engagement level.
- **Step 2:** Ask the ordering question after session.
- **Step 3:** In a second session, manually shuffle order. Compare engagement.
- **Observe/Measure:** Time per card by state. "Again" rate by state. Tester ordering preference. Whether new cards at the end get less attention.
- **Success criteria:** No card state has more than 2x the "Again" rate of another. No "jarring" reports. New cards at end get equivalent attention.

**What we'd change based on results:**
- New cards at end neglected: Interleave 1 new card after every 3 review cards.
- Overdue cards at start demoralizing: Sort by ease (easy first). Or add a warm-up card.
- Category interleaving desired: Add a "shuffle mode" that interleaves categories.

---

### Q18: GAIA Study Feedback Helpfulness

**What we're testing:** Whether GAIA's contextual feedback (mnemonics, encouragement, session summaries) adds value or becomes noise.

**The question (for tester):** "During your study session, did GAIA say anything that helped you remember a fact? Do you read GAIA's comments, or skip past them? After the session, did GAIA's summary feel genuine or generic?"

**Why this matters:** Each fact can have a GAIA comment and mnemonic field. GAIA is positioned as a character the player has a relationship with, but if comments are ignored, that relationship doesn't form.

**Playtest protocol:**
- **Setup:** Start a study session with 10+ cards.
- **Step 1:** Watch whether the tester reads GAIA comments. Track dwell time with vs without comments.
- **Step 2:** Get a fact wrong 3+ times to trigger mnemonic display. Ask if it helped.
- **Step 3:** After completion, ask about GAIA's summary message.
- **Observe/Measure:** Dwell time on cards with GAIA comments vs without. Mnemonic helpfulness (1-5). Summary perceived as genuine vs generic.
- **Success criteria:** 50%+ read GAIA comments on at least half the cards. Mnemonic helpfulness 3+. Summary perceived as fitting.

**What we'd change based on results:**
- Comments ignored: Move GAIA comment before the answer reveal (as a hint). Add GAIA's avatar sprite.
- Mnemonics unhelpful: Run a content pass. Consider personalized mnemonics.
- Summary generic: Add specific fact references ("You nailed 'What is the melting point of iron?'"). Call out most-improved facts.

---

### Q19: New Card Introduction Pacing

**What we're testing:** Whether the daily new card throttle (3 per session, 10 per day, suppressed when backlog > 3x) prevents overwhelm while keeping content fresh.

**The question (for tester):** "Are you seeing enough new facts, or does it feel like you're always reviewing the same ones? When new facts appear, is it welcome or unwanted? Do you wish you could learn more per day, or fewer?"

**Why this matters:** With 3 new cards per session and max 10 per day, a player doing 3 sessions sees 9 new cards. After a week, 63 facts in rotation. The throttle prevents snowballing, but in a game context, players expect consistent "new discovery" dopamine.

**Playtest protocol:**
- **Setup:** Tester plays 5 days naturally. Track new cards per day, review load, and throttle activations.
- **Step 1:** Days 1-3: How many new cards per session? Does tester notice the throttle?
- **Step 2:** Days 4-5: As backlog builds, does throttle suppress new cards? Does tester complain about "only old stuff"?
- **Step 3:** Ask the pacing question.
- **Observe/Measure:** New cards per day. Review backlog trend. Throttle activations. Content freshness satisfaction (1-10).
- **Success criteria:** Freshness satisfaction 6+. Review backlog stays under 40 cards. No "always reviewing" complaint for more than 1 day.

**What we'd change based on results:**
- "Always reviewing" complaint: Increase to 5 new per session. Reduce throttle ratio from 3 to 5.
- Overwhelmed: Reduce to 2 new per session. Add a "review vacation" mode.
- Wants control: Add a settings slider: "New cards per session: 1-10."

---

## Category 4: Core Mining Loop (Q20-Q23)

---

### Q20: O2 Pacing and Tension Curve

**What we're testing:** Whether the O2 system (300 total, costs 1-5 per block, 2.5x depth multiplier, 15 restored per layer) creates satisfying tension without hopelessness.

**The question (for tester):** "During your last dive, did you ever feel like you were about to run out of O2? How many times? Was that feeling exciting or stressful? Did you ever make a strategic decision based on O2? At what point did you feel 'safe' vs. 'worried'?"

**Why this matters:** On layer 1, 300 O2 mines 300 dirt blocks. By layer 10, dirt costs 1.71 per block. Layer transitions restore 15 O2 but deeper layers have larger grids. The question is whether the curve hits "exciting tension" vs "hopeless grind."

**Playtest protocol:**
- **Setup:** Start a dive. Play through at least 10 layers.
- **Step 1:** Track O2 level at each layer transition. Graph it. Note when the tester starts checking the O2 bar frequently.
- **Step 2:** Track blocks mined per layer vs blocks skipped (beeline to shaft).
- **Step 3:** Did the tester find oxygen caches? Did caches feel like lifelines or minor bonuses?
- **Observe/Measure:** O2 curve over layers. Layer at which "worry" begins. Blocks mined vs available. Cache discovery rate. Whether dive ended from depletion or voluntary surfacing.
- **Success criteria:** "Worry" between layers 8-12. At least 1 strategic O2 decision per dive. Caches extend dive by 15-25%. Fewer than 20% of dives end in unexpected depletion before layer 5.

**What we'd change based on results:**
- Worry too early (layer 3-5): Reduce O2 depth multiplier. Increase `OXYGEN_CACHE_RESTORE` from 30 to 40.
- No tension: Increase O2 costs by 25%. Or reduce to 2 starting tanks after 10 dives.
- Hopeless death spirals: Add "emergency ascent" option. Add O2 warning at 20% with GAIA message.

---

### Q21: Layer Progression — Depth vs. Breadth

**What we're testing:** Whether players prefer thorough mining (breadth) or rushing to depth, and whether the game rewards one disproportionately.

**The question (for tester):** "Do you try to explore every corner of each layer, or beeline for the descent shaft? What makes you decide? Would you want fewer bigger layers or more smaller layers?"

**Why this matters:** Each layer has 6 artifacts, 18 minerals, 4 O2 caches. Thorough mining gets more loot but costs more O2. Speed-running preserves O2 for deeper layers with better minerals. The optimal strategy depends on depth reward premium.

**Playtest protocol:**
- **Setup:** Have the tester do 3 dives with different strategies: (1) thorough, (2) speed-running, (3) natural.
- **Step 1:** Track blocks mined per layer, layers reached, total loot.
- **Step 2:** Compare loot-per-O2-spent efficiency.
- **Step 3:** Ask which strategy was most fun (not most efficient).
- **Observe/Measure:** Layers reached by strategy. Loot by strategy. O2 efficiency. Fun rating (1-10). Preferred strategy.
- **Success criteria:** Both strategies within 30% loot difference. Fun ratings within 2 points. No dominant "wrong" strategy.

**What we'd change based on results:**
- Speed-running dominant: Add layer completion bonuses. Increase artifact density.
- Thorough mining dominant: Increase depth-based mineral scaling. Add "deep diver" loot multiplier.
- Layers too uniform: Vary grid sizes more. Add "treasure floors" every 5 layers.

---

### Q22: Artifact Discovery Rate and Excitement

**What we're testing:** Whether 6 artifact nodes per layer creates sufficient discovery excitement, and whether the rarity distribution creates "big moment" variance.

**The question (for tester):** "How often do you find artifacts while mining? Is it exciting or routine? Have you found an Epic or Legendary? How did that feel? Does it get repetitive?"

**Why this matters:** Typical dive yields 12-32 artifacts. 60% are common (minimal animation), 25% uncommon, 15% rare+. If 85% of reveals are underwhelming, the average experience is flat.

**Playtest protocol:**
- **Setup:** Complete 3 full dives, collecting all artifacts.
- **Step 1:** Track artifacts per dive and rarity distribution.
- **Step 2:** Note tester's reaction to each rarity tier.
- **Step 3:** Ask whether they look forward to reveals.
- **Observe/Measure:** Artifacts per dive. Rarity in practice. Excitement by tier. Whether commons feel "worthless." Time spent on reveal animations.
- **Success criteria:** At least 1 rare+ per dive. "Exciting" or "rewarding" description. Commons not called "worthless." Rare+ animations watched fully.

**What we'd change based on results:**
- Too many commons: Shift weights (common 60->50, uncommon 25->30, rare 10->14). Auto-collect commons without animation.
- Not enough rare moments: Pity timer guaranteeing 1 rare per 20 artifacts. "Lucky dig" consecutive mining bonus.
- Reveal animations too slow: Reduce common animation duration. Add "Quick Reveal" toggle.

---

### Q23: Risk/Reward Balance on Hazards

**What we're testing:** Whether hazards (lava: -15 O2, gas: -8 O2) create interesting decisions or just unavoidable damage.

**The question (for tester):** "When you encounter lava or gas, do you have a choice? Can you see hazards coming? When a hazard costs O2, does it feel like your fault or bad luck? Do hazards make mining more exciting or more punishing?"

**Why this matters:** Scanner reveals hazards at tier 2+. Without upgrade, hazards are invisible in fog. A new player sees lava only when adjacent — surprise punishment. Fog reveal radius is only 1 block.

**Playtest protocol:**
- **Setup:** Start a dive and mine to layer 6+ where hazards appear.
- **Step 1:** Count hazard encounters. For each: was it visible beforehand? Could they route around?
- **Step 2:** Track O2 lost to hazards as % of total budget.
- **Step 3:** Ask the question. Probe: "Could you have avoided that?"
- **Observe/Measure:** Encounters per dive. Avoidable vs unavoidable. O2 lost %. Attribution (my fault vs unfair). Fun rating (1-10).
- **Success criteria:** 50%+ avoidable. O2 lost 10-20%. 60%+ attribute to own decision. Rated 5+ for fun.

**What we'd change based on results:**
- Too many surprises: Show hazards at scanner tier 1. Add "heat shimmer" visual around lava.
- O2 too high: Reduce `LAVA_OXYGEN_COST` from 15 to 10. Add craftable "heat suit."
- Feels random: Make hazard placement follow patterns (lava flows down, gas drifts up). Add warning cues 2 blocks before.

---

## Category 5: Integration & Motivation (Q24-Q25)

---

### Q24: Mining + Learning Integration Cohesion

**What we're testing:** Whether mining and spaced repetition feel like one unified experience or two separate apps awkwardly glued together.

**The question (for tester):** "If you described this game to a friend, would you say it's a mining game, a learning app, or something new? Do the quiz parts feel like they belong in the mine? When mining, are you thinking about facts? When studying, are you thinking about mining? What would make them feel more connected?"

**Why this matters:** This is the existential question. The product hypothesis is that gamification through mining context produces better retention than standalone flashcards. If testers perceive two separate apps, the thesis is invalidated. Connection points: artifacts (mine to discover), pop quizzes (review during mining), consistency penalty (study affects mining), rituals (study powers mining), Knowledge Tree (progress from both).

**Playtest protocol:**
- **Setup:** Tester plays 3+ days with at least 1 dive and 1 study session per day.
- **Step 1:** Day 3: Ask the integration question without priming.
- **Step 2:** Ask the tester to draw a diagram of how systems connect.
- **Step 3:** Probe: "Does studying help you mine? Does mining help you study?"
- **Observe/Measure:** Game description (mining vs learning vs integrated). System diagram accuracy. Unprompted mention of cross-system connections. Cohesion rating (1-10).
- **Success criteria:** 50%+ describe as "something new" or integrated. 70%+ identify 2+ cross-system connections unprompted. Cohesion rated 6+.

**What we'd change based on results:**
- "Two separate apps": Make study performance affect next dive (X% mastered = +X% mineral bonus). Show facts during mining (tooltip on artifact discovery). Add fact-themed biome names.
- Mining dominates: Increase quiz dust rewards. Add "Knowledge Armor" reducing hazard damage by mastery level.
- Learning dominates: Add more mining variety (combo mining, block chains). Reduce dive-start friction.

---

### Q25: Return Visit Drivers

**What we're testing:** What specifically brings players back — mining, learning, streaks, gacha, or GAIA? This determines which systems to invest in.

**The question (for tester):** "What made you open the game today? If you missed a day, what would make you come back — and what would make you stop permanently? What's the most satisfying moment you've had so far?"

**Why this matters:** Streaks, rituals, login rewards, and GAIA are all retention mechanisms. But they might not be the actual drivers. Understanding the primary return driver shapes every future product decision.

**Playtest protocol:**
- **Setup:** Tester plays 7+ days. Ask the question on days 3, 5, and 7 (phrased slightly differently each time).
- **Step 1:** Day 3: "Why did you open the game just now?"
- **Step 2:** Day 5: "If the mining disappeared and it was just study, would you keep using it? If study disappeared, would you keep mining?"
- **Step 3:** Day 7: Full question. Plus: "Rank: finding rare artifacts, mastering facts, maintaining streak, upgrading dome, GAIA's reactions."
- **Observe/Measure:** Self-reported driver by day. Rankings. Churn scenarios. Most satisfying moment. Streak pressure sentiment (positive vs negative).
- **Success criteria:** 2+ different drivers across tester pool. No single driver above 80%. At least 1 learning-related moment per tester.

**What we'd change based on results:**
- Mining is sole driver: Simplify learning to minimum. Double down on mining systems.
- Streak pressure is sole driver: Make "streak insurance" more prominent. Invest in intrinsic motivation.
- No learning moments satisfying: Make mastery celebrations more impactful. Add moments where a mastered fact saves the player in mining.
- GAIA is the driver: Invest in GAIA personality, dialogue variety, relationship memory.

---

## Appendix: Key Balance Constants

All "What we'd change" actions map to constants in `src/data/balance.ts`:

| Constant | Current Value | Questions That May Change It |
|----------|--------------|------------------------------|
| `QUIZ_BASE_RATE` | 0.08 (8%) | Q8 |
| `QUIZ_COOLDOWN_BLOCKS` | 15 | Q8, Q9 |
| `QUIZ_DISTRACTORS_SHOWN` | 3 | Q3, Q9 |
| `CONSISTENCY_PENALTY_O2` | 8 | Q10 |
| `CONSISTENCY_MIN_REPS` | 1 | Q10 |
| `LAYER_ENTRANCE_QUESTIONS` | 3 | Q11 |
| `LAYER_ENTRANCE_WRONG_O2_COST` | 10 | Q11 |
| `ARTIFACT_QUIZ_CHANCE` | 0.35 | Q12 |
| `ARTIFACT_BOOST_RARITY_CHANCE_PER_CORRECT` | 0.15 | Q12 |
| `SM2_GRADUATING_INTERVAL` | 1 | Q2 |
| `SM2_INITIAL_EASE` | 2.5 | Q2 |
| `SM2_LEECH_THRESHOLD` | 8 | Q5 |
| `SM2_MASTERY_INTERVAL_GENERAL` | 60 | Q4 |
| `SM2_MASTERY_INTERVAL_VOCAB` | 30 | Q4 |
| `NEW_CARDS_PER_SESSION` | 3 | Q19 |
| `STARTING_OXYGEN_TANKS` | 3 | Q20 |
| `OXYGEN_PER_TANK` | 100 | Q20 |
| `OXYGEN_CACHE_RESTORE` | 30 | Q20 |
| `LAVA_OXYGEN_COST` | 15 | Q23 |
| `GAS_POCKET_OXYGEN_DRAIN` | 8 | Q23 |
| `DENSITY_ARTIFACT_NODES` | 6 | Q22 |
| `MORNING_REVIEW_HOUR` | 7 | Q6 |
| `EVENING_REVIEW_HOUR` | 19 | Q6 |
