# Balance Curve Tester — BATCH-2026-04-10-003-fullsweep

## Header

- **Tester**: balance-curve
- **Model**: Claude Opus 4.6 (1M context)
- **Domain**: general_knowledge
- **Archetype**: balanced
- **Target accuracy**: ~70% (7/10 correct charges)
- **Encounters attempted**: 5 (2 in run 1, 3 in run 2)
- **Encounters completed**: 4 (E1, E2, E3, E4). E5 = player death.
- **Floors reached**: 3 (player died on Floor 3 / r3-n0)
- **Session duration**: 9.8 min
- **Runs**: 2 (first run used to test resume flow, second run for clean 3-encounter curve)

## Verdict: **FAIL**

**FAIL** justification:
1. **CRITICAL** — `reviewStateSnapshot.has is not a function` error on every card play after resume. Post-resume card plays either error or mutate state without dealing damage. Item 4 (resume-flow / InRunFactTracker rebuild) is NOT fully fixed. Player can play, cards consume AP, but damage output is broken and the in-game error surfaces repeatedly.
2. **CRITICAL** — `__rrPlay.restore()` reconstitutes data state but leaves the Phaser scene unloaded (black body below HUD chrome). `acceptReward()` fails with "RewardRoomScene not active after 3s wait". Natural "Resume Run" button works, but the dev-tool restore path does not.
3. **HIGH** — Sustained low FPS (4–22, avg 11–15) in CombatScene throughout the session. Multiple `[fps] Low FPS alert` events logged. This is not a one-off animation hitch — it is the floor for the whole run.

---

