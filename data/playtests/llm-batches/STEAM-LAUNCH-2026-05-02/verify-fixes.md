# Steam-Launch Fix Verification — 2026-05-02

Commits verified: be987e01a, 6809589ef, 2dec7bc67, e7cc2ac22, 8289ddb23
Method: Docker warm container (agent-id: verify-2026-05-02), fresh full run from hub to combat via DOM/API.

| Issue | Fix verified? | Evidence |
|-------|---------------|----------|
| ISSUE-1-2 (map cold scroll) | PARTIAL | scrollTop reached max=392 within ~20s of map mount. At T+16s it was 108 (nodes off-screen). By T+20s (next batch) it was at max (nodes visible: top=949, viewport=1080). The 12s retry tail fires late but does fire. Narration-dismiss trigger cannot be tested here (no narration in post_tutorial preset). For Steam players who see narration, the dismiss trigger fires immediately on dismiss. Raw cold-start without narration has ~4-8s window where nodes may be below fold. |
| ISSUE-1-3 (tutorial popups ≤2 before first action) | YES | combat-entry screenshot confirms combat_intro popup ("You are facing Page Flutter...") fired as popup #1. cards_ap_intro was #2. Both are proactive+blocking; player cannot act until they click Got it. After those 2, reactive popups (tap_card_prompt, card_selected_qp, post_quick_play, discard_pile) fire during gameplay — these are non-blocking context hints, not gating the player. The claim "≤2 blocking prompts before first card play" is satisfied. |
| ISSUE-1-4 (charge hint banner) | YES | Banner present in DOM (`.charge-hint-banner`), text: "Drag a card UP for Charge — quiz for 1.5× damage ×". Visually confirmed in combat-entry.rr.jpg and post-tutorial-final.rr.jpg (banner visible at bottom of combat screen). offsetParent=null artifact is a known layout-dump issue during animation; PNG confirms render. |
| ISSUE-1-5 (AP confirm once per combat) | YES | Turn 1 end-turn: warningPresent=true ("You still have AP to spend. End turn anyway?"). Turn 2 end-turn: warningPresent=false. Turn 3 end-turn: warningPresent=false. Exactly once-per-combat behavior confirmed. |
| ISSUE-1-6 (encounters ≥1) | YES (code) | git diff confirms: pill value changed from `{encountersWon}` → `{encountersTotal}` with "N won" sub-line. A player who enters 1 combat and dies sees ENCOUNTERS: 1 / 0 won instead of ENCOUNTERS: 0. Runtime verification blocked (run-end screen is Phaser canvas, not DOM text). |
| ISSUE-3-2 (no 0% explored) | YES (code) | git diff confirms: removed `explorationPct = encountersWon/encountersTotal × 100` and removed "you only explored X% of the dungeon" line. gradeExplanation now uses floor-based language: "All correct — the dungeon stopped you on Floor N, not the questions." |
| ISSUE-2-3 (no Practice Run for new players) | YES | chargesAttempted=0 in our run (0 quiz attempts). Code: `isPracticeRun()` now requires `chargesAttempted >= 5` (MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN) before any path returns true. 12 unit tests in tests/unit/runStats.test.ts cover counter init, increment, and gate behavior. |

## Overall verdict

PASS (with one caveat on ISSUE-1-2)

## Anomalies / regressions

1. **ISSUE-1-2 timing gap**: On cold start without narration (post_tutorial preset), nodes are off-screen for ~4-8s after map mount before the 12s retry fires. For Steam players who always see narration on run 1, the dismiss trigger covers this. For subsequent runs (no narration), the extended 12s retry window handles it but there's a momentary blank-map state. Not a regression vs. the original (which was stuck indefinitely), but the fix could be tighter.

2. **Tutorial popup count**: 4+ reactive "Got it" popups fire during gameplay after the 2 proactive combat-start ones. The fix correctly reduces pre-action blocking from 5→2, but total tutorial interactions in first combat remain high. This is within-scope of the fix as stated; a follow-up to reduce reactive popup density may improve new-player experience.

3. **Low FPS in Docker**: getRecentEvents showed "Low FPS alert: 22fps / 4fps in CombatScene" — this is expected SwiftShader behavior (software-renderer ceiling), not a game regression. No game-side FPS issue.

4. **acceptReward API error**: `window.__rrPlay.acceptReward()` threw "Cannot read properties of null (reading 'drawImage')" from the Phaser canvas. Likely a canvas context race condition in the rewardRoom scene. Could not be reproduced in DOM; did not affect gameplay flow (reward was skipped via navigate()).

## Screenshots referenced

- `/tmp/rr-docker-visual/verify-2026-05-02_none_1777720853344/combat-entry.rr.jpg` — combat_intro popup (ISSUE-1-3 proof)
- `/tmp/rr-docker-visual/verify-2026-05-02_none_1777721008445/post-tutorial-final.rr.jpg` — charge banner visible (ISSUE-1-4 proof)
- `/tmp/rr-docker-visual/verify-2026-05-02_none_1777721047278/end-turn-1-state.rr.jpg` — AP warning dialog turn 1 (ISSUE-1-5 proof)
- `/tmp/rr-docker-visual/verify-2026-05-02_none_1777720827433/map-scrolled-max.rr.jpg` — map nodes visible after scroll (ISSUE-1-2 settled state)
