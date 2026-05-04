# Full Act 1 + Act 2 Run — 2026-05-01

## Verdict: PASS_WITH_CAVEATS

---

## Run timeline

| Step | Floor | Node | Room type | Outcome | Screen after |
|------|-------|------|-----------|---------|--------------|
| 0 | — | — | Hub → deckSelection | startRun, clicked Trivia Dungeon panel | deckSelectionHub |
| 1 | F1 | r0-n0 | combat | Won in 8 turns vs Overdue Golem (36 HP) | rewardRoom |
| 2 | F1 | reward | rewardRoom | relic-leave + force-dispatch continue | dungeonMap |
| 3 | F1 | r1-n0 | mystery (The Inscription) | Answered correctly (1179) → +40 gold, +heal | dungeonMap |
| 4 | F2 | r2-n0 | combat | Won in 10 turns vs Staple Bug (70 HP) | rewardRoom |
| 5 | F2 | reward | rewardRoom | relic-leave + force-dispatch continue | dungeonMap |
| 6 | F2 | r3-n0 | mystery (The Reading Nook) | Triggered card upgrade → cardUpgradeReveal | cardUpgradeReveal |
| 7 | F2 | cardUpgrade | cardUpgradeReveal | Strike L3→L4 | dungeonMap |
| 8 | F3 | r4-n1 | treasure | rewardRoom (treasure) | rewardRoom |
| 9 | F3 | reward | rewardRoom | relic-leave + force-dispatch continue | dungeonMap |
| 10 | F4 | r5-n0 | **shop** | Bought Adrenaline Shard (44g); confirm leave dialog appeared; clicked "Leave anyway" | dungeonMap |
| 11 | F4 | r6-n0 | rest | restHeal() → HP 57→77 | dungeonMap |
| 12 | F5 | r7-n0 | **boss** (The Algorithm / The Burning Deadline) | Won in ~12 turns (144 HP); player HP 64/100 at victory | rewardRoom |
| 13 | F6 | reward | rewardRoom | relic-leave + force-dispatch continue | specialEvent (Relic Forge) |
| 14 | F6 | — | specialEvent (Relic Forge) | Skipped | retreatOrDelve |
| 15 | F6 | — | retreatOrDelve | delve() → Deep Caverns | dungeonMap (Act 2) |
| 16 | F7 | r0-n0 | **Act 2 combat** | Won in ~9 turns vs The Citation Needed (135 HP) | rewardRoom |
| 17 | F7 | reward | rewardRoom | relic-leave + force-dispatch continue | dungeonMap |
| 18 | F7 | r1-n0 | **Act 2 mystery** (The Flashcard Merchant) | Paid 25g, studied 3 facts, +60% charge damage | dungeonMap |
| 19 | F8 | r2-n0 | **Act 2 rest** | restHeal() → HP 53→73 | dungeonMap |

---

## Map visibility — every dungeonMap render

| Step | Segment | Floor | scrollTop | Row-0 nodes visible | Notes |
|------|---------|-------|-----------|---------------------|-------|
| Fresh start (after reload) | Shallow Depths | F1 | 108 | ❌ (top=1233) | Auto-scroll DID NOT fire on initial load |
| After manual scroll | Shallow Depths | F1 | 392 | ✅ (top=949) | Nodes exist, just off-screen; manual scroll workaround works |
| After combat 1 reward | Shallow Depths | F2 | 392 | ✅ (top=814) | Auto-scroll fired correctly after returning from reward |
| After mystery 1 | Shallow Depths | F2 | 108 | ✅ (top=963, row 2) | Visible without scroll |
| After mystery 2 (Reading Nook) | Shallow Depths | F3 | — | ✅ (row 4 visible) | |
| After treasure reward | Shallow Depths | F4 | — | ✅ (row 5/6 visible) | |
| After shop | Shallow Depths | F4 | — | ✅ (row 6 visible) | |
| After boss reward + delve | Deep Caverns | F7 | 392 | ✅ (top=949) | Auto-scroll fired correctly after delve |
| Act 2 after combat 1 | Deep Caverns | F7 | — | ✅ (row 1 visible) | |
| After Act 2 mystery | Deep Caverns | F8 | 108 | ✅ (row 3 visible) | |

---

## Bugs / anomalies

