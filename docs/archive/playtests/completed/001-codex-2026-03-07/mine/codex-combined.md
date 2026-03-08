# Mine Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 2026-03-07-1015-full-dive-20-cards.md | — mine | PASS |
| 2026-03-07-1230-3tanks-20cards-consistency.md | - mine | FAIL |
| 2026-03-07-fix-prompt.md | task: fix 2 mine gameplay issues from testing | PASS |
| 20260307-114154-many-reviews-due.md | Run 2 | FAIL |
| 20260307-1309-mine-run-01-post_tutorial.md | post_tutorial | FAIL |
| 20260307-1312-mine-run-02-many_reviews_due.md | many_reviews_due | FAIL |
| 20260307-1325-mine-run-03-quiz_due.md | quiz_due | MIXED/UNKNOWN |
| 20260307-1325-mine-run-04-mid_dive_active.md | mid_dive_active | MIXED/UNKNOWN |
| 20260307-1325-mine-run-05-heavy_review_overdue.md | heavy_review_overdue | MIXED/UNKNOWN |
| 20260307-1325-mine-run-06-custom_mature_overdue_alpha.md | custom_mature_overdue_alpha | MIXED/UNKNOWN |
| 20260307-1325-mine-run-07-custom_mature_overdue_beta.md | custom_mature_overdue_beta | MIXED/UNKNOWN |
| 20260307-1325-mine-run-08-custom_mature_overdue_gamma.md | custom_mature_overdue_gamma | MIXED/UNKNOWN |
| 20260307-1325-mine-run-09-post_tutorial_long.md | post_tutorial_long | MIXED/UNKNOWN |
| 20260307-1325-mine-run-10-quiz_due_short.md | quiz_due_short | MIXED/UNKNOWN |
| 20260307-1325-mine-run-11-many_reviews_due_short.md | many_reviews_due_short | MIXED/UNKNOWN |
| 20260307-1325-mine-run-12-mid_dive_active_long.md | mid_dive_active_long | MIXED/UNKNOWN |
| 20260307-1329-mine-run-01-post_tutorial.md | post_tutorial | MIXED/UNKNOWN |
| 20260307-1330-mine-run-02-many_reviews_due.md | many_reviews_due | MIXED/UNKNOWN |
| 20260307-1332-mine-run-03-quiz_due.md | quiz_due | MIXED/UNKNOWN |
| 20260307-1333-mine-run-04-mid_dive_active.md | mid_dive_active | MIXED/UNKNOWN |
| 20260307-1334-mine-run-05-heavy_review_overdue.md | heavy_review_overdue | MIXED/UNKNOWN |
| 20260307-1335-mine-run-06-custom_mature_overdue_alpha.md | custom_mature_overdue_alpha | MIXED/UNKNOWN |
| 20260307-1337-mine-run-07-custom_mature_overdue_beta.md | custom_mature_overdue_beta | MIXED/UNKNOWN |
| 20260307-1338-mine-run-08-custom_mature_overdue_gamma.md | custom_mature_overdue_gamma | MIXED/UNKNOWN |
| 20260307-1339-mine-run-09-post_tutorial_long.md | post_tutorial_long | MIXED/UNKNOWN |
| 20260307-1340-mine-run-10-quiz_due_short.md | quiz_due_short | MIXED/UNKNOWN |
| 20260307-1342-mine-run-11-many_reviews_due_short.md | many_reviews_due_short | MIXED/UNKNOWN |
| 20260307-1343-mine-run-12-mid_dive_active_long.md | mid_dive_active_long | MIXED/UNKNOWN |
| 20260307-mine-run-13-quiz_due-long.md | `devpreset=quiz_due` | FAIL |
| 20260307-mine-run-14-many_reviews_due-long.md | `devpreset=many_reviews_due` | FAIL |
| 20260307-mine-run-15-custom-mature-a.md | custom_mature_a | FAIL |
| 20260307-mine-run-16-custom-mature-b.md | custom_mature_b | FAIL |
| 20260307-mine-run-17-mid_dive_active-long.md | mid_dive_active-long | MIXED/UNKNOWN |
| 20260307-mine-run-18-control-path.md | control path | FAIL |
| 20260307-mine-run-19-many_reviews_due-endhunt.md | endhunt | MIXED/UNKNOWN |
| 20260307-mine-run-20-custom-high-o2.md | custom high o2 | MIXED/UNKNOWN |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- [high] Console/runtime errors observed (6)
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due, 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long

- [HIGH] Custom save injection not reflected in loaded runtime save (reverted to default-like state).
  - Runs: 20260307-mine-run-20-custom-high-o2

- [HIGH] Dive controls unavailable on base (`btn-dive` absent, `btn-enter-mine` absent).
  - Runs: 20260307-mine-run-20-custom-high-o2

- [high] No progress for >60s (partial)
  - Runs: 20260307-1330-mine-run-02-many_reviews_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1342-mine-run-11-many_reviews_due_short

- [high] Runner exception: page.evaluate: Target page, context or browser has been closed
  - Runs: 20260307-1325-mine-run-03-quiz_due

- [high] Runner exception: page.goto: Target page, context or browser has been closed
  - Runs: 20260307-1325-mine-run-04-mid_dive_active, 20260307-1325-mine-run-05-heavy_review_overdue, 20260307-1325-mine-run-06-custom_mature_overdue_alpha, 20260307-1325-mine-run-07-custom_mature_overdue_beta, 20260307-1325-mine-run-08-custom_mature_overdue_gamma, 20260307-1325-mine-run-09-post_tutorial_long, 20260307-1325-mine-run-10-quiz_due_short, 20260307-1325-mine-run-11-many_reviews_due_short, 20260307-1325-mine-run-12-mid_dive_active_long

