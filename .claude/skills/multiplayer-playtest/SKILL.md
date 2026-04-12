---
name: multiplayer-playtest
description: |
  Two-container multiplayer E2E playtest. Tests lobby system (create, join, password,
  browser, deck selection, ready, leave) and Race Mode gameplay via Fastify webBackend.
  Both containers hit the Fastify server through real WebSocket transport.
user_invocable: true
model: sonnet
---

# /multiplayer-playtest -- Two-Container Multiplayer E2E Playtest

## DOCKER-ONLY -- MANDATORY, NO EXCEPTIONS

**This skill runs EXCLUSIVELY in Docker warm containers via `scripts/docker-visual-test.sh --warm`.** The canonical rule lives in `.claude/rules/testing.md` "Docker-Only LLM Playtests". Summary:

- ALLOWED: `scripts/docker-visual-test.sh --warm start|test|stop --agent-id <id>` with `--actions-file <json>`
- FORBIDDEN: `mcp__playwright__browser_*` against `http://localhost:5173`
- FORBIDDEN: starting `npm run dev` as a playtest prerequisite (but the skill verifies/manages it)
- FORBIDDEN: leaving warm containers running after the batch completes

---

## Reference Sub-Files

| Sub-file | Read when |
|---|---|
| [`references/lobby-actions.md`](references/lobby-actions.md) | Running lobby test scenarios -- contains all 10 lobby action sequences |
| [`references/race-actions.md`](references/race-actions.md) | Running Race Mode test scenarios -- contains all 5 race action sequences |
| [`references/report-format.md`](references/report-format.md) | Generating the final report -- markdown templates and output directory layout |

---

## Arguments

Parse from the user's invocation message:

| Argument | Meaning |
|----------|---------|
| (none) | Run all tests (lobby + race + ui + trivia) |
| `lobby` | Lobby tests only (S1-S10) |
| `race` | Race Mode tests only (R1-R5) -- includes lobby setup |
| `smoke` | Infrastructure smoke test only -- boot + env var verification |
| `ui` | Mode selection UI + Trivia Night isolated tests |

**Examples:**
- `/multiplayer-playtest` -- all tests
- `/multiplayer-playtest lobby` -- lobby tests only
- `/multiplayer-playtest smoke` -- just verify infra works
- `/multiplayer-playtest race` -- race mode end-to-end

---

## Architecture

```
Orchestrator (this skill, inline)
+-- Phase 0: Infrastructure Boot
|   +-- .env.local: VITE_MP_API_URL + VITE_MP_WS_URL -> host.docker.internal:3000
|   +-- Fastify server: PORT=3000 (background, /tmp/rr-mp-server.pid)
|   +-- Vite dev server: verify running, restart if env vars changed
|   +-- Docker: rr-warm-mp-host-{DATE}
|   +-- Docker: rr-warm-mp-guest-{DATE}
+-- Phase 1: Smoke test (both containers, verify env vars baked)
+-- Phase 2: Lobby tests (10 scenarios, alternating host/guest)
+-- Phase 3: Race Mode test (shared seed -> gameplay -> HUD -> race end)
+-- Phase 4: Mode UI tests (all 5 mode cards render)
+-- Phase 5: Trivia Night isolated (scenario preset, host only)
+-- Phase 6: Report aggregation
+-- Phase 7: try/finally teardown (ALWAYS: stop both containers + kill Fastify)
```

**Coordination protocol**: Sequential. Send action batch to one container, read `result.json`, extract state (lobby code, player count), template it into the next container's action batch. No parallel container actions -- multiplayer state flows host -> Fastify server -> guest.

**State extraction shortcut**: The orchestrator can call `GET http://localhost:3000/mp/lobbies` from the host machine directly (Fastify REST API) to extract lobby IDs/codes reliably, instead of scraping container DOM. This is the preferred coordination mechanism.

---

## Phase 0: Infrastructure Boot

### Step 1: Generate Batch ID

```bash
BATCH_ID=$(date +%Y%m%d-%H%M%S)
BATCH_DIR="data/playtests/mp-batches/MP-${BATCH_ID}"
mkdir -p "$BATCH_DIR/screenshots"
```

