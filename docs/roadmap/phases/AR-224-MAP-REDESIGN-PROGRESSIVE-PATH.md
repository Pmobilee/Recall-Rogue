# AR-224: Map Redesign — Progressive Path View

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #34, #35, #36
> **Priority:** P1 — Major UI overhaul
> **Complexity:** Large (complete map redesign + generation rebalancing)
> **Dependencies:** None (independent system)

---

## Overview

Complete redesign of the dungeon map. Replace the full map overview with a progressive, step-by-step path view. Players see only their NEXT choices, with a scrollable history of past decisions. Also rebalance map generation for better distribution and increase desktop floor length to 12.

---

## User's Exact Words

- **#34:** "I hate the map! I from now on don't want to see the entire map of the floor, I want to see the NEXT options we have each time, even the first time we select, and instead of a blue line I want it to be like a path mark with - - - - -> in off white with black borders leading to the circles. These paths must spring from the last selected node, so all we can see after a while is scroll down and see all our choices in the past, along with all the ones we haven't taken, so we can sort of see how through time, centered in the middle of the screen, our choices got us where we are. No more planning beforehand. This means we disable our map animation at the start, and our entire map view!"
- **#35:** "Even though the map is seeded and the same for that seed every time, we must improve our generation and make sure every path sees an elite, a shop, a rest etc more evenly spread. BUT NOT FORCED, people must be able to take paths in their own way and try to avoid, though not always able to avoid. Basically its already pretty good now but not very balanced."
- **#36:** "Also, on desktop, floors can be 12 length so change it!"

---

## Sub-Steps

### 1. Disable Full Map View & Map Animation
- **What:** Remove the full map overview that shows all nodes at once.
- **What:** Remove the map reveal animation at floor start.
- **What:** The map screen now shows only the current decision point.
- **Acceptance:** No way to see the full map. No map animation at floor start.

### 2. Progressive Path View — Current Choices
- **What:** The map screen shows ONLY the next set of choices available to the player.
- **Layout:**
  - Center of screen: the last selected node (or starting node)
  - Below/ahead: 2-3 branching path options, each showing the room type icon (combat, shop, rest, elite, mystery, treasure, boss)
  - Paths drawn as dashed arrows: `- - - - ->` in off-white (#F5F0E6) with black borders
  - Paths spring FROM the last selected node TO each option
- **Interaction:** Click a node to select it. Once selected, that node becomes the new "last selected" and the next choices appear.
- **Acceptance:** Only next choices visible. Paths are dashed arrows in off-white. Selection advances the view.

### 3. Scrollable Path History
- **What:** As the player progresses, all past nodes remain visible above the current choice.
- **Layout:**
  - Vertical timeline, centered horizontally
  - Each past row shows: the selected node (highlighted) + unselected alternatives (dimmed/grayed)
  - Dashed path lines connect selected nodes vertically
  - Player can scroll up to see their full path history
- **Visual distinction:**
  - Selected (past): Full color, solid border
  - Unselected (past): 30% opacity, dashed border
  - Current choices: Full color, glowing border
- **Acceptance:** Scroll up reveals entire decision history. Clear which path was taken vs. alternatives.

### 4. Path Arrow Styling
- **What:** Replace the current blue line with dashed arrow paths.
- **Style:** `- - - - ->` pattern using:
  - Color: off-white (#F5F0E6) for the dashes
  - Border: 1-2px black outline around each dash segment
  - Arrow head at the end pointing to the destination node
- **Implementation:** SVG or Canvas path with `stroke-dasharray` and arrowhead marker.
- **Acceptance:** Paths are clearly visible dashed arrows, not solid lines.

### 5. Map Generation Rebalancing
- **What:** Improve the procedural map generation so that every possible path through the floor has a more balanced distribution of room types.
- **Goals:**
  - Every path should encounter at least 1 elite (cannot be avoided entirely, though specific ones can)
  - Every path should pass within reach of at least 1 shop and 1 rest site
  - No path should have 4+ consecutive combat rooms without a non-combat option
  - Room type distribution should be more even across branches
- **Constraint:** NOT forced — players can still make suboptimal choices. The generation just ensures that balanced options EXIST on every path.
- **Seed stability:** Same seed must produce same map. Rebalancing adjusts placement rules, not randomness.
- **Acceptance:** Run 1000 map generations, verify distribution statistics. No path is starved of key room types.

### 6. Desktop Floor Length — 12 Nodes
- **What:** On desktop (non-mobile), change floor length from current value to 12 nodes.
- **Detection:** Use viewport width or platform detection (same mechanism used elsewhere).
- **Acceptance:** Desktop floors have 12 nodes. Mobile retains current length.

---

## Files Affected

- `src/ui/screens/MapScreen.svelte` — complete redesign
- `src/ui/map/MapNode.svelte` — node rendering
- `src/ui/map/MapPath.svelte` (NEW or reworked) — dashed arrow paths
- `src/ui/map/PathHistory.svelte` (NEW) — scrollable past decisions
- `src/services/mapGenerator.ts` — generation rebalancing, floor length
- `src/data/balance.ts` — floor length constants (desktop vs mobile)
- `src/services/runState.ts` — path history tracking

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] No full map view or map animation
- [ ] Only next choices visible at each step
- [ ] Dashed arrow paths in off-white with black borders
- [ ] Scrollable path history shows selected + unselected past nodes
- [ ] Map generation: run 100 seeds, verify distribution balance
- [ ] Desktop floors = 12 nodes
- [ ] Mobile floors = current length (unchanged)
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Run Structure, Map system, Floor length
