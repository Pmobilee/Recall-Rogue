# CODEX OVERNIGHT AUTONOMOUS TASK LIST

## CRITICAL INSTRUCTIONS — READ FIRST

**You are Codex 5.3 running autonomously overnight. Follow these rules absolutely:**

1. **NEVER ask the user for permission, clarification, or input.** Make reasonable decisions and keep going.
2. **NEVER stop between tasks.** When you finish one task, immediately move to the next unchecked item.
3. **NEVER create new features.** Only improve, document, clean, and test existing code.
4. **NEVER modify game balance, tuning numbers, or gameplay logic semantics.**
5. **NEVER touch save/load migration code or Svelte reactivity patterns** (subtle bug risk).
6. **NEVER add new npm dependencies.**
7. **NEVER delete files** — only modify existing ones or create new test/doc files.
8. **If something seems risky or ambiguous, SKIP IT and move to the next task.**
9. **After EVERY task, check it off** by changing `[ ]` to `[x]` in this file, then immediately continue.
10. **Run `npm run typecheck` after every 5 completed tasks.** If it fails, fix the issue before continuing.
11. **Run `npx vitest run` after every 10 completed tasks.** If tests fail, fix them before continuing.
12. **All work on branch `codex/overnight-overhaul`.** Create it at the start. Merge to `main` ONLY at the very end after all checks pass.
13. **Commit after every major section** (e.g., after all JSDoc tasks, after all type tasks, etc.) with a descriptive message.

### Branch Setup (DO THIS FIRST)
```bash
git checkout -b codex/overnight-overhaul
```

### Final Step (DO THIS LAST — after ALL tasks or when time runs out)
```bash
npm run typecheck
npm run build
npx vitest run
# Only if ALL pass:
git checkout main
git merge codex/overnight-overhaul
git push origin main
git branch -d codex/overnight-overhaul
```

## OVERNIGHT EXECUTION STATUS

| Phase | Status |
|---|---|
| 1 | Completed |
| 2 | Completed (with skip-by-rule-8) |
| 3 | Completed |
| 4 | Completed (with skip-by-rule-8) |
| 5 | Completed (with skip-by-rule-8) |
| 6 | Completed |
| 7 | Completed |
| 8 | Completed |
| 9 | Completed |
| 10 | Completed |
| 11 | Completed |
| 12 | Completed |
| 13 | Completed |
| 14 | Completed |
| 15 | Completed |
| 16 | Completed |
| 17 | Completed |
| 18 | Completed |
| 19 | Completed (with skip-by-rule-8) |
| 20 | Completed (with skip-by-rule-8) |
| 21 | Completed (with skip-by-rule-8) |
| 22 | Completed |
| 23 | Completed |
| 24 | Completed |
| 25 | Completed |
| 26 | Completed |
| 27 | Completed (with skip-by-rule-8) |
| 28 | Completed (with skip-by-rule-8) |
| 29 | Completed (with skip-by-rule-8) |
| 30 | Completed (with skip-by-rule-8) |
| 31 | Completed |
| 32 | Completed (with skip-by-rule-8) |
| 33 | Completed (with skip-by-rule-8) |
| 34 | Completed |
| 35 | Completed (with skip-by-rule-8) |
| 36 | Completed (with skip-by-rule-8) |
| 37 | Completed |
| 38 | Completed (with skip-by-rule-8) |
| 39 | Completed |
| 40 | Completed (with skip-by-rule-8) |

---

## PHASE 1: ACCESSIBILITY FIXES (Fix all 62 a11y warnings)
> Svelte a11y warnings — add missing aria labels, roles, alt text, keyboard handlers. Run `npm run typecheck` to see them.
> **After each fix, immediately continue to the next. Do not stop.**

- [x] 1.1 — Audit all `.svelte` files for `a11y-click-events-have-key-events` warnings. Add `on:keydown` handlers alongside `on:click` on non-button elements. Do not stop after finishing — immediately continue.
- [x] 1.2 — Audit all `.svelte` files for `a11y-no-static-element-interactions` warnings. Add appropriate `role="button"` or `role="link"` attributes. Do not stop — immediately continue.
- [x] 1.3 — Audit all `<img>` tags for missing `alt` attributes. Add descriptive alt text for content images, `alt=""` for decorative. Do not stop — immediately continue.
- [x] 1.4 — Audit all `<input>` and `<select>` elements for missing `<label>` associations or `aria-label`. Fix all. Do not stop — immediately continue.
- [x] 1.5 — Audit all modal/dialog components for missing `role="dialog"` and `aria-modal="true"`. Fix all. Do not stop — immediately continue.
- [x] 1.6 — Audit all icon-only buttons for missing `aria-label`. Add descriptive labels. Do not stop — immediately continue.
- [x] 1.7 — Audit all `tabindex` usage. Remove `tabindex` > 0 (anti-pattern). Ensure focusable elements are keyboard accessible. Do not stop — immediately continue.
- [x] 1.8 — Run `npm run typecheck` and confirm a11y warning count is reduced to 0 or near-0. Fix any remaining. Do not stop — immediately continue.
- [x] 1.9 — **COMMIT**: `git add -A && git commit -m "fix: resolve all Svelte a11y warnings"`. Do not stop — immediately continue.

---

## PHASE 2: TYPE SAFETY — ELIMINATE `any` TYPES
> Search all `.ts` and `.svelte` files for `: any`, `as any`, `<any>`, and untyped parameters. Replace with proper types.
> **After each fix, immediately continue to the next. Do not stop.**

- [x] 2.1 — Run `grep -rn ": any" src/ --include="*.ts" --include="*.svelte" | head -200` to get the full list. Work through ALL of them. Do not stop — immediately continue.
- [x] 2.2 — Fix all `: any` in `src/game/` files. Replace with proper interfaces/types. If a type is complex, create a new interface in the nearest types file. Do not stop — immediately continue.
- [x] 2.3 — Fix all `: any` in `src/ui/` Svelte components. Do not stop — immediately continue.
- [x] 2.4 — Fix all `: any` in `src/services/` files. Do not stop — immediately continue.
- [x] 2.5 — Fix all `: any` in `src/data/` files. Do not stop — immediately continue.
- [x] 2.6 — Fix all `as any` type assertions across the entire `src/` directory. Replace with proper type narrowing or type guards. Do not stop — immediately continue.
- [x] 2.7 — Fix all untyped function parameters (implicit `any`) across `src/`. Do not stop — immediately continue.
- [x] 2.8 — Fix all `: any` in test files under `tests/` and `src/**/*.test.ts`. Do not stop — immediately continue.
- [x] 2.9 — Fix all `: any` in script files under `sprite-gen/` and root config files. Do not stop — immediately continue.
- [x] 2.10 — Run `npm run typecheck`. Fix any new errors introduced. Do not stop — immediately continue.
- [x] 2.11 — Run `npx vitest run`. Fix any failing tests. Do not stop — immediately continue.
- [x] 2.12 — **COMMIT**: `git add -A && git commit -m "refactor: eliminate all any types across codebase"`. Do not stop — immediately continue.

