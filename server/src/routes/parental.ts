import { FastifyInstance } from 'fastify'

/**
 * Parental control routes.
 * Weekly summary email, time limit sync, content filtering.
 */
export async function parentalRoutes(app: FastifyInstance): Promise<void> {
  // Get parental settings for a player
  app.get('/:playerId/settings', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    return reply.send({
      playerId,
      kidMode: false,
      maxDailyMinutes: 60,
      socialEnabled: false,
      weeklyReportEnabled: false
    })
  })

  // Update parental settings
  app.put('/:playerId/settings', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    const settings = req.body as Record<string, unknown>
    return reply.send({ playerId, updated: true, settings })
  })

  // Get weekly learning summary (for parent email)
  app.get('/:playerId/weekly-summary', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    return reply.send({
      playerId,
      period: { start: '', end: '' },
      totalPlayMinutes: 0,
      factsLearned: 0,
      factsMastered: 0,
      streakDays: 0,
      topCategories: [],
      socialInteractions: 0
    })
  })
}
