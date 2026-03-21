# Scenario 11: Onboarding Flow (First-Time User)

## Goal
Test the first-time user experience: age gate, tutorial introduction, and first guided combat.

## Preset
URL: `http://localhost:5173` (NO skipOnboarding — test the full onboarding)

## Steps

### Pre-flight
1. Navigate to `http://localhost:5173`
2. Clear localStorage via evaluate:
```javascript
localStorage.clear()
```
3. Reload page, wait 5s

### Age Gate
4. Verify age selection screen appears
5. Take **Screenshot #1 (age-gate)**
6. CHECK: age options visible (teen, adult buttons)
7. Click `[data-testid="btn-age-adult"]` (or first age button), wait 2s

### Onboarding / Tutorial
8. Read current screen — should be onboarding or tutorial
9. Take **Screenshot #2 (onboarding)**
10. Follow tutorial prompts:
    - Click any "continue" or "next" buttons
    - If domain selection appears, pick first option
    - If tutorial combat starts, play through it
11. Continue clicking progression buttons until reaching hub

### Post-Onboarding
12. Verify screen = `hub`
13. Take **Screenshot #3 (post-onboarding-hub)**
14. CHECK: Start Run button visible
15. Run filtered console check

## Checks
- Age gate appears on fresh start
- Age selection transitions to onboarding
- Tutorial can be completed by clicking through
- Hub is reached after onboarding
- No crashes or blank screens during tutorial
- Start Run button available after onboarding

## Report
Write JSON to `/tmp/playtest-11-onboarding.json` and summary to `/tmp/playtest-11-onboarding-summary.md`
