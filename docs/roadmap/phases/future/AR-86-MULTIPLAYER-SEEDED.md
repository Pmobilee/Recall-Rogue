# AR-86: Multiplayer — Seeded Competitive [FUTURE RELEASE]

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §12
> **Priority:** POST-LAUNCH
> **Complexity:** Very Large
> **Dependencies:** AR-47 (Seeded PRNG — completed), AR-80 (Steam Integration)

## Overview

Two players start a lobby and play the exact same run with the same seed. Same encounters, same card rewards, same shop contents. The player who gets further or scores higher wins.

## Modes

### Mode 1: Race Mode
- Shared seed determines: encounter order, enemy types, card rewards, shop inventory, relic drops
- Each player plays independently at own pace
- After both finish, compare results via scoring formula
- Lobby: create → get code → share → friend joins → both ready → run starts

### Mode 2: Same Cards
- Same as Race Mode, PLUS identical card slots, fact bindings, chain type assignments, and shuffle seeds
- "Pure skill" mode — identical hands, who plays better?
- FSRS scores may differ (asymmetric knowledge advantage — intentional)

### Mode 3: Co-op vs Enemy [PLANNED FUTURE — Design Only]
- Two players fight same enemy together, alternating turns
- Add to GDD as planned future content. Do not implement.

## Technical Requirements

- WebSocket server (owner builds infrastructure)
- Client sends: lobby create/join, ready state, turn results
- Server sends: lobby state, opponent progress, final comparison
- No game state sync — each client runs own game with same seed
- Opponent progress: small panel showing floor, HP, score (collapsible)

## Scoring Formula

```
Run Score = (Floors Cleared × 100)
          + (Total Damage Dealt × 1)
          + (Total Chain Multiplier Earned × 50)
          + (Correct Answers × 10)
          - (Wrong Answers × 5)
          + (Perfect Encounters × 200)
          + (Speed Bonus)
```

## GDD Updates

Add "§39. Multiplayer [PLANNED — Future Release]" with Race Mode, Same Cards, scoring formula, and Co-op as future.
