# AR-50 — Domain Misclassification Fix

## Overview
**Goal:** Fix cross-domain contamination where facts end up in the wrong domain (e.g., beef pho broth in animals_wildlife). Clean entity curation files, reclassify existing seed facts, and add validation to prevent future contamination.

**Root cause:** Domain is assigned by entity file location (`data/curated/{domain}/entities.json`). ALL facts generated from entities in that file inherit the domain, even if the entity doesn't belong there (e.g., "maize" was in the animals_wildlife entity file with subcategory "mammals"). ~30+ entities are misclassified across 10 domain files.

**Dependencies:** None.
**Estimated complexity:** Medium (entity cleanup is manual/LLM-assisted, seed reclassification needs a Haiku sub-agent pass).

## Sub-steps

### 1. Audit entity files for misclassified entries
- For each of the 10 `data/curated/*/entities.json` files, run a Haiku sub-agent to review every entity label+description and flag any that don't belong in that domain
- Produce a report: `{ entity, currentDomain, suggestedDomain, reason }`
- Focus areas identified:
  - animals_wildlife: food items (maize), plants
  - food_cuisine: pure animal facts (fish biology, not cuisine)
  - art_architecture: non-art historical figures
  - human_body_health: animal/food items
  - mythology_folklore: animals that are real, not mythological

**Files:** `data/curated/*/entities.json` (10 files)
**Acceptance:** Audit report lists all misclassified entities with suggested corrections.

### 2. Move misclassified entities to correct domain files
- Based on audit results, move entities from wrong domain file to correct one
- Update subcategory if needed
- Remove entities that don't fit any domain cleanly

**Files:** `data/curated/*/entities.json`
**Acceptance:** Each entity file contains only entities that genuinely belong in that domain.

### 3. Reclassify existing seed facts
- The ~30+ bad entities have already generated facts in the wrong seed files
- Run a Haiku sub-agent classifier over ALL seed facts to detect domain mismatches:
  - Read each fact's quizQuestion + correctAnswer + statement
  - Compare against the assigned category[0]
  - Flag facts where content clearly doesn't match domain
- For flagged facts: move them to the correct seed file with corrected category
- This is the bulk of the work but is automatable via sub-agents

**Files:** `src/data/seed/knowledge-*.json` (10 files)
**Acceptance:** No facts about food in animals_wildlife, no animal biology in food_cuisine, etc.

### 4. Add domain validation to content pipeline
- In `scripts/contentPipelineUtils.mjs`, add a `validateFactDomain()` function
- Checks that key terms in quizQuestion/statement are consistent with the assigned domain
- Uses a keyword allowlist/denylist per domain (e.g., animals_wildlife should NOT have "recipe", "cuisine", "broth", "dish")
- Runs automatically during fact normalization and logs warnings for mismatches
- Does NOT auto-fix (just warns) — human review needed

**Files:** `scripts/contentPipelineUtils.mjs`
**Acceptance:** Running the pipeline with a food fact tagged as animals_wildlife produces a console warning.

### 5. Add misclassification detection test
- Add a vitest that spot-checks seed facts for obvious domain violations
- Uses keyword denylist approach: certain words should NEVER appear in certain domains
- E.g., "recipe" in animals_wildlife, "mitosis" in food_cuisine
- Not exhaustive but catches the most egregious cases

**Files:** `tests/unit/fact-domain-quality.test.ts` (new)
**Acceptance:** Test catches known bad patterns. Passes after cleanup is done.

### 6. Rebuild facts.db
- After seed files are corrected, rebuild the SQLite database
- Run `npm run build:db` or equivalent
- Verify the fix by querying for the specific pho/broth fact

**Files:** `public/facts.db`
**Acceptance:** Database reflects corrected categories. No food facts in animals domain.

## Files Affected
| File | Changes |
|------|---------|
| `data/curated/*/entities.json` (10 files) | Entity cleanup — move/remove misclassified |
| `src/data/seed/knowledge-*.json` (10 files) | Move misclassified facts to correct files |
| `scripts/contentPipelineUtils.mjs` | Add validateFactDomain() warning |
| `tests/unit/fact-domain-quality.test.ts` (new) | Domain validation test |
| `public/facts.db` | Rebuilt after corrections |

## Verification Gate
- [ ] `npm run typecheck` — 0 errors
- [ ] `npx vitest run` — all tests pass including new domain quality test
- [ ] Spot check: no food facts in animals_wildlife seed file
- [ ] Spot check: no animal biology in food_cuisine seed file
- [ ] Content pipeline warns on misclassified facts
- [ ] facts.db rebuilt with corrected categories
- [ ] Playtest: start animals_wildlife run — no food questions appear
