# Full Act 1 Human-Style Playtest — BATCH-2026-05-04-001

**Date:** 2026-05-04  
**Agent:** qa-agent (Claude Sonnet 4.6)  
**Container:** llm-playtest-act1-001 (warm Docker, port 3266)  
**Run 1:** Started fresh, died on Floor 2 (Ink Slug combat)  
**Run 2:** Started to explore remaining room types via map + spawning  

---

## Run Summary

- Floors completed: 1.5 / 3 (died mid-Floor 2 combat in Run 1)
- Death floor: Floor 2 (Ink Slug combat, player HP 8/100 → 0)
- Combats won: 1 (Index Weaver, Floor 1)
- Rooms visited: combat=2 (won 1), mystery=1 (The Whispering Shelf), rest=1 (spawned), shop=1 (spawned), retreatOrDelve=1 (spawned), boss=0
- Quizzes seen: 18+ (across preview + direct play)
- Total play time (proxy): ~42 action batches issued

---

## Verdict

**ISSUES** — Core loop is functional and visually impressive, but blocked by 6 issues requiring fixes before Steam launch.

Top concern: A JS crash (`drawImage null`) during reward acceptance kills the Phaser canvas. A human player hitting this would see a black screen, find "Restart Game" overlay, and likely quit with a 1-star review. This must be fixed.

---

## Top 3 Player Frustrations

1. **HIGH** — `acceptReward()` JS crash kills Phaser canvas, leaving a black screen with hidden UI buttons. Players who don't know to click Continue in the right spot will think the game crashed. [Evidence: result.json step 16 — `"Error: Cannot read properties of null (reading 'drawImage')"`; layout-dump shows `(no active scenes)` after crash]

2. **HIGH** — 7+ sequential tutorial popups over 6 turns of the same combat. Each popup blocks the entire play area with "Got it" / "skip tutorial" buttons. The first combat with Index Weaver triggered: enemy intro, Quick Play explanation, Charge explanation, Correct-charge feedback, Draw Pile explanation, Discard Pile explanation, AP spending explanation, Focus Meter explanation — that is 8 popups across 6 turns before the player can breathe. [Evidence: screenshots `combat-floor1-start.png`, `combat-floor1-turn1-mid.png`, `combat-floor1-turn2-start.png`, `combat-floor1-turn3.png`, `combat-floor1-turn4.png`, `combat-floor1-turn5-or-end.png`, `combat-floor1-turn6.png`, `reward-room-floor1-combat1.png`]

3. **MEDIUM** — Content template placeholders leaked into the game. At least 2 facts show raw template tokens as answers: `"About {4} grams"` (iron in the human body) and `"{4000} km"` (Valles Marineris length). These render verbatim to the player during quiz. [Evidence: getCombatState results across multiple batches, factIds: `natural_sciences-iron-body-hemoglobin`, `natural_sciences-mars-valles-marineris-length`]

---

## All Issues

### ISSUE-1: acceptReward Phaser canvas crash
**Severity**: High  
**Category**: Bug  
**Screen/Context**: rewardRoom after first combat on Floor 1  
**Evidence**: result.json step 16 (batch llm-playtest-act1-001_none_1777870469788): `"ok": false, "message": "Error: Cannot read properties of null (reading 'drawImage')"`. Layout dump after crash shows `(no active scenes)` for Phaser, and buttons ["Restart Game", "Error details ▼"] visible in DOM eval output (batch llm-playtest-act1-001_none_1777870513805).  
**What happened**: `acceptReward()` attempted to draw an image to a null canvas context, crashing the Phaser renderer. The screen went black with all UI buttons hidden. Clicking the DOM Continue button directly (eval click) recovered the game.  
**Why it matters (player POV)**: "The game crashed right after I won my first fight. I had to click around blindly to get it working again. Unacceptable." 
**Suggested fix**: Null-check the canvas context before drawImage calls in the reward scene; add graceful recovery if canvas is unavailable.

