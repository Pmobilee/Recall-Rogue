# AR-221: Quiz Panel Redesign

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #23, #23b (auto-resume)
> **Priority:** P1 — Core gameplay readability
> **Complexity:** Medium (readability overhaul + auto-resume system + accessibility)
> **Dependencies:** AR-220 sub-step 6 (charge value fix) — must land first so quiz displays correct effect values

---

## Overview

The quiz panel is currently difficult to read, with poor space utilization and small fixed fonts. Redesign it for landscape at 1920x1080 with auto-scaling text, better layout, and an auto-resume system that automatically returns to combat after showing the answer.

There are TWO separate quiz UI components that must both receive these changes:
- `src/ui/components/CardExpanded.svelte` — **combat quiz UI**, shown during Charge Play in landscape. This is what the user's screenshot shows (domain header, effect value, question text, answer buttons, timer bar).
- `src/ui/components/QuizOverlay.svelte` — **non-combat quiz UI**, shown for Knowledge Gates, artifact analysis, and study. Separate component; must receive the same changes for consistency.

There is NO `QuizPanel.svelte` or `QuizAnswer.svelte`. Answer buttons are inlined in both components.

---

## User's Exact Words

- **#23:** "When answering a card, see the image I sent, it's very difficult to read! We must make better use of our space! Bigger automatically adjusting font, easy to read etc."
- **#23b (auto-resume):** "When we select an answer, we should automatically resume playing, but base the length of waiting on the total length of the correct answer, then automatically resume. In accessibility we can change the waiting factor for things like this, and even add that we can turn off automatically resume after seeing answer."

---

## Sub-Steps

### 1. Quiz Panel — Better Space Utilization

- **Target components:** `src/ui/components/CardExpanded.svelte` AND `src/ui/components/QuizOverlay.svelte`
- **What:** Both quiz UIs currently waste significant screen space. In landscape 1920x1080, the panel should use the available width more aggressively.
- **Changes:**
  - Question text: larger base font, auto-scaling to fit available width (see sub-step 2)
  - Answer buttons: wider (use more horizontal space), taller for touch targets
  - Effect preview (e.g., "GAIN 6 BLOCK"): larger, more prominent — note this value depends on AR-220 sub-step 6 landing first
  - Domain label: keep small but readable
  - Overall padding: reduce wasted space between elements
  - All sizing values MUST use `calc(Npx * var(--layout-scale, 1))` — ZERO hardcoded px values for layout/spacing/fonts
- **Acceptance:** Quiz panel fills space effectively. No cramped text. Easy to read at arm's length at 1920x1080.

### 2. Auto-Scaling Font Size

- **Target components:** `src/ui/components/CardExpanded.svelte` AND `src/ui/components/QuizOverlay.svelte`
- **What:** Question text and answer button text must automatically adjust font size based on content length. Currently both components have NO dynamic font sizing — all values are fixed CSS.
- **Logic:**
  - Short questions/answers (< 30 chars): large font
  - Medium (30–80 chars): medium font
  - Long (80+ chars): smaller but still readable font
- **Method:** Use a reactive Svelte derived value or `$effect` that measures content length and sets a CSS custom property, or use CSS `clamp()` combined with character-count class bindings. Worker should choose the approach that integrates cleanly with each component's existing reactivity pattern.
- **All font values MUST use `calc(Npx * var(--text-scale, 1))`** — never hardcode px for font sizes.
- **Acceptance:** All quiz text is readable regardless of content length. No overflow. No tiny text. Both CardExpanded and QuizOverlay behave consistently.

### 3. Auto-Resume After Answer

- **Target components:** `src/ui/components/CardExpanded.svelte` AND `src/ui/components/QuizOverlay.svelte`
- **What:** After the player selects an answer (correct or wrong), the game should automatically resume after a calculated delay.
- **Current behavior:**
  - Correct answers: auto-dismiss after 1600ms via `feedbackTimeoutId`
  - Wrong answers: require a manual "Got it" button tap (`waitingForGotIt` state, line ~437 of CardExpanded)
  - The auto-resume change primarily targets the wrong-answer flow — removing the mandatory "Got it" tap
