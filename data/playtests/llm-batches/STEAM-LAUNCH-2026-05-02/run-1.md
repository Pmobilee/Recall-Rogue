# Run 1 — DOM-only Playthrough

## Outcome
Died on Floor 1, combat encounter 1 (Staple Bug). Could not deal damage via Quick Play (2 damage - 10 block = 0). Never accessed Charge Play mechanic (requires Phaser canvas interaction, not DOM). Completed full flow: hub → deck select → dungeon start → narration → map → combat → death → runEnd → hub.

## Step-by-step
| Step | Screen | Action (DOM testid + text) | Result | Issue ID |
|------|--------|----------------------------|--------|---------|
| 1 | hub | Clicked `btn-start-run` | Went to deck selection | — |
| 2 | deckSelectionHub | Clicked `.panel--trivia` | Went to Armory deck config | — |
| 3 | triviaDungeon | Clicked "Start Run ▶" button | Went to dungeonMap + narration | — |
| 4 | narration | Tried to click "click to dismiss" button | Dismiss NOT FOUND (button textContent empty, counted as no-text button) | ISSUE-1-1 (partial) |
| 5 | narration | Waited 7s, narration auto-dismissed | Landed on dungeonMap | — |
| 6 | dungeonMap | Observed map — nodes at y=1233+, viewport=1080 | First nodes BELOW viewport | ISSUE-1-2 |
| 7 | dungeonMap | Manually scrolled to r0n0 via scrollIntoView | Map nodes barely visible at bottom edge | ISSUE-1-2 |
| 8 | dungeonMap | Clicked map-node-r0-n0 (state-available) | Entered combat | — |
| 9 | combat | Tutorial overlay appeared | 5 "Got it" clicks required to dismiss | ISSUE-1-3 |
| 10 | combat | Clicked card-hand-0 (Strike) | Card played via Quick Play; no Charge overlay appeared | ISSUE-1-4 |
| 11 | combat | Repeated clicking cards | Enemy gained 10 block (Harden Shell), all damage blocked | — |
| 12 | combat | End turn × 7 | Enemy attacked each turn, 16 damage per turn | — |
| 13 | combat | AP confirmation "You still have AP" appeared every turn | 5+ extra confirmation clicks needed | ISSUE-1-5 |
| 14 | combat | Player died (4→0 HP) | runEnd screen appeared | — |
| 15 | runEnd | Observed death screen: DRIVEN BACK, Grade F | All stats 0 (no quiz answers via Quick Play) | ISSUE-1-6 |
| 16 | runEnd | Clicked `btn-home` | Returned to hub | — |

## Issues found in this run

### ISSUE-1-1: Narration dismiss button not clickable via DOM
- Severity: LOW
- Where: Dungeon narration overlay
- What happened: Button had no textContent (all text was in CSS before-content or child elements), so text-based query failed. Had to wait for auto-dismiss.
- What I expected: Button would respond to `.click()` or be identifiable
- Evidence: result.json "NOT FOUND, buttons: |||||||||||||||||||||||"
- Steam-reviewer impact: Non-issue for real player with mouse. Low priority.

### ISSUE-1-2: Dungeon map initial scroll shows boss area, not starting nodes
- Severity: HIGH
- Where: dungeonMap — immediately after entering dungeon
- What happened: Map container (scrollHeight 1398, clientHeight 1006) opened at scrollTop=108, showing the top of the map (boss node at y=267). The first available nodes (r0) were at y=1233, completely below the 1080px viewport. Player sees a near-black starfield screen with zero clickable elements visible.
- What I expected: Map should auto-scroll to show the bottom (starting) nodes
- Evidence: screenshot `run1-map-visible.rr.jpg` — pure black with no nodes; node rects confirmed off-screen
- Steam-reviewer impact: "I can't click anything after starting a run." Would quit and negative review.

### ISSUE-1-3: First combat tutorial requires 5 dismiss clicks
- Severity: MEDIUM
- Where: Combat — first encounter
- What happened: 5 sequential "Got it" tutorial popups appeared before being able to play any card
- What I expected: 1-2 tutorial steps max, or all on one screen
- Evidence: screenshots `run1-after-start.rr.jpg` through `run1-combat-all-tutorial-done.rr.jpg`
- Steam-reviewer impact: "Too many tutorials." Would feel over-tutorialized.

### ISSUE-1-4: Charge Play mechanic completely undiscoverable via click
- Severity: HIGH
- Where: Combat — card interaction
- What happened: Clicking any card immediately Quick-plays it (no quiz). The Charge Play mechanic (which opens a knowledge quiz for full damage) requires hovering in Phaser canvas to see a popover with Quick/Charge options. Tutorial warns about it but provides no clear UI affordance. Against Staple Bug with 10 Block/turn, Quick Play is entirely useless (2 damage - 10 block = 0).
- What I expected: Clear UI element (button or visual indicator) on the card showing how to trigger Charge Play
- Evidence: No quiz-option or charge-overlay data-testid appeared in any DOM inspection
- Steam-reviewer impact: "I can't damage the enemy, cards don't work." Would likely quit or negative review. HIGH.

### ISSUE-1-5: "You still have AP" confirmation fires repeatedly even at critical HP
- Severity: MEDIUM
- Where: Combat — end turn
- What happened: Every turn had AP remaining → confirmation dialog appeared. Even at 4/100 HP (about to die) the dialog fires.
- What I expected: Maybe suppress confirmation at low HP, or after N turns
- Evidence: Multiple screenshots showing End Turn → End Turn confirmation → repeat cycle
- Steam-reviewer impact: "Annoying popup every turn." MEDIUM friction.

### ISSUE-1-6: RunEnd shows 0 Encounters despite completing 1 combat
- Severity: MEDIUM
- Where: runEnd screen
- What happened: ENCOUNTERS stat showed 0, though we entered and played through 1 combat encounter (Staple Bug).
- What I expected: ENCOUNTERS: 1
- Evidence: pageText = "ENCOUNTERS\n0"
- Steam-reviewer impact: Minor stats confusion. LOW-MEDIUM.

## Subjective notes
- Hub looks beautiful and clear. Immediately understood to click the door.
- Deck selection screen is clean and well-labeled. "Trivia Dungeon / The Armory" vs "Study Temple / The Library" is clear.
- Armory deck config with domain chips and subdeck selection is impressive but overwhelming on first view (260+ subdecks visible).
- Dungeon narration prose is good quality: "Somewhere beneath this collector's labyrinth, a curiosity cabinet was sealed against those who would use its fragments irresponsibly."
- Map is NOT USABLE on first load — black screen kills momentum immediately.
- Combat background art (industrial/pipe aesthetic for Floor 1) matches the "Staple Bug" enemy well.
- "Mandible snap — Attacking for 30 HP damage" was written as 30 in the intent but showed 16 as displayDamage — inconsistency in intent display?
- RunEnd screen is polished and clear. "DRIVEN BACK / Grade F / Remind yourself that overconfidence is a slow and insidious killer." is evocative.
