# Phase 2.1: Real Facts Content

**Status**: COMPLETE
**Goal**: Generate 100+ high-quality, fascinating facts across all categories

## Current State
- **122 facts** in `src/data/seed/facts-general.json` across 6 categories
  - Natural Sciences: 20 facts
  - Life Sciences: 21 facts
  - History: 21 facts
  - Geography: 20 facts
  - Technology: 20 facts
  - Culture: 20 facts
- **400 Japanese N3 vocabulary entries** in `src/data/seed/vocab-n3.json`
- **Total: 522 facts** in the database (122 general facts + 400 vocab)
- All facts have 24-25 distractors
- `wowFactor` and `sourceName` populated for all facts
- `gaiaComment` populated for all 122 general facts
- Fact interface supports all needed fields (`wowFactor`, `explanation`, `gaiaComment`, `sourceName`)
- Quiz system works with any Fact objects
- SM-2 spaced repetition fully functional

## Target Categories (from types.ts)
1. **Language** — Already has 500 vocab entries
2. **Natural Sciences** — Physics, chemistry, astronomy, geology
3. **Life Sciences** — Biology, marine life, ecology, anatomy
4. **History** — Ancient, medieval, modern, archaeology
5. **Geography** — Countries, landmarks, climate, oceans
6. **Technology** — Computing, engineering, inventions, space tech
7. **Culture** — Art, music, mythology, traditions

## Fact Quality Standards
- Must be genuinely fascinating ("Octopuses have three hearts" not "Cu is copper")
- `statement`: Concise, Anki-optimized (quiz-friendly)
- `wowFactor`: Mind-blowing reframing for artifact reveal
- `explanation`: 2-3 sentences of context
- `distractors`: 25 plausible wrong answers per fact
- `sourceName`: Attribution to credible source

## Steps
1. [x] Existing vocab data serves as template format
2. [x] Generate facts via AI agents (no script needed — generated directly)
3. [x] Generate 20+ facts per non-Language category → generated 20 each for Geography, Technology, Culture; 21 each for Life Sciences and History (122 total)
4. [x] Store in `src/data/seed/facts-general.json` — done
5. [x] Validate all facts have required fields — all validated
6. [x] Integrate into BootScene loading alongside vocab data — done (build-facts-db.mjs processes all seed JSONs)

## Verification
- `npm run typecheck` passes
- Facts load in game and appear in quizzes
- All 7 categories represented
