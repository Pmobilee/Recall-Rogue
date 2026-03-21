# AR-129 — Landscape Profile, Journal, Leaderboards & Social

**Priority:** P3-P4
**Depends on:** AR-127 (sidebar + content container)

---

## Overview

Polish the remaining 4 screens for landscape presentation: Profile, Journal, Leaderboards, Social.

## Sub-steps

### 1. Profile — Layout and stat cards

**Current:** Full-width, flat stats list, emoji avatar, bare empty state.

**Change in landscape:**
- Max-width 1200px, centered in screen-panel
- Stat grid: 3-column (3x2), each stat in a card container
- Stat card: dark panel bg, large value (28px), label below (14px)
- Avatar section: larger icon area (96px), player title "Explorer", level display
- Remove Back button in landscape
- Heading: 32px
- Empty state: "Your Legend Has Not Yet Been Written" + "Complete your first run" + CTA button

**Files:** `src/ui/components/ProfileScreen.svelte`

**Acceptance:** Stats in cards, readable sizes, atmospheric empty state.

### 2. Journal — Layout and empty state

**Current:** Bare heading + search + empty text.

**Change in landscape:**
- Max-width 1100px, centered
- Heading: "Adventurer's Journal" 32px
- Hide search box when no entries exist
- Remove Back button in landscape
- Empty state: book/scroll icon, "The pages await your first expedition" (20px heading), body text, CTA button

**Files:** `src/ui/components/JournalScreen.svelte`

**Acceptance:** Atmospheric empty state, proper sizing, no wasted space.

### 3. Leaderboards — Table styling

**Current:** Flat list with emoji icons, full width.

**Change in landscape:**
- Max-width 1000px, centered
- Heading: 32px
- Remove Back button in landscape
- Table header row: Rank | Adventurer | Streak | Dust | Floor — 15px, amber text
- Row height: 56px
- Top 3: gold/silver/bronze left border (3px)
- Alternate row tinting
- Rank numbers: 20px for top 3, 16px for rest

**Files:** `src/ui/components/LeaderboardsScreen.svelte`

**Acceptance:** Table is readable, top 3 distinguished, proper max-width.

### 4. Social — Disabled state redesign

**Current:** "Social features are disabled" + button, full width.

**Change in landscape:**
- Max-width 800px, centered vertically and horizontally
- Heading: "The Adventurers' Guild" 28px
- Subheading: "Social features are currently disabled"
- Brief description of what's coming (friend challenges, guild leaderboards)
- "Enable in Settings" button — styled prominently
- Remove Back button in landscape

**Files:** `src/ui/components/SocialScreen.svelte`

**Acceptance:** Centered, atmospheric, informative disabled state.

## Verification Gate

- [ ] `npm run typecheck` + `npm run build` clean
- [ ] All 4 screens at 1920x1080: proper max-width, readable text, no back button
- [ ] Portrait mode: all 4 screens UNCHANGED
