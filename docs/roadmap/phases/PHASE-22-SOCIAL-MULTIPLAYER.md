# Phase 22: Social & Multiplayer

**Status**: NOT STARTED
**Goal**: Build community and social engagement systems. Hub visiting, leaderboards, knowledge duels, fact trading, guilds, and referrals. Every social feature must reinforce the educational mission rather than dilute it.
**Design Decisions**: DD-V2-170, DD-V2-172, DD-V2-180

---

## Overview

Phase 22 implements all social systems. It is strictly gated on Phase 19 (auth, deployed backend, player accounts) and Phase 22 requires Phase 22.1 (hub visiting + sync protocol) to be complete before 22.2–22.6 can begin, since all subsequent systems rely on the player identity graph and sync infrastructure established in 22.1.

Social philosophy: social features in an educational game must serve the learning mission. Leaderboards compete on mastery, not spending. Duels use real quiz knowledge, not random card stats. Trading is constrained so it cannot bypass earning. Guilds pursue knowledge goals together.

---

## Prerequisites

- Phase 19: Auth system — player accounts, JWT, server-side saves. ALL of Phase 22 requires authenticated player identities.
- Phase 20: Mobile launch — referral system requires a live App Store/Play Store presence for invite links.
- Phase 21: Analytics infrastructure — social events must flow through the analytics pipeline.
- Fastify backend with PostgreSQL (or SQLite for MVP social): the social graph requires a relational database that can handle multi-player queries. Schema migration plan must be approved before 22.1 starts.
- Push notification system (from Phase 23 if available, or a minimal stub): duel invites and guild notifications require out-of-game delivery.

---

## Hub Visiting Data Sync Protocol

When player A visits player B's hub, the following read-only data is fetched via `GET /api/players/:playerId/hub-snapshot`:

### Hub Snapshot Schema
```typescript
interface HubSnapshot {
  playerId: string            // anonymized UUID, not username
  displayName: string         // player-chosen, censored
  playerLevel: number         // total dives completed
  patronBadge: string | null  // 'expedition' | 'grand' | null
  pioneerBadge: boolean
  joinDate: string            // ISO date, month+year only (no exact day)

  dome: {
    wallpaper: string         // asset key of current wallpaper
    unlockedRooms: string[]   // room IDs visible to visitor
    decorations: DomeObjectSnapshot[]
    petDisplayed: FossilPetSnapshot | null
  }

  knowledgeTree: {
    totalFacts: number
    masteredFacts: number
    categoryBreakdown: Record<string, { total: number; mastered: number }>
    topBranch: string         // category name with most mastered facts
    completionPercent: number
  }

  zoo: {
    revived: FossilSpecies[]  // list of species names, no rarity data
    totalCount: number
    rarest: string            // species name only
  }

  farm: {
    animalCount: number
    activeSpecies: string[]
  }

  gallery: {
    achievements: AchievementPainting[]
  }

  guestbook: GuestbookEntry[] // last 10 entries, chronological
  visitCount: number          // total unique visitors
  lastActive: string          // "X days ago" format, never exact timestamp
}
```

### Privacy Rules
- All hub data is read-only. Visitors cannot modify any player's state.
- `playerId` in the URL is the anonymized UUID, not the player's display name (prevents enumeration).
- Hub visiting can be disabled in settings: `PlayerSave.hubPrivate = true` → `GET /api/players/:id/hub-snapshot` returns 403.
- `lastActive` is rounded to the nearest day and displayed as "X days ago" — never an exact timestamp.
- No cross-player mineral or inventory data is exposed. Only display-layer information.

### Sync Cadence
- Hub snapshot is server-computed on demand (not cached), ensuring freshness.
- Rate limit: 60 hub visits per player per hour (prevent scraping).
- Snapshot TTL: 5 minutes server-side cache per (viewerId, ownerId) pair.

---

## Sub-Phase 22.1: Hub Visiting

### What
Allow players to visit each other's domes to view Knowledge Tree, zoo, farm, gallery, and leave guestbook messages. Gift sending (facts as "interesting reading" links, minerals). Read-only except guestbook and gifts.

### Where
- `server/routes/social.ts` — new file, all social endpoints
- `server/db/social.sql` — new file, social tables schema
- `src/ui/components/HubVisitorView.svelte` — new file, read-only hub view
- `src/ui/components/GuestbookModal.svelte` — new file
- `src/ui/components/GiftModal.svelte` — new file
- `src/ui/components/rooms/ArchiveRoom.svelte` — add "Visit a friend" entry point
- `src/ui/components/rooms/CommandRoom.svelte` — add visitor counter and guestbook notification
- `src/data/types.ts` — add `hubPrivate`, `guestbook`, `receivedGifts`, `visitCount` to `PlayerSave`
- `src/services/socialService.ts` — new file

### How

