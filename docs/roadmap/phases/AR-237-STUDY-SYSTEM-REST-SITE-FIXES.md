# AR-237: Study System & Rest Site Fixes

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 32, 33
**Complexity:** Medium — quiz service wiring, UI upgrade display
**Dependencies:** AR-113 (In-Run Mastery Upgrade System), AR-226 (Mystery Room Overhaul)

---

## Overview

Two rest site study issues: (1) Study questions are pulling from random database facts instead of the player's actual deck facts. (2) After study completes, the upgraded cards are not shown to the player — they should be displayed with upgrade icons below the "study complete" box.

---

## User's Exact Words

> "When studying at a rest site, the questions are completely random facts from the database, NOT based on the facts we have in our deck. Study questions must come from our deck's facts."

> "Once study is complete, show all upgraded cards with their upgrade icons, hovering below the 'study complete' box, so players can see what they improved."

---

## Sub-Steps

### Step 1 — Wire Study Questions to Deck Facts
**Files:** `src/ui/components/RestRoomOverlay.svelte`, `src/services/quizService.ts`

- Find where the rest site study action fetches its quiz questions.
- Currently it appears to call a generic fact-fetch that pulls from the full database.
- Change it to: fetch quiz questions only from facts assigned to cards currently in the player's deck.
- The player's deck is available via run state — get the fact IDs from all deck cards, then filter quiz questions to only those fact IDs.
- If `quizService` has a `getQuestionsForFacts(factIds: string[])` method or similar, use it. If not, add one.
- The study session should cycle through deck facts (not random DB facts) using SM-2 order (due first, then by difficulty).

**Acceptance:** Start a rest site study session. All quiz questions shown are for facts that exist in the current deck. No random off-deck facts appear.

---

### Step 2 — Show Upgraded Cards After Study Complete
**File:** `src/ui/components/RestRoomOverlay.svelte`

- After the study session completes (all questions answered), show a "Study Complete" summary.
- Below the summary box, render the cards that received mastery upgrades during the session.
- Each upgraded card shows: card artwork + frame (same as hand card rendering), upgrade icon/indicator (star, glow, or level indicator per the mastery system from AR-113).
- Cards are rendered in a horizontal row. If more than 5, use a scroll or wrap to a second row.
- Cards should use the same card component as the combat hand — not a custom stripped-down version.

**Acceptance:** After completing a study session, "Study Complete" text appears with upgraded cards shown below it. Each upgraded card is identifiable with its upgrade icon. Screenshot confirms this layout.

---

### Step 3 — Handle Edge Case: No Cards Upgraded
**File:** `src/ui/components/RestRoomOverlay.svelte`

- If the player answered all questions correctly but no cards gained a mastery level (e.g., already at max mastery), show a message: "All studied cards are already at max mastery" or similar.
- If no questions were answered (player exited study early), show nothing below the summary or a brief message.

**Acceptance:** No upgraded cards → appropriate message shown, no empty card row. Max mastery → appropriate message shown.

---

### Step 4 — Update quizService API if Needed
**File:** `src/services/quizService.ts`

- If Step 1 requires a new method on `quizService`, implement it here: `getQuestionsForFactIds(factIds: string[]): QuizQuestion[]`.
- Ensure the method filters correctly and returns questions in SM-2 priority order (due soonest first, then by last-wrong).
- Add JSDoc comment documenting the method.

**Acceptance:** `npm run typecheck` passes. Method returns only questions for requested fact IDs.

---

## Files Affected

- `src/ui/components/RestRoomOverlay.svelte` — study question source, post-study card display
- `src/services/quizService.ts` — deck-filtered question fetch method

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Functional: Study questions all come from deck facts (verify by checking question topics match deck)
- [ ] Visual: Post-study screen shows upgraded card row with upgrade icons
- [ ] Visual: Cards rendered identically to combat hand cards
- [ ] Functional: Edge case — no upgrades → message shown, no empty row

---

## Visual Testing — MANDATORY

Navigate to a rest site and perform a study session:
```javascript
// Use scenario or game flow to reach rest room
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Take screenshot before and after completing study. Confirm:
1. Questions reference deck facts
2. Post-study screen shows upgraded cards with icons

Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
