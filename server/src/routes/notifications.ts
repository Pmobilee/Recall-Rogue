import { FastifyInstance } from 'fastify'

export interface NotificationPreferences {
  dailyReminder: boolean
  streakAlert: boolean
  seasonAnnouncement: boolean
  weeklyDigest: boolean
  maxPerDay: number  // DD-V2-159: max 1/day default
}

const DEFAULT_PREFS: NotificationPreferences = {
  dailyReminder: true,
  streakAlert: true,
  seasonAnnouncement: true,
  weeklyDigest: false,
  maxPerDay: 1
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // Register device push token
  app.post('/register', async (req, reply) => {
    const { token, platform } = req.body as { token: string; platform: 'ios' | 'android' | 'web' }
    if (!token || !platform) return reply.status(400).send({ error: 'Token and platform required' })
    // Store token (in production: database)
    return reply.send({ registered: true })
  })

  // Get notification preferences
  app.get('/preferences', async (_req, reply) => {
    return reply.send({ preferences: DEFAULT_PREFS })
  })

  // Update notification preferences
  app.put('/preferences', async (req, reply) => {
    const prefs = req.body as Partial<NotificationPreferences>
    const merged = { ...DEFAULT_PREFS, ...prefs, maxPerDay: Math.min(prefs.maxPerDay ?? 1, 3) }
    return reply.send({ preferences: merged })
  })

  // Unregister device
  app.delete('/unregister', async (req, reply) => {
    const { token } = req.body as { token: string }
    if (!token) return reply.status(400).send({ error: 'Token required' })
    return reply.send({ unregistered: true })
  })
}