#### Database Schema (`server/db/social.sql`)
```sql
CREATE TABLE hub_visits (
  id SERIAL PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES players(id),
  owner_id UUID NOT NULL REFERENCES players(id),
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  INDEX idx_hub_visits_owner (owner_id),
  INDEX idx_hub_visits_visitor (visitor_id)
);

CREATE TABLE guestbook_entries (
  id SERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES players(id),
  author_id UUID NOT NULL REFERENCES players(id),
  author_display_name TEXT NOT NULL,
  message TEXT NOT NULL CHECK (length(message) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE gifts (
  id SERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES players(id),
  recipient_id UUID NOT NULL REFERENCES players(id),
  gift_type TEXT NOT NULL CHECK (gift_type IN ('minerals', 'fact_link')),
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  INDEX idx_gifts_recipient (recipient_id)
);

CREATE TABLE friend_connections (
  id SERIAL PRIMARY KEY,
  player_a_id UUID NOT NULL REFERENCES players(id),
  player_b_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_a_id, player_b_id)
);
```

#### Backend Endpoints (`server/routes/social.ts`)
- `GET /api/players/:playerId/hub-snapshot` — returns `HubSnapshot` (see sync protocol above)
- `POST /api/players/:playerId/guestbook` — add guestbook entry (body: `{ message: string }`; max 200 chars; sanitized; 3 entries per visitor per day limit)
- `POST /api/players/:playerId/gift` — send a gift (body: `{ type: 'minerals'|'fact_link', payload: object }`)
- `GET /api/players/me/received-gifts` — list unclaimed gifts
- `POST /api/players/me/received-gifts/:giftId/claim` — claim gift, credit PlayerSave
- `POST /api/players/friends/request` — send friend request
- `GET /api/players/me/friends` — list accepted friends with hub snapshot summaries
- `GET /api/players/search?q=displayName` — search players by display name (exact match or prefix, max 20 results)

#### Frontend (`src/ui/components/HubVisitorView.svelte`)
- Renders the visited player's dome using the same `DomeCanvas` component but in read-only mode.
- Top bar: player display name, patron badge (if any), "Knowledge Tree: X mastered", "Zoo: X animals".
- Bottom panel tabs: Knowledge Tree summary | Zoo | Farm | Gallery | Guestbook.
- "Leave a message" button opens `GuestbookModal.svelte` (200-char text input, emoji-safe, submit).
- "Send a gift" button opens `GiftModal.svelte` — choose: "Send 100 dust" (max 3 gifts per day) or "Share a fact" (sends a fact link from your Knowledge Tree as a "You might find this interesting" notification).
- Hub private toggle in player settings (Settings.svelte → Privacy section).

#### Gift Anti-Abuse
- Minerals gift: capped at 100 dust per gift, max 3 gifts sent per day per player, max 50 dust received from gifts per day per player. Prevents coordinated mineral laundering.
- Fact link gift: informational only. Recipient gets a notification "PlayerX shared a fact with you: [fact preview]" — tapping opens the standard fact card view. No SM-2 credit until the recipient reviews it themselves.

#### Guestbook Moderation
- Server-side: message passes through a word filter (configurable blocklist in `server/config/moderation.ts`) before storing.
- Client-side: "Report message" button on each guestbook entry.
- Auto-hide: messages with 3+ reports are hidden pending review (stored with `is_deleted = TRUE` in DB).

### Acceptance Criteria
- [ ] Player can visit a friend's hub by entering their display name
- [ ] Hub visitor view shows dome, Knowledge Tree summary, zoo, farm, gallery, guestbook
- [ ] Guestbook message saves and appears on owner's hub
- [ ] Gift of 100 dust credits correctly to recipient PlayerSave on claim
- [ ] Fact link gift sends notification to recipient
- [ ] Hub private setting prevents any visiting (returns 403)
- [ ] Gift abuse limits enforced (3/day send, 50 dust/day receive)
- [ ] Guestbook message blocked by moderation filter
- [ ] `npm run typecheck` passes

### Playwright Test
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to Archive room (hub visiting entry point)
  await page.click('[data-testid="room-tab-archive"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-archive-room.png' })
  // Check for "Visit a friend" button
  const visitBtn = await page.$('[data-testid="visit-friend-btn"]')
  console.assert(visitBtn !== null, 'Visit a friend button should exist in Archive room')
  await browser.close()
})()
```

---

## Sub-Phase 22.2: Leaderboards

### What
Global and friends-only leaderboards across six categories. Leaderboard entries display player display name, patron badge, and pioneer badge. Rankings update daily. Anti-cheat: all scores computed server-side from event history.

### Where
- `server/analytics/leaderboards.ts` — new file, score computation
- `server/routes/leaderboards.ts` — new file
- `src/ui/components/LeaderboardView.svelte` — new file
- `src/ui/components/rooms/ArchiveRoom.svelte` — add leaderboard entry point

### How

#### Leaderboard Category Definitions

| Category | ID | Score Formula | Notes |
|---|---|---|---|
| Deepest Dive | `deepest_dive` | Max layer reached in any single dive | Layer 1–20 scale |
| Most Facts Mastered | `facts_mastered` | COUNT(facts WHERE interval_days >= 60) | Uses server-side SM-2 data |
| Longest Streak | `longest_streak` | Max `streakRecord` in PlayerSave | Personal best, never resets |
| Biggest Knowledge Tree | `knowledge_tree` | SUM(facts WHERE reps >= 1) | All reviewed facts |
| Best Quiz Accuracy | `quiz_accuracy` | Correct / Total reviews (min 50 reviews) | Minimum review threshold to prevent gaming |
| Total Dives | `total_dives` | PlayerSave.totalDives | Endurance metric |

Score computation runs nightly at 03:00 UTC via cron. Players without minimum thresholds (e.g., < 50 reviews for quiz accuracy) are excluded from that category's board.

#### Database Schema
```sql
CREATE TABLE leaderboard_scores (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id),
  category TEXT NOT NULL,
  score NUMERIC NOT NULL,
  rank INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  INDEX idx_lb_category_score (category, score DESC)
);

