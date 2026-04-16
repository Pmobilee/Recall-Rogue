---
name: llm-playtest
description: |
  Batch LLM playtest orchestrator. Spawns Sonnet sub-agents to actually PLAY the game through Playwright MCP + __rrPlay API, each with a unique testing focus (quiz quality, balance curve, fun/engagement, study temple). Produces per-tester reports and a combined summary in data/playtests/llm-batches/. Complements /strategy-analysis (static reasoning about hypothetical states) and /visual-inspect (screenshots) by providing live gameplay with LLM reasoning — the only method that tests real quiz content, actual run flow, and subjective engagement.
user_invocable: true
model: sonnet
---

# /llm-playtest — Live LLM Game Playtest Orchestrator

## 🚨 DOCKER-ONLY — MANDATORY, NO EXCEPTIONS

**This skill runs EXCLUSIVELY in Docker warm containers via `scripts/docker-visual-test.sh --warm`. Local `npm run dev` + Playwright MCP is PROHIBITED.** The canonical rule lives in `.claude/rules/testing.md` § "Docker-Only LLM Playtests". Re-read that rule before every batch — it is the single source of truth for the Docker-only workflow. Summary:

- ✅ ALLOWED: `scripts/docker-visual-test.sh --warm start|test|stop --agent-id <id>` with `--actions-file <json>`
- ❌ FORBIDDEN: `mcp__playwright__browser_*` against `http://localhost:5173` in any tester sub-agent prompt
- ❌ FORBIDDEN: starting `npm run dev` as a prerequisite
- ❌ FORBIDDEN: leaving a warm container running after the batch completes — always `--warm stop` in a try/finally

**Every tester sub-agent prompt spawned by this skill MUST include the hard constraint:** *"NEVER call `mcp__playwright__*`. The ONLY browser access is `scripts/docker-visual-test.sh --warm test --actions-file`."*

The orchestrator wraps the entire batch in a deterministic try/finally so container teardown runs even if testers crash.

---

## Reference Sub-Files — Read Before You Start

This skill is organized into an overview (this file) and three reference sub-files under `.claude/skills/llm-playtest/references/`. Load them on demand by file path.

| Sub-file | Read when |
|---|---|
| [`references/profiles.md`](references/profiles.md) | Spawning any tester — contains the full self-contained prompt for all 5 profiles (quiz-quality, balance-curve, fun-engagement, study-temple, full-run). Copy the relevant block into the sub-agent spawn. |
| [`references/action-specs.md`](references/action-specs.md) | Building actions-files, calling `__rrPlay`, handling errors, understanding the known behaviors that are NOT bugs. |
| [`references/artifacts.md`](references/artifacts.md) | Output directory layout, per-tester report formats, combined SUMMARY.md format, registry stamping. |

---

## What This Skill Does

Spawns Sonnet sub-agents that **actually play the game** through a Docker warm container using the `window.__rrPlay` API. Each agent has a different testing focus and writes a structured report. The orchestrator aggregates all reports into a combined `SUMMARY.md`.

This is NOT screenshot-based visual testing, NOT static balance analysis, NOT a heuristic bot. This is an LLM with real reasoning that interacts with live game systems, reads quiz content, makes choices, and reports what it finds.

---

## 🚨 Hallucination Rate — Verify Every Issue Claim

**LLM playtest sub-agents hallucinate ~30% of reported issues.** BATCH-2026-04-15-001 confirmed this with three fabricated bugs that checked out as false on source code inspection:
- A fact ID that didn't exist in any deck
- A status effect value claimed as "30-5%" when source showed 50%
- A softlock scenario that was explicitly handled in `turnManager.ts`

**Hallucinated bugs tend to be:** specific enough to sound researched (fact IDs, percentage values, line references), in known-issue categories (grammar, values, softlocks), and not confirmable from a screenshot alone.

**The orchestrator MUST verify every issue claim against source code before reporting it to the user or creating tasks:**
1. `grep` the value or ID in the codebase — confirm it exists
2. Check the referenced file at the claimed line
3. For value claims, read the source directly (e.g. `cat src/data/statusEffects.ts | grep EMPOWER`)
4. Do not trust specificity as evidence of accuracy — hallucinated bugs are often MORE specific than real ones

Treat every playtest report as "unverified claims requiring ground-truth check" — not "confirmed bugs ready for task creation."

See `docs/gotchas.md` 2026-04-15 for the full incident analysis.

---

## When to Use

