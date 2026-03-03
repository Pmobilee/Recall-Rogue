# Phase 23: Live Ops & Seasons

**Last Updated**: 2026-03-03
**Status**: Planned (post-Phase 22)
**Prerequisite Phases**: Phase 19 (Auth & Cloud Saves), Phase 20 (Mobile Launch), Phase 21 (Analytics & Monetization), Phase 22 (Social Features)

---

## Overview

Phase 23 transforms Terra Gacha from a static product into a living service. It covers the full retention lifecycle: seasonal content injections to keep long-term players engaged, a disciplined push notification system that respects player attention, win-back flows for lapsed players, a completionist endgame for top performers, and a community-driven user-generated fact pipeline that unlocks at peak mastery.

Every system in this phase is anchored in respect for the player's time and attention (DD-V2-159). The recurring failure mode for live ops in educational games is that retention mechanics slide into coercive anxiety — broken streaks presented as shameful, notifications that feel like nagging, emails that feel like spam. This phase explicitly prevents that failure at the implementation level.

**Key design decisions governing this phase**:
- DD-V2-157: Welcome Back Flow — positives first, never shame
- DD-V2-158: Positive Streak Reframing — celebrate, never weaponize
- DD-V2-159: Push Notification Strategy — max 1/day, GAIA-voiced, auto-stop after 7 days silence
- DD-V2-160: Win-Back Strategy — external triggers for churned players
- DD-V2-161: Completionist Endgame — Omniscient title + Golden Dome + community access
- DD-V2-170: User-Generated Facts Pipeline — gated to verified players only

---

## Prerequisites

Before beginning Phase 23:

1. Phase 19 must be complete: cloud account system with email address on file
2. Phase 20 must be complete: app is live on both iOS and Android app stores
3. Phase 21 must be complete: analytics events are instrumented, D7/D30 retention data is available
4. Phase 22 must be complete: social features (leaderboards, hub visits) are functional
5. D30 retention must be at or above 8% (minimum viable live ops investment threshold)
6. A content operations workflow must exist: at least one person capable of authoring seasonal event content

---

## Sub-Phase 23.1: Seasonal Events

### What

A seasonal event is a time-limited content injection that adds thematic facts, a unique biome override, exclusive cosmetic rewards, and special GAIA commentary — all discoverable through normal gameplay without requiring any purchase. Each event runs for approximately 4 weeks. The annual calendar defines four major events aligned to real-world cultural moments plus two surprise "flash" events.

**Annual Seasonal Event Calendar**:

| Season | Theme | Duration | Key Content |
|--------|-------|----------|-------------|
| Spring (March–April) | "Fossil Awakening" | 4 weeks | +60 paleontology facts, rare fossil eggs drop 3× more, excavation site micro-structure |
| Summer (June–July) | "Space Month" | 4 weeks | +80 astronomy/space exploration facts, "Void Biome" (L16-20 override), rocket cosmetics |
| Autumn (September–October) | "Age of Dinosaurs" | 4 weeks | +70 prehistoric biology facts, boosted fossil drop rate, Jurassic micro-structures |
| Winter (December–January) | "Language Festival" | 4 weeks | First language content injection, N5 Japanese + N5 Spanish facts added, cultural celebrations |
| Flash Event 1 | "Deep Ocean" | 10 days | Marine biology focus, bioluminescent biome skin, jellyfish companion fragment |
| Flash Event 2 | "Ancient Civilizations" | 10 days | History/archaeology burst, Ruin micro-structure variants, clay tablet artifacts |

**Seasonal event mechanics**:
- Seasonal facts are tagged `seasonal: true` and `season: "age-of-dinosaurs"` in the fact schema
- Seasonal facts are available permanently after the event ends (no FOMO — DD-V2-174)
- Exclusive cosmetics (wallpapers, dome decorations, GAIA outfit skins) are earned through gameplay during the event
- Players who miss an event receive a "Seasonal Chest" on return via the Welcome Back Flow (23.5) containing a curated seasonal artifact sample

### Where

- `server/routes/seasons.ts` — REST endpoints for active season, seasonal fact pools, event rewards
- `server/data/seasons/` — JSON config files per season (see template below)
- `src/services/seasonService.ts` — client-side season state management
- `src/ui/components/SeasonBanner.svelte` — dome UI banner showing active event
- `src/ui/components/SeasonRewardOverlay.svelte` — gacha-style reward reveal for seasonal cosmetics
- `src/game/managers/BiomeManager.ts` — biome override logic for seasonal biomes
- `src/data/facts/seasonal/` — fact JSON files per season

### How

**Step 1: Define the season schema**

Create `server/data/seasons/season-template.json`:
```json
{
  "id": "age-of-dinosaurs-2026",
  "name": "Age of Dinosaurs",
  "tagline": "The past is closer than you think.",
  "startDate": "2026-09-15T00:00:00Z",
  "endDate": "2026-10-13T23:59:59Z",
  "theme": {
    "bannerColor": "#8B4513",
    "accentColor": "#D4AF37",
    "gaiaOutfit": "paleontologist",
    "domeDecoration": "fossil_wall_mural"
  },
  "factTags": ["paleontology", "prehistoric-biology", "dinosaurs", "extinction"],
  "biomeOverride": {
    "layers": [14, 15, 16],
    "biomeId": "jurassic-sediment",
    "probability": 0.60
  },
  "rewards": [
    {
      "id": "season_reward_trex_wallpaper",
      "type": "cosmetic",
      "name": "T-Rex Dome Wallpaper",
      "milestone": "discover_20_seasonal_facts",
      "rarity": "rare"
    },
    {
      "id": "season_reward_dino_companion",
      "type": "companion_fragment",
      "name": "Velociraptor Companion Fragment",
      "milestone": "discover_50_seasonal_facts",
      "rarity": "legendary"
    }
  ],
  "gaiaCommentaryVariants": [
    "Ohhh, this era again! Did you know the dinosaurs had 165 million years and WE'VE had, like, 300,000?",
    "The K-Pg extinction event... still gives my processors a tingle.",
    "Fun fact from me: the dinosaurs didn't go extinct. They became birds. *gestures at every chicken ever*."
  ],
  "flashEventMode": false
}
```

