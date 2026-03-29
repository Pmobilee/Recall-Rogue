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

## Optional: Visual Check
If the user adds `--visual` or if the change was UI-related:
1. Ensure dev server is running (`npm run dev`)
2. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Take screenshot: `browser_evaluate(() => window.__rrScreenshotFile())` — saves to `/tmp/rr-screenshot.jpg`, returns path. Use `Read("/tmp/rr-screenshot.jpg")` to view. NEVER use raw `__rrScreenshot()` (base64 exceeds limits), `mcp__playwright__browser_take_screenshot` (Phaser RAF causes 30s timeout), `page.screenshot()` (same), or `newCDPSession()` (hangs).
4. Check console: `mcp__playwright__browser_console_messages`
5. Report any visual issues or console errors.
