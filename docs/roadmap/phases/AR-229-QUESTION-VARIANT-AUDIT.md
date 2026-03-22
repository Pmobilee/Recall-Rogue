# AR-228: Question Variant Audit — Variants Not Appearing

> **Source:** Playtest Feedback 2026-03-22 (additional issue reported during session)
> **Priority:** P1 — Core quiz system integrity
> **Complexity:** Medium (investigation + fix)
> **Dependencies:** None

---

## Overview

During playtesting, the user observed that quiz questions for the same fact always appeared in the same format — question variants (Reverse, Synonym Pick, Definition Match) did not seem to trigger. All questions for a given fact appeared identical across multiple encounters. This needs investigation: either variants are not being selected, the tier thresholds are never met, or the variant selection code has a bug.

Per `docs/GAME_DESIGN.md` §5 Vocabulary Question Variants, the system should work as:

| Card Tier | Available Variants |
|-----------|-------------------|
| Tier 1 (Learning) | Forward only |
| Tier 2a (Active) | Forward (60%), Reverse (40%) |
| Tier 2b (Proficient) | Forward (30%), Reverse (30%), Synonym Pick (20%), Definition Match (20%) |
| Tier 3 (Mastered) | Free recall (no MC) |

If the user is only seeing Forward variants, the likely causes are:
1. All facts are Tier 1 (never reaching Tier 2a threshold) — most common in early playtesting
2. Variant selection code exists but is never called
3. Variant selection code has a bug (always returns Forward)
4. Non-vocabulary facts don't have variants at all (expected — but user may not realize)

---

## User's Exact Words

> "Also, add an AR to check why question variants don't seem to popup, maybe I didn't check enough, but all questions for same fact seemed the same"

---

## Sub-Steps

### 1. Audit Variant Selection Code Path

- **Investigate:** Find the code that selects question variants. Check:
  - `src/services/quizService.ts` — quiz question generation
  - `src/services/tierDerivation.ts` — card tier calculation (Tier 1/2a/2b/3)
  - Any variant selection logic that maps tier → variant type
- **Verify:** Is the variant selection code actually called during combat quiz generation? Add temporary logging to confirm.
- **Check:** What tier are the player's facts during a typical early run? If all facts are Tier 1, Forward-only is correct behavior. Log the tier distribution.
- **Acceptance:** Clear understanding of whether variants are working, broken, or correctly not triggering due to tier levels.

### 2. Verify Variant Data Exists for Test Facts

- **Check:** Do the vocabulary facts in the player's pool have the required data fields for variant types?
  - Reverse variants need L2 word extractable from the question
  - Synonym Pick needs WordNet synset data (`synonymMap.json`)
  - Definition Match needs `explanation` field on the fact (>= 10 chars)
- **If data is missing:** Document which variant types lack supporting data and for which languages/domains.
- **Acceptance:** Inventory of which variants are data-ready vs. data-blocked.

### 3. Fix Any Bugs Found

- **If variant selection is never called:** Wire it into the quiz generation path.
- **If variant selection always returns Forward:** Fix the selection logic.
- **If tiers never reach 2a:** This is expected behavior, not a bug. Add a note to the user about tier progression requirements.
- **If data is missing:** Flag for content pipeline work (separate AR).
- **Acceptance:** Variants trigger correctly when conditions are met (Tier 2a+ for vocab facts with supporting data).

### 4. Add Variant Logging for Debugging

- **What:** Add a console log (guarded by dev mode) that shows which variant was selected and why:
  ```
  [QuizVariant] fact=<id> tier=2a selected=reverse reason="40% random roll"
  ```
- **Purpose:** Makes future debugging trivial — the user can see in console which variants are firing.
- **Acceptance:** Dev-mode logging shows variant selection for every quiz question.

---

## Files Affected

- `src/services/quizService.ts` — quiz question generation, variant selection
- `src/services/tierDerivation.ts` — tier calculation
- Variant selection logic files (discover during audit — may be in quizService or a separate utility)
- `docs/GAME_DESIGN.md` — update if variant behavior differs from documented spec

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Variant selection code path traced and documented
- [ ] At least one non-Forward variant confirmed to trigger (at Tier 2a+ with vocab facts)
- [ ] Dev-mode logging shows variant selection for quiz questions
- [ ] Root cause documented: bug fix applied OR "working as designed" explanation provided
- [ ] `docs/GAME_DESIGN.md` updated if any variant behavior differs from spec