### ISSUE-2: Excessive sequential tutorial popups blocking combat
**Severity**: High  
**Category**: UX  
**Screen/Context**: Floor 1 first combat (Index Weaver), turns 1-6+  
**Evidence**: 8 distinct tutorial popup messages across 6 turns, visible in screenshots: `combat-floor1-start.png`, `combat-floor1-turn1-mid.png`, `combat-floor1-turn2-start.png`, `combat-floor1-turn3.png`, `combat-floor1-turn4.png`, `combat-floor1-turn5-or-end.png`, `combat-floor1-turn6.png`, `reward-room-floor1-combat1.png`. Each popup has `[button.tutorial-btn.svelte-1auqobx.enabled]` visible in layout dumps.  
**What happened**: The tutorial system fires sequential in-combat popups for: enemy intro, Quick Play, Charge mechanic, Correct answer bonus, Draw Pile, Discard Pile, AP spending, and Focus Meter — one per turn or action, covering the full game scene.  
**Why it matters (player POV)**: "I clicked 'Got it' 8 times in my first fight and I never got to think about strategy. The game explained me to death." 
**Suggested fix**: Batch related tutorial steps, cap at 3 per combat, or replace with an optional dedicated tutorial mode rather than blocking overlays during live play.

### ISSUE-3: Content template placeholders visible to players
**Severity**: High  
**Category**: Content  
**Screen/Context**: Any combat where these facts appear (Floor 1 and Floor 2)  
**Evidence**: getCombatState results show `factAnswer: "About {4} grams"` (factId: `natural_sciences-iron-body-hemoglobin`) and `factAnswer: "{4000} km"` (factId: `natural_sciences-mars-valles-marineris-length`). These appeared in multiple turns across both runs. Note: quiz choices DO resolve correctly to "About 4 grams" and "4000 km" via `previewCardQuiz` — the bug is the raw factAnswer field shown on cards/UI.  
**What happened**: Template tokens `{4}` and `{4000}` are not being substituted in the `factAnswer` field that is rendered on card faces or shown to players.  
**Why it matters (player POV)**: "The card says the answer is 'About {4} grams'. Is this a bug? This game feels unfinished." 
**Suggested fix**: Audit all facts for unresolved template tokens in the `factAnswer` field; run a regex scan for `\{[0-9]+\}` pattern across all deck JSON files.

### ISSUE-4: Enemy displayDamage scaling unexpectedly
**Severity**: Medium  
**Category**: Balance / UX  
**Screen/Context**: Floor 1 Index Weaver combat, turns 3-5  
**Evidence**: getCombatState results: Index Weaver "Fang barrage" `displayDamage` changed from 15 (turn 1) → 15 (turn 2) → 15 (turn 3) → 18 (turn 4) → 21 (turn 5) as the chain multiplier rose. The `value` field stayed at 6 while `displayDamage` increased.  
**What happened**: The enemy's displayed attack damage appears to scale with the player's chain multiplier. It's unclear if this is intentional (enemy adapts to player) or a bug (multiplier incorrectly applied to enemy display).  
**Why it matters (player POV)**: "Wait, the enemy hits harder when I chain well? That punishes skill somehow. Or is the damage display just wrong?" 
**Suggested fix**: Verify if enemy `displayDamage` should reflect multipliers. If intentional, document it. If not, fix the calculation.

### ISSUE-5: Shop prices exceed starting gold on first visit
**Severity**: Medium  
**Category**: Balance  
**Screen/Context**: shopRoom (any first visit)  
**Evidence**: getAllText shows shop prices 57-73g for cards, 150g for relics. getRunState shows starting currency = 50g. Cheapest card (57g) > starting gold (50g). Confirmed via shop eval (batch llm-playtest-act1-001_none_1777870985921): all cards priced 57-73g.  
**What happened**: A player visiting the shop on their first run cannot afford anything. All cards cost more than starting gold.  
**Why it matters (player POV)**: "I found a shop and can't buy anything. I'd need to save gold for 3 more fights just to get one card. Why even show me the shop?" 
**Suggested fix**: Ensure at least 1-2 affordable items per shop, OR give players more starting gold, OR add a "discount" item (e.g., one card at 30-40g) as a floor 1 shop guarantee.

