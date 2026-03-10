# Phase 56: Social & Live-Ops Foundation

**Status**: Not Started
**Depends On**: Phase 19 (Auth & Cloud — player accounts, cloud sync), Phase 22 (Social & Multiplayer — hub visiting, guestbook, trading, guilds), Phase 23 (Live Ops & Seasons — season framework), Phase 26 (Production Backend Integration — server routes mounted)
**Estimated Complexity**: High — multiple server-side endpoints, new Svelte components, cross-player data flows, season infrastructure; many building blocks exist from Phase 22/23 and need extension rather than creation
**Design Decisions**: Q-S1 (guild structure → resolved here), Q-S2 (season design → resolved here), Q-S3 (fact trading anti-exploitation)

---

## 1. Overview

Phase 56 builds the social layer that makes Recall Rogue a shared experience. Five systems are implemented:

1. **Fact of the Day** — a single server-selected daily fact shown prominently on the Hub, creating a shared daily cultural moment.
2. **Dome Guestbook** — players leave short messages when visiting another player's dome (component exists; verify functionality).
3. **Fact Trading (basic)** — direct player-to-player fact trading with anti-exploitation guardrails (component exists; verify and extend).
4. **Guild/Faction foundation** — resolve Q-S1 with a concrete guild system (component exists from Phase 22; extend).
5. **Seasonal event framework** — resolve Q-S2 with a server-driven season infrastructure (SeasonBanner exists; extend).

Much of the underlying infrastructure was established in Phase 22 and 23. This phase audits that work, fixes gaps, and adds the new systems that were deferred.

### What Exists Already

| File | Status |
|---|---|
| `src/ui/components/GuestbookModal.svelte` | Exists — audit whether write and read are both functional |
| `src/ui/components/TradeOfferModal.svelte` | Exists — audit limits (3/day, mastery guard) |
| `src/ui/components/GuildView.svelte` | Exists — audit knowledge-focus and guild XP pool systems |
| `src/ui/components/GuildInviteModal.svelte` | Exists |
| `src/ui/components/SeasonBanner.svelte` | Exists — audit server-driven content |
| `src/ui/components/HubView.svelte` | Exists — needs Fact of the Day panel |
| `src/ui/components/HubVisitorView.svelte` | Hub visitor view — needs Guestbook tab |
| `server/src/routes/` | Fastify routes — audit for guestbook, trade, guild, season endpoints |

---

## 2. Sub-phases

---

### 56.1 — Fact of the Day

**Goal**: Each UTC calendar day, one fact is selected server-side and made available via a dedicated endpoint. The Hub screen displays it prominently in a "Today's Discovery" panel. GAIA comments on it. Players can add it to their study rotation or share it.

#### 56.1.1 — Server endpoint `GET /api/v1/fact-of-day`

Create `server/src/routes/factOfDay.ts`:

```typescript
import { FastifyInstance } from 'fastify'

/**
 * GET /api/v1/fact-of-day
 * Returns the fact selected for today (UTC).
 * Selection: deterministic daily seed = dayIndex % totalFacts.
 * Response: { factId, statement, category, explanation, gaiaComment }
 */
export async function factOfDayRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/fact-of-day', async (request, reply) => {
    const todayUtc = new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))

    // Query the facts DB for total count, then select by index
    const totalFacts = db.prepare('SELECT COUNT(*) as cnt FROM facts WHERE status = ?').get('approved') as { cnt: number }
    const offset = dayIndex % totalFacts.cnt
    const fact = db.prepare('SELECT id, statement, category_l1, explanation, gaia_comment FROM facts WHERE status = ? LIMIT 1 OFFSET ?').get('approved', offset) as FactRow

    reply.send({
      factId:      fact.id,
      statement:   fact.statement,
      category:    fact.category_l1,
      explanation: fact.explanation,
      gaiaComment: fact.gaia_comment ?? 'Fascinating. Add this to your collection.',
      date:        todayUtc,
    })
  })
}
```

Register the route in `server/src/app.ts`.

