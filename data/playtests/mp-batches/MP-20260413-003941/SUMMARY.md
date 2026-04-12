# Multiplayer Playtest — MP-20260413-003941

**Date:** 2026-04-13 00:39
**Duration:** 61 minutes
**Skill version:** multiplayer-playtest v1

## Infrastructure

| Component | Status | Details |
|---|---|---|
| Fastify Server | STARTED | Port 3000, PID dynamic |
| Vite Dev Server | RESTARTED | Port 5173, restarted for CSP fix |
| Host Container | READY | rr-warm-mp-host-20260413-003941, port 3228 |
| Guest Container | READY | rr-warm-mp-guest-20260413-003941, port 3216 |
| Env Vars | UPDATED | VITE_MP_WS_URL=ws://host.docker.internal:3000/mp/ws |

## Smoke Test

| Container | __rrPlay | Screen |
|---|---|---|
| Host | true | combat (default preset) |
| Guest | true | combat (default preset) |

## Lobby Tests

| # | Scenario | Result | Notes |
|---|---|---|---|
| S1 | Create Lobby + Code | PASS | Code AC6879/WT3KXY/44ZTZ2 (multiple runs), Fastify confirms |
| S2 | Join by Code | PASS | 2 players confirmed (requires fresh container) |
| S3 | Password Protection | PARTIAL | Visibility toggle works, password input appears. Full flow blocked by MP-003. |
| S4 | Lobby Browser | SKIP | Blocked by auto-reconnect bug (MP-003) |
| S5 | Deck Selection | PASS | ldp-deck-check-btn selects, ldp-confirm-btn closes picker |
| S6 | House Rules | SKIP | Settings panel visible but not individually verified |
| S7 | Max Players | SKIP | Lobby never reached capacity in tests |
| S8 | Visibility | PARTIAL | public and password states confirmed via REST |
| S9 | Ready + Start Gate | FAIL | Host toggles. Guest button non-functional (MP-004). |
| S10 | Leave Lobby | FAIL | Stuck loading screen (MP-006). Navigation doesn't leave (MP-003). |

## Race Mode Tests

| # | Test | Result | Notes |
|---|---|---|---|
| R1 | Race Start | PASS | With bot: lobby -> onboarding -> dungeonMap |
| R2 | Shared Seed | SKIP | getRunState() doesn't expose seed field |
| R3 | Gameplay | FAIL | enterRoom() -> black screen, screen='unknown' (MP-007) |
| R4 | HUD Verification | SKIP | Blocked by R3 |
| R5 | Race End | SKIP | Blocked by R3 |

## Mode UI Tests

| # | Test | Result | Notes |
|---|---|---|---|
| M1 | Mode Cards | PASS | 5/5 modes: Race, Same Cards, Duel, Co-op, Trivia Night |

## Trivia Night Test

| # | Test | Result | Notes |
|---|---|---|---|
| T1 | Trivia Round | SKIP | No trivia-round scenario preset tested |

## Overall

- **Total:** 17 scenarios
- **Pass:** 5 (S1, S2, S5, R1, M1)
- **Fail:** 3 (S9, S10, R3)
- **Partial:** 3 (S3, S8, T1)
- **Skip:** 6 (S4, S6, S7, R2, R4, R5)

## Issues Found

12 issues documented in `issues.json`. See MASTER-SYNTHESIS.md for prioritized analysis.

| ID | Severity | Category | Title |
|---|---|---|---|
| MP-001 | CRITICAL | transport_bug | CSP blocks Docker -> Fastify connections (FIXED) |
| MP-002 | CRITICAL | transport_bug | CORS rejects Docker origin (FIXED runtime) |
| MP-003 | HIGH | lobby_bug | Lobby auto-reconnects on navigation |
| MP-004 | CRITICAL | lobby_bug | Guest ready button non-functional |
| MP-005 | HIGH | lobby_bug | Player slot count mismatch (server vs UI) |
| MP-006 | HIGH | lobby_bug | Leave lobby stuck on loading screen |
| MP-007 | CRITICAL | race_bug | enterRoom() black screen in multiplayer |
| MP-008 | MEDIUM | race_bug | Race start shows onboarding screen |
| MP-009 | MEDIUM | ui_bug | Deck row click doesn't select (checkbox required) |
| MP-010 | LOW | ui_bug | Error details button in lobby DOM |
| MP-011 | LOW | ui_bug | Start button repurposed as 'Select Content' |
| MP-012 | LOW | content_bug | csp.ts dead code (CSP in vite.config.ts) |

## Known Limitations

- RaceResultsScreen.svelte is NOT wired -- race end goes through normal RunEndScreen
- Duel, Co-op, Same Cards, Trivia Night are NOT wired into gameplay -- only lobby/UI tested
- ELO is not updated after race completion
- Server uses in-memory lobby registry (no persistence across server restarts)
