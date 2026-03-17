# AR-75: Hub / Camp Screen — Landscape Adaptation

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §6
> **Priority:** CORE EXPERIENCE
> **Complexity:** Medium
> **Dependencies:** AR-71 (Layout System)

## Context

The hub/camp screen is a full portrait campsite background image with absolute-positioned sprite hitboxes (percentage-based: `top: 11%, left: 28%, width: 44%, height: 27%`). In landscape, centering the portrait art and adding decorative side panels is the Phase 1 approach ("good enough for launch — looks intentional, not lazy").

## Current Implementation

- `src/ui/components/HubScreen.svelte` — `position: fixed; inset: 0`, background image, 11 `CampSpriteButton` components with percentage-based hitzones
- `src/ui/components/CampSpriteButton.svelte` — absolute hitbox over sprite, label positioning
- `src/ui/components/CampHudOverlay.svelte` — top HUD (streak, dust, active run)
- `src/ui/components/HubNavBar.svelte` — bottom nav (6 tabs), grid 6 columns
- Camp background: `public/assets/camp/sprites/background/camp-background.jpg`

## Directive

### Step 1: Hub Screen Landscape Branch

**File:** `src/ui/components/HubScreen.svelte`

```svelte
{#if $isLandscape}
  <div class="hub-landscape">
    <div class="hub-side-panel hub-side-left">
      <!-- Decorative stone/bookshelf art (placeholder for now) -->
    </div>
    <div class="hub-center">
      <!-- Existing campsite content, same hitboxes -->
      <!-- Constrained to portrait aspect ratio within center column -->
    </div>
    <div class="hub-side-panel hub-side-right">
      <!-- Decorative art, mirrored -->
    </div>
  </div>
{:else}
  <!-- EXISTING portrait implementation, UNCHANGED -->
{/if}
```

Landscape layout:
- Center column: maintains 9:16 aspect ratio, contains full campsite with all interactive elements
- Side panels: ~20% each, decorative only, no interactivity
- Side panels: solid dark color with subtle stone/cave texture (placeholder — art commissioned later)
- All existing sprite hitboxes work unchanged (they're percentage-based within the center column)

**Acceptance:** Campsite centered in landscape. Side panels visible. All interactive elements functional.

### Step 2: Nav Bar Adaptation

**File:** `src/ui/components/HubNavBar.svelte`

In landscape:
- Convert from bottom tab bar to **left sidebar** navigation
- Vertical stack of 6 nav buttons
- Position: `left: 0`, full height, width ~80px
- Icons + labels stacked vertically per button
- Active indicator on left edge

**Acceptance:** Nav bar is a left sidebar in landscape, bottom bar in portrait.

### Step 3: HUD Overlay Adaptation

**File:** `src/ui/components/CampHudOverlay.svelte`

In landscape:
- Reposition to top of center column (not full viewport width)
- Or: move to top-right corner of viewport with wider layout

**Acceptance:** HUD info visible and non-overlapping in landscape.

### Step 4: Side Panel Placeholder Art

Create simple CSS-only side panels for now:
- Dark gradient background (#1a1a2e → #0f0f23)
- Subtle noise/texture overlay (CSS pattern or very small tiled image)
- Faint torch glow effect (CSS radial gradient, positioned at panel inner edge)

**Acceptance:** Side panels look intentional and atmospheric, not like empty space.

### Step 5: Phase 2 Placeholder (Future)

Add a TODO comment in HubScreen.svelte landscape branch:
```
// PHASE 2 (Post-Launch): Replace side panels with full widescreen campsite
// background (1920x1080). Redistribute interactive hotspots across wider scene.
// New interactive elements: bookshelf=deck viewer, map table=run selector,
// notice board=daily challenge. See GDD §35 Future Todo.
```

### Step 6: Verification

- [ ] Portrait hub: pixel-identical to current
- [ ] Landscape hub: campsite centered, side panels visible
- [ ] All 11 camp interactive elements work in landscape
- [ ] Nav bar converts to left sidebar in landscape
- [ ] HUD overlay positioned correctly in landscape
- [ ] No visual glitches at 1920×1080 and 1280×800 (Steam Deck)

## Files Affected

| File | Action |
|------|--------|
| `src/ui/components/HubScreen.svelte` | MODIFY (landscape branch) |
| `src/ui/components/HubNavBar.svelte` | MODIFY (sidebar variant) |
| `src/ui/components/CampHudOverlay.svelte` | MODIFY (landscape position) |

## GDD Updates

Update `docs/GAME_DESIGN.md` §17 landscape subsection: Hub uses centered portrait camp with decorative side panels (Phase 1). Full widescreen campsite is Phase 2 (post-launch).
