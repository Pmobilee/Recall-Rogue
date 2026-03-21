# AR-123 — Visual Audit Fixes

**Date:** 2026-03-21
**Source:** Comprehensive 3-agent visual audit across all game screens at 3 viewport sizes (834x1194, 390x844, 375x667)
**Scope:** All combat scenarios, non-combat screens (shop, rewards, hub, menus, settings, library, profile, onboarding, mystery events, run-end), quiz overlay, card rendering, interactive elements

---

## Overview

Three Sonnet agents performed an exhaustive visual audit of every reachable game state. This AR consolidates all unique findings, deduplicated and organized by severity. Issues are grouped into fix batches for efficient implementation.

**Total unique issues: 58**
- Critical: 5
- High: 14
- Medium: 17
- Low: 14
- Dev-only (scenario config): 8

---

## CRITICAL — Blocks Gameplay

### C-1: `each_key_duplicate` in CardRewardScreen.svelte
- **File:** `src/ui/components/CardRewardScreen.svelte:327`
- **Bug:** `{#each options as option (option.cardType)}` uses `cardType` as key, but multiple cards can share the same type (e.g., two "attack" cards), causing Svelte duplicate key crash
- **Impact:** Card reward screen breaks when multiple cards of same type are offered — core gameplay loop
- **Fix:** Change key to unique identifier (e.g., `option.id` or index)
- [ ] Fix each key to use unique identifier
- [ ] Verify card-reward-attacks and card-reward-mixed scenarios work

### C-2: RewardRoomScene black screen on re-initialization
- **File:** `src/game/scenes/RewardRoomScene.ts:100`
- **Bug:** Scene logs "Scene already initialized" and early-returns without rendering when re-entered. Subsequent loads of reward-gold-and-cards, reward-relic scenarios show black screen
- **Impact:** Players may see black screen when entering reward room if scene wasn't properly cleaned up
- [ ] Fix scene cleanup/re-initialization logic
- [ ] Verify all reward scenarios render correctly on repeated loads

### C-3: Mystery event black screen on re-entry
- **Screens:** mystery-event, mystery-healing-fountain
- **Bug:** When loaded after other scenarios that used `bootstrapRun`, the Phaser WebGL context appears lost and renders only black
- **Impact:** Mystery rooms may render black if reached after combat
- [ ] Fix WebGL context preservation across scene transitions

### C-4: Card hand clips off BOTH viewport edges (5-card hand)
- **Affected:** All combat scenarios at 390x844
- **Measurements:** card-hand-0 x=-8 (8px off LEFT edge), card-hand-4 right=398 (8px off RIGHT edge at 390px viewport)
- **Impact:** Players cannot see the full border/art of outer cards — the most common hand size clips on every mobile device
- [ ] Fix card hand positioning to respect viewport bounds
- [ ] Verify at 375x667 and 390x844

### C-5: Run-end screens show blank stat values
- **Screens:** run-end-victory, run-end-defeat (run-end-retreat works)
- **Bug:** Stat rows show labels ("Floor Reached", "Facts Answered", "Accuracy") but values are blank/empty. Appears to be a race condition where the screen renders before stats are computed
- [ ] Fix stat loading to wait for data before rendering
- [ ] Verify all 3 run-end variants show populated stats

---

## HIGH — Very Noticeable

### H-1: "Tap a card to examine it" tooltip permanently shown
- **Screens:** All combat scenarios
- **Bug:** Onboarding hint rendered in Phaser canvas permanently overlays the middle of the card hand, making card descriptions unreadable
- **Impact:** Persistent UI clutter that obscures card content every combat
- [ ] Make tooltip dismiss after first card tap, or show only on first combat

### H-2: 10-card hand illegible when stacked
- **Screens:** combat-10-cards, combat-big-hand
- **Bug:** Cards 0-8 overlap so heavily that only the top banner (card name) is visible. Combined with chain color banners creates a chaotic rainbow of overlapping headers
- [ ] Improve card fan scaling for large hands (consider scroll/swipe or smaller cards)

### H-3: HP bar nearly invisible at low HP
- **Screens:** combat-low-hp (10/100), combat-near-death (3/100)
- **Bug:** At 10% HP the bar is a ~24px sliver on a 240px bar. At 3% it's imperceptible. No color change, glow, or pulse to indicate critical state
- [ ] Add minimum bar width (e.g., 8px) and/or critical HP visual indicator (red pulse, screen vignette)

