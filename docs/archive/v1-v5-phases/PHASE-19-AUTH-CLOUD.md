# Phase 19: Auth & Cloud System

**Status**: Planned
**Goal**: Ship authentication UI, cloud save sync, production infrastructure, offline reliability, legal compliance, multiple player profiles, and analytics instrumentation — all as prerequisites before any beta user touches the game.
**Design Decisions**: DD-V2-093, DD-V2-136, DD-V2-177, DD-V2-181

---

## Overview

Phase 19 hardens Recall Rogue's backend from a development prototype into a production-grade cloud system. The existing Fastify server (`server/`) has JWT auth, SQLite saves, and leaderboard routes — all functioning. This phase extends that foundation with: a polished auth UI that non-technical players can navigate, PostgreSQL migration for production scale, offline-first fact delivery (DD-V2-093), multiple device profiles (DD-V2-177), and the 10 analytics events that are mandatory before any beta (DD-V2-181).

**Non-negotiable rule**: Network calls are NEVER required to show a quiz. All fact content must be cached locally before any quiz can trigger. Any feature that breaks offline-first fails its acceptance criteria immediately.

---

## Prerequisites

- Phase 18 (Addictiveness Pass) complete — final gameplay loops are locked, no further changes to `PlayerSave` schema during Phase 19
- Server is running and reachable locally at `http://localhost:3001`
- `npm run typecheck` passes on both `src/` (Svelte app) and `server/src/` (Fastify server)
- Existing routes confirmed working:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET  /api/saves`
  - `POST /api/saves`
  - `GET  /api/leaderboards/:category`

---

## Auth UI Wireframes (text descriptions)

### Screen: Login
```
┌─────────────────────────────────────────┐
│  [← Back]              Recall Rogue      │
│                                         │
│         ╔═══════════════════╗           │
│         ║   G.A.I.A. icon   ║           │
│         ╚═══════════════════╝           │
│                                         │
│  Welcome back, Explorer.                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Email address                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Password                    [👁] │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Forgot password?                       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Sign In                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ────────── or continue with ─────────  │
│                                         │
│  [G  Google]          [  Apple]         │
│                                         │
│  Don't have an account? Register        │
│                                         │
│  [Continue as Guest]                    │
└─────────────────────────────────────────┘
```

### Screen: Register
```
┌─────────────────────────────────────────┐
│  [← Login]              Recall Rogue     │
│                                         │
│  Join the expedition.                   │
│  Your progress syncs to all devices.   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Display name (shown on boards)   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Email address                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Password (8+ chars)         [👁] │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Confirm password                 │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Age bracket: [Under 13] [13-17] [18+]  │
│                                         │
│  ☐ I agree to the Terms of Service     │
│  ☐ I agree to the Privacy Policy       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Create Account            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Screen: Profile Selector (title screen, before entering dome)
```
┌─────────────────────────────────────────┐
│              Recall Rogue                │
│                                         │
│  Who's playing?                         │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │  Avatar  │  │  Avatar  │            │
│  │  Kai     │  │  Mia     │            │
│  │  Lv. 12  │  │  Lv. 4   │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │  Avatar  │  │    +     │            │
│  │  Dad     │  │   Add    │            │
│  │  Lv. 7   │  │ Profile  │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  [Manage Profiles]                      │
└─────────────────────────────────────────┘
```

### Screen: Forgot Password
```
┌─────────────────────────────────────────┐
│  [← Login]                              │
│                                         │
│  Reset your password.                   │
│                                         │
│  Enter your email and we'll send        │
│  a reset link.                          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Email address                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │       Send Reset Link             │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## JWT Flow Diagram

```
CLIENT                                   SERVER
  │                                        │
  │── POST /api/auth/login ───────────────►│
  │   { email, password }                  │
  │                                        │ verify PBKDF2 hash
  │◄── 200 { token, refreshToken, user } ──│ issue access JWT (15m)
  │                                        │ issue refresh token (7d, stored in DB)
  │                                        │
  │── GET /api/saves ──────────────────────►│
  │   Authorization: Bearer <token>        │
  │                                        │ jwtVerify() → payload.sub = userId
  │◄── 200 { saveData }  ──────────────────│
  │                                        │
  │                    ... 15 minutes pass ...
  │                                        │
  │── GET /api/saves ──────────────────────►│
  │   Authorization: Bearer <expired-token>│
  │                                        │
  │◄── 401 Unauthorized  ──────────────────│
  │                                        │
  │── POST /api/auth/refresh ─────────────►│
  │   { refreshToken }                     │
  │                                        │ lookup in refresh_tokens table
  │                                        │ verify not expired
  │                                        │ DELETE old token (rotation)
  │◄── 200 { token, refreshToken } ────────│ INSERT new refresh token
  │                                        │
  │── GET /api/saves (retry) ─────────────►│
  │   Authorization: Bearer <new-token>    │
  │                                        │
  │◄── 200 { saveData }  ──────────────────│
```

---

## Sub-Phase 19.1: Auth UI

- **What**: Implement login, register, forgot-password, profile screen, and guest mode as Svelte 5 components wired to the existing `apiClient.ts` endpoints. Add age bracket selection to register form for COPPA compliance (referenced in 19.5).
- **Where**:
  - `src/ui/components/auth/LoginView.svelte` (new)
  - `src/ui/components/auth/RegisterView.svelte` (new)
  - `src/ui/components/auth/ForgotPasswordView.svelte` (new)
  - `src/ui/components/auth/ProfileView.svelte` (new)
  - `src/ui/stores/authStore.ts` (new — reactive auth state)
  - `src/services/apiClient.ts` (extend: add `deleteAccount`, `requestPasswordReset` methods)
  - `src/ui/App.svelte` (add routing logic: show profile selector before dome if profiles exist)
- **How**:
  1. Create `src/ui/stores/authStore.ts`:
     ```ts
     import { writable, derived } from 'svelte/store'
     import { apiClient } from '../../services/apiClient'

     interface AuthState {
       isLoggedIn: boolean
       userId: string | null
       email: string | null
       displayName: string | null
     }

     const _auth = writable<AuthState>({
       isLoggedIn: apiClient.isLoggedIn(),
       userId: null,
       email: null,
       displayName: null,
     })

     export const authStore = {
       subscribe: _auth.subscribe,
       setUser(user: { id: string; email: string; displayName: string | null }) {
         _auth.set({ isLoggedIn: true, userId: user.id, email: user.email, displayName: user.displayName })
       },
       clear() {
         _auth.set({ isLoggedIn: false, userId: null, email: null, displayName: null })
         apiClient.logout()
       },
     }

     export const isLoggedIn = derived(_auth, ($a) => $a.isLoggedIn)
     ```
  2. Create `LoginView.svelte` with: email input, password input (with show/hide toggle), "Sign In" button, "Forgot password?" link, "Continue as Guest" button, Google/Apple social login placeholders (Phase 19.1 wires email only; social is Phase 19.1.B after OAuth integration).
  3. Create `RegisterView.svelte` with: displayName, email, password, confirm-password, age bracket radio group (`under_13` / `teen` / `adult`), ToS and Privacy Policy checkboxes (required). Age bracket is saved to profile, used for content filtering.
  4. Create `ForgotPasswordView.svelte` with: email input, submit button that calls `POST /api/auth/password-reset-request`. Show "Check your email" confirmation state after submit.
  5. Create `ProfileView.svelte`: shows displayName, email, account creation date, "Change Password" button, "Logout" button, "Delete Account" button (requires typing "DELETE" to confirm — GDPR Article 17 compliance).
  6. Add `deleteAccount()` to `apiClient.ts` calling `DELETE /api/auth/account` (add this route to server in 19.3).
  7. Add `requestPasswordReset(email: string)` to `apiClient.ts` calling `POST /api/auth/password-reset-request`.
  8. In `App.svelte`: add top-level routing state (`'auth' | 'profileSelect' | 'game'`). Show `LoginView` when not logged in and no guest session. Show `ProfileSelectView` before dome loads when multiple profiles exist.
  9. All auth form buttons must be `min-height: 48px` (mobile touch target).
  10. All inputs must use `autocomplete` attributes: `autocomplete="email"`, `autocomplete="current-password"`, `autocomplete="new-password"`.
- **Acceptance Criteria**:
  - [ ] User can register a new account with valid email + 8-char password
  - [ ] User can log in and their save syncs within 5 seconds of login
  - [ ] "Continue as Guest" starts a game session without requiring registration
  - [ ] Logout clears tokens from localStorage and returns to login screen
  - [ ] "Forgot password?" shows email-sent confirmation screen
  - [ ] Age bracket field is present and required on registration
  - [ ] ToS and Privacy Policy checkboxes are required; form cannot submit without both checked
  - [ ] All interactive elements ≥ 44×44px touch target
  - [ ] `npm run typecheck` passes
- **Playwright Test**:
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 14
    await page.goto('http://localhost:5173')

    // Guest flow
    await page.click('button:has-text("Continue as Guest")')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
    console.log('Guest mode: OK')

    // Navigate to auth
    await page.goto('http://localhost:5173')
    await page.click('button:has-text("Sign In")') // or observe login screen directly

    // Register flow
    await page.fill('input[autocomplete="email"]', 'test@terragacha.test')
    await page.fill('input[autocomplete="new-password"]', 'testpass123')
    await page.fill('input[placeholder*="Confirm"]', 'testpass123')
    await page.fill('input[placeholder*="Display"]', 'TestMiner')
    await page.click('label:has-text("18+")')
    await page.check('input[name="agreeToS"]')
    await page.check('input[name="agreePrivacy"]')
    await page.click('button:has-text("Create Account")')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
    console.log('Registration + auto-login: OK')

    await page.screenshot({ path: '/tmp/ss-auth-register.png' })
    await browser.close()
  })()
  ```

