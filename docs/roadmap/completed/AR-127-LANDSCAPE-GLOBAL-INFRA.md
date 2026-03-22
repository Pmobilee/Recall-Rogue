# AR-127 — Landscape Global Infrastructure

**Priority:** P1 (highest impact, enables all other landscape ARs)
**Depends on:** None
**Blocks:** AR-128, AR-129

---

## Overview

Establish the three foundational systems that every landscape screen depends on:
1. Sidebar navigation visible on ALL screens (not just hub)
2. Consistent content container with sidebar offset
3. Desktop typography scale

## Sub-steps

### 1. Sidebar on all screens

**Current:** HubNavBar only renders when `$currentScreen === 'hub'` in CardApp.svelte.

**Change:** Move the `{#if $isLandscape}` HubNavBar block OUTSIDE the hub-only conditional, so it renders for ALL screens in landscape mode.

**Files:** `src/CardApp.svelte`

**Details:**
- Move `<HubNavBar>` from inside the `{#if $currentScreen === 'hub' || ...}` block to just after the phaser-container div, wrapped in `{#if $isLandscape && !showBootAnimation}`
- The `current` prop already uses `normalizeHomeScreen($currentScreen)` — verify it correctly highlights library, settings, profile, journal, leaderboards, social
- For screens not in HubNavBar's nav items (e.g. combat, rewardRoom), the sidebar should still show but with no active item
- Add `onNavigate` handling — currently navigating FROM non-hub screens needs to work. The `handleHubNavigate` function calls `transitionScreen()` which should work globally.

**Acceptance:** Navigate to Library, Settings, Profile, Journal, Leaderboards, Social — sidebar visible on ALL with correct item highlighted.

### 2. Content container with sidebar offset

**Current:** Non-hub screens use full viewport width with 16px padding. No sidebar offset.

**Change:** Add a landscape content container class that all non-hub screens use.

**Files:** `src/ui/components/HubScreen.svelte` (already has landscape layout), plus each screen component

**Details:**
- Add a global CSS class `.landscape-content` in a shared location (or each screen):
  ```css
  [data-layout="landscape"] .screen-panel {
    margin-left: 100px;  /* sidebar width */
    max-width: 1400px;
    margin-right: auto;
    padding: 32px 48px;
  }
  ```
- Each non-hub screen's outermost container gets class `screen-panel`
- The screens affected: LibraryScreen, SettingsScreen, ProfileScreen, JournalScreen, LeaderboardsScreen, SocialScreen
- Hub screen is exempt — it has its own layout

**Acceptance:** All non-hub screens have content offset from sidebar, max-width 1400px, proper padding.

### 3. Desktop typography scale

**Current:** Text sizes range 9-18px, designed for mobile.

**Change:** Add landscape overrides for key text sizes.

**Details:**
Add to each screen's `<style>` block (or a shared approach via `[data-layout="landscape"]` selectors in CardApp):

| Element | Current | Desktop |
|---|---|---|
| Screen title h2 | 20px | 32px |
| Section heading h3 | 14-16px | 20px |
| Body text | 12-13px | 15px |
| Stat values | 13px | 22px |
| Small labels | 9-11px | 13px |
| Back button | 10-12px | 14px |

Apply via `[data-layout="landscape"]` parent selector so portrait is untouched.

**Acceptance:** All text readable at arm's length on 1920x1080. No text below 13px in landscape.

### 4. Hover states for interactive elements

**Details:**
Add global hover rules in CardApp.svelte:
```css
[data-layout="landscape"] button:hover {
  filter: brightness(1.15);
  transition: filter 120ms ease;
}

[data-layout="landscape"] .domain-card:hover,
[data-layout="landscape"] .sidebar-btn:hover {
  transform: scale(1.02);
  transition: transform 120ms ease, filter 120ms ease;
}
```

**Acceptance:** All buttons brighten on hover. Card-style elements scale slightly.

### 5. Atmospheric background

**Details:**
Add a subtle dark vignette + stone-ish tint to the card-app background in landscape:
```css
[data-layout="landscape"] .card-app {
  background: radial-gradient(ellipse at center, #151020 0%, #0a0810 70%, #050408 100%);
}
```

This replaces the flat `#0D1117` with a subtle dungeon atmosphere on all screens.

**Acceptance:** Non-hub screens have a subtle gradient background instead of flat dark.

## Verification Gate

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — clean
- [ ] Navigate to all 7 screens at 1920x1080 — sidebar visible on all
- [ ] Active nav item correctly highlighted per screen
- [ ] No text below 13px on any screen
- [ ] Content offset from sidebar on all non-hub screens
- [ ] Hover states visible on buttons
- [ ] Portrait mode UNCHANGED — verify hub at 390x844
