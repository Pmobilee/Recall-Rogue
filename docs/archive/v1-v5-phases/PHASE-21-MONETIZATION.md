# Phase 21: Monetization

**Status**: NOT STARTED
**Goal**: Establish sustainable, ethical revenue without pay-to-win. Build the oxygen economy, subscription system, IAP catalog, analytics infrastructure, and economy rebalance required to run Recall Rogue as a live commercial product.
**Design Decisions**: DD-V2-134, DD-V2-138, DD-V2-145, DD-V2-146, DD-V2-147, DD-V2-148, DD-V2-149, DD-V2-150, DD-V2-151, DD-V2-152, DD-V2-153, DD-V2-154, DD-V2-155

---

## Overview

Phase 21 implements all revenue-generating systems. It is strictly gated on Phase 19 (auth, deployed backend) and Phase 20 (mobile launch). The subscription store API (21.5) has an additional hard gate: minimum 3,000 approved facts in the database (DD-V2-154). Sub-phases 21.1–21.4 and 21.8–21.15 can be built without passing the fact gate; 21.5 must not activate until the gate is met.

The game's monetization philosophy (DD-V2-145) is:
- No premium currency. All prices are direct dollar amounts.
- No pay-to-win. Oxygen buys time, not power.
- Knowledge is always free. Facts, SM-2, Knowledge Tree, study sessions: all free forever.
- The mastery path is sacred (DD-V2-152). Skilled learners playing free are the most valuable word-of-mouth.

---

## Prerequisites

- Phase 19: Auth system (JWT, account creation, server-side save) — REQUIRED for subscription validation.
- Phase 20: Mobile launch on App Store and Play Store — REQUIRED for IAP products to exist.
- Phase 11: Content pipeline at scale — REQUIRED before 21.5 activates (3,000-fact gate, DD-V2-154).
- Phase 8.14: Balance simulation — REQUIRED before economy rebalance (21.12) ships.
- `server/` Fastify backend running and deployed (from Phase 10 scaffold).
- Capacitor `@capacitor/purchases` or RevenueCat SDK integrated (dependency approval required from user before adding).

---

## Terra Pass Benefit Matrix

| Feature | Free Player | Terra Pass ($4.99/mo) | Expedition Patron ($24.99/season) | Grand Patron ($49.99/yr) |
|---|---|---|---|---|
| All facts & quizzes | YES | YES | YES | YES |
| SM-2 spaced repetition | YES | YES | YES | YES |
| Knowledge Tree | YES | YES | YES | YES |
| Study sessions | YES | YES | YES | YES |
| Oxygen regen (1 tank/90 min, max 3) | YES | UNLIMITED | UNLIMITED | UNLIMITED |
| Monthly exclusive cosmetic | NO | YES (1/month) | YES + patron extras | YES + all seasonal |
| Season Pass premium track | NO | NO | YES | YES (all seasons) |
| Pioneer Pack (first 7 days) | Purchase available | Purchase available | Purchase available | Purchase available |
| Patron nameplate on leaderboards | NO | NO | YES | YES |
| GAIA exclusive dialogue set | NO | NO | YES | YES |
| Patron Wall in Archive room | NO | NO | YES | YES |
| Physical sticker pack (annual mail) | NO | NO | NO | YES |
| Educational nonprofit donation | NO | NO | Included | Included |

---

## Oxygen Regen Formula

Real-time regen outside of dives. Implemented in `src/services/oxygenRegenService.ts` (new) and read by DomeView on app focus.

```
tanksAvailable = min(tanksStored + floor((now - lastRegenTimestamp) / 5400000), maxBank)
```

Where:
- `5400000` = 90 minutes in milliseconds (DD-V2-138)
- `maxBank` = 3 for free players, `Infinity` for Terra Pass subscribers
- `lastRegenTimestamp` stored in `PlayerSave.lastRegenAt` (Unix ms)

Dive cost by type:
- Quick dive (layers 1–5): 1 tank
- Medium dive (layers 6–10): 2 tanks
- Deep expedition (layers 11–15): 3 tanks
- Endgame dive (layers 16–20): 3 tanks (same as deep)

Mastery bonus tanks (quiz gate milestones per DD-V2-026):
- Gate 5 correct: +0.25 tank credited (fractional; credited to `tankCredit` float, floor applied to integer bank)
- Gate 10 correct: +0.25 tank
- Gate 15 correct: +0.25 tank
- Gate 20 correct: +0.25 tank
- Perfect run (all gates correct): net +1 full tank
- Shallow gate bonus capped at 0.1 tank per gate for layers 1–3 (anti-farming)

---

## IAP Product IDs

These must be registered in App Store Connect and Google Play Console before Phase 21.5 implementation.

### Subscriptions
| Product ID | Platform | Price | Description |
|---|---|---|---|
| `com.terragacha.terrapass.monthly` | iOS + Android | $4.99/month | Terra Pass — unlimited oxygen + monthly cosmetic |
| `com.terragacha.patron.season` | iOS + Android | $24.99/season | Expedition Patron — Terra Pass + Season Pass + patron exclusives |
| `com.terragacha.patron.annual` | iOS + Android | $49.99/year | Grand Patron — all seasons + physical sticker pack |

### One-Time Purchases
| Product ID | Platform | Price | Description |
|---|---|---|---|
| `com.terragacha.pioneerpack` | iOS + Android | $4.99 | Pioneer Pack — one-time, first 7 days only |
| `com.terragacha.seasonpass.current` | iOS + Android | $4.99 | Current Knowledge Expedition season pass (premium track) |

### Cosmetic IAPs (examples; full catalog generated per season)
| Product ID | Platform | Price | Tier |
|---|---|---|---|
| `com.terragacha.cosmetic.animated.pickaxe_aurora` | iOS + Android | $3.99 | Animated |
| `com.terragacha.cosmetic.animated.dome_volcanic` | iOS + Android | $4.99 | Animated |
| `com.terragacha.cosmetic.static.helmet_explorer` | iOS + Android | $0.99 | Static |
| `com.terragacha.cosmetic.static.suit_cobalt` | iOS + Android | $1.99 | Static |
| `com.terragacha.cosmetic.pet.trilobite_gold` | iOS + Android | $2.99 | Pet skin |
| `com.terragacha.cosmetic.gaia.crystalline` | iOS + Android | $1.99 | GAIA skin |
| `com.terragacha.cosmetic.bundle.volcanic_trio` | iOS + Android | $7.99 | Bundle (3 items, ~20% discount) |
| `com.terragacha.radar.disc_boost_3` | iOS + Android | $0.99 | Consumable (Data Disc Radar, 3 dives) |