---

## Sub-Phase 19.2: Cloud Sync Improvements

- **What**: Fix the leaderboard category mismatch between client and server, improve conflict resolution, add an offline operation queue, and add a visible sync status indicator in the UI.
- **Where**:
  - `src/services/syncService.ts` (extend: offline queue, connectivity listener)
  - `src/services/apiClient.ts` (fix: align category names with server `VALID_CATEGORIES`)
  - `src/ui/components/SyncIndicator.svelte` (new — small icon in HUD showing sync state)
  - `server/src/routes/leaderboards.ts` (fix: `VALID_CATEGORIES` to match client extractors)
- **How**:
  1. **Leaderboard category mismatch fix**: `syncService.ts` uses `deepest_layer`, `total_dives`, `total_facts`, `total_blocks_mined`, `best_streak` as keys. Server `VALID_CATEGORIES` has `deepest_dive`, `facts_mastered`, `longest_streak`, `total_dust`. Reconcile to a single canonical set. Decision: use server's categories as canonical. Update `LEADERBOARD_EXTRACTORS` in `syncService.ts`:
     ```ts
     const LEADERBOARD_EXTRACTORS: Record<string, (s: PlayerSave) => number> = {
       deepest_dive: (s) => s.stats.deepestLayerReached,
       facts_mastered: (s) => s.stats.totalFactsLearned,
       longest_streak: (s) => s.stats.bestStreak,
       total_dust: (s) => s.inventory?.dust ?? 0,
     }
     ```
  2. **Offline operation queue**: Add `OfflineQueue` class in `src/services/offlineQueue.ts`:
     - Stores pending operations (save uploads, leaderboard submissions) in `localStorage` under key `terra_offline_queue`
     - Each entry: `{ id: string, type: 'save' | 'leaderboard', payload: unknown, attemptCount: number, enqueuedAt: number }`
     - `enqueue(op)`: adds to queue
     - `flush()`: iterates queue, attempts each operation, removes on success, increments `attemptCount` on failure, removes after 5 failed attempts
     - Called from `syncService.syncAfterSave()` when offline
  3. **Connectivity listener** in `syncService.ts`:
     ```ts
     constructor() {
       this._lastSyncTime = this.readLastSyncTime()
       if (typeof window !== 'undefined') {
         window.addEventListener('online', () => this.onConnectivityRestored())
       }
     }

     private async onConnectivityRestored(): Promise<void> {
       await offlineQueue.flush()
       await this.pushToCloud()
     }
     ```
  4. **Sync indicator**: Create `SyncIndicator.svelte` with three states:
     - `idle` — small grey cloud icon (24×24px)
     - `syncing` — spinning blue cloud icon
     - `error` — red cloud with `!` (shown for 5 seconds after failed sync)
     - Mount this in the HUD overlay in `BaseView.svelte` or equivalent top-level component.
  5. **Conflict resolution improvement**: Current rule (higher `lastPlayedAt` wins) is correct. Add a secondary rule: if timestamps are within 60 seconds of each other (likely same session, dual-write), prefer the save with the higher `stats.totalBlocksMined` as a tiebreaker. Update `resolveConflict()` in `syncService.ts`.
- **Acceptance Criteria**:
  - [ ] Leaderboard categories match identically between `syncService.ts` extractors and server `VALID_CATEGORIES`
  - [ ] Going offline mid-session queues sync operations; reconnecting flushes them
  - [ ] Sync indicator visible in HUD during upload
  - [ ] `GET /api/leaderboards/deepest_dive` returns entries when tested with curl
  - [ ] `npm run typecheck` passes on both client and server
- **API Test** (curl):
  ```bash
  # Register
  TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"test19@ex.com","password":"pass1234","displayName":"Tester"}' \
    | jq -r '.token')

  # Submit leaderboard score
  curl -s -X POST http://localhost:3001/api/leaderboards/deepest_dive \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"score": 12}' | jq .

  # Fetch leaderboard
  curl -s http://localhost:3001/api/leaderboards/deepest_dive | jq .
  # Expected: array containing the submitted entry with rank=1
  ```

---

## Sub-Phase 19.3: Production Infrastructure

- **What**: Migrate the server database from SQLite to PostgreSQL using Drizzle ORM (keeping SQLite as the dev/test fallback), deploy to Railway or Fly.io via Docker Compose, configure rate limiting on auth endpoints, add SSL termination, add database backup and monitoring.
- **Where**:
  - `server/src/db/index.ts` (update: detect DATABASE_URL scheme, use postgres driver when `postgres://`)
  - `server/src/db/schema.ts` (update: add Drizzle PostgreSQL column types as alternative export)
  - `server/src/db/migrate.ts` (update: support both SQLite and PostgreSQL migrators)
  - `server/src/config.ts` (add: `rateLimitMax`, `rateLimitWindow` fields)
  - `server/src/index.ts` (add: `@fastify/rate-limit` plugin registration)
  - `server/docker-compose.yml` (update: add PostgreSQL service, pgAdmin optional)
  - `server/docker-compose.prod.yml` (new — production-specific compose)
  - `server/src/routes/auth.ts` (add: `DELETE /api/auth/account`, `POST /api/auth/password-reset-request`)
  - `server/.env.example` (new — documents all required env vars)

### PostgreSQL Schema DDL

