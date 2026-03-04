# Phase 26: Production Backend Integration

## Overview

### Goal
Wire every unregistered server route into Fastify, replace all service stubs with
live production integrations, and harden the server for real-world traffic. After
this phase the backend is fully operational: RevenueCat validates receipts and
fires webhooks, Resend delivers transactional email, FCM/APNs deliver push
notifications, Azure Cognitive Services generates TTS audio on demand, and every
environment variable is documented, validated at boot, and injectable via Docker
secrets.

### Dependencies
- Phase 19 (Auth & Cloud) — JWT auth middleware, PostgreSQL schema, save endpoints
- Phase 21 (Monetization) — IAP catalog, subscription routes, O2 regen service
- Phase 22 (Social & Multiplayer) — social routes, guestbook, guilds registered
- Phase 23 (Live Ops) — seasons, UGC, notifications routes exist as stubs

### Estimated Complexity
**High** — six distinct third-party integrations, cross-cutting env config, and
production hardening. Each sub-phase is independently testable; they can be
parallelised across workers but must all pass before the verification gate.

### Design Decisions Referenced
| ID | Decision |
|----|----------|
| DD-V2-140 | Use RevenueCat as the single source of truth for IAP receipts on both platforms |
| DD-V2-145 | Server validates RevenueCat webhook signature; never trust client receipt data |
| DD-V2-153 | Patron wall feature, opted-in display names only |
| DD-V2-154 | Subscription content-volume gate: 3,000 facts before enabling |
| DD-V2-159 | Push auto-stop after 7 consecutive days of silence |
| DD-V2-160 | Win-back tiers: gentle nudge → GAIA letter → seasonal chest |
| DD-V2-094 | Azure Neural TTS for vocabulary pronunciation; language-specific voices |
| DD-V2-195 | Azure Cognitive Services TTS primary; ElevenLabs fallback (future) |
| DD-V2-270 | Argon2id + JWT auth (already implemented) |
| DD-V2-271 | ES256 JWT signing in production |

---

## Sub-phases

---

### 26.1 — Mount All Unregistered Server Routes

**Goal**: Every route file in `server/src/routes/` is imported and registered in
`server/src/index.ts` under a consistent URL prefix. No route file is orphaned.

#### Routes currently NOT mounted (confirmed by reading index.ts)
| File | Status | Target prefix |
|------|--------|---------------|
| `audio.ts` | unmounted | `/api/audio` |
| `iap.ts` | unmounted | `/api/iap` |
| `patrons.ts` | unmounted | `/api/patrons` |
| `seasonPass.ts` | unmounted | `/api/season-pass` |
| `subscriptions.ts` | unmounted | `/api/subscriptions` |

The following are already mounted in index.ts and require no change:
`health`, `auth`, `saves`, `leaderboards`, `facts`, `factPacks`, `analytics`,
`admin`, `seasons`, `notifications`, `ugc`, `email`.

**Note on export style inconsistency**: `audio.ts`, `notifications.ts`, `ugc.ts`,
and `email.ts` export named functions (`audioRoutes`, `notificationRoutes`, etc.).
`iap.ts`, `patrons.ts`, `seasonPass.ts`, and `subscriptions.ts` use
`export default`. Normalise all unmounted files to **named exports** to match the
project convention before registering them.

#### Implementation steps

**Step 1** — Normalise export styles in unmounted route files.

`server/src/routes/iap.ts` — change the export from `export default` to named:
```ts
export async function iapRoutes(fastify: FastifyInstance): Promise<void> {
  // ... existing body unchanged
}
```
Remove the `export default` keyword; make it a named export throughout.

Apply the same transformation to:
- `server/src/routes/patrons.ts` → `export async function patronRoutes`
- `server/src/routes/seasonPass.ts` → `export async function seasonPassRoutes`
- `server/src/routes/subscriptions.ts` → `export async function subscriptionRoutes`

**Step 2** — Add imports and registrations to `server/src/index.ts`.

Add imports after the existing import block (around line 22):
```ts
import { audioRoutes }        from './routes/audio.js'
import { iapRoutes }          from './routes/iap.js'
import { patronRoutes }       from './routes/patrons.js'
import { seasonPassRoutes }   from './routes/seasonPass.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
```

Add registrations in `buildApp()` after the existing `emailRoutes` registration:
```ts
await fastify.register(audioRoutes,        { prefix: '/api/audio' })
await fastify.register(iapRoutes,          { prefix: '/api/iap' })
await fastify.register(patronRoutes,       { prefix: '/api/patrons' })
await fastify.register(seasonPassRoutes,   { prefix: '/api/season-pass' })
await fastify.register(subscriptionRoutes, { prefix: '/api/subscriptions' })
```

**Step 3** — Verify internal route paths do not double-prefix.

Each route file must register paths as relative (e.g. `'/verify'`, `'/:factId'`),
not absolute (e.g. `'/api/iap/verify'`). Fastify applies the prefix from `register`
and doubles it if the path also carries the prefix. Audit and fix:

- `audio.ts` line `app.get('/api/audio/:factId', ...)` must become `app.get('/:factId', ...)`
- `iap.ts` lines with `'/api/iap/verify'` and `'/api/iap/restore'` must become `'/verify'` and `'/restore'`
- `patrons.ts` line with `'/api/patrons/wall'` must become `'/wall'`
- `seasonPass.ts` line with `'/api/season/current'` must become `'/current'`
- `subscriptions.ts` lines with `'/api/subscriptions/...'` must drop the prefix

