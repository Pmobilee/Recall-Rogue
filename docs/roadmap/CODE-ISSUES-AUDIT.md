# Recall Rogue Code Issues Audit

Date: 2026-03-09
Scope: `src/`, `scripts/`, `docs/roadmap/`

## Method Used

This report is evidence-driven from repo scans and targeted code reads.

Commands executed (high-level):
- `npm run check`
- `npm run test`
- `npm run test:coverage`
- `npm run build`
- `npm run lint`
- `npx madge --circular --extensions ts ...`
- `npx jscpd ...`
- `npx ts-prune ...`
- `npx depcheck ...`
- `rg` scans for `TODO/FIXME`, stubs, `Math.random`, `localStorage`, `catch`, duplicate symbols
- targeted file inspections with `sed`/`nl`

## Executive Summary

The P1 card-core implementation is functional (typecheck/tests/build pass), but the codebase has accumulated substantial structural debt from mixed eras (new card systems + legacy mining systems + archive stubs + agent-generated duplication).

Top priorities:
1. Fix correctness defects (season reward index bug, broken asset audit, auth token key drift).
2. Remove active circular dependencies (4 in non-archived code).
3. Consolidate duplicated helper logic and duplicate type definitions.
4. Reduce hidden failures (`catch {}` and silent no-op patterns) and centralize persistence/network layers.
5. Harden CI gates for an LLM-built repo (cycles, clone threshold, naming drift, storage key registry).

## Audit Metrics

- Source files in `src`: 526
- Test files: 38
- Active (non-archived) TS/Svelte LOC: 68,796
- Archived TS/Svelte LOC under `src/_archived-mining`: 44,801
- Explicit mining-archive stubs in active tree: 13 files
- Active circular dependencies (madge): 4
- Clone blocks (jscpd): 16 blocks, 272 duplicated lines (0.64%)
- Direct `localStorage`/`sessionStorage` call sites: 166
- `catch` blocks: 165
- `sort(() => Math.random() - 0.5)` call sites: 7
- Duplicate exported symbol names detected: 4

## Findings (Prioritized)

## P0 - Correctness / Broken Signals

### P0-01: Season pass claim index bug
- Evidence: `src/data/seasonPass.ts:86`
- Code:
  - `.filter((r, i) => ... !claimed.includes(i))`
  - then `.map((_, i) => i)`
- Issue:
  - `map` uses the filtered array index, not original track index.
  - This can return wrong milestone indices once any earlier item is filtered out.
- Impact:
  - Incorrect reward claiming behavior (claim wrong milestone index).
- Recommended fix:
  - Preserve original index in filter/map pipeline:
  - `track.flatMap((r, i) => condition ? [i] : [])`

### P0-02: Asset audit script currently gives false confidence
- Evidence: `scripts/audit-assets.mjs:13-16`
- Issue:
  - Audit scans `src/assets/sprites*`, but actual sprite pipeline writes/reads `public/assets/sprites*` (`scripts/gen-sprite-keys.mjs`).
  - During build, audit prints `Asset Audit: 0 sprites on disk ... All clear!`.
- Impact:
  - Broken build quality signal; missing/invalid sprite refs can pass unnoticed.
- Recommended fix:
  - Point audit directories to `public/assets/sprites` and `public/assets/sprites-hires`.
  - Exclude `src/_archived-mining/**` when scanning code refs.

### P0-03: Auth key mismatch breaks classroom auth path
- Evidence:
  - `src/services/apiClient.ts:20` uses `terra_auth_token`
  - `src/services/classroomService.ts:13` uses `tg_access_token`
  - `src/ui/components/AnnouncementBanner.svelte:18` checks `tg_access_token`
- Issue:
  - Two token key conventions coexist (`terra_auth_token` vs `tg_access_token`).
- Impact:
  - Classroom/announcement requests can silently act unauthenticated for logged-in users.
- Recommended fix:
  - Centralize auth token key in one module and import everywhere.

