---
name: quick-verify
description: Run the standard verification sequence — typecheck, build, tests, and optionally Playwright visual check. Use after any code change to confirm nothing is broken.
user_invocable: true
---

# Quick Verify

Run the standard verification gate for any code change.

## Steps

1. Run typecheck:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && npm run typecheck
   ```

2. Run build:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && npm run build
   ```

3. Run unit tests:
   ```bash
   cd /Users/damion/CODE/Recall_Rogue && npx vitest run
   ```

4. If any step fails, report the failure with file and line numbers.

5. If all pass, report: "✓ typecheck, ✓ build, ✓ tests (N passed)"

## Visual Verification via Spawn

When the verification includes visual checks, use `__rrScenario.spawn()` to quickly set up specific states:

```javascript
// Quick visual check of combat
await page.evaluate(() => __rrScenario.spawn({ screen: 'combat', enemy: 'page_flutter' }));
await page.evaluate(() => window.__rrScreenshotFile());

// Test a specific element
await page.evaluate(() => __rrScenario.spawn(__rrScenario.recipes('soul_jar').config));
```

Use `spawn()` instead of navigating through menus — it's faster and more reliable.

## Optional: Full Visual Check

If the user adds `--visual` or if the change was UI-related:
1. Ensure dev server is running (`npm run dev`)
2. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Take screenshot AND layout dump (ALWAYS use both):
   - Screenshot: `browser_evaluate(() => window.__rrScreenshotFile())` — saves to `/tmp/rr-screenshot.jpg`, returns path. Use `Read("/tmp/rr-screenshot.jpg")` to view. NEVER use raw `__rrScreenshot()` (base64 exceeds limits), `mcp__playwright__browser_take_screenshot` (Phaser RAF causes 30s timeout), `page.screenshot()` (same), or `newCDPSession()` (hangs).
   - Layout dump: `browser_evaluate(() => window.__rrLayoutDump())` — returns text with exact pixel coordinates of ALL Phaser + DOM elements (structured coordinate data to complement the visual)
4. Check console: `mcp__playwright__browser_console_messages`
5. Report any visual issues or console errors.

### Parallel-Safe Visual Testing (Docker)

When multiple agents are running visual tests simultaneously, use the Docker method instead of Playwright MCP tools to avoid chrome-lock contention:

```bash
scripts/docker-visual-test.sh --scenario combat-basic --agent-id my-agent
```

Each Docker container runs its own isolated Chromium with SwiftShader WebGL — no chrome-lock needed. Read outputs from `/tmp/rr-docker-visual/{agent-id}_{scenario}_{timestamp}/`. Slower (~60-110s) but fully parallel-safe. See `.claude/skills/visual-inspect/skill.md` for full Docker method documentation.

### Registry Update (AUTO)
If all unit tests pass, stamp affected elements:
```bash
npx tsx scripts/registry/updater.ts --ids "{comma-separated element IDs with passing tests}" --type mechanicDate
```
If running full test suite (`npx vitest run`), stamp all:
```bash
npx tsx scripts/registry/updater.ts --table cards --type mechanicDate
npx tsx scripts/registry/updater.ts --table relics --type mechanicDate
npx tsx scripts/registry/updater.ts --table enemies --type mechanicDate
```