#### 56.1.2 — `factOfDayService.ts` client service

Create `src/services/factOfDayService.ts`:

```typescript
export interface FactOfDay {
  factId: string
  statement: string
  category: string
  explanation: string
  gaiaComment: string
  date: string  // YYYY-MM-DD UTC
}

export async function fetchFactOfDay(): Promise<FactOfDay | null> {
  try {
    const res = await fetch('/api/v1/fact-of-day')
    if (!res.ok) return null
    return res.json() as Promise<FactOfDay>
  } catch {
    return null
  }
}
```

Cache the result in `localStorage` under key `'terra:fact-of-day-[date]'` so repeat loads within the same day don't make unnecessary requests.

#### 56.1.3 — "Today's Discovery" panel in `HubView.svelte`

Add the panel to `src/ui/components/HubView.svelte`:

```svelte
{#if factOfDay}
  <div class="today-discovery">
    <div class="tod-header">
      <span class="icon">💡</span>
      <strong>Today's Discovery</strong>
      <span class="category-tag">{factOfDay.category}</span>
    </div>
    <p class="tod-statement">"{factOfDay.statement}"</p>
    <div class="tod-gaia">
      <img src="/assets/sprites/gaia-avatar-small.png" alt="GAIA" />
      <p>"{factOfDay.gaiaComment}"</p>
    </div>
    <div class="tod-actions">
      <button onclick={addToStudyRotation}>Add to Study</button>
      <button onclick={shareFactOfDay}>Share</button>
    </div>
  </div>
{/if}
```

`addToStudyRotation()`: adds `factOfDay.factId` to the player's `learnedFacts` (and initializes a `ReviewState`) if not already present. Shows a GAIA toast: "Added to your collection!"

`shareFactOfDay()`: opens `ShareCardModal.svelte` with a pre-built share card template for the fact of the day.

**Acceptance Criteria**:
- `/api/v1/fact-of-day` returns the same fact for all players on the same UTC day.
- Hub screen shows the "Today's Discovery" panel with fact text and GAIA comment.
- "Add to Study" adds the fact to the player's review queue; button changes to "Already in your collection" if already added.
- The panel updates to the next day's fact at midnight UTC.
- Offline: the panel shows yesterday's cached fact (or is hidden if no cache exists).

---

### 56.2 — Dome Guestbook (Audit and Complete)

**Goal**: When visiting another player's dome, a "Guestbook" tab allows leaving a short message (max 100 chars). The dome owner sees new entries with a notification badge. Existing `GuestbookModal.svelte` component should handle this — audit and complete gaps.

#### 56.2.1 — Audit current implementation

Read `src/ui/components/GuestbookModal.svelte` and `src/ui/components/HubVisitorView.svelte`. Check:

1. Is there a server endpoint `POST /api/v1/guestbook/:playerId` that saves a message?
2. Is there a `GET /api/v1/guestbook/:playerId` endpoint to retrieve entries?
3. Does `HubVisitorView.svelte` include a "Guestbook" tab?
4. Does `HubView.svelte` show a notification badge for new guestbook entries?

#### 56.2.2 — Server endpoints `server/src/routes/guestbook.ts`

Create (or verify) guestbook routes:

```typescript
/**
 * POST /api/v1/guestbook/:ownerId
 * Adds a guestbook entry. Rate limited: max 3 messages to the same player per day.
 * Body: { message: string (max 100 chars, sanitized) }
 */

/**
 * GET /api/v1/guestbook/:ownerId
 * Returns up to 50 guestbook entries for the given player, newest first.
 * Entries older than 30 days are automatically excluded by the query.
 */

/**
 * POST /api/v1/guestbook/:ownerId/:entryId/flag
 * Flags a guestbook entry for moderation review.
 */
```

All message content must pass through `contentFilter.ts` (existing profanity/safety filter) before being stored. If the message fails the filter, return `400` with `{ error: 'Message violates content guidelines' }`.

#### 56.2.3 — `HubVisitorView.svelte` guestbook tab