### P0-04: Progress roadmap naming inconsistency for CR-12 / CR-13
- Evidence:
  - `docs/roadmap/PROGRESS.md:172-173` labels CR-12/CR-13 as `Knowledge Library` and `Streaks & Daily`.
  - `docs/roadmap/phases/CR-12-ECHO-MECHANIC.md:1` and `CR-13-CARD-REWARD-SCREEN.md:1` define different deliverables.
- Issue:
  - Same CR IDs mapped to conflicting features.
- Impact:
  - High risk of agents implementing wrong scopes and incorrect status tracking.
- Recommended fix:
  - Normalize CR ID-to-feature mapping and add a single source-of-truth index.

## P1 - Architecture / Maintainability

### P1-01: Active circular dependencies (4)
- Evidence (madge):
  1. `data/types.ts <-> data/interestConfig.ts`
  2. `data/types.ts <-> services/behavioralLearner.ts`
  3. `services/saveService.ts <-> services/syncService.ts`
  4. `services/encounterBridge.ts <-> services/gameFlowController.ts`
- Impact:
  - Fragile initialization order, harder refactors, risk of partial module initialization bugs.
- Recommended fix:
  - Introduce boundary modules:
    - move shared category constants/types out of `data/types.ts`
    - split orchestration via event/callback interfaces
    - one-way dependency graph (`data` -> `services` -> `ui`)

### P1-02: save/sync cycle not truly removed
- Evidence:
  - `saveService` comments claim dynamic import avoids cycle (`src/services/saveService.ts:32-35`)
  - `syncService` still statically imports `load` from `saveService` (`src/services/syncService.ts:19`)
- Issue:
  - Cycle still exists despite comment claiming it is broken.
- Recommended fix:
  - Extract `saveSnapshotProvider` interface or callback injection to remove direct import.

### P1-03: encounter orchestration cycle
- Evidence:
  - `encounterBridge` imports `onEncounterComplete` from flow controller (`src/services/encounterBridge.ts:12`)
  - `gameFlowController` imports reward/deck functions from encounter bridge (`src/services/gameFlowController.ts:21`)
- Issue:
  - Two orchestrators mutually depend on each other.
- Recommended fix:
  - Create a neutral `runOrchestrator` or event bus interface; both depend on it, not each other.

### P1-04: Duplicate exported symbols with conflicting domains
- Evidence:
  - `RunState` in `src/services/runManager.ts:11` and `src/data/types.ts:820`
  - `EarnedBadge` in `src/services/badgeService.ts:47` and `src/data/types.ts:485`
  - `SeasonReward` in `src/services/seasonService.ts:23` and `src/data/seasonPass.ts:7`
- Issue:
  - Same symbol name, different meaning/schema.
- Impact:
  - Import mistakes become likely; weakens agent reliability.
- Recommended fix:
  - Canonicalize domain models in `data/types*`; service-specific DTOs use suffixes (`SeasonRewardApi`, etc.).

### P1-05: Store singleton helper duplication
- Evidence:
  - `src/ui/stores/gameState.ts:10-29`
  - `src/ui/stores/settings.ts:4-14`
  - similar variants in `playerData`, `combatState`
- Issue:
  - Repeated implementation of global symbol-backed singleton stores.
- Recommended fix:
  - Move into one utility (`src/ui/stores/singletonStore.ts`).

### P1-06: Network helper duplication (duel/social)
- Evidence:
  - `src/services/duelService.ts:146-235`
  - `src/services/socialService.ts:170-260`
- Issue:
  - Duplicate `_resolveBaseUrl`, `_readToken`, `_extractErrorMessage`, `_authedGet`, `_authedPost`.
- Impact:
  - Drift risk in auth/error handling.
- Recommended fix:
  - Shared authenticated fetch client or extend `apiClient` with typed public methods.

### P1-07: Dev helper duplication (playtest)
- Evidence:
  - `readStore` duplicated:
    - `src/dev/playtestAPI.ts:27-35`
    - `src/dev/playtestDescriber.ts:55-63`
