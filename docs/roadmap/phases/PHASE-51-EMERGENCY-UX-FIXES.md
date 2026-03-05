# Phase 51 — Emergency UX & Gameplay Fixes

**Priority**: CRITICAL — These bugs block core gameplay loops
**Status**: NOT STARTED
**Reported**: 2026-03-06
**Dependencies**: Phases 0-50 complete

---

## Overview

This phase addresses 11 critical UX and gameplay bugs discovered during live playtesting. Every issue either breaks a core loop (dive → results → continue) or creates confusion about what the player owns/can do. All must be fixed before the game is shareable.

**Bugs in priority order:**

| # | Issue | Severity |
|---|-------|----------|
| 51.1 | "Continue" after dive always goes to dome, not next level | Critical |
| 51.2 | Re-entering mine after results produces unresponsive empty scene | Critical |
| 51.3 | Consumables freely available without purchase | High |
| 51.4 | Relics freely available without finding them | High |
| 51.5 | Pickaxe UI shows all pickaxes; UX is confusing | High |
| 51.6 | Artifact collected in mine never appears in facts | High |
| 51.7 | Multiple same-type consumables selectable beyond owned quantity | High |
| 51.8 | No loot summary shown on mine exit | Medium |
| 51.9 | Starter dome missing critical rooms; GAIA terminal not clickable | High |
| 51.10 | Settings button hidden behind DEV button | Medium |
| 51.11 | Floor indicator dots stuck as screen overlay, not in dome | Medium |
| 51.12 | Sidebar content is not context-aware (dome vs mine) | Medium |
| 51.13 | Wrong quiz answer does not exclude that fact from next question | High |

---

## Sub-step 51.1 — "Continue" routes back to dome instead of next level

### Problem
`handleDiveResultsContinue()` in `src/App.svelte:573` always calls `getGM()?.goToBase()`, sending the player to the dome regardless of how they exited the mine. The player expects "Continue" to mean "keep diving deeper".

### Expected Behaviour
- **Voluntary exit (player used exit ladder)**: Show "Return to Dome" OR "Dive Deeper" as two distinct CTA buttons.
- **Forced exit (oxygen depleted)**: Only "Return to Dome" — player cannot voluntarily continue after O2 depletion.
- **"Dive Deeper"**: Directly starts next layer (no dome visit, carries current loadout + relics).

### Files to Modify
- `src/ui/stores/gameState.ts` — Add `exitType: 'voluntary' | 'forced'` to `DiveResults` interface
- `src/game/GameManager.ts` — Populate `exitType` in `endDive(forced)` call; set `'forced'` when `forced === true`, `'voluntary'` when player used exit ladder
- `src/ui/components/DiveResults.svelte` — Accept `onDiveDeeper?: () => void` prop; show "Dive Deeper" button only when `!diveResults.forced`; rename existing "Continue" to "Return to Dome"
- `src/App.svelte` — Implement `handleDiveDeeperContinue()`: calls `getGM()?.continueToNextLayer()` instead of `goToBase()`
- `src/game/GameManager.ts` — Add `continueToNextLayer()` method: re-uses last dive's layer data, increments layer, starts next MineScene (same flow as `handleDescentShaft`)

### Acceptance Criteria
- [ ] After voluntary exit: DiveResults shows "Return to Dome" and "Dive Deeper" buttons side by side
- [ ] After forced exit: DiveResults shows only "Return to Dome"
- [ ] "Dive Deeper" starts the next layer (layer+1) in MineScene with inventory carried over
- [ ] "Return to Dome" goes to dome as before
- [ ] Typecheck passes with 0 new errors

---

## Sub-step 51.2 — Re-entering mine from dome shows unresponsive empty level

### Problem
After viewing DiveResults and choosing "Return to Dome", clicking "Mine Entrance" in the dome starts a fresh dive at layer 1. However the mine scene appears empty and unresponsive — the player cannot click any tiles and only the "Surface" HUD button works.