Add a "Guestbook" tab to `src/ui/components/HubVisitorView.svelte` alongside existing dome view tabs:

```svelte
<div class="guestbook-tab">
  <div class="entries-list">
    {#each guestbookEntries as entry}
      <div class="entry">
        <span class="author">{entry.authorDisplayName}</span>
        <p class="message">{entry.message}</p>
        <span class="date">{formatRelativeDate(entry.createdAt)}</span>
        <button onclick={() => flagEntry(entry.id)} class="flag-btn" aria-label="Flag message">⚑</button>
      </div>
    {/each}
  </div>
  <div class="write-entry">
    <input bind:value={newMessage} maxlength="100" placeholder="Leave a message..." />
    <button onclick={submitMessage} disabled={newMessage.trim().length === 0}>Sign Guestbook</button>
  </div>
</div>
```

#### 56.2.4 — Notification badge in `HubView.svelte`

Add a `newGuestbookCount` store (fetched from server on Hub load). Show a red dot badge on the hub visitor icon if `newGuestbookCount > 0`. Tapping the dome → visits → clears the badge and marks entries as seen.

**Acceptance Criteria**:
- Visiting another player's dome shows a Guestbook tab.
- Writing a message (max 100 chars) and signing saves it server-side.
- Messages failing content filter are rejected with a clear error.
- Players can flag entries for moderation.
- Hub owner sees a notification badge for new guestbook entries since last visit.
- Entries older than 30 days do not appear.

---

### 56.3 — Fact Trading with Anti-Exploitation Guards (Resolve Q-S3)

**Goal**: Direct player-to-player fact trading with a 3-per-day limit and a mastery guard (cannot trade facts the recipient already has at Mastered level). Existing `TradeOfferModal.svelte` exists — audit and add missing guards.

#### 56.3.1 — Audit `TradeOfferModal.svelte` and server trade logic

Check whether the following guards exist:
- Daily trade limit: max 3 trades **sent** per player per day.
- Mastery guard: a fact already at Mastered level (`repetitions >= 6, easeFactor >= 2.5`) cannot be received via trade.
- Soulbound guard: `ArtifactCard.isSoulbound === true` cards cannot be traded.

Add any missing guards.

#### 56.3.2 — Server trade validation in `server/src/routes/trades.ts`

The trade acceptance endpoint must re-validate on the server (client validation alone is insufficient):

```typescript
// In POST /api/v1/trades/:offerId/accept:
// 1. Verify offerer has not exceeded 3 trades sent today
// 2. Verify the offered card is not soulbound
// 3. Verify the receiving player does not already have this fact at Mastered level
// If any check fails: return 409 with { error: 'trade_rejected', reason: string }
```

#### 56.3.3 — Trade limit display in `TradeOfferModal.svelte`

Show the player's remaining daily trades: "You have [N] trades remaining today." This counter resets at midnight UTC and is stored in `PlayerSave.tradesSentToday` and `PlayerSave.tradesSentDate`.

**Acceptance Criteria**:
- A player can send a maximum of 3 trade offers per day.
- Trade offers for soulbound cards are rejected (UI disables the offer button).
- A recipient who already has the offered fact at Mastered level sees the offer rejected with a clear reason.
- The 3/day limit is enforced server-side (not just client-side).
- `TradeOfferModal` shows remaining daily trade count.

---

### 56.4 — Guild/Faction Foundation (Resolve Q-S1)

**Goal**: Guilds are knowledge-area-focused groups (up to 50 members). Each guild has a primary knowledge focus category. Guild members collectively work toward branch completion goals. Guild XP pool grows when members review facts.

#### 56.4.1 — Audit `GuildView.svelte` current implementation

Read the file. Identify which of the following are present vs. absent:
- Primary knowledge focus category field (`guildFocus: string`)
- Guild XP pool (`guildXp: number`) displayed and updated when members review
- Branch completion leaderboard (total mastered facts in focus category across all members)
- Guild chat display

Document gaps and implement the missing pieces.