CREATE TABLE leaderboard_friends (
  leaderboard_score_id INTEGER REFERENCES leaderboard_scores(id),
  friend_id UUID REFERENCES players(id),
  INDEX idx_lb_friends (friend_id)
);
```

#### Backend Endpoints
- `GET /api/leaderboards/:category?scope=global&limit=100` — global top 100 for a category
- `GET /api/leaderboards/:category?scope=friends` — friends-only board for authed player
- `GET /api/leaderboards/:category/me` — authed player's rank and score in a category (even if outside top 100)
- `POST /api/leaderboards/refresh` — admin endpoint to manually trigger nightly computation

#### Frontend (`src/ui/components/LeaderboardView.svelte`)
- Tab bar: 6 category tabs (icons + labels)
- Toggle: "Global" / "Friends"
- Ranked list: rank number, player display name, patron badge (small), pioneer badge (if applicable), score value with unit label
- Current player's row highlighted in amber, always visible (pinned at bottom if outside top 100, showing actual rank)
- Refresh cadence label: "Rankings updated daily"
- Opt-out: Settings → Privacy → "Hide me from leaderboards" (sets `PlayerSave.leaderboardOptOut = true`; server excludes from computation)

### Acceptance Criteria
- [ ] All 6 category leaderboards return data
- [ ] Friends-only scope filters to only accepted friend connections
- [ ] Player's own rank visible even if outside top 100
- [ ] Patron badge displays correctly next to patron entries
- [ ] Minimum threshold (50 reviews) correctly excludes low-count quiz_accuracy entries
- [ ] Leaderboard opt-out removes player from all boards
- [ ] Score computation cron runs without error against production database
- [ ] `npm run typecheck` passes

### Playwright Test
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('[data-testid="room-tab-archive"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="leaderboard-open"]')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-leaderboard.png' })
  const leaderboardView = await page.$('[data-testid="leaderboard-view"]')
  console.assert(leaderboardView !== null, 'Leaderboard view should be visible')
  // Check category tabs
  const tabs = await page.$$('[data-testid^="lb-tab-"]')
  console.assert(tabs.length === 6, `Expected 6 leaderboard tabs, got ${tabs.length}`)
  await browser.close()
})()
```

---

## Sub-Phase 22.3: Knowledge Duels

### What
Asynchronous turn-based quiz battles. Player A challenges player B. Each player answers 5 questions from their shared known fact pool. Winner is determined by accuracy + speed. Mineral wagers optional. Duel history and stats tracked.

### Where
- `server/routes/duels.ts` — new file
- `server/db/duels.sql` — new file
- `src/ui/components/DuelView.svelte` — new file
- `src/ui/components/DuelInviteModal.svelte` — new file
- `src/ui/components/rooms/ArchiveRoom.svelte` — add duel entry point
- `src/data/types.ts` — add `duelStats: DuelStats`, `pendingDuels: DuelRecord[]`
- `src/services/duelService.ts` — new file

### How

#### Duel Flow
1. Player A opens DuelView, selects friend, sets optional wager (0–50 dust), taps "Challenge."
2. Server creates duel record with status `'pending'`, selects 5 questions from the intersection of both players' known facts (reps >= 1 for both). If intersection < 5, fills remainder with random approved facts (first exposure rules apply: no O2 penalty, reward-only).
3. Player B receives push notification: "PlayerA has challenged you to a Knowledge Duel!"
4. Both players answer their 5 questions independently (no real-time synchronization needed). Timing recorded per question.
5. Scoring:
   - Correct answer: 100 points base
   - Speed bonus: +50 points if answered in < 5 seconds, +25 if < 10 seconds
   - Perfect score (5/5 correct): +100 bonus
6. After both players complete (or 48-hour timeout), server resolves outcome:
   - Higher score wins
   - Winner receives wager × 2 (or wager returned on tie)
   - Winner receives `+10 dust` flat bonus (no wager required)
   - Loser receives a consolation message from GAIA
7. Both players see duel result card: their score vs opponent score, question breakdown, XP/dust credited.