#### Acceptance criteria
- [ ] `npm run build --prefix server` compiles with zero TypeScript errors
- [ ] `curl http://localhost:3001/api/audio/nonexistent` returns `{"error":"Audio not found"}` with status 404 (route reached, not Fastify's generic 404)
- [ ] `curl -X POST http://localhost:3001/api/iap/verify -H 'Content-Type: application/json' -d '{}'` returns `400 missing_fields`
- [ ] `curl http://localhost:3001/api/patrons/wall` returns `{ "patrons": [], "total": 0 }`
- [ ] `curl http://localhost:3001/api/season-pass/current` returns a season object with an `id` field
- [ ] `curl http://localhost:3001/api/subscriptions/status` returns subscription status JSON with a `tiers` array
- [ ] No route returns `{"error":"Route not found","statusCode":404}` for the paths listed above

---

### 26.2 — RevenueCat Webhook + IAP Validation

**Goal**: Replace the receipt-verification stub with real RevenueCat REST API
validation. Implement the RevenueCat S2S webhook so subscription state is updated
server-side without relying on the client.

#### Background
RevenueCat is a unified IAP abstraction that handles Apple App Store and Google
Play receipts. The server validates purchases in two ways:
1. **Client-initiated verification** — client calls `POST /api/iap/verify` after
   purchase; server forwards to RevenueCat REST v2 API.
2. **RevenueCat webhook** — RevenueCat posts events (INITIAL_PURCHASE, RENEWAL,
   CANCELLATION, etc.) to `POST /api/iap/webhook`. The server verifies the
   `Authorization` header against `REVENUECAT_WEBHOOK_SECRET`.

#### New environment variables (added in 26.6)
```
REVENUECAT_API_KEY=appl_xxxxxxxxxxxx   # RevenueCat server API key
REVENUECAT_WEBHOOK_SECRET=rc_whsec_xx  # Authorization header value for webhooks
```

#### Implementation steps

**Step 1** — Create `server/src/types/revenuecat.ts` (new file):
```ts
/** Subscriber response from RevenueCat REST v1 API */
export interface RCSubscriberResponse {
  subscriber: {
    subscriptions: Record<string, {
      expires_date: string        // ISO 8601
      purchase_date: string
      product_identifier: string
      period_type: 'normal' | 'trial'
      is_sandbox: boolean
    }>
    entitlements: Record<string, {
      expires_date: string | null
      product_identifier: string
    }>
    non_subscriptions: Record<string, { id: string; purchase_date: string }[]>
  }
}

/** S2S webhook event posted by RevenueCat */
export interface RCWebhookEvent {
  event: {
    type: 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'EXPIRATION'
           | 'PRODUCT_CHANGE' | 'NON_RENEWING_PURCHASE'
    app_user_id: string
    product_id: string
    period_type: 'normal' | 'trial'
    expiration_at_ms: number
    purchased_at_ms: number
    environment: 'SANDBOX' | 'PRODUCTION'
  }
}
```

**Step 2** — Create `server/src/services/revenuecatService.ts` (new file):
```ts
import { config } from '../config.js'
import type { RCSubscriberResponse } from '../types/revenuecat.js'

const RC_BASE = 'https://api.revenuecat.com/v1'

/**
 * Fetch subscriber info from RevenueCat REST API.
 * Called after a client purchase to verify the transaction.
 */
export async function getSubscriber(appUserId: string): Promise<RCSubscriberResponse> {
  const res = await fetch(`${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      'Authorization': `Bearer ${config.revenuecatApiKey}`,
    },
  })
  if (!res.ok) {
    throw new Error(`RevenueCat API error: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<RCSubscriberResponse>
}

/**
 * Verify a webhook request by comparing the Authorization header to the
 * shared webhook secret. Returns true if the request is authentic.
 */
export function verifyWebhookSecret(authHeader: string | undefined): boolean {
  if (!authHeader) return false
  if (!config.revenuecatWebhookSecret) return false
  return authHeader === config.revenuecatWebhookSecret
}

/** Map a RevenueCat product ID to our internal subscription tier name. */
export function productIdToTier(productId: string): string | null {
  const MAP: Record<string, string> = {
    'com.terragacha.terrapass.monthly': 'terra_pass',
    'com.terragacha.patron.season':     'expedition_patron',
    'com.terragacha.patron.annual':     'grand_patron',
  }
  return MAP[productId] ?? null
}
```

**Step 3** — Update `server/src/routes/iap.ts`. Replace the stub `POST /verify`
handler with real RC validation, and add a new `POST /webhook` handler:

```ts
import { getSubscriber, verifyWebhookSecret, productIdToTier } from '../services/revenuecatService.js'
import type { RCWebhookEvent } from '../types/revenuecat.js'

// POST /verify
fastify.post('/verify', async (request, reply) => {
  const body = request.body as Record<string, unknown>
  const productId = body?.productId as string
  const appUserId = body?.appUserId as string

  if (!productId || !appUserId) {
    return reply.status(400).send({ error: 'missing_fields', message: 'productId and appUserId are required' })
  }

  if (!config.revenuecatApiKey) {
    // Dev/sandbox mode: accept all purchases without hitting RC
    return { valid: true, productId, tier: productIdToTier(productId), sandbox: true }
  }

  try {
    const subscriber = await getSubscriber(appUserId)
    const sub = subscriber.subscriber.subscriptions[productId]
    if (!sub) {
      return reply.status(404).send({ error: 'no_subscription_found', productId })
    }
    const expiresAt = new Date(sub.expires_date)
    const valid = expiresAt > new Date()
    return {
      valid,
      productId,
      tier: productIdToTier(productId),
      expiresAt: sub.expires_date,
      sandbox: sub.is_sandbox,
    }
  } catch (err) {
    fastify.log.error(err, 'RevenueCat verify error')
    return reply.status(502).send({ error: 'upstream_error', message: 'Could not verify with RevenueCat' })
  }
})

// POST /webhook
fastify.post('/webhook', async (request, reply) => {
  const authHeader = request.headers['authorization'] as string | undefined
  if (!verifyWebhookSecret(authHeader)) {
    return reply.status(401).send({ error: 'invalid_webhook_secret' })
  }

  const event = (request.body as RCWebhookEvent).event
  const { type, app_user_id, product_id, expiration_at_ms } = event

  fastify.log.info({ type, app_user_id, product_id }, 'RevenueCat webhook received')

  const tier = productIdToTier(product_id)
  const expiresAt = new Date(expiration_at_ms).toISOString()

  if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL') {
    // Production: db.upsertSubscription(app_user_id, { tier, expiresAt })
    fastify.log.info({ app_user_id, tier, expiresAt }, 'Subscription activated/renewed')
  } else if (type === 'CANCELLATION' || type === 'EXPIRATION') {
    // Production: db.expireSubscription(app_user_id)
    fastify.log.info({ app_user_id }, 'Subscription cancelled/expired')
  }

  return reply.status(200).send({ received: true })
})
```

**Step 4** — Add `revenuecatApiKey` and `revenuecatWebhookSecret` to
`server/src/config.ts` (detailed in 26.6).

**Step 5** — Update client `src/services/iapService.ts` so the `purchaseProduct`
function includes `appUserId` (read from `authStore`) when calling
`POST /api/iap/verify`.

#### Acceptance criteria
- [ ] `POST /api/iap/verify` with `{ productId, appUserId }` returns `{ valid: bool, tier }` in dev (sandbox) mode without errors
- [ ] `POST /api/iap/webhook` returns `401` when the `Authorization` header is absent or wrong
- [ ] `POST /api/iap/webhook` with correct secret header returns `200 { received: true }`
- [ ] `server/src/types/revenuecat.ts` compiles without errors
- [ ] `server/src/services/revenuecatService.ts` compiles without errors
- [ ] `verifyWebhookSecret(undefined)` returns `false`
- [ ] `verifyWebhookSecret('')` returns `false`
- [ ] In production mode (`REVENUECAT_API_KEY` set), verify calls the live RC REST API

---

### 26.3 — Resend Email Integration

**Goal**: Replace `emailService.ts`'s `console.log` stub with live delivery via
[Resend](https://resend.com). Resend's REST API requires only `fetch` and a single
API key — no npm SDK needed.

#### New environment variables
```
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=GAIA <gaia@terra-gacha.app>
EMAIL_UNSUBSCRIBE_BASE_URL=https://terra-gacha.app/api/email/unsubscribe
```

#### Implementation steps

**Step 1** — Update `server/src/services/emailService.ts`. Replace the stub
`sendEmail` function with a Resend REST implementation. Keep all existing exported
types and builder functions unchanged; only `sendEmail` changes:

```ts
import { config } from '../config.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEND_API = 'https://api.resend.com/emails'

/** Load an HTML template and interpolate {{variable}} placeholders. */
function renderTemplate(template: EmailTemplate, variables: Record<string, string | number>): string {
  const name = template.replace(/_/g, '-')
  const filePath = join(__dirname, '..', 'templates', 'email', `${name}.html`)
  let html = readFileSync(filePath, 'utf-8')
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, String(value))
  }
  return html
}

/**
 * Send a transactional email via Resend REST API.
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; messageId?: string }> {
  if (!config.resendApiKey) {
    console.log(`[EmailService] DEV — would send "${payload.subject}" to ${payload.to}`)
    console.log('[EmailService] Variables:', payload.variables)
    return { sent: true, messageId: `dev-${Date.now()}` }
  }

  const unsubscribeUrl =
    `${config.emailUnsubscribeBaseUrl}?token=PLACEHOLDER_TOKEN`
  const html = renderTemplate(payload.template, { ...payload.variables, unsubscribeUrl })

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.fromEmail ?? 'GAIA <gaia@terra-gacha.app>',
      to: [payload.to],
      subject: payload.subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }

  const data = await res.json() as { id: string }
  return { sent: true, messageId: data.id }
}
```

**Step 2** — Add a `'welcome'` member to the `EmailTemplate` union type and create
`server/src/templates/email/welcome.html` (new file). Key template placeholders:
`{{playerName}}`, `{{verifyUrl}}`, `{{unsubscribeUrl}}`. Matches the visual style
of the existing `gaia-letter.html` (dark sci-fi, monospace font, `#e94560` accent).

**Step 3** — Add a welcome email send inside the register route handler in
`server/src/routes/auth.ts`, after successful account creation:

```ts
// After creating the user:
sendEmail({
  to: email,
  subject: 'Welcome to Terra Gacha',
  template: 'welcome',
  variables: { playerName: username },
}).catch(err => fastify.log.warn(err, 'Welcome email failed (non-fatal)'))
```

Always wrap in `.catch()` so a failing email never blocks registration.

**Step 4** — Update `server/src/jobs/winBackCron.ts` to call `sendEmail` directly
instead of the re-export stub. The job now has the real implementation behind it.

**Step 5** — Remove deprecated SMTP fields from `server/src/config.ts`
(`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`) — these were pre-Resend
placeholders that are now superseded. Update the `Config` interface and config
object accordingly.

**Step 6** — Add `resendApiKey` and `emailUnsubscribeBaseUrl` to
`server/src/config.ts` (detailed in 26.6).

#### Acceptance criteria
- [ ] In dev mode (no `RESEND_API_KEY`), calling `sendEmail()` logs to console and returns `{ sent: true }` without errors
- [ ] `server/src/services/emailService.ts` compiles with zero TS errors
- [ ] HTML templates are loaded from disk at send time; no HTML is hardcoded in the service
- [ ] `POST /api/email/win-back` triggers a `sendEmail()` call (verifiable via console log in dev)
- [ ] `GET /api/email/unsubscribe?token=x` returns `{ unsubscribed: true }`
- [ ] SMTP config fields (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`) are fully removed from the `Config` interface with no resulting TS errors
- [ ] `welcome.html` template exists at `server/src/templates/email/welcome.html`

---

### 26.4 — FCM/APNs Push Notification Service

**Goal**: Replace the notification scheduler stub with real push delivery via
Firebase Cloud Messaging (FCM), which covers both Android (FCM native) and iOS
(APNs via FCM). Device tokens are stored per-user. A daily cron dispatches
win-back and reminder pushes.

#### Architecture
- Client registers a device token via `POST /api/notifications/register` (stub already exists)
- Server stores `{ userId, token, platform, registeredAt }` in an in-memory map (production: `device_tokens` table)
- Push worker sends via FCM HTTP v1 API using an OAuth2 JWT service-account grant
- No external npm SDK — only Node.js built-in `crypto` and `fetch`

#### New environment variables
```
FCM_PROJECT_ID=terra-gacha-12345
FCM_CLIENT_EMAIL=firebase-adminsdk@terra-gacha-12345.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Values come from the Firebase Console service account JSON. The private key must
be stored as a Docker secret in production (see 26.6).

#### Implementation steps

**Step 1** — Create `server/src/services/pushService.ts` (new file). Uses Node.js
`crypto` for JWT signing (no googleapis SDK):

```ts
import { config } from '../config.js'

const FCM_URL =
  `https://fcm.googleapis.com/v1/projects/${config.fcmProjectId}/messages:send`

/** Cached short-lived OAuth2 token with expiry tracking */
let cachedToken: { token: string; expiresAt: number } | null = null

/** Build a minimal RS256 JWT grant and exchange it for an FCM access token. */
async function getFCMToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss:   config.fcmClientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(
    config.fcmPrivateKey.replace(/\\n/g, '\n'), 'base64url'
  )

  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  if (!res.ok) throw new Error(`FCM token error: ${res.status}`)

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    token:     data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.token
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Send a push notification to one device token via FCM HTTP v1.
 * Returns true on success. Returns false if the token is no longer valid
 * (caller should remove it from the database).
 * In dev mode (no FCM_PROJECT_ID), logs to console and returns true.
 */
export async function sendPush(deviceToken: string, payload: PushPayload): Promise<boolean> {
  if (!config.fcmProjectId || !config.fcmPrivateKey) {
    console.log(`[Push] DEV — "${payload.title}" → ...${deviceToken.slice(-8)}`)
    return true
  }

  const accessToken = await getFCMToken()

  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'normal' },
        apns:    { headers: { 'apns-priority': '5' } },
      },
    }),
  })

  if (res.status === 404 || res.status === 410) return false  // Token unregistered
  if (!res.ok) throw new Error(`FCM send error ${res.status}: ${await res.text()}`)
  return true
}

