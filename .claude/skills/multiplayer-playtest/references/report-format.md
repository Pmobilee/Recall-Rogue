# Multiplayer Playtest Report Format

## Output Directory

```
data/playtests/mp-batches/MP-{YYYYMMDD}-{HHMMSS}/
  SUMMARY.md              -- Combined results (the primary deliverable)
  lobby-tests.md          -- Detailed lobby scenario results
  race-tests.md           -- Detailed race scenario results
  screenshots/            -- All captured PNGs, organized by scenario
    S1-menu.png
    S1-lobby-created.png
    S2-guest-joined.png
    ...
    R1-host-started.png
    R4-guest-hud.png
    ...
```

---

## SUMMARY.md Template

```markdown
# Multiplayer Playtest -- MP-{BATCH_ID}

**Date:** {YYYY-MM-DD HH:MM}
**Duration:** {N} minutes
**Skill version:** multiplayer-playtest v1

## Infrastructure

| Component | Status | Details |
|---|---|---|
| Fastify Server | {STARTED/ALREADY_RUNNING} | Port 3000, PID {N} |
| Vite Dev Server | {RUNNING/RESTARTED} | Port 5173 |
| Host Container | READY | rr-warm-mp-host-{ID}, port {N} |
| Guest Container | READY | rr-warm-mp-guest-{ID}, port {N} |
| Env Vars | {OK/UPDATED} | VITE_MP_WS_URL={url} |

## Smoke Test

| Container | __rrPlay | WS URL | API URL | Screen |
|---|---|---|---|---|
| Host | {true/false} | {url} | {url} | {screen} |
| Guest | {true/false} | {url} | {url} | {screen} |

## Lobby Tests

| # | Scenario | Result | Notes |
|---|---|---|---|
| S1 | Create Lobby + Code | {PASS/FAIL/SKIP} | {lobby code or error} |
| S2 | Join by Code | {PASS/FAIL/SKIP} | {player count or error} |
| S3 | Password Protection | {PASS/FAIL/SKIP} | {rejection confirmed?} |
| S4 | Lobby Browser | {PASS/FAIL/SKIP} | {lobby visible?} |
| S5 | Deck Selection | {PASS/FAIL/SKIP} | {content synced?} |
| S6 | House Rules | {PASS/FAIL/SKIP} | {settings propagated?} |
| S7 | Max Players | {PASS/FAIL/SKIP} | {HTTP code for overflow} |
| S8 | Visibility | {PASS/FAIL/SKIP} | {public/password/friends behavior} |
| S9 | Ready + Start Gate | {PASS/FAIL/SKIP} | {start button state} |
| S10 | Leave Lobby | {PASS/FAIL/SKIP} | {player count after leave} |

## Race Mode Tests

| # | Test | Result | Notes |
|---|---|---|---|
| R1 | Race Start | {PASS/FAIL/SKIP} | {both screens} |
| R2 | Shared Seed | {PASS/FAIL/SKIP} | {host seed, guest seed} |
| R3 | Gameplay | {PASS/FAIL/SKIP} | {turns played, any crashes} |
| R4 | HUD Verification | {PASS/FAIL/SKIP} | {HUD visible? data present?} |
| R5 | Race End | {PASS/FAIL/SKIP} | {end state on both} |

## Mode UI Tests

| # | Test | Result | Notes |
|---|---|---|---|
| M1 | Mode Cards | {PASS/FAIL/SKIP} | {modes found: N/5} |

## Trivia Night Test

| # | Test | Result | Notes |
|---|---|---|---|
| T1 | Trivia Round | {PASS/FAIL/SKIP} | {preset loaded? screen rendered?} |

## Overall

- **Total:** {N} scenarios
- **Pass:** {N}
- **Fail:** {N}
- **Skip:** {N}

## Issues Found

{List any bugs, crashes, or unexpected behaviors discovered during testing.
Each issue should include:
- Scenario where it was found
- Expected vs actual behavior
- Screenshot reference
- Console errors if any}

## Known Limitations

- RaceResultsScreen.svelte is NOT wired -- race end goes through normal RunEndScreen
- Duel, Co-op, Trivia Night are NOT wired into gameplay -- only lobby/UI tested
- ELO is not updated after race completion
- Server uses in-memory lobby registry (no persistence across server restarts)
```

---

## lobby-tests.md Template

```markdown
# Lobby Test Details -- MP-{BATCH_ID}

## S1: Create Lobby + Code Generation

**Host actions:**
{paste action file contents}

**Result:**
- Lobby code: {CODE}
- Screen: {screen}
- Fastify response: {JSON}

**Screenshots:**
- `screenshots/S1-menu.png`
- `screenshots/S1-lobby-created.png`

**Verdict:** {PASS/FAIL}

---

## S2: Guest Joins by Code

{same format per scenario}
```

---

## race-tests.md Template

```markdown
# Race Mode Test Details -- MP-{BATCH_ID}

## R1: Race Start

**Host actions:**
{paste action file contents}

**Host result:**
- Screen: {screen}
- Console errors: {list}

**Guest result:**
- Screen: {screen}
- Console errors: {list}

**Screenshots:**
- `screenshots/R1-host-started.png`
- `screenshots/R1-guest-started.png`

**Verdict:** {PASS/FAIL}

---

{same format per scenario}
```

---

## Pass/Fail Criteria Summary

| Result | Meaning |
|--------|---------|
| PASS | All assertions met, no crashes, screenshots confirm visual state |
| FAIL | One or more assertions failed, crash occurred, or unexpected state |
| SKIP | Scenario could not run (prerequisite failed, preset not found, mode not wired) |

A SKIP is not a failure -- it's documented as a known limitation. The report distinguishes between "this feature doesn't work" (FAIL) and "this feature isn't implemented yet" (SKIP).

---

## Screenshot Naming Convention

```
{scenario}-{description}.png
```

Examples:
- `S1-menu.png` -- MultiplayerMenu before lobby creation
- `S1-lobby-created.png` -- Lobby screen after creation
- `S2-guest-joined.png` -- Guest's view after joining
- `S3-password-set.png` -- Host's lobby with password configured
- `R1-host-started.png` -- Host's screen after starting race
- `R4-guest-hud.png` -- Guest's screen showing MultiplayerHUD
- `smoke-host.png` / `smoke-guest.png` -- Smoke test captures