```sql
-- Run via psql or Drizzle migrate against postgres://...

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  age_bracket TEXT CHECK (age_bracket IN ('under_13', 'teen', 'adult')) DEFAULT 'adult',
  is_guest    BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  BIGINT,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  save_data   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  profile_id  TEXT NOT NULL DEFAULT 'default',  -- for multi-profile (19.6)
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saves_user_profile ON saves(user_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_saves_created_at ON saves(created_at DESC);

CREATE TABLE IF NOT EXISTS leaderboards (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  score       INTEGER NOT NULL,
  metadata    JSONB,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboards_category_score ON leaderboards(category, score DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  BIGINT NOT NULL,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id  TEXT NOT NULL,
  event_name  TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  platform    TEXT,
  app_version TEXT,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  BIGINT NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_packs (
  id          TEXT PRIMARY KEY,
  version     INTEGER NOT NULL,
  category    TEXT NOT NULL,
  pack_data   TEXT NOT NULL,  -- JSON blob of facts array
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fact_packs_category ON fact_packs(category);
```

### Docker Compose — Production

`server/docker-compose.prod.yml`:
```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: recall-rogue-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-terragacha}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-terragacha}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-terragacha}"]
      interval: 10s
      timeout: 5s
      retries: 5
    ports:
      - "5432:5432"

  server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: recall-rogue-server
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRY: ${JWT_EXPIRY:-15m}
      REFRESH_EXPIRY: ${REFRESH_EXPIRY:-7d}
      DATABASE_URL: postgresql://${POSTGRES_USER:-terragacha}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-terragacha}
      CORS_ORIGIN: ${CORS_ORIGIN:-https://terragacha.com}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX:-20}
      RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS:-60000}
      PASSWORD_RESET_BASE_URL: ${PASSWORD_RESET_BASE_URL:-https://terragacha.com/reset-password}
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  backup:
    image: postgres:16-alpine
    container_name: recall-rogue-backup
    restart: unless-stopped
    depends_on:
      - postgres
    volumes:
      - postgres-backups:/backups
    environment:
      PGPASSWORD: ${POSTGRES_PASSWORD}
    entrypoint: >
      sh -c "while true; do
        pg_dump -h postgres -U ${POSTGRES_USER:-terragacha} ${POSTGRES_DB:-terragacha}
          | gzip > /backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz;
        find /backups -name '*.sql.gz' -mtime +7 -delete;
        sleep 86400;
      done"

volumes:
  postgres-data:
    driver: local
  postgres-backups:
    driver: local
```

### `.env.example`

```bash
# server/.env.example — copy to .env and fill in values

NODE_ENV=production
PORT=3001

# JWT — must be a long random string (min 64 chars) in production
JWT_SECRET=change-me-to-a-64-char-random-string-here
JWT_EXPIRY=15m
REFRESH_EXPIRY=7d

# PostgreSQL
POSTGRES_USER=terragacha
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=terragacha
DATABASE_URL=postgresql://terragacha:change-me@localhost:5432/terragacha

# CORS — comma-separated for multiple origins
CORS_ORIGIN=https://terragacha.com,https://www.terragacha.com

# Rate limiting
RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW_MS=60000

# Email (for password reset)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=noreply@terragacha.com
PASSWORD_RESET_BASE_URL=https://terragacha.com/reset-password
```

### Rate Limiting Implementation

Add to `server/src/index.ts` (install `@fastify/rate-limit` — ask user before `npm install`):
```ts
await fastify.register(rateLimit, {
  global: false, // apply per-route only
})

// In authRoutes:
fastify.post('/register', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
}, handler)

fastify.post('/login', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
}, handler)

fastify.post('/refresh', {
  config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
}, handler)

fastify.post('/password-reset-request', {
  config: { rateLimit: { max: 3, timeWindow: '5 minutes' } }
}, handler)
```

### New Auth Routes to Add

`DELETE /api/auth/account` — requires JWT, soft-deletes user (sets `is_deleted = TRUE`, `deleted_at = now()`), invalidates all refresh tokens, returns 204.

`POST /api/auth/password-reset-request` — no auth, body `{ email }`, creates entry in `password_reset_tokens`, sends email (mock in dev: logs the URL), returns 202 regardless (prevents user enumeration).

`POST /api/auth/password-reset-confirm` — no auth, body `{ token, newPassword }`, validates token, updates password hash, marks token used, returns 200.

- **How** (deployment to Railway):
  1. `cd server && docker build -t recall-rogue-server .` — verify build succeeds
  2. Create Railway project, provision PostgreSQL addon, copy `DATABASE_URL` to Railway env
  3. Set all required env vars in Railway dashboard (or via `railway env set KEY=VALUE`)
  4. `railway up` from `server/` directory
  5. Verify `https://your-app.up.railway.app/health` returns `{"status":"ok"}`
  6. Update `VITE_API_BASE_URL` in client `.env.production` to point to Railway URL

- **Acceptance Criteria**:
  - [ ] `docker compose -f docker-compose.prod.yml up` starts both postgres and server containers successfully
  - [ ] `curl https://your-prod-url/health` returns `{"status":"ok"}`
  - [ ] `POST /api/auth/login` returns 429 after 11 attempts in 1 minute
  - [ ] `DELETE /api/auth/account` with valid JWT sets user `is_deleted = true` in PostgreSQL
  - [ ] `POST /api/auth/password-reset-request` with any email returns 202 (no user enumeration)
  - [ ] Daily backup cron produces compressed `.sql.gz` files in the backup volume
  - [ ] `npm run typecheck` in `server/` passes after all changes
- **API Tests** (curl):
  ```bash
  # Health check
  curl -s https://your-prod-url/health | jq .
  # Expected: {"status":"ok","uptime":...}

  # Rate limit test (run 11 times fast)
  for i in {1..11}; do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST https://your-prod-url/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"email":"x@x.com","password":"wrong"}';
  done
  # Expected: first 10 return 401, 11th returns 429

  # Account deletion
  TOKEN=$(curl -s -X POST https://your-prod-url/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@ex.com","password":"pass1234"}' | jq -r '.token')
  curl -s -X DELETE https://your-prod-url/api/auth/account \
    -H "Authorization: Bearer $TOKEN" -w "%{http_code}"
  # Expected: 204
  ```

---

## Sub-Phase 19.4: Offline & Reliability (DD-V2-093)

- **What**: Implement the three-phase fact database migration from DD-V2-093: (1) server as source of truth for fact content, (2) client downloads fact packs and caches in sql.js, (3) build script becomes offline-first seed pack builder. Also add Service Worker for asset caching, pre-fetch quiz questions in batches, and add error boundaries for network failures.
- **Where**:
  - `server/src/routes/facts.ts` (new — fact pack delivery endpoint)
  - `server/src/db/schema.ts` (add `fact_packs` table, already in DDL above)
  - `src/services/factPackService.ts` (new — download, cache, and serve fact packs offline-first)
  - `src/services/factsDB.ts` (update: become cache layer, not source of truth)
  - `scripts/build-facts-db.mjs` (update: also export packs JSON for server seeding)
  - `public/sw.js` (new — Service Worker for offline asset caching)
  - `src/ui/components/ErrorBoundary.svelte` (new — wraps async components with fallback UI)
  - `src/ui/components/OfflineToast.svelte` (new — shows when network lost during sync)
  - `vite.config.ts` (update: register Service Worker plugin)