/**
 * Send a push to multiple tokens. Returns an array of invalid tokens that
 * should be removed from the database.
 */
export async function sendPushBatch(
  tokens: string[],
  payload: PushPayload
): Promise<{ invalidTokens: string[] }> {
  const invalidTokens: string[] = []
  for (const token of tokens) {
    const valid = await sendPush(token, payload)
    if (!valid) invalidTokens.push(token)
  }
  return { invalidTokens }
}
```

**Step 2** — Add FCM config fields to `server/src/config.ts` (detailed in 26.6):
```ts
fcmProjectId:   string
fcmClientEmail: string
fcmPrivateKey:  string
```

**Step 3** — Update `server/src/routes/notifications.ts` to persist device tokens
in an in-memory store and add an admin-only test endpoint:

```ts
// Module-scope token store (production: replaces with DB table)
const tokenStore = new Map<string, {
  userId: string | null
  platform: string
  registeredAt: string
}>()

// POST /register — store the token
// Extract userId from JWT if present (optional auth)
tokenStore.set(token, {
  userId: null,   // production: extract from request.user.id
  platform,
  registeredAt: new Date().toISOString(),
})
return reply.send({ registered: true, tokenCount: tokenStore.size })

// POST /send-test (admin only)
app.post('/send-test', async (req, reply) => {
  const adminKey = req.headers['x-admin-key'] as string
  if (adminKey !== config.adminApiKey) {
    return reply.status(403).send({ error: 'Forbidden' })
  }
  const { token, title, body } = req.body as { token: string; title: string; body: string }
  if (!token) return reply.status(400).send({ error: 'token required' })
  const { sendPush } = await import('../services/pushService.js')
  const valid = await sendPush(token, { title, body })
  return reply.send({ sent: valid, tokenValid: valid })
})
```

**Step 4** — Update `server/src/jobs/winBackCron.ts` to call `sendPush` for
players whose win-back channel is `push`:

```ts
import { sendPush } from '../services/pushService.js'
import { getNotificationBody } from '../services/notificationScheduler.js'

