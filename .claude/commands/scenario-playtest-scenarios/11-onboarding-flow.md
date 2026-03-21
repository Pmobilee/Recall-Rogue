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

## Element Discovery & Evaluation — MANDATORY

At EVERY screenshot checkpoint, run the Runtime Element Discovery protocol from the Shared Protocol. Onboarding is CRITICAL for first impressions — subjective evaluation is especially important.

### Scenario-Specific Evaluation Questions

**Age Gate (#1):**
- Run element discovery. What buttons are visible? What text is shown?
- Is the age gate friendly and non-intimidating?
- Are the age options clearly labeled and large enough to tap?
- Does the screen explain why age is being asked (or does it feel invasive)?
- Is the visual design consistent with the rest of the game?
- Would a 13-year-old know which button to press?

**Onboarding (#2):**
- Run discovery. What tutorial elements are present?
- Is the tutorial text clear and concise (not walls of text)?
- Are continue/next buttons easy to find and tap?
- Does the onboarding establish the game's theme and identity?
- Is the pacing right — not too fast (confusing) or too slow (boring)?
- Are there any moments where a new player might get stuck?
- Does the tutorial explain the core loop (cards = knowledge = combat)?
- Is the art/visual quality consistent with a polished game?

**Post-Onboarding Hub (#3):**
- Run discovery. Compare element counts with a post_tutorial hub.
- Is the Start Run button the obvious next action?
- Does the hub feel welcoming for a first visit?
- Is anything confusingly locked or unavailable?
- Does the transition from tutorial to hub feel natural?
- Would a new player know what to do next without guidance?
- Rate the overall onboarding experience 1-10. What would you improve first?

## Checks
- Age gate appears on fresh start
- Age selection transitions to onboarding
- Tutorial can be completed by clicking through
- Hub is reached after onboarding
- No crashes or blank screens during tutorial
- Start Run button available after onboarding

## Report
Write JSON to `/tmp/playtest-11-onboarding.json` and summary to `/tmp/playtest-11-onboarding-summary.md`
