/**
 * Educator account endpoints for Terra Gacha.
 * Handles educator verification requests and status checks.
 *
 * Routes (registered under /api/educator):
 *   POST /verify-request — submit an educator verification request
 *   GET  /status         — check the caller's educator verification status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, educatorVerificationRequests } from '../db/schema.js'
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import { looksLikeEducationalDomain, extractEmailDomain } from '../services/educatorDomainValidator.js'

/**
 * Register educator account endpoints.
 *
 * @param app - The Fastify application instance.
 */
export async function educatorRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /api/educator/verify-request
   * Submit an educator verification request.
   * The user must already be logged in as a regular player account.
   * Body: { schoolName: string; schoolUrl?: string; verificationNote?: string }
   */
  app.post(
    '/verify-request',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId, email } = getAuthUser(request)

      // Prevent duplicate submissions
      const existing = await db
        .select()
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.userId, userId))
        .get()

      if (existing && existing.status === 'pending') {
        return reply.status(409).send({ error: 'Verification request already pending' })
      }
      if (existing && existing.status === 'approved') {
        return reply.status(409).send({ error: 'Account is already an approved educator' })
      }

      const body = request.body as {
        schoolName?: string
        schoolUrl?: string
        verificationNote?: string
      }

      if (!body.schoolName || body.schoolName.trim().length === 0) {
        return reply.status(400).send({ error: 'School name is required' })
      }

      const domain = extractEmailDomain(email)
      if (!domain) {
        return reply.status(400).send({ error: 'Unable to determine email domain' })
      }

      const domainIsEducational = looksLikeEducationalDomain(domain)

      const requestRecord = {
        id: crypto.randomUUID(),
        userId,
        schoolName: body.schoolName.trim().slice(0, 200),
        emailDomain: domain,
        schoolUrl: body.schoolUrl?.trim().slice(0, 500) ?? null,
        verificationNote: body.verificationNote?.trim().slice(0, 500) ?? null,
        status: 'pending' as const,
        reviewedBy: null,
        reviewNote: null,
        submittedAt: Date.now(),
        reviewedAt: null,
      }

      await db.insert(educatorVerificationRequests).values(requestRecord)

      // Flag on the user record immediately so the frontend can show the pending state
      await db
        .update(users)
        .set({ educatorVerification: 'pending' })
        .where(eq(users.id, userId))

      return reply.status(201).send({
        requestId: requestRecord.id,
        domainIsEducational,
        message: domainIsEducational
          ? 'Request submitted. Your domain looks educational — typical review time is 1–2 business days.'
          : 'Request submitted. Your email domain is not a standard .edu domain, so manual review may take longer (3–5 business days).',
      })
    },
  )

  /**
   * GET /api/educator/status
   * Check the caller's current educator verification status.
   * Returns role, verificationStatus, and rejection reason if rejected.
   */
  app.get(
    '/status',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request)

      const user = await db
        .select({
          role: users.role,
          educatorVerification: users.educatorVerification,
          classLimit: users.classLimit,
        })
        .from(users)
        .where(eq(users.id, userId))
        .get()

      if (!user) return reply.status(404).send({ error: 'User not found' })

      const verReq = await db
        .select({ reviewNote: educatorVerificationRequests.reviewNote })
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.userId, userId))
        .get()

      return reply.send({
        role: user.role ?? 'player',
        verificationStatus: user.educatorVerification ?? 'not_requested',
        rejectionReason: verReq?.reviewNote ?? null,
        classLimit: user.classLimit ?? 5,
      })
    },
  )
}
