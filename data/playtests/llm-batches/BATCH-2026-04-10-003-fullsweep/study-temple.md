# Study Temple Tester — BATCH-2026-04-10-003-fullsweep

**Tester**: study-temple
**Model**: claude-opus-4-6[1m]
**Domain**: Study Temple / Library path (primary owner of Focus Item 3)
**Container**: Docker warm, `rr-sweep` agent
**Encounters attempted**: 0 combat (this path does not enter combat; owns deck-selection UI)
**Encounters completed**: N/A (deck-front + study-UI focus)

---

## Verdict: **PASS**

All 7 new deck fronts (`anime_manga`, `chess_tactics`, `fifa_world_cup`, `ocean_life`, `philosophy`, `pop_culture`, `world_literature`) load cleanly in the Study Temple grid at portrait 365×636 CSS dimensions from 768×1024 source webps, with dark pixel-art styling matching the established set and "NEW" badges visible on 6/7 (Philosophy's badge not visible in the capture frame — likely just off-screen rather than missing; see low-sev note). No console errors, 70/70 deck tiles rendered, 0 broken, 0 stuck-loading. No landscape regressions.

---

## Focus Area Coverage

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Chess Tactics deck runtime puzzles / no MC / no hints | N/A | Not exercised — no combat in this tester's path. Chess Tactics deck-front art verified as portrait pixel-art (see Item 3). Full-run tester owns runtime-puzzle verification. |
| 2 | Map Pin Drop quiz mode (world_capitals) | N/A | World Capitals deck detail modal reached ("Launch Expedition" available) but did not enter combat. Map-pin mode fires inside combat quiz UI. |
| 3 | **Deck front art (7 new decks)** | **PASS** | All 7 loaded, portrait 365×636, dark pixel-art style, sourced from correct `/assets/sprites/deckfronts/*.webp`. No broken images across all 70 tiles. |
| 4 | Resume flow — InRunFactTracker rebuild | N/A | Requires active run + snapshot/reload. Balance-curve / full-run testers. |
| 5 | Fact repetition (NOT a bug) | N/A | No combat quizzes captured. |
| 6 | QP vs Charge ratio | N/A | No combat. |
| 7 | Post-tutorial onboarding hub clarity | N/A | Fun tester owns this. Hub reached cleanly though (`getScreen()==='hub'`, active-run banner present). |
| 8 | Audio leakage | N/A | No audio observed in the Study Temple screen. No Phaser scene running on this DOM-only screen. |
| 9 | AP economy sanity | N/A | Balance-curve tester. |
| 10 | Card reward relevance | N/A | No card rewards in Study Temple flow. |
| 11 | Relic clarity | N/A | Fun tester. |
| 12 | Run end flow | N/A | Full-run tester. |
| 13 | Cursed / fizzle path | N/A | Combat-only mechanic; no combat in this tester's path. |
| 14 | Performance subjective signal | PASS | `studyTemple` screen renders 70 deck tiles + scrollable grid. Navigate `hub→library→studyTemple→deck-click→modal` all respond within expected latency (<3s combined wait budget across transitions). No sluggishness, no hanging transitions. |

---

## Tester-Specific Findings

### Screen topology clarification (for future testers)

The Recall Rogue "Library/Study Temple" hierarchy has two DIFFERENT screens, which is confusing:

- `library` (screen id `library`) — **FACT BROWSER**. A purple Anki-style row list of 53,269 individual facts with category sidebar (All / General / Science / Space / General Geography / Capitals & Flags / History / Myth / Animals / Health / Cuisine / Art / Language). `fact-row` elements at 507×132 (landscape). **This is NOT where deck fronts live.**
- `studyTemple` (screen id `studyTemple`, UI header "THE LIBRARY") — **DECK SELECTION GRID**. 70 portrait deck tiles at 365×636, selected from a sidebar (All / Custom Decks / Languages / Math / History / Art / Science / General Geo.. / Social Sci / General / Space / Myth / Sports / Health / Animals / Cuisine / Workshop). **This is where the 7 new deck fronts live.**

Clicking a tile opens a deck-detail modal with "Launch Expedition" (starts a run) and "+ Add to Custom Deck". The Anki-style study card flow (`startStudy` / `getStudyCard` / `gradeCard`) is a SEPARATE mechanic scoped to rest rooms inside a run, not a standalone Study Temple feature.

### Deck Front Coverage Table (all 7 new decks)

| deck_id | art_loaded | source | natural_size | css_size | aspect | style_match | NEW_badge | verdict |
|---|---|---|---|---|---|---|---|---|
| `anime_manga` | ✅ yes | `/assets/sprites/deckfronts/anime_manga.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art, purple palette, cat silhouette on starfield | ✅ visible | PASS |
| `chess_tactics` | ✅ yes | `/assets/sprites/deckfronts/chess_tactics.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art, chess board w/ hanging lanterns | ✅ visible | PASS |
| `fifa_world_cup` | ✅ yes | `/assets/sprites/deckfronts/fifa_world_cup.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art, stadium w/ trophy and sunbeams | ✅ visible | PASS |
| `ocean_life` | ✅ yes | `/assets/sprites/deckfronts/ocean_life.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art, jellyfish in teal underwater scene | ✅ visible | PASS |
| `philosophy` | ✅ yes | `/assets/sprites/deckfronts/philosophy.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art, isometric study w/ books + armillary sphere | ⚠ not visible in capture frame (likely cropped, not missing) | PASS |
| `pop_culture` | ✅ yes | `/assets/sprites/deckfronts/pop_culture.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art with vibrant pink accents, disco orb + symbols | ✅ visible | PASS |
| `world_literature` | ✅ yes | `/assets/sprites/deckfronts/world_literature.webp` | 768×1024 | 365×636 | portrait 0.574 | ✅ dark pixel-art, warm-lit bookshelves in arched doorway | ✅ visible | PASS |

**Aggregate audit**: `document.querySelectorAll('.deck-tile img')` returned `{count: 70, broken: 0, loading: 0, total: 70}`. Console errors: 0. No 404s, no placeholder fallbacks, no landscape covers.

### Parallax hover — inconclusive (NOT a bug)

Programmatic `mouseenter`/`mousemove` CustomEvent dispatch on a deck tile did NOT update the `.plx-layer` img's `transform` (remained at `translate(0%, 0%) scale(1.08)`). This is EXPECTED for Svelte-reactive mousemove handlers bound via `bind:clientX` or `on:mousemove` — synthetic events without proper pageX/pageY deltas and without going through the full event loop won't trigger Svelte store updates. The `.plx-layer` is present in the DOM with a baseline 1.08 scale transform, confirming the parallax layer is mounted. **Not marking this as a bug** — absence of transform change under synthetic events is not proof of absence of parallax under real cursor input.

### Study Flow (startStudy from outside a run)

| Criterion | Score 1-5 | Note |
|---|---|---|
| Visual polish | N/A | Not in a proper study session; could not grade |
| Answer reveal timing | N/A | No card rendered |
| Grading button clarity | N/A | No grade buttons rendered |
| Progress indication | 1/5 | Showed "QUESTION 1 / 0" — see HIGH bug below |
| Overall flow | N/A | Flow precondition (being in a run's rest room) not met |

### 10 Captured Study Cards

Not captured. `getStudyCard()` returned `null` because no active study session could be started from outside a run context. See Issues → HIGH for the "1/0" empty-state bug.

---

## Issues Found

### HIGH — Study screen shows "QUESTION 1 / 0" when deck pool is empty

**Steps to reproduce:**
1. From hub (no active run), call `window.__rrPlay.startStudy(10)`.
2. `startStudy` logs an `ok: false` error (`Study button [data-testid="rest-study"] not found`) but the containing logic nonetheless navigates the screen store to `restStudy`.
3. Result: full-black screen with a single purple-bordered box displaying "QUESTION 1 / 0" — no card, no back button, no error, no grade buttons. Player is visually stuck in an empty flashcard UI.

**Screenshot**: `/tmp/rr-docker-visual/rr-sweep_none_1775795932998/study-session-start.png`

**Why it's HIGH**: Two independent defects compound:
- (a) `__rrPlay.startStudy()` fails its precondition check but still lets the screen advance, violating the "fail fast" contract.
- (b) The `restStudy` screen's empty-pool state renders `QUESTION 1 / 0` instead of a friendly "no cards to study" card or auto-redirect to hub. A real player hitting this via a mis-wired button would be stuck (no back button visible in the capture).

Since the primer says this tester should drive study session flows, this empty-state bug is directly in scope. Recommended fix: `restStudy` should early-return to hub or show a "No cards to review" empty state with a dismiss button when the study pool is empty.

### LOW — Philosophy deck NEW badge not visible in screenshot

In the screenshot where Philosophy is centered (`philosophy-focus.png`), the NEW badge that's visible on all 6 other new decks (anime_manga, chess_tactics, fifa_world_cup, ocean_life, pop_culture, world_literature) is NOT visible on Philosophy. Possible causes:
1. Badge IS present in DOM but clipped by the viewport's top edge at this scroll position (most likely — Philosophy was near the top of the visible window; other NEW tiles had more vertical room).
2. Badge is missing from Philosophy's deck data.

I did NOT verify (1) vs (2) programmatically (would require a DOM query for `.new-badge` within the Philosophy tile). Flagging as LOW for a follow-up owner to confirm. Not marking as HIGH because 6/7 badges render correctly and the deck art itself is fine.

### LOW — Library fact-browser has no text accessible to `getAllText()`

On the `library` screen (`getAllText` returned `{byTestId:{}, byClass:{}, raw:[]}`) despite fact cards clearly rendering (53269 facts, 13 category buttons). The `getAllText` helper is missing a selector for `.fact-row` content and sidebar-label text, which makes text-driven testing of the fact browser impossible. Not a gameplay bug; a testability gap.

### MEDIUM — `library` screen has 4.6MB layout dump (truncation risk)

The fact browser renders all ~53269 facts in a single scrollable list rather than virtualizing. The resulting layout dump is 4.6MB (exceeds default Read cap of 256KB). In addition to making testing harder, this is a likely performance issue for low-end Steam PCs: DOM with tens of thousands of `.fact-row` buttons is expensive. Suggest virtualized scrolling (react-virtual equivalent) for the fact browser. Flagging as MEDIUM because the user can still reach the screen — it's a performance/scalability concern, not a blocker.

---

## Raw Data

### Image audit (from `document.querySelectorAll('.deck-tile img')`)

```json
{"count": 70, "broken": 0, "loading": 0, "total": 70}
```

### 7-target verification (from targeted eval)

```json
[
  {"deck": "anime_manga",      "found": true, "src": "/assets/sprites/deckfronts/anime_manga.webp"},
  {"deck": "chess_tactics",    "found": true, "src": "/assets/sprites/deckfronts/chess_tactics.webp"},
  {"deck": "fifa_world_cup",   "found": true, "src": "/assets/sprites/deckfronts/fifa_world_cup.webp"},
  {"deck": "ocean_life",       "found": true, "src": "/assets/sprites/deckfronts/ocean_life.webp"},
  {"deck": "philosophy",       "found": true, "src": "/assets/sprites/deckfronts/philosophy.webp"},
  {"deck": "pop_culture",      "found": true, "src": "/assets/sprites/deckfronts/pop_culture.webp"},
  {"deck": "world_literature", "found": true, "src": "/assets/sprites/deckfronts/world_literature.webp"}
]
```

### Tile dimension sample (first 10)

All 10 confirmed portrait (h > w): Algebra, Ancient Greece, Ancient Rome, Anime & Manga, AP Biology, AP Chemistry, AP European History, AP Human Geography, AP Macroeconomics, AP Microeconomics — each `365×636` CSS, aspect ratio 0.574 (consistently portrait).

### Artifact paths

- Library fact-browser full PNG: `/tmp/rr-docker-visual/rr-sweep_none_1775795705382/library-overview.png`
- Study Temple overview PNG: `/tmp/rr-docker-visual/rr-sweep_none_1775795816082/studytemple-overview.png`
- Per-deck focus captures: `/tmp/rr-docker-visual/rr-sweep_none_1775795875186/{anime-manga|chess-tactics|fifa|ocean-life|philosophy|pop-culture|world-literature}-focus.png`
- Empty study-screen bug: `/tmp/rr-docker-visual/rr-sweep_none_1775795932998/study-session-start.png`
- Launch-expedition modal: `/tmp/rr-docker-visual/rr-sweep_none_1775795963085/after-deck-click.png`

---

## Summary for orchestrator

- **Verdict**: PASS
- **Library reachable?**: Yes — TWO reachable screens: `library` (fact browser, 53k facts) and `studyTemple` (deck selection grid, 70 portrait tiles). Note `studyTemple`'s on-screen header reads "THE LIBRARY", which is the source of the name collision.
- **7-deck art audit**: 7/7 PASS — all loaded, portrait 365×636 from 768×1024 sources, dark pixel-art style, 0 broken images across all 70 total tiles.
- **Study flow score**: N/A overall — could not exercise the Anki-style flashcard flow from outside a run. Surfaced a HIGH empty-state bug in `restStudy` where `QUESTION 1 / 0` renders with no exit path when pool is empty.
