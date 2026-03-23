# AR-235: Map Path System Fixes

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 16, 17, 18
**Complexity:** Medium — layout scaling + path generation logic
**Dependencies:** AR-224 (Map Redesign/Progressive Path)

---

## Overview

Three map system issues: (1) Map nodes and paths don't scale to screen size. (2) Arrows point down instead of up — history should be at bottom, next choices at top, arrows pointing upward. (3) Path generator sometimes produces only one choice per node — minimum must be 2, occasionally 3.

---

## User's Exact Words

> "The path and node options need to scale beautifully to the size of the screen."

> "My first options were three attack rooms, then I chose a mystery room shown above. I expected to see previous options below on the bottom, with arrows going upward toward the next option. Currently 'Choose your path' shows one attack at the very bottom with the arrow going DOWN toward it. The arrows should go upward."

> "Change the pathing system so there are ALWAYS at least two options for any room toward the next room. Sometimes three. Never just one."

---

## Sub-Steps

### Step 1 — Scale Map Nodes and Paths to Screen Size
**File:** `src/ui/components/DungeonMap.svelte`

- Audit all node sizes, path line widths, gap spacing, and font sizes in the map component.
- Replace all hardcoded px values with `calc(Npx * var(--layout-scale, 1))` for layout and `calc(Npx * var(--text-scale, 1))` for fonts.
- Node size should be proportional to viewport: consider `min(5vw, 5vh)` for node diameter, or a calc-based scale.
- Path line width: `calc(3px * var(--layout-scale, 1))`.
- The full map must be visible and well-proportioned at 1280x720, 1920x1080, and 2560x1440.

**Acceptance:** Map nodes and connecting paths are well-proportioned and readable at 1920x1080. No elements too small or too large. All sizing uses scale variables, zero hardcoded px.

---

### Step 2 — Fix Arrow Direction: Upward (History Below, Choices Above)
**File:** `src/ui/components/DungeonMap.svelte`

- The map layout convention: completed rooms at bottom, next room choices at top.
- Arrows/connectors between nodes must point UPWARD (from completed room toward the choice above it).
- Audit the arrow rendering: if using SVG arrows, ensure the `marker-end` arrowhead points in the upward direction.
- If the map renders top-to-bottom (choice at top of DOM, history below), arrows pointing upward means the SVG path goes from bottom node to top node with arrowhead at the top end.
- Verify the visual layout matches: "choose your path" choices appear above the player's current position, not below.

**Acceptance:** Screenshot shows current position at bottom, next choices above it, arrows pointing upward toward the choices. History of visited rooms visible below current position.

---

### Step 3 — Enforce Minimum 2 Choices Per Node (Max 3)
**File:** `src/services/mapGenerator.ts`

- Find the path branching logic — where the number of room choices per node is determined.
- Change the minimum from 1 (or whatever it currently is) to 2.
- Maximum remains 3 (or set to 3 if not already).
- The generator must guarantee: every non-terminal node offers exactly 2 or 3 choices. Never 1. Never 0.
- If the current generator uses weighted random for branch count, change the weight table to exclude 1-branch outcomes.
- Add a post-generation validation assertion: `assert(node.choices.length >= 2 && node.choices.length <= 3)` — throw or log an error if violated.

**Acceptance:** Generate 100 map instances (can be done in a unit test or via console). Zero instances have a node with only 1 choice. All nodes have 2 or 3 choices.

---

### Step 4 — Visual Layout Pass
**File:** `src/ui/components/DungeonMap.svelte`

- After Steps 1-3, do a full visual pass on the map at 1920x1080.
- Ensure: node icons are identifiable (combat, mystery, shop, rest icons visible), node labels readable, path connections clear, no overlapping elements.
- Fix any layout issues found.

**Acceptance:** Screenshot shows a clean, readable map with correct arrow direction and properly spaced nodes.

---

## Files Affected

- `src/ui/components/DungeonMap.svelte` — scaling, arrow direction, layout
- `src/services/mapGenerator.ts` — minimum branch count enforcement

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (mapGenerator tests if they exist)
- [ ] Visual: Map scales correctly at 1920x1080
- [ ] Visual: Arrows point upward (history below, choices above)
- [ ] Visual: Current position clearly indicated, next choices clearly above
- [ ] Functional: 100 generated maps, all nodes have 2-3 choices, never 1

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
// Navigate to map view — or use gameFlowController to enter dungeon map state
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Check arrow direction carefully — take a screenshot before and after the fix to confirm the direction flipped.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