- **How**:
  1. **Server fact pack API**: Create `server/src/routes/facts.ts`:

     ```ts
     // GET /api/facts/packs — list available pack versions
     // GET /api/facts/packs/:category — download a fact pack by category
     // GET /api/facts/packs/all — download the complete pack (for first install)
     ```

     Fact pack response shape:
     ```json
     {
       "packId": "general-v3",
       "category": "general",
       "version": 3,
       "factCount": 122,
       "facts": [
         {
           "id": "f001",
           "question": "...",
           "answer": "...",
           "distractors": ["...", "...", "..."],
           "gaiaComment": "...",
           "explanation": "...",
           "category": "geology",
           "wowFactor": 8
         }
       ]
     }
     ```

  2. **Client fact pack service** (`src/services/factPackService.ts`):

     ```ts
     const PACK_VERSION_KEY = 'terra_fact_pack_version'
     const PACK_DATA_KEY = 'terra_fact_pack_data'
     const PACK_LAST_SYNC_KEY = 'terra_fact_pack_last_sync'
     const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

     export class FactPackService {
       // init(): check localStorage for cached pack; if missing or stale, download
       // getFacts(category?): returns facts from cache (NEVER makes network call if cache exists)
       // syncPacks(): background sync — download updated packs, merge into sql.js cache
       // isPackStale(): true if last sync > SYNC_INTERVAL_MS ago
     }
     ```

     Critical rule from DD-V2-093: `getFacts()` must NEVER return empty when network is unavailable. If no pack is cached, fall back to the bundled `public/facts.db` seed (the existing sql.js approach).

  3. **Update `factsDB.ts`**: `getFacts()` now delegates to `factPackService.getFacts()` first. Only falls back to sql.js direct query if factPackService cache is empty.

  4. **Update `build-facts-db.mjs`**: After building `public/facts.db`, also write `public/seed-pack.json` — a full fact pack JSON for the server to seed its `fact_packs` table on first startup. Server reads this on `initSchema()` if `fact_packs` table is empty.

  5. **Service Worker** (`public/sw.js`) — cache-first strategy for app shell:
     ```js
     const CACHE_NAME = 'recall-rogue-v1'
     const PRECACHE_URLS = [
       '/',
       '/index.html',
       '/facts.db',
     ]

     self.addEventListener('install', (event) => {
       event.waitUntil(
         caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
       )
     })

     self.addEventListener('fetch', (event) => {
       // Network-first for API calls; cache-first for assets
       if (event.request.url.includes('/api/')) {
         event.respondWith(
           fetch(event.request).catch(() => caches.match(event.request))
         )
       } else {
         event.respondWith(
           caches.match(event.request).then((cached) => cached ?? fetch(event.request))
         )
       }
     })
     ```

  6. **Error boundaries**: Create `ErrorBoundary.svelte` using Svelte 5 `{#snippet fallback}` pattern. Wrap `QuizOverlay.svelte` and `StudySession.svelte` so a failed fact fetch shows "Quiz unavailable — check connection" rather than crashing.

  7. **Loading states**: Add `isLoading` boolean to all async data fetches. Show a skeleton/spinner during initial fact pack download (first launch only — subsequent launches are instant from cache).

- **Acceptance Criteria**:
  - [ ] `GET /api/facts/packs/all` returns all 522 facts (122 general + 400 N3 vocab) as a JSON pack
  - [ ] After first fact pack download, killing the server and refreshing the app still shows quizzes correctly (offline-first)
  - [ ] Service Worker is registered and visible in browser DevTools > Application > Service Workers
  - [ ] `ErrorBoundary` wrapping quiz shows fallback message on simulated network failure
  - [ ] `build-facts-db.mjs` generates both `public/facts.db` and `public/seed-pack.json`
  - [ ] `npm run typecheck` passes
- **Playwright Test**:
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })
    const page = await browser.newPage()
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(3000) // allow SW + fact pack to init

    // Simulate offline
    await page.context().setOffline(true)

    await page.click('button:has-text("Dive")')
    await page.waitForTimeout(1500)
    await page.click('button:has-text("Enter Mine")')
    await page.waitForTimeout(5000)

    // Mine blocks until quiz triggers
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(200)
    }

    // Check quiz still appears (offline-first)
    const quizVisible = await page.$('.quiz-overlay') !== null
    console.log('Offline quiz visible:', quizVisible) // must be true

    await page.screenshot({ path: '/tmp/ss-offline-quiz.png' })
    await browser.close()
  })()
  ```

---

## Sub-Phase 19.5: Legal & Compliance

- **What**: Add privacy policy and terms of service pages, implement COPPA age gate wired to content filtering, implement GDPR Article 17 account deletion, and define a data retention policy.
- **Where**:
  - `src/ui/components/legal/PrivacyPolicy.svelte` (new)
  - `src/ui/components/legal/TermsOfService.svelte` (new)
  - `src/ui/components/legal/AgeGate.svelte` (new — shown on first launch, before any content)
  - `src/services/saveService.ts` (update: read age bracket from profile, pass to fact filter)
  - `src/services/factsDB.ts` (update: `getFacts()` accepts `ageBracket` param, filters on `age_rating`)
  - `server/src/routes/auth.ts` (update: `DELETE /api/auth/account` marks data for deletion)

### Privacy Policy Template Outline

```
Privacy Policy — Recall Rogue
Last updated: [DATE]

1. Introduction
   - Who we are (operator name, contact email)
   - Scope of this policy

2. Data We Collect
   2.1 Account data: email, display name, password hash (never plaintext)
   2.2 Gameplay data: save state, facts learned, dive statistics (anonymised)
   2.3 Analytics: session events (see Section 3), no PII in event payloads
   2.4 Device data: platform, OS version, app version (for crash diagnostics only)

3. Analytics Events
   - We collect the 10 events listed in Section 19.7 (app_open, quiz_answered, etc.)
   - No personally identifiable information is included in any event payload
   - Events are stored on our servers for a maximum of 90 days

4. How We Use Your Data
   4.1 To save and sync your game progress across devices
   4.2 To display leaderboards (display name only, never email)
   4.3 To improve the game via aggregate analytics
   4.4 We do NOT sell data to third parties

5. Children's Privacy (COPPA)
   - Players who select "Under 13" during registration:
     * Are not shown adult-rated facts
     * Cannot appear on public leaderboards
     * Cannot use social features
   - Parental consent flow: [describe flow if applicable]

6. Data Retention
   - Active accounts: retained for the lifetime of the account
   - Deleted accounts: all data purged within 30 days of deletion request
   - Analytics events: purged after 90 days
   - Backup copies: purged from backups within 60 days

7. Your Rights (GDPR — EU/UK players)
   7.1 Right to access your data (email support@terragacha.com)
   7.2 Right to correct inaccurate data
   7.3 Right to delete your account (in-app: Settings > Account > Delete Account)
   7.4 Right to data portability (email request within 30 days)
   7.5 Right to withdraw consent

8. Security
   - Passwords stored as PBKDF2 hashes with random salts (never plaintext)
   - All API communications over HTTPS/TLS
   - Access tokens expire after 15 minutes

9. Contact
   - Email: privacy@terragacha.com
   - Response within 30 days for all GDPR requests
