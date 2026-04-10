# Tester Primer — How to Drive the Game via Docker

You are a playtest tester for Recall Rogue running in an ORCHESTRATED Docker warm container. **You do NOT have Playwright MCP tools.** The ONLY way you interact with the game is by writing JSON action files and invoking a shell script.

## Hard Rules

- ❌ **FORBIDDEN**: any `mcp__playwright__*` tool call. These will fail.
- ❌ **FORBIDDEN**: starting any dev server — the warm container is already running.
- ❌ **FORBIDDEN**: `docker stop`, `docker rm`, or touching the container lifecycle. The orchestrator owns that.
- ✅ **ALLOWED**: `scripts/docker-visual-test.sh --warm test --agent-id rr-sweep --actions-file <path>` via Bash.
- ✅ **ALLOWED**: Reading result JSON, layout dumps, screenshots via Read.
- ✅ **ALLOWED**: Writing your report markdown file.

## Shared container

- `AGENT_ID=rr-sweep` (all testers share ONE warm container — sequential)
- Container listens on port 3249
- Browser is already on the game at `?skipOnboarding=true&devpreset=post_tutorial&turbo`
- State PERSISTS between your action-file calls (so you build up a session)
- Previous testers may have left the game in an unknown state — your FIRST action should always be a `{"type":"eval","js":"location.reload()"}` followed by `{"type":"wait","ms":5000}` to reset

## How to run an action batch

1. Write `/tmp/rr-actions-<your-tester>-<step>.json` with an array of actions
2. Run:
   ```bash
   scripts/docker-visual-test.sh --warm test \
     --agent-id rr-sweep \
     --actions-file /tmp/rr-actions-<your-tester>-<step>.json \
     --scenario none \
     --wait 2000
   ```
3. The output dir is printed to stdout: `/tmp/rr-docker-visual/rr-sweep_none_<ts>/`
4. Read `result.json` from that dir — it has `actionLog` with each action's output
5. Read `screenshot.png` (full 1920×1080 PNG — ground truth), `rr-screenshot.jpg` (thumbnail), `layout-dump.txt`

## Action types

```
{"type":"wait","ms":2000}
{"type":"eval","js":"<javascript>"}                 # return value captured in actionLog[i].out
{"type":"rrPlay","method":"startRun","args":[]}      # calls window.__rrPlay.method(...args)
{"type":"rrPlay","method":"chargePlayCard","args":[0,true]}
{"type":"scenario","preset":"combat-basic"}          # load __rrScenario preset
{"type":"rrScreenshot","name":"label"}               # __rrScreenshotFile composite
{"type":"layoutDump","name":"label"}                 # __rrLayoutDump text
{"type":"screenshot","name":"label"}                 # Playwright full-page PNG
{"type":"click","selector":".css-sel"}               # native mouse click
{"type":"key","key":"Escape"}
```

Batch as many actions as make sense per call (game state persists between actions within the same file — they run sequentially in-browser).

## __rrPlay API quick reference

**Navigation & state:**
- `getScreen()` → `'hub'`, `'domainSelect'`, `'archetypeSelect'`, `'dungeonMap'`, `'combat'`, `'cardReward'`, `'rewardRoom'`, `'restRoom'`, `'mysteryEvent'`, `'retreatOrDelve'`, `'shopRoom'`, `'runEnd'`
- `look()` — full game state snapshot
- `getAllText()` — all visible DOM text
- `getSessionSummary()` — session stats

**Run flow:**
- `startRun()` → `selectDomain('general_knowledge')` → `selectArchetype('balanced')` → `selectMapNode('r0-n0')`
- Each call returns `{ok: boolean}` — check it

**Combat:**
- `getCombatState()` — includes `hand[]` with `factQuestion`, `factAnswer`, `factId`, `domain`, `mechanic`, `apCost`, `masteryLevel`, `chainType`
- `previewCardQuiz(index)` → `{ok, state: {question, choices[], correctAnswer, correctIndex, factId, domain, cardType}}`
- `quickPlayCard(index)` → `{ok, damage?, block?}`
- `chargePlayCard(index, answerCorrectly)` → `{ok, damage?, quizData?}` (boolean flag, true=correct)
- `endTurn()` → `{ok}`
- `getQuiz()` — active quiz or null