### Subscription Verification Flow

1. Player taps "Subscribe" in Terra Pass UI.
2. Native IAP sheet presented via Capacitor Purchases plugin (RevenueCat handles receipt).
3. On success: RevenueCat webhook fires `POST /api/subscriptions/verify` on Fastify backend.
4. Backend validates receipt against RevenueCat API, writes `user.subscription` row: `{ type: 'terra_pass', expiresAt: ISO8601, source: 'apple'|'google' }`.
5. Frontend `syncService.ts` fetches updated subscription state on next app foreground.
6. `saveService.ts` exposes `isSubscriber()` → reads from PlayerSave synced from server.
7. `oxygenRegenService.ts` checks `isSubscriber()` to set `maxBank = Infinity`.
8. Subscription lapse: webhook fires `subscription_expired` → backend clears subscription row → sync restores maxBank to 3 on next foreground.

---

## Season Pass Reward Tracks

### Free Track — "Knowledge Expedition" Season 1: Deep Time
Progress earned by: facts learned (1 point each), fossils found (5 points), dives completed (2 points).

| Milestone | Points | Reward |
|---|---|---|
| Horizon 1 | 50 | 200 dust + 1 bomb |
| Horizon 2 | 150 | Uncommon artifact + 1 shard |
| Horizon 3 | 300 | Fossil fragment (guaranteed trilobite) |
| Horizon 4 | 500 | 5 consumable bundle + streak freeze |
| Horizon 5 | 750 | Random Data Disc |
| Horizon 6 | 1,000 | 1 crystal + Knowledge Store voucher (200 KP) |
| Horizon 7 | 1,500 | Rare+ artifact guarantee |
| Grand Finale | 2,000 | Fossil egg (cosmetic companion hatch) |

### Premium Track — "Knowledge Expedition" Season 1: Deep Time (exclusive cosmetics, requires purchase)
| Milestone | Points | Reward |
|---|---|---|
| Horizon 1 | 50 | Trilobite Rider pickaxe trail (animated) |
| Horizon 2 | 150 | Dome wallpaper: Cambrian Seabed |
| Horizon 3 | 300 | Miner helmet: Fossil Hunter skin |
| Horizon 4 | 500 | GAIA outfit: Paleontologist coat |
| Horizon 5 | 750 | Pet skin: Ammonite Shell cat variant |
| Horizon 6 | 1,000 | Dome object: Giant Ammonite decoration |
| Horizon 7 | 1,500 | Full suit: Trilobite armor set |
| Grand Finale | 2,000 | Exclusive "Deep Time Pioneer" title + animated badge |

Rules (DD-V2-149):
- Pass never expires — players complete at their own pace.
- No FOMO: rewards are locked to that season's purchase but never time-deleted after earning.
- After season ends: all seasonal facts added to permanent free fact pool.
- Progress tied to learning milestones (facts learned), not session time.

---

## Pioneer Pack Contents (DD-V2-150)

- 500 dust (immediate, credited to PlayerSave.minerals.dust)
- 1 guaranteed Rare+ artifact (generated at open; rarity reroll to Rare minimum)
- "Pioneer's Pickaxe" skin — unique visual, exclusive to this pack, permanent cosmetic
- 3 bonus oxygen tanks (immediate, added to tank bank capped at maxBank+3 for the grant only)
- "Pioneer" badge — visible on player profile, future leaderboards, and hub visitors screen

Availability: first 168 hours (7 days) after account creation. After expiry, removed from shop; never returns.

---

## Patron Tier Benefits (DD-V2-153)

### Expedition Patron ($24.99/season)
- All Terra Pass benefits (unlimited oxygen + monthly cosmetic)
- Season Pass premium track for current season
- Exclusive "Patron of Knowledge" GAIA dialogue set (10 unique GAIA quips for correct quiz answers)
- Unique dome floor theme: "Scholar's Hall" (tiled marble-look with faint golden grid)
- "Patron" nameplate on all leaderboard entries and future hub visitor cards
- Real-world donation to a named educational nonprofit (Wikimedia Foundation by default; named in credits and patron section)

### Grand Patron ($49.99/year)
- All Expedition Patron benefits for every season in the year
- Every seasonal cosmetic included automatically (no per-season purchase required)
- Physical pixel art sticker pack mailed annually: 10–15 designs featuring game creatures, minerals, and GAIA. Print-on-demand via Printful or Gelato (no inventory held by developer).
- Listed on in-game Patron Wall in Archive room
- Listed in app credits by name (optional; consent required at purchase)

---

## Economy Rebalance Formulas (DD-V2-151)

### Remove Mineral Decay
- Delete `applyMineralDecay()` from `src/services/saveService.ts` entirely.
- Remove `MINERAL_DECAY_THRESHOLD` and `MINERAL_DECAY_RATE` from `src/data/balance.ts`.

### Dome Maintenance Sink
Dome maintenance is assessed weekly (every 7 days real time). Cost scales with number of active dome rooms:

```
weeklyMaintenance = (unlockedRoomCount - 2) * 50 * maintenanceMultiplier
```

Where `maintenanceMultiplier = 1.0` at launch (tunable). First 2 rooms (Command, Lab) are free. Each additional room costs +50 dust/week. 6 rooms = (6-2) × 50 = 200 dust/week.

Consequence of not paying: cosmetic only. Room displays a "needs maintenance" visual state (dust motes, flickering lights). No gameplay blocking.

### Spending Bonus Thresholds
First 500 dust spent per calendar week: +10% yield on all mineral node finds for that week. Tracked in `PlayerSave.weeklyDustSpent`. Resets Monday 00:00 UTC.

### Gold-Tier Aspirational Sinks
- "Obsidian Dome Throne" decoration: 50,000 dust
- "Primordial GAIA Core" skin (animated): 30,000 dust + 100 essence
- "Eternal Patron" dome plaque: 20,000 dust (vanity)

### Wealth Distribution Monitoring
Backend analytics event `economy_wealth_snapshot` emitted daily per player: `{ dustHeld, shardHeld, crystalHeld, totalDustEquivalent }`. If aggregate telemetry shows top 10% hold >80% of total mineral wealth, tighten sinks (reduce spending bonus threshold to 300 dust, raise maintenance by 25%).

