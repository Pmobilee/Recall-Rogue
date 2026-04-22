# Multiplayer / Steam Co-op Audit — MP-AUDIT-2026-04-22-STEAM-COOP

**Date:** 2026-04-22
**Scope:** Static code audit — Steam P2P, lobby→game handoff, co-op mode init, seed/content propagation.
**Method:** Orchestrator + 5 parallel Explore sub-agents, each scoped to a distinct surface area. All critical claims verified by orchestrator against source before cataloguing.
**Trigger:** User report — "on Steam play, players can join lobbies together but each player seems to join their own game in co-op mode." Dev two-tab mode works; Steam build does not.
**Verdict:** FAIL (21 issues, 3 of them CRITICAL smoking guns for the reported bug).

---

## Prime-Suspect Chain (read this first)

The reported bug — "each player joins their own game in co-op" — is almost certainly the confluence of **BUG-1 + BUG-2 + BUG-3** below. If only one fires, the bug is latent. In the Steam build all three are likely to fire together on any given join, which matches the user's observed 100%-repro.

1. **BUG-1** — guest silently drops `mode/deckId/houseRules` from `mp:lobby:start` payload. Guest keeps whatever `lobby.mode` was set by `mp:lobby:settings`. On Steam P2P, `mp:lobby:settings` can be lost (the comment at `multiplayerLobbyService.ts:1201-1202` explicitly acknowledges this — it's why `contentSelection` is re-sent in the start payload. The author remembered `contentSelection` but forgot `mode`).
2. **BUG-2** — `initCoopSync()` on the guest is gated on `lobby.mode === 'coop'` at `CardApp.svelte:857`. If BUG-1 left mode stale (e.g. default `'race'`), `initCoopSync` is not called and the guest **never subscribes to any `mp:coop:*` messages**. The host's `broadcastSharedEnemyState` lands on zero listeners.
3. **BUG-3** — host's `_fireSubscribers(_gameStartSubscribers, …)` fires via a 3-second timeout fallback (`multiplayerLobbyService.ts:1234-1242`) regardless of ACK arrival. If guest's ACK is lost and the host proceeds anyway, the two clients commit to slightly different run state with no resync opportunity.

Fix BUG-1 alone and the reported symptom probably disappears. Fix all three and this class of bug stops recurring.

---

## Issue Leaderboard

### CRITICAL — smoking guns for the reported bug

| ID | Title | Evidence |
|----|-------|----------|
| BUG-1 | Guest silently discards `mode`, `deckId`, `houseRules` from `mp:lobby:start` payload | `multiplayerLobbyService.ts:1196-1204` vs `:1562-1565` |
| BUG-2 | `initCoopSync()` guarded on `lobby.mode === 'coop'`; guest skips coop init entirely when mode is stale | `CardApp.svelte:857-859` |
| BUG-3 | Host fires `onGameStart` via 3s timeout even when no guest ACKed — host proceeds into a run the guest may never join | `multiplayerLobbyService.ts:1234-1242` |

### HIGH — adjacent real bugs (each can cause divergence under its own conditions)

| ID | Title | Evidence |
|----|-------|----------|
| BUG-4 | `mp:lobby:start_ack` NOT in `MultiplayerMessageType` union — sent via `as` cast, routing fidelity on Steam unverified by tests | `multiplayerLobbyService.ts:1578-1586` |
| BUG-5 | `SteamP2PTransport` is hard-coded single-peer (`private peerId = ''`) — 3-4P co-op / trivia_night cannot work | `multiplayerTransport.ts:502, 550, 724` |
| BUG-6 | `initCoopSync` called AFTER `startNewRun()` which synchronously transitions screen — early host broadcast arrives before guest subscribes | `CardApp.svelte:849-858` |
| BUG-7 | `onPartnerStateUpdate` subscription registered AFTER `initCoopSync` AND AFTER `startNewRun` — first `mp:coop:partner_state` can hit zero listeners | `CardApp.svelte:873` |
| BUG-8 | Host never self-loopbacks its own `mp:lobby:start` on Steam P2P (BroadcastChannel does) — host's own `_fireSubscribers` path relies on the 3s-timeout fallback, not the handler | `multiplayerTransport.ts` (no Steam loopback) vs `:983-995` (broadcast self-filter) + `multiplayerLobbyService.ts:1234-1242` |
| BUG-9 | `acceptP2PSession(peerId)` returned `false` is logged but state transitions to `'connected'` anyway — messages sent immediately after land on a half-open session | `multiplayerTransport.ts:563-575` |
| BUG-10 | No initial `broadcastPartnerState` at encounter start — guest's initial HP/block only reaches host after first turn-end | `encounterBridge.ts` (`broadcastPartnerState` only called at end-of-turn) |
| BUG-11 | `$effect` cleanup at `CardApp.svelte:896-906` unconditionally calls `destroyCoopSync()` — if the effect re-runs mid-run (because any tracked dep changes), all coop listeners are torn down | `CardApp.svelte:896-906` |
| BUG-12 | ACK retry loop at 750ms does not await send-delivery confirmation — `transport.send()` returns before `_sendWithRetry` finishes, so the retry interval can't tell whether the prior send actually landed | `multiplayerLobbyService.ts:1224-1232` vs `multiplayerTransport.ts:673-707` |
| BUG-13 | `contentSelection` is the ONLY payload field with a presence guard in CardApp (`:812-821`); missing `mode` / `deckId` pass silently through | `CardApp.svelte:812-821` |

### MEDIUM — fragility, near-misses, missing validation

| ID | Title | Evidence |
|----|-------|----------|
| BUG-14 | Unit tests for `mp:lobby:start` use seed-only stubs — would not have caught BUG-1 | `multiplayerLobbyService.test.ts:287, 300` |
| BUG-15 | P2P send / recv channel is `0` in both directions but via argument defaults, not a shared constant — refactor hazard | `steamNetworkingService.ts:654, 731` |
| BUG-16 | `session_request_callback` handle assigned as `Some(())` in `SteamState`, not the real `CallbackHandle` — sub-agent flagged this as possibly dropped by `steamworks-rs`; worth Rust-side confirmation | `src-tauri/src/steam.rs:86, 379` |
| BUG-17 | BUG-24 pattern (stale `LobbyChatUpdate.Left` from prior lobby) was patched for Left but there are 6+ other chat-update paths that could carry stale state across lobby re-joins; no general "ignore events whose lobby_id ≠ current" guard | recent commits `df09f5857`, `d15ed5471` |
| BUG-18 | `broadcastPartnerState called before initCoopSync -- dropped` log message (`multiplayerCoopSync.ts:489`) documents a known silent-drop path — symptomatic of BUG-6 but also a separate hazard for any caller racing init | `multiplayerCoopSync.ts:489, 629` |
| BUG-19 | `_currentLobby` is mutated in place (e.g. `multiplayerLobbyService.ts:1570-1574` sets `contentSelection`, `seed`, `status` directly on the existing object) — Svelte `$derived` watchers that depend on `lobby.X` may not invalidate because the reference is identical | `multiplayerLobbyService.ts:1570-1574` and the spread-workaround in commit `1223272ec` |

### LOW — observability and diagnostics (don't fix the bug, but make the next one easier)

| ID | Title | Evidence |
|----|-------|----------|
| BUG-20 | `invokeSteam()` null-coalesces all errors — "Steam unavailable", "IPC denied", "command threw" are indistinguishable in logs | `steamNetworkingService.ts:99, 117` |
| BUG-21 | Rust stdout/stderr redirect to `~/Library/Logs/Recall Rogue/debug.log` is platform-specific and not surfaced in-game — end users won't know to attach it to bug reports | `src-tauri/src/main.rs:15-38` |

---

## Fix Priority (recommended landing order)

1. **BUG-1** (trivial — add `mode?: MultiplayerMode; deckId?: string; houseRules?: HouseRules` to the payload type at `multiplayerLobbyService.ts:1562-1565` and apply them to `_currentLobby` before `_fireSubscribers`). 10-line change. Very high probability this alone resolves the reported bug.
2. **BUG-2** (defensive — after BUG-1, add an assertion inside the `mp:lobby:start` handler that logs `console.error` if `_currentLobby.mode` is `undefined` at fire time).
3. **BUG-3** (convert 3-second timeout from "fire anyway" to "fire with warning when at least 1 ACK received, abort otherwise" — abort returns guest to lobby rather than stranding host in an empty run).
4. **BUG-4** (add `'mp:lobby:start_ack'` to `MultiplayerMessageType` and regenerate any dependent type guards — remove the TODO).
5. **BUG-6 + BUG-7** (move `initCoopSync`, `onPartnerStateUpdate`, `initMapNodeSync` subscriptions BEFORE `startNewRun` inside the game-start callback so they're live before scene transition).
6. **BUG-8** (host-side: call `_fireSubscribers(_gameStartSubscribers, seed, _currentLobby)` immediately after `transport.send('mp:lobby:start', …)` rather than relying on receiving its own echo or waiting for a timeout).
7. **BUG-5** (defer — this is a 3-4P issue; ship the 2P fix first, queue the multi-peer refactor behind it).
8. **BUG-14** (add regression test: receive `mp:lobby:start` with `{ seed, mode: 'coop', deckId: 'x', houseRules: {...}, contentSelection: {...} }` and assert `_currentLobby.mode === 'coop'` after).
9. Everything else is hardening / observability — queue per the table above.

---

## What I cleared (so we don't re-investigate)

- **Message type routing** — `mp:coop:*` / `mp:duel:*` / `mp:race:*` are all handled uniformly by transport; no prefix-based silent drop. Verified `multiplayerTransport.ts:60-118`.
- **Reliability flags** — all P2P sends use `RELIABLE | AUTO_RESTART_BROKEN_SESSION`. Verified.
- **Channel number** — both send and recv use `0` (default arg). Matches. Fragile but not currently broken.
- **`primeP2PSessions` call sites** — IS called at `multiplayerLobbyService.ts:508, 651, 755` after every create/join. Sub-agent-4 was wrong on this — corrected.
- **Tauri capabilities blocking `steam_*` commands** — sub-agent-4 claimed the minimal `capabilities/default.json` blocks all steam commands; empirically wrong (user successfully joins lobbies on Steam, which requires `steam_*` commands to reach Rust). Tauri v2 `#[tauri::command]` fns registered via `invoke_handler!` are not gated by plugin-style capabilities. Not the bug.
- **Post-accept poll loop existence** — `startMessagePollLoop` at 16ms interval does run post-connect. Verified.
- **`initCoopSync` function existence** — exists at `multiplayerCoopSync.ts:148`. Called at `CardApp.svelte:858`. Sub-agent-2 speculation that it might not exist was checked and cleared.

---

## Method notes

Five parallel Explore sub-agents each produced 5-9 candidate issues. Orchestrator cross-checked:
- Every CRITICAL claim against the actual source at the cited line
- Every claim that a function "doesn't exist" via direct grep
- Every claim that a call site is missing via direct grep

Three sub-agent claims were corrected / downgraded based on ground truth:
- "primeP2PSessions is never called" → false, called in 3 places
- "Tauri capabilities block all steam_* commands" → false, user is already joining lobbies
- "mode is extracted but not applied" → false, mode is NOT even in the typed payload — discarded at the type-narrowing step

Two sub-agent claims became MORE severe on verification:
- BUG-1 (mode discard) — the comment at `:1201-1202` proves the author knew settings can drop; they handled `contentSelection` but forgot `mode/deckId/houseRules`. This is a maintenance-blind-spot bug, not a simple omission.
- BUG-3 (3s timeout fires regardless) — confirmed exact behavior at `:1234-1242` including `_pendingStartAcks.size > 0` logged as `console.warn` then proceeding anyway.