#### Matchmaking
- Duels are friend-only in v1. No random matchmaking.
- Future v2: opt-in global duel matchmaking matching by `knowledgeTree.masteredFacts` within ±20% of player's count.

#### Database Schema (`server/db/duels.sql`)
```sql
CREATE TABLE duels (
  id SERIAL PRIMARY KEY,
  challenger_id UUID NOT NULL REFERENCES players(id),
  opponent_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'challenger_done', 'opponent_done', 'completed', 'timed_out', 'declined')),
  wager_dust INTEGER NOT NULL DEFAULT 0 CHECK (wager_dust >= 0 AND wager_dust <= 50),
  question_ids JSONB NOT NULL,            -- array of 5 fact IDs
  challenger_answers JSONB,              -- { factId: { answeredIndex, timingMs, correct } }[]
  opponent_answers JSONB,
  challenger_score INTEGER,
  opponent_score INTEGER,
  winner_id UUID REFERENCES players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  completed_at TIMESTAMPTZ,
  INDEX idx_duels_challenger (challenger_id),
  INDEX idx_duels_opponent (opponent_id),
  INDEX idx_duels_status (status)
);
```

#### Backend Endpoints
- `POST /api/duels/challenge` — body: `{ opponentId, wagerDust }` → creates duel record
- `GET /api/duels/pending` — list of pending/active duels for authed player
- `POST /api/duels/:duelId/accept` — opponent accepts, duel status becomes active for both
- `POST /api/duels/:duelId/decline` — opponent declines, wager returned
- `POST /api/duels/:duelId/submit-answers` — submit answer array, server scores
- `GET /api/duels/:duelId/result` — duel result card once both parties done
- `GET /api/duels/history?limit=20` — past duel history for authed player
- `GET /api/duels/stats` — `{ wins, losses, ties, totalDuels, winRate, totalDustWon, totalDustLost }`

#### Frontend (`src/ui/components/DuelView.svelte`)
- Entry: from ArchiveRoom "Knowledge Duels" button
- Tabs: "Challenge" | "Pending Duels" | "History" | "My Stats"
- Challenge tab: friend picker, wager slider (0–50 dust, default 0), challenge button
- Pending tab: cards for each active duel, showing opponent name, wager, your completion status
- When answering: quiz overlay identical to standard quiz (same QuizOverlay component, reused), 5 questions in sequence, timer displayed
- Result card: side-by-side score comparison, per-question breakdown (correct/wrong for both players), dust credited/debited, GAIA commentary

#### Duel Stats (`DuelStats` type in `src/data/types.ts`)
```typescript
interface DuelStats {
  wins: number
  losses: number
  ties: number
  totalDuels: number
  totalDustWon: number
  totalDustLost: number
  currentWinStreak: number
  longestWinStreak: number
}
```

### Acceptance Criteria
- [ ] Duel challenge sent to friend and appears in their pending duels
- [ ] Question intersection logic selects only mutually-known facts (reps >= 1 for both)
- [ ] Speed bonus calculation correct (< 5s = +50, < 10s = +25)
- [ ] 48-hour expiry resolves with `timed_out` status, wager returned
- [ ] Winner receives wager × 2, dust credited to PlayerSave
- [ ] Duel stats update after completion
- [ ] Declined duel returns wager to challenger
- [ ] `npm run typecheck` passes

### Playwright Test
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('[data-testid="room-tab-archive"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="duels-open"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-duels.png' })
  const duelView = await page.$('[data-testid="duel-view"]')
  console.assert(duelView !== null, 'Duel view should be visible')
  // Check tabs
  const tabs = await page.$$('[data-testid^="duel-tab-"]')
  console.assert(tabs.length === 4, `Expected 4 duel tabs, got ${tabs.length}`)
  await browser.close()
})()
```

---

## Sub-Phase 22.4: Fact Trading Marketplace

### What
Marketplace for trading artifact cards with fact data. Direct trades between friends. Duplicate mixing (spend 3 duplicates of the same fact-rarity for a chance at higher rarity). Anti-exploitation: no pure mineral trades, no bypassing learning requirements.

### Where
- `server/routes/trading.ts` — new file
- `server/db/trading.sql` — new file
- `src/ui/components/TradeMarketView.svelte` — new file
- `src/ui/components/TradeOfferModal.svelte` — new file
- `src/ui/components/DuplicateMixingModal.svelte` — new file
- `src/data/types.ts` — add `inventoryArtifacts: ArtifactCard[]` to `PlayerSave` (if not already tracking individual artifact instances)

### How

#### Fact Trading Marketplace Schema
```typescript
interface ArtifactCard {
  instanceId: string       // unique per-card UUID
  factId: string           // which fact this card reveals
  rarity: ArtifactRarity   // common/uncommon/rare/epic/legendary/mythic
  discoveredAt: number     // unix ms when found in dive
  isSoulbound: boolean     // true for season-exclusive and patron rewards (not tradeable)
  isListed: boolean        // true when on public marketplace
  listPrice?: number       // dust price if listed
}