### ISSUE-6: Retreat/Delve copy is confusing
**Severity**: Medium  
**Category**: UX  
**Screen/Context**: retreatOrDelve screen  
**Evidence**: getAllText shows button text: `"Delve Deeper Death keeps 80% (40)"`. Confirmed in batch llm-playtest-act1-001_none_1777871022120 result.json.  
**What happened**: "Death keeps 80%" sounds like death is the agent keeping money, not the player. The sentence structure is ambiguous.  
**Why it matters (player POV)**: "What does 'Death keeps 80%' mean? Death keeps my money? Is that a threat? This doesn't make sense." 
**Suggested fix**: Rephrase to: "If you die, you keep 80% (40g)" or "Risk: die here, keep only 80% of your gold (40g)".

### ISSUE-7: Retreating/Delving trade-off not explained
**Severity**: Medium  
**Category**: UX  
**Screen/Context**: retreatOrDelve screen  
**Evidence**: getAllText (batch llm-playtest-act1-001_none_1777871022120) only shows "Retreat Keep all 50" vs "Delve Deeper Death keeps 80% (40)". No explanation of what delving provides beyond risk.  
**What happened**: The player learns what they lose by dying if they delve, but not what they GAIN by delving. There's no mention of floors, XP, or progression rewards for delving deeper.  
**Why it matters (player POV)**: "Why would I ever delve? The Retreat option keeps all my gold and I can stop safely. Delving just means I might lose 20%. There's no upside listed." 
**Suggested fix**: Add a brief benefit description: "Access deeper floors, earn more XP and rewards."

### ISSUE-8: Persistent low FPS in combat (Docker/SwiftShader)
**Severity**: Low  
**Category**: Performance  
**Screen/Context**: CombatScene (extended sessions)  
**Evidence**: look() output from mystery event batch includes: `"[fps] Low FPS alert: 14 fps in unknown for 123s"`, `"[fps] Low FPS alert: 7 fps in CombatScene for 365s"`. FPS dropped to 7 after ~6 minutes in combat.  
**What happened**: The game dropped to 7-14 FPS during extended combat sessions in Docker/SwiftShader rendering context. This may not affect real GPU hardware but indicates potential performance issues in software rendering environments.  
**Why it matters (player POV)**: "The game stutters badly after a few minutes of fighting." (May be Docker-specific; needs verification on real hardware.)  
**Suggested fix**: Profile CombatScene for memory leaks or texture registration issues (see console errors: "Texture key already in use: weapon-fade-tome/weapon-fade-shield" — these texture re-registration warnings occurred when starting Floor 2 combat).

### ISSUE-9: Backend connectivity error on every session
**Severity**: Low  
**Category**: Bug  
**Screen/Context**: All screens (console error on start and map navigation)  
**Evidence**: `consoleErrors: ["Failed to load resource: net::ERR_CONNECTION_REFUSED"]` appeared in 5+ batch results across both runs (batches ...1777870203787, ...1777870804765, etc.).  
**What happened**: Some resource is being requested from a local backend that isn't running in Docker. The error is non-fatal but indicates a service dependency that fails silently.  
**Why it matters (player POV)**: Likely not visible, but could affect functionality if the resource (analytics? save sync? leaderboards?) is expected by game code.  
**Suggested fix**: Identify the failing resource URL and add a graceful fallback for when the backend is unavailable.

### ISSUE-10: "Grey Matter" resource unexplained on run end screen
**Severity**: Low  
**Category**: UX  
**Screen/Context**: runEnd screen  
**Evidence**: Screenshot `combat2-result.png` (batch llm-playtest-act1-001_none_1777870764899) shows "GREY MATTER 0" with brain icon. No tooltip or explanation visible.  
**What happened**: The run end screen shows "GREY MATTER: 0" — this is presumably a meta-currency or progression resource, but it has no in-run explanation or tooltip.  
**Why it matters (player POV)**: "What's Grey Matter? I got 0 of it. Is that bad? What would I do with it if I earned some?" 
**Suggested fix**: Add a brief tooltip or description on the run end screen explaining what Grey Matter is and how to earn it.

