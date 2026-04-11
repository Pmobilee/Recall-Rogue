# Social Services

> **Purpose:** Multiplayer, duels, guilds, trading, classroom, challenges, leaderboards, referrals, sharing, and social hub.
> **Last verified:** 2026-04-11
> **Source files:** socialService.ts, duelService.ts, guildService.ts, tradingService.ts, classroomService.ts, challengeService.ts, coopService.ts, leaderboardFetch.ts, badgeService.ts, mentorService.ts, referralService.ts, feedbackService.ts, shareCardService.ts, runShareService.ts, scoreSubmissionQueue.ts, wsClient.ts

## Overview

Social services are mostly thin REST wrappers around the Fastify backend using `authedFetch`. Real-time co-op uses `wsClient` (WebSocket). Most social features are Phase 22+ and may be partially implemented. Recall Rogue is a Steam base-game purchase — the entire IAP/subscription/monetization subsystem was removed 2026-04-11 (pre-launch, no real customers).

---

## socialService

| | |
|---|---|
| **File** | src/services/socialService.ts |
| **Purpose** | Hub visiting, guestbook, gifting, and friend management REST calls |
| **Key exports** | `socialService` (singleton with `visitHub`, `addGuestbookEntry`, `sendGift`, `searchPlayers`, `getFriends`, `addFriend`) |
| **Key dependencies** | authedFetch |

## duelService

| | |
|---|---|
| **File** | src/services/duelService.ts |
| **Purpose** | Async knowledge duels — challenge friends, submit answers, fetch duel history and stats |
| **Key exports** | `duelService` (singleton with `challengeFriend`, `submitDuelAnswers`, `getDuelHistory`, `getDuelStats`) |
| **Key dependencies** | authedFetch |

## guildService

| | |
|---|---|
| **File** | src/services/guildService.ts |
| **Purpose** | Guild CRUD, member management, GKP tracking, challenge progress, and guild search |
| **Key exports** | `guildService` (singleton with `createGuild`, `joinGuild`, `leaveGuild`, `getMyGuild`, `searchGuilds`, `updateChallenge`) |
| **Key dependencies** | authedFetch |

## tradingService

| | |
|---|---|
| **File** | src/services/tradingService.ts |
| **Purpose** | Artifact card marketplace listings, P2P trade offers (incoming/outgoing), and trade execution |
| **Key exports** | `tradingService` (singleton with `getListings`, `createOffer`, `getPendingOffers`, `acceptOffer`, `declineOffer`) |
| **Key dependencies** | authedFetch |

## classroomService

| | |
|---|---|
| **File** | src/services/classroomService.ts |
| **Purpose** | Student-side classroom — syncs active homework assignment and announcements; polls every 30 min |
| **Key exports** | `syncActiveAssignment`, `syncAnnouncements` |
| **Key dependencies** | authTokens, classroomStore |

## challengeService

| | |
|---|---|
| **File** | src/services/challengeService.ts |
| **Purpose** | Session-scoped streak + prestige point awards for post-mastery challenge mode (speed/no_hint/reverse) |
| **Key exports** | `challengeService` (singleton with `onCorrect`, `onWrong`, `getStreak`, `getSessionPoints`), `ChallengeMode` (type) |
| **Key dependencies** | playerData store, analyticsService |

## coopService

| | |
|---|---|
| **File** | src/services/coopService.ts |
| **Purpose** | Co-op REST + WebSocket facade — lobby creation/join, dive actions, optimistic prediction, server reconciliation |
| **Key exports** | `createLobby`, `joinLobby`, `leaveLobby`, `sendDiveAction`, `getCoopState` |
| **Key dependencies** | wsClient, authedFetch |

## wsClient

| | |
|---|---|
| **File** | src/services/wsClient.ts |
| **Purpose** | WebSocket client with auto-reconnect (5 attempts, exponential backoff); typed message pub/sub |
| **Key exports** | `wsClient` (singleton with `connect`, `disconnect`, `send`, `on`, `off`), `WSMessage` (interface), `ConnectionState` (type) |
| **Key dependencies** | None (native WebSocket) |

## leaderboardFetch

| | |
|---|---|
| **File** | src/services/leaderboardFetch.ts |
| **Purpose** | Reusable leaderboard fetch utilities — abort timeout, 6-hour localStorage cache, cache read/write |
| **Key exports** | `withAbortTimeout`, `readCachedLeaderboardRows`, `writeCachedLeaderboardRows` |
| **Key dependencies** | None |

## scoreSubmissionQueue

| | |
|---|---|
| **File** | src/services/scoreSubmissionQueue.ts |
| **Purpose** | Persistent queue for competitive score submissions (daily/endless/scholar) — retries up to 5x, max 80 queued |
| **Key exports** | `scoreSubmissionQueue` (singleton with `enqueue`, `flush`), `ScoreSubmissionQueueStatus` (interface) |
| **Key dependencies** | apiClient, uuid utils |

## badgeService

| | |
|---|---|
| **File** | src/services/badgeService.ts |
| **Purpose** | Badge definitions and sharing — triggers share card pipeline for earned badges |
| **Key exports** | `BADGE_DEFINITIONS`, `fetchEarnedBadges`, `shareBadge` |
| **Key dependencies** | shareCardService |

## mentorService

| | |
|---|---|
| **File** | src/services/mentorService.ts |
| **Purpose** | Fetches and submits player-authored hint cards for facts surfaced to struggling learners |
| **Key exports** | `fetchHintForFact`, `submitHint`, `MentorHint` (interface) |
| **Key dependencies** | None (plain fetch) |

## referralService

| | |
|---|---|
| **File** | src/services/referralService.ts |
| **Purpose** | Referral code retrieval and referral history for invite-a-friend rewards |
| **Key exports** | `referralService` (singleton with `getMyCode`, `getMyHistory`) |
| **Key dependencies** | authedFetch |

## feedbackService

| | |
|---|---|
| **File** | src/services/feedbackService.ts |
| **Purpose** | Submits player feedback text to the backend API |
| **Key exports** | `feedbackService` (singleton with `submit`) |
| **Key dependencies** | authedFetch |

## shareCardService

| | |
|---|---|
| **File** | src/services/shareCardService.ts |
| **Purpose** | Generates 1200x630 px PNG share cards via Canvas 2D API for social sharing (fact mastery, dive record, guild win templates) |
| **Key exports** | `renderShareCard`, `shareOrDownload`, `ShareCardPayload` (interface), `ShareCardResult` (interface) |
| **Key dependencies** | None (Canvas 2D API) |

## runShareService

| | |
|---|---|
| **File** | src/services/runShareService.ts |
| **Purpose** | Renders a 1080x1350 run summary PNG for post-run sharing |
| **Key exports** | `renderRunShareCard`, `RunShareMethod` (type) |
| **Key dependencies** | None (Canvas 2D API) |
