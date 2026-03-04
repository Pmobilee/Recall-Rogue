/**
 * Subscription management routes (DD-V2-145, DD-V2-154).
 * Handles subscription verification, status, and content volume gate.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

/** Content volume gate: minimum approved facts before subscriptions activate */
const MINIMUM_FACTS_REQUIRED = 3000
const CURRENT_FACT_COUNT = 522 // Updated by content pipeline

export default async function subscriptionRoutes(fastify: FastifyInstance) {
  /** GET /api/subscriptions/status — returns subscription availability and current state */
  fastify.get('/api/subscriptions/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const factsReady = CURRENT_FACT_COUNT
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

  /** POST /api/subscriptions/verify — RevenueCat webhook handler */
  fastify.post('/api/subscriptions/verify', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Content volume gate check
    if (CURRENT_FACT_COUNT < MINIMUM_FACTS_REQUIRED) {
      return reply.status(503).send({
        error: 'subscription_not_yet_available',
        factsReady: CURRENT_FACT_COUNT,
        required: MINIMUM_FACTS_REQUIRED,
      })
    }

    // In production, this would validate RevenueCat webhook signature
    // and update the user's subscription record in the database
    // const body = request.body as Record<string, unknown>

    return {
      valid: true,
      message: 'Subscription verified (stub — production will validate via RevenueCat)',
    }
  })

  /** POST /api/subscriptions/record-cosmetic — records monthly cosmetic grant */
  fastify.post('/api/subscriptions/record-cosmetic', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Monthly cosmetic grant logic
    return { granted: false, message: 'Monthly cosmetic grant (stub)' }
  })
}