- Recommended fix:
  - Extract `src/dev/storeBridge.ts` helper.

### P1-08: Shuffle helper duplication
- Evidence:
  - `src/services/deckManager.ts:7-13`
  - `src/services/runPoolBuilder.ts:19-25`
- Recommended fix:
  - Reuse one utility with test coverage.

### P1-09: God-module risk in player save store
- Evidence:
  - `src/ui/stores/playerData.ts` is 1,648 lines and 56 exported functions.
  - Includes inline archive stubs/no-op replacements (`playerData.ts:17-24`, `:58`, `:1206+`).
- Impact:
  - Extremely high cognitive load and regression risk.
- Recommended fix:
  - Split by domain (`playerProgress`, `inventory`, `relicProgression`, `socialMeta`, `migration`).

### P1-10: Archived stubs still in active runtime tree
- Evidence examples:
  - `src/game/scenes/MineScene.ts` (all stub methods)
  - `src/ui/components/DivePrepScreen.svelte` (archived placeholder)
  - `src/game/systems/MineGenerator.ts`, `ImpactSystem.ts`, `OxygenSystem.ts`, etc.
- Issue:
  - Active tree contains compatibility shells rather than strongly bounded archive package.
- Impact:
  - Confusing import graph and misleading completion signals.
- Recommended fix:
  - Move all compatibility stubs under explicit `compat/legacyMining/` with typed facades and deprecation owner.

### P1-11: Mutable internal array escape
- Evidence: `src/services/encounterBridge.ts:312-314`
- Issue:
  - `getRunPoolCards()` returns `activeRunPool` by reference.
- Impact:
  - External mutation can corrupt bridge state.
- Recommended fix:
  - Return copy (`return [...activeRunPool]`) or readonly view.

## P2 - Performance / Scalability / Runtime Behavior

### P2-01: Non-uniform shuffle anti-pattern used in 7 places
- Evidence:
  - `sort(() => Math.random() - 0.5)` in:
    - `src/services/rewardGenerator.ts:20`
    - `src/services/encounterRewards.ts:39`
    - `src/services/factsDB.ts:181,340`
    - `src/ui/components/CardCombatOverlay.svelte:73`
    - `src/ui/components/ChallengeQuizOverlay.svelte:36,41`
- Impact:
  - Biased randomization, unnecessary sort cost.
- Recommended fix:
  - Replace with Fisher-Yates utility.

### P2-02: Core gameplay randomness is non-deterministic and globally sourced
- Evidence:
  - Many `Math.random()` in floor/card/relic/question paths (`turnManager`, `floorManager`, `rewardGenerator`, `runPoolBuilder`, etc.).
- Impact:
  - Harder replay/debugging, weaker deterministic tests.
- Recommended fix:
  - Inject seeded RNG per run/encounter and pass through gameplay services.

### P2-03: FactsDB category query is O(N) JS scan over full DB
- Evidence: `src/services/factsDB.ts:173-182`
- Issue:
  - `getAll()` + JS filter + JS shuffle instead of SQL query.
- Impact:
  - Poor scaling at larger fact counts.
- Recommended fix:
  - Add SQL query by category columns with indexed schema.

### P2-04: Persistence access is fragmented
- Evidence:
  - 166 direct `localStorage`/`sessionStorage` calls.
  - A `storageService` abstraction exists (`src/services/storageService.ts`) but is not consistently used.
- Impact:
  - Inconsistent key naming, migration difficulty, SSR fragility, harder audit.
- Recommended fix:
  - Enforce `storageService` usage except for explicitly justified low-level modules.

### P2-05: Silent failure rate is high
- Evidence:
  - 165 `catch` blocks; many swallow/ignore patterns (`catch {}`, `// ignore`, silent no-op).
- Impact:
  - Production issues become invisible and difficult to diagnose.
- Recommended fix:
  - Introduce error policy tiers:
    - user-safe silent fallback
    - telemetry-only
    - surfaced warning/toast