---

## Mastery-Free Monitoring Thresholds (DD-V2-152)

Definitions:
- **Mastery-free player**: D30 active, never purchased any IAP or subscription, last dive completed with tank bank > 0 (not oxygen-gated).
- **Subscriber**: active Terra Pass or Patron subscription at D30.

Monitoring query (run monthly against analytics database):
```sql
SELECT
  COUNT(*) FILTER (WHERE segment = 'mastery_free') AS mastery_free_count,
  COUNT(*) FILTER (WHERE segment = 'subscriber') AS subscriber_count,
  COUNT(*) FILTER (WHERE segment = 'inactive') AS inactive_count,
  COUNT(*) AS total_d30_active
FROM player_segments
WHERE cohort_date >= CURRENT_DATE - INTERVAL '30 days';
```

Thresholds:
- Mastery-free < 30% of D30 active: no action.
- Mastery-free 30–40%: internal review. Consider reducing max tank bank from 3 to 2 for free players. Do NOT ship without user sign-off.
- Mastery-free > 40%: reduce quick dive oxygen cost credit from gate milestones (shallow gate bonus from 0.1 to 0.05 tank).
- NEVER visible to players. NEVER communicated to players. NEVER weaken quiz gate mastery path itself.

---

## Content Volume Prerequisites (DD-V2-154)

The Terra Pass subscription (`com.terragacha.terrapass.monthly`) and Expedition Patron products MUST NOT be activated in production until:

1. `SELECT COUNT(*) FROM facts WHERE status = 'approved'` returns >= 3,000.
2. Phase 11 content pipeline is running with bi-weekly drops of 50–100 facts.
3. Fact coverage across at least 8 distinct categories.

This gate is enforced in `server/routes/subscriptions.ts`:
```typescript
const factCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM facts WHERE status = ?', ['approved'])
if (factCount.count < 3000) {
  return reply.status(503).send({ error: 'subscription_not_yet_available', factsReady: factCount.count, required: 3000 })
}
```

Current fact count: 522 (2026-03-03). Gap: 2,478 facts. Phase 11 must close this gap before 21.5 activates.

---

## Sub-Phase 21.1: Oxygen Regeneration System

### What
Implement real-time oxygen tank regeneration outside of dives. 1 tank per 90 minutes, max 3 tanks banked (free) or unlimited (subscriber). Regen timer displayed in dome UI without anxiety-inducing countdown.

### Where
- `src/services/oxygenRegenService.ts` — new file
- `src/data/types.ts` — add `lastRegenAt: number` to `PlayerSave`
- `src/data/balance.ts` — add `OXYGEN_REGEN_MS = 5_400_000`, `OXYGEN_MAX_BANK_FREE = 3`
- `src/ui/components/DomeView.svelte` — display tank count + regen state
- `src/services/saveService.ts` — migrate existing saves with `lastRegenAt = Date.now()`

### How
1. Create `src/services/oxygenRegenService.ts` with exported class `OxygenRegenService`:
   - `computeTanks(save: PlayerSave, isSubscriber: boolean): number` — applies the regen formula above
   - `drainTanks(save: PlayerSave, cost: number): PlayerSave` — deducts tanks, throws if insufficient
   - `creditMasteryTank(save: PlayerSave, gatesPassed: number, depth: number): PlayerSave` — adds fractional mastery bonus
   - Called on every app foreground via `document.addEventListener('visibilitychange')`
2. Add `lastRegenAt` and `tankBank` to `PlayerSave` in `src/data/types.ts`. Migration: existing saves get `lastRegenAt = Date.now()`, `tankBank = 3`.
3. In `DomeView.svelte`, display tank bank as discrete tank icons (e.g., 3 tank icons, filled/empty). When `tankBank === maxBank`, show "Ready" text in amber. When `tankBank < maxBank`, show "Next tank in Xh Ym" — computed from `lastRegenAt + 5_400_000 * (tanksUntilFull)` — but displayed only as a soft info label, not a countdown clock.
4. Pre-dive validation in `GameManager.ts` `startDive()`: check `oxygenRegenService.computeTanks(save, isSubscriber) >= diveCost`, else show GAIA toast "Not enough oxygen tanks for this depth."
5. Write unit tests for `computeTanks` covering: zero tanks regen after long absence, cap at maxBank, subscriber cap bypass.

