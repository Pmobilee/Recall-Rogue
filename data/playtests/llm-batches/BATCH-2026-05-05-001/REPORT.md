# Five-Room Human-Style Click Playtest

Batch: BATCH-2026-05-05-001
Agent: Codex
Method: Docker warm visual harness with real UI clicks/selects/Charge button presses. No gameplay-shortcut helpers were used for card plays or map choices.

## Result

Requested: 5 consecutive rooms.
Completed: 0 rooms.

The run did not reach a reward room or a second map room. Attempt 1 died in room 1 while learning the live Charge affordance against Staple Bug. Attempt 2 was stopped after reproducing and fixing a Charge button click blocker on the selected left-edge card.

## Confirmed Findings

1. Charge hint banner intercepted card clicks during combat.
   - Live symptom: clicking the selected card failed because `.charge-hint-banner` received the pointer.
   - Fix: `CardCombatOverlay.svelte` now makes the banner passive while leaving its close button clickable.
   - Verification: continued live combat after the fix without the hint intercepting card clicks.

2. Selected edge-card Charge button was present but not clickable.
   - Live symptom: selecting `card-hand-0` showed `.charge-play-btn-landscape`, but Playwright reported the selected card's `.card-front` intercepted the button click. This matches a real player problem: the Charge button is visually offered but cannot be pressed.
   - Root cause: selected cards use inline `z-index: 2000`, while the Charge button used `z-index: 30`/`40`.
   - Fix: `CardHand.svelte` now sets both Charge button rules to `z-index: 2100`.
   - Verification: `/tmp/rr-docker-visual/llm-five-rooms-2026-05-05_combat-basic_1777944982059/` successfully selected `card-hand-0`, clicked the Charge button, and opened a quiz (`quizCount: 3`).

## Notes

- First-combat tutorial cascade did not recur in this run.
- No reward-room transition was reached, so this batch does not verify the post-combat reward/map/floor transition path.
- The first attempt's death should not be treated as a balance verdict; play quality was distorted by live debugging of click/Charge affordances.