### P2-06: Build warnings indicate chunking strategy debt
- Evidence from `npm run build`:
  - `Circular chunk: combat -> capacitor -> combat`
  - chunk size warning (`phaser` > 500 kB)
- Related config: `vite.config.ts` manual chunk routing.
- Recommended fix:
  - Revisit chunk boundaries and avoid cross-chunk back-edges.

## P3 - Security / Privacy

### P3-01: Auth tokens persist in localStorage (known TODO not closed)
- Evidence:
  - `src/services/apiClient.ts:20-21, 62-76, 542-565`
  - TODO comments note migration to httpOnly cookies.
- Impact:
  - XSS token exfiltration risk.
- Recommended fix:
  - Prioritize cookie-based auth migration with server support.

### P3-02: Partner API key stored in plaintext localStorage
- Evidence: `src/ui/components/PartnerPortalView.svelte` (`partner-api-key` reads/writes).
- Impact:
  - Easy key leakage on shared devices or script injection.
- Recommended fix:
  - Move to short-lived session token flow; avoid persistent storage for partner creds.

### P3-03: Auth storage key namespace drift increases accidental data leaks/misuse
- Evidence:
  - mixed key prefixes: `terra_*`, `tg_*`, `setting_*`, custom component keys.
- Recommended fix:
  - Central key registry with namespaced constants and linter rule.

## P4 - Tooling / CI / Delivery Gaps

### P4-01: `npm run lint` is broken in current install
- Evidence:
  - Script exists (`package.json:17`) but runtime error: `eslint: not found`.
- Issue:
  - `eslint` package is not in dependencies/devDependencies.
- Impact:
  - No enforceable lint gate.
- Recommended fix:
  - Add and configure ESLint, or remove script if intentionally retired.

### P4-02: Dependency hygiene issues
- Evidence (`depcheck`):
  - Unused deps: `@capacitor/android`, `@capacitor/ios`, `@capacitor/status-bar`, etc.
  - Missing deps referenced by scripts/config: `rollup-plugin-visualizer`, `canvas`, `better-sqlite3`.
- Impact:
  - Script fragility and unclear environment expectations.
- Recommended fix:
  - Add optionalDependencies or document optional toolchain profile; clean unused deps.

### P4-03: Coverage metrics are narrow and can mislead
- Evidence:
  - `vitest.config.ts:23-32` includes only 7 files in coverage scope.
  - thresholds are low (40/40/30/40 at lines `17-21`).
- Impact:
  - Reported high % does not represent repo-wide risk.
- Recommended fix:
  - Expand coverage include set gradually, set module-level targets.

### P4-04: Archived code volume remains very high inside main repo path
- Evidence:
  - `src/_archived-mining`: 160 files, 44,801 LOC.
- Impact:
  - Search noise, agent confusion, false positives in custom scripts.
- Recommended fix:
  - Move archive outside `src` or enforce universal exclusions in scripts.

## P5 - Naming / Product Drift

### P5-01: Arcane vs Terra/Mine naming remains mixed in active code
- Evidence examples (non-archived):
  - `src/i18n/locales/en.json` title still `Recall Rogue`
  - multiple active UI/legal/components and game comments reference mine/miner/minerals.
- Impact:
  - Product identity drift and inconsistent UX copy.
- Recommended fix:
  - Add naming-lint check for active paths and migrate key user-facing strings.

## Duplicate/Consolidation Opportunities

### D-01: Centralize singleton-store utility
- Current duplicates: `gameState`, `settings`, `playerData`, `combatState`.
- Simplification:
  - `createSingletonWritable`, `createSingletonDerived` helper.

### D-02: Centralize authenticated HTTP helper
- Current duplicates: `duelService`, `socialService`, ad hoc token reads in other services/components.
- Simplification:
  - `authHttpClient` with typed `get/post` and shared error normalization.

### D-03: Centralize storage key registry
- Current: 23 literal keys detected (partial scan), mixed namespaces.
- Simplification:
  - `src/data/storageKeys.ts` + forbidden-literal lint rule.