### H-4: Shop "Leave Shop" button off-screen at all viewports
- **Screens:** shop, shop-loaded
- **Bug:** Content extends past screen bottom with no visible scroll affordance. "Leave Shop" button exists in DOM but is below visible area
- [ ] Ensure Leave Shop button is always visible (sticky footer or scrollable with indicator)

### H-5: Rest site "Study" shows "No cards to upgrade" falsely
- **Screen:** rest-site
- **Bug:** Study option grayed out with "No cards to upgrade" message even when player has a deck with cards
- [ ] Fix upgrade eligibility check

### H-6: Library "Capitals & Flags" shows 0/0 facts
- **Screen:** library
- **Bug:** Domain shows 0/0 total facts while all others have counts. May indicate missing fact pack or loading error
- **Also:** "Language" domain shows 0/105,976 — suspiciously large number, possible data import issue
- [ ] Fix fact count loading for Capitals & Flags
- [ ] Investigate Language domain count

### H-7: Hub buttons have no aria-labels (accessibility)
- **Screen:** hub-fresh, hub with run
- **Bug:** 10 interactive button elements overlaid on Phaser canvas have no accessible labels. Screen readers get no context
- [ ] Add aria-labels to all hub interaction zones

### H-8: Relic tray shows 0/5 with configured relics (combat-relic-heavy)
- **Screen:** combat-relic-heavy
- **Bug:** Relics specified in scenario don't appear. Console warns about unknown relic IDs (`momentum_gem`, `expanded_satchel`). Even valid relics don't display in slots
- [ ] Fix scenario relic IDs to use valid ones
- [ ] Verify relic tray renders correctly when relics are equipped

### H-9: Black letterbox bars on both sides of game
- **Screens:** All screens, all viewports
- **Bug:** ~85px black bars on left and right at 834px viewport, narrower but present at mobile sizes. Game canvas is letterboxed rather than filling available width
- **Impact:** Wastes significant screen real estate on a mobile-first game
- [ ] Investigate whether game can fill viewport width (background-size: cover or wider canvas)

### H-10: Combat layout extremely cramped at 375x667 (iPhone SE)
- **Screens:** All combat at 375x667
- **Bug:** Enemy sprite and card hand nearly touch with only ~50px of midground visible. Combat feels unplayable on this common form factor
- [ ] Test and improve combat layout at 375x667

### H-11: Game auto-transitions away from combat in 1-2s during dev scenarios
- **Dev-only but indicates real bug:** When combat scenarios are loaded, the game transitions to another screen within 1-2s because the turn state from devpreset isn't properly paused
- [ ] Fix scenario loader to properly initialize combat turn state

### H-12: `NUM_CHAIN_TYPES is not defined` runtime error (intermittent)
- **File:** `src/services/runPoolBuilder.ts:214`
- **Bug:** `ReferenceError: NUM_CHAIN_TYPES is not defined at assignChainTypes` — timing/import issue when scenario loads too quickly after page load
- [ ] Fix import or initialization order for NUM_CHAIN_TYPES

### H-13: Shop cards show "ATTACK • Learning / Power N" instead of card names
- **Screen:** shop-loaded
- **Bug:** Cards for sale display mechanic type + power value instead of human-readable card name (e.g., "Heavy Strike", "Multi-Hit")
- [ ] Display card name in shop item rows

### H-14: Card reward screen shows empty altar (no cards visible)
- **Screen:** card-reward
- **Bug:** "Choose a Card" header and "Cavern Altar" subtitle displayed, but the altar card slots show no cards. "Inspect a card" hint shown but nothing to inspect
- [ ] Verify cards render on the altar or add placeholder indicators

---

## MEDIUM — Noticeable On Close Look

### M-1: Quiz answer buttons have inconsistent heights
- **Screen:** Study quiz overlay
- **Bug:** Single-line answers = 63px height, multi-line answers (e.g., "Von Neumann architecture") = 89px. Buttons should have uniform height
- [ ] Set min-height on answer buttons for consistency

### M-2: Enemy intent icon has no label, tiny at small viewport
- **Screens:** All combat
- **Bug:** Attack damage badge (e.g., "8" with sword icon) at top-left is just a number with no context. At 375px, positioned at x=8 with no breathing room
- [ ] Add label or tooltip to enemy intent indicator

### M-3: Draw/discard pile touch targets too small (36px)
- **Screens:** All combat at 390x844
- **Bug:** Both piles are 36px wide, below the 44px minimum recommended mobile touch target
- [ ] Increase to 44px minimum