```

- **How** (COPPA age gate):
  1. On first app launch, show `AgeGate.svelte` before any content loads:
     - "How old are you?" with three choices: "Under 13", "13–17", "18+"
     - Store result in `localStorage` under `terra_age_bracket`
     - If "Under 13": set `profile.ageBracket = 'under_13'`, disable leaderboard features, filter facts to `age_rating: 'kid'` only
  2. In `factsDB.ts`, update `getFacts()` signature: `getFacts(category?: string, ageBracket?: 'under_13' | 'teen' | 'adult')`. Add `WHERE age_rating IN (...)` clause based on bracket.
  3. Account deletion: `DELETE /api/auth/account` sets `is_deleted = true`, `deleted_at = now()`. A scheduled job (or cron call) purges deleted users and all their data after 30 days. In dev, add a `POST /api/admin/purge-deleted` endpoint for manual testing.
  4. Add `Privacy Policy` and `Terms of Service` links in the `RegisterView.svelte` form checkboxes (already wireframed in 19.1). Make them open as modal sheets (not external browser tabs) so the user stays in the app.

- **Acceptance Criteria**:
  - [ ] First-time app launch shows age gate before any content
  - [ ] "Under 13" selection filters out all `age_rating: 'adult'` and `age_rating: 'teen'` facts from quizzes
  - [ ] "Under 13" players do not see public leaderboards
  - [ ] `DELETE /api/auth/account` endpoint returns 204 and sets `is_deleted = true` in DB
  - [ ] Privacy Policy and ToS text are accessible as modal sheets from the registration screen
  - [ ] Privacy Policy includes all 9 sections from template above
- **API Test**:
  ```bash
  # Create user, then delete
  CREDS=$(curl -s -X POST http://localhost:3001/api/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"delete-me@test.com","password":"pass1234"}')
  TOKEN=$(echo $CREDS | jq -r '.token')
  USER_ID=$(echo $CREDS | jq -r '.user.id')

  curl -s -X DELETE http://localhost:3001/api/auth/account \
    -H "Authorization: Bearer $TOKEN" -w "\nStatus: %{http_code}\n"
  # Expected: Status: 204

  # Verify user is soft-deleted (using admin endpoint)
  curl -s http://localhost:3001/api/admin/user-status/$USER_ID
  # Expected: {"is_deleted": true, "deleted_at": <timestamp>}
  ```

---

## Sub-Phase 19.6: Multiple Player Profiles (DD-V2-177)

- **What**: Support up to 4 independent player profiles per device. Each profile has its own `PlayerSave`, Knowledge Tree, fossil collection, age bracket, and interest settings. Profile switching appears on the title screen before the dome loads.
- **Where**:
  - `src/ui/components/profiles/ProfileSelectView.svelte` (new)
  - `src/ui/components/profiles/ProfileCreateView.svelte` (new)
  - `src/ui/components/profiles/ProfileDeleteView.svelte` (new)
  - `src/services/profileService.ts` (new — multi-profile localStorage management)
  - `src/services/saveService.ts` (update: namespace save key per active profile)
  - `src/ui/stores/profileStore.ts` (new — currently active profile)
  - `src/data/types.ts` (add `PlayerProfile` interface)

### Multiple Profile Data Structure

```ts
// src/data/types.ts additions

/** Lightweight descriptor for a player profile. */
export interface PlayerProfile {
  /** UUID v4. Generated on creation. */
  id: string
  /** User-entered name/nickname. Max 20 chars. */
  name: string
  /** Age bracket selected during profile creation. */
  ageBracket: 'under_13' | 'teen' | 'adult'
  /** Primary interest categories selected during onboarding. */
  interests: string[]
  /** Avatar emoji or sprite key chosen during creation. */
  avatarKey: string
  /** ISO date string of profile creation. */
  createdAt: string
  /** ISO date string of last play session for this profile. */
  lastPlayedAt: string
  /** Display level (highest mine layer reached, for UI). */
  level: number
  /** Cloud sync: this profile's cloud save ID (if logged in). */
  cloudSaveId: string | null
}

/** Container stored in localStorage under PROFILES_STORAGE_KEY. */
export interface ProfilesStore {
  /** All profiles on this device. Max 4. */
  profiles: PlayerProfile[]
  /** ID of the currently active profile. */
  activeProfileId: string | null
}
```

### Storage Keys (namespaced per profile)

```ts
// profileService.ts
const PROFILES_KEY = 'terra_profiles'        // ProfilesStore JSON
const SAVE_KEY_PREFIX = 'terra_save_'        // terra_save_<profileId>
const SM2_KEY_PREFIX = 'terra_sm2_'          // terra_sm2_<profileId>
const KNOWLEDGE_TREE_KEY_PREFIX = 'terra_kt_' // terra_kt_<profileId>
```

- **How**:
  1. Create `profileService.ts` with:
     - `getProfiles(): PlayerProfile[]` — reads `ProfilesStore` from localStorage
     - `getActiveProfile(): PlayerProfile | null`
     - `setActiveProfile(id: string): void` — sets `activeProfileId`, triggers app to reload save
     - `createProfile(data: Omit<PlayerProfile, 'id' | 'createdAt' | 'lastPlayedAt'>): PlayerProfile` — validates max 4 profiles, generates UUID
     - `deleteProfile(id: string): void` — removes profile, clears all namespaced keys for that ID
     - `updateProfile(id: string, updates: Partial<Pick<PlayerProfile, 'name' | 'avatarKey' | 'lastPlayedAt' | 'level'>>): void`

  2. Update `saveService.ts`: replace hardcoded key `'terra_save'` with `SAVE_KEY_PREFIX + profileStore.getActiveId()`. All save/load operations namespace by active profile.

  3. Create `ProfileSelectView.svelte` (matches wireframe in 19.1):
     - Shows up to 4 profile cards (avatar, name, level badge)
     - "Add Profile" card in slot 4 (disabled if 4 profiles already exist)
     - Tap profile → sets active → navigates to dome
     - Long-press profile → shows delete option (with confirmation: "Delete [Name]? This cannot be undone.")
     - "Manage Profiles" link → shows all profiles with rename/delete options

  4. Create `ProfileCreateView.svelte`:
     - Name input (max 20 chars)
     - Age bracket selector (same as register screen)
     - Avatar picker (8 emoji options: ⛏ 🪨 💎 🦕 🌋 🔭 🧬 🌿)
     - Interest selector (same categories as onboarding)
     - On submit: `profileService.createProfile()`, set as active, navigate to onboarding

  5. In `App.svelte`: On startup, if `profiles.length > 0`, show `ProfileSelectView` instead of title screen. If `profiles.length === 0`, skip selector and go to `ProfileCreateView` (or direct to game for guest).

  6. **Cloud sync integration**: When logged in, each profile's save uploads to the server tagged with `profile_id`. The `saves` table already has `profile_id` column (added in 19.3 DDL). `syncService.ts` reads `profileStore.getActiveId()` and passes it as `profile_id` in save uploads.

- **Acceptance Criteria**:
  - [ ] Can create 4 distinct profiles, each with independent saves
  - [ ] 5th profile creation attempt shows error "Maximum 4 profiles reached"
  - [ ] Switching profiles loads a completely different PlayerSave (different dust balance, different Knowledge Tree)
  - [ ] Deleting a profile clears all namespaced localStorage keys for that profile ID
  - [ ] Under-13 profile cannot see adult facts (ageBracket filter from 19.5 applies)
  - [ ] Profile names display correctly on the selector screen
  - [ ] Cloud sync uploads with correct `profile_id` field
  - [ ] `npm run typecheck` passes
- **Playwright Test**:
  ```js
  const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
  ;(async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/opt/google/chrome/chrome'
    })
    const page = await browser.newPage()
    await page.goto('http://localhost:5173')

    // Create profile 1
    await page.fill('input[placeholder*="Name"]', 'Kai')
    await page.click('[data-avatar="⛏"]')
    await page.click('button:has-text("18+")')
    await page.click('button:has-text("Start Exploring")')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })

    // Mine something
    await page.click('button:has-text("Dive")')
    await page.waitForTimeout(1500)
    await page.click('button:has-text("Enter Mine")')
    await page.waitForTimeout(3000)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(500)

    // Go back, switch to profile select
    await page.goto('http://localhost:5173')
    await page.waitForSelector('[data-profile-name="Kai"]', { timeout: 5000 })

    // Create profile 2
    await page.click('[data-add-profile]')
    await page.fill('input[placeholder*="Name"]', 'Mia')
    await page.click('button:has-text("Start Exploring")')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })

    // Verify Mia has fresh save (no dust carried over)
    const dustText = await page.textContent('.dust-display')
    console.log('Mia dust (should be 0):', dustText)

    await page.screenshot({ path: '/tmp/ss-profiles.png' })
    await browser.close()
  })()
  ```

---

## Sub-Phase 19.7: Analytics Infrastructure (DD-V2-181)

- **What**: Instrument all 10 critical pre-beta analytics events, build a lightweight self-hosted event store on the server, and create a retention metrics dashboard visible internally before beta begins. All events are anonymized — no PII in any payload.
- **Where**:
  - `src/services/analyticsService.ts` (new — event emission client)
  - `server/src/routes/analytics.ts` (new — event ingestion endpoint)
  - `server/src/db/schema.ts` (add `analytics_events` table — already in DDL above)
  - `src/game/GameManager.ts` (update: call `analyticsService.track()` at key moments)
  - `src/ui/components/rooms/ArchiveRoom.svelte` (future: GAIA's Report from DD-V2-176)
  - `scripts/analytics-dashboard.ts` (new — CLI tool to print D1/D7/D30 cohort data)

### Analytics Event Schemas (all 10 events)

```ts
// src/services/analyticsService.ts