- **Delay calculation:**
  - Correct answer: fixed `1000ms` (brief, celebratory)
  - Wrong answer: `clamp(1500 + correctAnswer.length * 30, 1500, 5000)ms`
    - Short answer (3 chars): `1500 + 90 = 1590ms` (~1.6s)
    - Long answer (80 chars): `1500 + 2400 = 3900ms` (~3.9s)
- **"Got it" button:** When auto-resume is enabled, rename "Got it" to "Continue" and keep it visible as an early-dismiss option. Do NOT remove the button entirely.
- **CRITICAL — do NOT trigger auto-resume on timer expiry.** The quiz timer is for speed bonus only, not a hard deadline. Auto-resume fires only after the player selects an answer. Timer expiry must never dismiss the quiz or auto-play.
- **When `autoResumeAfterAnswer` is OFF:** The "Continue" button remains, auto-resume timer does not start. Player must tap to dismiss manually (original behavior).
- **Timing must apply the `answerDisplaySpeed` multiplier** from settings (sub-step 4). Formula: `finalDelay = baseDelay * answerDisplaySpeed`.
- **Acceptance:** Wrong answers no longer require a mandatory tap when auto-resume is on. Timing scales with answer length and speed multiplier. "Continue" button allows early dismiss. Timer expiry does not trigger auto-resume. Both components behave consistently.

### 4. Accessibility Settings for Auto-Resume

- **Target files:** `src/ui/stores/settings.ts` (settings stores), `src/ui/components/SettingsPanel.svelte` (settings UI)
- **NOT** `src/services/settings.ts` or `src/ui/screens/SettingsScreen.svelte` — those are different files.
- **What:** Add two new settings in the Accessibility section of `SettingsPanel.svelte`:
  1. **Answer Display Speed** (multiplier slider): 0.5x to 3.0x in 0.1x steps (25 positions), default 1.0x.
     - 0.5x = fast readers (half the delay)
     - 1.0x = default
     - 3.0x = slow readers (triple the delay)
  2. **Auto-Resume After Answer** (toggle): On by default. When OFF, player must manually tap "Continue" to dismiss.
- **Implementation notes:**
  - Follow the `singletonWritable + localStorage` pattern already used in `src/ui/stores/settings.ts` for `highContrastQuiz`, `reducedMotion`, etc.
  - Storage keys: `'setting_answerDisplaySpeed'` and `'setting_autoResumeAfterAnswer'`
  - Check `src/services/accessibilityManager.ts` for any overlap before adding new logic — do not duplicate.
  - The Accessibility section in `SettingsPanel.svelte` already has `highContrastMode`, `isSlowReader`, `reduceMotionMode`, `textSize` — add the new settings adjacent to `isSlowReader` for logical grouping.
- **Acceptance:** Both settings persist across sessions via localStorage. Speed multiplier correctly scales timing at 0.5x, 1.0x, and 3.0x. Toggle fully disables auto-resume. UI matches the style of existing accessibility toggles/sliders.

---

## Files Affected

- `src/ui/components/CardExpanded.svelte` — layout, font sizing, auto-resume logic (primary combat quiz UI)
- `src/ui/components/QuizOverlay.svelte` — same changes for non-combat quiz consistency
- `src/ui/components/SettingsPanel.svelte` — accessibility settings UI additions
- `src/ui/stores/settings.ts` — new stores: `answerDisplaySpeed`, `autoResumeAfterAnswer`
- `src/data/balance.ts` — auto-resume timing constants (`CORRECT_ANSWER_RESUME_DELAY`, `WRONG_ANSWER_RESUME_DELAY_BASE`, `WRONG_ANSWER_RESUME_DELAY_PER_CHAR`, `WRONG_ANSWER_RESUME_DELAY_MAX`)
- `docs/GAME_DESIGN.md` — update quiz panel description, add auto-resume system documentation

---

## Worker Notes