interface TradeOffer {
  id: string
  offerId: string          // from player's instanceId
  requestId: string        // desired card instanceId from receiver's collection
  additionalDust: number   // sweetener dust (max 500)
  status: 'pending'|'accepted'|'declined'|'expired'
  expiresAt: number
}
```

#### Database Schema (`server/db/trading.sql`)
```sql
CREATE TABLE artifact_cards (
  instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  fact_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL,
  is_soulbound BOOLEAN NOT NULL DEFAULT FALSE,
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  list_price_dust INTEGER,
  INDEX idx_cards_player (player_id),
  INDEX idx_cards_fact (fact_id),
  INDEX idx_cards_listed (is_listed, rarity)
);

CREATE TABLE trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offerer_id UUID NOT NULL REFERENCES players(id),
  receiver_id UUID NOT NULL REFERENCES players(id),
  offered_card_instance UUID NOT NULL REFERENCES artifact_cards(instance_id),
  requested_card_instance UUID NOT NULL REFERENCES artifact_cards(instance_id),
  additional_dust INTEGER NOT NULL DEFAULT 0 CHECK (additional_dust >= 0 AND additional_dust <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
  resolved_at TIMESTAMPTZ,
  INDEX idx_trades_offerer (offerer_id),
  INDEX idx_trades_receiver (receiver_id)
);

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_instance_id UUID NOT NULL UNIQUE REFERENCES artifact_cards(instance_id),
  seller_id UUID NOT NULL REFERENCES players(id),
  price_dust INTEGER NOT NULL CHECK (price_dust >= 10 AND price_dust <= 10000),
  listed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  buyer_id UUID REFERENCES players(id),
  INDEX idx_marketplace_rarity (price_dust),
  INDEX idx_marketplace_fact (card_instance_id)
);
```

#### Backend Endpoints
- `GET /api/trading/marketplace?rarity=rare&category=history&limit=50` — browse listings
- `POST /api/trading/marketplace/list` — list an artifact card for sale (body: `{ instanceId, pricedust }`)
- `POST /api/trading/marketplace/buy/:listingId` — purchase a listing (atomic: deduct dust, transfer card)
- `DELETE /api/trading/marketplace/:listingId` — delist your own listing
- `POST /api/trading/offers/send` — send a direct trade offer to a friend
- `POST /api/trading/offers/:offerId/accept` — accept offer (atomic swap)
- `POST /api/trading/offers/:offerId/decline` — decline offer
- `GET /api/trading/offers/pending` — list pending offers (sent and received)
- `POST /api/trading/mix` — duplicate mixing: body `{ instanceIds: [3 UUIDs of same rarity] }` → server validates, returns 1 card of higher rarity

#### Marketplace Rules (Anti-Exploitation)
- Minimum listing price: 10 dust. Maximum: 10,000 dust. (Prevents using marketplace as mineral transfer)
- Soulbound cards cannot be listed or traded (season exclusives, patron rewards, pioneer pack items).
- Direct trade sweetener dust: max 500 per offer. (Prevents trades being purely mineral transfers with a token card)
- Duplicate mixing: requires exactly 3 cards of identical rarity and the SAME fact category (not any 3 random cards). Output rarity = one tier higher with 70% probability, same rarity on failure (30%).
- Global marketplace: all players see all listings. Friends-only listing option: set `listing.friendsOnly = true` in schema.
- Marketplace fee: 5% dust fee on all sales, burned (removed from economy, not redistributed). Anti-inflation measure.

#### Frontend (`src/ui/components/TradeMarketView.svelte`)
- Three tabs: "Browse Market" | "My Listings" | "Trade Offers"
- Browse: filterable by rarity, category, price range. Card tiles showing artifact image, fact preview snippet, rarity badge, price in dust.
- My Listings: current listed cards with delist button.
- Trade Offers: incoming + outgoing offers. Accept/Decline buttons on incoming.
- `DuplicateMixingModal.svelte`: drag-to-slot interface for selecting 3 identical-rarity cards. Shows success probability (70%). Animated mixing reveal on submit.

### Acceptance Criteria
- [ ] Marketplace listing creates a record and shows to all players in browse
- [ ] Buy transaction is atomic: dust deducted and card transferred in single DB transaction
- [ ] Soulbound cards cannot be listed (UI button disabled + server 403)
- [ ] Direct trade offer correctly swaps cards on acceptance
- [ ] Duplicate mixing requires same fact category (not just same rarity)
- [ ] Mixing produces rarity+1 at 70% rate (verify over 100 simulated mixes in test)
- [ ] 5% marketplace fee correctly reduces seller's received dust
- [ ] 72-hour trade offer expiry auto-declines
- [ ] `npm run typecheck` passes

### Playwright Test
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('[data-testid="room-tab-archive"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="marketplace-open"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-marketplace.png' })
  const marketView = await page.$('[data-testid="trade-market-view"]')
  console.assert(marketView !== null, 'Trade marketplace view should be visible')
  const tabs = await page.$$('[data-testid^="market-tab-"]')
  console.assert(tabs.length === 3, `Expected 3 marketplace tabs, got ${tabs.length}`)
  await browser.close()
})()
```

