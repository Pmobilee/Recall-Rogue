# Playtest Batch Summary — BATCH-2026-03-27-003
**Date**: 2026-03-27 | **Testers**: 4 | **Domain**: general_knowledge | **Runs**: 3 each

## Overall Verdict: ISSUES

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | ISSUES | 0 | 2 | 1 | 0 |
| Balance Curve | ISSUES | 0 | 2 | 3 | 0 |
| Fun/Engagement | ISSUES | 1 | 2 | 4 | 0 |
| Study Temple | ISSUES | 0 | 2 | 1 | 0 |

## Cross-Tester Insights

- [CONVERGING] **Reward screen crash**: Fun tester hit Phaser `blendModes` null + `.trigger` undefined errors after every combat. Balance tester also observed encounterBridge TypeError on every `endTurn()`. Both point to encounterBridge.ts null-check gaps.
- [CONVERGING] **Fact pool repetition**: Quiz tester found only 9 unique facts across 22 quiz instances (same Epimetheus/holism facts 5x each). Fun tester also noted repetitive content.
- [CONVERGING] **Template token artifacts**: Both Quiz and Fun testers saw curly-brace tokens in answers (`{1928}`, `{482}`, `{107}`) — numerical distractor formatting leaking into display.
- [SOLO] **Quick-play damage near-zero**: Balance tester measured quick-play at ~25% of base damage (expected ~65-75%). Charge-to-quick ratio is 3-6x, far outside target 1.3-2x.
- [SOLO] **HP resets to 100 after every combat**: Balance tester observed no cumulative HP attrition — either full heal-on-victory is intended but undocumented, or display bug.
- [SOLO] **Study API broken**: Study tester found `startStudy()` navigates to non-existent `'study'` screen (should be `'restStudy'`). SM-2 scheduler not connected to rest-room study path.
- [SOLO] **Heavy Strike unplayable at default AP**: Fun tester found 4-AP charge cost with 3 AP max — silent trap.

## All Issues by Severity

### CRITICAL
- **[fun]** Reward screen crashes after every combat (Phaser blendModes null + encounterBridge .trigger undefined) — deckbuilding progression inaccessible

### HIGH
- **[quiz]** Fact pool starvation — only 9 unique facts in 22 quiz instances; repetition defeats learning
- **[quiz]** Distractors don't diversify within a session — same 5 candidates reshuffled
- **[balance]** Quick-play vs charge-correct ratio appears ~1:4-6x (expected 1:1.5x per `CHARGE_CORRECT_MULTIPLIER`). Likely inflated by devpreset relics/mastery stacking on charge damage. Actual multiplier in code is 1.5x. **Needs retest without devpreset relics.**
- **[balance]** HP appears to reset to 100 after every combat — no cumulative attrition visible
- **[fun]** Heavy Strike can never be charge-played at default AP (costs 4, max AP is 3)
- **[fun]** AP max varies between encounters (3 vs 4) with no explanation
- **[study]** `__terraPlay.startStudy()` navigates to wrong screen (`'study'` not `'restStudy'`)
- **[study]** SM-2 scheduler not connected to rest-room study path — reviewStates never updated

### MEDIUM
- **[quiz]** Holism question answer debatable — "Ability to enjoy life" vs "Cognitive flexibility"
- **[quiz]** Black Sea question is Floor 3+ difficulty on Floor 1
- **[balance]** Recurring encounterBridge TypeError on every endTurn() (null-check gap lines 763/777/790)
- **[balance]** Curse accumulation snowballs — one wrong answer on recycled card = ~40% cursed hand
- **[balance]** Foresight (0-cost draw) appears overtuned — removes hand scarcity tension
- **[fun]** Relic triggers (iron_shield passive block) are completely invisible
- **[fun]** Card mastery upgrades happen silently with no reward moment
- **[fun]** Answer text contains unfilled template tokens: `{1928}`, `{482}`, `{107}`
- **[study]** `getSessionSummary()` returns irrelevant event log data, not study metrics

## Recommendations
1. **Fix encounterBridge null-checks** (lines 763/777/790) — unblocks reward screen, fixes endTurn errors
2. **Fix numerical answer display** — strip `{...}` bracket tokens before rendering in quiz UI
3. **Increase fact pool diversity** — fact selection should avoid repeating within a session
4. **Rebalance quick-play damage** — should be ~65-75% of base, not ~25%
5. **Fix study API** — `startStudy()` should navigate to `'restStudy'`, wire SM-2 updates into study path
6. **Cap Heavy Strike charge cost at AP max** — or clearly communicate it's a quick-play-only card

## Next Steps
- Run `/balance-sim` to get statistical confirmation of quick-play damage ratio
- Fix encounterBridge null-checks and re-run `/llm-playtest fun` to verify reward screen
- Run `/inspect` on the study system after SM-2 wiring fix