#### 56.4.2 — Guild data model extension

In the server guild schema (wherever guild data is stored), verify or add:

```typescript
interface GuildRecord {
  id: string
  name: string
  tag: string                    // 3-4 char abbreviation
  emblemId: number
  description: string
  isOpen: boolean                // Open to join without invite
  primaryFocus: string           // categoryL1 value (e.g., 'Natural Sciences')
  memberCount: number            // Current member count (max 50)
  maxMembers: number             // Fixed at 50
  guildXp: number                // Collective XP pool
  createdAt: number
  createdByPlayerId: string
}
```

#### 56.4.3 — Guild XP pool: increment on member review

In `server/src/routes/` (wherever review completions are processed), after a player successfully reviews a fact:
- Award 1 Guild XP to their guild's pool (if they are a member of a guild).
- No cap — guild XP is purely cumulative and drives the guild leaderboard.

Endpoint: `POST /api/v1/guild/:guildId/award-xp` (called server-side, not client-side).

#### 56.4.4 — Guild branch completion goal display in `GuildView.svelte`

Add a "Guild Progress" section to `GuildView.svelte`:

```svelte
<div class="guild-progress">
  <h3>Branch Focus: {guild.primaryFocus}</h3>
  <p>Members' mastered facts in this branch: {guildMasteredInFocus}</p>
  <p>Combined branch completion: {guildBranchPercent.toFixed(1)}%</p>
  <progress value={guildBranchPercent} max={100}></progress>
</div>
```

`guildMasteredInFocus` is fetched from a server endpoint: `GET /api/v1/guild/:guildId/stats` which aggregates mastered facts in the focus category across all guild members.

**Acceptance Criteria**:
- Guilds have a `primaryFocus` field (one of the 7 top-level categories).
- Guild XP pool increases when any member completes a fact review.
- GuildView displays the combined branch completion progress for the focus category.
- Guild member count is capped at 50.
- Guild chat (text only) is visible in GuildView (functional from Phase 22 — verify it works).

---

### 56.5 — Seasonal Event Framework (Resolve Q-S2)

**Goal**: A server-driven season infrastructure: 6-week seasons with a theme, exclusive fact category boost, a time-limited cosmetic set, and a seasonal leaderboard. No client update needed for new seasons — all season data comes from the server.

#### 56.5.1 — Server season endpoint `GET /api/v1/season/current`

Create `server/src/routes/seasonInfo.ts`:

```typescript
interface SeasonInfo {
  id: string               // 'season-01', 'season-02', etc.
  name: string             // 'Age of Dinosaurs'
  theme: string            // 1–2 sentence theme description
  startDate: string        // ISO date UTC
  endDate: string          // ISO date (6 weeks after startDate)
  boostedCategory: string  // categoryL1 — artifacts from this category drop more often
  boostMultiplier: number  // e.g., 1.5 = 50% more artifact drops in this category
  cosmeticSetId: string    // ID of the exclusive cosmetic set for this season
  leaderboardMetric: 'facts_mastered_in_category' | 'total_dives' | 'quiz_accuracy'
  isActive: boolean
}
```

For the first season, hard-code the data server-side:

```typescript
const SEASON_01: SeasonInfo = {
  id: 'season-01',
  name: 'Age of Dinosaurs',
  theme: 'The Cretaceous period roars back. Excavate dinosaur-era fossils and master paleontology facts.',
  startDate: '2026-04-01',
  endDate: '2026-05-13',
  boostedCategory: 'Life Sciences',
  boostMultiplier: 1.5,
  cosmeticSetId: 'cosmetic_set_dino',
  leaderboardMetric: 'facts_mastered_in_category',
  isActive: true,
}
```

#### 56.5.2 — Audit `SeasonBanner.svelte` and extend

Read `src/ui/components/SeasonBanner.svelte`. Verify it:
- Fetches season data from `/api/v1/season/current` on mount.
- Displays the season name, theme, and days remaining.
- Shows the boosted category with a visual indicator.

