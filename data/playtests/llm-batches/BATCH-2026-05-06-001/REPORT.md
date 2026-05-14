# Five-Room Human-Style Click Playtest

Batch: BATCH-2026-05-06-001
Agent: Codex
Method: Docker warm visual harness with real UI clicks/selects/Charge button presses. State dumps were used only as perception/inspection; gameplay choices were made through visible controls.

## Result

Requested: 5 consecutive rooms.
Completed: 0 rooms.

The run reached room 1 combat and did not reach the first reward room. The attempt was stopped after reproducing a stale end-turn confirmation overlay that persisted into the next player turn and blocked card clicks.

## Timeline

- Started from Hub, selected Trivia, entered the dungeon map.
- The first map-node click advanced to combat, but the Playwright action timed out during the transition even though state changed to combat. Artifact: `/tmp/rr-docker-visual/llm-five-rooms-2026-05-06_none_1778053444297/`.
- Room 1 enemy: Mold Puff, 26 HP.
- Charged a Strike and answered the visible quiz correctly. Combat continued normally.
- Ended turn after using a block.
- On the next player turn, the old end-turn confirmation overlay remained mounted and intercepted card clicks. Artifact: `/tmp/rr-docker-visual/llm-five-rooms-2026-05-06_none_1778053817931/`.

## Confirmed Finding

Stale end-turn confirmation overlay blocked the next player turn.

- Symptom: after turn advancement, `.end-turn-confirm-overlay` still existed and intercepted clicks on `card-hand-3`.
- Root cause: `showEndTurnConfirm` was not cleared on turn changes or when combat left `player_action`.
- Fix: `CardCombatOverlay.svelte` now clears `showEndTurnConfirm` on turn-number changes and whenever the phase is not `player_action`.
- Verification: `npm run typecheck` passes with 0 errors. A targeted Docker scenario verify was attempted but did not reach `btn-end-turn`, so visual verification of this exact fix remains pending.

## Additional Observations

- Map-node click actions sometimes timed out while still advancing the game state. This appears related to transition handling in the Docker/Playwright path and should be watched in the next run.
- Charge button and charge quiz were usable after the May 5 z-index fix.
- The first-combat tutorial cascade did not recur.
