# Verify Fix

Run this after any UI, interaction, or visual fix to confirm it actually works. Do NOT report a fix as done until this passes.

## Prerequisites

1. Ensure the dev server is running:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
   ```
   If not 200, start it: `npm run dev &` and wait a few seconds.

## Verification Steps

### Step 1: Typecheck and Build
```bash
npm run typecheck && npm run build
```
Both must pass with 0 errors. If they fail, fix before continuing.

### Step 2: Navigate to Affected Screen
Use Playwright MCP to navigate to the screen where the fix applies:
```
browser_navigate → http://localhost:5173?skipOnboarding=true&devpreset=<appropriate_preset>
```
Choose the devpreset that best matches the state needed to test the fix. See the playtest skill for the full preset list.

### Step 3: Capture Before State
- `browser_take_screenshot` — visual baseline
- `browser_evaluate` → `window.__terraDebug()` — runtime state snapshot
- `browser_console_messages` — check for pre-existing errors

### Step 4: Attempt the Fixed Interaction
Perform the exact interaction that was broken:
- For DOM buttons: `browser_click` with the data-testid selector
- For Phaser canvas: use devpresets or `browser_evaluate(() => globalThis[Symbol.for('terra:currentScreen')].set('targetScreen'))`
- For state changes: use `browser_evaluate` to trigger the action

### Step 5: Capture After State
- `browser_take_screenshot` — visual confirmation
- `browser_evaluate` → `window.__terraDebug()` — verify state changed as expected
- `browser_evaluate` → `window.__terraLog.slice(-10)` — check event trail
- `browser_console_messages` — check for new errors

### Step 6: Pass/Fail Decision
**PASS** if ALL of these are true:
- Screenshot shows expected visual result
- `__terraDebug()` shows expected state change
- No new console errors
- The interaction that was broken now works

**FAIL** if ANY of these are true:
- Screenshot shows no change or wrong state
- Console has new errors
- `__terraDebug()` state doesn't match expectations
- You can't confirm the fix worked (this counts as FAIL, not "probably works")

## Reporting
- If PASS: report the fix as done with evidence (what you checked, what you saw)
- If FAIL: do NOT report as done. Investigate further, apply another fix, and re-run this verification
