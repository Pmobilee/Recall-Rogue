# AR-211: UX Polish — Hover States, Atmospheric Backgrounds, Typography Hierarchy

**Priority:** P2
**Estimated complexity:** Medium
**Source:** AR-LANDSCAPE-UX-AUDIT.md sections C3, C4, C5

---

## Overview

Three cross-cutting improvements that transform the desktop experience from "stretched mobile app" to "intentional desktop game UI":
1. Hover states on all interactive elements
2. Atmospheric background treatment on all screens
3. RPG typography hierarchy with Cinzel headings

## Sub-steps

### 1. Global hover states (C5)

Add hover feedback to ALL interactive elements across all screens. Most hub/settings screens already got basic hovers in AR-208/209/210. This step adds them everywhere else.

**Global CSS file approach:** Create `src/ui/styles/desktop-polish.css` with landscape-only hover rules:

```css
/* Global hover states — landscape desktop only */
@media (min-width: 1280px) {
  button:not(:disabled):hover {
    filter: brightness(1.15);
    transition: filter 120ms ease;
  }

  /* Card-style containers */
  .stat:hover, .domain-card:hover, .relic-card:hover,
  .row:hover, .run-entry:hover, .card:hover {
    border-color: rgba(255, 215, 0, 0.3);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.1);
    transition: all 150ms ease;
  }
}
```

Import this CSS in CardApp.svelte.

**Acceptance criteria:**
- [x] Every clickable element shows visual feedback on hover
- [x] Transitions are smooth (120-150ms)
- [x] No hover effects on mobile/touch (media query guarded)

### 2. Atmospheric background treatment (C3)

Add subtle dungeon atmosphere to all non-hub screens. Currently they have plain dark backgrounds.

**Implementation:** Create a shared CSS class `.screen-atmosphere` that adds:
- Base: very dark background (`#0d0b0f`)
- Subtle vignette via radial gradient overlay
- Per-screen accent color via CSS variable `--screen-accent`

```css
.screen-atmosphere {
  background:
    radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%),
    linear-gradient(180deg, var(--screen-accent, rgba(30,50,80,0.15)) 0%, transparent 30%),
    #0d0b0f;
}
```

Apply accent colors per screen:
- Settings: `--screen-accent: rgba(100,100,120,0.12)` (neutral grey)
- Profile: `--screen-accent: rgba(180,140,60,0.12)` (warm amber)
- Library: `--screen-accent: rgba(60,80,160,0.12)` (cool blue)
- Journal: `--screen-accent: rgba(80,60,40,0.12)` (parchment brown)
- Leaderboards: `--screen-accent: rgba(180,160,40,0.12)` (gold)
- Social: `--screen-accent: rgba(60,120,80,0.12)` (guild green)

**Acceptance criteria:**
- [x] All non-hub screens have subtle atmospheric treatment
- [x] Each screen has a distinct accent color
- [x] The effect is very subtle — not distracting

### 3. RPG typography hierarchy (C4)

Apply Cinzel font to screen headings for RPG feel. The font is already loaded (used in level badge).

**Changes per screen:**
- All screen `h2` titles: font-family 'Cinzel', serif; letter-spacing 0.05em
- Section `h3` headings: font-family 'Cinzel', serif; letter-spacing 0.03em
- Screen subtitles/helpers: italic, slightly amber-tinted

These should be in the global `desktop-polish.css` file.

**Acceptance criteria:**
- [x] All screen headings use Cinzel font
- [x] Letter spacing gives a refined RPG feel
- [x] Body text remains system sans-serif for readability

---

## Verification Gate

- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] Visual verification at 1920x1080
- [x] Hover states visible on all interactive elements
- [x] Background atmosphere visible on all non-hub screens
- [x] Typography hierarchy looks professional and RPG-appropriate
- [x] No regressions on mobile/portrait layout
