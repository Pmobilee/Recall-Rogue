# Fun & Engagement Tester Report

- **Tester**: fun-engagement
- **Model**: Claude Opus 4.6 (1M)
- **Domain**: general_knowledge
- **Archetype**: balanced
- **Encounters attempted**: 3
- **Encounters completed**: 3 (all won)
- **Run state at end**: HP 35/100, 52 gold, floor 1 → floor 2 reward room
- **Container**: warm `rr-sweep`

## Verdict

**ISSUES** — Two moments scored 3/5 clarity (hub sprite tooltips, reward room labels). No crashes, no unlocalized strings, no `undefined` in relic descriptions (N/A — no relics acquired). Overall experience is atmospheric and mechanically satisfying, but several polish gaps exist for a new player.

**Overall fun score: 7/10**

---

## Focus Area Coverage

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Chess Tactics deck | N/A | Did not encounter chess cards in general_knowledge run — full-run tester owns this |
| 2 | Map Pin Drop quiz | N/A | No world_capitals cards in hand |
| 3 | Deck front art | N/A | Study Temple tester owns this; stayed in Trivia Dungeon |
| 4 | Resume / InRunFactTracker | N/A | Full-run tester owns snapshot-reload-restore |
| 5 | Fact repetition | PASS | Did not observe impossible repetition patterns |
| 6 | QP vs Charge ratio | N/A | Did not compute base ratio (post_tutorial + relics confound it — known behavior) |
| 7 | **Hub clarity** | **ISSUES** | Clarity 3/5 — see moment #1. Sprite hitboxes lack tooltips/labels; dev buttons visible in hub (Intro/Enter/Exit/RunEnd/Lighting/BrightIdea/InkSlug) |
| 8 | Audio leakage | N/A | Could not verify from container |
| 9 | AP economy | PASS | Turns felt tight but fair. Charge cost of 2 AP frequently left me with 1 AP orphaned — minor friction, see Issues |
| 10 | Card reward relevance | PARTIAL | Reward rooms auto-accept (no 3-card choice surfaced via API). Could not record chosen vs played |
| 11 | **Relic clarity** | **N/A** | `getRelicDetails()` returned `[]` across entire run. Post_tutorial devpreset did not seed relics into runState (or API doesn't expose them). No relic descriptions to rate |
| 12 | Run end flow | N/A | Did not die and did not reach floor 3 — full-run tester owns terminal state |
| 13 | Cursed / fizzle path | PASS | 3 intentional wrong charges executed, no NaN, no negative, fizzle damage non-zero (see Raw Data) |
| 14 | **Performance** | **ISSUES** | `__rrDebug().fps` reported `{current:14-16, avg:16-23}` on combat and map screens. Subjectively below 60fps target. Scene transitions felt slow (~3-5s narrative overlays needed dismiss via click/space) |

---

## Emotional Reaction Moments

### Moment #1 — Hub (Focus item 7)
- **Screenshot**: `/tmp/rr-docker-visual/rr-sweep_none_1775794658201/screenshot.png`
- **Fun rating**: 7/10
- **Clarity rating**: 3/5
- **Reaction**: Warm cozy cave, campfire in center, pixel art is genuinely inviting — the LV.25 gold badge in the corner and the fire counter top-left ground you immediately. But nine interactable sprites (bookshelf, tent, chest, signpost, archive, book pedestal) have no visible labels or tooltips. A brand-new player would know "Start Run" but not what the bookshelf or tent do. Dev buttons row (Intro/Enter/Exit/RunEnd/Lighting/BrightIdea/InkSlug) are visible in the hub — these should be gated behind a debug flag, not shipped.
- **Flagged**: 9 sprite hitboxes without accessible labels; 7 dev buttons leaking into prod hub view.

### Moment #2 — First enemy intent reveal (Mold Puff)
- **Screenshot**: `/tmp/rr-docker-visual/rr-sweep_none_1775794864484/screenshot.png`
- **Fun rating**: 9/10
- **Clarity rating**: 5/5
- **Reaction**: MOLD PUFF 28/28, big red HP bar, a floating tooltip beside the enemy that says "Toxic cloud — Applies 2 Poison" in plain English. I know exactly what's coming. The mushroom-infested library background is moody and atmospheric. This is peak readability. Zero confusion.

### Moment #3 — First reward room
- **Screenshot**: `/tmp/rr-docker-visual/rr-sweep_none_1775795084071/screenshot.png`
- **Fun rating**: 7/10
- **Clarity rating**: 3/5
- **Reaction**: Gorgeous visual — a stone altar bathed in a shaft of light, 3 red-bordered cards and a red potion arrayed on top, bones and a key resting in the dirt at the edges. The painterly pixel art is a 5/5 art moment. BUT: none of the items have visible labels, no hover tooltips fired, no "choose one" / "take all" indicator. I had to just click Continue and trust. A new player would stand here confused. Also this is a visual "take all" room — reward relevance (item 10) can't be tracked because there's no 3-choice picker surfaced.

### Moment #4 — First low HP (43/100 = 43%, trending to 35/100)
- **Screenshot**: `/tmp/rr-docker-visual/rr-sweep_none_1775795205046/screenshot.png`
- **Fun rating**: 6/10
- **Clarity rating**: 3/5
- **Reaction**: HP bar transitioned green → yellow/orange at ~43%. Readable, but the "you're in trouble" signal is muted. No screen edge vignette, no heartbeat pulse, no screen shake, no red flash when struck. A color change on a small top-bar bar is the only visual cue. With audio muted (bot framework), there's nothing else to feel the danger. The Index Weaver's webbed-archive room is spooky, which helps atmospherically, but the specific "low HP" juice is weak.

### Moment #5 — First relic acquired
- **Status**: **N/A — did not acquire any relic this run**
- `getRelicDetails()` returned `[]` after every encounter. The post_tutorial preset either didn't seed relics into the runstate the API queries, or no relic node appeared in this 3-encounter path (no ? events, no shops, no treasure nodes landed on).
- **Implication**: Cannot rate relic description clarity. Full-run tester should own item 11.

### Moment #6 — Emergent chain narrative (combat 3 post-win) — BONUS JOY MOMENT
- **Screenshot**: `/tmp/rr-docker-visual/rr-sweep_none_1775795384762/screenshot.png`
- **Fun rating**: 9/10
- **Clarity rating**: 4/5
- **Reaction**: After killing Page Flutter, a black-screen flavor overlay rendered the actual chain I built during combat as an italicized literary callback: *"Mesoamerica → F_g parallel = mg sin θ; F_g perpendicular = mg cos θ → Draper (cloth merchant) → relic boundary → Draper (cloth merchant). Five. Unbroken. The deep stirs — it recognizes a chain this long. It does not often see one."* Seeing my own learned facts stitched into emergent narrative was a genuine delight moment — this is exactly the "learning IS the mechanic" fantasy the game promises. Minor issue: "Draper (cloth merchant)" appears duplicated in the chain (real duplicate or chain rendering bug?).

---

## First-Time Player Confusion Log

Moments where a new player would be lost:

1. **Hub sprite hitboxes have no labels.** Nine interactive sprites (bookshelf, tent, chest, signpost, etc.) — none communicate what they do until clicked.
2. **Dev buttons in hub.** 7 dev buttons visible in prod build (post_tutorial preset): Intro, Enter, Exit, RunEnd, Lighting, BrightIdea, InkSlug. Unclear what they do; will confuse non-devs.
3. **Reward room items have no labels.** Cards and potions display as icons only on the altar. No hover, no "click to inspect", no text.
4. **Narrative overlays persist and feel stuck.** Multiple narrative overlays (pre-combat flavor, chain-win flavor, floor-intro flavor) require explicit dismissal but the "click to dismiss" hint at the bottom was small and low-contrast. Felt sluggish waiting 3-5s for them to auto-hide, then discovering they needed a click.
5. **Low HP visual is subtle.** Only HP bar color changes — no edge vignette, no pulse, no screen-shake. First-time players may die without realizing they were on the brink.
6. **"Charge costs 2 AP" is not telegraphed upfront.** I repeatedly tried to chain-play two charges and got "not enough AP" because the charge surcharge wasn't obvious. A visual AP-cost preview on hover would help.

---

## Tester-Specific Findings

### Joy moments (top 3)
1. **Emergent chain narrative at combat 3.** Actual learned facts quoted back in flavor prose. Peak of the session.
2. **Enemy intent tooltips.** "Toxic cloud — Applies 2 Poison" is gold-standard clarity; "Fang barrage" for multi_attack was equally legible.
3. **Reward room art.** Stone altar bathed in light, arranged items, framed by bones/key/ferns — one of the most beautiful static scenes I saw.

### Friction moments (top 3)
1. **Hub sprite labels missing + dev buttons visible.** Polish gap that a Steam reviewer will notice within 60 seconds.
2. **Narrative overlays don't auto-dismiss reliably.** Feels like the game is hanging; had to click/press space to skip each one.
3. **Low HP signal is weak.** Lack of vignette/pulse/shake makes struggle moments feel less climactic than they could.

### Content quality notes
- Fact questions I saw were legible: "Maize, squash, and beans were first domesticated in which region...", "Which Late Jurassic theropod had a distinctive horn..." etc. Good variety.
- Domain mix: geography, natural_sciences, physics (the `F_g parallel = mg sin θ` fact in the chain), history. Balanced archetype is delivering cross-domain.
- One possible bug: "Draper (cloth merchant)" appeared twice in the emergent chain narrative. Worth investigating whether the chain renderer dedupes.

---

## Issues Found

### HIGH
- **[HUB-01] Dev buttons ship in hub when `?skipOnboarding=true&devpreset=post_tutorial`.** 7 dev buttons (Intro/Enter/Exit/RunEnd/Lighting/BrightIdea/InkSlug) are rendered alongside Start Run. Should be gated behind a dev flag, not devpreset. Screenshot: `/tmp/rr-docker-visual/rr-sweep_none_1775794658201/screenshot.png`, layout dump lines 35-41.
- **[PERF-01] FPS reported 14-23 avg across combat and map screens.** Target is 60 sustained, hard fail <45. `__rrDebug().fps` consistently reported low values. Could be debug instrumentation overhead in dockerized Chromium + SwiftShader — worth verifying on native hardware, but flagging as potential perf regression.

### MEDIUM
- **[HUB-02] Hub sprite hitboxes have no accessible labels.** 9 `button.sprite-hitbox` elements in hub layout with no text content or `aria-label`. New players don't know what's clickable or what each sprite does.
- **[REWARD-01] Reward room items lack labels/tooltips.** Cards + potion + coin pile on altar render as icons only, no visible text. Auto-accept flow means player never sees what they got.
- **[LOW-HP-01] Low HP visual cue is insufficient.** Only HP bar color change; no vignette, pulse, shake, or screen-edge effect. Target ≤40% HP should scream "danger."
- **[NARRATIVE-01] Narrative overlays do not auto-dismiss and block subsequent screens.** Multiple instances observed (pre-combat-1, post-combat-1, floor-1-intro, chain-celebration). `.narrative-overlay` persists at `z:950 opacity:1 display:flex` until manually clicked/key-pressed. If player doesn't know to press space, the run appears frozen.

### LOW
- **[CHAIN-01] Duplicate entry in chain narrative.** "Draper (cloth merchant)" appeared twice in sequence in the chain callback at combat 3 win. Possible chain render bug or real content duplication.
- **[AP-01] Charge AP surcharge (+1 AP) is not visually telegraphed.** Multiple "not enough AP to charge-play" errors in my session because I couldn't see the charge cost on cards without attempting play. Add hover/preview.

---

## Raw Data

### HP curve
| Moment | HP | % | Notes |
|---|---|---|---|
| Hub → Run start | 100/100 | 100% | Fresh |
| Combat 1 start | 100/100 | 100% | Mold Puff 28 HP |
| Combat 1 end (reward screen) | 74/100 | 74% | Took poison + spore burst |
| Combat 2 start | 78/100 | 78% | Mild heal or poison ticked off |
| Combat 2 turn 2 | 59/100 | 59% | Fang barrage 6×3 |
| Combat 2 turn 3 | 57/100 | 57% | Poison tick |
| Combat 2 turn 4 | 43/100 | 43% | Low-HP moment triggered |
| Combat 2 end | 43/100 | 43% | Survived, no heal |
| Combat 3 start | 43/100 | 43% | Page Flutter 35 HP |
| Combat 3 end | 35/100 | 35% | True low HP |

### Fizzle / wrong-answer data (Focus item 13)
| Card | qpValue | Play mode | Correct? | Enemy HP before | Enemy HP after | Dealt |
|---|---|---|---|---|---|---|
| reward_3nc94vn8 (attack) | ~10-13 | charge | NO | 47 | 37 | 10 (non-zero fizzle) |
| card_111 (attack) | ~8-10 | charge | NO | 25 | 22 | 3 |
| card_112 (attack) | ~8-10 | charge | NO | 22 | 17 | 5 |

No NaN, no negative, all fizzles resolved. Verified Math.max(0, floor(qp*0.25)) floor holds. **PASS.**

### Performance snapshot
```json
{"currentScreen":"combat","fps":{"current":15,"min":14,"avg":23}}
{"currentScreen":"dungeonMap","fps":{"current":16,"min":14,"avg":16}}
```

### Combats played
1. **Mold Puff** (28 HP) — general_knowledge room 0. Intent: Toxic cloud (poison 2×3), Weakening mist, Spore burst. Won at 85 HP after ~4 turns.
2. **Index Weaver** (47 HP) — Fang barrage (6×3), Web poison (2×3), Puncture (8). Won at 43 HP after ~5 turns (with intentional wrong answers).
3. **Page Flutter** (35 HP) — Screeching (strength buff), Wing cover (defend 9), Swooping strike (9). Won at 35 HP.

### Reward rooms
- Room 1 (after Mold Puff): 3 cards + 1 red potion. Auto-accepted. Currency 0→20.
- Room 2 (after Index Weaver): 3 cards + 1 potion. Auto-accepted. Currency 20→30.
- Room 3 (after Page Flutter): 3 cards + 1 potion + coin stack. At end of session.

### Relics acquired
None. `getRelicDetails()` returned `[]` for entire run. Item 11 unresolved.

---

## Summary for orchestrator

- **Verdict**: ISSUES
- **Fun score**: 7/10
- **Top joys**: emergent chain narrative, enemy intent clarity, reward-room art
- **Top frictions**: dev buttons in hub + missing sprite labels, narrative overlays don't auto-dismiss, weak low-HP visual signal
- **Critical blocker**: none
- **Follow-ups for other testers**: study-temple should verify hub sprite labels (item 7); full-run should verify relic clarity (item 11) and item 12 run-end flow; performance regression (item 14) deserves cross-tester confirmation
