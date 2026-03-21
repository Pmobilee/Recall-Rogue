# Scenario Playtest — Recall Rogue

Conduct visual playtesting of Recall Rogue using AI agents as alpha testers. Agents navigate the real game UI via Playwright MCP tools, play combat, answer quizzes, and report all issues found.

This skill is for **visual, browser-based** testing. For headless mathematical simulations, use `/bot-playtest` instead.

---

## Quick Commands

| Command | Scenarios | Workers | Description |
|---------|-----------|---------|-------------|
| `/scenario-playtest smoke` | 01 | 1 | Quick full-run smoke test |
| `/scenario-playtest combat` | 03 | 1 | Deep combat mechanics test |
| `/scenario-playtest audit` | 02 + 07 | 2 | Hub menus + visual sprite audit |
| `/scenario-playtest quiz` | 08 | 1 | Quiz data quality check |
| `/scenario-playtest full` | 01-08 | 4 | Comprehensive test (parallel batches) |
| `/scenario-playtest onboarding` | 11 | 1 | First-time user experience |
| `/scenario-playtest edge` | 12 | 1 | Stress & edge case testing |
| `/scenario-playtest all` | 01-12 | 6 | Everything (parallel batches) |
| `/scenario-playtest {N}` | Scenario N | 1 | Run a specific scenario by number |

---

## Scenario Index

| # | Name | Tests | Est. Time |
|---|------|-------|-----------|
| 01 | Full Run Smoke Test | Hub → combat → reward → retreat → run end | 3 min |
| 02 | Hub & Menu Inspection | All hub buttons, library, settings, profile | 2 min |
| 03 | Combat Deep Dive | 3 encounters, card play, quiz, combos, damage | 4 min |
| 04 | Special Rooms | Shop, rest room, mystery event | 3 min |
| 05 | Card Reward & Deck Building | Reward selection, type strategy, deck growth | 2 min |
| 06 | Retreat, Delve & Run End | Checkpoint decisions, run end, play again | 2 min |
| 07 | Sprite & Visual Audit | Enemy sprites, card art, backgrounds | 3 min |
| 08 | Quiz Data Quality | 10+ quizzes, choice uniqueness, answer correctness | 3 min |
| 09 | Domain & Archetype Matrix | Multiple domain × archetype combos | 3 min |
| 10 | Settings, Library & Profile | Non-run hub screens, deck builder | 2 min |
| 11 | Onboarding Flow | First-time: age gate → tutorial → first combat | 3 min |
| 12 | Stress & Edge Cases | Low HP, max combo, rapid clicks, defeat | 3 min |

---

## Execution Model

### Orchestrator Protocol (Opus)

1. **Read user request** — determine which scenarios to run
2. **Ensure dev server** is running at `http://localhost:5173`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
   ```
   If not running: `cd /root/terra-miner && npm run dev &` and wait 8s.

3. **For each scenario**, spawn a Haiku worker (`model: "haiku"`) with:
   - The shared protocol (read from `.claude/commands/scenario-playtest-scenarios/00-SHARED-PROTOCOL.md`)
   - The specific scenario (read from `.claude/commands/scenario-playtest-scenarios/{NN}-{name}.md`)
   - Worker prompt template (see below)

4. **Run independent scenarios in parallel** (max 4 concurrent):
   - Batch 1: 01 + 02 (independent)
   - Batch 2: 03 + 07 (independent)
   - Batch 3: 04 + 08 (independent)
   - Batch 4: 05 + 06 + 09 + 10 (independent)
   - Sequential: 11, 12 (may need clean state)

5. **Collect reports** from `/tmp/playtest-{scenario}.json`
6. **Triage findings** — for each CONFIRMED-BUG or LIKELY-BUG, search source code for root cause
7. **Report to user** with summary table + top issues + fix proposals

### Worker Prompt Template

```
You are an alpha tester for Recall Rogue, a card roguelite knowledge game.
Follow the protocol and scenario below EXACTLY. Report ALL issues you find.

Use MCP Playwright tools to interact with the game:
- browser_navigate: go to URLs
- browser_click: click elements by CSS selector (always use force: true)
- browser_evaluate: run JavaScript in the page
- browser_take_screenshot: capture visual state (max 8 per scenario). ALWAYS use the MCP tool `mcp__playwright__browser_take_screenshot`. NEVER use `page.screenshot()` via `browser_run_code` (Phaser RAF blocks it) or `newCDPSession()` (hangs permanently).
- browser_snapshot: read DOM text (cheap, use liberally)
- browser_console_messages: check for JS errors

Dev server: http://localhost:5173

## PROTOCOL
{paste contents of 00-SHARED-PROTOCOL.md here}

## SCENARIO
{paste contents of specific scenario file here}

IMPORTANT:
- Do NOT report WebSocket, HMR, CORS, API 404, or GPU stall messages as bugs
- Use browser_snapshot (cheap) for state checks, browser_take_screenshot only at checkpoints
- Write report JSON to /tmp/playtest-{scenario-id}.json
- Write markdown summary to /tmp/playtest-{scenario-id}-summary.md
- If stuck on any screen for >10s, take screenshot, log issue, try to continue
- A partial report with clear data beats a run that exhausted context

