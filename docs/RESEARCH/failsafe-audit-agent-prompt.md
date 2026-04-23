# Failsafe Audit Agent — Prompt

**Purpose:** Deep pass through Recall Rogue's runtime flows to find every state
the game can enter where the player can observe a stuck, broken, or
non-recoverable situation — then add watchdogs / recovery hooks / UI escape
hatches wherever the game currently has none. Applies to solo AND multiplayer
(race, duel, coop, same_cards, trivia_night).

Motivating session (2026-04-23): user hit a coop combat state where "cards
didn't show up for both players and we got stuck, could only end turn." No
recovery. No diagnostic. No automatic repair. That class of bug should not be
possible to ship — if a human player can reach that state, the runtime must
either (a) prove the state is recoverable and recover it, (b) surface a
clear recovery control to the player, or (c) fail loudly with a single-click
return-to-hub.

---

## How to spawn this agent

```
Agent({
  description: "Failsafe audit + recovery wiring",
  subagent_type: "game-logic",
  isolation: "worktree",
  prompt: <<full prompt below>>
})
```

Use an isolated worktree — the audit will touch many files and you want to
review the diff before merging. Set `subagent_type: "game-logic"` because
most of the stuck-state surface is in `src/services/` and `src/game/`.
`ui-agent` should take the pure-UI escape-hatch wiring as a follow-up.

---

## The prompt (copy/paste into the Agent call)

You are performing a **failsafe audit** on Recall Rogue. Your job is to
systematically identify every runtime state the game can enter where a
human player is stuck (no input advances the game, no UI control escapes)
and wire a recovery path for each. This applies to solo and every
multiplayer mode (race, duel, coop, same_cards, trivia_night).

### Read first (in this order)

1. `docs/INDEX.md` — navigation
2. `docs/mechanics/combat.md` + `docs/mechanics/quiz.md` — turn flow
3. `docs/mechanics/multiplayer.md` + `docs/architecture/multiplayer.md` — MP flows
4. `docs/gotchas.md` last 30 entries — recently observed stuck-state classes
5. `.claude/rules/error-handling.md` — recoverable vs fatal policy
6. The service layer: `src/services/encounterBridge.ts`,
   `src/services/turnManager.ts`, `src/services/multiplayerCoopSync.ts`,
   `src/services/multiplayerLobbyService.ts`,
   `src/services/multiplayerGameService.ts`,
   `src/services/multiplayerTransport.ts`
7. `.claude/skills/steam-deploy/SKILL.md` "Log path quick reference" — the
   grep cheat sheet for debug.log is the observability surface you will
   hook new diagnostics into.

### Scope — the stuck-state classes to audit

Walk through each class below. For each, enumerate concrete failure
modes, verify the existing recovery (if any), and add watchdogs / escape
hatches where missing.

**A. Combat — hand / deck / AP stuck states**
- Draw pipeline returns zero cards and hand is empty. What happens? Is
  there a detector? What does the UI show?
- `playCard` fires but nothing enters the discard pile (effect resolver
  throws silently).
- `apCurrent` is 0, no playable cards, end-turn button is somehow
  disabled. Can the player recover?
- Card play gets wedged in `committed` stage (quiz resolved but
  `turnState.cardPlayStage` never transitions back).