### Step 2: Env Vars (.env.local)

The `VITE_MP_*` vars are build-time (baked into the Vite bundle). Docker containers need `host.docker.internal` to reach the host. Check and update `.env.local`:

```bash
# Check current state
grep "VITE_MP" .env.local 2>/dev/null || echo "VITE_MP vars not set"
```

If missing or pointing to `localhost`, add/update:
```
VITE_MP_API_URL=http://host.docker.internal:3000
VITE_MP_WS_URL=ws://host.docker.internal:3000/mp/ws
```

**Track whether the file changed** -- if so, the dev server must be restarted (Step 4).

### Step 3: Fastify Server

```bash
# Check if already running
curl -s http://localhost:3000/api/health 2>/dev/null | grep -q '"ok"' && echo "FASTIFY_UP" || echo "FASTIFY_DOWN"
```

If not running, start it:
```bash
cd /Users/damion/CODE/Recall_Rogue/server && PORT=3000 npx tsx src/index.ts > /tmp/rr-mp-server.log 2>&1 &
echo $! > /tmp/rr-mp-server.pid
```

Poll for readiness (max 30s):
```bash
for i in $(seq 1 30); do
  curl -s http://localhost:3000/api/health 2>/dev/null | grep -q '"ok"' && break
  sleep 1
done
```

The MP routes (`/mp/lobbies`, `/mp/ws`) use an in-memory lobby registry with zero DB dependency. The server may emit PostgreSQL warnings for other routes -- ignore them.

**Track whether we started the server** -- if so, we must kill it in teardown.

### Step 4: Vite Dev Server

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null
```

If not running, start: `cd /Users/damion/CODE/Recall_Rogue && npm run dev &`

If running BUT `.env.local` was just modified in Step 2, the bundle has stale env vars. Kill and restart:
```bash
# Find and kill Vite
lsof -ti:5173 | xargs kill 2>/dev/null
sleep 2
npm run dev &
```

Wait ~10s for Vite to boot, then verify:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

### Step 5: Start Both Docker Containers

```bash
scripts/docker-visual-test.sh --warm start --agent-id mp-host-${BATCH_ID}
scripts/docker-visual-test.sh --warm start --agent-id mp-guest-${BATCH_ID}
```

Both get deterministic ports in 3200-3299 (hash of agent-id). Wait for `/health` `ready: true` on both.

**FROM THIS POINT: wrap everything in try/finally for teardown.**

### Step 6: Smoke Test

Write a smoke action file and run on both containers:

```json
[
  {"type": "wait", "ms": 3000},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen(), rrPlay: typeof window.__rrPlay !== 'undefined', wsUrl: typeof import.meta !== 'undefined' && import.meta.env?.VITE_MP_WS_URL || 'NOT_SET', apiUrl: typeof import.meta !== 'undefined' && import.meta.env?.VITE_MP_API_URL || 'NOT_SET'})"},
  {"type": "rrScreenshot", "name": "smoke"}
]
```

**Pass criteria**:
- `rrPlay` is `true`
- `wsUrl` contains `host.docker.internal:3000` (NOT `localhost` or `NOT_SET`)
- `apiUrl` contains `host.docker.internal:3000`
- `screen` is a valid screen name (e.g., `hub`)

If `wsUrl` shows `localhost` or `NOT_SET`, the dev server was not restarted after env var update. Abort, restart dev server, reboot containers.

---

## Phase 2: Lobby Tests (S1-S10)

Read `references/lobby-actions.md` for the full action sequences. High-level flow:

**S1: Create Lobby** -- Host navigates to `multiplayerMenu`, clicks `mode-race`, clicks `btn-create-lobby`. Verify lobby code appears. Confirm via `GET http://localhost:3000/mp/lobbies`.

**S2: Join by Code** -- Extract lobby code from S1 (via Fastify REST). Guest navigates to `multiplayerMenu`, clicks `tab-join`, fills code into `join-code-input`, clicks `btn-join-lobby`. Verify both containers show 2 players.

**S3: Password Protection** -- Host creates a password-protected lobby. Guest tries joining without password (expect error), then with correct password (expect success).

**S4: Lobby Browser** -- Host has a public lobby. Guest navigates to `lobbyBrowser`, verifies lobby row appears, joins from browser.