// In the player iteration loop (production: replace comment with real DB query):
// if (action.channel === 'push' && player.deviceToken) {
//   const { title, body } = getNotificationBody('win_back', {
//     daysSince: daysSince, factsCount: player.factsCount
//   })
//   const valid = await sendPush(player.deviceToken, { title, body })
//   if (!valid) { /* remove stale token from DB */ }
// }
```

#### Acceptance criteria
- [ ] `server/src/services/pushService.ts` compiles with zero TS errors
- [ ] In dev mode (no `FCM_PROJECT_ID`), `sendPush()` logs to console and returns `true` without errors
- [ ] `POST /api/notifications/register` stores the token and returns `{ registered: true }`
- [ ] `POST /api/notifications/send-test` without `X-Admin-Key` returns `403`
- [ ] `POST /api/notifications/send-test` with correct admin key returns `{ sent: true }` in dev mode
- [ ] `getFCMToken()` does not import any external npm package; uses only `crypto` and `fetch`
- [ ] `shouldSendNotification()` from `notificationScheduler.ts` is called (or its logic honoured) before any real push is dispatched

---

### 26.5 — Azure TTS Pronunciation Engine

**Goal**: Replace the `ttsService.ts` stub with a live Azure Cognitive Services
Neural TTS implementation via the REST API (no npm SDK — avoid new dependencies).
Audio files are generated on demand or via batch script, stored in `data/audio/`,
and served by the existing `audioRoutes`.

#### New environment variables
```
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=eastus
```

#### Implementation steps

**Step 1** — Replace `server/src/services/ttsService.ts` entirely. Keep the same
exported function signatures (`generatePronunciationAudio`, `batchGenerateAudio`,
`TTSResult`) so callers require no changes:

```ts
import { config } from '../config.js'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

/** Neural voice assignments per BCP-47 language tag (DD-V2-094) */
const VOICE_MAP: Record<string, string> = {
  ja: 'ja-JP-NanamiNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ko: 'ko-KR-SunHiNeural',
  en: 'en-US-JennyNeural',
}

export interface TTSResult {
  success: boolean
  outputPath?: string
  error?: string
}

/** Build SSML markup for a single utterance with slight slow-down for learners. */
function buildSSML(text: string, voice: string): string {
  const lang = voice.split('-').slice(0, 2).join('-')
  return [
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">`,
    `  <voice name="${voice}">`,
    `    <prosody rate="0.85">${text}</prosody>`,
    `  </voice>`,
    `</speak>`,
  ].join('\n')
}

/**
 * Generate pronunciation audio for a single vocabulary item via Azure TTS REST API.
 * In dev (no AZURE_SPEECH_KEY), logs the intent and returns { success: false }.
 */
export async function generatePronunciationAudio(
  factId: string,
  language: string,
  text: string,
  outputPath: string
): Promise<TTSResult> {
  const voice = VOICE_MAP[language]
  if (!voice) {
    return { success: false, error: `No voice configured for language: ${language}` }
  }

  if (!config.azureSpeechKey || !config.azureSpeechRegion) {
    console.log(`[TTS] Stub: ${factId} → ${outputPath} (${language}/${voice})`)
    return { success: false, error: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not configured' }
  }

  const endpoint =
    `https://${config.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`
  const ssml = buildSSML(text, voice)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.azureSpeechKey,
      'Content-Type':              'application/ssml+xml',
      'X-Microsoft-OutputFormat':  'audio-16khz-128kbitrate-mono-mp3',
      'User-Agent':                'TerraGachaServer/1.0',
    },
    body: ssml,
  })

  if (!res.ok) {
    const msg = await res.text()
    return { success: false, error: `Azure TTS ${res.status}: ${msg}` }
  }

  const audioBytes = Buffer.from(await res.arrayBuffer())
  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'))
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(outputPath, audioBytes)

  return { success: true, outputPath }
}

/**
 * Batch-generate audio for vocabulary facts.
 * Throttles to ~4.7 req/s to stay within Azure free-tier rate limits.
 * Skips facts whose output file already exists.
 */
