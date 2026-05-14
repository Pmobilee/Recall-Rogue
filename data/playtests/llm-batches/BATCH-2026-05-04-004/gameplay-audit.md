# BATCH-2026-05-04-004 Gameplay Audit

Date: 2026-05-04
Runner: Codex self-playtest using the Claude `llm-playtest` Docker workflow
Domain: `general_knowledge`

## Verdict

PASS after fixes. The first run found two gameplay-quality issues and no active progression blocker. Both issues were fixed, then the same Docker LLM playtest was rerun through combat, reward rooms, shop, rest, retreat/delve, mystery events, and run death. The post-fix run ended on `runEnd`.

## Coverage

Post-fix screen coverage:

| Screen | Visits |
| --- | ---: |
| dungeonMap | 17 |
| combat | 50 |
| rewardRoom | 11 |
| shopRoom | 2 |
| restRoom | 3 |
| retreatOrDelve | 2 |
| mysteryEvent | 5 |

Post-fix combat coverage:

| Combat | Enemy max HP | Start HP | Turns | End screen |
| ---: | ---: | ---: | ---: | --- |
| 1 | 37 | 100 | 7 | combat, then reward transition |
| 2 | 144 | 100 | 13 | combat, then reward transition |
| 3 | 85 | 58 | 6 | combat, then reward transition |
| 4 | 87 | 56 | 4 | combat, then reward transition |
| 5 | 171 | 80 | 8 | combat, then reward transition |
| 6 | 227 | 36 | 2 | runEnd |

## Findings

### GP-004-001: Card-play Phaser visual exception could mark a valid card play as failed

Initial run evidence: a quick-played shield card returned `Cannot read properties of undefined (reading 'setFillStyle')`. The run continued, but the action result was false and could poison combat automation or any player-facing path where Phaser visual objects are late or missing.

Fix: `encounterBridge.handlePlayCard()` now treats chain, card-play, and victory animation updates as best-effort. Combat state resolves first; visual failures are logged and do not stop card resolution or encounter completion.

Status: fixed and covered by `src/services/encounterBridge.visualSafety.test.ts`.

### GP-004-002: Zero-valued numeric fact produced a one-choice quiz

Initial run evidence: fact `food_cuisine-bell-pepper-zero-scoville` produced choices `["0"]` for "What is the Scoville heat rating of a bell pepper?"

Source verification: `data/seed-pack.json` has answer `0` and no distractors for that fact.

Fix: numerical distractor generation now recognizes plain numeric answers and generates non-zero distractors for zero-valued facts. `getQuizChoices()` now returns the correct answer plus three wrong answers for this case.

Status: fixed and covered by `src/services/numericalDistractorService.domain.test.ts` and `src/services/quizService.test.ts`.

## Notes

- Reward rooms sometimes needed an additional loop tick before the screen changed, especially around relic swap overlays. The post-fix run kept progressing and did not reproduce the old reward-room black-screen or canvas crash.
- Mystery events sometimes stayed on `mysteryEvent` across several quiz/result steps before returning to the map. This matched the event flow and eventually reached `dungeonMap`.
- Elite/boss pressure remains high: the final fight started at 36 HP against a 227 HP enemy and ended in player death after two turns. That is balance pressure, not a room/encounter transition break.

## Artifacts

- Smoke: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-004_none_1777889864104/`
- Initial gameplay audit: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-004_none_1777889977602/`
- Post-fix gameplay audit: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-04-004_none_1777890348951/`
