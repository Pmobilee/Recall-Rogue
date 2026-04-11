# Track 10 — Visual Sweep Report

**Batch:** BATCH-2026-04-11-ULTRA
**Date:** 2026-04-11
**Agent:** BATCH-ULTRA-t10-a (Docker warm, port 3262, SwiftShader WebGL)
**Screens targeted:** 37 | **Captured:** 34 | **Failed to load:** 3
**Issues found:** 10 (1 high, 4 medium, 5 low)

---

## Screen Coverage Table

| Screen | Preset / Method | Verdict | Issues |
|--------|----------------|---------|--------|
| hub | `hub-endgame` | PASS | — |
| mainMenu | alias → hub | NOT DISTINCT | — |
| base | alias → hub | NOT DISTINCT | — |
| dungeonMap | `dungeon-map` | FAIL | issue-001 (HIGH): nodes render below viewport |
| combat | `combat-boss` | PASS | — |
| archetypeSelection | `archetype-selection` | PASS | — |
| cardReward | `card-reward-mixed` | WARN | issue-006 (LOW): card description text area empty |
| rewardRoom | `reward-gold-and-cards` | PASS | — |
| shopRoom | `shop-loaded` | PASS | — |
| restRoom | `rest-site` | PASS | — |
| restStudy | `study-quiz` | WARN | issue-005 (LOW): empty state has no background ambience |
| mysteryEvent | `mystery-event` | PASS | — |
| runEnd | `run-end-victory` | WARN | issue-007 (LOW): narrow column, large empty margins |
| deckSelectionHub | `dungeon-selection` | PASS | — |
| onboarding | `onboarding` | PASS | — |
| settings | `settings` | PASS | — |
| library | `library` | PASS | — |
| profile | `profile` | WARN | issue-010 (LOW): sparse empty state |
| journal | `journal` | PASS | — |
| relicSanctum | `relic-sanctum` | PASS | — |
| masteryChallenge | `mastery-challenge` | FAIL | issue-004 (MEDIUM): small panel in large dark void |
| retreatOrDelve | `retreat-or-delve` | PASS | — |
| specialEvent | `special-event` | PASS | — |
| relicSwapOverlay | `relic-swap` | FAIL | issue-002 (MEDIUM): renders specialEvent instead of RelicSwapOverlay |
| upgradeSelection | `upgrade-selection` | PASS | — |
| postMiniBossRest | `post-mini-boss-rest-full` | PASS | — |
| leaderboards | `hub-fresh` + loadCustom | PASS | — |
| multiplayerMenu | `hub-fresh` + loadCustom | PASS | — |
| studyTemple | `hub-fresh` + loadCustom | PASS | — |
| runPreview | `archetype-selection` + loadCustom | FAIL | issue-008 (MEDIUM): perpetual loading state |
| campfire | `rest-site` + loadCustom | PASS | — |
| restMeditate | `rest-site` + loadCustom | PASS | — |
| triviaDungeon | `dungeon-selection` + loadCustom | PASS | — |
| proceduralStudy | `study-quiz` + loadCustom | WARN | issue-009 (LOW): error state — no procedural deck registered |
| multiplayerLobby | `hub-fresh` + loadCustom | FAIL | issue-003 (MEDIUM): renders empty — requires currentLobby != null |
| relicReward | deprecated → `reward-room` preset | DEPRECATED | shows rewardRoom content (expected) |

---

## Issues by Severity

### HIGH (1)

**issue-001** — `dungeonMap` — nodes render below viewport (y=1233), map appears near-black on first load.
All map-node buttons exist in DOM but start at y=693–1233 (below the 1080px viewport). Player sees only fog wisps on a dark background. Scroll-to-current-floor initialization is not firing on first mount.
- Fix: `DungeonMap.svelte` — call `scrollToCurrentFloor()` after component mounts.

### MEDIUM (4)

**issue-002** — `relicSwapOverlay` — loads `specialEvent` ('Deck Thin') instead of RelicSwapOverlay component.
The `relic-swap` preset does not populate `pendingSwapRelicId`, so the RelicSwapOverlay guard condition fails and the previous screen (specialEvent) bleeds through.
- Fix: `relic-swap` scenario preset should also set `pendingSwapRelicId` in run state.

**issue-003** — `multiplayerLobby` — renders empty (only screen-transition element).
MultiplayerLobby component only mounts when `currentLobby !== null`. No scenario preset bootstraps a mock lobby object.
- Fix: Add a `multiplayer-lobby` scenario preset that sets `currentLobby` to a mock object before navigating.

