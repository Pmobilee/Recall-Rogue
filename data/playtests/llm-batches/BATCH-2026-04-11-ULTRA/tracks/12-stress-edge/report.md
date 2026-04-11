# Track 12 — Stress/Edge/Perf Report
**Batch:** BATCH-2026-04-11-ULTRA  
**Agent:** BATCH-ULTRA-t12-stress  
**Completed:** 2026-04-11 ~11:40 UTC  
**Container:** Docker SwiftShader warm container  
**System load during test:** 35–128 load avg (16 parallel batch containers running simultaneously)

---

## CRITICAL CONTEXT — Docker SwiftShader Baseline

**ALL FPS measurements in this report are Docker SwiftShader, NOT real GPU measurements.**

The phaser-perf SKILL.md documents: "~22fps is the hardware ceiling [for SwiftShader], NOT a bug." Per the HIGH-4 case study (2026-04-10), the SwiftShader detection fix was already applied. This batch ran under extreme system load (16 parallel containers, load avg 35–128). FPS numbers below should be treated as lower bounds under worst-case conditions.

---

## Scenario 1: Sustained Combat FPS — PARTIAL

**Method:** 10 turns of combat, FPS sampled every ~3s  
**Verdict:** Data collected; SwiftShader/load caveat applies  

| Time | FPS Current | FPS Min | FPS Avg | Memory MB |
|------|-------------|---------|---------|-----------|
| t0 (initial) | 31 | 31 | 39 | 351.3 |
| t3 (turn 1) | 26 | 25 | 35 | 353.8 |
| t6 (turn 2) | 27 | 25 | 34 | 358.1 |
| t9 (turn 3) | 21 | 21 | 32 | 352.9 |
| t12 (turn 4) | 15 | 15 | 30 | 351.2 |
| t15 (turn 5) | 11 | 11 | 27 | 353.1 |
| t18 (turn 6) | 14 | 10 | 25 | 353.1 |
| t21 (turn 7) | 15 | 10 | 24 | 362.5 |
| t24 (turn 8) | 14 | 10 | 23 | 357.1 |
| t27 (turn 9) | 15 | 10 | 23 | 352.1 |
| t30 (turn 10) | 17 | 10 | 22 | 359.4 |

**Renderer:** WebGL (SwiftShader)  
**Draw calls:** -1 (not observable in SwiftShader)  
**Game objects:** 36 | **Textures:** 109 (stable)  
**FPS avg (t0-t12):** ~31 | **FPS avg (t12-t30):** ~15 | **FPS all-time min:** 10

**Finding:** FPS degradation from 31fps to 10-15fps sustained after turn 5. This is consistent with HIGH-4 findings and SwiftShader under extreme load. `drawCalls=-1` confirms SwiftShader GL path. The 31fps initial reading is above the 22fps SwiftShader ceiling, which may indicate a brief hardware-accelerated phase before falling back. NOT actionable on real GPU without verification.

**Re: BATCH-2026-04-10-003 finding of 4-29 fps:** This measurement (10-31fps, avg 22fps) is consistent with the prior finding. The FPS range has not regressed. The SwiftShader baseline caveat documented in HIGH-4 applies here.

---

## Scenario 2: Memory Leak Hunt — PASS

**Method:** 3 consecutive combat scenarios with memory sampling at start/end  

| Checkpoint | Memory MB | Game Objects | Textures |
|-----------|-----------|--------------|---------|
| Combat 1 start | 350.3 | 36 | 109 |
| Combat 1 end | 351.0 | 36 | 109 |
| Combat 2 start | 350.2 | 36 | 109 |
| Combat 2 end | 352.6 | 36 | 109 |
| Combat 3 start | 353.2 | 36 | 109 |
| Combat 3 end | 352.6 | 36 | 109 |

**Growth:** 2.3MB total (0.65%) across 3 combats — well below 10% threshold  
**Game objects:** Stable at 36 across all 3 scenarios  
**Textures:** Stable at 109 across all 3 scenarios  
**Verdict:** No memory leak detected. Scenario reloads clean up properly.

---

## Scenario 3: Rapid Input Mashing — PASS

**Method:** 50 quickPlayCard(0) + endTurn() calls in tight loop  

- Plays executed: 50/50
- Turn ends executed: 50/50
- __rrLog errors: 0
- recentErrors: []
- Race conditions: 0

**Verdict:** Zero race conditions. Game handles 50 rapid automated play+endTurn cycles without errors. Input handling is robust.

---

## Scenario 4: Resize Battery — PARTIAL

**Method:** Screenshot at 1920x1080; attempt resize dispatch  

- **--layout-scale at 1920x1080:** 1.5 (correct)
- **--text-scale at 1920x1080:** 1.25 (correct)
- **After resize event dispatch:** No change (expected — Playwright viewport is fixed at 1920x1080; window.resizeTo() is sandboxed)
- **Screenshot at 1920x1080:** All elements in frame, layout correct