export async function batchGenerateAudio(
  facts: { id: string; word: string; reading?: string; language: string }[],
  outputDir: string
): Promise<{ generated: number; failed: number; errors: string[] }> {
  let generated = 0
  let failed = 0
  const errors: string[] = []

  for (const fact of facts) {
    const text       = fact.reading ?? fact.word
    const outputPath = `${outputDir}/${fact.id}_recognition.mp3`

    if (existsSync(outputPath)) { generated++; continue }

    const result = await generatePronunciationAudio(fact.id, fact.language, text, outputPath)
    if (result.success) {
      generated++
    } else {
      failed++
      errors.push(`${fact.id}: ${result.error}`)
    }

    // 210ms gap → ~4.7 req/s, safely under Azure 5 req/s free-tier limit
    await new Promise(r => setTimeout(r, 210))

    if ((generated + failed) % 10 === 0) {
      console.log(`[TTS] ${generated + failed}/${facts.length} (${generated} ok, ${failed} failed)`)
    }
  }

  return { generated, failed, errors }
}
```

**Step 2** — Add `azureSpeechKey` and `azureSpeechRegion` to `server/src/config.ts`
(detailed in 26.6).

**Step 3** — Add an admin-only `POST /generate` route to `server/src/routes/audio.ts`
for on-demand TTS generation:

```ts
app.post('/generate', async (req, reply) => {
  const adminKey = req.headers['x-admin-key'] as string
  if (adminKey !== config.adminApiKey) {
    return reply.status(403).send({ error: 'Forbidden' })
  }
  const { factId, language, text } = req.body as {
    factId: string; language: string; text: string
  }
  if (!factId || !language || !text) {
    return reply.status(400).send({ error: 'factId, language, text required' })
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(factId)) {
    return reply.status(400).send({ error: 'Invalid factId format' })
  }
  const outputPath = `${process.cwd()}/data/audio/${factId}_recognition.mp3`
  const { generatePronunciationAudio } = await import('../services/ttsService.js')
  const result = await generatePronunciationAudio(factId, language, text, outputPath)
  if (!result.success) {
    return reply.status(500).send({ error: result.error })
  }
  return reply.send({ generated: true, outputPath: result.outputPath })
})
```

**Step 4** — Update `server/src/scripts/fact-count-check.ts` (existing file) to
also report audio file coverage: how many `data/audio/*.mp3` files exist vs. the
total count of vocabulary facts in the database. This gives operators visibility
into TTS pipeline progress.

#### Acceptance criteria
- [ ] `server/src/services/ttsService.ts` compiles with zero TS errors
- [ ] In dev mode (no `AZURE_SPEECH_KEY`), `generatePronunciationAudio()` returns `{ success: false, error: '...' }` without throwing
- [ ] `POST /api/audio/generate` requires `X-Admin-Key`; returns `403` without it
- [ ] `POST /api/audio/generate` with invalid `factId` (e.g. containing `../`) returns `400`
- [ ] `GET /api/audio/:factId` still streams existing MP3 files correctly
- [ ] SSML output uses `prosody rate="0.85"` for learner-friendly pacing
- [ ] `batchGenerateAudio` throttles with 210ms delay between requests
- [ ] Batch skips already-generated files (idempotent re-run)

---

### 26.6 — Environment Configuration & Docker Secrets

**Goal**: All environment variables are documented in `.env.example`, validated at
boot time with clear error messages, injectable via Docker secrets in production,
and surfaced by a `/api/health/ready` endpoint. The existing `docker-compose.prod.yml`
(Phase 20) is updated to use Docker secrets for sensitive values.

#### Implementation steps

**Step 1** — Create `server/.env.example` (new file — safe to commit, no real values):

```env
# ── Core ─────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
JWT_SECRET=change-me-minimum-64-chars-random-string
JWT_EXPIRY=15m
REFRESH_EXPIRY=7d
DATABASE_URL=postgresql://user:password@localhost:5432/terra_gacha
CORS_ORIGIN=https://terra-gacha.app
ADMIN_API_KEY=change-me-admin-key

# ── Content pipeline ──────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
COMFYUI_URL=http://localhost:8188
DISTRACTOR_CONFIDENCE_THRESHOLD=0.7

# ── Monetisation (RevenueCat) ─────────────────────────────────────────────────
REVENUECAT_API_KEY=appl_...
REVENUECAT_WEBHOOK_SECRET=rc_whsec_...

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
FROM_EMAIL=GAIA <gaia@terra-gacha.app>
PASSWORD_RESET_BASE_URL=https://terra-gacha.app/reset-password
EMAIL_UNSUBSCRIBE_BASE_URL=https://terra-gacha.app/api/email/unsubscribe

# ── Push Notifications (FCM) ──────────────────────────────────────────────────
FCM_PROJECT_ID=terra-gacha-12345
FCM_CLIENT_EMAIL=firebase-adminsdk@terra-gacha-12345.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXX\n-----END PRIVATE KEY-----\n"

# ── TTS (Azure Cognitive Services) ───────────────────────────────────────────
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=eastus

# ── Rate limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW_MS=60000
```

**Step 2** — Extend `server/src/config.ts` with all new fields and remove
deprecated SMTP fields. Add a `readDockerSecret` helper:

```ts
/** Read an env var, falling back to a Docker secret file at /run/secrets/<secretName>. */
function readDockerSecret(envKey: string, secretName: string): string {
  const fromEnv = process.env[envKey]
  if (fromEnv) return fromEnv
  try {
    const { readFileSync } = require('fs') as typeof import('fs')
    return readFileSync(`/run/secrets/${secretName}`, 'utf-8').trim()
  } catch {
    return ''
  }
}
```

New fields in the `Config` interface:
```ts
revenuecatApiKey:        string
revenuecatWebhookSecret: string
resendApiKey:            string
emailUnsubscribeBaseUrl: string
fcmProjectId:            string
fcmClientEmail:          string
fcmPrivateKey:           string
azureSpeechKey:          string
azureSpeechRegion:       string
```

Remove from `Config` interface: `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`
(replaced by Resend).

Config object additions:
```ts
revenuecatApiKey:       readDockerSecret('REVENUECAT_API_KEY', 'revenuecat_api_key'),
revenuecatWebhookSecret:readDockerSecret('REVENUECAT_WEBHOOK_SECRET', 'revenuecat_webhook_secret'),
resendApiKey:           readDockerSecret('RESEND_API_KEY', 'resend_api_key'),
emailUnsubscribeBaseUrl:env('EMAIL_UNSUBSCRIBE_BASE_URL', 'http://localhost:3001/api/email/unsubscribe'),
fcmProjectId:           envOptional('FCM_PROJECT_ID', ''),
fcmClientEmail:         envOptional('FCM_CLIENT_EMAIL', ''),
fcmPrivateKey:          readDockerSecret('FCM_PRIVATE_KEY', 'fcm_private_key'),
azureSpeechKey:         readDockerSecret('AZURE_SPEECH_KEY', 'azure_speech_key'),
azureSpeechRegion:      envOptional('AZURE_SPEECH_REGION', 'eastus'),
```

**Step 3** — Add `validateProductionConfig()` to `server/src/config.ts`:

```ts
/**
 * Validate production-critical variables at boot. Call this inside start()
 * before buildApp(). Exits the process with a descriptive error on failure.
 */