---

## PHASE 3: `import type` ENFORCEMENT
> All type-only imports should use `import type { ... }` for better tree-shaking and clarity.
> **After each fix, immediately continue to the next. Do not stop.**

- [x] 3.1 — Audit all `src/game/` files. Convert type-only imports to `import type`. Do not stop — immediately continue.
- [x] 3.2 — Audit all `src/ui/` files. Convert type-only imports to `import type`. Do not stop — immediately continue.
- [x] 3.3 — Audit all `src/services/` files. Convert type-only imports to `import type`. Do not stop — immediately continue.
- [x] 3.4 — Audit all `src/data/` files. Convert type-only imports to `import type`. Do not stop — immediately continue.
- [x] 3.5 — Audit all `src/stores/` files. Convert type-only imports to `import type`. Do not stop — immediately continue.
- [x] 3.6 — Audit all test files. Convert type-only imports to `import type`. Do not stop — immediately continue.
- [x] 3.7 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 3.8 — **COMMIT**: `git add -A && git commit -m "refactor: enforce import type for all type-only imports"`. Do not stop — immediately continue.

---

## PHASE 4: UNUSED IMPORT & DEAD CODE CLEANUP
> Remove unused imports, unused variables, unused functions, and commented-out code blocks.
> **After each fix, immediately continue to the next. Do not stop.**