- **Severity**: [HIGH]
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 1 | [HIGH] | data | `deepestLayerReached` jumped from 8 to 19 in a single dive with only 58 blocks mined. This stat seems unreasonable — either it tracks something other than layer number, or descent is too easy
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 1 | [HIGH] | data | Consistency penalty not observable on deliberate mature wrong answer `cult-001` (expected extra O2 drain; observed `actualDrain=0` in save-level O2)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- 2 | [HIGH] | data | Consistency penalty not observable on deliberate mature wrong answer `cult-002` (expected extra O2 drain; observed `actualDrain=0` in save-level O2)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- 3 | [HIGH] | data | UI/store mismatch during dive: HUD remained `O2: 300/300` while `playerSave.oxygen` dropped to `0` in snapshots
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- cult-001 | 6 | 0 | 0 | mature wrong should apply extra drain | 0 | Fail
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- cult-002 | 7 | 0 | 0 | mature wrong should apply extra drain | 0 | Fail
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- factId | repetitions | O2 Before | O2 After | Expected Penalty | Actual Drain | Pass/Fail
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- Overall result: **FAIL** (high-severity mine-entry interaction defect present in primary control path).
  - Runs: 20260307-114154-many-reviews-due

### MEDIUM

- [medium] Blocks mined delta stayed zero despite mining inputs
  - Runs: 20260307-1329-mine-run-01-post_tutorial, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long

- [medium] Long-form target not met before timeout/exit
  - Runs: 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1337-mine-run-07-custom_mature_overdue_beta

- [medium] No block progress recorded despite active mining inputs
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due

- [medium] Run capped at 180s safety timeout
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due

- **Severity**: [COSMETIC] (downgraded from [MEDIUM])
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Severity**: [MEDIUM]
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Severity**: [MEDIUM] (testing gap)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 11 | [MEDIUM] | data | O2 max at layer 2 was 71 (matching current O2), not 300. The max O2 appears to be reset to current O2 on layer descent, meaning the O2 bar always shows "100%" even when severely depleted. This is misleading
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 12 | [MEDIUM] | pacing | 3 of 8 overdue review cards were never quizzed (cult-001, cult-005, cult-007, cult-008). With only 2 pop quizzes triggering in 58 blocks, many overdue cards go unreviewed in a single dive
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 2 | [MEDIUM] | behavioral | Dive results screen was bypassed/auto-dismissed. The diveResults store was null when checked. Arrow key presses may have clicked through it, or the screen auto-closed
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 3 | [MEDIUM] | pacing | Only 4 quizzes across 58 blocks mined (6.9% effective rate). 2 were pop quizzes, 2 were layer entrance. Expected ~8% base rate for pop quizzes alone. With only 48 eligible blocks (after 10-block minimum), this is ~4.2% pop quiz rate
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 4 | [MEDIUM] | behavioral | `120` key presses produced no increase in `totalBlocksMined` (remained `300`)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

- 4 | [MEDIUM] | pacing | Consistency penalty was never tested — all 4 quizzes were answered correctly. The skill/agent should force some wrong answers on mature cards to validate the penalty system
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 5 | [MEDIUM] | behavioral | Dive did not complete within capped loop; `diveResults` not reached/captured
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency

### LOW

- [low] Intentional wrong answer attempt not reflected in wrong delta
  - Runs: 20260307-1337-mine-run-07-custom_mature_overdue_beta

- **Severity**: [COSMETIC] (downgraded from [LOW])
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Severity**: [LOW]
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 10 | [LOW] | data | Console errors: 3 types of network failures (api/facts/packs/all 500, api/facts/delta 404, api/analytics/events 400). Expected without backend, but no graceful fallback message shown
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 5 | [LOW] | data | Only +16 dust gained from 58 blocks mined (0.28 dust/block). No shards, crystals, geodes, or essence. Mining rewards feel very low
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 6 | [LOW] | visual | HUD text "Layer 2 | D..." is truncated on mobile viewport. Full text not visible
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 7 | [LOW] | visual | Dome room labels aggressively truncated: "Companion H...", "Fossil Gall...", "Premium Mat...", "Upgrade Anv...", "Blueprint B...", "Hydroponic ...", "G.A.I.A. Te..."
  - Runs: 2026-03-07-1015-full-dive-20-cards

- 9 | [LOW] | behavioral | `zeroDiveSessions: 11` — Haiku agent reloaded the page 11 times before successfully entering the mine, suggesting the save injection flow is fragile
  - Runs: 2026-03-07-1015-full-dive-20-cards

### INFO