### ISSUE-11: "Adapt" card description is vague
**Severity**: Low  
**Category**: UX / Content  
**Screen/Context**: cardUpgradeReveal screen (mystery event reward), in-combat  
**Evidence**: Screenshot `after-mystery-whispering-shelf.png` shows Adapt card with text: "Auto-picks best: Attack, Block, or Cleanse". The combat state confirms this as a "wild/adapt" type card.  
**What happened**: "Auto-picks best" is mechanically vague. Does it automatically play? Does it choose which mechanic to apply? How does it decide "best"?  
**Why it matters (player POV)**: "The card says it auto-picks the best option. But what does that mean in practice? When I draw it, does it just... go? I don't understand when to play it." 
**Suggested fix**: Rephrase to: "Becomes an Attack, Block, or Cleanse based on current combat state."

---

## Bright Spots (what worked well)

1. **Visual design is exceptional**: Every room background is hand-crafted pixel art with atmospheric lighting. The Index Weaver's web-covered archive, the Ink Slug's damp cave, the rest room campfire, the shop tavern — each feels like a unique location. The reward room with cards displayed on a stone altar is particularly striking.

2. **Narrative prose quality is strong**: The dungeon segment descriptions ("Dust and accumulated strangeness... everything that refused to fit anywhere obvious") and mystery event text ("A basket of lost things — some coins, a bandage, half a sandwich. Better than nothing.") are human-voiced and specific. No obvious AI tells in the prose I encountered.

3. **Mastery system creates genuine investment**: Cards visibly upgraded mid-run (`masteryLevel: 0 → 1 → 2`) after correct charge plays. Seeing the base damage increase on a card I'd answered correctly felt rewarding — the learning-as-power-growth loop works as designed.

4. **Run end screen is comprehensive**: The "KNOWLEDGE HARVEST" breakdown (SEEN/REVIEWING/MASTERED counts with XP gains) and the "Practice Run" feedback ("Dive a domain you struggle with to earn rewards") give clear post-run guidance. The 100% EXCEPTIONAL accuracy badge gave real satisfaction.

5. **HP bar color change at low health** (yellow at ~50%, fully yellow/orange near death) gives good passive danger signaling without requiring the player to read numbers.

---

## Observed Quiz Sample

**Q1** — `sa_cosmology_hubbles_law`  
"What law states that galaxies recede faster the farther they are, indicating the universe is expanding?"  
Correct: Hubble's Law. Distractors: Einstein's Relativity, Olbers' Paradox, Doppler Effect.  
Quality: ✓ Good — distractors are plausible science concepts, not trick options.

**Q2** — `cs_2_html_elements_count`  
"Who first described HTML in 1991 in a document called 'HTML Tags', listing just 18 elements — the markup language that now defines every web page?"  
Correct: Tim Berners-Lee. Distractors: John Backus, Dennis Ritchie, Ada Lovelace.  
Quality: ⚠️ Acceptable but the question is very long (37 words before the actual question starts). Could be trimmed.

**Q3** — `art_architecture-pieta-mary-younger-than-jesus`  
"Why does Mary look younger than Jesus in Michelangelo's Pietà?"  
Correct: Inspired by Dante's poem. Distractors: Church censorship order, To show divine purity, Patron's request.  
Quality: ✓ Interesting and memorable — the "correct" answer is non-obvious, which makes it memorable.

**Q4** — `us_states_maine_one_syllable`  
"Which US state has the only one-syllable name?"  
Correct: Maine. Distractors: implied (not previewed).  
Quality: ✓ Good trivia, easy to verify, memorable.

**Q5** — `animals_wildlife-sea-otter-keystone-kelp`  
"How do sea otters protect kelp forests from destruction?"  
Correct: By eating sea urchins. Distractors: implied.  
Quality: ✓ Good ecological trivia with clear mechanism.

