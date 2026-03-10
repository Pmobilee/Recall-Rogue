/**
 * Subscription management routes (DD-V2-145, DD-V2-154).
 * Handles subscription verification, status, and content volume gate.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { factsDb } from '../db/facts-db.js'

/** Content volume gate: minimum approved facts before subscriptions activate */
const MINIMUM_FACTS_REQUIRED = 3000

function getApprovedFactCount(): number {
  try {
    const row = factsDb
      .prepare(`SELECT COUNT(*) as c FROM facts WHERE status = 'approved'`)
      .get() as { c?: number }
    return Math.max(0, row?.c ?? 0)
  } catch {
    return 0
  }
}

export async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /status — returns subscription availability and current state */
  fastify.get('/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const factsReady = getApprovedFactCount()
    const available = factsReady >= MINIMUM_FACTS_REQUIRED

    return {
      available,
      factsReady,
      required: MINIMUM_FACTS_REQUIRED,
      tiers: [
        { id: 'terra_pass', name: 'Terra Pass', priceUSD: 4.99, period: 'monthly' },
        { id: 'expedition_patron', name: 'Expedition Patron', priceUSD: 24.99, period: 'season' },
        { id: 'grand_patron', name: 'Grand Patron', priceUSD: 49.99, period: 'yearly' },
      ],
    }
  })

  /** POST /verify — RevenueCat webhook handler */
  fastify.post('/verify', async (_request: FastifyRequest, reply: FastifyReply) => {
    const factCount = getApprovedFactCount()
    // Content volume gate check
    if (factCount < MINIMUM_FACTS_REQUIRED) {
      return reply.status(503).send({
        error: 'subscription_not_yet_available',
        factsReady: factCount,
        required: MINIMUM_FACTS_REQUIRED,
      })
    }

    return {
      valid: true,
      message: 'Subscription verified (stub — production will validate via RevenueCat)',
    }
  })

  /** POST /record-cosmetic — records monthly cosmetic grant */
  fastify.post('/record-cosmetic', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Monthly cosmetic grant logic
    return { granted: false, message: 'Monthly cosmetic grant (stub)' }
  })
}