### Acceptance Criteria
- [ ] Free player with 0 tanks shows "Ready" after 90 minutes of real elapsed time (testable by setting `lastRegenAt` to `Date.now() - 5_400_000`)
- [ ] Free player never exceeds 3 tanks
- [ ] Subscriber shows no tank cap in UI (shows filled bar or "Unlimited")
- [ ] Pre-dive correctly blocks if tankBank < diveCost
- [ ] Mastery gate bonus credits fractional tanks; 4 perfect gates = net +1 tank
- [ ] `npm run typecheck` passes with no errors

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
  // Inject a save with lastRegenAt set 3 hours ago and 0 tanks
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terraMinerSave') || '{}')
    save.tankBank = 0
    save.lastRegenAt = Date.now() - (3 * 60 * 60 * 1000) // 3 hours ago
    localStorage.setItem('terraMinerSave', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-oxygen-regen.png' })
  // Verify tank display shows 3 tanks (3 hours = 2 regen cycles, capped at 3)
  const tankDisplay = await page.$eval('[data-testid="tank-bank"]', el => el.textContent)
  console.assert(tankDisplay.includes('3') || tankDisplay.includes('Unlimited'), 'Tank bank should show 3')
  await browser.close()
})()
```

---

## Sub-Phase 21.2: In-App Purchase Catalog & Pioneer Pack

### What
Implement the IAP product catalog, Pioneer Pack purchase flow, and all cosmetic purchase surfaces. NO premium currency. All prices direct dollar amounts. Pioneer Pack available during first 7 days only.

### Where
- `src/services/iapService.ts` — new file, wraps Capacitor Purchases / RevenueCat
- `src/ui/components/rooms/MarketRoom.svelte` — add IAP purchase buttons for cosmetics
- `src/ui/components/PioneerPackModal.svelte` — new file, 7-day limited offer modal
- `src/data/types.ts` — add `purchasedProducts: string[]`, `installDate: number`, `hasPioneerPack: boolean` to `PlayerSave`
- `server/routes/iap.ts` — new file, receipt verification endpoint
- `src/data/iapCatalog.ts` — new file, typed product catalog

### How
1. Create `src/data/iapCatalog.ts` defining `IAPProduct` interface and the full product catalog from the IAP Product IDs table above. Include `tier: 'animated'|'static'|'pet'|'gaia'|'bundle'|'consumable'|'subscription'` and `priceUSD: number`.
2. Create `src/services/iapService.ts` with:
   - `initialize()` — configures RevenueCat SDK with API key from env
   - `purchaseProduct(productId: string): Promise<PurchaseResult>` — triggers native purchase sheet
   - `restorePurchases(): Promise<void>` — for iOS restore purchases requirement
   - `getOfferings(): Promise<Offering[]>` — fetches current RevenueCat offerings
   - All methods gracefully degrade (return `{ success: false, error: 'iap_not_available' }`) in browser/dev mode
3. Create `src/ui/components/PioneerPackModal.svelte`: full-screen modal, shown once on first login between days 1–7. Contents: animated pixel art Pioneer's Pickaxe, item list, "$4.99 — one-time offer" button, "Not now" dismiss. Once dismissed, record `save.pioneerPackDismissed = true`. Show again on next login until purchased or day 7 expires.
4. Add purchase buttons to `src/ui/components/rooms/MarketRoom.svelte` for cosmetics. Each button shows item name, tier badge, and direct price (e.g., "$3.99"). On tap: call `iapService.purchaseProduct(id)` → on success: add to `save.purchasedProducts`, apply cosmetic to unlock store.
5. Create `server/routes/iap.ts`: `POST /api/iap/verify` endpoint that forwards receipt to RevenueCat REST API, returns `{ valid: boolean, productId: string, userId: string }`.
6. Write `src/data/iapCatalog.ts` cosmetic unlock mapper: `applyPurchasedCosmetic(productId: string, save: PlayerSave): PlayerSave`.

### Acceptance Criteria
- [ ] Pioneer Pack modal appears on fresh install, disappears after purchase or day 8
- [ ] Purchasing a static cosmetic unlocks it in Cosmetics shop immediately
- [ ] `iapService.purchaseProduct()` returns graceful error in browser dev mode (no crash)
- [ ] All product IDs match the IAP Product IDs table exactly
- [ ] No premium currency UI appears anywhere in the app
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
  // Set fresh install date (within 7 days)
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terraMinerSave') || '{}')
    save.installDate = Date.now()
    save.hasPioneerPack = false
    save.pioneerPackDismissed = false
    localStorage.setItem('terraMinerSave', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss-pioneer-pack.png' })
  // Pioneer pack modal should be visible
  const modal = await page.$('[data-testid="pioneer-pack-modal"]')
  console.assert(modal !== null, 'Pioneer pack modal should be visible on fresh install')
  await browser.close()
})()
```

---

## Sub-Phase 21.3: Analytics Infrastructure

### What
Implement usage analytics, learning effectiveness tracking, conversion funnel tracking, and A/B testing framework. All analytics must be privacy-compliant (GDPR/COPPA). No PII in events. Five learning effectiveness metrics from DD-V2-134.

### Where
- `src/services/analyticsService.ts` — new file
- `server/routes/analytics.ts` — new file
- `server/db/analytics.sql` — new file, schema migrations
- `src/data/analyticsEvents.ts` — new file, typed event catalog

### How
1. Create `src/data/analyticsEvents.ts` defining the 10 critical pre-beta events (DD-V2-181) as a typed union:
   - `first_dive_completed` — { layersReached: number }
   - `first_artifact_revealed` — { rarity: string }
   - `first_quiz_answered` — { correct: boolean }
   - `quiz_gate_passed` — { gateNumber: number, depth: number }
   - `oxygen_depleted` — { lootLostPercent: number, layer: number }
   - `terra_pass_viewed` — { source: 'dome'|'pre_dive'|'oxygen_empty' }
   - `iap_purchase_started` — { productId: string }
   - `iap_purchase_completed` — { productId: string, priceUSD: number }
   - `d7_review_completed` — { streakLength: number }
   - `session_ended` — { durationMs: number, divesCompleted: number, factsLearned: number }

2. Create `src/services/analyticsService.ts` with:
   - `track(event: AnalyticsEvent): void` — queues event, batches to server every 30 seconds
   - `setUserId(anonymousId: string): void` — hashed UUID, never real name or email
   - `flush(): Promise<void>` — force-sends queue (on app background)
   - `setExperimentGroup(experiment: string, group: 'A'|'B'): void` — A/B assignment, stored in localStorage

3. Create `server/routes/analytics.ts` with `POST /api/analytics/events` bulk ingest endpoint. Each event: `{ eventName, properties, anonymousUserId, clientTimestamp, serverTimestamp, appVersion, platform }`. Write to `analytics_events` table.

4. Retention metrics query (runs daily via cron):
   ```sql
   -- D1 retention: users who returned on day 2
   SELECT COUNT(DISTINCT user_id) FILTER (
     WHERE max_day >= 2
   )::float / COUNT(DISTINCT user_id) AS d1_retention
   FROM user_day_activity
   WHERE install_date = CURRENT_DATE - 2;
   ```

5. Learning effectiveness metrics (DD-V2-134) — computed nightly:
   - **Retention rate**: `fact_reviews WHERE correct = true AND reps >= 3` / total reviews = target 90%+
   - **Lapse rate**: SM-2 lapses / total reviews = target < 15%
   - **Daily study rate**: DAU who completed at least one study session / DAU = target 40%+
   - **Facts per serious player**: facts with reps >= 3 per player at D30 = target ~500
   - **Time to mastery**: median days from first_seen to interval_days >= 60 = target 30–90 days

6. A/B test framework: `src/services/analyticsService.ts` `assignExperiment(name, variants, weights)` returns deterministic group from hashed user ID. First experiment: "pioneer_pack_timing" — variant A: show on login day 1, variant B: show on login day 3.

