# Full Run Bug Hunter Report — BATCH-2026-05-01-001

**Date:** 2026-05-01  
**Agent:** Full Run Bug Hunter (Sonnet 4.6)  
**Steam Rejection Claim:** "After defeating a monster, the player is not sent back to the dungeon. The player is indefinitely waiting for an encounter or has to go back to the camp. Progression in the dungeon is not possible."

---

## Verdict: CRITICAL

Two Steam-blocking progression bugs confirmed. Both independently prevent dungeon progression. Bug #1 is the primary reproducer of the Steam rejection.

---

## Steam-Blocking Progression Test

- **Encounter 1:** Completed combat (Index Weaver, 45 HP, 3 turns). Post-combat screen transitioned to `rewardRoom`. Reward items rendered correctly (gold, vial, 3 cards). After reward collection → **STUCK on black rewardRoom screen** — never returned to dungeonMap. CRITICAL.
- **Encounter 2:** Not reached — stuck from Encounter 1.
- **Map navigation (fresh run):** On fresh startRun → dungeonMap, all 3 available nodes render at y=1233 in a 1080px viewport. Nodes are **below the visible viewport**. Map appears completely black to the player. Cannot click any nodes to start combat at all.

---

## Bugs Found

### Bug 1: Dungeon Map nodes rendered off-screen — players cannot start combat

**Severity: CRITICAL (Steam-blocking)**

**Reproduction:**
1. Start a new Trivia Dungeon run via `startRun()` + `selectDomain('trivia')`
2. Dungeon map loads — appears completely black to player
3. DOM check: all available map nodes (r0-n0, r0-n1, r0-n2) have `getBoundingClientRect().y = 1233` on a 1080px viewport
4. `scrollTop = 108` on the `.map-scroll-container` — showing the TOP of the map (boss area), not the bottom where row-0 nodes live
5. Player sees no combat nodes; there is nothing to click

**Evidence:**
- Screenshot: `step22-fresh-dungeonmap.rr.jpg` — black screen with narration overlay
- Screenshot: `step23-map-after-narration.rr.jpg` — black dungeon map, no visible nodes
- DOM check output: `{"available":[{"testId":"map-node-r0-n0","y":1233},...],"total":21}`
- After manual `scrollTop = scrollHeight - clientHeight`: nodes appear at y=949, combat works (screenshot `step24-map-scrolled.rr.jpg`)
- `scrollContainer: {scrollTop:108, scrollHeight:1398, clientHeight:1006}` — needs scrollTop≈392 to show row-0 nodes

**Root cause hypothesis:**
`DungeonMap.svelte` auto-scroll `$effect` (line 349) uses `scrollIntoView({ behavior: 'smooth', block: 'center' })` inside a `requestAnimationFrame`. The effect fires but either:
1. `scrollContainer` is bound before map-nodes are in the DOM, so `querySelector('.state-available')` returns null on the first RAF, and
2. `behavior: 'smooth'` may not complete/animate in Docker's Chromium headless, OR
3. The initial scrollTop=108 was set by some other logic but smooth-scroll to row-0 is failing silently

Manual scroll to bottom (`scrollTop = scrollHeight - clientHeight`) immediately reveals all nodes and makes combat accessible.

**Files:** `src/ui/components/DungeonMap.svelte` — lines 348–358 (auto-scroll effect)

---

### Bug 2: Post-combat rewardRoom stuck — never transitions back to dungeonMap

**Severity: CRITICAL (Steam-blocking)**

**Reproduction:**
1. Enter combat (worked by manually clicking map node DOM element)
2. Defeat enemy (Index Weaver) in ~3 turns using `chargePlayCard`
3. Screen transitions to `rewardRoom` ✓ — reward items visible (gold, vial, 3 cards)
4. Call `acceptReward()` — gold 60→70, HP 73→81 (items collected) ✓
5. Screen remains `rewardRoom` after 4+ seconds
6. `btn-reward-room-continue` exists in DOM (display:block, opacity:1, pointerEvents:auto) but clicking it does NOT change screen
7. `getScreen()` returns `rewardRoom` indefinitely — **dungeon map never reloads**

