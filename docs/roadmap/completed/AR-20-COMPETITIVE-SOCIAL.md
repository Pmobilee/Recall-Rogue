# AR-20: Competitive & Social Features

## Summary
Completed AR-20 end-to-end for competitive/social runtime wiring:
- Daily Expedition and Endless Depths now submit to backend leaderboard categories.
- Daily Expedition supports date-key filtered global boards and one-submission-per-day enforcement.
- Social, Duel, and Guild backend routes are registered in the server entrypoint and client endpoints were aligned to live contracts.
- Mastery Challenges and Relic Sanctum remain implemented and wired in app flow.

## Design Reference
From `docs/GAME_DESIGN.md`:

> "Same seed all players. Score = accuracy x speed x depth x combo. One attempt/day. Leaderboard (read-only). Rewards: participation badge, bonus for top 10%/25%/50%."

From `docs/GAME_DESIGN.md` (Status block in section 20):

> "Daily runs now submit to backend leaderboard category `daily_expedition` with `metadata.dateKey` (`YYYY-MM-DD`)."

> "Backend enforces one Daily submission per user per date key."

> "Endless mode submits to separate backend category `endless_depths`."

## Implementation
### Data Model
- Reused existing `leaderboards` table.
- Added AR-20 categories to valid route-level categories:
  - `daily_expedition`
  - `endless_depths`
- Daily submissions use `metadata.dateKey` (`YYYY-MM-DD`) for cycle-scoped ranking.

### Logic
- Server route registration now includes:
  - `/api/players` (social)
  - `/api/duels` (duel)
  - `/api/guilds` (guild)
- Leaderboard route updates:
  - Date-key filtering for `GET /api/leaderboards/daily_expedition?dateKey=...`
  - One submission per user per `dateKey` for Daily Expedition
  - Separate plausibility bounds for AR-20 categories
- Run completion wiring:
  - Daily completion submits score + dateKey metadata
  - Endless completion submits score + floor metadata

### UI
- Social screen now fetches global daily/endless boards with local fallback when unavailable.
- Duel screen endpoints and response parsing aligned to backend route contracts.
- Guild screen endpoints aligned to `/api/guilds/*`; added bootstrap flow for `/api/guilds/me`.

### System Interactions
- `gameFlowController` submits competitive scores through `apiClient` in fire-and-forget mode so run flow is not blocked by network latency.
- Client retains local leaderboard data as offline fallback.

## Edge Cases
- Daily duplicate submissions (same user + same `dateKey`) return 409 and are ignored client-side.
- Missing/invalid Daily `metadata.dateKey` is rejected.
- If global boards are unreachable, UI falls back to local leaderboard rows.
- Unauthenticated users still play Daily/Endless locally; backend submissions are skipped.

## Files To Modify
- `server/src/index.ts`
- `server/src/routes/leaderboards.ts`
- `server/src/routes/social.ts`
- `server/src/routes/guilds.ts`
- `src/services/apiClient.ts`
- `src/services/gameFlowController.ts`
- `src/services/dailyExpeditionService.ts`
- `src/services/endlessDepthsService.ts`
- `src/services/socialService.ts`
- `src/services/duelService.ts`
- `src/ui/components/SocialScreen.svelte`
- `src/ui/components/DuelView.svelte`
- `src/ui/components/GuildView.svelte`
- `docs/GAME_DESIGN.md`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist
- [x] Daily Expedition run scores submit to backend and appear on date-scoped global leaderboard.
- [x] One-attempt-per-day backend guard exists for Daily Expedition.
- [x] Endless Depths run scores submit to separate backend leaderboard category.
- [x] Social, Duel, and Guild routes are registered and reachable from server entrypoint.
- [x] Duel/Guild/Social client endpoints match backend route contracts.
- [x] Social screen displays global leaderboard data with local fallback.
- [x] Roadmap and design docs updated to reflect AR-20 completion.