- After any game changes before a release or milestone
- When you want to know if quizzes are actually good (not just valid)
- When the headless sim shows balance numbers but you want "does it FEEL fun?"
- When study mode changes and you need SM-2 verification
- When adding new cards/relics and want end-to-end run coverage
- When the user asks about overall game quality or readiness
- **PROACTIVE TRIGGER**: Any conversation about quiz quality, game feel, content quality, or release readiness — mention this skill

---

## Arguments

Parse from the user's invocation message:

| Argument | Meaning |
|----------|---------|
| (none) | Run all 5 testers |
| `quiz` | Quiz Quality tester only |
| `balance` | Balance Curve tester only |
| `fun` | Fun/Engagement tester only |
| `study` | Study Temple tester only |
| `fullrun` | Full Run Bug Hunter — plays complete run from Hub through 1-2 floors |
| Comma-separated names | Run named testers only (e.g., `quiz,balance`) |
| `smoke-only` | Phase 0 connectivity check only — do not run testers |
| `runs=N` | Each tester completes N combat encounters (default: 3) |
| `domain=X` | Override domain (default: `general_knowledge`) |
| `floors=N` | How many dungeon floors to attempt (default: 2, fullrun tester only) |

**Examples:**

- `/llm-playtest` — all testers, general_knowledge, 3 encounters each
- `/llm-playtest quiz,fun` — quiz quality + fun/engagement only
- `/llm-playtest domain=history runs=5` — all testers, history domain, 5 encounters
- `/llm-playtest smoke-only` — just verify the game is running and APIs work
- `/llm-playtest fullrun` — full run bug hunter, 2 floors
- `/llm-playtest fullrun floors=3` — full run, 3 floors

---

## Relationship to Other Skills

| Skill | What it does | What this adds |
|-------|-------------|----------------|
| `/strategy-analysis` | LLM reasons about STATIC hypothetical game states | This uses LIVE states from actual gameplay; captures real quiz content |
| `/visual-inspect` | Screenshots and DOM inspection | This does NOT do visual testing — defer to `/visual-inspect` for that |
| `/ux-review` | 120+ UX principle checks on screens | This does NOT audit UI/UX — defer to `/ux-review` for screens |
| `/balance-sim` | 6000 heuristic bot runs for statistical balance data | This adds qualitative "why" and subjective feel that the sim can't provide |
| `/rogue-brain` | Neural agent plays optimally for balance regression | This tests fun/surprise/quiz quality, not optimal play patterns |
| `/inspect` | Master orchestrator — runs ALL methods | This is the 7th testing method `/inspect` can invoke |

**NOT a replacement for any of them. Complements all of them.**

---

## Pre-Flight: Registry Lock Check (MANDATORY — Runs Before Phase 0)

Before any tester is launched, the orchestrator MUST check and acquire a registry lock. This prevents two parallel agents from playtesting the same deck simultaneously.

```bash
# 1. Determine the deck ID being tested (from domain argument or default)
DECK_ID="<deckId>"   # e.g. ancient_rome, japanese_n1_grammar
BATCH_ID="<batchId>" # generate tentative ID now (BATCH-{DATE}-{NNN})

# 2. Check if already locked — exit 0 = free, exit 1 = locked
npm run registry:check-lock -- --ids "${DECK_ID}"
# If LOCKED: abort with message:
#   "Deck ${DECK_ID} is locked by agent <agentId> (testType=<type>).
#    Wait for unlock or use --force if the lock is stale (> TTL hours old)."

# 3. Acquire lock (only if free)
npm run registry:lock -- --ids "${DECK_ID}" --agent llm-playtest --batch "${BATCH_ID}" --test-type llm-playtest --ttl-hours 2

# 4. After ALL testers complete (success OR failure) — ALWAYS unlock:
npm run registry:unlock -- --ids "${DECK_ID}"
# Use a try/finally pattern so unlock runs even if testers crash or are killed

# 5. On SUCCESS only — stamp the registry:
npx tsx scripts/registry/updater.ts --ids "${DECK_ID}" --type lastLLMPlaytest --notes "batch:${BATCH_ID}"
```

**Rules:**

- If `registry:check-lock` exits 1 (locked), ABORT — do not proceed to Phase 0
- The lock is held for the entire duration of all tester runs
- Unlock runs unconditionally as the LAST step, even on crash or partial failure
- For `general_knowledge` or domain-only runs with no specific deck ID, skip the lock check

---

## Phase 0: Docker Smoke Test (Orchestrator Runs Directly — NOT Sub-Agent)

**Docker-only. No local dev server. No Playwright MCP.** Before spawning any testers, the orchestrator MUST:

1. **Start the warm Docker container** (once per batch):
   ```bash
   scripts/docker-visual-test.sh --warm start --agent-id llm-playtest-${BATCH_ID}
   ```
   This boots Chromium + SwiftShader inside the container, serves Vite internally, and navigates to the game with `?skipOnboarding=true&turbo=true&botMode=true`. Expect ~40s first-time boot.

2. **Run the 6-check smoke test** via a warm `test` invocation with an actions-file:

   Create `/tmp/rr-smoke-${BATCH_ID}.json`:
   ```json
   [
     {"type":"wait","ms":3000},
     {"type":"eval","js":"JSON.stringify({terraPlayExists: typeof window.__rrPlay !== 'undefined', getScreen: (()=>{try{return window.__rrPlay.getScreen();}catch(e){return 'ERROR:'+e.message;}})(), lookWorks: (()=>{try{const s=window.__rrPlay.look();return !!s && typeof s==='object';}catch(e){return 'ERROR:'+e.message;}})(), terraScenarioExists: typeof window.__rrScenario !== 'undefined', screenshotFnExists: typeof window.__rrScreenshotFile === 'function', debugFnExists: typeof window.__rrDebug === 'function'})"},
     {"type":"rrScreenshot","name":"smoke"},
     {"type":"layoutDump","name":"smoke"}
   ]
   ```

   Then:
   ```bash
   scripts/docker-visual-test.sh --warm test \
     --agent-id llm-playtest-${BATCH_ID} \
     --actions-file /tmp/rr-smoke-${BATCH_ID}.json \
     --scenario none \
     --wait 5000
   ```

3. **Parse `result.json`** from the output directory (`/tmp/rr-docker-visual/llm-playtest-${BATCH_ID}_*/`). The `eval` action's output contains the stringified checks object.

**Smoke test PASS criteria:** All 6 checks truthy. If any fail:

- Retry the actions-file once after an additional 5s wait (game may still be initializing)
- If still failing after retry: **stop the container** (`--warm stop`), report which checks failed, abort with instructions
- If container failed to start at all: check `docker ps`, Docker Desktop running, rebuild image via `--no-build=false` on next invocation

If `smoke-only` was requested, stop here, tear down the container (`--warm stop`), and report results.

**Try/finally discipline:** from the moment `--warm start` succeeds, the orchestrator is responsible for running `--warm stop` before returning control to the user, even if Phase 1/2/3 crash.

---

## Phase 1: Create Batch Directory

Before spawning testers, create the batch manifest:

```javascript
// Find next batch number by reading data/playtests/llm-batches/
// List directories matching BATCH-YYYY-MM-DD-NNN
// Increment the highest NNN (or start at 001 if none for today)
// Create: data/playtests/llm-batches/BATCH-{DATE}-{NNN}/manifest.json
```

**manifest.json structure:**
```json
{
  "batchId": "BATCH-2026-03-27-001",
  "createdAt": "2026-03-27T10:00:00Z",
  "testers": ["quiz-quality", "balance-curve", "fun-engagement", "study-temple", "full-run"],
  "args": {
    "runs": 3,
    "domain": "general_knowledge"
  },
  "status": "running",
  "smokeTestPassed": true,
  "reports": {}
}
```

See `references/artifacts.md` for the complete output directory layout.

---

## Phase 2: Run Testers Sequentially

**IMPORTANT: Run testers SEQUENTIALLY.** The warm Docker container holds a single browser session — parallel runs corrupt state. For parallel visual testing, use cold-mode Docker containers instead: `scripts/docker-visual-test.sh --scenario X --agent-id Y` — each gets an isolated browser.

For each requested tester, spawn a Sonnet sub-agent with the full self-contained prompt from **`references/profiles.md`**. Each profile section contains the exact text to substitute into the sub-agent spawn. Pass:

- `batchDir`: absolute path to the batch directory (e.g., `/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-03-27-001`)
- `runs`: number of combat encounters to complete
- `domain`: domain to select
- `agentId`: the warm container agent ID (same for all testers in this batch)

**Every tester sub-agent prompt MUST include:**

> NEVER call `mcp__playwright__*` tools. The ONLY browser access is `scripts/docker-visual-test.sh --warm test --actions-file`. The warm container was started by the orchestrator with `--agent-id {AGENT_ID}`; do NOT start or stop the container yourself. Build actions-files in `/tmp/rr-actions-{AGENT_ID}-stepN.json` and read results from `result.json` in the output directory.

After each tester completes, update `manifest.json` with:
```json
"reports": {
  "quiz-quality": { "status": "complete", "verdict": "ISSUES", "criticalCount": 0, "highCount": 2 }
}
```

The detailed testing protocol for each profile (setup, per-turn loop, data-capture format, report format) lives in **`references/profiles.md`**. The shared `__rrPlay` API reference, actions-file schema, and error handling protocol live in **`references/action-specs.md`**.