**issue-004** — `masteryChallenge` — quiz panel occupies ~30% of 1920×1080; 70% is black void.
Panel is approximately 600×420px centered in a 1920×1080 canvas. Content is correct but undersized for Steam PC target.
- Fix: Expand mastery challenge overlay layout or add a background visual to fill the dark surrounding area.

**issue-008** — `runPreview` — perpetual 'Preparing your knowledge chains...' loading state; chain distribution never renders.
`loadCustom({ screen: 'runPreview' })` does not populate `activeRunState.chainDistribution`, causing the component to wait indefinitely.
- Fix: Add a `run-preview` scenario preset that bootstraps `chainDistribution` data before navigating.

### LOW (5)

**issue-005** — `restStudy` — empty state ('No Cards to Review') has pure dark background; no Phaser scene or ambient visual.
Functionally correct (escape button present per HIGH-8 contract) but visually disconnected from the game world. Other rest screens show the rest-site Phaser background.
- Fix: Consider keeping rest-site Phaser scene active behind the empty state.

**issue-006** — `cardReward` — card description text areas appear as dark empty rectangles.
Card name, type icon, and artwork visible; lower description text area blank. Three card choices (Strike, Block, Expose). Possible: description requires quiz hydration step or scenario data gap.
- Fix: Investigate whether card description text rendering requires resolved quiz fact in the scenario context.

**issue-007** — `runEnd` — victory screen uses narrow centered column (~800px wide) on 1920px canvas.
Content is functional (FOES VANQUISHED, KNOWLEDGE HARVEST, RUN STATS sections all present) but utilizes only ~42% of horizontal space. Large (~560px) empty margins on both sides.
- Fix: Consider expanding runEnd layout to use more horizontal space, or add side panels for detailed fact review.

**issue-009** — `proceduralStudy` — shows error state 'Could not start practice session. You'll need to register a procedural deck.'
Expected behavior in test context (no procedural deck registered), but error message is unclear to regular players. Escape ('Go Back') button present.
- Fix: Improve error message copy; add a procedural study scenario preset that bootstraps the required deck.

**issue-010** — `profile` — fresh save state shows sparse layout; sections appear to float in empty space.
Level 1, all stats at zero, 'No expeditions yet' placeholder. Functional but could confuse new players about what the screen will show when populated.
- Fix: Add richer empty-state messaging per section ('Complete your first expedition to see stats here').

---

## Top 5 Worst Screens

1. **dungeonMap** (HIGH) — Complete visibility failure; player sees black screen with fog wisps, no navigable map. Blocker-level UX issue.
2. **relicSwapOverlay** (MEDIUM) — Wrong screen renders; RelicSwapOverlay is completely unreachable via current scenario setup.
3. **multiplayerLobby** (MEDIUM) — Screen is completely empty; no testable visual state without mock lobby data.
4. **masteryChallenge** (MEDIUM) — 70% of screen is dead black space on the Steam PC target; quiz panel is functionally correct but visually underwhelming.
5. **runPreview** (MEDIUM) — Perpetual loading state; chain distribution screen never populates. Player would see a spinner forever.

---

## Screens That Passed Cleanly (no issues)

hub, combat, archetypeSelection, rewardRoom, shopRoom, restRoom, mysteryEvent, deckSelectionHub, onboarding, settings, library, journal, relicSanctum, retreatOrDelve, specialEvent, upgradeSelection, postMiniBossRest, leaderboards, multiplayerMenu, studyTemple, campfire, restMeditate, triviaDungeon (23 screens)

---

## Methodology Notes

- Docker warm container (SwiftShader WebGL, 1920×1080, system Chromium).
- All Phaser-rendered screens waited >= 5000ms; complex scenes (combat, dungeonMap, rewardRoom) waited 6000–8000ms.
- Screenshots that appeared near-black (leaderboards, multiplayerMenu, studyTemple) were cross-validated against layout dumps per `testing.md` protocol — all confirmed to have correct DOM content; dark backgrounds are expected (no Phaser canvas context active for DOM-only screens loaded via eval after hub-fresh).
- "HIDDEN" flags in layout dumps were not treated as bugs without PNG confirmation.
- `relicReward` is flagged as deprecated in the Screen type union and routes to `rewardRoom`'s Phaser scene; captured under relicReward evidence dir using reward-room preset.
- `mainMenu` and `base` are hub aliases with no distinct components; counted in screensTargeted per the 37-screen task contract but not separately testable.

---

## Evidence

All screenshots and layout dumps are in `evidence/screens/<screen-id>/`:
- `screenshot.png` — full 1920×1080 PNG
- `layout-dump.txt` — DOM + Phaser spatial dump
