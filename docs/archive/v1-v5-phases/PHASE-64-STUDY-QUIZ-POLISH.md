# Phase 64: Study Session & Quiz Polish

**Status**: Not Started
**Priority**: HIGH — Fixes playtest findings H4 (layout overflow) and H7 (missing grading button)
**Estimated Effort**: 1-2 sprints
**Last Updated**: 2026-03-06

---

## Tech Stack

- Frontend: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- Study Session UI: `src/ui/components/StudySession.svelte` — card review overlay
- Grading UI: Currently 2 buttons (lines 338-362): "Didn't get it" (false) and "Got it" (true)
- SM-2 Engine: `src/services/sm2.ts` — `reviewFact(state, quality)` where quality is 0-5
- Player Data: `src/ui/stores/playerData.ts` — `updateReviewState(factId, correct, factCategory?)` (lines 171-226)
- Design Decision: DD-V2-096 specifies 3-button grading: Again (quality 1), Good (quality 3), Easy (quality 5)
- Typecheck: `npm run typecheck` — must remain at 0 errors

---

## Overview

The Study Session is the core review mechanic where players strengthen learned facts using SM-2 spaced repetition. Two playtest findings identified issues:

1. **H4 — Layout overflow**: The answer card title overlaps the "1/5" progress indicator, explanation text gets clipped at the bottom, and grading buttons overlap card content on smaller screens.
2. **H7 — Only 2 grading buttons**: The current "Didn't get it" / "Got it" binary grading loses nuance. DD-V2-096 specifies 3 grades (Again / Good / Easy) mapping to SM-2 qualities 1, 3, and 5 respectively. This distinction is critical for the spaced repetition algorithm to schedule reviews at appropriate intervals.

**Dependencies**: None. This phase touches only the study session UI and its data flow.

---

## Sub-Phase Index

| Sub-Phase | Name | Status |
|-----------|------|--------|
| 64.1 | Fix study card layout overflow | Not Started |
| 64.2 | Add third grading button (Again / Good / Easy) | Not Started |
| 64.3 | Wire SM-2 quality grades correctly | Not Started |

---

## Prerequisites

Before starting any sub-phase, verify:
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (all SM-2 and study-related tests)
- [ ] Dev server running on `http://localhost:5173`

---

## Sub-Phase 64.1: Fix Study Card Layout Overflow

### Goal
Eliminate all visual overlap between the progress indicator, card content, and grading buttons in the study session.

### Current State
- File: `src/ui/components/StudySession.svelte` lines 259-336
- The progress indicator ("1/5") sits inside the card area and gets overlapped by the answer title
- Explanation text is clipped at the bottom when it exceeds the card height
- Grading buttons overlap the bottom of the card content on shorter viewports

### Implementation Steps

**Step 1**: Move the progress indicator above the card
- In the template section (around line 259), move the progress indicator element ("X/Y") out of the card container
- Position it as a fixed-height element above the card with `margin-bottom: 8px`
- Style: centered text, muted color, small font size (0.85rem)

**Step 2**: Make card content scrollable
- Add `overflow-y: auto` to the card content area (the div containing the question/answer text and explanation)
- Set `max-height` on the card content area using `calc()` to account for:
  - Progress indicator height (~28px)
  - Card header/padding (~16px top + 16px bottom)
  - Grading button area (~60px)
  - Container padding (~24px total)
- Example: `max-height: calc(100vh - 200px)` (adjust based on actual layout measurements)

**Step 3**: Add spacing between card bottom and grading buttons
- Ensure at least 12px gap between the card bottom edge and the grading buttons
- Use `margin-top: 12px` on the button container or `padding-bottom: 12px` on the card

**Step 4**: Ensure grading buttons are always visible
- The grading button container should be positioned outside and below the scrollable card area
- It must not be inside the scrollable region — buttons must always be visible without scrolling

### Files Modified
- `src/ui/components/StudySession.svelte` (template and style sections)

### Acceptance Criteria
- [ ] Progress indicator ("1/5") is visually separate from and above the card content
- [ ] Long answer text (explanation > 200 words) scrolls within the card without clipping
- [ ] Grading buttons are always visible below the card, never overlapped
- [ ] Layout works on mobile viewport (375x667) and desktop (1280x720)
- [ ] No visual regression on the question-side of the card (before answer reveal)

---

## Sub-Phase 64.2: Add Third Grading Button (Again / Good / Easy)

### Goal
Replace the 2-button grading UI with 3 buttons matching DD-V2-096's specification, giving players nuanced control over their spaced repetition schedule.

### Current State
- File: `src/ui/components/StudySession.svelte` lines 338-362
- Two buttons: "Didn't get it" (calls `rate(false)`) and "Got it" (calls `rate(true)`)
- The `rate()` function takes a boolean and calls the `onAnswer` callback

### Implementation Steps