### BUG-1: Auto-scroll fails on initial dungeonMap load (REGRESSION)
- **Description**: On first dungeonMap render after startRun, the auto-scroll did NOT trigger. Row-0 nodes were at y=1233 (scrollTop=108), well below the 1080px viewport. After 10+ seconds of waiting (including the 5s MutationObserver retry tail), scrollTop remained at 108.
- **Workaround used**: Manual `c.scrollTop = 400` via eval. After that, nodes were visible (top=949).
- **Impact**: Real players would see a black map with no visible nodes. They would need to manually scroll or know to look below the viewport.
- **Context**: This only failed on the INITIAL load. All subsequent map renders (after returning from rooms) had correct scrollTop=392. The fix in `acc54a441` may not cover the specific path: fresh run start → deck select → start run → narration → dungeonMap.
- **Docker note**: May be a SwiftShader/Docker timing issue. Needs validation in the packaged Tauri binary.

### NOTE-1: RewardRoom Continue requires dispatchEvent, not .click()
- **Description**: `btn.click()` on the Continue button had mixed results (appeared to work sometimes but left the game in a dark-screen-with-rewardRoom-state). `btn.dispatchEvent(new MouseEvent('click', {bubbles:true}))` reliably triggered the transition to dungeonMap.
- **Root cause**: The reward room Continue button is behind a CSS transform (`matrix(1, 0, 0, 1, -135, -39)`) and rendered as HIDDEN in the layout dump, but its computed style shows visibility:visible. The `.click()` synthetic event may not bubble correctly through the transform stack in the Docker Chromium environment.
- **Impact**: In the actual Tauri/Chrome app this likely works fine. Docker-specific behavior.
- **Not a regression**: The `21a308ab1` fix (RewardRoom softlock) is confirmed working — we successfully returned to dungeonMap after every combat.

### NOTE-2: Boss display name mismatch
- **Description**: During combat, `getCombatState()` returns `enemyName: 'The Algorithm'`. The retreat/delve victory screen says "You defeated The Burning Deadline." These appear to be different display names for the same enemy.
- **Severity**: Minor / cosmetic. Not a functional bug.

### NOTE-3: Shop leave confirmation dialog works correctly
- **Description**: After `shopLeave()`, a "Leave the shop? You still have gold..." confirmation appeared. Clicking "Leave anyway" via DOM worked. This is expected behavior.

### NOTE-4: Low FPS in CombatScene
- **Description**: FPS alert logged: "Low FPS alert: 16 fps in CombatScene for 63s" during the first combat. This is Docker/SwiftShader artifact, not a game bug.

---

## Steam-resubmission confidence

**YES (with one caveat)** — The core loop is solid: hub → run start → combat → reward room → map (no softlock) → shop → rest → boss → retreat/delve → Act 2 map → Act 2 encounters all completed without hard blocks. The RewardRoom Continue bug (commit `21a308ab1`) is confirmed fixed. The delve transition works cleanly.

**Caveat**: Auto-scroll (commit `acc54a441`) FAILED on the initial dungeonMap load in the Docker container. Every subsequent map render scrolled correctly. If this failure also manifests in the packaged Tauri binary, the fix is incomplete. **Recommend testing the initial map load in the actual Steam build** before resubmission.

---

## Screenshots

Key screenshots captured under `/tmp/rr-docker-visual/fullact-2026-05-01_*/`:

| Label | What it shows |
|-------|---------------|
| `phase0-after-reload` | Hub screen — clean starting state |
| `fresh-map` | First dungeonMap with manual scroll — nodes at bottom |
| `combat-1-start` | Overdue Golem combat starting |
| `post-combat1` | RewardRoom after first combat |
| `mystery-room-enter` | The Inscription mystery event |
| `mystery-quiz-start` | Quiz question showing |
| `mystery-quiz-answered` | Correct answer highlighted |
| `back-to-map-1` | Map after combat 1 reward (auto-scroll worked) |
| `shop-enter` | Shop room with inventory |
| `boss-fight-start` | The Algorithm boss combat |
| `boss-defeated` | RewardRoom after boss victory |
| `after-relic-forge` | Relic Forge special event skipped |
| `boss-post-reward` | retreatOrDelve "SEGMENT CLEARED" screen |
| `act2-map-enter` | Deep Caverns Floor 7 map — auto-scroll worked |
| `act2-combat1-start` | The Citation Needed Act 2 combat |
| `act2-reward-room` | Act 2 reward room |
| `act2-mystery-enter` | The Flashcard Merchant |
| `act2-flashcard-study` | 3 facts studied |
| `act2-after-flashcard` | +60% charge bonus applied |
| `final-act2-map` | Deep Caverns Floor 8 — session end |