CRITICAL — ELEMENT DISCOVERY & EVALUATION:
- At EVERY screenshot checkpoint, you MUST run the Runtime Element Discovery protocol (Step 1 in the Shared Protocol) via browser_evaluate BEFORE taking the screenshot
- After discovery, generate a per-element checklist asking BOTH objective questions (size, visibility, data artifacts, broken images) AND subjective questions (clarity, feel, fun, polish, would a new player understand this?)
- Evaluate EVERY discovered element — do not skip any. Total evaluated must equal total discovered.
- Answer the scenario-specific evaluation questions listed in the scenario file
- End your report with holistic subjective impressions: emotion evoked, visual polish rating 1-10, #1 improvement suggestion, and whether this screen makes you want to keep playing
- Your report quality is measured by HOW MANY elements you evaluated and HOW SPECIFIC your assessments are. Generic "looks fine" is a FAILURE.
```

### Execution Paths

| Environment | Method | Tools |
|-------------|--------|-------|
| Claude Code (interactive) | MCP Playwright tools | browser_navigate, browser_click, browser_evaluate, etc. |
| Codex (headless) | Node.js scripts | Write .cjs files using playwright-core, run with `node` |
| Other AI tools | Read scenario files | Follow steps manually with available browser automation |

For Codex workers: see the "Codex / Script Path Boilerplate" section in `00-SHARED-PROTOCOL.md`.

---

## Report Aggregation

After all workers complete, the orchestrator:

1. Reads each `/tmp/playtest-{id}.json` report
2. Reads each `/tmp/playtest-{id}-summary.md`
3. Compiles a combined summary:

```markdown
## Playtest Results — {date}

### Scenarios Run
| # | Name | Verdict | Issues | Time |
|---|------|---------|--------|------|
| 01 | Full Run | PASS | 0 | 2m |
| 03 | Combat | PASS_WITH_ISSUES | 2 | 4m |

### Top Issues
| # | Severity | Screen | Title | Confidence |
|---|----------|--------|-------|------------|
| 1 | HIGH | combat | Damage number behind sprite | CONFIRMED-BUG |

### Fix Proposals
For each CONFIRMED-BUG:
- Root cause (file:line)
- Proposed fix
- Blast radius
```

4. For `CONFIRMED-BUG` items, searches source code to identify root causes and proposes fixes
5. Optionally saves combined report to `docs/playtests/visual/YYYY-MM-DD-results.md`

---

## Batch Playtest System

For tracked, repeatable playtests:

### Create a Batch
1. Scan `docs/playtests/active/` for next batch number
2. Create `docs/playtests/active/{NNN}-{description}/`
3. Create manifest with scenario list and objectives
4. Create `results/` subdirectory

### Run a Batch
1. Read batch manifest
2. Execute each scenario per manifest
3. Write results to batch `results/` folder
4. When complete, move batch to `docs/playtests/completed/`

---

## API Reference — window.__terraPlay

Available in dev mode. Workers can use these via `browser_evaluate`:

### Run Management
| Method | Returns | Description |
|--------|---------|-------------|
| `startRun()` | PlayResult | Click Start Run button |
| `selectDomain(id)` | PlayResult | Select knowledge domain |
| `selectArchetype(id)` | PlayResult | Select combat archetype |

### Combat
| Method | Returns | Description |
|--------|---------|-------------|
| `getCombatState()` | object | Player HP, enemy, hand, combo, turn |
| `playCard(index)` | PlayResult | Select card in hand |
| `answerQuiz(index)` | PlayResult | Click quiz answer |
| `answerQuizCorrectly()` | PlayResult | Auto-answer correct |
| `answerQuizIncorrectly()` | PlayResult | Auto-answer wrong |
| `endTurn()` | PlayResult | End combat turn |

### Navigation & Rewards
| Method | Returns | Description |
|--------|---------|-------------|
| `selectRoom(index)` | PlayResult | Pick room door |
| `acceptReward()` | PlayResult | Accept card reward |
| `selectRewardType(type)` | PlayResult | Pick reward card type |
| `retreat()` | PlayResult | Cash out at checkpoint |
| `delve()` | PlayResult | Continue deeper |
| `getRunState()` | object | Floor, segment, gold, deck, HP |

### Perception
| Method | Returns | Description |
|--------|---------|-------------|
| `look()` | string | Text description of current screen |
| `getScreen()` | string | Current screen name |
| `getAllText()` | object | All visible text by testid/class |
| `getQuiz()` | object/null | Active quiz data |
| `validateScreen()` | object | Sanity check for anomalies |

### Meta
| Method | Returns | Description |
|--------|---------|-------------|
| `navigate(screen)` | PlayResult | Set screen directly |
| `getSave()` | object | Full player save |
| `getStats()` | object | Key stat values |
| `resetToPreset(id)` | PlayResult | Load a dev preset |
| `getRecentEvents(n)` | array | Last N log entries |

---

## Known Limitations

- **Phaser canvas**: Playwright CANNOT click Phaser canvas objects. All interactive UI is DOM-based (Svelte overlays), which works fine.
- **No backend**: API calls will 404. The game works offline — this is expected.
- **Headless animations**: Some animations may not render in headless mode. Use screenshots to verify visual state.
- **Audio**: Cannot test audio in headless mode.

---

## Designing Custom Playthroughs

To create a new scenario:

1. Create a file in `.claude/commands/scenario-playtest-scenarios/{NN}-{name}.md`
2. Follow the template:
   ```
   # Scenario NN: Title
   ## Goal (1 sentence)
   ## Preset (URL with params)
   ## Steps (numbered, with exact selectors from 00-SHARED-PROTOCOL.md)
   ## Screenshot Checkpoints (numbered, max 8)
   ## Checks (assertions to validate)
   ## Report (output file paths)
   ```
3. Add it to the Scenario Index in this file
4. Test by running: `/scenario-playtest {NN}`

### Good Scenario Design Principles
- **One focus per scenario** — don't test everything at once
- **Exact selectors** — workers follow instructions literally
- **Fallback paths** — what to do if expected screen doesn't appear
- **Max 8 screenshots** — use snapshots for everything else
- **Concrete checks** — "HP is a number" not "things look right"
- **Time-bounded** — abort conditions to prevent infinite loops
