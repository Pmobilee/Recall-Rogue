# BATCH-2026-05-04-005 Gameplay Audit

Date: 2026-05-04
Runner: Codex self-playtest using the Claude `llm-playtest` Docker workflow
Domain: `general_knowledge`

## Verdict

PASS after fixes. The first replay found a real combat-exit progression blocker: after the first enemy died, the screen stayed on `combat` with no active combat state. The fix bypasses the visual combat-exit gate in turbo/bot mode, then the same route was replayed through multiple combats and special rooms without reproducing the limbo.

## Initial Failure

Initial artifact: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-005-b_none_1777900546114/`

Observed:

- Screen counts: `dungeonMap: 1`, `combat: 69`.
- Final screen: `combat`.
- Combat state: `null` after victory.
- Recent debug errors included repeated `TutorialCoachMark` null-anchor exceptions.

Root cause:

- `gameFlowController` correctly raised `combatExitRequested`.
- `CardApp` skipped the doorway click in turbo mode, but still waited for `ParallaxTransition.onComplete()` before calling `onCombatExitComplete()`.
- Under very low Docker FPS, that visual transition did not complete in time, so the post-combat action never opened the reward room.

Fix:

- Turbo/bot combat exit now calls `onCombatExitComplete()` directly.
- `TutorialCoachMark` now tolerates a missing `anchor` object instead of throwing from reactive positioning.

## Post-Fix Coverage

Post-fix artifact: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-005-b_none_1777901416317/`

| Screen | Visits |
| --- | ---: |
| dungeonMap | 14 |
| combat | 40 |
| rewardRoom | 8 |
| mysteryEvent | 5 |
| restRoom | 1 |
| retreatOrDelve | 1 |
| shopRoom | 1 |

Combat outcomes:

| Combat | Enemy | Start HP | End screen |
| ---: | --- | ---: | --- |
| 1 | Bookmark Vine | 100 | rewardRoom |
| 2 | The Tutor | 66 | dungeonMap |
| 3 | The Tutor | 66 | rewardRoom |
| 4 | The Algorithm | 66 | rewardRoom |
| 5 | The Red Herring | 59 | rewardRoom |
| 6 | The Bright Idea | 35 | rewardRoom |

## Residual Notes

- `__rrPlay.endTurn()` exceeded the audit wrapper's 8-second timeout once while Docker was running at 1-2 FPS. The game state advanced afterward and the run continued. This is Docker/automation slowness, not a player-facing progression blocker.
- Some reward-room calls needed an extra loop tick before moving on, but reward acceptance did progress.
- No `TutorialCoachMark` runtime errors appeared in the post-fix debug error list.
