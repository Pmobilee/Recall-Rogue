# AR-14: Soft Launch & Analytics
> Phase: Post-Launch — Market Testing
> Priority: HIGH
> Depends on: AR-13 (Launch Readiness), AR-12 (Cloud Save)
> Estimated scope: M

App is ready to ship. This phase handles soft launch to a limited market (Malaysia or via invite link), sets up analytics instrumentation, and establishes feedback loops. Measure retention, progression, and user sentiment. Run initial A/B tests to validate balance and design decisions.

## Design Reference

From GAME_DESIGN.md Section 33 (Soft Launch Strategy):

> Release to limited audience (Malaysia region, or via invite link). Measure D1/D7/D30 retention, progression metrics, session length. A/B test: Slow Reader on/off, 3 AP vs 4 AP, deck size 15 vs 18. Collect feedback weekly.

From GAME_DESIGN.md Section 34 (Analytics Events):

> Track 10 critical funnels: onboarding completion, first run completion, D1 return, domain selection choices, cash-out decisions, death points (where do players quit?), Tier 2 card first seen, bounty completion, session length, share button usage.

## Implementation

### Sub-task 1: Analytics Instrumentation

Create analytics service to track 10 key events:

```typescript
// In src/services/analyticsService.ts

export type AnalyticsEvent =
  | 'app_launch'
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'run_start'
  | 'run_complete'
  | 'run_death'
  | 'encounter_start'
  | 'card_play'
  | 'answer_correct'
  | 'answer_incorrect'
  | 'domain_select'
  | 'cash_out'
  | 'card_reward'
  | 'card_type_selected'
  | 'shop_visit'
  | 'bounty_complete'
  | 'tier_upgrade'  // Player's first Tier 2 card
  | 'streak_milestone'
  | 'share_button'
  | 'settings_change'
  | 'account_created';

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  userId: string;  // deviceId or accountId
  sessionId: string;
  timestamp: string;  // ISO
  properties?: Record<string, any>;  // Context-specific data
}

export class AnalyticsService {
  private sessionId: string;
  private userId: string;
  private eventQueue: AnalyticsPayload[] = [];
  private flushInterval = 30000;  // 30 seconds

  constructor(userId: string) {
    this.userId = userId;
    this.sessionId = generateId();
    this.startAutoFlush();
  }

  track(event: AnalyticsEvent, properties?: Record<string, any>): void {
    const payload: AnalyticsPayload = {
      event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      properties,
    };

    this.eventQueue.push(payload);

    // If queue gets too large, flush immediately
    if (this.eventQueue.length >= 50) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0);  // Swap out queue

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });

      console.log(`Flushed ${events.length} analytics events`);
    } catch (error) {
      console.warn('Failed to send analytics:', error);
      // Re-queue on failure
      this.eventQueue.unshift(...events);
    }
  }

  private startAutoFlush(): void {
    setInterval(() => this.flush(), this.flushInterval);
  }

  // Convenience methods for common events

  onOnboardingComplete(difficulty: string): void {
    this.track('onboarding_complete', { difficulty });
  }

  onRunStart(domain: string, difficulty: string): void {
    this.track('run_start', { domain, difficulty });
  }

  onRunComplete(
    floorReached: number,
    runLength: number,
    accuracy: number,
    cardsCollected: number
  ): void {
    this.track('run_complete', {
      floorReached,
      runLength,
      accuracy,
      cardsCollected,
    });
  }

  onRunDeath(floor: number, cause: string): void {
    this.track('run_death', { floor, cause });  // cause: 'enemy' | 'timeout' | 'forfeited'
  }

  onCardTypeSelected(type: string): void {
    this.track('card_type_selected', { cardType: type });
  }

  onDomainSelect(primary: string, secondary: string): void {
    this.track('domain_select', { primary, secondary });
  }

  onCashOut(floor: number, gold: number): void {
    this.track('cash_out', { floor, goldEarned: gold });
  }

  onTierUpgrade(factId: string, oldTier: string, newTier: string): void {
    this.track('tier_upgrade', { factId, oldTier, newTier });
  }

  onShareButton(runId: string): void {
    this.track('share_button', { runId });
  }

  onBountyComplete(bountyId: string, reward: number): void {
    this.track('bounty_complete', { bountyId, goldReward: reward });
  }

  onAccountCreated(email: string): void {
    this.track('account_created', { email });
  }
}
```

### Sub-task 2: Backend Analytics Endpoint

