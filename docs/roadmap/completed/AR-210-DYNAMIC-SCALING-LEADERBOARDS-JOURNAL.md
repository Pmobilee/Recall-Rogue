# AR-210: Dynamic Scaling — Leaderboards + Journal + Social Screens

**Priority:** P1 — Critical
**Estimated complexity:** Medium
**Rule:** ZERO hardcoded px for layout/sizing/spacing/fonts. Use `calc(Npx * var(--layout-scale, 1))` for layout, `calc(Npx * var(--text-scale, 1))` for fonts.

---

## Overview

LeaderboardsScreen has NO landscape layout at all. JournalScreen and SocialScreen have landscape layouts but with hardcoded px values. All three need dynamic scaling enforcement and UX improvements.

## Sub-steps

### 1. LeaderboardsScreen.svelte — Add landscape layout + dynamic scaling

**File:** `src/ui/components/LeaderboardsScreen.svelte`

This screen has ZERO landscape adaptation. It currently renders the portrait layout stretched across 1920px.

**Changes needed:**
1. Import `isLandscape` from layoutStore
2. Add landscape-specific layout with proper desktop overrides
3. Ensure ALL px values use scaling variables

Add landscape desktop overrides:
```css
:global([data-layout="landscape"]) .leaderboards-screen {
  margin-left: calc(100px * var(--layout-scale, 1));
  max-width: calc(1200px * var(--layout-scale, 1));
  padding: calc(32px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1));
}

:global([data-layout="landscape"]) .back-btn {
  display: none;
}

:global([data-layout="landscape"]) .header h2 {
  font-size: calc(28px * var(--text-scale, 1));
}

:global([data-layout="landscape"]) .helper {
  font-size: calc(15px * var(--text-scale, 1));
}

:global([data-layout="landscape"]) .row {
  grid-template-columns: calc(64px * var(--layout-scale, 1)) minmax(0, 1fr) auto auto auto;
  grid-template-areas: 'rank name streak gold floor';
  padding: calc(14px * var(--layout-scale, 1));
  min-height: calc(56px * var(--layout-scale, 1));
}

:global([data-layout="landscape"]) .rank {
  font-size: calc(20px * var(--text-scale, 1));
}

:global([data-layout="landscape"]) .name {
  font-size: calc(16px * var(--text-scale, 1));
}

:global([data-layout="landscape"]) .metric {
  font-size: calc(14px * var(--text-scale, 1));
}

:global([data-layout="landscape"]) .row:hover {
  background: rgba(30, 50, 80, 0.5);
  border-color: rgba(255, 215, 0, 0.3);
  transition: all 150ms ease;
}
```

Also fix existing hardcoded base values:
```
.back-btn min-height: 44px → calc(44px * var(--layout-scale, 1))
```

**Acceptance criteria:**
- [ ] Leaderboards has a proper landscape layout
- [ ] Entries display in a single-row format (not stacked 3-row) on landscape
- [ ] sidebar offset and max-width applied
- [ ] Back button hidden on landscape (nav sidebar handles navigation)
- [ ] Hover states on leaderboard rows
- [ ] All values use scaling variables

### 2. JournalScreen.svelte — Convert hardcoded values

**File:** `src/ui/components/JournalScreen.svelte`

Find all `:global([data-layout="landscape"])` rules and any hardcoded px in landscape sections. Convert to use `calc(Npx * var(--layout-scale, 1))` for layout and `calc(Npx * var(--text-scale, 1))` for fonts.

Search for patterns: `font-size: \d+px`, `padding: \d+px`, `gap: \d+px`, `margin: \d+px`, `width: \d+px`, `height: \d+px`, `min-height: \d+px`, `max-width: \d+px`

Replace each with the scaled equivalent. Do NOT change values that are already wrapped in `calc(... * var(--layout-scale, 1))` or `calc(... * var(--text-scale, 1))`.

Add hover states where missing:
```css
:global([data-layout="landscape"]) .run-entry:hover {
  background: rgba(30, 50, 80, 0.4);
  border-color: rgba(255, 215, 0, 0.25);
  transition: all 150ms ease;
}
```

**Acceptance criteria:**
- [ ] No hardcoded px in landscape overrides of JournalScreen.svelte
- [ ] Journal scales properly at all resolutions
- [ ] Hover states present on interactive elements

### 3. SocialScreen.svelte — Convert hardcoded values

**File:** `src/ui/components/SocialScreen.svelte`

Same pattern as Journal: find all hardcoded px values in landscape overrides and convert to scaling variables.

**Acceptance criteria:**
- [ ] No hardcoded px in landscape overrides of SocialScreen.svelte
- [ ] Social screen scales properly at all resolutions

### 4. RelicCollectionScreen.svelte — Check and fix

**File:** `src/ui/components/RelicCollectionScreen.svelte`

Audit for hardcoded px values and convert as needed.

**Acceptance criteria:**
- [ ] No hardcoded px in landscape overrides

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual inspection at 1920x1080 — all three screens properly laid out
- [ ] Visual inspection at 1280x720 — all three screens readable
- [ ] Leaderboards shows single-row entries on desktop
- [ ] Hover states work on all interactive elements
- [ ] Update `data/inspection-registry.json` lastChangedDate for leaderboards, journal, social screens