**Q6** — `natural_sciences-iron-body-hemoglobin`  
"How much iron does an average adult human body contain?"  
Correct: About 4 grams. Distractors: About 7g, 5g, 3g.  
Quality: ⚠️ BUG — `factAnswer` field shows `"About {4} grams"` (unresolved template). Quiz choices are resolved correctly.

**Q7** — `ww_mod_palm_jumeirah_material`  
"Palm Jumeirah in Dubai is a massive artificial island — what material was it built from, with no concrete, steel, or rock?"  
Correct: Sand.  
Quality: ✓ Excellent question — specific, surprising, memorable.

**Q8** — `human_body_health-enzyme-million-year-reaction`  
"One enzyme accelerates a reaction from millions of years to milliseconds. Which enzyme?"  
Correct: Orotidine 5'-phosphate decarboxylase.  
Quality: ⚠️ Concerning difficulty — this is extremely specialized biochemistry. The correct answer is a complex chemical name most players will never recognize. Could cause frustration.

**Q9** — `philosophy_nc_nietzsche_death_of_god`  
"Which concept in Nietzsche's The Gay Science (§125, the Madman parable) diagnoses the collapse of the metaphysical foundation of European values rather than triumphant atheism?"  
Correct: death of God. Distractors: pragmatic maxim, eternal recurrence, perspectivism.  
Quality: ✓ Excellent — genuinely educational, clear (if demanding), distractors are Nietzsche-adjacent.

**Q10** — `gk-genetic-engineering-gm-food-1994`  
"What was the first genetically modified food sold commercially, released in 1994?"  
Correct: Flavr Savr tomato. Distractors: Innate potato, Purple tomato, Golden rice.  
Quality: ✓ Good — specific year anchor, distractors are real GM products, just wrong ones.

**Q11** — `philosophy_at_nozick_experience_machine`  
"Robert Nozick's thought experiment in Anarchy, State, and Utopia (1974) described a hypothetical device that gives you any experiences you desire. What is the name of this thought experiment device?"  
Correct: experience machine. Distractors: What Is It Like to Be a Bat?, Chinese Room, Twin Earth.  
Quality: ✓ Good — all distractors are genuine philosophy thought experiments, high-quality academic content.

---

## Run Narrative (decision log)

**Run 1 — Hub entry to Floor 2 death:**

Entered a fresh Hub (Level 1, 0 XP, 50g, 0 stats). The hub art was immediately impressive — cave campfire, character sitting, dungeon door with signs. Clicked the door area to start a run. The deck selection screen appeared cleanly with "TRIVIA DUNGEON" and "STUDY TEMPLE" options. Selected mixed domain.

A narrative opening text appeared on a black background (auto-dismissing countdown: ~9s): *"The terms were set before you descended..."* — well-written, atmospheric. First dungeon map loaded: Floor 1 "Shallow Depths" with 3 combat nodes visible in the bottom row.

**First combat (Index Weaver):** Tutorial mode fired immediately — 8 sequential "Got it" popups across 6 turns explaining every mechanic. By turn 3 the popups became grating. The Index Weaver felt appropriately challenging: multi-hit barrage attacks, web poison debuff. The chain mechanic worked smoothly (attack → build chain → multiplier increased). Combat lasted 6 turns, took significant HP (100→62 before finishing). `acceptReward` crashed the Phaser canvas on first try — had to click Continue button via DOM directly.

Discovered a mystery room (The Whispering Shelf) that gave an Adapt card. The mystery prose was evocative and brief — no AI tells. Gold advanced to 60→70.

**Floor 2 combat (Ink Slug):** Entered at 48/100 HP with no healing opportunity. The Ink Slug's 81 HP compared to Floor 1's 44 HP felt like a significant HP spike. The Bog Grasp poison stacked up and combined with Fang Barrage hits dragged HP from 48→29→8 over 6 turns. Died at HP=8 before killing the Ink Slug (27/81 HP remaining).

