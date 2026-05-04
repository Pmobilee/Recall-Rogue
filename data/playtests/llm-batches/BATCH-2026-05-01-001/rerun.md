# Stress Re-run Report — 2026-05-01

## Verdict: FAIL

Both fixes require additional work. Bug 2 (rewardRoom softlock) is **partially fixed** but the
`acceptReward` rrPlay API crashes. Bug 1 (map auto-scroll) is **partially broken** on initial
map load only; subsequent map transitions display nodes in-viewport correctly.

---

## Encounters Tested

| # | Run | Node | Room Type | Result | Transitions |
|---|-----|------|-----------|--------|-------------|
| 1 | Run 1 | r0-n0 | combat | victory (turn 6) | combat → rewardRoom (DOM Continue) → dungeonMap ✓ |
| 2 | Run 1 | r1-n0 | mystery (Tutor's Office) | completed | mysteryEvent → dungeonMap ✓ |
| 3 | Run 1 | r2-n0 | shop | left shop | shopRoom → dungeonMap ✓ |
| 4 | Run 1 | r3-n0 | combat | player died (turn 13) | combat → runEnd ✓ |
| 5 | Run 2 | r0-n0 | combat | victory (turn ~8) | combat → rewardRoom (DOM Continue) → dungeonMap ✓ |
| 6 | Run 2 | r1-n0 | combat (r2 node) | player died (turn 10) | combat → runEnd ✓ |
| 7 | Run 3 | r0-n0 | combat | victory (~8 turns) | combat → rewardRoom (DOM Continue) → dungeonMap ✓ |
| 8 | Run 3 | r1-n0 | combat | player died (~8 turns) | combat → runEnd ✓ |

3 clean **combat → rewardRoom (DOM Continue) → dungeonMap** loops confirmed.
Boss/retreatOrDelve screen NOT reached — player died before reaching row 5 boss.

---

## Bug 1 (map auto-scroll) — PARTIAL FIX

**Status: Broken on initial map load; works correctly on subsequent returns.**

### Initial map load (broken)
- On first load: `map-scroll-container` auto-scrolled to `scrollTop: 108` px
- Required scroll: `392` px to bring entrance row (r0) nodes into viewport
- Entrance nodes (r0-n0, r0-n1, r0-n2) had DOM positions at y=1233–1311, **outside the 1080px viewport**
- Screenshot confirmed: completely black map, no nodes visible
- Fix: manual `scrollTop = scrollHeight - clientHeight` workaround used in testing

### Subsequent returns from rooms (works)
- After reward → dungeonMap: `scrollTop: 392`, available nodes r1-n0/r1-n1 at y=814–892 (**in viewport**)
- After mystery → dungeonMap: `scrollTop: 108`, available nodes at y=963 (**just barely in viewport** — top 963, bottom 1041 vs viewport 1080)
- After shop → dungeonMap: `scrollTop: 108`, nodes visible

**Summary:** The fix only scrolls to 108px consistently, but 392px is needed on initial load.
On re-entries, the next available row is higher up the map so 108px happens to be sufficient
to bring them into the visible area (they're at y~963). But the **entrance row (y=1233) is never
visible** without the user manually scrolling.

---

## Bug 2 (rewardRoom softlock) — PARTIAL FIX

**Status: DOM Continue button works; rrPlay `acceptReward` crashes.**

### DOM Continue button (FIXED)
- Confirmed 3× in separate runs: `document.querySelector('[data-testid="btn-reward-room-continue"]').click()`
  navigates to `dungeonMap` correctly. Button is present, enabled, and functional.

### rrPlay acceptReward (BROKEN)
- Error: `{'ok': False, 'message': "Error: Cannot read properties of null (reading 'drawImage')"}`
- After error: black screen with only topbar visible, game state stuck on `rewardRoom`
- Caller was then rescued by clicking DOM Continue button directly
- This is a JavaScript null-ref crash inside the acceptReward implementation (canvas context likely nil)

---

## New Issues Found

### 1. Reward room renders black on initial entry (minor UX issue)
- When navigating from combat → rewardRoom, the initial state shows a black screen with narration overlay
- The narration has a countdown timer (`click to dismiss (5s)`) that blocks interaction
- The `[data-testid="btn-reward-room-continue"]` button is present but hidden behind narration
- After narration dismisses, the reward room card selection renders correctly
- Not a softlock — just a timing/sequencing issue. Cards do appear after dismiss.

### 2. Player dies before reaching boss in all 3 run attempts
- All 3 runs ended at row 3–4 (out of 8 rows to boss at row 7)
- Player HP was 19–57 entering rows 3–4; enemy HP was 43–78
- Deck composition heavy on shields/buffs, weak on attack cards
- This is balance feedback, not a bug, but blocks boss path testing

### 3. `shopLeave` rrPlay doesn't navigate — needs confirmation dialog click
- `rrPlay shopLeave` returns `ok: true, Screen: shopRoom` but doesn't actually leave
- The shop shows a confirmation dialog ("Leave the shop? You still have gold...")
- Must click `[data-testid="btn-leave-confirm"]` to complete the navigation
- This is a rrPlay API limitation — `shopLeave` should click through the confirmation

### 4. `mysteryContinue` rrPlay is ambiguous
- During The Tutor's Office, `mysteryContinue` triggered "Begin Quiz" but left screen as `mysteryEvent`
- Had to manually click quiz answers + "See Results" + "Continue" button sequence
- The rrPlay `mysteryContinue` method should fully skip the mystery or it needs a `mysterySkip` variant

### 5. Navigation to devpreset URL breaks the warm Docker container
- Using `location.href = 'http://localhost:5173?devpreset=post_tutorial'` broke the rrPlay session
- After navigation, `window.__rrPlay` was never re-registered
- The warm container could not recover even after `location.reload(true)`
- Do not navigate away from localhost:5173 root during warm container sessions

---

## Transitions Summary (across all runs)

| Transition | Count | Result |
|---|---|---|
| combat → rewardRoom | 3 | ✓ All worked |
| rewardRoom (DOM Continue) → dungeonMap | 3 | ✓ All worked |
| rewardRoom (rrPlay acceptReward) → dungeonMap | 1 | ✗ Crashed with drawImage null |
| mysteryEvent → dungeonMap | 1 | ✓ |
| shopRoom → dungeonMap | 1 | ✓ |
| combat → runEnd (player death) | 4 | ✓ Clean death screen |

---

## Raw Evidence

- Bug 1 scroll value: `scrollTop: 108` vs needed `392` (delta = 284px short)
- Bug 2 crash: `Cannot read properties of null (reading 'drawImage')` in acceptReward
- DOM Continue clicks: 3× confirmed working (`disabled=false`, getScreen returned `dungeonMap`)
- Map node positions on initial load: r0 nodes at y=1233 (viewport=1080 → off-screen by 153px)
