/**
 * Webhook subscription management routes.
 * API key holders can register up to 5 webhook endpoints per key.
 * Payloads are signed with HMAC-SHA256 using per-subscription secrets.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'
import { validateApiKey } from '../services/apiKeyService.js'

/**
 * Register webhook subscription routes under /api/webhooks.
 *
 * @param app - The Fastify instance to register routes on.
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // POST / — register a new webhook endpoint
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })
    const key = validateApiKey(rawKey)
    if (!key) return reply.status(401).send({ error: 'Invalid API key' })

    const body = req.body as { endpointUrl: string; events: string[] }
    if (!body.endpointUrl || !Array.isArray(body.events) || body.events.length === 0) {
      return reply.status(400).send({ error: 'endpointUrl and events[] required' })
    }

    // Limit to 5 subscriptions per key
    const count = (factsDb.prepare(
      `SELECT COUNT(*) as c FROM webhook_subscriptions WHERE key_id = ?`
    ).get(key.id) as { c: number }).c
    if (count >= 5) {
      return reply.status(400).send({ error: 'Maximum 5 webhook subscriptions per API key' })
    }

    const id = crypto.randomUUID()
    const secret = crypto.randomBytes(32).toString('hex')

    for (const event of body.events) {
      factsDb.prepare(`
        INSERT INTO webhook_subscriptions
          (id, key_id, endpoint_url, event, secret, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(
        `${id}-${event}`, key.id, body.endpointUrl.slice(0, 500),
        event, secret, Date.now()
      )
    }

    return reply.status(201).send({
      subscriptionId: id,
      secret,  // Return once — use this to verify HMAC signatures
      events: body.events,
      endpointUrl: body.endpointUrl
    })
  })

  // GET / — list active webhook subscriptions for this key
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })
    const key = validateApiKey(rawKey)
    if (!key) return reply.status(401).send({ error: 'Invalid API key' })

    const subs = factsDb.prepare(
      `SELECT id, endpoint_url, event, is_active, created_at
       FROM webhook_subscriptions WHERE key_id = ? AND is_active = 1`
    ).all(key.id)

    return reply.send({ subscriptions: subs })
  })

  // DELETE /:id — unsubscribe (deactivate all rows for this subscription group)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })
    const key = validateApiKey(rawKey)
    if (!key) return reply.status(401).send({ error: 'Invalid API key' })

    const { id } = req.params as { id: string }
    factsDb.prepare(
      `UPDATE webhook_subscriptions SET is_active = 0 WHERE id LIKE ? AND key_id = ?`
    ).run(`${id}%`, key.id)

    return reply.status(204).send()
  })
}