### D-04: Replace inline archived stubs with explicit compatibility layer
- Current: stubs sprinkled across gameplay/UI/store modules.
- Simplification:
  - one `compat/legacyMining` package with typed adapter interfaces.

## LLM-Optimized Engineering Recommendations

Because this repo is heavily agent-built, prioritizing deterministic structure and machine-checkable constraints will return outsized value.

### LLM-01: Add architecture contracts to CI
- Enforce with `madge`/`depcruise`:
  - forbid service-to-service cycles
  - forbid `services -> ui/components` imports
  - forbid `data -> services` runtime imports

### LLM-02: Add clone budget gate
- Run `jscpd` in CI with low threshold for new duplication.
- Allow baseline file; fail only on net-new clone blocks.

### LLM-03: Add storage/API key policy checks
- Regex-lint for raw `localStorage` token access and unknown key literals.
- Require imports from canonical key modules.

### LLM-04: Deterministic RNG protocol
- Standard `Rng` interface and seeded run context.
- Ban direct `Math.random` in core gameplay modules.

### LLM-05: Spec-ID consistency validator
- Validate `CR-XX` mapping between `PROGRESS.md` and phase docs.
- Fail CI when IDs or titles diverge.

### LLM-06: Module ownership map for agents
- Add lightweight owners per folder + dependency intent notes.
- Agents can use this to avoid cross-domain edits.

### LLM-07: Small-file budget for volatile modules
- Soft cap:
  - service files <= 400 LOC
  - store files <= 500 LOC
  - components <= 600 LOC
- Require decomposition plan when exceeded.

### LLM-08: Error handling policy template
- Define allowed silent catches and require tagged comments:
  - `// intentional-silent: offline-safe`
  - `// intentional-silent: optional-plugin`
- Everything else logs structured telemetry.

## Suggested Execution Plan

### Phase A (Immediate, 1-2 days)
1. Fix `seasonPass` index bug.
2. Fix `audit-assets.mjs` directory and archive exclusion.
3. Unify auth token key usage (`terra_auth_token` path).
4. Restore lint by adding/configuring ESLint.

### Phase B (Short, 3-5 days)
1. Break 4 active cycles.
2. Extract shared singleton-store and auth-http helpers.
3. Replace `sort(() => Math.random() - 0.5)` with Fisher-Yates helper.
4. Convert `getRunPoolCards` to immutable return.

### Phase C (Medium, 1-2 weeks)
1. Split `playerData.ts` by domain.
2. Introduce storage key registry + localStorage wrapper enforcement.
3. Expand coverage target set and raise thresholds.
4. Add CI checks for cycle/clone/spec consistency.

### Phase D (Ongoing)
1. Naming migration (Recall Rogue canonical copy).
2. Archive isolation strategy to shrink active cognitive surface.
3. Full auth cookie migration.

## Appendix A - Active Circular Dependencies

Detected in active non-archived TS graph:
1. `data/types.ts -> data/interestConfig.ts -> data/types.ts`
2. `data/types.ts -> services/behavioralLearner.ts -> data/types.ts`
3. `services/saveService.ts -> services/syncService.ts -> services/saveService.ts`
4. `services/encounterBridge.ts -> services/gameFlowController.ts -> services/encounterBridge.ts`

## Appendix B - Notable Clone Pairs (Active)

From `jscpd` scan:
- `src/ui/stores/gameState.ts` <-> `src/ui/stores/settings.ts` (singleton helper block)
- `src/services/duelService.ts` <-> `src/services/socialService.ts` (auth fetch helper blocks)
- `src/services/deckManager.ts` <-> `src/services/runPoolBuilder.ts` (shuffle helper)
- `src/dev/playtestAPI.ts` <-> `src/dev/playtestDescriber.ts` (`readStore` helper)

## Appendix C - Commands With Immediate Actionable Failures

- `npm run lint` fails in current workspace (`eslint` binary missing).
- `depcheck` reports missing script deps (`rollup-plugin-visualizer`, `canvas`, `better-sqlite3`).