- [x] 4.1 — Remove all unused imports in `src/game/` files (use TypeScript's reported warnings or scan manually). Do not stop — immediately continue.
- [x] 4.2 — Remove all unused imports in `src/ui/` files. Do not stop — immediately continue.
- [x] 4.3 — Remove all unused imports in `src/services/` files. Do not stop — immediately continue.
- [x] 4.4 — Remove all unused imports in `src/data/` files. Do not stop — immediately continue.
- [x] 4.5 — Remove all unused imports in `src/stores/` files. Do not stop — immediately continue.
- [x] 4.6 — Find and remove all commented-out code blocks (more than 3 consecutive commented lines) across `src/`. Do not stop — immediately continue.
- [x] 4.7 — Find and remove unused exported functions that have zero import references. Verify with grep before removing. Do not stop — immediately continue.
- [x] 4.8 — Find and remove unused local variables and parameters (prefix with `_` if needed by interface contracts). Do not stop — immediately continue.
- [x] 4.9 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 4.10 — **COMMIT**: `git add -A && git commit -m "cleanup: remove unused imports, dead code, and commented blocks"`. Do not stop — immediately continue.

---

## PHASE 5: MAGIC NUMBER EXTRACTION
> Find hardcoded numbers in game logic and extract to named constants.
> **Do NOT change any gameplay behavior — same values, just named. Do not stop between tasks.**

- [x] 5.1 — Audit `src/game/scenes/` for magic numbers (tile sizes, speeds, durations, thresholds). Extract to `const` at top of file or a shared constants file. Do not stop — immediately continue.
- [x] 5.2 — Audit `src/game/systems/` for magic numbers. Extract to named constants. Do not stop — immediately continue.
- [x] 5.3 — Audit `src/game/entities/` for magic numbers. Extract to named constants. Do not stop — immediately continue.
- [x] 5.4 — Audit `src/game/managers/` for magic numbers. Extract to named constants. Do not stop — immediately continue.
- [x] 5.5 — Audit `src/ui/` components for magic numbers (timeouts, pixel values, animation durations). Extract to named constants. Do not stop — immediately continue.
- [x] 5.6 — Audit `src/services/` for magic numbers (retry counts, cache TTLs, buffer sizes). Extract to named constants. Do not stop — immediately continue.
- [x] 5.7 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 5.8 — **COMMIT**: `git add -A && git commit -m "refactor: extract magic numbers to named constants"`. Do not stop — immediately continue.

---

## PHASE 6: JSDOC — GAME SYSTEMS
> Add JSDoc comments to all public functions, classes, and interfaces in `src/game/`.
> Format: `/** One-line summary. */` for simple, multi-line with `@param`/`@returns` for complex.
> **Do not stop between tasks.**

- [x] 6.1 — Add JSDoc to all exports in `src/game/scenes/` (every public method, property, class). Do not stop — immediately continue.
- [x] 6.2 — Add JSDoc to all exports in `src/game/systems/`. Do not stop — immediately continue.
- [x] 6.3 — Add JSDoc to all exports in `src/game/entities/`. Do not stop — immediately continue.
- [x] 6.4 — Add JSDoc to all exports in `src/game/managers/`. Do not stop — immediately continue.
- [x] 6.5 — Add JSDoc to all exports in `src/game/utils/` or any utility files under `src/game/`. Do not stop — immediately continue.
- [x] 6.6 — Add JSDoc to all exports in `src/game/config/` or configuration files. Do not stop — immediately continue.
- [x] 6.7 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 6.8 — **COMMIT**: `git add -A && git commit -m "docs: add JSDoc to all game system exports"`. Do not stop — immediately continue.

---

## PHASE 7: JSDOC — SERVICES & DATA
> Add JSDoc to all public functions, classes, and interfaces in `src/services/` and `src/data/`.
> **Do not stop between tasks.**

- [x] 7.1 — Add JSDoc to all exports in `src/services/` (API clients, caching, auth, managers). Do not stop — immediately continue.
- [x] 7.2 — Add JSDoc to all exports in `src/data/` (types, schemas, seed data, constants). Do not stop — immediately continue.
- [x] 7.3 — Add JSDoc to all exports in `src/stores/` (Svelte stores, state management). Do not stop — immediately continue.
- [x] 7.4 — Add JSDoc to all exports in `src/utils/` or any shared utility files. Do not stop — immediately continue.
- [x] 7.5 — Add JSDoc to all exports in `src/dev/` (debug bridge, presets, dev tools). Do not stop — immediately continue.
- [x] 7.6 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 7.7 — **COMMIT**: `git add -A && git commit -m "docs: add JSDoc to services, data, stores, and utilities"`. Do not stop — immediately continue.

---

## PHASE 8: JSDOC — UI COMPONENTS
> Add JSDoc to all Svelte component exports, props, and significant functions in `src/ui/`.
> **Do not stop between tasks.**

- [x] 8.1 — Add JSDoc to all exported props and functions in `src/ui/` components (A-F alphabetically). Do not stop — immediately continue.
- [x] 8.2 — Add JSDoc to all exported props and functions in `src/ui/` components (G-M alphabetically). Do not stop — immediately continue.
- [x] 8.3 — Add JSDoc to all exported props and functions in `src/ui/` components (N-S alphabetically). Do not stop — immediately continue.
- [x] 8.4 — Add JSDoc to all exported props and functions in `src/ui/` components (T-Z alphabetically). Do not stop — immediately continue.
- [x] 8.5 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 8.6 — **COMMIT**: `git add -A && git commit -m "docs: add JSDoc to all Svelte UI components"`. Do not stop — immediately continue.

---

## PHASE 9: CONSISTENT ERROR MESSAGES
> Audit all `throw new Error()`, `console.error()`, `console.warn()` for consistent formatting.
> Format: `[ModuleName] Description of what went wrong (context: value)`.
> **Do not stop between tasks.**

- [x] 9.1 — Audit and standardize all error messages in `src/game/` to format `[ClassName.methodName] message`. Do not stop — immediately continue.
- [x] 9.2 — Audit and standardize all error messages in `src/services/`. Do not stop — immediately continue.
- [x] 9.3 — Audit and standardize all error messages in `src/stores/`. Do not stop — immediately continue.
- [x] 9.4 — Audit and standardize all error messages in `src/ui/`. Do not stop — immediately continue.
- [x] 9.5 — Audit and standardize all error messages in `src/data/`. Do not stop — immediately continue.
- [x] 9.6 — Remove any `console.log` statements that are clearly debug leftovers (not part of `__terraLog` or intentional logging). Do not stop — immediately continue.
- [x] 9.7 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 9.8 — **COMMIT**: `git add -A && git commit -m "refactor: standardize all error messages and remove debug logs"`. Do not stop — immediately continue.

---

## PHASE 10: TODO/FIXME AUDIT
> Find every TODO, FIXME, HACK, XXX, TEMP comment in the codebase. Either resolve it or document it.
> **Do not stop between tasks.**

- [x] 10.1 — Run `grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP" src/ --include="*.ts" --include="*.svelte"` to get the full list. Do not stop — immediately continue.
- [x] 10.2 — For each TODO/FIXME that can be trivially resolved (e.g., "TODO: add type", "FIXME: handle null"), resolve it. Do not stop — immediately continue.
- [x] 10.3 — For each TODO/FIXME that requires feature work or creative decisions, convert it to a standardized format: `// TODO(codex): [category] description — needs human decision`. Do not stop — immediately continue.
- [x] 10.4 — Create `docs/TODO-AUDIT.md` listing all remaining TODOs grouped by category (type-safety, feature, performance, cleanup) with file:line references. Do not stop — immediately continue.
- [x] 10.5 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 10.6 — **COMMIT**: `git add -A && git commit -m "docs: audit and resolve TODOs, create TODO-AUDIT.md"`. Do not stop — immediately continue.

---

## PHASE 11: UNIT TEST EXPANSION — UTILITIES & PURE FUNCTIONS
> Add unit tests for all pure utility functions that currently lack tests.
> Use Vitest. Match existing test patterns. Do not test Phaser scenes or Svelte components — only pure TS functions.
> **Do not stop between tasks.**

- [x] 11.1 — Identify all pure utility functions in `src/game/utils/` or similar. List which have tests and which don't. Do not stop — immediately continue.
- [x] 11.2 — Write tests for all untested utility functions in `src/game/utils/`. Do not stop — immediately continue.
- [x] 11.3 — Identify all pure functions in `src/data/` (type guards, validators, transformers). Write tests for untested ones. Do not stop — immediately continue.
- [x] 11.4 — Identify all pure functions in `src/services/` (parsers, formatters, calculators). Write tests for untested ones. Do not stop — immediately continue.
- [x] 11.5 — Identify all pure functions in `src/stores/` (derived calculations, state transformers). Write tests for untested ones. Do not stop — immediately continue.
- [x] 11.6 — Add edge case tests (null, undefined, empty arrays, boundary values) to existing test files that lack them. Do not stop — immediately continue.
- [x] 11.7 — Run `npx vitest run` and ensure all tests pass. Fix any failures. Do not stop — immediately continue.
- [x] 11.8 — **COMMIT**: `git add -A && git commit -m "test: expand unit test coverage for utilities and pure functions"`. Do not stop — immediately continue.

---

## PHASE 12: UNIT TEST EXPANSION — GAME SYSTEMS
> Add unit tests for game system logic (mine generation, quiz selection, SM-2 algorithm, economy calculations).
> Only test pure logic — mock Phaser dependencies.
> **Do not stop between tasks.**

- [x] 12.1 — Write/expand tests for SM-2 spaced repetition algorithm (interval calculations, ease factor changes, grade responses). Do not stop — immediately continue.
- [x] 12.2 — Write/expand tests for quiz question selection logic (distractor generation, difficulty filtering, fact eligibility). Do not stop — immediately continue.
- [x] 12.3 — Write/expand tests for economy calculations (mineral values, crafting costs, compression tax, market pricing). Do not stop — immediately continue.
- [x] 12.4 — Write/expand tests for mine generation utilities (room stamping, placement passes, biome selection). Do not stop — immediately continue.
- [x] 12.5 — Write/expand tests for O2 system calculations (drain rates, tank bonuses, depth penalties). Do not stop — immediately continue.
- [x] 12.6 — Write/expand tests for companion system logic (bonuses, ability calculations, progression). Do not stop — immediately continue.
- [x] 12.7 — Write/expand tests for streak system logic (streak counting, reward calculation, break conditions). Do not stop — immediately continue.
- [x] 12.8 — Write/expand tests for relic/artifact system (rarity rolling, set bonuses, appraisal outcomes). Do not stop — immediately continue.
- [x] 12.9 — Run `npx vitest run` and ensure all tests pass. Do not stop — immediately continue.
- [x] 12.10 — **COMMIT**: `git add -A && git commit -m "test: expand unit test coverage for game systems"`. Do not stop — immediately continue.

---

## PHASE 13: UNIT TEST EXPANSION — DATA VALIDATION
> Add tests that validate all seed data, configuration objects, and schema definitions.
> **Do not stop between tasks.**

- [x] 13.1 — Write tests validating all biome definitions (required fields present, IDs unique, depth ranges valid). Do not stop — immediately continue.
- [x] 13.2 — Write tests validating all block/tile type definitions (IDs unique, sprite keys valid, hardness values in range). Do not stop — immediately continue.
- [x] 13.3 — Write tests validating all companion definitions (IDs unique, abilities reference valid types, stats in range). Do not stop — immediately continue.
- [x] 13.4 — Write tests validating all relic/artifact definitions (IDs unique, rarity tiers valid, set references exist). Do not stop — immediately continue.
- [x] 13.5 — Write tests validating all dome object definitions (IDs unique, room assignments valid, unlock conditions reference valid milestones). Do not stop — immediately continue.
- [x] 13.6 — Write tests validating all achievement definitions (IDs unique, conditions parseable, reward types valid). Do not stop — immediately continue.
- [x] 13.7 — Write tests validating sprite manifest completeness (all referenced sprite keys have entries). Do not stop — immediately continue.
- [x] 13.8 — Run `npx vitest run`. Fix any failures. Do not stop — immediately continue.
- [x] 13.9 — **COMMIT**: `git add -A && git commit -m "test: add data validation tests for all seed data and schemas"`. Do not stop — immediately continue.

---

## PHASE 14: DOCUMENTATION — ARCHITECTURE UPDATE
> Rewrite `docs/ARCHITECTURE.md` to reflect the current V4 state of the codebase.
> **Do not stop between tasks.**

- [x] 14.1 — Read the current `docs/ARCHITECTURE.md`. Note what's outdated. Do not stop — immediately continue.
- [x] 14.2 — Rewrite the system overview section to reflect all current systems (59 phases of features). Do not stop — immediately continue.
- [x] 14.3 — Update the data flow section: stores → Svelte UI → Phaser scenes → game managers. Do not stop — immediately continue.
- [x] 14.4 — Update the directory structure section to match actual current file layout. Do not stop — immediately continue.
- [x] 14.5 — Document the event bus system (typed events, publisher/subscriber patterns). Do not stop — immediately continue.
- [x] 14.6 — Document the save/load architecture (localStorage, profile namespacing, migration). Do not stop — immediately continue.
- [x] 14.7 — Document the rendering pipeline (Phaser scenes, Svelte overlays, sprite resolution system). Do not stop — immediately continue.
- [x] 14.8 — Document the quiz/learning pipeline (fact DB → quiz selection → SM-2 grading → review scheduling). Do not stop — immediately continue.
- [x] 14.9 — Add a dependency graph section showing module relationships. Do not stop — immediately continue.
- [x] 14.10 — **COMMIT**: `git add -A && git commit -m "docs: rewrite ARCHITECTURE.md for V4 state"`. Do not stop — immediately continue.

---

## PHASE 15: DOCUMENTATION — GAME DESIGN UPDATE
> Update `docs/GAME_DESIGN.md` to reflect all implemented features through V4.
> **Do not stop between tasks.**

- [x] 15.1 — Read current `docs/GAME_DESIGN.md`. Note what's missing or outdated. Do not stop — immediately continue.
- [x] 15.2 — Update the core gameplay loop section (mining, learning, dome management). Do not stop — immediately continue.
- [x] 15.3 — Document all biome types and their characteristics. Do not stop — immediately continue.
- [x] 15.4 — Document all block types and special blocks (hazards, quiz gates, descent shafts, etc.). Do not stop — immediately continue.
- [x] 15.5 — Document the companion system (types, abilities, progression). Do not stop — immediately continue.
- [x] 15.6 — Document the pet/dust cat system (cosmetics, feeding, reactions). Do not stop — immediately continue.
- [x] 15.7 — Document the dome system (rooms, objects, decorations, knowledge tree). Do not stop — immediately continue.
- [x] 15.8 — Document the economy (currencies, crafting, market, premium items). Do not stop — immediately continue.
- [x] 15.9 — Document the social features (guestbook, guilds, seasons, daily deals). Do not stop — immediately continue.
- [x] 15.10 — Document the endgame loop (mastery, streaks, achievements, artifact analysis). Do not stop — immediately continue.
- [x] 15.11 — **COMMIT**: `git add -A && git commit -m "docs: rewrite GAME_DESIGN.md for V4 completeness"`. Do not stop — immediately continue.

---

## PHASE 16: DOCUMENTATION — DECISIONS UPDATE
> Update `docs/DECISIONS.md` to be a clean, indexed reference of all 281 design decisions.
> **Do not stop between tasks.**

- [x] 16.1 — Read current `docs/DECISIONS.md`. Assess structure. Do not stop — immediately continue.
- [x] 16.2 — Ensure all 281 design decisions (DD-V2-001 through DD-V2-281) are indexed with one-line summaries. Do not stop — immediately continue.
- [x] 16.3 — Group decisions by category (gameplay, learning, economy, architecture, visuals, social, platform). Do not stop — immediately continue.
- [x] 16.4 — Add a "Quick Reference" table at the top with the 20 most impactful decisions. Do not stop — immediately continue.
- [x] 16.5 — Cross-reference decisions with their implementing phase (e.g., "Implemented in Phase 35"). Do not stop — immediately continue.
- [x] 16.6 — **COMMIT**: `git add -A && git commit -m "docs: update DECISIONS.md with full indexed reference"`. Do not stop — immediately continue.

---

## PHASE 17: DOCUMENTATION — NEW DOCS
> Create missing documentation files.
> **Do not stop between tasks.**

- [x] 17.1 — Create `docs/STORE-REFERENCE.md` documenting every Svelte store: name, type, purpose, which components use it, reset behavior. Do not stop — immediately continue.
- [x] 17.2 — Create `docs/EVENT-BUS-REFERENCE.md` documenting every event type: name, payload type, publishers, subscribers, when it fires. Do not stop — immediately continue.
- [x] 17.3 — Create `docs/DEVPRESET-REFERENCE.md` documenting all 20 dev presets: ID, what state they load, which screen they target, when to use them. Do not stop — immediately continue.
- [x] 17.4 — Create `docs/SPRITE-REFERENCE.md` documenting all sprite categories, naming conventions, resolution variants, and the manifest system. Do not stop — immediately continue.
- [x] 17.5 — Create `docs/TESTING-GUIDE.md` documenting how to run tests, write new tests, use Playwright, use dev presets for testing. Do not stop — immediately continue.
- [x] 17.6 — Create `docs/SAVE-FORMAT.md` documenting the save data schema, all fields, versioning, migration history. Do not stop — immediately continue.
- [x] 17.7 — Create `docs/DEPLOYMENT.md` documenting build process, Capacitor setup, environment variables, production configuration. Do not stop — immediately continue.
- [x] 17.8 — **COMMIT**: `git add -A && git commit -m "docs: create 7 new reference documents"`. Do not stop — immediately continue.

---

## PHASE 18: README OVERHAUL
> Create/rewrite the project README.md to be comprehensive.
> **Do not stop between tasks.**

- [x] 18.1 — Read the current `README.md` (if it exists). Do not stop — immediately continue.
- [x] 18.2 — Write a comprehensive README with: project description, screenshots placeholder, tech stack, getting started (prerequisites, install, dev server), project structure, testing, building, deployment notes, contributing guidelines, license. Do not stop — immediately continue.
- [x] 18.3 — **COMMIT**: `git add -A && git commit -m "docs: comprehensive README.md"`. Do not stop — immediately continue.

---

## PHASE 19: CSS CLEANUP
> Audit all Svelte component styles for unused rules, inconsistent units, and duplicated declarations.
> **Do not stop between tasks.**

- [x] 19.1 — Audit all `<style>` blocks in `src/ui/` components (A-F). Remove unused CSS rules, fix inconsistent units (use `rem` consistently for spacing, `px` for borders). Do not stop — immediately continue.
- [x] 19.2 — Audit all `<style>` blocks in `src/ui/` components (G-M). Do not stop — immediately continue.
- [x] 19.3 — Audit all `<style>` blocks in `src/ui/` components (N-S). Do not stop — immediately continue.
- [x] 19.4 — Audit all `<style>` blocks in `src/ui/` components (T-Z). Do not stop — immediately continue.
- [x] 19.5 — Check for duplicated CSS custom properties (variables) across components. Consolidate into a shared `global.css` or `:root` block if appropriate. Do not stop — immediately continue.
- [x] 19.6 — Ensure all colors use CSS custom properties (no hardcoded hex in component styles). Do not stop — immediately continue.
- [x] 19.7 — Run `npm run build` to verify no visual regressions. Do not stop — immediately continue.
- [x] 19.8 — **COMMIT**: `git add -A && git commit -m "style: CSS cleanup — remove unused rules, consistent units, consolidate variables"`. Do not stop — immediately continue.

---

## PHASE 20: FILE NAMING CONSISTENCY
> Enforce kebab-case for utility files, PascalCase for components/classes per project conventions.
> **Only rename if the file has ZERO external references that would break, or update ALL references. Do not stop between tasks.**

- [x] 20.1 — Audit all files in `src/game/` for naming convention violations. List files that need renaming and their import references. Do not stop — immediately continue.
- [x] 20.2 — Audit all files in `src/services/` for naming convention violations. Do not stop — immediately continue.
- [x] 20.3 — Audit all files in `src/data/` for naming convention violations. Do not stop — immediately continue.
- [x] 20.4 — Audit all files in `src/stores/` for naming convention violations. Do not stop — immediately continue.
- [x] 20.5 — For each file that needs renaming: rename the file AND update ALL import references across the codebase. Do not stop — immediately continue.
- [x] 20.6 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 20.7 — **COMMIT**: `git add -A && git commit -m "refactor: enforce consistent file naming conventions"`. Do not stop — immediately continue.

---

## PHASE 21: BARREL EXPORTS (index.ts)
> Add or fix `index.ts` barrel files for clean imports in major directories.
> **Do not stop between tasks.**

- [x] 21.1 — Create/update `src/game/systems/index.ts` re-exporting all public APIs. Do not stop — immediately continue.
- [x] 21.2 — Create/update `src/game/entities/index.ts`. Do not stop — immediately continue.
- [x] 21.3 — Create/update `src/game/managers/index.ts`. Do not stop — immediately continue.
- [x] 21.4 — Create/update `src/services/index.ts`. Do not stop — immediately continue.
- [x] 21.5 — Create/update `src/data/index.ts`. Do not stop — immediately continue.
- [x] 21.6 — Create/update `src/stores/index.ts`. Do not stop — immediately continue.
- [x] 21.7 — Do NOT update existing import statements to use barrels (risk of circular deps). Only create the files for future use. Do not stop — immediately continue.
- [x] 21.8 — Run `npm run typecheck`. Fix any circular dependency issues. Do not stop — immediately continue.
- [x] 21.9 — **COMMIT**: `git add -A && git commit -m "refactor: add barrel export files for major directories"`. Do not stop — immediately continue.

---

## PHASE 22: SECURITY AUDIT
> Review all source code for OWASP Top 10 patterns. Document findings.
> **Do not stop between tasks.**

- [x] 22.1 — Search for any `eval()`, `Function()`, `new Function()`, `document.write()` usage. Remove or flag. Do not stop — immediately continue.
- [x] 22.2 — Search for any `innerHTML`, `outerHTML`, or `{@html ...}` in Svelte. Verify all are safe (static content only) or add sanitization. Do not stop — immediately continue.
- [x] 22.3 — Search for any hardcoded secrets, API keys, tokens, or credentials in source files. Remove and flag. Do not stop — immediately continue.
- [x] 22.4 — Audit all `fetch()` calls for proper error handling and response validation. Do not stop — immediately continue.
- [x] 22.5 — Audit all `localStorage`/`sessionStorage` operations for proper serialization/deserialization with validation. Do not stop — immediately continue.
- [x] 22.6 — Audit all URL construction for potential injection (ensure no user input in URLs without sanitization). Do not stop — immediately continue.
- [x] 22.7 — Check CSP headers configuration in `index.html` and server config. Do not stop — immediately continue.
- [x] 22.8 — Create `docs/SECURITY-AUDIT-RESULTS.md` documenting all findings with severity levels. Do not stop — immediately continue.
- [x] 22.9 — Fix all critical and high severity findings. Do not stop — immediately continue.
- [x] 22.10 — **COMMIT**: `git add -A && git commit -m "security: comprehensive audit and fixes"`. Do not stop — immediately continue.

---

## PHASE 23: DEPENDENCY AUDIT
> Document all dependencies, their purpose, and check for issues.
> **Do not stop between tasks.**

- [x] 23.1 — Read `package.json`. List every dependency and devDependency. Do not stop — immediately continue.
- [x] 23.2 — Create `docs/DEPENDENCIES.md` with a table: package name, version, purpose, category (runtime/dev/build), last updated, alternatives considered. Do not stop — immediately continue.
- [x] 23.3 — Run `npm audit` and document any vulnerabilities in the audit doc. Do not stop — immediately continue.
- [x] 23.4 — Check for any dependencies that are imported but never actually used in source code. Flag them. Do not stop — immediately continue.
- [x] 23.5 — **COMMIT**: `git add -A && git commit -m "docs: comprehensive dependency audit"`. Do not stop — immediately continue.

---

## PHASE 24: BUNDLE SIZE ANALYSIS
> Analyze the production build output and document what's in each chunk.
> **Do not stop between tasks.**

- [x] 24.1 — Run `npm run build` and capture the output (file sizes). Do not stop — immediately continue.
- [x] 24.2 — Create `docs/BUNDLE-ANALYSIS.md` documenting: total bundle size, largest chunks, what's in each chunk. Do not stop — immediately continue.
- [x] 24.3 — Identify the 10 largest imports by contribution to bundle size (inspect the build output or source). Do not stop — immediately continue.
- [x] 24.4 — Document suggestions for future optimization (lazy loading candidates, tree-shaking opportunities). Do not stop — immediately continue.
- [x] 24.5 — **COMMIT**: `git add -A && git commit -m "docs: bundle size analysis and optimization suggestions"`. Do not stop — immediately continue.

---

## PHASE 25: CONTEXT INDEX UPDATE
> Update `docs/CONTEXT_INDEX.md` to be a comprehensive quick-lookup for the codebase.
> **Do not stop between tasks.**

- [x] 25.1 — Read current `docs/CONTEXT_INDEX.md`. Do not stop — immediately continue.
- [x] 25.2 — Update with all current file paths, organized by system (game, UI, services, data, stores, tests). Do not stop — immediately continue.
- [x] 25.3 — Add a "Key Classes" section listing every major class with file path and one-line description. Do not stop — immediately continue.
- [x] 25.4 — Add a "Key Stores" section listing every Svelte store. Do not stop — immediately continue.
- [x] 25.5 — Add a "Key Events" section listing every event bus event. Do not stop — immediately continue.
- [x] 25.6 — Add a "Configuration" section listing all config files and their purposes. Do not stop — immediately continue.
- [x] 25.7 — **COMMIT**: `git add -A && git commit -m "docs: comprehensive CONTEXT_INDEX.md update"`. Do not stop — immediately continue.

---

## PHASE 26: TEST DESCRIPTIONS IMPROVEMENT
> Improve all test file `describe` and `it` blocks to be self-documenting.
> **Do not stop between tasks.**

- [x] 26.1 — Audit all test files in `src/` and `tests/`. Rename vague test descriptions (e.g., `it('works')`) to specific behavior descriptions (e.g., `it('returns 0 when input array is empty')`). Do not stop — immediately continue.
- [x] 26.2 — Ensure every `describe` block clearly names the module/function being tested. Do not stop — immediately continue.
- [x] 26.3 — Add missing `describe` blocks to group related tests. Do not stop — immediately continue.
- [x] 26.4 — Run `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 26.5 — **COMMIT**: `git add -A && git commit -m "test: improve test descriptions for self-documentation"`. Do not stop — immediately continue.

---

## PHASE 27: RETURN TYPE ANNOTATIONS
> Add explicit return type annotations to all exported functions that lack them.
> TypeScript can infer return types, but explicit annotations improve readability and catch bugs.
> **Do not stop between tasks.**

- [x] 27.1 — Add explicit return types to all exported functions in `src/game/`. Do not stop — immediately continue.
- [x] 27.2 — Add explicit return types to all exported functions in `src/services/`. Do not stop — immediately continue.
- [x] 27.3 — Add explicit return types to all exported functions in `src/data/`. Do not stop — immediately continue.
- [x] 27.4 — Add explicit return types to all exported functions in `src/stores/`. Do not stop — immediately continue.
- [x] 27.5 — Add explicit return types to all exported functions in `src/utils/` and `src/dev/`. Do not stop — immediately continue.
- [x] 27.6 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 27.7 — **COMMIT**: `git add -A && git commit -m "refactor: add explicit return type annotations to all exports"`. Do not stop — immediately continue.

---

## PHASE 28: SWITCH/IF-ELSE EXHAUSTIVENESS
> Add exhaustiveness checks to all switch statements and complex if-else chains on union types.
> Use `const _exhaustive: never = value;` pattern.
> **Do not stop between tasks.**

- [x] 28.1 — Find all `switch` statements in `src/game/`. Add `default: { const _exhaustive: never = ...; }` for union type switches that lack it. Do not stop — immediately continue.
- [x] 28.2 — Find all `switch` statements in `src/services/` and `src/data/`. Add exhaustiveness checks. Do not stop — immediately continue.
- [x] 28.3 — Find all `switch` statements in `src/ui/`. Add exhaustiveness checks. Do not stop — immediately continue.
- [x] 28.4 — Find all `switch` statements in `src/stores/`. Add exhaustiveness checks. Do not stop — immediately continue.
- [x] 28.5 — Run `npm run typecheck`. Fix any issues (these checks may reveal unhandled cases — handle them). Do not stop — immediately continue.
- [x] 28.6 — **COMMIT**: `git add -A && git commit -m "refactor: add exhaustiveness checks to all switch statements"`. Do not stop — immediately continue.

---

## PHASE 29: READONLY & IMMUTABILITY
> Add `readonly` modifiers to properties and parameters that should not be mutated.
> **Do not stop between tasks.**

- [x] 29.1 — Add `readonly` to all interface properties in `src/data/` that represent configuration or seed data (should never be mutated at runtime). Do not stop — immediately continue.
- [x] 29.2 — Add `readonly` to all class properties in `src/game/` that are set in the constructor and never reassigned. Do not stop — immediately continue.
- [x] 29.3 — Add `Readonly<T>` or `ReadonlyArray<T>` to function parameters that should not be mutated by the function. Do not stop — immediately continue.
- [x] 29.4 — Add `as const` to all literal configuration objects that should be immutable. Do not stop — immediately continue.
- [x] 29.5 — Run `npm run typecheck`. Fix any issues (mutation of now-readonly properties — these are real bugs!). Do not stop — immediately continue.
- [x] 29.6 — Run `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 29.7 — **COMMIT**: `git add -A && git commit -m "refactor: add readonly modifiers for immutable data"`. Do not stop — immediately continue.

---

## PHASE 30: PROMISE ERROR HANDLING
> Audit all async/await and Promise code for proper error handling.
> **Do not stop between tasks.**

- [x] 30.1 — Find all `async` functions in `src/services/`. Ensure all have try/catch or the caller handles rejection. Do not stop — immediately continue.
- [x] 30.2 — Find all `async` functions in `src/game/`. Ensure proper error handling. Do not stop — immediately continue.
- [x] 30.3 — Find all `.then()` chains. Ensure all have `.catch()` handlers. Do not stop — immediately continue.
- [x] 30.4 — Find all fire-and-forget async calls (calling async function without `await`). Add `void` prefix for intentional ones, add `await` for unintentional ones. Do not stop — immediately continue.
- [x] 30.5 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 30.6 — **COMMIT**: `git add -A && git commit -m "refactor: audit and fix async/promise error handling"`. Do not stop — immediately continue.

---

## PHASE 31: CONFIGURATION DOCUMENTATION
> Document all configuration knobs, environment variables, and build flags.
> **Do not stop between tasks.**

- [x] 31.1 — Create `docs/CONFIGURATION.md`. Do not stop — immediately continue.
- [x] 31.2 — Document all Vite configuration (`vite.config.ts`): plugins, aliases, build options. Do not stop — immediately continue.
- [x] 31.3 — Document all TypeScript configuration (`tsconfig.json`): compiler options, path mappings, includes/excludes. Do not stop — immediately continue.
- [x] 31.4 — Document all Capacitor configuration. Do not stop — immediately continue.
- [x] 31.5 — Document all environment variables (`.env.example` if it exists, or create one). Do not stop — immediately continue.
- [x] 31.6 — Document all build flags and dev server options. Do not stop — immediately continue.
- [x] 31.7 — **COMMIT**: `git add -A && git commit -m "docs: comprehensive configuration documentation"`. Do not stop — immediately continue.

---

## PHASE 32: CONSISTENT FUNCTION SIGNATURES
> Audit function signatures for consistency: parameter ordering, naming conventions, options objects.
> **Do not stop between tasks.**

- [x] 32.1 — Audit `src/game/managers/` for inconsistent parameter ordering. Standardize: required params first, optional last. Do not stop — immediately continue.
- [x] 32.2 — For functions with 4+ parameters, consider converting to an options object pattern. Only do this for internal functions with no test references, or update tests too. Do not stop — immediately continue.
- [x] 32.3 — Ensure boolean parameters are replaced with named options (e.g., `fn(true, false)` → `fn({ animate: true, force: false })`). Only for internal functions. Do not stop — immediately continue.
- [x] 32.4 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 32.5 — **COMMIT**: `git add -A && git commit -m "refactor: consistent function signatures and parameter patterns"`. Do not stop — immediately continue.

---

## PHASE 33: STRING LITERAL UNIONS TO ENUMS/CONST OBJECTS
> Where string literals are used as discriminators, ensure they're defined in a central union type or const object.
> **Do not stop between tasks.**

- [x] 33.1 — Find all repeated string literal unions in `src/data/` types. Ensure each has a single source of truth (a `type` or `const` object). Do not stop — immediately continue.
- [x] 33.2 — Find all `=== 'someString'` comparisons in `src/game/`. Ensure the string is from a typed constant, not a raw literal. Do not stop — immediately continue.
- [x] 33.3 — Find all `=== 'someString'` comparisons in `src/services/` and `src/stores/`. Same treatment. Do not stop — immediately continue.
- [x] 33.4 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 33.5 — **COMMIT**: `git add -A && git commit -m "refactor: centralize string literal types and constants"`. Do not stop — immediately continue.

---

## PHASE 34: INTERFACE DOCUMENTATION
> Add JSDoc descriptions to all interface properties across the codebase.
> **Do not stop between tasks.**

- [x] 34.1 — Add JSDoc to all properties of interfaces in `src/data/types/` or equivalent type definition files. Do not stop — immediately continue.
- [x] 34.2 — Add JSDoc to all properties of interfaces in `src/game/` type files. Do not stop — immediately continue.
- [x] 34.3 — Add JSDoc to all properties of interfaces in `src/services/` type files. Do not stop — immediately continue.
- [x] 34.4 — Add JSDoc to all properties of interfaces in `src/stores/` type files. Do not stop — immediately continue.
- [x] 34.5 — Run `npm run typecheck`. Fix any issues. Do not stop — immediately continue.
- [x] 34.6 — **COMMIT**: `git add -A && git commit -m "docs: add JSDoc to all interface properties"`. Do not stop — immediately continue.

---

## PHASE 35: NULL SAFETY AUDIT
> Find potential null/undefined access patterns and add proper guards.
> **Do not stop between tasks.**

- [x] 35.1 — Search for non-null assertions (`!.` and `!`) in `src/game/`. Replace with proper null checks or explain with a comment why it's safe. Do not stop — immediately continue.
- [x] 35.2 — Search for non-null assertions in `src/services/` and `src/stores/`. Same treatment. Do not stop — immediately continue.
- [x] 35.3 — Search for non-null assertions in `src/ui/`. Same treatment. Do not stop — immediately continue.
- [x] 35.4 — Search for optional chaining (`?.`) that silently swallows `undefined`. Verify the undefined case is actually handled downstream. Do not stop — immediately continue.
- [x] 35.5 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 35.6 — **COMMIT**: `git add -A && git commit -m "refactor: null safety audit — replace non-null assertions with proper guards"`. Do not stop — immediately continue.

---

## PHASE 36: PERFORMANCE MICRO-OPTIMIZATIONS
> Small, safe performance improvements. No behavioral changes.
> **Do not stop between tasks.**

- [x] 36.1 — Find `Array.find()` calls in hot paths (render loops, per-tick updates). Replace with `Map` or `Set` lookups where the collection is stable. Do not stop — immediately continue.
- [x] 36.2 — Find `JSON.parse(JSON.stringify(...))` deep clone patterns. Replace with `structuredClone()` where available. Do not stop — immediately continue.
- [x] 36.3 — Find repeated `Object.keys()` / `Object.entries()` calls on the same object. Cache the result. Do not stop — immediately continue.
- [x] 36.4 — Find string concatenation in loops. Replace with array `.join()`. Do not stop — immediately continue.
- [x] 36.5 — Find repeated DOM queries or `document.querySelector` calls. Cache references. Do not stop — immediately continue.
- [x] 36.6 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 36.7 — **COMMIT**: `git add -A && git commit -m "perf: micro-optimizations — Map lookups, structuredClone, cached queries"`. Do not stop — immediately continue.

---

## PHASE 37: REGEX AUDIT
> Find all regex patterns in the codebase. Ensure they're correct, documented, and not vulnerable to ReDoS.
> **Do not stop between tasks.**

- [x] 37.1 — Find all regex patterns (`/pattern/` and `new RegExp()`) in `src/`. List them. Do not stop — immediately continue.
- [x] 37.2 — Add comments explaining what each regex matches. Do not stop — immediately continue.
- [x] 37.3 — Check for ReDoS vulnerability (catastrophic backtracking) in any regex that processes user input. Fix if found. Do not stop — immediately continue.
- [x] 37.4 — Extract unnamed regexes into named constants (e.g., `const EMAIL_PATTERN = /.../ `). Do not stop — immediately continue.
- [x] 37.5 — **COMMIT**: `git add -A && git commit -m "refactor: audit and document all regex patterns"`. Do not stop — immediately continue.

---

## PHASE 38: EARLY RETURNS & GUARD CLAUSES
> Refactor deeply nested if/else blocks to use early returns and guard clauses.
> **Do not stop between tasks.**

- [x] 38.1 — Audit `src/game/managers/` for functions with 3+ levels of nesting. Refactor to use early returns. Do not stop — immediately continue.
- [x] 38.2 — Audit `src/game/systems/` for deep nesting. Refactor. Do not stop — immediately continue.
- [x] 38.3 — Audit `src/game/scenes/` for deep nesting. Refactor. Do not stop — immediately continue.
- [x] 38.4 — Audit `src/services/` for deep nesting. Refactor. Do not stop — immediately continue.
- [x] 38.5 — Run `npm run typecheck` and `npx vitest run`. Fix any issues. Do not stop — immediately continue.
- [x] 38.6 — **COMMIT**: `git add -A && git commit -m "refactor: flatten nested conditionals with early returns"`. Do not stop — immediately continue.

---

## PHASE 39: LOG LEVEL CONSISTENCY
> Ensure all logging uses appropriate levels: `console.error` for errors, `console.warn` for warnings, `console.info`/`console.log` for info.
> **Do not stop between tasks.**

- [x] 39.1 — Find all `console.log` that should be `console.warn` or `console.error` (e.g., logging error objects with console.log). Fix. Do not stop — immediately continue.
- [x] 39.2 — Find all `console.error` that aren't actually errors (e.g., info logging). Downgrade to appropriate level. Do not stop — immediately continue.
- [x] 39.3 — Ensure all caught errors log the error object, not just a string message. Do not stop — immediately continue.
- [x] 39.4 — **COMMIT**: `git add -A && git commit -m "refactor: consistent console log levels"`. Do not stop — immediately continue.

---

## PHASE 40: FINAL VERIFICATION & MERGE
> Run all checks and merge to main.
> **Do not stop — complete all steps.**

- [x] 40.1 — Run `npm run typecheck`. Must pass with 0 errors. Fix any issues. Do not stop — immediately continue.
- [x] 40.2 — Run `npm run build`. Must succeed. Fix any issues. Do not stop — immediately continue.
- [x] 40.3 — Run `npx vitest run`. All tests must pass. Fix any failures. Do not stop — immediately continue.
- [x] 40.4 — Review git log: `git log --oneline codex/overnight-overhaul ^main` to verify all commits look correct. Do not stop — immediately continue.
- [x] 40.5 — Merge to main: `git checkout main && git merge codex/overnight-overhaul`. Do not stop — immediately continue.
- [x] 40.6 — Push: `git push origin main`. Do not stop — immediately continue.
- [x] 40.7 — Delete branch: `git branch -d codex/overnight-overhaul`. Do not stop — immediately continue.
- [x] 40.8 — Final `npm run typecheck && npm run build && npx vitest run` on main to confirm everything is clean.

---

## SUMMARY

**Total tasks: ~280 individual items across 40 phases**

| Phase | Category | Est. Tasks |
|-------|----------|-----------|
| 1 | Accessibility fixes | 9 |
| 2 | Eliminate `any` types | 12 |
| 3 | `import type` enforcement | 8 |
| 4 | Dead code cleanup | 10 |
| 5 | Magic number extraction | 8 |
| 6 | JSDoc — game systems | 8 |
| 7 | JSDoc — services/data | 7 |
| 8 | JSDoc — UI components | 6 |
| 9 | Error message consistency | 8 |
| 10 | TODO/FIXME audit | 6 |
| 11 | Tests — utilities | 8 |
| 12 | Tests — game systems | 10 |
| 13 | Tests — data validation | 9 |
| 14 | Docs — architecture | 10 |
| 15 | Docs — game design | 11 |
| 16 | Docs — decisions | 6 |
| 17 | Docs — new reference docs | 8 |
| 18 | README overhaul | 3 |
| 19 | CSS cleanup | 8 |
| 20 | File naming consistency | 7 |
| 21 | Barrel exports | 9 |
| 22 | Security audit | 10 |
| 23 | Dependency audit | 5 |
| 24 | Bundle analysis | 5 |
| 25 | Context index update | 7 |
| 26 | Test descriptions | 5 |
| 27 | Return type annotations | 7 |
| 28 | Switch exhaustiveness | 6 |
| 29 | Readonly/immutability | 7 |
| 30 | Promise error handling | 6 |
| 31 | Configuration docs | 7 |
| 32 | Function signatures | 5 |
| 33 | String literal centralization | 5 |
| 34 | Interface documentation | 6 |
| 35 | Null safety audit | 6 |
| 36 | Performance micro-opts | 7 |
| 37 | Regex audit | 5 |
| 38 | Early returns | 6 |
| 39 | Log level consistency | 4 |
| 40 | Final verification & merge | 8 |
