# AR-213: Menu Screens Layout Balance

## Overview
Multiple menu/utility screens (Profile, Settings, Archetype Selection, Campfire, Leaderboards, Social, Journal) have severe layout balance issues at 1920x1080 — content crammed into a small area with vast empty space. These screens feel like they were designed for mobile portrait mode and never adapted for landscape PC.

**Complexity**: Medium
**Dependencies**: None
**Files Affected**: `src/ui/components/ProfileScreen.svelte`, `src/ui/components/SettingsScreen.svelte`, `src/ui/components/ArchetypeSelection.svelte`, `src/ui/components/CampfireScreen.svelte`, `src/ui/components/LeaderboardScreen.svelte`, `src/ui/components/SocialScreen.svelte`, `src/ui/components/JournalScreen.svelte`

## Sub-steps

### 1. Profile screen — use full width with visual enhancements
- Currently: 6 small stat cards in top-left ~30% of width, rest empty
- Target: Center content, use wider stat cards, add visual treatment for empty domain runs
- Add a hero section with avatar, level, title taking full width
- Stats grid should be wider (max-width: calc(900px * var(--layout-scale, 1)) or similar)
- Consider 2-column layout: stats left, domain run history right
- **Acceptance**: Profile content uses at least 70% of viewport width

### 2. Settings screen — wider content panel
- Currently: content fills ~40% of width
- Target: Settings content panel wider (max-width 60-70% of viewport)
- Fix hot-pink checkboxes/sliders — use brand-consistent warm gold/amber colors
- **Acceptance**: Settings panel fills reasonable width; controls match brand colors

### 3. Archetype Selection — add visual flair
- Currently: plain text list, tiny colored squares, massive empty space
- Target: Larger archetype cards with icons/art, wider layout
- Each archetype should have a distinctive icon/illustration, not just a colored square
- Use a card-based layout that fills more width
- Description text should be larger and readable
- **Acceptance**: Archetype selection feels like a meaningful choice, not a settings dropdown

### 4. Campfire screen — enlarge and enrich modal
- Currently: tiny modal centered on screen, clearly mobile-sized
- Target: Scale modal to fill at least 40% of viewport width/height
- Stats grid (Level, HP, Cards, Gold) should be larger
- Consider adding run context (floor, domain, enemies defeated)
- Use `--layout-scale` for all modal dimensions
- **Acceptance**: Campfire modal appropriately sized for 1080p

### 5. Leaderboards — wider entries, better stat display
- Currently: entries only fill ~50% of width, stat icons tiny
- Target: Entries fill more width, stats have labels or larger icons
- Top 3 entries could have larger/more distinctive styling
- **Acceptance**: Leaderboard entries fill at least 70% width, stats readable

### 6. Social screen — better disabled state
- Currently: massive empty card above the disabled message, ugly scrollbar
- Target: Centered message without oversized empty container
- Hide scrollbar or use custom styled scrollbar
- **Acceptance**: Disabled state looks intentional and polished

### 7. Journal screen — better empty state
- Currently: oversized grey card area with tiny centered message
- Target: Reduce empty card size, add illustration or prompt
- **Acceptance**: Empty journal feels inviting rather than desolate

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] All 7 screens visually inspected at 1920x1080
- [ ] Content fills at least 60% of viewport width on each screen
- [ ] No hardcoded px values — all use `calc()` with scale variables
- [ ] Settings controls use brand-consistent colors (not hot pink)