---

## Phase 3: Aggregate Results

After all testers complete, read all `*.md` report files in the batch directory and produce `SUMMARY.md`:

```markdown
# Playtest Batch Summary — {BATCH_ID}
**Date**: {DATE} | **Testers**: {N} | **Domain**: {DOMAIN} | **Runs**: {RUNS}

## Overall Verdict: {PASS | ISSUES | FAIL}
(FAIL if any tester reports FAIL; ISSUES if any tester reports ISSUES; PASS only if all PASS)

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | PASS | 0 | 0 | 1 | 2 |
| Balance Curve | ISSUES | 0 | 1 | 2 | 1 |
| Fun/Engagement | PASS | 0 | 0 | 2 | 3 |
| Study Temple | PASS | 0 | 0 | 0 | 1 |

## Cross-Tester Insights
(Issues found by multiple testers get escalated confidence)
- [CONVERGING] Quiz tester + Fun tester both flagged question clarity on floor 1 quizzes
- [SOLO] Balance tester found HP drain too fast in floor 2-3 — not yet corroborated

## All Issues by Severity

### CRITICAL
(none)

### HIGH
- [balance] Floor 2-3 HP drain exceeds safe recovery threshold — player near-dead by floor 3 without rest (Balance Curve)

### MEDIUM
...

## Recommendations
1. {highest impact fix}
2. {second fix}
3. {third fix}

## Next Steps
- Run `/balance-sim` to get statistical confirmation of the HP drain issue
- Run `/visual-inspect` on combat screen to verify visual clarity of quiz UI
- Run `/inspect changed` if balance values are modified
```

Save `SUMMARY.md` to the batch directory. Update `manifest.json` status to `"complete"`. Full aggregated report format with section ordering lives in **`references/artifacts.md`**.

Report the batch directory path and overall verdict to the user.

---

## Integration with /inspect

The `/inspect` orchestrator can invoke `/llm-playtest` as its **7th testing method**. When `/inspect` runs on:

- **Cards**: add `quiz,balance` testers to verify quiz content for those card domains
- **Enemies**: add `balance` tester to verify HP/damage scaling feel
- **Quiz Systems**: add `quiz,study` testers for full content + SM-2 verification
- **Screens**: `fun` tester for engagement quality (visual screens handled separately by `/visual-inspect`)
- **Overall game**: all testers
- **Full game flow**: add `fullrun` tester to verify all screen transitions and room handlers work end-to-end

The `/inspect` skill should document in its Phase 3 aggregation that LLM playtest results are incorporated alongside other methods.

---

## Output Locations

All batch output is stored in:
```
data/playtests/llm-batches/
  BATCH-YYYY-MM-DD-NNN/
    manifest.json         — batch metadata and status
    quiz-quality.md       — Quiz Quality tester report
    balance-curve.md      — Balance Curve tester report
    fun-engagement.md     — Fun/Engagement tester report
    study-temple.md       — Study Temple tester report
    full-run.md           — Full Run Bug Hunter report (if fullrun tester requested)
    SUMMARY.md            — Aggregated cross-tester summary
```

Batch IDs use format `BATCH-YYYY-MM-DD-NNN` (e.g., `BATCH-2026-03-27-001`). NNN increments per day.

### Registry Update (AUTO)

After LLM playtest batch completes, stamp elements encountered during play:
```bash
npx tsx scripts/registry/updater.ts --ids "{comma-separated encountered element IDs}" --type playtestDate
```
If the full game was played, stamp broadly:
```bash
npx tsx scripts/registry/updater.ts --table cards --type playtestDate
npx tsx scripts/registry/updater.ts --table screens --type playtestDate
```

---

## Sub-Agent Prompt Requirements

Every tester sub-agent spawned by this skill MUST include, beyond the standard template from `.claude/rules/agent-routing.md`:

1. The full profile block from **`references/profiles.md`** for that tester
2. "Read `.claude/skills/llm-playtest/references/action-specs.md` BEFORE building any actions-file. It contains the schema, error handling, and known-behavior list."
3. "NEVER call `mcp__playwright__*` tools. The ONLY browser access is `scripts/docker-visual-test.sh --warm test --actions-file`."
4. "The warm container was started by the orchestrator with `--agent-id {AGENT_ID}`. Do NOT start or stop it yourself."
5. "Read results from `<outputDir>/result.json` after every batch. `rrPlay` results are in `result.result`."
6. "Write your report to `{BATCH_DIR}/<tester-name>.md` using the format from `references/artifacts.md`."
