/**
 * Season Pass routes (DD-V2-149).
 * Provides current season metadata and player progress.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export default async function seasonPassRoutes(fastify: FastifyInstance) {
  /** GET /api/season/current — returns current season definition */
  fastify.get('/api/season/current', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      id: 'season_1_deep_time',
      name: 'Knowledge Expedition: Deep Time',
      theme: 'deep_time',
      startDate: '2026-04-01',
      endDate: null,
      milestonesCount: 8,
      maxPoints: 2000,
      rules: {
        neverExpires: true,
        factsAddedToFreePoolAfterSeason: true,
        progressTiedToLearning: true,
      },
    }
  })
}