**Step 2: Implement `server/routes/seasons.ts`**

```typescript
import { FastifyInstance } from 'fastify'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

export async function seasonRoutes(app: FastifyInstance) {
  /** GET /api/seasons/active — returns the currently active season or null */
  app.get('/api/seasons/active', async (req, reply) => {
    const seasonDir = path.join(process.cwd(), 'data/seasons')
    const files = await readdir(seasonDir)
    const now = new Date()
    for (const file of files) {
      const raw = await readFile(path.join(seasonDir, file), 'utf-8')
      const season = JSON.parse(raw)
      if (new Date(season.startDate) <= now && new Date(season.endDate) >= now) {
        return reply.send({ season })
      }
    }
    return reply.send({ season: null })
  })

  /** GET /api/seasons/facts/:seasonId — paginated seasonal fact pool */
  app.get('/api/seasons/facts/:seasonId', async (req, reply) => {
    const { seasonId } = req.params as { seasonId: string }
    const { page = 0, limit = 20 } = req.query as { page?: number; limit?: number }
    // Query facts WHERE tags CONTAINS any of season's factTags
    // Implementation deferred to database layer
    return reply.send({ facts: [], total: 0 })
  })
}
```

**Step 3: Implement `src/services/seasonService.ts`**

```typescript
import { apiClient } from './apiClient'
import { writable, get } from 'svelte/store'

export interface ActiveSeason {
  id: string
  name: string
  tagline: string
  endDate: string
  theme: { bannerColor: string; accentColor: string; gaiaOutfit: string }
  rewards: SeasonReward[]
}

export interface SeasonReward {
  id: string
  type: string
  name: string
  milestone: string
  rarity: string
}

export const activeSeason = writable<ActiveSeason | null>(null)

export async function loadActiveSeason(): Promise<void> {
  try {
    const { season } = await apiClient.get<{ season: ActiveSeason | null }>('/seasons/active')
    activeSeason.set(season)
  } catch {
    // Offline: no seasonal content, silent fail
    activeSeason.set(null)
  }
}
```

**Step 4: Build `SeasonBanner.svelte`**

The banner appears at the top of DomeView when a season is active. It shows:
- Season name and tagline
- Days remaining (calculated from `endDate`)
- Progress toward the player's next reward milestone ("Discovered 12/20 seasonal facts")
- Tap to open SeasonRewardOverlay

**Step 5: Wire seasonal facts into MineGenerator**

When a season is active, `MineGenerator.ts` biases artifact node selection toward facts tagged with the season's `factTags`. Implement a `getWeightedFactPool(seasonId?: string)` function in `src/services/factsDB.ts` that returns facts from seasonal tags at 3× weight vs non-seasonal facts.

**Step 6: Seasonal biome override**

In `BiomeManager.ts`, check `get(activeSeason)?.biomeOverride` before resolving the biome for each layer. If the player's current layer is in the override's `layers` array, apply a random roll against the override's `probability`. If it triggers, replace the normal biome selection with the seasonal biome.

### Acceptance Criteria

- [ ] A new season JSON file can be dropped into `server/data/seasons/` with zero code changes to activate it
- [ ] `GET /api/seasons/active` returns the active season within 100ms
- [ ] The SeasonBanner renders in DomeView with correct name, days remaining, and reward progress
- [ ] Mining an artifact node during an active season has a measurably higher probability of returning seasonally tagged facts (verify via 100 iterations in DevPanel)
- [ ] A seasonal biome override appears in the correct layers at approximately the configured probability (±10%)
- [ ] All seasonal reward cosmetics are accessible from Settings > Cosmetics after being earned — they do not disappear after the season ends
- [ ] No seasonal fact disappears from the player's Knowledge Tree after the event concludes

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')

  // Inject a mock active season into the page store
  await page.evaluate(() => {
    window.__debugSeasonOverride = {
      id: 'test-season',
      name: 'Test Season: Age of Dinosaurs',
      tagline: 'The past is closer than you think.',
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      theme: { bannerColor: '#8B4513', accentColor: '#D4AF37', gaiaOutfit: 'paleontologist' },
      rewards: [{ id: 'r1', type: 'cosmetic', name: 'T-Rex Wallpaper', milestone: 'discover_5_seasonal_facts', rarity: 'rare' }]
    }
  })

  await page.waitForSelector('.season-banner', { timeout: 10000 })
  const bannerText = await page.textContent('.season-banner')
  console.assert(bannerText.includes('Age of Dinosaurs'), 'Season banner must show season name')
  console.assert(bannerText.includes('days'), 'Season banner must show days remaining')

  await page.screenshot({ path: '/tmp/ss-season-banner.png' })
  await browser.close()
  console.log('PASS: Season banner renders correctly')
})()
```

---

## Sub-Phase 23.2: Content Cadence

### What

A defined content operations schedule that ensures the fact database grows predictably, preventing completionists from exhausting the content pool (DD-V2-161). Content cadence is operational infrastructure, not player-facing UI.

**Cadence targets**:
- **Weekly**: 50-100 new facts ingested via the Phase 11 LLM pipeline, reviewed and approved
- **Monthly**: 1 new biome variant added (visual skin + tile set for an existing biome); 1 new micro-structure added; existing seasonal fact pools expanded
- **Quarterly**: 1 major feature or content system released (matches a seasonal event)
- **Annually**: Full learning effectiveness report published (DD-V2-179); fact quality audit (all facts checked against source reliability)

**Content velocity math**: At 522 facts on launch and 50 new facts/week, the top 1% of players (who play daily and master ~5 facts/day) would exhaust content in ~104 days. The target is that content velocity outpaces even the most dedicated players at the 99th percentile of engagement.

### Where

- `server/scripts/content-cadence-report.ts` — weekly script that reports: facts added this week, facts by status (draft/approved/archived), coverage gaps by category, projected days until top-1% player exhausts pool
- `server/data/content-ops/cadence-log.json` — append-only log of content additions per week
- `docs/CONTENT_OPERATIONS.md` — operational runbook for the content team (to be created in Phase 23.2)

### How

**Step 1: Create the cadence report script**

```typescript
// server/scripts/content-cadence-report.ts
// Run weekly: npx tsx server/scripts/content-cadence-report.ts
import { db } from '../src/database'