### Acceptance Criteria
- [ ] All 10 critical events fire during a normal play session (verifiable in server logs)
- [ ] Analytics batch sends every 30 seconds and on app background
- [ ] No PII (email, real name, device ID) in any event payload
- [ ] D1/D7/D30 retention queries return results against test data
- [ ] Learning effectiveness metrics compute without error against 522-fact dataset
- [ ] A/B experiment assignment is deterministic (same user always gets same group)
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
  // Capture analytics events from network
  const analyticsRequests = []
  page.on('request', req => {
    if (req.url().includes('/api/analytics/events')) analyticsRequests.push(req.postData())
  })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(35000) // Wait for 30s batch flush + buffer
  console.assert(analyticsRequests.length > 0, 'Analytics events should have been sent')
  await page.screenshot({ path: '/tmp/ss-analytics.png' })
  await browser.close()
})()
```

---

## Sub-Phase 21.4: Oxygen Regeneration UI

### What
Add visible oxygen tank display to dome UI showing current tank count, regen state, and "Ready" vs soft timer label. No anxiety-inducing countdown timers. Display integrates with Terra Pass subscriber state.

### Where
- `src/ui/components/DomeView.svelte` — add tank display to resource bar
- `src/ui/components/OxygenTankDisplay.svelte` — new file, tank icon row
- `src/assets/sprites/icons/icon_tank_full.png`, `icon_tank_empty.png` — new sprites (32px)
- `src/assets/sprites-hires/icons/icon_tank_full.png`, `icon_tank_empty.png` — new sprites (256px)

### How
1. Generate `icon_tank_full.png` and `icon_tank_empty.png` via ComfyUI: "pixel art single oxygen tank, cylindrical with valve, green/cyan, 32x32, transparent background."
2. Create `src/ui/components/OxygenTankDisplay.svelte` showing:
   - Up to 3 tank icons (free) or infinity symbol (subscriber)
   - Filled tanks: full color icon. Empty tanks: desaturated icon.
   - Below icons: if tankBank === maxBank → "Ready" in amber text. If tankBank < maxBank → "Next tank in Xh Ym" in soft gray. NEVER show seconds. NEVER show red color.
3. Add `OxygenTankDisplay` to DomeView resource bar between oxygen percentage and dust count.
4. `data-testid="tank-bank"` attribute on the tank count span for Playwright.
5. Pre-dive modal: show dive cost in tanks ("This dive costs 2 tanks. You have 3.") before confirming.

### Acceptance Criteria
- [ ] Tank icons visible in dome resource bar
- [ ] "Ready" label appears when all tanks are full
- [ ] "Next tank in Xh Ym" appears when tanks are not full (no countdown seconds)
- [ ] Subscriber sees "Unlimited" or infinity icon instead of tank count
- [ ] Pre-dive modal shows tank cost and current balance
- [ ] No red color or urgency framing anywhere in tank UI
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
  await page.waitForSelector('[data-testid="tank-bank"]', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-tank-display.png' })
  const tankText = await page.$eval('[data-testid="tank-bank"]', el => el.textContent)
  console.log('Tank display:', tankText)
  await browser.close()
})()
```

---

## Sub-Phase 21.5: Terra Pass Subscription System

**GATED**: Requires 3,000 approved facts in database AND Phase 19 auth AND Phase 20 App Store/Play Store presence.

### What
Full subscription management UI and RevenueCat integration for Terra Pass ($4.99/month) and Patron tiers ($24.99/season, $49.99/year). Subscription state syncs via backend. Cancel anytime, earned cosmetics retained.

### Where
- `src/ui/components/TerraPassModal.svelte` — new file
- `src/ui/components/rooms/MarketRoom.svelte` — add subscription section
- `server/routes/subscriptions.ts` — new file
- `src/services/subscriptionService.ts` — new file
- `src/data/types.ts` — add `subscription?: SubscriptionRecord` to `PlayerSave`

### How
1. Create `src/services/subscriptionService.ts` wrapping `iapService` for subscription-specific logic:
   - `getCurrentSubscription(): SubscriptionRecord | null`
   - `subscribe(productId: string): Promise<void>`
   - `cancelFlow(): void` — opens platform subscription management (App Store / Play Store)
   - `isSubscriber(): boolean`
2. Create `src/ui/components/TerraPassModal.svelte`:
   - Benefit matrix display (see Terra Pass Benefit Matrix table above)
   - Pricing clearly displayed: "$4.99/month" — no obfuscation
   - "Subscribe" CTA and "Not now" dismiss
   - For active subscribers: shows renewal date, "Manage Subscription" (opens platform settings), "Earned cosmetics are yours to keep" note
   - Facts-gate check: if `factCount < 3000`, show "Coming soon — we're building the content library" instead of subscribe button
3. Create `server/routes/subscriptions.ts`:
   - `POST /api/subscriptions/verify` — RevenueCat webhook handler
   - `GET /api/subscriptions/status` — returns current subscription for authed user
   - `POST /api/subscriptions/record-cosmetic` — records monthly cosmetic grant
4. Monthly cosmetic grant: on subscription renewal, server selects next cosmetic from `monthly_cosmetic_schedule` table and fires push notification via Phase 23 notification system.