```typescript
// In backend/src/routes/analytics.ts

import { FastifyInstance } from 'fastify';

export async function setupAnalyticsRoute(app: FastifyInstance) {
  // POST /api/analytics/events — Ingest events
  app.post<{ Body: { events: AnalyticsPayload[] } }>(
    '/api/analytics/events',
    async (request, reply) => {
      const { events } = request.body;

      if (!events || events.length === 0) {
        return reply.code(400).send({ error: 'No events provided' });
      }

      try {
        // Insert events into analytics table
        for (const event of events) {
          await db.query(
            `INSERT INTO analytics_events (event_type, user_id, session_id, timestamp, properties)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              event.event,
              event.userId,
              event.sessionId,
              event.timestamp,
              JSON.stringify(event.properties || {}),
            ]
          );
        }

        return reply.code(200).send({ success: true, recorded: events.length });
      } catch (error) {
        console.error('Error recording analytics:', error);
        return reply.code(500).send({ error: 'Failed to record events' });
      }
    }
  );

  // GET /api/analytics/dashboard — Query dashboard data
  app.get<{ Querystring: { startDate: string; endDate: string } }>(
    '/api/analytics/dashboard',
    async (request, reply) => {
      const { startDate, endDate } = request.query;

      try {
        // Get key metrics
        const result = await db.query(
          `SELECT
            event_type,
            COUNT(*) as count,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT session_id) as unique_sessions
           FROM analytics_events
           WHERE timestamp >= $1 AND timestamp < $2
           GROUP BY event_type
           ORDER BY count DESC`,
          [startDate, endDate]
        );

        return reply.code(200).send({ metrics: result.rows });
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        return reply.code(500).send({ error: 'Failed to fetch dashboard' });
      }
    }
  );

  // GET /api/analytics/retention — D1/D7/D30 cohort analysis
  app.get<{ Querystring: { cohortDate: string } }>(
    '/api/analytics/retention',
    async (request, reply) => {
      const { cohortDate } = request.query;

      try {
        const result = await db.query(
          `SELECT
            DATE(created_at) as cohort_day,
            DATEDIFF(DAY, created_at, last_active) as days_since_install,
            COUNT(*) as user_count
           FROM users
           WHERE DATE(created_at) = $1
           GROUP BY cohort_day, DATEDIFF(DAY, created_at, last_active)
           ORDER BY days_since_install`,
          [cohortDate]
        );

        // Calculate retention percentages
        const totalUsers = result.rows.reduce((sum, r) => sum + r.user_count, 0);
        const retention = result.rows.map(r => ({
          day: r.days_since_install,
          count: r.user_count,
          percentage: (r.user_count / totalUsers) * 100,
        }));

        return reply.code(200).send({ retention });
      } catch (error) {
        console.error('Error fetching retention:', error);
        return reply.code(500).send({ error: 'Failed to fetch retention' });
      }
    }
  );
}
```

### Sub-task 3: Integration in Client

Wire analytics into key game flows:

```typescript
// In src/services/gameFlowController.ts

export class GameFlowController {
  private analytics: AnalyticsService;

  constructor(userId: string) {
    this.analytics = new AnalyticsService(userId);
  }

  async startRun(domain: string, difficulty: string): Promise<void> {
    this.analytics.onRunStart(domain, difficulty);
    // ... rest of run start logic
  }

  async completeRun(runState: CardRunState): Promise<void> {
    const { floorReached, encountersCompleted, correctAnswers, incorrectAnswers, cardsCollected } = runState;
    const accuracy = correctAnswers / (correctAnswers + incorrectAnswers);

    this.analytics.onRunComplete(floorReached, encountersCompleted, accuracy, cardsCollected.length);
    // ... rest of run completion logic
  }

  async endRun(floor: number, cause: 'enemy' | 'timeout' | 'forfeited'): Promise<void> {
    this.analytics.onRunDeath(floor, cause);
    // ... rest of run end logic
  }

  selectCardType(type: string): void {
    this.analytics.onCardTypeSelected(type);
  }

  selectDomain(primary: string, secondary: string): void {
    this.analytics.onDomainSelect(primary, secondary);
  }

  cashOut(floor: number, gold: number): void {
    this.analytics.onCashOut(floor, gold);
  }
}
```

### Sub-task 4: A/B Test Framework

Implement a/b test system using feature flags:

```typescript
// In src/services/experimentService.ts

export type ExperimentKey =
  | 'slow_reader_default'
  | 'starting_ap_3_vs_4'
  | 'starter_deck_15_vs_18'
  | 'combo_multiplier_2x_vs_3x'
  | 'shop_gold_prices_low_vs_high';

export interface ExperimentVariant {
  key: ExperimentKey;
  group: 'control' | 'test';
  value: any;
}

export class ExperimentService {
  private userId: string;
  private variants: Map<ExperimentKey, ExperimentVariant> = new Map();

  constructor(userId: string) {
    this.userId = userId;
    this.initializeExperiments();
  }