### M-4: No block counter shown when block = 0
- **Screens:** All combat
- **Bug:** Block counter disappears entirely at 0 rather than showing "0 Block". Players can't tell if block is at 0 or not rendered
- [ ] Show block counter at 0 (dimmed or with "0" label)

### M-5: Pause button near right edge at 390px
- **Screen:** All combat at 390x844
- **Bug:** Pause button at x=334, right=382 — only 8px from viewport edge. Uncomfortable touch target near device edge
- [ ] Add more right margin to pause button

### M-6: Run-end screen title has no top padding (safe area)
- **Screens:** All run-end screens
- **Bug:** "PULLED OUT" / "DIVE COMPLETE" text starts at y≈0 with no padding. On notched phones, this would be obscured by device status bar
- [ ] Add safe-area-inset-top padding

### M-7: No bottom safe area margin for iPhone home bar
- **Screens:** All combat at 390x844
- **Bug:** END TURN button bottom=832, HP bar bottom=830 on 844px viewport. Only 14px below HP bar — iPhone home indicator would overlap
- [ ] Add safe-area-inset-bottom padding

### M-8: Enemy name pixel font hard to read at 375px
- **Screens:** All combat at 375px
- **Bug:** All-caps pixel font becomes very small and aliased/blurry on small viewports
- [ ] Scale font or use more readable font at small sizes

### M-9: Relic "0/5" counter text tiny and low contrast
- **Screens:** All combat with relic tray
- **Bug:** Small font, poor contrast against game background. Nearly impossible to read at 375px
- [ ] Increase font size and contrast

### M-10: Library "Deck Builder" tab wraps to two lines at 375px
- **Screen:** library at 375x667
- **Bug:** "Deck Builder" wraps to "Deck" / "Builder" while "Knowledge" stays single-line
- [ ] Reduce padding or abbreviate

### M-11: Settings left-side content cut off by nav strip
- **Screen:** settings
- **Bug:** ~80px of empty dark space on left side — leftover Phaser canvas showing through behind Svelte overlay
- [ ] Fix settings overlay width/positioning

### M-12: Shop relic descriptions truncated with ellipsis
- **Screens:** shop, shop-loaded
- **Bug:** "Combo Ring" description cut off: "First Charged correct answer each turn grants..." — truncation too aggressive, text would fit with slightly taller row
- [ ] Increase row height or allow wrapping

### M-13: Run-end "Share" button on defeat (unusual UX)
- **Screen:** run-end-defeat, run-end-retreat
- **Bug:** Share button present on defeat/retreat — unusual for games. Also, Play Again + Home + Share buttons squished together at 390x844
- [ ] Consider hiding Share on defeat or adding more button spacing

### M-14: Onboarding "Back" button very small (~60x22px)
- **Screen:** onboarding
- **Bug:** Tiny tap target in top-left corner. Players entering by mistake have a very small target to exit
- [ ] Increase Back button size to >=44px

### M-15: Rest site "Meditate" text wraps badly in narrow column
- **Screen:** rest-site at 390x844
- **Bug:** "Remove 1 card from your deck" wraps to 2-3 words per line in narrow column
- [ ] Widen columns or reduce font size

### M-16: Mystery event icon is tiny (32x32 sprite)
- **Screen:** mystery-healing-fountain, mystery-event
- **Bug:** Event icon/image in dialog is a 32x32px sprite rendered at native resolution in a large dialog
- [ ] Scale up mystery event icons

### M-17: Hub "Run in progress" banner crowds top of screen
- **Screen:** Hub with active run
- **Bug:** Resume/Abandon banner at top competes with flame counter and dust display for same vertical space
- [ ] Add spacing or reorganize top bar when run banner is active

---

## LOW — Minor Polish

### L-1: HP formatting inconsistent (enemy "17 / 17" vs player "100/100")
### L-2: Profile avatar is generic placeholder silhouette
### L-3: Settings font size selector — selected state not prominent enough
### L-4: Settings checkbox states use very different visual weights
### L-5: Library progress bars invisible at 0% (thin single-pixel lines)
### L-6: Library vs Profile domain naming inconsistent ("General" vs "General Knowledge")
### L-7: Hub XP bar/level at bottom-right clips near device home bar at 375x667
### L-8: Run-end stat row labels and values misaligned
### L-9: Onboarding background too dark (entrance arch barely visible)
### L-10: Profile large empty area below stat cards
### L-11: Settings section header colors inconsistent (amber vs white)
### L-12: Shop no prominent gold balance display visible
### L-13: Profile stats show "0" with no indication if loaded or genuinely zero
### L-14: Chain color banners create chaotic rainbow in stacked hands

