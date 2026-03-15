# AR-37: Hub UI Cleanup — Banner Overlap, Currency Clarity, Shop Rework

**Status:** Complete
**Created:** 2026-03-15
**Depends on:** None

## Overview

Fix three hub-level UX issues: (1) the "Run in progress" resume/abandon banner overlaps with the streak and dust HUD icons, (2) the 💎 emoji is confusing — it looks like "gems" but represents "dust", and the currency system needs clarification, (3) the Shop button opens a camp upgrade modal full of hallucinated/placeholder items that need to be stripped to a clean shell awaiting real upgrade data.

## Deliverables

Total: 3 files edited, 2 verification steps

## Tasks

### Section A: Fix Resume Banner / HUD Overlap

- [x] **A.1** Read `src/ui/components/CampHudOverlay.svelte` — understand current `banner-offset` behavior (pushes HUD pills down 56px when banner is active)
  - Acceptance: file read, current offset value noted
- [x] **A.2** Read `src/CardApp.svelte` lines 1032-1048 — understand the active-run-banner height and position
  - Acceptance: file read, banner height noted
- [x] **A.3** Edit `src/ui/components/CampHudOverlay.svelte` — increase `.hud-overlay.banner-offset .hud-pill` top from `calc(56px + var(--safe-top))` to `calc(64px + var(--safe-top))` so HUD pills clear the banner (banner is ~44px tall with 10px padding + 1px border = ~55px)
  - Acceptance: HUD pills no longer overlap with the resume/abandon banner

### Section B: Currency Clarity

- [x] **B.1** Edit `src/ui/components/CampHudOverlay.svelte` — change the dust icon from `&#x1F48E;` (gem emoji 💎) to `✦` (a generic sparkle/dust symbol) to avoid confusion with a "gems" currency
  - Acceptance: HUD shows ✦ instead of 💎 for dust balance
- [x] **B.2** Edit `src/ui/components/CampHudOverlay.svelte` — add `aria-label="Dust"` to the dust pill for accessibility
  - Acceptance: screen readers announce "Dust" for the currency display

### Section C: Shop Page Rework — Clean Shell

- [x] **C.1** Read `src/ui/components/CampUpgradeModal.svelte` fully — understand what's currently shown (tent/seating/campfire/decor upgrade tiers, outfit selection, pet companions)
  - Acceptance: file read, all sections identified
- [x] **C.2** Edit `src/ui/components/CampUpgradeModal.svelte` — strip ALL upgrade items, outfit lists, pet lists, and daily deals. Replace the modal body with a clean empty-state message: "Camp upgrades coming soon! Check back later." Keep the modal frame, close button, and dust balance display.
  - Acceptance: opening Shop shows a clean modal with the "coming soon" message, no hallucinated items
- [x] **C.3** Edit `src/ui/components/CampUpgradeModal.svelte` — keep the dust balance display at the top so users can see how much dust they have
  - Acceptance: dust balance is visible in the shop modal header

### Section D: Verification Gate

- [x] **D.1** Run `npm run typecheck` — 0 errors
  - Acceptance: exit code 0, 0 ERRORS in output
- [x] **D.2** Run `npm run build` — succeeds
  - Acceptance: "built in" message, no build errors
- [x] **D.3** Playwright verify — resume banner does not overlap HUD icons
  - Acceptance: visual separation between banner and HUD pills
- [x] **D.4** Playwright verify — Shop shows clean "coming soon" shell
  - Acceptance: no hallucinated upgrade items visible

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/CampHudOverlay.svelte` | EDIT | A.3, B.1, B.2 |
| `src/ui/components/CampUpgradeModal.svelte` | EDIT | C.2, C.3 |
