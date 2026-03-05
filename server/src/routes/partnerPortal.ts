/**
 * Educational Partnership Portal routes.
 * Institutions register for verified API access, view usage dashboards,
 * and configure content filters for their deployment.
 * DD-V2-200: Educational partnerships for institutional API access.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'
import { requireAdmin } from '../middleware/adminAuth.js'
import { createApiKey } from '../services/apiKeyService.js'
import { sendPartnerWelcomeEmail } from '../services/emailService.js'

/**
 * Register partner portal routes under /api/partner.
 *
 * @param app - The Fastify instance to register routes on.
 */
export async function partnerPortalRoutes(app: FastifyInstance): Promise<void> {
  // POST /register — institution self-registration
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      name: string; domain: string; orgType: string
      contactEmail: string; contactName: string
    }
    if (!body.name || !body.domain || !body.contactEmail || !body.contactName) {
      return reply.status(400).send({ error: 'All fields required' })
    }
    // Basic domain format validation
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(body.domain.toLowerCase())) {
      return reply.status(400).send({ error: 'Invalid domain format' })
    }

    const id = crypto.randomUUID()
    const now = Date.now()
    try {
      factsDb.prepare(`
        INSERT INTO partner_orgs
          (id, name, domain, org_type, contact_email, contact_name,
           license_tier, verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      `).run(id, body.name.slice(0, 200), body.domain.slice(0, 100).toLowerCase(),
             body.orgType, body.contactEmail.slice(0, 200), body.contactName.slice(0, 200),
             now, now)
    } catch {
      return reply.status(409).send({ error: 'Domain already registered' })
    }

    // Notify admin of new application (non-blocking)
    sendPartnerWelcomeEmail(body.contactEmail, body.name).catch(console.error)

    return reply.status(201).send({
      partnerId: id,
      status: 'pending',
      message: 'Application received. You will be contacted within 2 business days.'
    })
  })

  // POST /verify/:partnerId — admin approves and issues institutional API key
  app.post('/verify/:partnerId', { preHandler: requireAdmin }, async (req, reply) => {
    const { partnerId } = req.params as { partnerId: string }
    const { tier } = req.body as { tier?: 'institutional' | 'enterprise' }
    const resolvedTier = tier ?? 'institutional'

    const org = factsDb.prepare(
      `SELECT * FROM partner_orgs WHERE id = ?`
    ).get(partnerId) as Record<string, unknown> | undefined

    if (!org) return reply.status(404).send({ error: 'Partner not found' })

    const { apiKey, rawKey } = createApiKey(
      `${String(org.name)} — ${resolvedTier}`,
      resolvedTier,
      null
    )

    factsDb.prepare(`
      UPDATE partner_orgs
      SET verified = 1, license_tier = ?, api_key_id = ?, updated_at = ?
      WHERE id = ?
    `).run(resolvedTier, apiKey.id, Date.now(), partnerId)

    return reply.send({
      partnerId,
      tier: resolvedTier,
      apiKeyId: apiKey.id,
      rawKey,  // Show once — admin must securely deliver this to the partner
      message: 'Partner verified. Send rawKey to partner via secure channel.'
    })
  })

  // GET /dashboard — partner views their own usage
  app.get('/dashboard', async (req, reply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyRow = factsDb.prepare(
      `SELECT ak.id, ak.tier, ak.quota_per_day, ak.quota_per_min, ak.is_active,
              po.name as org_name, po.org_type, po.domain
       FROM api_keys ak
       LEFT JOIN partner_orgs po ON po.api_key_id = ak.id
       WHERE ak.key_hash = ? AND ak.is_active = 1`
    ).get(keyHash) as Record<string, unknown> | undefined

    if (!keyRow) return reply.status(401).send({ error: 'Invalid API key' })

    // Last 7 days of hourly usage
    const since = Date.now() - 7 * 86_400_000
    const usage = factsDb.prepare(`
      SELECT endpoint, SUM(request_count) as total_requests
      FROM usage_logs
      WHERE key_id = ? AND hour_bucket >= ?
      GROUP BY endpoint ORDER BY total_requests DESC
    `).all(keyRow.id, Math.floor(since / 3_600_000) * 3_600_000) as
      { endpoint: string; total_requests: number }[]

    return reply.send({
      org: { name: keyRow.org_name, domain: keyRow.domain, tier: keyRow.tier },
      quota: { perDay: keyRow.quota_per_day, perMin: keyRow.quota_per_min },
      usageLast7Days: usage
    })
  })

  // PUT /dashboard/config — update content configuration
  app.put('/dashboard/config', async (req, reply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyRow = factsDb.prepare(
      `SELECT ak.id, po.id as partner_id
       FROM api_keys ak
       JOIN partner_orgs po ON po.api_key_id = ak.id
       WHERE ak.key_hash = ? AND ak.is_active = 1`
    ).get(keyHash) as { id: string; partner_id: string } | undefined

    if (!keyRow) return reply.status(401).send({ error: 'Invalid API key or no partner org' })

    const { ageRating, categories, maxDifficulty } = req.body as {
      ageRating?: string; categories?: string[]; maxDifficulty?: number
    }
    const contentConfig = JSON.stringify({ ageRating, categories, maxDifficulty })
    factsDb.prepare(
      'UPDATE partner_orgs SET content_config = ?, updated_at = ? WHERE id = ?'
    ).run(contentConfig, Date.now(), keyRow.partner_id)

    return reply.send({ success: true })
  })
}