  private initializeExperiments(): void {
    // Assign variants based on user ID hash
    const hash = hashUserId(this.userId);

    // Experiment 1: Slow Reader default
    this.variants.set('slow_reader_default', {
      key: 'slow_reader_default',
      group: hash % 2 === 0 ? 'control' : 'test',
      value: hash % 2 === 0 ? false : true,  // Control: off, Test: on
    });

    // Experiment 2: Starting AP (3 vs 4)
    this.variants.set('starting_ap_3_vs_4', {
      key: 'starting_ap_3_vs_4',
      group: hash % 2 === 0 ? 'control' : 'test',
      value: hash % 2 === 0 ? 3 : 4,
    });

    // Experiment 3: Starter deck size (15 vs 18 cards)
    this.variants.set('starter_deck_15_vs_18', {
      key: 'starter_deck_15_vs_18',
      group: (hash >> 2) % 2 === 0 ? 'control' : 'test',
      value: (hash >> 2) % 2 === 0 ? 15 : 18,
    });
  }

  getVariant(key: ExperimentKey): ExperimentVariant {
    return this.variants.get(key)!;
  }

  getVariantValue(key: ExperimentKey): any {
    return this.variants.get(key)?.value;
  }

  logExposure(key: ExperimentKey): void {
    const variant = this.variants.get(key);
    console.log(`Exposed to ${key}: ${variant?.group}`);
    // Send to analytics
  }
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;  // Convert to 32-bit
  }
  return Math.abs(hash);
}
```

Usage:

```typescript
// In gameFlowController

const experimentService = new ExperimentService(userId);

// Experiment 1: Slow Reader default
const slowReaderDefault = experimentService.getVariantValue('slow_reader_default');
profile.isSlowReader = slowReaderDefault;

// Experiment 2: Starting AP
const startingAP = experimentService.getVariantValue('starting_ap_3_vs_4');
const encounterAP = startingAP;  // Use in first encounter

// Experiment 3: Starter deck size
const deckSize = experimentService.getVariantValue('starter_deck_15_vs_18');
const starterDeck = createStarterDeck(facts, deckSize);
```

### Sub-task 5: Soft Launch Distribution

#### Malaysia Region (Web)

Add geo-targeting via Vercel analytics:

```typescript
// In middleware or Vercel Edge Config

import { geolocation } from '@vercel/edge';

export async function middleware(request: Request) {
  const { country } = geolocation(request);

  if (country !== 'MY' && process.env.SOFT_LAUNCH_REGION === 'MY') {
    // Return 403 or friendly message
    return new Response('App not yet available in your region', { status: 403 });
  }

  return NextResponse.next();
}
```

Or simpler: distribute via **invite link** that bypasses region check.

#### Invite Link Mechanism

Generate short invite codes (e.g., `ARCANE2024`) that pre-register device:

```typescript
// Backend endpoint

app.post<{ Body: { inviteCode: string } }>(
  '/api/invite/validate',
  async (request, reply) => {
    const { inviteCode } = request.body;

    const result = await db.query(
      `SELECT * FROM invite_codes WHERE code = $1 AND used_count < max_uses`,
      [inviteCode.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid or exhausted invite code' });
    }

    // Increment usage
    await db.query(
      `UPDATE invite_codes SET used_count = used_count + 1 WHERE code = $1`,
      [inviteCode]
    );

    return reply.code(200).send({ valid: true });
  }
);
```

### Sub-task 6: Feedback Collection

Add "Send Feedback" button in Settings:

```svelte
<!-- src/ui/components/FeedbackButton.svelte -->
<script>
  let showForm = false;
  let feedbackText = '';
  let sending = false;

  async function submitFeedback() {
    if (!feedbackText.trim()) return;

    sending = true;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getPlayerProfile().deviceId,
          feedback: feedbackText,
          timestamp: new Date().toISOString(),
        }),
      });

      feedbackText = '';
      showForm = false;
      alert('Thank you for your feedback!');
    } catch (error) {
      alert('Failed to send feedback');
    } finally {
      sending = false;
    }
  }
</script>

