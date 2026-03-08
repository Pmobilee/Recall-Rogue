# Save/Resume Integrity Playthrough - 2026-03-07 12:23:38

## Scope
- Mode: FAST WORKER MODE single deterministic run
- Target flow: `post_tutorial` load -> mine interaction attempts -> reload persistence check -> alternate preset sanity check
- App code edits: none

## Run Metadata
- Start URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
- Browser: Playwright Chromium (`--no-sandbox`)
- Viewport: `390x844`
- Raw artifacts:
  - `/tmp/save_playthrough_result.json`
  - `/tmp/save-playthrough-blockage.png`
  - `/tmp/save-playthrough-blockage-snapshot.json`
  - `/tmp/save-playthrough-blockage-dom.html`

## Action Trace
1. Loaded `post_tutorial` preset.
2. Forced `currentScreen` to `base` via debug store setter for deterministic state.
3. Attempted interactions:
   - `btn-enter-mine`: missing
   - `btn-dive`: missing
   - `quiz-answer-0`: missing
   - `btn-surface`: missing
4. Reloaded without preset: `?skipOnboarding=true`.
5. Loaded alternate preset: `?skipOnboarding=true&devpreset=mid_game_3_rooms`.
6. Reloaded without preset again to check persistence stability.

## Blockage Capture
- Blockage: required mine/quiz/surface DOM controls were not present (`visibleTestIds: []`) throughout run.
- Snapshot capture: `/tmp/save-playthrough-blockage-snapshot.json`
- Screenshot: `/tmp/save-playthrough-blockage.png`
- Console capture: included in `/tmp/save_playthrough_result.json` (repeated 500 and 404 resource errors, no fatal page crash).

## Persistence Assertions
- `saveExistsAfterActions`: PASS
- `saveExistsAfterReload`: PASS
- `activeSaveKeyStableAcrossReload`: PASS (`terra_save`)
- `oxygenPersistedAcrossReload`: PASS (3 -> 3)
- `mineralsPersistedAcrossReload`: PASS (`dust/shard/crystal/geode/essence` unchanged)
- `divesPersistedAcrossReload`: PASS
- `blocksPersistedAcrossReload`: PASS
- `screenSafeAfterReload`: PASS (`cutscene`, not transient quiz/loading)
- `midGamePresetApplied`: PASS (`dust=2400`, `totalDivesCompleted=18`)
- `midGameStateStableAfterReload`: PASS

## Profile/Session Corruption Sanity
- Alternate preset load and subsequent no-preset reload remained internally consistent.
- No obvious cross-session corruption observed in core resources/stats fields.

## Overall Result
- **FAIL (partial):** persistence integrity checks passed, but required interaction segment (enter mine / mine-or-quiz / surface) could not be executed due missing interactable controls in this runtime state.