### Acceptance Criteria
- [ ] Subscription modal shows "Coming soon" if fact count < 3,000
- [ ] Subscribe button opens native IAP sheet in Capacitor environment
- [ ] Subscriber sees "Unlimited" oxygen tanks after successful subscription
- [ ] Subscription lapse restores maxBank to 3 within next app foreground
- [ ] Earned cosmetics remain unlocked after cancellation (checked via `purchasedProducts` list)
- [ ] Backend rejects subscription verify calls with invalid RevenueCat signatures
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
  // Navigate to Market room and open Terra Pass
  await page.click('[data-testid="room-tab-market"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="terra-pass-open"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-terra-pass.png' })
  const modal = await page.$('[data-testid="terra-pass-modal"]')
  console.assert(modal !== null, 'Terra Pass modal should be visible')
  await browser.close()
})()
```

---

## Sub-Phase 21.6: Ad-Free Policy Implementation (DD-V2-146)

### What
Formally implement and document the ad-free policy. Ensure no ad SDK is included in the build, add policy notice to app store listing copy, and implement the opt-in rewarded ad stub (disabled at launch, activatable via feature flag if needed).

### Where
- `src/services/adService.ts` — new file (stub only, feature-flagged off)
- `server/config/features.ts` — feature flags
- Store listing copy: `docs/store/APP_STORE_LISTING.md` (new file, documentation)

### How
1. Create `src/services/adService.ts` as a complete stub:
   ```typescript
   // Opt-in rewarded ads — disabled at launch. Feature flag: FEATURE_REWARDED_ADS
   export async function showRewardedAd(): Promise<{ rewarded: boolean }> {
     if (!FEATURES.REWARDED_ADS) return { rewarded: false }
     // RevenueCat or AdMob integration would go here
     return { rewarded: false }
   }
   ```
2. Add `FEATURE_REWARDED_ADS: false` to `server/config/features.ts` and ensure the feature flag is checked server-side before any ad endpoint is exposed.
3. Verify no ad SDK packages in `package.json`. Add `ads` to `.npmrc` blocklist comment as documentation.
4. Add policy text to `docs/store/APP_STORE_LISTING.md`: "No ads. Recall Rogue is completely ad-free. Our educational mission requires a distraction-free experience. If we ever add optional ads, they will be: opt-in only, rewarded only, and never shown during gameplay or quizzes."

### Acceptance Criteria
- [ ] `grep -r 'AdMob\|admob\|advertisement\|ad_unit' src/` returns no results
- [ ] `adService.showRewardedAd()` returns `{ rewarded: false }` in all environments
- [ ] Feature flag `FEATURE_REWARDED_ADS` is `false` in all environment configs
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.7: Knowledge Never Paywalled (DD-V2-147)

### What
Audit the entire codebase for any code paths that gate facts, Data Discs, or quiz content behind payment. Replace any such gates with cosmetic-only alternatives. Add "Data Disc Radar" consumable and cosmetic Data Disc skins as the paid alternatives.

### Where
- `src/data/dataDiscs.ts` — remove any price fields; add `cosmeticSkin?: string`
- `src/ui/components/rooms/MarketRoom.svelte` — replace "Buy Data Disc" with "Buy Data Disc Radar" and cosmetic skins
- `src/data/iapCatalog.ts` — add Radar consumable product
- `src/services/saveService.ts` — add `dataDiscRadarCharges: number` to `PlayerSave`

### How
1. Grep for any `price` or `purchaseRequired` fields in `src/data/dataDiscs.ts` and remove.
2. Add `DataDiscRadar` consumable: when active (3-dive duration), Data Disc drop rate increases by 3×. Tracked in `PlayerSave.dataDiscRadarCharges`.
3. Add 3 cosmetic Data Disc skins to `iapCatalog.ts`: "Holographic Disc" ($0.99), "Ancient Stone Tablet Disc" ($0.99), "Crystal Data Core Disc" ($1.99). These change the visual of any Data Disc found, not its content.
4. Update `MarketRoom.svelte`: remove any "purchase disc" buttons; add "Data Disc Radar (3 dives) — $0.99" and skin options.
5. Add automated test: `grep -r 'dataDisc.*price\|paywall.*fact\|fact.*paywall' src/` must return 0 results.

### Acceptance Criteria
- [ ] All facts accessible to all players without any payment
- [ ] Data Disc Radar consumable purchasable and functional
- [ ] Cosmetic disc skins purchasable and apply visual change only
- [ ] Zero code paths gate quiz content behind payment
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.8: Cosmetic Pricing Tiers (DD-V2-148)

### What
Implement the full cosmetic catalog with correct pricing tiers. All pricing in direct USD. Implement bundle pricing (3 thematically related cosmetics at 20% discount). Milestone-unlocked free cosmetics established.

### Where
- `src/data/iapCatalog.ts` — full cosmetic catalog
- `src/ui/components/rooms/MarketRoom.svelte` — organized cosmetic shop UI
- `src/data/milestoneCosmetics.ts` — new file, free milestone cosmetics

### How
1. Expand `src/data/iapCatalog.ts` with full cosmetic catalog per the IAP Product IDs table.
2. Tier display in `MarketRoom.svelte`:
   - Animated tier (most prominent position, highlighted border): animated pickaxe skins, dome themes
   - Static tier: helmet skins, suit colors
   - Pet skins section
   - GAIA skins section
   - Bundles section (auto-apply 20% discount calculation displayed)
3. Create `src/data/milestoneCosmetics.ts`:
   - "Dust Collector" helmet: unlocked at 1,000 total dust earned
   - "Stone Breaker" pickaxe skin: unlocked at 100 blocks mined
   - "First Contact" dome badge: unlocked at first artifact
   - "Scholar" GAIA dialogue set: unlocked at 50 facts learned
4. Milestone cosmetics display in the same shop with "FREE — Earned at X" label.

### Acceptance Criteria
- [ ] All animated cosmetics priced $2.99–$4.99
- [ ] All static cosmetics priced $0.99–$1.99
- [ ] Bundle pricing correctly shows 20% discount (e.g., 3 × $1.99 = $5.97 → bundle $4.77)
- [ ] At least 4 milestone-unlocked free cosmetics visible in shop
- [ ] No premium currency anywhere in pricing flow
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.9: Season Pass — Knowledge Expedition (DD-V2-149)

### What
Implement the "Knowledge Expedition" season pass system. 8–12 week seasons, $4.99 premium track. Free track contains all educational content. Premium track is cosmetics only. No FOMO: earned rewards never expire.

### Where
- `src/data/seasonPass.ts` — new file, season definition and reward track schema
- `src/ui/components/SeasonPassView.svelte` — new file
- `src/ui/components/rooms/MarketRoom.svelte` — add Season Pass tab
- `server/routes/seasonPass.ts` — new file
- `src/data/types.ts` — add `seasonPassProgress: SeasonPassProgress` to `PlayerSave`

### How
1. Create `src/data/seasonPass.ts` with `SeasonDefinition` type (id, name, theme, startDate, endDate, freeTrack[], premiumTrack[]).
2. Define Season 1 "Deep Time" using the reward tracks in this document.
3. Progress computed from: facts learned (1pt), fossils found (5pt), dives completed (2pt). Store in `PlayerSave.seasonPassProgress.points`.
4. Create `src/ui/components/SeasonPassView.svelte`:
   - Two-column layout: Free Track (left) + Premium Track (right)
   - Progress bar across top
   - Milestone nodes with lock icons (premium) or checkmarks (earned)
   - "Upgrade to Premium — $4.99" button on premium column header
   - "No FOMO — rewards never expire" label
5. Add Season Pass tab in `MarketRoom.svelte`.
6. Backend `server/routes/seasonPass.ts`: `GET /api/season/current` returns season metadata + player progress.

### Acceptance Criteria
- [ ] Season Pass view shows both free and premium tracks
- [ ] Progress bar updates when facts are learned (live in session)
- [ ] Free track rewards claimable without purchase
- [ ] Premium track rewards locked behind purchase (shows IAP sheet on claim attempt)
- [ ] Earned rewards remain in `PlayerSave` after season end (never deleted)
- [ ] Seasonal facts added to permanent free fact pool at season end (backend migration script)
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.10: Pioneer Pack

### What
Pioneer Pack modal and purchase flow. One-time offer, first 7 days after install. Pioneer badge permanently visible on profile. See Pioneer Pack Contents section above.

### Where
- `src/ui/components/PioneerPackModal.svelte` — (scaffolded in 21.2, fully implemented here)
- `src/data/types.ts` — `installDate`, `hasPioneerPack`, `pioneerPackDismissed`

### How
(Detailed in 21.2 above. This sub-phase focuses on full polish: animations, GAIA commentary, and Playwright verification.)

1. Animate pioneer pack open: gacha-reveal animation for Pioneer's Pickaxe (spin → glow → settle).
2. GAIA dialogue on pack open: "Oh, you're going all-in from day one! I knew I liked you, [player]. Pioneer spirit detected."
3. Pioneer badge on player profile card visible to hub visitors.
4. Verify `installDate + 7 days` expiry is enforced server-side (not just client-side) to prevent clock manipulation.

### Acceptance Criteria
- [ ] Pack modal visible within first 7 days, gone after day 8
- [ ] Pioneer's Pickaxe skin unlocked and equippable after purchase
- [ ] Pioneer badge visible on profile
- [ ] Gacha reveal animation plays on purchase
- [ ] GAIA dialogue fires with pack open
- [ ] Server validates 7-day window independently of client clock
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.11: Patron Tier

### What
Implement Expedition Patron ($24.99/season) and Grand Patron ($49.99/year) products. Patron nameplate, GAIA dialogue set, dome floor theme, Patron Wall in Archive room. Physical sticker pack integration (external print-on-demand).

### Where
- `src/ui/components/rooms/ArchiveRoom.svelte` — add Patron Wall
- `src/ui/components/TerraPassModal.svelte` — add Patron tier section
- `server/routes/patrons.ts` — new file, Patron wall data endpoint
- `src/data/types.ts` — add `patronTier?: 'expedition'|'grand'` to `PlayerSave`

### How
1. Add Patron tier section to `TerraPassModal.svelte` below Terra Pass section. Two cards: Expedition Patron + Grand Patron. Each shows clear bullet list of benefits.
2. Grand Patron shipping flow: after purchase, server collects shipping address via a secure web form (separate from game — link to `https://terragacha.com/patron-shipping`). Print-on-demand fulfilled via Printful API (external service; no game code required).
3. Patron Wall in `ArchiveRoom.svelte`: scrollable list of patron display names. Data from `GET /api/patrons/wall`. Names opt-in only (set at purchase on the patron shipping form).
4. "Patron" nameplate: add `patronBadge: string | null` to `PlayerSave`, displayed on leaderboard entries.