<div class="feedback-section">
  <button on:click={() => showForm = !showForm}>
    💬 Send Feedback
  </button>

  {#if showForm}
    <div class="feedback-form">
      <textarea
        bind:value={feedbackText}
        placeholder="What would you like us to know? (bugs, ideas, balance issues...)"
        disabled={sending}
      />
      <div class="actions">
        <button on:click={submitFeedback} disabled={!feedbackText.trim() || sending}>
          {sending ? 'Sending...' : 'Submit'}
        </button>
        <button on:click={() => showForm = false}>Cancel</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .feedback-section {
    padding: 12dp;
  }

  .feedback-form {
    margin-top: 8dp;
  }

  textarea {
    width: 100%;
    min-height: 100dp;
    padding: 8dp;
    border: 1px solid #666;
    border-radius: 4dp;
    font-family: system-ui;
    font-size: 14dp;
  }

  .actions {
    display: flex;
    gap: 8dp;
    margin-top: 8dp;
  }

  button {
    padding: 8dp 16dp;
    border-radius: 4dp;
  }
</style>
```

### Sub-task 7: Weekly Analytics Dashboard

Create a simple dashboard (Google Sheets or Metabase) to review weekly:

```
Week of Mar 09:
- New Users: 250
- D1 Retention: 38%
- D7 Retention: 12%
- Avg Session: 18 min
- Avg Run Floor: 4.2

Top 5 Events:
1. onboarding_complete: 250
2. run_start: 2100
3. answer_incorrect: 15400
4. answer_correct: 9800
5. cash_out: 150

A/B Test Results:
- slow_reader_default: No significant difference
- starting_ap_3_vs_4: 4 AP shows +5% retention
- starter_deck_15_vs_18: 18 cards shows -3% retention

Top User Feedback:
- "Enemies too hard on floor 3"
- "Love the knowledge library!"
- "Timer is too short"
```

### Sub-task 8: Weekly Review Process

Schedule weekly meetings (owner + team):

1. **Review metrics:** D1/D7/D30 retention, session length, progression bottlenecks
2. **Analyze feedback:** Common themes, bug reports, feature requests
3. **Check A/B tests:** Statistical significance? Decide: ship, iterate, or revert
4. **Balance changes:** Adjust enemy health, AP, timer based on data
5. **Content:** Generate new facts for high-drop domains
6. **Next week:** Set 1-2 priorities based on data

## System Interactions

- **Analytics:** Integrated throughout game (all AR phases touch analytics)
- **Experiments:** Feature flags stored in profile, used at game start
- **Feedback:** Independent, doesn't affect gameplay
- **Soft launch:** Controlled distribution (region or invite code)

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User plays offline, comes online | Events batched and flushed on next online window |
| Network fails mid-flush | Events re-queued, retry next flush interval |
| User disables analytics in settings | No events sent, but local tracking continues (for seed data) |
| Event queue exceeds 50 items | Immediate flush (don't wait for timer) |
| User ID changes (logout/relogin) | New AnalyticsService instance, new session ID |
| Experiment variant expires | Fallback to control group |
| Invite code exhausted | Return 401, user cannot access app |
| Feedback submission fails | Alert user, preserve text, retry on next attempt |
| Week 1 data shows 80%+ churn | Address critical issues before proceeding. Consider pausing expansion. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/analyticsService.ts` | Core analytics tracking |
| Create | `src/services/experimentService.ts` | A/B test variant assignment |
| Create | `src/ui/components/FeedbackButton.svelte` | Feedback form UI |
| Modify | `src/services/gameFlowController.ts` | Integrate analytics calls throughout flows |
| Modify | `backend/src/routes/analytics.ts` | Analytics endpoints (ingest, dashboard, retention) |
| Create | `backend/src/routes/invite.ts` | Invite code validation |
| Create | `backend/src/routes/feedback.ts` | Feedback submission endpoint |
| Modify | `backend/src/schema/database.sql` | Add analytics_events, invite_codes, feedback tables |
| Create | `vercel.json` (or middleware) | Geo-targeting for soft launch |
| Modify | `src/ui/screens/SettingsMenu.svelte` | Add feedback button |
| Create | `docs/SOFT_LAUNCH_GUIDE.md` | Instructions for soft launch |
| Create | `docs/ANALYTICS_EVENTS.md` | Complete event schema reference |

## Done When

- [ ] AnalyticsService tracks all 10+ events
- [ ] Events batch and flush every 30s or at 50 items
- [ ] Backend /api/analytics/events receives events
- [ ] Dashboard endpoint /api/analytics/dashboard queries by date range
- [ ] Retention endpoint /api/analytics/retention calculates D1/D7/D30
- [ ] A/B experiments: slow_reader, ap_3_vs_4, deck_15_vs_18 all implemented
- [ ] Experiment variants assigned consistently per user (hash-based)
- [ ] Soft launch geo-targeted (Malaysia) or invite code protected
- [ ] Feedback form integrated in Settings
- [ ] Weekly analytics review checklist documented
- [ ] Dashboard created (Sheets or Metabase) and populated
- [ ] First week results analyzed and decisions made
- [ ] A/B test framework proven with ≥1 test running
- [ ] User feedback collected and triaged
- [ ] Balance adjustments made based on data (if needed)
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
