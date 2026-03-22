# Expansion — Decisions Needed

Items that came up during AR writing where I made a best-guess decision but want your confirmation. None of these block starting work — they can be resolved as we go.

## Resolved During AR Writing (No Action Needed)

These came up but I resolved them based on your prior answers or obvious defaults:

| # | Item | Resolution |
|---|------|-----------|
| 1 | `echo_chamber` relic — kill or keep? | You said KILL. AR-201 removes it from game. However, the AR-201 agent found that `echo_chamber` has a chain-replay mechanic (replays first chain card at 60% on 2+ chain) that is unrelated to the Echo card system. **Decision made: kill it anyway per your instruction.** If you want to keep it under a new name, let me know. |
| 2 | `bestCombo` stat display | The combo system is killed but `bestCombo` is a historical high-water mark shown on RunEndScreen. AR-201 renames the label from "Best Combo" to "Best Chain" since chains are the surviving streak mechanic. |
| 3 | AR-207 says 16 cards but has 15 | The spec implementation index says Phase 2 = 16 cards, but only 15 unique mechanics map to that phase. `aegis_pulse` was the missing 16th — I moved it to AR-206 since it's a straightforward shield card. |
| 4 | AR-208 says 18 cards but has 23 | The implementation index section says 18 but the actual Phase 3 scope is 23 mechanics. AR-208 body is correct at 23. I fixed the AR-200 summary table to match. |

## Open Items for Your Review

None at this time. All design decisions were resolved in our Q&A session. The ARs are ready to execute.

## AR Status Summary

| AR | File | Status | Cards | Relics | Notes |
|---|---|---|---|---|---|
| AR-200 | Master orchestration | Complete | — | — | Dependency diagram, rules, verification gates |
| AR-201 | Kill Echo + Combo | Complete | -3 | -3 | 21 tasks, very detailed with line numbers |
| AR-202 | Cursed Card System | Complete | 0 | 0 | 12 tasks, full cursed lifecycle |
| AR-203 | Burn + Bleed | Complete | 0 | 0 | 10 tasks, both effects + self-Burn |
| AR-204 | Inscription + CardBrowser | Complete | 0 | 0 | 10 tasks, system + 3 UI components |
| AR-205 | Card Unlock Gating | Complete | 0 | 0 | 6 tasks, unlock infrastructure |
| AR-206 | Cards Phase 1 | Complete | 30 | 0 | 30 mechanics (8 filler + 18 basic + 4 gap-fills) |
| AR-207 | Cards Phase 2 | Complete | 15 | 0 | 15 identity/flagship cards |
| AR-208 | Cards Phase 3 | Complete | 23 | 0 | 23 advanced/chase cards |
| AR-209 | Unlock Wiring | Complete | 0 | 0 | Populate data tables |
| AR-210 | Balance Pass | Complete | 0 | 0 | Headless sim validation |
| AR-211 | All Relics | Complete | 0 | 36 | 4 batches, 16 tasks |
| AR-212 | Art Studio | Complete | 0 | 0 | 96 sprite prompts |
| AR-213 | Doc Sync | Complete | 0 | 0 | GAME_DESIGN.md full update |
| AR-214 | Final Test | Complete | 0 | 0 | E2E, visual audit, integration |

**Total new content: 60 card mechanics + 36 relics + 2 status effects + 3 new systems (Cursed, Inscription, Card Unlock Gating) + combo/echo removal**