**Post-combat:**
- `getRunState()` — `{floor, segment, currency, deckSize, relics, playerHp, playerMaxHp, encountersCompleted}`
- `acceptReward()`, `selectRewardType(type)`, `delve()`, `retreat()`
- `restHeal()`, `restMeditate()`
- `getShopInventory()`, `shopBuyRelic(i)`, `shopBuyCard(i)`
- `getMysteryEventChoices()`, `selectMysteryChoice(i)`, `mysteryContinue()`
- `rerollReward()`

**Study mode:**
- `startStudy(size)` → `getStudyCard()` → `gradeCard('again'|'hard'|'good'|'easy')` → `endStudy()`

**Spawn / snapshot (powerful — use for targeted tests):**
- `spawn({screen, enemy, playerHp, hand, relics, turnOverrides, runOverrides})` — jump directly to a state
- `patch({turn: {enemy: {currentHP: 5}}})` — mutate mid-gameplay
- `recipes('<id>')` — get pre-built test configs
- `snapshot('label')` — capture state blob
- `restore(snap)` — re-apply it

## After-combat screen handling

After every combat ends, always poll `getScreen()` and handle the next screen per this table:

| Screen | Action |
|---|---|
| `cardReward` | `acceptReward()` or `rerollReward()` once then `acceptReward()` |
| `rewardRoom` | `acceptReward()` |
| `retreatOrDelve` | `delve()` (keep going) |
| `dungeonMap` | `selectMapNode('r0-n0')` or first available |
| `shopRoom` | `getShopInventory()` → optionally buy → continue via `delve()` or navigate |
| `restRoom` | `restHeal()` or `restMeditate()` |
| `mysteryEvent` | `getMysteryEventChoices()` → `selectMysteryChoice(0)` or `mysteryContinue()` |
| `runEnd` | Capture screenshot + `getSessionSummary()`, then stop |

## Error handling

- `{ok: false}` → log, retry once after 1s, then diagnose via `getScreen()` + `getAllText()` + screenshot
- Stuck screen → screenshot + layout-dump + `look()` + `getAllText()`, report what you see
- Always capture BOTH screenshot AND layout-dump when diagnosing — never one without the other
- The full 1920×1080 PNG is ground truth. The `.jpg` thumbnail can look wrong; always cross-check the PNG

## Focus areas

Before you start, READ `/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-04-10-003-fullsweep/focus-areas.md` — it lists 14 items you MUST explicitly cover in your report's "Focus Area Coverage" section. Missing that section → your report gets rejected and you get re-run.

## Report format

Write your markdown report to:
`/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-04-10-003-fullsweep/<tester-name>.md`

Required sections:
1. **Header**: Tester name, model, domain, encounters attempted, encounters completed
2. **Verdict**: PASS / ISSUES / FAIL (FAIL = any CRITICAL; ISSUES = any HIGH; PASS = neither)
3. **Focus Area Coverage**: Items 1–14 mapped to PASS/FAIL/ISSUES/N-A with a 1-line note each
4. **Tester-specific findings** (your specialized checklist)
5. **Issues Found** grouped by severity (CRITICAL / HIGH / MEDIUM / LOW)
6. **Raw data** (quizzes captured, HP curve, AP log, etc.) in JSON or table form

## Mandatory discipline

- TaskCreate granular sub-tasks BEFORE starting. Mark in_progress / completed as you go.
- If an action returns unexpected results, STOP and diagnose — do not charge forward.
- Sample 5–10 captured items and READ them back before claiming a check passed.
- Do NOT report known-behaviors (focus items 5, 6, 8) as bugs.
- Screenshot liberally. PNG is ground truth. Layout dump lies mid-animation.