### Acceptance Criteria
- [ ] Both Patron products visible in Terra Pass modal
- [ ] Patron nameplate shows on leaderboard entries for patrons
- [ ] Patron Wall in Archive room displays opted-in patron names
- [ ] GAIA exclusive dialogue set activates for Patron subscribers
- [ ] Scholar's Hall dome floor theme unlocks for Patron subscribers
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.12: Economy Rebalance (DD-V2-151)

### What
Remove mineral decay mechanic. Add dome maintenance costs, spending bonus thresholds, and gold-tier aspirational sinks. Validate economy against Phase 8.14 balance simulation.

### Where
- `src/data/balance.ts` — remove decay constants, add maintenance + spending bonus constants
- `src/services/saveService.ts` — remove `applyMineralDecay()`, add `applyWeeklyMaintenance()`, `checkSpendingBonus()`
- `src/ui/components/rooms/CommandRoom.svelte` — add maintenance cost display
- `src/data/types.ts` — add `weeklyDustSpent`, `lastMaintenanceDate`, `spendingBonusActive` to `PlayerSave`

### How
1. In `src/data/balance.ts`:
   - Delete: `MINERAL_DECAY_THRESHOLD`, `MINERAL_DECAY_RATE`
   - Add: `DOME_MAINTENANCE_BASE_DUST = 50`, `SPENDING_BONUS_THRESHOLD = 500`, `SPENDING_BONUS_YIELD_MULTIPLIER = 1.1`
2. In `src/services/saveService.ts`:
   - Delete `applyMineralDecay()` and all call sites
   - Add `applyWeeklyMaintenance(save: PlayerSave): PlayerSave` — charges maintenance on Monday 00:00 UTC if save has `lastMaintenanceDate` older than 7 days
   - Add `checkSpendingBonus(save: PlayerSave): PlayerSave` — sets `spendingBonusActive = true` when `weeklyDustSpent >= 500`
3. In `CommandRoom.svelte`: add "Dome Upkeep" display showing current weekly maintenance cost and days until next assessment.
4. Add gold-tier items to `MarketRoom.svelte`: Obsidian Throne (50,000 dust), Primordial GAIA Core (30,000 dust + 100 essence), Eternal Patron Plaque (20,000 dust).

### Acceptance Criteria
- [ ] No mineral decay occurs on any test save
- [ ] Weekly maintenance charges correct amount based on room count formula
- [ ] Spending bonus activates when 500 dust spent in a week
- [ ] +10% yield active during the week after spending bonus triggers
- [ ] Gold-tier items visible in Market room at correct prices
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.13: Mastery-Free Play Monitoring (DD-V2-152)

### What
Server-side analytics query and dashboard for mastery-free vs subscriber segmentation. Internal-only, never player-visible. Monthly review cadence.

### Where
- `server/analytics/playerSegments.ts` — new file, segmentation logic
- `server/routes/admin.ts` — add segment report endpoint (admin-only, JWT role check)

### How
1. Create `server/analytics/playerSegments.ts` with `computePlayerSegments(cohortDate: Date)` function implementing the SQL query in the Mastery-Free Monitoring Thresholds section above.
2. Segment assignment runs nightly via cron at 02:00 UTC.
3. Add `GET /api/admin/segments/monthly` to `server/routes/admin.ts` — requires `role: 'admin'` JWT claim.
4. Response format: `{ mastereyFreeCount, subscriberCount, inactiveCount, totalD30Active, masterFreePercent, threshold: 30, status: 'ok'|'review'|'tighten' }`.
5. Set up cron in `server/cron.ts`: `0 2 1 * *` (1st of each month) → emit `economy_mastery_segment_snapshot` analytics event with the monthly snapshot.