---

## Sub-Phase 22.5: Guilds & Factions

### What
Knowledge-focused player groups (guilds) with shared challenges, collective progress tracking, and a faction identity. Guilds compete on aggregate knowledge metrics, not individual power. Max 30 members.

### Where
- `server/routes/guilds.ts` — new file
- `server/db/guilds.sql` — new file
- `src/ui/components/GuildView.svelte` — new file
- `src/ui/components/GuildInviteModal.svelte` — new file
- `src/ui/components/rooms/ArchiveRoom.svelte` — add guild entry point
- `src/data/types.ts` — add `guildId?: string`, `guildRole?: 'leader'|'officer'|'member'`

### How

#### Guild Structure
- Guild name: 2–30 characters, filtered against blocklist, unique.
- Guild size: max 30 members.
- Guild roles: `leader` (1), `officer` (up to 3), `member`.
- Guild tag: 2–4 character abbreviation displayed on leaderboard entries of guild members.
- Guild emblem: chosen from 20 preset pixel art emblems (no user-uploaded images).

#### Guild Challenges
Three concurrent weekly guild challenges (reset Monday 00:00 UTC):

| Challenge Type | Example | Scoring |
|---|---|---|
| Collective facts mastered | "Guild: master 50 new facts this week" | Sum of new facts mastered (reps reaching 60d+ interval) across all members |
| Dive depth | "Guild: reach layer 15 combined 10 times" | Sum of layer 15+ dives across all members |
| Quiz accuracy | "Guild: maintain 85%+ quiz accuracy" | Guild-wide average quiz accuracy this week |

Reward on 3/3 challenges completed: every guild member receives a "Guild Chest" with 1 rare+ artifact and 200 dust. Rewards unclaimed after 14 days expire.

#### Guild Progression (Faction Ranks)
Guilds level up by accumulating "Guild Knowledge Points" (GKP):
- 1 GKP per member fact mastered
- 5 GKP per member fossil revived
- 2 GKP per guild challenge completed

Guild Ranks:
- Rank 1 (0 GKP): Fledgling Faction
- Rank 2 (500 GKP): Research Party
- Rank 3 (2,000 GKP): Knowledge Corps
- Rank 4 (5,000 GKP): Explorer League
- Rank 5 (15,000 GKP): Planetary Archive

Higher ranks unlock visual guild emblem enhancements and a "Guild Wall" in the Archive room (shared public page).

#### Database Schema (`server/db/guilds.sql`)
```sql
CREATE TABLE guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE,
  emblem_id INTEGER NOT NULL,
  leader_id UUID NOT NULL REFERENCES players(id),
  description TEXT CHECK (length(description) <= 500),
  guild_knowledge_points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 1,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  INDEX idx_guilds_gkp (guild_knowledge_points DESC)
);

CREATE TABLE guild_members (
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','officer','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weekly_gkp_contribution INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, player_id)
);

CREATE TABLE guild_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id),
  week_start TIMESTAMPTZ NOT NULL,
  challenge_type TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_guild_challenges_week (guild_id, week_start)
);

CREATE TABLE guild_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id),
  inviter_id UUID NOT NULL REFERENCES players(id),
  invitee_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);
```

#### Backend Endpoints
- `POST /api/guilds/create` — create a guild (leader is the creator; 1 guild per player)
- `GET /api/guilds/search?q=name` — search by name prefix
- `GET /api/guilds/:guildId` — guild profile with members list, current challenges, GKP
- `POST /api/guilds/:guildId/join` — join open guild
- `POST /api/guilds/:guildId/leave` — leave guild (leader must promote officer first)
- `POST /api/guilds/:guildId/invite` — send invite (body: `{ playerId }`)
- `POST /api/guilds/invites/:inviteId/respond` — accept/decline invite
- `GET /api/guilds/me/challenges` — current week challenges for my guild
- `POST /api/guilds/:guildId/kick` — officer/leader can kick members
- `GET /api/guilds/leaderboard` — top 50 guilds by GKP

#### Frontend (`src/ui/components/GuildView.svelte`)
- "My Guild" tab: guild name, tag, rank, GKP progress bar, member list with roles, weekly challenge progress (3 cards).
- "Find Guilds" tab: search bar, list of open guilds with member count, rank, and join button.
- "Create Guild" tab: name input, tag input, emblem picker (20 options grid), description, create button.
- Challenge progress cards: each shows challenge description, progress bar (X/target), member contribution leaderboard (top 5 contributors this week).

### Acceptance Criteria
- [ ] Guild creates with unique name and tag
- [ ] Max 30 member limit enforced server-side
- [ ] Weekly challenge progress accumulates from member analytics events
- [ ] Guild chest awarded to all members when 3/3 challenges complete
- [ ] Guild rank advances when GKP thresholds crossed
- [ ] Guild leaderboard shows top 50 guilds by GKP
- [ ] Player cannot be in more than one guild simultaneously
- [ ] `npm run typecheck` passes

