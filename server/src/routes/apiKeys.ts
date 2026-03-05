/**
 * API key management routes.
 * Authenticated players can create, list, and revoke their own API keys.
 * Admin can create keys for any tier without JWT.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../middleware/adminAuth.js'
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getDailyUsage,
} from '../services/apiKeyService.js'

/**
 * Register API key management routes under /api/keys.
 *
 * @param app - The Fastify instance to register routes on.
 */
export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/keys — admin creates a key (any tier)
  app.post('/', { preHandler: requireAdmin }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { name?: string; tier?: string; ownerId?: string }
    if (!body.name) {
      return reply.status(400).send({ error: 'name is required' })
    }
    const tier = (body.tier ?? 'free') as 'free' | 'institutional' | 'enterprise'
    if (!['free', 'institutional', 'enterprise'].includes(tier)) {
      return reply.status(400).send({ error: 'tier must be free | institutional | enterprise' })
    }
    const result = createApiKey(body.name, tier, body.ownerId ?? null)
    return reply.status(201).send({
      apiKey: result.apiKey,
      rawKey: result.rawKey,
      message: 'Store the rawKey securely — it will not be shown again.'
    })
  })

  // POST /api/keys/self — authenticated player creates a free key for themselves
  app.post('/self', { preHandler: requireAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(req)
    const body = req.body as { name?: string }
    if (!body.name) {
      return reply.status(400).send({ error: 'name is required' })
    }
    const result = createApiKey(body.name.slice(0, 100), 'free', user.sub)
    return reply.status(201).send({
      apiKey: result.apiKey,
      rawKey: result.rawKey,
      message: 'Store the rawKey securely — it will not be shown again.'
    })
  })

  // GET /api/keys/self — list the authenticated player's keys
  app.get('/self', { preHandler: requireAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(req)
    const keys = listApiKeys(user.sub)
    return reply.send({ keys })
  })

  // GET /api/keys/:keyId/usage — get usage stats for a key
  app.get('/:keyId/usage', { preHandler: requireAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { keyId } = req.params as { keyId: string }
    const user = getAuthUser(req)
    const keys = listApiKeys(user.sub)
    const key = keys.find(k => k.id === keyId)
    if (!key) {
      return reply.status(404).send({ error: 'API key not found or not owned by this user' })
    }
    const dailyUsage = getDailyUsage(keyId)
    return reply.send({
      keyId,
      dailyUsage,
      quotaPerDay: key.quotaPerDay,
      remaining: Math.max(0, key.quotaPerDay - dailyUsage)
    })
  })

  // DELETE /api/keys/:keyId — revoke a key (owner or admin)
  app.delete('/:keyId', { preHandler: requireAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { keyId } = req.params as { keyId: string }
    const user = getAuthUser(req)
    revokeApiKey(keyId, user.sub)
    return reply.status(204).send()
  })
}
