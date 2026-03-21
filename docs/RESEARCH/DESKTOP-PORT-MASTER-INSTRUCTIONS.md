# Recall Rogue — Desktop Port & Responsive Overhaul: Master Instruction Document

---

> **PURPOSE OF THIS DOCUMENT**
>
> This document is a **master instruction set for AI coding agents (Claude Code)**. It is NOT an implementation document itself. Agents reading this document must:
>
> 1. **Inspect the repository** thoroughly before writing any code
> 2. **Create individual Action Reports (ARs)** for each section of work
> 3. Each AR must contain **complete, specific implementation directives** — file paths, component names, function signatures, data structures, and step-by-step instructions that another agent can execute without ambiguity
> 4. ARs that involve **new features** (multiplayer, Anki import, Workshop, leaderboards) must ALSO update `GAME_DESIGN.md` with a new section documenting the feature as a future/planned implementation
> 5. ARs that involve **rewriting existing systems** (layout, input, combat UI) must reference the exact current implementation, what changes, and what stays
>
> **AR Format:**
> ```
> # AR-[NUMBER]: [Title]
> ## Context
> What exists now, why it needs to change
> ## Directive
> Exactly what to build/change, file by file
> ## Acceptance Criteria
> How to verify this AR is complete
> ## Dependencies
> Which other ARs must be completed first
> ## GDD Updates
> What to add/change in GAME_DESIGN.md (if applicable)
> ```
>
> **Agents must create ARs in dependency order.** Foundation ARs (layout system, input system) come first. Feature ARs (multiplayer, Anki) come last. Each AR should be independently implementable once its dependencies are met.

---

## TABLE OF CONTENTS