Add if missing: a "Season Leaderboard" button that opens `SeasonLeaderboard.svelte`.

#### 56.5.3 — `SeasonLeaderboard.svelte` component

Create `src/ui/components/SeasonLeaderboard.svelte`. Fetches from `GET /api/v1/season/:seasonId/leaderboard`:

```svelte
<div class="season-leaderboard">
  <h2>{season.name} — Leaderboard</h2>
  <p class="metric-label">Ranked by: Facts Mastered in {season.boostedCategory}</p>
  <ol class="leaderboard-list">
    {#each entries as entry, i}
      <li class:me={entry.playerId === currentPlayerId}>
        <span class="rank">#{i + 1}</span>
        <span class="name">{entry.displayName}</span>
        <span class="score">{entry.score}</span>
      </li>
    {/each}
  </ol>
  <p class="season-ends">Season ends {formatDate(season.endDate)}</p>
</div>
```

#### 56.5.4 — Season artifact boost in `GameManager.ts`

On dive start, fetch the current season data (or use cached). If `season.isActive`, when generating artifact nodes, apply the boost:

```typescript
if (currentSeason?.isActive && artifactCategory === currentSeason.boostedCategory) {
  // Extra rarity roll: each artifact in the boosted category gets an additional
  // rarity upgrade roll at boostMultiplier-derived probability
  const bonusChance = (currentSeason.boostMultiplier - 1.0) * 0.2 // e.g., 50% boost → 10% extra rarity chance
  if (Math.random() < bonusChance) upgradeArtifactRarity(artifact)
}
```

**Acceptance Criteria**:
- `GET /api/v1/season/current` returns season data including name, dates, boosted category, and cosmetic set ID.
- SeasonBanner on the Hub shows the season name, theme, days remaining, and a leaderboard button.
- SeasonLeaderboard shows the top players ranked by the season metric.
- Artifact drops in the boosted category have a slightly higher rarity roll during the active season.
- The season framework requires no client update to start a new season — only server data changes.

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors (client + server).
- [ ] `npm run build` completes successfully.
- [ ] `GET /api/v1/fact-of-day` returns the same fact for two requests on the same UTC day.
- [ ] Hub screen shows "Today's Discovery" panel with correct content.
- [ ] "Add to Study" button adds the fact to `learnedFacts` and shows a GAIA toast.
- [ ] Visiting another player's dome shows a Guestbook tab.
- [ ] Posting a guestbook message saves it; re-opening the tab shows the message.
- [ ] Message exceeding 100 characters is rejected by the server.
- [ ] Offensive message (triggering content filter) is rejected with 400.
- [ ] TradeOfferModal shows remaining daily trade count.
- [ ] Attempting a 4th trade in a day is rejected client-side and server-side.
- [ ] GuildView displays `primaryFocus` and guild branch completion progress.
- [ ] Season banner shows season name and days remaining.
- [ ] SeasonLeaderboard opens and shows a ranked list.
- [ ] Server-side: changing season data in `SEASON_01` updates what all clients see without a build.

---

## 4. Files Affected

### Modified
- `src/ui/components/HubView.svelte` — "Today's Discovery" panel
- `src/ui/components/HubVisitorView.svelte` — Guestbook tab
- `src/ui/components/GuestbookModal.svelte` — audit and complete write/read paths
- `src/ui/components/TradeOfferModal.svelte` — add daily limit display, mastery guard UI
- `src/ui/components/GuildView.svelte` — guild focus, XP pool, branch progress section
- `src/ui/components/SeasonBanner.svelte` — leaderboard button, server data fetch
- `src/App.svelte` — mount SeasonLeaderboard conditionally
- `server/src/app.ts` — register factOfDay, guestbook, season routes

### New
- `src/services/factOfDayService.ts`
- `src/ui/components/SeasonLeaderboard.svelte`
- `server/src/routes/factOfDay.ts`
- `server/src/routes/guestbook.ts` (if not present from Phase 22)
- `server/src/routes/seasonInfo.ts`