**Step 1**: Replace the 2-button template with 3 buttons
- Remove the existing "Didn't get it" and "Got it" buttons
- Add three buttons in a horizontal row:
  1. **"Again"** — red/danger color (`background: #e74c3c` or equivalent theme color)
     - Tooltip/sublabel: "Forgot" or "Reset"
     - Calls `rate(1)`
  2. **"Good"** — green/success color (`background: #2ecc71` or equivalent theme color)
     - Tooltip/sublabel: "Correct"
     - Calls `rate(3)`
  3. **"Easy"** — gold or blue accent color (`background: #f39c12` or `#3498db`)
     - Tooltip/sublabel: "Effortless"
     - Calls `rate(5)`
- All buttons should be equal width, arranged in a single row with 8px gap
- Minimum touch target: 44px height (mobile accessibility)

**Step 2**: Update the `rate()` function signature
- Change from `rate(correct: boolean)` to `rate(quality: number)`
- The function should pass the quality number directly to the `onAnswer` callback
- Remove any boolean-to-quality mapping inside `rate()`

**Step 3**: Update the `onAnswer` callback prop type
- Change the component's `onAnswer` prop from `(correct: boolean) => void` to `(quality: number) => void`
- If using Svelte 5 `$props()`, update the type definition accordingly
- Example: `let { onAnswer }: { onAnswer: (quality: number) => void } = $props()`

**Step 4**: Style the buttons with visual hierarchy
- "Again" should feel like a warning/failure (red tones)
- "Good" should feel like the default/expected action (green, slightly larger or bolder)
- "Easy" should feel like a bonus/reward (gold/warm tones)
- Add a subtle icon or emoji-free indicator if desired (e.g., border style differences)
- Buttons should only appear after the answer is revealed (preserve existing show/hide logic)

### Files Modified
- `src/ui/components/StudySession.svelte` (template, script, and style sections)

### Acceptance Criteria
- [ ] Three buttons visible after answer reveal: "Again" (red), "Good" (green), "Easy" (gold)
- [ ] Each button calls `onAnswer` with the correct quality value (1, 3, or 5)
- [ ] Buttons are equal width, at least 44px tall, with 8px gap between them
- [ ] Only two buttons existed before; now exactly three exist
- [ ] Buttons are hidden before answer reveal (no regression)

---

## Sub-Phase 64.3: Wire SM-2 Quality Grades Correctly

### Goal
Ensure the quality values from the 3-button UI flow correctly through `updateReviewState` to `sm2.reviewFact()`, producing appropriate interval scheduling for each grade.

### Current State
- File: `src/ui/stores/playerData.ts` lines 171-226
- `updateReviewState(factId, correct, factCategory?)` takes a boolean `correct`
- Internally maps boolean to SM-2 quality (likely `correct ? 3 : 1` or similar)
- `src/services/sm2.ts` `reviewFact(state, quality)` already accepts quality 0-5

### Implementation Steps

**Step 1**: Audit `updateReviewState` in playerData.ts
- Read lines 171-226 to confirm the current boolean-to-quality mapping
- Identify where `reviewFact()` is called and what quality value is passed
- Document the current mapping (e.g., `correct ? 3 : 1`)

**Step 2**: Change `updateReviewState` signature
- Change from `updateReviewState(factId: string, correct: boolean, factCategory?: string)`
- To: `updateReviewState(factId: string, quality: number, factCategory?: string)`
- Inside the function, pass `quality` directly to `reviewFact(state, quality)` instead of mapping from boolean
- Keep any side effects (streak updates, stats tracking) that depend on correct/incorrect:
  - Derive correctness from quality: `const correct = quality >= 3`
  - Use this derived boolean for streak/stats logic

**Step 3**: Update all callers of `updateReviewState`
- **StudySession.svelte**: Already passes quality number from Sub-Phase 64.2 — verify it flows through
- **Mine quiz flow** (search for all `updateReviewState` calls):
  - Likely in `src/game/managers/QuizManager.ts` or similar
  - Mine quizzes use binary correct/incorrect — update these callers to pass `quality: correct ? 3 : 1`
  - This preserves existing mine quiz behavior (no 3-button grading in mines)
- **Any other callers**: Search codebase for `updateReviewState` and update each call site

**Step 4**: Verify SM-2 interval calculations
- `sm2.ts` `reviewFact(state, quality)` should already handle quality 1, 3, and 5 correctly:
  - Quality 1: Reset interval (failed card, show again soon)
  - Quality 3: Normal progression (interval grows by easeFactor)
  - Quality 5: Accelerated progression (interval grows faster, easeFactor increases)
- Read `sm2.ts` to confirm this behavior — if the standard SM-2 algorithm is implemented, quality 1 resets to interval 1, quality 3 keeps normal flow, quality 5 boosts easeFactor
- If `sm2.ts` needs changes (unlikely), update it to match standard SM-2 behavior for these quality values

**Step 5**: Update unit tests
- Search for existing tests: `npx vitest run --reporter=verbose 2>&1 | grep -i "sm2\|review\|study\|grade"`
- Update any tests that call `updateReviewState` with a boolean to use quality numbers
- Add new test cases if not already covered:
  - `updateReviewState(factId, 1)` → interval resets (short next review)
  - `updateReviewState(factId, 3)` → interval grows normally
  - `updateReviewState(factId, 5)` → interval grows faster than quality 3
- Run `npx vitest run` to confirm all tests pass