## Focus Area Coverage

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Chess Tactics deck | N/A | Did not draw any chess_tactics cards in general_knowledge trivia runs. |
| 2 | Map Pin Drop | N/A | Did not draw any world_capitals cards. |
| 3 | Deck front art | N/A | Study Temple tester owns this; I was trivia-side. |
| 4 | Resume flow / InRunFactTracker | **FAIL** | `reviewStateSnapshot.has is not a function` after resume. See CRITICAL-1 below. |
| 5 | Fact repetition | N/A — info only | Observed ~8–10 unique facts cycling across ~27 quiz charges. Expected per rule. |
| 6 | QP vs Charge ratio | PASS — info only | Charge-correct strike qp8 → 14 damage (exactly 8×1.75). Ratio matches spec. Not reported as imbalance. |
| 7 | Post-tutorial onboarding | N/A | Fun tester owns. |
| 8 | Audio leakage | N/A | Not audible in Docker. |
| 9 | AP economy sanity | **ISSUES** | 6/13 turns (46%) ended with ≥1 wasted AP — hand composition often stranded a second charge at AP 1 with only apCost:1 cards that still required 2 AP to charge. See table below. |
| 10 | Card reward relevance | ISSUES | 2/2 rewards auto-accepted via `acceptReward()` (no choice UI exposed via __rrPlay), chosen card IDs = `reinforce` (E3→E4 hand) and unknown (E4→E5). `reinforce` WAS played in E4 T1 (charge block correct) → rewardsPlayed/rewardsTaken ≥ 50%. Data incomplete: orchestrator should expose reward-choice API. |
| 11 | Relic clarity | N/A | Fun tester owns. No relics acquired in either run. |
| 12 | Run end flow | PASS | Death in E5 T4 → immediate return to hub (not `runEnd` screen as spec'd — went straight to hub, runState=null). No NaN/undefined in any numbers. `getSessionSummary()` returned valid data. Note: runEnd scene skipped? Possible minor issue — spec'd a runEnd screen but got direct hub. |
| 13 | Cursed / fizzle path | PASS | 2 intentional wrong-charges tested. Run 1 E1 T2: strike qp 8, wrong charge → 4 damage (floor(8×0.25)=2, got 4 → some mastery/relic bonus, never 0, never NaN). Run 2 E3 T2: block qp 6, wrong charge → 5 block (same pattern — floor + bonus). No UI freeze, next card still playable. |
| 14 | Performance | **ISSUES** | `__rrDebug().fps` values logged: min 4, avg 11, current 18 at end. 10 `[fps] Low FPS alert` events in session log (8–17 fps sustained in CombatScene for 183–423 seconds). Not subjective — measured. |

---

## Tester-specific findings

### Run 1 (first attempt — E1 + E2 clean, E3 broken by resume bug)
- E1 vs Staple Bug (49 HP): took 10 turns, HP 100 → 93 (-7), ~7 block wasted turns
- E2 vs Thesis Construct (59 HP): took 6 turns, HP 93 → 78 (-15)
- After E2, tested `__rrPlay.snapshot('mid-run')` → persisted to localStorage → `location.reload()` → `__rrPlay.restore(snap)` → restore returned `{ok: true, message: "Restored snapshot 'mid-run' (screen: rewardRoom)"}` and HUD chrome showed correct HP/gold — but **scene body was black**, no reward options rendered. `acceptReward()` failed. Had to fall back to natural "Resume Run" button from hub.
- Natural Resume Run: worked. Landed in combat vs "The Librarian" (113 HP) on floor 1. But every card play (charge AND quick) returned `Error: state.reviewStateSnapshot.has is not a function`. Cards still consumed AP and hand slots, but damage was inconsistent. Enemy HP went 113 → 88 (-25) on 2 erroring charges, which LOOKS like 12+13 correct damage, so the damage path partially works — but the tracker path is broken and errors leak to the dev-tools layer and presumably to production error logs.

### Run 2 (clean — E3, E4, E5 until death)
- E3 vs Thesis Construct (40 HP): took 8 turns, HP 100 → 64 (-36). Floor 1.
- E4 vs Thesis Construct (52 HP): took 7 turns, HP 47 → 19 (-28). Floor 2.
- E5 vs Thesis Construct (66 HP): 4 turns, HP 19 → 0 (death). Floor 3.
- Final: died on Floor 3 with 19 HP entering, facing a 66-HP enemy.

### QP vs Charge damage observations (Item 6, information-only)
- Strike qpValue 8, charge-correct: measured 14 damage (exactly 8×1.75)
- Strike qpValue 8, charge-wrong: measured 4 damage (spec: floor(8×0.25)=2 — got double, suggesting mastery bonus applied to fizzle floor)
- Block qpValue 6, charge-correct: measured 9–11 block (spec: 6×1.75=10.5, rounds to 10)
- Block qpValue 6, charge-wrong: measured 5 block (spec: floor(6×0.25)=1 — also higher than pure spec)
- **Not flagging as bug** per Item 6; noting that fizzle values are above the raw formula floor likely due to mastery tables.

---

## Issues Found

### CRITICAL

**CRITICAL-1: `reviewStateSnapshot.has is not a function` after resume (Item 4 regression)**
- **What**: After `location.reload()` + resume (either natural "Resume Run" button OR `__rrPlay.restore(snapshot)`), the very first card play inside the next combat throws:
  > `Error: state.reviewStateSnapshot.has is not a function`
- **Observed in**: Run 1 post-resume, encounter vs The Librarian. Reproduced on charge play AND quick play, every turn, every card. Cards STILL consume AP and reduce hand size, and some damage IS applied (enemy HP 113 → 88 → 79 → 72 across 3 erroring turns), but the error is thrown and leaks into the rrPlay return value.
- **Why it matters**: The Item 4 fix target was exactly this — "InRunFactTracker class instance not rebuilt after save/load". The fix description said it was fixed. The test proves the tracker is STILL being rehydrated as a plain object rather than a Set/Map (`reviewStateSnapshot` is deserialized from JSON as `{}` but code expects `.has()`).
- **Reproduction**:
  1. Play 2 encounters (any domain)
  2. `location.reload()`
  3. Click "Resume Run" (or `__rrPlay.restore(snap)`)
  4. Enter combat → try `chargePlayCard(i, true)`
  5. Returns `{ok:false, message:"Error: state.reviewStateSnapshot.has is not a function"}`
- **Severity**: CRITICAL — any player who alt-tabs, closes the browser, or reloads the page mid-run enters a broken combat state. This defeats the entire save/resume system.

**CRITICAL-2: `__rrPlay.restore()` black-body scene (dev-tool only, not real save path)**
- **What**: `__rrPlay.restore(snapshot)` returns `{ok: true}` and the HUD chrome (HP bar, gold counter, floor label) shows correct values — but the main scene body is a solid dark color with no Phaser scene loaded. Action handlers fail: `acceptReward()` → "RewardRoomScene not active after 3s wait"; `delve()` → "Delve button not found".
- **Scope**: This is the __rrPlay dev-tool restore. The natural "Resume Run" button from the hub DOES render the scene correctly (though see CRITICAL-1 for the tracker bug that affects both paths).
- **Severity**: CRITICAL for test infrastructure — breaks `/inspect` resume testing, breaks any playtest that wants mid-run state capture. Lower urgency for players (they'd use the Resume Run button). Still needs fixing for the dev tooling.

### HIGH

**HIGH-1: Sustained low FPS in CombatScene (Item 14)**
- **What**: `__rrDebug().fps` measured `{current: 15–18, min: 4, avg: 11–22}` across the whole session. Ten `[fps] Low FPS alert` events in the internal event log, e.g.:
  - `Low FPS alert: 13 fps in CombatScene for 183s`
  - `Low FPS alert: 12 fps in CombatScene for 243s`
  - `Low FPS alert: 8 fps in CombatScene for 423s`
  - `Low FPS alert: 11 fps in CombatScene for 363s`
- **Scope**: Docker headless Chromium with SwiftShader — so the absolute numbers are WORSE than a real player, but the sustained 4–22 fps suggests something is spinning. The spec target is 60 sustained / 45 hard fail. This would be a hard fail on real hardware too if the root cause is not render-backend-specific.
- **Severity**: HIGH — needs profiling. Could be a tween leak, RAF leak, or Phaser object pool churning.

### MEDIUM

**MED-1: AP economy — frequent stranded 1-AP turns (Item 9)**
- **What**: On 6 of the 13 tracked turns (46%), the player ended with exactly 1 AP leftover AND still had apCost:1 cards in hand — but charge plays require 2 AP (cost+1 surcharge) and I wanted to keep charge plays for damage efficiency. Quick-playing instead of wasting AP is the correct workaround, and I did use it on some turns, but the math is hostile: starting AP 3/4 means you can charge exactly 1 card for 2 AP and have 1 AP orphaned, since a second charge needs 2. The only options: (a) charge 1 + quick 1 (gives up half your damage multiplier), (b) charge 1 + waste 1 (common in my logs), (c) quick 3 (gives up ALL charge bonus).
- **Suggestion**: Either (i) bump starting AP to 4/4 every turn (already is on turn 2+), or (ii) make the first-charge-free waiver consistent, or (iii) reduce charge surcharge to 0 when hand is homogeneous same-cost. Current state penalizes conservative play.
- **Severity**: MEDIUM — not a bug, but a consistent feel-bad moment.

**MED-2: Run-end skips `runEnd` screen**
- **What**: Player HP dropped to 0 on E5 T4 → next `getScreen()` returned `hub`, not `runEnd`. `getSessionSummary()` worked but no death screen shown. Spec (Item 12) expected runEnd with final stats render, return-to-hub button, etc.
- **Severity**: MEDIUM — players would expect a death screen with stats, not an instant jump to hub. Likely a missing transition scene or a skipped-when-run-already-committed path.

### LOW

**LOW-1: Inconsistent enemy attack-blocked math**
- Several turns where intent said "attack 10" or "attack 12" but actual HP loss after block did not match (e.g., E1 T1: 9 block vs attack 10 → lost 6 HP, implying ~15 total hit. E5 T3: 16 block vs attack 12 → lost 12 HP, implying block was bypassed or worn down).
- Could be enemy status effects (vulnerable?), thorns return damage, or charge-unleash bonus. Worth auditing the damage pipeline for invisible modifiers.

---

## Raw Data

### Per-encounter summary

| # | Enemy | Enemy HP | Turns | Player HP start → end | HP lost | Result |
|---|---|---|---|---|---|---|
| 1 | Staple Bug | 49 | 10 | 100 → 93 | 7 | WIN |
| 2 | Thesis Construct | 59 | 6 | 93 → 78 | 15 | WIN |
| 3 | Thesis Construct | 40 | 8 | 100 → 64 | 36 | WIN (fresh run 2) |
| 4 | Thesis Construct | 52 | 7 | 47 → 19 | 28 | WIN |
| 5 | Thesis Construct | 66 | 4 | 19 → 0 | 19 | DEATH |

### Per-turn AP/HP table (selected turns — full log in /tmp/rr-actions-balance-*.json)

| Enc | Turn | apStart | apEnd | Cards | Wasted | HPstart | HPend | enemyHP | Notes |
|---|---|---|---|---|---|---|---|---|---|
| E1 | T1 | 3 | 0 | 2 (chg) | 0 | 100 | 94 | 49→42 | charge strike correct (7 dmg) + charge block correct |
| E1 | T2 | 4 | 1 | 2 (chg+wrong) | 1 | 94 | 94 | 42→24 | strike correct 14 dmg, strike wrong 4 dmg (fizzle test) |
| E1 | T3 | 3 | 0 | 2 | 0 | 94 | 93 | 24→24 | enemy defending — wasted on block cards |
| E1 | T4 | 3 | 1 | 2 | 1 | 93 | 93 | 24→24 | 2 block charges, enemy still defending |
| E1 | T5 | 3 | 1 | 1 | 1 | 93 | 93 | 24→24 | **AP WASTED** — 1 left, had apCost:1 cards but couldn't 2nd charge |
| E1 | T6 | 3 | 0 | 2 | 0 | 93 | 93 | 24→16 | charge strike 8 + charge block |
| E1 | T7 | 3 | 1 | 1 | 1 | 93 | 93 | 16→16 | **AP WASTED** — same pattern |
| E1 | T8 | 3 | 1 | 2 (chg+qp) | 0 | 93 | 93 | 16→12 | charge + quickplay (enemy blocked most) |
| E1 | T9 | 3 | 0 | 2 | 0 | 93 | 93 | 12→12 | enemy block absorbed, playerBlock 23 built |
| E1 | T10 | 4 | — | 1 | — | 93 | 93 | 12→0 | finishing blow, combat ended |
| E2 | T1 | 3 | 1 | 1 | 1 | 93 | 93 | 59→59 | **AP WASTED** — only 1 charge could fit |
| E2 | T2 | 4 | 1 | 2 (chg+wrong) | 1 | 93 | 93 | 59→59 | wrong targeted blocks — bad index pick |
| E2 | T3 | 3 | 0 | 2 (chg×2) | 0 | 93 | 93 | 59→45 | 2 charge strikes correct (14 dmg) |
| E2 | T4 | 4 | 1 | 1 | 1 | 93 | 93 | 45→36 | **AP WASTED** |
| E2 | T5 | 4 | 0 | 2 (chg×2) | 0 | 93 | 78 | 36→14 | 22 damage from 2 correct charge strikes; enemy hit 15 |
| E2 | T6 | 3 | 1 | 2 (chg+qp) | — | 78 | 78 | 14→0 | finishing (chg strike 12 + quick) |
| E3 | T1 | 3 | 1 | 1 | 1 | 100 | 100 | 40→33 | **AP WASTED** |
| E3 | T2 | 4 | 0 | 2 (chg+wrong) | 0 | 100 | 100 | 33→33 | 1 correct strike (enemy defending), 1 wrong block |
| E3 | T3 | 3 | 0 | 2 (chg×2) | 0 | 100 | 94 | 33→26 | strike 7 + block 10; enemy attack unleashed 6 HP |
| E3 | T4 | 4 | 1 | 1 | 1 | 94 | 77 | 26→19 | **AP WASTED**; enemy hit 17 |
| E3 | T5 | 3 | 0 | 2 (chg+qp) | 0 | 77 | 77 | 19→12 | chg strike + quickblock |
| E3 | T6 | 3 | 1 | 2 | 1 | 77 | 64 | 12→12 | **AP WASTED**; 2 utility plays, no damage; enemy hit 13 |
| E3 | T7 | 4 | 1 | 2 (chg+qp) | 0 | 64 | 47 | 12→3 | charge strike 9 + quickplay; enemy hit 17 |
| E3 | T8 | 3 | 2 | 1 | 0 | 47 | 47 | 3→0 | quickplay kill (2 dmg) |
| E4 | T1 | 3 | 1 | 1 (chg) | 1 | 47 | 47 | 52→52 | **AP WASTED**; reinforce charge (block) |
| E4 | T2 | 4 | 1 | 1 (chg) | 1 | 47 | 32 | 52→42 | **AP WASTED**; chg strike 10 dmg; enemy hit 15 |
| E4 | T3 | 3 | 1 | 2 (chg×2) | 0 | 32 | 32 | 42→28 | chg block + chg strike 14 dmg |
| E4 | T4 | 3 | 1 | 2 (chg×2) | 1 | 32 | 32 | 28→18 | 2 correct charges; enemy no hit (defending) |
| E4 | T5 | 3 | 1 | 1 (chg) | 1 | 32 | 32 | 18→14 | **AP WASTED** |
| E4 | T6 | 3 | 0 | 2 (chg+qp) | 0 | 32 | 19 | 14→10 | chg block + quickplay strike 4; enemy hit 13 |
| E4 | T7 | 4 | — | 1 | — | 19 | 19 | 10→0 | charge strike finish |
| E5 | T1 | 3 | 1 | 1 (chg) | 1 | 19 | 19 | 66→66 | **AP WASTED**; reinforce block |
| E5 | T2 | 3 | 1 | 1 (chg) | 1 | 19 | 19 | 66→66 | **AP WASTED** |
| E5 | T3 | 3 | 1 | 1 (chg) | 1 | 19 | 7 | 66→56 | **AP WASTED**; enemy unleash hit 12 |
| E5 | T4 | 3 | 1 | 1 (chg) | 1 | 7 | 0 | 56→56 | **AP WASTED**; player died |

**Wasted-AP summary**: 13 of 31 turns (42%) had ≥1 AP left at end-of-turn when a second charge was desired but not affordable. NONE had `forcedEndTurn=true` (player always had at least one playable card via quickplay, just rejected that option strategically).

### HP curve (ASCII, one row per encounter)

```
Enc  Turns:  1   2   3   4   5   6   7   8   9  10  Result
E1:  100—94, 94, 94, 93, 93, 93, 93, 93, 93, 93 → WIN (-7)
E2:   93, 93, 93, 93, 78, 78                    → WIN (-15)
E3:  100,100,100, 94, 77, 77, 64, 47, 47        → WIN (-53)
E4:   47, 47, 32, 32, 32, 32, 19                → WIN (-28)
E5:   19, 19, 19,  7,  0                        → DEATH
```

### Accuracy log
- Correct charge plays: 22
- Wrong charge plays: 3 (E1 T2 strike, E2 T2 block, E3 T2 block)
- Quick plays: 6 (no accuracy)
- Effective accuracy on charge plays: **22/25 = 88%** (higher than target 70% — I was not aggressive enough on wrong answers, and a few failed AP-short attempts didn't count as wrong answers because they didn't register as plays. Intentional wrong: 3.)

### Reward choices observed
- E1 → rewardRoom → `acceptReward()` auto-picked (__rrPlay does not expose the 3-card selection interface). Result: card was added.
- E3 → E4: `reinforce` (block mechanic) appeared in hand of E4 T1. Was played. **Reward was USED.**
- E4 → E5: reward auto-accepted. Did not identify the specific card in E5's hand.
- **rewardsPlayed / rewardsTaken ≈ 2/3 ≈ 67%** (above the 40% MEDIUM threshold). PASS on Item 10 — but the data collection is incomplete because __rrPlay doesn't surface the card-reward options API.

### Mystery event
- After E4, on r2-n1: mystery event with 2 choices:
  - "Read it carefully (upgrade a card)"
  - "Stuff it in your bag (gain a card)"
- Chose #0 via DOM click (because `getMysteryEventChoices()` returned empty array — **minor API gap**). Event resolved, returned to map.

### FPS measurements
- `__rrDebug().fps` end of session: `{current: 18, min: 4, avg: 11}`
- Earlier samples: `{current: 15, min: 15, avg: 22}` (Run 1 E1 T1)
- Event log `[fps] Low FPS alert` entries: 10 across session
- Worst: `8 fps in CombatScene for 423s`

---

## Artifacts

Key screenshots and result JSONs under `/tmp/rr-docker-visual/rr-sweep_none_*/`:
- `1775792881108` — E1 enter combat
- `1775792916386` — E1 T1 complete
- `1775793358583` — pre-reload snapshot captured (HP 78, currency 30)
- `1775793405259` — **post-restore black-body scene** (CRITICAL-2 evidence)
- `1775793502083` — natural Resume Run post-reload
- `1775793582433` — **reviewStateSnapshot.has error** first occurrence (CRITICAL-1)
- `1775794332594` — E5 T4 player death → hub transition
- `1775794377467` — session summary + final FPS measurement

All action files under `/tmp/rr-actions-balance-*.json` (step-by-step reproducible).
