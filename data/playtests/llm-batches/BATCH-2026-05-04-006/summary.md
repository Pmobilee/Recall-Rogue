# BATCH-2026-05-04-006

Manual LLM click playtest using the Docker llm-playtest warm container.

## Path Played

- Started a Trivia Dungeon run through the UI.
- Selected the middle first-row combat node.
- Played the Page Flutter encounter with real card clicks and turn decisions.
- Reached the reward room after combat victory.
- Clicked the visible reward Continue button and reproduced the post-victory break.

## Findings

- `rewardRoom` Continue reproduced the Steam-style blocker: a Svelte click handler threw `Cannot read properties of null (reading 'drawImage')`, the screen stayed on `rewardRoom`, and the visible scene became a black/star field.
- The reward DOM accessibility overlay was intercepting mouse/touch clicks, bypassing the Phaser reward room's normal `onContinueTapped()` flow and its "Leave items behind?" confirmation.
- The Charge hint banner could sit over the hand and intercept the second tap on a selected card, blocking Quick Play.
- The combat tutorial still cascaded beyond the two intended intro popups and repeatedly stole card clicks during normal play.
- Domain strip cards were missing the `domain-card-*` test IDs expected by the project's own playtest API.

## Fixes Landed

- Reward Continue now delegates to `RewardRoomScene.continueFromOverlay()` so the normal Phaser flow handles uncollected rewards.
- Reward room completion catches `stopRewardRoom()` exceptions and continues game flow in `finally`.
- Reward overlay buttons no longer intercept mouse/touch clicks; they remain keyboard/screen-reader activatable.
- Charge hint banner no longer intercepts card clicks, while its close button remains clickable.
- Combat tutorial now ships only the two launch-critical orientation steps.
- Domain strip cards now expose `data-testid="domain-card-{domainId}"`.

## Verification

- `npm run test -- rewardRoomBridge.test.ts playtestAPI.test.ts`
- `npm run typecheck` (0 errors, 22 pre-existing warnings)
- Targeted reward-room visual verification: scenario reward room opened, real pointer click on Continue showed the normal "Leave items behind?" confirmation, clicking Yes advanced out of reward room with no recent runtime errors.