### Acceptance Criteria
- [ ] Admin endpoint returns segmentation data when called with admin JWT
- [ ] Non-admin JWT receives 403
- [ ] Segmentation cron runs without error against empty analytics database
- [ ] `status: 'review'` returned when masterFreePercent >= 30
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.14: Content Volume Gate (DD-V2-154)

### What
Enforce the 3,000-fact minimum before subscription products activate. Server-side gate in subscription endpoint. Client-side "Coming soon" state in Terra Pass modal.

### Where
- `server/routes/subscriptions.ts` — fact count gate (already specified in 21.5)
- `src/ui/components/TerraPassModal.svelte` — "Coming soon" state
- `server/scripts/fact-count-check.ts` — utility script for operators

### How
1. Subscription verify endpoint: fact count checked on every `POST /api/subscriptions/verify` — if < 3,000, return 503 with `{ error: 'subscription_not_yet_available', factsReady: N, required: 3000 }`.
2. Client fetches `GET /api/subscriptions/status` on Terra Pass modal open. If response includes `{ available: false, factsReady: N }`, show: "Terra Pass is coming soon — we're building the content library. X facts ready, 3,000 needed."
3. Create `server/scripts/fact-count-check.ts`: `npx ts-node server/scripts/fact-count-check.ts` prints current approved fact count and days at current velocity until gate clears.

### Acceptance Criteria
- [ ] Subscribe button replaced with "Coming soon" text when fact count < 3,000
- [ ] Backend returns 503 for subscription verify when fact count < 3,000
- [ ] Fact count script runs successfully and outputs count
- [ ] `npm run typecheck` passes

---

## Sub-Phase 21.15: Retention Targets Dashboard (DD-V2-155)

### What
Build admin retention dashboard tracking D1/D7/D30 targets: D1=45%, D7=20%, D30=10%. D7 is primary success metric.

### Where
- `server/analytics/retention.ts` — new file
- `server/routes/admin.ts` — add retention endpoint

### How
1. Create `server/analytics/retention.ts` with `computeRetention(cohortDate: Date): RetentionReport` implementing D1/D7/D30 queries.
2. Add `GET /api/admin/retention` returning:
   ```json
   {
     "d1": { "target": 0.45, "actual": 0.42, "status": "below" },
     "d7": { "target": 0.20, "actual": 0.18, "status": "below", "isPrimaryMetric": true },
     "d30": { "target": 0.10, "actual": null, "status": "insufficient_data" }
   }
   ```
3. D7 status `"below"` triggers dashboard alert color (red). `"at"` or `"above"` shows green. Displayed as table in admin web panel.

### Acceptance Criteria
- [ ] Retention endpoint returns correct format
- [ ] D7 flagged as primary metric in response
- [ ] Cohort-based queries work against analytics_events table
- [ ] `npm run typecheck` passes

---

## Verification Gate

Before Phase 21 is considered complete:

1. `npm run typecheck` — zero errors
2. `npm run build` — clean build, no bundle warnings about undefined exports
3. Economy smoke test: create a test save, run 20 simulated dives, verify no negative mineral events, maintenance costs apply correctly, spending bonus triggers at 500 dust spent.
4. IAP stub smoke test: call `iapService.purchaseProduct('com.terragacha.pioneerpack')` in browser dev mode — verify graceful `{ success: false, error: 'iap_not_available' }` response, no crash.
5. Analytics smoke test: complete one dive session, verify at minimum `first_dive_completed` and `session_ended` events reach server (check server logs).
6. Oxygen regen smoke test: set `lastRegenAt = Date.now() - 10_800_000` (3 hours), reload page, verify `tankBank === 3`.
7. Fact gate smoke test: with 522 facts in DB, call `POST /api/subscriptions/verify` — verify 503 response.
8. Playwright screenshots pass visual inspection: no broken layouts, tank display visible in dome, Pioneer Pack modal visible on fresh save.

---

## Files Affected

### New Files
- `src/services/oxygenRegenService.ts`
- `src/services/iapService.ts`
- `src/services/subscriptionService.ts`
- `src/services/analyticsService.ts`
- `src/services/adService.ts`
- `src/ui/components/OxygenTankDisplay.svelte`
- `src/ui/components/PioneerPackModal.svelte`
- `src/ui/components/TerraPassModal.svelte`
- `src/ui/components/SeasonPassView.svelte`
- `src/data/iapCatalog.ts`
- `src/data/analyticsEvents.ts`
- `src/data/seasonPass.ts`
- `src/data/milestoneCosmetics.ts`
- `src/assets/sprites/icons/icon_tank_full.png`
- `src/assets/sprites/icons/icon_tank_empty.png`
- `src/assets/sprites-hires/icons/icon_tank_full.png`
- `src/assets/sprites-hires/icons/icon_tank_empty.png`
- `server/routes/iap.ts`
- `server/routes/subscriptions.ts`
- `server/routes/seasonPass.ts`
- `server/routes/patrons.ts`
- `server/analytics/retention.ts`
- `server/analytics/playerSegments.ts`
- `server/scripts/fact-count-check.ts`
- `docs/store/APP_STORE_LISTING.md`

### Modified Files
- `src/data/types.ts` — PlayerSave additions: `lastRegenAt`, `tankBank`, `installDate`, `hasPioneerPack`, `pioneerPackDismissed`, `purchasedProducts`, `subscription`, `seasonPassProgress`, `weeklyDustSpent`, `lastMaintenanceDate`, `spendingBonusActive`, `patronTier`, `patronBadge`
- `src/data/balance.ts` — remove decay constants, add maintenance + regen constants
- `src/services/saveService.ts` — remove decay, add maintenance + spending bonus
- `src/ui/components/DomeView.svelte` — add `OxygenTankDisplay`
- `src/ui/components/rooms/MarketRoom.svelte` — full cosmetic shop + IAP + season pass tab
- `src/ui/components/rooms/ArchiveRoom.svelte` — Patron Wall
- `src/ui/components/rooms/CommandRoom.svelte` — dome maintenance display
- `src/game/GameManager.ts` — pre-dive oxygen tank validation
- `server/routes/admin.ts` — retention + segment endpoints