---

## Dev-Only / Scenario Config Issues

### D-1: 3 scenarios reference non-existent enemy IDs
- `combat-scholar` → `enemy: 'scholar'` (doesn't exist)
- `combat-elite` → `enemy: 'the_librarian'` (doesn't exist)
- `combat-mini-boss` → `enemy: 'cave_guardian'` (doesn't exist)
- **File:** `src/dev/scenarioSimulator.ts`

### D-2: 2 scenarios reference non-existent relic IDs
- `combat-relic-heavy` → `momentum_gem` (doesn't exist)
- `combat-big-hand` → `expanded_satchel` (doesn't exist)
- **File:** `src/dev/scenarioSimulator.ts`

### D-3: `hub-endgame` references non-existent relic `scholars_hat`

### D-4: `combat-boss` intermittently loads wrong enemy (cave_bat instead of the_archivist)

### D-5: `combat-near-death` scenario loads Profile screen instead of combat

### D-6: Multiple scenarios load wrong screens (card-reward loads run-end, rest-site loads run-end)

### D-7: `study-quiz` scenario intermittently shows black screen with each_key_duplicate error

### D-8: Scenario loader doesn't properly pause combat turn state (auto-transitions in 1-2s)

---

## Console Errors (Non-Gameplay, Infrastructure)

These are expected in local dev but should be addressed before production:
- `ERR_CONNECTION_REFUSED @ localhost:3001/api/analytics/events` — backend not running
- `ERR_CONNECTION_REFUSED @ localhost:3001/api/facts/packs/all` — backend not running
- `CSP violation: Connecting to 'http://100.74.153.81:5175/...'` — hardcoded IP in CSP
- `PWA manifest icon-192.png download error` — missing or broken icon
- `[encounterBridge] Encounter already active` — shop scenario trigger on existing encounter

---

## Suggested Fix Batches

**Batch 1 — Critical Fixes (do first):**
- C-1: CardRewardScreen duplicate key
- C-2: RewardRoomScene re-initialization
- C-4: Card hand viewport clipping
- C-5: Run-end blank stats

**Batch 2 — High-Impact Combat Polish:**
- H-1: Dismiss "tap to examine" tooltip
- H-3: Low HP visual indicator
- H-12: NUM_CHAIN_TYPES import fix
- M-7: Bottom safe area padding
- M-6: Top safe area padding

**Batch 3 — Non-Combat Screen Fixes:**
- H-4: Shop Leave button visibility
- H-5: Rest site Study false disabled
- H-6: Library fact counts
- H-13: Shop card names
- H-14: Card reward empty altar

**Batch 4 — Responsive & Touch Target Fixes:**
- M-3: Draw/discard pile touch targets
- M-5: Pause button margin
- M-14: Onboarding Back button size
- H-10: Combat layout at 375x667

**Batch 5 — Accessibility & Polish:**
- H-7: Hub aria-labels
- M-1: Quiz button heights
- M-4: Block counter at 0
- All LOW items

**Batch 6 — Dev Tooling:**
- D-1 through D-8: Fix all scenario configs

---

## Acceptance Criteria

- [ ] All CRITICAL issues resolved and verified with Playwright screenshots
- [ ] All HIGH issues resolved
- [ ] All MEDIUM issues resolved
- [ ] Card reward screen works with duplicate card types
- [ ] Reward room re-entry renders correctly
- [ ] Combat card hand fully visible at 390x844 and 375x667
- [ ] Run-end stats populated on all 3 variants
- [ ] No Svelte `each_key_duplicate` errors in console
- [ ] All scenario configs reference valid enemy/relic IDs

---

## Files Likely Affected

- `src/ui/components/CardRewardScreen.svelte` — duplicate key fix
- `src/game/scenes/RewardRoomScene.ts` — re-initialization fix
- `src/ui/components/CardHand.svelte` — viewport clipping
- `src/ui/components/RunEndScreen.svelte` — stat loading
- `src/game/scenes/CombatScene.ts` — tooltip, HP indicator, layout
- `src/ui/components/ShopRoomOverlay.svelte` — leave button, card names, relic descriptions
- `src/ui/components/RestRoomOverlay.svelte` — study eligibility
- `src/ui/components/KnowledgeLibrary.svelte` — fact counts, tab wrapping
- `src/dev/scenarioSimulator.ts` — all D-* scenario fixes
- `src/services/runPoolBuilder.ts` — NUM_CHAIN_TYPES import
- Various components — safe area padding, touch targets, aria-labels
