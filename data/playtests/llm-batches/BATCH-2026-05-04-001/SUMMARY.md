# Playtest Batch Summary — BATCH-2026-05-04-001

**Date**: 2026-05-04 | **Testers**: 1 (full-run human-style) | **Domain**: general_knowledge | **Floors**: 3 (Act 1) | **Style**: human-style observation

## Overall Verdict: ISSUES

11 issues observed in a single Act 1 attempt (died on Floor 2). Several block Steam-launch quality. Visual design and narrative prose praised — core polish gaps and 1 hard JS error are the launch-blockers.

## Tester Verdicts

| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Full Run (Act 1) | ISSUES | 0 | 3 | 4 | 4 |

## Source-Verified Issues (orchestrator double-check)

| # | Title | Verified |
|---|---|---|
| 1 | acceptReward Phaser drawImage null crash | Symptom verified in `result.json`; root cause not localized in `RewardRoomScene.ts` (no `drawImage` calls there). Likely a Phaser internal asset issue — needs runtime trace. |
| 2 | 8 sequential tutorial popups in first combat | `src/data/tutorialSteps.ts` has 32 step IDs across combat + meta; many fire in first run. Recent commit (cb5e4db18) reduced popup count but evidence shows it's still excessive. |
| 3 | Template tokens `{N}` leak into `answer` field | **CONFIRMED** — `data/seed-pack.json` contains **1994** facts with unresolved `{N}` placeholders in their `answer` field. Massive content bug. |
| 4 | Enemy `displayDamage` scales with player chain | Behavior observed in result.json. Source verification needed — defer to game-logic. |
| 5 | Shop prices exceed starting gold (50g) | Behavior observed (57–73g cards, 150g relics). Defer to balance verification. |
| 6 | "Death keeps 80% (40)" copy ambiguous | **CONFIRMED** at `src/ui/components/RetreatOrDelve.svelte:87`. |
| 7 | Delve trade-off has no upside copy | Confirmed via the same component layout (only penalty is shown). |
| 8 | Low FPS (7–14) in extended Docker sessions | Docker/SwiftShader artifact — low priority for Steam launch. |
| 9 | `net::ERR_CONNECTION_REFUSED` on every session | Backend-not-running noise; Docker-environmental. Investigate request URL. |
| 10 | "Grey Matter 0" on run end has no tooltip | Currency exists in `playerData.ts`. UX gap is real. |
| 11 | "Adapt" card description vague | **CONFIRMED** at `src/services/cardDescriptionService.ts:1017` — text is "Auto-picks best:\nAttack, Block, or Cleanse". |

## Top 3 Player Frustrations

1. **HIGH** — `acceptReward` JS crash (black screen, hidden buttons) on first reward.
2. **HIGH** — 1994 facts ship with `{N}` template tokens in their answer string.
3. **HIGH** — 8 sequential tutorial popups in first combat (game "explains the player to death").

## All Issues by Severity

### CRITICAL
(none — no full softlocks observed; recovery path existed for ISSUE-1)

### HIGH
- **ISSUE-1** [Bug] `acceptReward()` Phaser canvas crash — `Cannot read properties of null (reading 'drawImage')`. Black screen. UI buttons hidden. Recovered via direct DOM click.
- **ISSUE-2** [UX] 8 sequential blocking tutorial popups across the first 6 turns of combat — buries the moment-to-moment game.
- **ISSUE-3** [Content] 1994 facts have unresolved `{N}` placeholders in the `answer` field of `data/seed-pack.json`.

### MEDIUM
- **ISSUE-4** [Balance/UX] Enemy `displayDamage` scales with player chain — unclear if intentional.
- **ISSUE-5** [Balance] First-floor shop unaffordable on starting gold — nothing to buy.
- **ISSUE-6** [UX] "Death keeps 80% (40)" copy ambiguous (`RetreatOrDelve.svelte:87`).
- **ISSUE-7** [UX] Retreat/Delve screen lists penalty only; no upside copy for delving.

### LOW
- **ISSUE-8** [Perf] Low FPS in extended Docker/SwiftShader sessions (likely env-only).
- **ISSUE-9** [Bug] `net::ERR_CONNECTION_REFUSED` on every session (backend lookup).
- **ISSUE-10** [UX] "Grey Matter 0" on run end has no tooltip/explanation.
- **ISSUE-11** [Content] "Adapt" card description vague (`cardDescriptionService.ts:1017`).

## Bright Spots

- Visual design and pixel-art rooms — repeatedly impressive.
- Narrative prose on map and mystery events — passes human-voice bar.
- Mastery system creates real felt progression.
- Run-end Knowledge Harvest screen is comprehensive and rewarding.
- HP-bar color coding signals danger without numbers.

## Recommendations

1. **BLOCKER for launch** — fix `acceptReward` drawImage crash. Add a runtime catch + recovery path so a black canvas can never persist.
2. **BLOCKER for launch** — sweep `data/seed-pack.json` (and any deck JSON) for `\{[0-9]+\}` tokens in `answer` and `correctAnswer` fields. Either run substitution at build or strip placeholders out of source.
3. **BLOCKER for launch** — audit the in-combat tutorial cascade. Cap to the genuinely critical 2–3 steps for first combat; defer the rest to context-triggered hints.
4. Rephrase `RetreatOrDelve.svelte:87` to "If you die, you keep 80% (40g)" and add an upside line for delving.
5. Add a Grey Matter tooltip on the run-end screen.
6. Make at least one shop item affordable on starting gold (or raise starting gold to 60–75g).
7. Verify enemy `displayDamage` is not incorrectly multiplied by the player's chain coefficient.

## Next Steps

- Run `/issue-triage` to add these to the issue leaderboard (next).
- Pre-Steam launch: address all HIGH issues. The `{N}` placeholder bug is the worst — 1994 facts is far too many to ship.
- Run `/balance-sim` after shop-pricing fixes land to confirm no over-correction.
