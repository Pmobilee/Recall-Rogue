# AR-128 — Landscape Library & Settings Redesign

**Priority:** P1-P2
**Depends on:** AR-127 (sidebar + content container)

---

## Overview

The Library and Settings are the two most-visited non-hub screens. Both have significant layout issues at 1920x1080. This AR fixes them.

## Sub-steps

### 1. Library — Fix header layout

**Current:** "Library" heading is at x:1806 (far right). Back button at top-left. 330px gap between tabs and domain grid.

**Change:**
- Remove Back button in landscape (sidebar handles navigation)
- "Library" heading: left-aligned, 32px Cinzel
- Add subtitle: "Your collected knowledge" — 14px, dim text
- Move "Mastered Facts: N" into the header area as a stat chip
- Eliminate the 330px gap — tabs directly above domain grid with 24px spacing

**Files:** `src/ui/components/LibraryScreen.svelte` (or wherever the library component lives)

**Acceptance:** Header is left-aligned, no gap, no back button in landscape.

### 2. Library — Domain grid improvements

**Current:** 4-column grid, 454px cards, 186px tall.

**Change:**
- 4-column grid at max-width 1400px gives ~320px cards — good size
- Card content scaled up: domain name 16px, fact count 14px, meta text 13px
- Add domain accent color as left border (4px) per domain
- Card hover: border-color shifts to amber, slight brightness increase

**Domain colors:**
| Domain | Color |
|---|---|
| General | #94a3b8 |
| Science | #4a9eff |
| Space | #8b5cf6 |
| Geography | #22c55e |
| Capitals | #f59e0b |
| History | #a16207 |
| Myth | #7c3aed |
| Animals | #ea580c |
| Health | #e11d48 |
| Cuisine | #d97706 |
| Art | #9333ea |
| Language | #0d9488 |

**Acceptance:** Domain cards have colored left borders, larger text, hover states.

### 3. Settings — Layout restructure

**Current:** Internal 200px sidebar + 560px content panel = lots of wasted space.

**Change in landscape only:**
- Remove internal sidebar
- Category tabs (Audio, Accessibility, Notifications, Account) become horizontal tabs at top
- Content area: max-width 800px, centered within the screen-panel
- Each tab: pill-style button, ~160px wide
- Setting rows: 15px labels, larger toggles/sliders
- Remove Back button in landscape (sidebar handles nav)

**Files:** `src/ui/components/SettingsScreen.svelte`

**Acceptance:** Settings uses horizontal tabs in landscape, content is 800px centered, labels are readable.

## Verification Gate

- [ ] `npm run typecheck` + `npm run build` clean
- [ ] Library at 1920x1080: header aligned, no gap, domain colors, hover states
- [ ] Settings at 1920x1080: horizontal tabs, 800px content, readable labels
- [ ] Portrait mode: both screens UNCHANGED