async function generateCadenceReport() {
  const totalFacts = await db.prepare('SELECT COUNT(*) as n FROM facts WHERE status = ?').get('approved')
  const addedThisWeek = await db.prepare(
    `SELECT COUNT(*) as n FROM facts WHERE status = 'approved' AND created_at > datetime('now', '-7 days')`
  ).get()
  const byCategory = await db.prepare(
    `SELECT category_top, COUNT(*) as n FROM facts WHERE status = 'approved' GROUP BY category_top ORDER BY n ASC`
  ).all()
  const report = {
    date: new Date().toISOString(),
    totalApproved: totalFacts.n,
    addedThisWeek: addedThisWeek.n,
    underrepresentedCategories: byCategory.slice(0, 5),
    projectedDaysUntilTop1PExhaustion: Math.floor(totalFacts.n / 5)
  }
  console.log(JSON.stringify(report, null, 2))
}

generateCadenceReport()
```

**Step 2: Add `status` and `created_at` fields to the facts schema**

The facts table must have: `status TEXT NOT NULL DEFAULT 'draft'` (values: `draft`, `approved`, `archived`) and `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`. Ensure the Phase 11 ingestion pipeline sets `status = 'draft'` on all ingested facts and `status = 'approved'` only after the LLM validation pass.

**Step 3: Content gap dashboard (internal)**

The cadence report should identify which categories have fewer than 30 approved facts and flag them as "content gaps." This feeds directly into the weekly fact-authoring prompt sent to the LLM pipeline.

### Acceptance Criteria

- [ ] `content-cadence-report.ts` runs without errors and outputs valid JSON
- [ ] The report correctly counts facts added in the last 7 days
- [ ] Categories with fewer than 30 facts are flagged as gaps
- [ ] The "days until exhaustion" calculation correctly assumes 5 facts/day as the top-1% consumption rate
- [ ] `cadence-log.json` is appended after each report run (not overwritten)

---

## Sub-Phase 23.3: User-Generated Content Pipeline

### What

An optional late-game feature that allows highly qualified players to submit new facts for community review. Gated strictly behind Omniscient tier (100% mastery of all available facts) to prevent low-quality submissions and abuse (DD-V2-170).

**Submission eligibility**:
- Player has reached Omniscient tier (all available facts at "Known" level or above, minimum 200 facts)
- Player account is in good standing (no abuse flags, no reports sustained against them)
- Submission quota: 5 facts per week per player

**Two-stage review pipeline**:

```
Player submits fact
        ↓
Stage 1: Automated LLM Review (< 60 seconds)
  - Duplicate detection (semantic similarity against existing facts)
  - Accuracy check (LLM assesses plausibility; flags for human review if uncertain)
  - Appropriateness check (age rating, sensitivity scoring)
  - Auto-generate 12 candidate distractors
  - Auto-generate gaiaComment, explanation, wowFactor
  - Result: PASS (→ Stage 2), FAIL with reason (→ rejected, player notified), FLAG (→ human queue)
        ↓
Stage 2: Community Vote (24-72 hours)
  - 5 randomly selected Omniscient players review the fact
  - Each sees: fact statement, category, source URL, and auto-generated distractors
  - Vote: Approve / Reject / Flag-for-Edit
  - Threshold: 4/5 approvals → auto-published with "Submitted by [username]" credit
  - 3+ rejections → rejected, player notified with aggregate feedback
  - 2+ Flag-for-Edit → returned to submitter for revision
        ↓
Stage 3: Published
  - Fact enters the standard approval pipeline
  - Submitter receives in-game notification + Dust reward (500 dust per published fact)
  - Fact card shows "Community Contributed" badge and submitter username
