/**
 * Webhook delivery service.
 * Supports up to 5 registered endpoints per API key.
 * Retries with exponential back-off: 10s, 30s, 2min, 10min, then drops.
 */
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'

export type WebhookEvent =
  | 'ugc.submitted'
  | 'ugc.approved'
  | 'ugc.rejected'
  | 'ugc.ready_for_review'
  | 'fact.updated'
  | 'fact.deleted'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

const RETRY_DELAYS_MS = [10_000, 30_000, 120_000, 600_000]

/** Webhook subscription row shape from DB. */
interface WebhookSubRow {
  id: string
  endpoint_url: string
  secret: string
}

/**
 * Trigger a webhook event.
 * Fans out to all active subscriptions for the given event.
 * Delivery is non-blocking (fire-and-forget with retry queue).
 *
 * @param event - The webhook event type to trigger.
 * @param data  - Event-specific payload data.
 */
export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const subs = factsDb.prepare(`
    SELECT ws.id, ws.endpoint_url, ws.secret
    FROM webhook_subscriptions ws
    JOIN api_keys ak ON ak.id = ws.key_id
    WHERE ws.event = ? AND ws.is_active = 1 AND ak.is_active = 1
  `).all(event) as WebhookSubRow[]

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  }
  const body = JSON.stringify(payload)

  for (const sub of subs) {
    void deliverWithRetry(sub.endpoint_url, sub.secret, body, 0)
  }
}

/**
 * Deliver a webhook payload to a single endpoint with exponential back-off retry.
 *
 * @param url     - The endpoint URL to POST to.
 * @param secret  - The HMAC secret for signature generation.
 * @param body    - The JSON stringified payload body.
 * @param attempt - Current attempt number (0-indexed).
 */
async function deliverWithRetry(
  url: string, secret: string, body: string, attempt: number
): Promise<void> {
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RecallRogue-Signature': `sha256=${signature}`,
        'X-RecallRogue-Attempt': String(attempt + 1)
      },
      body,
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok && attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      return deliverWithRetry(url, secret, body, attempt + 1)
    }
  } catch {
    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      return deliverWithRetry(url, secret, body, attempt + 1)
    }
    // Final failure: log and drop
    console.error(`[webhooks] Delivery to ${url} failed after ${attempt + 1} attempts`)
  }
}