1. [Current State Summary](#1-current-state-summary)
2. [Responsive Layout System (Foundation)](#2-responsive-layout-system)
3. [Combat Layout — Option D (Landscape)](#3-combat-layout-option-d)
4. [Input System Overhaul](#4-input-system-overhaul)
5. [Chain Type System (6 Types)](#5-chain-type-system)
6. [Hub / Camp Screen Adaptation](#6-hub--camp-screen)
7. [Map & Navigation Screens](#7-map--navigation-screens)
8. [Shop, Reward, & Modal Screens](#8-shop-reward--modal-screens)
9. [Quiz Panel Adaptation](#9-quiz-panel-adaptation)
10. [Steam Platform Integration](#10-steam-platform-integration)
11. [Desktop Wrapper (Tauri)](#11-desktop-wrapper)
12. [Multiplayer — Seeded Competitive](#12-multiplayer--seeded-competitive)
13. [Leaderboard System](#13-leaderboard-system)
14. [Anki Deck Import](#14-anki-deck-import)
15. [Steam Workshop / Community Packs](#15-steam-workshop--community-packs)
16. [Monetization Architecture](#16-monetization-architecture)
17. [Cross-Platform Save Sync](#17-cross-platform-save-sync)
18. [Accessibility & Colorblind Support](#18-accessibility--colorblind-support)
19. [Asset Requirements](#19-asset-requirements)
20. [Testing & QA Strategy](#20-testing--qa-strategy)
21. [AR Dependency Graph](#21-ar-dependency-graph)

---

## 1. Current State Summary

Agents MUST inspect the repository to verify these assumptions. This summary is based on analysis at time of writing and may have drifted.

### Architecture

- **Framework:** Svelte 5 + Phaser 3 + TypeScript
- **Mobile wrapper:** Capacitor
- **Components:** ~166 Svelte components, all assuming portrait layout
- **Phaser scenes:** 4 scenes (Boot, Combat, Hub, Transitions)
- **Services:** ~126 pure-logic services — zero layout assumptions (GOOD — these are fully portable)
- **Assets:** ~1,532 visual assets, all portrait-oriented backgrounds

### Hardcoded Portrait Assumptions (Must Change)

- **Base width:** 390px, hardcoded in `layout.ts`
- **Aspect ratio:** 9:16 portrait, no responsive detection
- **Scaling:** Everything uses `calc(Xpx * var(--layout-scale, 1))` computed from 390px base
- **Phaser canvas:** 390x844px with `Phaser.Scale.FIT` + `CENTER_BOTH`
- **Combat split:** Top 58% = enemy, bottom 42% = card hand overlay
- **Backgrounds:** All 720x1280px portrait
- **Touch targets:** 48px minimum, designed for finger not cursor
- **Hub screen:** Percentage-based sprite hitboxes over portrait campsite image
- **No media queries anywhere** — single-layout scaling only

### What's Already Portable (No Changes Needed)

- All 126 service files (game logic, FSRS scheduler, chain system, combat resolver, deck manager, enemy AI)
- Enemy definitions, balance constants, card types, relic definitions
- Data models and TypeScript interfaces
- Audio system (sound effects, music)

---

## 2. Responsive Layout System

> **This is the foundation AR. Everything else depends on it.**

### Goal

One codebase, two layout modes. The app detects viewport aspect ratio at runtime and switches between portrait and landscape layouts. Resizing the browser window or rotating a tablet triggers a live layout switch. No branches, no separate builds.

### Layout Mode Store

Create a reactive Svelte store that is the single source of truth for layout mode:

```typescript
// src/stores/layoutStore.ts

type LayoutMode = 'portrait' | 'landscape';

// Reactive store
export const layoutMode = writable<LayoutMode>(detectLayoutMode());

function detectLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'portrait';
  return (window.innerWidth / window.innerHeight) >= 1.0 ? 'landscape' : 'portrait';
}

// Listen for resize/orientation changes
window.addEventListener('resize', () => layoutMode.set(detectLayoutMode()));
window.addEventListener('orientationchange', () => {
  // Delay to let browser settle new dimensions
  setTimeout(() => layoutMode.set(detectLayoutMode()), 100);
});

// Derived values
export const isLandscape = derived(layoutMode, $m => $m === 'landscape');
export const isPortrait = derived(layoutMode, $m => $m === 'portrait');
```

### CSS Scale Variables

Replace the single `--layout-scale` with a mode-aware system:

```typescript
// Layout design canvases
const PORTRAIT_CANVAS = { width: 390, height: 844 };
const LANDSCAPE_CANVAS = { width: 1280, height: 720 };

function updateScaleVariables() {
  const mode = get(layoutMode);
  const canvas = mode === 'portrait' ? PORTRAIT_CANVAS : LANDSCAPE_CANVAS;
  const scaleX = window.innerWidth / canvas.width;
  const scaleY = window.innerHeight / canvas.height;
  const scale = Math.min(scaleX, scaleY); // Fit within viewport

  document.documentElement.style.setProperty('--layout-scale', String(scale));
  document.documentElement.style.setProperty('--layout-scale-x', String(scaleX));
  document.documentElement.style.setProperty('--layout-scale-y', String(scaleY));
  document.documentElement.style.setProperty('--layout-mode', mode);
}
```

### Component Pattern

Every component that has layout-dependent rendering must follow this pattern:

```svelte
<script>
  import { layoutMode } from '$stores/layoutStore';
</script>

{#if $layoutMode === 'landscape'}
  <div class="component-landscape">
    <!-- landscape layout -->
  </div>
{:else}
  <div class="component-portrait">
    <!-- portrait layout (current implementation, preserved) -->
  </div>
{/if}
```

**Critical rule:** The portrait path MUST remain identical to the current implementation. Do not "improve" portrait layout during this port. Portrait is the shipped product. Landscape is the new work.

### Dev Mode Toggle

Add a keyboard shortcut for development that force-toggles layout mode without resizing:

```typescript
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      layoutMode.update(m => m === 'portrait' ? 'landscape' : 'portrait');
    }
  });
}
```

### Phaser Canvas Reconfiguration

The Phaser game instance must resize when layout mode changes:

```typescript
layoutMode.subscribe(mode => {
  const config = mode === 'portrait'
    ? { width: 390, height: 844 }
    : { width: 1280, height: 720 };
  game.scale.resize(config.width, config.height);
  // Notify active scene to reposition all sprites
  game.scene.getScenes(true).forEach(scene => {
    if (scene.handleLayoutChange) scene.handleLayoutChange(mode);
  });
});
```

Every Phaser scene must implement `handleLayoutChange(mode: LayoutMode)` that repositions sprites, backgrounds, and UI elements.

### AR Directive for Agents

The agent for this AR must:
1. Inspect `layout.ts` and every file that references `--layout-scale`
2. Create `layoutStore.ts` with the reactive store, scale computation, and dev toggle
3. Refactor `layout.ts` to use the new mode-aware scale system
4. Add `handleLayoutChange` interface to Phaser scene base class
5. Verify portrait mode is pixel-identical to current implementation after refactor
6. Document every file that was changed

---

## 3. Combat Layout — Option D

### Portrait Mode (Unchanged)

```
+----------------------+
|                      |
|      ENEMY (58%)     |
|    HP / Intent /     |
|    Status Effects    |
|                      |
+----------------------+
|                      |
|    CARD HAND (42%)   |
|   [C1][C2][C3][C4][C5]|
|     [AP] [Chain]     |
|                      |
+----------------------+
```

Identical to current. No changes.

### Landscape Mode (New — Option D)

```
+----------------------------------------------------+
| [Relics] [Chain Counter] [Combo]  |   ENEMY        |
|                                   |   Sprite       |
|                                   |   HP Bar       |
|        CENTER STAGE               |   Intent       |
|    (Quiz panel appears here       |   Status FX    |
|     when Charge is committed)     |   Damage nums  |
|                                   |                |
|                                   |                |
+-----------------------------------+----------------+
|  [Card1]  [Card2]  [Card3]  [Card4]  [Card5]      |
|              [AP: 3/3]  [Surge indicator]          |
|         [Quick Play]  [CHARGE +1 AP]               |
+----------------------------------------------------+
```

### Layout Specifications

**Enemy panel (right side):**
- Width: ~30% of viewport
- Full height minus card hand area
- Contains: enemy sprite (centered), HP bar, intent icon + damage number, status effect icons, enemy name
- On hover (desktop): shows expanded tooltip with next 2-3 intents, all status effects with durations, damage breakdown

**Center stage (left side, above cards):**
- Width: ~70% of viewport
- Default: shows ambient combat background, particle effects, chain visualization lines
- When quiz triggers: quiz panel animates in from bottom-center, takes ~60% of center stage area
- Persistent UI in corners: relics (top-left), chain counter (top-center), combo counter (top-right)

**Card hand (bottom strip):**
- Full viewport width
- Height: ~25-30% of viewport
- Cards spread horizontally in a fan/arc
- Each card shows: mechanic name, AP cost (colored by chain type), chain glow (top-left), difficulty stars
- Selected card rises vertically with info overlay
- Quick Play / Charge buttons appear below selected card

**Quiz panel (center stage overlay):**
- Appears when Charge is committed
- Centered in the center stage area
- Enemy panel remains fully visible on the right (improvement over portrait where quiz covers enemy)
- Timer bar at top of quiz panel
- Multiple choice: 2x2 grid or vertical list
- Typed input (vocab): text field with large font, answer preview

### Transitions Between States

- **No card selected:** Center stage shows background + ambient VFX. Enemy panel at full size.
- **Card selected (tapped/clicked):** Card rises. Quick/Charge buttons appear. Center stage unchanged.
- **Charge committed:** Quiz panel slides into center stage (200ms ease-out). Enemy panel stays. Card hand dims slightly.
- **Quiz answered:** Result animation plays in center stage (correct = green flash + particles, wrong = red pulse). Quiz panel slides out. Card resolves.

### Phaser Scene Changes

The combat Phaser scene must:
1. Detect layout mode on init and on `handleLayoutChange`
2. In landscape: position enemy sprite in the right 30% of canvas
3. In landscape: allocate center-left 70% for background, VFX, chain lines
4. Particle systems, chain lightning, damage numbers — all reposition based on layout
5. Background image: use landscape combat background (1920x1080) in landscape mode, portrait (720x1280) in portrait

### AR Directive for Agents

The agent must:
1. Inspect the current combat scene (Phaser + Svelte overlay)
2. Map every element's current position in portrait
3. Create landscape position configs for every element
4. Implement the center-stage quiz transition for landscape
5. Ensure enemy panel is always visible (even during quiz) in landscape
6. Test card selection, Quick Play, Charge, quiz flow, chain visualization in both modes
7. The portrait combat flow must remain pixel-identical to current

---

## 4. Input System Overhaul

### Current State

Touch-only. Pointer events for card drag. Capacitor haptics. 48px touch targets. No keyboard support.

### New Input Architecture

Create an input abstraction layer that normalizes touch, mouse, and keyboard into game actions:

```typescript
// src/services/inputService.ts

type GameAction =
  | { type: 'SELECT_CARD'; index: number }      // 0-4
  | { type: 'QUICK_PLAY' }
  | { type: 'CHARGE' }
  | { type: 'DESELECT' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'QUIZ_ANSWER'; index: number }       // 0-3 for multiple choice
  | { type: 'QUIZ_TYPED'; value: string }         // for typed vocab input
  | { type: 'QUIZ_TRUE_FALSE'; value: boolean }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_DECK_VIEW' }
  | { type: 'SKIP_ANIMATION' };
```

### Keyboard Mapping (Landscape Mode)

| Key | Action | Context |
|-----|--------|---------|
| 1-5 | Select card 1-5 | Card hand visible |
| Q | Quick Play selected card | Card selected |
| E | Charge selected card | Card selected |
| Escape | Deselect / Back / Pause | Any |
| Space | Confirm / Skip animation | Any |
| 1-4 | Select answer 1-4 | Quiz multiple choice |
| T / F | True / False | Quiz true/false |
| Enter | Submit typed answer | Quiz typed input |
| Tab | Toggle deck view | Combat |
| R | View relics | Combat |

Keyboard input is ONLY active in landscape mode. Portrait mode remains touch/click only (mobile users don't have keyboards).

### Mouse Input (Landscape Mode)

- **Hover over card:** Card subtly enlarges (1.05x scale) with info preview (mechanic, AP cost, chain type, fact preview). NOT the same as selecting — no buttons appear.
- **Click card:** Selects it (card rises, Quick/Charge buttons appear). Same as current tap behavior.
- **Click Quick Play button:** Plays card as Quick Play.
- **Click Charge button:** Commits to Charge, quiz appears.
- **Click quiz answer:** Selects answer.
- **Right-click card:** Shows detailed card info (fact, chain type, FSRS tier). Context menu.
- **Hover over enemy:** Shows expanded intent tooltip (next 2-3 moves, status details).
- **Drag card up (optional):** Same as mobile fling-to-Charge gesture. Works with mouse drag.

### Mouse-Only Guarantee

**Every single action in the game must be performable with mouse clicks alone.** Keyboard shortcuts are acceleration, not requirements. Every action has a clickable UI element. This is non-negotiable.

### Typed Quiz Input (Vocab + True/False Only)

For vocabulary facts (type: "vocabulary") and true/false variants, an optional typed input mode:

- **Vocab typed mode:** Text input field appears instead of multiple choice buttons. Player types answer, presses Enter. Fuzzy match against `acceptableAnswers` array. Available as a toggle in settings ("Typed Quiz Mode" — off by default).
- **True/False:** T/F keys or click True/False buttons. Both always available.
- **Knowledge facts:** Always multiple choice. No typed input. The `acceptableAnswers` arrays are too narrow for reliable fuzzy matching on freeform knowledge answers.
- **Typed mode bonus:** When typed quiz mode is enabled and player types a correct answer, apply a 1.1x "Scholar" multiplier. This stacks with all other multipliers. Rewards players who choose the harder input method.
- **Timer adjustment:** Typed mode adds +3 seconds to the quiz timer to compensate for typing speed.

### Haptics

- **Mobile (Capacitor):** Existing haptic feedback — keep unchanged
- **Desktop:** No haptics. Controller rumble if controller support is added later.

### AR Directive for Agents

The agent must:
1. Create `inputService.ts` with the GameAction type and input normalization
2. Create `keyboardInput.ts` that listens for keyboard events and dispatches GameActions (landscape only)
3. Create `mouseInput.ts` for hover, click, right-click, drag behaviors
4. Modify existing touch/pointer handlers to dispatch through the same GameAction system
5. Add typed quiz input component with fuzzy matching against `acceptableAnswers`
6. Add "Typed Quiz Mode" toggle to settings
7. Add hover-to-preview behavior for cards and enemy in landscape mode
8. Verify all actions are clickable (no keyboard-only actions)
9. Add keyboard shortcut overlay/help screen (? key to toggle)
10. **Update GAME_DESIGN.md** with new input system documentation

---

## 5. Chain Type System

> **A separate detailed document exists: `CHAIN-TYPES-IMPLEMENTATION.md`. Reference it.**

### Summary for Context

- 6 chain types: Obsidian, Crimson, Azure, Amber, Violet, Jade
- Assigned randomly and evenly across fact pool at run start via `index % 6`
- Facts are **bound to card slots** for the entire run (GDD change: no more per-draw fact shuffling)
- Visual: AP cost text color + top-left radial glow
- Matching cards pulse in sync
- Chain type visible on reward screen card picks
- Draw smoothing ensures ~98% of hands have at least one chain pair
- All existing chain relics work unchanged (trigger on chain length)

### AR Directive for Agents

The agent must follow `CHAIN-TYPES-IMPLEMENTATION.md` exactly. That document IS the AR for this system. Verify:
1. Fact-to-card binding in `buildRunPool()`
2. Chain resolution swap from `categoryL2` to `chainType`
3. Visual implementation (AP text color, glow, pulse sync)
4. Reward screen chain type badge
5. Shop card removal shows chain composition
6. Draw smoothing logic
7. Relic compatibility (Tag Magnet uses `chainType`)
8. **Update GAME_DESIGN.md** Section 3 (Knowledge Chain System) with new chain type system, replacing the `categoryL2` chain description

---

## 6. Hub / Camp Screen

### Portrait Mode

Unchanged. Current campsite background with sprite hotspots.

### Landscape Mode — Phase 1 (Ship This)

Center the portrait campsite artwork on screen. Add **thematic side panels** that extend the scene:

- Left panel: stone wall / bookshelf / camp equipment — static decorative art
- Right panel: same treatment, mirrored or complementary
- Interactive hotspots remain on the centered campsite area
- Side panels are decorative only, no interactivity

This is explicitly a "good enough for launch" solution. It looks intentional (framed camp scene) rather than lazy (black bars).

### Landscape Mode — Phase 2 (Post-Launch, Add to GDD as Future)

Commission a full widescreen campsite background (1920x1080). Redistribute interactive hotspots across the wider scene. Add new interactive elements that use the extra space (bookshelf = deck viewer, map table = run selector, notice board = daily challenge).

### AR Directive for Agents

The agent must:
1. Inspect current hub scene implementation (Phaser? Svelte? Hybrid?)
2. Implement landscape centering with side panel slots
3. Create placeholder side panel artwork (solid color + subtle texture is fine for now — art will be commissioned)
4. Ensure all hotspot interactions work identically in both modes
5. **Update GAME_DESIGN.md** with Phase 2 widescreen camp as a planned future feature

---

## 7. Map & Navigation Screens

### Portrait Mode

Unchanged. Vertical scrolling map showing floor progression.

### Landscape Mode

- **Map:** Switches to horizontal layout. Floors progress left-to-right instead of top-to-bottom. Shows more floors visible at once. Same node data, different render direction.
- **Deck viewer:** Cards in a grid (3-4 columns) instead of vertical scroll. More cards visible at once. Hover to enlarge.
- **Collection screen:** Grid layout with more columns. Filter/sort controls in a top bar instead of bottom sheet.
- **Settings:** Standard desktop settings layout — left sidebar with categories, right panel with options.

### AR Directive for Agents

The agent must:
1. Inspect each navigation screen component
2. Create landscape layout variants for: map, deck viewer, collection, settings, profile
3. Map screen specifically: change scroll direction from vertical to horizontal in landscape
4. Deck viewer: switch from vertical list to responsive grid
5. All navigation must work with both mouse clicks and keyboard (arrow keys + Enter for navigation, Escape for back)

---

## 8. Shop, Reward, & Modal Screens

### Portrait Mode

Unchanged. Full-screen modals.

### Landscape Mode

- **Card reward screen (post-encounter):** Centered modal at ~65% viewport width. 3 cards displayed horizontally with more detail visible (fact preview, chain type badge, mechanic description). Background dims but remains visible. Click or press 1/2/3 to select.
- **Shop:** Centered panel, ~70% viewport width. Cards and relics in a horizontal row. Card removal section below. Chain composition summary visible.
- **Rest site:** Centered modal with options listed vertically. Same functionality.
- **All modals:** Click outside to dismiss (where appropriate). Escape key to close/back.

### AR Directive for Agents

The agent must:
1. Inspect all modal/overlay components
2. Refactor each to support two size modes (full-screen for portrait, centered-panel for landscape)
3. Add click-outside-to-dismiss for landscape modals
4. Add Escape key handling for all modals
5. Ensure card reward screen shows chain type badge and fact preview (as specified in chain types doc)
6. Card reward screen must enforce 2+ distinct chain types across 3 options

---

## 9. Quiz Panel Adaptation

### Portrait Mode

Unchanged. Quiz panel slides in between enemy and card hand.

### Landscape Mode (Center Stage)

The quiz panel occupies the center-stage area (left 70%, vertically centered):

- **Multiple choice:** 2x2 button grid or vertical list of 4 options. Each option shows a number (1-4) for keyboard selection. Mouse hover highlights.
- **True/False:** Two large buttons side by side. T/F keyboard shortcuts shown on buttons.
- **Typed input (vocab, when enabled):** Large text input field, centered. Auto-focused when quiz appears. Placeholder text shows expected format. Enter to submit.
- **Timer bar:** Horizontal bar at top of quiz panel. Same behavior as portrait.
- **Fact statement / question:** Large, readable text above answer options.

### Quiz Panel Sizing

- Width: ~50% of viewport (fits within the 70% center stage area with padding)
- Height: auto-sized to content
- Position: centered in center stage area, vertically and horizontally
- Animation: slides up from bottom of center stage (200ms ease-out), exits same way

### AR Directive for Agents

The agent must:
1. Inspect current quiz panel component
2. Create landscape variant with the center-stage positioning
3. Add keyboard shortcut labels to answer buttons (1/2/3/4, T/F)
4. Implement typed input mode for vocab facts
5. Implement fuzzy matching for typed answers
6. Add Scholar multiplier (1.1x) for correct typed answers
7. Timer extension (+3s) for typed mode
8. Ensure enemy panel remains fully visible during quiz in landscape

---

## 10. Steam Platform Integration

### Steamworks SDK Features (Launch)

| Feature | Priority | Notes |
|---------|----------|-------|
| Steam Achievements | **Required** | Map to existing achievement system |
| Steam Cloud Save | **Required** | Sync save data, integrates with cross-platform save (Section 17) |
| Steam Rich Presence | **Nice-to-have** | Show current floor, chain focus, enemy name |
| Steam Overlay | **Required** | Comes free with Steamworks SDK, verify no Phaser conflicts |
| Steam Leaderboards | **Required** | Used by competitive mode and daily challenges (Section 13) |
| Steam Workshop | **Post-launch** | Community fact packs (Section 15), architect now |
| Steam Trading Cards | **Post-launch** | Cosmetic, low priority |
| Steam Deck Verified | **Required** | Test at 1280x800, gamepad input, on-screen keyboard |

### Achievement Mapping

The agent must inspect the current achievement/progression system and create a 1:1 mapping to Steam achievements. Every in-game achievement becomes a Steam achievement.

### AR Directive for Agents

The agent must:
1. Inspect current achievement system
2. Create Steam achievement definitions (name, description, icon requirements)
3. Create Steamworks API integration service (achievement unlock, cloud save read/write, rich presence updates, leaderboard submission)
4. Wrap all Steamworks calls behind a platform check (only call on desktop/Steam build)
5. **Update GAME_DESIGN.md** with Steam integration section listing all achievements and Steam-specific features
6. **Add to GAME_DESIGN.md** as future: Steam Trading Cards, Steam Workshop

---

## 11. Desktop Wrapper

### Tauri (Primary Choice)

Use Tauri v2 to wrap the web app for desktop distribution:
- ~10MB installer vs Electron's ~150MB
- Rust backend for Steamworks SDK integration
- Native window management, file system access
- macOS, Windows, Linux support

### Build Pipeline

Single web app build. Platform-specific wrappers:
- **Mobile:** Capacitor (existing)
- **Desktop:** Tauri
- **Web (optional):** Direct deploy for browser play

Environment flag:

```typescript
// src/lib/platform.ts
export type Platform = 'mobile' | 'desktop' | 'web';

export const platform: Platform = (() => {
  if (window.__TAURI__) return 'desktop';
  if (window.Capacitor) return 'mobile';
  return 'web';
})();
```

**Layout mode is SEPARATE from platform.** A tablet in landscape gets landscape layout. A desktop with vertical monitor gets portrait layout. Layout = viewport. Platform = API availability.

### AR Directive for Agents

The agent must:
1. Set up Tauri v2 project configuration alongside existing Capacitor config
2. Create `platform.ts` with platform detection
3. Create build scripts: `build:mobile` (Capacitor), `build:desktop` (Tauri), `build:web`
4. Configure Tauri window: resizable, minimum 1280x720, title "Terra Gacha"
5. Integrate Steamworks SDK via Tauri Rust backend (or JS bridge)
6. Verify Phaser canvas works inside Tauri WebView
7. Test on Windows and macOS minimum

---

## 12. Multiplayer — Seeded Competitive

> **This section must be added to GAME_DESIGN.md as a new major section.**

### Overview

Two players start a lobby and play the exact same run with the same seed. Both see the same encounters, same card rewards, same shop contents. The player who gets further (or finishes with a higher score) wins.

### Mode 1: Race Mode (Launch Feature)

- Both players share a **seed** that determines: encounter order, enemy types, card rewards offered, shop inventory, relic drops, fact pool
- Each player plays independently at their own pace
- After both finish (or one dies + the other finishes/dies), compare results
- **Scoring:** Floors cleared x total damage dealt x chain multipliers earned x accuracy percentage
- **Lobby system:** Player creates lobby -> gets a code -> shares with friend -> friend joins -> both press ready -> run starts

### Mode 2: Same Cards (Launch Feature Variant)

Same as Race Mode, but additionally:
- Both players get the **exact same card slots** with the **exact same facts bound** and the **exact same chain type assignments**
- Both players get the **same hand draws** each encounter (same shuffle seed)
- This is the "pure skill" mode — identical hands, who plays better?
- FSRS scores may differ between players (one might know a fact the other doesn't) — this is intentional and creates asymmetric knowledge advantages

### Mode 3: Co-op vs Enemy (Future — Add to GDD Only)

- Two players fight the same enemy together
- Turn-based: Player A plays their hand -> Player B plays their hand -> Enemy attacks both
- Shared or individual HP (design TBD)
- Chain building can potentially cross between players
- **This is a post-launch feature. Add to GAME_DESIGN.md as planned future content. Do not implement now.**

### Technical Architecture

**Seed system:**
```typescript
interface RunSeed {
  masterSeed: number;         // Generates all sub-seeds
  encounterSeed: number;      // Enemy sequence, types
  rewardSeed: number;         // Card rewards, relic drops
  shopSeed: number;           // Shop inventory
  factPoolSeed: number;       // Fact selection and chain type assignment
  shuffleSeed: number;        // Draw order (Mode 2 only)
}
```

ALL random generation must be refactored to use a **seeded PRNG** (e.g., `mulberry32` or `xoshiro128`) instead of `Math.random()`. This is a prerequisite for multiplayer AND daily challenges AND leaderboards.

**Lobby system:**
- WebSocket server (owner builds server infrastructure)
- Client sends: lobby create/join, ready state, turn results (floor cleared, score, died)
- Server sends: lobby state, opponent progress updates, final comparison
- No game state sync needed — each client runs its own game with the same seed

**Opponent progress display:**
- Small non-intrusive panel showing opponent's current floor, HP, and score
- Updates in real-time via WebSocket
- Position: top-right corner in landscape, top of screen in portrait
- Collapsible

### Balanced Pool Option (Same Cards Mode)

When "Same Cards" is selected, the pool building can optionally enforce balanced FSRS tiers:
- Pool draws facts evenly across FSRS tiers (Tier 1, 2a, 2b, 3)
- Ensures neither player has a massive knowledge advantage from their personal mastery data
- Toggle: "Balanced Pool" on/off in lobby settings
- When off, each player uses their own FSRS scores — creating asymmetric knowledge advantages

### AR Directive for Agents

The agent must:
1. Refactor ALL random generation to use seeded PRNG — every `Math.random()` in game logic replaced with seeded generator
2. Create `RunSeed` interface and seed derivation from master seed
3. Create `seedService.ts` providing deterministic random values per game system
4. Create lobby UI components (create, join, waiting room, opponent progress panel)
5. Define WebSocket message protocol (lobby CRUD, ready, progress, results)
6. Create `multiplayerService.ts` client for WebSocket connection and state
7. Create multiplayer mode selection in main menu (Race Mode, Same Cards, Solo)
8. Create post-run comparison screen (score breakdown)
9. Create "Balanced Pool" toggle for Same Cards mode
10. **Update GAME_DESIGN.md** with full multiplayer section: Race Mode, Same Cards, scoring, and Co-op as planned future

---

## 13. Leaderboard System

> **This section must be added to GAME_DESIGN.md.**

### Daily Challenge

- One shared seed per day, globally
- All players play the same run (same encounters, rewards, shops)
- Score submitted at run end
- Global leaderboard + friends leaderboard
- Resets daily at 00:00 UTC
- One attempt per day (no re-runs)

### All-Time Leaderboards

- Highest single-run score (any seed)
- Longest chain achieved
- Fastest run completion
- Highest accuracy percentage (minimum 20 Charge plays)
- Per-domain leaderboards (best score using only History facts, only Space facts, etc.)

### Scoring Formula

```
Run Score = (Floors Cleared x 100)
          + (Total Damage Dealt x 1)
          + (Total Chain Multiplier Earned x 50)
          + (Correct Answers x 10)
          - (Wrong Answers x 5)
          + (Perfect Encounters x 200)  // no damage taken
          + (Speed Bonus)               // faster answers = more points
```

### AR Directive for Agents

The agent must:
1. Create scoring calculation service (`scoringService.ts`)
2. Create daily challenge seed generation (hash of current UTC date)
3. Create leaderboard UI: daily board, all-time boards, friends board
4. Create submission flow (end of run -> calculate -> submit)
5. Integrate with Steamworks Leaderboard API (desktop) and REST API (mobile/web)
6. Create daily challenge entry point in main menu
7. One attempt per day enforcement (local + server-verified)
8. **Update GAME_DESIGN.md** with leaderboard system, scoring formula, daily challenge rules

---

## 14. Anki Deck Import

> **This is a major selling point. Add to GAME_DESIGN.md.**

### Overview

Players import existing Anki decks (.apkg files) into Terra Gacha. Anki cards become facts in the game's fact pool. Anki review history converts to FSRS mastery tiers. Study real flashcards while playing a roguelike.

### .apkg File Format

Anki .apkg files are ZIP archives containing:
- `collection.anki2` or `collection.anki21` — SQLite database with cards, notes, review history
- Media files (numbered files in ZIP root)

Key tables:
- `notes` — content (fields separated by `\x1f`)
- `cards` — card instances linked to notes
- `revlog` — review history (timestamps, intervals, ease factors)

### Import Conversion

Each Anki note becomes a Terra Gacha fact:

```typescript
interface ImportedFact {
  id: string;                    // 'anki-{noteId}'
  type: 'vocabulary';            // All Anki imports treated as vocab
  domain: 'Community';
  subdomain: string;             // Anki deck name
  categoryL1: 'community_anki';
  categoryL2: string;            // 'anki_{deckName}'
  statement: string;             // Back of card
  quizQuestion: string;          // Front of card
  correctAnswer: string;         // Back of card
  distractors: string[];         // Generated from other cards in same deck
  acceptableAnswers: string[];   // [back, normalized variants]
  difficulty: number;            // From Anki ease factor
  tags: string[];                // Anki tags
  ankiEaseFactor: number;        // Preserved
  ankiInterval: number;          // Preserved
  fsrsTier: number;              // Converted from review history
}
```

### FSRS Tier Conversion

| Anki Interval | FSRS Tier | Rationale |
|---------------|-----------|-----------|
| 0-1 days (new/learning) | Tier 1 (Learning) | New or barely learned |
| 2-7 days | Tier 1 (Learning) | Short interval |
| 8-30 days | Tier 2a (Familiar) | Medium retention |
| 31-90 days | Tier 2b (Confident) | Good retention |
| 91+ days | Tier 3 (Mastered) | Long-term memory |

### Distractor Generation

Generate distractors from other cards in the same Anki deck (random answers from other notes). Minimum 3 distractors. If deck has <4 cards, pad with generic distractors.

### Edge Cases

- **Multi-field notes:** Field 1 = question, field 2 = answer, ignore rest (offer field mapping UI in future)
- **Image-only cards:** Skip. Show count of skipped cards after import.
- **Cloze deletions:** `{{c1::answer}}` becomes fill-in-the-blank. Cloze text = answer.
- **HTML in cards:** Strip tags, preserve text content
- **Re-import:** Update existing facts by Anki note ID, merge review history, no duplicates

### AR Directive for Agents

The agent must:
1. Create .apkg parser (ZIP extraction + SQLite reader — use sql.js for browser SQLite)
2. Create note-to-fact conversion pipeline
3. Create Anki review history -> FSRS tier converter
4. Create distractor generation from same-deck cards
5. Create cloze deletion parser
6. Create import UI (file picker, progress, import summary)
7. Create "Anki: {DeckName}" domain option at run start
8. Handle re-import / duplicate detection
9. Store imported decks locally (not in cloud fact database)
10. **Update GAME_DESIGN.md** with Anki import feature, conversion rules, limitations
11. Test with real .apkg exports

---

## 15. Steam Workshop / Community Packs

> **Add to GAME_DESIGN.md as planned future. Architect now, build post-launch.**

### Community Pack Format

```json
{
  "packId": "community_japanese_advanced",
  "packName": "Advanced Japanese Vocabulary",
  "author": "username",
  "version": "1.0.0",
  "domain": "Community",
  "subdomain": "japanese_advanced",
  "factCount": 500,
  "facts": [
    {
      "id": "cp-ja-adv-001",
      "type": "vocabulary",
      "quizQuestion": "What does ... mean?",
      "correctAnswer": "...",
      "acceptableAnswers": ["..."],
      "distractors": ["..."],
      "difficulty": 4,
      "tags": ["jlpt_n2"]
    }
  ]
}
```

### Rules

- Community packs use `domain: "Community"`, `categoryL1: "community_{packId}"` — NEVER overlap with official domain IDs
- Limited quiz variants (forward/reverse only)
- Clearly labeled "Community Content" in-game
- FSRS scheduling works identically
- Chain types assigned randomly at run start
- Cannot modify mechanics, relics, enemies, or balance — facts only

### Architecture Now (Pre-Launch)

Fact loading must support external JSON files in a `community_packs/` directory:
- On launch, scan directory for .json files
- Validate against pack schema
- Valid packs appear as selectable domains
- Invalid packs skipped with error log

### AR Directive for Agents

The agent must:
1. Define pack JSON schema
2. Create pack validator
3. Refactor fact loading to scan external directory
4. Create `community_packs/` directory convention
5. **Update GAME_DESIGN.md** with community pack spec, Workshop roadmap, domain ID isolation rule

---

## 16. Monetization Architecture

> **Add to GAME_DESIGN.md.**

### Mobile (F2P + Subscription)

| Tier | Price | Content |
|------|-------|---------|
| Free | $0 | 2-3 knowledge domains, full roguelike, solo mode |
| Scholar Pass | $4.99/mo | All domains, languages, study decks, cosmetics, multiplayer, daily challenges |

### Steam (Premium + DLC)

| Product | Price | Content |
|---------|-------|---------|
| Base Game (Early Access) | $9.99 | All 10 knowledge domains, roguelike, multiplayer, daily challenges, leaderboards |
| Base Game (1.0) | $14.99 | Same + polish |
| Language DLC (each) | $4.99 | Japanese N5-N3, Korean A1-B1, Spanish A1-B1, etc. |
| Curated Study Packs | $2.99 | SAT Prep, Medical Terminology, etc. |
| Cosmetic DLC | $1.99-3.99 | Card backs, particles, chain themes, enemy skins |

### Entitlement System

```typescript
interface PlayerEntitlements {
  platform: 'mobile' | 'steam';
  baseDomains: string[];
  subscribedDomains: string[];
  communityPacks: string[];       // Always free
  ankiDecks: string[];            // Always free
  cosmetics: string[];
  hasMultiplayer: boolean;
  hasDailyChallenge: boolean;
}
```

- Anki imports and community packs are ALWAYS free on all platforms
- Mobile subscribers with Steam: subscription unlocks on both while active
- Steam purchases are permanent

### AR Directive for Agents

The agent must:
1. Create `entitlementService.ts`
2. Gate domain selection based on entitlements
3. Gate multiplayer/daily challenge based on entitlements
4. Create platform-specific purchase flows (Capacitor IAP, Steamworks DLC)
5. **Update GAME_DESIGN.md** with monetization model, pricing, entitlement rules

---

## 17. Cross-Platform Save Sync

> **Add to GAME_DESIGN.md.**

### Save Data Structure

```typescript
interface CloudSave {
  version: number;
  lastModified: string;
  playerId: string;
  activeRun: RunState | null;
  fsrsData: FSRSCardData[];
  unlockedRelics: string[];
  masteryCoins: number;
  achievements: Achievement[];
  statistics: PlayerStats;
  ownedCosmetics: string[];
  selectedCosmetics: CosmeticSlots;
  settings: PlayerSettings;
  ankiDeckMeta: AnkiDeckMeta[];    // Metadata only, decks stored locally
}
```

### Sync Flow

1. On launch: pull cloud save, compare timestamps with local
2. Cloud newer: prompt to load
3. Local newer: auto-push
4. Mid-run: save to cloud at end of each encounter
5. Backend: REST API (owner builds)

### AR Directive for Agents

The agent must:
1. Define `CloudSave` interface
2. Create `cloudSaveService.ts` with save/load/sync/conflict resolution
3. Create account UI (sign up, log in, link devices)
4. Integrate with Steamworks Cloud Save for Steam builds
5. Create sync status indicator
6. **Update GAME_DESIGN.md** with cloud save system

---

## 18. Accessibility & Colorblind Support

### Chain Type Icons

Each chain type gets an icon in addition to color:

| Chain Type | Icon Shape | Description |
|------------|-----------|-------------|
| Obsidian | Diamond | Faceted gem |
| Crimson | Flame | Fire wisp |
| Azure | Droplet | Water drop |
| Amber | Star | 5-point star |
| Violet | Crescent | Half-moon |
| Jade | Leaf | Simple leaf |

Icons appear in: card glow area (~12px), chain badges, chain counter display.

### UI Scale

Settings slider: 80% to 150%. Modifies `--layout-scale`. Default 100% desktop, auto on mobile.

### Text Size

Settings option: Small / Medium / Large. Affects quiz text, card text, UI labels. Does not affect layout geometry.

### AR Directive for Agents

The agent must:
1. Create SVG icons for all 6 chain types
2. Integrate into card glow, badges, chain counter
3. Add UI Scale slider to settings
4. Add Text Size option to settings
5. Test chain colors against protanopia, deuteranopia, tritanopia
6. **Update GAME_DESIGN.md** with accessibility features

---

## 19. Asset Requirements

### New Assets Needed

| Asset | Dimensions | Count | Priority |
|-------|-----------|-------|----------|
| Landscape combat backgrounds | 1920x1080 | 3 (per act) | **Required** |
| Landscape hub side panels | 565x1080 each | 1 pair | **Required** |
| Landscape boot/splash screen | 1920x1080 | 1 | **Required** |
| Chain type icons (SVG) | 24x24 | 6 | **Required** |
| Steam store assets | Various | ~10 | **Required for Steam** |

### Existing Assets (No Changes)

- Card frames (512x748) — fine at 1080p
- Enemy sprites — scale to any layout
- Relic icons — resolution-independent
- Particle/VFX — Phaser-rendered
- Audio — platform-independent

### AR Directive for Agents

The agent must:
1. Document exact specs for each needed asset
2. Create placeholder assets (solid color + label) for development
3. Define naming convention and directory structure for landscape assets
4. Asset loader must check for landscape variants, fall back to portrait

---

## 20. Testing & QA Strategy

### Layout Testing Matrix

| Viewport | Mode | Priority |
|----------|------|----------|
| 390x844 (iPhone 14) | Portrait | **Must pass** |
| 844x390 (iPhone landscape) | Landscape | **Must pass** |
| 1024x768 (iPad portrait) | Portrait | Must pass |
| 1366x1024 (iPad landscape) | Landscape | Must pass |
| 1920x1080 (Desktop) | Landscape | **Must pass** |
| 2560x1440 (Desktop 1440p) | Landscape | Should pass |
| 1280x800 (Steam Deck) | Landscape | **Must pass** |
| 3440x1440 (Ultrawide) | Landscape (letterbox) | Should pass |

### Functional Checklist

- [ ] Portrait mode pixel-identical to pre-port version
- [ ] Layout toggle works via resize and Ctrl+Shift+L
- [ ] Full combat flow in both modes
- [ ] All keyboard shortcuts work in landscape
- [ ] All actions mouse-clickable (no keyboard-only)
- [ ] Typed quiz input for vocab
- [ ] Chain type visuals in both modes
- [ ] Multiplayer lobby create/join
- [ ] Seeded runs identical for both players
- [ ] Same Cards mode identical hands
- [ ] Leaderboard submission and display
- [ ] Daily challenge one-attempt enforcement
- [ ] Anki .apkg import with real decks
- [ ] Cross-platform save sync
- [ ] Steam achievements
- [ ] Steam Cloud Save
- [ ] 60fps at 1080p

---

## 21. AR Dependency Graph

```
PHASE 1 — FOUNDATION (Do First):
  AR-01: Layout System (layoutStore, scale vars, dev toggle, Phaser resize)
  AR-10: Seeded PRNG Refactor (replace all Math.random in game logic)
  AR-14: Chain Type System (CHAIN-TYPES-IMPLEMENTATION.md)
  AR-15: Platform Abstraction (platform.ts, Tauri setup)
  AR-21: Asset Specs & Placeholders

PHASE 2 — CORE EXPERIENCE:
  AR-02: Combat Layout Option D ............... depends on AR-01
  AR-03: Input System Overhaul ................ depends on AR-01
  AR-04: Hub/Camp Adaptation .................. depends on AR-01
  AR-05: Quiz Panel Adaptation ................ depends on AR-02, AR-03
  AR-06: Chain Type Visuals (combat/reward) ... depends on AR-02, AR-14
  AR-07: Map & Navigation Screens ............. depends on AR-01
  AR-08: Shop, Reward, & Modal Screens ........ depends on AR-01, AR-14
  AR-09: Accessibility (UI Scale, Icons) ...... depends on AR-14

PHASE 3 — FEATURES:
  AR-11: Multiplayer Race Mode ................ depends on AR-10
  AR-12: Multiplayer Same Cards Mode .......... depends on AR-10, AR-11
  AR-13: Leaderboard & Daily Challenge ........ depends on AR-10
  AR-16: Steam Integration .................... depends on AR-15
  AR-17: Entitlement & Monetization ........... depends on AR-15
  AR-18: Anki Deck Import .................... standalone

PHASE 4 — POST-LAUNCH ARCHITECTURE:
  AR-19: Community Pack Architecture .......... standalone
  AR-20: Cross-Platform Save Sync ............. depends on AR-16

PHASE 5 — DOCUMENTATION:
  AR-22: GDD Master Update ................... runs LAST, collects all GDD
                                               changes from every AR
```

---

## FINAL NOTES FOR AGENTS

1. **Inspect before writing.** Every AR starts with thorough repo inspection. Verify file paths, component names, function signatures. Do not assume from this document.

2. **Portrait mode is sacred.** The existing portrait layout is the shipped product. Use conditional rendering to branch. Do not modify portrait behavior.

3. **Test both modes constantly.** After every change, verify portrait unchanged and landscape works. Ctrl+Shift+L to toggle.

4. **GDD is the source of truth.** If this document conflicts with GAME_DESIGN.md, ask for clarification. If an AR changes mechanics, update GAME_DESIGN.md in the same AR.

5. **Future features go in GDD as future sections.** Co-op multiplayer, Workshop, widescreen camp redesign, Steam Trading Cards — documented as planned, not built now.

6. **The owner builds the servers.** Backend infra (WebSocket, REST, cloud save) is the owner's responsibility. Agents build client-side integration and define API contracts.

7. **Chain type system is specified separately.** Reference `CHAIN-TYPES-IMPLEMENTATION.md`. Do not redesign.

8. **Every AR must be independently executable** once dependencies are met. Another agent should implement it without reading unrelated ARs.

9. **Seeded PRNG is critical infrastructure.** Multiplayer, leaderboards, and daily challenges ALL depend on deterministic randomness. This refactor (AR-10) must be thorough — no `Math.random()` calls left in any game logic path.

10. **Anki import is a major selling point.** Treat it with care. Test with real exported Anki decks. The FSRS conversion must feel fair — players who've studied in Anki should see their progress reflected accurately in Terra Gacha.