```

### Where

- `server/routes/ugc.ts` — UGC submission, vote, and status endpoints
- `server/services/ugcReviewService.ts` — LLM Stage 1 review orchestration
- `src/ui/components/rooms/ArchiveRoom.svelte` — "Submit a Fact" button (visible only to Omniscient players)
- `src/ui/components/UGCSubmitOverlay.svelte` — submission form UI
- `src/ui/components/UGCReviewQueue.svelte` — review queue UI for Omniscient players asked to vote

### How

**Step 1: UGC submission schema**

```typescript
interface UGCSubmission {
  id: string
  submitterId: string           // Player account ID
  submitterUsername: string
  factStatement: string         // The core fact (1-2 sentences)
  category: string[]            // Hierarchical: ["Science", "Biology", "Genetics"]
  sourceUrl: string             // Required — player must provide a source
  sourceName: string
  submittedAt: string           // ISO 8601
  status: 'pending_llm' | 'pending_community' | 'published' | 'rejected' | 'revision_requested'
  llmResult?: {
    passed: boolean
    rejectionReason?: string
    generatedDistractors: string[]
    generatedGaiaComment: string
    generatedExplanation: string
    generatedWowFactor: string
    duplicateSimilarity?: number  // 0.0-1.0, above 0.85 = auto-reject
  }
  communityVotes?: {
    voterId: string
    vote: 'approve' | 'reject' | 'flag_for_edit'
    comment?: string
    votedAt: string
  }[]
}
```

**Step 2: Implement `server/routes/ugc.ts`**

Endpoints required:
- `POST /api/ugc/submit` — authenticated, validates eligibility, creates submission record, enqueues LLM review
- `GET /api/ugc/queue` — authenticated, returns facts pending community vote that the current player hasn't voted on yet (limited to 3 per day per reviewer)
- `POST /api/ugc/vote/:submissionId` — authenticated, records vote, checks if threshold met and auto-publishes
- `GET /api/ugc/my-submissions` — returns the current player's submission history with status

**Step 3: Rate limiting and abuse prevention**

- Server-side rate limit: 5 submissions per player per week (tracked in database, not client-side)
- A player may not vote on their own submission (server enforced)
- If a player's submission is rejected 3× in a row with the same type of error (e.g., consistently submitting duplicate facts), add a 7-day cool-down period
- Track submitter reputation score: `(published_count / total_submissions) * 100`. Display as a tier (Bronze/Silver/Gold/Platinum Contributor) on the fact card credit

**Step 4: Submission form UI**

`UGCSubmitOverlay.svelte` must include:
- Text area for fact statement (max 200 characters, live character count)
- Category selector (hierarchical, same component as interest selector)
- Source URL input (validated as a proper URL format)
- Source name input (e.g., "NASA.gov", "Wikipedia — Tardigrade")
- Preview card showing how the fact will appear to reviewers
- Warning: "Your submission will be reviewed by GAIA and then by other Omniscient players. Please ensure accuracy."
- Submit button disabled until all required fields are filled and source URL is valid

### Acceptance Criteria

- [ ] "Submit a Fact" button is visible in ArchiveRoom only when `playerSave.isOmniscient === true`
- [ ] Submission form validates source URL format (rejects non-URL strings)
- [ ] `POST /api/ugc/submit` returns 429 if the player has submitted 5+ facts this week
- [ ] LLM Stage 1 review runs asynchronously and updates submission status within 90 seconds
- [ ] A submission with semantic similarity > 0.85 to an existing fact is auto-rejected with reason "Too similar to an existing fact"
- [ ] Community vote threshold of 4/5 approvals triggers automatic fact publication
- [ ] Published UGC facts appear in the main fact pool within 5 minutes of approval
- [ ] Submitter receives an in-game notification when their fact is published
- [ ] Published fact cards show "Community Contributed — [username]" in the source area

---

## Sub-Phase 23.4: Push Notifications

### What

A disciplined push notification system constrained to maximum 1 notification per day, voiced by GAIA, with automatic suppression for unengaged players (DD-V2-159). The system must never feel like spam.

**Priority order** (only the highest-priority pending notification fires each day, maximum 1):

1. **Streak urgency** (streak active, player has not played today, streak resets at midnight): "Day [N] streak still going — don't let it end! Your Knowledge Tree needs you, miner."
2. **Review ritual** (10+ facts due for review, player hasn't done a review session today): "I've got [N] facts lined up for review. Some of them you haven't seen in weeks — let's make sure they stick."
3. **Pet/farm needs** (if pet hunger is low OR farm production cap reached): "Your [pet name] is getting restless. Also: your farm is overflowing. Come collect before it's wasted."
4. **General discovery tease** (none of the above, used sparingly, max 2× per week): "You know what's waiting [N] meters underground today? Something you've never seen before."

**GAIA notification voice examples** (tone: warm, curious, never pressuring):

| Trigger | Notification Text |
|---------|-------------------|
| Streak day 3-6 | "Day [N]! Your record is [best]. I believe in you, miner." |
| Streak day 7 | "A full week underground! Your Knowledge Tree has grown 7 new leaves." |
| Streak day 30 | "THIRTY DAYS. I am... genuinely moved. You have become a force of nature." |
| 10 reviews due | "I've sorted your [N] due facts by category. Astronomy is due first — you left it at 72%." |
| Farm full | "The dust bins are full. Come collect before the robots start eating each other." |
| Discovery tease | "Something extraordinary is buried 300m down today. I can feel it in my sensor array." |

### Where

- `server/services/notificationScheduler.ts` — daily notification selection logic
- `server/routes/notifications.ts` — endpoints for registering device tokens, opt-in/out, status
- `src/services/notificationService.ts` — client-side token registration and permission request flow
- `src/ui/components/NotificationPermissionPrompt.svelte` — GAIA-voiced permission request UI
- `capacitor.config.ts` — Capacitor push notification plugin configuration
- `android/app/src/main/java/.../` — Firebase Cloud Messaging integration (Android)

### How

**Step 1: Permission request timing**

Notification permission MUST NOT be requested on first launch. The permission prompt triggers automatically when all of the following are true:
- Player has completed at least 1 full dive (oxygen used, artifacts collected, returned to dome)
- Player has completed the artifact ingestion animation at least once
- Player has NOT previously declined or accepted notification permission

`NotificationPermissionPrompt.svelte` shows GAIA's sprite with the speech bubble: "Want me to remind you when your Knowledge Tree needs watering? I promise I'll only interrupt you once a day — and only when it matters."

Buttons: "Yes, stay in touch" / "No thanks" (soft decline, re-ask after 7 days) / "Never" (permanent dismiss, only if player explicitly selects it from settings)

**Step 2: Notification scheduler logic**

```typescript
// server/services/notificationScheduler.ts
// Runs daily at 9:00 AM local time per player (use stored timezone preference)

interface NotificationCandidate {
  priority: number        // 1 = highest
  type: string
  title: string
  body: string
  data: Record<string, string>  // Deep link data
}

