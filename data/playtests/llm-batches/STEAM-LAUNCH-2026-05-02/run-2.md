# Run 2 — DOM-only Playthrough

## Outcome
Died on Floor 1, combat encounter 1 (Bookmark Vine, 40 HP). Player reached 16/100 HP before enemy killed them. Discovered that DOM `.click()` on card buttons does NOT register card plays in the game engine — only keyboard shortcuts (1-5) and Phaser canvas interactions register actual card plays. Tested with different enemy (Bookmark Vine vs Run 1's Staple Bug).

## Step-by-step
| Step | Screen | Action (DOM testid + text) | Result | Issue ID |
|------|--------|----------------------------|--------|---------|
| 1 | hub | Clicked btn-start-run | deck selection | — |
| 2 | deckSelectionHub | Clicked .panel--trivia | Armory config | — |
| 3 | triviaDungeon | Clicked "Start Run ▶" | dungeonMap + narration | — |
| 4 | narration | Clicked narration overlay | Narration dismissed | — |
| 5 | dungeonMap | Observed — nodes below viewport again | Confirmed ISSUE-1-2 | ISSUE-1-2 |
| 6 | dungeonMap | scrollTop = scrollHeight (max scroll) | Nodes visible at bottom | — |
| 7 | dungeonMap | Clicked map-node-r0-n2 | Entered combat vs Bookmark Vine | — |
| 8 | combat | Clicked ? button | Keyboard help overlay appeared | — |
| 9 | combat help | Read shortcuts: 1-5 select card, Q=quick play, C=charge play, Enter=end turn | Discovered Charge Play mechanic | ISSUE-2-1 |
| 10 | combat | Closed help, pressed key '1' | Card played! AP: 5→2 (Transmute card?) | — |
| 11 | combat | Pressed key '2' | Strike-4 played, enemy 40→36 HP | — |
| 12 | combat | DOM .click() on cards | AP unchanged, cardsPlayedThisTurn=0 | ISSUE-2-2 |
| 13 | combat | Keys 1,2,3,4,5 + Enter | Cards played, enemy 32→28 HP, player died | — |
| 14 | runEnd | DRIVEN BACK — Grade F, Accuracy 100%, SEEN 6/6, +12 XP | Run stats shown | — |
| 15 | runEnd | "Practice Run" banner appeared | Accuracy too high = no camp rewards | ISSUE-2-3 |
| 16 | runEnd | ENCOUNTERS: 0 again | Confirmed encounters counter bug | ISSUE-1-6 |
| 17 | runEnd | Clicked btn-home | Hub | — |

## Issues found in this run

### ISSUE-2-1: Charge Play discovery requires finding the ? button or hovering over Phaser canvas
- Severity: HIGH
- Where: Combat — card interaction
- What happened: The ONLY way to discover Quick Play vs Charge Play as a new player is to: (a) find and click the "?" keyboard help button (not obvious), or (b) hover over a card to see Phaser canvas popover. No persistent UI hint about Charge Play exists.
- What I expected: A visual UI element on each card (icon, tooltip, or split button) showing "Quick" vs "Charge" options
- Evidence: Help overlay screenshot `run2-kbd-help.rr.jpg` shows Q/C shortcuts
- Steam-reviewer impact: "I went 5 turns without knowing I could answer questions for full damage." HIGH.

### ISSUE-2-2: DOM .click() on card-hand-N buttons does NOT register card plays
- Severity: MEDIUM for players (keyboard fallback exists), HIGH for testing
- Where: Combat — card buttons
- What happened: Clicking card-hand-N DOM buttons triggers CSS animations (card-playing class) but cardsPlayedThisTurn stays 0 and AP doesn't decrease
- What I expected: DOM button click = card play
- Evidence: cardsPlayedThisTurn=0 after multiple DOM clicks; keyboard key presses DID register
- Steam-reviewer impact: Non-issue for mouse players who hover/click in the Phaser canvas. But suggests the DOM button is not the primary interaction target.

### ISSUE-2-3: "Practice Run" penalty appears confusingly early
- Severity: MEDIUM
- Where: runEnd screen
- What happened: After playing just Quick Play cards (no quiz), accuracy showed 100% "EXCEPTIONAL" and triggered "Practice Run — No camp rewards — you already know this material"
- What I expected: Practice Run should only trigger for players with genuine mastery, not new players who haven't even answered their first question
- Evidence: runEnd screenshot `run2-combat-result.rr.jpg` — 100% EXCEPTIONAL, Practice Run notice
- Steam-reviewer impact: "The game told me I already know everything but I haven't answered any questions yet." MEDIUM confusion.

## Subjective notes
- Bookmark Vine combat background (vine-covered library) looks fantastic, great variety from Run 1.
- Enemy visual variety (Staple Bug vs Bookmark Vine) is excellent.
- The keyboard help overlay is clean and professional.
- "Poisoned thorns — Applies 2 Dagger" status effect appeared during combat, adding tactical depth.
- The "Practice Run" notice has good flavor text: "Dive a domain you struggle with to earn rewards." But context is wrong here.
- RunEnd with "ACCURACY: 100% EXCEPTIONAL" feels wrong for a player who died on floor 1 having never answered a knowledge question.
- Navigating back to hub is instant and seamless.
