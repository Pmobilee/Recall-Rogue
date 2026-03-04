/**
 * Patron tier routes (DD-V2-153).
 * Patron Wall data and patron features.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export default async function patronRoutes(fastify: FastifyInstance) {
  /** GET /api/patrons/wall — returns opted-in patron display names */
  fastify.get('/api/patrons/wall', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // In production, this queries the patrons table for opted-in display names
    // Stub returns empty list for now
    return {
      patrons: [] as Array<{ displayName: string; tier: string; since: string }>,
      total: 0,
    }
  })
}