**Evidence:**
- Screenshots: `step14-post-combat.rr.jpg`, `step16-after-acceptreward.rr.jpg`, `step17-after-continue-click.rr.jpg` — all show black 1920×1080 screen with top HUD
- `__rrDebug()` at stuck state: `{"currentScreen":"rewardRoom","phaser":{"activeScene":null}}`
- Phaser scene check: `game.scene.getScenes(true)` returns `[]` — ALL scenes inactive
- `mgr.getRewardRoomScene().scene.isActive()` → `false` despite scene object existing
- Manually calling `game.scene.start('RewardRoom', {rewards:[]})` DOES start the scene — confirming Phaser CAN run it
- `triggerRewardRoomContinue()` logs: "no active RewardRoomScene" and no-ops

**Root cause hypothesis:**
The `openRewardRoom()` bridge (`src/services/rewardRoomBridge.ts`) calls `mgr.startRewardRoom(data)` which does `game.scene.start('RewardRoom', data)`. The `waitForRewardRoomScene()` polls up to 3s for the scene to become active. 

During the `acceptReward()` API call, the scene polled as active (gold/vial were collected by emitting pointerdown on sprites). But `sceneComplete` was never emitted because `checkAutoAdvance()` only fires when ALL items are collected, and the API only collects gold+vial+1card (leaving 2 cards uncollected).

The fallback `triggerRewardRoomContinue()` then runs, but the scene has since become inactive (possible race with `stopCombat()` or Phaser scene management). Without an active scene to receive `sceneComplete`, `handleComplete()` never runs, `proceedAfterReward()` never runs, and `currentScreen` stays on `rewardRoom` forever.

**Secondary factor:** The initial `phaser: null` in `__rrDebug()` is a red herring — `getPhaserState()` reads `rr:gameManagerStore` (wrong symbol), while `phaserPerf` correctly reads `rr:cardGameManager`. The game IS running but the debug bridge has a symbol mismatch.

**Files:**
- `src/services/rewardRoomBridge.ts` — `triggerRewardRoomContinue()` (lines 42–54): silently no-ops when scene inactive
- `src/services/rewardRoomBridge.ts` — `openRewardRoom()` (lines 147–251): listener lifecycle and `sceneComplete` dependency
- `src/game/scenes/RewardRoomScene.ts` — `checkAutoAdvance()` (lines 705–720): only fires when ALL items collected
- `src/dev/playtestAPI.ts` — `acceptReward()` (lines 605–699): only collects one card, leaving others uncollected

---

### Bug 3 (MEDIUM): selectMapNode API silently ignores off-screen nodes

**Severity: MEDIUM**

`window.__rrPlay.selectMapNode('map-node-r0-n0')` calls `btn.click()` on the node element. When nodes are at y=1233 (below viewport), the click fires but the navigation fails silently. After 5s polling loop, returns `{ok:true}` despite screen staying on `dungeonMap`. The API should detect when `btn.getBoundingClientRect().y > window.innerHeight` and report an error or scroll first.

**Files:** `src/dev/playtestAPI.ts` — `selectMapNode()` (lines 552–590)

---

### Bug 4 (LOW): Debug bridge symbol mismatch — phaser field always null

**Severity: LOW**

`getPhaserState()` in `debugBridge.ts` reads `readSymbolStore('rr:gameManagerStore')` (a string key) while the actual CardGameManager is registered at `Symbol.for('rr:cardGameManager')`. This causes `__rrDebug().phaser` to always return `null` even when Phaser is running. The `phaserPerf` field uses the correct symbol and shows real data.

**Files:** `src/dev/debugBridge.ts` — `getPhaserState()` (lines 186–205)

---

## Run Stats

- **Floors reached:** 1 (Shallow Depths, Floor 1)
- **Encounters completed:** 1 (combat won, reward room stuck)
- **Deaths:** 0
- **Map scroll auto-fix:** Never happened (nodes off-screen on every fresh run tested)
- **Time:** ~25 minutes
- **Screenshots captured:** 24 steps

## Summary for Fix Priority

1. **Bug 1 (CRITICAL):** Fix `DungeonMap.svelte` auto-scroll — use `behavior: 'instant'` or `scrollTop` assignment instead of smooth scrollIntoView. Ensure scroll fires after nodes are mounted.
2. **Bug 2 (CRITICAL):** Fix `rewardRoom` → `dungeonMap` transition — ensure `sceneComplete` always fires, or add a DOM-level fallback that calls `proceedAfterReward()` directly when Continue is clicked and no active scene is found.
3. **Bug 3 (MEDIUM):** Fix `selectMapNode` to scroll+retry if node is off-screen.
4. **Bug 4 (LOW):** Fix `getPhaserState()` symbol to use `Symbol.for('rr:cardGameManager')`.
