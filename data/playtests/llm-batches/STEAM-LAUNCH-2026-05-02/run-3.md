# Run 3 — Keyboard-Driven Combat, Charge Play Attempt

## Outcome
Died on Floor 1, combat encounter 1 (Thesis Construct, 48 HP). Player reached 9 HP before dying. Successfully used keyboard shortcuts (1-5) for all card plays — confirming this is the correct interaction model. Attempted Charge Play (key C) but it executed as Quick Play without showing a quiz. New enemy type Thesis Construct introduced with escalating "Crystal Slam" attack (22 HP damage). 

## Step-by-step
| Step | Screen | Action (DOM testid + text) | Result | Issue ID |
|------|--------|----------------------------|--------|---------|
| 1 | hub | location.reload() | hub reloaded fresh | — |
| 2 | hub | Clicked btn-start-run | deck selection | — |
| 3 | deckSelectionHub | Clicked `.panel.panel--trivia` | triviaDungeon config | — |
| 4 | triviaDungeon | Clicked "Start Run ▶" | dungeonMap + narration | — |
| 5 | dungeonMap | Clicked narration overlay | Narration dismissed | — |
| 6 | dungeonMap | `.map-scroll-container` scrollTop = scrollHeight | Nodes scrolled into view | ISSUE-1-2 |
| 7 | dungeonMap | Surveyed all 18 map nodes | All nodes are combat type; row 0 has 3 available; r2-n0 = elite, r7-n0 = boss | ISSUE-3-3 |
| 8 | dungeonMap | Clicked map-node-r0-n1 | Entered combat vs Thesis Construct (48 HP) | — |
| 9 | combat | Keys 1, 2, 3 | 2 cards connected, AP 3→1→auto-new-turn. Player took damage 100→98 | — |
| 10 | combat | Key 1 then key C | AP 3→2, cardsPlayed 0→1 — NO quiz appeared. Charge Play silent-executed as Quick Play | ISSUE-3-1 |
| 11 | combat | Keys 1-5 repeating over multiple turns | Enemy 48→44→40→32→26→22→18→14→12 HP; Player 100→98→84→71→53→41→23→9 HP | — |
| 12 | combat | End of AP at 9 HP, enemy at 12 HP | Player died (enemy Crystal Slam 22 damage, 9 HP insufficient) | — |
| 13 | runEnd | Observed DRIVEN BACK — Grade F, ENCOUNTERS 0 | Confirmed ENCOUNTERS bug (run 3) | ISSUE-1-6 |
| 14 | runEnd | Observed "0% of dungeon explored" | Confirmed dungeon explored metric broken | ISSUE-3-2 |
| 15 | runEnd | Practice Run banner again | 100% accuracy from Quick Play → Practice Run (3rd run in a row) | ISSUE-2-3 |
| 16 | runEnd | rrScreenshot captured Phaser canvas, not runEnd UI | Screenshot shows combat background despite runEnd screen | ISSUE-3-4 |
| 17 | runEnd | Clicked btn-home | Hub | — |

## Issues found in this run

### ISSUE-3-1: Charge Play key (C) does not trigger quiz — silently plays as Quick Play
- Severity: HIGH
- Where: Combat — keyboard interaction
- What happened: After selecting card 1 (key '1'), pressing 'C' decremented AP and registered a card play but showed NO quiz overlay. The card played without any knowledge check.
- What I expected: Key 'C' with a card selected should open a quiz popup with the card's fact question and 4 answer options.
- Evidence: `{ap:3→2, cardsPlayed:0→1, hasQuiz:false, quizText:null}` — AP changed but quiz never appeared.
- Steam-reviewer impact: "Charge Play is supposed to let me answer questions for bonus damage, but pressing C just plays the card normally." Core learning mechanic is non-functional via keyboard. CRITICAL.

### ISSUE-3-2: "0% of dungeon explored" shown even after dying deep in Floor 1 combat
- Severity: MEDIUM
- Where: runEnd screen — exploration stats
- What happened: After reaching Floor 1 and fighting ~10 turns of combat, runEnd showed "You explored 0% of the dungeon." The text reads: "You aced what you faced — but only explored 0% of the dungeon."
- What I expected: Some exploration progress shown for completing a combat encounter (or attempting one).
- Evidence: runEnd pageText includes "explored 0% of the dungeon" across all 3 runs.
- Steam-reviewer impact: "I fought for 6 minutes and it says I explored 0% of the dungeon." Discouraging and likely wrong.

### ISSUE-3-3: No shop, mystery, or rest rooms visible on any map — all combat nodes
- Severity: MEDIUM
- Where: dungeonMap — room variety
- What happened: All 3 runs showed maps with 100% combat nodes (except 1 elite + 1 boss). No shop, mystery event, or rest rooms ever appeared.
- What I expected: Map should have varied room types (Slay the Spire model: shop every ~5 floors, rest sites, mystery events).
- Evidence: `nodes.map(n=>n.type)` output for Run 3: `['combat','combat','combat','locked-combat'×15, 'type-elite', 'type-boss']`.
- Steam-reviewer impact: "There's no shop or rest areas, just constant combat. The roguelite map feels shallow." MEDIUM.

### ISSUE-3-4: rrScreenshot during runEnd captures Phaser canvas, not Svelte overlay
- Severity: LOW (testing infrastructure), MEDIUM (player perception — runEnd UI may not render on Phaser)
- Where: runEnd screen — screenshot/rendering
- What happened: When screen="runEnd", `rrScreenshot` captures the Phaser combat background (enemy sprite still visible at 12/48 HP) instead of the runEnd Svelte component overlay.
- What I expected: The runEnd screen UI to be captured in the screenshot.
- Evidence: All 3 run end screenshots show combat backgrounds, DOM shows runEnd components with correct data.
- Steam-reviewer impact: RunEnd overlay may appear visually jarring if the Phaser background shows through. Verify overlay actually covers canvas fully on real hardware.

## Subjective notes
- Thesis Construct (crystal/stone golem in cave) visual is high quality — very distinct from prior enemies.
- The escalating Crystal Slam threat (10 damage early, 22 damage late) creates genuine tension and strategic pressure to finish the enemy quickly.
- Block cards feel meaningful — the shield cards visibly reduced incoming damage each turn.
- Dying at 9 HP with enemy at 12 HP is genuinely frustrating in a good way — "so close!" feeling is real. Good design.
- The combat pacing across 6+ turns felt natural — no softlocks, no freezes, no broken states.
- Knowledge Harvest breakdown (SEEN 2/10, REVIEWING 8/10) is genuinely interesting to see. Suggests FSRS is running correctly under the hood even with Quick Play only.
- GREY MATTER: 0 shown on runEnd — unclear what this resource does or how to earn it.
- Total XP +28 across 10 knowledge items is generous and motivating.
- "Remind yourself that overconfidence is a slow and insidious killer." — the death flavor text is great.
- All three keyboard-driven runs played smoothly; keyboard shortcuts 1-5 + Enter work reliably.
