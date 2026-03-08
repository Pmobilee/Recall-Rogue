# TODO-07 Save Persistence Isolation Hardening

## Problem statement and impact

Most dedicated save persistence checks pass, but there are high-impact inconsistencies in injected-state retention and interaction-segment coverage. Some mine/save runs show injected custom states reverting to default-like runtime state, and save-integrity flows can fail to execute required mine interactions due to route/entry blockers. This threatens confidence in profile isolation and deterministic test setup.

## Frequency and occurrence in corpus

- `MINE-002` injected custom save not retained after boot: 3 reports (`raw/analysis-mine-study.md`)
- `SAVE-001` save integrity flow cannot execute mine interaction segment: 3/15 economy+save reports (`raw/analysis-econ-save.md`)
- Save persistence core checks still pass in multiple runs (mitigates but does not remove risk).

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-mine-study.md`
- `docs/playthroughs/codex-2026-03-07/raw/analysis-econ-save.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-122338-save-resume-integrity.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-1308-save-run-04-post-tutorial-reload-persist.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-1309-save-run-05-mid-game-reload-persist.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-1310-save-run-06-rich-player-reload-persist.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-save-run-07-post-tutorial-persist.md`
- `docs/playthroughs/codex-2026-03-07/save/20260307-save-run-08-isolation.md`
- `docs/playthroughs/codex-2026-03-07/mine/20260307-mine-run-20-custom-high-o2.md`

## Suspected root-cause areas (repo paths)

- `src/services/saveService.ts` (load/save key semantics and profile selection)
- `src/services/storageService.ts` / `src/services/profileService.ts` (namespace isolation)
- `src/ui/stores/playerData.ts` (hydration timing, fallback writes, schema defaults)
- `src/main.ts` and `src/App.svelte` (boot flow order relative to preset injection)
- `tests/e2e/03-save-resume.cjs` (interaction-segment assumptions and setup sequence)

## Phased fix plan

### Phase A - Save lifecycle ordering guarantees

1. Document and enforce strict order: inject -> hydrate -> route -> render controls.
2. Add one-time boot guard preventing default save overwrite before injection completes.
3. Emit lifecycle telemetry (`save_loaded`, `save_injected`, `save_fallback_applied`) with source tags.

### Phase B - Isolation and schema hardening

1. Validate profile key isolation across presets/runs; ensure no cross-profile bleed.
2. Add schema version + migration verification before accepting runtime save object.
3. Refuse silent fallback on malformed partial saves; surface explicit diagnostics.

### Phase C - Persistence and interaction regression suite

1. Expand save tests to include post-injection runtime equality checks for critical fields.
2. Add isolation test that alternates two profiles/presets and asserts strict separation.
3. Add save+mine bridge test that verifies required mine controls are available after reload.

## Acceptance criteria

- Injected save payload values (oxygen, reviewStates, learnedFacts, streak fields) persist into runtime without reset.
- Reload persistence remains stable for post-tutorial, mid-game, and rich-player profiles.
- Isolation run proves profile A and B do not overwrite each other across alternating reloads.
- Save integrity script can complete required interaction segment without forced store mutation.

## Verification protocol

- Playwright interactive:
  - Inject known save payload, reload with/without preset, compare runtime state snapshots.
  - Confirm control availability (`btn-dive`, `btn-enter-mine`, `btn-surface`, quiz answer buttons) after load.
- Automated:
  - `node tests/e2e/03-save-resume.cjs`
  - Add dedicated isolation script for alternating profile contexts.
- Unit/integration:
  - Unit tests for save load precedence and fallback behavior.
  - Integration tests for schema migration and profile key scoping.

## Risk and rollback notes

- Risk: tighter save validation can reject legacy or partially migrated saves.
- Risk: boot-order changes can shift initial screen behavior.
- Rollback: keep compatibility adapter path and telemetry-based rollback trigger for rejected saves.

## Priority and effort band

- Priority: `P1` (data integrity and reproducibility)
- Estimated effort: `M-L` (3-5 engineering days)