export function validateProductionConfig(): void {
  if (!config.isProduction) return

  const required: [keyof Config, string][] = [
    ['jwtSecret',              'JWT_SECRET (min 64 chars, random)'],
    ['adminApiKey',            'ADMIN_API_KEY'],
    ['revenuecatApiKey',       'REVENUECAT_API_KEY'],
    ['revenuecatWebhookSecret','REVENUECAT_WEBHOOK_SECRET'],
    ['resendApiKey',           'RESEND_API_KEY'],
  ]

  const missing = required.filter(([key]) => !config[key])
  if (missing.length > 0) {
    console.error('[Config] FATAL: Missing required production environment variables:')
    for (const [, label] of missing) console.error(`  - ${label}`)
    process.exit(1)
  }

  if (config.jwtSecret.length < 64) {
    console.error('[Config] FATAL: JWT_SECRET must be at least 64 characters in production')
    process.exit(1)
  }
}
```

Call `validateProductionConfig()` in `server/src/index.ts` inside `start()`,
before `buildApp()`.

**Step 4** — Extend `/api/health` in `server/src/routes/health.ts` with a
`GET /ready` route:

```ts
app.get('/ready', async (_req, reply) => {
  const integrations = {
    revenuecat: Boolean(config.revenuecatApiKey),
    resend:     Boolean(config.resendApiKey),
    fcm:        Boolean(config.fcmProjectId && config.fcmPrivateKey),
    azureTts:   Boolean(config.azureSpeechKey),
  }
  const allReady = Object.values(integrations).every(Boolean)
  return reply.status(allReady ? 200 : 206).send({
    status: allReady ? 'ready' : 'partial',
    integrations,
    environment: config.nodeEnv,
  })
})
```

**Step 5** — Update `docker-compose.prod.yml` (from Phase 20) to reference Docker
secrets for sensitive values:

```yaml
# In the server service, add:
secrets:
  - jwt_secret
  - revenuecat_api_key
  - revenuecat_webhook_secret
  - resend_api_key
  - fcm_private_key
  - azure_speech_key

# At the top level, declare secrets as external (created via `docker secret create`):
secrets:
  jwt_secret:
    external: true
  revenuecat_api_key:
    external: true
  revenuecat_webhook_secret:
    external: true
  resend_api_key:
    external: true
  fcm_private_key:
    external: true
  azure_speech_key:
    external: true
```

**Step 6** — Schedule the win-back cron in `server/src/index.ts` inside `start()`,
after DB schema init, before `buildApp()`:

```ts
const { runWinBackCron } = await import('./jobs/winBackCron.js')
// Run once at startup after 30-second warm-up delay
setTimeout(() => runWinBackCron().catch(console.error), 30_000)
// Run daily thereafter
setInterval(() => {
  runWinBackCron().catch(err => console.error('[Cron] Win-back failed:', err))
}, 86_400_000)
```

#### Acceptance criteria
- [ ] `server/.env.example` exists and documents all 20+ environment variables
- [ ] `GET /api/health/ready` returns `{ status, integrations, environment }` — `206` when any integration is unconfigured, `200` when all are configured
- [ ] `validateProductionConfig()` is exported from config.ts and called in `start()`
- [ ] `npm run build --prefix server` passes with updated Config type (SMTP fields removed, new fields added)
- [ ] `docker-compose.prod.yml` declares Docker secrets for all sensitive values
- [ ] Win-back cron is scheduled in `start()` with 30-second initial delay
- [ ] No hardcoded API keys or tokens anywhere in source files

---

### 26.7 — Integration Smoke Tests

**Goal**: A single executable script at `server/scripts/smoke-test.ts` exercises
every mounted route, verifying the server responds with the expected HTTP status
code. Run by the CI pipeline and by operators after each deploy.

#### Implementation steps

**Step 1** — Create `server/scripts/smoke-test.ts` (new file):

```ts
#!/usr/bin/env npx tsx
/**
 * Smoke test: hits every mounted route with minimal requests.
 * Run: SERVER_URL=http://localhost:3001 npx tsx server/scripts/smoke-test.ts
 */

const BASE = process.env.SERVER_URL ?? 'http://localhost:3001'
const ADMIN = process.env.ADMIN_API_KEY ?? 'dev-admin-key-change-me'
let passed = 0
let failed = 0

async function check(
  label: string,
  url: string,
  opts: RequestInit = {},
  expected = 200
): Promise<void> {
  try {
    const res = await fetch(`${BASE}${url}`, opts)
    if (res.status === expected) {
      console.log(`  PASS  [${res.status}] ${label}`)
      passed++
    } else {
      console.error(`  FAIL  [${res.status}] ${label} (expected ${expected})`)
      failed++
    }
  } catch (err) {
    console.error(`  FAIL  ${label} — ${(err as Error).message}`)
    failed++
  }
}

const J = { 'Content-Type': 'application/json' }
const A = { ...J, 'X-Admin-Key': ADMIN }

