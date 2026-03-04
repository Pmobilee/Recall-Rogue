/**
 * In-App Purchase verification routes (DD-V2-145).
 * Receipt verification via RevenueCat REST API.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export default async function iapRoutes(fastify: FastifyInstance) {
  /** POST /api/iap/verify — verify IAP receipt */
  fastify.post('/api/iap/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>
    const productId = body?.productId as string
    const receipt = body?.receipt as string

    if (!productId || !receipt) {
      return reply.status(400).send({ error: 'missing_fields', message: 'productId and receipt are required' })
    }

    // In production, forward receipt to RevenueCat REST API for validation
    // RevenueCat handles both Apple and Google receipt verification
    return {
      valid: false,
      productId,
      message: 'Receipt verification stub — production will validate via RevenueCat',
    }
  })

  /** POST /api/iap/restore — handle restore purchases request */
  fastify.post('/api/iap/restore', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      restoredProducts: [] as string[],
      message: 'Restore purchases stub — production will query RevenueCat',
    }
  })
}
