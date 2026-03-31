---
name: work-tracking
description: Enforces plan-before-code discipline using Claude planning mode and task tracking. Always active — ensures non-trivial work is planned before implementation begins.
---

# Work Tracking Enforcement

## Core Rule

**YOU MUST NOT WRITE A SINGLE LINE OF CODE, DELEGATE TO ANY SUB-AGENT, OR EDIT ANY FILE UNTIL YOU HAVE A PLAN.**

For non-trivial tasks: use `/plan` (Claude planning mode) to plan before implementing. The plan file IS the spec — workers receive their instructions from it. Planning mode handles context preservation natively.

Once the plan exists: use `TaskCreate` to break implementation into trackable tasks. Use `TaskUpdate` to mark progress as you go.

## What Requires Planning Mode

Use `/plan` before starting any of these:
- New features or game mechanics
- Multi-file changes (touching 3+ files)
- Content pipeline batches
- Balance adjustments
- UI/UX modifications
- Refactors
- Any task with more than 2-3 discrete steps

**Exceptions (no plan needed — these are genuinely trivial):**
- Single-line bug fix
- Typo or comment correction
- Simple config value change (one number, one flag)

## Implementation Tracking

1. **Before starting**: `TaskCreate` for each discrete chunk of work
2. **When beginning a task**: `TaskUpdate` → `in_progress`
3. **When done with a task**: `TaskUpdate` → `completed`
4. **ONE task at a time** — finish and mark complete before starting the next
5. **If a task reveals new work**: create new tasks immediately, don't let them float in your head
6. **Use `TaskList` periodically** to confirm you're tracking everything and nothing is orphaned

## Visual Inspection — NON-NEGOTIABLE

After completing ANY task that touches UI, visuals, gameplay, or layout, the Opus orchestrator MUST visually inspect using Playwright MCP before marking the task complete.

### How to Take Screenshots

```javascript
// CORRECT — always use BOTH of these together:
browser_evaluate(() => window.__rrScreenshotFile())
// Saves to /tmp/rr-screenshot.jpg — then Read("/tmp/rr-screenshot.jpg") to view

browser_evaluate(() => window.__rrLayoutDump())
// Returns text with exact pixel coordinates of ALL Phaser + DOM elements
// REQUIRED alongside screenshot — provides structured coordinate data the visual alone cannot

// NEVER use these (they hang/timeout due to Phaser's RAF loop):
// mcp__playwright__browser_take_screenshot
// page.screenshot() via browser_run_code
// page.context().newCDPSession()
// raw __rrScreenshot() — base64 exceeds tool output limits
```

### Standard Visual Inspection Sequence

1. Ensure dev server is running (`npm run dev`)
2. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Disable animations: `browser_evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'))`
4. Take screenshot: `browser_evaluate(() => window.__rrScreenshotFile())` → `Read("/tmp/rr-screenshot.jpg")`
4b. Get layout dump: `browser_evaluate(() => window.__rrLayoutDump())` — exact pixel coordinates of ALL Phaser + DOM elements (ALWAYS run alongside screenshot)
5. DOM snapshot: `mcp__playwright__browser_snapshot`
6. Console check: `mcp__playwright__browser_console_messages`

### Quick Game State Setup

Use `__rrScenario` to jump directly to any state — never navigate through menus manually:

```javascript
await page.evaluate(() => window.__rrScenario.load('combat-basic'));
await page.evaluate(() => window.__rrScenario.load('combat-boss'));
await page.evaluate(() => window.__rrScenario.load('shop'));
await page.evaluate(() => window.__rrScenario.load('reward-room'));
// Full list: window.__rrScenario.list()
```

### What to Do When It Looks Wrong

If the visual result doesn't match expectations: **fix it before reporting done**. Spawn another worker, iterate, re-inspect. Never tell the user "it should work" — confirm it works. This rule has been violated repeatedly and the user has paid the price.

## Verification Gates

Run these after every implementation batch — not just visual tasks:

```bash
npm run typecheck          # TypeScript/Svelte type errors
npm run build              # Production build (catches bundler issues)
npx vitest run             # 1900+ unit tests — run after any logic/data changes
```

Hardcoded px values (Dynamic Scaling Rule violation) are treated as bugs. Every CSS change must use `calc(Npx * var(--layout-scale, 1))` for layout values and `calc(Npx * var(--text-scale, 1))` for font sizes — never bare `px` values.

## Documentation Sync

Any change touching gameplay, balance, UI, mechanics, enemies, cards, relics, or player-facing systems MUST update `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` in the same task — never as a follow-up. Stale docs are bugs with the same priority as broken tests.

## Content Pipeline — Verified Source Data

When working on fact/content generation, the following rules are absolute:

1. **NEVER generate facts from LLM training knowledge.** Workers format pre-verified data — they do not invent it.
2. Every fact-generation worker prompt MUST include verified source data (dates, numbers, names from Wikipedia/Wikidata looked up before the prompt is written).
3. Distractors MUST be generated by an LLM reading the specific question — NEVER pulled from `correct_answer` values of other facts in the database.
4. Source URLs must have been actually consulted, not assumed. Fake sourceUrls are worse than no sources.
5. QA by another LLM has the same blind spots as generation — human spot-check is required for numerical facts.

When working on content pipeline: read `docs/RESEARCH/SOURCES/content-pipeline-spec.md` first. Update `docs/RESEARCH/SOURCES/content-pipeline-progress.md` after every batch operation.

## Common Violations

- Starting code before a plan exists
- Skipping visual inspection because "it's probably fine"
- Accepting tool failures (Playwright, browser, screenshots) instead of fixing them immediately
- Batching TaskUpdate calls at the end of a session instead of updating per-task
- Telling the user a fix "should work" without confirming it visually
- Using fallback/workaround approaches when the primary tool breaks instead of diagnosing and fixing the root cause
- Generating content from LLM training knowledge instead of verified source data
- Hardcoding px values in CSS
- Skipping doc updates because "it's just a small change"