;(async () => {
  console.log(`\nSmoke test → ${BASE}\n`)

  await check('GET /api/health',                    '/api/health')
  await check('GET /api/health/ready',              '/api/health/ready',              {}, 200)

  await check('GET /api/facts',                     '/api/facts?limit=5')
  await check('GET /api/facts/packs',               '/api/facts/packs')
  await check('GET /api/leaderboards',              '/api/leaderboards')
  await check('GET /api/seasons/active',            '/api/seasons/active')
  await check('GET /api/subscriptions/status',      '/api/subscriptions/status')
  await check('GET /api/patrons/wall',              '/api/patrons/wall')
  await check('GET /api/season-pass/current',       '/api/season-pass/current')
  await check('GET /api/notifications/preferences', '/api/notifications/preferences')

  await check('POST /api/auth/register (empty)',    '/api/auth/register',
    { method: 'POST', headers: J, body: '{}' }, 400)
  await check('POST /api/iap/verify (empty)',       '/api/iap/verify',
    { method: 'POST', headers: J, body: '{}' }, 400)
  await check('POST /api/iap/webhook (no auth)',    '/api/iap/webhook',
    { method: 'POST', headers: J, body: '{}' }, 401)
  await check('POST /api/ugc/submit (empty)',       '/api/ugc/submit',
    { method: 'POST', headers: J, body: '{}' }, 400)

  await check('GET /api/audio/:nonexistent',        '/api/audio/no_such_fact_xyz', {}, 404)
  await check('GET /api/email/unsubscribe (no tok)','/api/email/unsubscribe',        {}, 400)

  await check('POST /api/notifications/send-test (no auth)', '/api/notifications/send-test',
    { method: 'POST', headers: J, body: '{}' }, 403)
  await check('POST /api/audio/generate (no auth)','/api/audio/generate',
    { method: 'POST', headers: J, body: '{}' }, 403)

  await check('GET /api/does-not-exist (404)',      '/api/does-not-exist', {}, 404)

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
  process.exit(failed > 0 ? 1 : 0)
})()
```

**Step 2** — Add the `smoke-test` script to `server/package.json`:
```json
"scripts": {
  "smoke-test": "npx tsx scripts/smoke-test.ts"
}
```

#### Acceptance criteria
- [ ] `npm run smoke-test --prefix server` exits with code 0 when dev server is running
- [ ] Every route check prints `PASS` with the expected status code
- [ ] Script exits with code 1 if any check fails
- [ ] Output is human-readable with one `PASS/FAIL` line per route

---

## Playwright Test Scripts

The following scripts verify the backend integration from the running application's
perspective. Both the dev server (`npm run dev`) and backend
(`npm run dev --prefix server`) must be running.

### Test: All routes reachable

```js
// Write to /tmp/test-routes-26.js and run: node /tmp/test-routes-26.js
const BASE = 'http://localhost:3001'
const J = { 'Content-Type': 'application/json' }

async function check(label, url, method = 'GET', body = null, expected = 200) {
  const opts = { method, headers: J, ...(body ? { body: JSON.stringify(body) } : {}) }
  const res = await fetch(`${BASE}${url}`, opts)
  const ok = res.status === expected
  console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${label}`)
  return ok
}

;(async () => {
  const results = await Promise.all([
    check('health/ready',             '/api/health/ready'),
    check('subscriptions/status',     '/api/subscriptions/status'),
    check('patrons/wall',             '/api/patrons/wall'),
    check('season-pass/current',      '/api/season-pass/current'),
    check('seasons/active',           '/api/seasons/active'),
    check('notifications/prefs',      '/api/notifications/preferences'),
    check('audio 404',                '/api/audio/fakefact', 'GET', null, 404),
    check('iap verify empty→400',     '/api/iap/verify', 'POST', {}, 400),
    check('iap webhook no auth→401',  '/api/iap/webhook', 'POST', {}, 401),
    check('ugc submit empty→400',     '/api/ugc/submit', 'POST', {}, 400),
  ])
  const fail = results.filter(r => !r).length
  console.log(`\n${results.length - fail} passed / ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
})()
```

### Test: RevenueCat webhook auth

```js
// /tmp/test-rc-webhook-26.js
;(async () => {
  const BASE = 'http://localhost:3001'
  const J = { 'Content-Type': 'application/json' }

  // No auth → 401
  const r1 = await fetch(`${BASE}/api/iap/webhook`, {
    method: 'POST', headers: J, body: JSON.stringify({ event: {} })
  })
  console.log(r1.status === 401 ? 'PASS: no auth → 401' : `FAIL: got ${r1.status}`)

  // Wrong auth → 401
  const r2 = await fetch(`${BASE}/api/iap/webhook`, {
    method: 'POST',
    headers: { ...J, 'Authorization': 'wrong-secret' },
    body: JSON.stringify({ event: {} })
  })
  console.log(r2.status === 401 ? 'PASS: wrong auth → 401' : `FAIL: got ${r2.status}`)

  console.log('(Production test with real REVENUECAT_WEBHOOK_SECRET required for full validation)')
})()
```

### Test: Email dev mode (no RESEND_API_KEY)

```js
// /tmp/test-email-26.js
;(async () => {
  const BASE = 'http://localhost:3001'
  const J = { 'Content-Type': 'application/json' }
  const ADMIN = process.env.ADMIN_API_KEY ?? 'dev-admin-key-change-me'

  const res = await fetch(`${BASE}/api/email/win-back`, {
    method: 'POST',
    headers: { ...J, 'X-Admin-Key': ADMIN },
    body: JSON.stringify({ playerId: 'test-player-abc' }),
  })
  const data = await res.json()
  const ok = res.status === 200 && data.queued === true
  console.log(ok ? 'PASS: email win-back route' : `FAIL: ${JSON.stringify(data)}`)
})()
```

### Test: TTS and audio routes

```js
// /tmp/test-tts-26.js
;(async () => {
  const BASE = 'http://localhost:3001'
  const J = { 'Content-Type': 'application/json' }
  const ADMIN = process.env.ADMIN_API_KEY ?? 'dev-admin-key-change-me'

  // Admin TTS generate (dev mode: returns error because no Azure creds)
  const r1 = await fetch(`${BASE}/api/audio/generate`, {
    method: 'POST',
    headers: { ...J, 'X-Admin-Key': ADMIN },
    body: JSON.stringify({ factId: 'test-001', language: 'ja', text: '火星' }),
  })
  console.log(r1.status === 500 || r1.status === 200
    ? `PASS: /generate responded (${r1.status})`
    : `FAIL: unexpected ${r1.status}`)

  // No admin key → 403
  const r2 = await fetch(`${BASE}/api/audio/generate`, {
    method: 'POST', headers: J, body: '{}',
  })
  console.log(r2.status === 403 ? 'PASS: 403 without admin key' : `FAIL: got ${r2.status}`)

  // Audio serve → 404 for non-existent fact
  const r3 = await fetch(`${BASE}/api/audio/nonexistent_xyz_123`)
  console.log(r3.status === 404 ? 'PASS: audio 404' : `FAIL: got ${r3.status}`)
})()
```

### Test: Push notification send-test

```js
// /tmp/test-push-26.js
;(async () => {
  const BASE = 'http://localhost:3001'
  const J = { 'Content-Type': 'application/json' }
  const ADMIN = process.env.ADMIN_API_KEY ?? 'dev-admin-key-change-me'

  // Register a test token
  const r1 = await fetch(`${BASE}/api/notifications/register`, {
    method: 'POST', headers: J,
    body: JSON.stringify({ token: 'test-device-token-abc123', platform: 'android' }),
  })
  const d1 = await r1.json()
  console.log(d1.registered ? 'PASS: token registered' : `FAIL: ${JSON.stringify(d1)}`)

  // Send test push (dev mode)
  const r2 = await fetch(`${BASE}/api/notifications/send-test`, {
    method: 'POST',
    headers: { ...J, 'X-Admin-Key': ADMIN },
    body: JSON.stringify({ token: 'test-device-token-abc123', title: 'Test', body: 'Hello' }),
  })
  const d2 = await r2.json()
  console.log(d2.sent ? 'PASS: push sent (dev mode)' : `FAIL: ${JSON.stringify(d2)}`)

  // No admin key → 403
  const r3 = await fetch(`${BASE}/api/notifications/send-test`, {
    method: 'POST', headers: J, body: '{}',
  })
  console.log(r3.status === 403 ? 'PASS: 403 without admin key' : `FAIL: got ${r3.status}`)
})()
```

---

## Verification Gate

All items below must be true before Phase 26 is marked complete in PROGRESS.md.

### TypeScript
- [ ] `npm run typecheck` exits 0 with zero errors (client + server)
- [ ] `npm run build --prefix server` exits 0 with zero errors
- [ ] No `any` types introduced without explicit justification comment

### Route Coverage — every mounted route responds correctly
- [ ] `GET /api/health` → `200`
- [ ] `GET /api/health/ready` → `200` or `206` with `integrations` object
- [ ] `GET /api/audio/x` → `404 {"error":"Audio not found"}` (not generic 404)
- [ ] `POST /api/iap/verify {}` → `400 missing_fields`
- [ ] `POST /api/iap/webhook` (no auth) → `401`
- [ ] `GET /api/patrons/wall` → `200 { patrons: [], total: 0 }`
- [ ] `GET /api/season-pass/current` → `200` with season `id` field
- [ ] `GET /api/subscriptions/status` → `200` with `tiers` array
- [ ] Zero route files in `server/src/routes/` remain unmounted

### Integration Services (dev mode)
- [ ] `sendEmail()` returns `{ sent: true }` without crashing
- [ ] `sendPush()` returns `true` without crashing
- [ ] `generatePronunciationAudio()` returns `{ success: false, error: '...' }` without throwing
- [ ] `verifyWebhookSecret(undefined)` returns `false`
- [ ] `verifyWebhookSecret('')` returns `false`
- [ ] `productIdToTier('com.terragacha.terrapass.monthly')` returns `'terra_pass'`

### Health Endpoint
- [ ] `GET /api/health/ready` returns `{ status, integrations, environment }`
- [ ] Each integration key (`revenuecat`, `resend`, `fcm`, `azureTts`) is present in the response

### Configuration
- [ ] `server/.env.example` exists with all 20+ variable names documented
- [ ] `validateProductionConfig()` is exported from `server/src/config.ts` and called in `start()`
- [ ] SMTP fields (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`) are removed from `Config` interface
- [ ] No hardcoded API keys, tokens, or secrets in any source file
- [ ] `docker-compose.prod.yml` uses Docker secrets for all sensitive values