**S5: Deck Selection** -- Host opens deck picker, selects a deck. Verify content selection syncs to guest via WebSocket settings broadcast.

**S6: House Rules** -- Host sets turn timer and quiz difficulty. Verify settings propagate to guest's lobby state.

**S7: Max Players** -- With lobby at capacity (2 for race), attempt a 3rd join via direct REST POST. Expect 409.

**S8: Visibility** -- Toggle through public/password/friends_only. Verify listing behavior for each state via `GET /mp/lobbies`.

**S9: Ready + Start Gate** -- Both players click ready. Verify `btn-start-game` becomes enabled on host.

**S10: Leave Lobby** -- Guest clicks `btn-leave-lobby`. Verify host sees 1 player, Fastify shows 1 player.

**Between scenarios**: Clear lobby state by having both containers navigate away (`__rrPlay.navigate('hub')`), then call `DELETE` or wait for TTL. Or create fresh lobbies per scenario.

---

## Phase 3: Race Mode Test (R1-R5)

Read `references/race-actions.md` for full action sequences. Prerequisites: S1+S2+S9 completed (both in lobby, both ready).

**R1: Race Start** -- Host clicks `btn-start-game`. Wait 3s. Both eval `__rrPlay.getScreen()`. Expect `dungeonMap` or `combat`.

**R2: Shared Seed** -- Both eval `__rrPlay.getRunState()`. Compare seeds. Must match.

**R3: Gameplay** -- Both: `selectMapNode` -> combat -> `quickPlayCard(0)` -> `endTurn`. Repeat 2 turns each. Verify combat state valid after each turn (no crashes, HP values sensible).

**R4: HUD Verification** -- After host plays a turn, eval guest container for `[data-testid="mp-hud"]`. Verify HUD DOM exists with opponent data (HP, score, floor).

**R5: Race End** -- Host retreats via `__rrPlay.retreat()`. Wait 3s. Check both containers for race end state. Verify `multiplayerGameService` broadcasts `isFinished`.

---

## Phase 4: Mode UI Tests (M1)

Single scenario on host container only (no multiplayer interaction needed):

```json
[
  {"type": "rrPlay", "method": "navigate", "args": ["multiplayerMenu"]},
  {"type": "wait", "ms": 1500},
  {"type": "eval", "js": "JSON.stringify([...document.querySelectorAll('[data-testid^=\"mode-\"]')].map(e => ({id: e.dataset.testid, name: e.querySelector('.mode-name')?.textContent?.trim()})))"},
  {"type": "screenshot", "name": "mode-cards-all"}
]
```

**Pass criteria**: 5 mode cards returned: `mode-race`, `mode-same_cards`, `mode-duel`, `mode-coop`, `mode-trivia_night`, each with a non-empty name.

Click each mode card and screenshot to verify selection state:
```json
[
  {"type": "click", "selector": "[data-testid='mode-duel']", "waitAfter": 500},
  {"type": "screenshot", "name": "mode-duel-selected"},
  {"type": "click", "selector": "[data-testid='mode-coop']", "waitAfter": 500},
  {"type": "screenshot", "name": "mode-coop-selected"},
  {"type": "click", "selector": "[data-testid='mode-trivia_night']", "waitAfter": 500},
  {"type": "screenshot", "name": "mode-trivia-selected"}
]
```

---

## Phase 5: Trivia Night Isolated (T1)

On host container only, load the `trivia-round` scenario preset:

```json
[
  {"type": "scenario", "preset": "trivia-round"},
  {"type": "wait", "ms": 3000},
  {"type": "screenshot", "name": "trivia-round"},
  {"type": "eval", "js": "JSON.stringify({screen: window.__rrPlay?.getScreen(), hasContent: document.querySelector('.trivia-round, [class*=trivia]') !== null})"}
]
```

**Pass criteria**: Screen renders without crash. If the preset doesn't exist or errors, mark as SKIP (not FAIL).

---

## State Extraction Protocol

After each `docker-visual-test.sh --warm test` call, the result lands at:
```
/tmp/rr-docker-visual/{agentId}_{scenario}_{timestamp}/result.json
```