**Finding:** The actual resize behavior cannot be validated in Playwright with a fixed 1920x1080 viewport. The `--layout-scale` CSS variable is driven by actual viewport dimensions. To properly test resize, cold Docker runs with `--viewport` parameter changes are needed. Layout at 1920x1080 is correct.

**Screenshot evidence:** `evidence/screenshots/s4-1920x1080.png` — all UI elements visible and correctly positioned.

---

## Scenario 5: Empty States — PARTIAL

**Tested:**
- Shop scenario: renders correctly (500g, 3 items: Whetstone/Iron Shield/Vitality Ring at 150g each). No crash.
- Combat normal hand: renders correctly, cards visible.

**API gaps found:**
- `window.__rrPlay.forceHand([])` — method NOT available (would enable empty hand testing)
- `window.__rrPlay.setGold(0)` — method NOT available (would enable zero-gold shop testing)

**Available __rrPlay methods:** navigate, getScreen, getAvailableScreens, startRun, selectDomain, selectArchetype, getCombatState, playCard, quickPlayCard, chargePlayCard, previewCardQuiz, endTurn, selectRoom, selectMapNode, acceptReward, selectRewardType, selectRelic, getRelicDetails, getRewardChoices, retreat

**Finding:** Shop does NOT crash with normal gold (500g). Empty hand and zero-gold states could not be force-tested via current API. This is a test coverage gap, not a bug finding. No crash observed in any tested state.

---

## Scenario 6: Error States — PASS

**Corrupt save test:**
- Keys corrupted: 4/5 (rr_save, rr_analytics_queue, terra-review-prompt-state, card:currentScreen)
- Game response: Loaded hub normally (no crash, no visible error)
- Combat after corruption: Loaded normally
- __rrDebug().recentErrors: []

**Verdict:** Robust save error handling confirmed. The game gracefully falls back to defaults on corrupt localStorage data. No crash, softlock, or visible error state. This is good defensive design.

---

## Scenario 7: Console Error Collection — PASS

**Scenarios covered:** combat-basic, shop, reward-room, hub-fresh

**Game logic errors (__rrLog type=error):** 0  
**recentErrors from debug bridge:** 0 in all scenarios  
**Browser console errors:** 4 total  

| Error | Count | Source | Game Bug? |
|-------|-------|--------|-----------|
| ERR_CONNECTION_REFUSED | 3 | Static asset fetch | No — Docker environment |
| Web Worker blob URL warning | 1 | Worker creation | No — informational |

**Verdict:** Zero game logic errors across all tested scenarios. The 4 browser console errors are all Docker environment artifacts (HMR connections refused, Web Worker blob). No actionable game bugs surfaced.

---

## Overall Summary

| Scenario | Status | Key Finding |
|----------|--------|-------------|
| 1 — FPS | PARTIAL | 10-31fps (avg 22fps); Docker SwiftShader + extreme load applies |
| 2 — Memory | PASS | 0.65% growth, stable game objects/textures |
| 3 — Rapid Input | PASS | 50 iterations, 0 errors, 0 race conditions |
| 4 — Resize | PARTIAL | Layout correct at 1920x1080; actual resize needs cold run variants |
| 5 — Empty States | PARTIAL | Shop renders OK; forceHand/setGold API methods missing |
| 6 — Error States | PASS | Corrupt save handled gracefully, no crash |
| 7 — Console Errors | PASS | 0 game logic errors |

**Memory leak detected:** No  
**Race conditions found:** 0  
**Game crashes:** 0 (1 infrastructure crash from Docker under 16-container load)  
**Console errors (game logic):** 0  
**Critical issues:** 0  
**High issues:** 1 (Docker infrastructure - 16 container crash ceiling)  
**Medium issues:** 1 (FPS degradation under Docker+load)  
**Low issues:** 7 (mostly PASSes documented as informational)

---

## Issues

See `issues.json` for full schema.

**Top 5 Findings:**

1. **[MEDIUM] Docker SwiftShader FPS drops to 10-15fps after 5+ turns** (issue-12-001) — Docker baseline only; recheck on real GPU needed
2. **[HIGH] Docker SwiftShader crashes under 16-container parallel load** (issue-12-003) — Infrastructure issue; limit to 8 parallel containers
3. **[LOW] drawCalls=-1 in SwiftShader** (issue-12-002) — Cannot validate draw call budget in Docker; needs real GPU testing
4. **[LOW] __rrPlay API missing forceHand/setGold** (issue-12-006) — Test coverage gap; not a game bug
5. **[LOW] Viewport resize untestable in fixed Playwright viewport** (issue-12-005) — Methodology gap; cold runs at multiple viewports needed

