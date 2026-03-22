# AR-221: Quiz Panel Redesign

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #23, #23b (auto-resume)
> **Priority:** P1 — Core gameplay readability
> **Complexity:** Medium (readability overhaul + auto-resume system + accessibility)
> **Dependencies:** AR-220 (charge value fix feeds into what the quiz panel displays)

---

## Overview

The quiz panel is currently difficult to read, with poor space utilization and small fonts. Redesign it for landscape at 1920x1080 with auto-scaling text, better layout, and an auto-resume system that automatically returns to combat after showing the answer.

---

## User's Exact Words

- **#23:** "When answering a card, see the image I sent, it's very difficult to read! We must make better use of our space! Bigger automatically adjusting font, easy to read etc."
- **#23b (auto-resume):** "When we select an answer, we should automatically resume playing, but base the length of waiting on the total length of the correct answer, then automatically resume. In accessibility we can change the waiting factor for things like this, and even add that we can turn off automatically resume after seeing answer."

---

## Sub-Steps

### 1. Quiz Panel — Better Space Utilization
- **What:** The quiz panel currently wastes significant screen space. In landscape 1920x1080, the panel should use the available width more aggressively.
- **Changes:**
  - Question text: larger base font, auto-scaling to fit available width
  - Answer buttons: wider (use more horizontal space), taller for touch targets
  - Effect preview (e.g., "GAIN 6 BLOCK"): larger, more prominent
  - Domain label: keep small but readable
  - Overall padding: reduce wasted space between elements
- **Acceptance:** Quiz panel fills space effectively. No cramped text. Easy to read at arm's length.

### 2. Auto-Scaling Font Size
- **What:** Question text and answer text must automatically adjust font size based on content length.
- **Logic:**
  - Short questions/answers (< 30 chars): large font
  - Medium (30-80 chars): medium font
  - Long (80+ chars): smaller but still readable font
- **Method:** Use CSS `clamp()` or JavaScript measurement to dynamically set font-size.
- **Must scale with `--text-scale` variable** per the dynamic scaling rule.
- **Acceptance:** All quiz text is readable regardless of content length. No overflow. No tiny text.

### 3. Auto-Resume After Answer
- **What:** After the player selects an answer (correct or wrong), the game should automatically resume combat after a calculated delay.
- **Delay calculation:** Base delay proportional to the total character length of the correct answer text:
  - Base: 1.5 seconds minimum
  - Per character: ~30ms per character of the correct answer
  - Maximum: 5 seconds
  - Formula: `delay = clamp(1500 + correctAnswer.length * 30, 1500, 5000)`
- **Wrong answer:** Show correct answer highlighted, then auto-resume after the calculated delay.
- **Correct answer:** Brief celebration (existing), then auto-resume after a shorter delay (e.g., 1.0s).
- **Acceptance:** Game auto-resumes after answer. No manual dismissal needed. Timing feels natural.

### 4. Accessibility Settings for Auto-Resume
- **What:** Add two new settings in the Accessibility settings panel:
  1. **Answer Display Speed** (multiplier): Slider from 0.5x to 3.0x (default 1.0x). Multiplies the auto-resume delay.
     - 0.5x = fast readers (half the delay)
     - 1.0x = default
     - 3.0x = slow readers (triple the delay)
  2. **Auto-Resume After Answer** (toggle): On by default. When OFF, player must manually tap/click to dismiss the answer and resume combat.
- **Acceptance:** Both settings persist. Speed multiplier correctly affects timing. Toggle disables auto-resume entirely.

---

## Files Affected

- `src/ui/combat/QuizPanel.svelte` — layout, font sizing, auto-resume logic
- `src/ui/combat/QuizAnswer.svelte` or equivalent — answer button styling
- `src/ui/screens/SettingsScreen.svelte` — accessibility settings additions
- `src/services/settings.ts` — new settings: `answerDisplaySpeed`, `autoResumeAfterAnswer`
- `src/data/balance.ts` — auto-resume timing constants

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Quiz text readable at 1920x1080 for short, medium, and long questions
- [ ] Auto-scaling font works (no overflow, no tiny text)
- [ ] Auto-resume triggers correctly after answer selection
- [ ] Timing scales with answer length
- [ ] Accessibility speed multiplier works (0.5x, 1.0x, 3.0x tested)
- [ ] Auto-resume toggle in settings correctly enables/disables
- [ ] Settings persist across sessions
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: add auto-resume system, update quiz panel description
