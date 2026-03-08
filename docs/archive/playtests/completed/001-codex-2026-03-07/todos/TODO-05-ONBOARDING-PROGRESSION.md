# TODO-05 Onboarding Progression

## Problem statement and impact

Onboarding is hard-blocked in both adult and teen paths because the primary progression CTA (`Start Exploring`) remains disabled, preventing transition from cutscene/onboarding to base gameplay. This is a critical first-session defect with direct retention impact and blocks all new-player funnel validation.

## Frequency and occurrence in corpus

- `ONB-001` progression blocked (`Start Exploring` disabled): 5/5 onboarding runs (`raw/analysis-dome-family.md`)
- `ONB-002` onboarding/base state mismatch: 4/5 onboarding runs
- `ONB-003` recurring runtime/API noise in onboarding: 5/5 (secondary confounder)

## Evidence references (spot-checked)

- `docs/playthroughs/codex-2026-03-07/raw/analysis-dome-family.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/20260307-123837-first-boot.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/20260307-1311-onboarding-run-07-first-boot-adult-path.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/20260307-1312-onboarding-run-08-first-boot-teen-path.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-09-adult-path.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/20260307-onboarding-run-10-teen-path.md`
- `docs/playthroughs/codex-2026-03-07/onboarding/codex-combined.md`
- `docs/playthroughs/codex-2026-03-07/codex-combined.md`

## Suspected root-cause areas (repo paths)

- `src/ui/components/profiles/ProfileCreateView.svelte` (CTA enablement conditions)
- `src/ui/components/legal/AgeGate.svelte` (age selection persistence and state handoff)
- `src/App.svelte` (onboarding screen routing and transition)
- `src/ui/stores/playerData.ts` (interest selection completion state)
- `src/services/legalConstants.ts` and related storage keys (`terra_age_bracket` semantics)

## Phased fix plan

### Phase A - Gate condition traceability

1. Enumerate all booleans required to enable `Start Exploring`.
2. Add debug readout for each gating field in DEV mode.
3. Validate state transitions for both age paths and back-navigation edge cases.

### Phase B - Progression state repair

1. Normalize onboarding completion criteria (age selected, interests selected, required profile fields valid).
2. Remove stale/hidden dependencies that keep CTA disabled after valid selection.
3. Ensure `Start Exploring` commits completion state and transitions to `base` exactly once.

### Phase C - Funnel regression tests

1. Add onboarding E2E for adult and teen full paths from clean localStorage.
2. Add assertion that CTA transitions from disabled -> enabled after required actions.
3. Verify one reload during onboarding does not deadlock progression state.

## Acceptance criteria

- Adult path can complete onboarding and land on `base` without debug forcing.
- Teen path can complete onboarding and land on `base` without debug forcing.
- `Start Exploring` is enabled immediately after required selections are valid.
- Onboarding completion persists across reload; returning user bypasses onboarding as expected.

## Verification protocol

- Playwright interactive:
  - Start from clean storage (`first_boot` scenario), complete both age paths, record screen transitions.
  - Capture `window.__terraDebug()` before CTA click and after transition.
- Automated:
  - Add onboarding flow scripts for adult and teen in `tests/e2e/`.
  - Run `node tests/e2e/01-app-loads.cjs` as baseline.
- Unit/integration:
  - Unit tests for CTA enablement predicate and onboarding completion reducer.

## Risk and rollback notes

- Risk: loosening gate could permit incomplete profiles to enter gameplay.
- Risk: onboarding completion persistence changes can affect existing saves.
- Rollback: keep old gating function available behind temporary switch and compare funnel metrics.

## Priority and effort band

- Priority: `P0` (critical user journey blocker)
- Estimated effort: `M` (2-4 engineering days)