### Playwright Test
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('[data-testid="room-tab-archive"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="guilds-open"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-guild.png' })
  const guildView = await page.$('[data-testid="guild-view"]')
  console.assert(guildView !== null, 'Guild view should be visible')
  await browser.close()
})()
```

---

## Sub-Phase 22.6: Referral System (DD-V2-180)

### What
"Invite a friend, you both get a fossil egg" referral mechanic. Referral link from player profile. First reward triggers on invitee's first completed dive (not just install). Bonus if invitee maintains 7-day streak. Anti-abuse: max 10 referrals per year per account, unique device validation server-side.

### Where
- `server/routes/referrals.ts` — new file
- `server/db/referrals.sql` — new file
- `src/ui/components/ReferralModal.svelte` — new file
- `src/ui/components/rooms/CommandRoom.svelte` — add referral entry point ("Invite Friends" button)
- `src/data/types.ts` — add `referralCode: string`, `referredBy?: string`, `referralRewardsEarned: number`

### How

#### Referral Flow (Step by Step)

1. Player opens Command Room → "Invite Friends" → `ReferralModal.svelte` opens.
2. Modal shows: referral link (`https://terragacha.com/invite/REFCODE`), share button (native OS share sheet via Capacitor Share), and current referral status (X of 10 referrals used this year, pending rewards).
3. Invitee installs the app and opens the referral link. Server sets `invitee.referredBy = referrerCode` in their PlayerSave at account creation.
4. When invitee completes their first dive: server checks `referredBy` → fires reward pipeline:
   - Invitee gets: 1 fossil egg (generates a random fossil species, stored in invitee's inventory as `FossilEgg` item)
   - Referrer gets: 1 fossil egg + referral count incremented
5. If invitee completes a 7-day login streak: bonus reward fires:
   - Invitee gets: 200 dust + 1 streak freeze
   - Referrer gets: 200 dust + "Mentor" badge for that invitee on referral history

#### Fossil Egg System
A fossil egg is a pending fossil with hidden species until "hatched" by the player at the Materializer. Hatching requires no minerals (referral reward) but does have a standard knowledge gate (first fossil species always has a reduced gate of 3 facts, not the full 10). Hatch animation is a gacha reveal (identical to artifact reveal).

#### Anti-Abuse Measures
- Referral code is 8-character alphanumeric UUID derived from `playerId` (deterministic, not enumerable).
- Max 10 referral rewards per `referrerId` per calendar year. After 10, additional installs via their link still install the game but earn no reward for either party.
- Unique device fingerprint: server stores SHA256 of `(deviceModel + osVersion + installTimestamp rounded to hour)` at account creation. If two accounts share identical fingerprints and one refers the other, reward is flagged for review (not auto-blocked, to avoid false positives on family devices).
- Referrer and invitee must have distinct IP regions OR a 24-hour gap between installs to count (basic VPN abuse prevention).
- Self-referral impossible: server checks `referrerId !== inviteeId`.

#### Database Schema (`server/db/referrals.sql`)
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES players(id),
  invitee_id UUID NOT NULL REFERENCES players(id) UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dive_reward_sent','streak_reward_sent','completed','flagged')),
  first_dive_at TIMESTAMPTZ,
  streak_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_fingerprint_hash TEXT,
  INDEX idx_referrals_referrer (referrer_id),
  INDEX idx_referrals_code (referral_code)
);