- Hand render ignores `turnState.deck.hand` changes (Svelte reactivity
  miss — we've hit this on spread/proxy semantics before; grep BUG 22).
- **Specific bug from 2026-04-23:** both players in coop had empty hands
  and could only end turn. Reproduce the conditions that cause empty
  hands on BOTH sides simultaneously (deck exhausted + no shuffle?
  host-authoritative state diverging? draw effect never fires at
  encounter start?). Fix at the root AND add a watchdog that detects
  "hand=0, AP>0, turn not ended" for N seconds and forces a refresh
  from authoritative state (coop host) or triggers a re-draw (solo).

**B. Combat — enemy state**
- `turnState.enemy` is null or has no `currentHP`. Detect early, either
  re-hydrate from snapshot or fail the encounter cleanly.
- Enemy intent is undefined for the current turn. Default to a no-op
  "stalling" intent rather than softlocking the enemy phase.
- Enemy HP is stuck at a negative or `NaN` value.
- Enemy has no viable moves in its intent pool (empty or all-gated).
- Enemy sprite fails to load or Phaser scene shutdown leaves a zombie.

**C. Coop shared-enemy sync**
- Host broadcasts initial `mp:coop:enemy_state`, guest misses it,
  `awaitCoopEnemyReconcile` times out. Today's behavior: guest uses
  local enemy (silent divergence). Fix: after timeout, guest MUST
  request a resend via `mp:coop:request_initial_state`, and host MUST
  re-broadcast from the last-sent snapshot buffer
  (`_lastBroadcastSnapshot` in `multiplayerCoopSync.ts`).
- `mp:coop:enemy_hp_update` arrives with HP > local `maxHP` or negative.
  Clamp and log.
- Turn-end barrier never releases (partner dropped mid-turn, timeout
  fires, no recovery UI). Existing 15 s timeout path — verify the
  player actually gets a clear "partner disconnected" modal with
  options (retry / leave / continue solo).
- `_collectedDeltas` bucket overflow across turns — verify M-047 fix is
  holding (spot-check at runtime by logging bucket sizes every turn).
- Partner HP goes to 0 mid-encounter but `handleCoopPlayerDeath` never
  runs (wiring check).

**D. Multiplayer lobby / transport**
- `mp:lobby:start` fires but `gameStart` callback rejects silently or
  throws. Today we have the BUG 28 guard; verify ALL rejection paths
  surface to the user AND don't loop via H5 retries.
- Transport enters `error` state. Does the player get notified? Can
  they leave/reconnect?
- Guest sees "host disconnected" but actually the host was just slow —
  add a grace-period detector before destroying lobby state.
- Peer-presence monitor declares peer dead from false-positive pong
  miss. Verify the 15 s grace is respected.
- `setupMessageHandlers` runs after lobby is already torn down
  (race), leaving orphan listeners.

**E. Screen / scene transitions**
- Phaser scene shutdown races with Svelte component unmount. Grep for
  `getCombatScene()` returning null during active combat.
- `currentScreen` flips to a value no component renders (dead screen —
  this is how BUG 27 slipped in).
- Overlay (quiz, narrative, reward) mounts but never unmounts because
  dismiss callback fails silently.
- `gameFlowState` and `currentScreen` drift apart (one says `combat`,
  the other says `rewardRoom`).

**F. Save / run state**
- `activeRunState` is null but combat scene is running.
- Run save fails on the persist interval; subsequent reload crashes.
- Migration from an older schema leaves `run.multiplayerMode` set on
  what is now a solo run.
- `playerSave` proxy mutation happens outside an `update()` call,
  causing the next save to persist stale data.

**G. Quiz / answer-checking**
- Quiz fact is null when the card is committed. Current behavior?
- FSRS lookup fails mid-quiz, leaving the card in `committed` state.
- Answer-check throws on a malformed deck entry — does the card
  resolve as quick-play-wrong, or wedge?

**H. Audio / asset loading**
- Audio file fails to load, `playCardAudio` throws, turn flow stops.
  Audit every `await playCardAudio` in hot paths.
- Sprite atlas missing a frame — does the render fallback, or throw?

### The recovery policy (apply everywhere)

For every stuck state you find, pick exactly one of these three:

1. **Prove recovery.** Add a watchdog (polling `$effect` or service-side
   interval) that detects the state and automatically repairs it.
   Example: "hand=0 for >3 s while apCurrent>0 and turn not ended" →
   force a re-hydrate from `activeTurnState` or, in coop, request a
   resnapshot from the host.

2. **Surface recovery.** If the state is genuinely unrepairable, ensure
   the player has ≥1 visible non-destructive control and ≥1 destructive
   control. Non-destructive first: "Retry" / "Reconnect" / "Refresh
   from host". Destructive fallback: "Return to hub (lose run)".

3. **Fail loudly.** If neither is tractable, throw with a clear
   user-facing modal ("A network glitch corrupted the encounter. Click
   to return to hub and try again. Your run is saved."). Log the full
   state snapshot to debug.log so post-hoc analysis can reconstruct
   what broke.

Never leave a state where the player has no input that changes the game
state. "Can only end turn" is the current failure mode — expand that
into "end turn, refresh state, or leave the encounter".

### Logging standard

Every watchdog must emit `rrLog('watchdog:<area>', '<condition>',
{ ...state })` at detection time. Match the existing tag taxonomy in
`.claude/skills/steam-deploy/SKILL.md` so the grep cheat sheet can be
extended. Every automatic repair must log the before + after state.

### Deliverables

1. **One commit** per stuck-state class (eight classes above → up to
   eight focused commits). Each commit: watchdog + repair + UI escape +
   gotcha entry + rrLog diagnostics.
2. **Failsafe test suite** under `src/services/failsafes.test.ts` that
   simulates each stuck state (mocked at the service boundary) and
   asserts the watchdog detects + repairs within the expected window.
3. **`docs/mechanics/failsafes.md`** new doc indexing every watchdog,
   its trigger condition, its repair action, and its escape hatch.
4. **Gotchas for every class touched,** appended to `docs/gotchas.md`
   per the append-only rule.
5. **Humanizer pass** on any new player-facing strings (the modal
   copy, toast text, tooltip text) — `/humanizer` with
   `.claude/skills/humanizer/voice-sample.md`, paste the audit under
   `## Humanizer Audit` per `.claude/rules/human-prose.md`.
6. **Self-verification paste** per `.claude/rules/agent-routing.md`
   template item 10 — `git diff --stat`, typecheck output, relevant
   test output, grep-verification of watchdog registration.

### Out of scope (don't do these)

- Don't touch the multiplayer transport layer — that has its own active
  audit. Just wire to the existing `rrLog('mp:tx', ...)` hooks.
- Don't rewrite `encounterBridge.ts` — add watchdog hooks only; any
  rewrite is a separate task.
- Don't add new features (e.g. "pause multiplayer"). Recovery only.
- Don't change existing pre-game balance values to "hide" stuck states.
  Fix the state machine, not the content.

### When you're done

Produce a final report with the canonical sub-agent return sections:

- **One-line summary**
- **## Changes** — concrete file list
- **## Heads-Up** — Yellow-zone fixes adjacent to the audit
- **## Humanizer Audit** — paste per `.claude/rules/human-prose.md`
- **## Self-Verification** — paste per `.claude/rules/agent-routing.md`
  item 10
- **## Creative Pass** — three items, concrete to what you found
- **## What's Next** — Form A (prioritized follow-ups) because this
  audit is a living document, not a finished project. Form B only if
  you genuinely found every stuck state in all eight classes.

---

## When to re-run this prompt

Every post-launch playtest wave. New decks, new enemies, new relics,
new mystery events, new MP modes — each adds stuck-state surface.
Re-running the audit each wave keeps the watchdog set current instead
of rotting into "we had watchdogs once and then shipped five new
mechanics past them."