// Session ID: generated once per app launch (not tied to user ID)
// UUID v4, stored in sessionStorage (cleared on tab close)

type Platform = 'android' | 'ios' | 'web'
type AppVersion = string // semver e.g. "0.9.0"

// ── Event 1 ─────────────────────────────────────────────────────────────────
interface AppOpenEvent {
  name: 'app_open'
  properties: {
    platform: Platform
    app_version: AppVersion
    /** 'cold' = fresh launch; 'warm' = resumed from background */
    launch_type: 'cold' | 'warm'
    /** ms since epoch — used to compute D1/D7/D30 from server-side */
    client_ts: number
    /** true if the user has any profile/save data */
    has_existing_save: boolean
    /** The active profile's age bracket (never email/name) */
    age_bracket: 'under_13' | 'teen' | 'adult' | 'unknown'
  }
}

// ── Event 2 ─────────────────────────────────────────────────────────────────
interface TutorialStepCompleteEvent {
  name: 'tutorial_step_complete'
  properties: {
    step_name: string  // e.g. 'mine_first_block', 'answer_first_quiz', 'return_to_dome'
    step_index: number // 0-based position in tutorial sequence
    /** ms since tutorial started */
    elapsed_ms: number
    /** true if player needed a hint */
    used_hint: boolean
  }
}

// ── Event 3 ─────────────────────────────────────────────────────────────────
interface FirstDiveCompleteEvent {
  name: 'first_dive_complete'
  properties: {
    layer_reached: number
    o2_remaining: number
    /** count of distinct item types found */
    items_found: number
    blocks_mined: number
    /** ms of dive duration */
    dive_duration_ms: number
  }
}

// ── Event 4 ─────────────────────────────────────────────────────────────────
interface QuizAnsweredEvent {
  name: 'quiz_answered'
  properties: {
    /** The fact's ID (not the question text — no PII risk) */
    fact_id: string
    correct: boolean
    quiz_type: 'gate' | 'random' | 'artifact' | 'layer_entrance' | 'hazard'
    /** ms from question display to answer tap */
    response_time_ms: number
    /** current mine layer when quiz triggered */
    current_layer: number
    distractor_count: number
  }
}

// ── Event 5 ─────────────────────────────────────────────────────────────────
interface FactMasteredEvent {
  name: 'fact_mastered'
  properties: {
    fact_id: string
    category: string
    /** calendar days from first exposure to mastery threshold (60d interval) */
    days_to_mastery: number
    /** total SM-2 review count to reach mastery */
    total_reviews: number
  }
}

// ── Event 6 ─────────────────────────────────────────────────────────────────
interface FossilRevivedEvent {
  name: 'fossil_revived'
  properties: {
    /** species key e.g. 'triceratops', 'megalodon' */
    species: string
    /** number of dives it took to unlock this fossil */
    dives_to_unlock: number
    /** total facts that were required to be learned for this revival */
    facts_required: number
    /** which revival animation played */
    animation_key: string
  }
}

// ── Event 7 ─────────────────────────────────────────────────────────────────
interface SessionEndEvent {
  name: 'session_end'
  properties: {
    /** total active session ms */
    duration_ms: number
    /** array of screen names visited in order */
    screens_visited: string[]
    dives_completed: number
    reviews_completed: number
    facts_learned: number
    /** reason session ended: 'app_close' | 'idle_timeout' | 'explicit_exit' */
    exit_reason: 'app_close' | 'idle_timeout' | 'explicit_exit'
  }
}

// ── Event 8 ─────────────────────────────────────────────────────────────────
interface PurchaseInitiatedEvent {
  name: 'purchase_initiated'
  properties: {
    /** e.g. 'oxygen_refill', 'cosmetic_pick', 'premium_material_bundle' */
    item_type: string
    /** The price label shown to user e.g. '$2.99' */
    price_point: string
    /** Where in the UI the purchase was triggered e.g. 'hud_oxygen_button', 'cosmetics_shop' */
    trigger_context: string
    /** current dive depth when purchase initiated (0 if not in mine) */
    current_layer: number
  }
}

// ── Event 9 ─────────────────────────────────────────────────────────────────
interface ChurnSignalEvent {
  name: 'churn_signal'
  properties: {
    /** 'D3' | 'D7' | 'D30' — which absence threshold was crossed */
    absence_type: 'D3' | 'D7' | 'D30'
    /** How many days since last session (server-computed) */
    days_absent: number
    /** Last known dive depth before churn */
    last_layer: number
    /** Last known streak at time of churn */
    streak_at_churn: number
  }
}

// ── Event 10 ────────────────────────────────────────────────────────────────
interface EngagementScoreChangeEvent {
  name: 'engagement_score_change'
  properties: {
    /** 0-100 score before this action */
    score_before: number
    /** 0-100 score after this action */
    score_after: number
    /** The action that caused the change e.g. 'quiz_correct', 'fossil_revived', 'streak_extended' */
    trigger_action: string
    delta: number
  }
}

type AnalyticsEvent =
  | AppOpenEvent
  | TutorialStepCompleteEvent
  | FirstDiveCompleteEvent
  | QuizAnsweredEvent
  | FactMasteredEvent
  | FossilRevivedEvent
  | SessionEndEvent
  | PurchaseInitiatedEvent
  | ChurnSignalEvent
  | EngagementScoreChangeEvent
```

### Analytics Service Implementation

```ts
// src/services/analyticsService.ts (structure)