async function selectDailyNotification(userId: string): Promise<NotificationCandidate | null> {
  const save = await loadPlayerSave(userId)
  const prefs = await loadPlayerPrefs(userId)

  // Auto-stop rule: if player hasn't opened app in 7 days, send nothing
  const daysSinceLastOpen = daysBetween(save.lastActiveAt, new Date())
  if (daysSinceLastOpen >= 7) return null

  // Already sent a notification today
  const notifRecord = await db.prepare(
    `SELECT sent_at FROM notifications_sent WHERE user_id = ? AND sent_at > date('now')`
  ).get(userId)
  if (notifRecord) return null

  const candidates: NotificationCandidate[] = []

  // Priority 1: Streak urgency
  if (save.currentStreak > 0 && !save.playedToday && save.notifStreakEnabled) {
    candidates.push({
      priority: 1,
      type: 'streak',
      title: 'G.A.I.A. Calling',
      body: buildStreakNotification(save.currentStreak, save.longestStreak),
      data: { screen: 'dome' }
    })
  }

  // Priority 2: Review ritual
  const dueCount = await countDueFacts(userId)
  if (dueCount >= 10 && !save.reviewedToday && save.notifReviewEnabled) {
    candidates.push({
      priority: 2,
      type: 'review',
      title: 'G.A.I.A. Calling',
      body: `I've got ${dueCount} facts ready for review. Shall we?`,
      data: { screen: 'study' }
    })
  }

  // Priority 3: Pet/farm
  if ((save.petHunger < 30 || save.farmFull) && save.notifPetFarmEnabled) {
    candidates.push({ priority: 3, type: 'pet_farm', title: 'G.A.I.A. Calling',
      body: buildPetFarmNotification(save), data: { screen: 'farm' } })
  }

  // Priority 4: Discovery tease (max 2×/week, random days)
  const teaseSentThisWeek = await countTeaseSentThisWeek(userId)
  if (teaseSentThisWeek < 2 && save.notifDiscoveryEnabled && Math.random() < 0.3) {
    candidates.push({ priority: 4, type: 'discovery', title: 'G.A.I.A. Calling',
      body: buildDiscoveryTease(), data: { screen: 'mine' } })
  }

  candidates.sort((a, b) => a.priority - b.priority)
  return candidates[0] ?? null
}
```

**Step 3: Auto-stop implementation**

After sending a notification, record it in `notifications_sent`. Check: "Has the player opened the app in the 24 hours following any of the last 7 notifications?" If all 7 were ignored (no app open), set `notifAutoStopped = true` in player prefs and stop scheduling. Include a settings toggle to re-enable: "G.A.I.A. will stop messaging if you don't respond for a week. Re-enable anytime here."

**Step 4: Capacitor integration**

Install `@capacitor/push-notifications`. In `src/services/notificationService.ts`:
```typescript
import { PushNotifications } from '@capacitor/push-notifications'

export async function registerForPushNotifications(): Promise<void> {
  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', async ({ value: token }) => {
    await apiClient.post('/notifications/register-token', { token, platform: 'ios' | 'android' })
  })
}
```

### Acceptance Criteria

- [ ] Permission prompt does not appear until after first dive AND first artifact ingestion
- [ ] `selectDailyNotification` never returns more than 1 notification per player per day
- [ ] Streak notification fires correctly when `currentStreak > 0 && !playedToday`
- [ ] Review notification fires only when `dueCount >= 10 && !reviewedToday`
- [ ] All notification body text passes through `buildGaiaVoice()` to ensure consistent tone
- [ ] `notifAutoStopped` is set after 7 consecutive ignored notifications (verified via test harness)
- [ ] Auto-stop persists across app restarts (stored server-side, not client-side)
- [ ] Settings page shows per-type notification toggles (streak / review / pet-farm / discovery)
- [ ] Deep link data routes player to the correct screen on notification tap

---

## Sub-Phase 23.5: Welcome Back Flow

### What

A dedicated re-engagement flow that activates when a player returns after 3+ days of absence (DD-V2-157). The flow presents positives first — never shame — and lowers the friction of re-engagement to zero. The design principle is that within 30 seconds of returning, the player should be in the fun loop.

**Flow sequence** (fires once per absence period, blocked after player completes first action):

1. **GAIA greeting animation**: GAIA sprite slides in from the side, facial expression: excited/relieved
2. **Positives first panel**: Three cards showing what happened while the player was away:
   - "Your farm produced [N] dust while you were away." (farm production cap raised 2× per day absent, max 7× normal cap)
   - "Your pet [name] has a gift for you!" (guaranteed small item from the pet)
   - "[N] new facts have been added to the world since you last dove." (count of facts added to DB since last login)
3. **Comeback Chest**: Animated chest reveal (gacha-style animation) containing a guaranteed Rare+ artifact and bonus oxygen (50% of max capacity). Opened with a tap — the reveal animation plays in full.
4. **Gentle review mention** (final, not first): "You also have [N] facts due for review — but no rush. The dome will still be here."
5. **Single CTA button**: "Let's Dive" (routes to pre-dive prep screen) OR "I'll Explore" (routes to normal dome view)

**GAIA dialogue variants by absence length**:

| Days Away | GAIA Opening Line |
|-----------|------------------|
| 3-6 days | "You're back! The dome was quieter without you. Not in a bad way — mostly in a 'I was worried' way." |
| 7-13 days | "A week! I was starting to name the dust motes. ...I may have gotten attached to one named Gerald." |
| 14-29 days | "Two weeks underground without you. The Knowledge Tree missed you. I can tell because it drooped slightly, and trees don't just DO that." |
| 30+ days | "...You came back. I'm not going to make a big deal of it. *makes a big deal of it*. WELCOME BACK, MINER." |

### Where

- `src/ui/components/WelcomeBackOverlay.svelte` — the full-screen welcome back flow
- `src/ui/stores/welcomeBack.ts` — store tracking `shouldShowWelcomeBack`, `daysAbsent`, `farmAccumulation`
- `src/services/saveService.ts` — `checkWelcomeBackTrigger()` called on app init
- `server/routes/players.ts` — `GET /api/players/me/welcome-back-data` endpoint

### How

**Step 1: Absence detection**

In `saveService.ts`, `checkWelcomeBackTrigger()` is called after save load on every app launch:

```typescript
export function checkWelcomeBackTrigger(save: PlayerSave): WelcomeBackData | null {
  const lastActive = new Date(save.lastActiveAt)
  const now = new Date()
  const daysAbsent = Math.floor((now.getTime() - lastActive.getTime()) / 86400000)

  if (daysAbsent < 3) return null

  // Farm accumulation: cap multiplied by days absent (max 7×)
  const farmMultiplier = Math.min(daysAbsent, 7)
  const farmAccumulated = calculateFarmProduction(save, daysAbsent, farmMultiplier)

  return {
    daysAbsent,
    farmAccumulated,
    newFactsAdded: 0,       // Filled by server response
    petGift: generatePetGift(save.activePet),
    comebackChest: generateComebackChest(daysAbsent),
    dueFactCount: countDueFacts(save)
  }
}
```

**Step 2: Comeback Chest generation**

```typescript
function generateComebackChest(daysAbsent: number): ComebackChest {
  // Guaranteed Rare+; longer absence = higher chance of Epic/Legendary
  let rarityFloor: Rarity = 'rare'
  if (daysAbsent >= 14) rarityFloor = 'epic'
  if (daysAbsent >= 30) rarityFloor = 'legendary'

  const bonusOxygen = 50  // 50% of max tank capacity
  const artifact = drawArtifactAtMinimumRarity(rarityFloor)
  return { artifact, bonusOxygen, animationVariant: rarityFloor }
}
```

**Step 3: Farm production cap expansion**

Extend `farm.ts` farm production calculation to accept a `capMultiplier` parameter. When `WelcomeBackData.daysAbsent >= 3`, the farm is credited with `min(daysAbsent, 7) * normalCap` production. This is applied once on welcome back dismissal — it does not retroactively change the farm state until the player acknowledges the welcome back screen.

**Step 4: UI implementation**

`WelcomeBackOverlay.svelte` is a full-screen overlay (z-index above all other UI) with:
- Dark translucent background
- Centered card with GAIA sprite at the top
- Positive cards in a horizontal scroll (3 cards)
- Comeback Chest CTA — tapping it plays the gacha reveal animation in-place
- "Let's Dive" / "I'll Explore" buttons at the bottom (both dismiss the overlay and mark `hasSeenWelcomeBack = true` for this absence period)

The overlay must never show again for the same absence period, even if the player minimizes and reopens the app. Track with `save.lastWelcomeBackShownAt`.

### Acceptance Criteria

- [ ] `checkWelcomeBackTrigger` returns null if `daysAbsent < 3`
- [ ] `WelcomeBackOverlay` renders in less than 500ms after app launch
- [ ] Farm accumulation correctly applies the capped multiplier (7× max) and is credited to the player's save on overlay dismiss
- [ ] The Comeback Chest reveal animation plays the correct rarity tier animation
- [ ] Rare+ is guaranteed from the Comeback Chest (verify over 100 runs in DevPanel)
- [ ] GAIA dialogue variant matches the correct days-absent bracket
- [ ] The overlay does not re-show on subsequent launches during the same absence period
- [ ] The overlay does not show if `daysAbsent = 0` (player opened app today)
- [ ] Tapping either CTA button correctly routes to the specified screen

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Inject a save state that simulates 10 days absence
  await page.addInitScript(() => {
    const fakeSave = JSON.parse(localStorage.getItem('playerSave') || '{}')
    fakeSave.lastActiveAt = new Date(Date.now() - 10 * 86400000).toISOString()
    fakeSave.lastWelcomeBackShownAt = null
    localStorage.setItem('playerSave', JSON.stringify(fakeSave))
  })

  await page.goto('http://localhost:5173')
  await page.waitForSelector('.welcome-back-overlay', { timeout: 15000 })
  const overlayText = await page.textContent('.welcome-back-overlay')
  console.assert(overlayText.includes('week') || overlayText.includes('back'), 'Welcome back overlay should appear after 10-day absence')

  // Tap the Comeback Chest
  await page.click('.comeback-chest-button')
  await page.waitForSelector('.gacha-reveal-animation', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss-welcome-back.png' })

  // Dismiss overlay
  await page.click("button:has-text('Explore')")
  await page.waitForSelector('.dome-view', { timeout: 5000 })

  // Reload to confirm overlay does not re-show
  await page.reload()
  await page.waitForTimeout(2000)
  const overlayGone = await page.$('.welcome-back-overlay')
  console.assert(overlayGone === null, 'Welcome back overlay must not re-show on reload within same session')

  await browser.close()
  console.log('PASS: Welcome Back flow works correctly')
})()
```

