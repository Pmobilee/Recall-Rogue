# AR-64: Active Run Guard Popup on Dungeon Entry

## Overview
**Goal:** When the player clicks "Enter Dungeon" while an active run save exists, show a modal popup asking them to Continue or Abandon the existing run, rather than silently overwriting it.

**Dependencies:** Existing `hasActiveRun()`, `loadActiveRun()`, `clearActiveRun()` from `runSaveService.ts`; `handleResumeActiveRun()`, `abandonActiveRun()`, `startNewRun()` in `CardApp.svelte`.

**Estimated complexity:** Low — single-file change, new state variables + UI block, reuse existing modal styles.

---

## Sub-steps

### 1. Add Guard State Variables
In `src/CardApp.svelte`, after the existing `showAbandonConfirm` state (around line 532), add:
```typescript
let showRunGuardPopup = $state(false)
let guardRunStats = $state<{ floor: number; gold: number; encounters: number; factsCorrect: number } | null>(null)
```

### 2. Modify `handleStartRun()`
Replace the current body of `handleStartRun()` (lines 176–179) so that:
- If `hasActiveRun()` returns true → load save, populate `guardRunStats`, set `showRunGuardPopup = true`, return early
- Otherwise → fall through to existing `maybePromptOutsideDueReviews()` / `startNewRun()` logic

### 3. Add `handleGuardContinue()` and `handleGuardAbandon()` handlers
```typescript
function handleGuardContinue(): void {
  showRunGuardPopup = false
  guardRunStats = null
  handleResumeActiveRun()
}

async function handleGuardAbandon(): Promise<void> {
  showRunGuardPopup = false
  guardRunStats = null
  // Normal start-new-run flow (includes outside-due prompt)
  if (await maybePromptOutsideDueReviews()) return
  startNewRun({ includeOutsideDueReviews: false })
}
```
Note: `handleGuardAbandon` must NOT call `clearActiveRun()` directly — `startNewRun()` internally calls `abandonActiveRun()` which clears the save.

### 4. Add Popup UI Block in the Template
Inside the `{#if $currentScreen === 'hub' || ...}` block, add a new `{#if showRunGuardPopup}` block alongside the other modals. Style it using the existing `.abandon-confirm-overlay` / `.abandon-confirm-modal` CSS classes.

- Title: "Run In Progress"
- Stats grid (floor, gold, encounters won, facts correct) — same layout as `abandon-run-stats`
- Warning: "Abandoning will lose all progress from this run."
- Two buttons:
  - "Continue Run" (primary/green) → `handleGuardContinue()`
  - "Abandon & Start New" (danger/red) → `handleGuardAbandon()`
- Clicking the backdrop closes popup with no action (sets `showRunGuardPopup = false`)

### 5. Hide Active-Run Banner While Guard Popup Is Open
Update `showActiveRunBanner` derived value to also hide when guard popup is showing:
```typescript
let showActiveRunBanner = $derived(!$activeRunState && hasRunSave && !showRunGuardPopup)
```

---

## Acceptance Criteria
- [ ] Clicking "Enter Dungeon" with no active save → normal flow (no popup)
- [ ] Clicking "Enter Dungeon" with an active save → guard popup appears with correct stats
- [ ] "Continue Run" → resumes existing run, popup closes
- [ ] "Abandon & Start New" → clears old run, starts new run flow (including outside-due prompt if applicable)
- [ ] Backdrop click → popup closes, player stays on hub
- [ ] Active-run banner is hidden while popup is open
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

---

## Files Affected
- `src/CardApp.svelte` — state vars, handler functions, template block, derived update
- `docs/GAME_DESIGN.md` — note added to Save/Resume System section

---

## Verification Gate
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean build
- [ ] `npx vitest run` — existing tests still pass
- [ ] Playwright visual check: popup renders correctly, both buttons work