CREATE TABLE referral_rewards_log (
  id SERIAL PRIMARY KEY,
  referral_id UUID NOT NULL REFERENCES referrals(id),
  recipient_id UUID NOT NULL REFERENCES players(id),
  reward_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Backend Endpoints
- `GET /api/referrals/my-code` — returns authed player's referral code and link
- `POST /api/referrals/register` — called at account creation with `{ referralCode }` in query param
- `GET /api/referrals/my-history` — list of referrals, their status, and rewards earned
- `POST /api/referrals/internal/process-dive` — internal webhook called by dive completion event; checks referral status, fires rewards
- `POST /api/referrals/internal/process-streak` — internal webhook called by 7-day streak event

#### Frontend (`src/ui/components/ReferralModal.svelte`)
- "Invite Friends" entry in Command Room (below resource bar).
- Modal shows:
  - Large referral link in a copyable text box
  - "Share" button (fires `Capacitor.Plugins.Share.share({ url })`)
  - "You and your friend each receive a fossil egg!" benefit description
  - Bonus: "If your friend builds a 7-day streak, you both earn bonus dust!"
  - History section: list of sent referrals with status ("Pending first dive" / "Fossil egg sent" / "Streak bonus earned")
  - Counter: "X of 10 referrals used this year"

### Acceptance Criteria
- [ ] Referral link correctly encodes referrer's code
- [ ] Installing via referral link sets `referredBy` on invitee's account
- [ ] Fossil egg credited to both players after invitee's first dive
- [ ] Streak bonus triggers after invitee achieves 7-day streak
- [ ] Max 10 referrals per year enforced (11th referral fires no reward)
- [ ] Self-referral blocked by server
- [ ] Duplicate device fingerprint flagged (not auto-blocked)
- [ ] Native share sheet opens on "Share" button tap
- [ ] `npm run typecheck` passes

### Playwright Test
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to Command Room
  await page.click('[data-testid="room-tab-command"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="invite-friends-btn"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-referral.png' })
  const modal = await page.$('[data-testid="referral-modal"]')
  console.assert(modal !== null, 'Referral modal should be visible')
  // Verify referral code is displayed
  const codeBox = await page.$('[data-testid="referral-link-box"]')
  console.assert(codeBox !== null, 'Referral link box should be visible')
  const linkText = await page.$eval('[data-testid="referral-link-box"]', el => el.textContent)
  console.assert(linkText.includes('terragacha.com/invite/'), 'Referral link should contain invite URL')
  await browser.close()
})()
```

---

## Verification Gate

Before Phase 22 is considered complete:

1. `npm run typecheck` — zero errors.
2. `npm run build` — clean build.
3. Hub Visiting: visit a second test account's hub (using separate browser session) — verify read-only view renders correctly, guestbook message saves, gift credits on claim.
4. Leaderboards: seed 10 test player records, verify all 6 leaderboard categories rank correctly, verify friends-only scope filters correctly to the test friend connection.
5. Knowledge Duels: create a duel between 2 test accounts, answer questions on both sides, verify winner receives wager × 2, verify duel history records both sides.
6. Marketplace: list an artifact from test account A, buy from test account B — verify atomic transfer (card moves, dust deducted and credited, 5% fee burned).
7. Duplicate Mixing: attempt mix with 3 cards of same rarity + same category — verify 70% success rate over 20 simulated mixes (accept 60–80% as valid range for 20-sample test).
8. Guilds: create a guild, invite second test account, complete a collective challenge, verify guild chest awarded.
9. Referrals: create referral link from account A, register account B with code, complete a dive as B — verify fossil egg credited to both accounts.
10. Privacy: set hub to private on account A, attempt visit from account B — verify 403.
11. Anti-abuse: attempt self-referral — verify server blocks with appropriate error.

---

## Files Affected

### New Files
- `src/services/socialService.ts`
- `src/services/duelService.ts`
- `src/ui/components/HubVisitorView.svelte`
- `src/ui/components/GuestbookModal.svelte`
- `src/ui/components/GiftModal.svelte`
- `src/ui/components/LeaderboardView.svelte`
- `src/ui/components/DuelView.svelte`
- `src/ui/components/DuelInviteModal.svelte`
- `src/ui/components/TradeMarketView.svelte`
- `src/ui/components/TradeOfferModal.svelte`
- `src/ui/components/DuplicateMixingModal.svelte`
- `src/ui/components/GuildView.svelte`
- `src/ui/components/GuildInviteModal.svelte`
- `src/ui/components/ReferralModal.svelte`
- `server/routes/social.ts`
- `server/routes/leaderboards.ts`
- `server/routes/duels.ts`
- `server/routes/trading.ts`
- `server/routes/guilds.ts`
- `server/routes/referrals.ts`
- `server/analytics/leaderboards.ts`
- `server/db/social.sql`
- `server/db/duels.sql`
- `server/db/trading.sql`
- `server/db/guilds.sql`
- `server/db/referrals.sql`

### Modified Files
- `src/data/types.ts` — `PlayerSave` additions: `hubPrivate`, `guestbook`, `receivedGifts`, `visitCount`, `leaderboardOptOut`, `guildId`, `guildRole`, `duelStats`, `pendingDuels`, `inventoryArtifacts` (as `ArtifactCard[]`), `referralCode`, `referredBy`, `referralRewardsEarned`
- `src/ui/components/rooms/ArchiveRoom.svelte` — add: hub visiting entry, leaderboard entry, duels entry, marketplace entry, guild entry, Patron Wall
- `src/ui/components/rooms/CommandRoom.svelte` — add: visitor counter, guestbook notification badge, "Invite Friends" button
- `src/data/analyticsEvents.ts` — add social events: `hub_visited`, `guestbook_posted`, `gift_sent`, `gift_claimed`, `duel_started`, `duel_completed`, `marketplace_listed`, `marketplace_purchased`, `guild_joined`, `guild_challenge_completed`, `referral_link_shared`, `referral_reward_earned`

---

## Sub-Phase 22.7: Anti-Cheat Leaderboard Sanitization

- [ ] Leaderboard submission pipeline routes through the server-side plausibility checks defined in Phase 19.22 (DD-V2-225) before any score is committed.
- [ ] Flagged scores are held in a `leaderboard_review` queue; suspicious entries are excluded from public display until cleared; duel scores from flagged accounts are voided.
- `server/routes/admin.ts` — add social health endpoints