- **Blast Radius**: balance.ts constant only
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: HUD.svelte O2 display, MineScene.init(), OxygenSystem.ts
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: HUD.svelte, DomeScene room label rendering
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: MineBlockInteractor reward logic
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: MineGenerator (shaft placement), MineBlockInteractor (shaft interaction), GameManager (layer transition)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: None
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: None (skill improvement only)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Blast Radius**: Skill file only
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: behavioral (testing infrastructure)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: coverage
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: data
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: data/UX
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: pacing
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: pacing/balance
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Category**: visual
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Constants** (from `src/data/balance.ts:568-573`): `QUIZ_BASE_RATE=0.08`, `QUIZ_COOLDOWN_BLOCKS=15`, `QUIZ_FIRST_TRIGGER_AFTER_BLOCKS=10`, `QUIZ_FATIGUE_THRESHOLD=5`
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Impact**: Dust income feels low in dives where few mineral nodes spawn. Players who mine mostly terrain get rewards only through quizzes.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Impact**: None — informational display working as designed.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Impact**: Players can "speedrun" layers by finding descent shafts without meaningful mining. This bypasses the intended gameplay loop of exploring and mining a layer before descending. It also means quiz opportunities are sparse (fewer blocks = fewer quiz triggers).
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Impact**: Players can't tell how much total O2 they've consumed across layers. The bar is misleading — it looks full even when 76% of total O2 is gone. This removes urgency and makes O2 management feel trivial until sudden depletion.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Impact**: Pop quiz rate is working correctly but may feel sparse with short dives. Players who mine only 50-60 blocks will see 1-3 quizzes per dive.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Impact**: Testing infrastructure issue only. The playthrough skill should capture dive results immediately upon screen transition to 'diveResults', before any further interaction.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Needs Re-test**: No
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Needs Re-test**: Yes
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Needs Re-test**: Yes (balance testing)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Needs Re-test**: Yes (dedicated consistency penalty test)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Needs Re-test**: Yes (playthrough to validate feel)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Needs Re-test**: Yes (visual)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: "Layer 2 |D..." truncated in HUD, dome room labels heavily truncated
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: 2 pop quizzes in 58 blocks (4.2%)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: All 4 quizzes answered correctly. Consistency penalty (wrong answer on card with reps >= 4) was never triggered despite having 4 mature overdue cards.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: diveResults store was null when checked post-dive; results screen was already dismissed
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: O2 display showed "x1.1" at layer 2
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: O2 showed "71/71" at layer 2 start (100% bar), despite having consumed 229 of original 300 O2
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: Only +16 dust from 58 blocks (0.28 dust/block)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Observed**: Player reached layer 19 (of max 20) by mining only 58 blocks total across 19 layers (~3 blocks/layer)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: Consider a minimum blocks-mined requirement per layer before the descent shaft activates, or place descent shafts deeper in the mine grid so they require more excavation to reach. A simple gate: `if (blocksMindedThisLayer < MIN_BLOCKS_PER_LAYER) { showMessage("Mine deeper to stabilize the descent shaft") }`.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: Consider adding a small dust drop (1-2) for harder block types (Stone, HardRock) to make mining feel more rewarding per action.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: Consider reducing `QUIZ_COOLDOWN_BLOCKS` from 15 to 10 for a more engaging quiz cadence, especially for shorter dives. This would increase expected quizzes from ~2 to ~3 per 58-block session.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: For HUD: abbreviate "Layer" to "L" or stack depth on a second line. For dome labels: use smaller font or 2-line labels for room names.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: None needed. Could add a tooltip explaining "O2 costs increase with depth" on first encounter.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: Pass the original max O2 separately to MineScene, or track `originalMaxO2` as a field on OxygenState. Display the bar as `current / originalMax` rather than `current / layerMax`. Alternatively, show a secondary indicator "Total: 71/300".
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: Update `/playthrough` skill to instruct: "For any quiz where the fact has repetitions >= 5 (mature card), deliberately answer WRONG to test consistency penalty. Document the extra O2 drain."
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Proposed Fix**: Update the playthrough skill to poll `currentScreen` after every action and immediately capture `diveResults` store data when it transitions to 'diveResults'. No game code change needed.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: In `src/game/GameManager.ts:322-330`, `handleDescentShaft()` converts restored O2 to fractional tanks: `oxygenTanks = restoredOxygen / OXYGEN_PER_TANK`. Then `MineScene.init()` calls `createOxygenState(tanks)` which sets `max = tanks * 100`. Since tanks is fractional (0.71), max becomes 71 — matching current. The O2 bar always shows 100% on a new layer.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: Mobile viewport (412px width) doesn't have enough room for full labels. CSS `text-overflow: ellipsis` is aggressively cutting text.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: NOT a bug. Plain terrain blocks (Dirt, SoftRock, Stone, HardRock) give NO direct dust reward — they only trigger quiz opportunities. The 16 dust came exactly from 2 correct pop quizzes × 8 dust each (`RANDOM_QUIZ_REWARD_DUST=8` in `src/data/balance.ts:107`). Mineral Nodes (special blocks) give 5-15 dust but may not have been encountered.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: NOT a bug. The quiz system (`src/game/managers/QuizManager.ts:118-143`) uses: 8% base rate, 10-block minimum before first quiz, 15-block cooldown between quizzes. With expected ~12.5 blocks per trigger (1/0.08), first quiz fires around block 22, second around block 49. Getting 2 pop quizzes in 58 blocks is statistically expected. The 15-block cooldown is the primary limiter.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: The DiveResults component (`src/ui/components/DiveResults.svelte`) has NO keyboard handlers and NO auto-dismiss timer — only button clicks dismiss it. The Haiku agent (291 tool calls) likely clicked "Continue" before its context expired, properly dismissing the screen. This is expected behavior, not a game bug.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: The Haiku agent answered all quizzes correctly. The playthrough skill's instructions should enforce deliberate wrong answers on mature cards.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: The mine generator places descent shafts that can be reached with very few blocks mined. If the player moves through empty cells (which cost no O2 and don't count as blocks), they can locate descent shafts rapidly. `deepestLayerReached` is tracked in `src/ui/stores/playerData.ts:775-778` via `maxDepthThisRun` from GameManager.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Root Cause**: This is the O2 depth cost multiplier from `getO2DepthMultiplier(layer)` in `src/data/balance.ts:525-528`. Formula: `1.0 + (1.5 * layer / 19)`. At layer 2: 1.0 + 0.158 ≈ 1.16, displayed as "x1.1". This is working correctly — it tells the player that mining costs are 10% higher on this layer.
  - Runs: 2026-03-07-1015-full-dive-20-cards

- **Severity**: [COSMETIC]
  - Runs: 2026-03-07-1015-full-dive-20-cards

- # | Severity | Category | Description
  - Runs: 2026-03-07-1015-full-dive-20-cards, 2026-03-07-1230-3tanks-20cards-consistency

- ## Issue 1: O2 Max Resets on Layer Descent (HIGH)
  - Runs: 2026-03-07-fix-prompt

- ## Issue 2: Layer Speedrunning — No Mining Requirement for Descent (MEDIUM)
  - Runs: 2026-03-07-fix-prompt

- ### Issue 1: O2 Max Resets on Layer Descent — Misleading O2 Bar
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 2: deepestLayerReached = 19 with Only 58 Blocks Mined
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 3: Dive Results Screen Dismissed Without Observation
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 4: Pop Quiz Rate Analysis — Working as Designed
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 5: Mining Dust Rewards — Working as Designed
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 6: HUD Text Truncation on Mobile
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 7: O2 "x1.1" Multiplier Display
  - Runs: 2026-03-07-1015-full-dive-20-cards

- ### Issue 8: Consistency Penalty Never Tested
  - Runs: 2026-03-07-1015-full-dive-20-cards

- `__terraDebug().currentScreen`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt

- `WebSocket closed without opened.`
  - Runs: 20260307-114154-many-reviews-due

- 100 key actions were **not** executed (requirement gated on successful mine entry).
  - Runs: 20260307-mine-run-18-control-path

- 8 | [COSMETIC] | visual | O2 display shows "x1.1" multiplier — origin unclear (no relic or upgrade was equipped)
  - Runs: 2026-03-07-1015-full-dive-20-cards

- Additional resource load errors observed (`500`, `404`, `400`).
  - Runs: 20260307-mine-run-15-custom-mature-a

- Because `btn-dive` and `btn-enter-mine` are absent and screen remains `cutscene`, mine was not entered.
  - Runs: 20260307-mine-run-18-control-path

- Console errors observed:
  - Runs: 20260307-114154-many-reviews-due

- Correct outcomes: 0 observed
  - Runs: 20260307-mine-run-17-mid_dive_active-long

- COSMETIC | Quiz rate, dust rewards, text truncation | Working as designed; minor polish opportunities
  - Runs: 2026-03-07-1015-full-dive-20-cards

- deep scan of `__terraDebug().stores` for non-null `diveResults` fields
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt

- Deliberate wrong answer included: yes (Quiz 1)
  - Runs: 20260307-mine-run-14-many_reviews_due-long

- Deliberate wrong answers on mature cards: not possible (0/2) because no quiz appeared before forced dive end.
  - Runs: 20260307-mine-run-15-custom-mature-a

- Due-card selection evidence: **both prompted facts were due and had review states**.
  - Runs: 20260307-114154-many-reviews-due

- Final screen: `sacrifice`
  - Runs: 20260307-mine-run-14-many_reviews_due-long

- HIGH | O2 max resets per layer — misleading bar | Fix in GameManager/OxygenSystem
  - Runs: 2026-03-07-1015-full-dive-20-cards

- Incorrect outcomes: 0 observed
  - Runs: 20260307-mine-run-17-mid_dive_active-long

- Max key requirement (`<= 220`): not reached due to pre-run block.
  - Runs: 20260307-mine-run-16-custom-mature-b

- MEDIUM | Consistency penalty untested | Update playthrough skill
  - Runs: 2026-03-07-1015-full-dive-20-cards

- MEDIUM | Layer speedrunning (19 layers, 58 blocks) | Add min-blocks gate for descent shafts
  - Runs: 2026-03-07-1015-full-dive-20-cards

- Mine loop executed: no (0 key presses; blocked before dive/mine transition).
  - Runs: 20260307-mine-run-16-custom-mature-b

- Normal route is blocked before the first control button appears.
  - Runs: 20260307-mine-run-18-control-path

- Observation: never entered a dive/results state and no non-null `diveResults` path was detected.
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt

- Observed: only one quiz encounter during this run
  - Runs: 20260307-mine-run-13-quiz_due-long

- Outcome: blocked at first quiz state; wrong/correct pair could not both be completed in this single run
  - Runs: 20260307-mine-run-13-quiz_due-long

- Page errors observed:
  - Runs: 20260307-114154-many-reviews-due

- Priority | Issue | Action
  - Runs: 2026-03-07-1015-full-dive-20-cards

- Quiz interaction target met: **2 interactions completed, including 1 wrong answer**.
  - Runs: 20260307-114154-many-reviews-due

- Quiz interactions attempted: 2
  - Runs: 20260307-mine-run-14-many_reviews_due-long

- Quiz overlays encountered: 0
  - Runs: 20260307-mine-run-15-custom-mature-a

- Quiz overlays encountered: 0 detected
  - Runs: 20260307-mine-run-17-mid_dive_active-long

- Quiz responses made: 0
  - Runs: 20260307-mine-run-17-mid_dive_active-long

- Quiz trigger target (at least 2): not possible (0 quizzes seen).
  - Runs: 20260307-mine-run-16-custom-mature-b

- Repeated Vite HMR websocket connection errors (`ERR_CONNECTION_REFUSED`) in headless run.
  - Runs: 20260307-mine-run-15-custom-mature-a

- Requirement: intentionally answer one wrong and one correct if encountered
  - Runs: 20260307-mine-run-13-quiz_due-long

- Resource load errors: HTTP `500`, `404`, `400`
  - Runs: 20260307-114154-many-reviews-due

- Run remained playable and reached `diveResults` despite these errors.
  - Runs: 20260307-mine-run-15-custom-mature-a

- Runtime check used each step:
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt

- screen-name regex for results-like states
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt

- Vite HMR websocket connection refused (`ws://100.74.153.81:5173/...`)
  - Runs: 20260307-114154-many-reviews-due

- Wrong-answer requirement: not possible (0 quiz opportunities).
  - Runs: 20260307-mine-run-16-custom-mature-b

## Metrics and State Trends

- **Correct behavior confirmed:**
  - Runs: 2026-03-07-1015-full-dive-20-cards
- `__terraDebug().currentScreen`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `__terraDebug().stores.currentScreen`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `base` (forced via `terra:currentScreen.set('base')`)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `base` (stable for all 200 key actions)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `cutscene` -> `onboarding` (after key 4: `Enter`)
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `cutscene` (after 15 Enter presses)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `cutscene` (post-load)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `diveResults`: `null`
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- `globalThis[Symbol.for('terra:currentScreen')]?.get?.()`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `learnedFacts: 30`
  - Runs: 20260307-mine-run-20-custom-high-o2
- `null` -> `cutscene` (initial load)
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `onboarding` -> `studySession` (after key 12: `Enter`)
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `oxygen: 5`
  - Runs: 20260307-mine-run-20-custom-high-o2
- `playerSave.oxygen` | 3 | 0 | -3
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- `reviewStates: 10`
  - Runs: 20260307-mine-run-20-custom-high-o2
- `stats.totalBlocksMined` | 300 | 300 | 0
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- `stats.totalQuizCorrect` | 25 | 28 | +3
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- `stats.totalQuizWrong` | 5 | 5 | 0
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- `totalBlocksMined`: `300` (no delta)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- All reviewed cards correctly tagged with `lastReviewContext: "mine"`
  - Runs: 2026-03-07-1015-full-dive-20-cards
- All SM-2 interval multipliers match the easeFactor (expected behavior)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Blocks mined (end): **29**
  - Runs: 20260307-mine-run-13-quiz_due-long
- Blocks mined (start): **0**
  - Runs: 20260307-mine-run-13-quiz_due-long
- Blocks mined delta: **+29**
  - Runs: 20260307-mine-run-13-quiz_due-long
- Blocks mined delta: +39
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- Blocks mined delta: 0
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due, 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long
- Blocks mined end: 39
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- Blocks mined start: 0
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- blocks mined: `0`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Compared on each sample:
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Console error count: **5**
  - Runs: 20260307-mine-run-13-quiz_due-long
- Console error count: 6
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due, 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long
- Correct delta: 0
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due, 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long
- Correct delta: 1
  - Runs: 20260307-1332-mine-run-03-quiz_due
- cult-002 | ctx | — | mine | Correctly tagged
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-002 | interval | 5d | 13d | Pop quiz, correct (x2.6)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-002 | reps | 3 | 4 | —
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-003 | ctx | — | mine | Correctly tagged
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-003 | interval | 7d | 18d | Layer quiz, correct (x2.57)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-003 | reps | 3 | 4 | —
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-004 | ctx | — | mine | Correctly tagged
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-004 | interval | 9d | 23d | Layer quiz, correct (x2.55)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-004 | reps | 3 | 4 | —
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-006 | ctx | — | mine | Correctly tagged
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-006 | interval | 80d | 220d | Pop quiz, correct (x2.75)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- cult-006 | reps | 9 | 10 | —
  - Runs: 2026-03-07-1015-full-dive-20-cards
- debug screen: `studySession`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Desync events detected: **0**
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Dive prep verified with explicit 3-tank selection (`Estimated Oxygen: 300 O2`)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- dive results present: `false`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Dives completed: 10
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Dives completed: 11 (+1)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Due mature cards (`repetitions >= 5`): `cult-001` (6), `cult-002` (7), `cult-003` (8), `cult-004` (6), `cult-005` (7)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- Due-review pool during interactions: `30/30` then `29/30` (one due card appears to have been advanced)
  - Runs: 20260307-114154-many-reviews-due
- Dust: 800, Shards: 25, Crystals: 5, Geodes: 0, Essence: 0
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Dust: 816 (+16), Shards: 25, Crystals: 5, Geodes: 0, Essence: 0
  - Runs: 2026-03-07-1015-full-dive-20-cards
- End O2: **47**
  - Runs: 20260307-mine-run-13-quiz_due-long
- End O2: 0 (oxygenCurrent store)
  - Runs: 20260307-1342-mine-run-11-many_reviews_due_short
- End O2: 3 (oxygenCurrent store)
  - Runs: 20260307-1338-mine-run-08-custom_mature_overdue_gamma
- End O2: 38 (oxygenCurrent store)
  - Runs: 20260307-1329-mine-run-01-post_tutorial
- End O2: 5 (oxygenCurrent store)
  - Runs: 20260307-1309-mine-run-01-post_tutorial
- End O2: 53 (oxygenCurrent store)
  - Runs: 20260307-1340-mine-run-10-quiz_due_short
- End O2: 57 (oxygenCurrent store)
  - Runs: 20260307-1312-mine-run-02-many_reviews_due
- End O2: 63 (oxygenCurrent store)
  - Runs: 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1339-mine-run-09-post_tutorial_long
- End O2: 64 (oxygenCurrent store)
  - Runs: 20260307-1335-mine-run-06-custom_mature_overdue_alpha
- End O2: 66 (oxygenCurrent store)
  - Runs: 20260307-1334-mine-run-05-heavy_review_overdue
- End O2: 68 (oxygenCurrent store)
  - Runs: 20260307-1343-mine-run-12-mid_dive_active_long
- End O2: 76 (oxygenCurrent store)
  - Runs: 20260307-1332-mine-run-03-quiz_due
- End O2: 81 (oxygenCurrent store)
  - Runs: 20260307-1330-mine-run-02-many_reviews_due
- End O2: 96 (oxygenCurrent store)
  - Runs: 20260307-1333-mine-run-04-mid_dive_active
- End state: screen `mining`, O2 `2`
  - Runs: 20260307-114154-many-reviews-due
- Fact ID | Field | Before | After | Note
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Field | Before | After | Delta
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- final `playerSave.learnedFacts: 0`
  - Runs: 20260307-mine-run-20-custom-high-o2
- final `playerSave.oxygen: 3`
  - Runs: 20260307-mine-run-20-custom-high-o2
- final `playerSave.reviewStates: 0`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Final save oxygen tanks: `0`
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- Final screen: `mining`
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- Final state:
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- HUD O2 label | `3 O2` (base), then `300/300` in mine | `300/300` | no visible drain in HUD
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- HUD text at end: `O2: 300/300 x1.1` (unchanged display)
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- Injection payload written to localStorage successfully:
  - Runs: 20260307-mine-run-20-custom-high-o2
- Layer entrance quiz triggered: "Depth Calibration" title
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Learning cards (geo-002..004) were NOT quizzed in mine
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Multi-part quiz (2 questions required)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- New cards (geo-005, lsci-001..002) were NOT quizzed in mine
  - Runs: 2026-03-07-1015-full-dive-20-cards
- No further transitions occurred through key 53.
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Non-due review cards (cult-009, cult-010, geo-001) were NOT quizzed
  - Runs: 2026-03-07-1015-full-dive-20-cards
- O2 at transition: 71 (of original 300)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- O2 delta: -100
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- O2 end: 0
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- O2 start: 100
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- O2 Tanks: 3 (300 O2 points)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- O2 Tanks: 3 (restored after dive)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- playerSave learnedFacts/reviewStates: `0/0`
  - Runs: 20260307-mine-run-20-custom-high-o2
- playerSave oxygen tanks: `3`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Quiz correct start/end/delta: 200 -> 201 (**+1**)
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- quiz correct/wrong: `0/0`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Quiz count encountered: **1**
  - Runs: 20260307-mine-run-13-quiz_due-long
- Quiz count: 0 (encounters observed: 0)
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due
- Quiz count: 0 (quiz overlays seen: 0)
  - Runs: 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long
- Quiz count: 0 (quiz overlays seen: 47)
  - Runs: 20260307-1337-mine-run-07-custom_mature_overdue_beta
- Quiz count: 1 (quiz overlays seen: 50)
  - Runs: 20260307-1332-mine-run-03-quiz_due
- Quiz wrong start/end/delta: 25 -> 26 (**+1**)
  - Runs: 20260307-mine-run-14-many_reviews_due-long
- Relearning cards (lsci-003..005) were NOT quizzed in mine
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Rooms: command, lab, workshop
  - Runs: 2026-03-07-1015-full-dive-20-cards
- Runtime loaded state after app boot did not retain the injected payload:
  - Runs: 20260307-mine-run-20-custom-high-o2
- Save injection verified: `screen=base`, `oxygen=3`, `reviewStates=20`
  - Runs: 2026-03-07-1230-3tanks-20cards-consistency
- screen: `base`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Start O2: **100**
  - Runs: 20260307-mine-run-13-quiz_due-long
- Start O2: 0 (oxygenCurrent store)
  - Runs: 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long
- Start O2: 3 (playerSave.oxygen)
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due
- Start state: screen `cutscene`, O2 `3`, due reviews `30/30`
  - Runs: 20260307-114154-many-reviews-due
- store screen: `studySession`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- symbol screen: `null`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- This indicates the run executed against a fallback/default save state, not the intended custom save.
  - Runs: 20260307-mine-run-20-custom-high-o2
- Wrong delta: 0
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due, 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long

## Unique Notes / Gaps

- [info] Injected custom mature overdue cards
  - Runs: 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma
- [medium] Dive button path unavailable; forced currentScreen to divePrepScreen
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due
- [medium] Forced base screen due to non-base preset routing
  - Runs: 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1340-mine-run-10-quiz_due_short
- [medium] Forced divePrepScreen due to missing dive entry path
  - Runs: 20260307-1329-mine-run-01-post_tutorial, 20260307-1330-mine-run-02-many_reviews_due, 20260307-1332-mine-run-03-quiz_due, 20260307-1333-mine-run-04-mid_dive_active, 20260307-1334-mine-run-05-heavy_review_overdue, 20260307-1335-mine-run-06-custom_mature_overdue_alpha, 20260307-1337-mine-run-07-custom_mature_overdue_beta, 20260307-1338-mine-run-08-custom_mature_overdue_gamma, 20260307-1339-mine-run-09-post_tutorial_long, 20260307-1340-mine-run-10-quiz_due_short, 20260307-1342-mine-run-11-many_reviews_due_short, 20260307-1343-mine-run-12-mid_dive_active_long
- [medium] Preset landed on non-base gate screen; forced currentScreen to base
  - Runs: 20260307-1309-mine-run-01-post_tutorial, 20260307-1312-mine-run-02-many_reviews_due
- **Assessment**: Pop quiz rate feels low. With 15-block cooldown and 8% chance, expected ~3-4 pop quizzes in 48 blocks, got 2. Mining rewards feel minimal. Layer entrance quiz system works well with multi-part challenge.
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **Dust earned**: 16 dust from 58 blocks = 0.28 dust/block (feels low)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **Layer entrance quiz**: Multi-part (2 questions), functioned correctly
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **O2 consumption**: 300 → 71 in layer 1 (~229 consumed for 50 blocks ≈ 4.6 O2/block average)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **Pop quiz rate**: 2 pop quizzes / ~48 eligible blocks = ~4.2% (below 8% target)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **Quiz cards used**: 4 of 8 eligible overdue cards (50% coverage in one dive)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **Total blocks mined**: 58 (across 2 layers)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- **Total quizzes**: 4 (2 pop, 2 layer entrance)
  - Runs: 2026-03-07-1015-full-dive-20-cards
- `[vite] failed to connect to websocket (WebSocket closed without opened.)`
  - Runs: 20260307-mine-run-13-quiz_due-long
- `artifactsFound = 0`
  - Runs: 20260307-mine-run-15-custom-mature-a
- `base` (forced via `terra:currentScreen.set('base')`)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `base` (stable for all 200 key actions)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `btn-dive`: missing (`present: false`, `visible: false`)
  - Runs: 20260307-mine-run-18-control-path
- `btn-enter-mine`: missing (`present: false`, `visible: false`)
  - Runs: 20260307-mine-run-18-control-path
- `cutscene` (after 15 Enter presses)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `cutscene` (post-load)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `diveResults` availability observed: **No**
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- `Failed to load resource: 400 (Bad Request)`
  - Runs: 20260307-mine-run-13-quiz_due-long
- `Failed to load resource: 404 (Not Found)`
  - Runs: 20260307-mine-run-13-quiz_due-long
- `Failed to load resource: 500 (Internal Server Error)`
  - Runs: 20260307-mine-run-13-quiz_due-long
- `forced = true`
  - Runs: 20260307-mine-run-15-custom-mature-a
- `GET /api/facts/delta?since=0&limit=500`
  - Runs: 20260307-mine-run-16-custom-mature-b
- `http://localhost:5173?skipOnboarding=true` (load)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `http://localhost:5173` (inject)
  - Runs: 20260307-mine-run-20-custom-high-o2
- `hud-o2-bar`: missing (`present: false`)
  - Runs: 20260307-mine-run-18-control-path
- `totalBlocksMined = 44`
  - Runs: 20260307-mine-run-15-custom-mature-a
- `totalQuizCorrect = 0`, `totalQuizWrong = 0`
  - Runs: 20260307-mine-run-15-custom-mature-a
- `WebSocket connection to 'ws://100.74.153.81:5173/?token=...' failed: net::ERR_CONNECTION_REFUSED`
  - Runs: 20260307-mine-run-13-quiz_due-long
- Additional resource load errors observed (`500`, `404`, `400`).
  - Runs: 20260307-mine-run-15-custom-mature-a
- Attempt at least 2 quiz interactions, including one wrong answer
  - Runs: 20260307-114154-many-reviews-due
- Attempted dive controls, but `btn-dive` and `btn-enter-mine` were not present
  - Runs: 20260307-mine-run-20-custom-high-o2
- Attempted to reach base from `cutscene`
  - Runs: 20260307-mine-run-20-custom-high-o2
- Because session options were disabled on `studySession`, progression to mine/dive flow was blocked, so dive end could not be reached in this run.
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Block reason: `Quiz encountered (1) but required wrong/correct pair not both submitted`
  - Runs: 20260307-mine-run-13-quiz_due-long
- Block reason: no screen transition for 41 consecutive inputs on `studySession`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Capture O2/state deltas and console errors
  - Runs: 20260307-114154-many-reviews-due
- Console errors observed during blocked run:
  - Runs: 20260307-mine-run-16-custom-mature-b
- Continued run via direct GameManager fallback (`startDive(1)` + `forceQuiz()`) to complete quiz validation.
  - Runs: 20260307-114154-many-reviews-due
- Dive end reached: **No**
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Dive ended early: No
  - Runs: 20260307-mine-run-13-quiz_due-long
- Dive ended on `diveResults` at 145 keys with `oxygenCurrent = 0`.
  - Runs: 20260307-mine-run-15-custom-mature-a
- End state evidence: `End screen=quiz O2=47 blocks=29`
  - Runs: 20260307-mine-run-13-quiz_due-long
- End-of-dive state:
  - Runs: 20260307-mine-run-15-custom-mature-a
- Entered mine flow via forced `divePrepScreen` fallback, then mine loaded.
  - Runs: 20260307-mine-run-15-custom-mature-a
- Executed key presses before block: 76
  - Runs: 20260307-mine-run-13-quiz_due-long
- Final screen: `quiz`
  - Runs: 20260307-mine-run-13-quiz_due-long
- Forced `terra:currentScreen` to `base` after no transition on Enter
  - Runs: 20260307-mine-run-20-custom-high-o2
- Full dive path attempt:
  - Runs: 20260307-mine-run-20-custom-high-o2
- Initial state (`window.__terraDebug()`): `currentScreen: "cutscene"`
  - Runs: 20260307-mine-run-18-control-path
- Key presses executed: 145 (within max 180).
  - Runs: 20260307-mine-run-15-custom-mature-a
- Log tail evidence (`window.__terraLog`): `{"event":"state-change"}` only; no mine-entry signal
  - Runs: 20260307-mine-run-18-control-path
- Mine state observed:
  - Runs: 20260307-mine-run-15-custom-mature-a
- O2 declined with movement to 4 by ~60 keys, then stayed near 4 until forced dive end.
  - Runs: 20260307-mine-run-15-custom-mature-a
- Outcome: **blocked before mine entry**
  - Runs: 20260307-mine-run-20-custom-high-o2
- Outcome: **partial-blocked-or-timebox**
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Preset context reflected a due-heavy review set at prompt time (`30/30` due initially).
  - Runs: 20260307-114154-many-reviews-due
- Primary mine entry control was blocked in automated DOM flow (`[data-testid="btn-dive"]` unavailable), marked as a high-severity interaction defect.
  - Runs: 20260307-114154-many-reviews-due
- Raw run data captured at: `/tmp/mine-run-16-custom-mature-b.json`
  - Runs: 20260307-mine-run-16-custom-mature-b
- repeated analytics endpoint failures on `localhost:3001`
  - Runs: 20260307-mine-run-16-custom-mature-b
- Repeated Vite HMR websocket connection errors (`ERR_CONNECTION_REFUSED`) in headless run.
  - Runs: 20260307-mine-run-15-custom-mature-a
- Request failures included:
  - Runs: 20260307-mine-run-16-custom-mature-b
- Resource failures (`500`, `404`)
  - Runs: 20260307-mine-run-16-custom-mature-b
- Run remained playable and reached `diveResults` despite these errors.
  - Runs: 20260307-mine-run-15-custom-mature-a
- Runtime diagnostics observed during run:
  - Runs: 20260307-mine-run-13-quiz_due-long
- Start in mine: `oxygenCurrent = 100/100`, `saveOxygenTanks = 2`
  - Runs: 20260307-mine-run-15-custom-mature-a
- Start state evidence: `Start screen=mining O2=100 blocks=0`
  - Runs: 20260307-mine-run-13-quiz_due-long
- Store evidence (`globalThis[Symbol.for('terra:currentScreen')]`): object present, `hasGet: false`, derived value: `null`
  - Runs: 20260307-mine-run-18-control-path
- Target key presses: 180
  - Runs: 20260307-mine-run-13-quiz_due-long
- The run completed with 140 key actions, but runtime telemetry hooks and HUD selectors used for observation returned no usable values.
  - Runs: 20260307-mine-run-17-mid_dive_active-long
- This report is intentionally partial per instruction because runtime save verification failed after one retry.
  - Runs: 20260307-mine-run-16-custom-mature-b
- This report is therefore partial: movement input was executed, but hazard/O2/quiz state could not be confirmed from accessible headless runtime signals.
  - Runs: 20260307-mine-run-17-mid_dive_active-long
- This run stayed within the keypress budget and remained a single playthrough session.
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Total key actions executed: **200**
  - Runs: 20260307-mine-run-20-custom-high-o2
- Total key presses used: **53**
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- URL loaded: `http://localhost:5173/?skipOnboarding=true&devpreset=post_tutorial`
  - Runs: 20260307-mine-run-18-control-path
- URL sequence:
  - Runs: 20260307-mine-run-20-custom-high-o2
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due`
  - Runs: 20260307-mine-run-19-many_reviews_due-endhunt
- Validate quiz frequency and due-card selection
  - Runs: 20260307-114154-many-reviews-due
- Vite websocket failures (`ERR_CONNECTION_REFUSED`, websocket closed before open)
  - Runs: 20260307-mine-run-16-custom-mature-b

## Source Files

- mine/2026-03-07-1015-full-dive-20-cards.md
- mine/2026-03-07-1230-3tanks-20cards-consistency.md
- mine/2026-03-07-fix-prompt.md
- mine/20260307-114154-many-reviews-due.md
- mine/20260307-1309-mine-run-01-post_tutorial.md
- mine/20260307-1312-mine-run-02-many_reviews_due.md
- mine/20260307-1325-mine-run-03-quiz_due.md
- mine/20260307-1325-mine-run-04-mid_dive_active.md
- mine/20260307-1325-mine-run-05-heavy_review_overdue.md
- mine/20260307-1325-mine-run-06-custom_mature_overdue_alpha.md
- mine/20260307-1325-mine-run-07-custom_mature_overdue_beta.md
- mine/20260307-1325-mine-run-08-custom_mature_overdue_gamma.md
- mine/20260307-1325-mine-run-09-post_tutorial_long.md
- mine/20260307-1325-mine-run-10-quiz_due_short.md
- mine/20260307-1325-mine-run-11-many_reviews_due_short.md
- mine/20260307-1325-mine-run-12-mid_dive_active_long.md
- mine/20260307-1329-mine-run-01-post_tutorial.md
- mine/20260307-1330-mine-run-02-many_reviews_due.md
- mine/20260307-1332-mine-run-03-quiz_due.md
- mine/20260307-1333-mine-run-04-mid_dive_active.md
- mine/20260307-1334-mine-run-05-heavy_review_overdue.md
- mine/20260307-1335-mine-run-06-custom_mature_overdue_alpha.md
- mine/20260307-1337-mine-run-07-custom_mature_overdue_beta.md
- mine/20260307-1338-mine-run-08-custom_mature_overdue_gamma.md
- mine/20260307-1339-mine-run-09-post_tutorial_long.md
- mine/20260307-1340-mine-run-10-quiz_due_short.md
- mine/20260307-1342-mine-run-11-many_reviews_due_short.md
- mine/20260307-1343-mine-run-12-mid_dive_active_long.md
- mine/20260307-mine-run-13-quiz_due-long.md
- mine/20260307-mine-run-14-many_reviews_due-long.md
- mine/20260307-mine-run-15-custom-mature-a.md
- mine/20260307-mine-run-16-custom-mature-b.md
- mine/20260307-mine-run-17-mid_dive_active-long.md
- mine/20260307-mine-run-18-control-path.md
- mine/20260307-mine-run-19-many_reviews_due-endhunt.md
- mine/20260307-mine-run-20-custom-high-o2.md
