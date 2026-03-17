# AR-77: Map & Navigation Screens — Landscape Adaptation

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §7
> **Priority:** CORE EXPERIENCE
> **Complexity:** Medium
> **Dependencies:** AR-71 (Layout System)

## Context

Navigation screens (map, deck viewer, collection, settings, profile, journal) are all designed for portrait scrolling. In landscape, they should use the extra horizontal space: horizontal map, grid deck viewer, sidebar settings, etc.

## Directive

### Step 1: Room Selection / Map Screen

**File:** `src/ui/components/RoomSelection.svelte`

Portrait: vertical layout, 3 room cards stacked or in a row.
Landscape:
- Room cards spread horizontally with more detail visible
- Room descriptions expanded (not truncated)
- Click or keyboard (1/2/3) to select
- Arrow keys navigate between room options

### Step 2: Deck Viewer / Library

**File:** `src/ui/components/KnowledgeLibrary.svelte` (and related)

Portrait: vertical scrolling list of cards.
Landscape:
- Cards in a responsive grid (4-5 columns)
- More cards visible at once
- Hover to see card detail (landscape only)
- Filter/sort controls in a top bar instead of bottom sheet

### Step 3: Settings Screen

**File:** `src/ui/components/SettingsPanel.svelte`

Portrait: vertical scrolling list of options.
Landscape:
- Left sidebar with setting categories (Audio, Graphics, Gameplay, Accessibility)
- Right panel shows options for selected category
- Standard desktop settings pattern

### Step 4: Profile Screen

**File:** `src/ui/components/ProfileScreen.svelte`

Portrait: vertical scroll.
Landscape:
- Two-column layout: stats on left, achievements/badges on right
- Radar chart larger and more readable

### Step 5: Run End / Results Screen

**File:** `src/ui/components/RunEndScreen.svelte`

Portrait: vertical scroll with stats.
Landscape:
- Two-column: left column = run stats, right column = cards earned / facts learned
- Continue button at bottom-right

### Step 6: Navigation — Keyboard Support

All navigation screens in landscape:
- Arrow keys navigate between selectable items
- Enter confirms selection
- Escape goes back
- Tab cycles through sections/tabs

### Step 7: Verification

- [ ] All portrait screens: pixel-identical to current
- [ ] Room selection: landscape layout with keyboard support
- [ ] Library: grid layout in landscape
- [ ] Settings: sidebar + panel in landscape
- [ ] Profile: two-column in landscape
- [ ] Run end: two-column in landscape
- [ ] Arrow keys + Enter navigate correctly
- [ ] Escape goes back from all screens

## Files Affected

| File | Action |
|------|--------|
| `src/ui/components/RoomSelection.svelte` | MODIFY |
| `src/ui/components/KnowledgeLibrary.svelte` | MODIFY |
| `src/ui/components/SettingsPanel.svelte` | MODIFY |
| `src/ui/components/ProfileScreen.svelte` | MODIFY |
| `src/ui/components/RunEndScreen.svelte` | MODIFY |
| `src/ui/components/JournalScreen.svelte` | MODIFY |

## GDD Updates

None required — these are layout-only changes, no gameplay impact.