**Run end screen:** Showed "DRIVEN BACK" with an F grade, Knowledge Harvest (SEEN 4/9, REVIEWING 5/9), accuracy 100% "EXCEPTIONAL", 2 encounters (1 won), 9m 37s. The post-run messaging was encouraging despite the harsh letter grade.

**Run 2 (exploratory):** Started fresh. Used the map to progress through 2 combats efficiently, then spawned to rest/shop/retreatOrDelve/mystery directly to evaluate those screens. Rest room was beautiful and clearly laid out. Shop had too-expensive items for starting gold. Retreat/Delve copy was confusing. Discovered FPS dropped to 7-14 in extended sessions.

---

## Self-Verification

Artifact paths produced during this session:

| Batch ID | Key Screenshot |
|---|---|
| llm-playtest-act1-001_none_1777870130691 | hub-initial.rr.jpg |
| llm-playtest-act1-001_none_1777870156120 | after-start-run.rr.jpg |
| llm-playtest-act1-001_none_1777870171626 | dungeon-map-floor1.rr.jpg |
| llm-playtest-act1-001_none_1777870203787 | dungeon-map-floor1-clear.rr.jpg |
| llm-playtest-act1-001_none_1777870233622 | first-room-entered.rr.jpg |
| llm-playtest-act1-001_none_1777870253929 | combat-floor1-start.rr.jpg |
| llm-playtest-act1-001_none_1777870273030 | combat-floor1-turn1-mid.rr.jpg |
| llm-playtest-act1-001_none_1777870295958 | combat-floor1-turn2-start.rr.jpg |
| llm-playtest-act1-001_none_1777870320030 | combat-floor1-turn3.rr.jpg |
| llm-playtest-act1-001_none_1777870343357 | combat-floor1-turn4.rr.jpg |
| llm-playtest-act1-001_none_1777870363272 | combat-floor1-turn5-or-end.rr.jpg |
| llm-playtest-act1-001_none_1777870387971 | combat-floor1-end-or-reward.rr.jpg |
| llm-playtest-act1-001_none_1777870429901 | combat1-result.rr.jpg |
| llm-playtest-act1-001_none_1777870446253 | reward-room-floor1-combat1.rr.jpg |
| llm-playtest-act1-001_none_1777870469788 | reward-room-floor1-cards.rr.jpg, after-reward-accept.rr.jpg |
| llm-playtest-act1-001_none_1777870490500 | after-reward-retry.rr.jpg |
| llm-playtest-act1-001_none_1777870513805 | black-screen-buttons.rr.jpg |
| llm-playtest-act1-001_none_1777870532148 | after-continue-click-attempt.rr.jpg |
| llm-playtest-act1-001_none_1777870553067 | second-room-entered.rr.jpg |
| llm-playtest-act1-001_none_1777870571458 | second-combat-start.rr.jpg (mystery event) |
| llm-playtest-act1-001_none_1777870590881 | after-mystery-whispering-shelf.rr.jpg |
| llm-playtest-act1-001_none_1777870613372 | third-room-entered.rr.jpg |
| llm-playtest-act1-001_none_1777870638181 | room-r2-n0.rr.jpg (Floor 2 combat) |
| llm-playtest-act1-001_none_1777870764899 | combat2-result.rr.jpg (run end) |
| llm-playtest-act1-001_none_1777870791703 | run-end-full.rr.jpg |
| llm-playtest-act1-001_none_1777870964551 | rest-room-spawned.rr.jpg |
| llm-playtest-act1-001_none_1777870985921 | shop-room-spawned.rr.jpg |
| llm-playtest-act1-001_none_1777871022120 | retreat-or-delve.rr.jpg |
| llm-playtest-act1-001_none_1777871044224 | mystery-event-spawned.rr.jpg |

All result.json files verified at respective paths under `/tmp/rr-docker-visual/`.

---

## Humanizer Audit

This report contains analysis-only content (no new player-facing prose written by this agent). The humanizer rule is exempt for QA analysis output. Exempt.