### Files Modified
- `src/ui/stores/playerData.ts` (signature change, internal logic update)
- `src/ui/components/StudySession.svelte` (caller update — may already be done from 64.2)
- `src/game/managers/QuizManager.ts` or equivalent (mine quiz caller update)
- Any other files that call `updateReviewState` (search codebase)
- Test files for SM-2 / review state (update assertions)

### Acceptance Criteria
- [ ] `updateReviewState` accepts a numeric quality (0-5) instead of boolean
- [ ] StudySession passes quality 1, 3, or 5 based on button clicked
- [ ] Mine quiz callers pass quality 3 (correct) or 1 (incorrect) — no behavioral change for mine quizzes
- [ ] `sm2.reviewFact()` receives the correct quality value for all code paths
- [ ] Quality 1 results in a shorter next-review interval than quality 3
- [ ] Quality 5 results in a longer next-review interval than quality 3
- [ ] All existing unit tests pass after updates
- [ ] `npm run typecheck` — 0 errors

---

## Verification Gate

All of the following must pass before Phase 64 is marked complete:

### Automated Checks
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds with no errors
- [ ] `npx vitest run` — all tests pass, including SM-2 and review state tests

### Visual / Manual Checks (Playwright)
Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`

1. **Start study session**: Click "Memory Strengthening" or equivalent study button
2. **Verify card layout**: Progress indicator ("1/5") is above the card, not overlapping content
3. **Reveal answer**: Tap/click to reveal the answer
4. **Verify 3 buttons**: Exactly 3 grading buttons visible — "Again" (red), "Good" (green), "Easy" (gold)
5. **Verify no overlap**: Buttons do not overlap card content; card content scrolls if long
6. **Click "Easy"**: Verify the card advances to the next review item
7. **Check SM-2 intervals**: Use `browser_evaluate(() => window.__terraDebug())` to inspect the review state — the fact graded "Easy" should have a longer interval than facts graded "Good"
8. **Click "Again"**: On the next card, click "Again" — verify the fact gets a short interval (will appear again soon)
9. **Complete session**: Finish all cards, verify the session ends cleanly (no JS errors)
10. **Console check**: `browser_console_messages` — no errors related to study session or SM-2

### Playwright Test Script (Node.js)

```javascript
// tests/e2e/064-study-quiz-polish.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due');
  await page.waitForTimeout(3000);

  // Find and click study/review button
  const studyBtn = page.locator('[data-testid="btn-study"], button:has-text("Memory"), button:has-text("Study"), button:has-text("Review")');
  if (await studyBtn.count() > 0) {
    await studyBtn.first().click({ force: true });
    await page.waitForTimeout(2000);

    // Verify progress indicator exists
    const progress = page.locator('text=/\\d+\\/\\d+/');
    console.log('Progress indicator found:', await progress.count() > 0);

    // Reveal answer (click card or reveal button)
    const revealBtn = page.locator('button:has-text("Reveal"), button:has-text("Show"), [data-testid="btn-reveal"]');
    if (await revealBtn.count() > 0) {
      await revealBtn.first().click({ force: true });
    } else {
      await page.click('body', { position: { x: 187, y: 400 } });
    }
    await page.waitForTimeout(1000);

    // Check for 3 grading buttons
    const againBtn = page.locator('button:has-text("Again")');
    const goodBtn = page.locator('button:has-text("Good")');
    const easyBtn = page.locator('button:has-text("Easy")');

    console.log('Again button:', await againBtn.count() > 0);
    console.log('Good button:', await goodBtn.count() > 0);
    console.log('Easy button:', await easyBtn.count() > 0);

    // Screenshot
    await page.screenshot({ path: 'study-quiz-polish-3buttons.png' });

    // Click Easy and verify progression
    if (await easyBtn.count() > 0) {
      await easyBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
      console.log('Clicked Easy - session advanced');
    }
  } else {
    console.log('WARN: Could not find study button');
  }

  console.log('JS errors:', errors.length === 0 ? 'NONE' : errors);
  await page.screenshot({ path: 'study-quiz-polish-final.png' });
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
```

---

## Files Affected (Complete List)

| File | Change Type |
|------|-------------|
| `src/ui/components/StudySession.svelte` | Modified — layout fix, 3-button UI, rate() signature |
| `src/ui/stores/playerData.ts` | Modified — `updateReviewState` signature boolean → number |
| `src/services/sm2.ts` | Read-only verification (already supports quality 0-5) |
| `src/game/managers/QuizManager.ts` | Modified — update `updateReviewState` caller (boolean → quality) |
| Any other `updateReviewState` callers | Modified — update call signature |
| Test files (SM-2 / review) | Modified — update test assertions for new signature |
| `tests/e2e/064-study-quiz-polish.cjs` | New — E2E verification script |

---

## Design References

- **DD-V2-096**: 3-button grading (Again / Good / Easy) with SM-2 quality mapping
- **SM-2 Algorithm**: Standard Supermemo-2 with quality 0-5 scale; quality < 3 = failure (reset interval)
- **Playtest Finding H4**: Study card layout overlaps on mobile viewports
- **Playtest Finding H7**: Binary grading insufficient for spaced repetition nuance