Read it to extract:
- `result.actionLog[N].out` -- the return value of `eval` and `rrPlay` actions (JSON strings)
- `result.success` -- overall pass/fail
- `result.consoleErrors` -- any JS errors from the page
- `result.screenshotPath` -- path to the PNG

To thread state between containers (e.g., lobby code from host to guest):
1. Parse the eval output from the host result: `JSON.parse(actionLog[evalIndex].out)`
2. Extract the value (e.g., `lobbyCode`)
3. Template it into the guest's action file before writing to `/tmp/`
4. OR use the Fastify REST shortcut: `curl http://localhost:3000/mp/lobbies | jq '.lobbies[0].lobbyCode'`

The REST approach is preferred -- it's always correct and avoids DOM parsing fragility.

---

## try/finally Teardown (Phase 7)

**This MUST run unconditionally**, even on crash:

```bash
# Stop both containers
scripts/docker-visual-test.sh --warm stop --agent-id mp-host-${BATCH_ID} 2>/dev/null || true
scripts/docker-visual-test.sh --warm stop --agent-id mp-guest-${BATCH_ID} 2>/dev/null || true

# Kill Fastify if we started it
if [ -f /tmp/rr-mp-server.pid ]; then
  kill $(cat /tmp/rr-mp-server.pid) 2>/dev/null || true
  rm -f /tmp/rr-mp-server.pid
fi
```

Verify no orphans: `docker ps --filter "name=rr-warm-mp-" --format '{{.Names}}'` should return empty.

---

## Backend Selection -- Why It Works Without Code Changes

`warm-server.mjs` loads the game at:
```
${DEV_SERVER}?skipOnboarding=true&devpreset=post_tutorial&turbo
```

No `?mp` param, so `isBroadcastMode()` returns `false`. No Tauri/Steam in Docker, so `hasSteam` is `false`. Therefore `pickBackend()` returns `webBackend` automatically:

```
pickBackend() priority:
  1. isBroadcastMode() -> false (no ?mp)
  2. hasSteam -> false (no Tauri)
  3. webBackend -> SELECTED
```

The `webBackend` reads `VITE_MP_API_URL` (REST) and `VITE_MP_WS_URL` (WebSocket) from the baked Vite bundle. That's why Step 2 (env vars) and Step 4 (dev server restart) are critical.

---

## Key Files Reference

| File | Role |
|------|------|
| `src/services/multiplayerLobbyService.ts` | Lobby lifecycle, `pickBackend()`, `webBackend` |
| `src/services/multiplayerTransport.ts` | `WebSocketTransport`, env var URL construction |
| `src/services/multiplayerGameService.ts` | Race progress, `startRaceProgressBroadcast()` |
| `src/data/multiplayerTypes.ts` | `MultiplayerMode`, `LobbyState`, mode metadata |
| `src/ui/components/MultiplayerMenu.svelte` | Entry screen with mode cards |
| `src/ui/components/MultiplayerLobby.svelte` | Lobby config, player list, ready/start |
| `src/ui/components/LobbyBrowserScreen.svelte` | Public lobby browser |
| `src/ui/components/MultiplayerHUD.svelte` | Race opponent progress overlay |
| `server/src/services/mpLobbyRegistry.ts` | In-memory lobby registry |
| `server/src/routes/mpLobby.ts` | REST routes |
| `server/src/routes/mpLobbyWs.ts` | WebSocket upgrade + relay |
| `scripts/docker-visual-test.sh` | Docker warm container launcher |
| `docker/playwright-xvfb/warm-server.mjs` | Warm container HTTP server + action executor |

---

## Relationship to Other Skills

| Skill | Overlap | Difference |
|-------|---------|-----------|
| `/multiplayer` | Same system | Management skill (status, wiring). This skill is testing. |
| `/llm-playtest` | Same Docker infra | Single-player gameplay testing. This tests multiplayer interactions. |
| `/visual-inspect` | Same Docker containers | Screenshot-based visual check. This tests real two-player flows. |
| `/scenario-playtest` | Same action format | Predefined single-player scenarios. This coordinates two containers. |

Not a replacement for any of them. This is the ONLY skill that tests actual two-player multiplayer interactions.