export class AnalyticsService {
  private sessionId: string
  private queue: AnalyticsEvent[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly FLUSH_INTERVAL_MS = 10_000 // batch every 10s
  private readonly QUEUE_KEY = 'terra_analytics_queue'

  constructor() {
    this.sessionId = this.getOrCreateSessionId()
    this.loadQueue() // recover unsent events from localStorage
    this.setupSessionEnd()
  }

  /** Track an event. Adds to queue; flushes to server in batches. */
  track<T extends AnalyticsEvent>(event: T): void {
    // Privacy: never log any field called 'email', 'name', 'displayName'
    this.queue.push(event)
    this.saveQueue()
    this.scheduleFlush()
  }

  /** Force flush on session end (visibilitychange + beforeunload). */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return
    const batch = [...this.queue]
    this.queue = []
    this.saveQueue()
    try {
      await fetch(`${API_BASE_URL}/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, events: batch }),
        keepalive: true, // allows flush even during page unload
      })
    } catch {
      // On failure, put events back in queue for next session
      this.queue = [...batch, ...this.queue]
      this.saveQueue()
    }
  }
}

export const analyticsService = new AnalyticsService()
```

### Server Analytics Endpoint

`server/src/routes/analytics.ts`:
```ts
// POST /api/analytics/events
// Body: { sessionId: string, events: AnalyticsEvent[] }
// No auth required (session_id is anonymous)
// Rate limit: 60 events per session per minute

// Validation:
// - sessionId must be UUID v4
// - events.length must be <= 50 per batch
// - each event must have 'name' from allowed list (reject unknown event names)
// - no PII fields allowed: reject if any key is 'email', 'password', 'displayName'
// - store in analytics_events table: { id, session_id, event_name, properties: JSONB, platform, app_version, created_at }
```

### Retention Dashboard CLI

`scripts/analytics-dashboard.ts` — run with `npx tsx scripts/analytics-dashboard.ts`:
```
Recall Rogue Analytics Dashboard
================================
Period: 2026-03-01 to 2026-03-03

D1 Retention Cohort (yesterday):
  New users: 47
  Returned next day: 31 (65.9%)

D7 Retention Cohort (7 days ago):
  New users: 12
  Returned after 7 days: 3 (25.0%)

Top Quiz Categories (by answer count):
  geology: 1,203 answers (78% correct)
  biology: 891 answers (82% correct)
  history: 445 answers (71% correct)

Avg Session Duration: 8m 42s
Avg Dives per Session: 1.4
Tutorial Completion Rate: 68%
```

- **Where to call `analyticsService.track()`**:
  - `app_open`: in `main.ts` or `App.svelte` `onMount()`
  - `tutorial_step_complete`: in tutorial state machine (Phase 14 code)
  - `first_dive_complete`: in `GameManager.ts` on first `handleDiveComplete()`
  - `quiz_answered`: in `QuizManager.ts` `handleAnswer()`
  - `fact_mastered`: in `sm2.ts` when interval exceeds mastery threshold
  - `fossil_revived`: in `FossilManager.ts` (or GameManager fossil completion handler)
  - `session_end`: via `document.addEventListener('visibilitychange', ...)` and `beforeunload`
  - `purchase_initiated`: in monetization overlay (Phase 21)
  - `churn_signal`: computed server-side from `app_open` events with large time gaps
  - `engagement_score_change`: in engagement scoring system (Phase 18)

- **Acceptance Criteria**:
  - [ ] `POST /api/analytics/events` accepts a batch and writes to `analytics_events` table
  - [ ] `quiz_answered` event fires on every quiz answer (correct and wrong)
  - [ ] `app_open` event fires on every cold launch with correct `launch_type`
  - [ ] Events with `email` or `password` fields are rejected by server with 400
  - [ ] Queue persists across page refreshes (events not lost if page closes before flush)
  - [ ] `npx tsx scripts/analytics-dashboard.ts` prints retention metrics from DB data
  - [ ] `npm run typecheck` passes on both client and server
- **API Test**:
  ```bash
  # Submit valid analytics batch
  curl -s -X POST http://localhost:3001/api/analytics/events \
    -H 'Content-Type: application/json' \
    -d '{
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "events": [
        {
          "name": "app_open",
          "properties": {
            "platform": "web",
            "app_version": "0.9.0",
            "launch_type": "cold",
            "client_ts": 1709424000000,
            "has_existing_save": false,
            "age_bracket": "adult"
          }
        }
      ]
    }' | jq .
  # Expected: {"accepted": 1}

  # Reject PII
  curl -s -X POST http://localhost:3001/api/analytics/events \
    -H 'Content-Type: application/json' \
    -d '{
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "events": [{"name": "app_open", "properties": {"email": "test@test.com"}}]
    }' -w "%{http_code}"
  # Expected: 400
  ```

---

## Verification Gate

Run all of the following before declaring Phase 19 complete:

```bash
# 1. TypeScript — client
cd /root/terra-miner && npm run typecheck

# 2. TypeScript — server
cd /root/terra-miner/server && npm run typecheck

# 3. Server health check (server must be running)
curl -s http://localhost:3001/health | jq .
# Expected: {"status":"ok"}

# 4. Full auth flow
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"verify19@test.com","password":"verifypass"}' | jq -r '.token')
echo "Token: $TOKEN" | head -c 50

# 5. Cloud save round-trip
curl -s -X POST http://localhost:3001/api/saves \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"saveData": {"version": 1, "dust": 100}, "version": 1}' -w "\nStatus: %{http_code}\n"
curl -s http://localhost:3001/api/saves \
  -H "Authorization: Bearer $TOKEN" | jq '.saveData.dust'
# Expected: 100

# 6. Analytics ingestion
curl -s -X POST http://localhost:3001/api/analytics/events \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"00000000-0000-4000-8000-000000000001","events":[{"name":"app_open","properties":{"platform":"web","app_version":"0.9.0","launch_type":"cold","client_ts":1709424000000,"has_existing_save":false,"age_bracket":"adult"}}]}' \
  | jq .

# 7. Rate limiting
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"wrong"}')
  echo "Attempt $i: $STATUS"
done
# First 10: 401, 11th+: 429

# 8. Visual check
node /tmp/ss.js  # run Playwright screenshot — see template in CLAUDE.md
```

---

## Files Affected

### New Files
- `src/ui/components/auth/LoginView.svelte`
- `src/ui/components/auth/RegisterView.svelte`
- `src/ui/components/auth/ForgotPasswordView.svelte`
- `src/ui/components/auth/ProfileView.svelte`
- `src/ui/components/profiles/ProfileSelectView.svelte`
- `src/ui/components/profiles/ProfileCreateView.svelte`
- `src/ui/components/profiles/ProfileDeleteView.svelte`
- `src/ui/components/SyncIndicator.svelte`
- `src/ui/components/OfflineToast.svelte`
- `src/ui/components/ErrorBoundary.svelte`
- `src/ui/components/legal/PrivacyPolicy.svelte`
- `src/ui/components/legal/TermsOfService.svelte`
- `src/ui/components/legal/AgeGate.svelte`
- `src/ui/stores/authStore.ts`
- `src/ui/stores/profileStore.ts`
- `src/services/analyticsService.ts`
- `src/services/factPackService.ts`
- `src/services/profileService.ts`
- `src/services/offlineQueue.ts`
- `public/sw.js`
- `server/src/routes/analytics.ts`
- `server/src/routes/facts.ts`
- `server/docker-compose.prod.yml`
- `server/.env.example`
- `scripts/analytics-dashboard.ts`

### Modified Files
- `src/services/apiClient.ts` — add `deleteAccount()`, `requestPasswordReset()`
- `src/services/syncService.ts` — fix category names, add offline queue, connectivity listener, improved conflict resolution
- `src/services/saveService.ts` — namespace save key per active profile
- `src/services/factsDB.ts` — accept `ageBracket` param, delegate to factPackService
- `src/data/types.ts` — add `PlayerProfile`, `ProfilesStore` interfaces
- `src/ui/App.svelte` — add routing state, profile select logic, age gate on first launch
- `src/game/GameManager.ts` — add `analyticsService.track()` calls at key events
- `src/game/managers/QuizManager.ts` — add `quiz_answered` analytics event
- `scripts/build-facts-db.mjs` — also export `public/seed-pack.json`
- `server/src/db/schema.ts` — add `analytics_events`, `password_reset_tokens`, `fact_packs` tables; add `age_bracket`, `is_guest`, `is_deleted`, `deleted_at` columns to `users`; add `profile_id` to `saves`
- `server/src/db/index.ts` — detect `postgres://` prefix, use postgres driver
- `server/src/db/migrate.ts` — support PostgreSQL migrator
- `server/src/config.ts` — add `rateLimitMax`, `rateLimitWindow`, `smtpHost`, `smtpPass`, `fromEmail`, `passwordResetBaseUrl`
- `server/src/index.ts` — register `@fastify/rate-limit`, register analytics and facts routes
- `server/src/routes/auth.ts` — add `DELETE /account`, `POST /password-reset-request`, `POST /password-reset-confirm`
- `server/src/routes/leaderboards.ts` — align `VALID_CATEGORIES` with client extractors
- `server/docker-compose.yml` — remains dev SQLite compose (unchanged)

---

## Sub-Phase 19.8: PlayerSave Sub-Documents

- [ ] Split `PlayerSave` into 5 versioned sub-documents (core, knowledge, inventory, dome, analytics) stored as separate IndexedDB keys, each with its own version counter. (DD-V2-192)
- [ ] Implement per-sub-doc merge on sync conflict; unmodified sub-docs are never transmitted in sync requests.

## Sub-Phase 19.9: IndexedDB Migration

- [ ] Replace `localStorage` as the primary persistence layer with `idb-keyval`; `localStorage` retained as a write-through mirror for session reads only. (DD-V2-193)
- [ ] Migrate existing saves on first launch; fallback gracefully if IndexedDB is unavailable (private browsing).

## Sub-Phase 19.10: Field-Level Sync Merge

- [ ] Implement per-fact, per-field conflict resolution: server timestamp wins for SM-2 fields; client wins for cosmetic preferences; merge-max for numeric progress. (DD-V2-194)
- [ ] Log all resolved conflicts to `sync_conflicts` analytics table for monitoring.

## Sub-Phase 19.11: Token Storage Security

- [ ] Store JWT access tokens in `httpOnly` cookies on web; use `@capacitor-community/secure-storage` on native iOS/Android. (DD-V2-195)
- [ ] Remove all `localStorage` token storage; update `src/services/authService.ts` accordingly.

## Sub-Phase 19.12: Save Durability

- [ ] Trigger immediate cloud sync on `App.addListener('appStateChange', ...)` when app moves to background. (DD-V2-199)
- [ ] IndexedDB writes are always synchronous (no fire-and-forget); confirm write before continuing game state mutation.

## Sub-Phase 19.13: Sync Status UI

- [ ] Add a cloud-sync status icon to the HUD (synced / syncing / error states). (DD-V2-200)
- [ ] Error state shows a GAIA personality message instead of a raw error code; retry button triggers manual sync.

## Sub-Phase 19.14: PostgreSQL jsonb + Analytics Columns

- [ ] Add `jsonb` columns to the `saves` table for sub-document storage; add GIN indexes on frequently-queried JSON paths. (DD-V2-202)
- [ ] Add `analytics_columns` materialized view for leaderboard and retention queries without deserializing jsonb.

## Sub-Phase 19.15: Save History Retention Policy

- [ ] Keep last 10 save snapshots per user; add `is_active` boolean index; prune rows exceeding 10 on each write. (DD-V2-203)
- [ ] Add `GET /api/saves/history` endpoint for the profile screen to display restore points.

## Sub-Phase 19.16: Leaderboard Scaling

- [ ] Add composite index `(category, score DESC, user_id)` to the leaderboard table; use upsert (`INSERT ... ON CONFLICT DO UPDATE`) for score submissions. (DD-V2-204)
- [ ] Cache top-100 rows per category in Redis or in-memory LRU with 60-second TTL.

## Sub-Phase 19.17: Argon2id Migration

- [ ] Replace the current bcrypt password hashing with Argon2id (memory: 64MB, iterations: 3, parallelism: 4). (DD-V2-205)
- [ ] Implement transparent re-hash on next successful login for existing bcrypt users; no forced password reset required.

## Sub-Phase 19.18: Social Login + Guest Linking

- [ ] Add Google and Apple OAuth via `@capacitor-community/oauth2` or `@codetrix-studio/capacitor-google-auth`. (DD-V2-206)
- [ ] Implement guest→authenticated account linking: all saves, SM-2 progress, and relics transfer on link; guest account is deleted after 30 days.

## Sub-Phase 19.19: SQLite→PostgreSQL Migration

- [ ] Implement phased migration with dual-write: new writes go to both SQLite and PostgreSQL; reads prefer PostgreSQL once validation passes. (DD-V2-209)
- [ ] Create migration scripts in `server/src/db/migrations/`; dry-run mode counts rows without writing.

## Sub-Phase 19.20: Refresh Token Hashing

- [ ] Store SHA-256 hash of refresh tokens in the database (never the raw token). (DD-V2-210)
- [ ] Implement token family rotation: any attempt to reuse an invalidated refresh token revokes the entire family.

## Sub-Phase 19.21: Rate Limiting

- [ ] Register `@fastify/rate-limit` with per-route limits: auth endpoints 10 req/min, save endpoints 30 req/min, leaderboard 60 req/min. (DD-V2-211)
- [ ] Return `Retry-After` header on 429 responses; add rate-limit bypass for internal health-check routes.

## Sub-Phase 19.22: Anti-Cheat

- [ ] Implement server-side plausibility checks: flag saves where dive duration < minimum possible ticks for blocks mined. (DD-V2-225)
- [ ] Add HMAC checksum on `PlayerSave` sub-documents signed with a server secret; reject mismatched checksums on sync. Anomaly detection queues flagged users for soft review, not auto-ban.

## Sub-Phase 19.23: CSP Per Environment

- [ ] Configure Content Security Policy via Vite transform: strict `script-src self` for prod, relaxed for dev (allows `eval` for HMR), Capacitor-specific `capacitor://` origin allowance. (DD-V2-226)
- [ ] CSP headers set by Fastify on all API responses; `index.html` meta CSP for web-only delivery.

## Sub-Phase 19.24: Asymmetric JWT (ES256)

- [ ] Replace HMAC-SHA256 JWTs with ES256 (ECDSA P-256); private key signs tokens on the server, public key verifies on any service. (DD-V2-227)
- [ ] Store private key in environment variable (never in code); rotate keys via key-id header without invalidating existing tokens.

## Sub-Phase 19.25: GDPR Right to Erasure

- [ ] Implement `DataDeletionService` with a 30-day soft delete: account marked `is_deleted=true`, data anonymized after 30 days by a scheduled job. (DD-V2-229)
- [ ] Add `DELETE /api/account` endpoint; send confirmation email; leaderboard rows anonymized immediately.

## Sub-Phase 19.26: Service Worker

- [ ] Integrate `vite-plugin-pwa` for web-only service worker with Workbox pre-caching of static assets and the core facts DB. (DD-V2-196)
- [ ] Service worker only active on web (`Capacitor.isNativePlatform() === false`); native app uses Capacitor's bundle caching.
- `vite.config.ts` — register Service Worker plugin (if using `vite-plugin-pwa`, ask user first)
