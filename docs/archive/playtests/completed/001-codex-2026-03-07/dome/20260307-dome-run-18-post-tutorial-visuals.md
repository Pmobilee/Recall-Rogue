# Dome Visual Regression Spot-Check (Run 18)

- Date: 2026-03-07T15:14:11Z
- Run type: `dome visual regression spot-check`
- Scenario: `post_tutorial`
- URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
- Forced checks requested: `base`, `divePrepScreen`, `diveResults` via currentScreen store if needed
- Result: **FAIL (PARTIAL - BLOCKED BEFORE PLAYTHROUGH START)**

## Blocking Issue

- Severity: **critical**
- Issue: Playwright browser could not launch in this environment, so no in-app playthrough actions could be executed.
- Evidence: Chromium failed with root+sandbox restriction (`Running as root without --no-sandbox is not supported. See https://crbug.com/638180.`)
- Impact: Could not validate visuals/interactions for `base`, `divePrepScreen`, or `diveResults`; forced currentScreen checks were not reachable.

## Visual/Interaction Findings

- No app-level visual or interaction regressions were observed because the run was blocked before page load.
- Only environment-level blocker captured in this run.

## Console/Page Errors Summary

- App console errors: not available (browser session did not start)
- App page/runtime errors: not available (browser session did not start)
- Environment/runner errors observed:
  - `Chromium sandboxing failed`
  - `Running as root without --no-sandbox is not supported`

## Run Notes

- Exactly one playthrough run was attempted.
- No code edits were made.