**Root cause (suspected)**: `startDive()` in GameManager calls `scene.start('MineScene', data)` but if MineScene was previously stopped (during the last dive's `endDive()`) and the Phaser scene system still has stale state, the `create()` lifecycle may not fully re-initialize. Specifically: `TickSystem` callbacks from the previous dive (`instability`, `mine-events`) are NOT unregistered in `handleShutdown()`, so they persist into the new scene and fire on old (destroyed) objects, potentially throwing errors that silently break game logic.

### Files to Modify
- `src/game/scenes/MineScene.ts` — In `handleShutdown()`, add `TickSystem.getInstance().unregister('instability')` and `TickSystem.getInstance().unregister('mine-events')` to the existing cleanup block (currently only `hazard-system` is unregistered)
- `src/game/scenes/MineScene.ts` — In `create()`, always call `TickSystem.getInstance().resetAll()` when `currentLayer === 0` to ensure a clean slate (already done, verify it runs before any tick registrations)
- `src/game/scenes/MineScene.ts` — Add `this.events.off('shutdown', this.handleShutdown, this)` at the start of `handleShutdown()` to prevent double-registration on scene restart (Phaser's EventEmitter3 does NOT deduplicate `.on()` calls with the same handler; after stop+start+stop, the handler fires twice)

### Acceptance Criteria
- [ ] Player can start a fresh dive, exit voluntarily, return to dome, and immediately start another dive
- [ ] Second dive is fully interactive (tiles clickable, player moves)
- [ ] No console errors during second dive startup
- [ ] TickSystem has 0 duplicate callbacks after second scene start

---

## Sub-step 51.3 — Consumables freely available without purchase

### Problem
`DivePrepScreen.svelte` cycles through `ALL_CONSUMABLE_IDS` (all possible consumable types) when filling slots, regardless of what the player actually owns. `playerSave.consumables` (or similar field) tracks owned quantities but is not consulted.

### Expected Behaviour
- Consumable slots only show types the player currently owns (qty > 0)
- If player owns 0 consumables, slots show as empty/locked with "Find in mines" hint
- Owned quantity is shown on each slot (e.g. "×3")

### Files to Modify
- `src/ui/components/DivePrepScreen.svelte` — Change consumable slot cycling logic: only cycle through consumable IDs where `playerSave.consumables[id] > 0`; show owned count badge on each filled slot
- `src/data/types.ts` — Verify `PlayerSave.consumables` field exists as `Record<ConsumableId, number>`; add if missing
- `src/game/GameManager.ts` — When a consumable is used during a dive, decrement `playerSave.consumables[id]` and persist

### Acceptance Criteria
- [ ] Fresh player (no consumables owned) sees all 3 slots as empty with "Find in mines" hint
- [ ] After finding a bomb in a mine, the bomb appears in slot cycling on next dive prep
- [ ] Owned count badge visible on each selected slot
- [ ] Selecting more consumables than owned is impossible (slot stays empty if none owned)
- [ ] Consumable quantity decrements after a dive that uses them

---

## Sub-step 51.4 — Relics freely available without finding them

### Problem
`DivePrepScreen.svelte` line 167–169:
```typescript
const displayRelics = $relicVault.length > 0 ? $relicVault : RELIC_CATALOGUE
```
This fallback shows all relics in the catalogue when the vault is empty, which is always the case for new players.

### Expected Behaviour
- Relic section shows only relics in `playerSave.relicVault` (found during dives)
- If vault is empty, show a placeholder: "No relics found yet — explore mines to discover them"
- Remove the `RELIC_CATALOGUE` fallback entirely (it was a dev shortcut)

### Files to Modify
- `src/ui/components/DivePrepScreen.svelte` — Remove the `RELIC_CATALOGUE` fallback; always use `$relicVault`; show empty state message when vault is empty

### Acceptance Criteria
- [ ] Fresh player sees "No relics found yet" placeholder in relic section
- [ ] Relic found in mine appears in vault on next dive prep
- [ ] DEV panel still has a "Give Relic" button for testing (do not remove DEV functionality)

---

## Sub-step 51.5 — Pickaxe selection UI is confusing (shows all pickaxes from start)

### Problem
DivePrepScreen shows a grid of all pickaxe types (standard + reinforced + higher tiers). New players see options they haven't unlocked, and the UX is a flat grid rather than a purposeful gear slot.

### Expected Behaviour
- One "Pickaxe" gear slot shown in DivePrepScreen, displaying the currently selected pickaxe
- Tapping the slot opens a bottom-sheet / dropdown listing only pickaxes the player owns
- Default: auto-select the last pickaxe used in the previous dive (persisted in `selectedLoadout.pickaxeId`)
- Owned pickaxes are tracked in `playerSave.ownedPickaxes: string[]`
- Every player starts with only `'pickaxe_standard'` in their owned list

### Files to Modify
- `src/data/types.ts` — Add `ownedPickaxes: string[]` to `PlayerSave` (default: `['pickaxe_standard']`)
- `src/services/saveService.ts` — Migration guard: add `ownedPickaxes: ['pickaxe_standard']` for saves missing this field
- `src/ui/components/DivePrepScreen.svelte` — Replace pickaxe grid with single gear-slot button; tapping opens an inline dropdown of owned pickaxes; "pickaxe_reinforced" and higher only appear after unlocked/crafted
- `src/game/GameManager.ts` — When a pickaxe is crafted/unlocked, push its ID to `playerSave.ownedPickaxes`

### Acceptance Criteria
- [ ] Fresh player sees one pickaxe slot: "Standard Pickaxe" (only option)
- [ ] Tapping slot shows dropdown with only owned pickaxes
- [ ] Last-used pickaxe auto-selected on next dive prep
- [ ] Reinforced pickaxe does NOT appear until unlocked

---

## Sub-step 51.6 — Artifact collected in mine never appears in facts

### Problem
`ArtifactNode` blocks are mined and added to the dive inventory, but after surfacing and viewing dive results, the player's facts/knowledge base does not show them. The conversion pathway (artifact → learnable fact) is either broken or not wired to a visible UI.

### Root Cause (to investigate)
- `endDive()` in GameManager calls `scene.surfaceRun()` which should process artifacts
- `reviewNextArtifact()` is called from `handleDiveResultsContinue()` if `pendingArtifacts.length > 0`
- Verify `pendingArtifacts` is populated after a dive with artifacts; if not, trace from `surfaceRun()` → `GameManager.endDive()` → `diveResults` → `pendingArtifacts` store

### Files to Investigate / Modify
- `src/game/GameManager.ts` — `endDive()` (line ~1246): verify that artifacts from `scene.surfaceRun()` are pushed to `pendingArtifacts` store
- `src/game/scenes/MineScene.ts` — `surfaceRun()`: confirm `artifactsFound` array is returned with populated fact IDs
- `src/App.svelte` — `handleDiveResultsContinue()` (line 573): confirm `reviewNextArtifact()` is called and leads to artifact review screen
- `src/ui/stores/gameState.ts` — `pendingArtifacts` store: confirm it is set after endDive
- `src/ui/stores/playerData.ts` — Confirm that completing artifact review calls `updateReviewState()` or equivalent to make the fact appear in the study queue

### Acceptance Criteria
- [ ] Mine an ArtifactNode, surface, view dive results, click Continue
- [ ] Artifact review/appraisal screen appears showing the artifact's fact
- [ ] After completing the appraisal quiz, fact appears in the player's knowledge base
- [ ] Fact shows as reviewable in the study queue within 24h

---

## Sub-step 51.7 — Multiple same-type consumables selectable beyond owned quantity

### Problem
The consumable slot cycling in DivePrepScreen allows placing the same consumable type in multiple slots (e.g., 3× bomb) even if the player only owns 1 bomb. The dive then starts with 3 bomb slots but only 1 real bomb.

### Expected Behaviour
- Each consumable slot tracks type AND deducts from owned pool as slots are filled
- If player owns 2 bombs, at most 2 bomb slots can be filled
- Cycling a slot past the available quantity skips to the next available consumable type

### Files to Modify
- `src/ui/components/DivePrepScreen.svelte` — Rewrite slot cycling: maintain a running "remaining quantity" map per consumable; when cycling, skip types with 0 remaining; decrement remaining when assigned to a slot; increment when removed from a slot

### Acceptance Criteria
- [ ] Player with 1 bomb can only fill 1 slot with bombs; second slot skips bomb
- [ ] Player with 3 bombs can fill all 3 slots with bombs
- [ ] Removing a bomb from a slot makes it available again for other slots

---

## Sub-step 51.8 — No loot summary shown on mine exit

### Problem
When a player voluntarily exits the mine (exit ladder) or is forced out (oxygen depletion), the `DiveResults` screen shows only a minimal summary. The user wants a clear "what did I gain this run" breakdown including all loot types.

### Expected Behaviour
`DiveResults.svelte` should show a comprehensive loot summary:
- All mineral types collected (dust, shards, crystals, geodes, essence) — already partially done in App.svelte inline template
- Artifacts found (count + names)
- Relics found (count + names)
- Facts learned this dive
- Blocks mined, layers reached, O2 remaining

The existing inline template in `App.svelte:970-998` should be moved into `DiveResults.svelte` and expanded.

### Files to Modify
- `src/ui/stores/gameState.ts` — Extend `DiveResults` interface: add `artifactsFound: string[]`, `relicsFound: string[]`, `factsLearned: number`, `layersReached: number`
- `src/game/GameManager.ts` — Populate new fields in `endDive()` when setting `diveResults`
- `src/ui/components/DiveResults.svelte` — Expand loot summary section with all new fields; style as a distinct loot card with icons per category
- `src/App.svelte` — Remove the inline `{#if $diveResults}` loot block from App.svelte; DiveResults component owns this display

### Acceptance Criteria
- [ ] After any exit, DiveResults shows: minerals (all types), artifacts count, relics found, facts learned count, blocks mined, layers reached
- [ ] Zero-quantity items are hidden (don't show "Geodes: 0")
- [ ] Forced exit shows "Run cut short — some loot was lost" warning if loot loss occurred
- [ ] Voluntary exit shows "Safe return — all loot secured"

---

## Sub-step 51.9 — Starter dome missing critical rooms; GAIA terminal not clickable

### Problem
New players only see: Mine Entrance, Materializer, Tiny Sapling, and a non-interactive "GAIA Te..." element. Missing from starter dome:
- Way to review collected facts (study room / knowledge tree)
- Way to examine/appraise artifacts
- Way to upgrade floors / access progression
- GAIA terminal is not clickable (event handler missing or pointer-events blocked)

### Expected Behaviour
- **GAIA Terminal**: Must be clickable; opens GAIA dialogue/chat panel. Check CSS `pointer-events` and z-index; ensure click handler fires on the dome room element
- **Study Room**: Should be accessible from floor 1 of dome. Even if the full room isn't built, a "Study Queue" button/room must exist pointing to `currentScreen.set('study')`
- **Artifact Lab**: Must be accessible after first artifact is found. Either always show (locked state) or unlock after first artifact
- **Upgrade Panel**: Some path to "upgrade floors" must be reachable from dome floor 1 (via a button, a room, or a GAIA prompt)

### Files to Investigate / Modify
- `src/game/scenes/DomeScene.ts` — Check click handlers for GAIA terminal room; ensure `pointerdown` event is registered and not blocked
- `src/ui/stores/hubLayout.ts` — Check which rooms are unlocked by default for new players
- `src/game/scenes/DomeScene.ts` — If study room / artifact lab room tiles exist, verify they have click handlers that emit appropriate game events
- `src/App.svelte` or relevant screen file — Verify `currentScreen.set('study')` leads to a functioning study screen
- `src/ui/components/rooms/` — Check which room components exist and which are wired up

### Acceptance Criteria
- [ ] GAIA terminal is clickable and opens a GAIA panel/dialogue
- [ ] From dome floor 1, player can reach the study queue / review screen
- [ ] From dome floor 1, player can see artifact appraisal entry point (even if locked with "Find an artifact first" state)
- [ ] From dome floor 1, player can see floor upgrade option (even if expensive)

---

## Sub-step 51.10 — Settings button hidden behind DEV button

### Problem
The settings button (gear icon or similar) is positioned at `top-right` and is visually covered by the DEV button which also sits at `top: 4px; right: 4px; z-index: 9999`.

### Expected Behaviour
- DEV button and Settings button are side by side, not overlapping
- DEV button: `top: 4px; right: 4px`
- Settings button: `top: 4px; right: 48px` (or similar, to the left of DEV)
- Both buttons remain visible at all times when present

### Files to Modify
- `src/ui/components/DevPanel.svelte` — Adjust `.dev-toggle` position to leave room for settings button, or add `right: 4px` and document the gap
- Whichever component renders the settings button (search for `settings-btn` or `gear` icon) — adjust its `right` offset to not overlap with DEV button
- Confirm both are on the same z-index level or that DEV is deliberately above settings (with documented reasoning)

### Acceptance Criteria
- [ ] Settings button fully visible and clickable
- [ ] DEV button fully visible and clickable
- [ ] No overlap between the two buttons at 320px-wide viewport and up
- [ ] On production build (DEV button hidden), settings button shifts to `right: 4px`

---

## Sub-step 51.11 — Floor indicator dots displayed as screen overlay, not inside dome

### Problem
The floor indicator dots (showing current dome floor level) are rendered as a fixed-position HTML/Svelte overlay on top of the Phaser canvas rather than being part of the dome scene rendering. They appear "stuck on screen" regardless of what is being displayed.

### Expected Behaviour
- Floor dots should only appear when `currentScreen === 'dome'`
- Ideally rendered as Phaser game objects inside DomeScene, OR as a Svelte overlay that is conditionally shown only during dome view
- Should be positioned relative to the dome canvas, not `position: fixed` on the full viewport

### Files to Investigate / Modify
- Search for floor dot rendering: `grep -rn "floor.*dot\|dot.*floor\|floorDot\|levelDot" src/`
- If in a Svelte component: add `{#if $currentScreen === 'dome'}` wrapper around the dots
- If `position: fixed`: change to `position: absolute` within a dome-specific container, or move rendering into DomeScene.ts as Phaser graphics

### Acceptance Criteria
- [ ] Floor dots only visible when in dome view
- [ ] Floor dots not visible during mine, quiz, study, or results screens
- [ ] Floor dots correctly positioned relative to dome canvas

---

## Sub-step 51.12 — Sidebar content not context-aware

### Problem
`DesktopSidePanel.svelte` always shows: player name, streak, Facts Mastered, Due for Review, and Keyboard Shortcuts. This is irrelevant information during a mine run.

### Expected Behaviour
**In dome** (`currentScreen === 'dome'`): Keep current content (facts mastered, due for review, streak)
**In mine** (`currentScreen === 'mining'`): Show mining-specific info:
  - Current layer / depth
  - Oxygen remaining (bar or fraction)
  - Blocks mined this run
  - Artifacts found this run
  - Active consumables (icons)

**In study/quiz** (`currentScreen === 'study' | 'quiz'`): Show quiz progress:
  - Facts reviewed this session
  - Current streak
  - Due count

### Files to Modify
- `src/ui/components/DesktopSidePanel.svelte` — Import `currentScreen` store; conditionally render different panels based on screen
- `src/ui/stores/gameState.ts` — Verify `currentLayer`, `oxygenState`, `blocksMinedThisRun` are exported as readable stores (they may already exist)
- `src/ui/components/DesktopSidePanel.svelte` — Subscribe to mine state stores; display oxygen bar using existing styles from HUD

### Acceptance Criteria
- [ ] In dome: shows facts mastered, due for review, streak
- [ ] In mine: shows layer, oxygen %, blocks mined, artifacts found this run
- [ ] In quiz/study: shows facts reviewed today, streak, due count
- [ ] Transition between contexts is immediate on screen change (no stale data)

---

## Sub-step 51.13 — Wrong quiz answer does not exclude fact from next question

### Problem
`getInterestWeightedFact()` in GameManager calls `factsDB.getPacedFact()` with no "recently asked / recently failed" exclusion. If the player answers a fact incorrectly, the very next quiz can be that same fact again.

### Expected Behaviour
- Track `lastAskedFactId: string | null` in GameManager (reset per dive)
- `getInterestWeightedFact()` passes this to `getPacedFact()` as an exclusion
- After a wrong answer specifically, additionally track `recentlyFailedFactIds: Set<string>` (cleared on layer change); exclude these from the next 3 quiz picks
- `factsDB.getPacedFact()` accepts an optional `excludeIds: string[]` parameter

### Files to Modify
- `src/game/GameManager.ts` — Add `private lastAskedFactId: string | null = null` and `private recentlyFailedFactIds: Set<string> = new Set()`; populate in `getInterestWeightedFact()` (set `lastAskedFactId` after selection); update `recentlyFailedFactIds` in quiz answer handlers when `correct === false`; clear on layer change
- `src/game/GameManager.ts` — Pass `excludeIds: [...recentlyFailedFactIds, lastAskedFactId].filter(Boolean)` to `getPacedFact()`
- `src/services/factsDB.ts` (or wherever `getPacedFact` is defined) — Add optional `excludeIds?: string[]` parameter; filter out excluded IDs before selection

### Acceptance Criteria
- [ ] Getting a fact wrong in quiz → next quiz is a DIFFERENT fact (never the same one immediately)
- [ ] After answering wrong, that fact is not asked again for the next 3 quizzes in the same dive
- [ ] `lastAskedFactId` excludes the just-asked fact even on correct answers (no immediate repeat)
- [ ] On layer change, `recentlyFailedFactIds` resets (layer-specific pacing)

---

## Playwright Test Scripts

### Test 51.1 — Dive → Exit → "Dive Deeper" starts next layer
```js
// /tmp/test-51-1-dive-deeper.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: '/opt/google/chrome/chrome' })
  const p = await b.newPage()
  await p.setViewportSize({ width: 1200, height: 800 })
  await p.goto('http://localhost:5173')
  // ... skip onboarding, quick dive, navigate to exit ladder, surface
  // Assert: DiveResults shows two buttons "Return to Dome" and "Dive Deeper"
  // Click "Dive Deeper"
  // Assert: currentScreen === 'mining', layer === 2 (HUD shows "Layer 2")
  await p.screenshot({ path: '/tmp/test-51-1.png' })
  await b.close()
})()
```

### Test 51.2 — Second dive is fully interactive
```js
// /tmp/test-51-2-second-dive.js
// Quick dive → surface → return to dome → mine entrance → verify tiles clickable
// Assert: HUD shows oxygen bar, player sprite visible, clicking a tile produces visual response
```

### Test 51.3 — Fresh player sees no consumables
```js
// /tmp/test-51-3-no-consumables.js
// Clear localStorage, load game, skip onboarding, open dive prep
// Assert: all 3 consumable slots show "Find in mines" / empty state
// Assert: no cycling through bomb/flare/etc.
```

### Test 51.4 — Fresh player sees no relics
```js
// /tmp/test-51-4-no-relics.js
// Clear localStorage, load, open dive prep
// Assert: relic section shows "No relics found yet" placeholder
// Assert: no relic buttons visible
```

### Test 51.6 — Artifact flow: mine → surface → facts
```js
// /tmp/test-51-6-artifact-facts.js
// DEV: give artifact, surface, continue
// Assert: artifact review screen appears
// Assert: after completing appraisal, fact appears in knowledge base (check playerSave.learnedFacts)
```

### Test 51.9 — GAIA terminal clickable
```js
// /tmp/test-51-9-gaia-clickable.js
// Load game, enter dome
// Find and click GAIA terminal tile
// Assert: GAIA panel/dialogue opens
```

### Test 51.10 — Settings and DEV buttons not overlapping
```js
// /tmp/test-51-10-button-layout.js
// Load game
// Get bounding boxes of DEV button and settings button
// Assert: bounding boxes do not overlap
// Assert: both buttons have opacity > 0 and are within viewport
```

### Test 51.13 — No repeat quiz after wrong answer
```js
// /tmp/test-51-13-no-repeat-quiz.js
// DEV: force quiz, answer wrong
// Assert: next quiz fact ID !== previous quiz fact ID
// DEV: answer wrong again
// Assert: fact from 2 quizzes ago is still excluded
```

---

## Verification Gate

Before marking Phase 51 complete, ALL of the following must pass:

### Functional
- [ ] 51.1: "Dive Deeper" starts layer+1 with inventory carried
- [ ] 51.1: "Return to Dome" still works as before
- [ ] 51.2: Second fresh dive after dome visit is interactive
- [ ] 51.3: No consumables shown without ownership
- [ ] 51.4: No relics shown without vault items
- [ ] 51.5: Only owned pickaxes in dropdown; standard selected by default
- [ ] 51.6: Artifact from mine appears in facts after appraisal
- [ ] 51.7: Cannot select more of a consumable type than owned
- [ ] 51.8: Loot summary shows all gained items on exit
- [ ] 51.9: GAIA terminal clickable; study queue accessible from dome
- [ ] 51.10: Settings and DEV buttons visible and non-overlapping
- [ ] 51.11: Floor dots only show during dome view
- [ ] 51.12: Sidebar shows mine stats during mine, knowledge stats in dome
- [ ] 51.13: Same fact never asked twice in a row

### Technical
- [ ] `npm run typecheck` — 0 errors (same or fewer than current 56 warnings)
- [ ] `npm run build` — successful
- [ ] Playwright screenshots confirm: mine view (layer 0), mine layer transition, dive results both buttons, dome GAIA clickable
- [ ] No new JS console errors during normal gameplay flow

---

## Files Affected

**New files**: none expected

**Modified files**:
- `src/App.svelte` — dive deeper handler, remove inline loot block
- `src/game/GameManager.ts` — `continueToNextLayer()`, `recentlyFailedFactIds`, `lastAskedFactId`, `endDive()` artifacts fix
- `src/game/scenes/MineScene.ts` — `handleShutdown()` tick unregistration, double-listener guard
- `src/game/scenes/DomeScene.ts` — GAIA terminal click handler
- `src/ui/components/DiveResults.svelte` — two CTA buttons, expanded loot summary
- `src/ui/components/DivePrepScreen.svelte` — owned-only consumables, owned-only relics, pickaxe dropdown
- `src/ui/components/DesktopSidePanel.svelte` — context-aware content
- `src/ui/components/DevPanel.svelte` — position adjustment
- `src/data/types.ts` — `PlayerSave.ownedPickaxes`, `DiveResults.exitType`
- `src/services/saveService.ts` — migration guard for `ownedPickaxes`
- `src/services/factsDB.ts` — `excludeIds` parameter for `getPacedFact()`
- Floor-dot component (TBD — find via grep) — conditional show for dome only
