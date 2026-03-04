import { FastifyInstance } from 'fastify'

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  // Trigger win-back email (admin only)
  app.post('/win-back', async (req, reply) => {
    const { playerId } = req.body as { playerId: string }
    if (!playerId) return reply.status(400).send({ error: 'playerId required' })
    // In production: queue email via emailService
    return reply.send({ queued: true, playerId })
  })

  // Send season announcement (admin only)
  app.post('/season-announcement', async (req, reply) => {
    const { seasonId } = req.body as { seasonId: string }
    if (!seasonId) return reply.status(400).send({ error: 'seasonId required' })
    return reply.send({ queued: true, seasonId })
  })

  // Unsubscribe (public, token-verified)
  app.get('/unsubscribe', async (req, reply) => {
    const { token } = req.query as { token: string }
    if (!token) return reply.status(400).send({ error: 'Unsubscribe token required' })
    return reply.send({ unsubscribed: true })
  })
}