### Security
- [ ] `POST /api/iap/webhook` returns `401` without correct `Authorization` header
- [ ] `POST /api/audio/generate` returns `403` without `X-Admin-Key` header
- [ ] `POST /api/notifications/send-test` returns `403` without `X-Admin-Key`
- [ ] `factId` in audio routes is validated against `/^[a-zA-Z0-9_-]+$/`
- [ ] No `eval()`, `Function()`, or `innerHTML` with dynamic content introduced
- [ ] All user-facing input has length caps and type validation

### Smoke Test
- [ ] `npm run smoke-test --prefix server` exits 0 with dev server running
- [ ] All route checks print `PASS`
- [ ] Script exits 1 if any check fails

---

## Files Affected

### New files
| Path | Purpose |
|------|---------|
| `server/src/types/revenuecat.ts` | TypeScript types for RC API responses and webhook events |
| `server/src/services/revenuecatService.ts` | RevenueCat REST client + webhook secret verification |
| `server/src/services/pushService.ts` | FCM HTTP v1 push delivery using built-in `crypto` + `fetch` |
| `server/src/templates/email/welcome.html` | Welcome email HTML template (Resend) |
| `server/scripts/smoke-test.ts` | End-to-end route smoke test script |
| `server/.env.example` | All environment variable names with placeholder values |

### Modified files
| Path | Change |
|------|--------|
| `server/src/index.ts` | Import + register 5 unmounted routes; call `validateProductionConfig()`; schedule daily win-back cron |
| `server/src/config.ts` | Add 9 new fields; remove 4 SMTP fields; add `readDockerSecret()`; add `validateProductionConfig()` |
| `server/src/routes/iap.ts` | Named export; fix double-prefix; add real RC verify + webhook handler |
| `server/src/routes/patrons.ts` | Named export; fix double-prefix |
| `server/src/routes/seasonPass.ts` | Named export; fix double-prefix |
| `server/src/routes/subscriptions.ts` | Named export; fix double-prefix |
| `server/src/routes/audio.ts` | Fix double-prefix; add `POST /generate` admin endpoint |
| `server/src/routes/health.ts` | Add `GET /ready` integration status endpoint |
| `server/src/routes/notifications.ts` | Add in-memory token store; add `POST /send-test` admin endpoint |
| `server/src/routes/auth.ts` | Send welcome email (non-fatal) after registration |
| `server/src/services/emailService.ts` | Replace console.log stub with Resend REST; add `renderTemplate()`; add `'welcome'` to union; remove SMTP references |
| `server/src/services/ttsService.ts` | Replace stub with Azure TTS REST; add `buildSSML()`; add throttle in batch |
| `server/src/jobs/winBackCron.ts` | Call real `sendEmail` and `sendPush` (player query remains a stub pending production DB) |
| `server/src/scripts/fact-count-check.ts` | Add audio file coverage reporting |
| `docker-compose.prod.yml` | Add Docker secrets declarations for all sensitive values |
| `server/package.json` | Add `"smoke-test"` npm script |

### No changes needed
| Path | Reason |
|------|--------|
| `server/src/routes/seasons.ts` | Already mounted in index.ts |
| `server/src/routes/email.ts` | Already mounted; content unchanged |
| `server/src/routes/ugc.ts` | Already mounted; content unchanged |
| `server/src/routes/notifications.ts` prefix | Already mounted; only body content changes |
| `server/src/services/notificationScheduler.ts` | Pure logic library; called by winBackCron |
| `server/src/services/winBackService.ts` | Pure logic library; no changes needed |
| `src/services/subscriptionService.ts` | Client stub; no server changes required |
| `src/services/adService.ts` | Opt-in ads disabled at launch (DD-V2-146) |