- **TWO components must be updated:** `CardExpanded.svelte` (combat) and `QuizOverlay.svelte` (non-combat). Do not touch only one and call it done.
- **No QuizPanel.svelte or QuizAnswer.svelte exist.** Answer buttons are inlined in both components.
- **Auto-resume MUST NOT trigger on timer expiry** — only after the player selects an answer. This is a hard rule.
- **"Got it" becomes "Continue"** when auto-resume is enabled — do not remove the early-dismiss button.
- **AR-220 dependency:** Sub-step 6 of AR-220 must land before this AR so the effect value displayed in the quiz (e.g., "GAIN 6 BLOCK") is correct. Coordinate with whoever runs AR-220.
- **Test with extremes:** Short answer (3 chars → ~1.6s wrong delay) and long answer (80 chars → ~3.9s wrong delay). Both should feel natural, not rushed or slow.
- **Dynamic scaling is mandatory.** Every px value for layout/spacing must use `calc(Npx * var(--layout-scale, 1))`. Every font size must use `calc(Npx * var(--text-scale, 1))`. Zero exceptions.
- After implementation, run `npm run typecheck` and `npm run build`. Then verify visually with Playwright: use `browser_evaluate(() => window.__terraScreenshotFile())` to save screenshot, then `Read()` to view (NEVER `mcp__playwright__browser_take_screenshot` — it times out). Check both CardExpanded (use `__terraScenario.load('combat-basic')`) and QuizOverlay if a scenario exists. The orchestrator will inspect too.
- Update `docs/GAME_DESIGN.md` to document the auto-resume system and updated quiz panel layout in the same task — not as a follow-up.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] CardExpanded quiz text readable at 1920x1080 for short, medium, and long questions
- [ ] QuizOverlay quiz text readable at 1920x1080 for short, medium, and long questions
- [ ] Auto-scaling font works in both components (no overflow, no tiny text)
- [ ] Wrong-answer auto-resume triggers after calculated delay (no manual "Got it" tap required)
- [ ] Correct-answer auto-resume triggers after 1000ms
- [ ] Timing scales correctly with answer length (test 3-char and 80-char answers)
- [ ] Timer expiry does NOT trigger auto-resume (confirmed via test)
- [ ] "Continue" button visible during feedback for early dismiss
- [ ] `answerDisplaySpeed` multiplier works at 0.5x, 1.0x, and 3.0x
- [ ] `autoResumeAfterAnswer` toggle OFF restores manual-dismiss behavior ("Continue" button required)
- [ ] Both settings persist across browser sessions (localStorage confirmed)
- [ ] Settings UI matches existing accessibility section style in SettingsPanel.svelte
- [ ] `docs/GAME_DESIGN.md` updated with auto-resume system and quiz panel changes

---

## Visual Testing — MANDATORY

**After ALL sub-steps are implemented, a Sonnet visual-testing worker MUST inspect the result before the AR is considered complete.**

### Procedure

1. Ensure the dev server is running (`npm run dev`)
2. Navigate with Playwright MCP: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Load the relevant scenario: `browser_evaluate(() => window.__terraScenario.load('combat-basic'))` (or the appropriate scenario for this AR)
4. Take screenshot: `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`
5. Read the screenshot: `Read('/tmp/terra-screenshot.jpg')` to visually inspect
6. Take DOM snapshot: `mcp__playwright__browser_snapshot` for structural verification
7. Check console: `mcp__playwright__browser_console_messages` for JS errors
8. **If ANY visual issue is found: fix it before reporting done.** Do not tell the user "it should work" — CONFIRM it works.

### What to Verify (per AR)

The visual-testing worker must check every sub-step's acceptance criteria against the actual rendered output. Specific checks:

- Layout positions match the AR's layout diagram (if any)
- No element overlap or clipping
- Text is readable at 1920x1080 landscape
- Colors match the spec (HP bar colors, chain colors, etc.)
- No hardcoded-px visual artifacts (elements too small or too large)
- No console errors or warnings
- Dynamic scaling works (test at 1920x1080 AND 1280x720 if the AR touches layout)

### Resolution

- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's RAF blocks it permanently
- **NEVER** use `page.screenshot()` via `browser_run_code` — same RAF blocking issue
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')`
- Use Sonnet workers (`model: "sonnet"`) for visual inspection — equally capable as Opus for screenshot analysis
