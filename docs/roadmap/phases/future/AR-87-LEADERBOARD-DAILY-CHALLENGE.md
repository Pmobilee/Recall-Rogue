# AR-87: Leaderboard System & Daily Challenge [FUTURE RELEASE]

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §13
> **Priority:** POST-LAUNCH
> **Complexity:** Large
> **Dependencies:** AR-47 (Seeded PRNG — completed), AR-80 (Steam Integration)

## Overview

### Daily Challenge
- One shared seed per day (hash of UTC date)
- All players play same run (same encounters, rewards, shops)
- Score submitted at run end
- Global + friends leaderboard
- Resets daily at 00:00 UTC
- One attempt per day (enforced local + server)

### All-Time Leaderboards
- Highest single-run score
- Longest chain achieved
- Fastest run completion
- Highest accuracy (min 20 Charge plays)
- Per-domain leaderboards

### Scoring Formula
Same as AR-86 multiplayer scoring.

## Technical Requirements
- `scoringService.ts` — scoring calculation
- Daily seed: `hashToSeed(new Date().toISOString().slice(0, 10))`
- Steamworks Leaderboard API (desktop) + REST API (mobile/web)
- One-attempt enforcement: localStorage flag + server validation
- Daily challenge entry point in main menu

## GDD Updates

Add "§40. Leaderboards & Daily Challenge [PLANNED — Future Release]" with scoring formula, daily challenge rules, leaderboard categories.