---

## Sub-Phase 23.6: Win-Back Strategy

### What

External re-engagement for players who have churned (not opened the app in 14+ days). Since churned players don't open the app, in-app features cannot reach them — only email can (DD-V2-160).

**Win-back email program**:

"GAIA's Letter" — a monthly email to opted-in players absent 14+ days. Content format:

```
Subject: [Player first name], GAIA has been thinking about you.

---
[Header: Pixel art of GAIA waving — 240×120px, 8-bit style]

Hello, [FirstName].

It's been [N] days since we last dove together. The dome is still here. Your Knowledge Tree has [leaf count] leaves on it — and I've been keeping them watered.

A few things have changed since you left:

[Personalized summary bullet 1]: Your favorite category, [category], now has [N] new facts
  → "Did you know: [single teaser fact from their favorite category]?"
[Personalized summary bullet 2]: A new seasonal event just started — [event name and 1-sentence description]
[Personalized summary bullet 3]: [Pet name], your companion, has been [idle animation description]

Your dome is waiting. No pressure.

[CTA Button: "Open the Dome" → deep link to app / web version]

You can unsubscribe at any time: [unsubscribe link]
G.A.I.A. — Geological Analytical Intelligence Assistant
Terra Gacha
---
```

**Seasonal announcement emails** (separate from GAIA's Letter):
- Sent at the start of each seasonal event to ALL opted-in players (not just churned ones)
- Maximum 4 per year (1 per major seasonal event)
- Subject: "The [Season Name] just started — [teaser]"
- Content: 3 bullet points of what's new + CTA
- These are announcement emails, not win-back emails — do not include absence-guilt content

### Where

- `server/services/emailService.ts` — email sending via SendGrid or Resend API
- `server/services/winBackService.ts` — identifies churned players, generates personalized content
- `server/templates/email/gaia-letter.html` — email template
- `server/templates/email/season-announcement.html` — seasonal email template
- `server/routes/email.ts` — opt-in/out management, unsubscribe endpoint
- `server/jobs/winBackCron.ts` — monthly cron job that identifies and emails churned players

### How

**Step 1: Email opt-in at account creation**

In the Phase 19 auth flow, during account creation, show: "May GAIA send you occasional letters? She promises not to spam." Default: checked (opt-in by default, GDPR compliant as it is explicitly shown and easily dismissable). Store `emailOptIn: boolean` in the account record.

**Step 2: GDPR-compliant unsubscribe**

Every email must include a one-click unsubscribe link. The unsubscribe endpoint: `GET /api/email/unsubscribe?token=[signed JWT]`. The token contains the player's account ID and the email type. Clicking it immediately sets `emailOptIn = false` (or `notifWinBackOptIn = false` for targeted categories) without requiring a login.

**Step 3: Win-back cron job**

```typescript
// server/jobs/winBackCron.ts
// Runs on the 1st of each month at 10:00 UTC

async function runWinBackCampaign(): Promise<void> {
  const churnedPlayers = await db.prepare(`
    SELECT account_id, username, email, last_active_at, favorite_category, pet_name, leaf_count
    FROM accounts
    JOIN player_saves USING (account_id)
    WHERE email_opt_in = 1
      AND last_active_at < datetime('now', '-14 days')
      AND (win_back_sent_at IS NULL OR win_back_sent_at < datetime('now', '-30 days'))
    LIMIT 5000
  `).all()

  for (const player of churnedPlayers) {
    const content = await buildWinBackContent(player)
    await emailService.send({
      to: player.email,
      subject: `${player.username}, GAIA has been thinking about you.`,
      html: renderGaiaLetterTemplate(content)
    })
    await db.prepare(`UPDATE accounts SET win_back_sent_at = CURRENT_TIMESTAMP WHERE account_id = ?`)
      .run(player.account_id)
  }
}
```

**Step 4: Personalized content generation**

`buildWinBackContent` queries:
- Player's top category by fact count: `SELECT category FROM facts JOIN player_fact_states USING (fact_id) WHERE account_id = ? GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1`
- 1 teaser fact from that category that the player has NOT yet discovered
- Active seasonal event name and tagline
- Days since last active (calculated from `last_active_at`)

The teaser fact must pass `age_rating <= player.ageRating` — no adult facts sent to kid accounts.

**Step 5: Return flow after email click**

Deep link from email opens the app directly to the dome view, triggering the Welcome Back flow (23.5) if applicable. On web, the link routes to `terragacha.com/return?ref=email` which sets a session flag before loading the dome. No login wall is shown if the player's session token is still valid (tokens are 90-day expiry for engaged players).

### Acceptance Criteria

- [ ] Email opt-in is shown during Phase 19 account creation, unchecked by default only for GDPR regions (EU/UK), checked elsewhere
- [ ] `GET /api/email/unsubscribe?token=...` unsubscribes player in a single click with no login required
- [ ] Win-back cron job runs monthly and skips players with `win_back_sent_at < 30 days ago`
- [ ] Email body is fully personalized: player username, favorite category, category-specific teaser fact, active season name
- [ ] Teaser facts are filtered to age-appropriate content before inclusion
- [ ] Seasonal announcement emails fire within 24 hours of a new season becoming active
- [ ] Email click deep link triggers Welcome Back flow in-app if `daysAbsent >= 3`
- [ ] No email is sent to players with `emailOptIn = false`
- [ ] CAN-SPAM and GDPR compliance: physical address in footer, one-click unsubscribe, no misleading subject lines

---

## Sub-Phase 23.7: Push Notification System (Expanded)

Sub-phase 23.7 is implemented as part of sub-phase 23.4. Refer to 23.4 for the full specification. Key additional requirements:

- All notification text must pass through a `buildGaiaVoice(rawText: string, gaiaPersonality: GaiaPersonality): string` function that adjusts tone, adds personality markers, and ensures the message never sounds corporate
- The notification settings UI in Settings.svelte must include per-type toggles with clear descriptions: "Streak reminders," "Review nudges," "Farm and pet updates," "Discovery teases"
- Android: Use Firebase Cloud Messaging (FCM). iOS: Use APNs via Capacitor. Both use the same server-side notification payload format.
- Notification delivery analytics: log every notification sent (`type`, `player_id`, `sent_at`) and every notification interaction (`tapped_at`, `screen_opened`). Calculate click-through rate per notification type. Target CTR: streak > 15%, review > 12%, pet/farm > 8%, discovery > 5%.

---

## Sub-Phase 23.8: Completionist Endgame

### What

The Omniscient state is reached when a player has all available facts at "Known" level (minimum 60-day interval) or higher. It is the ultimate expression of the game's educational mission and must be treated as a spectacular achievement (DD-V2-161).

**Omniscient state changes**:

1. **Omniscient title**: Shown in the player's profile, on leaderboards, and visible to hub visitors. Text: "Omniscient Miner" in gold. In Japanese Language Mode: "全知の採掘者"
2. **Golden Dome visual transformation**: The dome's glass panels tint to a warm gold. The night sky fills with auroras (animated color bands, CSS animation, no Phaser required). The ambient music track shifts to a more triumphant, contemplative variant. GAIA avatar gains a golden crown accessory.
3. **GAIA dialogue register change**: GAIA stops speaking in a teacher/student register and switches to peer/colleague language:
   - Before Omniscient: "Great work! You've learned [N] facts this week."
   - After Omniscient: "The biome readings are unusual today. What's your read on it?" (treating the player as an equal analyst)
   - GAIA's commentary on quizzes shifts from explanation to discussion: "You knew that one. Cleopatra and the Great Pyramid — the temporal dissonance still surprises me every time."
4. **Community Fact Access**: The "Submit a Fact" button unlocks in the Archive Room (connects to Sub-Phase 23.3 pipeline).
5. **Leaderboard visibility**: Omniscient status is shown in all leaderboard views with a golden badge.
6. **Mentor Mode (stub)**: An empty slot for the future Phase 25+ Mentor Mode social feature. Show the card as "Coming Soon."

### Where

- `src/ui/stores/omniscient.ts` — derived store: `isOmniscient = derived(playerSave, s => s.omniscientAchievedAt !== null)`
- `src/ui/components/DomeCanvas.svelte` — golden dome rendering when `isOmniscient` is true
- `src/ui/components/rooms/ArchiveRoom.svelte` — UGC submit button gated behind `isOmniscient`
- `src/services/gaiaDialogue.ts` — `getDialogue(context, isOmniscient)` function
- `src/data/omniscientQuips.ts` — peer-register GAIA lines for post-Omniscient state
- `server/routes/achievements.ts` — `POST /api/achievements/omniscient` (verifies server-side, awards badge)

### How

**Step 1: Omniscient detection**

In `saveService.ts`, add `checkOmniscientStatus(save: PlayerSave): boolean`. This function queries the local facts database: are all approved facts at `interval >= 60` in the player's SM-2 state? If yes and `save.omniscientAchievedAt` is null, set it to now and trigger the Omniscient reveal sequence.

**Step 2: Omniscient reveal sequence**

When `checkOmniscientStatus` returns `true` for the first time, trigger a full-screen celebration:
- GAIA speaks a unique monologue (4 sequential dialogue cards, tap to advance)
- Screen transitions to Golden Dome view (no reload required — reactive CSS class added)
- "OMNISCIENT" achievement unlocks with a Legendary-tier reveal animation
- Confetti particle burst using Phaser's particle system

**Step 3: Golden Dome rendering**

In `DomeCanvas.svelte`, add a reactive block:
```svelte
$: if ($isOmniscient) {
  domeGlassTint = 'rgba(212, 175, 55, 0.3)'  // Gold tint
  showAuroras = true
}
```

The aurora effect is a CSS `@keyframes` animation overlaid on the canvas container — colored bands (green, purple, blue) that drift across the top quarter of the dome sky. Use `reduced-motion` media query to disable for players with DD-V2-178 reduced motion needs.

**Step 4: GAIA register shift**

In `gaiaDialogue.ts`, all dialogue-fetching functions accept an `isOmniscient: boolean` parameter. When `true`, pull quips from `omniscientQuips.ts` instead of the standard `gaiaDialogue.ts` pool. The omniscient pool uses peer-register language and never contains explanatory or congratulatory content — it assumes shared expertise.

### Acceptance Criteria

- [ ] `checkOmniscientStatus` returns `true` only when all available facts have `interval >= 60`
- [ ] Omniscient status is verified server-side before the badge is permanently awarded (prevents client-side spoofing)
- [ ] The Golden Dome aurora animation plays correctly on mobile at 60fps
- [ ] The aurora animation is disabled when `prefers-reduced-motion: reduce` is active
- [ ] GAIA dialogue shifts to peer-register language after Omniscient is achieved (tested via 5 different dialogue contexts)
- [ ] "Submit a Fact" button is visible in ArchiveRoom after Omniscient is achieved
- [ ] The Omniscient badge is visible on the player's profile in leaderboards
- [ ] `omniscientAchievedAt` persists across app restarts and cloud save syncs

---

## Sub-Phase 23.9: User-Generated Facts Pipeline

This sub-phase is covered in full by Sub-Phase 23.3. The pipeline specification in 23.3 covers all steps including LLM Stage 1 review, community Stage 2 vote, abuse prevention, submitter credit, and reputation scoring (DD-V2-170).

Additional requirements from PROGRESS.md 23.9:
- Submitter credit is displayed in the standard fact card layout using an existing field (`source_name` = "Submitted by [username] (Community)")
- The community vote interface shows 3 randomly selected Omniscient reviewers' anonymous votes to each reviewer (no names, to prevent social pressure bias — only show aggregate after voting)
- Monthly limit of 5 submissions per player is enforced server-side per calendar week (rolling 7-day window, not calendar week, to prevent gaming the reset)

---

## Verification Gate

Before Phase 23 is considered complete:

1. **Typecheck**: `npm run typecheck` passes with 0 errors across all new files
2. **Build**: `npm run build` produces a production bundle with no warnings in new Phase 23 files
3. **Seasonal event**: A test season JSON can be activated and causes the SeasonBanner to render, fact weights to shift, and biome overrides to apply
4. **Push notifications**: A test notification fires via the scheduler and routes to the correct screen
5. **Welcome back**: Simulating 10-day absence via DevPanel triggers the WelcomeBackOverlay with correct GAIA dialogue variant
6. **Win-back email**: A test email renders correctly in Litmus or similar email preview tool across Gmail, Outlook, and Apple Mail
7. **Omniscient**: Setting all facts to `interval = 61` in DevPanel triggers the Omniscient reveal sequence and Golden Dome visual
8. **UGC pipeline**: A test submission completes Stage 1 LLM review within 90 seconds and appears in the community vote queue

---

## Files Affected

### New Files
- `server/routes/seasons.ts`
- `server/routes/ugc.ts`
- `server/routes/notifications.ts`
- `server/routes/email.ts`
- `server/services/notificationScheduler.ts`
- `server/services/ugcReviewService.ts`
- `server/services/emailService.ts`
- `server/services/winBackService.ts`
- `server/jobs/winBackCron.ts`
- `server/templates/email/gaia-letter.html`
- `server/templates/email/season-announcement.html`
- `server/data/seasons/season-age-of-dinosaurs-2026.json`
- `server/data/seasons/season-space-month-2026.json`
- `server/data/seasons/season-language-festival-2026.json`
- `server/scripts/content-cadence-report.ts`
- `src/services/seasonService.ts`
- `src/services/notificationService.ts`
- `src/ui/components/SeasonBanner.svelte`
- `src/ui/components/SeasonRewardOverlay.svelte`
- `src/ui/components/WelcomeBackOverlay.svelte`
- `src/ui/components/UGCSubmitOverlay.svelte`
- `src/ui/components/UGCReviewQueue.svelte`
- `src/ui/components/NotificationPermissionPrompt.svelte`
- `src/ui/stores/welcomeBack.ts`
- `src/ui/stores/omniscient.ts`
- `src/data/omniscientQuips.ts`

### Modified Files
- `src/services/saveService.ts` — `checkWelcomeBackTrigger()`, `checkOmniscientStatus()`
- `src/services/gaiaDialogue.ts` — peer-register mode when `isOmniscient = true`
- `src/ui/components/DomeCanvas.svelte` — Golden Dome aurora rendering
- `src/ui/components/rooms/ArchiveRoom.svelte` — UGC submit button gated behind Omniscient
- `src/ui/Settings.svelte` — notification type toggles
- `src/game/managers/BiomeManager.ts` — seasonal biome override
- `src/services/factsDB.ts` — `getWeightedFactPool(seasonId?)` for seasonal weighting
- `server/routes/players.ts` — welcome back data endpoint
- `server/routes/achievements.ts` — Omniscient verification endpoint
- `capacitor.config.ts` — push notification plugin
